import { MessageCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function ChatbotButton() {
  const { setIsOpen, messages } = useChat();
  const hasNew = messages.length === 0;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-sage-500 hover:bg-sage-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
      title="Buka asisten AI"
    >
      <MessageCircle size={20} />
      {hasNew && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
      )}
    </button>
  );
}