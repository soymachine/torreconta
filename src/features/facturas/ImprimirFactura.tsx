import { Link, useParams } from 'react-router-dom'
import { Euros, formatFecha } from '../../components/shared'
import { Button } from '../../components/ui'
import { importeLinea } from '../../lib/contabilizacion'
import { useLibros } from '../libros/LibrosProvider'

/** Vista de factura lista para imprimir o guardar como PDF desde el navegador. */
export function ImprimirFactura() {
  const { id } = useParams()
  const { emitidas, empresa } = useLibros()
  const f = emitidas.find((x) => x.id === id)
  if (!f) return <p className="text-sm text-slate-500">Factura no encontrada.</p>
  return (
    <div>
      <div className="mb-4 flex gap-2 print:hidden">
        <Link to="/facturas-emitidas" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">← Volver</Link>
        <Button onClick={() => window.print()}>Imprimir / Guardar PDF</Button>
      </div>
      <article className="mx-auto max-w-3xl bg-white p-10 text-sm shadow-sm print:p-0 print:shadow-none">
        <header className="mb-10 flex justify-between gap-6">
          <div>
            <div className="text-lg font-semibold">{empresa.razonSocial}</div>
            <div>NIF {empresa.nif}</div>
            <div>{empresa.domicilio}</div>
            <div>{[empresa.codigoPostal, empresa.municipio, empresa.provincia].filter(Boolean).join(' ')}</div>
            {empresa.email && <div>{empresa.email}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-wide">FACTURA</div>
            <div className="mt-1">Nº <strong>{f.numero}</strong></div>
            <div>Fecha {formatFecha(f.fecha)}</div>
          </div>
        </header>
        <section className="mb-8 rounded border border-slate-200 p-4">
          <div className="text-xs uppercase text-slate-500">Cliente</div>
          <div className="font-medium">{f.terceroNombre}</div>
          {f.terceroNif && <div>NIF {f.terceroNif}</div>}
        </section>
        <table className="mb-8 w-full">
          <thead className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
            <tr><th className="py-2">Concepto</th><th className="py-2 text-right">Cant.</th><th className="py-2 text-right">Precio</th><th className="py-2 text-right">IVA</th><th className="py-2 text-right">Importe</th></tr>
          </thead>
          <tbody>
            {f.lineas.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{l.concepto}</td>
                <td className="py-2 text-right">{l.cantidad.toLocaleString('es-ES')}</td>
                <td className="py-2 text-right"><Euros cents={l.precioCent} /></td>
                <td className="py-2 text-right">{l.ivaPct} %</td>
                <td className="py-2 text-right"><Euros cents={importeLinea(l)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto grid w-72 grid-cols-[1fr_auto] gap-y-1">
          {f.bases.map((b) => (
            <div key={b.ivaPct} className="contents">
              <dt>Base {b.ivaPct} %</dt><dd className="text-right"><Euros cents={b.baseCent} /></dd>
              <dt>IVA {b.ivaPct} %</dt><dd className="text-right"><Euros cents={b.cuotaCent} /></dd>
            </div>
          ))}
          {f.retencionCent !== 0 && (<><dt>Retención IRPF {f.irpfPct} %</dt><dd className="text-right">−<Euros cents={f.retencionCent} /></dd></>)}
          <dt className="mt-1 border-t border-slate-300 pt-1 text-base font-semibold">Total</dt>
          <dd className="mt-1 border-t border-slate-300 pt-1 text-right text-base font-semibold"><Euros cents={f.totalCent} /></dd>
        </dl>
      </article>
    </div>
  )
}
