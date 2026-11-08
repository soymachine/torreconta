/** Tipos de los documentos de negocio que se guardan en Firestore. */
import type { CalculoFactura, LineaFactura } from './contabilizacion'
import type { Cents } from './money'

export type TipoTercero = 'cliente' | 'proveedor' | 'acreedor'

export interface Tercero {
  id: string
  tipo: TipoTercero
  nombre: string
  nif: string
  email: string
  domicilio: string
  cuenta: string
  categoriaPorDefectoId: string | null
  activo: boolean
}

export interface Categoria {
  id: string
  nombre: string
  color: string
  cuentaGasto: string
  activa: boolean
}

export interface MovimientoTesoreria {
  fecha: string
  cuenta: string
  asientoId: string
}

interface FacturaBase extends CalculoFactura {
  id: string
  ejercicio: number
  numero: string
  fecha: string
  terceroId: string
  terceroNombre: string
  terceroNif: string
  terceroCuenta: string
  lineas: LineaFactura[]
  asientoId: string
}

export interface FacturaEmitida extends FacturaBase {
  secuencia: number
  cuentaIngreso: string
  estado: 'pendiente' | 'cobrada'
  cobro: MovimientoTesoreria | null
}

export interface FacturaRecibida extends FacturaBase {
  categoriaId: string
  ivaDeducible: boolean
  estado: 'pendiente' | 'pagada'
  pago: MovimientoTesoreria | null
}

export interface Ejercicio {
  anio: number
  estado: 'abierto' | 'cerrado'
  contadorAsientos: number
  contadorFacturas?: number
}

export type { Cents }
