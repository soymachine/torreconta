import { Checkbox } from '@/components/ui/checkbox'
import { FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, Button, Card } from '../../components/base'
import { Badge, Euros, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { calcularModelo347, UMBRAL_METALICO, type Fila347 } from '../../lib/modelo347'
import { useLogo } from '../empresa/useLogo'
import { useLibros } from '../libros/LibrosProvider'
import { exportar347Pdf } from './exportar347Pdf'

function Tabla({ titulo, filas, testid }: { titulo: string; filas: Fila347[]; testid: string }) {
  const sum = (fn: (f: Fila347) => number) => filas.reduce((s, f) => s + fn(f), 0)
  return (
    <div className="space-y-2" data-testid={testid}>
      <h2 className="font-semibold">{titulo}</h2>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>NIF</th>
              <th className={th}>Nombre</th>
              <th className={th}>Prov.</th>
              {['1T', '2T', '3T', '4T'].map((t) => <th key={t} className={thNum}>{t}</th>)}
              <th className={thNum}>Total anual</th>
              <th className={thNum}>Metálico</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave + f.terceroId} className="border-t border-slate-100">
                <td className={`${td} font-mono`}>{f.nif || '—'}</td>
                <td className={td}>
                  {f.nombre}
                  {f.avisos.map((a) => (
                    <span key={a} className="ml-1"><Badge tone="amber">{a}</Badge></span>
                  ))}
                </td>
                <td className={td}>{f.provincia ?? '—'}</td>
                {f.trimestres.map((c, i) => <td key={i} className={tdNum}><Euros cents={c} muted /></td>)}
                <td className={`${tdNum} font-semibold`}><Euros cents={f.totalCent} /></td>
                <td className={tdNum}>
                  {f.metalicoCent ? <Euros cents={f.metalicoCent} className={f.metalicoCent > UMBRAL_METALICO ? 'font-semibold text-amber-700' : ''} /> : ''}
                </td>
              </tr>
            ))}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className={td} colSpan={3}>Total ({filas.length})</td>
                {[0, 1, 2, 3].map((i) => <td key={i} className={tdNum}><Euros cents={sum((f) => f.trimestres[i])} /></td>)}
                <td className={tdNum}><Euros cents={sum((f) => f.totalCent)} /></td>
                <td className={tdNum}><Euros cents={sum((f) => f.metalicoCent)} muted /></td>
              </tr>
            </tfoot>
          )}
        </table>
        {filas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Sin operaciones que declarar.</p>}
      </TableWrap>
    </div>
  )
}

export function Modelo347Page() {
  const { anio, empresa, emitidas, recibidas, emitidasAnteriores, terceros } = useLibros()
  const logo = useLogo()
  const [verTodos, setVerTodos] = useState(false)
  const [conRetencion, setConRetencion] = useState(false)
  const [exportando, setExportando] = useState(false)

  const r = useMemo(
    () => calcularModelo347({ anio, emitidas, recibidas, emitidasAnteriores, terceros, incluirConRetencion: conRetencion }),
    [anio, emitidas, recibidas, emitidasAnteriores, terceros, conRetencion],
  )
  const filas = verTodos ? [...r.declarados, ...r.noDeclarados] : r.declarados
  const avisos = r.declarados.filter((f) => f.avisos.length).length

  const pdf = async () => {
    setExportando(true)
    try {
      await exportar347Pdf({ anio, empresa, logo, resultado: r, filas, incluirConRetencion: conRetencion, incluyeNoDeclarados: verTodos })
    } catch {
      toast.error('No se ha podido generar el PDF.')
    } finally {
      setExportando(false)
    }
  }

  const csv = () =>
    descargarCsv(
      `modelo-347-${anio}.csv`,
      toCsv(
        ['Clave', 'NIF', 'Nombre', 'Provincia', '1T', '2T', '3T', '4T', 'Total anual', 'Metálico', 'Avisos'],
        filas.map((f) => [f.clave, f.nif, f.nombre, f.provincia ?? '', ...f.trimestres.map(centsCsv), centsCsv(f.totalCent), centsCsv(f.metalicoCent), f.avisos.join('; ')]),
      ),
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones con terceros (347)"
        subtitle={`Ejercicio ${anio} · terceros con más de 3.005,06 € en el año, IVA incluido`}
        actions={
          <>
            <Button variant="secondary" onClick={csv} disabled={!filas.length}>Exportar CSV</Button>
            <Button onClick={pdf} disabled={exportando}>
              <FileDown /> {exportando ? 'Generando…' : 'Exportar PDF'}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Clave B · ventas</div>
          <div className="mt-1 text-xl font-semibold"><Euros cents={r.totales.B.importeCent} /></div>
          <div className="text-xs text-slate-500">{r.totales.B.declarados} clientes declarados</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Clave A · compras</div>
          <div className="mt-1 text-xl font-semibold"><Euros cents={r.totales.A.importeCent} /></div>
          <div className="text-xs text-slate-500">{r.totales.A.declarados} proveedores declarados</div>
        </Card>
        <Card className="space-y-2 p-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={verTodos} onCheckedChange={(v) => setVerTodos(v === true)} />
            Mostrar también los que no superan el umbral
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={conRetencion} onCheckedChange={(v) => setConRetencion(v === true)} />
            Incluir facturas recibidas con retención IRPF
          </label>
        </Card>
      </div>
      {avisos > 0 && <Alert tone="info">Hay {avisos} declarados con datos por revisar (NIF o código postal). Corrígelos en «Clientes y proveedores».</Alert>}
      <Tabla titulo="Clave B · Entregas (clientes)" filas={filas.filter((f) => f.clave === 'B')} testid="tabla-347-B" />
      <Tabla titulo="Clave A · Adquisiciones (proveedores y acreedores)" filas={filas.filter((f) => f.clave === 'A')} testid="tabla-347-A" />
      <p className="text-xs text-slate-500">
        Datos orientativos para cumplimentar el modelo 347 (plazo: febrero del año siguiente). Importes con IVA incluido, sin
        descontar retenciones, por la fecha de la factura. Las facturas recibidas con retención de IRPF se declaran en el
        modelo 190. La provincia se toma del código postal del domicilio. Revísalos antes de presentarlo.
      </p>
    </div>
  )
}
