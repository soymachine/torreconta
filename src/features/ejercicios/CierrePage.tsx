import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AsientoPreview } from '../../components/AsientoPreview'
import { Badge, centsAInput, errorMsg, Euros, PageHeader } from '../../components/shared'
import { Alert, Button, Card, Field, Input } from '../../components/ui'
import { ORIGEN_LABEL } from '../../lib/asientos'
import { calcularCierre, comprobacionesCierre, origenIdCierre, type NivelComprobacion } from '../../lib/cierre'
import { parseEuros, percentOf } from '../../lib/money'
import { paraInformes, pyg } from '../../lib/saldos'
import { renumerarAsientos } from '../../services/asientos'
import { cerrarEjercicio, reabrirEjercicio } from '../../services/cierre'
import { useLibros } from '../libros/LibrosProvider'

const ICONO: Record<NivelComprobacion, { simbolo: string; clase: string }> = {
  ok: { simbolo: '✓', clase: 'bg-emerald-100 text-emerald-700' },
  aviso: { simbolo: '!', clase: 'bg-amber-100 text-amber-800' },
  error: { simbolo: '✕', clase: 'bg-red-100 text-red-700' },
}

function Reabrir({ anio }: { anio: number }) {
  const { eid, asientos } = useLibros()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const generados = asientos.filter((a) => a.origenId === origenIdCierre(anio))
  return (
    <Card className="max-w-3xl space-y-4">
      <p className="text-sm text-slate-600">
        Al reabrir se borrarán la regularización y el cierre de {anio} y la apertura de {anio + 1}. El asiento del impuesto
        sobre sociedades, si lo hay, se conserva. Después podrás corregir lo que necesites y volver a cerrar.
      </p>
      {generados.length > 0 && (
        <ul className="text-sm">
          {generados.map((a) => (
            <li key={a.id}>
              <Badge tone="sky">{ORIGEN_LABEL[a.origen]}</Badge> Asiento nº {a.numero} · {a.concepto}
            </li>
          ))}
        </ul>
      )}
      {error && <Alert>{error}</Alert>}
      <Button
        variant="danger"
        disabled={saving}
        onClick={async () => {
          if (!confirm(`¿Reabrir el ejercicio ${anio}?`)) return
          setSaving(true)
          setError(null)
          try {
            await reabrirEjercicio(eid, anio)
          } catch (e) {
            setError(errorMsg(e))
          } finally {
            setSaving(false)
          }
        }}
      >
        {saving ? 'Reabriendo…' : `Reabrir ejercicio ${anio}`}
      </Button>
    </Card>
  )
}

