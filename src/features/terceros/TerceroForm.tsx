import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMsg } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { isValidNif, normalizeNif } from '../../lib/nif'
import type { Tercero, TipoTercero } from '../../lib/tipos'
import { actualizarTercero, crearTercero } from '../../services/terceros'
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
        await actualizarTercero(eid, tercero, datos)
        onDone({ ...tercero, ...datos })
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
      <Field label="Tipo" hint={tercero ? `Subcuenta ${tercero.cuenta}` : 'Se le asignará su propia subcuenta (430…, 400… o 410…)'}>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTercero)} disabled={!!tercero}>
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
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={() => onDone()}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : tercero ? 'Guardar' : 'Crear'}</Button>
      </div>
    </form>
  )
}
