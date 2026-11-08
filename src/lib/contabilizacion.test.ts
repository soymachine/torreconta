import { describe, expect, it } from 'vitest'
import { PGC_PYMES } from '../data/pgc-pymes'
import { totales, validarAsiento } from './asientos'
import {
  asientoCobro,
  asientoFacturaEmitida,
  asientoFacturaRecibida,
  asientoPago,
  calcularFactura,
} from './contabilizacion'

const cuentas = [
  ...PGC_PYMES.map((c) => ({ ...c, activa: true })),
  { codigo: '4300001', nombre: 'Cliente', naturaleza: 'activo' as const, activa: true },
  { codigo: '4000001', nombre: 'Proveedor', naturaleza: 'pasivo' as const, activa: true },
]

describe('calcularFactura', () => {
  it('agrupa por tipo de IVA y aplica la retención sobre la base', () => {
    const c = calcularFactura(
      [
        { concepto: 'Consultoría', cantidad: 10, precioCent: 8000, ivaPct: 21 },
        { concepto: 'Formación', cantidad: 1, precioCent: 20000, ivaPct: 21 },
        { concepto: 'Libro', cantidad: 2, precioCent: 1999, ivaPct: 4 },
      ],
      15,
    )
    expect(c.bases).toEqual([
      { ivaPct: 21, baseCent: 100000, cuotaCent: 21000 },
      { ivaPct: 4, baseCent: 3998, cuotaCent: 160 },
    ])
    expect(c.baseCent).toBe(103998)
    expect(c.cuotaIvaCent).toBe(21160)
    expect(c.retencionCent).toBe(15600) // 15 % de 1039,98 = 155,997
    expect(c.totalCent).toBe(103998 + 21160 - 15600)
  })
  it('admite cantidades decimales', () => {
    expect(calcularFactura([{ concepto: 'h', cantidad: 1.5, precioCent: 3333, ivaPct: 21 }]).baseCent).toBe(5000)
  })
})

const emitida = {
  fecha: '2026-02-10',
  numero: 'F2026-0001',
  terceroNombre: 'Cliente',
  terceroCuenta: '4300001',
  cuentaIngreso: '705',
  calculo: calcularFactura([{ concepto: 'Servicio', cantidad: 1, precioCent: 100000, ivaPct: 21 }], 15),
}

