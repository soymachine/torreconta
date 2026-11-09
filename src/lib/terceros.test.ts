import { describe, expect, it } from 'vitest'
import { cuentaCoherente, siguienteSubcuenta } from './terceros'

describe('subcuentas de terceros', () => {
  it('siguiente subcuenta libre por tipo', () => {
    const cuentas = [{ codigo: '430' }, { codigo: '4300001' }, { codigo: '4300007' }, { codigo: '4000001' }]
    expect(siguienteSubcuenta('cliente', cuentas)).toBe('4300008')
    expect(siguienteSubcuenta('proveedor', cuentas)).toBe('4000002')
    expect(siguienteSubcuenta('acreedor', cuentas)).toBe('4100001')
  })
  it('coherencia entre tipo y cuenta', () => {
    expect(cuentaCoherente('cliente', '4300002')).toBe(true)
    expect(cuentaCoherente('proveedor', '4300002')).toBe(false)
    expect(cuentaCoherente('acreedor', '4100001')).toBe(true)
    expect(cuentaCoherente('proveedor', '400')).toBe(false)
  })
})
