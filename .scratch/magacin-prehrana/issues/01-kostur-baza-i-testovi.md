# 01: Kostur: lokalna baza, migracije i test okvir

**What to build:** Razvojno okruženje u kojem se poslovna pravila pišu u bazi i testiraju direktno: lokalna Supabase instanca (uz Docker), migracije šeme i okvir za testove koji pozivaju operacije baze. Jedan probni slučaj pokazuje da cijeli put (migracija → operacija → provjera) radi.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Lokalna baza se pokreće jednom naredbom i migracije se primjenjuju od nule
- [x] Test okvir poziva operaciju u bazi i provjerava rezultat, počevši od praznog stanja svaki put
- [x] Jedan probni test prolazi i pokazuje obrazac za sve ostale zadatke
- [x] Kratko uputstvo u repozitoriju kako pokrenuti bazu i testove
