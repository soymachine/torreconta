# TorreConta: cierre y apertura de ejercicio

## Contexto
El MVP ya está en `claude/jolly-mayer-w1dw6c`. Hoy un ejercicio solo se puede abrir: el año siguiente no recibe los saldos y no hay forma de cerrar. El usuario pide el cierre y la apertura.

**Objetivo**: un asistente que, para el ejercicio N, haga lo siguiente:
1. Compruebe que todo está en orden.
2. Opcionalmente contabilice el impuesto sobre sociedades.
3. Genere los asientos de **regularización** (grupos 6 y 7 contra la 129) y de **cierre**, ambos a 31/12/N.
4. Genere el asiento de **apertura** a 01/01/N+1.
5. Bloquee N y active N+1.
6. Permita **reabrir** el ejercicio si hubo un error.

Como paso previo necesario, se añade la **liquidación trimestral de IVA** (477/472 contra 4750/4700). Sin ella, el cierre arrastraría todo el IVA del año en 472 y 477.

## Lógica pura (`src/lib`), con tests
- **`asientos.ts`**:
  - Nuevos orígenes: `liquidacion-iva`, `impuesto-sociedades`, `regularizacion`, `cierre` y `apertura`, con sus etiquetas.
  - `ordenarAsientos` desempata a igual fecha por prioridad de origen: apertura, normales, liquidación de IVA e impuesto, regularización y, el último, cierre. Así «Renumerar por fecha» deja la apertura como nº 1 y el cierre como el último.
  - `validarAsiento` admite la opción `{ sistema: true }`, que solo exige el cuadre y no que las cuentas sean imputables. Una cuenta con movimientos antiguos que luego recibió subcuentas debe poder cerrarse.
- **`cierre.ts`** (nuevo):
  - `saldosHasta(asientos, fecha?)`: saldo por cuenta, reutilizando `sumasPorCuenta` de `saldos.ts`.
  - `asientoImpuestoSociedades(importeCent, saldo473, anio)`:
    - Debe: 630 por el impuesto.
    - Haber: 473 por los pagos a cuenta y retenciones, hasta su saldo.
    - La diferencia va al Haber de la 4752 (a pagar) o al Debe de la 4709 (a devolver).
  - `asientoRegularizacion(asientos, anio)`: cada cuenta de los grupos 6 y 7 con saldo, contra la 129. Devuelve `null` si no hay ninguna.
  - `asientoCierre(asientos, anio)`: todas las cuentas de los grupos 1 a 5 con saldo, la 129 incluida, al lado contrario. Se calcula después de la regularización.
  - `asientoApertura(cierre, anio + 1)`: las mismas líneas invertidas, a 01/01.
  - `comprobacionesCierre(...)` devuelve una lista de `{ nivel: 'error' | 'aviso' | 'ok', texto, enlace }`:
    - **error**: hay asientos descuadrados; el diario no está en orden cronológico (se ofrece renumerar); ya existe un asiento de cierre.
    - **aviso**: las 472 o 477 tienen saldo (IVA sin liquidar); hay facturas pendientes de cobro o de pago (es solo informativo, sus saldos pasan a N+1); no se ha contabilizado el impuesto.
- **`iva.ts`**: `asientoLiquidacionIva(asientos, anio, trimestre)`.
  - Toma los saldos acumulados de 477 y 472 hasta el último día del trimestre, lo que se autocorrige con las liquidaciones previas.
  - Líneas: Debe 477 y Haber 472. La diferencia va al Haber de la 4750 (a ingresar) o al Debe de la 4700 (a compensar).
  - La fecha es el último día del trimestre y el `origenId` es `iva-AAAA-T`, para evitar duplicados.
- **`saldos.ts`**: `paraInformes(asientos)` excluye la regularización y el cierre. Así la PyG, el balance y las sumas y saldos de un ejercicio cerrado siguen mostrando sus cifras reales y no ceros. El mayor y el diario muestran todo.

## Servicios
- **`services/cierre.ts`** (nuevo)
  - `cerrarEjercicio(uid, anio, { impuestoCent, activarSiguiente }, datos)`:
    1. Si N+1 no existe, `abrirEjercicio(N+1)` en una escritura previa. Las reglas comprueban con `get()` el estado anterior a la transacción, así que N+1 debe existir antes.
    2. Una `runTransaction` que:
       - lee N y N+1;
       - comprueba que N está abierto y que no hay ya un cierre;
       - crea los asientos de impuesto (si lo hay), regularización y cierre en N, y el de apertura en N+1, con `origenId` igual a `cierre-N`;
       - actualiza los contadores;
       - pone N como `cerrado`;
       - y, si se pide, pone `ejercicioActivo` igual a N+1.
  - `reabrirEjercicio(uid, anio)` en dos pasos idempotentes:
    1. Pone N como `abierto`.
    2. Una transacción borra los asientos de regularización y cierre de N y el de apertura de N+1 (localizados por `origenId`), y ajusta los contadores.

    Si el segundo paso falla, el asistente detecta que «N está abierto pero tiene asientos de cierre» y ofrece terminar la operación. El asiento del impuesto se conserva: es un asiento normal que el usuario puede borrar.
  - `contabilizarLiquidacionIva(uid, anio, t, asientos, cuentas)` crea el asiento en una transacción con el contador y rechaza el duplicado (mismo `origenId`).
