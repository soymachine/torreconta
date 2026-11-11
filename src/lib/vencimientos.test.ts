import { describe, expect, it } from 'vitest'
import { diasEntre, sumarDias, vencidasPendientes, vencimientoDe, vencimientosEntre } from './vencimientos'

const f = (fecha: string, vencimiento: string | undefined, estado: 'pendiente' | 'pagada', total = 1000) => ({ fecha, vencimiento, estado, totalCent: total })

describe('fechas', () => {
  it('sumar días y diferencia', () => {
    expect(sumarDias('2026-01-31', 30)).toBe('2026-03-02')
    expect(sumarDias('2026-12-15', 30)).toBe('2027-01-14')
    expect(diasEntre('2026-11-11', '2026-11-20')).toBe(9)
    expect(diasEntre('2026-11-11', '2026-11-01')).toBe(-10)
  })
  it('sin vencimiento, vence en la fecha de la factura', () => {
    expect(vencimientoDe({ fecha: '2026-05-01' })).toBe('2026-05-01')
    expect(vencimientoDe({ fecha: '2026-05-01', vencimiento: '2026-06-01' })).toBe('2026-06-01')
  })
})

describe('vencimientos entre fechas', () => {
  const facturas = [
    f('2026-10-01', '2026-10-31', 'pendiente', 100),
    f('2026-11-01', '2026-12-01', 'pendiente', 200),
    f('2026-11-05', '2026-11-20', 'pagada', 300),
    f('2026-11-10', undefined, 'pendiente', 400),
    f('2026-09-01', '2027-01-15', 'pendiente', 500),
  ]
  it('filtra por rango, ordena y calcula días', () => {
    const r = vencimientosEntre(facturas, '2026-11-01', '2026-12-31', '2026-11-11')
    expect(r.map((x) => [x.vencimiento, x.dias, x.vencida])).toEqual([
      ['2026-11-10', -1, true],
      ['2026-11-20', 9, false],
      ['2026-12-01', 20, false],
    ])
  })
  it('solo pendientes', () => {
    expect(vencimientosEntre(facturas, '2026-11-01', '2026-12-31', '2026-11-11', { soloPendientes: true }).map((x) => x.factura.totalCent)).toEqual([400, 200])
  })
  it('vencidas pendientes', () => {
    expect(vencidasPendientes(facturas, '2026-11-11')).toEqual({ numero: 2, totalCent: 500 })
  })
})
