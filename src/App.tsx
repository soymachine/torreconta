import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, cerrarSesion, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { Layout } from './components/Layout'
import { Alert, Button, Card, Spinner } from './components/ui'
import { CuentasPage } from './features/cuentas/CuentasPage'
import { EmpresaPage } from './features/empresa/EmpresaPage'
import { EmpresaProvider, useEmpresaState } from './features/empresa/EmpresaProvider'
import { SetupPage } from './features/empresa/SetupPage'

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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/cuentas" element={<CuentasPage />} />
        <Route path="/empresa" element={<EmpresaPage />} />
        <Route path="*" element={<Navigate to="/cuentas" replace />} />
      </Route>
    </Routes>
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
