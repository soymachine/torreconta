/**
 * Listado compacto de clientes y proveedores en PDF, generado en el
 * navegador. jsPDF se carga solo al exportar para no engordar la app.
 */
import { formatEuros } from '../../lib/money'
import type { Logo } from '../../lib/logo'
import type { Tercero } from '../../lib/tipos'

export interface FilaPdfTercero {
  tercero: Tercero
  categoria: string
  saldoCent: number
}

export interface DatosPdfTerceros {
  empresa: { razonSocial: string; nif: string }
  anio: number
  filtro: string
  filas: FilaPdfTercero[]
  logo: Logo | null
}

const TIPO: Record<Tercero['tipo'], string> = { cliente: 'Cliente', proveedor: 'Proveedor', acreedor: 'Acreedor' }

// Las fuentes estándar del PDF no tienen el espacio fino que usa Intl en algunos formatos.
const limpio = (t: string) => t.replace(/[  ]/g, ' ')

/** jsPDF no admite WebP en todos los visores: se convierte el logo a PNG. */
async function logoPng(logo: Logo): Promise<string | null> {
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

export function nombreArchivoPdf(filtro: string, fecha = new Date()): string {
  const f = fecha.toISOString().slice(0, 10)
  const sufijo = filtro.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `terceros-${sufijo || 'todos'}-${f}.pdf`
}

export async function exportarTercerosPdf(d: DatosPdfTerceros): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const margen = 12
  let y = margen

  if (d.logo) {
    const png = await logoPng(d.logo)
    if (png) {
      const alto = 12
      const anchoLogo = Math.min(50, (d.logo.ancho / d.logo.alto) * alto)
      doc.addImage(png, 'PNG', margen, y, anchoLogo, alto)
      y += alto + 3
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(14).text('Clientes y proveedores', margen, y + 4)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90)
  const generado = new Date().toLocaleDateString('es-ES')
  doc.text(`${d.empresa.razonSocial} · NIF ${d.empresa.nif}`, margen, y + 9)
  doc.text(`${d.filtro} · ${d.filas.length} registros · saldos del ejercicio ${d.anio} · generado el ${generado}`, margen, y + 13)
  doc.setTextColor(0)

  autoTable(doc, {
    startY: y + 17,
    margin: { left: margen, right: margen, bottom: 14 },
    head: [['Nombre', 'NIF', 'Tipo', 'Subcuenta', 'Categoría por defecto', 'Saldo']],
    body: d.filas.map((f) => [
      f.tercero.nombre + (f.tercero.activo ? '' : ' (inactivo)'),
      f.tercero.nif,
      TIPO[f.tercero.tipo],
      f.tercero.cuenta,
      f.categoria,
      limpio(formatEuros(f.saldoCent)),
    ]),
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, overflow: 'ellipsize' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 38 },
      5: { cellWidth: 26, halign: 'right' },
    },
    didParseCell: (c) => {
      if (c.section === 'head' && c.column.index === 5) c.cell.styles.halign = 'right'
    },
  })

  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5).setTextColor(120)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, doc.internal.pageSize.getHeight() - 7, { align: 'right' })
    doc.text('TorreConta', margen, doc.internal.pageSize.getHeight() - 7)
  }
  doc.save(nombreArchivoPdf(d.filtro))
}
