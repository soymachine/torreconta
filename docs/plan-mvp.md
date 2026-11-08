# TorreConta: primer MVP (fases 2 a 4)

## Contexto
La fase 1 ya está en la rama `claude/jolly-mayer-w1dw6c`: login, `/autorizados`, alta de empresa con el PGC de PYMES, plan de cuentas, reglas y tests. El plan global está en `docs/plan.md`.

El usuario pide seguir sin parar hasta un primer MVP. Objetivo del MVP: **llevar la contabilidad de un ejercicio de principio a fin**. Eso significa:
- registrar facturas emitidas y recibidas, que generan el asiento automáticamente;
- registrar cobros y pagos;
- hacer asientos manuales;
- consultar diario, mayor, sumas y saldos, balance, PyG, el modelo 303 y el gasto por categoría.

**Fuera del MVP**, para después:
- cierre y apertura de ejercicio automáticos (en el MVP solo se podrá abrir el ejercicio siguiente);
- PDF con pdfmake (en el MVP se imprime con una vista HTML y `window.print()`);
- el resumen anual 390;
- Verifactu.

## Decisiones de diseño
- **Datos en memoria**: un `EjercicioProvider` se suscribe a todos los asientos, facturas, terceros y categorías del ejercicio activo, una suscripción por colección. Mayor, saldos e informes se calculan en el cliente con funciones puras. Con el volumen de una pyme de un usuario sobra, y evita índices compuestos.
- **Escrituras atómicas**: crear o editar una factura escribe en una sola `runTransaction` la factura, su asiento y el contador del ejercicio. Los contadores de asientos y facturas viven en `ejercicios/{año}`.
- **Numeración de asientos**: correlativa por ejercicio. Si se borra un asiento queda un hueco; en el MVP se acepta.
- **Numeración de facturas emitidas**: `SERIE+AÑO-0001`. Para mantener la correlatividad, solo se puede borrar la última factura.
- **Asientos generados por facturas**: no se editan desde el diario; se editan desde su factura. El campo `origen` lo controla.
- **Subcuenta de cada tercero**: se crea automáticamente con el siguiente código libre (`4300001…` para clientes, `4000001…` para proveedores y `4100001…` para acreedores), en el mismo batch que el tercero.
- **Categorías**: se precargan las 10 categorías por defecto en `inicializarEmpresa`. Las empresas ya creadas tienen un botón «Crear categorías predeterminadas» si no tienen ninguna.
- **Rutas con lazy loading** (`React.lazy`) para resolver el aviso de bundle de más de 500 kB.

## Lógica pura (`src/lib`), con tests
- `asientos.ts`
  - Tipos `Linea` y `Asiento`.
  - `validarAsiento(lineas, cuentas)`: cuadra, al menos 2 líneas, cuentas imputables, ninguna línea con debe y haber a la vez ni a cero.
  - `totales()` y `cuentasDe()`.
- `contabilizacion.ts`
  - `calcularFactura(lineas, irpfPct)`: bases y cuotas por tipo de IVA, retención y total, en céntimos con `percentOf` de `money.ts`.
  - `asientoFacturaEmitida(f, cfg)`:
    - Debe: subcuenta del cliente (total) y 473 (retención).
    - Haber: cuenta de ingreso (705 por defecto, 700 a elegir) por la base y 477 por las cuotas.
  - `asientoFacturaRecibida(f, categoria)`:
    - Debe: la cuenta 6xx de la categoría por la base (más el IVA si no es deducible) y 472 por las cuotas.
    - Haber: subcuenta del proveedor (total) y 4751 (retención).
  - `asientoCobro` y `asientoPago`: banco (572) o caja (570) contra la subcuenta del tercero.
- `saldos.ts`
  - `movimientosPorCuenta`, `mayor(cuenta)` con saldo acumulado, `sumasYSaldos(nivel)` que agrega por prefijo.
  - `balance(cuentas, asientos)`: activo, pasivo y patrimonio neto, con el resultado del ejercicio dentro del PN, y `cuadra`.
  - `pyg()`: ingresos (grupo 7) menos gastos (grupo 6) por subgrupo.
- `iva.ts`
  - `modelo303(facturas, trimestre)`: devengado por tipo (base y cuota), deducible, y el resultado a ingresar o a compensar.
  - `gastoPorCategoria(facturasRecibidas, periodo)`.
- `csv.ts`: `toCsv(filas)` con `;` como separador y BOM, para que Excel en español lo abra bien.

