import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmar } from '@/components/Confirmar'
import { Checkbox } from '@/components/ui/checkbox'
import { useSearchParams } from 'react-router-dom'
import { Badge, errorMsg, Euros, formatFecha, hoyEn, Modal, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import type { FacturaRecibida } from '../../lib/tipos'
import { borrarFacturaRecibida, deshacerPago, reasignarCategoria } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'
import { FacturaDetalle } from './FacturaDetalle'
import { FacturaForm } from './FacturaForm'
import { faltaSubcuenta, SubcuentaGastoSelect } from './SubcuentaGastoSelect'
import { CategoriaGastoSelect } from './CategoriaGastoSelect'
import { hoyIso, vencimientoDe } from '../../lib/vencimientos'
import { raizDeSeleccion } from '../../lib/categoriasGasto'
import { asegurarCategoria } from '../../services/categorias'
import { TesoreriaForm } from './TesoreriaForm'

type ModalState = { tipo: 'nueva' | 'reasignar' } | { tipo: 'editar' | 'pagar'; f: FacturaRecibida } | null

export function FacturasRecibidasPage() {
  const { eid, anio, recibidas, recibidasAnteriores, categorias, cuentas, ejercicio } = useLibros()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<ModalState>(null)
  const [estado, setEstado] = useState<'' | 'pendiente' | 'pagada'>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [q, setQ] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [destino, setDestino] = useState('')
  const [hoy] = useState(() => hoyIso())
  const [subcuentaDestino, setSubcuentaDestino] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abierto = ejercicio?.estado === 'abierto'
  const confirmar = useConfirmar()
  const ver = [...recibidas, ...recibidasAnteriores].find((f) => f.id === params.get('ver'))
  const catPorId = new Map(categorias.map((c) => [c.id, c]))

  const visibles = useMemo(
    () =>
      [...recibidas, ...recibidasAnteriores]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .filter(
          (f) =>
            (!estado || f.estado === estado) &&
            (!categoriaFiltro || f.categoriaId === categoriaFiltro) &&
            (!q || `${f.numero} ${f.terceroNombre}`.toLowerCase().includes(q.toLowerCase())),
        ),
    [recibidas, recibidasAnteriores, estado, categoriaFiltro, q],
  )
  const tot = visibles.reduce((s, f) => ({ base: s.base + f.baseCent, iva: s.iva + f.cuotaIvaCent, total: s.total + f.totalCent }), { base: 0, iva: 0, total: 0 })
  const seleccionadas = visibles.filter((f) => seleccion.has(f.id) && f.ejercicio === anio)
  const seleccionables = visibles.filter((f) => f.ejercicio === anio)
  const todas = seleccionables.length > 0 && seleccionadas.length === seleccionables.length

  const accion = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMsg(e))
    }
  }

  const toggle = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const reasignar = async () => {
    if (!destino) return
    await accion(async () => {
      // Si se eligió una cuenta mayor sin categoría, se crea su categoría.
      const cat = await asegurarCategoria(eid, destino, categorias, cuentas)
      await reasignarCategoria(eid, seleccionadas, cat, cuentas, subcuentaDestino || undefined)
      toast.success(`${seleccionadas.length} facturas movidas a «${cat.nombre}»`)
      setSeleccion(new Set())
      setModal(null)
    })
  }

  const exportar = () =>
    descargarCsv(
      `facturas-recibidas-${anio}.csv`,
      toCsv(
        ['Número', 'Fecha', 'Proveedor', 'NIF', 'Categoría', 'Cuenta gasto', 'Base', 'IVA', 'IVA deducible', 'Retención', 'Total', 'Estado', 'Fecha pago'],
        visibles.map((f) => {
          const c = catPorId.get(f.categoriaId)
          return [f.numero, f.fecha, f.terceroNombre, f.terceroNif, c?.nombre ?? '', c?.cuentaGasto ?? '', centsCsv(f.baseCent), centsCsv(f.cuotaIvaCent), f.ivaDeducible ? 'Sí' : 'No', centsCsv(f.retencionCent), centsCsv(f.totalCent), f.estado, f.pago?.fecha ?? '']
        }),
      ),
    )

  return (
    <div>
      <PageHeader
        title="Facturas recibidas"
        subtitle={`Ejercicio ${anio} · ${recibidas.length} facturas`}
        actions={
          <>
            <Button variant="secondary" onClick={exportar} disabled={!visibles.length}>Exportar CSV</Button>
            <Button onClick={() => setModal({ tipo: 'nueva' })} disabled={!abierto || categorias.length === 0}>Nueva factura</Button>
          </>
        }
      />
      {categorias.length === 0 && <div className="mb-3"><Alert tone="info">Crea antes al menos una categoría de gasto (menú «Categorías»).</Alert></div>}
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className="max-w-[14rem]" aria-label="Estado">
          <option value="">Todas</option>
          <option value="pendiente">Pendientes de pago</option>
          <option value="pagada">Pagadas</option>
        </Select>
        <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="max-w-[16rem]" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número o proveedor" className="max-w-xs" aria-label="Buscar factura" />
        {seleccionadas.length > 0 && abierto && (
          <Button variant="secondary" onClick={() => setModal({ tipo: 'reasignar' })}>
            Cambiar categoría ({seleccionadas.length})
          </Button>
        )}
      </div>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>
                <Checkbox checked={todas} onCheckedChange={() => setSeleccion(todas ? new Set() : new Set(seleccionables.map((f) => f.id)))} aria-label="Seleccionar todas" />
              </th>
              <th className={th}><span className="sr-only">Acciones</span></th>
              <th className={th}>Fecha</th>
              <th className={th}>Número</th>
              <th className={th}>Vence</th>
              <th className={th}>Proveedor</th>
              <th className={th}>Categoría</th>
              <th className={thNum}>Base</th>
              <th className={thNum}>IVA</th>
              <th className={thNum}>Total</th>
              <th className={th}>Estado</th>
              <th className={th}><span className="sr-only">Borrar</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const c = catPorId.get(f.categoriaId)
              return (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className={td}><Checkbox disabled={f.ejercicio !== anio} checked={seleccion.has(f.id)} onCheckedChange={() => toggle(f.id)} aria-label={`Seleccionar ${f.numero}`} /></td>
                  <td className={`${td} whitespace-nowrap`}>
                    {f.estado === 'pendiente' ? (
                      <>
                        {abierto && f.ejercicio === anio && <Button variant="ghost" className="px-2 py-1 text-sky-700 hover:bg-sky-50 hover:text-sky-800" onClick={() => setModal({ tipo: 'editar', f })}>Editar</Button>}
                        <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'pagar', f })}>Pagar</Button>
                      </>
                    ) : (
                      <Button variant="ghost" className="px-2 py-1" onClick={async () => (await confirmar({ titulo: '¿Deshacer el pago?', descripcion: 'Se borrará el asiento del pago y la factura volverá a quedar pendiente.', accion: 'Deshacer pago', destructiva: true })) && accion(() => deshacerPago(eid, f))}>
                        Deshacer pago
                      </Button>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {formatFecha(f.fecha)} {f.ejercicio !== anio && <Badge>{f.ejercicio}</Badge>}
                  </td>
                  <td className={`${td} font-mono`}><button className="hover:underline" onClick={() => setParams({ ver: f.id })}>{f.numero}</button></td>
                  <td className={`${td} whitespace-nowrap`}>
                    {formatFecha(vencimientoDe(f))}{' '}
                    {f.estado === 'pendiente' && vencimientoDe(f) < hoy && <Badge tone="amber">Vencida</Badge>}
                  </td>
                  <td className={td}>{f.terceroNombre}</td>
                  <td className={td}>
                    {c && <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />}
                    {c?.nombre ?? '—'}
                    <span className="block font-mono text-xs text-slate-400">{f.cuentaGasto ?? c?.cuentaGasto}</span>
                  </td>
                  <td className={tdNum}><Euros cents={f.baseCent} /></td>
                  <td className={tdNum}><Euros cents={f.cuotaIvaCent} />{!f.ivaDeducible && <span className="ml-1 text-xs text-slate-400" title="IVA no deducible">ND</span>}</td>
                  <td className={`${tdNum} font-medium`}><Euros cents={f.totalCent} /></td>
                  <td className={td}>{f.estado === 'pagada' ? <Badge tone="green">Pagada</Badge> : <Badge tone="amber">Pendiente</Badge>}</td>
                  <td className={`${td} w-10 px-1 text-right`}>
                    {f.estado === 'pendiente' && abierto && f.ejercicio === anio && (
                      <Button variant="ghost" className="size-8 px-0 text-red-700 hover:bg-red-50 hover:text-red-800" title="Borrar" aria-label="Borrar" onClick={async () => (await confirmar({ titulo: `¿Borrar la factura ${f.numero}?`, descripcion: 'Se borrará también su asiento.', accion: 'Borrar', destructiva: true })) && accion(() => borrarFacturaRecibida(eid, f))}>
                        <Trash2 />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={td} colSpan={7}>Total</td>
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
        <Modal title="Nueva factura recibida" onClose={() => setModal(null)} wide>
          <FacturaForm tipo="recibida" fechaInicial={hoyEn(anio)} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'editar' && (
        <Modal title={`Factura ${modal.f.numero}`} onClose={() => setModal(null)} wide>
          <FacturaForm tipo="recibida" existente={modal.f} fechaInicial={modal.f.fecha} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'pagar' && (
        <Modal title="Registrar pago" onClose={() => setModal(null)}>
          <TesoreriaForm tipo="pago" factura={modal.f} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'reasignar' && (
        <Modal title={`Cambiar categoría de ${seleccionadas.length} facturas`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Se regenerarán sus asientos para llevar el gasto a la cuenta de la nueva categoría.</p>
            <Field label="Nueva categoría">
              <CategoriaGastoSelect
                value={destino}
                onChange={(v) => { setDestino(v); setSubcuentaDestino('') }}
                categorias={categorias}
                cuentas={cuentas}
                aria-label="Nueva categoría"
              />
            </Field>
            <SubcuentaGastoSelect raiz={raizDeSeleccion(destino, categorias)} cuentas={cuentas} value={subcuentaDestino} onChange={setSubcuentaDestino} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
              <Button onClick={reasignar} disabled={!destino || faltaSubcuenta(raizDeSeleccion(destino, categorias), cuentas, subcuentaDestino)}>Cambiar</Button>
            </div>
          </div>
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
