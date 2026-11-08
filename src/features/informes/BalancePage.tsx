import { useMemo } from 'react'
import { Euros, PageHeader } from '../../components/shared'
import { Alert, Button, Card } from '../../components/base'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { balance, paraInformes, type SeccionBalance } from '../../lib/saldos'
import { useLibros } from '../libros/LibrosProvider'

function Seccion({ s }: { s: SeccionBalance }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between border-b border-slate-200 pb-1 font-semibold">
        <span>{s.titulo}</span>
        <Euros cents={s.total} />
      </div>
      {s.partidas.map((p) => (
        <div key={p.codigo + p.nombre} className="flex justify-between py-0.5 pl-3 text-slate-700">
          <span><span className="mr-2 font-mono text-xs text-slate-400">{p.codigo}</span>{p.nombre}</span>
          <Euros cents={p.importe} />
        </div>
      ))}
      {s.partidas.length === 0 && <div className="pl-3 text-slate-400">—</div>}
    </div>
  )
}

export function BalancePage() {
  const { anio, asientos, cuentas, ejercicio } = useLibros()
  const b = useMemo(() => balance(paraInformes(asientos), cuentas), [asientos, cuentas])
  const secciones = [b.activoNoCorriente, b.activoCorriente, b.patrimonioNeto, b.pasivoNoCorriente, b.pasivoCorriente]
  const exportar = () =>
    descargarCsv(
      `balance-${anio}.csv`,
      toCsv(['Sección', 'Código', 'Partida', 'Importe'], secciones.flatMap((s) => s.partidas.map((p) => [s.titulo, p.codigo, p.nombre, centsCsv(p.importe)]))),
    )
  return (
    <div>
      <PageHeader
        title="Balance de situación"
        subtitle={`Ejercicio ${anio}${ejercicio?.estado === 'cerrado' ? ' (cerrado) · antes del asiento de cierre' : ' · a la fecha del último asiento'} · incluye el resultado del ejercicio`}
        actions={<><Button variant="secondary" onClick={() => window.print()}>Imprimir</Button><Button variant="secondary" onClick={exportar}>Exportar CSV</Button></>}
      />
      {!b.cuadra && <div className="mb-4"><Alert>El balance no cuadra: revisa el diario.</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Activo</h2>
          <Seccion s={b.activoNoCorriente} />
          <Seccion s={b.activoCorriente} />
          <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-semibold" data-testid="total-activo">
            <span>Total activo</span><Euros cents={b.totalActivo} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Patrimonio neto y pasivo</h2>
          <Seccion s={b.patrimonioNeto} />
          <Seccion s={b.pasivoNoCorriente} />
          <Seccion s={b.pasivoCorriente} />
          <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-semibold" data-testid="total-pasivo">
            <span>Total patrimonio neto y pasivo</span><Euros cents={b.totalPasivoYPn} />
          </div>
        </Card>
      </div>
    </div>
  )
}
