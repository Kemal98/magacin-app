-- Nove vrijednosti za potvrdu prijema; odvojeno jer se dodana vrijednost enum-a
-- ne smije koristiti u istoj transakciji u kojoj je dodana.
alter type magacin.status_zahtjeva add value 'primljeno';
alter type magacin.vrsta_kretanja_objekta add value 'razlika_pri_prijemu';
