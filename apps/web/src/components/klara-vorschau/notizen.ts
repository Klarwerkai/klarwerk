// ================================================================================================
// KLARA 06 (produkt:20261007:klara-notizen-aufgaben) · DIE PRIVATEN NOTIZEN — Anlegen, Öffnen,
// Bearbeiten, Wiederfinden, Fehler und Wiederholung.
// ================================================================================================
//
// DIE WAHRHEIT IST DER SERVER (`/api/me/klara/notizen`). Hier liegt nur, was gerade gezeigt wird,
// und was NOCH NICHT gespeichert ist:
//   · Jedes Anlegen bekommt EINEN Vorgangsschlüssel. Scheitert es (Netz, Server, Anmeldung), bleibt
//     es als „Nicht gespeichert" mit Grund sichtbar stehen; „Erneut speichern" schickt DENSELBEN
//     Schlüssel — kam der erste Versuch doch an, antwortet der Server mit derselben Notiz, statt eine
//     zweite anzulegen.
//   · Eine Bearbeitung nennt die gesehene Fassung. Scheitert sie, bleibt der Text im Feld und der
//     Fehler steht daneben; die Wiederholung schickt dieselbe Änderung mit derselben Fassung.
//
// WARUM AUSSERHALB VON REACT: aus demselben Grund wie `echt.ts` — die Hülle montiert Klara bei jeder
// Breitenänderung neu, und ein nicht gespeicherter Vorgang darf dabei nicht verloren gehen. Nichts
// davon liegt im Browser-Speicher; beim Abmelden wird es vergessen (`beimVergessen`).
import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";
import { ApiError } from "../../api/client";
import type { KlaraObjektbezug } from "../../api/klaraGespraech";
import {
  type KlaraNotiz,
  type KlaraNotizAenderung,
  type KlaraNotizEingabe,
  klaraNotizApi,
} from "../../api/klaraNotiz";
import { HOME_ROUTE } from "../../app/navigation";
import { internerPfad } from "../../lib/internerPfad";
import { leserHref } from "../../lib/objektbezug";
import { artikelPfad } from "./artikel";
import { beimVergessen, fehlerBild } from "./echt";

export type NotizLadestand = "aus" | "laedt" | "bereit" | "fehler";

/** Ein Anlegen, das noch läuft oder gescheitert ist — mit seinem festen Vorgangsschlüssel. */
export interface AusstehendeNotiz {
  vorgang: string;
  eingabe: KlaraNotizEingabe;
  /** Was die Person wiedererkennt: der Anfang des Textes bzw. „aus dem Gespräch". */
  vorschau: string;
  stand: "laeuft" | "fehler";
  fehler: string | null;
}

export interface NotizBearbeitung {
  stand: "laeuft" | "fehler";
  fehler: string | null;
  /** Die zuletzt versuchte Änderung — „Erneut speichern" schickt genau sie. */
  aenderung: KlaraNotizAenderung;
}

export interface NotizZustand {
  laden: NotizLadestand;
  ladeFehler: string | null;
  suche: string;
  liste: KlaraNotiz[];
  /** Die geöffnete Notiz, wie der Server sie zuletzt bestätigt hat. */
  offen: KlaraNotiz | null;
  bearbeitung: NotizBearbeitung | null;
  ausstehend: AusstehendeNotiz[];
  /** Der letzte bestätigte Schritt, für die Ansage (`aria-live`). */
  meldung: string | null;
}

const LEER: NotizZustand = {
  laden: "aus",
  ladeFehler: null,
  suche: "",
  liste: [],
  offen: null,
  bearbeitung: null,
  ausstehend: [],
  meldung: null,
};

let zustand: NotizZustand = LEER;
const hoerer = new Set<() => void>();
/** Wie in `echt.ts`: ein Ablauf eines vergessenen Kontos endet ohne Zustandsänderung. */
let generation = 0;
/** Nur die Antwort der JÜNGSTEN Suche wird gezeigt. */
let suchlauf = 0;

function setze(f: (z: NotizZustand) => NotizZustand): void {
  const neu = f(zustand);
  if (neu === zustand) {
    return;
  }
  zustand = neu;
  for (const h of hoerer) {
    h();
  }
}

export function leseNotizen(): NotizZustand {
  return zustand;
}

export function useNotizen(): NotizZustand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    leseNotizen,
    leseNotizen,
  );
}

/** Abmelden, Kontowechsel, Tests: alles vergessen. */
export function vergissNotizen(): void {
  generation += 1;
  zustand = LEER;
  for (const h of hoerer) {
    h();
  }
}
beimVergessen(vergissNotizen);

// ------------------------------------------------------------------------------------------------
// Reine Helfer.
// ------------------------------------------------------------------------------------------------

