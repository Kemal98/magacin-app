# 22: Zaštita PIN prijave od pogađanja

**What to build:** Šestocifreni PIN ima samo milion mogućnosti, a imena za prijavu se vide bez prijave (potrebna su da tablet ponudi izbor). Napadač u mreži centra bi mogao pokušavati PIN-ove za poznato ime. Ovaj zadatak dodaje zaštitu: privremeno zaključavanje računa poslije više uzastopnih pogrešnih pokušaja i pregled toga za menadžera. Pronađeno u pregledu koda zadatka 02; Supabase po IP adresi već ograničava broj pokušaja, ali ne po računu.

**Blocked by:** 02 (Prijava i uloge), 21 (Upravljanje korisnicima)

**Status:** done

- [x] Poslije određenog broja uzastopnih pogrešnih PIN-ova račun se privremeno zaključava (npr. 5 pokušaja, 15 minuta)
- [x] Zaključan račun jasno javlja razlog i ne pokazuje da li je PIN blizu tačnog
- [x] Menadžer vidi zaključane račune i može ih odmah otključati
- [x] Uspješna prijava poništava brojač pogrešnih pokušaja
- [x] Testovi u bazi pokrivaju zaključavanje, isteka vremena i otključavanje
