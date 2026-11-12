import { describe, expect, it } from 'vitest'
import { validarInicioNumeracion } from './numeracion'

describe('validarInicioNumeracion', () => {
  it('rechaza valores fuera de rango o no enteros', () => {
    expect(validarInicioNumeracion(0, 0)).toMatch(/entre 1 y 9999/)
    expect(validarInicioNumeracion(10000, 0)).toMatch(/entre 1 y 9999/)
    expect(validarInicioNumeracion(2.5, 0)).toMatch(/entre 1 y 9999/)
    expect(validarInicioNumeracion(Number.NaN, 0)).toMatch(/entre 1 y 9999/)
  })
  it('no permite repetir números ya emitidos', () => {
    expect(validarInicioNumeracion(3, 3, 'F2026-0003')).toBe('Ya existe la factura F2026-0003: el número debe ser 4 o mayor.')
    expect(validarInicioNumeracion(1, 3)).toMatch(/4 o mayor/)
  })
  it('acepta saltar o volver por encima de la última emitida', () => {
    expect(validarInicioNumeracion(21, 0)).toBeNull()
    expect(validarInicioNumeracion(4, 3)).toBeNull()
  })
})
