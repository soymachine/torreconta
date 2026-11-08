import { useState, type FormEvent } from 'react'
import { centsAInput, errorMsg, Euros, Modal } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/ui'
import { calcularFactura, TIPOS_IRPF, TIPOS_IVA, type LineaFactura } from '../../lib/contabilizacion'
import { esImputable } from '../../lib/cuentas'
import { parseEuros } from '../../lib/money'
import type { FacturaEmitida, FacturaRecibida, Tercero, TipoTercero } from '../../lib/tipos'
import { guardarFacturaEmitida, guardarFacturaRecibida } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'
import { TerceroForm } from '../terceros/TerceroForm'

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
  const [numero, setNumero] = useState(recibida?.numero ?? '')
  const [terceroId, setTerceroId] = useState(existente?.terceroId ?? '')
  const [categoriaId, setCategoriaId] = useState(recibida?.categoriaId ?? '')
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
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const opcionesTercero = [...terceros, ...extraTerceros.filter((t) => !terceros.some((x) => x.id === t.id))].filter(
    (t) => tiposTercero.includes(t.tipo) && (t.activo || t.id === terceroId),
  )
  const cuentasIngreso = cuentas.filter((c) => c.codigo.startsWith('7') && esImputable(c, cuentas))

  const parsed = lineas.map((l): LineaFactura | null => {
    const cantidad = Number(l.cantidad.replace(',', '.'))
    const precio = parseEuros(l.precio)
    if (!Number.isFinite(cantidad) || precio === null) return null
    return { concepto: l.concepto.trim(), cantidad, precioCent: precio, ivaPct: l.ivaPct }
  })
  const validas = parsed.filter((l): l is LineaFactura => l !== null)
  const calculo = calcularFactura(validas, irpfPct)

  const elegirTercero = (id: string, lista = opcionesTercero) => {
    setTerceroId(id)
    const t = lista.find((x) => x.id === id)
    if (tipo === 'recibida' && t?.categoriaPorDefectoId) setCategoriaId(t.categoriaPorDefectoId)
  }

  const set = (i: number, campo: keyof LineaEdit, v: string | number) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const tercero = opcionesTercero.find((t) => t.id === terceroId)
    if (!tercero) return setError(tipo === 'emitida' ? 'Elige el cliente.' : 'Elige el proveedor.')
    if (parsed.some((l) => l === null)) return setError('Hay cantidades o precios con formato incorrecto.')
    const utiles = validas.filter((l) => l.concepto || l.precioCent)
    if (!utiles.length) return setError('Añade al menos una línea con importe.')
    if (utiles.some((l) => !l.concepto)) return setError('Todas las líneas necesitan concepto.')
    setSaving(true)
    try {
      if (tipo === 'emitida') {
        if (!cuentasIngreso.some((c) => c.codigo === cuentaIngreso)) throw new Error('Elige una cuenta de ingresos válida.')
        await guardarFacturaEmitida(
          eid,
          { serie: empresa.serieFacturas, anio, cuentas },
          { fecha, tercero, lineas: utiles, irpfPct, cuentaIngreso },
          emitida,
        )
      } else {
        const categoria = categorias.find((c) => c.id === categoriaId)
        if (!categoria) throw new Error('Elige la categoría de gasto.')
        await guardarFacturaRecibida(
          eid,
          { anio, cuentas },
          { fecha, numero, tercero, lineas: utiles, irpfPct, ivaDeducible, categoria },
          recibida,
        )
      }
      onDone()
    } catch (err) {
      setError(errorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha">
          <Input type="date" value={fecha} min={`${existente?.ejercicio ?? anio}-01-01`} max={`${existente?.ejercicio ?? anio}-12-31`} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        {tipo === 'recibida' ? (
          <Field label="Nº de factura del proveedor">
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={40} />
          </Field>
        ) : (
          <Field label="Número" hint="Se asigna al guardar">
            <Input value={emitida?.numero ?? `${empresa.serieFacturas}${anio}-…`} disabled />
          </Field>
        )}
        <Field label={tipo === 'emitida' ? 'Cliente' : 'Proveedor'}>
          <div className="flex gap-2">
            <Select value={terceroId} onChange={(e) => elegirTercero(e.target.value)} aria-label={tipo === 'emitida' ? 'Cliente' : 'Proveedor'}>
              <option value="">— Elige —</option>
              {opcionesTercero.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}{t.nif ? ` · ${t.nif}` : ''}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => setNuevoTercero(true)} title="Nuevo" aria-label="Crear tercero">+</Button>
          </div>
        </Field>
        {tipo === 'recibida' ? (
          <>
            <Field label="Categoría de gasto" className="sm:col-span-2">
              <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoría">
                <option value="">— Elige —</option>
                {categorias.filter((c) => c.activa || c.id === categoriaId).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.cuentaGasto})</option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={ivaDeducible} onChange={(e) => setIvaDeducible(e.target.checked)} />
              IVA deducible
            </label>
          </>
        ) : (
          <Field label="Cuenta de ingresos" className="sm:col-span-2">
            <Select value={cuentaIngreso} onChange={(e) => setCuentaIngreso(e.target.value)}>
              {cuentasIngreso.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="pb-1 pr-2">Concepto</th>
              <th className="w-24 pb-1 pr-4 text-right">Cantidad</th>
              <th className="w-32 pb-1 pr-4 text-right">Precio</th>
              <th className="w-24 pb-1 pl-1">IVA</th>
              <th className="w-32 pb-1 pr-2 text-right">Importe</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const p = parsed[i]
              return (
                <tr key={i}>
                  <td className="py-1 pr-2"><Input value={l.concepto} onChange={(e) => set(i, 'concepto', e.target.value)} aria-label={`Concepto ${i + 1}`} /></td>
                  <td className="py-1 pr-2"><Input className="text-right" inputMode="decimal" value={l.cantidad} onChange={(e) => set(i, 'cantidad', e.target.value)} aria-label={`Cantidad ${i + 1}`} /></td>
                  <td className="py-1 pr-2"><Input className="text-right" inputMode="decimal" value={l.precio} onChange={(e) => set(i, 'precio', e.target.value)} aria-label={`Precio ${i + 1}`} /></td>
                  <td className="py-1 pr-2">
                    <Select value={l.ivaPct} onChange={(e) => set(i, 'ivaPct', Number(e.target.value))} aria-label={`IVA ${i + 1}`}>
                      {TIPOS_IVA.map((t) => <option key={t} value={t}>{t} %</option>)}
                    </Select>
                  </td>
                  <td className="py-1 pr-2 text-right">{p ? <Euros cents={Math.round(p.cantidad * p.precioCent)} /> : '—'}</td>
                  <td className="py-1">
                    <button type="button" className="rounded p-2 text-xs text-slate-500 hover:bg-slate-100" onClick={() => setLineas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} aria-label={`Quitar línea ${i + 1}`}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
