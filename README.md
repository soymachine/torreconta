# TorreConta

Contabilidad web de partida doble (PGC de PYMES) para una pequeña empresa con un solo usuario.
Stack: **Vite + React + TypeScript**, **Tailwind CSS**, **Firebase** (Authentication, Firestore y Hosting) en el plan gratuito Spark.

El plan completo está en [`docs/plan.md`](docs/plan.md).

## Estado: MVP

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Login, reglas de seguridad, alta de empresa con el PGC de PYMES y plan de cuentas | ✅ |
| 2 | Libro diario (asientos manuales, renumeración por fecha), mayor y sumas y saldos | ✅ |
| 3 | Clientes y proveedores con subcuenta automática, categorías de gasto, facturas emitidas y recibidas con asiento automático, cobros y pagos | ✅ |
| 4 | IVA trimestral (303), PyG, balance, gasto por categoría, panel y exportación CSV | ✅ |
| 5a | Liquidación trimestral de IVA, impuesto sobre sociedades, cierre (regularización + cierre) y apertura del ejercicio siguiente, reapertura | ✅ |
| 5b | Resumen 390, PDF propio, copia de seguridad completa, aplicación automática del resultado | Pendiente |

Planes: [`docs/plan.md`](docs/plan.md) (global), [`docs/plan-mvp.md`](docs/plan-mvp.md) (MVP) y [`docs/plan-cierre.md`](docs/plan-cierre.md) (cierre).

### Qué hace la aplicación

- **Facturas emitidas**:
  - numeración correlativa `SERIE+AÑO-0001`;
  - líneas con varios tipos de IVA y retención IRPF;
  - vista imprimible para guardar en PDF desde el navegador;
  - registro del cobro.
  - Solo se puede borrar la última factura, para no dejar huecos.
- **Facturas recibidas**:
  - **categoría de gasto obligatoria**, preseleccionada desde el proveedor;
  - IVA deducible o no deducible;
  - retención de profesionales;
  - registro del pago;
  - filtro por categoría y **cambio de categoría a varias facturas a la vez**, que regenera sus asientos.
- **Contabilidad automática**: cada factura, cobro o pago genera su asiento del PGC. Por ejemplo, una factura recibida carga la cuenta 6xx de su categoría y la 472, contra la 400/410 del proveedor. La factura, su asiento y el contador se guardan en una misma transacción.
- **Libros**:
  - diario con asientos manuales que validan el cuadre en vivo;
  - mayor por cuenta o por prefijo;
  - sumas y saldos.
- **Cierre del ejercicio** (menú «Cierre del ejercicio»):
  1. Comprobaciones previas: cuadre, orden cronológico e IVA liquidado. Para liquidar el IVA, cada trimestre se contabiliza la liquidación desde la página del 303 (477/472 contra 4750/4700).
  2. Impuesto sobre sociedades opcional (630 contra 473 y 4752, o 4709 si sale a devolver).
  3. Asientos de regularización (grupos 6 y 7 contra la 129) y de cierre a 31/12, y de apertura a 01/01 del año siguiente.
  4. El ejercicio queda bloqueado. Las facturas pendientes se cobran o pagan desde el ejercicio nuevo.
  5. «Reabrir ejercicio» deshace el cierre si hay que corregir algo.
- **Informes**: modelo 303 por trimestre, pérdidas y ganancias, balance de situación (comprueba que cuadra), gasto por categoría y panel resumen. Todo se exporta a CSV para Excel en español.
## Desarrollo local (sin proyecto real de Firebase)

Requisitos: Node 22 y Java 21 (para los emuladores).

```bash
npm install
npm run emulators          # Auth en :9099, Firestore en :8080, UI en :4000
npm run dev:emu            # en otra terminal: la app contra los emuladores
```

Para entrar, crea un usuario en la UI de emuladores (http://127.0.0.1:4000/auth), copia su UID y crea en Firestore el documento `autorizados/{UID}` con el campo `empresaId` (por ejemplo, `"demo"`).

## Tests

```bash
npm test                   # unitarios: importes, NIF, cuentas, asientos, facturas, saldos, IVA, CSV
npm run test:rules         # reglas de seguridad de Firestore contra el emulador
npm run build              # comprobación de tipos y build
```

## Producción

La aplicación está desplegada en **https://emili-contabilidad.web.app** (proyecto de Firebase `emili-contabilidad`; configuración web en `.env.production`).

Para volver a desplegar tras un cambio:

```bash
npx firebase login
```

```bash
npm run deploy
```

**Dar acceso a otro usuario:**
1. Créalo en Authentication.
2. En Firestore, añade `autorizados/{su UID}` con el campo `empresaId: "emili"`.

Todos los usuarios con el mismo `empresaId` comparten la misma contabilidad.

## Modelo de seguridad

- Todos los datos viven en `empresas/{empresaId}/…`. Las reglas (`firestore.rules`) solo dejan acceder a usuarios autenticados cuyo documento `autorizados/{uid}` apunte a esa empresa.
- Los asientos solo se aceptan si están cuadrados (debe = haber, en céntimos enteros), tienen al menos dos líneas, la fecha cae dentro del ejercicio y el ejercicio está abierto. Los asientos de un ejercicio cerrado no se pueden modificar ni borrar.
- Las cuentas no se borran: solo se renombran o se desactivan. El código y la naturaleza no se pueden cambiar.
