/** Liquidación trimestral de IVA (modelo 303) y gasto por categoría. */
import { linea, sinLineasVacias, type AsientoData, type BorradorAsiento } from './asientos'
import type { Cents } from './money'
import { saldosHasta } from './saldos'
import type { FacturaEmitida, FacturaRecibida } from './tipos'

export type Trimestre = 1 | 2 | 3 | 4

export function trimestreDe(fecha: string): Trimestre {
  return (Math.floor((Number(fecha.slice(5, 7)) - 1) / 3) + 1) as Trimestre
}

/** Trimestre en curso si el ejercicio es el año actual; si no, el 4º. */
export function trimestreActual(anio: number, hoy: Date = new Date()): Trimestre {
  return hoy.getFullYear() === anio ? (Math.floor(hoy.getMonth() / 3) + 1) as Trimestre : 4
}

export function rangoTrimestre(anio: number, t: Trimestre): { desde: string; hasta: string } {
  const mIni = (t - 1) * 3 + 1
  const mFin = mIni + 2
  const ultimoDia = new Date(Date.UTC(anio, mFin, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { desde: `${anio}-${pad(mIni)}-01`, hasta: `${anio}-${pad(mFin)}-${pad(ultimoDia)}` }
}

export interface LineaIva {
  ivaPct: number
  baseCent: Cents
  cuotaCent: Cents
}

export interface Modelo303 {
  desde: string
  hasta: string
  devengado: LineaIva[]
  totalDevengadoCent: Cents
  baseDeducibleCent: Cents
  cuotaDeducibleCent: Cents
  resultadoCent: Cents // positivo: a ingresar; negativo: a compensar/devolver
  numEmitidas: number
  numRecibidas: number
}

const enRango = (fecha: string, desde: string, hasta: string) => fecha >= desde && fecha <= hasta

export function modelo303(
  emitidas: readonly Pick<FacturaEmitida, 'fecha' | 'bases'>[],
  recibidas: readonly Pick<FacturaRecibida, 'fecha' | 'bases' | 'ivaDeducible'>[],
  anio: number,
  t: Trimestre,
): Modelo303 {
  const { desde, hasta } = rangoTrimestre(anio, t)
  const porTipo = new Map<number, LineaIva>()
  const em = emitidas.filter((f) => enRango(f.fecha, desde, hasta))
  for (const f of em)
    for (const b of f.bases) {
      const acc = porTipo.get(b.ivaPct) ?? { ivaPct: b.ivaPct, baseCent: 0, cuotaCent: 0 }
      acc.baseCent += b.baseCent
      acc.cuotaCent += b.cuotaCent
      porTipo.set(b.ivaPct, acc)
    }
  const devengado = [...porTipo.values()].sort((a, b) => a.ivaPct - b.ivaPct)
  const totalDevengadoCent = devengado.reduce((s, l) => s + l.cuotaCent, 0)
  let baseDeducibleCent = 0
  let cuotaDeducibleCent = 0
  const rec = recibidas.filter((f) => enRango(f.fecha, desde, hasta))
  for (const f of rec) {
    if (!f.ivaDeducible) continue
    for (const b of f.bases) {
      if (b.cuotaCent === 0) continue
      baseDeducibleCent += b.baseCent
      cuotaDeducibleCent += b.cuotaCent
    }
  }
  return {
    desde,
    hasta,
    devengado,
    totalDevengadoCent,
    baseDeducibleCent,
    cuotaDeducibleCent,
    resultadoCent: totalDevengadoCent - cuotaDeducibleCent,
    numEmitidas: em.length,
    numRecibidas: rec.length,
  }
}

export interface GastoCategoria {
  categoriaId: string
  importeCent: Cents
  numFacturas: number
}

/** Gasto contable por categoría: base, más el IVA cuando no es deducible. */
export function gastoPorCategoria(
  recibidas: readonly Pick<FacturaRecibida, 'fecha' | 'categoriaId' | 'baseCent' | 'cuotaIvaCent' | 'ivaDeducible'>[],
  desde: string,
  hasta: string,
): GastoCategoria[] {
  const m = new Map<string, GastoCategoria>()
  for (const f of recibidas) {
    if (!enRango(f.fecha, desde, hasta)) continue
    const acc = m.get(f.categoriaId) ?? { categoriaId: f.categoriaId, importeCent: 0, numFacturas: 0 }
    acc.importeCent += f.baseCent + (f.ivaDeducible ? 0 : f.cuotaIvaCent)
    acc.numFacturas += 1
    m.set(f.categoriaId, acc)
  }
  return [...m.values()].sort((a, b) => b.importeCent - a.importeCent)
}

export const origenIdLiquidacion = (anio: number, t: Trimestre) => `iva-${anio}-${t}`

/**
 * Asiento de liquidación del IVA a fin de trimestre. Salda los saldos
 * acumulados de 477 (repercutido) y 472 (soportado) hasta esa fecha contra
 * 4750 (a ingresar) o 4700 (a compensar o devolver). Como usa saldos
 * acumulados, cada liquidación recoge solo lo no liquidado antes.
 */
export function asientoLiquidacionIva(asientos: readonly AsientoData[], anio: number, t: Trimestre): BorradorAsiento | null {
  const { hasta } = rangoTrimestre(anio, t)
  const saldos = saldosHasta(asientos, hasta)
  const repercutido = -(saldos.get('477') ?? 0)
  const soportado = saldos.get('472') ?? 0
  if (repercutido === 0 && soportado === 0) return null
  const resultado = repercutido - soportado
  return {
    fecha: hasta,
    concepto: `Liquidación IVA ${t}T ${anio}`,
    lineas: sinLineasVacias([
      linea('477', repercutido, 'debe'),
      linea('472', soportado, 'haber'),
      resultado >= 0 ? linea('4750', resultado, 'haber') : linea('4700', -resultado, 'debe'),
    ]),
  }
}
