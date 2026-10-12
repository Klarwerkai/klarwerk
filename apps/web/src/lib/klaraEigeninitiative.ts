// ================================================================================================
// produkt:20261008:klara-eigeninitiative — WANN SICH DIE ASSISTENZ MELDET.
// ================================================================================================
//
// Ein kleiner Speicher im Browser für den vom Server bestätigten Unterstützungsmodus des
// angemeldeten Kontos — gebaut wie `assistenzProfil.ts`: an die Kontokennung gebunden, bei Abmeldung
// und Kontowechsel verworfen, dauerhaft gespeichert nur am Server (`/api/me/assistenz/eigeninitiative`).
// Nach Neuladen und auf einem zweiten Gerät gilt deshalb derselbe Modus.
//
// Dazu die reine Ableitung EINES Hinweises aus dem tatsächlichen Kontext (`hinweisFuer`) und die
// Regel, wann er erscheinen darf (`hinweisErlaubt`). Ein Hinweis bietet Hilfe an — ausgeführt wird
// erst, was die Person danach selbst anklickt.
import { useSyncExternalStore } from "react";
import {
  type EigeninitiativeAntwort,
  type EigeninitiativeModus,
  type HinweisAblageStand,
  eigeninitiativeApi,
} from "../api/assistenzEigeninitiative";

export type EigeninitiativeLadestand = "leer" | "laedt" | "bereit" | "fehler";

export interface EigeninitiativeLage {
  readonly kontoId: string | null;
  readonly status: EigeninitiativeLadestand;
  readonly antwort: EigeninitiativeAntwort | null;
  /** Ein Moduswechsel ist unterwegs. */
  readonly speichert: boolean;
  /** Der letzte Schreibversuch schlug fehl — der angezeigte Modus ist der zuletzt bestätigte. */
  readonly fehler: boolean;
}

/** Ohne bestätigte Wahl gilt: still bleiben. */
export const VORGABE_MODUS: EigeninitiativeModus = "nachfrage";

const LEER: EigeninitiativeLage = {
  kontoId: null,
  status: "leer",
  antwort: null,
  speichert: false,
  fehler: false,
};

let lage: EigeninitiativeLage = LEER;
const hoerer = new Set<() => void>();

function setze(neu: EigeninitiativeLage): void {
  lage = neu;
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

export function eigeninitiativeLage(): EigeninitiativeLage {
  return lage;
}

export function useEigeninitiative(): EigeninitiativeLage {
  return useSyncExternalStore(abonniere, eigeninitiativeLage, eigeninitiativeLage);
}

/** Der wirksame Modus: der bestätigte — solange keiner gelesen ist, die stille Vorgabe. */
export function wirksamerModus(l: EigeninitiativeLage): EigeninitiativeModus {
  return l.status === "bereit" && l.antwort ? l.antwort.modus : VORGABE_MODUS;
}

function istAntwort(wert: unknown): wert is EigeninitiativeAntwort {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    return false;
  }
  const w = wert as Partial<EigeninitiativeAntwort>;
  return (
    (w.modus === "nachfrage" || w.modus === "hinweise" || w.modus === "auftraege") &&
    Array.isArray(w.hinweise)
  );
}

/** Liest den Modus des Kontos. Kommt die Antwort nach einem Kontowechsel, gilt sie nicht. */
export async function ladeEigeninitiative(kontoId: string): Promise<void> {
  if (lage.kontoId !== kontoId) {
    setze({ ...LEER, kontoId, status: "laedt" });
  }
  try {
    const antwort: unknown = await eigeninitiativeApi.lesen();
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz/eigeninitiative");
    }
    if (lage.kontoId === kontoId) {
      setze({ ...lage, status: "bereit", antwort });
    }
  } catch {
    if (lage.kontoId === kontoId) {
      setze({ ...lage, status: lage.antwort ? "bereit" : "fehler" });
    }
  }
}

