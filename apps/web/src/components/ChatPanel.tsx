'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ChatMessage } from '@/hooks/useRandomCall';
import { SendIcon } from '@/components/icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  ready: boolean;
  peerTyping: boolean;
  onSend: (text: string) => void;
  onTyping: () => void;
}

/** Scrolling message list with a composer, backed by the call's data channel. */
export function ChatPanel({
  messages,
  ready,
  peerTyping,
  onSend,
  onTyping,
}: ChatPanelProps): React.ReactElement {
  const t = useTranslations('call');
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages, peerTyping]);

  // Put the caret in the composer the moment the channel opens.
  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !peerTyping && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-neutral-500">{ready ? t('chatEmpty') : t('chatWaiting')}</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] break-words rounded-2xl px-4 py-2 text-sm leading-snug shadow-sm ${
                message.from === 'me'
                  ? 'rounded-br-md bg-brand text-brand-fg'
                  : 'rounded-bl-md bg-neutral-800 text-neutral-100'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}

        {peerTyping && (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-neutral-800 px-4 py-3"
              aria-label={t('chatTyping')}
            >
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-neutral-800 bg-neutral-900/60 p-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (event.target.value.trim()) onTyping();
          }}
          placeholder={t('chatPlaceholder')}
          disabled={!ready}
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 transition placeholder:text-neutral-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!ready || draft.trim().length === 0}
          aria-label={t('chatSend')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg transition hover:scale-105 hover:opacity-90 active:scale-95 disabled:scale-100 disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
