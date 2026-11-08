/**
 * Facturas emitidas y recibidas. Cada operación escribe en una sola
 * transacción la factura, su asiento y los contadores del ejercicio, para que
 * la contabilidad nunca quede a medias.
 */
import { runTransaction, writeBatch, type DocumentReference, type Transaction } from 'firebase/firestore'
import { db } from '../firebase'
import { aAsientoData, validarAsiento, type BorradorAsiento, type OrigenAsiento } from '../lib/asientos'
import {
  asientoCobro,
  asientoFacturaEmitida,
  asientoFacturaRecibida,
  asientoPago,
  calcularFactura,
  type LineaFactura,
} from '../lib/contabilizacion'
import type { Cuenta } from '../lib/cuentas'
import type { Categoria, FacturaEmitida, FacturaRecibida, Tercero } from '../lib/tipos'
import { leerEjercicioAbierto } from './ejercicios'
import { asientoRef, asientosCol, ejercicioRef, emitidaRef, emitidasCol, nuevoId, recibidaRef, recibidasCol } from './paths'

function comprobar(b: BorradorAsiento, cuentas: readonly Cuenta[], anio: number) {
  const errores = validarAsiento(b, cuentas, anio)
  if (errores.length) throw new Error(errores.join(' '))
}

/** Campos del asiento que cambian al regenerarlo (el número se conserva). */
function camposAsiento(b: BorradorAsiento) {
  const { ejercicio: _e, numero: _n, origen: _o, origenId: _i, ...resto } = aAsientoData(b, {
    ejercicio: 0,
    numero: 0,
    origen: 'manual',
    origenId: null,
  })
  return resto
}

async function crearAsientoEnTx(
  tx: Transaction,
  uid: string,
  anio: number,
  contadorActual: number,
  b: BorradorAsiento,
  origen: OrigenAsiento,
  origenId: string,
): Promise<DocumentReference> {
  const ref = nuevoId(asientosCol(uid))
  tx.set(ref, aAsientoData(b, { ejercicio: anio, numero: contadorActual + 1, origen, origenId }))
  return ref
}

const datosTercero = (t: Tercero) => ({
  terceroId: t.id,
  terceroNombre: t.nombre,
  terceroNif: t.nif,
  terceroCuenta: t.cuenta,
})

const anioDe = (fecha: string) => Number(fecha.slice(0, 4))

export function numeroFactura(serie: string, anio: number, secuencia: number) {
  return `${serie}${anio}-${String(secuencia).padStart(4, '0')}`
}

/* ───────────────────────────── Emitidas ───────────────────────────── */

export interface EntradaFacturaEmitida {
  fecha: string
  tercero: Tercero
  lineas: LineaFactura[]
  irpfPct: number
  cuentaIngreso: string
}

export async function guardarFacturaEmitida(
  uid: string,
  ctx: { serie: string; anio: number; cuentas: readonly Cuenta[] },
  e: EntradaFacturaEmitida,
  existente?: FacturaEmitida,
): Promise<string> {
  if (e.lineas.length === 0) throw new Error('La factura no tiene líneas.')
  const anio = existente?.ejercicio ?? ctx.anio
  if (anioDe(e.fecha) !== anio) throw new Error(`La fecha debe pertenecer al ejercicio ${anio}.`)
  if (existente && existente.estado !== 'pendiente') throw new Error('Deshaz el cobro antes de modificar la factura.')
  const calculo = calcularFactura(e.lineas, e.irpfPct)
  if (calculo.totalCent === 0 && calculo.baseCent === 0) throw new Error('La factura no tiene importe.')

  return runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    const secuencia = existente?.secuencia ?? (ej.contadorFacturas ?? 0) + 1
    const numero = existente?.numero ?? numeroFactura(ctx.serie, anio, secuencia)
    const borrador = asientoFacturaEmitida({
      fecha: e.fecha,
      numero,
      terceroNombre: e.tercero.nombre,
      terceroCuenta: e.tercero.cuenta,
      cuentaIngreso: e.cuentaIngreso,
      calculo,
    })
    comprobar(borrador, ctx.cuentas, anio)

    const facturaRef = existente ? emitidaRef(uid, existente.id) : nuevoId(emitidasCol(uid))
    let asientoId = existente?.asientoId
    if (existente) {
      tx.update(asientoRef(uid, existente.asientoId), camposAsiento(borrador))
    } else {
      const ref = await crearAsientoEnTx(tx, uid, anio, ej.contadorAsientos, borrador, 'factura-emitida', facturaRef.id)
      asientoId = ref.id
      tx.update(ejercicioRef(uid, anio), { contadorAsientos: ej.contadorAsientos + 1, contadorFacturas: secuencia })
    }
    const factura: Omit<FacturaEmitida, 'id'> = {
      ejercicio: anio,
      numero,
      secuencia,
      fecha: e.fecha,
      ...datosTercero(e.tercero),
      lineas: e.lineas,
      ...calculo,
      cuentaIngreso: e.cuentaIngreso,
      asientoId: asientoId!,
      estado: 'pendiente',
      cobro: null,
    }
    tx.set(facturaRef, factura)
    return facturaRef.id
  })
}

