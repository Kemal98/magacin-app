Status: ready-for-agent

# Magacin prehrane i ŠANK HOTEL: evidencija robe i troškova

## Problem Statement

Sportski centar (oko 400.000 m²) ima magacin prehrane i magacin materijala, iz kojih roba odlazi u desetine objekata (kuhinja, šankovi, pizzerie, švedski sto, sobarice, spa i dr.). Danas se potrošnja svakog objekta piše ručno na papir, a jedna plaćena osoba te papire prepisuje u Excel (artikli, ulazi, utrošci, zalihe). To je sporo, skupo i podložno greškama: zaliha često ode u minus (55 od 485 artikala), jedinice su pomiješane, datumi nevaljani, a odgovor na pitanja "šta je potrošeno, koliko košta i šta je ostalo" stiže kasno i nije pouzdan. Magacin i objekti nemaju zajednički, trenutan pogled na to gdje je koja roba.

## Solution

Web aplikacija (radi u pregledniku na Lenovo tabletima s dodirom) koja zamjenjuje papir i prepisivanje. Magacioner unosi **prijem** (skenerom bar koda ili ručnim izborom), objekat šalje **zahtjev**, magacioner ga odobri i označi **na dostavi**, a objekat na svom fiksnom tabletu jednim dodirom potvrdi **primljeno** (uz mogućnost upisa razlike). Izdata roba postaje **zaliha objekta**. Na kraju **smjene** objekat upiše završno stanje, a razlika je **evidencija potrošnje** i time **trošak objekta**, izražen u KM bez PDV-a po cijeni pri izdavanju. Magacin ima **otpis**, **popis** i **minimum zaliha** s upozorenjima. **Menadžer** vidi i kontroliše sve u magacinu i objektima i dobija izvještaje (trošak po objektu za period, stanje s vrijednošću, potrošnja po artiklu, upozorenja) s izvozom u Excel.

Prvi test obuhvata **magacin prehrane** i jedan objekat, **ŠANK HOTEL** (caffe bar u Hotelu Central). Ostali objekti i magacin materijala dolaze nakon uspješnog testa.

## User Stories

### Magacioner: prijem i zaliha

1. Kao magacioner, želim unijeti prijem robe s dobavljačem, artiklom, količinom i nabavnom cijenom, kako bi zaliha magacina i njena vrijednost bili tačni.
2. Kao magacioner, želim skenirati bar kod artikla pri prijemu, kako bih izbjegao ručno traženje u dugačkom popisu.
3. Kao magacioner, želim ručno izabrati artikal s liste kad nema bar koda (rasuta roba, voće, povrće), kako prijem ne bi zastao.
4. Kao magacioner, želim primiti robu u pakovanju (npr. kutija od 10 kg) i da se ona sama pretvori u osnovnu mjeru, kako evidencija uvijek bude u kg, l ili kom.
5. Kao magacioner, želim da se prosječna cijena artikla sama preračuna kad stigne nova nabavka po drugoj cijeni, kako vrijednost zalihe bude tačna bez ručnog računanja.
6. Kao magacioner, želim vidjeti trenutno stanje svakog artikla u magacinu s vrijednošću, kako znam šta imam.
7. Kao magacioner, želim vidjeti crvenu oznaku kad artikal padne ispod minimuma, kako bih na vrijeme naručio.
8. Kao magacioner, želim zadati minimum zaliha po artiklu, kako upozorenja odgovaraju stvarnim potrebama.
9. Kao magacioner, želim da mi aplikacija ne dozvoli izdati više nego što je na stanju, kako zaliha nikad ne ode u minus.
10. Kao magacioner, želim da svaka moja radnja ima moje ime i vrijeme, kako bi se znalo ko je šta uradio.

### Magacioner: zahtjevi i izdavanje

11. Kao magacioner, želim vidjeti nove zahtjeve objekata čim su poslani, bez osvježavanja stranice, kako brzo reagujem.
12. Kao magacioner, želim odobriti zahtjev punom količinom, kako objekat dobije šta traži.
13. Kao magacioner, želim odobriti manju količinu od tražene (kad nema dovoljno), kako objekat dobije koliko ima.
14. Kao magacioner, želim odbiti zahtjev uz obavezan razlog, kako objekat zna zašto nije dobio robu.
15. Kao magacioner, želim skenirati bar kod pri izdavanju, kako se roba brzo i tačno skida sa zalihe.
16. Kao magacioner, želim označiti zahtjev kao "na dostavi", kako objekat vidi da je roba krenula.
17. Kao magacioner, želim vidjeti koji su zahtjevi na dostavi, a nisu potvrđeni kao primljeni, kako znam šta je još na putu.
18. Kao magacioner, želim vidjeti razliku koju je objekat prijavio pri prijemu, kako je mogu provjeriti i riješiti.

