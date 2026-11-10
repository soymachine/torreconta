import { describe, expect, it } from 'vitest'
import { primerError, validarFormularioFactura, type DatosFormularioFactura } from './validarFactura'

const base: DatosFormularioFactura = {
  tipo: 'recibida',
  anio: 2026,
  fecha: '2026-03-01',
  numero: 'A-1',
  terceroId: 't1',
  categoriaId: 'c1',
  cuentaIngreso: '705',
  cuentasIngresoValidas: ['700', '705'],
  lineas: [{ concepto: 'Luz', cantidad: '1', precio: '100' }],
}

describe('validarFormularioFactura', () => {
  it('una factura completa no tiene errores', () => {
    expect(validarFormularioFactura(base)).toEqual({})
    expect(validarFormularioFactura({ ...base, tipo: 'emitida', numero: '', categoriaId: '' })).toEqual({})
  })

  it('recibida vacía: mensajes personalizados por campo', () => {
    const e = validarFormularioFactura({ ...base, fecha: '', numero: ' ', terceroId: '', categoriaId: '', lineas: [{ concepto: '', cantidad: '1', precio: '' }] })
    expect(e).toEqual({
      fecha: 'Indica la fecha de la factura.',
      numero: 'Escribe el número que figura en la factura del proveedor.',
      tercero: 'Elige el proveedor que te ha facturado.',
      categoria: 'Elige en qué categoría de gasto va esta factura.',
      'linea.0.concepto': 'Línea 1: falta el concepto.',
      'linea.0.precio': 'Línea 1: falta la base imponible.',
    })
    expect(primerError(e)).toBe('fecha')
  })

  it('emitida: cliente, cuenta, cantidad y precio mal escritos', () => {
    const e = validarFormularioFactura({
      ...base,
      tipo: 'emitida',
      terceroId: '',
      cuentaIngreso: '999',
      lineas: [
        { concepto: 'Servicio', cantidad: 'x', precio: '12,345' },
        { concepto: '', cantidad: '1', precio: 'abc' },
      ],
    })
    expect(e).toEqual({
      tercero: 'Elige el cliente al que facturas.',
      cuentaIngreso: 'Elige la cuenta de ingresos.',
      'linea.0.cantidad': 'Línea 1: la cantidad no es válida.',
      'linea.1.concepto': 'Línea 2: falta el concepto.',
      'linea.1.precio': 'Línea 2: el precio no es válido (ejemplo: 1.234,56).',
    })
    expect(primerError(e)).toBe('tercero')
  })

  it('fecha fuera del ejercicio e ignora líneas vacías sobrantes', () => {
    const e = validarFormularioFactura({ ...base, fecha: '2025-12-31', lineas: [...base.lineas, { concepto: '', cantidad: '1', precio: '' }] })
    expect(e).toEqual({ fecha: 'La fecha debe estar dentro del ejercicio 2026.' })
  })
})

describe('subcuenta de gasto', () => {
  it('obliga a elegir subcuenta si la cuenta de la categoría tiene varias', () => {
    const d = { ...base, raizCuentaGasto: '602', opcionesCuentaGasto: ['6020001', '6020002'] }
    expect(validarFormularioFactura({ ...d, cuentaGasto: '' }).cuentaGasto).toBe('Elige la subcuenta de gasto (la 602 tiene subcuentas).')
    expect(validarFormularioFactura({ ...d, cuentaGasto: '602' }).cuentaGasto).toBeDefined()
    expect(validarFormularioFactura({ ...d, cuentaGasto: '6020002' })).toEqual({})
  })
  it('con una sola cuenta posible no pide nada; sin ninguna avisa', () => {
    expect(validarFormularioFactura({ ...base, raizCuentaGasto: '628', opcionesCuentaGasto: ['628'] })).toEqual({})
    expect(validarFormularioFactura({ ...base, raizCuentaGasto: '602', opcionesCuentaGasto: [] }).cuentaGasto).toMatch(/no tiene subcuentas activas/)
  })
})
