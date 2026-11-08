import { describe, expect, it } from 'vitest'
import { PGC_PYMES } from '../data/pgc-pymes'
import { aAsientoData, linea, type AsientoData, type BorradorAsiento } from './asientos'
import { asientoCobro, asientoFacturaEmitida, asientoFacturaRecibida, asientoPago, calcularFactura } from './contabilizacion'
import { balance, mayor, pyg, sumasYSaldos } from './saldos'

const cuentas = [
  ...PGC_PYMES.map((c) => ({ ...c, activa: true })),
  { codigo: '4300001', nombre: 'Cliente A', naturaleza: 'activo' as const, activa: true },
  { codigo: '4000001', nombre: 'Proveedor B', naturaleza: 'pasivo' as const, activa: true },
]

let n = 0
const data = (b: BorradorAsiento): AsientoData =>
  aAsientoData(b, { ejercicio: 2026, numero: ++n, origen: 'manual', origenId: null })

const emitida = calcularFactura([{ concepto: 's', cantidad: 1, precioCent: 100000, ivaPct: 21 }], 15)
const recibida = calcularFactura([{ concepto: 'luz', cantidad: 1, precioCent: 50000, ivaPct: 21 }])

const asientos = [
  data({
    fecha: '2026-01-01',
    concepto: 'Aportación de capital',
    lineas: [linea('572', 300000, 'debe'), linea('100', 300000, 'haber')],
  }),
  data(
    asientoFacturaEmitida({
      fecha: '2026-02-10',
      numero: 'F1',
      terceroNombre: 'A',
      terceroCuenta: '4300001',
      cuentaIngreso: '705',
      calculo: emitida,
    }),
  ),
  data(
    asientoCobro({
      fecha: '2026-02-20',
      numeroFactura: 'F1',
      terceroNombre: 'A',
      terceroCuenta: '4300001',
      cuentaTesoreria: '572',
      importeCent: emitida.totalCent,
    }),
  ),
  data(
    asientoFacturaRecibida({
      fecha: '2026-02-15',
      numero: 'L1',
      terceroNombre: 'B',
      terceroCuenta: '4000001',
      cuentaGasto: '628',
      ivaDeducible: true,
      calculo: recibida,
    }),
  ),
  data(
    asientoPago({
      fecha: '2026-03-01',
      numeroFactura: 'L1',
      terceroNombre: 'B',
      terceroCuenta: '4000001',
      cuentaTesoreria: '572',
      importeCent: recibida.totalCent,
    }),
  ),
]

describe('mayor', () => {
  it('ordena por fecha y acumula el saldo', () => {
    const m = mayor(asientos, '572')
    expect(m.map((x) => x.saldo)).toEqual([300000, 406000, 345500])
    expect(mayor(asientos, '4300001').at(-1)?.saldo).toBe(0)
  })
  it('con prefijo agrega subcuentas', () => {
    expect(mayor(asientos, '43')).toHaveLength(2)
  })
})

describe('sumas y saldos', () => {
  it('cuadra en total y agrega por 3 dígitos', () => {
    const filas = sumasYSaldos(asientos, cuentas, null)
    const debe = filas.reduce((s, f) => s + f.debe, 0)
    const haber = filas.reduce((s, f) => s + f.haber, 0)
    expect(debe).toBe(haber)
    const tres = sumasYSaldos(asientos, cuentas, 3)
    expect(tres.find((f) => f.codigo === '430')).toMatchObject({ nombre: 'Clientes', saldoDeudor: 0, saldoAcreedor: 0 })
    expect(tres.find((f) => f.codigo === '477')).toMatchObject({ saldoAcreedor: 21000 })
  })
})

describe('PyG y balance', () => {
  it('resultado = ingresos − gastos', () => {
    const r = pyg(asientos, cuentas)
    expect(r.totalIngresos).toBe(100000)
    expect(r.totalGastos).toBe(50000)
    expect(r.resultado).toBe(50000)
    expect(r.gastos).toEqual([{ codigo: '62', nombre: 'Servicios exteriores', importe: 50000 }])
  })

  it('el balance cuadra e incluye el resultado en el patrimonio neto', () => {
    const b = balance(asientos, cuentas)
    expect(b.cuadra).toBe(true)
    expect(b.resultado).toBe(50000)
    // Activo: bancos 3455 + HP retenciones 150 + HP IVA soportado 105
    expect(b.totalActivo).toBe(345500 + 15000 + 10500)
    expect(b.patrimonioNeto.total).toBe(300000 + 50000)
    expect(b.pasivoCorriente.partidas).toEqual([{ codigo: '47', nombre: 'Administraciones públicas', importe: 21000 }])
    expect(b.totalPasivoYPn).toBe(b.totalActivo)
  })

  it('cuentas mixtas van a activo o pasivo según su saldo', () => {
    const extra = [
      ...asientos,
      data({ fecha: '2026-04-01', concepto: 'Préstamo socio', lineas: [linea('572', 1000, 'debe'), linea('551', 1000, 'haber')] }),
    ]
    const b = balance(extra, cuentas)
    expect(b.pasivoCorriente.partidas.find((p) => p.codigo === '55')?.importe).toBe(1000)
    expect(b.cuadra).toBe(true)
  })
})
