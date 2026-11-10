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
const SOCIO = 'socio'
const INTRUSO = 'intruso'
const EMP = 'emili'
const OTRA = 'otra-empresa'
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
    await setDoc(doc(db, 'autorizados', OWNER), { empresaId: EMP })
    await setDoc(doc(db, 'autorizados', SOCIO), { empresaId: EMP })
    await setDoc(doc(db, `empresas/${EMP}/ejercicios/2026`), { anio: 2026, estado: 'abierto', contadorAsientos: 0 })
    await setDoc(doc(db, `empresas/${EMP}/ejercicios/2025`), { anio: 2025, estado: 'cerrado', contadorAsientos: 10 })
    await setDoc(doc(db, `empresas/${EMP}/cuentas/430`), { codigo: '430', nombre: 'Clientes', naturaleza: 'activo', activa: true })
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
    await assertSucceeds(getDoc(doc(ownerDb(), `empresas/${EMP}/cuentas/430`)))
  })
  it('otro usuario no puede leer ni escribir datos ajenos', async () => {
    await assertFails(getDoc(doc(intrusoDb(), `empresas/${EMP}/cuentas/430`)))
    await assertFails(setDoc(doc(intrusoDb(), `empresas/${EMP}/asientos/a1`), asiento()))
  })
  it('un usuario no autorizado no puede usar ni su propio espacio', async () => {
    await assertFails(
      setDoc(doc(intrusoDb(), `empresas/${OTRA}/cuentas/430`), { codigo: '430', nombre: 'X', naturaleza: 'activo', activa: true }),
    )
  })
  it('sin sesión no hay acceso', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `empresas/${EMP}/cuentas/430`)))
  })
  it('un segundo usuario de la misma empresa comparte los datos', async () => {
    const socio = env.authenticatedContext(SOCIO).firestore()
    await assertSucceeds(getDoc(doc(socio, `empresas/${EMP}/cuentas/430`)))
    await assertSucceeds(setDoc(doc(socio, `empresas/${EMP}/asientos/s1`), asiento()))
    await assertFails(getDoc(doc(socio, `empresas/${OTRA}/cuentas/430`)))
  })
  it('nadie puede darse de alta en /autorizados', async () => {
    await assertFails(setDoc(doc(intrusoDb(), 'autorizados', INTRUSO), { empresaId: EMP }))
    await assertSucceeds(getDoc(doc(ownerDb(), 'autorizados', OWNER)))
    await assertFails(getDoc(doc(intrusoDb(), 'autorizados', OWNER)))
  })
})

