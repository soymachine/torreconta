import { describe, expect, it } from 'vitest'
import { centsCsv, toCsv } from './csv'

describe('csv', () => {
  it('escapa y usa punto y coma con BOM', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'di "hola"'], [1, null]])).toBe('﻿a;b\r\n"x;y";"di ""hola"""\r\n1;\r\n')
  })
  it('formatea céntimos con coma decimal', () => {
    expect(centsCsv(123456)).toBe('1234,56')
    expect(centsCsv(-5)).toBe('-0,05')
    expect(centsCsv(0)).toBe('0,00')
  })
})
