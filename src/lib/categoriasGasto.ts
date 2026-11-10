/**
 * Opciones del selector «Categoría de gasto» de las facturas recibidas:
 * las categorías activas y, además, cualquier cuenta mayor del grupo 6 (3
 * dígitos) que todavía no tenga categoría. Al guardar con una de esas
 * cuentas se crea su categoría automáticamente.
 */
import type { Cuenta } from './cuentas'
import type { Categoria } from './tipos'

export interface OpcionCategoriaGasto {
  /** `cat:<id>` (categoría existente) o `cta:<codigo>` (cuenta mayor sin categoría). */
  valor: string
  etiqueta: string
  raiz: string
}

export const valorCategoria = (id: string) => `cat:${id}`
export const valorCuenta = (codigo: string) => `cta:${codigo}`

export function opcionesCategoriaGasto(
  categorias: readonly Categoria[],
  cuentas: readonly Cuenta[],
  seleccion?: string,
): OpcionCategoriaGasto[] {
  const visibles = categorias.filter((c) => c.activa || valorCategoria(c.id) === seleccion)
  const cubiertas = new Set(categorias.filter((c) => c.activa).map((c) => c.cuentaGasto))
  const opciones: OpcionCategoriaGasto[] = [
    ...visibles.map((c) => ({ valor: valorCategoria(c.id), etiqueta: `${c.nombre} (${c.cuentaGasto})`, raiz: c.cuentaGasto })),
    ...cuentas
      .filter((c) => c.codigo.length === 3 && c.codigo[0] === '6' && c.activa && !cubiertas.has(c.codigo))
      .map((c) => ({ valor: valorCuenta(c.codigo), etiqueta: `${c.nombre} (${c.codigo})`, raiz: c.codigo })),
  ]
  return opciones.sort((a, b) => a.raiz.localeCompare(b.raiz) || a.etiqueta.localeCompare(b.etiqueta, 'es'))
}

/** Cuenta raíz de una selección (`cat:` o `cta:`), o undefined si no hay. */
export function raizDeSeleccion(valor: string, categorias: readonly Categoria[]): string | undefined {
  if (valor.startsWith('cta:')) return valor.slice(4)
  if (valor.startsWith('cat:')) return categorias.find((c) => c.id === valor.slice(4))?.cuentaGasto
  return undefined
}
