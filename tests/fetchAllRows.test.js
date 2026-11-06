import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchAllRows } from '../src/lib/fetchAllRows.js'

test('rekap mengambil seluruh halaman, bukan hanya respons pertama', async () => {
  const calls = []
  const data = [1, 2, 3, 4, 5]
  const rows = await fetchAllRows(() => ({
    range: async (from, to) => {
      calls.push([from, to])
      return { data: data.slice(from, to + 1), error: null }
    },
  }), 2)
  assert.deepEqual(rows, data)
  assert.deepEqual(calls, [[0, 1], [2, 3], [4, 5]])
})

test('error di halaman berikutnya menghentikan rekap', async () => {
  await assert.rejects(fetchAllRows(() => ({
    range: async from => from === 0
      ? { data: [1, 2], error: null }
      : { data: null, error: new Error('Jaringan terputus') },
  }), 2), /Jaringan terputus/)
})
