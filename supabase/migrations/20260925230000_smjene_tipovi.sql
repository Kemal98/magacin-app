-- Nove vrste kretanja u knjizi objekta; odvojeno jer se dodana vrijednost enum-a
-- ne smije koristiti u istoj transakciji u kojoj je dodana.
alter type magacin.vrsta_kretanja_objekta add value 'potrosnja';
alter type magacin.vrsta_kretanja_objekta add value 'izuzetak';
alter type magacin.vrsta_kretanja_objekta add value 'visak_pri_zatvaranju';
