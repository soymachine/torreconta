import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useConfirmar } from '@/components/Confirmar'
import { Button, Field, Input } from '../../components/base'
import { errorMsg } from '../../components/shared'
import { planRenumeracion, validarRenumeracion } from '../../lib/numeracion'
import { numeroFactura, renumerarFacturasEmitidas } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'

/**
 * Renumera todas las facturas emitidas del ejercicio activo empezando por el
 * número indicado (p. ej. si se empieza a usar el programa a mitad de año).
 */
export function NumeracionForm({ onDone }: { onDone: () => void }) {
  const { eid, anio, empresa, emitidas, ejercicio } = useLibros()
  const confirmar = useConfirmar()
  const n = emitidas.length
  const primera = n ? Math.min(...emitidas.map((f) => f.secuencia)) : undefined
  const [valor, setValor] = useState(String(primera ?? (ejercicio?.contadorFacturas ?? 0) + 1))
  const [tocado, setTocado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  const inicio = valor.trim() === '' ? Number.NaN : Number(valor)
  const error = validarRenumeracion(inicio, n, primera)
  const mostrarError = (tocado && error) || errorServidor
  const plan = useMemo(() => (error ? null : planRenumeracion(emitidas, inicio)), [error, emitidas, inicio])
  const proxima = plan ? numeroFactura(empresa.serieFacturas, anio, plan.ultima + 1) : null
  const muestra = plan ? (plan.cambios.length > 4 ? [...plan.cambios.slice(0, 3), null, plan.cambios[plan.cambios.length - 1]] : plan.cambios) : []

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setTocado(true)
    setErrorServidor(null)
    if (error || !plan) return
    const c = plan.cambios
    const ok = await confirmar(
      n
        ? {
            titulo: '¿Renumerar las facturas?',
            descripcion: `${n === 1 ? 'La factura emitida' : `Las ${n} facturas emitidas`} de ${anio} pasarán de ${c[0].numeroAntes}${n > 1 ? `…${c[n - 1].numeroAntes}` : ''} a ${c[0].numeroNuevo}${n > 1 ? `…${c[n - 1].numeroNuevo}` : ''}. También se actualiza el concepto de sus asientos. La próxima será ${proxima}.`,
            accion: 'Renumerar',
          }
        : {
            titulo: '¿Cambiar la numeración?',
            descripcion: `La primera factura emitida de ${anio} será ${proxima}.`,
            accion: 'Cambiar numeración',
          },
    )
    if (!ok) return
    setGuardando(true)
    try {
      const r = await renumerarFacturasEmitidas(eid, anio, inicio)
      toast.success(r.renumeradas ? `${r.renumeradas} ${r.renumeradas === 1 ? 'factura renumerada' : 'facturas renumeradas'} · la próxima será ${proxima}` : `La próxima factura será ${proxima}`)
      onDone()
    } catch (err) {
      setErrorServidor(errorMsg(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600">
        {n ? (
          <>Se renumerarán {n === 1 ? 'la factura emitida' : `las ${n} facturas emitidas`} de {anio}, en el mismo orden y de forma consecutiva.</>
        ) : (
          <>Aún no hay facturas emitidas en {anio}: indica el número de la primera.</>
        )}
      </p>
      <Field label="Empezar la numeración en" error={mostrarError || undefined}>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          step={1}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value)
            setTocado(true)
            setErrorServidor(null)
          }}
          aria-invalid={mostrarError ? true : undefined}
          className={mostrarError ? 'border-red-500 focus-visible:ring-red-200' : undefined}
          autoFocus
        />
      </Field>
      <div className="space-y-2 rounded-md bg-slate-50 px-3 py-2 text-sm" data-testid="vista-previa-numeracion">
        {plan ? (
          <>
            {muestra.length > 0 && (
              <table className="font-mono text-xs">
                <tbody>
                  {muestra.map((c, i) =>
                    c ? (
                      <tr key={c.id} data-testid="cambio-numero">
                        <td className="py-0.5 text-slate-500">{c.numeroAntes}</td>
                        <td className="px-2 text-slate-400">→</td>
                        <td className="py-0.5 font-semibold">{c.numeroNuevo}</td>
                      </tr>
                    ) : (
                      <tr key={`hueco-${i}`}><td className="text-slate-400" colSpan={3}>…</td></tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
            <p>La próxima factura será <span className="font-mono font-semibold">{proxima}</span></p>
          </>
        ) : (
          <span className="text-slate-500">Escribe un número válido para ver cómo quedará.</span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : n ? 'Renumerar' : 'Guardar'}</Button>
      </div>
    </form>
  )
}
