import { useState } from 'react'
import { useUid } from '../../auth/AuthProvider'
import { Alert, Card } from '../../components/ui'
import { actualizarEmpresa } from '../../services/empresa'
import { EmpresaForm } from './EmpresaForm'
import { useEmpresa } from './EmpresaProvider'

export function EmpresaPage() {
  const uid = useUid()
  const empresa = useEmpresa()
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Empresa</h1>
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
        <p className="mt-6 text-xs text-slate-500">Ejercicio activo: {empresa.ejercicioActivo}</p>
      </Card>
    </div>
  )
}
