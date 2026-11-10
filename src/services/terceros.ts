import { getDoc, getDocs, limit, query, runTransaction, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { Cuenta } from '../lib/cuentas'
import { CUENTA_TIPO, siguienteSubcuenta, validarCodigoTercero } from '../lib/terceros'
import type { Tercero, TipoTercero } from '../lib/tipos'
import { asientoRef, asientosCol, cuentaRef, ejercicioRef, emitidaRef, emitidasCol, nuevoId, recibidaRef, recibidasCol, terceroRef, tercerosCol } from './paths'
import type { Linea } from '../lib/asientos'
import type { Ejercicio } from '../lib/tipos'

export type DatosTercero = Omit<Tercero, 'id' | 'cuenta' | 'activo'>

export async function crearTercero(
  eid: string,
  datos: DatosTercero,
  cuentas: readonly Cuenta[],
  codigoElegido?: string,
): Promise<Tercero> {
  const codigo = codigoElegido || siguienteSubcuenta(datos.tipo, cuentas)
  const error = validarCodigoTercero(datos.tipo, codigo, cuentas)
  if (error) throw new Error(error)
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
  codigoElegido?: string,
): Promise<Tercero> {
  if (nuevoTipo === tercero.tipo) return tercero
  const uso = await usoTercero(eid, tercero)
  if (uso.facturas || uso.asientos)
    throw new Error('Este tercero ya tiene facturas o asientos: no se puede cambiar su tipo. Crea uno nuevo del tipo correcto.')
  const codigo = codigoElegido || siguienteSubcuenta(nuevoTipo, cuentas)
  const errorCodigo = validarCodigoTercero(nuevoTipo, codigo, cuentas)
  if (errorCodigo) throw new Error(errorCodigo)
  const actualizado: Tercero = {
    ...tercero,
    tipo: nuevoTipo,
    cuenta: codigo,
    categoriaPorDefectoId: nuevoTipo === 'cliente' ? null : tercero.categoriaPorDefectoId,
    cuentaGastoPorDefecto: nuevoTipo === 'cliente' ? null : tercero.cuentaGastoPorDefecto ?? null,
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
      cuentaGastoPorDefecto: actualizado.cuentaGastoPorDefecto,
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

/**
 * Cambia el código de la subcuenta de un tercero (p. ej. «Proveedores varios»
 * a 4000999). Si tiene movimientos, se trasladan al código nuevo: los apuntes
 * de sus asientos y la subcuenta guardada en sus facturas. Solo es posible si
 * todos están en ejercicios abiertos. La subcuenta antigua queda desactivada.
 */
export async function cambiarCodigoTercero(eid: string, tercero: Tercero, nuevoCodigo: string, cuentas: readonly Cuenta[]) {
  const viejo = tercero.cuenta
  if (nuevoCodigo === viejo) return tercero
  const error = validarCodigoTercero(tercero.tipo, nuevoCodigo, cuentas)
  if (error) throw new Error(error)
  if ((await getDoc(cuentaRef(eid, nuevoCodigo))).exists()) throw new Error(`La subcuenta ${nuevoCodigo} ya existe.`)

  const [asientos, emitidas, recibidas] = await Promise.all([
    getDocs(query(asientosCol(eid), where('cuentas', 'array-contains', viejo))),
    getDocs(query(emitidasCol(eid), where('terceroId', '==', tercero.id))),
    getDocs(query(recibidasCol(eid), where('terceroId', '==', tercero.id))),
  ])
  const anios = new Set<number>([...asientos.docs, ...emitidas.docs, ...recibidas.docs].map((d) => d.data().ejercicio as number))
  for (const anio of anios) {
    const ej = await getDoc(ejercicioRef(eid, anio))
    if ((ej.data() as Ejercicio | undefined)?.estado !== 'abierto')
      throw new Error(`Tiene movimientos en el ejercicio ${anio}, que está cerrado: no se puede cambiar su código. Reabre ese ejercicio si es imprescindible.`)
  }

  const cambiar = (c: string) => (c === viejo ? nuevoCodigo : c)
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
    (b) => b.set(cuentaRef(eid, nuevoCodigo), { codigo: nuevoCodigo, nombre: tercero.nombre, naturaleza: CUENTA_TIPO[tercero.tipo].naturaleza, activa: true }),
    ...asientos.docs.map((d) => (b: ReturnType<typeof writeBatch>) => {
      const lineas = (d.data().lineas as Linea[]).map((l) => ({ ...l, cuenta: cambiar(l.cuenta) }))
      b.update(asientoRef(eid, d.id), { lineas, cuentas: [...new Set((d.data().cuentas as string[]).map(cambiar))] })
    }),
    ...emitidas.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.update(emitidaRef(eid, d.id), { terceroCuenta: nuevoCodigo })),
    ...recibidas.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.update(recibidaRef(eid, d.id), { terceroCuenta: nuevoCodigo })),
    (b) => b.update(terceroRef(eid, tercero.id), { cuenta: nuevoCodigo }),
    (b) => b.update(cuentaRef(eid, viejo), { activa: false }),
  ]
  // Un único lote si cabe (atómico); si no, por partes en orden: la subcuenta nueva primero y el tercero al final.
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db)
    ops.slice(i, i + 450).forEach((op) => op(b))
    await b.commit()
  }
  return { ...tercero, cuenta: nuevoCodigo }
}
