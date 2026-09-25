import { promijeniAktivnost } from "@/app/actions/sifrarnik";

/** Isključuje aktivan zapis ili ponovo uključuje isključeni. */
export function AktivnostDugme({
  vrsta,
  id,
  aktivan,
}: {
  vrsta: "artikal" | "objekat" | "dobavljac";
  id: string;
  aktivan: boolean;
}) {
  return (
    <form action={promijeniAktivnost.bind(null, vrsta, id, !aktivan)}>
      <button
        type="submit"
        className="min-h-14 rounded-xl border-2 border-zinc-300 px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200 bg-white"
      >
        {aktivan ? "Isključi" : "Uključi"}
      </button>
    </form>
  );
}
