import { deleteDoc, runTransaction, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { aAsientoData, ORIGENES_BORRABLES, ORIGENES_CIERRE, ordenarPorFecha, validarAsiento, type Asiento, type BorradorAsiento } from '../lib/asientos'
import type { Cuenta } from '../lib/cuentas'
import { leerEjercicioAbierto } from './ejercicios'
import { asientoRef, asientosCol, ejercicioRef, nuevoId } from './paths'

function comprobar(b: BorradorAsiento, cuentas: readonly Cuenta[], anio: number) {
  const errores = validarAsiento(b, cuentas, anio)
  if (errores.length) throw new Error(errores.join(' '))
}

export async function crearAsientoManual(uid: string, anio: number, b: BorradorAsiento, cuentas: readonly Cuenta[]) {
  comprobar(b, cuentas, anio)
  return runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    const numero = ej.contadorAsientos + 1
    const ref = nuevoId(asientosCol(uid))
    tx.set(ref, aAsientoData(b, { ejercicio: anio, numero, origen: 'manual', origenId: null }))
    tx.update(ejercicioRef(uid, anio), { contadorAsientos: numero })
    return ref.id
  })
}

export async function actualizarAsientoManual(uid: string, asiento: Asiento, b: BorradorAsiento, cuentas: readonly Cuenta[]) {
  if (asiento.origen !== 'manual') throw new Error('Este asiento se modifica desde su factura.')
  comprobar(b, cuentas, asiento.ejercicio)
  await runTransaction(db, async (tx) => {
    await leerEjercicioAbierto(tx, uid, asiento.ejercicio)
    tx.set(
      asientoRef(uid, asiento.id),
      aAsientoData(b, { ejercicio: asiento.ejercicio, numero: asiento.numero, origen: 'manual', origenId: null }),
    )
  })
}

export async function borrarAsientoManual(uid: string, asiento: Asiento) {
  if (!ORIGENES_BORRABLES.includes(asiento.origen))
    throw new Error(ORIGENES_CIERRE.includes(asiento.origen) ? 'Para deshacer el cierre, reabre el ejercicio.' : 'Este asiento se borra desde su factura.')
  await deleteDoc(asientoRef(uid, asiento.id))
}

/**
 * Vuelve a numerar los asientos del ejercicio en orden cronológico (1, 2, 3…),
 * como exige el libro diario. Devuelve cuántos han cambiado de número.
 */
export async function renumerarAsientos(uid: string, anio: number, asientos: readonly Asiento[]): Promise<number> {
  const cambios = ordenarPorFecha(asientos)
    .map((a, i) => ({ a, numero: i + 1 }))
    .filter(({ a, numero }) => a.numero !== numero)
  for (let i = 0; i < cambios.length; i += 400) {
    const batch = writeBatch(db)
    for (const { a, numero } of cambios.slice(i, i + 400)) batch.update(asientoRef(uid, a.id), { numero })
    await batch.commit()
  }
  // El siguiente asiento será el n + 1, sin huecos.
  await updateDoc(ejercicioRef(uid, anio), { contadorAsientos: asientos.length })
  return cambios.length
}