describe('cuentas', () => {
  const ref = () => doc(ownerDb(), `empresas/${EMP}/cuentas/4300001`)
  it('crea una subcuenta válida', async () => {
    await assertSucceeds(setDoc(ref(), { codigo: '4300001', nombre: 'Cliente A', naturaleza: 'activo', activa: true }))
  })
  it('rechaza código distinto al id, no numérico o campos extra', async () => {
    await assertFails(setDoc(ref(), { codigo: '4300002', nombre: 'X', naturaleza: 'activo', activa: true }))
    await assertFails(
      setDoc(doc(ownerDb(), `empresas/${EMP}/cuentas/43A`), { codigo: '43A', nombre: 'X', naturaleza: 'activo', activa: true }),
    )
    await assertFails(setDoc(ref(), { codigo: '4300001', nombre: 'X', naturaleza: 'activo', activa: true, saldo: 5 }))
  })
  it('solo permite cambiar nombre y estado, y nunca borrar', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/cuentas/430`)
    await assertSucceeds(updateDoc(r, { nombre: 'Clientes nacionales', activa: false }))
    await assertFails(updateDoc(r, { naturaleza: 'pasivo' }))
    await assertFails(deleteDoc(r))
  })
})

describe('asientos', () => {
  const ref = (id = 'a1') => doc(ownerDb(), `empresas/${EMP}/asientos/${id}`)
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
      await setDoc(doc(ctx.firestore(), `empresas/${EMP}/asientos/viejo`), asiento({ ejercicio: 2025, fecha: '2025-06-01' }))
    })
    await assertFails(updateDoc(ref('viejo'), { concepto: 'cambiado' }))
    await assertFails(deleteDoc(ref('viejo')))
  })
  it('no permite cambiar el número a la vez que el contenido', async () => {
    await assertSucceeds(setDoc(ref(), asiento()))
    await assertFails(updateDoc(ref(), { numero: 2, concepto: 'Otro' }))
    await assertSucceeds(updateDoc(ref(), { concepto: 'Venta corregida' }))
  })
})

describe('ejercicios', () => {
  it('el contador no puede ser negativo y un ejercicio cerrado no se modifica', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/ejercicios/2026`)
    await assertSucceeds(updateDoc(r, { contadorAsientos: 1 }))
    await assertSucceeds(updateDoc(r, { contadorAsientos: 0 }))
    await assertFails(updateDoc(r, { contadorAsientos: -1 }))
    await assertFails(updateDoc(r, { contadorAsientos: 'x' }))
    const cerrado = doc(ownerDb(), `empresas/${EMP}/ejercicios/2025`)
    await assertFails(updateDoc(cerrado, { contadorAsientos: 11 }))
    await assertFails(updateDoc(cerrado, { estado: 'abierto', contadorAsientos: 0 }))
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
  it('crea un tercero válido, su subcuenta solo cambia a otra coherente y solo un miembro lo borra', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/terceros/t1`)
    await assertSucceeds(setDoc(r, tercero))
    await assertSucceeds(updateDoc(r, { nombre: 'Cliente Nuevo SA' }))
    await assertSucceeds(updateDoc(r, { cuenta: '4300999' }))
    await assertFails(updateDoc(r, { cuenta: '4000002' }))
    await assertSucceeds(updateDoc(r, { cuentaGastoPorDefecto: '6020002' }))
    await assertFails(updateDoc(r, { cuentaGastoPorDefecto: '7050001' }))
    await assertFails(deleteDoc(doc(intrusoDb(), `empresas/${EMP}/terceros/t1`)))
    await assertSucceeds(updateDoc(r, { activo: false }))
    await assertSucceeds(deleteDoc(r))
  })
  it('rechaza terceros con subcuenta incorrecta o tipo desconocido', async () => {
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/terceros/t2`), { ...tercero, cuenta: '5720001' }))
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/terceros/t3`), { ...tercero, tipo: 'socio' }))
  })
  it('las categorías apuntan a una cuenta del grupo 6 que no cambia', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/categorias/c1`)
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
    await assertSucceeds(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasEmitidas/e1`), emitida))
    await assertSucceeds(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasRecibidas/r1`), recibida))
  })
  it('la cuenta de gasto de una recibida, si existe, es del grupo 6', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasRecibidas/r5`), { ...recibida, cuentaGasto: '6020002' }))
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasRecibidas/r6`), { ...recibida, cuentaGasto: '7050001' }))
  })
  it('rechaza totales incoherentes y facturas recibidas sin categoría', async () => {
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasEmitidas/e1`), { ...emitida, totalCent: 1 }))
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasRecibidas/r1`), { ...recibida, categoriaId: '' }))
    const { categoriaId: _c, ...sinCategoria } = recibida
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasRecibidas/r2`), sinCategoria))
  })
  it('no deja crear facturas en un ejercicio cerrado ni a usuarios ajenos', async () => {
    const cerrada = { ...emitida, ejercicio: 2025, fecha: '2025-05-01' }
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/facturasEmitidas/e9`), cerrada))
    await assertFails(setDoc(doc(intrusoDb(), `empresas/${EMP}/facturasEmitidas/e1`), emitida))
  })
  it('no deja cambiar el número de una factura emitida', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/facturasEmitidas/e1`)
    await assertSucceeds(setDoc(r, emitida))
    await assertFails(updateDoc(r, { numero: 'F2026-0002' }))
  })
  it('en un ejercicio cerrado solo se puede registrar el cobro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `empresas/${EMP}/facturasEmitidas/vieja`), {
        ...emitida,
        ejercicio: 2025,
        fecha: '2025-05-01',
      })
    })
    const r = doc(ownerDb(), `empresas/${EMP}/facturasEmitidas/vieja`)
    await assertFails(updateDoc(r, { lineas: [], baseCent: 0 }))
    await assertFails(deleteDoc(r))
    await assertSucceeds(updateDoc(r, { estado: 'cobrada', cobro: { fecha: '2026-01-10', cuenta: '572', asientoId: 'x' } }))
  })
  it('el contador de facturas puede bajar al borrar la última, pero no ser negativo', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/ejercicios/2026`)
    await assertSucceeds(updateDoc(r, { contadorFacturas: 1 }))
    await assertSucceeds(updateDoc(r, { contadorFacturas: 0 }))
    await assertFails(updateDoc(r, { contadorFacturas: -1 }))
  })
})