export function CierrePage() {
  const { eid, anio, ejercicio, asientos, cuentas, emitidas, recibidas } = useLibros()
  const navigate = useNavigate()
  const resultadoAntes = useMemo(() => pyg(paraInformes(asientos), cuentas).resultado, [asientos, cuentas])
  const [impuestoTxt, setImpuestoTxt] = useState('')
  const [entendido, setEntendido] = useState(false)
  const [activarSiguiente, setActivarSiguiente] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const impuestoCent = impuestoTxt.trim() ? parseEuros(impuestoTxt) : 0
  const impuestoValido = impuestoCent !== null && impuestoCent >= 0
  const comprobaciones = useMemo(
    () => comprobacionesCierre({ anio, asientos, emitidas, recibidas, impuestoCent: impuestoCent ?? 0 }),
    [anio, asientos, emitidas, recibidas, impuestoCent],
  )
  const calculo = useMemo(() => {
    if (!impuestoValido) return null
    try {
      return calcularCierre(asientos, anio, impuestoCent ?? 0)
    } catch {
      return null
    }
  }, [asientos, anio, impuestoCent, impuestoValido])
  const hayErrores = comprobaciones.some((c) => c.nivel === 'error')
  const tieneAsientosCierre = asientos.some((a) => a.origenId === origenIdCierre(anio))

  if (ejercicio?.estado === 'cerrado' || (ejercicio?.estado === 'abierto' && tieneAsientosCierre)) {
    return (
      <div>
        <PageHeader
          title={`Ejercicio ${anio} cerrado`}
          subtitle={ejercicio?.estado === 'abierto' ? 'El ejercicio está abierto pero conserva asientos de cierre: termina de reabrirlo.' : undefined}
        />
        <Reabrir anio={anio} />
      </div>
    )
  }

  const sugerencia = resultadoAntes > 0 ? percentOf(resultadoAntes, 25) : 0

  const cerrar = async () => {
    setError(null)
    setSaving(true)
    try {
      await cerrarEjercicio(eid, anio, { impuestoCent: impuestoCent ?? 0, activarSiguiente }, { asientos, cuentas })
      navigate(`/ejercicios/cierre/hecho?anio=${anio}`)
    } catch (e) {
      setError(errorMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={`Cierre del ejercicio ${anio}`} subtitle="Regularización, cierre y apertura del ejercicio siguiente" />

      <Card>
        <h2 className="mb-3 font-semibold">1. Comprobaciones</h2>
        <ul className="space-y-2 text-sm" data-testid="comprobaciones">
          {comprobaciones.map((c) => (
            <li key={c.id} className="flex items-start gap-3" data-nivel={c.nivel}>
              <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ICONO[c.nivel].clase}`}>
                {ICONO[c.nivel].simbolo}
              </span>
              <span className="flex-1">
                {c.texto}{' '}
                {c.enlace && <Link to={c.enlace} className="font-medium underline">Ir</Link>}
                {c.id === 'orden' && c.nivel === 'error' && (
                  <button className="font-medium underline" onClick={() => renumerarAsientos(eid, anio, asientos).catch((e) => setError(errorMsg(e)))}>
                    Renumerar por fecha
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">2. Impuesto sobre sociedades (opcional)</h2>
        <p className="mb-3 text-sm text-slate-600">
          Resultado antes de impuestos: <strong><Euros cents={resultadoAntes} /></strong>. Si ya lo has contabilizado o no
          aplica, déjalo vacío. Se cargará en la 630 contra las retenciones (473) y la cuota a pagar (4752).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Cuota del impuesto" error={impuestoValido ? undefined : 'Importe no válido'} className="w-48">
            <Input inputMode="decimal" className="text-right" value={impuestoTxt} onChange={(e) => setImpuestoTxt(e.target.value)} aria-label="Cuota del impuesto" />
          </Field>
          {sugerencia > 0 && (
            <Button variant="ghost" onClick={() => setImpuestoTxt(centsAInput(sugerencia))}>
              <span>Usar 25 % (<Euros cents={sugerencia} />, orientativo)</span>
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">3. Asientos que se generarán</h2>
        {calculo ? (
          <>
            <p className="mb-4 text-sm">
              Resultado del ejercicio después de impuestos:{' '}
              <strong className={calculo.resultado < 0 ? 'text-red-700' : 'text-emerald-700'} data-testid="resultado-cierre">
                <Euros cents={calculo.resultado} />
              </strong>
            </p>
            <div className="space-y-3">
              {[calculo.impuesto, calculo.regularizacion, calculo.cierre, calculo.apertura].map(
                (b) =>
                  b && (
                    <details key={b.concepto} className="group" open={b === calculo.regularizacion}>
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">{b.concepto}</summary>
                      <div className="mt-2"><AsientoPreview asiento={b} cuentas={cuentas} /></div>
                    </details>
                  ),
              )}
              {!calculo.cierre && <p className="text-sm text-slate-500">No hay saldos que cerrar.</p>}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Revisa el importe del impuesto.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">4. Confirmar</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={entendido} onChange={(e) => setEntendido(e.target.checked)} />
          Entiendo que el ejercicio {anio} quedará bloqueado: no se podrán añadir ni modificar asientos ni facturas (salvo cobros
          y pagos, que se contabilizan en {anio + 1}). Podré reabrirlo si lo necesito.
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activarSiguiente} onChange={(e) => setActivarSiguiente(e.target.checked)} />
          Pasar a trabajar en el ejercicio {anio + 1}
        </label>
        {error && <Alert>{error}</Alert>}
        {hayErrores && <Alert>Corrige los errores de las comprobaciones antes de cerrar.</Alert>}
        <Button onClick={cerrar} disabled={!entendido || hayErrores || !calculo?.cierre || saving}>
          {saving ? 'Cerrando…' : `Cerrar ejercicio ${anio}`}
        </Button>
      </Card>
    </div>
  )
}

export function CierreHechoPage() {
  const { anio } = useLibros()
  const [params] = useSearchParams()
  const cerrado = Number(params.get('anio'))
  return (
    <Card className="max-w-2xl space-y-3">
      <h1 className="text-xl font-semibold">Ejercicio {cerrado} cerrado</h1>
      <p className="text-sm text-slate-600">
        Se han generado la regularización y el cierre de {cerrado} y la apertura de {cerrado + 1}. Estás trabajando en el
        ejercicio {anio}.
      </p>
      <p className="text-sm text-slate-600">
        Recuerda aplicar el resultado (cuenta 129 a reservas, 113, o a resultados negativos, 121) con un asiento manual
        cuando se apruebe.
      </p>
      <div className="flex gap-2">
        <Link to="/diario" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">Ver diario de {anio}</Link>
        <Link to="/informes/balance" className="rounded-md border border-slate-300 px-3 py-2 text-sm">Balance de apertura</Link>
      </div>
    </Card>
  )
}