## Servicios (`src/services`)
| Servicio | Funciones |
|---|---|
| `asientos.ts` | `crearAsientoManual`, `actualizarAsientoManual`, `borrarAsientoManual` |
| `terceros.ts` | `crearTercero` (con su subcuenta), `actualizarTercero` |
| `categorias.ts` | CRUD, `crearPredeterminadas`, `fusionar` (reasigna las facturas y regenera sus asientos en un batch) |
| `facturas.ts` | `guardarFacturaEmitida`, `guardarFacturaRecibida` (transacción factura + asiento + contador), `borrarFactura*`, `registrarCobro` / `registrarPago`, `deshacerCobro`, `reasignarCategoria(ids, categoriaId)` |
| `ejercicios.ts` | `abrirEjercicio(año)`, `cambiarEjercicioActivo` |

`paths.ts` se amplía con las nuevas colecciones.

## Pantallas (`src/features`)
| Ruta | Contenido |
|---|---|
| `/` | **Panel**: ingresos, gastos y resultado del año; IVA del trimestre; pendiente de cobro y de pago; gasto por categoría |
| `/diario` | Lista de asientos con filtro de fechas y búsqueda; formulario de asiento manual con líneas dinámicas, autocompletado de cuenta y descuadre en vivo; export CSV |
| `/mayor` | Selector de cuenta y movimientos con saldo acumulado; enlaces al asiento y a la factura |
| `/sumas-y-saldos` | Agregado por nivel: 3 dígitos o detalle |
| `/terceros` | Clientes y proveedores con NIF validado por `nif.ts` y categoría por defecto del proveedor |
| `/categorias` | Alta con su cuenta 6xx (elegir una existente o crear subcuenta), renombrar, desactivar y fusionar |
| `/facturas-emitidas` | Lista con estado (pendiente o cobrada), formulario con líneas (concepto, cantidad, precio, % IVA), % IRPF y cuenta de ingreso; vista imprimible; cobrar o deshacer el cobro |
| `/facturas-recibidas` | Igual que las emitidas, más **categoría obligatoria** preseleccionada desde el proveedor, filtro por categoría, selección múltiple con «cambiar categoría» e IVA deducible sí o no |
| `/informes/balance`, `/informes/pyg`, `/informes/iva`, `/informes/gasto-categorias` | Informes, con selector de trimestre en IVA y de periodo en gasto por categoría; todos exportables a CSV |
| `/empresa` | Además, selector de ejercicio activo y «Abrir ejercicio N+1» |

Componentes compartidos nuevos en `src/components`: `ImporteInput` (usa `parseEuros` y `formatEuros`), `CuentaSelect` (solo cuentas imputables), `DataTable` sencilla, `Modal` y `PeriodoSelect`.

## Reglas de Firestore (`firestore.rules`)
- **`terceros`**: valida campos, tipo y subcuenta.
- **`categorias`**: valida nombre y `cuentaGasto` (empieza por 6).
- **`facturasEmitidas` y `facturasRecibidas`**:
  - totales enteros y fecha dentro de un ejercicio abierto;
  - la recibida exige `categoriaId`;
  - no se puede borrar ni modificar en un ejercicio cerrado.
- **`ejercicios`**: el update permite también `contadorFacturas`, que solo crece.
- **`asientos`**: se mantienen las validaciones actuales.

## Verificación
- `npm test`: tests nuevos de `asientos`, `contabilizacion` (cada caso de factura cuadra y usa las cuentas correctas: IVA mixto, retención, IVA no deducible, categoría que decide la 6xx), `saldos` (el balance cuadra y el resultado de la PyG coincide con el que entra en el PN), `iva` (303 de un trimestre de ejemplo) y `csv`.
- `npm run test:rules`: más casos para terceros, categorías y facturas (factura recibida sin categoría, ejercicio cerrado, usuario ajeno, contador que decrece).
- `npm run lint` y `npm run build` sin errores.
- E2E con Playwright contra los emuladores (script en el scratchpad, como en la fase 1):
  1. Alta de empresa.
  2. Cliente y proveedor con categoría por defecto.
  3. Factura emitida de 1.000 € + 21 % IVA − 15 % IRPF, y cobro.
  4. Factura recibida de 500 € + 21 % con la categoría «Suministros» preseleccionada, y pago.
  5. Asiento manual.
  6. Comprobaciones: diario con 5 asientos cuadrados, mayor de la 628, 303 del trimestre (devengado 210, deducible 105, a ingresar 105), balance cuadrado, PyG con resultado 500, y reasignación de categoría que mueve el gasto a otra 6xx.
  7. Capturas para revisión visual.
- Commits por bloques, con push a `claude/jolly-mayer-w1dw6c`, y README actualizado con el estado.
