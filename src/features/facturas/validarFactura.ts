/** Validación del formulario de factura con mensajes por campo. */
import { parseEuros } from '../../lib/money'

export interface LineaFormulario {
  concepto: string
  cantidad: string
  precio: string
}

export interface DatosFormularioFactura {
  tipo: 'emitida' | 'recibida'
  anio: number
  fecha: string
  numero: string
  terceroId: string
  categoriaId: string
  /** Cuenta raíz de la categoría elegida y subcuentas donde se puede contabilizar. */
  raizCuentaGasto?: string
  opcionesCuentaGasto?: readonly string[]
  cuentaGasto?: string
  cuentaIngreso: string
  cuentasIngresoValidas: readonly string[]
  lineas: readonly LineaFormulario[]
}

/** Claves: fecha, numero, tercero, categoria, cuentaIngreso, lineas y `linea.{i}.{campo}`. */
export type ErroresFactura = Record<string, string>

export const claveLinea = (i: number, campo: keyof LineaFormulario) => `linea.${i}.${campo}`

const lineaVacia = (l: LineaFormulario) => !l.concepto.trim() && !l.precio.trim()

export function validarFormularioFactura(d: DatosFormularioFactura): ErroresFactura {
  const e: ErroresFactura = {}
  const recibida = d.tipo === 'recibida'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) e.fecha = 'Indica la fecha de la factura.'
  else if (!d.fecha.startsWith(`${d.anio}-`)) e.fecha = `La fecha debe estar dentro del ejercicio ${d.anio}.`

  if (recibida && !d.numero.trim()) e.numero = 'Escribe el número que figura en la factura del proveedor.'
  if (!d.terceroId) e.tercero = recibida ? 'Elige el proveedor que te ha facturado.' : 'Elige el cliente al que facturas.'
  if (recibida && !d.categoriaId) e.categoria = 'Elige en qué categoría de gasto va esta factura.'
  if (recibida && d.categoriaId && d.raizCuentaGasto) {
    const ops = d.opcionesCuentaGasto ?? []
    if (ops.length === 0) e.cuentaGasto = `La cuenta ${d.raizCuentaGasto} no tiene subcuentas activas: actívalas o crea una en el plan de cuentas.`
    else if (ops.length > 1 && !ops.includes(d.cuentaGasto ?? ''))
      e.cuentaGasto = `Elige la subcuenta de gasto (la ${d.raizCuentaGasto} tiene subcuentas).`
  }
  if (!recibida && !d.cuentasIngresoValidas.includes(d.cuentaIngreso)) e.cuentaIngreso = 'Elige la cuenta de ingresos.'

  const importe = recibida ? 'la base imponible' : 'el precio'
  let conImporte = 0
  d.lineas.forEach((l, i) => {
    // Las líneas totalmente vacías se ignoran (p. ej. una línea añadida de más).
    if (lineaVacia(l) && d.lineas.length > 1) return
    const n = `Línea ${i + 1}`
    if (!l.concepto.trim()) e[claveLinea(i, 'concepto')] = `${n}: falta el concepto.`
    if (!l.precio.trim()) e[claveLinea(i, 'precio')] = `${n}: falta ${importe}.`
    else if (parseEuros(l.precio) === null) e[claveLinea(i, 'precio')] = `${n}: ${importe} no es válid${recibida ? 'a' : 'o'} (ejemplo: 1.234,56).`
    else conImporte++
    if (!recibida) {
      const c = Number(l.cantidad.replace(',', '.'))
      if (!l.cantidad.trim() || !Number.isFinite(c) || c === 0) e[claveLinea(i, 'cantidad')] = `${n}: la cantidad no es válida.`
    }
  })
  if (conImporte === 0 && !Object.keys(e).some((k) => k.startsWith('linea.')))
    e.lineas = 'Añade al menos una línea con importe.'
  return e
}

/** Orden visual de los campos, para enfocar el primero con error. */
export function primerError(e: ErroresFactura): string | undefined {
  const orden = ['fecha', 'numero', 'tercero', 'categoria', 'cuentaGasto', 'cuentaIngreso']
  return orden.find((k) => e[k]) ?? Object.keys(e).filter((k) => k.startsWith('linea.')).sort()[0] ?? (e.lineas ? 'lineas' : undefined)
}
