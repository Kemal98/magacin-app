import Link from "next/link";
import { Ikona } from "./ikone";

/** Povratak na prethodni ekran: velika, jasna ciljna površina za dodir. */
export function Nazad({ href, children = "Nazad" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-2 self-start rounded-xl px-3 text-xl font-semibold text-brand active:bg-brand-soft"
    >
      <Ikona ime="nazad" className="size-6" />
      {children}
    </Link>
  );
}
