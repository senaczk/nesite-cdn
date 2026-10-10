/** A small, non-sensitive File. Content mirrors the live audit probe. */
export function makeFile(size = 53, name = 'probe.txt', type = 'text/plain'): File {
  const seed = 'nesite cdn provider audit probe\n';
  const text = size === 0 ? '' : size <= seed.length ? seed.slice(0, size) : seed + 'x'.repeat(size - seed.length);
  return new File([text], name, { type });
}

export function makeRequest(fields: { provider?: string; file?: File | null; extra?: Record<string, string> }): Request {
  const form = new FormData();
  if (fields.provider !== undefined) form.append('provider', fields.provider);
  if (fields.file) form.append('file', fields.file, fields.file.name);
  for (const [key, value] of Object.entries(fields.extra ?? {})) form.append(key, value);
  return new Request('http://localhost/api/upload-proxy', { method: 'POST', body: form });
}

export async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}