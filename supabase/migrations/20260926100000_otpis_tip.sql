-- Otpis magacina kao nova vrsta kretanja; odvojeno jer se dodana vrijednost enum-a
-- ne smije koristiti u istoj transakciji u kojoj je dodana.
alter type magacin.vrsta_kretanja add value 'otpis';
