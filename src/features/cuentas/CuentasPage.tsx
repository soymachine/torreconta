import { useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Alert, Button, Card, Input, Select } from '../../components/base'
import { esImputable, GRUPOS, type Cuenta } from '../../lib/cuentas'
import { actualizarCuenta } from '../../services/cuentas'
import { NuevaCuenta } from './NuevaCuenta'
import { useLibros } from '../libros/LibrosProvider'

const naturalezaLabel: Record<Cuenta['naturaleza'], string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  patrimonio: 'Patrimonio neto',
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  mixta: 'Mixta',
}

export function CuentasPage() {
  const eid = useEmpresaId()
  const { cuentas } = useLibros()
  const [busqueda, setBusqueda] = useState('')
  const [grupo, setGrupo] = useState('')
  const [verInactivas, setVerInactivas] = useState(false)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<{ codigo: string; nombre: string } | null>(null)
  const [opError, setOpError] = useState<string | null>(null)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return cuentas.filter(
      (c) =>
        (verInactivas || c.activa) &&
        (!grupo || c.codigo.startsWith(grupo)) &&
        (!q || c.codigo.startsWith(q) || c.nombre.toLowerCase().includes(q)),
    )
  }, [cuentas, busqueda, grupo, verInactivas])


  const guardarNombre = async () => {
    if (!editando) return
    const nombre = editando.nombre.trim()
    if (nombre.length < 2) return setOpError('El nombre es demasiado corto.')
    try {
      await actualizarCuenta(eid, editando.codigo, { nombre })
      setEditando(null)
      setOpError(null)
    } catch {
      setOpError('No se ha podido renombrar la cuenta.')
    }
  }

  const toggleActiva = async (c: Cuenta) => {
    try {
      await actualizarCuenta(eid, c.codigo, { activa: !c.activa })
    } catch {
      setOpError('No se ha podido cambiar el estado de la cuenta.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Plan de cuentas</h1>
        <Button onClick={() => setCreando((v) => !v)} variant={creando ? 'secondary' : 'primary'}>
          {creando ? 'Cancelar' : 'Nueva cuenta o subcuenta'}
        </Button>
      </div>

      {creando && (
        <Card>
          <NuevaCuenta cuentas={cuentas} onDone={() => setCreando(false)} />
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por código o nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
          aria-label="Buscar cuenta"
        />
        <Select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="max-w-xs" aria-label="Grupo">
          <option value="">Todos los grupos</option>
          {Object.entries(GRUPOS).map(([g, nombre]) => (
            <option key={g} value={g}>
              {g} · {nombre}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Checkbox checked={verInactivas} onCheckedChange={(v) => setVerInactivas(v === true)} />
          Mostrar inactivas
        </label>
      </div>

      {opError && <Alert>{opError}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Naturaleza</th>
              <th className="px-4 py-2">Apuntes</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => {
              const nivel = Math.min(c.codigo.length, 4) - 1
              const cabecera = c.codigo.length <= 2
              return (
                <tr key={c.codigo} className={`border-t border-slate-100 ${c.activa ? '' : 'text-slate-400'}`}>
                  <td className={`px-4 py-2 font-mono ${cabecera ? 'font-semibold' : ''}`}>{c.codigo}</td>
                  <td className="px-4 py-2" style={{ paddingLeft: `${1 + nivel * 1}rem` }}>
                    {editando?.codigo === c.codigo ? (
                      <div className="flex gap-2">
                        <Input
                          value={editando.nombre}
                          onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardarNombre()
                            if (e.key === 'Escape') setEditando(null)
                          }}
                          autoFocus
                          aria-label={`Nombre de la cuenta ${c.codigo}`}
                        />
                        <Button variant="secondary" onClick={guardarNombre}>
                          Guardar
                        </Button>
                      </div>
                    ) : (
                      <span className={cabecera ? 'font-semibold' : ''}>{c.nombre}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{naturalezaLabel[c.naturaleza]}</td>
                  <td className="px-4 py-2">
                    {esImputable(c, cuentas) && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Imputable</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" onClick={() => setEditando({ codigo: c.codigo, nombre: c.nombre })}>
                      Renombrar
                    </Button>
                    {c.codigo.length >= 3 && (
                      <Button variant="ghost" onClick={() => toggleActiva(c)}>
                        {c.activa ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay cuentas que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Los apuntes solo pueden ir a cuentas «imputables»: de 3 o más dígitos y sin subcuentas por debajo.
      </p>
    </div>
  )
}
