/**
 * Shared between the browser client and the serverless proxy so the two can
 * never disagree about the ceiling.
 *
 * Vercel documents a 4.5 MB request body limit for serverless functions. We sit
 * just under it so the multipart overhead still fits. Proxied providers are
 * therefore limited to small files — a real, measured limitation of routing an
 * upload through a function, not a guess.
 */
export const PROXY_BODY_LIMIT_BYTES = 4 * 1024 * 1024;