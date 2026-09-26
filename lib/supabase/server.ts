import { SUPABASE_JAVNI_KLJUC, SUPABASE_URL } from "@/lib/supabase/okruzenje";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase klijent za server (Server Components i Server Actions), vezan za prijavu iz kolačića. */
export async function napraviServerKlijent() {
  const kolacici = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_JAVNI_KLJUC,
    {
      db: { schema: "magacin" },
      cookies: {
        getAll: () => kolacici.getAll(),
        setAll: (zapisi) => {
          try {
            zapisi.forEach(({ name, value, options }) =>
              kolacici.set(name, value, options),
            );
          } catch {
            // Poziv iz Server Component-e ne smije postavljati kolačiće;
            // proxy osvježava prijavu, pa se ovo može zanemariti.
          }
        },
      },
    },
  );
}