/** Ein Vorgangsschlüssel je Anlegen (8–100 Zeichen aus Buchstaben, Ziffern, `-`, `_`). */
export function neuerVorgang(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Wohin der Rücklink führt — dieselbe Regel wie der Rücklink des Notizentwurfs (Klara 04): ein
 * Wissensobjekt in seine Lesefläche mit der Fassung von damals, ein Artikelabsatz an den Absatz,
 * sonst die Seite. Nur ein interner Pfad wird Ziel (R-1398).
 */
export function ruecklinkZiel(b: KlaraObjektbezug): string {
  if (b.koId) {
    return leserHref({ koId: b.koId, fassung: b.fassung ?? null });
  }
  return b.artikelId && b.absatz
    ? `${artikelPfad(b.artikelId)}#absatz-${b.absatz}`
    : internerPfad(b.pfad, HOME_ROUTE);
}

/** Offene Fragen aus dem Textfeld: eine je Zeile, leere Zeilen fallen weg. */
export function fragenAusText(text: string): string[] {
  return text
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z.length > 0);
}

function notizFehler(fehler: unknown, t: TFunction): string {
  if (fehler instanceof ApiError && fehler.status === 409) {
    const grund = fehler.details.grund;
    if (grund === "konflikt") {
      return t("klaranotiz.fehler.konflikt");
    }
    if (grund === "voll") {
      return t("klaranotiz.fehler.voll");
    }
  }
  if (fehler instanceof ApiError && fehler.status === 404) {
    return t("klaranotiz.fehler.weg");
  }
  return fehlerBild(fehler, t).text;
}

function vorschauVon(eingabe: KlaraNotizEingabe, t: TFunction): string {
  if (eingabe.weg === "gespraech") {
    return t("klaranotiz.weg.gespraech");
  }
  const text = eingabe.inhalt.trim().replace(/\s+/g, " ");
  return [...text].length > 60 ? `${[...text].slice(0, 59).join("")}…` : text;
}

function mitNotiz(liste: readonly KlaraNotiz[], n: KlaraNotiz): KlaraNotiz[] {
  return [n, ...liste.filter((x) => x.id !== n.id)];
}

// ------------------------------------------------------------------------------------------------
// Abläufe gegen den Server.
// ------------------------------------------------------------------------------------------------

/** Liest die eigenen Notizen (mit Suchwörtern) — die zuletzt geänderten zuerst. */
export async function ladeNotizen(t: TFunction, suche = zustand.suche): Promise<void> {
  const gen = generation;
  suchlauf += 1;
  const lauf = suchlauf;
  setze((z) => ({ ...z, suche, laden: "laedt", ladeFehler: null }));
  try {
    const { notizen } = await klaraNotizApi.liste(suche);
    if (gen !== generation || lauf !== suchlauf) {
      return;
    }
    setze((z) => ({ ...z, laden: "bereit", liste: notizen }));
  } catch (fehler) {
    if (gen !== generation || lauf !== suchlauf) {
      return;
    }
    setze((z) => ({ ...z, laden: "fehler", ladeFehler: notizFehler(fehler, t) }));
  }
}

async function versucheAnlegen(vorgang: string, t: TFunction): Promise<KlaraNotiz | null> {
  const gen = generation;
  const eintrag = zustand.ausstehend.find((a) => a.vorgang === vorgang);
  if (!eintrag) {
    return null;
  }
  setze((z) => ({
    ...z,
    ausstehend: z.ausstehend.map((a) =>
      a.vorgang === vorgang ? { ...a, stand: "laeuft" as const, fehler: null } : a,
    ),
  }));
  try {
    const { notiz } = await klaraNotizApi.lege(vorgang, eintrag.eingabe);
    if (gen !== generation) {
      return null;
    }
    // Erst die Bestätigung des Servers macht daraus eine gespeicherte Notiz.
    setze((z) => ({
      ...z,
      ausstehend: z.ausstehend.filter((a) => a.vorgang !== vorgang),
      liste: mitNotiz(z.liste, notiz),
      offen: notiz,
      bearbeitung: null,
      meldung: t("klaranotiz.gespeichert", { titel: notiz.titel }),
    }));
    return notiz;
  } catch (fehler) {
    if (gen !== generation) {
      return null;
    }
    const text = notizFehler(fehler, t);
    setze((z) => ({
      ...z,
      ausstehend: z.ausstehend.map((a) =>
        a.vorgang === vorgang ? { ...a, stand: "fehler" as const, fehler: text } : a,
      ),
      meldung: t("klaranotiz.nichtGespeichert", { grund: text }),
    }));
    return null;
  }
}

