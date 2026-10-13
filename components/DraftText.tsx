'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const fit = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// An inline-editable line (focus, week focus, journal). It keeps a local
// draft and commits on blur or Enter. Render it with key={value} so a change
// from the server (an agent, another tab) replaces the draft.
export function DraftText({
  value,
  onCommit,
  className = 'focus',
  placeholder,
  label,
  autoFocus,
  multiline,
  onDraft,
}: {
  value: string;
  onCommit?: (next: string) => void;
  className?: string;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
  multiline?: boolean;
  onDraft?: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => fit(ref.current), [draft]);
  // Re-wrap when the placard changes width (scrollbar, window resize).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit(el);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      className={className}
      rows={1}
      value={draft}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={label}
      onChange={(e) => {
        setDraft(e.target.value);
        onDraft?.(e.target.value);
      }}
      onBlur={() => draft !== value && onCommit?.(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}