/** Speichert den Modus am Server; angezeigt wird erst der bestätigte Stand. */
export async function waehleModus(kontoId: string, modus: EigeninitiativeModus): Promise<boolean> {
  if (lage.kontoId !== kontoId) {
    return false;
  }
  setze({ ...lage, speichert: true, fehler: false });
  try {
    const antwort: unknown = await eigeninitiativeApi.modus(modus);
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz/eigeninitiative");
    }
    if (lage.kontoId === kontoId) {
      setze({ ...lage, status: "bereit", antwort, speichert: false, fehler: false });
    }
    return true;
  } catch {
    if (lage.kontoId === kontoId) {
      setze({ ...lage, speichert: false, fehler: true });
    }
    return false;
  }
}

/**
 * Schliesst einen Hinweis oder stellt ihn zurück. Der Hinweis verschwindet SOFORT (auch wenn der
 * Server nicht antwortet, bleibt er für diese Sitzung verborgen); dauerhaft ruht er, sobald der
 * Server die Ablage bestätigt hat.
 */
export async function legeHinweisAb(
  kontoId: string,
  schluessel: string,
  stand: HinweisAblageStand,
): Promise<boolean> {
  merkeGezeigt(schluessel);
  if (lage.kontoId !== kontoId) {
    return false;
  }
  try {
    const antwort: unknown = await eigeninitiativeApi.hinweisAblegen(schluessel, stand);
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz/eigeninitiative/hinweise");
    }
    if (lage.kontoId === kontoId) {
      setze({ ...lage, status: "bereit", antwort });
    }
    return true;
  } catch {
    return false;
  }
}

/** Abmelden oder Kontowechsel: nichts vom bisherigen Stand bleibt im Browser stehen. */
export function verwerfeEigeninitiative(): void {
  vergissGezeigte();
  if (lage !== LEER) {
    setze(LEER);
  }
}

// ------------------------------------------------------------------------------------------------
// Keine dauernde Wiederholung: ein Hinweis erscheint je Browsersitzung höchstens einmal — auch wenn
// die Person ihn weder schliesst noch zurückstellt, sondern einfach weiterarbeitet.
// ------------------------------------------------------------------------------------------------

// Je Konto ein eigener Eintrag im Tab-Speicher (wie „Später“ der Ersteinrichtung); die Abmeldung
// räumt alle ab.
const GEZEIGT_PRAEFIX = "kw-klara-hinweise-gezeigt:";
let gezeigt: { kontoId: string; menge: Set<string> } | null = null;

function gezeigtMenge(): Set<string> {
  const kontoId = lage.kontoId;
  if (!kontoId) {
    return new Set();
  }
  if (gezeigt?.kontoId === kontoId) {
    return gezeigt.menge;
  }
  const menge = new Set<string>();
  try {
    const roh = window.sessionStorage.getItem(`${GEZEIGT_PRAEFIX}${kontoId}`);
    const liste: unknown = roh ? JSON.parse(roh) : [];
    if (Array.isArray(liste)) {
      for (const s of liste) {
        if (typeof s === "string") {
          menge.add(s);
        }
      }
    }
  } catch {
    // Ohne Tab-Speicher gilt die Merkliste nur bis zum Neuladen.
  }
  gezeigt = { kontoId, menge };
  return menge;
}

export function warSchonGezeigt(schluessel: string): boolean {
  return gezeigtMenge().has(schluessel);
}

export function merkeGezeigt(schluessel: string): void {
  const kontoId = lage.kontoId;
  const m = gezeigtMenge();
  if (!kontoId || m.has(schluessel)) {
    return;
  }
  m.add(schluessel);
  try {
    const liste = JSON.stringify([...m].slice(-200));
    window.sessionStorage.setItem(`${GEZEIGT_PRAEFIX}${kontoId}`, liste);
  } catch {
    // Ohne Tab-Speicher gilt die Merkliste nur bis zum Neuladen.
  }
}

function vergissGezeigte(): void {
  gezeigt = null;
  try {
    for (const schluessel of Object.keys(window.sessionStorage)) {
      if (schluessel.startsWith(GEZEIGT_PRAEFIX)) {
        window.sessionStorage.removeItem(schluessel);
      }
    }
  } catch {
    // Ohne Tab-Speicher gibt es nichts zu vergessen.
  }
}

