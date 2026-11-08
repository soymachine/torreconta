import { collection, doc } from 'firebase/firestore'
import { db } from '../firebase'

const u = (uid: string, ...rest: string[]) => ['users', uid, ...rest] as const

export const empresaRef = (uid: string) => doc(db, ...u(uid, 'config', 'empresa'))
export const cuentasCol = (uid: string) => collection(db, ...u(uid, 'cuentas'))
export const cuentaRef = (uid: string, codigo: string) => doc(db, ...u(uid, 'cuentas', codigo))
export const ejerciciosCol = (uid: string) => collection(db, ...u(uid, 'ejercicios'))
export const ejercicioRef = (uid: string, anio: number) => doc(db, ...u(uid, 'ejercicios', String(anio)))
export const asientosCol = (uid: string) => collection(db, ...u(uid, 'asientos'))
export const asientoRef = (uid: string, id: string) => doc(db, ...u(uid, 'asientos', id))
export const tercerosCol = (uid: string) => collection(db, ...u(uid, 'terceros'))
export const terceroRef = (uid: string, id: string) => doc(db, ...u(uid, 'terceros', id))
export const categoriasCol = (uid: string) => collection(db, ...u(uid, 'categorias'))
export const categoriaRef = (uid: string, id: string) => doc(db, ...u(uid, 'categorias', id))
export const emitidasCol = (uid: string) => collection(db, ...u(uid, 'facturasEmitidas'))
export const emitidaRef = (uid: string, id: string) => doc(db, ...u(uid, 'facturasEmitidas', id))
export const recibidasCol = (uid: string) => collection(db, ...u(uid, 'facturasRecibidas'))
export const recibidaRef = (uid: string, id: string) => doc(db, ...u(uid, 'facturasRecibidas', id))
export const autorizadoRef = (uid: string) => doc(db, 'autorizados', uid)

/** Referencia con id autogenerado (para crear varios documentos en una transacción). */
export const nuevoId = (col: ReturnType<typeof collection>) => doc(col)
