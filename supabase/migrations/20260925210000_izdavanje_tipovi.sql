-- Nove vrijednosti za izdavanje. Odvojeno od ostatka jer se dodana vrijednost enum-a
-- ne smije koristiti u istoj transakciji u kojoj je dodana.
alter type magacin.status_zahtjeva add value 'na_dostavi';
alter type magacin.vrsta_kretanja add value 'izdavanje';
