import { NavLink, Outlet } from 'react-router-dom'
import { cerrarSesion, useAuth } from '../auth/AuthProvider'
import { useEmpresa } from '../features/empresa/EmpresaProvider'

const nav: { to: string; label: string; disponible: boolean }[] = [
  { to: '/cuentas', label: 'Plan de cuentas', disponible: true },
  { to: '/diario', label: 'Libro diario', disponible: false },
  { to: '/facturas-emitidas', label: 'Facturas emitidas', disponible: false },
  { to: '/facturas-recibidas', label: 'Facturas recibidas', disponible: false },
  { to: '/informes', label: 'Informes', disponible: false },
  { to: '/empresa', label: 'Empresa', disponible: true },
]

export function Layout() {
  const empresa = useEmpresa()
  const auth = useAuth()
  const email = auth.status === 'autorizado' ? auth.user.email : null

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <div className="text-lg font-semibold text-slate-900">TorreConta</div>
          <div className="truncate text-xs text-slate-500" title={empresa.razonSocial}>
            {empresa.razonSocial} · {empresa.ejercicioActivo}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map((item) =>
            item.disponible ? (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.to}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-400"
                title="Próximamente"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
        <div className="hidden border-t border-slate-100 px-5 py-4 md:block">
          <div className="truncate text-xs text-slate-500">{email}</div>
          <button onClick={() => cerrarSesion()} className="mt-1 text-xs text-slate-700 hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
