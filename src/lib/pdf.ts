/** Utilidades comunes para los PDF generados con jsPDF (solo navegador). */
import type { jsPDF } from 'jspdf'
import type { Logo } from './logo'

// Las fuentes estándar del PDF no tienen el espacio fino que usa Intl en algunos formatos.
export const textoPdf = (t: string) => t.replace(/[  ]/g, ' ')

/** jsPDF no admite WebP en todos los visores: se convierte el logo a PNG. */
export async function logoPng(logo: Logo): Promise<string | null> {
  try {
    const img = new Image()
    img.src = logo.dataUrl
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}

/** Dibuja el logo arriba a la izquierda y devuelve la nueva posición vertical. */
export async function dibujarLogo(doc: jsPDF, logo: Logo | null, x: number, y: number, alto = 12): Promise<number> {
  if (!logo) return y
  const png = await logoPng(logo)
  if (!png) return y
  doc.addImage(png, 'PNG', x, y, Math.min(50, (logo.ancho / logo.alto) * alto), alto)
  return y + alto + 3
}

export function piePaginas(doc: jsPDF, margen: number) {
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5).setTextColor(120)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 7, { align: 'right' })
    doc.text('TorreConta', margen, alto - 7)
  }
  doc.setTextColor(0)
}
