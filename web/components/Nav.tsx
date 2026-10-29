import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/explorer", label: "Explorer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agent", label: "Agent" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-ink-950 text-cream transition group-hover:bg-brand-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight text-ink-950">
            ACH<span className="text-brand-600">.</span>
          </span>
          <span className="hidden text-[11px] text-slate-500 sm:block">autonomous clearing house</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-1.5 py-1.5 font-mono text-[11px] text-slate-500 transition hover:bg-brand-100 hover:text-ink-950 sm:px-3 sm:text-[12px]"
            >
              {l.label}
            </Link>
          ))}
          <span className="ml-2 hidden items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-brand-700 sm:flex">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-600" />
            testnet live
          </span>
        </nav>
      </div>
    </header>
  );
}
