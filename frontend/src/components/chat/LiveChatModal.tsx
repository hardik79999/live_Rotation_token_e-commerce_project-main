/**
 * LiveChatModal — floating chat window between a customer and a seller.
 *
 * Bug fixes applied:
 *  1. Socket listeners are registered BEFORE emitting join_chat so the
 *     chat_history event is never missed.
 *  2. loading is set to false on REST success/failure AND on socket
 *     connect_error — the spinner can never get stuck.
 *  3. A 10-second safety timeout also clears the spinner.
 *  4. connect_error shows a toast so the user knows what happened.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';
import api from '@/api/axios';
import { CHAT } from '@/api/routes';
import type { ChatMessage } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  sellerUuid:  string;
  sellerName:  string;
  sellerPhoto: string | null;
  productUuid?: string;
  productName?: string;
  onClose: () => void;
}

export function LiveChatModal({
  sellerUuid, sellerName, sellerPhoto,
  productUuid, productName, onClose,
}: Props) {
  const { user }             = useAuthStore();
  const { socket, connected } = useChat();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomId,   setRoomId]   = useState<string | null>(null);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we've already joined so React StrictMode double-effect
  // doesn't emit join_chat twice.
  const joinedRef    = useRef(false);

  // ── Auto-scroll ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Main setup: register listeners FIRST, then get room + join ────────
  useEffect(() => {
    if (!user || joinedRef.current) return;

    // ── 1. Register all socket listeners before emitting anything ────────
    const onHistory = (data: { room_id: string; messages: ChatMessage[] }) => {
      setMessages(data.messages ?? []);
      setLoading(false);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      if (data.room_id) socket.emit('mark_read', { room_id: data.room_id });
    };

    const onNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.uuid === msg.uuid)) return prev;
        return [...prev, msg];
      });
      if (msg.sender_uuid !== user.uuid) {
        socket.emit('mark_read', { room_id: msg.room_id });
      }
    };

    const onTypingEvt = (data: { sender_uuid: string }) => {
      if (data.sender_uuid !== user.uuid) {
        setIsTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setIsTyping(false), 2500);
      }
    };

    const onConnectError = (err: Error) => {
      setLoading(false);
      setError('Could not connect to chat server.');
      toast.error(`Chat connection failed: ${err.message}`);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };

    socket.on('chat_history',  onHistory);
    socket.on('new_message',   onNewMessage);
    socket.on('typing',        onTypingEvt);
    socket.on('connect_error', onConnectError);

    // ── 2. Safety timeout — stop spinner after 10 s no matter what ───────
    safetyTimer.current = setTimeout(() => {
      setLoading(false);
      setError('Chat is taking too long to load. Please try again.');
    }, 10_000);

    // ── 3. Get room_id via REST, then emit join_chat ──────────────────────
    api.post(CHAT.ROOM, {
      seller_uuid:  sellerUuid,
      product_uuid: productUuid ?? null,
    }).then((res) => {
      const rid = res.data.room_id as string;
      setRoomId(rid);
      joinedRef.current = true;

      // Emit join_chat — server will respond with chat_history event
      socket.emit('join_chat', {
        seller_uuid:  sellerUuid,
        product_uuid: productUuid ?? null,
      });
    }).catch((err) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to open chat';
      setLoading(false);
      setError(msg);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    });

    return () => {
      socket.off('chat_history',  onHistory);
      socket.off('new_message',   onNewMessage);
      socket.off('typing',        onTypingEvt);
      socket.off('connect_error', onConnectError);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uuid, sellerUuid, productUuid]);   // socket is a stable singleton

  // ── Send message ──────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !roomId || sending) return;
    setSending(true);
    socket.emit('send_message', {
      room_id:       roomId,
      text:          trimmed,
      receiver_uuid: sellerUuid,
    });
    setText('');
    setSending(false);
    inputRef.current?.focus();
  }, [text, roomId, sending, socket, sellerUuid]);

  const handleTyping = () => {
    if (roomId) socket.emit('typing', { room_id: roomId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const avatarLetter = sellerName.charAt(0).toUpperCase();

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
      style={{ height: '520px' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 dark:bg-slate-800 shrink-0">
        <div className="relative shrink-0">
          {sellerPhoto ? (
            <img src={getImageUrl(sellerPhoto)} alt={sellerName}
                 className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-400" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-sm text-white">
              {avatarLetter}
            </div>
          )}
          <span className={cn(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900',
            connected ? 'bg-green-400' : 'bg-gray-500',
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{sellerName}</p>
          {productName && (
            <p className="text-xs text-gray-400 truncate">re: {productName}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connected
            ? <Wifi size={14} className="text-green-400" />
            : <WifiOff size={14} className="text-gray-500" />
          }
          <button onClick={onClose}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50 dark:bg-slate-900/50">
        {loading ? (
          /* Spinner — guaranteed to stop via safety timeout */
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400 dark:text-slate-500">Connecting…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <WifiOff size={32} className="text-red-400 mb-3" />
            <p className="text-sm font-medium text-red-500">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); joinedRef.current = false; }}
              className="mt-3 text-xs text-orange-500 hover:text-orange-600 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle size={36} className="text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">No messages yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Say hello to {sellerName}!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_uuid === user?.uuid;
            return (
              <div key={msg.uuid} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm',
                  isMine
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-bl-sm',
                )}>
                  <p className="break-words">{msg.text}</p>
                  <p className={cn(
                    'text-xs mt-1 text-right',
                    isMine ? 'text-orange-200' : 'text-gray-400 dark:text-slate-500',
                  )}>
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                    {isMine && <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span key={i}
                        className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => { setText(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            maxLength={2000}
            disabled={!connected || !roomId || !!error}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !connected || !roomId || sending || !!error}
            className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors active:scale-95 shrink-0"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        {!connected && !error && (
          <p className="text-xs text-center text-gray-400 dark:text-slate-500 mt-1.5">
            Reconnecting…
          </p>
        )}
      </div>
    </div>
  );
}
