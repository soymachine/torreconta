import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Euros, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Button, Select } from '../../components/ui'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { sumasYSaldos } from '../../lib/saldos'
import { useLibros } from '../libros/LibrosProvider'

export function SumasSaldosPage() {
  const { anio, asientos, cuentas } = useLibros()
  const [nivel, setNivel] = useState<'3' | '2' | 'detalle'>('detalle')
  const filas = useMemo(() => sumasYSaldos(asientos, cuentas, nivel === 'detalle' ? null : Number(nivel)), [asientos, cuentas, nivel])
  const tot = filas.reduce(
    (s, f) => ({ debe: s.debe + f.debe, haber: s.haber + f.haber, sd: s.sd + f.saldoDeudor, sa: s.sa + f.saldoAcreedor }),
    { debe: 0, haber: 0, sd: 0, sa: 0 },
  )

  const exportar = () =>
    descargarCsv(
      `sumas-y-saldos-${anio}.csv`,
      toCsv(
        ['Cuenta', 'Nombre', 'Debe', 'Haber', 'Saldo deudor', 'Saldo acreedor'],
        filas.map((f) => [f.codigo, f.nombre, centsCsv(f.debe), centsCsv(f.haber), centsCsv(f.saldoDeudor), centsCsv(f.saldoAcreedor)]),
      ),
    )

  return (
    <div>
      <PageHeader
        title="Sumas y saldos"
        subtitle={`Ejercicio ${anio}`}
        actions={
          <>
            <Select value={nivel} onChange={(e) => setNivel(e.target.value as typeof nivel)} aria-label="Nivel">
              <option value="detalle">Cuentas de detalle</option>
              <option value="3">Cuentas (3 dígitos)</option>
              <option value="2">Subgrupos (2 dígitos)</option>
            </Select>
            <Button variant="secondary" onClick={exportar} disabled={!filas.length}>Exportar CSV</Button>
          </>
        }
      />
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Cuenta</th>
              <th className={th}>Nombre</th>
              <th className={thNum}>Debe</th>
              <th className={thNum}>Haber</th>
              <th className={thNum}>Saldo deudor</th>
              <th className={thNum}>Saldo acreedor</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.codigo} className="border-t border-slate-100">
                <td className={`${td} font-mono`}><Link to={`/mayor?cuenta=${f.codigo}`} className="hover:underline">{f.codigo}</Link></td>
                <td className={td}>{f.nombre}</td>
                <td className={tdNum}><Euros cents={f.debe} muted /></td>
                <td className={tdNum}><Euros cents={f.haber} muted /></td>
                <td className={tdNum}>{f.saldoDeudor ? <Euros cents={f.saldoDeudor} /> : ''}</td>
                <td className={tdNum}>{f.saldoAcreedor ? <Euros cents={f.saldoAcreedor} /> : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={td} colSpan={2}>Totales</td>
              <td className={tdNum}><Euros cents={tot.debe} /></td>
              <td className={tdNum}><Euros cents={tot.haber} /></td>
              <td className={tdNum}><Euros cents={tot.sd} /></td>
              <td className={tdNum}><Euros cents={tot.sa} /></td>
            </tr>
          </tfoot>
        </table>
        {filas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sin movimientos.</p>}
      </TableWrap>
    </div>
  )
}