/** Solo se puede borrar la última factura de la serie, para no dejar huecos. */
export async function borrarFacturaEmitida(uid: string, f: FacturaEmitida) {
  if (f.estado !== 'pendiente') throw new Error('Deshaz el cobro antes de borrar la factura.')
  await runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, f.ejercicio)
    if (f.secuencia !== ej.contadorFacturas)
      throw new Error('Solo se puede borrar la última factura emitida. Para anular otra, emite una rectificativa.')
    tx.delete(asientoRef(uid, f.asientoId))
    tx.delete(emitidaRef(uid, f.id))
    tx.update(ejercicioRef(uid, f.ejercicio), { contadorFacturas: f.secuencia - 1 })
  })
}

/* ───────────────────────────── Recibidas ───────────────────────────── */

export interface EntradaFacturaRecibida {
  fecha: string
  numero: string
  tercero: Tercero
  lineas: LineaFactura[]
  irpfPct: number
  ivaDeducible: boolean
  categoria: Categoria
}

function borradorRecibida(f: Pick<FacturaRecibida, 'fecha' | 'numero' | 'terceroNombre' | 'terceroCuenta' | 'ivaDeducible'> & { calculo: ReturnType<typeof calcularFactura> }, categoria: Categoria) {
  return asientoFacturaRecibida({ ...f, cuentaGasto: categoria.cuentaGasto })
}

export async function guardarFacturaRecibida(
  uid: string,
  ctx: { anio: number; cuentas: readonly Cuenta[] },
  e: EntradaFacturaRecibida,
  existente?: FacturaRecibida,
): Promise<string> {
  if (e.lineas.length === 0) throw new Error('La factura no tiene líneas.')
  if (!e.numero.trim()) throw new Error('Indica el número de la factura del proveedor.')
  const anio = existente?.ejercicio ?? ctx.anio
  if (anioDe(e.fecha) !== anio) throw new Error(`La fecha debe pertenecer al ejercicio ${anio}.`)
  if (existente && existente.estado !== 'pendiente') throw new Error('Deshaz el pago antes de modificar la factura.')
  const calculo = calcularFactura(e.lineas, e.irpfPct)
  const borrador = borradorRecibida(
    {
      fecha: e.fecha,
      numero: e.numero.trim(),
      terceroNombre: e.tercero.nombre,
      terceroCuenta: e.tercero.cuenta,
      ivaDeducible: e.ivaDeducible,
      calculo,
    },
    e.categoria,
  )
  comprobar(borrador, ctx.cuentas, anio)

  return runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    const facturaRef = existente ? recibidaRef(uid, existente.id) : nuevoId(recibidasCol(uid))
    let asientoId = existente?.asientoId
    if (existente) {
      tx.update(asientoRef(uid, existente.asientoId), camposAsiento(borrador))
    } else {
      const ref = await crearAsientoEnTx(tx, uid, anio, ej.contadorAsientos, borrador, 'factura-recibida', facturaRef.id)
      asientoId = ref.id
      tx.update(ejercicioRef(uid, anio), { contadorAsientos: ej.contadorAsientos + 1 })
    }
    const factura: Omit<FacturaRecibida, 'id'> = {
      ejercicio: anio,
      numero: e.numero.trim(),
      fecha: e.fecha,
      ...datosTercero(e.tercero),
      lineas: e.lineas,
      ...calculo,
      categoriaId: e.categoria.id,
      ivaDeducible: e.ivaDeducible,
      asientoId: asientoId!,
      estado: 'pendiente',
      pago: null,
    }
    tx.set(facturaRef, factura)
    return facturaRef.id
  })
}

export async function borrarFacturaRecibida(uid: string, f: FacturaRecibida) {
  if (f.estado !== 'pendiente') throw new Error('Deshaz el pago antes de borrar la factura.')
  await runTransaction(db, async (tx) => {
    await leerEjercicioAbierto(tx, uid, f.ejercicio)
    tx.delete(asientoRef(uid, f.asientoId))
    tx.delete(recibidaRef(uid, f.id))
  })
}

