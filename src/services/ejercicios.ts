import { getDoc, setDoc, updateDoc, type Transaction } from 'firebase/firestore'
import type { Ejercicio } from '../lib/tipos'
import { empresaRef, ejercicioRef } from './paths'

/** Lee el ejercicio dentro de una transacción y comprueba que esté abierto. */
export async function leerEjercicioAbierto(tx: Transaction, uid: string, anio: number): Promise<Ejercicio> {
  const snap = await tx.get(ejercicioRef(uid, anio))
  if (!snap.exists()) throw new Error(`El ejercicio ${anio} no existe.`)
  const e = snap.data() as Ejercicio
  if (e.estado !== 'abierto') throw new Error(`El ejercicio ${anio} está cerrado.`)
  return e
}

export async function abrirEjercicio(uid: string, anio: number) {
  const ref = ejercicioRef(uid, anio)
  if ((await getDoc(ref)).exists()) throw new Error(`El ejercicio ${anio} ya existe.`)
  await setDoc(ref, { anio, estado: 'abierto', contadorAsientos: 0, contadorFacturas: 0 })
}

export async function cambiarEjercicioActivo(uid: string, anio: number) {
  await updateDoc(empresaRef(uid), { ejercicioActivo: anio })
}

