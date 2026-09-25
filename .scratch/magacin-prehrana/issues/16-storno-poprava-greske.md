# 16: Storno: poništavanje greške

**What to build:** Menadžer može poništiti pogrešan prijem, izdavanje ili otpis uz razlog. Stanje se vraća, a trag ostaje: ništa se ne briše niti mijenja.

**Blocked by:** 09 (Izdavanje ("na dostavi")), 13 (Otpis magacina)

**Status:** done

- [x] Storno vraća stanje magacina i zalihe objekta u ispravno
- [x] Storno traži razlog i bilježi ko ga je uradio
- [x] Originalni zapis ostaje vidljiv uz oznaku storna
- [x] Samo menadžer može poništavati