### Magacioner: otpis i popis

19. Kao magacioner, želim otpisati robu zbog kvara, isteka roka ili lomljenja uz razlog, kako se taj trošak vidi odvojeno od potrošnje.
20. Kao magacioner, želim izvršiti popis skeniranjem i brojanjem artikala, kako se stanje u sistemu uskladi sa stvarnim.
21. Kao magacioner, želim vidjeti razliku između sistema i stvarnog stanja prije nego potvrdim popis, kako uočim greške.

### Objekat (ŠANK HOTEL): zahtjevi i prijem

22. Kao osoblje šanka, želim vidjeti samo artikle koje šank koristi, kako je popis kratak, a unos brz i bez greške.
23. Kao osoblje šanka, želim poslati zahtjev za robu s velikim dugmadima na dodir, kako mogu raditi na tabletu u toku smjene.
24. Kao osoblje šanka, želim tražiti robu u osnovnoj mjeri ili u pakovanju, kako tražim onako kako robu stvarno brojim.
25. Kao osoblje šanka, želim vidjeti status svog zahtjeva (poslan, odobren, odbijen s razlogom, na dostavi, primljeno), kako znam gdje je roba.
26. Kao osoblje šanka, želim kad roba stigne kliknuti veliko dugme "STIGLO", kako magacin ima potvrdu isporuke.
27. Kao osoblje šanka, želim pri potvrdi upisati stvarno primljenu količinu ako se razlikuje od poslane, kako se razlika zabilježi.
28. Kao osoblje šanka, želim da robu vidim u zalihi objekta odmah po potvrdi, kako znam čime raspolažem.

### Objekat (ŠANK HOTEL): potrošnja i smjena

29. Kao osoblje šanka, želim na kraju smjene upisati završno stanje po artiklu, kako aplikacija izračuna šta je potrošeno.
30. Kao osoblje šanka, želim da se početno stanje smjene preuzme iz završnog stanja prethodne smjene, kako ne moram ponovo brojati.
31. Kao osoblje šanka, želim u toku smjene dodati izuzetak (razbijeno, proliveno, otpis) s razlogom, kako se to ne miješa s običnom potrošnjom.
32. Kao osoblje šanka, želim upisati ime osobe pri zatvaranju smjene, kako se zna ko je zatvorio.
33. Kao osoblje šanka, želim da se smjena ne može zatvoriti bez završnog stanja, kako evidencija nikad ne ostane nepotpuna.
34. Kao osoblje šanka, želim upisati veće završno stanje nego što je moguće uz obavezan razlog (npr. "dobijeno od kuhinje"), kako zatvaranje smjene ne zapne zbog sitnice.
35. Kao osoblje šanka, želim vidjeti šta je bilo potrošeno u prethodnim smjenama, kako mogu provjeriti unos.

### Menadžer: kontrola i upravljanje

36. Kao menadžer, želim vidjeti sve u oba magacina i u svim objektima, kako imam potpunu kontrolu.
37. Kao menadžer, želim upravljati artiklima (naziv, osnovna mjera, pakovanja, bar kod, minimum), kako je šifrarnik uvijek ažuran.
38. Kao menadžer, želim odrediti koje artikle koji objekat vidi, kako svaki objekat dobije kratak, pravi popis.
39. Kao menadžer, želim upravljati objektima, dobavljačima i korisnicima (dodati, isključiti), kako sistem prati stvarno stanje u centru.
40. Kao menadžer, želim zadati broj smjena i satnice po objektu, kako aplikacija zna kada se smjena zatvara.
41. Kao menadžer, želim ispraviti ili poništiti grešku (pogrešan prijem, otpis, izdavanje) uz razlog, kako se pogreška ispravi, a trag ostane.
42. Kao menadžer, želim vidjeti upozorenje kad je objekat upisao veće završno stanje od mogućeg, kako mogu provjeriti da roba nije stigla mimo evidencije.
43. Kao menadžer, želim vidjeti otpis i popis odmah po unosu, bez dodatnog odobravanja, kako pratim gubitke.
44. Kao menadžer, želim vidjeti za svaki objekat i period i šta je izdato iz magacina i šta je potrošeno, kao i razliku (zaliha objekta), kako razumijem gdje je roba.

### Menadžer: izvještaji

45. Kao menadžer, želim izvještaj potrošnje i troška po objektu za dan, sedmicu ili mjesec, kako znam koliko koji objekat košta.
46. Kao menadžer, želim izvještaj stanja magacina s vrijednošću, kako znam koliko je novca u zalihama.
47. Kao menadžer, želim izvještaj potrošnje po artiklu, kako vidim koje artikle najviše trošimo.
48. Kao menadžer, želim popis artikala ispod minimuma, kako vidim šta treba naručiti.
49. Kao menadžer, želim svaki izvještaj izvesti u Excel, kako ga mogu poslati računovodstvu i dalje analizirati (npr. trošak po gostu).
50. Kao menadžer, želim izvještaje po izabranom periodu i objektu, kako mogu odgovoriti na konkretna pitanja.

