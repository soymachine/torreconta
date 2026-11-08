/**
 * Cierre, reapertura y liquidaciones de IVA. Los asientos del cierre se
 * escriben en una sola transacción junto con el estado de los ejercicios.
 */
import { getDoc, getDocs, query, runTransaction, updateDoc, where, type Transaction } from 'firebase/firestore'
import { db } from '../firebase'
import { aAsientoData, validarAsiento, type Asiento, type BorradorAsiento, type OrigenAsiento } from '../lib/asientos'
import { calcularCierre, origenIdCierre } from '../lib/cierre'
import type { Cuenta } from '../lib/cuentas'
import { asientoLiquidacionIva, origenIdLiquidacion, type Trimestre } from '../lib/iva'
import type { Ejercicio } from '../lib/tipos'
import { abrirEjercicio, leerEjercicioAbierto } from './ejercicios'
import { asientoRef, asientosCol, ejercicioRef, empresaRef, nuevoId } from './paths'

function comprobar(b: BorradorAsiento, cuentas: readonly Cuenta[], anio: number, sistema = false) {
  const errores = validarAsiento(b, cuentas, anio, { sistema })
  if (errores.length) throw new Error(errores.join(' '))
}

function crear(tx: Transaction, uid: string, b: BorradorAsiento, ejercicio: number, numero: number, origen: OrigenAsiento, origenId: string | null) {
  const ref = nuevoId(asientosCol(uid))
  tx.set(ref, aAsientoData(b, { ejercicio, numero, origen, origenId }))
  return ref.id
}

export async function contabilizarLiquidacionIva(
  uid: string,
  anio: number,
  t: Trimestre,
  asientos: readonly Asiento[],
  cuentas: readonly Cuenta[],
) {
  const origenId = origenIdLiquidacion(anio, t)
  if (asientos.some((a) => a.origenId === origenId)) throw new Error(`El ${t}T ya está liquidado.`)
  const b = asientoLiquidacionIva(asientos, anio, t)
  if (!b) throw new Error('No hay IVA pendiente de liquidar hasta ese trimestre.')
  comprobar(b, cuentas, anio)
  await runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    crear(tx, uid, b, anio, ej.contadorAsientos + 1, 'liquidacion-iva', origenId)
    tx.update(ejercicioRef(uid, anio), { contadorAsientos: ej.contadorAsientos + 1 })
  })
}

export async function cerrarEjercicio(
  uid: string,
  anio: number,
  opciones: { impuestoCent: number; activarSiguiente: boolean },
  datos: { asientos: readonly Asiento[]; cuentas: readonly Cuenta[] },
) {
  if (datos.asientos.some((a) => a.origen === 'regularizacion' || a.origen === 'cierre'))
    throw new Error(`El ejercicio ${anio} ya tiene asientos de cierre.`)
  const c = calcularCierre(datos.asientos, anio, opciones.impuestoCent)
  if (!c.cierre || !c.apertura) throw new Error('No hay saldos que cerrar.')
  if (c.impuesto) comprobar(c.impuesto, datos.cuentas, anio, true)
  if (c.regularizacion) comprobar(c.regularizacion, datos.cuentas, anio, true)
  comprobar(c.cierre, datos.cuentas, anio, true)
  comprobar(c.apertura, datos.cuentas, anio + 1, true)

  // El ejercicio siguiente debe existir antes de la transacción: las reglas
  // comprueban su estado con el valor previo a la escritura.
  const siguiente = anio + 1
  const snap = await getDoc(ejercicioRef(uid, siguiente))
  if (!snap.exists()) await abrirEjercicio(uid, siguiente)
  else if ((snap.data() as Ejercicio).estado !== 'abierto') throw new Error(`El ejercicio ${siguiente} está cerrado.`)

  const origenId = origenIdCierre(anio)
  await runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    const ejSig = await leerEjercicioAbierto(tx, uid, siguiente)
    let numero = ej.contadorAsientos
    if (c.impuesto) crear(tx, uid, c.impuesto, anio, ++numero, 'impuesto-sociedades', null)
    if (c.regularizacion) crear(tx, uid, c.regularizacion, anio, ++numero, 'regularizacion', origenId)
    crear(tx, uid, c.cierre!, anio, ++numero, 'cierre', origenId)
    crear(tx, uid, c.apertura!, siguiente, ejSig.contadorAsientos + 1, 'apertura', origenId)
    tx.update(ejercicioRef(uid, anio), { contadorAsientos: numero, estado: 'cerrado' })
    tx.update(ejercicioRef(uid, siguiente), { contadorAsientos: ejSig.contadorAsientos + 1 })
    if (opciones.activarSiguiente) tx.update(empresaRef(uid), { ejercicioActivo: siguiente })
  })
}

/**
 * Deshace el cierre: reabre el ejercicio y borra regularización, cierre y la
 * apertura del siguiente. Es idempotente: si se interrumpe, puede repetirse.
 * El asiento del impuesto se conserva (se puede borrar desde el diario).
 */
export async function reabrirEjercicio(uid: string, anio: number) {
  const ref = ejercicioRef(uid, anio)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`El ejercicio ${anio} no existe.`)
  if ((snap.data() as Ejercicio).estado === 'cerrado') await updateDoc(ref, { estado: 'abierto' })

  const origenId = origenIdCierre(anio)
  const generados = await getDocs(query(asientosCol(uid), where('origenId', '==', origenId)))
  const delAnio = await getDocs(query(asientosCol(uid), where('ejercicio', '==', anio)))
  const restantes = delAnio.docs.filter((d) => d.data().origenId !== origenId).map((d) => d.data().numero as number)
  await runTransaction(db, async (tx) => {
    await leerEjercicioAbierto(tx, uid, anio)
    const anios = new Set(generados.docs.map((d) => d.data().ejercicio as number))
    for (const a of anios) if (a !== anio) await leerEjercicioAbierto(tx, uid, a)
    for (const d of generados.docs) tx.delete(asientoRef(uid, d.id))
    tx.update(ref, { contadorAsientos: Math.max(0, ...restantes) })
    tx.update(empresaRef(uid), { ejercicioActivo: anio })
  })
}
