/**
 * Cierre y apertura del ejercicio (PGC de PYMES): impuesto sobre sociedades,
 * regularización de gastos e ingresos contra la 129, asiento de cierre y
 * asiento de apertura del ejercicio siguiente. Funciones puras.
 */
import {
  estaEnOrdenCronologico,
  linea,
  totales,
  type AsientoData,
  type BorradorAsiento,
  type Linea,
} from './asientos'
import type { Cents } from './money'
import { saldosHasta } from './saldos'
import type { FacturaEmitida, FacturaRecibida } from './tipos'

const esResultado = (codigo: string) => codigo[0] === '6' || codigo[0] === '7'
const porCodigo = (a: Linea, b: Linea) => a.cuenta.localeCompare(b.cuenta)

export const origenIdCierre = (anio: number) => `cierre-${anio}`

/**
 * Impuesto sobre sociedades: 630 al debe; al haber, las retenciones y pagos
 * a cuenta (473) y la diferencia a pagar (4752) o, si sobran retenciones,
 * a devolver (4709, al debe).
 */
export function asientoImpuestoSociedades(importeCent: Cents, saldo473: Cents, anio: number): BorradorAsiento | null {
  if (importeCent <= 0) return null
  const retenciones = Math.max(saldo473, 0)
  const diferencia = importeCent - retenciones
  const lineas: Linea[] = [linea('630', importeCent, 'debe')]
  if (retenciones > 0) lineas.push(linea('473', retenciones, 'haber'))
  if (diferencia > 0) lineas.push(linea('4752', diferencia, 'haber'))
  if (diferencia < 0) lineas.push(linea('4709', -diferencia, 'debe'))
  return { fecha: `${anio}-12-31`, concepto: `Impuesto sobre sociedades ${anio}`, lineas }
}

/** Salda todas las cuentas de gastos (6) e ingresos (7) contra la 129. */
export function asientoRegularizacion(asientos: readonly AsientoData[], anio: number): BorradorAsiento | null {
  const lineas: Linea[] = []
  let total = 0
  for (const [cuenta, saldo] of saldosHasta(asientos)) {
    if (!esResultado(cuenta) || saldo === 0) continue
    lineas.push(linea(cuenta, saldo, 'haber'))
    total += saldo
  }
  if (lineas.length === 0) return null
  lineas.sort(porCodigo)
  // total = gastos − ingresos: si hay beneficio es negativo y la 129 queda al haber.
  lineas.push(linea('129', total, 'debe'))
  return { fecha: `${anio}-12-31`, concepto: `Regularización del ejercicio ${anio}`, lineas }
}

/**
 * Asiento de cierre: salda todas las cuentas de balance. Debe calcularse con
 * la regularización ya incluida (los grupos 6 y 7 tienen que estar a cero).
 */
export function asientoCierre(asientos: readonly AsientoData[], anio: number): BorradorAsiento | null {
  const lineas: Linea[] = []
  for (const [cuenta, saldo] of saldosHasta(asientos)) {
    if (saldo === 0) continue
    if (esResultado(cuenta)) throw new Error(`La cuenta ${cuenta} no está regularizada.`)
    lineas.push(linea(cuenta, saldo, 'haber'))
  }
  if (lineas.length === 0) return null
  lineas.sort(porCodigo)
  return { fecha: `${anio}-12-31`, concepto: `Cierre del ejercicio ${anio}`, lineas }
}

/** Apertura del ejercicio siguiente: el cierre con debe y haber intercambiados. */
export function asientoApertura(cierre: BorradorAsiento, anioNuevo: number): BorradorAsiento {
  return {
    fecha: `${anioNuevo}-01-01`,
    concepto: `Apertura del ejercicio ${anioNuevo}`,
    lineas: cierre.lineas.map((l) => ({ ...l, debeCent: l.haberCent, haberCent: l.debeCent })),
  }
}

export interface AsientosCierre {
  impuesto: BorradorAsiento | null
  regularizacion: BorradorAsiento | null
  cierre: BorradorAsiento | null
  apertura: BorradorAsiento | null
  resultado: Cents // después de impuestos
}

