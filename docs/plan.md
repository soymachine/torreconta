# TorreConta: stack y plan (partida doble, PGC)

## Contexto
Contabilidad web para una pequeña empresa española con un solo usuario. El repo `soymachine/torreconta` está vacío (rama `claude/jolly-mayer-w1dw6c`, sin commits). Lo decidido:
- **Firebase** en plan gratuito Spark: Firestore, Authentication y Hosting.
- **Contabilidad de partida doble con el PGC de PYMES** (RD 1515/2007): libro diario, mayor, sumas y saldos, balance, PyG e IVA.
- **Categorías de compras**: cada factura recibida va a una categoría que elige el usuario.

## Stack (todo gratuito)
| Capa | Elección | Motivo |
|---|---|---|
| Frontend | **Vite + React + TypeScript** (SPA) | Sin servidor propio, se sirve estática desde Firebase Hosting |
| UI | **Tailwind CSS + shadcn/ui**, **TanStack Table** | Tablas de diario y mayor con filtros y ordenación |
| Formularios | **react-hook-form + zod** | Validación de asientos cuadrados, NIF, fechas e importes |
| Router | **React Router** | |
| Datos | **Firestore** (SDK modular) con caché offline persistente | |
| Auth | **Firebase Authentication** (email y contraseña) | Registro público desactivado, un único UID autorizado |
| Hosting | **Firebase Hosting** | HTTPS y dominio propio gratis |
| PDF | **pdfmake** en el navegador | Facturas e informes sin Cloud Functions, que exigen plan Blaze |
| Dinero y fechas | Importes en **céntimos enteros**, **date-fns** | Sin errores de coma flotante |
| Tests | **Vitest**, **Firebase Emulator Suite** con `@firebase/rules-unit-testing`, **Playwright** | |
| CI/CD | **GitHub Actions** con deploy a Hosting | |

**Límites del plan Spark**: 1 GiB y 50k lecturas o 20k escrituras al día en Firestore, más que suficiente para un usuario. Cloud Functions, Cloud Storage (adjuntar tickets) y las exportaciones gestionadas requieren Blaze. Por eso la v1 calcula todo en el cliente y hace la copia de seguridad con un **export JSON y CSV desde la app**.

**Alternativas gratuitas evaluadas y descartadas**:
- **Supabase**: es Postgres, que encaja mejor con la partida doble, pero pausa el proyecto tras 7 días sin uso.
- **PocketBase**: hay que alojarlo y mantenerlo.
- **Appwrite Cloud**.
- Software ya hecho: **Akaunting**, **Dolibarr**, **InvoiceNinja** (open source, autoalojados).

## Modelo de datos (Firestore, todo bajo `users/{uid}/`)
- `config/empresa`: razón social, NIF, domicilio, serie de facturas, ejercicio activo y cuentas por defecto (banco 572, caja 570).
- `cuentas/{codigo}`: código (`6280001`), nombre, grupo (1 a 7), tipo (activo, pasivo, PN, gasto o ingreso), si es de detalle y si está activa. Se precarga el **PGC PYMES** (grupos, subgrupos y cuentas habituales). El usuario crea las subcuentas.
- `ejercicios/{año}`: estado (abierto o cerrado) y contador de asientos.
- `asientos/{id}`: ejercicio, número correlativo, fecha, concepto y origen (manual, factura emitida, factura recibida, cobro, pago, regularización, cierre o apertura), con su `origenId`.
  - `lineas: [{cuenta, debeCent, haberCent, concepto}]`.
  - `cuentas: string[]`, para poder filtrar el mayor con `array-contains`.
  - `totalDebeCent` y `totalHaberCent`.
- `terceros/{id}`: clientes y proveedores con NIF, datos y su subcuenta propia (`4300xxxx` o `4000xxxx`). El proveedor guarda además `categoriaPorDefectoId`.
- `categorias/{id}`: nombre, color, **`cuentaGasto`** (6xx) y si está activa.
- `facturasEmitidas/{id}` y `facturasRecibidas/{id}`: número, fecha, tercero, líneas (base, % de IVA, % de IRPF), totales, estado y el `asientoId` generado. Las recibidas llevan además **`categoriaId` obligatoria**.

**Integridad del diario**:
- Cada asiento es un solo documento, lo que lo hace atómico.
- El cliente valida que debe = haber.
- `firestore.rules` exige `totalDebeCent == totalHaberCent`, que el UID sea el del dueño y la lista blanca, y que el ejercicio esté abierto (con `get()` sobre `ejercicios/{año}`). Así un ejercicio cerrado no se puede tocar.
- La numeración de asientos y de facturas se asigna con **transacción** sobre el contador.

**Saldos**: se calculan en el cliente a partir de los asientos del ejercicio, que quedan en caché. Con el volumen de una pyme de un solo usuario sobra. Si algún día crece, se añaden documentos de saldo mensual por cuenta actualizados en la misma transacción.

