import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMsg } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { isValidNif, normalizeNif } from '../../lib/nif'
import type { Tercero, TipoTercero } from '../../lib/tipos'
import { siguienteSubcuenta } from '../../lib/terceros'
import { actualizarTercero, cambiarTipoTercero, crearTercero, usoTercero, type UsoTercero } from '../../services/terceros'
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
  const { eid, cuentas, categorias } = useLibros()
  const [tipo, setTipo] = useState<TipoTercero>(tercero?.tipo ?? tipoInicial)
  const [nombre, setNombre] = useState(tercero?.nombre ?? '')
  const [nif, setNif] = useState(tercero?.nif ?? '')
  const [email, setEmail] = useState(tercero?.email ?? '')
  const [domicilio, setDomicilio] = useState(tercero?.domicilio ?? '')
  const [categoriaId, setCategoriaId] = useState(tercero?.categoriaPorDefectoId ?? '')
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
  const nuevaCuenta = cambiaTipo ? siguienteSubcuenta(tipo, cuentas) : null
  const ayudaTipo = !tercero
    ? 'Se le asignará su propia subcuenta (430…, 400… o 410…)'
    : uso === 'comprobando'
      ? 'Comprobando si tiene movimientos…'
      : conMovimientos
        ? `Subcuenta ${tercero.cuenta}. Ya tiene ${uso && uso.facturas ? 'facturas' : 'asientos'}: no se puede cambiar el tipo. Si es un error, crea uno nuevo del tipo correcto y desactiva este.`
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
      categoriaPorDefectoId: tipo === 'cliente' ? null : categoriaId || null,
    }
    setSaving(true)
    try {
      if (tercero) {
        const base = cambiaTipo ? await cambiarTipoTercero(eid, tercero, tipo, cuentas) : tercero
        await actualizarTercero(eid, base, datos)
        if (cambiaTipo) toast.success(`${datos.nombre} ahora es ${TIPO_LABEL[tipo].toLowerCase()} (subcuenta ${base.cuenta})`)
        onDone({ ...base, ...datos })
      } else {
        const nuevo = await crearTercero(eid, { ...datos, tipo }, cuentas)
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
      <Field label="NIF / CIF">
        <Input value={nif} onChange={(e) => setNif(e.target.value)} maxLength={20} />
      </Field>
      <Field label="Nombre o razón social" className="sm:col-span-2">
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
          <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">— Ninguna —</option>
            {categorias.filter((c) => c.activa || c.id === categoriaId).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.cuentaGasto})</option>
            ))}
          </Select>
        </Field>
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
