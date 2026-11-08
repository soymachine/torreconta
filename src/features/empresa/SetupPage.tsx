import { useState } from 'react'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Alert, Card, Field, Input } from '../../components/ui'
import { inicializarEmpresa } from '../../services/empresa'
import { EmpresaForm } from './EmpresaForm'

/** Primer acceso: datos de la empresa y carga del plan de cuentas. */
export function SetupPage() {
  const eid = useEmpresaId()
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <Card className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-slate-900">Configura tu empresa</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          Se cargará el plan de cuentas del PGC de PYMES y se abrirá el primer ejercicio contable.
        </p>
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}
        <EmpresaForm
          submitLabel="Crear empresa"
          defaultValues={{
            razonSocial: '',
            nif: '',
            domicilio: '',
            codigoPostal: '',
            municipio: '',
            provincia: '',
            email: '',
            serieFacturas: 'F',
          }}
          extra={
            <Field label="Primer ejercicio" hint="Año natural del primer ejercicio contable">
              <Input
                type="number"
                min={2000}
                max={2100}
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              />
            </Field>
          }
          onSubmit={async (datos) => {
            setError(null)
            if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
              setError('Ejercicio no válido.')
              return
            }
            try {
              await inicializarEmpresa(eid, datos, anio)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se ha podido crear la empresa.')
            }
          }}
        />
      </Card>
    </main>
  )
}
