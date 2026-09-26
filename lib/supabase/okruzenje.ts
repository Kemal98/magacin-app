/**
 * Adresa i javni ključ projekta. Vrijednosti zalijepljene u Vercel često dobiju razmak, novi red ili kosu
 * crtu na kraju; to se ovdje čisti da prijava ne pukne zbog nevidljivog znaka.
 * (NEXT_PUBLIC_ varijable se ugrađuju pri gradnji, pa se moraju pisati doslovno.)
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
export const SUPABASE_JAVNI_KLJUC = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
