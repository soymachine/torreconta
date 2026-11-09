import { describe, expect, it } from 'vitest'
import { calcularModelo347, provinciaDesdeDomicilio } from './modelo347'

const fac = (terceroId: string, fecha: string, base: number, iva: number, ret = 0, cobro: { fecha: string; cuenta: string } | null = null) => ({
  terceroId,
  terceroNombre: terceroId.toUpperCase(),
  terceroNif: '',
  fecha,
  baseCent: base,
  cuotaIvaCent: iva,
  retencionCent: ret,
  totalCent: base + iva - ret,
  cobro: cobro ? { ...cobro, asientoId: 'x' } : null,
})

const terceros = [
  { id: 'cli', nombre: 'Cliente Grande SL', nif: 'B12345674', domicilio: 'C/ Mayor 1, 28001 Madrid' },
  { id: 'pro', nombre: 'Proveedor Pequeño SA', nif: 'A58818501', domicilio: 'Avda. Diagonal 100, 08019 Barcelona' },
  { id: 'abo', nombre: 'Gestoría', nif: '', domicilio: 'Sin dirección' },
]

describe('provincia desde el domicilio', () => {
  it('toma los dos primeros dígitos del código postal', () => {
    expect(provinciaDesdeDomicilio('C/ Mayor 1, 28001 Madrid')).toBe('28')
    expect(provinciaDesdeDomicilio('08019 Barcelona')).toBe('08')
    expect(provinciaDesdeDomicilio('Calle 123')).toBeNull()
    expect(provinciaDesdeDomicilio('Tel 912345678')).toBeNull()
    expect(provinciaDesdeDomicilio('99001 Nada')).toBeNull()
  })
})

describe('modelo 347', () => {
  const emitidas = [
    fac('cli', '2026-02-10', 200000, 42000),
    fac('cli', '2026-08-01', 100000, 21000, 15000, { fecha: '2026-08-02', cuenta: '570' }),
    fac('cli', '2025-12-01', 999999, 0), // de otro año: no cuenta
  ]
  const recibidas = [
    fac('pro', '2026-03-01', 200000, 42000),
    fac('pro', '2026-05-01', 39669, 8331), // total 2.900 €
    fac('abo', '2026-04-01', 500000, 105000, 75000), // con retención
  ]

  it('declara el cliente con desglose trimestral, IVA incluido y sin restar retención', () => {
    const r = calcularModelo347({ anio: 2026, emitidas, recibidas, terceros })
    const cli = r.declarados.find((f) => f.terceroId === 'cli')!
    expect(cli).toMatchObject({ clave: 'B', nombre: 'Cliente Grande SL', nif: 'B12345674', provincia: '28', numFacturas: 2 })
    expect(cli.trimestres).toEqual([242000, 0, 121000, 0])
    expect(cli.totalCent).toBe(363000)
    expect(cli.metalicoCent).toBe(106000)
    expect(cli.avisos).toEqual([])
    expect(r.totales.B).toEqual({ importeCent: 363000, declarados: 1 })
  })

  it('no declara a quien no supera 3.005,06 € y excluye las facturas con retención', () => {
    const r = calcularModelo347({ anio: 2026, emitidas, recibidas, terceros })
    expect(r.declarados.map((f) => f.terceroId)).toEqual(['cli'])
    expect(r.noDeclarados.find((f) => f.terceroId === 'pro')?.totalCent).toBe(290000)
    expect(r.noDeclarados.some((f) => f.terceroId === 'abo')).toBe(false)
  })

  it('con la opción, incluye las recibidas con retención y avisa de datos que faltan', () => {
    const r = calcularModelo347({ anio: 2026, emitidas, recibidas, terceros, incluirConRetencion: true })
    const abo = r.declarados.find((f) => f.terceroId === 'abo')!
    expect(abo.clave).toBe('A')
    expect(abo.totalCent).toBe(605000)
    expect(abo.avisos).toEqual(['Falta el NIF', 'Sin código postal en el domicilio'])
  })

  it('marca los cobros en metálico de más de 6.000 € aunque la factura sea del año anterior', () => {
    const r = calcularModelo347({
      anio: 2026,
      emitidas: [],
      recibidas: [],
      emitidasAnteriores: [fac('cli', '2025-12-20', 550000, 115500, 0, { fecha: '2026-01-10', cuenta: '570' })],
      terceros,
    })
    const cli = r.declarados[0]
    expect(cli.metalicoCent).toBe(665500)
    expect(cli.totalCent).toBe(0)
    expect(cli.avisos).toContain('Cobros en metálico > 6.000 €')
  })
})
