import { useState, type FormEvent } from 'react'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Alert, Button, Field, Input } from '../../components/ui'
import { MENSAJES_ERROR_SUBCUENTA, validarNuevaSubcuenta, type Cuenta } from '../../lib/cuentas'
import { crearCuenta } from '../../services/cuentas'

export function NuevaSubcuenta({ cuentas, onDone }: { cuentas: Cuenta[]; onDone: () => void }) {
  const eid = useEmpresaId()
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const check = codigo.length >= 4 ? validarNuevaSubcuenta(codigo, cuentas) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = validarNuevaSubcuenta(codigo, cuentas)
    if (!v.ok) return setError(MENSAJES_ERROR_SUBCUENTA[v.error])
    if (nombre.trim().length < 2) return setError('Escribe un nombre para la subcuenta.')
    setSaving(true)
    try {
      await crearCuenta(eid, { codigo, nombre: nombre.trim(), naturaleza: v.padre.naturaleza, activa: true })
      onDone()
    } catch {
      setError('No se ha podido crear la subcuenta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <Field
        label="Código"
        hint={check?.ok ? `Cuelga de ${check.padre.codigo} · ${check.padre.nombre}` : 'p. ej. 4300001'}
      >
        <Input
          inputMode="numeric"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          maxLength={12}
          autoFocus
        />
      </Field>
      <Field label="Nombre">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
      </Field>
      <Button type="submit" disabled={saving}>
        Crear
      </Button>
      {error && (
        <div className="sm:col-span-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </form>
  )
}