// ------------------------------------------------------------------------------------------------
// Ein Hinweis aus dem tatsächlichen Kontext.
// ------------------------------------------------------------------------------------------------

export type HinweisArt = "tutorial" | "ungeprueft" | "seite";

export interface Hinweis {
  /** Art und Ort — dieselbe Form, die der Server prüft (`art:ort`). */
  readonly schluessel: string;
  readonly art: HinweisArt;
  /** Was ein Klick auf das Angebot tut: die vorhandene Hilfe „zeigen“ bzw. „erklären“. */
  readonly angebot: "zeige" | "erklaere";
}

export interface HinweisKontext {
  readonly pfad: string;
  readonly koId?: string | undefined;
  readonly pruefstatus?: "geprueft" | "ungeprueft" | undefined;
  readonly modus?: "lesen" | "bearbeiten" | undefined;
  /** Gibt es für diese Seite eine Schritt-für-Schritt-Anleitung, und ist sie gerade zu? */
  readonly tutorialVorhanden: boolean;
  readonly tutorialOffen: boolean;
  /** Kennt die Hilfe eine Erklärung dieser Seite? */
  readonly erklaerbar: boolean;
}

/** Der Ort als Schlüsselteil: der erste Pfadabschnitt (`/fragen/x` → `fragen`), sonst `start`. */
export function ortSchluessel(pfad: string): string {
  const erster =
    pfad
      .split("?")[0]
      ?.split("/")
      .find((teil) => teil.length > 0) ?? "start";
  return erster.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 60) || "start";
}

/**
 * Höchstens EIN Hinweis, abgeleitet aus dem, was gerade wirklich da ist — in dieser Rangfolge:
 *   1. Für die Seite gibt es eine Anleitung, die nicht offen ist → „Anleitung zeigen“.
 *   2. Ein Wissensobjekt wird gelesen und ist ungeprüft → „Erklären, was das bedeutet“.
 *   3. Die Hilfe kennt eine Erklärung der Seite → „Seite erklären“.
 * Sonst keiner.
 */
export function hinweisFuer(k: HinweisKontext): Hinweis | null {
  const ort = ortSchluessel(k.pfad);
  if (k.tutorialVorhanden && !k.tutorialOffen) {
    return { schluessel: `tutorial:${ort}`, art: "tutorial", angebot: "zeige" };
  }
  if (k.koId && k.pruefstatus === "ungeprueft" && k.modus !== "bearbeiten") {
    const id = k.koId.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 100);
    return { schluessel: `ungeprueft:${id}`, art: "ungeprueft", angebot: "erklaere" };
  }
  if (k.erklaerbar) {
    return { schluessel: `seite:${ort}`, art: "seite", angebot: "erklaere" };
  }
  return null;
}

/** Ruht dieser Hinweis (geschlossen oder zurückgestellt, Frist nicht abgelaufen)? */
export function hinweisRuht(
  schluessel: string,
  antwort: EigeninitiativeAntwort | null,
  jetzt: number,
): boolean {
  return (antwort?.hinweise ?? []).some(
    (h) => h.schluessel === schluessel && Date.parse(h.bis) > jetzt,
  );
}

/**
 * Darf der Hinweis jetzt erscheinen? Nur im Modus „Passende Hinweise anbieten“ mit gelesenem Stand,
 * nicht während die Person schon mit der Assistenz arbeitet, nicht wenn er ruht und nicht ein
 * zweites Mal in derselben Sitzung.
 */
export function hinweisErlaubt(
  hinweis: Hinweis | null,
  l: EigeninitiativeLage,
  umstand: { beschaeftigt: boolean; jetzt: number },
): hinweis is Hinweis {
  if (!hinweis || umstand.beschaeftigt) {
    return false;
  }
  if (l.status !== "bereit" || l.antwort?.modus !== "hinweise") {
    return false;
  }
  return !hinweisRuht(hinweis.schluessel, l.antwort, umstand.jetzt);
}
