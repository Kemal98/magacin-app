import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

/**
 * Minimalno čitanje .xlsx fajla: samo tražene tabele, samo tekst ćelija.
 * Ostale tabele (ulazi, utrošci; desetine MB) se ne raspakuju.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#t",
  parseTagValue: false,
  isArray: (ime) => ["sheet", "Relationship", "si", "r", "row", "c"].includes(ime),
});

type Cvor = Record<string, unknown>;

const niz = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Tekst iz čvora `t` koji je običan tekst ili ima atribute (xml:space). */
function tekstCvora(t: unknown): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object") return String((t as Cvor)["#t"] ?? "");
  return "";
}

function tekstStringa(si: Cvor): string {
  if (si.t !== undefined) return tekstCvora(si.t);
  return niz(si.r as Cvor[]).map((r) => tekstCvora(r.t)).join("");
}

export type Tabela = Record<string, string>[]; // red = { A: "...", B: "..." }

/** Vraća tabele po nazivu lista; nedostajući list se prijavlja greškom. */
export function procitajTabele(fajl: Uint8Array, nazivi: string[]): Record<string, Tabela> {
  const zip = unzipSync(fajl, {
    filter: (f) =>
      f.name === "xl/workbook.xml" ||
      f.name === "xl/_rels/workbook.xml.rels" ||
      f.name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name) && f.originalSize < 5_000_000,
  });
  const citaj = (ime: string) => {
    const d = zip[ime];
    if (!d) throw new Error(`Fajl nije ispravan Excel (nedostaje ${ime}).`);
    return parser.parse(strFromU8(d));
  };

  const radnaKnjiga = citaj("xl/workbook.xml").workbook;
  const veze = citaj("xl/_rels/workbook.xml.rels").Relationships;
  const cilj = new Map<string, string>(
    niz<Cvor>(veze.Relationship as Cvor[]).map((r) => [String(r["@Id"]), String(r["@Target"])]),
  );
  const nizovi = zip["xl/sharedStrings.xml"]
    ? niz<Cvor>(citaj("xl/sharedStrings.xml").sst?.si as Cvor[] | undefined).map(tekstStringa)
    : [];

  const izlaz: Record<string, Tabela> = {};
  for (const naziv of nazivi) {
    const list = niz<Cvor>(radnaKnjiga.sheets.sheet as Cvor[]).find((s) => s["@name"] === naziv);
    if (!list) throw new Error(`U Excelu nema lista "${naziv}".`);
    const cilj_ = cilj.get(String(list["@r:id"]));
    if (!cilj_) throw new Error(`List "${naziv}" nije pronađen u fajlu.`);
    const putanja = `xl/${cilj_.replace(/^\/?(xl\/)?/, "")}`;
    const redovi = niz<Cvor>(citaj(putanja).worksheet?.sheetData?.row as Cvor[] | undefined);
    izlaz[naziv] = redovi.map((red) => {
      const r: Record<string, string> = {};
      for (const c of niz<Cvor>(red.c as Cvor[] | undefined)) {
        const kol = String(c["@r"]).replace(/\d+/g, "");
        let v = "";
        if (c["@t"] === "s") v = nizovi[Number(tekstCvora(c.v))] ?? "";
        else if (c["@t"] === "inlineStr") v = tekstStringa((c.is as Cvor) ?? {});
        else v = tekstCvora(c.v);
        if (v !== "") r[kol] = v;
      }
      return r;
    });
  }
  return izlaz;
}
