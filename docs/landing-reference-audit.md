# Audit referensi landing page Lambert | Lambert

Referensi: <https://lambert-lambert.com/?ref=siteinspire> (diamati 6 November 2026).

## Yang terlihat di halaman

- Beranda berupa galeri layar penuh, bukan halaman dengan beberapa bagian vertikal.
- Setiap tampilan memakai komposisi dua bidang: area visual dan area editorial. Area visual bergeser secara horizontal ketika pengguna menggulir atau menggeser.
- Logo/identitas berada di tengah atas pada bidang putih transparan. Nama proyek, kredit, dan tautan proyek berada di bagian bawah.
- Tipografi menggabungkan huruf display sangat tebal dan teks kecil bergaya editorial. Ruang kosong yang luas membuat gambar menjadi fokus.
- Saat dibuka, ada transisi identitas singkat sebelum galeri terlihat.

## Indikasi teknis dari halaman yang ter-render

- Asset CSS menggunakan jalur `/_app/immutable/assets/`, yang menunjukkan build SvelteKit. Source privatnya tidak tersedia, jadi versi dan susunan komponen aslinya tidak dapat dipastikan.
- Elemen kustom `hero-slider` dan kelas `embla`, `embla__container`, `embla__slide` terlihat di DOM. Pergeseran memakai `transform: translate3d(...)`. Ini konsisten dengan pola slider Embla; library aslinya tidak dikonfirmasi dari source.
- Kelas seperti `flex`, `shrink-0`, `font-black`, dan ukuran dalam kurung siku menunjukkan CSS utilitas bergaya Tailwind.
- Gambar diambil dari CDN Sanity; beberapa slide memiliki elemen video dengan poster Vimeo. Asset ini tidak dipakai di 99Foods.
- Implementasi 99Foods memakai React 18, React Router, CSS native, dan icon `lucide-react` yang sudah menjadi dependency project. Efek galeri dibuat dengan state React dan CSS transform tanpa mengganti stack aplikasi kasir.

## Penerapan untuk 99Foods

Landing page ada di `/`; login tetap `/login`; dashboard setelah login ada di `/app`. Navigasi fitur lain tetap pada rute sebelumnya. Logo yang digunakan berasal dari `src/assets/element/logo.png`. Palet memakai oranye logo, hijau sage dashboard, dan warna pendukung hangat. Empat foto 99Foods dari pengguna berada di `src/assets/landing/` dan dihubungkan melalui properti `image` pada setiap slide di `src/pages/Landing.jsx`.

Tiga foto makanan tambahan dari pengguna dibuat menjadi potongan PNG transparan dengan imagegen, lalu digunakan sebagai aksen kecil di sekitar kartu foto. Stiker bulat bertuliskan “Buat dinikmati” telah dihapus.

Tampilan mengikuti struktur, ritme, dan interaksi referensi. Foto, karya, logo, dan kode referensi tidak disalin.
