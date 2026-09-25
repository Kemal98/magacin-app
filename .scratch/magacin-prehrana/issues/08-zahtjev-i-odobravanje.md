# 08: Zahtjev i odobravanje

**What to build:** Šank šalje zahtjev za robu (u osnovnoj mjeri ili pakovanju) s velikim dugmadima na dodir. Magacioner vidi novi zahtjev odmah, odobrava puno ili manju količinu, ili odbija uz razlog. Status je odmah vidljiv objektu.

**Blocked by:** 05 (Prijem robe i stanje magacina), 07 (Popis artikala po objektu (ŠANK HOTEL))

**Status:** ready-for-agent

- [ ] Zahtjev prolazi statuse poslan, odobren (puna ili manja količina), odbijen
- [ ] Odbijanje traži razlog koji objekat vidi
- [ ] Novi zahtjev i promjena statusa vide se bez osvježavanja stranice
- [ ] Objekat može tražiti samo artikle sa svog popisa
- [ ] Testovi pokrivaju sve statuse i zabranjene prelaze
