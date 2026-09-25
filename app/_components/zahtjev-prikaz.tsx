import { datumVrijeme, kolicina as fmt } from "@/lib/format";
import { NAZIV_STATUSA, type StavkaZahtjeva, type Zahtjev } from "@/lib/zahtjevi-tipovi";

const BOJA_STATUSA = {
  poslan: "bg-amber-100 text-amber-900 border-amber-500",
  odobren: "bg-green-100 text-green-900 border-green-700",
  odbijen: "bg-red-100 text-red-900 border-red-700",
  na_dostavi: "bg-blue-100 text-blue-900 border-blue-700",
  primljeno: "bg-green-100 text-green-900 border-green-700",
  stornirano: "bg-zinc-200 text-zinc-700 border-zinc-500",
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
    <li data-red className="flex flex-col gap-3 rounded-2xl border border-zinc-300 p-4 shadow-sm bg-white">
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
          const primljeno = z.status === "primljeno";
          const krenulo = z.status === "na_dostavi" || primljeno;
          const kol = krenulo ? s.izdana_kolicina : s.odobrena_kolicina;
          const osn = krenulo ? s.izdana_osnovna : s.odobrena_osnovna;
          const odlucen = (z.status === "odobren" || krenulo) && kol !== null;
          const manje = odlucen && kol !== null && kol < s.trazena_kolicina;
          const razlika = primljeno && (s.razlika_osnovna ?? 0) !== 0;
          return (
            <li key={s.id}>
              <span className="font-semibold">{s.naziv}</span>: traženo {kolicinaTekst(s.trazena_kolicina, s.trazena_osnovna, s)}
              {odlucen && kol !== null && (
                <span className={manje ? "font-bold text-amber-800" : "text-green-800"}>
                  {" "}
                  → {krenulo ? "izdato" : "odobreno"} {kolicinaTekst(kol, osn ?? 0, s)}
                  {manje && " (manje od traženog)"}
                </span>
              )}
              {primljeno && s.primljena_kolicina !== null && (
                <span className={razlika ? "font-bold text-red-700" : "text-green-800"}>
                  {" "}
                  → primljeno {kolicinaTekst(s.primljena_kolicina, s.primljena_osnovna ?? 0, s)}
                  {razlika && ` (razlika ${fmt(s.razlika_osnovna ?? 0)} ${s.mjera})`}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {z.status === "stornirano" && (
        <p className="text-xl font-semibold text-zinc-700">
          Izdavanje je poništeno; roba nije u zalihi objekta. Ako je i dalje potrebna, pošaljite novi zahtjev.
        </p>
      )}
      {z.status === "odbijen" && (
        <p className="text-xl font-semibold text-red-800">Razlog odbijanja: {z.razlog}</p>
      )}
      {z.status !== "poslan" && z.odobrio && (
        <p className="text-lg text-zinc-500">
          {z.status === "odbijen" ? "Odbio" : "Odobrio"}: {z.odobrio}
          {z.odluka_vrijeme && `, ${datumVrijeme(z.odluka_vrijeme)}`}
        </p>
      )}
      {z.status === "primljeno" && z.primio && (
        <p className="text-lg text-zinc-500">
          Primio: {z.primio}
          {z.primljeno_vrijeme && `, ${datumVrijeme(z.primljeno_vrijeme)}`}
        </p>
      )}
      {(z.status === "na_dostavi" || z.status === "primljeno") && z.izdao && (
        <p className="text-lg text-zinc-500">
          Izdao: {z.izdao}
          {z.izdano_vrijeme && `, ${datumVrijeme(z.izdano_vrijeme)}`}
        </p>
      )}
    </li>
  );
}
