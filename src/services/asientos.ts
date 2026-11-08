import { deleteDoc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { aAsientoData, validarAsiento, type Asiento, type BorradorAsiento } from '../lib/asientos'
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
  if (asiento.origen !== 'manual') throw new Error('Este asiento se borra desde su factura.')
  await deleteDoc(asientoRef(uid, asiento.id))
}
