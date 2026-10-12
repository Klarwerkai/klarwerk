// ================================================================================================
// produkt:20261010:assistenz-name-avatar — DER BESTÄTIGTE ASSISTENZSTAND DES ANGEMELDETEN KONTOS.
// ================================================================================================
//
// Ein kleiner Speicher im Browser, der genau EINE Sache hält: was der Server zuletzt als Profil
// des angemeldeten Kontos bestätigt hat. Er ist an die Kontokennung gebunden — wechselt das Konto
// oder meldet es sich ab, wird er verworfen, bevor das neue Profil gelesen ist (kein Profil eines
// anderen Menschen bleibt sichtbar stehen). Er ist kein zweiter Speicherort: dauerhaft gespeichert
// wird nur am Server (`/api/me/assistenz`); nach Neuladen und auf einem zweiten Gerät liest er neu.
//
// Jede Assistenzfläche liest Namen und Avatar von hier (`useAssistenzAnzeige`) und bindet den Namen
// über `useAssistenzT` als `{{assistenz}}` in ihre Texte. Ein Speichern unter „Meine Assistenz"
// schreibt den bestätigten Stand hierher — die offene Assistenz zeigt ihn sofort, ohne Abmeldung.
import type { TFunction } from "i18next";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { type AssistenzProfilAntwort, assistenzProfilApi } from "../api/assistenzProfil";
import { type AssistenzAvatarMotiv, STANDARD_AVATAR, avatarMotiv } from "./assistenzAvatare";

export type AssistenzLadestand = "leer" | "laedt" | "bereit" | "fehler";

export interface AssistenzStand {
  readonly kontoId: string | null;
  readonly status: AssistenzLadestand;
  readonly antwort: AssistenzProfilAntwort | null;
}

const LEER: AssistenzStand = { kontoId: null, status: "leer", antwort: null };

let stand: AssistenzStand = LEER;
const hoerer = new Set<() => void>();

function setze(neu: AssistenzStand): void {
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

export function assistenzStand(): AssistenzStand {
  return stand;
}

/** Nur eine Antwort in der vereinbarten Form wird zum bestätigten Stand. */
function istAntwort(wert: unknown): wert is AssistenzProfilAntwort {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    return false;
  }
  const w = wert as { profil?: unknown; einrichtungOffen?: unknown };
  // `typeof null === "object"`: ein fehlendes Profil (`null`) ist eine gültige Antwort.
  return typeof w.einrichtungOffen === "boolean" && typeof w.profil === "object";
}

/** Liest das Profil des Kontos. Kommt die Antwort, nachdem das Konto gewechselt hat, gilt sie nicht. */
export async function ladeAssistenzProfil(kontoId: string): Promise<void> {
  if (stand.kontoId !== kontoId) {
    setze({ kontoId, status: "laedt", antwort: null });
  } else {
    setze({ ...stand, status: stand.antwort ? stand.status : "laedt" });
  }
  try {
    const antwort: unknown = await assistenzProfilApi.lesen();
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz");
    }
    if (stand.kontoId === kontoId) {
      setze({ kontoId, status: "bereit", antwort });
    }
  } catch {
    if (stand.kontoId === kontoId) {
      setze({ kontoId, status: stand.antwort ? "bereit" : "fehler", antwort: stand.antwort });
    }
  }
}

/** Übernimmt den vom Server bestätigten Stand nach einem gelungenen Speichern. */
export function bestaetigeAssistenzProfil(kontoId: string, antwort: AssistenzProfilAntwort): void {
  if (stand.kontoId === kontoId) {
    setze({ kontoId, status: "bereit", antwort });
  }
}

/** Abmelden oder Kontowechsel: nichts vom bisherigen Profil bleibt im Browser stehen. */
export function verwerfeAssistenzProfil(): void {
  if (stand !== LEER) {
    setze(LEER);
  }
}

