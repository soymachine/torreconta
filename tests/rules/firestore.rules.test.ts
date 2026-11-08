// Registra el SDK compat que usa internamente @firebase/rules-unit-testing.
import 'firebase/compat/firestore'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const OWNER = 'propietario'
const INTRUSO = 'intruso'
let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-torreconta',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'autorizados', OWNER), { alta: true })
    await setDoc(doc(db, `users/${OWNER}/ejercicios/2026`), { anio: 2026, estado: 'abierto', contadorAsientos: 0 })
    await setDoc(doc(db, `users/${OWNER}/ejercicios/2025`), { anio: 2025, estado: 'cerrado', contadorAsientos: 10 })
    await setDoc(doc(db, `users/${OWNER}/cuentas/430`), { codigo: '430', nombre: 'Clientes', naturaleza: 'activo', activa: true })
  })
})

const ownerDb = () => env.authenticatedContext(OWNER).firestore()
const intrusoDb = () => env.authenticatedContext(INTRUSO).firestore()

function asiento(overrides: Record<string, unknown> = {}) {
  return {
    ejercicio: 2026,
    numero: 1,
    fecha: '2026-03-15',
    concepto: 'Venta',
    origen: 'manual',
    lineas: [
      { cuenta: '430', debeCent: 12100, haberCent: 0 },
      { cuenta: '705', debeCent: 0, haberCent: 10000 },
      { cuenta: '477', debeCent: 0, haberCent: 2100 },
    ],
    cuentas: ['430', '705', '477'],
    totalDebeCent: 12100,
    totalHaberCent: 12100,
    ...overrides,
  }
}

describe('acceso', () => {
  it('el propietario autorizado lee sus cuentas', async () => {
    await assertSucceeds(getDoc(doc(ownerDb(), `users/${OWNER}/cuentas/430`)))
  })
  it('otro usuario no puede leer ni escribir datos ajenos', async () => {
    await assertFails(getDoc(doc(intrusoDb(), `users/${OWNER}/cuentas/430`)))
    await assertFails(setDoc(doc(intrusoDb(), `users/${OWNER}/asientos/a1`), asiento()))
  })
  it('un usuario no autorizado no puede usar ni su propio espacio', async () => {
    await assertFails(
      setDoc(doc(intrusoDb(), `users/${INTRUSO}/cuentas/430`), { codigo: '430', nombre: 'X', naturaleza: 'activo', activa: true }),
    )
  })
  it('sin sesión no hay acceso', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `users/${OWNER}/cuentas/430`)))
  })
  it('nadie puede darse de alta en /autorizados', async () => {
    await assertFails(setDoc(doc(intrusoDb(), 'autorizados', INTRUSO), { alta: true }))
    await assertSucceeds(getDoc(doc(ownerDb(), 'autorizados', OWNER)))
    await assertFails(getDoc(doc(intrusoDb(), 'autorizados', OWNER)))
  })
})

