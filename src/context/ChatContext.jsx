import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { sendChatMessage } from '../lib/chatbotApi';

const ChatContext = createContext(null);

const STORAGE_KEY = '99foods-chat-history';

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages]);

  const addMessage = useCallback((role, content, meta = {}) => {
    const msg = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const sendMessage = useCallback(async (content) => {
    addMessage('user', content);
    setIsLoading(true);

    try {
      const { reply, file, filename } = await sendChatMessage(content);
      addMessage('assistant', reply, { file, filename });
    } catch (err) {
      addMessage('assistant', '⚠️ Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isOpen,
        setIsOpen,
        isLoading,
        sendMessage,
        clearHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}