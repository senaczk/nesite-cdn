'use client';

import type { ProviderMeta } from '@/lib/providers/types';
import { effectiveMaxSize, showsNoApiKeyBadge } from '@/lib/providers/types';
import { formatBytes } from '@/lib/upload/validation';

interface ProviderSelectorProps {
  providers: ProviderMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  fileSize: number | null;
  disabled?: boolean;
  /** Provider ids the user has explicitly accepted after a policy warning. */
  acknowledged: Record<string, boolean>;
  onAcknowledge: (id: string, value: boolean) => void;
}

/** Re-exported so the console and the selector agree on one rule. */
export { effectiveMaxSize };

export function ProviderSelector({
  providers,
  selectedId,
  onSelect,
  fileSize,
  disabled = false,
  acknowledged,
  onAcknowledge,
}: ProviderSelectorProps) {
  return (
    <section aria-labelledby="provider-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="provider-heading" className="label-mono">
          02 — Choose a provider
        </h2>
        <span className="text-[11px] text-white/30">{providers.length} available</span>
      </div>

      <div role="radiogroup" aria-label="Upload provider" className="grid gap-2.5">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            selected={selectedId === provider.id}
            onSelect={onSelect}
            fileSize={fileSize}
            disabled={disabled}
            acknowledged={Boolean(acknowledged[provider.id])}
            onAcknowledge={(value) => onAcknowledge(provider.id, value)}
          />
        ))}
      </div>
    </section>
  );
}

function ProviderCard({
  provider,
  selected,
  onSelect,
  fileSize,
  disabled,
  acknowledged,
  onAcknowledge,
}: {
  provider: ProviderMeta;
  selected: boolean;
  onSelect: (id: string) => void;
  fileSize: number | null;
  disabled: boolean;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) {
  const needsAck = Boolean(provider.acknowledgement) && !acknowledged;
  const max = effectiveMaxSize(provider);
  const tooBig = fileSize != null && max != null && fileSize > max;

  return (
    <div
      role="radio"
      tabIndex={disabled || needsAck ? -1 : 0}
      aria-checked={selected}
      aria-disabled={disabled || needsAck}
      onClick={() => {
        if (disabled || needsAck) return;
        onSelect(provider.id);
      }}
      onKeyDown={(event) => {
        if (disabled || needsAck) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(provider.id);
        }
      }}
      className={[
        'relative cursor-pointer rounded-xl border p-3.5 transition-all duration-150 sm:p-4',
        selected
          ? 'border-neon-purple/60 bg-neon-purple/[0.07] shadow-[0_0_0_1px_rgba(168,85,247,0.25)]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]',
        disabled ? 'pointer-events-none opacity-50' : '',
        needsAck ? 'pointer-events-none' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={[
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            selected ? 'border-neon-purple bg-neon-purple' : 'border-white/25',
          ].join(' ')}
        >
          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-ink-950" /> : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-white sm:text-[15px]">{provider.name}</span>
            {showsNoApiKeyBadge(provider) ? <span className="tag-dark text-emerald-300">No API Key</span> : null}
            {provider.integration === 'proxy' ? <span className="tag-dark text-sky-300">Via server relay</span> : null}
            {provider.status === 'partial' ? <span className="tag-dark text-amber-300">Limited</span> : null}
          </div>

          <p className="mt-1 text-xs leading-relaxed text-white/45">{provider.description}</p>

          <dl className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11px] text-white/40 sm:grid-cols-2">
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-white/25">expiry</dt>
              <dd className="min-w-0 truncate" title={provider.expiration}>
                {provider.expiration}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-white/25">limit</dt>
              <dd className={tooBig ? 'text-rose-300' : ''}>
                {provider.maxFileSizeBytes ? formatBytes(provider.maxFileSizeBytes) : 'not published'}
                {provider.integration === 'proxy' ? ' (capped by relay)' : ''}
              </dd>
            </div>
          </dl>

          {tooBig ? (
            <p className="mt-2 text-[11px] text-rose-300">
              Your file is {formatBytes(fileSize!)} — this provider cannot take it.
            </p>
          ) : null}

          {provider.acknowledgement && !acknowledged ? (
            <label
              className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-2.5"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-400"
                checked={acknowledged}
                onChange={(event) => onAcknowledge(event.target.checked)}
              />
              <span className="text-[11px] leading-relaxed text-amber-100/85">
                <strong className="font-semibold text-amber-200">{provider.acknowledgement.title}.</strong>{' '}
                {provider.acknowledgement.body}
              </span>
            </label>
          ) : null}

          {provider.acknowledgement && acknowledged ? (
            <p className="mt-2 text-[11px] text-emerald-300/80">Policy acknowledged — you can select this provider.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}