describe('cuentas', () => {
  const ref = () => doc(ownerDb(), `users/${OWNER}/cuentas/4300001`)
  it('crea una subcuenta válida', async () => {
    await assertSucceeds(setDoc(ref(), { codigo: '4300001', nombre: 'Cliente A', naturaleza: 'activo', activa: true }))
  })
  it('rechaza código distinto al id, no numérico o campos extra', async () => {
    await assertFails(setDoc(ref(), { codigo: '4300002', nombre: 'X', naturaleza: 'activo', activa: true }))
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/cuentas/43A`), { codigo: '43A', nombre: 'X', naturaleza: 'activo', activa: true }),
    )
    await assertFails(setDoc(ref(), { codigo: '4300001', nombre: 'X', naturaleza: 'activo', activa: true, saldo: 5 }))
  })
  it('solo permite cambiar nombre y estado, y nunca borrar', async () => {
    const r = doc(ownerDb(), `users/${OWNER}/cuentas/430`)
    await assertSucceeds(updateDoc(r, { nombre: 'Clientes nacionales', activa: false }))
    await assertFails(updateDoc(r, { naturaleza: 'pasivo' }))
    await assertFails(deleteDoc(r))
  })
})

describe('asientos', () => {
  const ref = (id = 'a1') => doc(ownerDb(), `users/${OWNER}/asientos/${id}`)
  it('acepta un asiento cuadrado en un ejercicio abierto', async () => {
    await assertSucceeds(setDoc(ref(), asiento()))
  })
  it('rechaza un asiento descuadrado', async () => {
    await assertFails(setDoc(ref(), asiento({ totalHaberCent: 12000 })))
  })
  it('rechaza importes no enteros, a cero o con una sola línea', async () => {
    await assertFails(setDoc(ref(), asiento({ totalDebeCent: 121.5, totalHaberCent: 121.5 })))
    await assertFails(setDoc(ref(), asiento({ totalDebeCent: 0, totalHaberCent: 0 })))
    await assertFails(setDoc(ref(), asiento({ lineas: [{ cuenta: '430', debeCent: 1, haberCent: 0 }] })))
  })
  it('rechaza una fecha fuera del ejercicio', async () => {
    await assertFails(setDoc(ref(), asiento({ fecha: '2025-12-31' })))
  })
  it('no permite escribir en un ejercicio cerrado ni en uno inexistente', async () => {
    await assertFails(setDoc(ref(), asiento({ ejercicio: 2025, fecha: '2025-06-01' })))
    await assertFails(setDoc(ref(), asiento({ ejercicio: 2027, fecha: '2027-01-01' })))
  })
  it('no permite modificar ni borrar asientos de un ejercicio cerrado', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${OWNER}/asientos/viejo`), asiento({ ejercicio: 2025, fecha: '2025-06-01' }))
    })
    await assertFails(updateDoc(ref('viejo'), { concepto: 'cambiado' }))
    await assertFails(deleteDoc(ref('viejo')))
  })
  it('no permite cambiar el número de un asiento', async () => {
    await assertSucceeds(setDoc(ref(), asiento()))
    await assertFails(updateDoc(ref(), { numero: 2 }))
    await assertSucceeds(updateDoc(ref(), { concepto: 'Venta corregida' }))
  })
})

describe('ejercicios', () => {
  it('el contador solo avanza y un ejercicio cerrado no se reabre', async () => {
    const r = doc(ownerDb(), `users/${OWNER}/ejercicios/2026`)
    await assertSucceeds(updateDoc(r, { contadorAsientos: 1 }))
    await assertFails(updateDoc(r, { contadorAsientos: 0 }))
    const cerrado = doc(ownerDb(), `users/${OWNER}/ejercicios/2025`)
    await assertFails(updateDoc(cerrado, { estado: 'abierto' }))
  })
})

describe('terceros y categorías', () => {
  const tercero = {
    tipo: 'cliente',
    nombre: 'Cliente SA',
    nif: 'B12345674',
    email: '',
    domicilio: '',
    cuenta: '4300001',
    categoriaPorDefectoId: null,
    activo: true,
  }
  it('crea un tercero válido y no deja cambiar su subcuenta ni borrarlo', async () => {
    const r = doc(ownerDb(), `users/${OWNER}/terceros/t1`)
    await assertSucceeds(setDoc(r, tercero))
    await assertSucceeds(updateDoc(r, { nombre: 'Cliente Nuevo SA' }))
    await assertFails(updateDoc(r, { cuenta: '4300002' }))
    await assertFails(deleteDoc(r))
  })
  it('rechaza terceros con subcuenta incorrecta o tipo desconocido', async () => {
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/terceros/t2`), { ...tercero, cuenta: '5720001' }))
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/terceros/t3`), { ...tercero, tipo: 'socio' }))
  })
  it('las categorías apuntan a una cuenta del grupo 6 que no cambia', async () => {
    const r = doc(ownerDb(), `users/${OWNER}/categorias/c1`)
    await assertFails(setDoc(r, { nombre: 'Mal', color: '#000', cuentaGasto: '700', activa: true }))
    await assertSucceeds(setDoc(r, { nombre: 'Suministros', color: '#000', cuentaGasto: '628', activa: true }))
    await assertSucceeds(updateDoc(r, { nombre: 'Luz y agua', activa: false }))
    await assertFails(updateDoc(r, { cuentaGasto: '629' }))
    await assertFails(deleteDoc(r))
  })
})

