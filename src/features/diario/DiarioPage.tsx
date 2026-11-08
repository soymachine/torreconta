import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, errorMsg, Euros, formatFecha, hoyEn, Modal, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Alert, Button, Input } from '../../components/ui'
import { estaEnOrdenCronologico, ORIGEN_LABEL, ordenarAsientos, type Asiento } from '../../lib/asientos'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { borrarAsientoManual, renumerarAsientos } from '../../services/asientos'
import { useLibros } from '../libros/LibrosProvider'
import { AsientoForm } from './AsientoForm'

export function enlaceOrigen(a: Asiento): string | null {
  if (!a.origenId) return null
  if (a.origen === 'factura-emitida' || a.origen === 'cobro') return `/facturas-emitidas?ver=${a.origenId}`
  if (a.origen === 'factura-recibida' || a.origen === 'pago') return `/facturas-recibidas?ver=${a.origenId}`
  return null
}

export function DiarioPage() {
  const { uid, anio, asientos, cuentas, ejercicio } = useLibros()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<Asiento | 'nuevo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nombres = useMemo(() => new Map(cuentas.map((c) => [c.codigo, c.nombre])), [cuentas])
  const abierto = ejercicio?.estado === 'abierto'

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return ordenarAsientos(asientos).filter(
      (a) =>
        (!desde || a.fecha >= desde) &&
        (!hasta || a.fecha <= hasta) &&
        (!q || a.concepto.toLowerCase().includes(q) || a.cuentas.some((c) => c.startsWith(q)) || String(a.numero) === q),
    )
  }, [asientos, desde, hasta, texto])

  const total = visibles.reduce((s, a) => s + a.totalDebeCent, 0)
  const enOrden = useMemo(() => estaEnOrdenCronologico(asientos), [asientos])

  const renumerar = async () => {
    setError(null)
    try {
      await renumerarAsientos(uid, anio, asientos)
    } catch (e) {
      setError(errorMsg(e))
    }
  }

  const exportar = () => {
    const filas = visibles.flatMap((a) =>
      a.lineas.map((l) => [a.numero, a.fecha, a.concepto, l.cuenta, nombres.get(l.cuenta) ?? '', l.concepto, centsCsv(l.debeCent), centsCsv(l.haberCent)]),
    )
    descargarCsv(`diario-${anio}.csv`, toCsv(['Asiento', 'Fecha', 'Concepto', 'Cuenta', 'Nombre cuenta', 'Concepto línea', 'Debe', 'Haber'], filas))
  }

  const borrar = async (a: Asiento) => {
    if (!confirm(`¿Borrar el asiento ${a.numero}? Su número quedará libre.`)) return
    try {
      await borrarAsientoManual(uid, a)
    } catch (e) {
      setError(errorMsg(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Libro diario"
        subtitle={`Ejercicio ${anio} · ${asientos.length} asientos`}
        actions={
          <>
            <Button variant="secondary" onClick={exportar} disabled={!visibles.length}>Exportar CSV</Button>
            <Button onClick={() => setEditando('nuevo')} disabled={!abierto}>Nuevo asiento</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-slate-500">Desde</span>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500">Hasta</span>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <Input className="max-w-xs" placeholder="Concepto, cuenta o nº de asiento" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en el diario" />
      </div>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      {!enOrden && abierto && (
        <div className="mb-3">
          <Alert tone="info">
            La numeración no sigue el orden de las fechas (hay huecos o asientos registrados con fecha anterior).{' '}
            <button className="font-medium underline" onClick={renumerar}>Renumerar por fecha</button>
          </Alert>
        </div>
      )}

      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Nº</th>
              <th className={th}>Fecha</th>
              <th className={th}>Cuenta</th>
              <th className={th}>Concepto</th>
              <th className={thNum}>Debe</th>
              <th className={thNum}>Haber</th>
              <th className={th} />
            </tr>
          </thead>
          {visibles.map((a) => {
            const enlace = enlaceOrigen(a)
            return (
              <tbody key={a.id} className="border-t-2 border-slate-200" data-testid="asiento">
                <tr className="bg-slate-50/60">
                  <td className={`${td} font-semibold`}>{a.numero}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatFecha(a.fecha)}</td>
                  <td className={td} colSpan={2}>
                    <span className="font-medium">{a.concepto}</span>{' '}
                    {a.origen !== 'manual' && <Badge tone="sky">{ORIGEN_LABEL[a.origen]}</Badge>}
                  </td>
                  <td className={tdNum} />
                  <td className={tdNum} />
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {a.origen === 'manual' && abierto ? (
                      <>
                        <Button variant="ghost" className="px-2 py-1" onClick={() => setEditando(a)}>Editar</Button>
                        <Button variant="ghost" className="px-2 py-1 text-red-700" onClick={() => borrar(a)}>Borrar</Button>
                      </>
                    ) : enlace ? (
                      <Link to={enlace} className="text-xs text-slate-600 hover:underline">Ver documento</Link>
                    ) : null}
                  </td>
                </tr>
                {a.lineas.map((l, i) => (
                  <tr key={i}>
                    <td className={td} />
                    <td className={td} />
                    <td className={`${td} font-mono`}>
                      <Link to={`/mayor?cuenta=${l.cuenta}`} className="hover:underline">{l.cuenta}</Link>
                    </td>
                    <td className={`${td} text-slate-600`}>
                      {nombres.get(l.cuenta) ?? '—'}
                      {l.concepto && <span className="text-slate-400"> · {l.concepto}</span>}
                    </td>
                    <td className={tdNum}>{l.debeCent ? <Euros cents={l.debeCent} /> : ''}</td>
                    <td className={tdNum}>{l.haberCent ? <Euros cents={l.haberCent} /> : ''}</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            )
          })}
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={td} colSpan={4}>Total ({visibles.length} asientos)</td>
              <td className={tdNum}><Euros cents={total} /></td>
              <td className={tdNum}><Euros cents={total} /></td>
              <td />
            </tr>
          </tfoot>
        </table>
        {visibles.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No hay asientos.</p>}
      </TableWrap>

      {editando && (
        <Modal title={editando === 'nuevo' ? 'Nuevo asiento' : `Asiento ${editando.numero}`} onClose={() => setEditando(null)} wide>
          <AsientoForm asiento={editando === 'nuevo' ? undefined : editando} fechaInicial={hoyEn(anio)} onDone={() => setEditando(null)} />
        </Modal>
      )}
    </div>
  )
}
