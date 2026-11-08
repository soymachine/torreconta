import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, cerrarSesion, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { Layout } from './components/Layout'
import { Alert, Button, Card, Spinner } from './components/ui'
import { EmpresaProvider, useEmpresaState } from './features/empresa/EmpresaProvider'
import { SetupPage } from './features/empresa/SetupPage'
import { LibrosProvider } from './features/libros/LibrosProvider'

// Cada pantalla se carga bajo demanda para que el bundle inicial sea ligero.
const lazyPage = <K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })))

const PanelPage = lazyPage(() => import('./features/panel/PanelPage'), 'PanelPage')
const CuentasPage = lazyPage(() => import('./features/cuentas/CuentasPage'), 'CuentasPage')
const EmpresaPage = lazyPage(() => import('./features/empresa/EmpresaPage'), 'EmpresaPage')
const DiarioPage = lazyPage(() => import('./features/diario/DiarioPage'), 'DiarioPage')
const MayorPage = lazyPage(() => import('./features/mayor/MayorPage'), 'MayorPage')
const SumasSaldosPage = lazyPage(() => import('./features/mayor/SumasSaldosPage'), 'SumasSaldosPage')
const TercerosPage = lazyPage(() => import('./features/terceros/TercerosPage'), 'TercerosPage')
const CategoriasPage = lazyPage(() => import('./features/categorias/CategoriasPage'), 'CategoriasPage')
const FacturasEmitidasPage = lazyPage(() => import('./features/facturas/FacturasEmitidasPage'), 'FacturasEmitidasPage')
const FacturasRecibidasPage = lazyPage(() => import('./features/facturas/FacturasRecibidasPage'), 'FacturasRecibidasPage')
const ImprimirFactura = lazyPage(() => import('./features/facturas/ImprimirFactura'), 'ImprimirFactura')
const BalancePage = lazyPage(() => import('./features/informes/BalancePage'), 'BalancePage')
const PygPage = lazyPage(() => import('./features/informes/PygPage'), 'PygPage')
const IvaPage = lazyPage(() => import('./features/informes/IvaPage'), 'IvaPage')
const GastoCategoriasPage = lazyPage(() => import('./features/informes/GastoCategoriasPage'), 'GastoCategoriasPage')

function NoAutorizado({ email }: { email: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="max-w-md space-y-4">
        <h1 className="text-lg font-semibold">Acceso no autorizado</h1>
        <p className="text-sm text-slate-600">
          La cuenta {email ?? ''} no tiene permiso para usar esta aplicación.
        </p>
        <Button variant="secondary" onClick={() => cerrarSesion()}>
          Cerrar sesión
        </Button>
      </Card>
    </main>
  )
}

function AppAutorizada() {
  const state = useEmpresaState()
  if (state.status === 'cargando') return <Spinner />
  if (state.status === 'error')
    return (
      <div className="p-8">
        <Alert>Error al cargar la empresa: {state.error.message}</Alert>
      </div>
    )
  if (state.status === 'sin-configurar') return <SetupPage />
  return (
    <LibrosProvider key={state.empresa.ejercicioActivo}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<PanelPage />} />
            <Route path="/facturas-emitidas" element={<FacturasEmitidasPage />} />
            <Route path="/facturas-emitidas/:id/imprimir" element={<ImprimirFactura />} />
            <Route path="/facturas-recibidas" element={<FacturasRecibidasPage />} />
            <Route path="/terceros" element={<TercerosPage />} />
            <Route path="/categorias" element={<CategoriasPage />} />
            <Route path="/diario" element={<DiarioPage />} />
            <Route path="/mayor" element={<MayorPage />} />
            <Route path="/sumas-y-saldos" element={<SumasSaldosPage />} />
            <Route path="/cuentas" element={<CuentasPage />} />
            <Route path="/informes/iva" element={<IvaPage />} />
            <Route path="/informes/pyg" element={<PygPage />} />
            <Route path="/informes/balance" element={<BalancePage />} />
            <Route path="/informes/gasto-categorias" element={<GastoCategoriasPage />} />
            <Route path="/empresa" element={<EmpresaPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </LibrosProvider>
  )
}

function Root() {
  const auth = useAuth()
  switch (auth.status) {
    case 'cargando':
      return <Spinner />
    case 'anonimo':
      return <LoginPage />
    case 'no-autorizado':
      return <NoAutorizado email={auth.user.email} />
    case 'autorizado':
      return (
        <EmpresaProvider>
          <AppAutorizada />
        </EmpresaProvider>
      )
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AuthProvider>
  )
}
