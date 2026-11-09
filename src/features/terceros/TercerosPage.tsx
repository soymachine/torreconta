import { FileDown, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Badge, Euros, Modal, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Button, Input, Select } from '../../components/base'
import { paraInformes, sumasPorCuenta } from '../../lib/saldos'
import type { Tercero, TipoTercero } from '../../lib/tipos'
import { useLibros } from '../libros/LibrosProvider'
import { useConfirmar } from '../../components/Confirmar'
import { errorMsg } from '../../components/shared'
import { cambiarActivoTercero, eliminarTercero, usoTercero } from '../../services/terceros'
import { useLogo } from '../empresa/useLogo'
import { exportarTercerosPdf } from './exportarPdf'
import { TerceroForm, TIPO_LABEL } from './TerceroForm'

export function TercerosPage() {
  const { eid, terceros, categorias, asientos, empresa, anio } = useLibros()
  const logo = useLogo()
  const confirmar = useConfirmar()
  const [comprobando, setComprobando] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [tipo, setTipo] = useState<'' | TipoTercero>('')
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<Tercero | 'nuevo' | null>(null)
  const sumas = useMemo(() => sumasPorCuenta(paraInformes(asientos)), [asientos])
  const catNombre = new Map(categorias.map((c) => [c.id, c.nombre]))

  const visibles = terceros.filter(
    (t) =>
      (!tipo || t.tipo === tipo) &&
      (!q || t.nombre.toLowerCase().includes(q.toLowerCase()) || t.nif.includes(q.toUpperCase()) || t.cuenta.startsWith(q)),
  )

  const saldoDe = (t: Tercero) => {
    const s = sumas.get(t.cuenta)
    return s ? s.debe - s.haber : 0
  }

  /** Elimina si no tiene movimientos; si los tiene, ofrece desactivarlo. */
  const eliminar = async (t: Tercero) => {
    setComprobando(t.id)
    let uso
    try {
      uso = await usoTercero(eid, t)
    } catch (e) {
      toast.error(errorMsg(e))
      return
    } finally {
      setComprobando(null)
    }
    try {
      if (!uso.facturas && !uso.asientos) {
        const ok = await confirmar({
          titulo: `¿Eliminar a ${t.nombre}?`,
          descripcion: `Se borrará de la lista y su subcuenta ${t.cuenta} quedará desactivada en el plan de cuentas. Esta acción no se puede deshacer.`,
          accion: 'Eliminar',
          destructiva: true,
        })
        if (!ok) return
        await eliminarTercero(eid, t)
        toast.success(`${t.nombre} eliminado`)
      } else if (t.activo) {
        const ok = await confirmar({
          titulo: `No se puede eliminar a ${t.nombre}`,
          descripcion: `Tiene ${uso.facturas ? 'facturas' : 'asientos'} en la contabilidad y borrarlo dejaría esos registros sin su ${t.tipo === 'cliente' ? 'cliente' : 'proveedor'}. Puedes desactivarlo: dejará de aparecer al crear facturas, pero se conserva todo su historial y podrás reactivarlo cuando quieras.`,
          accion: 'Desactivar',
        })
        if (!ok) return
        await cambiarActivoTercero(eid, t, false)
        toast.success(`${t.nombre} desactivado`)
      } else {
        toast.info(`${t.nombre} tiene movimientos y ya está desactivado; no se puede eliminar.`)
      }
    } catch (e) {
      toast.error(errorMsg(e))
    }
  }

  const reactivar = async (t: Tercero) => {
    try {
      await cambiarActivoTercero(eid, t, true)
      toast.success(`${t.nombre} reactivado`)
    } catch (e) {
      toast.error(errorMsg(e))
    }
  }

  const exportarPdf = async () => {
    setExportando(true)
    try {
      const nombresTipo = { '': 'Todos', cliente: 'Clientes', proveedor: 'Proveedores', acreedor: 'Acreedores' }
      await exportarTercerosPdf({
        empresa,
        anio,
        logo,
        filtro: nombresTipo[tipo] + (q.trim() ? ` que coinciden con «${q.trim()}»` : ''),
        filas: visibles.map((t) => ({
          tercero: t,
          categoria: t.categoriaPorDefectoId ? catNombre.get(t.categoriaPorDefectoId) ?? '' : '',
          saldoCent: saldoDe(t),
        })),
      })
    } catch {
      toast.error('No se ha podido generar el PDF.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes y proveedores"
        actions={
          <>
            <Button variant="secondary" onClick={exportarPdf} disabled={exportando || visibles.length === 0}>
              <FileDown /> {exportando ? 'Generando…' : 'Exportar PDF'}
            </Button>
            <Button onClick={() => setEditando('nuevo')}>Nuevo</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="max-w-xs" aria-label="Tipo">
          <option value="">Todos</option>
          <option value="cliente">Clientes</option>
          <option value="proveedor">Proveedores</option>
          <option value="acreedor">Acreedores</option>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, NIF o cuenta" className="max-w-xs" aria-label="Buscar tercero" />
      </div>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Nombre</th>
              <th className={th}>NIF</th>
              <th className={th}>Tipo</th>
              <th className={th}>Subcuenta</th>
              <th className={th}>Categoría por defecto</th>
              <th className={thNum}>Saldo</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {visibles.map((t) => {
              const saldo = saldoDe(t)
              return (
                <tr key={t.id} className={`border-t border-slate-100 ${t.activo ? '' : 'text-slate-400'}`}>
                  <td className={`${td} font-medium`}>
                    {t.nombre} {!t.activo && <Badge>Inactivo</Badge>}
                  </td>
                  <td className={`${td} font-mono`}>{t.nif}</td>
                  <td className={td}><Badge tone={t.tipo === 'cliente' ? 'green' : 'amber'}>{TIPO_LABEL[t.tipo]}</Badge></td>
                  <td className={`${td} font-mono`}><Link to={`/mayor?cuenta=${t.cuenta}`} className="hover:underline">{t.cuenta}</Link></td>
                  <td className={td}>{t.categoriaPorDefectoId ? catNombre.get(t.categoriaPorDefectoId) : ''}</td>
                  <td className={tdNum} title="Saldo deudor positivo (nos deben); negativo, le debemos">
                    <Euros cents={saldo} muted />
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {!t.activo && (
                      <Button variant="ghost" className="px-2 py-1" onClick={() => reactivar(t)}>Reactivar</Button>
                    )}
                    <Button variant="ghost" className="px-2 py-1" onClick={() => setEditando(t)} aria-label={`Editar ${t.nombre}`}>
                      <Pencil /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-red-700"
                      onClick={() => eliminar(t)}
                      disabled={comprobando === t.id}
                      aria-label={`Eliminar ${t.nombre}`}
                    >
                      <Trash2 /> {comprobando === t.id ? 'Comprobando…' : 'Eliminar'}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visibles.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No hay terceros todavía.</p>}
      </TableWrap>
      {editando && (
        <Modal title={editando === 'nuevo' ? 'Nuevo cliente o proveedor' : editando.nombre} onClose={() => setEditando(null)}>
          <TerceroForm tercero={editando === 'nuevo' ? undefined : editando} onDone={() => setEditando(null)} />
        </Modal>
      )}
    </div>
  )
}
