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
| 5 | Cierre y apertura automáticos, resumen 390, PDF, copia de seguridad completa | Pendiente |

Planes: [`docs/plan.md`](docs/plan.md) (global) y [`docs/plan-mvp.md`](docs/plan-mvp.md) (MVP).

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
- **Informes**: modelo 303 por trimestre, pérdidas y ganancias, balance de situación (comprueba que cuadra), gasto por categoría y panel resumen. Todo se exporta a CSV para Excel en español.
## Desarrollo local (sin proyecto real de Firebase)

Requisitos: Node 22 y Java 21 (para los emuladores).

```bash
npm install
npm run emulators          # Auth en :9099, Firestore en :8080, UI en :4000
npm run dev:emu            # en otra terminal: la app contra los emuladores
```

Para entrar, crea un usuario en la UI de emuladores (http://127.0.0.1:4000/auth), copia su UID y crea en Firestore el documento `autorizados/{UID}` con cualquier contenido (por ejemplo, `alta: true`).

## Tests

```bash
npm test                   # unitarios: importes, NIF, cuentas, asientos, facturas, saldos, IVA, CSV
npm run test:rules         # reglas de seguridad de Firestore contra el emulador
npm run build              # comprobación de tipos y build
```

## Puesta en producción

1. Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/) (plan Spark) y añade una app web.
2. **Authentication**:
   - Activa el proveedor *Correo electrónico/contraseña* y crea tu usuario.
   - En *Configuración → Acciones del usuario*, desactiva la creación de cuentas para que nadie más pueda registrarse.
3. **Firestore**: crea la base de datos y añade a mano el documento `autorizados/{tu UID}`. Solo los UID que estén ahí pueden leer o escribir datos.
4. Copia `.env.example` a `.env.local` y rellénalo con la configuración de la app web. Pon el id del proyecto en `.firebaserc`.
5. Despliega:

   ```bash
   npx firebase login
   npm run deploy
   ```

   El workflow `.github/workflows/ci.yml` también despliega automáticamente al hacer push a `main` si configuras los secretos que indica.

## Modelo de seguridad

- Todos los datos viven en `users/{uid}/…` y las reglas (`firestore.rules`) exigen que el usuario esté autenticado, sea el dueño y figure en `autorizados`.
- Los asientos solo se aceptan si están cuadrados (debe = haber, en céntimos enteros), tienen al menos dos líneas, la fecha cae dentro del ejercicio y el ejercicio está abierto. Los asientos de un ejercicio cerrado no se pueden modificar ni borrar.
- Las cuentas no se borran: solo se renombran o se desactivan. El código y la naturaleza no se pueden cambiar.
