import { useMemo, useState } from 'react'
import { Euros, formatFecha, PageHeader, TableWrap, td, tdNum, th, thNum } from '../../components/shared'
import { Button, Card, Select } from '../../components/ui'
import { centsCsv, descargarCsv, toCsv } from '../../lib/csv'
import { asientoLiquidacionIva, modelo303, origenIdLiquidacion, trimestreActual, type Trimestre } from '../../lib/iva'
import { AsientoPreview } from '../../components/AsientoPreview'
import type { BorradorAsiento } from '../../lib/asientos'
import { errorMsg } from '../../components/shared'
import { Alert } from '../../components/ui'
import { contabilizarLiquidacionIva } from '../../services/cierre'
import { useLibros } from '../libros/LibrosProvider'

/** Importe a ingresar (positivo) o a compensar (negativo) del asiento de liquidación. */
function resultadoLiquidacion(b: BorradorAsiento): number {
  return b.lineas.reduce((s, l) => s + (l.cuenta === '4750' ? l.haberCent : l.cuenta === '4700' ? -l.debeCent : 0), 0)
}

/** Casillas del modelo 303 (régimen general) por tipo de IVA devengado. */
const CASILLAS: Record<number, [string, string]> = { 4: ['01', '03'], 10: ['04', '06'], 21: ['07', '09'] }

export function IvaPage() {
  const { eid, anio, emitidas, recibidas, asientos, cuentas, ejercicio } = useLibros()
  const [verLiq, setVerLiq] = useState(false)
  const [errorLiq, setErrorLiq] = useState<string | null>(null)
  const [t, setT] = useState<Trimestre>(() => trimestreActual(anio))
  const r = useMemo(() => modelo303(emitidas, recibidas, anio, t), [emitidas, recibidas, anio, t])
  const liquidado = asientos.find((a) => a.origenId === origenIdLiquidacion(anio, t))
  const liquidacion = useMemo(() => (liquidado ? null : asientoLiquidacionIva(asientos, anio, t)), [asientos, anio, t, liquidado])
  const liquidar = async () => {
    setErrorLiq(null)
    try {
      await contabilizarLiquidacionIva(eid, anio, t, asientos, cuentas)
      setVerLiq(false)
    } catch (e) {
      setErrorLiq(errorMsg(e))
    }
  }

  const exportar = () =>
    descargarCsv(
      `iva-${anio}-${t}T.csv`,
      toCsv(['Concepto', 'Tipo', 'Base', 'Cuota'], [
        ...r.devengado.map((l) => ['IVA devengado', `${l.ivaPct} %`, centsCsv(l.baseCent), centsCsv(l.cuotaCent)]),
        ['IVA deducible', '', centsCsv(r.baseDeducibleCent), centsCsv(r.cuotaDeducibleCent)],
        ['Resultado', '', '', centsCsv(r.resultadoCent)],
      ]),
    )

  return (
    <div>
      <PageHeader
        title="IVA trimestral (modelo 303)"
        subtitle={`Del ${formatFecha(r.desde)} al ${formatFecha(r.hasta)} · ${r.numEmitidas} facturas emitidas, ${r.numRecibidas} recibidas`}
        actions={
          <>
            <Select value={t} onChange={(e) => setT(Number(e.target.value) as Trimestre)} aria-label="Trimestre">
              {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}T {anio}</option>)}
            </Select>
            <Button variant="secondary" onClick={exportar}>Exportar CSV</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr><th className={th}>IVA devengado</th><th className={th}>Casillas</th><th className={thNum}>Base</th><th className={thNum}>Cuota</th></tr>
              </thead>
              <tbody>
                {r.devengado.map((l) => (
                  <tr key={l.ivaPct} className="border-t border-slate-100">
                    <td className={td}>Régimen general {l.ivaPct} %</td>
                    <td className={`${td} text-slate-500`}>{CASILLAS[l.ivaPct] ? CASILLAS[l.ivaPct].join(' / ') : l.ivaPct === 0 ? 'Exento / no sujeto' : '—'}</td>
                    <td className={tdNum}><Euros cents={l.baseCent} /></td>
                    <td className={tdNum}><Euros cents={l.cuotaCent} /></td>
                  </tr>
                ))}
                {r.devengado.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">Sin facturas emitidas en el trimestre.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold"><td className={td} colSpan={3}>Total cuota devengada (27)</td><td className={tdNum}><Euros cents={r.totalDevengadoCent} /></td></tr>
              </tfoot>
            </table>
          </TableWrap>
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr><th className={th}>IVA deducible</th><th className={th}>Casillas</th><th className={thNum}>Base</th><th className={thNum}>Cuota</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className={td}>Operaciones interiores corrientes</td>
                  <td className={`${td} text-slate-500`}>28 / 29</td>
                  <td className={tdNum}><Euros cents={r.baseDeducibleCent} /></td>
                  <td className={tdNum}><Euros cents={r.cuotaDeducibleCent} /></td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold"><td className={td} colSpan={3}>Total a deducir (45)</td><td className={tdNum}><Euros cents={r.cuotaDeducibleCent} /></td></tr>
              </tfoot>
            </table>
          </TableWrap>
        </div>
        <Card>
          <div className="text-sm text-slate-500">Resultado régimen general (46)</div>
          <div className={`mt-1 text-3xl font-semibold ${r.resultadoCent > 0 ? 'text-red-700' : 'text-emerald-700'}`} data-testid="resultado-303">
            <Euros cents={r.resultadoCent} />
          </div>
          <div className="mt-1 text-sm">{r.resultadoCent > 0 ? 'A ingresar' : r.resultadoCent < 0 ? 'A compensar o devolver' : 'Sin actividad'}</div>
          <div className="mt-4 border-t border-slate-100 pt-4" data-testid="liquidacion">
            {liquidado ? (
              <p className="text-sm text-emerald-700">Liquidado contablemente (asiento nº {liquidado.numero}).</p>
            ) : liquidacion ? (
              <>
                <Button variant="secondary" onClick={() => setVerLiq((v) => !v)} disabled={ejercicio?.estado !== 'abierto'}>
                  Contabilizar liquidación del {t}T
                </Button>
                <p className="mt-1 text-xs text-slate-500">Salda 477 y 472 contra 4750 (a ingresar) o 4700 (a compensar).</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Sin IVA pendiente de liquidar hasta este trimestre.</p>
            )}
            {errorLiq && <div className="mt-2"><Alert>{errorLiq}</Alert></div>}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Cálculo orientativo a partir de las facturas registradas (régimen general, operaciones interiores). Revisa el borrador en la sede de la AEAT antes de presentarlo.
          </p>
        </Card>
      </div>
      {verLiq && liquidacion && (
        <Card className="mt-4 space-y-3">
          <AsientoPreview asiento={liquidacion} cuentas={cuentas} />
          {resultadoLiquidacion(liquidacion) !== r.resultadoCent && (
            <Alert tone="info">
              El importe sale de los saldos de las cuentas 472 y 477 hasta el fin del trimestre (incluye asientos manuales o
              trimestres anteriores sin liquidar), por eso puede diferir del cálculo por facturas.
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVerLiq(false)}>Cancelar</Button>
            <Button onClick={liquidar}>Contabilizar</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
