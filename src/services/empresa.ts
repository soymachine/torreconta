import { getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { PGC_PYMES } from '../data/pgc-pymes'
import { cuentaRef, ejercicioRef, empresaRef } from './paths'

export interface Empresa {
  razonSocial: string
  nif: string
  domicilio: string
  codigoPostal: string
  municipio: string
  provincia: string
  email: string
  serieFacturas: string
  ejercicioActivo: number
  cuentaBanco: string
  cuentaCaja: string
}

export type DatosEmpresa = Omit<Empresa, 'ejercicioActivo' | 'cuentaBanco' | 'cuentaCaja'>

export function suscribirEmpresa(uid: string, cb: (e: Empresa | null) => void, onError: (e: Error) => void) {
  return onSnapshot(
    empresaRef(uid),
    (snap) => cb(snap.exists() ? (snap.data() as Empresa) : null),
    onError,
  )
}

/**
 * Alta inicial: datos de la empresa, plan de cuentas PGC PYMES y ejercicio
 * abierto. Se hace en un único batch (unas 150 escrituras, límite 500).
 */
export async function inicializarEmpresa(uid: string, datos: DatosEmpresa, anio: number) {
  const existing = await getDoc(empresaRef(uid))
  if (existing.exists()) throw new Error('La empresa ya está configurada.')

  const batch = writeBatch(db)
  for (const c of PGC_PYMES) {
    batch.set(cuentaRef(uid, c.codigo), { ...c, activa: true })
  }
  batch.set(ejercicioRef(uid, anio), { anio, estado: 'abierto', contadorAsientos: 0 })
  batch.set(empresaRef(uid), {
    ...datos,
    ejercicioActivo: anio,
    cuentaBanco: '572',
    cuentaCaja: '570',
    creadoEn: serverTimestamp(),
  })
  await batch.commit()
}

export async function actualizarEmpresa(uid: string, datos: Partial<DatosEmpresa>) {
  await updateDoc(empresaRef(uid), datos)
}

