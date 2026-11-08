import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CuentaInput, Euros, formatFecha, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Button, Field } from '../../components/ui'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { mayor } from '../../lib/saldos'
import { enlaceOrigen } from '../diario/DiarioPage'
import { useLibros } from '../libros/LibrosProvider'

export function MayorPage() {
  const { anio, asientos, cuentas } = useLibros()
  const [params, setParams] = useSearchParams()
  const cuenta = params.get('cuenta') ?? ''
  const info = cuentas.find((c) => c.codigo === cuenta)
  const movs = useMemo(() => (cuenta.length >= 1 ? mayor(asientos, cuenta) : []), [asientos, cuenta])
  const debe = movs.reduce((s, m) => s + m.debe, 0)
  const haber = movs.reduce((s, m) => s + m.haber, 0)

  const exportar = () =>
    descargarCsv(
      `mayor-${cuenta}-${anio}.csv`,
      toCsv(
        ['Fecha', 'Asiento', 'Concepto', 'Debe', 'Haber', 'Saldo'],
        movs.map((m) => [m.asiento.fecha, m.asiento.numero, m.concepto, centsCsv(m.debe), centsCsv(m.haber), centsCsv(m.saldo)]),
      ),
    )

  return (
    <div>
      <PageHeader
        title="Libro mayor"
        subtitle={info ? `${info.codigo} · ${info.nombre}` : 'Elige una cuenta (o un prefijo, p. ej. 43 para todos los clientes)'}
        actions={<Button variant="secondary" onClick={exportar} disabled={!movs.length}>Exportar CSV</Button>}
      />
      <Field label="Cuenta" className="mb-4 max-w-xs">
        <CuentaInput
          cuentas={cuentas}
          value={cuenta}
          onChange={(v) => setParams(v ? { cuenta: v } : {}, { replace: true })}
          aria-label="Cuenta del mayor"
        />
      </Field>
      {cuenta && (
        <TableWrap>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Asiento</th>
                {cuenta.length < 7 && <th className={th}>Cuenta</th>}
                <th className={th}>Concepto</th>
                <th className={thNum}>Debe</th>
                <th className={thNum}>Haber</th>
                <th className={thNum}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m, i) => {
                const enlace = enlaceOrigen(m.asiento)
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className={`${td} whitespace-nowrap`}>{formatFecha(m.asiento.fecha)}</td>
                    <td className={td}>{m.asiento.numero}</td>
                    {cuenta.length < 7 && <td className={`${td} font-mono`}>{m.cuenta}</td>}
                    <td className={td}>
                      {enlace ? <Link to={enlace} className="hover:underline">{m.concepto}</Link> : m.concepto}
                    </td>
                    <td className={tdNum}>{m.debe ? <Euros cents={m.debe} /> : ''}</td>
                    <td className={tdNum}>{m.haber ? <Euros cents={m.haber} /> : ''}</td>
                    <td className={`${tdNum} font-medium`}><Euros cents={m.saldo} /></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className={td} colSpan={cuenta.length < 7 ? 4 : 3}>Totales</td>
                <td className={tdNum}><Euros cents={debe} /></td>
                <td className={tdNum}><Euros cents={haber} /></td>
                <td className={tdNum} data-testid="saldo-mayor"><Euros cents={debe - haber} /></td>
              </tr>
            </tfoot>
          </table>
          {movs.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sin movimientos en {anio}.</p>}
        </TableWrap>
      )}
    </div>
  )
}
