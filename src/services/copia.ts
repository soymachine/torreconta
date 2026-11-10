/**
 * Copia de seguridad: descarga en JSON todos los datos de la empresa. Sirve
 * de respaldo mientras el proyecto esté en el plan gratuito (sin copias
 * automáticas de Firestore).
 */
import { getDoc, getDocs, Timestamp } from 'firebase/firestore'
import {
  asientosCol,
  categoriasCol,
  cuentasCol,
  ejerciciosCol,
  emitidasCol,
  empresaRef,
  logoRef,
  recibidasCol,
  tercerosCol,
} from './paths'

function serializar(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(serializar)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serializar(x)]))
  return v
}

export async function generarCopia(eid: string) {
  const colecciones = {
    cuentas: cuentasCol(eid),
    ejercicios: ejerciciosCol(eid),
    terceros: tercerosCol(eid),
    categorias: categoriasCol(eid),
    asientos: asientosCol(eid),
    facturasEmitidas: emitidasCol(eid),
    facturasRecibidas: recibidasCol(eid),
  }
  const [empresa, logo, ...listas] = await Promise.all([
    getDoc(empresaRef(eid)),
    getDoc(logoRef(eid)),
    ...Object.values(colecciones).map((c) => getDocs(c)),
  ])
  const datos = Object.fromEntries(
    Object.keys(colecciones).map((k, i) => [k, listas[i].docs.map((d) => ({ id: d.id, ...(serializar(d.data()) as object) }))]),
  )
  return {
    formato: 'torreconta-copia',
    version: 1,
    generada: new Date().toISOString(),
    empresaId: eid,
    config: { empresa: serializar(empresa.data() ?? null), logo: serializar(logo.data() ?? null) },
    ...datos,
  }
}

export async function descargarCopia(eid: string) {
  const copia = await generarCopia(eid)
  const blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `torreconta-copia-${copia.generada.slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  const total = Object.values(copia).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0)
  return total
}
