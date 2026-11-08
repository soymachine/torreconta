import { useMemo } from 'react'
import { Euros, PageHeader } from '../../components/shared'
import { Button, Card } from '../../components/ui'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { paraInformes, pyg, type PartidaPyg } from '../../lib/saldos'
import { useLibros } from '../libros/LibrosProvider'

function Bloque({ titulo, partidas, total }: { titulo: string; partidas: PartidaPyg[]; total: number }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between border-b border-slate-200 pb-1 font-semibold"><span>{titulo}</span><Euros cents={total} /></div>
      {partidas.map((p) => (
        <div key={p.codigo} className="flex justify-between py-0.5 pl-3 text-slate-700">
          <span><span className="mr-2 font-mono text-xs text-slate-400">{p.codigo}</span>{p.nombre}</span>
          <Euros cents={p.importe} />
        </div>
      ))}
      {partidas.length === 0 && <div className="pl-3 text-slate-400">—</div>}
    </div>
  )
}

export function PygPage() {
  const { anio, asientos, cuentas } = useLibros()
  const r = useMemo(() => pyg(paraInformes(asientos), cuentas), [asientos, cuentas])
  const exportar = () =>
    descargarCsv(
      `pyg-${anio}.csv`,
      toCsv(['Tipo', 'Subgrupo', 'Partida', 'Importe'], [
        ...r.ingresos.map((p) => ['Ingreso', p.codigo, p.nombre, centsCsv(p.importe)]),
        ...r.gastos.map((p) => ['Gasto', p.codigo, p.nombre, centsCsv(p.importe)]),
        ['Resultado', '', '', centsCsv(r.resultado)],
      ]),
    )
  return (
    <div>
      <PageHeader
        title="Pérdidas y ganancias"
        subtitle={`Ejercicio ${anio}`}
        actions={<><Button variant="secondary" onClick={() => window.print()}>Imprimir</Button><Button variant="secondary" onClick={exportar}>Exportar CSV</Button></>}
      />
      <Card className="max-w-2xl">
        <Bloque titulo="Ingresos" partidas={r.ingresos} total={r.totalIngresos} />
        <Bloque titulo="Gastos" partidas={r.gastos} total={r.totalGastos} />
        <div className={`flex justify-between border-t-2 border-slate-300 pt-2 text-lg font-semibold ${r.resultado < 0 ? 'text-red-700' : 'text-emerald-700'}`} data-testid="resultado">
          <span>Resultado del ejercicio</span><Euros cents={r.resultado} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Resultado antes del impuesto sobre sociedades si no se ha contabilizado la cuenta 630.</p>
      </Card>
    </div>
  )
}