describe('facturas', () => {
  const base = {
    ejercicio: 2026,
    numero: 'F2026-0001',
    fecha: '2026-02-10',
    terceroId: 't1',
    terceroNombre: 'Cliente SA',
    terceroNif: 'B12345674',
    terceroCuenta: '4300001',
    lineas: [{ concepto: 'Servicio', cantidad: 1, precioCent: 100000, ivaPct: 21 }],
    bases: [{ ivaPct: 21, baseCent: 100000, cuotaCent: 21000 }],
    baseCent: 100000,
    cuotaIvaCent: 21000,
    irpfPct: 0,
    retencionCent: 0,
    totalCent: 121000,
    asientoId: 'a1',
  }
  const emitida = { ...base, secuencia: 1, cuentaIngreso: '705', estado: 'pendiente', cobro: null }
  const recibida = { ...base, numero: 'A-1', categoriaId: 'c1', ivaDeducible: true, estado: 'pendiente', pago: null }

  it('acepta facturas coherentes en un ejercicio abierto', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/facturasEmitidas/e1`), emitida))
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/facturasRecibidas/r1`), recibida))
  })
  it('rechaza totales incoherentes y facturas recibidas sin categoría', async () => {
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/facturasEmitidas/e1`), { ...emitida, totalCent: 1 }))
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/facturasRecibidas/r1`), { ...recibida, categoriaId: '' }))
    const { categoriaId: _c, ...sinCategoria } = recibida
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/facturasRecibidas/r2`), sinCategoria))
  })
  it('no deja crear facturas en un ejercicio cerrado ni a usuarios ajenos', async () => {
    const cerrada = { ...emitida, ejercicio: 2025, fecha: '2025-05-01' }
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/facturasEmitidas/e9`), cerrada))
    await assertFails(setDoc(doc(intrusoDb(), `users/${OWNER}/facturasEmitidas/e1`), emitida))
  })
  it('no deja cambiar el número de una factura emitida', async () => {
    const r = doc(ownerDb(), `users/${OWNER}/facturasEmitidas/e1`)
    await assertSucceeds(setDoc(r, emitida))
    await assertFails(updateDoc(r, { numero: 'F2026-0002' }))
  })
  it('en un ejercicio cerrado solo se puede registrar el cobro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${OWNER}/facturasEmitidas/vieja`), {
        ...emitida,
        ejercicio: 2025,
        fecha: '2025-05-01',
      })
    })
    const r = doc(ownerDb(), `users/${OWNER}/facturasEmitidas/vieja`)
    await assertFails(updateDoc(r, { lineas: [], baseCent: 0 }))
    await assertFails(deleteDoc(r))
    await assertSucceeds(updateDoc(r, { estado: 'cobrada', cobro: { fecha: '2026-01-10', cuenta: '572', asientoId: 'x' } }))
  })
  it('el contador de facturas puede bajar al borrar la última, pero no ser negativo', async () => {
    const r = doc(ownerDb(), `users/${OWNER}/ejercicios/2026`)
    await assertSucceeds(updateDoc(r, { contadorFacturas: 1 }))
    await assertSucceeds(updateDoc(r, { contadorFacturas: 0 }))
    await assertFails(updateDoc(r, { contadorFacturas: -1 }))
  })
})
