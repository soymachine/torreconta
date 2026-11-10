import { DatabaseBackup } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Button, Card } from '../../components/base'
import { errorMsg } from '../../components/shared'
import { descargarCopia } from '../../services/copia'

export function CopiaCard() {
  const eid = useEmpresaId()
  const [generando, setGenerando] = useState(false)
  const descargar = async () => {
    setGenerando(true)
    try {
      const n = await descargarCopia(eid)
      toast.success(`Copia descargada (${n} registros)`)
    } catch (e) {
      toast.error(errorMsg(e))
    } finally {
      setGenerando(false)
    }
  }
  return (
    <Card className="max-w-2xl space-y-3">
      <h2 className="text-lg font-semibold">Copia de seguridad</h2>
      <p className="text-sm text-muted-foreground">
        Descarga un archivo con todos los datos de la empresa: cuentas, clientes y proveedores, facturas, asientos y
        ejercicios. Hazlo de forma periódica (por ejemplo, cada mes y tras cerrar el ejercicio) y guárdalo en un lugar
        seguro: contiene datos personales y fiscales.
      </p>
      <Button variant="secondary" onClick={descargar} disabled={generando}>
        <DatabaseBackup /> {generando ? 'Generando…' : 'Descargar copia de seguridad (JSON)'}
      </Button>
    </Card>
  )
}