## Asientos automáticos (`src/lib/contabilizacion.ts`)
- **Factura emitida**: Debe 430 (total) y 473 (retención IRPF). Haber 700/705 (base) y 477 (IVA repercutido).
- **Factura recibida**: Debe **cuenta 6xx de su categoría** (base) y 472 (IVA soportado; si no es deducible, el IVA va como mayor gasto). Haber 400/410 (total) y 4751 (retención, si la hay).
- **Cobro y pago**: 572 contra 430, y 400 contra 572.
- Al editar una factura, su asiento se regenera dentro de la misma transacción.

## Categorías de compras
- Cada categoría equivale a una cuenta de gasto. Se precargan, por ejemplo:
  - 600 Compras de mercaderías
  - 602 Otros aprovisionamientos
  - 621 Arrendamientos
  - 623 Servicios profesionales
  - 624 Transportes
  - 625 Seguros
  - 626 Servicios bancarios
  - 627 Publicidad
  - 628 Suministros
  - 629 Otros servicios, que incluye el software
- Pantalla **Categorías**: alta (eligiendo o creando su cuenta 6xx), renombrar, desactivar y fusionar. Una categoría con facturas no se puede borrar.
- En la factura recibida la categoría es obligatoria y se preselecciona desde el proveedor.
- El listado se filtra por categoría y permite **reasignar varias facturas a la vez**, lo que regenera sus asientos.
- Hay un informe de gasto por categoría por mes, trimestre o año, y la categoría sale en el export CSV.

## Informes
- Libro diario
- Libro mayor por cuenta
- Balance de sumas y saldos
- **Balance de situación** y **Cuenta de PyG** en el modelo abreviado PYMES
- Libros registro de facturas emitidas y recibidas
- **Modelo 303** trimestral, a partir de los movimientos de 477 y 472
- Resumen anual de IVA para el 390
- Gasto por categoría

Todos se exportan a PDF y CSV.

## Cierre de ejercicio
Asistente con cuatro pasos:
1. Asiento de **regularización**: los grupos 6 y 7 contra la cuenta 129.
2. Asiento de **cierre**.
3. Paso del ejercicio a cerrado.
4. **Apertura** del siguiente ejercicio con los saldos de balance.

## Estructura
```
src/
  firebase.ts
  auth/                  LoginPage, RequireAuth
  data/pgc-pymes.json    plan de cuentas inicial
  lib/money.ts  lib/nif.ts  lib/contabilizacion.ts  lib/saldos.ts
  features/
    cuentas/ terceros/ categorias/
    asientos/            diario y alta de asientos manuales
    facturas-emitidas/ facturas-recibidas/ tesoreria/
    informes/            mayor, sumas y saldos, balance, PyG, IVA, gasto por categoría
    ejercicios/          asistente de cierre y apertura
    export/
firestore.rules  firestore.indexes.json  firebase.json
.github/workflows/deploy.yml
```

## Fases
1. Scaffolding, Firebase, login, reglas con el emulador, precarga del PGC y CRUD de cuentas.
2. Diario: asientos manuales cuadrados con numeración, mayor y sumas y saldos.
3. Terceros, categorías, facturas emitidas y recibidas con asiento automático, cobros y pagos.
4. IVA (303 y 390), libros registro, balance, PyG y gasto por categoría.
5. Cierre y apertura de ejercicio, exports y backup, CI de deploy.

## Fuera de la v1
- Amortización automática del inmovilizado (se hará con asientos manuales).
- Nóminas.
- Adjuntos (requieren Blaze).
- **Verifactu**. Si la app emite facturas, la normativa antifraude (RD 1007/2023, obligatoria a partir de 2027) exige registros encadenados, QR y envío a la AEAT, lo que necesita backend y certificado. Opciones: implementarlo antes de la fecha o usar en la v1 la app solo para **registrar** facturas emitidas con otra herramienta homologada. Hay que decidirlo antes de usarla para facturar.

## Verificación
- **Vitest**:
  - `money.ts`, `nif.ts`.
  - `contabilizacion.ts`: cada tipo de factura genera un asiento cuadrado con las cuentas correctas, y la categoría determina la 6xx.
  - `saldos.ts`: con datos de ejemplo, el balance cuadra (activo = PN + pasivo, con el resultado incluido), y el resultado de la PyG coincide con el saldo de la 129 tras la regularización.
- **Reglas, contra el emulador**: rechazan un asiento descuadrado, un UID ajeno y escrituras en un ejercicio cerrado.
- **Playwright con emuladores**:
  1. Login.
  2. Crear categoría y proveedor con categoría por defecto.
  3. Registrar factura recibida y comprobar el asiento en el diario y en el mayor de la 6xx.
  4. Emitir factura y cobrarla.
  5. Revisar el 303 del trimestre.
  6. Cerrar el ejercicio y comprobar el asiento de apertura.
- Deploy a un canal de preview (`firebase hosting:channel:deploy`) antes de producción.
