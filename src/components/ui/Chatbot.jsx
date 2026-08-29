import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, MessageCircle, FileText, X, Loader2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { formatRupiah } from '../../utils/format';

const QUICK_SUGGESTIONS = [
  'Berapa omset hari ini?',
  'Stok apa yang menipis?',
  'Menu terlaris minggu ini',
  'Buat Excel laporan bulan ini',
];

export default function Chatbot({ open, onClose }) {
  const { messages, isLoading, sendMessage, clearHistory } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDownload = (base64, filename) => {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 sm:bg-black/20" onClick={onClose} />

      <div className="relative w-full sm:max-w-md h-[85vh] sm:h-[520px] bg-white rounded-t-2xl sm:rounded-xl border border-gray-100 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-sage-500 rounded-t-2xl sm:rounded-t-xl">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-white" />
            <span className="text-sm font-semibold text-white">Asisten 99Foods</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (window.confirm('Hapus semua percakapan?')) clearHistory();
              }}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title="Hapus riwayat"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin bg-gray-50/50">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle size={32} className="mx-auto text-sage-300 mb-2" />
              <p className="text-sm text-gray-400 mb-4">Tanya apa saja tentang bisnis 99Foods</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-sage-200 text-sage-600 hover:bg-sage-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-sage-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.content}
                {msg.file && (
                  <button
                    onClick={() => handleDownload(msg.file, msg.filename)}
                    className="mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-sage-50 border border-sage-200 text-sage-700 hover:bg-sage-100 transition-colors w-full"
                  >
                    <FileText size={13} />
                    Download {msg.filename}
                  </button>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm flex items-center gap-2">
                <Loader2 size={14} className="text-sage-500 animate-spin" />
                <span className="text-xs text-gray-400">Berpikir...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-2xl sm:rounded-b-xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pertanyaan..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-300 max-h-24 scrollbar-thin"
              style={{ minHeight: '38px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-sage-500 text-white hover:bg-sage-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}