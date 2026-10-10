'use client';

interface UploadProgressProps {
  /** 0-100. */
  percent: number;
  phase: 'sending' | 'waiting' | 'done';
  providerName: string;
  fileName: string;
  onCancel?: () => void;
}

const PHASE_TEXT: Record<UploadProgressProps['phase'], string> = {
  sending: 'Uploading to',
  waiting: 'Uploaded — waiting for',
  done: 'Uploaded to',
};

export function UploadProgress({ percent, phase, providerName, fileName, onCancel }: UploadProgressProps) {
  return (
    <section className="panel p-4" aria-live="polite">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-white/85">{fileName}</span>
        <span className="shrink-0 font-mono text-xs text-white/50">{Math.round(percent)}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={`Upload progress for ${fileName}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-blue transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-white/45">
          <Spinner active={phase !== 'done'} />
          {PHASE_TEXT[phase]} <span className="font-medium text-white/75">{providerName}</span>
        </p>
        {onCancel ? (
          <button type="button" className="btn-ghost !py-1 !text-[11px]" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Spinner({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 rounded-full border-2 border-neon-purple/30 border-t-neon-purple ${
        active ? 'animate-spin' : 'opacity-30'
      }`}
    />
  );
}