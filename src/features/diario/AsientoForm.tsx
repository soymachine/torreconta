import { useState, type FormEvent } from 'react'
import { CuentaInput, centsAInput, errorMsg, Euros } from '../../components/shared'
import { Alert, Button, Field, Input } from '../../components/ui'
import { totales, validarAsiento, type Asiento, type BorradorAsiento, type Linea } from '../../lib/asientos'
import { parseEuros } from '../../lib/money'
import { actualizarAsientoManual, crearAsientoManual } from '../../services/asientos'
import { useLibros } from '../libros/LibrosProvider'

interface FilaEdit {
  cuenta: string
  debe: string
  haber: string
  concepto: string
}

const filaVacia = (): FilaEdit => ({ cuenta: '', debe: '', haber: '', concepto: '' })

export function AsientoForm({ asiento, fechaInicial, onDone }: { asiento?: Asiento; fechaInicial: string; onDone: () => void }) {
  const { uid, anio, cuentas } = useLibros()
  const [fecha, setFecha] = useState(asiento?.fecha ?? fechaInicial)
  const [concepto, setConcepto] = useState(asiento?.concepto ?? '')
  const [filas, setFilas] = useState<FilaEdit[]>(
    asiento
      ? asiento.lineas.map((l) => ({ cuenta: l.cuenta, debe: centsAInput(l.debeCent), haber: centsAInput(l.haberCent), concepto: l.concepto }))
      : [filaVacia(), filaVacia()],
  )
  const [errores, setErrores] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const lineas: (Linea | null)[] = filas.map((f) => {
    const debe = f.debe.trim() ? parseEuros(f.debe) : 0
    const haber = f.haber.trim() ? parseEuros(f.haber) : 0
    if (debe === null || haber === null) return null
    return { cuenta: f.cuenta, debeCent: debe, haberCent: haber, concepto: f.concepto.trim() }
  })
  const validas = lineas.filter((l): l is Linea => l !== null)
  const t = totales(validas)

  const set = (i: number, campo: keyof FilaEdit, v: string) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: v } : f)))

  /** Rellena el importe que falta para cuadrar en la línea indicada. */
  const cuadrar = (i: number) => {
    const resto = totales(validas.filter((_, j) => j !== i)).diferencia
    if (resto > 0) setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, debe: '', haber: centsAInput(resto) } : f)))
    if (resto < 0) setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, haber: '', debe: centsAInput(-resto) } : f)))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (lineas.some((l) => l === null)) return setErrores(['Hay importes con formato incorrecto.'])
    const borrador: BorradorAsiento = {
      fecha,
      concepto,
      lineas: validas.filter((l) => l.cuenta || l.debeCent || l.haberCent),
    }
    const errs = validarAsiento(borrador, cuentas, asiento?.ejercicio ?? anio)
    if (errs.length) return setErrores(errs)
    setSaving(true)
    try {
      if (asiento) await actualizarAsientoManual(uid, asiento, borrador, cuentas)
      else await crearAsientoManual(uid, anio, borrador, cuentas)
      onDone()
    } catch (err) {
      setErrores([errorMsg(err)])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Field label="Fecha">
          <Input type="date" value={fecha} min={`${anio}-01-01`} max={`${anio}-12-31`} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Concepto">
          <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} maxLength={300} placeholder="p. ej. Aportación de capital" />
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="w-36 pb-1">Cuenta</th>
              <th className="pb-1">Concepto de la línea</th>
              <th className="w-32 pb-1 text-right">Debe</th>
              <th className="w-32 pb-1 text-right">Haber</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const nombre = cuentas.find((c) => c.codigo === f.cuenta)?.nombre
              return (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2">
                    <CuentaInput cuentas={cuentas} value={f.cuenta} onChange={(v) => set(i, 'cuenta', v)} aria-label={`Cuenta línea ${i + 1}`} />
                    <div className="mt-0.5 truncate text-xs text-slate-500">{nombre ?? ' '}</div>
                  </td>
                  <td className="py-1 pr-2">
                    <Input value={f.concepto} onChange={(e) => set(i, 'concepto', e.target.value)} placeholder="(opcional)" aria-label={`Concepto línea ${i + 1}`} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input className="text-right" inputMode="decimal" value={f.debe} onChange={(e) => set(i, 'debe', e.target.value)} aria-label={`Debe línea ${i + 1}`} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input className="text-right" inputMode="decimal" value={f.haber} onChange={(e) => set(i, 'haber', e.target.value)} aria-label={`Haber línea ${i + 1}`} />
                  </td>
                  <td className="whitespace-nowrap py-1">
                    <button type="button" onClick={() => cuadrar(i)} className="rounded px-1.5 py-2 text-xs text-slate-600 hover:bg-slate-100" title="Cuadrar con esta línea">
                      =
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilas((fs) => (fs.length > 2 ? fs.filter((_, j) => j !== i) : fs))}
                      className="rounded px-1.5 py-2 text-xs text-slate-600 hover:bg-slate-100"
                      aria-label={`Quitar línea ${i + 1}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium">
              <td className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setFilas((fs) => [...fs, filaVacia()])}>
                  + Línea
                </Button>
              </td>
              <td className="pt-2 text-right text-slate-500">Totales</td>
              <td className="pt-2 pr-2 text-right"><Euros cents={t.debe} /></td>
              <td className="pt-2 pr-2 text-right"><Euros cents={t.haber} /></td>
              <td />
            </tr>
            <tr>
              <td colSpan={5} className={`pt-1 text-right text-sm ${t.diferencia === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {t.diferencia === 0 ? (t.debe > 0 ? 'Cuadrado' : '') : <>Descuadre: <Euros cents={Math.abs(t.diferencia)} /></>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {errores.length > 0 && (
        <Alert>
          <ul className="list-inside list-disc">
            {errores.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : asiento ? 'Guardar cambios' : 'Crear asiento'}</Button>
      </div>
    </form>
  )
}
