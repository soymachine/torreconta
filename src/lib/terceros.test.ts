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

describe('código de subcuenta elegido', () => {
  it('valida formato, prefijo del tipo y duplicados', async () => {
    const { validarCodigoTercero } = await import('./terceros')
    const cuentas = [{ codigo: '4000001' }, { codigo: '4300001' }]
    expect(validarCodigoTercero('proveedor', '4000999', cuentas)).toBeNull()
    expect(validarCodigoTercero('proveedor', '4000001', cuentas)).toBe('La subcuenta 4000001 ya existe.')
    expect(validarCodigoTercero('proveedor', '4000001', cuentas, '4000001')).toBeNull()
    expect(validarCodigoTercero('proveedor', '4300999', cuentas)).toMatch(/debe empezar por 400/)
    expect(validarCodigoTercero('cliente', '43099', cuentas)).toMatch(/7 dígitos/)
    expect(validarCodigoTercero('acreedor', '4100000', cuentas)).toMatch(/a partir de 4100001/)
  })
})
