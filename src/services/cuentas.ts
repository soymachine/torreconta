import { runTransaction, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Cuenta } from '../lib/cuentas'
import { cuentaRef } from './paths'

/** Crea una cuenta; falla si el código ya existe (nunca sobrescribe). */
export async function crearCuenta(eid: string, cuenta: Cuenta) {
  await runTransaction(db, async (tx) => {
    const ref = cuentaRef(eid, cuenta.codigo)
    if ((await tx.get(ref)).exists()) throw new Error(`Ya existe la cuenta ${cuenta.codigo}.`)
    tx.set(ref, cuenta)
  })
}

export async function actualizarCuenta(eid: string, codigo: string, cambios: Partial<Pick<Cuenta, 'nombre' | 'activa'>>) {
  await updateDoc(cuentaRef(eid, codigo), cambios)
}
