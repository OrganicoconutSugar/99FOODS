const PROFILES = [
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb', characteristic: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
  { service: '0000ae30-0000-1000-8000-00805f9b34fb', characteristic: '0000ae01-0000-1000-8000-00805f9b34fb' },
]

let device = null
let characteristic = null
let serialPort = null

function ascii(value) {
  return String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '?')
}

function line(left, right = '', width = 32) {
  const a = ascii(left)
  const b = ascii(right)
  return a.slice(0, width - b.length) + ' '.repeat(Math.max(0, width - a.length - b.length)) + b
}

function rupiah(value) {
  return `Rp${Number(value || 0).toLocaleString('id-ID')}`
}

export function buildReceiptBytes(transaction, details) {
  if (!transaction || !Array.isArray(details)) throw new Error('Data struk tidak lengkap')
  const lines = [
    '          99FOODS',
    '       Dimsum & Cireng',
    '-'.repeat(32),
    ascii(transaction.kode),
    ascii(transaction.tanggal),
    `Bayar: ${ascii(transaction.channel)}`,
  ]
  if (transaction.nama_customer) lines.push(`Pelanggan: ${ascii(transaction.nama_customer).slice(0, 20)}`)
  lines.push('-'.repeat(32))
  for (const item of details) {
    lines.push(ascii(item.nama_menu).slice(0, 32))
    lines.push(line(`${item.jumlah_porsi} x ${rupiah(item.harga_jual)}`, rupiah(item.subtotal_omset)))
  }
  lines.push('-'.repeat(32), line('TOTAL', rupiah(transaction.total_omset)), '-'.repeat(32), '       Terima kasih!', '', '', '')
  const text = lines.join('\n')
  const bytes = new Uint8Array(2 + text.length + 3)
  bytes.set([0x1b, 0x40], 0) // ESC @: inisialisasi
  for (let index = 0; index < text.length; index++) bytes[2 + index] = text.charCodeAt(index)
  bytes.set([0x1d, 0x56, 0x00], 2 + text.length) // GS V: potong jika printer mendukung
  return bytes
}

async function getWritableCharacteristic() {
  if (characteristic && device?.gatt?.connected) return characteristic
  if (!globalThis.isSecureContext) throw new Error('Cetak Bluetooth memerlukan HTTPS atau localhost.')
  if (!navigator.bluetooth) throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan cetak browser.')

  if (!device) {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [...new Set(PROFILES.map(profile => profile.service))],
    })
  }

  const server = device.gatt?.connected ? device.gatt : await device.gatt?.connect()
  if (!server) throw new Error('Printer tidak menyediakan koneksi BLE yang dapat digunakan browser.')
  for (const profile of PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service)
      const candidate = await service.getCharacteristic(profile.characteristic)
      if (candidate.properties.write || candidate.properties.writeWithoutResponse) {
        characteristic = candidate
        return candidate
      }
    } catch { /* Coba profil BLE berikutnya. */ }
  }
  throw new Error('Layanan cetak BLE printer tidak dikenali. Periksa protokol printer; cetak browser tetap tersedia.')
}

async function printBle(bytes) {
  const output = await getWritableCharacteristic()
  for (let offset = 0; offset < bytes.length; offset += 20) {
    const chunk = bytes.slice(offset, offset + 20)
    if (output.properties.writeWithoutResponse && output.writeValueWithoutResponse) {
      await output.writeValueWithoutResponse(chunk)
    } else if (output.writeValueWithResponse) {
      await output.writeValueWithResponse(chunk)
    } else {
      await output.writeValue(chunk)
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

async function printSerial(bytes) {
  if (!globalThis.isSecureContext) throw new Error('Cetak Bluetooth memerlukan HTTPS atau localhost.')
  if (!navigator.serial) throw new Error('Browser ini tidak mendukung Web Serial untuk Bluetooth Classic.')
  if (!serialPort) serialPort = await navigator.serial.requestPort()
  try {
    await serialPort.open({ baudRate: 9600 })
    const writer = serialPort.writable.getWriter()
    try { await writer.write(bytes) } finally { writer.releaseLock() }
    await serialPort.close()
  } catch (error) {
    try { await serialPort.close() } catch { /* Port mungkin sudah tertutup. */ }
    serialPort = null
    throw error
  }
}

export async function printBluetoothReceipt(transaction, details, mode = 'serial') {
  const bytes = buildReceiptBytes(transaction, details)
  if (mode === 'ble') await printBle(bytes)
  else await printSerial(bytes)
}

export function forgetPrinter() {
  device?.gatt?.disconnect()
  device = null
  characteristic = null
  serialPort = null
}