// „Später" in der Ersteinrichtung: nur für diese Browsersitzung und dieses Konto. Abgeschlossen ist
// damit nichts; das Abmelden vergisst es (`AuthContext`), die nächste Anmeldung bietet neu an.
const SPAETER_PRAEFIX = "kw-assistenz-einrichtung-spaeter:";

export function einrichtungSpaeter(kontoId: string): boolean {
  try {
    return window.sessionStorage.getItem(`${SPAETER_PRAEFIX}${kontoId}`) === "1";
  } catch {
    return false;
  }
}

export function merkeEinrichtungSpaeter(kontoId: string): void {
  try {
    window.sessionStorage.setItem(`${SPAETER_PRAEFIX}${kontoId}`, "1");
  } catch {
    // Ohne Tab-Speicher gilt „Später" nur bis zum Neuladen.
  }
}

export function vergissEinrichtungSpaeter(): void {
  try {
    for (const schluessel of Object.keys(window.sessionStorage)) {
      if (schluessel.startsWith(SPAETER_PRAEFIX)) {
        window.sessionStorage.removeItem(schluessel);
      }
    }
  } catch {
    // Ohne Tab-Speicher gibt es nichts zu vergessen.
  }
}

export function useAssistenzStand(): AssistenzStand {
  return useSyncExternalStore(abonniere, assistenzStand, assistenzStand);
}

export interface AssistenzAnzeige {
  /** Der gespeicherte persönliche Name — oder `null` (dann gilt die neutrale Bezeichnung). */
  readonly name: string | null;
  /** Name oder neutral „Assistenz" — für Beschriftungen und Sätze. */
  readonly anzeigename: string;
  /** Name oder neutral „Deine Assistenz" — für Überschriften. */
  readonly titel: string;
  /** Das anzuzeigende Motiv — `null`, wenn die gespeicherte Kennung nicht mehr angeboten wird. */
  readonly motiv: AssistenzAvatarMotiv | null;
  /** Die gespeicherte Kennung ist unbekannt geworden: neutrale Ersatzgrafik mit Hinweis. */
  readonly avatarFehlt: boolean;
  readonly bewegungReduziert: boolean;
}

export function useAssistenzAnzeige(): AssistenzAnzeige {
  const { t } = useTranslation();
  const s = useAssistenzStand();
  const profil = s.antwort?.profil ?? null;
  const name = profil?.name ?? null;
  const gespeichert = profil?.avatar ?? null;
  const motiv = avatarMotiv(gespeichert ?? STANDARD_AVATAR);
  return {
    name,
    anzeigename: name ?? t("assistenz.neutral.name"),
    titel: name ?? t("assistenz.neutral.titel"),
    motiv,
    avatarFehlt: motiv === null,
    bewegungReduziert: profil?.bewegung === "reduziert",
  };
}

type RohT = (schluessel: unknown, optionen?: unknown, weitere?: unknown) => unknown;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/**
 * `t` mit dem Assistenznamen: jeder Text kann `{{assistenz}}` (Name oder „Assistenz") und
 * `{{assistenzTitel}}` (Name oder „Deine Assistenz") enthalten. Der Name ist ein Wert, kein
 * Übersetzungstext — er wird nie als Schlüssel, Markup oder Anweisung gelesen.
 */
export interface AssistenzUebersetzung {
  t: TFunction;
  i18n: ReturnType<typeof useTranslation>["i18n"];
}

export function useAssistenzT(): AssistenzUebersetzung {
  const { t, i18n } = useTranslation();
  const { anzeigename, titel } = useAssistenzAnzeige();
  const gebunden = useMemo(() => {
    const roh = t as unknown as RohT;
    const werte = { assistenz: anzeigename, assistenzTitel: titel };
    const f: RohT = (schluessel, optionen, weitere) => {
      if (typeof optionen === "string") {
        return roh(schluessel, optionen, { ...werte, ...(istObjekt(weitere) ? weitere : {}) });
      }
      return roh(schluessel, { ...werte, ...(istObjekt(optionen) ? optionen : {}) });
    };
    return f as unknown as TFunction;
  }, [t, anzeigename, titel]);
  return { t: gebunden, i18n };
}
