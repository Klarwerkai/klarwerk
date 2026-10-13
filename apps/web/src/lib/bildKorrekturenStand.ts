// ================================================================================================
// OCR-E02 · DER BESTÄTIGTE STAND DER BILDBERICHTIGUNGEN DES ANGEMELDETEN KONTOS.
// ================================================================================================
//
// Derselbe Bau wie `lib/assistenzProfil.ts`: ein kleiner Speicher, der genau das hält, was der Server
// zuletzt bestätigt hat (`/api/me/assistenz/bildkorrekturen`). Er gehört zu EINER Kontokennung —
// wechselt das Konto, gilt nichts mehr davon, bevor das neue Konto gelesen ist. Dauerhaft gespeichert
// wird nur am Server; nach Neuladen wird neu gelesen.
//
// Ob berichtigt werden darf, sagt der Server (`darfBearbeiten`, Recht `ko.create`). Ein Schreiben
// ohne das Recht weist er mit 403 ab; die Oberfläche bietet es dann gar nicht erst an.
import { useEffect, useSyncExternalStore } from "react";
import {
  type BildKorrekturAenderung,
  type BildKorrekturAntwort,
  type BildKorrekturDaten,
  bildKorrekturApi,
} from "../api/bildKorrekturen";
import { ApiError } from "../api/client";
import { assistenzStand, useAssistenzStand } from "./assistenzProfil";
import type { BildBefund } from "./bildAutomatik";
import { befundMitKorrektur, findeKorrektur, korrekturQuelleFuer } from "./bildKorrektur";

export type KorrekturLadestand = "leer" | "laedt" | "bereit" | "fehler";

export interface BildKorrekturStand {
  readonly kontoId: string | null;
  readonly status: KorrekturLadestand;
  readonly darfBearbeiten: boolean;
  readonly korrekturen: readonly BildKorrekturDaten[];
}

const LEER: BildKorrekturStand = {
  kontoId: null,
  status: "leer",
  darfBearbeiten: false,
  korrekturen: [],
};

let stand: BildKorrekturStand = LEER;
const hoerer = new Set<() => void>();

function setze(neu: BildKorrekturStand): void {
  stand = neu;
  for (const h of hoerer) {
    h();
  }
}

function abonniere(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

function lies(): BildKorrekturStand {
  return stand;
}

/** Der bestätigte Stand — für Abläufe außerhalb von React. */
export function bildKorrekturStand(): BildKorrekturStand {
  return stand;
}

/**
 * Für Abläufe außerhalb von React (Text einer eingelesenen Datei, „OCR → Text“): der Befund mit
 * der wirksamen Berichtigung des ANGEMELDETEN Kontos — sonst unverändert.
 */
export function wirksamerBefund(praefix: string, b: BildBefund): BildBefund {
  const kontoId = assistenzStand().kontoId;
  if (kontoId === null || stand.kontoId !== kontoId) {
    return b;
  }
  const quelle = korrekturQuelleFuer(praefix, b.fundstelle);
  return befundMitKorrektur(b, findeKorrektur(stand.korrekturen, quelle, b.inhaltskennung));
}

function istAntwort(wert: unknown): wert is BildKorrekturAntwort {
  if (typeof wert !== "object" || wert === null) {
    return false;
  }
  const w = wert as { darfBearbeiten?: unknown; korrekturen?: unknown };
  return typeof w.darfBearbeiten === "boolean" && Array.isArray(w.korrekturen);
}

/** Liest die Berichtigungen des Kontos. Eine Antwort nach einem Kontowechsel gilt nicht. */
export async function ladeBildKorrekturen(kontoId: string): Promise<void> {
  if (stand.kontoId !== kontoId) {
    setze({ ...LEER, kontoId, status: "laedt" });
  }
  try {
    const antwort: unknown = await bildKorrekturApi.lesen();
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz/bildkorrekturen");
    }
    if (stand.kontoId === kontoId) {
      setze({
        kontoId,
        status: "bereit",
        darfBearbeiten: antwort.darfBearbeiten,
        korrekturen: antwort.korrekturen,
      });
    }
  } catch {
    if (stand.kontoId === kontoId) {
      setze({ ...stand, status: stand.status === "bereit" ? "bereit" : "fehler" });
    }
  }
}

/** Abmelden oder Kontowechsel: nichts vom bisherigen Konto bleibt stehen. */
export function verwerfeBildKorrekturen(): void {
  if (stand !== LEER) {
    setze(LEER);
  }
}

export type KorrekturErgebnis =
  | { art: "gespeichert"; korrektur: BildKorrekturDaten | null }
  | { art: "verweigert" }
  | { art: "fehler"; meldung: string };

/**
 * Setzen, rückgängig, zurücksetzen — über den Server. Erst seine Antwort wird zum Stand; ein
 * Ergebnis, das nach einem Kontowechsel kommt, wird verworfen.
 */
export async function aendereBildKorrektur(
  aenderung: BildKorrekturAenderung,
): Promise<KorrekturErgebnis> {
  const kontoBeiStart = stand.kontoId;
  try {
    const antwort = await bildKorrekturApi.aendern(aenderung);
    if (!istAntwort(antwort)) {
      return { art: "fehler", meldung: "Unerwartete Antwort" };
    }
    if (kontoBeiStart !== null && stand.kontoId === kontoBeiStart) {
      setze({
        kontoId: kontoBeiStart,
        status: "bereit",
        darfBearbeiten: antwort.darfBearbeiten,
        korrekturen: antwort.korrekturen,
      });
    }
    const passt = (k: BildKorrekturDaten): boolean =>
      k.quelle === aenderung.quelle && k.inhaltskennung === aenderung.inhaltskennung;
    return { art: "gespeichert", korrektur: antwort.korrekturen.find(passt) ?? null };
  } catch (fehler) {
    if (fehler instanceof ApiError && fehler.status === 403) {
      if (stand.kontoId === kontoBeiStart) {
        setze({ ...stand, darfBearbeiten: false });
      }
      return { art: "verweigert" };
    }
    return { art: "fehler", meldung: fehler instanceof Error ? fehler.message : String(fehler) };
  }
}

/**
 * Die Berichtigungen des ANGEMELDETEN Kontos. Lädt sie beim ersten Gebrauch (nur `aktiv`: die Fläche
 * hat eine Quelle, an die berichtigt werden kann); gehört der Speicher zu einem anderen Konto, gilt
 * er als leer (es wird nichts aus einem fremden Konto angewendet).
 */
export function useBildKorrekturen(aktiv = true): BildKorrekturStand {
  const kontoId = useAssistenzStand().kontoId;
  const s = useSyncExternalStore(abonniere, lies, lies);
  useEffect(() => {
    if (aktiv && kontoId !== null && s.kontoId !== kontoId) {
      void ladeBildKorrekturen(kontoId);
    }
  }, [aktiv, kontoId, s.kontoId]);
  if (!aktiv || kontoId === null) {
    return LEER;
  }
  if (s.kontoId !== kontoId) {
    return { ...LEER, kontoId, status: "laedt" };
  }
  return s;
}