/**
 * Legt eine Notiz an: ein neuer Vorgang, sichtbar als „wird gespeichert", bis der Server bestätigt.
 * Gibt die gespeicherte Notiz zurück — oder `null`, wenn sie (noch) nicht gespeichert ist.
 *
 * `vorgang` setzt der Aufrufer nur, wenn derselbe Anlass immer derselbe Vorgang ist (eine
 * Gesprächsnachricht: zweimal „Als Notiz" ergibt eine Notiz, nicht zwei).
 */
export function legeNotiz(
  eingabe: KlaraNotizEingabe,
  t: TFunction,
  vorgang: string = neuerVorgang(),
): Promise<KlaraNotiz | null> {
  if (zustand.ausstehend.some((a) => a.vorgang === vorgang)) {
    return versucheAnlegen(vorgang, t);
  }
  setze((z) => ({
    ...z,
    ausstehend: [
      ...z.ausstehend,
      { vorgang, eingabe, vorschau: vorschauVon(eingabe, t), stand: "laeuft", fehler: null },
    ],
  }));
  return versucheAnlegen(vorgang, t);
}

/** „Erneut speichern": derselbe Vorgang, derselbe Inhalt — keine Doppelnotiz. */
export function nochmalAnlegen(vorgang: string, t: TFunction): Promise<KlaraNotiz | null> {
  return versucheAnlegen(vorgang, t);
}

/** Ein gescheitertes Anlegen bewusst verwerfen (nichts wurde gespeichert). */
export function verwirfAusstehend(vorgang: string): void {
  setze((z) => ({ ...z, ausstehend: z.ausstehend.filter((a) => a.vorgang !== vorgang) }));
}

/** Öffnet eine eigene Notiz — immer frisch vom Server gelesen. */
export async function oeffneNotiz(id: string, t: TFunction): Promise<void> {
  const gen = generation;
  try {
    const { notiz } = await klaraNotizApi.hole(id);
    if (gen !== generation) {
      return;
    }
    setze((z) => ({ ...z, offen: notiz, bearbeitung: null, meldung: null }));
  } catch (fehler) {
    if (gen !== generation) {
      return;
    }
    setze((z) => ({ ...z, meldung: notizFehler(fehler, t) }));
  }
}

export function schliesseNotiz(): void {
  setze((z) => ({ ...z, offen: null, bearbeitung: null }));
}

async function versucheAendern(aenderung: KlaraNotizAenderung, t: TFunction): Promise<boolean> {
  const gen = generation;
  const offen = zustand.offen;
  if (!offen) {
    return false;
  }
  setze((z) => ({ ...z, bearbeitung: { stand: "laeuft", fehler: null, aenderung } }));
  try {
    const { notiz } = await klaraNotizApi.aendere(offen.id, aenderung);
    if (gen !== generation) {
      return false;
    }
    setze((z) => ({
      ...z,
      offen: z.offen?.id === notiz.id ? notiz : z.offen,
      liste: mitNotiz(z.liste, notiz),
      bearbeitung: null,
      meldung: t("klaranotiz.geaendert", { titel: notiz.titel }),
    }));
    return true;
  } catch (fehler) {
    if (gen !== generation) {
      return false;
    }
    setze((z) => ({
      ...z,
      bearbeitung: { stand: "fehler", fehler: notizFehler(fehler, t), aenderung },
    }));
    return false;
  }
}

/** Speichert eine Bearbeitung der geöffneten Notiz mit der Fassung, die die Person gesehen hat. */
export function speichereNotiz(
  felder: Omit<KlaraNotizAenderung, "fassung">,
  t: TFunction,
): Promise<boolean> {
  const offen = zustand.offen;
  if (!offen) {
    return Promise.resolve(false);
  }
  return versucheAendern({ ...felder, fassung: offen.fassung }, t);
}

/** „Erneut speichern" einer gescheiterten Bearbeitung — dieselbe Änderung, dieselbe Fassung. */
export function nochmalAendern(t: TFunction): Promise<boolean> {
  const b = zustand.bearbeitung;
  return b ? versucheAendern(b.aenderung, t) : Promise.resolve(false);
}

export async function loescheNotiz(id: string, t: TFunction): Promise<void> {
  const gen = generation;
  try {
    await klaraNotizApi.loesche(id);
    if (gen !== generation) {
      return;
    }
    setze((z) => ({
      ...z,
      liste: z.liste.filter((n) => n.id !== id),
      offen: z.offen?.id === id ? null : z.offen,
      bearbeitung: z.offen?.id === id ? null : z.bearbeitung,
      meldung: t("klaranotiz.geloescht"),
    }));
  } catch (fehler) {
    if (gen !== generation) {
      return;
    }
    setze((z) => ({ ...z, meldung: notizFehler(fehler, t) }));
  }
}