### Prijava, uređaji i podaci

51. Kao magacioner ili osoblje objekta, želim da se prijavim PIN-om uz izbor svog imena, kako je prijava brza na zajedničkom tabletu.
52. Kao menadžer, želim da se prijavim lozinkom, kako je pristup svemu bolje zaštićen.
53. Kao korisnik, želim da aplikacija radi na Lenovo tabletu i laptopu u pregledniku, kako ne moram ništa instalirati.
54. Kao korisnik, želim da je aplikacija na bosanskom, a iznosi u KM bez PDV-a, kako odgovara našem radu.
55. Kao menadžer, želim da se artikli, objekti i dobavljači uvezu iz postojećeg Excela očišćeni od grešaka, kako ne moram sve unositi ručno.
56. Kao menadžer, želim da artikli budu razdvojeni na prehranu i materijal, kako svaki magacin ima svoj popis.
57. Kao menadžer, želim da početno stanje zaliha krene od svježeg popisa na dan početka, kako stara netačna stanja ne uđu u novi sistem.

## Implementation Decisions

- **Platforma:** web aplikacija u Next.js (već postoji prazan projekat u repozitoriju magacin-app), objavljena na Vercelu, s bazom i prijavom na Supabase. Radi na internetu; svi uređaji vide isto stanje. Za razvoj se koristi lokalni server i lokalna Supabase instanca.
- **Poslovna pravila žive u bazi** kao transakcione operacije, a ekrani su tanak sloj iznad njih. Time pravila važe bez obzira ko ih poziva, a paralelni unosi (magacin i objekat u isto vrijeme) ne mogu pokvariti stanje. Ovo je jedini test seam (vidi Testing Decisions).
- **Glavne operacije:** prijem; kreiranje zahtjeva; odobravanje (puno, manje, odbijanje s razlogom); na dostavi (izdavanje); potvrda primljenog s mogućom razlikom; zatvaranje smjene s završnim stanjem; izuzetak/otpis objekta; otpis magacina; popis magacina; poništavanje (storno) greške.
- **Knjiga kretanja (ledger):** sve promjene stanja su nepromjenjivi zapisi (ko, kada, koji artikal, količina, cijena, razlog). Ispravke se rade stornom, nikad brisanjem ni izmjenom. Stanje magacina, zaliha objekta i trošak izvode se iz knjige.
- **Zahtjev, statusi:** poslan → odobren (puna ili manja količina) ili odbijen (uz razlog) → na dostavi → primljeno. Promjena statusa vidljiva drugoj strani bez osvježavanja.
- **Izdavanje:** dešava se pri statusu "na dostavi". Skida zalihu magacina i ulazi u zalihu objekta. Izdavanje iznad stanja magacina je blokirano. Ne knjiži trošak.
- **Primljeno i razlika pri prijemu:** objekat potvrđuje primljeno i može upisati stvarno primljenu količinu; razlika se zapisuje i vidljiva je magacioneru i menadžeru.
- **Trošak objekta:** nastaje pri evidenciji potrošnje, po cijeni pri izdavanju (ne po današnjoj cijeni). Potrošnja se vrednuje po prosječnoj cijeni izdatih količina u zalihi objekta.
- **Evidencija potrošnje:** objekat upisuje završno stanje po artiklu na kraju smjene; potrošnja = početno stanje + primljeno − završno. Početno stanje smjene je završno prethodne (automatski). U toku smjene mogu se dodati izuzeci (otpis objekta) s razlogom. Smjena se ne zatvara bez završnog stanja i imena osobe.
- **Veće završno stanje od mogućeg:** dozvoljeno, uz obavezan razlog; menadžer vidi upozorenje.
- **Prosječna cijena:** ponderisana, preračunava se pri svakom prijemu; nabavna cijena bez PDV-a, u KM.
- **Artikli i mjere:** artikal ima jednu osnovnu mjeru (kg, l, kom) i po potrebi pakovanja s faktorom pretvaranja. Evidencija je uvijek u osnovnoj mjeri; zahtjev i prijem mogu biti u pakovanju ili osnovnoj mjeri.
- **Artikli po objektu:** svaki objekat vidi samo popis artikala koji mu je zadao menadžer. Za ŠANK HOTEL prijedlog popisa izvodi se iz utrošaka u postojećem Excelu.
- **Bar kod:** glavni način unosa je skener koji radi kao tastatura (USB/Bluetooth); kamera tableta je rezerva. Koristi se pri prijemu, izdavanju i popisu. Artikli bez koda biraju se s liste. Štampanje naljepnica nije u obimu.
- **Uloge:** magacioner, objekat (fiksni tablet) i menadžer. Magacioner i objekat se prijavljuju PIN-om uz izbor imena osobe, menadžer lozinkom. Ime osobe se bilježi uz svaku radnju. Menadžer upravlja artiklima, minimumom, korisnicima, objektima i smjenama, a može poništiti grešku uz razlog. Otpis i popis ne traže odobrenje menadžera.
- **Minimum zaliha:** zadaje magacioner po artiklu; upozorenje se vidi samo u magacinu i menadžeru (crvena oznaka).
- **Otpis magacina i popis:** otpis skida zalihu uz razlog i vodi se kao odvojeni trošak. Popis usklađuje sistem sa brojanim stanjem uz vidljivu razliku.
- **Izvještaji:** trošak i potrošnja po objektu za dan/sedmicu/mjesec, stanje magacina s vrijednošću, potrošnja po artiklu, artikli ispod minimuma. Prikaz na ekranu i izvoz u Excel. Trošak po gostu nije u aplikaciji.
- **Uvoz iz Excela (Utrošci - zalihe.xlsx):** uvoze se artikli, objekti i dobavljači, ne historija ulaza i utrošaka. Čišćenje pri uvozu: ujednačiti jedinice (`L`/`l`, `KG`/`kg`, `jkg`), spojiti duplirani objekat (`PIZERIA VIDIKOVAC` i `PIZZERIA VIDIKOVAC`). Artikli se dijele na prehranu i materijal (prijedlog po nazivu i jedinici, menadžer ispravlja). Zalihe počinju od svježeg popisa.
- **Interfejs:** dizajniran za dodir, velika dugmad, jednostavni ekrani. Jezik bosanski, valuta KM.

