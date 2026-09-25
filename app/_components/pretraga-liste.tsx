"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { poklapa } from "@/lib/pretraga";

/**
 * Traži po sadržaju liste ili tabele unutar sebe. Redovi se označavaju atributom `data-red` (i, ako u njima
 * ima polja za unos, `data-trazi` s tekstom po kojem se traži). Radi i nad sadržajem koji je već iscrtan na
 * serveru: redovi koji se ne poklapaju se samo sakriju. `grupa` (nije obavezno) je oznaka kartice ili odjeljka
 * koji se sakriva kad u njemu nema nijednog vidljivog reda.
 */
export function PretragaListe({
  placeholder = "Traži…",
  grupa,
  children,
}: {
  placeholder?: string;
  /** Selektor odjeljka koji se sakriva kad su mu svi redovi sakriveni. */
  grupa?: string;
  children: React.ReactNode;
}) {
  const korijen = useRef<HTMLDivElement>(null);
  const [upit, setUpit] = useState("");
  const [brojevi, setBrojevi] = useState<{ vidljivo: number; ukupno: number }>({ vidljivo: 0, ukupno: 0 });

  const primijeni = useCallback(
    (tekst: string) => {
      const el = korijen.current;
      if (!el) return;
      const redovi = [...el.querySelectorAll<HTMLElement>("[data-red]")];
      let vidljivo = 0;
      for (const r of redovi) {
        const prikazi = poklapa(r.dataset.trazi ?? r.textContent ?? "", tekst);
        r.hidden = !prikazi;
        r.style.display = prikazi ? "" : "none";
        if (prikazi) vidljivo++;
      }
      if (grupa) {
        for (const g of el.querySelectorAll<HTMLElement>(grupa)) {
          const ima = [...g.querySelectorAll<HTMLElement>("[data-red]")].some((r) => !r.hidden);
          const sakrij = tekst.trim() !== "" && !ima;
          g.hidden = sakrij;
          g.style.display = sakrij ? "none" : "";
        }
      }
      setBrojevi({ vidljivo, ukupno: redovi.length });
    },
    [grupa],
  );

  // Sadržaj se može osvježiti (automatsko osvježavanje ekrana): filter se tada primijeni ponovo.
  useEffect(() => {
    const el = korijen.current;
    if (!el) return;
    primijeni(upit);
    const posmatrac = new MutationObserver(() => primijeni(upit));
    posmatrac.observe(el, { childList: true, subtree: true });
    return () => posmatrac.disconnect();
  }, [upit, primijeni]);

  const traziSe = upit.trim() !== "";
  return (
    <div ref={korijen} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={upit}
          onChange={(e) => setUpit(e.target.value)}
          onKeyDown={(e) => {
            // Enter u polju za pretragu (i skener) ne smije poslati nijednu formu na stranici.
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className="min-h-14 min-w-64 flex-1 rounded-xl border-2 border-zinc-300 bg-white px-4 text-xl"
        />
        {traziSe && (
          <button
            type="button"
            onClick={() => setUpit("")}
            className="min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
          >
            Očisti
          </button>
        )}
      </div>
      {traziSe && (
        <p role="status" className="text-lg text-zinc-600">
          {brojevi.vidljivo === 0
            ? "Nema rezultata za ovu pretragu."
            : `Prikazano ${brojevi.vidljivo} od ${brojevi.ukupno}`}
        </p>
      )}
      {children}
    </div>
  );
}
