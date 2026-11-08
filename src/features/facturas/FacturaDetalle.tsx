import { Link } from 'react-router-dom'
import { Badge, Euros, formatFecha, td, tdNum, th, thNum } from '../../components/shared'
import { importeLinea } from '../../lib/contabilizacion'
import type { FacturaEmitida, FacturaRecibida } from '../../lib/tipos'
import { useLibros } from '../libros/LibrosProvider'

export function FacturaDetalle({ factura }: { factura: FacturaEmitida | FacturaRecibida }) {
  const { asientos, cuentas, categorias } = useLibros()
  const nombres = new Map(cuentas.map((c) => [c.codigo, c.nombre]))
  const asiento = asientos.find((a) => a.id === factura.asientoId)
  const mov = 'cobro' in factura ? factura.cobro : factura.pago
  const recibida = 'categoriaId' in factura
  const categoria = 'categoriaId' in factura ? categorias.find((c) => c.id === factura.categoriaId) : undefined
  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div><span className="text-slate-500">Fecha:</span> {formatFecha(factura.fecha)}</div>
        <div><span className="text-slate-500">Tercero:</span> {factura.terceroNombre} {factura.terceroNif && `(${factura.terceroNif})`}</div>
        {categoria && <div><span className="text-slate-500">Categoría:</span> {categoria.nombre} ({categoria.cuentaGasto})</div>}
        <div>
          <span className="text-slate-500">Estado:</span>{' '}
          {mov ? <Badge tone="green">{'cobro' in factura ? 'Cobrada' : 'Pagada'} el {formatFecha(mov.fecha)} ({mov.cuenta})</Badge> : <Badge tone="amber">Pendiente</Badge>}
        </div>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>Concepto</th>
            {!recibida && <th className={thNum}>Cant.</th>}
            <th className={thNum}>{recibida ? 'Base imponible' : 'Precio'}</th>
            <th className={thNum}>IVA</th>
            <th className={thNum}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {factura.lineas.map((l, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className={td}>{l.concepto}</td>
              {!recibida && <td className={tdNum}>{l.cantidad.toLocaleString('es-ES')}</td>}
              <td className={tdNum}><Euros cents={l.precioCent} /></td>
              <td className={tdNum}>{l.ivaPct} %</td>
              <td className={tdNum}><Euros cents={importeLinea(l)} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-right">
          <tr><td colSpan={recibida ? 3 : 4} className="px-3 pt-2 text-slate-500">Base</td><td className={tdNum}><Euros cents={factura.baseCent} /></td></tr>
          <tr><td colSpan={recibida ? 3 : 4} className="px-3 text-slate-500">IVA</td><td className={tdNum}><Euros cents={factura.cuotaIvaCent} /></td></tr>
          {factura.retencionCent !== 0 && <tr><td colSpan={recibida ? 3 : 4} className="px-3 text-slate-500">Retención {factura.irpfPct} %</td><td className={tdNum}>−<Euros cents={factura.retencionCent} /></td></tr>}
          <tr className="font-semibold"><td colSpan={recibida ? 3 : 4} className="px-3">Total</td><td className={tdNum}><Euros cents={factura.totalCent} /></td></tr>
        </tfoot>
      </table>
      {asiento && (
        <div>
          <h3 className="mb-1 font-semibold">Asiento nº {asiento.numero}</h3>
          <table className="w-full">
            <tbody>
              {asiento.lineas.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className={`${td} font-mono`}><Link className="hover:underline" to={`/mayor?cuenta=${l.cuenta}`}>{l.cuenta}</Link></td>
                  <td className={td}>{nombres.get(l.cuenta)}</td>
                  <td className={tdNum}>{l.debeCent ? <Euros cents={l.debeCent} /> : ''}</td>
                  <td className={tdNum}>{l.haberCent ? <Euros cents={l.haberCent} /> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
