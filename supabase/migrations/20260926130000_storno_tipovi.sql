-- Nove vrijednosti za storno; odvojeno jer se dodana vrijednost enum-a
-- ne smije koristiti u istoj transakciji u kojoj je dodana.
alter type magacin.vrsta_kretanja add value 'storno_prijema';
alter type magacin.vrsta_kretanja add value 'storno_izdavanja';
alter type magacin.vrsta_kretanja add value 'storno_otpisa';
alter type magacin.vrsta_kretanja_objekta add value 'storno_izdavanja';
alter type magacin.status_zahtjeva add value 'stornirano';
