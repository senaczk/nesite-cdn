'use client';

import { useCallback, useEffect, useState } from 'react';

interface UploadResultProps {
  url: string;
  providerName: string;
  fileName: string;
  onReset: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Mount this with `key={url}` so a new upload starts from a clean slate. That
 * replaces the "reset the copy badge when the url changes" effect, which would
 * have been a synchronous setState inside an effect body.
 */
export function UploadResult({ url, providerName, fileName, onReset }: UploadResultProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2200);
    return () => clearTimeout(timer);
  }, [copyState]);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Plain-http contexts and older mobile browsers have no Clipboard API.
        const el = document.createElement('textarea');
        el.value = url;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        if (!ok) throw new Error('copy rejected');
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, [url]);

  return (
    <section className="panel panel-strong animate-fade-up p-4" aria-live="polite">
      <div className="mb-3 flex items-center gap-2">
        <CheckGlyph />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Upload complete</p>
          <p className="truncate text-[11px] text-white/40">
            {fileName} · {providerName}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          aria-label="Direct file URL"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2.5 font-mono text-xs text-white/85 outline-none focus:border-neon-purple/50"
        />
        <button type="button" className="btn-primary !w-auto sm:px-6" onClick={copy}>
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy URL'}
        </button>
      </div>

      {copyState === 'failed' ? (
        <p className="mt-2 text-[11px] text-rose-300">
          The browser blocked clipboard access. Long-press the URL above to copy it.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-neon-blue underline-offset-2 hover:underline">
          Open file ↗
        </a>
        <button type="button" className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline" onClick={onReset}>
          Upload another
        </button>
      </div>
    </section>
  );
}

function CheckGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-emerald-400">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}