'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { sendSupportChatMessage, type SupportChatTurn } from '@/lib/support-chat-api';
import ChatMessage, { type UiChatMessage } from './ChatMessage';
import TypingIndicator from './TypingIndicator';

const WELCOME_TEXT = 'Hello 👋 What can I help you with today?';

/** Floating AI support chat for the homepage (bottom-right). */
export default function SupportChat() {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>(() => [
    { id: 'welcome', role: 'assistant', content: WELCOME_TEXT },
  ]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isLoading, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => scrollToBottom();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    const mq = window.matchMedia('(max-width: 639px)');
    if (mq.matches) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: UiChatMessage = {
      id: createId(),
      role: 'user',
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const reply = await sendSupportChatMessage(toApiHistory(nextMessages));
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', content: reply },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[248] bg-black/20 sm:hidden"
          aria-label="Close chat"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed z-[250] flex flex-col ${
          isOpen
            ? 'inset-x-0 bottom-[64px] items-stretch px-2 sm:inset-auto sm:bottom-[76px] sm:right-4 sm:left-auto sm:w-auto sm:items-end sm:px-0'
            : 'bottom-[76px] right-3 items-end sm:right-4'
        }`}
      >
        {isOpen && (
          <div
            id={panelId}
            role="dialog"
            aria-label="Live support chat"
            className="mb-3 flex h-[min(72dvh,520px)] w-full flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl shadow-black/10 sm:h-[min(68vh,560px)] sm:w-[min(100vw-2rem,380px)]"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-emerald-100 bg-white px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-md">
                <SupportIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-green-900">Live Support</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
                  AI assistant · Online
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-green-50 hover:text-green-800"
                aria-label="Close chat"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div
              ref={listRef}
              className="hide-scrollbar min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 px-3 py-4"
            >
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && <TypingIndicator />}
            </div>

            {error && (
              <p className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <form
              onSubmit={onSubmit}
              className="flex shrink-0 items-end gap-2 border-t border-emerald-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isLoading}
                placeholder="Type your message…"
                maxLength={2000}
                className="hide-scrollbar max-h-24 min-h-[44px] flex-1 resize-none rounded-xl border-2 border-green-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-green-600 focus:ring-2 focus:ring-green-500/25 disabled:opacity-60"
                aria-label="Message"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700 text-white shadow-lg shadow-green-600/30 transition-transform hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L17 12l-10.8 1.4-2.8 7.2Z" />
                </svg>
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-700 text-white shadow-xl shadow-green-600/35 transition-transform hover:scale-105 active:scale-95"
          aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
        >
          {isOpen ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          ) : (
            <SupportIcon className="h-7 w-7" />
          )}
        </button>
      </div>
    </>
  );
}

function createId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toApiHistory(messages: UiChatMessage[]): SupportChatTurn[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2C6.48 2 2 6.02 2 11c0 2.76 1.34 5.22 3.5 6.88V22l4.09-2.25c1.43.4 2.95.62 4.41.62 5.52 0 10-4.02 10-9S17.52 2 12 2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10.5h7M8.5 13.5h4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
