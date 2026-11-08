import { runTransaction, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Cuenta, Naturaleza } from '../lib/cuentas'
import type { Tercero, TipoTercero } from '../lib/tipos'
import { cuentaRef, nuevoId, terceroRef, tercerosCol } from './paths'

const CUENTA_TIPO: Record<TipoTercero, { prefijo: string; naturaleza: Naturaleza }> = {
  cliente: { prefijo: '430', naturaleza: 'activo' },
  proveedor: { prefijo: '400', naturaleza: 'pasivo' },
  acreedor: { prefijo: '410', naturaleza: 'pasivo' },
}

/** Siguiente subcuenta libre de 7 dígitos: 4300001, 4300002… */
export function siguienteSubcuenta(tipo: TipoTercero, cuentas: readonly Pick<Cuenta, 'codigo'>[]): string {
  const { prefijo } = CUENTA_TIPO[tipo]
  let max = 0
  for (const c of cuentas)
    if (c.codigo.length === 7 && c.codigo.startsWith(prefijo)) max = Math.max(max, Number(c.codigo.slice(3)))
  if (max >= 9999) throw new Error('No quedan subcuentas libres.')
  return prefijo + String(max + 1).padStart(4, '0')
}

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
