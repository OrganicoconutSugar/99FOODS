import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestId } from '../src/utils/requestId.js'

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('ID checkout dibuat ketika randomUUID tidak tersedia', () => {
  const cryptoWithoutRandomUUID = {
    getRandomValues: bytes => bytes.set(Array.from({ length: 16 }, (_, index) => index)),
  }
  assert.match(createRequestId(cryptoWithoutRandomUUID), uuidV4)
})

test('halaman tetap dapat membuat ID bila Web Crypto tidak tersedia', () => {
  assert.match(createRequestId(null), uuidV4)
})
