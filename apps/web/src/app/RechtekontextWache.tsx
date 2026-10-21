import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fragenSpeicher, merkeAntwortRechtewechsel } from "../lib/fragenArbeitsstand";
import { aufRechtekontextwechsel, verwerfeAlteInhalte } from "../lib/rechtekontext";

// produkt:20261011:peter-p14 (K6/K7) — die eine Stelle, an der ein erkannter Wechsel des
// Rechtekontexts (Rolle, Mitgliedschaft, Konto) den Zwischenspeicher räumt. Regel und Grenzen in
// `lib/rechtekontext.ts`. Montiert neben `GeteilterStandNachlader` — dessen Takt sorgt dafür, dass
// auch eine offen stehende Seite den Wechsel mit der nächsten Antwort erfährt.
export function RechtekontextWache({ kontoId = null }: { kontoId?: string | null } = {}): null {
  const queryClient = useQueryClient();
  const kontoJetzt = useRef(kontoId);
  kontoJetzt.current = kontoId;
  useEffect(
    () =>
      aufRechtekontextwechsel(() => {
        // Der wirklich erkannte Wechsel erreicht denselben eigenen Arbeitsstand auch ohne Ask.
        merkeAntwortRechtewechsel(fragenSpeicher(), kontoJetzt.current);
        void verwerfeAlteInhalte(queryClient);
      }),
    [queryClient],
  );
  return null;
}
