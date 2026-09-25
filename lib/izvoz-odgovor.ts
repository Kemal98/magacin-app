import { XLSX_TIP } from "@/lib/izvoz";

/** Odgovor za preuzimanje Excel fajla; bez keširanja, jer su podaci uvijek svježi. */
export function xlsxOdgovor(bajtovi: Uint8Array, imeFajla: string): Response {
  return new Response(new Blob([bajtovi as BlobPart], { type: XLSX_TIP }), {
    headers: {
      "Content-Type": XLSX_TIP,
      "Content-Disposition": `attachment; filename="${imeFajla}"`,
      "Cache-Control": "no-store",
    },
  });
}
