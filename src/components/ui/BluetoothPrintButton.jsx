import { useState } from 'react'
import { Bluetooth } from 'lucide-react'
import { printBluetoothReceipt, forgetPrinter } from '../../lib/printerService'
import Button from './Button'
import toast from 'react-hot-toast'

export default function BluetoothPrintButton({ transaksi, detail }) {
  const [printing, setPrinting] = useState(false)
  const handlePrint = async (mode) => {
    setPrinting(true)
    try {
      await printBluetoothReceipt(transaksi, detail, mode)
      toast.success('Struk dikirim ke printer Bluetooth')
    } catch (error) {
      toast.error(error.message || 'Gagal mencetak lewat Bluetooth', { duration: 6000 })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" onClick={() => handlePrint('serial')} loading={printing} disabled={!transaksi || !detail?.length}>
        <Bluetooth size={14} /> Cetak Bluetooth Classic
      </Button>
      <button type="button" disabled={printing} onClick={() => handlePrint('ble')} className="text-[11px] text-sage-600 hover:underline disabled:opacity-50">Printer BLE? Coba koneksi BLE</button>
      <button type="button" disabled={printing} onClick={() => { forgetPrinter(); toast.success('Printer lama dilepas; pilih printer lagi saat mencetak') }} className="text-[11px] text-gray-400 hover:underline disabled:opacity-50">Ganti printer Bluetooth</button>
    </div>
  )
}