## Testing Decisions

- **Dobar test** provjerava vidljivo ponašanje (stanje magacina, zaliha objekta, trošak, statusi, odbijene radnje), a ne implementaciju (tabele, funkcije, redoslijed poziva).
- **Jedan seam:** operacije nad knjigom magacina u bazi (prijem, zahtjev, odobravanje, izdavanje, primljeno, zatvaranje smjene, otpis, popis, storno) i upiti nad njima (stanje, zaliha objekta, trošak). Testovi pozivaju te operacije direktno na lokalnoj Supabase bazi.
- **Šta se testira:** prosječna cijena pri više prijema po različitim cijenama; blokada izdavanja iznad stanja; pretvaranje pakovanja u osnovnu mjeru; cijeli tok zahtjeva do primljeno s razlikom; da izdavanje ne knjiži trošak, a potrošnja da; potrošnja iz brojanja i cijena pri izdavanju; veće završno stanje uz razlog i upozorenje; otpis i popis; storno (trag ostaje, stanje se vrati); paralelno izdavanje istog artikla ne smije preći stanje.
- **Ekrani:** nema posebnih testova ekrana u ovom obimu; provjeravaju se ručno na tabletu.
- **Prior art:** nema. Projekat je prazan Next.js šablon bez testova, pa ovaj seam postavlja obrazac.

## Out of Scope

- Magacin materijala i ostali objekti osim ŠANK HOTEL (dolaze nakon testa).
- Rok trajanja i praćenje po serijama.
- Štampanje bar kod naljepnica.
- Vraćanje robe iz objekta u magacin.
- Veza s kasom i poređenje potrošnje s prodajom (sve je all inclusive, nema kase).
- Trošak po gostu (računa se kasnije u analitici).
- Recepti/normativi (potrošnja iz prodanih jela).
- Uvoz historije ulaza i utrošaka iz Excela.
- Rad bez interneta (offline).

## Further Notes

- **Pretpostavke koje treba potvrditi:** (1) početno stanje smjene preuzima se automatski iz završnog prethodne smjene, pa šank upisuje samo završno; (2) potrošnja se vrednuje po prosječnoj cijeni izdatih količina u zalihi objekta; (3) šank vidi samo svoje artikle i veće završno stanje se dozvoljava uz razlog, pošto ta dva pitanja nisu izričito odgovorena.
- **Postojeći Excel** ima stvarne podatke za ŠANK HOTEL (3.621 utrošak od februara), pa ih možemo koristiti kao stvarni test prijedloga popisa artikala i kao provjeru izvještaja.
- **Razvojno okruženje:** za lokalni Supabase treba Docker Desktop, a za GitHub Issues treba `gh` CLI. Dok ih nema, zadaci se vode lokalno u `.scratch/`.
- **Vercel i Supabase** projekti se povezuju kasnije, kad ima šta objaviti.
- Rječnik iz `CONTEXT.md` je obavezan u kodu, ekranima i izvještajima (magacin, objekat, zahtjev, izdavanje, zaliha objekta, trošak objekta, otpis, popis, smjena, menadžer, magacioner).
