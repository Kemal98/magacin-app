"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Skeniranje kamerom tableta (rezerva kad skener nije dostupan).
 * Kamera radi samo na HTTPS adresi (ili na localhost) i traži dozvolu preglednika.
 */
export function KameraSkener({
  onKod,
  onZatvori,
}: {
  onKod: (kod: string) => void;
  onZatvori: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [greska, setGreska] = useState<string | null>(null);
  // Držimo najnovije funkcije u refu da kamera ne kreće ispočetka pri svakom prikazu.
  const povratni = useRef({ onKod, onZatvori });
  useEffect(() => {
    povratni.current = { onKod, onZatvori };
  });

  useEffect(() => {
    let zaustavi: (() => void) | undefined;
    let otkazano = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setGreska("Kamera nije dostupna u ovom pregledniku (potrebna je sigurna HTTPS veza).");
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const citac = new BrowserMultiFormatReader();
        const kontrole = await citac.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current!,
          (rezultat) => {
            if (rezultat && !otkazano) {
              otkazano = true; // jedan kod po otvaranju
              povratni.current.onKod(rezultat.getText());
              povratni.current.onZatvori();
            }
          },
        );
        if (otkazano) kontrole.stop();
        else zaustavi = () => kontrole.stop();
      } catch (e) {
        const ime = e instanceof Error ? e.name : "";
        setGreska(
          ime === "NotAllowedError"
            ? "Kamera nije dozvoljena. Dozvolite pristup kameri u pregledniku."
            : ime === "NotFoundError"
              ? "Kamera nije pronađena na ovom uređaju."
              : "Kamera se ne može pokrenuti.",
        );
      }
    })();

    return () => {
      otkazano = true;
      zaustavi?.();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Skeniranje kamerom"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4"
    >
      {greska ? (
        <p role="alert" className="max-w-md rounded-2xl bg-white p-6 text-xl font-semibold text-red-700">
          {greska}
        </p>
      ) : (
        <>
          <video ref={video} className="max-h-[70vh] w-full max-w-xl rounded-2xl bg-black" muted playsInline />
          <p className="text-xl text-white">Usmjerite kameru na bar kod</p>
        </>
      )}
      <button
        type="button"
        onClick={onZatvori}
        className="min-h-16 rounded-2xl bg-white px-8 text-2xl font-semibold active:bg-zinc-200"
      >
        Zatvori
      </button>
    </div>
  );
}