/**
 * Cambia la categoría de varias facturas recibidas y regenera sus asientos
 * para que el gasto pase a la cuenta 6xx de la nueva categoría.
 */
export async function reasignarCategoria(
  uid: string,
  facturas: readonly FacturaRecibida[],
  categoria: Categoria,
  cuentas: readonly Cuenta[],
) {
  const pendientes = facturas.filter((f) => f.categoriaId !== categoria.id)
  for (let i = 0; i < pendientes.length; i += 200) {
    const batch = writeBatch(db)
    for (const f of pendientes.slice(i, i + 200)) {
      const borrador = borradorRecibida({ ...f, calculo: f }, categoria)
      comprobar(borrador, cuentas, f.ejercicio)
      batch.update(recibidaRef(uid, f.id), { categoriaId: categoria.id })
      batch.update(asientoRef(uid, f.asientoId), camposAsiento(borrador))
    }
    await batch.commit()
  }
}

/* ─────────────────────────── Cobros y pagos ─────────────────────────── */

export interface DatosTesoreria {
  fecha: string
  cuenta: string // 572 o 570 (o subcuentas)
}

export async function registrarCobro(uid: string, f: FacturaEmitida, t: DatosTesoreria, cuentas: readonly Cuenta[]) {
  const anio = anioDe(t.fecha)
  const borrador = asientoCobro({
    fecha: t.fecha,
    numeroFactura: f.numero,
    terceroNombre: f.terceroNombre,
    terceroCuenta: f.terceroCuenta,
    cuentaTesoreria: t.cuenta,
    importeCent: f.totalCent,
  })
  comprobar(borrador, cuentas, anio)
  if (t.fecha < f.fecha) throw new Error('El cobro no puede ser anterior a la factura.')
  await runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    const actual = await tx.get(emitidaRef(uid, f.id))
    if (actual.data()?.estado !== 'pendiente') throw new Error('La factura ya está cobrada.')
    const ref = await crearAsientoEnTx(tx, uid, anio, ej.contadorAsientos, borrador, 'cobro', f.id)
    tx.update(ejercicioRef(uid, anio), { contadorAsientos: ej.contadorAsientos + 1 })
    tx.update(emitidaRef(uid, f.id), { estado: 'cobrada', cobro: { ...t, asientoId: ref.id } })
  })
}

export async function deshacerCobro(uid: string, f: FacturaEmitida) {
  if (!f.cobro) return
  const cobro = f.cobro
  await runTransaction(db, async (tx) => {
    await leerEjercicioAbierto(tx, uid, anioDe(cobro.fecha))
    tx.delete(asientoRef(uid, cobro.asientoId))
    tx.update(emitidaRef(uid, f.id), { estado: 'pendiente', cobro: null })
  })
}

export async function registrarPago(uid: string, f: FacturaRecibida, t: DatosTesoreria, cuentas: readonly Cuenta[]) {
  const anio = anioDe(t.fecha)
  const borrador = asientoPago({
    fecha: t.fecha,
    numeroFactura: f.numero,
    terceroNombre: f.terceroNombre,
    terceroCuenta: f.terceroCuenta,
    cuentaTesoreria: t.cuenta,
    importeCent: f.totalCent,
  })
  comprobar(borrador, cuentas, anio)
  if (t.fecha < f.fecha) throw new Error('El pago no puede ser anterior a la factura.')
  await runTransaction(db, async (tx) => {
    const ej = await leerEjercicioAbierto(tx, uid, anio)
    const actual = await tx.get(recibidaRef(uid, f.id))
    if (actual.data()?.estado !== 'pendiente') throw new Error('La factura ya está pagada.')
    const ref = await crearAsientoEnTx(tx, uid, anio, ej.contadorAsientos, borrador, 'pago', f.id)
    tx.update(ejercicioRef(uid, anio), { contadorAsientos: ej.contadorAsientos + 1 })
    tx.update(recibidaRef(uid, f.id), { estado: 'pagada', pago: { ...t, asientoId: ref.id } })
  })
}

export async function deshacerPago(uid: string, f: FacturaRecibida) {
  if (!f.pago) return
  const pago = f.pago
  await runTransaction(db, async (tx) => {
    await leerEjercicioAbierto(tx, uid, anioDe(pago.fecha))
    tx.delete(asientoRef(uid, pago.asientoId))
    tx.update(recibidaRef(uid, f.id), { estado: 'pendiente', pago: null })
  })
}