describe('asientos de facturas', () => {
  it('factura emitida con IVA y retención', () => {
    const a = asientoFacturaEmitida(emitida)
    expect(a.lineas).toEqual([
      { cuenta: '4300001', debeCent: 106000, haberCent: 0, concepto: '' },
      { cuenta: '473', debeCent: 15000, haberCent: 0, concepto: '' },
      { cuenta: '705', debeCent: 0, haberCent: 100000, concepto: '' },
      { cuenta: '477', debeCent: 0, haberCent: 21000, concepto: '' },
    ])
    expect(validarAsiento(a, cuentas, 2026)).toEqual([])
  })

  it('factura emitida sin retención no genera línea 473', () => {
    const calculo = calcularFactura([{ concepto: 's', cantidad: 1, precioCent: 100000, ivaPct: 21 }])
    const a = asientoFacturaEmitida({ ...emitida, calculo })
    expect(a.lineas.map((l) => l.cuenta)).toEqual(['4300001', '705', '477'])
  })

  it('factura rectificativa (importes negativos) invierte los lados', () => {
    const a = asientoFacturaEmitida({
      ...emitida,
      calculo: calcularFactura([{ concepto: 'Abono', cantidad: -1, precioCent: 10000, ivaPct: 21 }]),
    })
    expect(a.lineas[0]).toMatchObject({ cuenta: '4300001', debeCent: 0, haberCent: 12100 })
    expect(a.lineas[1]).toMatchObject({ cuenta: '705', debeCent: 10000, haberCent: 0 })
    expect(totales(a.lineas).diferencia).toBe(0)
  })

  it('factura recibida: la categoría decide la cuenta de gasto', () => {
    const calculo = calcularFactura([{ concepto: 'Luz', cantidad: 1, precioCent: 50000, ivaPct: 21 }])
    const a = asientoFacturaRecibida({
      fecha: '2026-02-15',
      numero: 'A-77',
      terceroNombre: 'Eléctrica',
      terceroCuenta: '4000001',
      cuentaGasto: '628',
      ivaDeducible: true,
      calculo,
    })
    expect(a.lineas).toEqual([
      { cuenta: '628', debeCent: 50000, haberCent: 0, concepto: '' },
      { cuenta: '472', debeCent: 10500, haberCent: 0, concepto: '' },
      { cuenta: '4000001', debeCent: 0, haberCent: 60500, concepto: '' },
    ])
    expect(validarAsiento(a, cuentas, 2026)).toEqual([])
  })

  it('factura recibida de profesional con retención e IVA no deducible', () => {
    const calculo = calcularFactura([{ concepto: 'Asesoría', cantidad: 1, precioCent: 30000, ivaPct: 21 }], 15)
    const a = asientoFacturaRecibida({
      fecha: '2026-03-01',
      numero: '12',
      terceroNombre: 'Gestor',
      terceroCuenta: '4000001',
      cuentaGasto: '623',
      ivaDeducible: false,
      calculo,
    })
    expect(a.lineas).toEqual([
      { cuenta: '623', debeCent: 36300, haberCent: 0, concepto: '' },
      { cuenta: '4000001', debeCent: 0, haberCent: 31800, concepto: '' },
      { cuenta: '4751', debeCent: 0, haberCent: 4500, concepto: '' },
    ])
    expect(validarAsiento(a, cuentas, 2026)).toEqual([])
  })

  it('cobro y pago', () => {
    const m = {
      fecha: '2026-03-01',
      numeroFactura: 'F1',
      terceroNombre: 'X',
      terceroCuenta: '4300001',
      cuentaTesoreria: '572',
      importeCent: 106000,
    }
    expect(asientoCobro(m).lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['572', 106000, 0],
      ['4300001', 0, 106000],
    ])
    expect(asientoPago({ ...m, terceroCuenta: '4000001' }).lineas.map((l) => [l.cuenta, l.debeCent, l.haberCent])).toEqual([
      ['4000001', 106000, 0],
      ['572', 0, 106000],
    ])
  })
})

describe('validarAsiento', () => {
  const base = { fecha: '2026-01-05', concepto: 'Prueba' }
  it('detecta descuadres, cuentas no imputables y fechas fuera del ejercicio', () => {
    const errores = validarAsiento(
      {
        ...base,
        fecha: '2025-12-31',
        lineas: [
          { cuenta: '430', debeCent: 100, haberCent: 0, concepto: '' }, // tiene subcuenta 4300001
          { cuenta: '9999', debeCent: 0, haberCent: 90, concepto: '' },
          { cuenta: '572', debeCent: 5, haberCent: 5, concepto: '' },
        ],
      },
      cuentas,
      2026,
    )
    expect(errores).toEqual([
      'La fecha debe pertenecer al ejercicio 2026.',
      'Línea 1: la cuenta 430 no admite apuntes.',
      'Línea 2: la cuenta «9999» no existe.',
      'Línea 3: no puede tener debe y haber a la vez.',
      'El asiento no cuadra: el debe y el haber deben sumar lo mismo.',
    ])
  })
  it('exige al menos dos líneas y concepto', () => {
    expect(validarAsiento({ fecha: '2026-01-01', concepto: ' ', lineas: [] }, cuentas)).toContain('Falta el concepto.')
    expect(validarAsiento({ fecha: '2026-01-01', concepto: 'x', lineas: [] }, cuentas)).toContain(
      'Un asiento necesita al menos dos líneas.',
    )
  })
})
