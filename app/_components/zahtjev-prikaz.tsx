import { datumVrijeme, kolicina as fmt } from "@/lib/format";
import { NAZIV_STATUSA, type StavkaZahtjeva, type Zahtjev } from "@/lib/zahtjevi-tipovi";

const BOJA_STATUSA = {
  poslan: "bg-amber-100 text-amber-900 border-amber-500",
  odobren: "bg-green-100 text-green-900 border-green-700",
  odbijen: "bg-red-100 text-red-900 border-red-700",
} as const;

export function StatusOznaka({ status }: { status: Zahtjev["status"] }) {
  return (
    <span className={`rounded-full border-2 px-4 py-1 text-lg font-bold ${BOJA_STATUSA[status]}`}>
      {NAZIV_STATUSA[status]}
    </span>
  );
}

/** "2 kutija (20 kg)" ili "5 kg". */
export function kolicinaTekst(kol: number, osnovna: number, s: StavkaZahtjeva): string {
  return s.pakovanje ? `${fmt(kol)} ${s.pakovanje} (${fmt(osnovna)} ${s.mjera})` : `${fmt(kol)} ${s.mjera}`;
}

/** Zahtjev bez radnji: ko, kada, stavke i (ako je odlučeno) odobrene količine ili razlog odbijanja. */
export function ZahtjevKartica({ z, pokaziObjekat = false }: { z: Zahtjev; pokaziObjekat?: boolean }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-300 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {pokaziObjekat && <p className="text-2xl font-bold">{z.objekat}</p>}
          <p className="text-lg text-zinc-500">
            {z.poslao}, {datumVrijeme(z.vrijeme)}
          </p>
        </div>
        <StatusOznaka status={z.status} />
      </div>

      <ul className="flex flex-col gap-1 text-xl">
        {z.stavke.map((s) => {
          const manje =
            z.status === "odobren" && s.odobrena_kolicina !== null && s.odobrena_kolicina < s.trazena_kolicina;
          return (
            <li key={s.id}>
              <span className="font-semibold">{s.naziv}</span>: traženo {kolicinaTekst(s.trazena_kolicina, s.trazena_osnovna, s)}
              {z.status === "odobren" && s.odobrena_kolicina !== null && (
                <span className={manje ? "font-bold text-amber-800" : "text-green-800"}>
                  {" "}
                  → odobreno {kolicinaTekst(s.odobrena_kolicina, s.odobrena_osnovna ?? 0, s)}
                  {manje && " (manje od traženog)"}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {z.status === "odbijen" && (
        <p className="text-xl font-semibold text-red-800">Razlog odbijanja: {z.razlog}</p>
      )}
      {z.status !== "poslan" && z.odobrio && (
        <p className="text-lg text-zinc-500">
          {z.status === "odobren" ? "Odobrio" : "Odbio"}: {z.odobrio}
          {z.odluka_vrijeme && `, ${datumVrijeme(z.odluka_vrijeme)}`}
        </p>
      )}
    </li>
  );
}
