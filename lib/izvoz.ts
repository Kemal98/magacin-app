import type { RedStanja } from "@/app/_components/stanje-tabela";
import { poArtiklu, poObjektu, ukupanTrosak, zbir, type RedIzvjestaja } from "@/lib/izvjestaji-tipovi";
import type { ZaNaruciti } from "@/lib/minimum";
import type { List } from "@/lib/xlsx-pisanje";

export const XLSX_TIP = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Stanje magacina s vrijednošću i popis artikala ispod minimuma. */
export function stanjeUListove(stanje: RedStanja[], zaNaruciti: ZaNaruciti[]): List[] {
  const ukupno = stanje.reduce((z, r) => z + r.vrijednost, 0);
  return [
    {
      naziv: "Stanje magacina",
      kolone: [
        { naslov: "Artikal", tip: "tekst", sirina: 42 },
        { naslov: "Mjera", tip: "tekst", sirina: 8 },
        { naslov: "Količina", tip: "kolicina" },
        { naslov: "Prosječna cijena (KM)", tip: "km" },
        { naslov: "Vrijednost (KM)", tip: "km" },
        { naslov: "Minimum", tip: "kolicina" },
        { naslov: "Ispod minimuma", tip: "tekst", sirina: 16 },
      ],
      redovi: stanje.map((r) => [r.naziv, r.mjera, r.kolicina, r.prosjecna_cijena, r.vrijednost, r.minimum, r.ispod_minimuma ? "DA" : "NE"]),
      zbir: ["UKUPNO", null, null, null, ukupno, null, null],
    },
    {
      naziv: "Za naručivanje",
      kolone: [
        { naslov: "Artikal", tip: "tekst", sirina: 42 },
        { naslov: "Mjera", tip: "tekst", sirina: 8 },
        { naslov: "Na stanju", tip: "kolicina" },
        { naslov: "Minimum", tip: "kolicina" },
        { naslov: "Nedostaje", tip: "kolicina" },
      ],
      redovi: zaNaruciti.map((a) => [a.naziv, a.mjera, Number(a.kolicina), Number(a.minimum), Number(a.nedostaje)]),
    },
  ];
}

export type PodaciIzvoza = { od: string; do: string; objekat: string; izvezao: string; izvezeno: string };

