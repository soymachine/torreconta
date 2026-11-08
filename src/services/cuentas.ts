import { setDoc, updateDoc } from 'firebase/firestore'
import type { Cuenta } from '../lib/cuentas'
import { cuentaRef } from './paths'

export async function crearCuenta(eid: string, cuenta: Cuenta) {
  await setDoc(cuentaRef(eid, cuenta.codigo), cuenta)
}

export async function actualizarCuenta(eid: string, codigo: string, cambios: Partial<Pick<Cuenta, 'nombre' | 'activa'>>) {
  await updateDoc(cuentaRef(eid, codigo), cambios)
}
