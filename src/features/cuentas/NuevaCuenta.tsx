import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { errorMsg } from '../../components/shared'
import { mensajeErrorNuevaCuenta, NATURALEZAS, validarNuevaCuenta, type Cuenta, type Naturaleza } from '../../lib/cuentas'
import { crearCuenta } from '../../services/cuentas'
import { useLibros } from '../libros/LibrosProvider'

const NATURALEZA_LABEL: Record<Naturaleza, string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  patrimonio: 'Patrimonio neto',
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  mixta: 'Mixta (según saldo)',
}

/** Alta de una cuenta del PGC (3 dígitos) o de una subcuenta (4 a 12 dígitos). */
export function NuevaCuenta({ cuentas, onDone }: { cuentas: Cuenta[]; onDone: () => void }) {
  const eid = useEmpresaId()
  const { asientos } = useLibros()
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [naturaleza, setNaturaleza] = useState<Naturaleza | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const check = codigo.length >= 3 ? validarNuevaCuenta(codigo, cuentas) : null
  const padre = check?.ok ? check.padre : undefined
  const eligeNaturaleza = padre?.naturaleza === 'mixta'
  const padreConApuntes = !!padre && padre.codigo.length >= 3 && asientos.some((a) => a.cuentas.includes(padre.codigo))

  const ayuda = !check
    ? '3 dígitos: cuenta del PGC (p. ej. 601). 4 o más: subcuenta (p. ej. 6020001).'
    : check.ok
      ? `${check.tipo === 'cuenta' ? 'Cuenta' : 'Subcuenta'} de ${check.padre.codigo} · ${check.padre.nombre}`
      : mensajeErrorNuevaCuenta(codigo, check.error)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = validarNuevaCuenta(codigo, cuentas)
    if (!v.ok) return setError(mensajeErrorNuevaCuenta(codigo, v.error))
    if (nombre.trim().length < 2) return setError('Escribe un nombre para la cuenta.')
    if (v.padre.naturaleza === 'mixta' && !naturaleza) return setError('Elige la naturaleza de la cuenta.')
    setSaving(true)
    try {
      await crearCuenta(eid, {
        codigo,
        nombre: nombre.trim(),
        naturaleza: v.padre.naturaleza === 'mixta' ? (naturaleza as Naturaleza) : v.padre.naturaleza,
        activa: true,
      })
      toast.success(`${v.tipo === 'cuenta' ? 'Cuenta' : 'Subcuenta'} ${codigo} creada`)
      onDone()
    } catch (err) {
      setError(errorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  const invalido = !!check && !check.ok
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-start" noValidate>
      <Field label="Código" hint={invalido ? undefined : ayuda} error={invalido ? ayuda : undefined}>
        <Input
          inputMode="numeric"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          maxLength={12}
          aria-invalid={invalido || undefined}
          autoFocus
        />
      </Field>
      <Field label="Nombre">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
      </Field>
      <Button type="submit" disabled={saving || invalido} className="sm:mt-6">
        Crear
      </Button>
      {eligeNaturaleza && (
        <Field label="Naturaleza" hint={`La ${padre!.codigo} es mixta: indica cómo se comporta esta cuenta`} className="sm:col-span-2">
          <Select value={naturaleza} onChange={(e) => setNaturaleza(e.target.value as Naturaleza)} aria-label="Naturaleza">
            <option value="">— Elige —</option>
            {NATURALEZAS.map((n) => <option key={n} value={n}>{NATURALEZA_LABEL[n]}</option>)}
          </Select>
        </Field>
      )}
      {padreConApuntes && (
        <div className="sm:col-span-3">
          <Alert tone="info">
            La {padre!.codigo} ya tiene apuntes este ejercicio. Se conservan en ella, pero a partir de ahora los nuevos
            apuntes tendrán que ir a alguna de sus subcuentas.
          </Alert>
        </div>
      )}
      {error && (
        <div className="sm:col-span-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </form>
  )
}
