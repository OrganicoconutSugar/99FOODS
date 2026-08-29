const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://haritsvite.app.n8n.cloud/webhook/chatbot';

export async function sendChatMessage(message) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      reply: data.reply || 'Tidak ada jawaban dari asisten.',
      file: data.file || null,
      filename: data.filename || null,
    };
  } catch (err) {
    console.error('Chatbot API error:', err);
    return {
      reply: '⚠️ Gagal terhubung ke asisten. Coba lagi nanti.',
      file: null,
      filename: null,
    };
  }
}