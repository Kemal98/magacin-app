# 09: Izdavanje ("na dostavi")

**What to build:** Magacioner označava odobreni zahtjev kao "na dostavi", po potrebi skenerom. Roba se skida sa zalihe magacina i ulazi u zalihu objekta. Izdavanje iznad stanja je blokirano. Ne knjiži trošak.

**Blocked by:** 08 (Zahtjev i odobravanje), 06 (Skener bar koda)

**Status:** done

- [x] Izdavanje skida zalihu magacina i povećava zalihu objekta po prosječnoj cijeni izdatog
- [x] Izdavanje iznad stanja magacina se odbija s jasnom porukom
- [x] Paralelno izdavanje istog artikla ne može preći stanje
- [x] Izdavanje ne stvara trošak objekta
- [x] Status zahtjeva postaje "na dostavi" i vidljiv je objektu
