import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useConfirmar } from '@/components/Confirmar'
import { Button, Field, Input } from '../../components/base'
import { errorMsg } from '../../components/shared'
import { validarInicioNumeracion } from '../../lib/numeracion'
import { cambiarInicioNumeracion, numeroFactura } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'

/** Cambia el número de la próxima factura emitida del ejercicio activo. */
export function NumeracionForm({ onDone }: { onDone: () => void }) {
  const { eid, anio, empresa, emitidas, ejercicio } = useLibros()
  const confirmar = useConfirmar()
  const serie = empresa.serieFacturas
  const ultima = Math.max(0, ...emitidas.map((f) => f.secuencia))
  const [valor, setValor] = useState(String((ejercicio?.contadorFacturas ?? ultima) + 1))
  const [tocado, setTocado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  const siguiente = valor.trim() === '' ? Number.NaN : Number(valor)
  const error = validarInicioNumeracion(siguiente, ultima, numeroFactura(serie, anio, ultima))
  const mostrarError = (tocado && error) || errorServidor
  const proxima = error ? null : numeroFactura(serie, anio, siguiente)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setTocado(true)
    setErrorServidor(null)
    if (error || !proxima) return
    const ok = await confirmar({
      titulo: '¿Cambiar la numeración?',
      descripcion: `La próxima factura emitida será ${proxima}. Las facturas ya emitidas no cambian.`,
      accion: 'Cambiar numeración',
    })
    if (!ok) return
    setGuardando(true)
    try {
      await cambiarInicioNumeracion(eid, anio, serie, siguiente)
      toast.success(`La próxima factura será ${proxima}`)
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
        {ultima > 0 ? (
          <>Última factura emitida en {anio}: <span className="font-mono font-medium">{numeroFactura(serie, anio, ultima)}</span></>
        ) : (
          <>Aún no hay facturas emitidas en {anio}.</>
        )}
      </p>
      <Field
        label="Próxima factura nº"
        error={mostrarError || undefined}
        hint="Útil si empiezas a usar el programa a mitad de ejercicio: pon el número que toca."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={ultima + 1}
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
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm" data-testid="vista-previa-numeracion">
        {proxima ? (
          <>La próxima factura será <span className="font-mono font-semibold">{proxima}</span></>
        ) : (
          <span className="text-slate-500">Escribe un número válido para ver cómo quedará.</span>
        )}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}
