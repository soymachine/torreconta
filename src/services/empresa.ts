import { getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { PGC_PYMES } from '../data/pgc-pymes'
import { sembrarCategorias } from './categorias'
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

export function suscribirEmpresa(eid: string, cb: (e: Empresa | null) => void, onError: (e: Error) => void) {
  return onSnapshot(
    empresaRef(eid),
    (snap) => cb(snap.exists() ? (snap.data() as Empresa) : null),
    onError,
  )
}

/**
 * Alta inicial: datos de la empresa, plan de cuentas PGC PYMES y ejercicio
 * abierto y categorías de gasto predeterminadas. Se hace en un único batch
 * (unas 150 escrituras, límite 500).
 */
export async function inicializarEmpresa(eid: string, datos: DatosEmpresa, anio: number) {
  const existing = await getDoc(empresaRef(eid))
  if (existing.exists()) throw new Error('La empresa ya está configurada.')

  const batch = writeBatch(db)
  for (const c of PGC_PYMES) {
    batch.set(cuentaRef(eid, c.codigo), { ...c, activa: true })
  }
  batch.set(ejercicioRef(eid, anio), { anio, estado: 'abierto', contadorAsientos: 0, contadorFacturas: 0 })
  sembrarCategorias(batch, eid)
  batch.set(empresaRef(eid), {
    ...datos,
    ejercicioActivo: anio,
    cuentaBanco: '572',
    cuentaCaja: '570',
    creadoEn: serverTimestamp(),
  })
  await batch.commit()
}

export async function actualizarEmpresa(eid: string, datos: Partial<DatosEmpresa>) {
  await updateDoc(empresaRef(eid), datos)
}

