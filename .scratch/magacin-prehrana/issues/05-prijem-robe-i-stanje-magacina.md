# 05: Prijem robe i stanje magacina

**What to build:** Magacioner unosi prijem od dobavljača (artikal, količina u osnovnoj mjeri ili pakovanju, nabavna cijena u KM bez PDV-a). Prosječna cijena se preračunava, a stanje magacina s vrijednošću je odmah vidljivo. Ime i vrijeme se bilježe.

**Blocked by:** 03 (Šifrarnik: artikli, objekti, dobavljači)

**Status:** done

- [x] Pakovanje se pretvara u osnovnu mjeru pri prijemu
- [x] Prosječna cijena je ponderisana i mijenja se s prijemom po drugoj cijeni
- [x] Pregled stanja pokazuje količinu i vrijednost po artiklu i ukupno
- [x] Prijem se bilježi u nepromjenjivu knjigu s imenom osobe i vremenom
- [x] Testovi pokrivaju više prijema po različitim cijenama