/** Trošak i potrošnja, zbirovi po objektu i artiklu te izdato/potrošeno/zaliha, za izabrani period. */
export function izvjestajUListove(redovi: RedIzvjestaja[], podaci: PodaciIzvoza): List[] {
  const ukupno = zbir(redovi);
  const sPotrosnjom = redovi.filter((r) => r.potroseno > 0 || r.izuzeci > 0);
  const poRedu = [...sPotrosnjom].sort(
    (a, b) => a.objekat.localeCompare(b.objekat, "bs") || a.artikal.localeCompare(b.artikal, "bs"),
  );

  return [
    {
      naziv: "Trošak i potrošnja",
      kolone: [
        { naslov: "Objekat", tip: "tekst", sirina: 26 },
        { naslov: "Artikal", tip: "tekst", sirina: 42 },
        { naslov: "Mjera", tip: "tekst", sirina: 8 },
        { naslov: "Potrošeno", tip: "kolicina" },
        { naslov: "Trošak potrošnje (KM)", tip: "km", sirina: 22 },
        { naslov: "Izuzeci", tip: "kolicina" },
        { naslov: "Trošak izuzetaka (KM)", tip: "km", sirina: 22 },
        { naslov: "Ukupan trošak (KM)", tip: "km", sirina: 20 },
      ],
      redovi: poRedu.map((r) => [r.objekat, r.artikal, r.mjera, r.potroseno, r.trosak_potrosnje, r.izuzeci, r.trosak_izuzetaka, ukupanTrosak(r)]),
      zbir: ["UKUPNO", null, null, null, ukupno.trosak_potrosnje, null, ukupno.trosak_izuzetaka, ukupanTrosak(ukupno)],
    },
    {
      naziv: "Po objektu",
      kolone: [
        { naslov: "Objekat", tip: "tekst", sirina: 26 },
        { naslov: "Trošak potrošnje (KM)", tip: "km", sirina: 22 },
        { naslov: "Trošak izuzetaka (KM)", tip: "km", sirina: 22 },
        { naslov: "Ukupan trošak (KM)", tip: "km", sirina: 20 },
        { naslov: "Vrijednost izdatog (KM)", tip: "km", sirina: 24 },
      ],
      redovi: poObjektu(redovi).map((g) => [g.objekat, g.zbir.trosak_potrosnje, g.zbir.trosak_izuzetaka, ukupanTrosak(g.zbir), g.zbir.vrijednost_izdatog]),
      zbir: ["UKUPNO", ukupno.trosak_potrosnje, ukupno.trosak_izuzetaka, ukupanTrosak(ukupno), ukupno.vrijednost_izdatog],
    },
    {
      naziv: "Po artiklu",
      kolone: [
        { naslov: "Artikal", tip: "tekst", sirina: 42 },
        { naslov: "Mjera", tip: "tekst", sirina: 8 },
        { naslov: "Potrošeno", tip: "kolicina" },
        { naslov: "Izuzeci", tip: "kolicina" },
        { naslov: "Trošak potrošnje (KM)", tip: "km", sirina: 22 },
        { naslov: "Ukupan trošak (KM)", tip: "km", sirina: 20 },
      ],
      redovi: poArtiklu(redovi)
        .filter((a) => a.potroseno > 0 || a.izuzeci > 0)
        .map((a) => [a.artikal, a.mjera, a.potroseno, a.izuzeci, a.trosak_potrosnje, ukupanTrosak(a)]),
      zbir: ["UKUPNO", null, null, null, ukupno.trosak_potrosnje, ukupanTrosak(ukupno)],
    },
    {
      naziv: "Izdato i potrošeno",
      kolone: [
        { naslov: "Objekat", tip: "tekst", sirina: 26 },
        { naslov: "Artikal", tip: "tekst", sirina: 42 },
        { naslov: "Mjera", tip: "tekst", sirina: 8 },
        { naslov: "Izdato", tip: "kolicina" },
        { naslov: "Potrošeno", tip: "kolicina" },
        { naslov: "Razlika (izdato − potrošeno)", tip: "kolicina", sirina: 28 },
        { naslov: "Izuzeci", tip: "kolicina" },
        { naslov: "Manjak pri prijemu", tip: "kolicina", sirina: 20 },
        { naslov: "Višak pri zatvaranju", tip: "kolicina", sirina: 22 },
        { naslov: "Zaliha objekta (sada)", tip: "kolicina", sirina: 22 },
        { naslov: "Vrijednost izdatog (KM)", tip: "km", sirina: 24 },
      ],
      redovi: [...redovi]
        .sort((a, b) => a.objekat.localeCompare(b.objekat, "bs") || a.artikal.localeCompare(b.artikal, "bs"))
        .map((r) => [r.objekat, r.artikal, r.mjera, r.izdato, r.potroseno, r.razlika, r.izuzeci, r.manjak, r.visak, r.zaliha_sada, r.vrijednost_izdatog]),
      zbir: ["UKUPNO", null, null, null, null, null, null, null, null, null, ukupno.vrijednost_izdatog],
    },
    {
      naziv: "Podaci",
      kolone: [
        { naslov: "Stavka", tip: "tekst", sirina: 20 },
        { naslov: "Vrijednost", tip: "tekst", sirina: 30 },
      ],
      redovi: [
        ["Od", podaci.od],
        ["Do", podaci.do],
        ["Objekat", podaci.objekat],
        ["Izvezao", podaci.izvezao],
        ["Izvezeno", podaci.izvezeno],
        ["Napomena", "Iznosi su u KM bez PDV-a, po cijeni pri izdavanju."],
      ],
    },
  ];
}
