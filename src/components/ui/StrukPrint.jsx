/**
 * StrukPrint — komponen struk kasir thermal 80mm
 * Dipanggil via window.print() setelah dirender di DOM
 *
 * Props:
 *   transaksi   : object  — data header transaksi
 *   detail      : array   — array transaksi_detail
 *   ref         : ref ke div yang akan di-print
 */
import { forwardRef } from 'react'
import { formatRupiah, formatTanggal } from '../../utils/format'

const StrukPrint = forwardRef(function StrukPrint({ transaksi, detail }, ref) {
  if (!transaksi) return null

  const total   = transaksi.total_omset || 0
  const now     = new Date()
  const jamCetak = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      ref={ref}
      className="struk-print-area hidden print:block"
      style={{ fontFamily: 'monospace', fontSize: 11, width: '72mm', padding: '4mm', color: '#000' }}
    >
      {/* Header toko */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>99Foods</div>
        <div style={{ fontSize: 10 }}>Dimsum &amp; Cireng</div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      </div>

      {/* Info transaksi */}
      <div style={{ fontSize: 10, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>No.</span>
          <span style={{ fontWeight: 600 }}>{transaksi.kode}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tanggal</span>
          <span>{formatTanggal(transaksi.tanggal)} {jamCetak}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Kasir</span>
          <span>Owner</span>
        </div>
        {transaksi.nama_customer && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer</span>
            <span>{transaksi.nama_customer}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Pembayaran</span>
          <span>{transaksi.channel}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* Item */}
      <div style={{ marginBottom: 6 }}>
        {(detail || []).map((d, i) => (
          <div key={i} style={{ marginBottom: 3 }}>
            <div style={{ fontWeight: 600 }}>{d.nama_menu}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 4 }}>
              <span>{d.jumlah_porsi} x {formatRupiah(d.harga_jual)}</span>
              <span>{formatRupiah(d.subtotal_omset)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* Total */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>{formatRupiah(total)}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 6 }}>
        <div>Terima kasih!</div>
        <div>Selamat menikmati 🍜</div>
      </div>
    </div>
  )
})

export default StrukPrint
