import { getDocs, limit, query, runTransaction, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Cuenta } from '../lib/cuentas'
import { CUENTA_TIPO, siguienteSubcuenta } from '../lib/terceros'
import type { Tercero, TipoTercero } from '../lib/tipos'
import { asientosCol, cuentaRef, emitidasCol, nuevoId, recibidasCol, terceroRef, tercerosCol } from './paths'

export type DatosTercero = Omit<Tercero, 'id' | 'cuenta' | 'activo'>

export async function crearTercero(eid: string, datos: DatosTercero, cuentas: readonly Cuenta[]): Promise<Tercero> {
  const codigo = siguienteSubcuenta(datos.tipo, cuentas)
  const ref = nuevoId(tercerosCol(eid))
  const tercero: Tercero = { ...datos, id: ref.id, cuenta: codigo, activo: true }
  await runTransaction(db, async (tx) => {
    const existente = await tx.get(cuentaRef(eid, codigo))
    if (existente.exists()) throw new Error(`La subcuenta ${codigo} ya existe. Inténtalo de nuevo.`)
    tx.set(cuentaRef(eid, codigo), {
      codigo,
      nombre: datos.nombre,
      naturaleza: CUENTA_TIPO[datos.tipo].naturaleza,
      activa: true,
    })
    const { id: _id, ...sinId } = tercero
    tx.set(ref, sinId)
  })
  return tercero
}

export async function actualizarTercero(eid: string, tercero: Tercero, cambios: Partial<Omit<DatosTercero, 'tipo'>> & { activo?: boolean }) {
  await updateDoc(terceroRef(eid, tercero.id), cambios)
  if (cambios.nombre && cambios.nombre !== tercero.nombre)
    await updateDoc(cuentaRef(eid, tercero.cuenta), { nombre: cambios.nombre })
}

export interface UsoTercero {
  facturas: boolean
  asientos: boolean
}

/** ¿Tiene el tercero facturas o asientos en algún ejercicio? */
export async function usoTercero(eid: string, tercero: Pick<Tercero, 'id' | 'cuenta'>): Promise<UsoTercero> {
  const [emitidas, recibidas, asientos] = await Promise.all([
    getDocs(query(emitidasCol(eid), where('terceroId', '==', tercero.id), limit(1))),
    getDocs(query(recibidasCol(eid), where('terceroId', '==', tercero.id), limit(1))),
    getDocs(query(asientosCol(eid), where('cuentas', 'array-contains', tercero.cuenta), limit(1))),
  ])
  return { facturas: !emitidas.empty || !recibidas.empty, asientos: !asientos.empty }
}

/**
 * Corrige el tipo de un tercero dado de alta por error. Solo se permite si no
 * tiene movimientos: le asigna una subcuenta nueva del tipo correcto y
 * desactiva la anterior (las cuentas no se borran).
 */
export async function cambiarTipoTercero(
  eid: string,
  tercero: Tercero,
  nuevoTipo: TipoTercero,
  cuentas: readonly Cuenta[],
): Promise<Tercero> {
  if (nuevoTipo === tercero.tipo) return tercero
  const uso = await usoTercero(eid, tercero)
  if (uso.facturas || uso.asientos)
    throw new Error('Este tercero ya tiene facturas o asientos: no se puede cambiar su tipo. Crea uno nuevo del tipo correcto.')
  const codigo = siguienteSubcuenta(nuevoTipo, cuentas)
  const actualizado: Tercero = {
    ...tercero,
    tipo: nuevoTipo,
    cuenta: codigo,
    categoriaPorDefectoId: nuevoTipo === 'cliente' ? null : tercero.categoriaPorDefectoId,
  }
  await runTransaction(db, async (tx) => {
    const existente = await tx.get(cuentaRef(eid, codigo))
    if (existente.exists()) throw new Error(`La subcuenta ${codigo} ya existe. Inténtalo de nuevo.`)
    tx.set(cuentaRef(eid, codigo), { codigo, nombre: tercero.nombre, naturaleza: CUENTA_TIPO[nuevoTipo].naturaleza, activa: true })
    tx.update(cuentaRef(eid, tercero.cuenta), { activa: false })
    tx.update(terceroRef(eid, tercero.id), {
      tipo: actualizado.tipo,
      cuenta: actualizado.cuenta,
      categoriaPorDefectoId: actualizado.categoriaPorDefectoId,
    })
  })
  return actualizado
}

/**
 * Elimina un tercero sin movimientos (alta por error o que no se llegó a
 * usar). Su subcuenta no se borra: queda desactivada en el plan de cuentas.
 */
export async function eliminarTercero(eid: string, tercero: Tercero) {
  const uso = await usoTercero(eid, tercero)
  if (uso.facturas || uso.asientos)
    throw new Error('Este tercero tiene facturas o asientos y no se puede eliminar. Puedes desactivarlo.')
  await runTransaction(db, async (tx) => {
    const cuenta = await tx.get(cuentaRef(eid, tercero.cuenta))
    if (cuenta.exists()) tx.update(cuentaRef(eid, tercero.cuenta), { activa: false })
    tx.delete(terceroRef(eid, tercero.id))
  })
}

/** Desactivar oculta el tercero al crear facturas, pero conserva su historial. */
export async function cambiarActivoTercero(eid: string, tercero: Tercero, activo: boolean) {
  await updateDoc(terceroRef(eid, tercero.id), { activo })
}
