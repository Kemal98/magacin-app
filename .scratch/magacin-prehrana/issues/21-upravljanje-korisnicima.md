# 21: Upravljanje korisnicima

**What to build:** Menadžer dodaje, mijenja i isključuje korisnike (magacioner, osoblje objekta, drugi menadžer): ime, uloga, PIN ili lozinka i, za osoblje objekta, koji objekat. Isključena osoba se više ne nudi na ekranu za prijavu i ne može raditi. Do sada korisnike daje samo razvojni seed. (Specifikacija, priča 39; nijedan raniji zadatak ovo ne pokriva.)

**Blocked by:** 02 (Prijava i uloge), 03 (Šifrarnik: artikli, objekti, dobavljači)

**Status:** ready-for-agent

- [ ] Menadžer dodaje korisnika s imenom, ulogom i PIN-om (magacioner, objekat) ili lozinkom (menadžer)
- [ ] Osoblje objekta se veže za objekat iz šifrarnika
- [ ] Menadžer mijenja ime, PIN i lozinku i isključuje korisnika
- [ ] Isključen korisnik nestaje s ekrana za prijavu i njegova prijava se odbija
- [ ] Samo menadžer može upravljati korisnicima
