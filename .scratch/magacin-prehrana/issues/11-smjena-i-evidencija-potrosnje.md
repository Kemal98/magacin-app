# 11: Smjena i evidencija potrošnje

**What to build:** Menadžer zadaje smjene objekta (broj i satnice). Šank na kraju smjene upisuje završno stanje po artiklu i ime osobe; potrošnja = početno + primljeno − završno, a trošak objekta se knjiži po cijeni pri izdavanju. Početno stanje smjene je završno prethodne.

**Blocked by:** 10 (Primljeno i razlika pri prijemu)

**Status:** ready-for-agent

- [ ] Smjena se ne može zatvoriti bez završnog stanja i imena osobe
- [ ] Potrošnja se računa iz početnog, primljenog i završnog stanja
- [ ] Trošak potrošnje ide po prosječnoj cijeni izdatih količina u zalihi objekta
- [ ] Početno stanje sljedeće smjene je završno prethodne
- [ ] Testovi provjeravaju da kasnija promjena cijene u magacinu ne mijenja već knjižen trošak
