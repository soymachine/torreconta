import { setDoc, updateDoc } from 'firebase/firestore'
import type { Cuenta } from '../lib/cuentas'
import { cuentaRef } from './paths'

export async function crearCuenta(uid: string, cuenta: Cuenta) {
  await setDoc(cuentaRef(uid, cuenta.codigo), cuenta)
}

export async function actualizarCuenta(uid: string, codigo: string, cambios: Partial<Pick<Cuenta, 'nombre' | 'activa'>>) {
  await updateDoc(cuentaRef(uid, codigo), cambios)
}
