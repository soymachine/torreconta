import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { centsAInput, errorMsg, Euros, Modal } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { calcularFactura, TIPOS_IRPF, TIPOS_IVA, type LineaFactura } from '../../lib/contabilizacion'
import { cuentasDeGasto, esImputable } from '../../lib/cuentas'
import { raizDeSeleccion, valorCategoria } from '../../lib/categoriasGasto'
import { asegurarCategoria } from '../../services/categorias'
import { diasEntre, sumarDias } from '../../lib/vencimientos'
import { CategoriaGastoSelect } from './CategoriaGastoSelect'
import { parseEuros } from '../../lib/money'
import type { FacturaEmitida, FacturaRecibida, Tercero, TipoTercero } from '../../lib/tipos'
import { guardarFacturaEmitida, guardarFacturaRecibida } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'
import { TerceroForm } from '../terceros/TerceroForm'
import { claveLinea, primerError, validarFormularioFactura, type ErroresFactura } from './validarFactura'

interface LineaEdit {
  concepto: string
  cantidad: string
  precio: string
  ivaPct: number
}

const lineaVacia = (): LineaEdit => ({ concepto: '', cantidad: '1', precio: '', ivaPct: 21 })

type Props =
  | { tipo: 'emitida'; existente?: FacturaEmitida; fechaInicial: string; onDone: () => void }
  | { tipo: 'recibida'; existente?: FacturaRecibida; fechaInicial: string; onDone: () => void }

