import assert from 'node:assert/strict';
import test from 'node:test';
import { salesPdf } from '../server/pdf.js';

test('sales PDFs are valid PDF documents', async () => {
  const pdf = await salesPdf({
    title: 'Invoice', number: 'EMB-0001', recipient: 'Example Team',
    lines: [{ description: 'Garment', quantity: 100, unit_price_pence: 1250, line_total_pence: 125000 }], totalPence: 125000,
  });
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
});
