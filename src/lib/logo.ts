/** Reglas del logotipo de la empresa (sin dependencias del navegador). */

export const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const
export const MAX_BYTES_ORIGEN = 5 * 1024 * 1024
export const MAX_LADO = 512
/** Límite del dataURL guardado (las reglas de Firestore usan el mismo). */
export const MAX_DATAURL = 700_000

export interface Logo {
  dataUrl: string
  ancho: number
  alto: number
}

export function validarArchivoLogo(f: { type: string; size: number }): string | null {
  if (!(TIPOS_LOGO as readonly string[]).includes(f.type)) return 'El logotipo debe ser una imagen PNG, JPG, WebP o SVG.'
  if (f.size > MAX_BYTES_ORIGEN) return 'La imagen pesa más de 5 MB.'
  if (f.size === 0) return 'El archivo está vacío.'
  return null
}

/** Tamaño final manteniendo la proporción; nunca amplía imágenes pequeñas. */
export function dimensionesAjustadas(ancho: number, alto: number, max = MAX_LADO): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0)) throw new Error('No se han podido leer las dimensiones de la imagen.')
  const escala = Math.min(1, max / Math.max(ancho, alto))
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) }
}

export function dataUrlValido(d: string): boolean {
  return /^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(d) && d.length <= MAX_DATAURL
}
