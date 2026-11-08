/**
 * Cálculo de facturas y generación de sus asientos según el PGC de PYMES.
 * Funciones puras: no tocan Firestore.
 */
import { linea, sinLineasVacias, type BorradorAsiento } from './asientos'
import { percentOf, type Cents } from './money'

export const CUENTAS = {
  ivaSoportado: '472',
  retencionesSoportadas: '473', // retenciones que nos practican los clientes
  retencionesPracticadas: '4751', // retenciones que practicamos a profesionales
  ivaRepercutido: '477',
  ventas: '700',
  servicios: '705',
  banco: '572',
  caja: '570',
} as const

export const TIPOS_IVA = [21, 10, 4, 0] as const
export const TIPOS_IRPF = [0, 7, 15, 19] as const

export interface LineaFactura {
  concepto: string
  cantidad: number
  precioCent: Cents
  ivaPct: number
}

export interface BaseIva {
  ivaPct: number
  baseCent: Cents
  cuotaCent: Cents
}

export interface CalculoFactura {
  bases: BaseIva[]
  baseCent: Cents
  cuotaIvaCent: Cents
  irpfPct: number
  retencionCent: Cents
  totalCent: Cents
}

export function importeLinea(l: LineaFactura): Cents {
  return Math.round(l.cantidad * l.precioCent)
}

/** Bases y cuotas agrupadas por tipo de IVA; la retención va sobre la base total. */
export function calcularFactura(lineas: readonly LineaFactura[], irpfPct = 0): CalculoFactura {
  const porTipo = new Map<number, Cents>()
  for (const l of lineas) porTipo.set(l.ivaPct, (porTipo.get(l.ivaPct) ?? 0) + importeLinea(l))
  const bases = [...porTipo.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ivaPct, baseCent]) => ({ ivaPct, baseCent, cuotaCent: percentOf(baseCent, ivaPct) }))
  const baseCent = bases.reduce((s, b) => s + b.baseCent, 0)
  const cuotaIvaCent = bases.reduce((s, b) => s + b.cuotaCent, 0)
  const retencionCent = percentOf(baseCent, irpfPct)
  return { bases, baseCent, cuotaIvaCent, irpfPct, retencionCent, totalCent: baseCent + cuotaIvaCent - retencionCent }
}

export interface DatosAsientoFactura {
  fecha: string
  numero: string
  terceroNombre: string
  terceroCuenta: string
  calculo: CalculoFactura
}

export function asientoFacturaEmitida(f: DatosAsientoFactura & { cuentaIngreso: string }): BorradorAsiento {
  const c = f.calculo
  return {
    fecha: f.fecha,
    concepto: `Factura ${f.numero} · ${f.terceroNombre}`,
    lineas: sinLineasVacias([
      linea(f.terceroCuenta, c.totalCent, 'debe'),
      linea(CUENTAS.retencionesSoportadas, c.retencionCent, 'debe'),
      linea(f.cuentaIngreso, c.baseCent, 'haber'),
      linea(CUENTAS.ivaRepercutido, c.cuotaIvaCent, 'haber'),
    ]),
  }
}

export function asientoFacturaRecibida(
  f: DatosAsientoFactura & { cuentaGasto: string; ivaDeducible: boolean },
): BorradorAsiento {
  const c = f.calculo
  // Si el IVA no es deducible, es mayor gasto.
  const gasto = f.ivaDeducible ? c.baseCent : c.baseCent + c.cuotaIvaCent
  return {
    fecha: f.fecha,
    concepto: `Fra. ${f.numero} · ${f.terceroNombre}`,
    lineas: sinLineasVacias([
      linea(f.cuentaGasto, gasto, 'debe'),
      linea(CUENTAS.ivaSoportado, f.ivaDeducible ? c.cuotaIvaCent : 0, 'debe'),
      linea(f.terceroCuenta, c.totalCent, 'haber'),
      linea(CUENTAS.retencionesPracticadas, c.retencionCent, 'haber'),
    ]),
  }
}

export interface DatosMovimientoTesoreria {
  fecha: string
  numeroFactura: string
  terceroNombre: string
  terceroCuenta: string
  cuentaTesoreria: string
  importeCent: Cents
}

export function asientoCobro(m: DatosMovimientoTesoreria): BorradorAsiento {
  return {
    fecha: m.fecha,
    concepto: `Cobro fra. ${m.numeroFactura} · ${m.terceroNombre}`,
    lineas: [linea(m.cuentaTesoreria, m.importeCent, 'debe'), linea(m.terceroCuenta, m.importeCent, 'haber')],
  }
}

export function asientoPago(m: DatosMovimientoTesoreria): BorradorAsiento {
  return {
    fecha: m.fecha,
    concepto: `Pago fra. ${m.numeroFactura} · ${m.terceroNombre}`,
    lineas: [linea(m.terceroCuenta, m.importeCent, 'debe'), linea(m.cuentaTesoreria, m.importeCent, 'haber')],
  }
}
