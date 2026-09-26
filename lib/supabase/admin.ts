import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/okruzenje";

/**
 * Administratorski klijent (tajni ključ, zaobilazi pravila pristupa). Smije se koristiti samo na serveru,
 * u Server Actionima koji su prethodno provjerili ulogu; nikad u komponentama za preglednik.
 */
export function napraviAdminKlijent() {
  const url = SUPABASE_URL;
  const kljuc = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !kljuc) {
    throw new Error("Nedostaje SUPABASE_SERVICE_ROLE_KEY (vidi .env.example).");
  }
  return createClient(url, kljuc, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "magacin" },
  });
}
