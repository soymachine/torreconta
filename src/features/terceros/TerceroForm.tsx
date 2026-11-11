import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMsg } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { isValidNif, normalizeNif } from '../../lib/nif'
import type { Tercero, TipoTercero } from '../../lib/tipos'
import { esSubcuentaReutilizable, siguienteSubcuenta, validarCodigoTercero } from '../../lib/terceros'
import { cuentasDeGasto } from '../../lib/cuentas'
import { useConfirmar } from '../../components/Confirmar'
import { SubcuentaGastoSelect } from '../facturas/SubcuentaGastoSelect'
import { CategoriaGastoSelect } from '../facturas/CategoriaGastoSelect'
import { raizDeSeleccion, valorCategoria } from '../../lib/categoriasGasto'
import { asegurarCategoria } from '../../services/categorias'
import { actualizarTercero, cambiarCodigoTercero, cambiarTipoTercero, crearTercero, usoTercero, type UsoTercero } from '../../services/terceros'
import { useLibros } from '../libros/LibrosProvider'

export const TIPO_LABEL: Record<TipoTercero, string> = {
  cliente: 'Cliente',
  proveedor: 'Proveedor (compras)',
  acreedor: 'Acreedor (servicios)',
}

export function TerceroForm({
  tercero,
  tipoInicial = 'cliente',
  tiposPermitidos,
  onDone,
}: {
  tercero?: Tercero
  tipoInicial?: TipoTercero
  tiposPermitidos?: TipoTercero[]
  onDone: (t?: Tercero) => void
}) {
  const { eid, cuentas, categorias, terceros } = useLibros()
  const [tipo, setTipo] = useState<TipoTercero>(tercero?.tipo ?? tipoInicial)
  const [nombre, setNombre] = useState(tercero?.nombre ?? '')
  const [nif, setNif] = useState(tercero?.nif ?? '')
  const [email, setEmail] = useState(tercero?.email ?? '')
  const [domicilio, setDomicilio] = useState(tercero?.domicilio ?? '')
  const [seleccionCat, setSeleccionCat] = useState(tercero?.categoriaPorDefectoId ? valorCategoria(tercero.categoriaPorDefectoId) : '')
  const [cuentaGastoDef, setCuentaGastoDef] = useState(tercero?.cuentaGastoPorDefecto ?? '')
  // Código de la subcuenta: vacío = el automático (o el actual al editar).
  const [codigoEditado, setCodigoEditado] = useState('')
  const confirmar = useConfirmar()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const tipos = tiposPermitidos ?? (['cliente', 'proveedor', 'acreedor'] as TipoTercero[])

  // Al editar, el tipo solo se puede corregir si el tercero aún no tiene movimientos.
  const [uso, setUso] = useState<UsoTercero | 'comprobando' | null>(tercero ? 'comprobando' : null)
  useEffect(() => {
    if (!tercero) return
    let vigente = true
    usoTercero(eid, tercero)
      .then((u) => vigente && setUso(u))
      .catch(() => vigente && setUso({ facturas: true, asientos: true }))
    return () => {
      vigente = false
    }
  }, [eid, tercero])
  const conMovimientos = uso !== null && uso !== 'comprobando' && (uso.facturas || uso.asientos)
  const tipoBloqueado = !!tercero && (uso === 'comprobando' || conMovimientos)
  const cambiaTipo = !!tercero && tipo !== tercero.tipo
  const sugerida = tercero && !cambiaTipo ? tercero.cuenta : siguienteSubcuenta(tipo, cuentas)
  const codigoFinal = codigoEditado || sugerida
  const errorCodigo = codigoEditado
    ? validarCodigoTercero(tipo, codigoFinal, cuentas, tercero && !cambiaTipo ? tercero.cuenta : undefined, terceros)
    : null
  // Subcuenta desactivada de un tercero eliminado: se reactiva al guardar.
  const reutiliza = !errorCodigo && codigoFinal !== tercero?.cuenta && esSubcuentaReutilizable(codigoFinal, cuentas, terceros)
  const nuevaCuenta = cambiaTipo ? codigoFinal : null
  const raizCat = raizDeSeleccion(seleccionCat, categorias)
  const subcuentaValida = !!raizCat && cuentasDeGasto(raizCat, cuentas).length > 1
    && cuentasDeGasto(raizCat, cuentas).some((c) => c.codigo === cuentaGastoDef)
  const ayudaTipo = !tercero
    ? 'Se le asignará su propia subcuenta (430…, 400… o 410…)'
    : uso === 'comprobando'
      ? 'Comprobando si tiene movimientos…'
      : conMovimientos
        ? `Subcuenta ${tercero.cuenta}. Ya tiene ${uso && uso.facturas ? 'facturas' : 'asientos'}: no se puede cambiar el tipo. Si es un error, crea uno nuevo del tipo correcto y desactiva este desde «Eliminar» en el listado.`
        : `Subcuenta ${tercero.cuenta}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const n = normalizeNif(nif)
    if (nombre.trim().length < 2) return setError('Escribe el nombre o razón social.')
    // Se admite NIF vacío (p. ej. tickets) o extranjero, pero se avisa de los españoles mal formados.
    if (n && /^[0-9XYZA-HJNP-SUVW]/.test(n) && n.length === 9 && !isValidNif(n))
      return setError('El NIF/CIF no es válido. Revísalo o déjalo vacío.')
    const datos = {
      nombre: nombre.trim(),
      nif: n,
      email: email.trim(),
      domicilio: domicilio.trim(),
      categoriaPorDefectoId: null as string | null,
      cuentaGastoPorDefecto: tipo === 'cliente' || !subcuentaValida ? null : cuentaGastoDef,
    }
    if (errorCodigo) return setError(errorCodigo)
    try {
      // Si se eligió una cuenta mayor sin categoría, se crea su categoría.
      if (tipo !== 'cliente' && seleccionCat) datos.categoriaPorDefectoId = (await asegurarCategoria(eid, seleccionCat, categorias, cuentas)).id
    } catch (err) {
      return setError(errorMsg(err))
    }
    setSaving(true)
    try {
      if (tercero) {
        let base = tercero
        if (cambiaTipo) base = await cambiarTipoTercero(eid, tercero, tipo, cuentas, codigoEditado || undefined)
        else if (codigoFinal !== tercero.cuenta) {
          if (conMovimientos) {
            const ok = await confirmar({
              titulo: `¿Cambiar la subcuenta ${tercero.cuenta} por ${codigoFinal}?`,
              descripcion: 'Sus apuntes y facturas pasarán a la nueva subcuenta y la antigua quedará desactivada. Solo es posible si todos sus movimientos están en ejercicios abiertos.',
              accion: 'Cambiar subcuenta',
            })
            if (!ok) return
          }
          base = await cambiarCodigoTercero(eid, tercero, codigoFinal, cuentas)
          toast.success(`${tercero.nombre} ahora usa la subcuenta ${codigoFinal}`)
        }
        await actualizarTercero(eid, base, datos)
        if (cambiaTipo) toast.success(`${datos.nombre} ahora es ${TIPO_LABEL[tipo].toLowerCase()} (subcuenta ${base.cuenta})`)
        onDone({ ...base, ...datos })
      } else {
        const nuevo = await crearTercero(eid, { ...datos, tipo }, cuentas, codigoFinal)
        toast.success(`${nuevo.nombre} creado con la subcuenta ${nuevo.cuenta}`)
        onDone(nuevo)
      }
    } catch (err) {
      setError(errorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Tipo" hint={ayudaTipo}>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTercero)} disabled={tipoBloqueado} aria-label="Tipo">
          {tipos.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </Select>
      </Field>
      <Field
        label="Subcuenta"
        error={errorCodigo ?? undefined}
        hint={
          reutiliza
            ? `Se reutilizará la subcuenta ${codigoFinal}, que estaba desactivada`
            : tercero && !cambiaTipo
            ? `Puedes cambiarla (p. ej. ${tercero.cuenta.slice(0, 3)}0999 para que salga al final)${conMovimientos ? '; sus movimientos se trasladarán' : ''}`
            : `Vacía = la siguiente libre (${sugerida}). Puedes elegir otra, p. ej. ${sugerida.slice(0, 3)}0999`
        }
      >
        <Input
          value={codigoEditado}
          placeholder={sugerida}
          onChange={(e) => setCodigoEditado(e.target.value.replace(/\D/g, '').slice(0, 7))}
          inputMode="numeric"
          className="font-mono"
          aria-invalid={errorCodigo ? true : undefined}
          aria-label="Subcuenta"
        />
      </Field>
      <Field label="NIF / CIF">
        <Input value={nif} onChange={(e) => setNif(e.target.value)} maxLength={20} />
      </Field>
      <Field label="Nombre o razón social">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={150} autoFocus />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} />
      </Field>
      <Field label="Domicilio">
        <Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} maxLength={300} />
      </Field>
      {tipo !== 'cliente' && (
        <Field label="Categoría de gasto por defecto" hint="Se preseleccionará en sus facturas" className="sm:col-span-2">
          <CategoriaGastoSelect
            value={seleccionCat}
            onChange={(v) => { setSeleccionCat(v); setCuentaGastoDef('') }}
            categorias={categorias}
            cuentas={cuentas}
            vacio="— Ninguna —"
            aria-label="Categoría de gasto por defecto"
          />
        </Field>
      )}
      {tipo !== 'cliente' && (
        <div className="sm:col-span-2">
          <SubcuentaGastoSelect
            raiz={raizCat}
            cuentas={cuentas}
            value={cuentaGastoDef}
            onChange={setCuentaGastoDef}
            label="Subcuenta de gasto por defecto"
            vacio="— Elegir en cada factura —"
          />
        </div>
      )}
      {cambiaTipo && tercero && (
        <div className="sm:col-span-2" data-testid="aviso-cambio-tipo">
          <Alert tone="info">
            Pasará de {TIPO_LABEL[tercero.tipo].toLowerCase()} a {TIPO_LABEL[tipo].toLowerCase()}: se le asignará la subcuenta{' '}
            <strong className="font-mono">{nuevaCuenta}</strong> y la actual <span className="font-mono">{tercero.cuenta}</span> quedará
            desactivada en el plan de cuentas.
          </Alert>
        </div>
      )}
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={() => onDone()}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : tercero ? 'Guardar' : 'Crear'}</Button>
      </div>
    </form>
  )
}
