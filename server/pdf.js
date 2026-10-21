// Deliberately small shared PDF renderer: the database remains the source of every amount.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const money = (pence) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(pence) / 100);

export async function salesPdf({ title, number, recipient, lines, totalPence, note }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const write = (text, x, y, options = {}) => page.drawText(String(text), { x, y, size: options.size ?? 10, font: options.bold ? bold : font, color: rgb(0.08, 0.12, 0.18) });
  write('EMBLARA', 48, 790, { bold: true, size: 19 }); write(title, 48, 755, { bold: true, size: 15 }); write(number, 470, 755, { bold: true });
  write(recipient, 48, 720); let y = 670;
  for (const line of lines) { write(line.description, 48, y); write(`${line.quantity} × ${money(line.unit_price_pence)}`, 340, y); write(money(line.line_total_pence), 485, y); y -= 22; }
  page.drawLine({ start: { x: 48, y: y - 4 }, end: { x: 547, y: y - 4 }, thickness: 1, color: rgb(0.65, 0.45, 0.26) }); write('Total', 400, y - 26, { bold: true }); write(money(totalPence), 485, y - 26, { bold: true });
  if (note) write(note, 48, Math.max(72, y - 80), { size: 9 });
  return Buffer.from(await doc.save());
}
