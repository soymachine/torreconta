import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Euros, PageHeader } from '../../components/shared'
import { Card } from '../../components/ui'
import { gastoPorCategoria, modelo303, trimestreActual } from '../../lib/iva'
import { paraInformes, pyg, sumasPorCuenta } from '../../lib/saldos'
import { useLibros } from '../libros/LibrosProvider'

function Kpi({ label, cents, count, to, tone }: { label: string; cents?: number; count?: number; to?: string; tone?: 'good' | 'bad' }) {
  const body = (
    <Card className="h-full p-4 transition-colors hover:border-slate-300">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'}`}>
        {count !== undefined ? <span className="tabular-nums">{count}</span> : <Euros cents={cents ?? 0} />}
      </div>
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function PanelPage() {
  const { anio, asientos, cuentas, emitidas, recibidas, emitidasAnteriores, recibidasAnteriores, categorias, empresa } = useLibros()
  const r = useMemo(() => pyg(paraInformes(asientos), cuentas), [asientos, cuentas])
  const [t] = useState(() => trimestreActual(anio))
  const iva = useMemo(() => modelo303(emitidas, recibidas, anio, t), [emitidas, recibidas, anio, t])
  const pendCobro = [...emitidas, ...emitidasAnteriores].filter((f) => f.estado === 'pendiente').reduce((s, f) => s + f.totalCent, 0)
  const pendPago = [...recibidas, ...recibidasAnteriores].filter((f) => f.estado === 'pendiente').reduce((s, f) => s + f.totalCent, 0)
  const sumas = useMemo(() => sumasPorCuenta(paraInformes(asientos)), [asientos])
  const tesoreria = [...sumas.entries()].filter(([c]) => c.startsWith('57')).reduce((s, [, v]) => s + v.debe - v.haber, 0)
  const gastos = useMemo(() => gastoPorCategoria(recibidas, `${anio}-01-01`, `${anio}-12-31`).slice(0, 6), [recibidas, anio])
  const maxGasto = Math.max(1, ...gastos.map((g) => g.importeCent))
  const cat = new Map(categorias.map((c) => [c.id, c]))

  return (
    <div>
      <PageHeader title={empresa.razonSocial} subtitle={`Resumen del ejercicio ${anio}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ingresos" cents={r.totalIngresos} to="/informes/pyg" />
        <Kpi label="Gastos" cents={r.totalGastos} to="/informes/pyg" />
        <Kpi label="Resultado" cents={r.resultado} to="/informes/pyg" tone={r.resultado >= 0 ? 'good' : 'bad'} />
        <Kpi label="Tesorería (57)" cents={tesoreria} to="/mayor?cuenta=57" />
        <Kpi label={`IVA ${t}T (a ingresar)`} cents={iva.resultadoCent} to="/informes/iva" />
        <Kpi label="Pendiente de cobro" cents={pendCobro} to="/facturas-emitidas" />
        <Kpi label="Pendiente de pago" cents={pendPago} to="/facturas-recibidas" />
        <Kpi label="Asientos" count={asientos.length} to="/diario" />
      </div>
      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Gasto por categoría</h2>
          <Link to="/informes/gasto-categorias" className="text-sm text-slate-600 hover:underline">Ver informe</Link>
        </div>
        {gastos.length === 0 && <p className="text-sm text-slate-500">Todavía no hay facturas recibidas.</p>}
        <div className="space-y-2">
          {gastos.map((g) => (
            <div key={g.categoriaId} className="grid grid-cols-[10rem_1fr_7rem] items-center gap-3 text-sm">
              <span className="truncate">{cat.get(g.categoriaId)?.nombre ?? '—'}</span>
              <div className="h-2.5 rounded bg-slate-100">
                <div className="h-2.5 rounded" style={{ width: `${(g.importeCent / maxGasto) * 100}%`, background: cat.get(g.categoriaId)?.color ?? '#64748b' }} />
              </div>
              <span className="text-right"><Euros cents={g.importeCent} /></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
