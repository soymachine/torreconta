import { describe, expect, it } from 'vitest'
import { PGC_PYMES } from '../data/pgc-pymes'
import { aAsientoData, linea, ordenarAsientos, totales, type AsientoData, type BorradorAsiento, type OrigenAsiento } from './asientos'
import { asientoImpuestoSociedades, calcularCierre, comprobacionesCierre } from './cierre'
import { asientoCobro, asientoFacturaEmitida, asientoFacturaRecibida, asientoPago, calcularFactura } from './contabilizacion'
import { asientoLiquidacionIva } from './iva'
import { balance, pyg, saldosHasta } from './saldos'

const cuentas = [
  ...PGC_PYMES.map((c) => ({ ...c, activa: true })),
  { codigo: '4300001', nombre: 'Cliente A', naturaleza: 'activo' as const, activa: true },
  { codigo: '4000001', nombre: 'Proveedor B', naturaleza: 'pasivo' as const, activa: true },
]

let n = 0
const data = (b: BorradorAsiento, origen: OrigenAsiento = 'manual', ejercicio = 2026): AsientoData =>
  aAsientoData(b, { ejercicio, numero: ++n, origen, origenId: null })

const emitida = calcularFactura([{ concepto: 's', cantidad: 1, precioCent: 100000, ivaPct: 21 }], 15)
const recibida = calcularFactura([{ concepto: 'luz', cantidad: 1, precioCent: 50000, ivaPct: 21 }])

/** Escenario del MVP: capital 3.000, venta 1.000 + IVA − IRPF cobrada, luz 500 + IVA pagada. */
function escenario(): AsientoData[] {
  return [
    data({ fecha: '2026-01-02', concepto: 'Capital', lineas: [linea('572', 300000, 'debe'), linea('100', 300000, 'haber')] }),
    data(asientoFacturaEmitida({ fecha: '2026-11-02', numero: 'F1', terceroNombre: 'A', terceroCuenta: '4300001', cuentaIngreso: '705', calculo: emitida }), 'factura-emitida'),
    data(asientoFacturaRecibida({ fecha: '2026-11-03', numero: 'L1', terceroNombre: 'B', terceroCuenta: '4000001', cuentaGasto: '628', ivaDeducible: true, calculo: recibida }), 'factura-recibida'),
    data(asientoCobro({ fecha: '2026-11-05', numeroFactura: 'F1', terceroNombre: 'A', terceroCuenta: '4300001', cuentaTesoreria: '572', importeCent: emitida.totalCent }), 'cobro'),
    data(asientoPago({ fecha: '2026-11-06', numeroFactura: 'L1', terceroNombre: 'B', terceroCuenta: '4000001', cuentaTesoreria: '572', importeCent: recibida.totalCent }), 'pago'),
  ]
}

describe('liquidación de IVA', () => {
  it('salda 477 y 472 contra 4750 si sale a ingresar', () => {
    const a = asientoLiquidacionIva(escenario(), 2026, 4)!
    expect(a.fecha).toBe('2026-12-31')
    expect(a.lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['477', 21000, 0],
      ['472', 0, 10500],
      ['4750', 0, 10500],
    ])
  })
  it('a compensar usa la 4700 y una segunda liquidación solo recoge lo nuevo', () => {
    const asientos = [
      data({ fecha: '2026-02-01', concepto: 'Compra', lineas: [linea('628', 10000, 'debe'), linea('472', 2100, 'debe'), linea('4000001', 12100, 'haber')] }),
    ]
    const t1 = asientoLiquidacionIva(asientos, 2026, 1)!
    expect(t1.lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['472', 0, 2100],
      ['4700', 2100, 0],
    ])
    asientos.push(data(t1, 'liquidacion-iva'))
    expect(asientoLiquidacionIva(asientos, 2026, 1)).toBeNull()
    asientos.push(data({ fecha: '2026-05-01', concepto: 'Venta', lineas: [linea('4300001', 1210, 'debe'), linea('705', 1000, 'haber'), linea('477', 210, 'haber')] }))
    expect(asientoLiquidacionIva(asientos, 2026, 2)!.lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['477', 210, 0],
      ['4750', 0, 210],
    ])
  })
})

describe('impuesto sobre sociedades', () => {
  it('a devolver (4709) o a pagar (4752) según las retenciones', () => {
    expect(asientoImpuestoSociedades(12500, 15000, 2026)!.lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['630', 12500, 0],
      ['473', 0, 15000],
      ['4709', 2500, 0],
    ])
    expect(asientoImpuestoSociedades(20000, 5000, 2026)!.lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['630', 20000, 0],
      ['473', 0, 5000],
      ['4752', 0, 15000],
    ])
    expect(asientoImpuestoSociedades(0, 5000, 2026)).toBeNull()
  })
})

