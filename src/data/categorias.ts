/** Categorías de gasto que se crean por defecto, cada una ligada a su cuenta 6xx. */
export const CATEGORIAS_PREDETERMINADAS: { nombre: string; cuentaGasto: string; color: string }[] = [
  { nombre: 'Compras de mercaderías', cuentaGasto: '600', color: '#0ea5e9' },
  { nombre: 'Material y aprovisionamientos', cuentaGasto: '602', color: '#14b8a6' },
  { nombre: 'Alquiler', cuentaGasto: '621', color: '#8b5cf6' },
  { nombre: 'Servicios profesionales', cuentaGasto: '623', color: '#f59e0b' },
  { nombre: 'Transporte', cuentaGasto: '624', color: '#64748b' },
  { nombre: 'Seguros', cuentaGasto: '625', color: '#10b981' },
  { nombre: 'Comisiones bancarias', cuentaGasto: '626', color: '#6366f1' },
  { nombre: 'Publicidad', cuentaGasto: '627', color: '#ec4899' },
  { nombre: 'Suministros', cuentaGasto: '628', color: '#ef4444' },
  { nombre: 'Otros servicios y software', cuentaGasto: '629', color: '#84cc16' },
]
