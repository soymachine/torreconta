import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, errorMsg, Euros, formatFecha, hoyEn, Modal, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Alert, Button, Input, Select } from '../../components/ui'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import type { FacturaEmitida } from '../../lib/tipos'
import { borrarFacturaEmitida, deshacerCobro } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'
import { FacturaDetalle } from './FacturaDetalle'
import { FacturaForm } from './FacturaForm'
import { TesoreriaForm } from './TesoreriaForm'

type ModalState = { tipo: 'nueva' } | { tipo: 'editar' | 'cobrar'; f: FacturaEmitida } | null

export function FacturasEmitidasPage() {
  const { eid, anio, emitidas, emitidasAnteriores, ejercicio } = useLibros()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<ModalState>(null)
  const [estado, setEstado] = useState<'' | 'pendiente' | 'cobrada'>('')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abierto = ejercicio?.estado === 'abierto'
  const ver = [...emitidas, ...emitidasAnteriores].find((f) => f.id === params.get('ver'))

  const visibles = useMemo(
    () =>
      [...emitidas, ...emitidasAnteriores]
        .sort((a, b) => b.ejercicio - a.ejercicio || b.secuencia - a.secuencia)
        .filter((f) => (!estado || f.estado === estado) && (!q || `${f.numero} ${f.terceroNombre}`.toLowerCase().includes(q.toLowerCase()))),
    [emitidas, emitidasAnteriores, estado, q],
  )
  const tot = visibles.reduce((s, f) => ({ base: s.base + f.baseCent, iva: s.iva + f.cuotaIvaCent, total: s.total + f.totalCent }), { base: 0, iva: 0, total: 0 })

  const accion = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMsg(e))
    }
  }

  const exportar = () =>
    descargarCsv(
      `facturas-emitidas-${anio}.csv`,
      toCsv(
        ['Número', 'Fecha', 'Cliente', 'NIF', 'Base', 'IVA', 'Retención', 'Total', 'Estado', 'Fecha cobro'],
        visibles.map((f) => [f.numero, f.fecha, f.terceroNombre, f.terceroNif, centsCsv(f.baseCent), centsCsv(f.cuotaIvaCent), centsCsv(f.retencionCent), centsCsv(f.totalCent), f.estado, f.cobro?.fecha ?? '']),
      ),
    )

  return (
    <div>
      <PageHeader
        title="Facturas emitidas"
        subtitle={`Ejercicio ${anio} · ${emitidas.length} facturas`}
        actions={
          <>
            <Button variant="secondary" onClick={exportar} disabled={!visibles.length}>Exportar CSV</Button>
            <Button onClick={() => setModal({ tipo: 'nueva' })} disabled={!abierto}>Nueva factura</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className="max-w-xs" aria-label="Estado">
          <option value="">Todas</option>
          <option value="pendiente">Pendientes de cobro</option>
          <option value="cobrada">Cobradas</option>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número o cliente" className="max-w-xs" aria-label="Buscar factura" />
      </div>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Número</th>
              <th className={th}>Fecha</th>
              <th className={th}>Cliente</th>
              <th className={thNum}>Base</th>
              <th className={thNum}>IVA</th>
              <th className={thNum}>Total</th>
              <th className={th}>Estado</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className={`${td} font-mono`}>
                  <button className="hover:underline" onClick={() => setParams({ ver: f.id })}>{f.numero}</button>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {formatFecha(f.fecha)} {f.ejercicio !== anio && <Badge>{f.ejercicio}</Badge>}
                </td>
                <td className={td}>{f.terceroNombre}</td>
                <td className={tdNum}><Euros cents={f.baseCent} /></td>
                <td className={tdNum}><Euros cents={f.cuotaIvaCent} /></td>
                <td className={`${tdNum} font-medium`}><Euros cents={f.totalCent} /></td>
                <td className={td}>{f.estado === 'cobrada' ? <Badge tone="green">Cobrada</Badge> : <Badge tone="amber">Pendiente</Badge>}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <Link to={`/facturas-emitidas/${f.id}/imprimir`} className="mr-1 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">Imprimir</Link>
                  {f.estado === 'pendiente' ? (
                    <>
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'cobrar', f })}>Cobrar</Button>
                      {abierto && f.ejercicio === anio && <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'editar', f })}>Editar</Button>}
                      {abierto && f.ejercicio === anio && (
                        <Button variant="ghost" className="px-2 py-1 text-red-700" onClick={() => confirm(`¿Borrar la factura ${f.numero}?`) && accion(() => borrarFacturaEmitida(eid, f))}>
                          Borrar
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="ghost" className="px-2 py-1" onClick={() => confirm('¿Deshacer el cobro? Se borrará su asiento.') && accion(() => deshacerCobro(eid, f))}>
                      Deshacer cobro
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={td} colSpan={3}>Total</td>
              <td className={tdNum}><Euros cents={tot.base} /></td>
              <td className={tdNum}><Euros cents={tot.iva} /></td>
              <td className={tdNum}><Euros cents={tot.total} /></td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        {visibles.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No hay facturas.</p>}
      </TableWrap>

      {modal?.tipo === 'nueva' && (
        <Modal title="Nueva factura emitida" onClose={() => setModal(null)} wide>
          <FacturaForm tipo="emitida" fechaInicial={hoyEn(anio)} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'editar' && (
        <Modal title={`Factura ${modal.f.numero}`} onClose={() => setModal(null)} wide>
          <FacturaForm tipo="emitida" existente={modal.f} fechaInicial={modal.f.fecha} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'cobrar' && (
        <Modal title="Registrar cobro" onClose={() => setModal(null)}>
          <TesoreriaForm tipo="cobro" factura={modal.f} onDone={() => setModal(null)} />
        </Modal>
      )}
      {ver && (
        <Modal title={`Factura ${ver.numero}`} onClose={() => setParams({})} wide>
          <FacturaDetalle factura={ver} />
        </Modal>
      )}
    </div>
  )
}
