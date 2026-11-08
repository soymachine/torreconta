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
