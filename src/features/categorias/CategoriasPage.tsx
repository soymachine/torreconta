import { useMemo, useState, type FormEvent } from 'react'
import { Badge, CuentaInput, errorMsg, Euros, Modal, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Alert, Button, Field, Input, Select } from '../../components/base'
import { gastoPorCategoria } from '../../lib/iva'
import type { Categoria } from '../../lib/tipos'
import { actualizarCategoria, crearCategoria, crearCategoriasPredeterminadas } from '../../services/categorias'
import { reasignarCategoria } from '../../services/facturas'
import { useLibros } from '../libros/LibrosProvider'

function CategoriaForm({ categoria, onDone }: { categoria?: Categoria; onDone: () => void }) {
  const { eid, cuentas } = useLibros()
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [color, setColor] = useState(categoria?.color ?? '#64748b')
  const [cuentaGasto, setCuentaGasto] = useState(categoria?.cuentaGasto ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (nombre.trim().length < 2) return setError('Escribe un nombre.')
    try {
      if (categoria) await actualizarCategoria(eid, categoria.id, { nombre: nombre.trim(), color })
      else {
        if (!cuentas.some((c) => c.codigo === cuentaGasto)) return setError('Elige una cuenta de gasto existente (grupo 6).')
        await crearCategoria(eid, { nombre: nombre.trim(), color, cuentaGasto, activa: true })
      }
      onDone()
    } catch (err) {
      setError(errorMsg(err))
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nombre">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoFocus />
      </Field>
      <Field
        label="Cuenta de gasto"
        hint={categoria ? 'La cuenta no se puede cambiar: crea otra categoría y fusiona.' : 'Cuenta del grupo 6 donde se contabilizará el gasto. Puedes crear una subcuenta en el plan de cuentas, p. ej. 6290001.'}
      >
        <CuentaInput cuentas={cuentas} value={cuentaGasto} onChange={setCuentaGasto} filtro={(c) => c.codigo.startsWith('6')} disabled={!!categoria} aria-label="Cuenta de gasto" />
      </Field>
      <Field label="Color">
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" />
      </Field>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit">{categoria ? 'Guardar' : 'Crear'}</Button>
      </div>
    </form>
  )
}

function FusionarForm({ origen, onDone }: { origen: Categoria; onDone: () => void }) {
  const { eid, categorias, recibidas, cuentas } = useLibros()
  const [destinoId, setDestinoId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const afectadas = recibidas.filter((f) => f.categoriaId === origen.id)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const destino = categorias.find((c) => c.id === destinoId)
    if (!destino) return setError('Elige la categoría de destino.')
    setSaving(true)
    try {
      await reasignarCategoria(eid, afectadas, destino, cuentas)
      await actualizarCategoria(eid, origen.id, { activa: false })
      onDone()
    } catch (err) {
      setError(errorMsg(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Las {afectadas.length} facturas del ejercicio en «{origen.nombre}» pasarán a la categoría elegida (y su gasto a su
        cuenta). «{origen.nombre}» quedará desactivada.
      </p>
      <Field label="Fusionar en">
        <Select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
          <option value="">— Elige —</option>
          {categorias.filter((c) => c.activa && c.id !== origen.id).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} ({c.cuentaGasto})</option>
          ))}
        </Select>
      </Field>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={saving}>Fusionar</Button>
      </div>
    </form>
  )
}

export function CategoriasPage() {
  const { eid, anio, categorias, recibidas, cuentas } = useLibros()
  const [modal, setModal] = useState<{ tipo: 'nueva' } | { tipo: 'editar' | 'fusionar'; c: Categoria } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gasto = useMemo(
    () => new Map(gastoPorCategoria(recibidas, `${anio}-01-01`, `${anio}-12-31`).map((g) => [g.categoriaId, g])),
    [recibidas, anio],
  )
  const nombreCuenta = new Map(cuentas.map((c) => [c.codigo, c.nombre]))

  return (
    <div>
      <PageHeader
        title="Categorías de gasto"
        subtitle="Cada factura recibida va a una categoría; la categoría decide la cuenta de gasto (grupo 6)."
        actions={<Button onClick={() => setModal({ tipo: 'nueva' })}>Nueva categoría</Button>}
      />
      {categorias.length === 0 && (
        <div className="mb-4">
          <Alert tone="info">
            No hay categorías.{' '}
            <button
              className="font-medium underline"
              onClick={() => crearCategoriasPredeterminadas(eid).catch((e) => setError(errorMsg(e)))}
            >
              Crear las categorías predeterminadas
            </button>
          </Alert>
        </div>
      )}
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Categoría</th>
              <th className={th}>Cuenta</th>
              <th className={thNum}>Facturas {anio}</th>
              <th className={thNum}>Gasto {anio}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className={`border-t border-slate-100 ${c.activa ? '' : 'text-slate-400'}`}>
                <td className={td}>
                  <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: c.color }} />
                  <span className="font-medium">{c.nombre}</span> {!c.activa && <Badge>Inactiva</Badge>}
                </td>
                <td className={td}><span className="font-mono">{c.cuentaGasto}</span> <span className="text-slate-500">{nombreCuenta.get(c.cuentaGasto)}</span></td>
                <td className={tdNum}>{gasto.get(c.id)?.numFacturas ?? 0}</td>
                <td className={tdNum}><Euros cents={gasto.get(c.id)?.importeCent ?? 0} muted /></td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'editar', c })}>Editar</Button>
                  <Button variant="ghost" className="px-2 py-1" onClick={() => actualizarCategoria(eid, c.id, { activa: !c.activa }).catch((e) => setError(errorMsg(e)))}>
                    {c.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                  {c.activa && <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'fusionar', c })}>Fusionar…</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {modal?.tipo === 'nueva' && (
        <Modal title="Nueva categoría" onClose={() => setModal(null)}>
          <CategoriaForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'editar' && (
        <Modal title={modal.c.nombre} onClose={() => setModal(null)}>
          <CategoriaForm categoria={modal.c} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'fusionar' && (
        <Modal title={`Fusionar «${modal.c.nombre}»`} onClose={() => setModal(null)}>
          <FusionarForm origen={modal.c} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
