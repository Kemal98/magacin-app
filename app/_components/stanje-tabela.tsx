"use client";

import { useState } from "react";
import { km, kolicina } from "@/lib/format";

export type RedStanja = {
  id: string;
  naziv: string;
  mjera: string;
  kolicina: number;
  prosjecna_cijena: number;
  vrijednost: number;
};

/** Stanje magacina: količina, prosječna cijena i vrijednost po artiklu, s ukupnom vrijednošću. */
export function StanjeTabela({ redovi }: { redovi: RedStanja[] }) {
  const [trazi, setTrazi] = useState("");
  const [saPrazninama, setSaPrazninama] = useState(false);

  const vidljivi = redovi.filter(
    (r) =>
      (saPrazninama || r.kolicina > 0) && r.naziv.toLowerCase().includes(trazi.trim().toLowerCase()),
  );
  const ukupno = redovi.reduce((z, r) => z + r.vrijednost, 0);
  const naStanju = redovi.filter((r) => r.kolicina > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-2xl font-bold">
        Ukupna vrijednost: {km(ukupno)} <span className="text-lg font-normal text-zinc-500">({naStanju} artikala na stanju)</span>
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <input
          value={trazi}
          onChange={(e) => setTrazi(e.target.value)}
          placeholder="Traži artikal"
          aria-label="Traži artikal"
          className="min-h-14 flex-1 rounded-xl border-2 border-zinc-300 px-4 text-xl"
        />
        <label className="flex min-h-14 items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={saPrazninama}
            onChange={(e) => setSaPrazninama(e.target.checked)}
            className="size-6"
          />
          Prikaži i artikle bez zalihe
        </label>
      </div>

      {vidljivi.length === 0 ? (
        <p className="text-xl text-zinc-500">Nema artikala za prikaz.</p>
      ) : (
        <table className="w-full text-left text-lg">
          <thead>
            <tr className="border-b-2 border-zinc-300">
              <th className="py-2">Artikal</th>
              <th className="py-2 text-right">Količina</th>
              <th className="py-2 text-right">Prosj. cijena</th>
              <th className="py-2 text-right">Vrijednost</th>
            </tr>
          </thead>
          <tbody>
            {vidljivi.map((r) => (
              <tr key={r.id} className="border-b border-zinc-200">
                <td className="py-2">{r.naziv}</td>
                <td className="py-2 text-right">
                  {kolicina(r.kolicina)} {r.mjera}
                </td>
                <td className="py-2 text-right">{km(r.prosjecna_cijena)}</td>
                <td className="py-2 text-right font-semibold">{km(r.vrijednost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
