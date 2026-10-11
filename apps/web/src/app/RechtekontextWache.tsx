import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { aufRechtekontextwechsel, verwerfeAlteInhalte } from "../lib/rechtekontext";

// produkt:20261011:peter-p14 (K6/K7) — die eine Stelle, an der ein erkannter Wechsel des
// Rechtekontexts (Rolle, Mitgliedschaft, Konto) den Zwischenspeicher räumt. Regel und Grenzen in
// `lib/rechtekontext.ts`. Montiert neben `GeteilterStandNachlader` — dessen Takt sorgt dafür, dass
// auch eine offen stehende Seite den Wechsel mit der nächsten Antwort erfährt.
export function RechtekontextWache(): null {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      aufRechtekontextwechsel(() => {
        void verwerfeAlteInhalte(queryClient);
      }),
    [queryClient],
  );
  return null;
}
