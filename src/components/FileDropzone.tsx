'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { describeFileType, formatBytes, sanitizeFileName } from '@/lib/upload/validation';

interface FileDropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  error?: string | null;
}

export function FileDropzone({ file, onFile, disabled = false, error }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const accept = useCallback(
    (next: File | null | undefined) => {
      if (disabled) return;
      onFile(next ?? null);
    },
    [disabled, onFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) accept(dropped);
    },
    [accept],
  );

  return (
    <section aria-labelledby={`${inputId}-label`}>
      <div className="mb-3 flex items-center justify-between">
        <span id={`${inputId}-label`} className="label-mono">
          01 — Choose a file
        </span>
        {file && !disabled ? (
          <button type="button" className="text-xs text-white/45 underline-offset-2 hover:underline" onClick={() => accept(null)}>
            Clear
          </button>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'group relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-8 text-center transition-all duration-200',
          dragging
            ? 'border-neon-purple/70 bg-neon-purple/10'
            : file
              ? 'border-white/15 bg-white/[0.03]'
              : 'border-white/12 bg-white/[0.015] hover:border-white/25 hover:bg-white/[0.035]',
          disabled ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => accept(event.target.files?.[0])}
        />

        {file ? (
          <>
            <FileGlyph />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{sanitizeFileName(file.name)}</p>
              <p className="mt-1 font-mono text-xs text-white/45">
                {formatBytes(file.size)} · {describeFileType(file)}
              </p>
            </div>
            <span className="text-xs text-white/35">Tap to choose a different file</span>
          </>
        ) : (
          <>
            <DropGlyph />
            <div>
              <p className="text-base font-semibold text-white">Drop a file here</p>
              <p className="mt-1 text-xs text-white/40">or tap to browse your device</p>
            </div>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-2.5 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function DropGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-neon-purple">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-neon-blue">
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}