export function FacturaForm(props: Props) {
  const { tipo, existente, fechaInicial, onDone } = props
  const { eid, anio, empresa, cuentas, terceros, categorias } = useLibros()
  const tiposTercero: TipoTercero[] = tipo === 'emitida' ? ['cliente'] : ['proveedor', 'acreedor']
  const recibida = tipo === 'recibida' ? props.existente : undefined
  const emitida = tipo === 'emitida' ? props.existente : undefined

  const [fecha, setFecha] = useState(existente?.fecha ?? fechaInicial)
  // Vencimiento del pago (solo facturas recibidas); por defecto, al contado.
  const [vencimiento, setVencimiento] = useState(recibida ? recibida.vencimiento ?? recibida.fecha : existente?.fecha ?? fechaInicial)
  const plazoActual = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && /^\d{4}-\d{2}-\d{2}$/.test(vencimiento) ? diasEntre(fecha, vencimiento) : null
  /** Al cambiar la fecha de la factura se mantiene el plazo elegido. */
  const cambiarFecha = (nueva: string) => {
    if (plazoActual !== null && plazoActual >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(nueva)) setVencimiento(sumarDias(nueva, plazoActual))
    setFecha(nueva)
  }
  const [numero, setNumero] = useState(recibida?.numero ?? '')
  const [terceroId, setTerceroId] = useState(existente?.terceroId ?? '')
  // Selección `cat:<id>` (categoría) o `cta:<codigo>` (cuenta mayor 6xx aún sin categoría).
  const [seleccion, setSeleccion] = useState(recibida ? valorCategoria(recibida.categoriaId) : '')
  const [cuentaGasto, setCuentaGasto] = useState(recibida?.cuentaGasto ?? '')
  const [ivaDeducible, setIvaDeducible] = useState(recibida?.ivaDeducible ?? true)
  const [cuentaIngreso, setCuentaIngreso] = useState(emitida?.cuentaIngreso ?? '705')
  const [irpfPct, setIrpfPct] = useState(existente?.irpfPct ?? 0)
  const [lineas, setLineas] = useState<LineaEdit[]>(
    existente
      ? existente.lineas.map((l) => ({ concepto: l.concepto, cantidad: String(l.cantidad).replace('.', ','), precio: centsAInput(l.precioCent), ivaPct: l.ivaPct }))
      : [lineaVacia()],
  )
  const [nuevoTercero, setNuevoTercero] = useState(false)
  const [extraTerceros, setExtraTerceros] = useState<Tercero[]>([])
  const [errores, setErrores] = useState<ErroresFactura>({})
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const esRecibida = tipo === 'recibida'
  const etiquetaImporte = esRecibida ? 'Base imponible' : 'Precio'

  /** Quita el error de un campo en cuanto el usuario lo modifica. */
  const limpiar = (...claves: string[]) =>
    setErrores((e) => {
      if (!claves.some((k) => k in e)) return e
      const n = { ...e }
      for (const k of claves) delete n[k]
      if (claves.some((k) => k.startsWith('linea.'))) delete n.lineas
      return n
    })
  const inv = (k: string) => (errores[k] ? true : undefined)
  const [saving, setSaving] = useState(false)

  const opcionesTercero = [...terceros, ...extraTerceros.filter((t) => !terceros.some((x) => x.id === t.id))].filter(
    (t) => tiposTercero.includes(t.tipo) && (t.activo || t.id === terceroId),
  )
  const cuentasIngreso = cuentas.filter((c) => c.codigo.startsWith('7') && esImputable(c, cuentas))
  // Si la cuenta de la categoría tiene subcuentas, hay que elegir una de ellas (nunca la cuenta raíz).
  const raiz = raizDeSeleccion(seleccion, categorias)
  const opcionesGasto = raiz ? cuentasDeGasto(raiz, cuentas) : []
  const cuentaGastoFinal = opcionesGasto.length === 1 ? opcionesGasto[0].codigo : cuentaGasto

  const parsed = lineas.map((l): LineaFactura | null => {
    const cantidad = Number(l.cantidad.replace(',', '.'))
    const precio = parseEuros(l.precio)
    if (!Number.isFinite(cantidad) || precio === null) return null
    return { concepto: l.concepto.trim(), cantidad, precioCent: precio, ivaPct: l.ivaPct }
  })
  const validas = parsed.filter((l): l is LineaFactura => l !== null)
  const calculo = calcularFactura(validas, irpfPct)

  const cambiarCategoria = (valor: string) => {
    setSeleccion(valor)
    limpiar('categoria', 'cuentaGasto')
    // Se conserva la subcuenta elegida solo si sigue siendo válida para la nueva selección.
    const r = raizDeSeleccion(valor, categorias)
    if (!r || !cuentasDeGasto(r, cuentas).some((c) => c.codigo === cuentaGasto)) setCuentaGasto('')
  }

  const elegirTercero = (id: string, lista = opcionesTercero) => {
    setTerceroId(id)
    limpiar('tercero', 'categoria')
    const t = lista.find((x) => x.id === id)
    if (tipo === 'recibida' && t?.categoriaPorDefectoId) {
      cambiarCategoria(valorCategoria(t.categoriaPorDefectoId))
      if (t.cuentaGastoPorDefecto) setCuentaGasto(t.cuentaGastoPorDefecto)
    }
  }

  const set = (i: number, campo: keyof LineaEdit, v: string | number) => {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)))
    if (campo !== 'ivaPct') limpiar(claveLinea(i, campo))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const errs = validarFormularioFactura({
      tipo,
      anio: existente?.ejercicio ?? anio,
      fecha,
      vencimiento: tipo === 'recibida' ? vencimiento : undefined,
      numero,
      terceroId,
      categoriaId: seleccion,
      raizCuentaGasto: raiz,
      opcionesCuentaGasto: opcionesGasto.map((c) => c.codigo),
      cuentaGasto: cuentaGastoFinal,
      cuentaIngreso,
      cuentasIngresoValidas: cuentasIngreso.map((c) => c.codigo),
      lineas,
    })
    setErrores(errs)
    const primero = primerError(errs)
    if (primero) {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-campo="${primero}"] :is(input, button)`)
      el?.focus()
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    const tercero = opcionesTercero.find((t) => t.id === terceroId)!
    const utiles = validas.filter((l) => l.concepto || l.precioCent)
    setSaving(true)
    try {
      if (tipo === 'emitida') {
        await guardarFacturaEmitida(
          eid,
          { serie: empresa.serieFacturas, anio, cuentas },
          { fecha, tercero, lineas: utiles, irpfPct, cuentaIngreso },
          emitida,
        )
        toast.success(emitida ? `Factura ${emitida.numero} actualizada` : 'Factura emitida registrada')
      } else {
        // Si se eligió una cuenta mayor sin categoría, se crea su categoría ahora.
        const categoria = await asegurarCategoria(eid, seleccion, categorias, cuentas)
        await guardarFacturaRecibida(
          eid,
          { anio, cuentas },
          { fecha, numero, tercero, lineas: utiles, irpfPct, ivaDeducible, categoria, cuentaGasto: cuentaGastoFinal, vencimiento },
          recibida,
        )
        toast.success(recibida ? `Factura ${recibida.numero} actualizada` : 'Factura recibida registrada')
      }
      onDone()
    } catch (err) {
      setError(errorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo k="fecha">
          <Field label="Fecha" error={errores.fecha}>
            <Input type="date" aria-invalid={inv('fecha')} value={fecha} min={`${existente?.ejercicio ?? anio}-01-01`} max={`${existente?.ejercicio ?? anio}-12-31`} onChange={(e) => { cambiarFecha(e.target.value); limpiar('fecha', 'vencimiento') }} />
          </Field>
        </Campo>
        {tipo === 'recibida' ? (
          <>
          <Campo k="numero">
            <Field label="Nº de factura del proveedor" error={errores.numero}>
              <Input aria-invalid={inv('numero')} value={numero} onChange={(e) => { setNumero(e.target.value); limpiar('numero') }} maxLength={40} />
            </Field>
          </Campo>
          <Campo k="vencimiento">
            <Field label="Vencimiento" error={errores.vencimiento}>
              <Input
                type="date"
                aria-label="Vencimiento"
                aria-invalid={inv('vencimiento')}
                value={vencimiento}
                min={fecha}
                onChange={(e) => { setVencimiento(e.target.value); limpiar('vencimiento') }}
              />
              <span className="flex flex-wrap gap-1 pt-1">
                {[0, 30, 60, 90].map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={(ev) => { ev.preventDefault(); setVencimiento(sumarDias(fecha, dias)); limpiar('vencimiento') }}
                    className={`rounded border px-1.5 py-0.5 text-xs ${plazoActual === dias ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {dias === 0 ? 'Al contado' : `${dias} días`}
                  </button>
                ))}
              </span>
            </Field>
          </Campo>
          </>
        ) : (
          <Field label="Número" hint="Se asigna al guardar">
            <Input value={emitida?.numero ?? `${empresa.serieFacturas}${anio}-…`} disabled />
          </Field>
        )}
        <Campo k="tercero">
        <Field label={tipo === 'emitida' ? 'Cliente' : 'Proveedor'} error={errores.tercero}>
          <div className="flex gap-2">
            <Select value={terceroId} onChange={(e) => elegirTercero(e.target.value)} aria-label={tipo === 'emitida' ? 'Cliente' : 'Proveedor'} aria-invalid={inv('tercero')}>
              <option value="">— Elige —</option>
              {opcionesTercero.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}{t.nif ? ` · ${t.nif}` : ''}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => setNuevoTercero(true)} title="Nuevo" aria-label="Crear tercero">+</Button>
          </div>
        </Field>
        </Campo>
        {tipo === 'recibida' ? (
          <>
            <Campo k="categoria" className="sm:col-span-2">
            <Field label="Categoría de gasto" error={errores.categoria} hint="Cualquier cuenta de gasto del grupo 6. Si aún no tiene categoría, se crea al guardar.">
              <CategoriaGastoSelect
                value={seleccion}
                onChange={cambiarCategoria}
                categorias={categorias}
                cuentas={cuentas}
                aria-invalid={inv('categoria')}
              />
            </Field>
            </Campo>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <Checkbox checked={ivaDeducible} onCheckedChange={(v) => setIvaDeducible(v === true)} />
              IVA deducible
            </label>
            {raiz && (
              <Campo k="cuentaGasto" className="sm:col-span-2">
                {opcionesGasto.length > 1 ? (
                  <Field label="Cuenta de gasto" error={errores.cuentaGasto} hint={`La ${raiz} tiene subcuentas: elige en cuál se contabiliza`}>
                    <Select
                      value={cuentaGasto}
                      onChange={(e) => { setCuentaGasto(e.target.value); limpiar('cuentaGasto') }}
                      aria-label="Cuenta de gasto"
                      aria-invalid={inv('cuentaGasto')}
                    >
                      <option value="">— Elige subcuenta —</option>
                      {opcionesGasto.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
                    </Select>
                  </Field>
                ) : opcionesGasto.length === 1 ? (
                  <p className="text-sm text-slate-500" data-testid="cuenta-gasto-auto">
                    Se contabilizará en la <span className="font-mono">{opcionesGasto[0].codigo}</span> · {opcionesGasto[0].nombre}
                  </p>
                ) : (
                  <p className="text-sm text-destructive">{errores.cuentaGasto ?? `La cuenta ${raiz} no tiene subcuentas activas.`}</p>
                )}
              </Campo>
            )}
          </>
        ) : (
          <Campo k="cuentaIngreso" className="sm:col-span-2">
            <Field label="Cuenta de ingresos" error={errores.cuentaIngreso}>
              <Select value={cuentaIngreso} onChange={(e) => { setCuentaIngreso(e.target.value); limpiar('cuentaIngreso') }} aria-invalid={inv('cuentaIngreso')}>
                {cuentasIngreso.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
              </Select>
            </Field>
          </Campo>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="pb-1 pr-2">Concepto</th>
              {!esRecibida && <th className="w-24 pb-1 pr-4 text-right">Cantidad</th>}
              <th className="w-36 pb-1 pr-4 text-right">{etiquetaImporte}</th>
              <th className="w-24 pb-1 pl-1">IVA</th>
              <th className="w-32 pb-1 pr-2 text-right">Importe</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const p = parsed[i]
              const mensajes = (['concepto', 'cantidad', 'precio'] as const).map((c) => errores[claveLinea(i, c)]).filter(Boolean)
              return (
                <Fila key={i} mensajes={mensajes} columnas={esRecibida ? 5 : 6}>
                  <td className="py-1 pr-2" data-campo={claveLinea(i, 'concepto')}><Input aria-invalid={inv(claveLinea(i, 'concepto'))} value={l.concepto} onChange={(e) => set(i, 'concepto', e.target.value)} aria-label={`Concepto ${i + 1}`} /></td>
                  {!esRecibida && (
                    <td className="py-1 pr-2" data-campo={claveLinea(i, 'cantidad')}><Input aria-invalid={inv(claveLinea(i, 'cantidad'))} className="text-right" inputMode="decimal" value={l.cantidad} onChange={(e) => set(i, 'cantidad', e.target.value)} aria-label={`Cantidad ${i + 1}`} /></td>
                  )}
                  <td className="py-1 pr-2" data-campo={claveLinea(i, 'precio')}><Input aria-invalid={inv(claveLinea(i, 'precio'))} className="text-right" inputMode="decimal" value={l.precio} onChange={(e) => set(i, 'precio', e.target.value)} aria-label={`${etiquetaImporte} ${i + 1}`} /></td>
                  <td className="py-1 pr-2">
                    <Select value={l.ivaPct} onChange={(e) => set(i, 'ivaPct', Number(e.target.value))} aria-label={`IVA ${i + 1}`}>
                      {TIPOS_IVA.map((t) => <option key={t} value={t}>{t} %</option>)}
                    </Select>
                  </td>
                  <td className="py-1 pr-2 text-right">{p ? <Euros cents={Math.round(p.cantidad * p.precioCent)} /> : '—'}</td>
                  <td className="py-1">
                    <button type="button" className="rounded p-2 text-xs text-slate-500 hover:bg-slate-100" onClick={() => { setLineas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)); setErrores({}) }} aria-label={`Quitar línea ${i + 1}`}>✕</button>
                  </td>
                </Fila>
              )
            })}
          </tbody>
        </table>
        {errores.lineas && <p className="mt-1 text-xs text-destructive" data-campo="lineas">{errores.lineas}</p>}
        <Button type="button" variant="ghost" onClick={() => setLineas((ls) => [...ls, lineaVacia()])}>+ Línea</Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Field label="Retención IRPF" className="w-48">
          <Select value={irpfPct} onChange={(e) => setIrpfPct(Number(e.target.value))} aria-label="Retención IRPF">
            {TIPOS_IRPF.map((t) => <option key={t} value={t}>{t === 0 ? 'Sin retención' : `${t} %`}</option>)}
          </Select>
        </Field>
        <dl className="grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-md bg-slate-50 p-4 text-sm">
          {calculo.bases.map((b) => (
            <div key={b.ivaPct} className="contents text-slate-600">
              <dt>Base {b.ivaPct} % · cuota</dt>
              <dd className="text-right"><Euros cents={b.baseCent} /> · <Euros cents={b.cuotaCent} /></dd>
            </div>
          ))}
          <dt>Base imponible</dt><dd className="text-right"><Euros cents={calculo.baseCent} /></dd>
          <dt>IVA</dt><dd className="text-right"><Euros cents={calculo.cuotaIvaCent} /></dd>
          {calculo.retencionCent !== 0 && (<><dt>Retención IRPF</dt><dd className="text-right">−<Euros cents={calculo.retencionCent} /></dd></>)}
          <dt className="border-t border-slate-200 pt-1 font-semibold">Total</dt>
          <dd className="border-t border-slate-200 pt-1 text-right font-semibold" data-testid="total-factura"><Euros cents={calculo.totalCent} /></dd>
        </dl>
      </div>

      {Object.keys(errores).length > 0 && (
        <Alert>
          <p className="font-medium">Revisa los campos marcados en rojo:</p>
          <ul className="mt-1 list-inside list-disc">
            {Object.values(errores).map((m) => <li key={m}>{m}</li>)}
          </ul>
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : existente ? 'Guardar cambios' : 'Registrar factura'}</Button>
      </div>

      {nuevoTercero && (
        <Modal title={tipo === 'emitida' ? 'Nuevo cliente' : 'Nuevo proveedor'} onClose={() => setNuevoTercero(false)}>
          <TerceroForm
            tipoInicial={tiposTercero[0]}
            tiposPermitidos={tiposTercero}
            onDone={(t) => {
              setNuevoTercero(false)
              if (t) {
                setExtraTerceros((xs) => [...xs, t])
                elegirTercero(t.id, [...opcionesTercero, t])
              }
            }}
          />
        </Modal>
      )}
    </form>
  )
}

/** Envoltorio que localiza un campo para enfocarlo cuando tiene error. */
function Campo({ k, className, children }: { k: string; className?: string; children: ReactNode }) {
  return (
    <div data-campo={k} className={className}>
      {children}
    </div>
  )
}

/** Fila de línea de factura con sus mensajes de error debajo. */
function Fila({ mensajes, columnas, children }: { mensajes: string[]; columnas: number; children: ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {mensajes.length > 0 && (
        <tr>
          <td colSpan={columnas} className="pb-1 text-xs text-destructive">
            {mensajes.join(' ')}
          </td>
        </tr>
      )}
    </>
  )
}
