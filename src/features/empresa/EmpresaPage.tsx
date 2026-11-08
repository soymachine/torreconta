import { useState } from 'react'
import { useUid } from '../../auth/AuthProvider'
import { Badge, errorMsg } from '../../components/shared'
import { Alert, Button, Card } from '../../components/ui'
import { abrirEjercicio, cambiarEjercicioActivo } from '../../services/ejercicios'
import { useLibros } from '../libros/LibrosProvider'
import { actualizarEmpresa } from '../../services/empresa'
import { EmpresaForm } from './EmpresaForm'
import { useEmpresa } from './EmpresaProvider'

export function EmpresaPage() {
  const uid = useUid()
  const empresa = useEmpresa()
  const { ejercicios } = useLibros()
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [msgEj, setMsgEj] = useState<string | null>(null)
  const siguiente = Math.max(...ejercicios.map((e) => e.anio), empresa.ejercicioActivo) + 1

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Empresa y ejercicios</h1>
      <Card className="max-w-2xl">
        {msg && (
          <div className="mb-4">
            <Alert tone={msg.tone}>{msg.text}</Alert>
          </div>
        )}
        <EmpresaForm
          submitLabel="Guardar cambios"
          defaultValues={empresa}
          onSubmit={async (datos) => {
            try {
              await actualizarEmpresa(uid, datos)
              setMsg({ tone: 'info', text: 'Datos guardados.' })
            } catch {
              setMsg({ tone: 'error', text: 'No se han podido guardar los datos.' })
            }
          }}
        />
      </Card>
      <Card className="max-w-2xl">
        <h2 className="mb-1 text-lg font-semibold">Ejercicios</h2>
        <p className="mb-4 text-sm text-slate-500">
          El ejercicio activo es el que se muestra en libros, facturas e informes. Los cobros y pagos se contabilizan en el
          ejercicio de su fecha, que debe estar abierto.
        </p>
        <ul className="divide-y divide-slate-100 text-sm">
          {ejercicios.map((e) => (
            <li key={e.anio} className="flex items-center justify-between py-2">
              <span>
                <strong>{e.anio}</strong>{' '}
                <Badge tone={e.estado === 'abierto' ? 'green' : 'slate'}>{e.estado === 'abierto' ? 'Abierto' : 'Cerrado'}</Badge>{' '}
                <span className="text-slate-500">· {e.contadorAsientos} asientos · {e.contadorFacturas ?? 0} facturas emitidas</span>
              </span>
              {e.anio === empresa.ejercicioActivo ? (
                <Badge tone="sky">Activo</Badge>
              ) : (
                <Button variant="ghost" onClick={() => cambiarEjercicioActivo(uid, e.anio).catch((err) => setMsgEj(errorMsg(err)))}>
                  Activar
                </Button>
              )}
            </li>
          ))}
        </ul>
        {msgEj && <div className="mt-3"><Alert>{msgEj}</Alert></div>}
        <Button
          variant="secondary"
          className="mt-4"
          onClick={async () => {
            setMsgEj(null)
            try {
              await abrirEjercicio(uid, siguiente)
            } catch (err) {
              setMsgEj(errorMsg(err))
            }
          }}
        >
          Abrir ejercicio {siguiente}
        </Button>
        <p className="mt-2 text-xs text-slate-500">
          El cierre con asientos de regularización y apertura llegará en la próxima versión; mientras tanto puedes hacerlos
          como asientos manuales.
        </p>
      </Card>
    </div>
  )
}
