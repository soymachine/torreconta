import { addDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { CATEGORIAS_PREDETERMINADAS } from '../data/categorias'
import type { Categoria } from '../lib/tipos'
import { categoriaRef, categoriasCol, nuevoId } from './paths'

export type DatosCategoria = Omit<Categoria, 'id'>

export function sembrarCategorias(batch: ReturnType<typeof writeBatch>, eid: string) {
  for (const c of CATEGORIAS_PREDETERMINADAS) batch.set(nuevoId(categoriasCol(eid)), { ...c, activa: true })
}

export async function crearCategoriasPredeterminadas(eid: string) {
  const batch = writeBatch(db)
  sembrarCategorias(batch, eid)
  await batch.commit()
}

export async function crearCategoria(eid: string, datos: DatosCategoria) {
  if (!/^6\d{2,11}$/.test(datos.cuentaGasto)) throw new Error('La cuenta de gasto debe ser del grupo 6.')
  return (await addDoc(categoriasCol(eid), datos)).id
}

export async function actualizarCategoria(eid: string, id: string, cambios: Partial<Pick<Categoria, 'nombre' | 'color' | 'activa'>>) {
  await updateDoc(categoriaRef(eid, id), cambios)
}

/**
 * Devuelve la categoría de una selección del formulario: la existente
 * (`cat:<id>`) o, para una cuenta mayor (`cta:<codigo>`), la categoría activa
 * de esa cuenta si ya existe o una nueva creada con el nombre de la cuenta.
 */
export async function asegurarCategoria(
  eid: string,
  valor: string,
  categorias: readonly Categoria[],
  cuentas: readonly { codigo: string; nombre: string }[],
): Promise<Categoria> {
  if (valor.startsWith('cat:')) {
    const c = categorias.find((x) => x.id === valor.slice(4))
    if (!c) throw new Error('La categoría elegida ya no existe.')
    return c
  }
  const codigo = valor.slice(4)
  const existente = categorias.find((c) => c.activa && c.cuentaGasto === codigo)
  if (existente) return existente
  const cuenta = cuentas.find((c) => c.codigo === codigo)
  if (!cuenta) throw new Error(`La cuenta ${codigo} no existe.`)
  const datos = { nombre: cuenta.nombre.slice(0, 80), color: '#64748b', cuentaGasto: codigo, activa: true }
  const id = await crearCategoria(eid, datos)
  return { id, ...datos }
}
