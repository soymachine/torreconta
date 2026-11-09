/** PDF imprimible con los datos del modelo 347, para cumplimentar la declaración. */
import { centsCsv } from '../../lib/csv'
import type { Logo } from '../../lib/logo'
import type { Fila347, Resultado347 } from '../../lib/modelo347'
import { dibujarLogo, piePaginas, textoPdf } from '../../lib/pdf'

const imp = (c: number) => {
  // 1.234,56 con separador de miles, fácil de transcribir.
  const [e, dec] = centsCsv(c).split(',')
  const neg = e.startsWith('-')
  const miles = (neg ? e.slice(1) : e).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg ? '-' : ''}${miles},${dec}`
}

export async function exportar347Pdf(d: {
  anio: number
  empresa: { razonSocial: string; nif: string }
  logo: Logo | null
  resultado: Resultado347
  filas: Fila347[]
  incluirConRetencion: boolean
  incluyeNoDeclarados: boolean
}) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margen = 12
  let y = await dibujarLogo(doc, d.logo, margen, margen)

  doc.setFont('helvetica', 'bold').setFontSize(14).text(`Modelo 347 · Ejercicio ${d.anio}`, margen, y + 4)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(70)
  doc.text('Declaración anual de operaciones con terceros (importes superiores a 3.005,06 €, IVA incluido)', margen, y + 9)
  doc.text(textoPdf(`Declarante: ${d.empresa.razonSocial} · NIF ${d.empresa.nif}`), margen, y + 13.5)
  const { A, B } = d.resultado.totales
  doc.text(
    `Resumen: ${A.declarados + B.declarados} declarados · Clave A (adquisiciones): ${A.declarados} por ${imp(A.importeCent)} € · Clave B (entregas): ${B.declarados} por ${imp(B.importeCent)} €`,
    margen,
    y + 18,
  )
  doc.setTextColor(0)
  y += 22

  const tabla = (titulo: string, filas: Fila347[]) => {
    doc.setFont('helvetica', 'bold').setFontSize(10.5).text(titulo, margen, y + 4)
    const total = (i: number | 'total' | 'metalico') =>
      filas.reduce((s, f) => s + (i === 'total' ? f.totalCent : i === 'metalico' ? f.metalicoCent : f.trimestres[i]), 0)
    autoTable(doc, {
      startY: y + 6,
      margin: { left: margen, right: margen, bottom: 14 },
      head: [['NIF', 'Nombre o razón social', 'Prov.', '1T', '2T', '3T', '4T', 'Total anual', 'Metálico', 'Avisos']],
      body: filas.length
        ? filas.map((f) => [
            f.nif || '—',
            f.nombre,
            f.provincia ?? '—',
            imp(f.trimestres[0]),
            imp(f.trimestres[1]),
            imp(f.trimestres[2]),
            imp(f.trimestres[3]),
            imp(f.totalCent),
            f.metalicoCent ? imp(f.metalicoCent) : '',
            f.avisos.join('; '),
          ])
        : [['', 'Sin operaciones que declarar', '', '', '', '', '', '', '', '']],
      foot: filas.length
        ? [['', `Total (${filas.length})`, '', imp(total(0)), imp(total(1)), imp(total(2)), imp(total(3)), imp(total('total')), imp(total('metalico')), '']]
        : undefined,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, lineColor: [210, 214, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 24, font: 'courier' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 11, halign: 'center' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 22, halign: 'right' },
        9: { cellWidth: 45, fontSize: 7, textColor: [180, 83, 9] },
      },
      didParseCell: (c) => {
        if (c.section !== 'body' && c.column.index >= 3 && c.column.index <= 8) c.cell.styles.halign = 'right'
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
  }

  tabla('Clave B · Entregas de bienes y prestaciones de servicios (clientes)', d.filas.filter((f) => f.clave === 'B'))
  tabla('Clave A · Adquisiciones de bienes y servicios (proveedores y acreedores)', d.filas.filter((f) => f.clave === 'A'))

  const notas = [
    'Importes en euros con IVA incluido y sin descontar retenciones, agrupados por la fecha de la factura (trimestre de devengo).',
    d.incluirConRetencion
      ? 'Se han incluido las facturas recibidas con retención de IRPF.'
      : 'No se incluyen las facturas recibidas con retención de IRPF (profesionales): se declaran en el modelo 190.',
    'Metálico: cobros registrados en caja (cuenta 570) durante el año; se declaran si superan 6.000 € con un mismo cliente.',
    'Provincia: dos primeros dígitos del código postal del domicilio del tercero.',
    d.incluyeNoDeclarados ? 'Este listado incluye también terceros que no superan el umbral (solo para revisión).' : '',
    'Documento orientativo generado por TorreConta. Revise los datos antes de presentar la declaración (plazo: mes de febrero).',
  ].filter(Boolean)
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    y = margen
  }
  doc.setFont('helvetica', 'bold').setFontSize(8.5).text('Notas', margen, y)
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(70)
  notas.forEach((n, i) => doc.text(`• ${n}`, margen, y + 4.5 + i * 4))
  doc.setTextColor(0)

  piePaginas(doc, margen)
  doc.save(`modelo-347-${d.anio}.pdf`)
}
