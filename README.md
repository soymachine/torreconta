# TorreConta

Contabilidad web de partida doble (PGC de PYMES) para una pequeña empresa con un solo usuario.
Stack: **Vite + React + TypeScript**, **Tailwind CSS**, **Firebase** (Authentication, Firestore y Hosting) en el plan gratuito Spark.

El plan completo está en [`docs/plan.md`](docs/plan.md).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Scaffolding, login, reglas de seguridad, alta de empresa con el PGC de PYMES y plan de cuentas | ✅ |
| 2 | Libro diario (asientos manuales), mayor y sumas y saldos | Pendiente |
| 3 | Terceros, categorías de compras, facturas emitidas y recibidas con asiento automático, cobros y pagos | Pendiente |
| 4 | Modelos 303 y 390, libros registro, balance, PyG y gasto por categoría | Pendiente |
| 5 | Cierre y apertura de ejercicio, exportaciones y copia de seguridad | Pendiente |

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
npm test                   # unitarios: importes, NIF, plan de cuentas
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