describe('cierre y apertura', () => {
  const base = () => {
    const xs = escenario()
    xs.push(data(asientoLiquidacionIva(xs, 2026, 4)!, 'liquidacion-iva'))
    return xs
  }

  it('regulariza 6 y 7 contra la 129 con el resultado después de impuestos', () => {
    const c = calcularCierre(base(), 2026, 12500)
    expect(c.regularizacion!.lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['628', 0, 50000],
      ['630', 0, 12500],
      ['705', 100000, 0],
      ['129', 0, 37500],
    ])
    expect(c.resultado).toBe(37500)
    for (const a of [c.impuesto!, c.regularizacion!, c.cierre!, c.apertura!]) expect(totales(a.lineas).diferencia).toBe(0)
  })

  it('el cierre deja todas las cuentas a cero y la apertura reproduce el balance', () => {
    const asientos = base()
    const c = calcularCierre(asientos, 2026, 12500)
    const todos = [...asientos, data(c.impuesto!, 'impuesto-sociedades'), data(c.regularizacion!, 'regularizacion'), data(c.cierre!, 'cierre')]
    expect([...saldosHasta(todos).values()].every((v) => v === 0)).toBe(true)
    // Balance final de 2026 (antes del cierre) = balance de 2027 con solo la apertura.
    const balance2026 = balance([...asientos, data(c.impuesto!, 'impuesto-sociedades')], cuentas)
    const balance2027 = balance([data(c.apertura!, 'apertura', 2027)], cuentas)
    expect(balance2026.cuadra && balance2027.cuadra).toBe(true)
    expect(balance2027.totalActivo).toBe(balance2026.totalActivo)
    expect(balance2027.totalPasivoYPn).toBe(balance2026.totalPasivoYPn)
    expect(balance2027.resultado).toBe(0)
    expect(c.apertura!.fecha).toBe('2027-01-01')
    expect(c.apertura!.lineas.find((l) => l.cuenta === '129')).toMatchObject({ debeCent: 0, haberCent: 37500 })
    expect(c.apertura!.lineas.find((l) => l.cuenta === '572')).toMatchObject({ debeCent: 345500, haberCent: 0 })
    // La PyG de 2026, filtrando regularización y cierre, sigue mostrando el resultado.
    expect(pyg(todos.filter((a) => a.origen !== 'regularizacion' && a.origen !== 'cierre'), cuentas).resultado).toBe(37500)
  })

  it('pérdidas: la 129 queda al debe', () => {
    const xs = [
      data({ fecha: '2026-01-01', concepto: 'Capital', lineas: [linea('572', 1000, 'debe'), linea('100', 1000, 'haber')] }),
      data({ fecha: '2026-02-01', concepto: 'Gasto', lineas: [linea('629', 300, 'debe'), linea('572', 300, 'haber')] }),
    ]
    const c = calcularCierre(xs, 2026, 0)
    expect(c.resultado).toBe(-300)
    expect(c.regularizacion!.lineas.at(-1)).toMatchObject({ cuenta: '129', debeCent: 300, haberCent: 0 })
    expect(c.impuesto).toBeNull()
  })

  it('un ejercicio sin movimientos no genera asientos', () => {
    expect(calcularCierre([], 2026, 0)).toEqual({ impuesto: null, regularizacion: null, cierre: null, apertura: null, resultado: 0 })
  })
})

describe('comprobaciones previas', () => {
  const niveles = (cs: ReturnType<typeof comprobacionesCierre>) => Object.fromEntries(cs.map((c) => [c.id, c.nivel]))
  it('detecta IVA sin liquidar, diario desordenado y pendientes', () => {
    const xs = escenario()
    xs[0] = { ...xs[0], numero: 99 }
    const c = niveles(comprobacionesCierre({ anio: 2026, asientos: xs, emitidas: [{ estado: 'pendiente' }], recibidas: [], impuestoCent: 0 }))
    expect(c).toMatchObject({ cuadre: 'ok', orden: 'error', iva: 'aviso', pendientes: 'aviso', impuesto: 'aviso' })
  })
  it('todo correcto', () => {
    const xs = escenario()
    xs.push(data(asientoLiquidacionIva(xs, 2026, 4)!, 'liquidacion-iva'))
    const ordenados = ordenarAsientos(xs).map((a, i) => ({ ...a, numero: i + 1 }))
    const c = comprobacionesCierre({ anio: 2026, asientos: ordenados, emitidas: [], recibidas: [], impuestoCent: 100 })
    expect(c.every((x) => x.nivel === 'ok')).toBe(true)
  })
  it('detecta un cierre ya hecho', () => {
    const xs = [...escenario(), data({ fecha: '2026-12-31', concepto: 'Cierre', lineas: [] }, 'cierre')]
    expect(niveles(comprobacionesCierre({ anio: 2026, asientos: xs, emitidas: [], recibidas: [], impuestoCent: 0 }))['ya-cerrado']).toBe('error')
  })
})

describe('orden por prioridad de origen', () => {
  it('apertura primero y cierre último en el mismo día', () => {
    const xs = [
      data({ fecha: '2026-12-31', concepto: 'c', lineas: [] }, 'cierre'),
      data({ fecha: '2026-12-31', concepto: 'r', lineas: [] }, 'regularizacion'),
      data({ fecha: '2026-12-31', concepto: 'm', lineas: [] }, 'manual'),
      data({ fecha: '2026-12-31', concepto: 'i', lineas: [] }, 'liquidacion-iva'),
      data({ fecha: '2026-01-01', concepto: 'x', lineas: [] }, 'manual'),
      data({ fecha: '2026-01-01', concepto: 'a', lineas: [] }, 'apertura'),
    ]
    expect(ordenarAsientos(xs).map((a) => a.concepto).join('')).toBe('axmirc')
  })
})
