import Link from "next/link";
import { Ikona, type ImeIkone } from "./ikone";

/** Velika pločica za početne ekrane: ikona, naslov, kratak opis i (nije obavezno) broj u crvenoj znački. */
export function Plocica({
  href,
  naslov,
  opis,
  ikona,
  znacka,
}: {
  href: string;
  naslov: string;
  opis: string;
  ikona: ImeIkone;
  znacka?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm active:bg-brand-soft"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Ikona ime={ikona} className="size-8" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-2xl font-bold">
          {naslov}
          {znacka !== undefined && znacka > 0 && (
            <span className="rounded-full bg-red-700 px-2.5 py-0.5 text-lg font-bold text-white">{znacka}</span>
          )}
        </span>
        <span className="text-lg text-zinc-500">{opis}</span>
      </span>
      <Ikona ime="strelica" className="size-6 shrink-0 text-zinc-400" />
    </Link>
  );
}
