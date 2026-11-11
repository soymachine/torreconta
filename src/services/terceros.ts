import { getDoc, getDocs, limit, query, runTransaction, updateDoc, where, writeBatch, type DocumentData, type DocumentReference, type Transaction } from 'firebase/firestore'
import { db } from '../firebase'
import type { Cuenta } from '../lib/cuentas'
import { CUENTA_TIPO, siguienteSubcuenta, validarCodigoTercero } from '../lib/terceros'
import type { Tercero, TipoTercero } from '../lib/tipos'
import { asientoRef, asientosCol, cuentaRef, ejercicioRef, emitidaRef, emitidasCol, nuevoId, recibidaRef, recibidasCol, terceroRef, tercerosCol } from './paths'
import type { Linea } from '../lib/asientos'
import type { Ejercicio } from '../lib/tipos'

export type DatosTercero = Omit<Tercero, 'id' | 'cuenta' | 'activo'>

type EstadoSubcuenta = 'nueva' | 'reutilizar'

/**
 * ¿Se puede usar este código para un tercero? Si la cuenta no existe se
 * creará; si existe desactivada, sin otro tercero y sin movimientos (p. ej.
 * la de un cliente eliminado), se reutilizará reactivándola.
 */
export async function comprobarSubcuentaLibre(
  eid: string,
  codigo: string,
  tipo: TipoTercero,
  excluirTerceroId?: string,
): Promise<EstadoSubcuenta> {
  const snap = await getDoc(cuentaRef(eid, codigo))
  if (!snap.exists()) return 'nueva'
  const cuenta = snap.data() as Cuenta
  if (cuenta.activa !== false) throw new Error(`La subcuenta ${codigo} ya existe.`)
  if (cuenta.naturaleza !== CUENTA_TIPO[tipo].naturaleza)
    throw new Error(`La subcuenta ${codigo} existe (desactivada) con otra naturaleza y no se puede reutilizar.`)
  const [ters, asis] = await Promise.all([
    getDocs(query(tercerosCol(eid), where('cuenta', '==', codigo), limit(2))),
    getDocs(query(asientosCol(eid), where('cuentas', 'array-contains', codigo), limit(1))),
  ])
  const otro = ters.docs.find((d) => d.id !== excluirTerceroId)
  if (otro) throw new Error(`La subcuenta ${codigo} ya es de «${otro.data().nombre}».`)
  if (!asis.empty) throw new Error(`La subcuenta ${codigo} está desactivada pero tiene movimientos: no se puede reutilizar.`)
  return 'reutilizar'
}

interface Escritor {
  set(ref: DocumentReference<DocumentData>, data: DocumentData): unknown
  update(ref: DocumentReference<DocumentData>, data: DocumentData): unknown
}

/** Crea la subcuenta o reactiva la desactivada que se reutiliza. */
function ocuparSubcuenta(w: Escritor, eid: string, codigo: string, nombre: string, tipo: TipoTercero, estado: EstadoSubcuenta) {
  if (estado === 'nueva') w.set(cuentaRef(eid, codigo), { codigo, nombre, naturaleza: CUENTA_TIPO[tipo].naturaleza, activa: true })
  else w.update(cuentaRef(eid, codigo), { nombre, activa: true })
}

/** En una transacción, comprueba que la subcuenta sigue como se comprobó. */
async function confirmarEnTx(tx: Transaction, eid: string, codigo: string, estado: EstadoSubcuenta) {
  const snap = await tx.get(cuentaRef(eid, codigo))
  const ok = estado === 'nueva' ? !snap.exists() : snap.exists() && (snap.data() as Cuenta).activa === false
  if (!ok) throw new Error(`La subcuenta ${codigo} acaba de cambiar. Inténtalo de nuevo.`)
}

export async function crearTercero(
  eid: string,
  datos: DatosTercero,
  cuentas: readonly Cuenta[],
  codigoElegido?: string,
): Promise<Tercero> {
  const codigo = codigoElegido || siguienteSubcuenta(datos.tipo, cuentas)
  const error = validarCodigoTercero(datos.tipo, codigo, cuentas)
  if (error) throw new Error(error)
  const estado = await comprobarSubcuentaLibre(eid, codigo, datos.tipo)
  const ref = nuevoId(tercerosCol(eid))
  const tercero: Tercero = { ...datos, id: ref.id, cuenta: codigo, activo: true }
  await runTransaction(db, async (tx) => {
    await confirmarEnTx(tx, eid, codigo, estado)
    ocuparSubcuenta(tx, eid, codigo, datos.nombre, datos.tipo, estado)
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
  const estado = await comprobarSubcuentaLibre(eid, codigo, nuevoTipo, tercero.id)
  const actualizado: Tercero = {
    ...tercero,
    tipo: nuevoTipo,
    cuenta: codigo,
    categoriaPorDefectoId: nuevoTipo === 'cliente' ? null : tercero.categoriaPorDefectoId,
    cuentaGastoPorDefecto: nuevoTipo === 'cliente' ? null : tercero.cuentaGastoPorDefecto ?? null,
  }
  await runTransaction(db, async (tx) => {
    await confirmarEnTx(tx, eid, codigo, estado)
    ocuparSubcuenta(tx, eid, codigo, tercero.nombre, nuevoTipo, estado)
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
  const estado = await comprobarSubcuentaLibre(eid, nuevoCodigo, tercero.tipo, tercero.id)

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
    (b) => ocuparSubcuenta(b, eid, nuevoCodigo, tercero.nombre, tercero.tipo, estado),
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
