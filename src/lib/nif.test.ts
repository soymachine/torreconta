import { describe, expect, it } from 'vitest'
import { isValidNif, normalizeNif, tipoNif } from './nif'

describe('NIF', () => {
  it('valida DNI', () => {
    expect(tipoNif('12345678Z')).toBe('DNI')
    expect(isValidNif('12345678A')).toBe(false)
  })
  it('valida NIE', () => {
    expect(tipoNif('X1234567L')).toBe('NIE')
    expect(isValidNif('X1234567A')).toBe(false)
  })
  it('valida CIF', () => {
    expect(tipoNif('B12345674')).toBe('CIF')
    expect(tipoNif('A58818501')).toBe('CIF')
    expect(tipoNif('Q2826000H')).toBe('CIF')
    expect(isValidNif('B12345675')).toBe(false)
  })
  it('normaliza', () => {
    expect(normalizeNif(' b-1234.5674 ')).toBe('B12345674')
    expect(isValidNif('12.345.678-z')).toBe(true)
  })
})
