import type { BorradorAsiento } from '../lib/asientos'
import { totales } from '../lib/asientos'
import type { Cuenta } from '../lib/cuentas'
import { Euros, formatFecha, td, tdNum, th, thNum } from './shared'

/** Vista previa de un asiento aún no guardado. */
export function AsientoPreview({ asiento, cuentas, titulo }: { asiento: BorradorAsiento; cuentas: readonly Cuenta[]; titulo?: string }) {
  const nombres = new Map(cuentas.map((c) => [c.codigo, c.nombre]))
  const t = totales(asiento.lineas)
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <div className="flex justify-between bg-slate-50 px-3 py-2 text-sm">
        <span className="font-medium">{titulo ?? asiento.concepto}</span>
        <span className="text-slate-500">{formatFecha(asiento.fecha)} · {asiento.lineas.length} líneas</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr><th className={th}>Cuenta</th><th className={th}>Nombre</th><th className={thNum}>Debe</th><th className={thNum}>Haber</th></tr>
        </thead>
        <tbody>
          {asiento.lineas.map((l, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className={`${td} font-mono`}>{l.cuenta}</td>
              <td className={td}>{nombres.get(l.cuenta) ?? ''}</td>
              <td className={tdNum}>{l.debeCent ? <Euros cents={l.debeCent} /> : ''}</td>
              <td className={tdNum}>{l.haberCent ? <Euros cents={l.haberCent} /> : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 font-semibold">
            <td className={td} colSpan={2}>Totales</td>
            <td className={tdNum}><Euros cents={t.debe} /></td>
            <td className={tdNum}><Euros cents={t.haber} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
