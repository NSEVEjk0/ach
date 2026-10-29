import Link from "next/link";

/** A quiet "back to overview" link for inner pages. */
export default function BackButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition hover:text-ink-950"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to overview
    </Link>
  );
}
