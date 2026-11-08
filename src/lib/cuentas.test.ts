import { describe, expect, it } from 'vitest'
import { PGC_PYMES } from '../data/pgc-pymes'
import { cuentaPadre, esImputable, validarNuevaSubcuenta, type Cuenta } from './cuentas'

const cuentas: Cuenta[] = PGC_PYMES.map((c) => ({ ...c, activa: true }))
const get = (codigo: string) => cuentas.find((c) => c.codigo === codigo)!

describe('PGC PYMES', () => {
  it('no tiene códigos duplicados y todos son numéricos', () => {
    const codigos = PGC_PYMES.map((c) => c.codigo)
    expect(new Set(codigos).size).toBe(codigos.length)
    expect(codigos.every((c) => /^\d{1,4}$/.test(c))).toBe(true)
  })
  it('toda cuenta salvo los grupos tiene padre', () => {
    for (const c of cuentas.filter((c) => c.codigo.length > 1)) {
      expect(cuentaPadre(c.codigo, cuentas), c.codigo).toBeDefined()
    }
  })
  it('incluye las cuentas que usarán los asientos automáticos', () => {
    for (const codigo of ['129', '400', '410', '430', '472', '473', '4751', '477', '570', '572', '700', '705']) {
      expect(get(codigo), codigo).toBeDefined()
    }
  })
  it('naturaleza coherente con el grupo', () => {
    expect(cuentas.filter((c) => c.codigo.startsWith('6')).every((c) => c.naturaleza === 'gasto')).toBe(true)
    expect(cuentas.filter((c) => c.codigo.startsWith('7')).every((c) => c.naturaleza === 'ingreso')).toBe(true)
  })
})

describe('imputabilidad y subcuentas', () => {
  it('475 tiene hijas y no es imputable; 4751 sí', () => {
    expect(esImputable(get('475'), cuentas)).toBe(false)
    expect(esImputable(get('4751'), cuentas)).toBe(true)
    expect(esImputable(get('43'), cuentas)).toBe(false)
  })
  it('valida nuevas subcuentas', () => {
    const ok = validarNuevaSubcuenta('4300001', cuentas)
    expect(ok.ok && ok.padre.codigo).toBe('430')
    expect(validarNuevaSubcuenta('47510001', cuentas)).toMatchObject({ ok: true, padre: { codigo: '4751' } })
    expect(validarNuevaSubcuenta('430', cuentas)).toEqual({ ok: false, error: 'formato' })
    expect(validarNuevaSubcuenta('4751', cuentas)).toEqual({ ok: false, error: 'existe' })
    expect(validarNuevaSubcuenta('8000001', cuentas)).toEqual({ ok: false, error: 'sin-padre' })
    expect(validarNuevaSubcuenta('4200001', cuentas)).toEqual({ ok: false, error: 'padre-grupo' })
  })
})
