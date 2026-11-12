import { describe, expect, it } from 'vitest'
import { cambiarSecuencia, planRenumeracion, renumerarTexto, validarRenumeracion } from './numeracion'

describe('numeración de facturas', () => {
  it('cambia solo la parte numérica final', () => {
    expect(cambiarSecuencia('F2026-0001', 10)).toBe('F2026-0010')
    expect(cambiarSecuencia('A-2026-0003', 125)).toBe('A-2026-0125')
  })
  it('renumera consecutivamente en el orden actual', () => {
    const { cambios, ultima } = planRenumeracion(
      [
        { id: 'b', numero: 'F2026-0002', secuencia: 2 },
        { id: 'a', numero: 'F2026-0001', secuencia: 1 },
        { id: 'c', numero: 'F2026-0004', secuencia: 4 },
      ],
      10,
    )
    expect(cambios.map((c) => [c.id, c.numeroNuevo, c.secuencia])).toEqual([
      ['a', 'F2026-0010', 10],
      ['b', 'F2026-0011', 11],
      ['c', 'F2026-0012', 12],
    ])
    expect(ultima).toBe(12)
    expect(planRenumeracion([], 21).ultima).toBe(20)
  })
  it('valida el número inicial', () => {
    expect(validarRenumeracion(0, 3, 1)).toMatch(/entre 1 y 9999/)
    expect(validarRenumeracion(1.5, 3, 1)).toMatch(/entre 1 y 9999/)
    expect(validarRenumeracion(9998, 3, 1)).toMatch(/no puede pasar de 9997/)
    expect(validarRenumeracion(1, 3, 1)).toBe('Las facturas ya empiezan en la 1.')
    expect(validarRenumeracion(10, 3, 1)).toBeNull()
    expect(validarRenumeracion(1, 0)).toBeNull()
  })
  it('cambia el número en el concepto sin tocar números más largos', () => {
    expect(renumerarTexto('Factura F2026-0001 · Cliente', 'F2026-0001', 'F2026-0010')).toBe('Factura F2026-0010 · Cliente')
    expect(renumerarTexto('Cobro fra. F2026-00012', 'F2026-0001', 'X')).toBe('Cobro fra. F2026-00012')
  })
})
