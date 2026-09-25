import { Ikona } from "./ikone";

/** Preuzimanje Excel fajla: običan link, radi bez skripte i na tabletu. */
export function IzvozDugme({ href, children = "Izvezi u Excel" }: { href: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      download
      className="inline-flex min-h-14 items-center gap-2 self-start rounded-xl border-2 border-brand bg-white px-5 text-xl font-semibold text-brand active:bg-brand-soft"
    >
      <Ikona ime="preuzmi" className="size-6" />
      {children}
    </a>
  );
}