describe('renumeración', () => {
  it('permite cambiar solo el número de un asiento, no el número junto a otros campos', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/asientos/a1`)
    await assertSucceeds(setDoc(r, asiento()))
    await assertSucceeds(updateDoc(r, { numero: 7 }))
    await assertFails(updateDoc(r, { numero: 8, concepto: 'otro' }))
    await assertFails(updateDoc(r, { numero: 0 }))
  })
})

describe('cierre de ejercicio', () => {
  it('reabrir un ejercicio cerrado solo puede cambiar el estado', async () => {
    const cerrado = doc(ownerDb(), `empresas/${EMP}/ejercicios/2025`)
    await assertSucceeds(updateDoc(cerrado, { estado: 'abierto' }))
    await assertFails(updateDoc(doc(intrusoDb(), `empresas/${EMP}/ejercicios/2026`), { estado: 'cerrado' }))
  })
  it('acepta asientos de cierre con muchas líneas', async () => {
    const lineas = Array.from({ length: 500 }, (_, i) =>
      i % 2 === 0 ? { cuenta: '572', debeCent: 100, haberCent: 0 } : { cuenta: '100', debeCent: 0, haberCent: 100 },
    )
    await assertSucceeds(
      setDoc(doc(ownerDb(), `empresas/${EMP}/asientos/grande`), asiento({ origen: 'cierre', lineas, cuentas: ['572', '100'], totalDebeCent: 25000, totalHaberCent: 25000 })),
    )
  })
})

describe('logotipo', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const ref = (db = ownerDb(), e = EMP) => doc(db, `empresas/${e}/config/logo`)
  it('un miembro sube y borra el logo; otro usuario no', async () => {
    await assertSucceeds(setDoc(ref(), { dataUrl: png, ancho: 1, alto: 1 }))
    await assertSucceeds(getDoc(ref(env.authenticatedContext(SOCIO).firestore())))
    await assertFails(getDoc(ref(intrusoDb())))
    await assertFails(setDoc(ref(intrusoDb()), { dataUrl: png, ancho: 1, alto: 1 }))
    await assertSucceeds(deleteDoc(ref()))
  })
  it('rechaza SVG, tamaños excesivos y campos extra', async () => {
    await assertFails(setDoc(ref(), { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', ancho: 1, alto: 1 }))
    await assertFails(setDoc(ref(), { dataUrl: 'data:image/png;base64,' + 'A'.repeat(700000), ancho: 1, alto: 1 }))
    await assertFails(setDoc(ref(), { dataUrl: png, ancho: 2000, alto: 1 }))
    await assertFails(setDoc(ref(), { dataUrl: png, ancho: 1, alto: 1, script: 'x' }))
  })
})

describe('cambio de tipo de un tercero', () => {
  const t = { tipo: 'cliente', nombre: 'Equivocado SL', nif: '', email: '', domicilio: '', cuenta: '4300002', categoriaPorDefectoId: null, activo: true }
  const ref = () => doc(ownerDb(), `empresas/${EMP}/terceros/t9`)
  it('cliente → proveedor cambiando a una subcuenta 400', async () => {
    await assertSucceeds(setDoc(ref(), t))
    await assertSucceeds(updateDoc(ref(), { tipo: 'proveedor', cuenta: '4000002' }))
    await assertSucceeds(updateDoc(ref(), { tipo: 'acreedor', cuenta: '4100001' }))
  })
  it('rechaza tipo y subcuenta incoherentes', async () => {
    await assertSucceeds(setDoc(ref(), t))
    await assertFails(updateDoc(ref(), { tipo: 'proveedor' }))
    await assertFails(updateDoc(ref(), { tipo: 'proveedor', cuenta: '4300003' }))
    await assertFails(setDoc(doc(ownerDb(), `empresas/${EMP}/terceros/t10`), { ...t, cuenta: '4000001' }))
  })
})

describe('validaciones reforzadas', () => {
  const empresa = {
    razonSocial: 'Torre SL', nif: 'B12345674', domicilio: '', codigoPostal: '', municipio: '', provincia: '',
    email: '', serieFacturas: 'F', ejercicioActivo: 2026, cuentaBanco: '572', cuentaCaja: '570',
  }
  const ref = () => doc(ownerDb(), `empresas/${EMP}/config/empresa`)
  it('config/empresa solo admite sus campos', async () => {
    await assertSucceeds(setDoc(ref(), empresa))
    await assertFails(setDoc(ref(), { ...empresa, administrador: true }))
    await assertFails(setDoc(ref(), { ...empresa, ejercicioActivo: 1900 }))
    await assertFails(setDoc(ref(), { ...empresa, razonSocial: 'x'.repeat(200) }))
    await assertSucceeds(updateDoc(ref(), { ejercicioActivo: 2027 }))
  })
  it('las líneas de asiento deben ser importes enteros no negativos y cuentas numéricas', async () => {
    const r = doc(ownerDb(), `empresas/${EMP}/asientos/v1`)
    const lineas = (l0: object) => ({ lineas: [l0, { cuenta: '705', debeCent: 0, haberCent: 100, concepto: '' }], totalDebeCent: 100, totalHaberCent: 100, cuentas: ['430', '705'] })
    await assertSucceeds(setDoc(r, asiento(lineas({ cuenta: '430', debeCent: 100, haberCent: 0, concepto: '' }))))
    await assertFails(setDoc(r, asiento(lineas({ cuenta: '430', debeCent: -100, haberCent: 0, concepto: '' }))))
    await assertFails(setDoc(r, asiento(lineas({ cuenta: '430', debeCent: 1.5, haberCent: 0, concepto: '' }))))
    await assertFails(setDoc(r, asiento(lineas({ cuenta: 'abc', debeCent: 100, haberCent: 0, concepto: '' }))))
    await assertFails(setDoc(r, asiento(lineas({ cuenta: '430', debeCent: 100, haberCent: 0, concepto: '', extra: 1 }))))
  })
})
