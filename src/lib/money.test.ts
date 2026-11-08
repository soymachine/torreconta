import { describe, expect, it } from 'vitest'
import { formatEuros, parseEuros, percentOf, sumCents } from './money'

describe('parseEuros', () => {
  it.each([
    ['1234,56', 123456],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1234.5', 123450],
    ['12', 1200],
    ['0,05', 5],
    ['-12,30', -1230],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    [' 99,9 € ', 9990],
    ['12,345', 1234500],
    ['1,5', 150],
  ])('%s → %i', (input, expected) => {
    expect(parseEuros(input)).toBe(expected)
  })

  it.each(['', 'abc', '1,234,5x', '1..2', '-', '1,2,3', '12,345,67'])('rechaza %s', (input) => {
    expect(parseEuros(input)).toBeNull()
  })
})

describe('percentOf', () => {
  it('calcula el IVA con redondeo comercial', () => {
    expect(percentOf(10000, 21)).toBe(2100)
    expect(percentOf(50, 21)).toBe(11) // 10,5 → 11
    expect(percentOf(-50, 21)).toBe(-11)
    expect(percentOf(1, 10)).toBe(0)
    expect(percentOf(333, 15)).toBe(50) // 49,95 → 50
    expect(percentOf(10000, 5.2)).toBe(520)
    expect(Object.is(percentOf(-1, 10), -0)).toBe(false)
  })
})

describe('formatEuros y sumCents', () => {
  it('formatea en es-ES', () => {
    expect(formatEuros(123456).replace(/\s/g, ' ')).toBe('1.234,56 €')
    expect(formatEuros(-5).replace(/\s/g, ' ')).toBe('-0,05 €')
  })
  it('suma enteros', () => {
    expect(sumCents([10, 20, -5])).toBe(25)
  })
})
