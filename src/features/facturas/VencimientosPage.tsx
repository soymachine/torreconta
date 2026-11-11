import { FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { Button, Card, Field, Input } from '../../components/base'
import { Badge, Euros, formatFecha, Modal, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import type { FacturaRecibida } from '../../lib/tipos'
import { hoyIso, sumarDias, vencidasPendientes, vencimientosEntre } from '../../lib/vencimientos'
import { useLibros } from '../libros/LibrosProvider'
import { TesoreriaForm } from './TesoreriaForm'
import { useLogo } from '../empresa/useLogo'
import { exportarVencimientosPdf } from './exportarVencimientosPdf'

function estadoVencimiento(dias: number, pagada: boolean) {
  if (pagada) return <Badge tone="green">Pagada</Badge>
  if (dias < 0) return <Badge tone="amber">Vencida hace {-dias} {dias === -1 ? 'día' : 'días'}</Badge>
  if (dias === 0) return <Badge tone="amber">Vence hoy</Badge>
  return <Badge tone="sky">Vence en {dias} {dias === 1 ? 'día' : 'días'}</Badge>
}

/** Listado de vencimientos de facturas recibidas entre dos fechas. */
export function VencimientosPage() {
  const { recibidas, recibidasAnteriores, empresa } = useLibros()
  const logo = useLogo()
  const [exportando, setExportando] = useState(false)
  const [hoy] = useState(() => hoyIso())
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(() => sumarDias(hoyIso(), 30))
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [pagar, setPagar] = useState<FacturaRecibida | null>(null)

  const todas = useMemo(() => [...recibidas, ...recibidasAnteriores], [recibidas, recibidasAnteriores])
  const filas = useMemo(() => vencimientosEntre(todas, desde, hasta, hoy, { soloPendientes }), [todas, desde, hasta, hoy, soloPendientes])
  const vencidas = useMemo(() => vencidasPendientes(todas, hoy), [todas, hoy])
  const totalPendiente = filas.filter((r) => r.factura.estado === 'pendiente').reduce((s, r) => s + r.factura.totalCent, 0)

  const rango = (d: string, h: string) => {
    setDesde(d)
    setHasta(h)
  }

  const exportar = () =>
    descargarCsv(
      `vencimientos-${desde}-${hasta}.csv`,
      toCsv(
        ['Vencimiento', 'Días', 'Proveedor', 'NIF', 'Nº factura', 'Fecha factura', 'Total', 'Estado'],
        filas.map((r) => [r.vencimiento, r.dias, r.factura.terceroNombre, r.factura.terceroNif, r.factura.numero, r.factura.fecha, centsCsv(r.factura.totalCent), r.factura.estado]),
      ),
    )

  const exportarPdf = async () => {
    setExportando(true)
    try {
      await exportarVencimientosPdf({ empresa, desde, hasta, soloPendientes, filas, vencidas, logo })
    } catch {
      toast.error('No se ha podido generar el PDF.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vencimientos de pago"
        subtitle="Facturas recibidas que vencen entre las fechas elegidas"
        actions={
          <>
            <Button variant="secondary" onClick={exportar} disabled={!filas.length}>Exportar CSV</Button>
            <Button variant="secondary" onClick={exportarPdf} disabled={exportando || !filas.length}>
              <FileDown /> {exportando ? 'Generando…' : 'Exportar PDF'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Desde">
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={soloPendientes} onCheckedChange={(v) => setSoloPendientes(v === true)} />
              Solo pendientes de pago
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              ['Próximos 7 días', hoy, sumarDias(hoy, 7)],
              ['Próximos 30 días', hoy, sumarDias(hoy, 30)],
              ['Próximos 90 días', hoy, sumarDias(hoy, 90)],
              ['Este mes', hoy.slice(0, 8) + '01', sumarDias(sumarDias(hoy.slice(0, 8) + '01', 32).slice(0, 8) + '01', -1)],
            ].map(([etiqueta, d, h]) => (
              <button key={etiqueta} type="button" onClick={() => rango(d, h)} className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50">
                {etiqueta}
              </button>
            ))}
          </div>
        </Card>
        <Card className={vencidas.numero ? 'border-amber-300 bg-amber-50' : ''}>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Vencidas sin pagar</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="vencidas-total"><Euros cents={vencidas.totalCent} /></div>
          <div className="text-xs text-slate-500">{vencidas.numero} facturas</div>
          {vencidas.numero > 0 && (
            <button type="button" className="mt-2 text-xs font-medium underline" onClick={() => rango('', sumarDias(hoy, -1))}>
              Ver vencidas
            </button>
          )}
        </Card>
      </div>

      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Vencimiento</th>
              <th className={th}>Situación</th>
              <th className={th}>Proveedor</th>
              <th className={th}>Nº factura</th>
              <th className={th}>Fecha factura</th>
              <th className={thNum}>Total</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.factura.id} className="border-t border-slate-100" data-testid="fila-vencimiento">
                <td className={`${td} whitespace-nowrap font-medium`}>{formatFecha(r.vencimiento)}</td>
                <td className={td}>{estadoVencimiento(r.dias, r.factura.estado === 'pagada')}</td>
                <td className={td}>{r.factura.terceroNombre}</td>
                <td className={`${td} font-mono`}>
                  <Link to={`/facturas-recibidas?ver=${r.factura.id}`} className="hover:underline">{r.factura.numero}</Link>
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatFecha(r.factura.fecha)}</td>
                <td className={`${tdNum} font-medium`}><Euros cents={r.factura.totalCent} /></td>
                <td className={`${td} text-right`}>
                  {r.factura.estado === 'pendiente' && (
                    <Button variant="ghost" className="px-2 py-1" onClick={() => setPagar(r.factura)}>Pagar</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={td} colSpan={5}>Pendiente de pago en el periodo ({filas.filter((r) => r.factura.estado === 'pendiente').length})</td>
              <td className={tdNum} data-testid="total-periodo"><Euros cents={totalPendiente} /></td>
              <td />
            </tr>
          </tfoot>
        </table>
        {filas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No hay vencimientos en este periodo.</p>}
      </TableWrap>

      {pagar && (
        <Modal title="Registrar pago" onClose={() => setPagar(null)}>
          <TesoreriaForm tipo="pago" factura={pagar} onDone={() => setPagar(null)} />
        </Modal>
      )}
    </div>
  )
}
