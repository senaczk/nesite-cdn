export function Header() {
  return (
    <header className="mb-8 text-center sm:mb-10">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-cyan opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-cyan" />
        </span>
        <span className="font-mono text-[11px] tracking-[0.22em] text-white/55">NESITE CDN</span>
      </div>

      <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
        <span className="neon-text">Upload Once.</span>
        <br className="sm:hidden" />{' '}
        <span className="text-white">Share Everywhere.</span>
      </h1>

      <p className="mx-auto mt-4 max-w-md text-sm text-white/50 sm:text-base">One interface. Multiple file hosts.</p>
    </header>
  );
}