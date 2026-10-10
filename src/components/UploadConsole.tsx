'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { FileDropzone } from '@/components/FileDropzone';
import { Header } from '@/components/Header';
import { ProviderSelector } from '@/components/ProviderSelector';
import { effectiveMaxSize } from '@/lib/providers/types';
import { UploadProgress } from '@/components/UploadProgress';
import { UploadResult } from '@/components/UploadResult';
import { listSelectableProviders, listUnavailableProviders } from '@/lib/providers/registry';
import { performUpload } from '@/lib/providers/client';
import type { NormalizedUpload, ProviderMeta } from '@/lib/providers/types';
import { UploadError, describeError } from '@/lib/upload/errors';
import { validateForProvider } from '@/lib/upload/validation';
import { VLTCS_EXPIRY_PRESETS } from '@/lib/providers/vltcs';
import { CATBOX_BLOCKED_EXTENSIONS } from '@/lib/providers/catbox';

type Phase = 'idle' | 'uploading' | 'success' | 'error';

export function UploadConsole() {
  const selectable = useMemo(() => listSelectableProviders(), []);
  const unavailable = useMemo(() => listUnavailableProviders(), []);

  const [file, setFile] = useState<File | null>(null);
  const [providerId, setProviderId] = useState<string | null>(selectable[0]?.id ?? null);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [expiry, setExpiry] = useState('permanent');

  const [phase, setPhase] = useState<Phase>('idle');
  const [percent, setPercent] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'sending' | 'waiting'>('sending');
  const [result, setResult] = useState<(NormalizedUpload & { provider: ProviderMeta }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Double-submission guard: a ref, because a click landing twice inside one
  // render pass must still be ignored.
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectedProvider = useMemo(
    () => selectable.find((p) => p.id === providerId) ?? null,
    [selectable, providerId],
  );

  const blockedExtensions = selectedProvider?.id === 'catbox' ? CATBOX_BLOCKED_EXTENSIONS : undefined;
  const fileCheck = useMemo(() => {
    if (!file || !selectedProvider) return null;
    return validateForProvider(file, {
      id: selectedProvider.id,
      maxFileSizeBytes: effectiveMaxSize(selectedProvider),
      blockedExtensions,
    });
  }, [file, selectedProvider, blockedExtensions]);

  const busy = phase === 'uploading';
  const canUpload = Boolean(file) && Boolean(selectedProvider) && !busy && fileCheck?.ok !== false;

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setPercent(0);
    setPhase('idle');
    setUploadPhase('sending');
    inFlight.current = false;
    abortRef.current = null;
  }, []);

  const onPickFile = useCallback(
    (next: File | null) => {
      if (inFlight.current) return;
      setFile(next);
      setResult(null);
      setError(null);
      setPhase('idle');
      // Drop a provider that cannot take the new file, rather than silently failing later.
      if (next && selectedProvider) {
        const check = validateForProvider(next, {
          id: selectedProvider.id,
          maxFileSizeBytes: effectiveMaxSize(selectedProvider),
          blockedExtensions: selectedProvider.id === 'catbox' ? CATBOX_BLOCKED_EXTENSIONS : undefined,
        });
        if (!check.ok && selectedProvider.id === providerId) {
          setProviderId(null);
        }
      }
    },
    [selectedProvider, providerId],
  );

  const submit = useCallback(async () => {
    if (inFlight.current || !file || !selectedProvider) return;
    if (fileCheck && !fileCheck.ok) {
      setError(fileCheck.error ?? 'That file cannot be uploaded here.');
      setPhase('error');
      return;
    }

    inFlight.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase('uploading');
    setError(null);
    setResult(null);
    setPercent(0);
    setUploadPhase('sending');

    try {
      const normalized = await performUpload({
        providerId: selectedProvider.id,
        file,
        options: selectedProvider.id === 'vltcs' ? { expiry } : {},
        signal: controller.signal,
        onProgress: (event) => {
          setPercent(event.percent);
          // 100% on the wire, but the provider still has to answer.
          if (event.percent >= 100) setUploadPhase('waiting');
        },
      });
      setResult({ ...normalized, provider: selectedProvider });
      setPercent(100);
      setPhase('success');
    } catch (err) {
      const uploadError = err instanceof UploadError ? err : null;
      if (uploadError?.code === 'cancelled') {
        setPhase('idle');
        setPercent(0);
        return;
      }
      setError(describeError(err));
      setPhase('error');
    } finally {
      inFlight.current = false;
      abortRef.current = null;
    }
  }, [file, selectedProvider, fileCheck, expiry]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <main>
      <Header />

      <div className="flex flex-col gap-5">
        <FileDropzone file={file} onFile={onPickFile} disabled={busy} error={phase === 'error' ? error : null} />

        <ProviderSelector
          providers={selectable}
          selectedId={providerId}
          onSelect={setProviderId}
          fileSize={file?.size ?? null}
          disabled={busy}
          acknowledged={acknowledged}
          onAcknowledge={(id, value) => setAcknowledged((prev) => ({ ...prev, [id]: value }))}
        />

        {selectedProvider?.id === 'vltcs' && !busy ? (
          <div className="panel flex items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="vltcs-expiry" className="label-mono">
              Link expiry
            </label>
            <select
              id="vltcs-expiry"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="rounded-lg border border-white/12 bg-ink-850 px-3 py-1.5 font-mono text-xs text-white/85"
            >
              {VLTCS_EXPIRY_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {phase === 'error' && error ? (
          <p role="alert" className="panel border-rose-500/30 bg-rose-500/[0.07] p-3.5 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {busy && file && selectedProvider ? (
          <UploadProgress
            percent={percent}
            phase={uploadPhase}
            providerName={selectedProvider.name}
            fileName={file.name}
            onCancel={cancel}
          />
        ) : null}

        {phase === 'success' && result ? (
          <UploadResult
            key={result.url}
            url={result.url}
            providerName={result.provider.name}
            fileName={file?.name ?? ''}
            onReset={reset}
          />
        ) : null}

        <button type="button" className="btn-primary" onClick={submit} disabled={!canUpload}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-white/30">
          Files are sent straight from your browser to the provider you pick. Anything you upload becomes public
          according to that provider&apos;s policy — do not upload anything sensitive.
        </p>

        <UnavailableList providers={unavailable} />
      </div>
    </main>
  );
}

function UnavailableList({ providers }: { providers: ProviderMeta[] }) {
  if (providers.length === 0) return null;
  return (
    <details className="panel mt-2 px-4 py-3">
      <summary className="cursor-pointer text-xs font-medium text-white/45">
        {providers.length} audited provider{providers.length > 1 ? 's are' : ' is'} unavailable here — see why
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {providers.map((provider) => (
          <li key={provider.id} className="border-l-2 border-white/10 pl-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/70">{provider.name}</span>
              <span className="tag-dark text-white/40">{provider.status}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/35">{provider.notes}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}