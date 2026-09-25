"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Drži ekran svježim bez ručnog osvježavanja: ponovo učitava podatke svakih nekoliko sekundi
 * dok je stranica vidljiva, i odmah kad se tablet vrati na nju.
 */
export function Osvjezavac({ sekundi = 5 }: { sekundi?: number }) {
  const router = useRouter();

  useEffect(() => {
    const osvjezi = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const sat = setInterval(osvjezi, sekundi * 1000);
    document.addEventListener("visibilitychange", osvjezi);
    return () => {
      clearInterval(sat);
      document.removeEventListener("visibilitychange", osvjezi);
    };
  }, [router, sekundi]);

  return null;
}
