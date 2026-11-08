import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMsg, Euros, hoyEn } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { esImputable } from '../../lib/cuentas'
import type { FacturaEmitida, FacturaRecibida } from '../../lib/tipos'
import { registrarCobro, registrarPago } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'

type Props =
  | { tipo: 'cobro'; factura: FacturaEmitida; onDone: () => void }
  | { tipo: 'pago'; factura: FacturaRecibida; onDone: () => void }

/** Registra el cobro de una factura emitida o el pago de una recibida. */
export function TesoreriaForm(props: Props) {
  const { eid, anio, empresa, cuentas, ejercicios } = useLibros()
  const { factura, tipo, onDone } = props
  const hoy = hoyEn(anio)
  const [fecha, setFecha] = useState(hoy < factura.fecha ? factura.fecha : hoy)
  const tesoreria = cuentas.filter((c) => c.codigo.startsWith('57') && esImputable(c, cuentas))
  const [cuenta, setCuenta] = useState(
    tesoreria.find((c) => c.codigo === empresa.cuentaBanco)?.codigo ?? tesoreria[0]?.codigo ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const abiertos = ejercicios.filter((e) => e.estado === 'abierto').map((e) => e.anio)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!abiertos.includes(Number(fecha.slice(0, 4))))
      return setError(`No hay ningún ejercicio abierto para ${fecha.slice(0, 4)}. Ábrelo desde «Empresa».`)
    setSaving(true)
    try {
      if (props.tipo === 'cobro') await registrarCobro(eid, props.factura, { fecha, cuenta }, cuentas)
      else await registrarPago(eid, props.factura, { fecha, cuenta }, cuentas)
      toast.success(`${props.tipo === 'cobro' ? 'Cobro' : 'Pago'} de la factura ${factura.numero} registrado`)
      onDone()
    } catch (err) {
      setError(errorMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Factura {factura.numero} · {factura.terceroNombre} · <strong><Euros cents={factura.totalCent} /></strong>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tipo === 'cobro' ? 'Fecha de cobro' : 'Fecha de pago'}>
          <Input type="date" value={fecha} min={factura.fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Cuenta de tesorería">
          <Select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            {tesoreria.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
          </Select>
        </Field>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={saving || !cuenta}>{tipo === 'cobro' ? 'Registrar cobro' : 'Registrar pago'}</Button>
      </div>
    </form>
  )
}
