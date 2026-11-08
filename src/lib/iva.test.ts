import { describe, expect, it } from 'vitest'
import { calcularFactura } from './contabilizacion'
import { gastoPorCategoria, modelo303, rangoTrimestre, trimestreDe } from './iva'

const em = (fecha: string, ...lineas: [number, number][]) => ({
  fecha,
  ...calcularFactura(lineas.map(([precioCent, ivaPct]) => ({ concepto: '', cantidad: 1, precioCent, ivaPct }))),
})

describe('trimestres', () => {
  it('rango y trimestre de una fecha', () => {
    expect(rangoTrimestre(2024, 1)).toEqual({ desde: '2024-01-01', hasta: '2024-03-31' })
    expect(rangoTrimestre(2026, 4)).toEqual({ desde: '2026-10-01', hasta: '2026-12-31' })
    expect(trimestreDe('2026-07-01')).toBe(3)
    expect(trimestreDe('2026-03-31')).toBe(1)
  })
})

describe('modelo 303', () => {
  it('suma devengado por tipo y resta el deducible del trimestre', () => {
    const emitidas = [em('2026-01-10', [100000, 21]), em('2026-02-10', [10000, 10], [5000, 21]), em('2026-04-01', [999999, 21])]
    const recibidas = [
      { ...em('2026-02-15', [50000, 21]), ivaDeducible: true },
      { ...em('2026-03-15', [20000, 21]), ivaDeducible: false },
      { ...em('2026-03-20', [3000, 0]), ivaDeducible: true },
    ]
    const r = modelo303(emitidas, recibidas, 2026, 1)
    expect(r.devengado).toEqual([
      { ivaPct: 10, baseCent: 10000, cuotaCent: 1000 },
      { ivaPct: 21, baseCent: 105000, cuotaCent: 22050 },
    ])
    expect(r.totalDevengadoCent).toBe(23050)
    expect(r.baseDeducibleCent).toBe(50000)
    expect(r.cuotaDeducibleCent).toBe(10500)
    expect(r.resultadoCent).toBe(12550)
    expect(r.numEmitidas).toBe(2)
    expect(r.numRecibidas).toBe(3)
  })
})

describe('gasto por categoría', () => {
  it('suma base y el IVA no deducible', () => {
    const f = (fecha: string, categoriaId: string, base: number, deducible: boolean) => ({
      fecha,
      categoriaId,
      baseCent: base,
      cuotaIvaCent: base * 0.21,
      ivaDeducible: deducible,
    })
    const r = gastoPorCategoria(
      [f('2026-01-01', 'luz', 10000, true), f('2026-02-01', 'luz', 10000, false), f('2026-02-01', 'alq', 50000, true), f('2027-01-01', 'luz', 1, true)],
      '2026-01-01',
      '2026-12-31',
    )
    expect(r).toEqual([
      { categoriaId: 'alq', importeCent: 50000, numFacturas: 1 },
      { categoriaId: 'luz', importeCent: 22100, numFacturas: 2 },
    ])
  })
})
