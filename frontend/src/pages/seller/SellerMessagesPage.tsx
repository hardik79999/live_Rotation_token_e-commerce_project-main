/**
 * SellerMessagesPage — inbox for sellers to see and reply to all customer chats.
 *
 * Left panel: list of conversations (sorted by most recent).
 * Right panel: the active chat window using the same Socket.IO hook.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { MessageCircle, Search, Send, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';
import api from '@/api/axios';
import { CHAT } from '@/api/routes';
import type { ChatConversation, ChatMessage } from '@/types';

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Conversation list item ────────────────────────────────────
function ConvItem({
  conv, active, onClick,
}: {
  conv: ChatConversation;
  active: boolean;
  onClick: () => void;
}) {
  const letter = conv.other_user.username.charAt(0).toUpperCase();
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
        active
          ? 'bg-orange-50 dark:bg-orange-500/10 border-r-2 border-orange-500'
          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50',
      )}
    >
      {conv.other_user.profile_photo ? (
        <img src={getImageUrl(conv.other_user.profile_photo)}
             alt={conv.other_user.username}
             className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
          {letter}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
            {conv.other_user.username}
          </p>
          <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
            {timeAgo(conv.last_message_time)}
          </span>
        </div>
        {conv.product && (
          <p className="text-xs text-orange-500 truncate">re: {conv.product.name}</p>
        )}
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{conv.last_message}</p>
          {conv.unread_count > 0 && (
            <span className="shrink-0 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {conv.unread_count > 9 ? '9+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function SellerMessagesPage() {
  const { user } = useAuthStore();
  const { socket, connected } = useChat();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConv,    setActiveConv]    = useState<ChatConversation | null>(null);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [text,          setText]          = useState('');
  const [sending,       setSending]       = useState(false);
  const [isTyping,      setIsTyping]      = useState(false);
  const [loadingConvs,  setLoadingConvs]  = useState(true);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [search,        setSearch]        = useState('');

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── KEY FIX: ref always holds the current activeConv so socket
  //    listeners never read a stale closure value ──────────────
  const activeConvRef = useRef<ChatConversation | null>(null);

  // Keep ref in sync with state
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  // ── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Load conversations on mount ───────────────────────────
  const loadConversations = useCallback(() => {
    api.get(CHAT.CONVERSATIONS)
      .then((r) => setConversations(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Open a conversation ───────────────────────────────────
  const openConversation = (conv: ChatConversation) => {
    setActiveConv(conv);
    setMessages([]);
    setLoadingMsgs(true);

    // Pass room_id directly — the backend fast-path uses it to join
    // the exact same room the customer is in, without recomputing.
    socket.emit('join_chat', { room_id: conv.room_id });
  };

  // ── Socket.IO listeners — registered ONCE, use ref for current conv ──
  // Removing activeConv from deps prevents stale-closure drops: the ref
  // always holds the latest value so every incoming message is evaluated
  // against the currently open conversation.
  useEffect(() => {
    const onHistory = (data: { room_id: string; messages: ChatMessage[] }) => {
      const conv = activeConvRef.current;
      if (conv && data.room_id === conv.room_id) {
        setMessages(data.messages);
        setLoadingMsgs(false);
        socket.emit('mark_read', { room_id: data.room_id });
        loadConversations();
      }
    };

    const onNewMessage = (msg: ChatMessage) => {
      const conv = activeConvRef.current;

      // Always update the conversation list preview (sidebar badge + last msg)
      setConversations((prev) =>
        prev.map((c) =>
          c.room_id === msg.room_id
            ? {
                ...c,
                last_message:      msg.text,
                last_message_time: msg.created_at,
                // Increment unread only if this conv is NOT currently open
                unread_count:
                  msg.sender_uuid !== user?.uuid && c.room_id !== conv?.room_id
                    ? c.unread_count + 1
                    : 0,
              }
            : c
        ).sort((a, b) =>
          (b.last_message_time || '').localeCompare(a.last_message_time || '')
        )
      );

      // Append to message list only if this room is currently open
      if (conv && msg.room_id === conv.room_id) {
        setMessages((prev) => {
          if (prev.some((m) => m.uuid === msg.uuid)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_uuid !== user?.uuid) {
          socket.emit('mark_read', { room_id: msg.room_id });
        }
      }
    };

    const onTyping = (data: { sender_uuid: string }) => {
      if (data.sender_uuid !== user?.uuid) {
        setIsTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setIsTyping(false), 2500);
      }
    };

    socket.on('chat_history', onHistory);
    socket.on('new_message',  onNewMessage);
    socket.on('typing',       onTyping);

    return () => {
      socket.off('chat_history', onHistory);
      socket.off('new_message',  onNewMessage);
      socket.off('typing',       onTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  // socket and user?.uuid are stable — intentionally omit activeConv
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.uuid, loadConversations]);

  // ── Send message ──────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !activeConv || sending) return;

    setSending(true);
    socket.emit('send_message', {
      room_id:       activeConv.room_id,
      text:          trimmed,
      receiver_uuid: activeConv.other_user.uuid,
    });
    setText('');
    setSending(false);
    inputRef.current?.focus();
  }, [text, activeConv, sending, socket]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTyping = () => {
    if (activeConv) socket.emit('typing', { room_id: activeConv.room_id });
  };

  const filtered = conversations.filter((c) =>
    c.other_user.username.toLowerCase().includes(search.toLowerCase()) ||
    (c.product?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  if (loadingConvs) return <PageSpinner />;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">

      {/* ── Left: conversation list ── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-100 dark:border-slate-700">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex-1">Messages</h2>
            {totalUnread > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {totalUnread}
              </span>
            )}
            <div className={cn('w-2 h-2 rounded-full', connected ? 'bg-green-400' : 'bg-gray-400')} />
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
              <MessageCircle size={32} className="text-gray-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {conversations.length === 0 ? 'No messages yet' : 'No results'}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConvItem
                key={conv.room_id}
                conv={conv}
                active={activeConv?.room_id === conv.room_id}
                onClick={() => openConversation(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: active chat ── */}
      {!activeConv ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <MessageCircle size={48} className="text-gray-200 dark:text-slate-700 mb-4" />
          <p className="text-lg font-semibold text-gray-500 dark:text-slate-400">Select a conversation</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            Choose a chat from the left to start replying
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 shrink-0">
            {activeConv.other_user.profile_photo ? (
              <img src={getImageUrl(activeConv.other_user.profile_photo)}
                   alt={activeConv.other_user.username}
                   className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
                {activeConv.other_user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                {activeConv.other_user.username}
              </p>
              {activeConv.product && (
                <p className="text-xs text-orange-500 truncate">re: {activeConv.product.name}</p>
              )}
            </div>
            {connected
              ? <Wifi size={14} className="text-green-400 shrink-0" />
              : <WifiOff size={14} className="text-gray-400 shrink-0" />
            }
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-gray-50/50 dark:bg-slate-900/30">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-sm text-gray-400 dark:text-slate-500">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_uuid === user?.uuid;
                return (
                  <div key={msg.uuid} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm',
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

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0,1,2].map((i) => (
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

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-xl px-3 py-2">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => { setText(e.target.value); handleTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder="Type a reply…"
                maxLength={2000}
                disabled={!connected}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || !connected || sending}
                className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors active:scale-95 shrink-0"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
