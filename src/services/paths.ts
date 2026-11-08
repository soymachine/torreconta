import { collection, doc } from 'firebase/firestore'
import { db } from '../firebase'

export const empresaRef = (uid: string) => doc(db, 'users', uid, 'config', 'empresa')
export const cuentasCol = (uid: string) => collection(db, 'users', uid, 'cuentas')
export const cuentaRef = (uid: string, codigo: string) => doc(db, 'users', uid, 'cuentas', codigo)
export const ejercicioRef = (uid: string, anio: number) =>
  doc(db, 'users', uid, 'ejercicios', String(anio))
export const autorizadoRef = (uid: string) => doc(db, 'autorizados', uid)
