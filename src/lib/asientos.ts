/** Asientos contables: tipos y validaciones puras. */
import { esImputable, type Cuenta } from './cuentas'
import type { Cents } from './money'

export type OrigenAsiento = 'manual' | 'factura-emitida' | 'factura-recibida' | 'cobro' | 'pago'

export interface Linea {
  cuenta: string
  debeCent: Cents
  haberCent: Cents
  concepto: string
}

/** Lo mínimo para describir un asiento antes de numerarlo y guardarlo. */
export interface BorradorAsiento {
  fecha: string // AAAA-MM-DD
  concepto: string
  lineas: Linea[]
}

export interface AsientoData extends BorradorAsiento {
  ejercicio: number
  numero: number
  origen: OrigenAsiento
  origenId: string | null
  cuentas: string[]
  totalDebeCent: Cents
  totalHaberCent: Cents
}

export interface Asiento extends AsientoData {
  id: string
}

export const ORIGEN_LABEL: Record<OrigenAsiento, string> = {
  manual: 'Manual',
  'factura-emitida': 'Factura emitida',
  'factura-recibida': 'Factura recibida',
  cobro: 'Cobro',
  pago: 'Pago',
}

/**
 * Crea una línea en el lado indicado. Un importe negativo (p. ej. en una
 * factura rectificativa) pasa al lado contrario con signo positivo.
 */
export function linea(cuenta: string, importe: Cents, lado: 'debe' | 'haber', concepto = ''): Linea {
  const enDebe = (lado === 'debe') === importe >= 0
  const abs = Math.abs(importe)
  return { cuenta, debeCent: enDebe ? abs : 0, haberCent: enDebe ? 0 : abs, concepto }
}

export function totales(lineas: readonly Linea[]) {
  let debe = 0
  let haber = 0
  for (const l of lineas) {
    debe += l.debeCent
    haber += l.haberCent
  }
  return { debe, haber, diferencia: debe - haber }
}

export function cuentasDe(lineas: readonly Linea[]): string[] {
  return [...new Set(lineas.map((l) => l.cuenta))]
}

/** Quita las líneas a cero (p. ej. retención 0) para no ensuciar el diario. */
export function sinLineasVacias(lineas: readonly Linea[]): Linea[] {
  return lineas.filter((l) => l.debeCent !== 0 || l.haberCent !== 0)
}

export function validarAsiento(b: BorradorAsiento, cuentas: readonly Cuenta[], anio?: number): string[] {
  const errores: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) errores.push('La fecha no es válida.')
  else if (anio !== undefined && !b.fecha.startsWith(`${anio}-`))
    errores.push(`La fecha debe pertenecer al ejercicio ${anio}.`)
  if (!b.concepto.trim()) errores.push('Falta el concepto.')
  if (b.lineas.length < 2) errores.push('Un asiento necesita al menos dos líneas.')
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]))
  b.lineas.forEach((l, i) => {
    const n = i + 1
    const c = porCodigo.get(l.cuenta)
    if (!c) errores.push(`Línea ${n}: la cuenta «${l.cuenta}» no existe.`)
    else if (!esImputable(c, cuentas)) errores.push(`Línea ${n}: la cuenta ${l.cuenta} no admite apuntes.`)
    if (!Number.isSafeInteger(l.debeCent) || !Number.isSafeInteger(l.haberCent) || l.debeCent < 0 || l.haberCent < 0)
      errores.push(`Línea ${n}: importe no válido.`)
    else if (l.debeCent > 0 && l.haberCent > 0) errores.push(`Línea ${n}: no puede tener debe y haber a la vez.`)
    else if (l.debeCent === 0 && l.haberCent === 0) errores.push(`Línea ${n}: importe a cero.`)
  })
  const t = totales(b.lineas)
  if (t.diferencia !== 0) errores.push('El asiento no cuadra: el debe y el haber deben sumar lo mismo.')
  else if (t.debe === 0 && b.lineas.length >= 2) errores.push('El asiento no tiene importe.')
  return errores
}

/** Completa un borrador con los campos derivados que se guardan en Firestore. */
export function aAsientoData(
  b: BorradorAsiento,
  extra: { ejercicio: number; numero: number; origen: OrigenAsiento; origenId: string | null },
): AsientoData {
  const t = totales(b.lineas)
  return {
    ...extra,
    fecha: b.fecha,
    concepto: b.concepto.trim(),
    lineas: b.lineas.map((l) => ({ ...l, concepto: l.concepto ?? '' })),
    cuentas: cuentasDe(b.lineas),
    totalDebeCent: t.debe,
    totalHaberCent: t.haber,
  }
}

export function ordenarAsientos<T extends { fecha: string; numero: number }>(xs: readonly T[]): T[] {
  return [...xs].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
}
