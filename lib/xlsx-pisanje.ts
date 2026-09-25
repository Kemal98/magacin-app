import { strToU8, zipSync } from "fflate";

/**
 * Minimalan, pouzdan pisac .xlsx fajlova: listovi s tekstom i pravim brojevima (ne tekstom), zaglavljem,
 * zamrznutim prvim redom, širinama kolona, formatima za KM i količine i (nije obavezno) redom zbira.
 * Bez vanjskih biblioteka osim kompresije, da izvoz bude lak i predvidljiv.
 */

export type TipKolone = "tekst" | "broj" | "kolicina" | "km";
export type Kolona = { naslov: string; tip: TipKolone; sirina?: number };
export type Celija = string | number | null;
export type List = {
  naziv: string;
  kolone: Kolona[];
  redovi: Celija[][];
  /** Red zbira na kraju, podebljan. */
  zbir?: Celija[];
};

// Isti mehanizam zaokruživanja kao pri prikazu iznosa na ekranu (Intl), da se izvezeni i prikazani iznosi
// uvijek poklapaju (npr. 1,005 se na ekranu i u fajlu zaokružuje na 1,01).
const DVIJE_DECIMALE = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** KM se zapisuje na dvije decimale, isto kao što se prikazuje na ekranu. */
export const zaokruziKm = (v: number) => Number(DVIJE_DECIMALE.format(v));

// Indeksi stilova u xl/styles.xml
const STIL = { zaglavlje: 1, km: 2, kolicina: 3, broj: 4, boldTekst: 5, boldKm: 6, boldKolicina: 7, boldBroj: 8 } as const;

const stilZa = (tip: TipKolone, bold: boolean): number =>
  bold
    ? { tekst: STIL.boldTekst, km: STIL.boldKm, kolicina: STIL.boldKolicina, broj: STIL.boldBroj }[tip]
    : { tekst: 0, km: STIL.km, kolicina: STIL.kolicina, broj: STIL.broj }[tip];

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
// Znakovi koje XML 1.0 ne dozvoljava izbacuju se, da fajl uvijek ostane ispravan.
const NEDOZVOLJENO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const xml = (t: string) => t.replace(NEDOZVOLJENO, "").replace(/[&<>"]/g, (c) => ESC[c]);

/** Excel ne dozvoljava \ / ? * [ ] : u nazivu lista, a naziv ima najviše 31 znak. */
export function nazivListaZaExcel(naziv: string): string {
  const cist = naziv.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim();
  return (cist || "List").slice(0, 31).trim();
}

function slovo(indeks: number): string {
  let s = "";
  for (let n = indeks + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function celija(kolona: number, red: number, v: Celija, tip: TipKolone, bold: boolean): string {
  if (v === null || v === "") return "";
  const ref = `${slovo(kolona)}${red}`;
  const s = stilZa(tip, bold);
  if (typeof v === "number" && Number.isFinite(v)) {
    const vrijednost = tip === "km" ? zaokruziKm(v) : v;
    return `<c r="${ref}"${s ? ` s="${s}"` : ""}><v>${vrijednost}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ""}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
}

function listXml(list: List): string {
  const redovi: string[] = [];
  redovi.push(
    `<row r="1">${list.kolone
      .map((k, i) => `<c r="${slovo(i)}1" t="inlineStr" s="${STIL.zaglavlje}"><is><t xml:space="preserve">${xml(k.naslov)}</t></is></c>`)
      .join("")}</row>`,
  );
  const dodaj = (red: Celija[], bold: boolean) => {
    const r = redovi.length + 1;
    redovi.push(`<row r="${r}">${list.kolone.map((k, i) => celija(i, r, red[i] ?? null, k.tip, bold)).join("")}</row>`);
  };
  for (const red of list.redovi) dodaj(red, false);
  if (list.zbir) dodaj(list.zbir, true);

  const kolone = list.kolone
    .map((k, i) => {
      const sirina = k.sirina ?? (k.tip === "tekst" ? 28 : 16);
      return `<col min="${i + 1}" max="${i + 1}" width="${sirina}" customWidth="1"/>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${kolone}</cols><sheetData>${redovi.join("")}</sheetData></worksheet>`
  );
}

const STILOVI =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="165" formatCode="#,##0.###"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE2F1F3"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="9">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Pravi .xlsx fajl (bajtovi) iz listova. */
export function napraviXlsx(listovi: List[]): Uint8Array {
  if (listovi.length === 0) throw new Error("Excel fajl mora imati bar jedan list.");
  // Naziv lista mora biti jedinstven bez obzira na velika i mala slova.
  const zauzeti = new Set<string>();
  const nazivi = listovi.map((l) => {
    let naziv = nazivListaZaExcel(l.naziv);
    for (let n = 2; zauzeti.has(naziv.toLowerCase()); n++) naziv = `${naziv.slice(0, 28)} ${n}`;
    zauzeti.add(naziv.toLowerCase());
    return naziv;
  });

  const datoteke: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        listovi
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        `</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${nazivi.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        listovi
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join("") +
        `<Relationship Id="rId${listovi.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    "xl/styles.xml": strToU8(STILOVI),
  };
  listovi.forEach((l, i) => {
    datoteke[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(listXml(l));
  });
  return zipSync(datoteke);
}
