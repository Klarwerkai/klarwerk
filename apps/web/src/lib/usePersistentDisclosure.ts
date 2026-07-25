// AUFTRAG-uxpol5: React-Hook um einen einklappbaren Bereich, dessen Auf-/Zu-Zustand PRO BROWSER
// (localStorage) überlebt. Zwei Träger:
//  · „Weitere Filter" (Punkt 2): defaultOpen=false → immer eingeklappt starten, Wahl gemerkt.
//  · Reife-Erklärbox (Punkt 3): defaultOpen=false, openOnFirstVisit=true → beim ERSTEN Besuch offen,
//    ab dem nächsten Besuch eingeklappt (der Erststart schreibt den Dauer-Standard fest), Wahl gemerkt.
// key === undefined ⇒ rein flüchtiger Zustand (kein Speicherzugriff) — für generische Nutzer ohne
// eigenen Speicherschlüssel (z. B. der Facetten-Träger-Test).
import { useCallback, useEffect, useState } from "react";
import { readStoredBool, safeLocalStorage, writeStoredBool } from "./persistentToggle";

export function usePersistentDisclosure(
  key: string | undefined,
  opts: { defaultOpen: boolean; openOnFirstVisit?: boolean } = { defaultOpen: false },
): [boolean, () => void] {
  const { defaultOpen } = opts;
  const openOnFirstVisit = opts.openOnFirstVisit ?? defaultOpen;
  // AUFTRAG-uxpol6 (bens GELB 2.2): auch das ERMITTELN des Speichers ist fehlerfähig — wirft bereits
  // der window.localStorage-Getter (Browser-/Origin-Policy), gilt „kein Speicher“ statt eines Crashs.
  const storage = key ? safeLocalStorage() : undefined;
  const [open, setOpen] = useState<boolean>(
    () => readStoredBool(storage, key ?? "") ?? openOnFirstVisit,
  );

  useEffect(() => {
    if (!key) {
      return;
    }
    // Erststart (Schlüssel fehlt): den DAUER-Standard festschreiben. So bleibt eine evtl. beim ersten
    // Besuch offene Fläche danach standardmäßig eingeklappt, ohne die spätere Nutzerwahl zu überschreiben.
    if (readStoredBool(storage, key) === null) {
      writeStoredBool(storage, key, defaultOpen);
    }
  }, [key, storage, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (key) {
        writeStoredBool(storage, key, next);
      }
      return next;
    });
  }, [key, storage]);

  return [open, toggle];
}
