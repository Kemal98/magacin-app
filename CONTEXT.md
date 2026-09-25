# Magacin sportskog centra

Evidencija zaliha i troškova za veliki sportski centar (oko 400.000 m²). Iz magacina roba odlazi do objekata u kompleksu, a sistem prati šta je izdato, koliko je potrošeno i koliko košta.

## Language

**Magacin**:
Mjesto na kojem se roba skladišti i iz kojeg se izdaje objektima. Centar ima dva: magacin prehrane i magacin materijala.
_Avoid_: Skladište

**Magacin prehrane**:
Magacin hrane i pića (uključujući kafu). Prvi magacin koji se uvodi u sistem.

**Magacin materijala**:
Magacin ostalog materijala. Uvodi se nakon magacina prehrane.

**Objekat**:
Mjesto u kompleksu koje traži robu iz magacina i na koje se troškovi evidentiraju (npr. kuhinja, Hotel Central, kafić, caffe bar). Prvi objekat u testu je ŠANK HOTEL (caffe bar u Hotelu Central).
_Avoid_: Lokacija, odjel

**Artikal**:
Vrsta robe koja se vodi na zalihi, s jednom osnovnom mjerom (kg, l, kom) i mogućim pakovanjima (npr. kutija od 10 kg).
_Avoid_: Proizvod, stavka

**Bar kod**:
Kod na artiklu ili pakovanju koji magacioner skenira da brzo pronađe artikal pri prijemu, izdavanju i popisu.
_Avoid_: Barkod, šifra

**Menadžer**:
Uloga koja vidi i kontroliše sve u oba magacina i u svim objektima.
_Avoid_: Admin, šef

**Magacioner**:
Osoba u magacinu koja vodi prijem, odobrava zahtjeve, izdaje robu i vodi otpis i popis.
_Avoid_: Skladištar

**Dobavljač**:
Firma od koje magacin nabavlja robu; vodi se uz svaki prijem.
_Avoid_: Snabdjevač

## Kretanje robe

**Prijem**:
Ulaz robe u magacin od dobavljača, s količinom i nabavnom cijenom po artiklu.
_Avoid_: Nabavka, ulaz

**Prosječna cijena**:
Cijena artikla na zalihi izračunata iz količina i nabavnih cijena svih prijema; mijenja se sa svakim prijemom po drugoj cijeni.

**Zahtjev**:
Upit objekta magacinu za određenu robu u određenoj količini. Prolazi statuse: poslan, odobren (punom ili manjom količinom) ili odbijen (uz razlog), na dostavi, primljen.
_Avoid_: Narudžba, upit

**Na dostavi**:
Status zahtjeva kad je magacioner odobrio i roba je krenula prema objektu.

**Primljeno**:
Status zahtjeva kad je objekat na svom tabletu potvrdio da je roba stigla.

**Izdavanje**:
Odobren zahtjev čija roba napušta magacin prema objektu; u tom trenutku se skida sa zalihe magacina i ulazi u zalihu objekta. Nije moguće izdati više nego što je na stanju.

**Razlika pri prijemu**:
Odstupanje između poslane i stvarno primljene količine koje objekat upiše pri potvrdi "primljeno".
_Avoid_: Reklamacija

## Potrošnja u objektu

**Evidencija potrošnje**:
Zapis objekta o tome šta je potrošeno (artikal i količina) u toku dana ili smjene. Danas se vodi ručno na papiru, a aplikacija je zamjenjuje na fiksnom tabletu u objektu.
_Avoid_: Evidencija troškova, izvještaj

**Zaliha objekta**:
Roba izdana objektu koja još nije potrošena; nije trošak dok se ne potroši.

**Trošak objekta**:
Vrijednost robe koju je objekat stvarno potrošio, po cijeni po kojoj mu je izdata; određuje se evidencijom potrošnje, ne izdavanjem.
_Avoid_: Izdatak

**Smjena**:
Radni period objekta na čijem se kraju zaključuje evidencija potrošnje.
_Avoid_: Tura

## Stanje zaliha

**Minimum zaliha**:
Količina artikla ispod koje magacin dobija upozorenje; zadaje ga magacioner po artiklu.

**Otpis**:
Skidanje robe sa zalihe zbog kvara, isteka roka ili lomljenja, uz razlog; vodi se kao trošak, odvojeno od izdavanja.
_Avoid_: Rastur, kalo

**Popis**:
Brojanje stvarnog stanja u magacinu i usklađivanje zalihe u sistemu s tim brojem.
_Avoid_: Inventura
