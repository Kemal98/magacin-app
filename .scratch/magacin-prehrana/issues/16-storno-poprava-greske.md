# 16: Storno: poništavanje greške

**What to build:** Menadžer može poništiti pogrešan prijem, izdavanje ili otpis uz razlog. Stanje se vraća, a trag ostaje: ništa se ne briše niti mijenja.

**Blocked by:** 09 (Izdavanje ("na dostavi")), 13 (Otpis magacina)

**Status:** ready-for-agent

- [ ] Storno vraća stanje magacina i zalihe objekta u ispravno
- [ ] Storno traži razlog i bilježi ko ga je uradio
- [ ] Originalni zapis ostaje vidljiv uz oznaku storna
- [ ] Samo menadžer može poništavati
