# 20: Vercel i Supabase u oblaku

**What to build:** Aplikacija se objavljuje na Vercelu i povezuje sa Supabase projektom u oblaku, da tableti u magacinu i ŠANK HOTEL mogu raditi na istoj bazi. Zahtijeva tvoje prijave na Vercel i Supabase, pa je zadatak za čovjeka; agent priprema korake i provjere.

**Blocked by:** 02 (Prijava i uloge)

**Status:** ready-for-human

- [ ] Vercel projekat povezan s GitHub repozitorijem i objavljuje glavnu granu
- [ ] Supabase projekat u oblaku s primijenjenim migracijama
- [ ] Tablet u magacinu i tablet u ŠANK HOTEL vide iste podatke u realnom vremenu
- [ ] Ključevi i lozinke nisu u repozitoriju (samo u okruženju)
- [ ] U Supabase projektu u oblaku je javna registracija isključena (Authentication → Sign In / Providers → "Allow new users to sign up" isključeno), kao i u lokalnoj konfiguraciji
- [ ] Šema `magacin` je izložena kroz API u oblaku (Settings → API → Exposed schemas)
