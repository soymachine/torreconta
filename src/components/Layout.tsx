import { NavLink, Outlet } from 'react-router-dom'
import { cerrarSesion, useAuth } from '../auth/AuthProvider'
import { useEmpresa } from '../features/empresa/EmpresaProvider'
import { useLibros } from '../features/libros/LibrosProvider'
import { useLogo } from '../features/empresa/useLogo'

const secciones: { titulo?: string; items: { to: string; label: string }[] }[] = [
  { items: [{ to: '/', label: 'Panel' }] },
  {
    titulo: 'Facturación',
    items: [
      { to: '/facturas-emitidas', label: 'Facturas emitidas' },
      { to: '/facturas-recibidas', label: 'Facturas recibidas' },
      { to: '/terceros', label: 'Clientes y proveedores' },
      { to: '/categorias', label: 'Categorías de gasto' },
    ],
  },
  {
    titulo: 'Contabilidad',
    items: [
      { to: '/diario', label: 'Libro diario' },
      { to: '/mayor', label: 'Libro mayor' },
      { to: '/sumas-y-saldos', label: 'Sumas y saldos' },
      { to: '/cuentas', label: 'Plan de cuentas' },
      { to: '/ejercicios/cierre', label: 'Cierre del ejercicio' },
    ],
  },
  {
    titulo: 'Informes',
    items: [
      { to: '/informes/iva', label: 'IVA (303)' },
      { to: '/informes/pyg', label: 'Pérdidas y ganancias' },
      { to: '/informes/balance', label: 'Balance' },
      { to: '/informes/gasto-categorias', label: 'Gasto por categoría' },
      { to: '/informes/347', label: 'Operaciones con terceros (347)' },
    ],
  },
  { items: [{ to: '/empresa', label: 'Empresa y ejercicios' }] },
]

export function Layout() {
  const empresa = useEmpresa()
  const { ejercicio } = useLibros()
  const logo = useLogo()
  const auth = useAuth()
  const email = auth.status === 'autorizado' ? auth.user.email : null

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row print:block print:bg-white">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r print:hidden">
        <div className="px-5 py-4">
          {logo ? (
            <NavLink to="/" className="mb-2 block" title={empresa.razonSocial}>
              <img
                src={logo.dataUrl}
                alt={`Logotipo de ${empresa.razonSocial}`}
                className="max-h-14 max-w-full object-contain object-left"
                data-testid="logo-sidebar"
              />
            </NavLink>
          ) : (
            <div className="text-lg font-semibold text-slate-900">TorreConta</div>
          )}
          <div className="truncate text-xs text-slate-500" title={empresa.razonSocial}>
            {empresa.razonSocial}
          </div>
          <div className="mt-1 text-xs">
            Ejercicio <strong>{empresa.ejercicioActivo}</strong>{' '}
            {ejercicio?.estado === 'cerrado' && <span className="text-red-700">(cerrado)</span>}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-0 md:overflow-visible">
          {secciones.map((s, i) => (
            <div key={i} className="flex gap-1 md:mb-2 md:flex-col md:gap-0.5">
              {s.titulo && <div className="hidden px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:block">{s.titulo}</div>}
              {s.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden border-t border-slate-100 px-5 py-4 md:block">
          <div className="truncate text-xs text-slate-500">{email}</div>
          <button onClick={() => cerrarSesion()} className="mt-1 text-xs text-slate-700 hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8 print:p-0">
        <Outlet />
      </main>
    </div>
  )
}
