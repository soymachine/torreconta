import { describe, expect, it } from 'vitest'
import { PGC_PYMES } from '../data/pgc-pymes'
import { opcionesCategoriaGasto, raizDeSeleccion } from './categoriasGasto'

const cuentas = [
  ...PGC_PYMES.map((c) => ({ ...c, activa: true })),
  { codigo: '6070001', nombre: 'Subcontrata A', naturaleza: 'gasto' as const, activa: true },
].map((c) => (c.codigo === '678' ? { ...c, activa: false } : c))
const categorias = [
  { id: 'sum', nombre: 'Suministros', color: '#f00', cuentaGasto: '628', activa: true },
  { id: 'vieja', nombre: 'Antigua', color: '#000', cuentaGasto: '629', activa: false },
]

describe('opcionesCategoriaGasto', () => {
  const ops = opcionesCategoriaGasto(categorias, cuentas)
  const etiquetas = ops.map((o) => o.etiqueta)
  it('incluye cualquier mayor del grupo 6 sin categoría', () => {
    expect(ops.find((o) => o.raiz === '607')).toEqual({ valor: 'cta:607', etiqueta: 'Trabajos realizados por otras empresas (607)', raiz: '607' })
  })
  it('no duplica las mayores que ya tienen categoría activa', () => {
    expect(ops.filter((o) => o.raiz === '628').map((o) => o.valor)).toEqual(['cat:sum'])
  })
  it('las categorías inactivas no cubren su cuenta y no se muestran salvo si están seleccionadas', () => {
    expect(ops.filter((o) => o.raiz === '629').map((o) => o.valor)).toEqual(['cta:629'])
    expect(opcionesCategoriaGasto(categorias, cuentas, 'cat:vieja').some((o) => o.valor === 'cat:vieja')).toBe(true)
  })
  it('excluye subcuentas, cuentas inactivas y otros grupos', () => {
    expect(etiquetas.some((e) => e.includes('6070001'))).toBe(false)
    expect(ops.some((o) => o.raiz === '678')).toBe(false)
    expect(ops.every((o) => o.raiz[0] === '6' && o.raiz.length === 3)).toBe(true)
  })
  it('ordena por código', () => {
    const raices = ops.map((o) => o.raiz)
    expect([...raices].sort()).toEqual(raices)
  })
  it('raíz de una selección', () => {
    expect(raizDeSeleccion('cta:607', categorias)).toBe('607')
    expect(raizDeSeleccion('cat:sum', categorias)).toBe('628')
    expect(raizDeSeleccion('', categorias)).toBeUndefined()
  })
})
