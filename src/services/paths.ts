import { collection, doc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Todos los datos contables cuelgan de /empresas/{eid}. Los usuarios
 * autorizados (/autorizados/{uid}) apuntan a su empresa con `empresaId`,
 * así varios usuarios pueden compartir la misma contabilidad.
 */
const e = (eid: string, ...rest: string[]) => ['empresas', eid, ...rest] as const

export const empresaRef = (eid: string) => doc(db, ...e(eid, 'config', 'empresa'))
export const logoRef = (eid: string) => doc(db, ...e(eid, 'config', 'logo'))
export const cuentasCol = (eid: string) => collection(db, ...e(eid, 'cuentas'))
export const cuentaRef = (eid: string, codigo: string) => doc(db, ...e(eid, 'cuentas', codigo))
export const ejerciciosCol = (eid: string) => collection(db, ...e(eid, 'ejercicios'))
export const ejercicioRef = (eid: string, anio: number) => doc(db, ...e(eid, 'ejercicios', String(anio)))
export const asientosCol = (eid: string) => collection(db, ...e(eid, 'asientos'))
export const asientoRef = (eid: string, id: string) => doc(db, ...e(eid, 'asientos', id))
export const tercerosCol = (eid: string) => collection(db, ...e(eid, 'terceros'))
export const terceroRef = (eid: string, id: string) => doc(db, ...e(eid, 'terceros', id))
export const categoriasCol = (eid: string) => collection(db, ...e(eid, 'categorias'))
export const categoriaRef = (eid: string, id: string) => doc(db, ...e(eid, 'categorias', id))
export const emitidasCol = (eid: string) => collection(db, ...e(eid, 'facturasEmitidas'))
export const emitidaRef = (eid: string, id: string) => doc(db, ...e(eid, 'facturasEmitidas', id))
export const recibidasCol = (eid: string) => collection(db, ...e(eid, 'facturasRecibidas'))
export const recibidaRef = (eid: string, id: string) => doc(db, ...e(eid, 'facturasRecibidas', id))
export const autorizadoRef = (uid: string) => doc(db, 'autorizados', uid)

/** Referencia con id autogenerado (para crear varios documentos en una transacción). */
export const nuevoId = (col: ReturnType<typeof collection>) => doc(col)
