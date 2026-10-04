import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { askAboutTour } from '../services/api';
import { parseTime } from '../lib/format';
import type { ChatTurn } from '../types';

interface Props {
  youtubeId: string;
  currentTime: number;
  onSeek: (t: number) => void;
  disabled?: boolean;
}

const STARTERS = [
  'What is the kitchen like?',
  'Is there outdoor space?',
  'What did the agent say about updates or renovations?',
  'Summarize this home in three bullets',
];

// Turns [1:25], [1:25–1:55] and [0:25, 0:50] citations into links the renderer can intercept.
const STAMP = String.raw`\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?`;
const CITATION = new RegExp(String.raw`\[(${STAMP}(?:\s*[,;]\s*${STAMP})*)\]`, 'g');
const linkTimestamps = (text: string) =>
  text.replace(CITATION, (_, inner: string) =>
    inner.split(/\s*[,;]\s*/).map(stamp => {
      const start = stamp.split(/\s*[–-]\s*/)[0];
      return `[${start}](#t-${start})`;
    }).join(' '),
  );

const ChatPanel: React.FC<Props> = ({ youtubeId, currentTime, onSeek, disabled }) => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow the answer as it streams, scrolling the message list rather than the page.
  useEffect(() => {
    const box = scrollRef.current;
    if (box && turns.length) box.scrollTop = box.scrollHeight;
  }, [turns]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = turns;
    setTurns([...history, { role: 'user', text: question }, { role: 'assistant', text: '' }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      await askAboutTour({ youtubeId, question, currentTime, history }, delta =>
        setTurns(t => {
          const copy = [...t];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, text: last.text + delta };
          return copy;
        }),
      );
    } catch (e) {
      setError((e as Error).message);
      setTurns(t => t.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {turns.length === 0 && (
          <div>
            <p className="text-warmWhite/70 text-sm mb-3">
              Ask anything about this home. Answers come only from what is seen and said in the tour, with timestamps you can click.
            </p>
            <div className="flex flex-col gap-2">
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={disabled}
                  className="text-left text-sm px-3 py-2 border-2 border-warmWhite/30 text-warmWhite hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <p key={i} className="ml-8 bg-terracotta text-white text-sm px-3 py-2 border-2 border-charcoal">
              {t.text}
            </p>
          ) : (
            <div key={i} className="mr-4 bg-warmWhite text-charcoal text-sm px-3 py-2 border-2 border-charcoal prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
              {t.text ? (
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) =>
                      href?.startsWith('#t-') ? (
                        <button
                          onClick={() => onSeek(parseTime(href.slice(3)))}
                          className="font-mono text-xs font-bold bg-charcoal text-warmWhite px-1 hover:bg-terracotta"
                        >
                          {children}
                        </button>
                      ) : (
                        <a href={href} target="_blank" rel="noreferrer">{children}</a>
                      ),
                  }}
                >
                  {linkTimestamps(t.text)}
                </ReactMarkdown>
              ) : (
                <span className="font-mono text-xs text-olive animate-pulse">Watching the tour…</span>
              )}
            </div>
          ),
        )}
        {error && <p className="text-sm text-terracotta font-mono">{error}</p>}
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          ask(input);
        }}
        className="p-3 border-t border-warmWhite/10 flex gap-2"
      >
        <input
          id="tour-question"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={disabled ? 'Available after indexing' : 'Ask about this home…'}
          disabled={disabled}
          className="flex-1 min-w-0 bg-warmWhite text-charcoal border-2 border-charcoal px-3 py-2 text-sm focus:outline-none focus:border-terracotta"
        />
        <button
          type="submit"
          disabled={busy || disabled || !input.trim()}
          className="px-4 bg-terracotta text-white border-2 border-charcoal font-mono text-xs font-bold uppercase disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
