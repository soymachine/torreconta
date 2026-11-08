import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Euros, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Button, Select } from '../../components/base'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { gastoPorCategoria, rangoTrimestre, type Trimestre } from '../../lib/iva'
import { useLibros } from '../libros/LibrosProvider'

export function GastoCategoriasPage() {
  const { anio, recibidas, categorias } = useLibros()
  const [periodo, setPeriodo] = useState('anual')
  const { desde, hasta } = useMemo(() => {
    if (periodo === 'anual') return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
    if (periodo.startsWith('T')) return rangoTrimestre(anio, Number(periodo.slice(1)) as Trimestre)
    const m = periodo.padStart(2, '0')
    return { desde: `${anio}-${m}-01`, hasta: `${anio}-${m}-31` }
  }, [periodo, anio])
  const filas = useMemo(() => gastoPorCategoria(recibidas, desde, hasta), [recibidas, desde, hasta])
  const total = filas.reduce((s, f) => s + f.importeCent, 0)
  const cat = new Map(categorias.map((c) => [c.id, c]))
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const exportar = () =>
    descargarCsv(
      `gasto-categorias-${anio}-${periodo}.csv`,
      toCsv(['Categoría', 'Cuenta', 'Facturas', 'Importe'], filas.map((f) => [cat.get(f.categoriaId)?.nombre ?? f.categoriaId, cat.get(f.categoriaId)?.cuentaGasto ?? '', f.numFacturas, centsCsv(f.importeCent)])),
    )

  return (
    <div>
      <PageHeader
        title="Gasto por categoría"
        subtitle="Base imponible más el IVA no deducible"
        actions={
          <>
            <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
              <option value="anual">Año {anio}</option>
              {[1, 2, 3, 4].map((t) => <option key={t} value={`T${t}`}>{t}er trimestre</option>)}
              {meses.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </Select>
            <Button variant="secondary" onClick={exportar} disabled={!filas.length}>Exportar CSV</Button>
          </>
        }
      />
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className={th}>Categoría</th><th className={th}>Cuenta</th><th className={thNum}>Facturas</th><th className={thNum}>Importe</th><th className={th}>% del total</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const c = cat.get(f.categoriaId)
              const pct = total ? (f.importeCent / total) * 100 : 0
              return (
                <tr key={f.categoriaId} className="border-t border-slate-100">
                  <td className={td}>
                    <Link to={`/facturas-recibidas`} className="hover:underline">{c?.nombre ?? 'Sin categoría'}</Link>
                  </td>
                  <td className={`${td} font-mono`}>{c?.cuentaGasto}</td>
                  <td className={tdNum}>{f.numFacturas}</td>
                  <td className={tdNum}><Euros cents={f.importeCent} /></td>
                  <td className={`${td} w-1/3`}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded bg-slate-100">
                        <div className="h-2 rounded" style={{ width: `${pct}%`, background: c?.color ?? '#64748b' }} />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-slate-500">{pct.toFixed(1)} %</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold"><td className={td} colSpan={3}>Total</td><td className={tdNum}><Euros cents={total} /></td><td /></tr>
          </tfoot>
        </table>
        {filas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sin gastos en el periodo.</p>}
      </TableWrap>
    </div>
  )
}
