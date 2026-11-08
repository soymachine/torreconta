import { onSnapshot, query, where, type Query } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Alert, Spinner } from '../../components/base'
import type { Asiento } from '../../lib/asientos'
import { compararCodigos, type Cuenta } from '../../lib/cuentas'
import type { Categoria, Ejercicio, FacturaEmitida, FacturaRecibida, Tercero } from '../../lib/tipos'
import type { Empresa } from '../../services/empresa'
import {
  asientosCol,
  categoriasCol,
  cuentasCol,
  ejerciciosCol,
  emitidasCol,
  recibidasCol,
  tercerosCol,
} from '../../services/paths'
import { useEmpresa } from '../empresa/EmpresaProvider'

export interface Libros {
  eid: string
  empresa: Empresa
  anio: number
  ejercicio: Ejercicio | undefined
  ejercicios: Ejercicio[]
  cuentas: Cuenta[]
  terceros: Tercero[]
  categorias: Categoria[]
  asientos: Asiento[]
  emitidas: FacturaEmitida[]
  recibidas: FacturaRecibida[]
  /** Facturas del ejercicio anterior pendientes, o cobradas/pagadas en este. */
  emitidasAnteriores: FacturaEmitida[]
  recibidasAnteriores: FacturaRecibida[]
}

type Colecciones = Omit<Libros, 'eid' | 'empresa' | 'anio' | 'ejercicio'>
const CLAVES: (keyof Colecciones)[] = [
  'ejercicios',
  'cuentas',
  'terceros',
  'categorias',
  'asientos',
  'emitidas',
  'recibidas',
  'emitidasAnteriores',
  'recibidasAnteriores',
]

const LibrosContext = createContext<Libros | null>(null)

/**
 * Mantiene en memoria todo lo del ejercicio activo (asientos y facturas) y
 * los maestros (cuentas, terceros, categorías). Los informes se calculan a
 * partir de aquí, sin más lecturas a Firestore.
 */
export function LibrosProvider({ children }: { children: ReactNode }) {
  const eid = useEmpresaId()
  const empresa = useEmpresa()
  const anio = empresa.ejercicioActivo
  const [datos, setDatos] = useState<Partial<Colecciones>>({})
  const [error, setError] = useState<Error | null>(null)

  // El proveedor se monta con key={anio}: al cambiar de ejercicio el estado empieza vacío.
  useEffect(() => {
    const delAnio = (q: Query, a = anio) => query(q, where('ejercicio', '==', a))
    const fuentes: [keyof Colecciones, Query, boolean][] = [
      ['ejercicios', ejerciciosCol(eid), false],
      ['cuentas', cuentasCol(eid), false],
      ['terceros', tercerosCol(eid), true],
      ['categorias', categoriasCol(eid), true],
      ['asientos', delAnio(asientosCol(eid)), true],
      ['emitidas', delAnio(emitidasCol(eid)), true],
      ['recibidas', delAnio(recibidasCol(eid)), true],
      ['emitidasAnteriores', delAnio(emitidasCol(eid), anio - 1), true],
      ['recibidasAnteriores', delAnio(recibidasCol(eid), anio - 1), true],
    ]
    const unsubs = fuentes.map(([clave, q, conId]) =>
      onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => (conId ? { ...d.data(), id: d.id } : d.data()))
          setDatos((prev) => ({ ...prev, [clave]: docs }))
        },
        setError,
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [eid, anio])

  const value = useMemo<Libros | null>(() => {
    if (CLAVES.some((k) => datos[k] === undefined)) return null
    const d = datos as Colecciones
    return {
      ...d,
      eid,
      empresa,
      anio,
      cuentas: [...d.cuentas].sort((a, b) => compararCodigos(a.codigo, b.codigo)),
      terceros: [...d.terceros].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      categorias: [...d.categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      ejercicios: [...d.ejercicios].sort((a, b) => a.anio - b.anio),
      ejercicio: d.ejercicios.find((e) => e.anio === anio),
      emitidasAnteriores: d.emitidasAnteriores.filter((f) => f.estado === 'pendiente' || f.cobro?.fecha.startsWith(`${anio}-`)),
      recibidasAnteriores: d.recibidasAnteriores.filter((f) => f.estado === 'pendiente' || f.pago?.fecha.startsWith(`${anio}-`)),
    }
  }, [datos, eid, empresa, anio])

  if (error) return <div className="p-8"><Alert>No se han podido cargar los datos: {error.message}</Alert></div>
  if (!value) return <Spinner />
  return <LibrosContext.Provider value={value}>{children}</LibrosContext.Provider>
}

export function useLibros(): Libros {
  const v = useContext(LibrosContext)
  if (!v) throw new Error('useLibros fuera de LibrosProvider')
  return v
}
