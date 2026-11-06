import test from 'node:test'
import assert from 'node:assert/strict'
import { refundTimeRange, jakartaDate, netOmset } from '../src/lib/cashLedger.js'

test('refund masuk ke tanggal Jakarta dan mengurangi kas pada hari refund', () => {
  const range = refundTimeRange('2026-10-26', '2026-10-26')
  assert.equal(range.from, '2026-10-25T17:00:00.000Z')
  assert.equal(range.through, '2026-10-26T17:00:00.000Z')
  assert.equal(jakartaDate('2026-10-25T18:00:00.000Z'), '2026-10-26')
  assert.equal(netOmset([{ total_omset: 50000 }], [{ total_omset: 20000 }]), 30000)
})
