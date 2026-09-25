# 02: Prijava i uloge

**What to build:** Magacioner i objekat se prijavljuju PIN-om uz izbor svog imena, a menadžer lozinkom. Poslije prijave svaka uloga vidi svoj prazan početni ekran na tabletu, bosanski jezik i velika dugmad. Ime prijavljene osobe se pamti da bi ga mogle bilježiti sve radnje.

**Blocked by:** 01 (Kostur: lokalna baza, migracije i test okvir)

**Status:** ready-for-agent

- [ ] Magacioner i objekat: izbor imena + PIN; menadžer: lozinka
- [ ] Svaka uloga vidi samo svoj ekran; pristup tuđim ekranima nije moguć
- [ ] Ime i vrijeme osobe dostupni su svakoj kasnijoj operaciji u bazi
- [ ] Testovi provjeravaju da uloga ne može pozivati operacije koje joj ne pripadaju
