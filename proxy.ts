import { SUPABASE_JAVNI_KLJUC, SUPABASE_URL } from "@/lib/supabase/okruzenje";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Osvježava prijavu i šalje neprijavljene na ekran za prijavu.
 * Ovo je samo brza provjera; prava provjera uloge radi se u bazi.
 */
export async function proxy(zahtjev: NextRequest) {
  let odgovor = NextResponse.next({ request: zahtjev });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_JAVNI_KLJUC,
    {
      cookies: {
        getAll: () => zahtjev.cookies.getAll(),
        setAll: (zapisi) => {
          zapisi.forEach(({ name, value }) => zahtjev.cookies.set(name, value));
          odgovor = NextResponse.next({ request: zahtjev });
          zapisi.forEach(({ name, value, options }) =>
            odgovor.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const naPrijavi = zahtjev.nextUrl.pathname.startsWith("/prijava");
  if (!user && !naPrijavi) {
    return NextResponse.redirect(new URL("/prijava", zahtjev.url));
  }
  return odgovor;
}

export const config = {
  // Bez internih fajlova i javnih statičkih fajlova (slike, ikone, manifest).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|webmanifest)$).*)",
  ],
};
