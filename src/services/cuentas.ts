import { onSnapshot, query, setDoc, updateDoc, orderBy } from 'firebase/firestore'
import type { Cuenta } from '../lib/cuentas'
import { cuentaRef, cuentasCol } from './paths'

export function suscribirCuentas(uid: string, cb: (c: Cuenta[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(cuentasCol(uid), orderBy('codigo')),
    (snap) => cb(snap.docs.map((d) => d.data() as Cuenta)),
    onError,
  )
}

export async function crearCuenta(uid: string, cuenta: Cuenta) {
  await setDoc(cuentaRef(uid, cuenta.codigo), cuenta)
}

export async function actualizarCuenta(uid: string, codigo: string, cambios: Partial<Pick<Cuenta, 'nombre' | 'activa'>>) {
  await updateDoc(cuentaRef(uid, codigo), cambios)
}