/** Calcula, en orden, todos los asientos del cierre a partir de los del ejercicio. */
export function calcularCierre(asientos: readonly AsientoData[], anio: number, impuestoCent: Cents): AsientosCierre {
  const saldos = saldosHasta(asientos)
  const impuesto = asientoImpuestoSociedades(impuestoCent, saldos.get('473') ?? 0, anio)
  const tmp = (b: BorradorAsiento): AsientoData => ({
    ...b,
    ejercicio: anio,
    numero: 0,
    origen: 'manual',
    origenId: null,
    cuentas: [],
    totalDebeCent: 0,
    totalHaberCent: 0,
  })
  const conImpuesto = impuesto ? [...asientos, tmp(impuesto)] : [...asientos]
  const regularizacion = asientoRegularizacion(conImpuesto, anio)
  const resultado = regularizacion ? -(regularizacion.lineas.at(-1)!.debeCent - regularizacion.lineas.at(-1)!.haberCent) : 0
  const conRegularizacion = regularizacion ? [...conImpuesto, tmp(regularizacion)] : conImpuesto
  const cierre = asientoCierre(conRegularizacion, anio)
  return { impuesto, regularizacion, cierre, apertura: cierre ? asientoApertura(cierre, anio + 1) : null, resultado }
}

export type NivelComprobacion = 'ok' | 'aviso' | 'error'

export interface Comprobacion {
  id: string
  nivel: NivelComprobacion
  texto: string
  enlace?: string
}

export function comprobacionesCierre(datos: {
  anio: number
  asientos: readonly AsientoData[]
  emitidas: readonly Pick<FacturaEmitida, 'estado'>[]
  recibidas: readonly Pick<FacturaRecibida, 'estado'>[]
  impuestoCent: Cents
}): Comprobacion[] {
  const { asientos, emitidas, recibidas } = datos
  const out: Comprobacion[] = []

  if (asientos.some((a) => a.origen === 'regularizacion' || a.origen === 'cierre'))
    out.push({ id: 'ya-cerrado', nivel: 'error', texto: 'El ejercicio ya tiene asientos de cierre. Reábrelo para repetir el cierre.' })

  if (asientos.length === 0) out.push({ id: 'vacio', nivel: 'aviso', texto: 'El ejercicio no tiene asientos.' })

  const descuadrados = asientos.filter((a) => totales(a.lineas).diferencia !== 0)
  out.push(
    descuadrados.length
      ? { id: 'cuadre', nivel: 'error', texto: `Hay ${descuadrados.length} asientos descuadrados.`, enlace: '/diario' }
      : { id: 'cuadre', nivel: 'ok', texto: 'Todos los asientos cuadran.' },
  )

  out.push(
    estaEnOrdenCronologico(asientos)
      ? { id: 'orden', nivel: 'ok', texto: 'La numeración del diario sigue el orden de las fechas.' }
      : { id: 'orden', nivel: 'error', texto: 'La numeración del diario no sigue el orden de las fechas. Renumera antes de cerrar.' },
  )

  const saldos = saldosHasta(asientos)
  const iva = (saldos.get('472') ?? 0) !== 0 || (saldos.get('477') ?? 0) !== 0
  out.push(
    iva
      ? { id: 'iva', nivel: 'aviso', texto: 'Las cuentas 472/477 tienen saldo: falta contabilizar alguna liquidación de IVA.', enlace: '/informes/iva' }
      : { id: 'iva', nivel: 'ok', texto: 'IVA liquidado (472 y 477 a cero).' },
  )

  const pendCobro = emitidas.filter((f) => f.estado === 'pendiente').length
  const pendPago = recibidas.filter((f) => f.estado === 'pendiente').length
  if (pendCobro || pendPago)
    out.push({
      id: 'pendientes',
      nivel: 'aviso',
      texto: `Facturas pendientes: ${pendCobro} de cobro y ${pendPago} de pago. Sus saldos pasarán al ejercicio siguiente y podrás cobrarlas o pagarlas allí.`,
    })

  const yaImpuesto = asientos.some((a) => a.origen === 'impuesto-sociedades' || a.lineas.some((l) => l.cuenta.startsWith('630')))
  if (!yaImpuesto && datos.impuestoCent <= 0)
    out.push({ id: 'impuesto', nivel: 'aviso', texto: 'No se ha contabilizado el impuesto sobre sociedades (puedes indicarlo abajo).' })

  return out
}
