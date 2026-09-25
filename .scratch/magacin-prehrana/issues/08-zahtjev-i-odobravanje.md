# 08: Zahtjev i odobravanje

**What to build:** Šank šalje zahtjev za robu (u osnovnoj mjeri ili pakovanju) s velikim dugmadima na dodir. Magacioner vidi novi zahtjev odmah, odobrava puno ili manju količinu, ili odbija uz razlog. Status je odmah vidljiv objektu.

**Blocked by:** 05 (Prijem robe i stanje magacina), 07 (Popis artikala po objektu (ŠANK HOTEL))

**Status:** done

- [x] Zahtjev prolazi statuse poslan, odobren (puna ili manja količina), odbijen
- [x] Odbijanje traži razlog koji objekat vidi
- [x] Novi zahtjev i promjena statusa vide se bez osvježavanja stranice
- [x] Objekat može tražiti samo artikle sa svog popisa
- [x] Testovi pokrivaju sve statuse i zabranjene prelaze
