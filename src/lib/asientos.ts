/** Asientos contables: tipos y validaciones puras. */
import { esImputable, type Cuenta } from './cuentas'
import type { Cents } from './money'

export type OrigenAsiento =
  | 'manual'
  | 'factura-emitida'
  | 'factura-recibida'
  | 'cobro'
  | 'pago'
  | 'liquidacion-iva'
  | 'impuesto-sociedades'
  | 'regularizacion'
  | 'cierre'
  | 'apertura'

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
  'liquidacion-iva': 'Liquidación IVA',
  'impuesto-sociedades': 'Impuesto sociedades',
  regularizacion: 'Regularización',
  cierre: 'Cierre',
  apertura: 'Apertura',
}

/** Asientos que genera el cierre del ejercicio: solo se deshacen reabriéndolo. */
export const ORIGENES_CIERRE: readonly OrigenAsiento[] = ['regularizacion', 'cierre', 'apertura']

/** Asientos generados que pueden borrarse desde el diario (no se editan). */
export const ORIGENES_BORRABLES: readonly OrigenAsiento[] = ['manual', 'liquidacion-iva', 'impuesto-sociedades']

/**
 * Prioridad dentro de un mismo día: la apertura va la primera y, el último día
 * del año, los ajustes van antes de la regularización y esta antes del cierre.
 */
const PRIORIDAD: Partial<Record<OrigenAsiento, number>> = {
  apertura: 0,
  'liquidacion-iva': 2,
  'impuesto-sociedades': 2,
  regularizacion: 3,
  cierre: 4,
}
export const prioridadOrigen = (o: OrigenAsiento | undefined) => (o ? PRIORIDAD[o] ?? 1 : 1)

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

/**
 * Valida un asiento. Con `sistema`, para asientos generados (cierre,
 * apertura…), no exige que las cuentas sean imputables: una cuenta con
 * movimientos antiguos que después recibió subcuentas debe poder saldarse.
 */
export function validarAsiento(
  b: BorradorAsiento,
  cuentas: readonly Cuenta[],
  anio?: number,
  opciones: { sistema?: boolean } = {},
): string[] {
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
    else if (!opciones.sistema && !esImputable(c, cuentas)) errores.push(`Línea ${n}: la cuenta ${l.cuenta} no admite apuntes.`)
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

type Ordenable = { fecha: string; numero: number; origen?: OrigenAsiento }

export function ordenarAsientos<T extends Ordenable>(xs: readonly T[]): T[] {
  return [...xs].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || prioridadOrigen(a.origen) - prioridadOrigen(b.origen) || a.numero - b.numero,
  )
}

/**
 * Orden cronológico estable para renumerar: por fecha y, a igual fecha, por
 * el número actual (respeta el orden en que se registraron).
 */
export function ordenarPorFecha<T extends Ordenable>(xs: readonly T[]): T[] {
  return ordenarAsientos(xs)
}

export function estaEnOrdenCronologico(xs: readonly Ordenable[]): boolean {
  return ordenarPorFecha(xs).every((a, i) => a.numero === i + 1)
}
