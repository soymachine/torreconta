/**
 * Listado de vencimientos de pago en PDF, generado en el navegador.
 * jsPDF se carga solo al exportar.
 */
import { formatEuros } from '../../lib/money'
import type { Logo } from '../../lib/logo'
import { dibujarLogo, piePaginas, textoPdf as limpio } from '../../lib/pdf'
import type { FacturaRecibida } from '../../lib/tipos'
import type { FilaVencimiento } from '../../lib/vencimientos'

export interface DatosPdfVencimientos {
  empresa: { razonSocial: string; nif: string }
  desde: string
  hasta: string
  soloPendientes: boolean
  filas: FilaVencimiento<FacturaRecibida>[]
  vencidas: { numero: number; totalCent: number }
  logo: Logo | null
}

const fecha = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

export function situacion(dias: number, pagada: boolean): string {
  if (pagada) return 'Pagada'
  if (dias < 0) return `Vencida hace ${-dias} ${dias === -1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export async function exportarVencimientosPdf(d: DatosPdfVencimientos): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margen = 12
  let y = margen
  y = await dibujarLogo(doc, d.logo, margen, y)

  const periodo = d.desde ? `del ${fecha(d.desde)} al ${fecha(d.hasta)}` : `hasta el ${fecha(d.hasta)}`
  doc.setFont('helvetica', 'bold').setFontSize(14).text('Vencimientos de pago', margen, y + 4)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90)
  doc.text(`${d.empresa.razonSocial} · NIF ${d.empresa.nif}`, margen, y + 9)
  doc.text(
    `Facturas recibidas que vencen ${periodo} · ${d.soloPendientes ? 'solo pendientes' : 'pendientes y pagadas'} · generado el ${new Date().toLocaleDateString('es-ES')}`,
    margen,
    y + 13,
  )
  doc.setTextColor(0)

  const pendientes = d.filas.filter((r) => r.factura.estado === 'pendiente')
  const totalPendiente = pendientes.reduce((s, r) => s + r.factura.totalCent, 0)

  autoTable(doc, {
    startY: y + 17,
    margin: { left: margen, right: margen, bottom: 14 },
    head: [['Vencimiento', 'Situación', 'Proveedor', 'Nº factura', 'Fecha fra.', 'Total']],
    body: d.filas.map((r) => [
      fecha(r.vencimiento),
      situacion(r.dias, r.factura.estado === 'pagada'),
      r.factura.terceroNombre,
      r.factura.numero,
      fecha(r.factura.fecha),
      limpio(formatEuros(r.factura.totalCent)),
    ]),
    foot: [[{ content: `Pendiente de pago en el periodo (${pendientes.length})`, colSpan: 5 }, limpio(formatEuros(totalPendiente))]],
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, overflow: 'ellipsize' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28 },
      4: { cellWidth: 20 },
      5: { cellWidth: 24, halign: 'right' },
    },
    didParseCell: (c) => {
      if ((c.section === 'head' || c.section === 'foot') && c.column.index === 5) c.cell.styles.halign = 'right'
      if (c.section === 'body' && c.column.index === 1 && String(c.cell.raw).startsWith('Vencida')) c.cell.styles.textColor = [180, 83, 9]
    },
  })

  if (d.vencidas.numero > 0) {
    const yFin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    doc.setFontSize(8.5).setTextColor(180, 83, 9)
    doc.text(`Vencidas sin pagar (cualquier fecha): ${d.vencidas.numero} facturas · ${limpio(formatEuros(d.vencidas.totalCent))}`, margen, yFin)
    doc.setTextColor(0)
  }

  piePaginas(doc, margen)
  doc.save(`vencimientos-${d.desde || 'inicio'}-${d.hasta}.pdf`)
}