- **`services/asientos.ts`**: `borrarAsientoManual` permite también borrar los asientos `liquidacion-iva` e `impuesto-sociedades`. El resto de asientos de sistema no se borra desde el diario.

## Reglas de Firestore
- **`ejercicios`**: se permite pasar de `cerrado` a `abierto` si solo cambia `estado`, para poder reabrir.
- **`asientos`**: el límite de `lineas` sube de 200 a 1000, porque el cierre de una empresa con muchas subcuentas puede superar 200.

## Interfaz
- **`/ejercicios/cierre`** (`src/features/ejercicios/CierrePage.tsx`), enlazada desde «Empresa y ejercicios» y desde el menú. Pasos:
  1. **Comprobaciones**: lista con iconos y botones de acción (renumerar el diario, ir a liquidar el IVA, ver las pendientes). Si hay algún error, no se puede cerrar.
  2. **Impuesto sobre sociedades** (opcional): campo de importe, con una sugerencia del 25 % del resultado positivo marcada como orientativa, y vista previa del asiento.
  3. **Vista previa** de la regularización, el cierre y la apertura en tablas plegables, con el resultado del ejercicio destacado.
  4. **Confirmación**: casilla «Entiendo que el ejercicio N quedará bloqueado» y casilla «Pasar a trabajar en N+1», marcada por defecto. Botón «Cerrar ejercicio N».
  5. Si N ya está cerrado: un resumen con enlaces a los asientos y el botón «Reabrir ejercicio N», con confirmación. Se avisa de que se borrará la apertura de N+1.
- **`IvaPage`**: botón «Contabilizar liquidación del trimestre» con vista previa. Si ya existe, muestra «Liquidado (asiento nº X)».
- **`DiarioPage`**: insignias para los nuevos orígenes; «Borrar» para las liquidaciones y el asiento del impuesto.
- **`BalancePage`, `PygPage`, `SumasSaldosPage` y `PanelPage`**: usan `paraInformes(asientos)`. En un ejercicio cerrado muestran la insignia «Ejercicio cerrado».
- **«Empresa y ejercicios»**: en cada ejercicio abierto, el enlace «Cerrar…»; en cada uno cerrado, «Ver cierre / reabrir».

## Verificación
- **`npm test`**:
  - `cierre.test.ts`:
    - con el escenario del MVP, la regularización lleva 6 y 7 a cero y abona 500 a la 129;
    - el cierre deja todas las cuentas a cero;
    - la apertura reproduce el balance;
    - el balance de N+1 con solo la apertura es igual al balance final de N;
    - el impuesto con retenciones mayores o menores que la cuota (4752 o 4709);
    - un ejercicio sin movimientos devuelve `null`;
    - las comprobaciones detectan el diario desordenado y el IVA sin liquidar.
  - `iva.test.ts`: liquidación a ingresar y a compensar, y una segunda liquidación tras la primera que solo recoge lo nuevo.
  - `asientos`: el orden de prioridad de los orígenes.
- **`npm run test:rules`**: reabrir solo cambiando `estado`; un asiento con 500 líneas cuadrado se acepta; cerrado→abierto con otros campos se rechaza.
- **`npm run lint` y `npm run build`.**
- **E2E con Playwright contra los emuladores** (sobre el escenario del MVP):
  1. Liquidar el IVA del 4T: la 4750 queda con 105.
  2. Abrir el cierre: las comprobaciones salen bien tras renumerar.
  3. Impuesto de 125 €.
  4. Cerrar 2026: 2026 queda cerrado y «Nuevo asiento» deshabilitado al volver a 2026.
  5. 2027 queda activo, con la apertura como asiento nº 1, la 572 a 3.455 y el balance de 2027 igual al de 2026.
  6. La PyG de 2026 sigue mostrando un resultado de 375 (500 menos 125).
  7. Cobrar en 2027 una factura de 2026 pendiente.
  8. Reabrir 2026: desaparecen la apertura de 2027 y el cierre de 2026.
  9. Capturas de pantalla para revisión.
- Commit y push a `claude/jolly-mayer-w1dw6c`; README actualizado (fase 5 parcial).
