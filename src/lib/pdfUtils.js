import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

/**
 * buildPdfReport — shared PDF generation utility
 *
 * @param {object} opts
 * @param {string} opts.title        — bold title e.g. "Pelikn"
 * @param {string} opts.subtitle     — report name e.g. "Cleaning Records Report"
 * @param {string} [opts.venueLabel] — optional venue name shown in header
 * @param {string} opts.periodLabel  — e.g. "01/01/2025 – 31/01/2025"
 * @param {string[]} opts.columns    — table header columns
 * @param {Array[]} opts.rows        — table body rows (arrays of cell values)
 * @param {Function} [opts.didParseCell] — optional jspdf-autotable hook for custom cell styling
 * @param {string} opts.filename     — downloaded filename e.g. "cleaning-report.pdf"
 */
export function buildPdfReport({ title, subtitle, venueLabel, periodLabel, columns, rows, didParseCell, filename }) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(title, 14, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100)

  let y = 25
  doc.text(subtitle, 14, y); y += 6
  if (venueLabel) { doc.text(venueLabel, 14, y); y += 6 }
  doc.text(`Period: ${periodLabel}`, 14, y); y += 6
  doc.setTextColor(0)

  // ── Table ─────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y + 2,
    head: [columns],
    body: rows,
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    ...(didParseCell ? { didParseCell } : {}),
  })

  // ── Footer (all pages) ────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')} · Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }

  doc.save(filename)
}
