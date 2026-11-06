import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPosWorkflowSchema } from '../src/lib/posSchema.js'

test('skema lama dikenali agar laporan dapat memakai kueri kompatibel', async () => {
  const client = { from: () => ({ select: () => ({ limit: async () => ({ error: {
    code: '42703', message: 'column transaksi.payment_status does not exist',
  } }) }) }) }
  assert.equal(await hasPosWorkflowSchema(client), false)
})

test('error lain tidak disamarkan sebagai skema lama', async () => {
  const issue = { code: '42501', message: 'permission denied' }
  const client = { from: () => ({ select: () => ({ limit: async () => ({ error: issue }) }) }) }
  await assert.rejects(hasPosWorkflowSchema(client), error => error === issue)
})
