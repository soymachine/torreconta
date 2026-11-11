import { describe, expect, it } from 'vitest'
import { PGC_PYMES } from '../data/pgc-pymes'
import { cuentaPadre, esImputable, mensajeErrorNuevaCuenta, validarNuevaCuenta, type Cuenta } from './cuentas'

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
  it('valida nuevas cuentas y subcuentas', () => {
    expect(validarNuevaCuenta('4300001', cuentas)).toMatchObject({ ok: true, tipo: 'subcuenta', padre: { codigo: '430' } })
    expect(validarNuevaCuenta('47510001', cuentas)).toMatchObject({ ok: true, padre: { codigo: '4751' } })
    expect(validarNuevaCuenta('601', cuentas)).toMatchObject({ ok: true, tipo: 'cuenta', padre: { codigo: '60' } })
    expect(validarNuevaCuenta('6010001', cuentas)).toMatchObject({ ok: false, error: 'padre-grupo' })
    expect(validarNuevaCuenta('430', cuentas)).toEqual({ ok: false, error: 'existe' })
    expect(validarNuevaCuenta('4751', cuentas)).toEqual({ ok: false, error: 'existe' })
    expect(validarNuevaCuenta('62', cuentas)).toEqual({ ok: false, error: 'formato' })
    expect(validarNuevaCuenta('8000001', cuentas)).toEqual({ ok: false, error: 'sin-padre' })
    expect(validarNuevaCuenta('800', cuentas)).toEqual({ ok: false, error: 'sin-padre' })
    expect(mensajeErrorNuevaCuenta('430', 'existe')).toBe('Ya existe la cuenta 430.')
    expect(mensajeErrorNuevaCuenta('4300009', 'existe', [{ codigo: '4300009', nombre: 'x', naturaleza: 'activo', activa: false }])).toMatch(/está desactivada/)
    expect(mensajeErrorNuevaCuenta('6010001', 'padre-grupo')).toMatch(/Antes crea la cuenta de 3 dígitos 601/)
  })
})

describe('cuentasDeGasto', () => {
  it('sin subcuentas devuelve la propia cuenta', async () => {
    const { cuentasDeGasto } = await import('./cuentas')
    expect(cuentasDeGasto('628', cuentas).map((c) => c.codigo)).toEqual(['628'])
  })
  it('con subcuentas devuelve solo las subcuentas activas, nunca la raíz', async () => {
    const { cuentasDeGasto } = await import('./cuentas')
    const con = [
      ...cuentas,
      { codigo: '6020001', nombre: 'Material A', naturaleza: 'gasto' as const, activa: true },
      { codigo: '6020002', nombre: 'Material B', naturaleza: 'gasto' as const, activa: true },
      { codigo: '6020003', nombre: 'Antigua', naturaleza: 'gasto' as const, activa: false },
    ]
    expect(cuentasDeGasto('602', con).map((c) => c.codigo)).toEqual(['6020001', '6020002'])
  })
})

describe('resolverCuentaGasto', () => {
  it('elige la preferida válida, la única posible o pide elegir', async () => {
    const { resolverCuentaGasto } = await import('./cuentas')
    const con = [
      ...cuentas,
      { codigo: '6020001', nombre: 'A', naturaleza: 'gasto' as const, activa: true },
      { codigo: '6020002', nombre: 'B', naturaleza: 'gasto' as const, activa: true },
    ]
    expect(resolverCuentaGasto('628', con)).toBe('628')
    expect(resolverCuentaGasto('602', con, '6020002')).toBe('6020002')
    expect(() => resolverCuentaGasto('602', con)).toThrow('Elige la subcuenta de gasto')
    expect(() => resolverCuentaGasto('602', con, '602')).toThrow('Elige la subcuenta de gasto')
    expect(() => resolverCuentaGasto('602', con, '6280001')).toThrow('Elige la subcuenta de gasto')
  })
})
