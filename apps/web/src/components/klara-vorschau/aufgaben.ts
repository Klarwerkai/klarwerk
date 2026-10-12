// ================================================================================================
// KLARA 07 (produkt:20261008:klara-aufgaben) · DIE PERSÖNLICHEN AUFGABEN — Anlegen aus einer Notiz,
// Öffnen, Bearbeiten, Priorisieren, Erledigen, Fehler und Wiederholung.
// ================================================================================================
//
// DIE WAHRHEIT IST DER SERVER (`/api/me/klara/aufgaben`). Hier liegt nur, was gerade gezeigt wird,
// und was NOCH NICHT gespeichert ist — dieselbe Bauart wie die Notizen (`notizen.ts`):
//   · Eine Aufgabe aus einer Notiz trägt den Vorgangsschlüssel DIESER Notiz. Zweimal „Als Aufgabe"
//     ergibt eine Aufgabe; scheitert das Anlegen, steht es als „Nicht gespeichert" mit Grund da, und
//     „Erneut speichern" schickt denselben Schlüssel.
//   · Eine Änderung (Titel/Text, Priorität, Erledigt) nennt die gesehene Fassung. Scheitert sie,
//     steht der Fehler an GENAU dieser Aufgabe; „Erneut speichern" schickt dieselbe Änderung mit
//     derselben Fassung. Gezeigt wird danach immer der Stand, den der Server bestätigt hat — nie
//     ein vorweggenommener.
//   · Aufgaben aus einem gesprochenen oder getippten Auftrag legt der gemeinsame Aktionsweg am
//     Server an (`auftrag.ts` → `klara-ausfuehrung.ts`); danach wird diese Liste neu gelesen.
//
// WARUM AUSSERHALB VON REACT: wie `echt.ts` und `notizen.ts` — die Hülle montiert Klara bei jeder
// Breitenänderung neu. Nichts davon liegt im Browser-Speicher; beim Abmelden wird es vergessen.
import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";
import { ApiError } from "../../api/client";
import {
  type KlaraAufgabe,
  type KlaraAufgabeAenderung,
  type KlaraAufgabeAusNotiz,
  type KlaraAufgabePrioritaet,
  klaraAufgabeApi,
} from "../../api/klaraAufgabe";
import type { KlaraNotiz } from "../../api/klaraNotiz";
import { beimVergessen, fehlerBild } from "./echt";

export type AufgabenLadestand = "aus" | "laedt" | "bereit" | "fehler";

/** Ein Anlegen aus einer Notiz, das noch läuft oder gescheitert ist. */
export interface AusstehendeAufgabe {
  vorgang: string;
  eingabe: KlaraAufgabeAusNotiz;
  vorschau: string;
  stand: "laeuft" | "fehler";
  fehler: string | null;
}

/** Ein Änderungsversuch an GENAU einer Aufgabe — nur ihr gehören Fehler und Wiederholung. */
export interface AufgabenAenderung {
  stand: "laeuft" | "fehler";
  fehler: string | null;
  aenderung: KlaraAufgabeAenderung;
}

export interface AufgabenZustand {
  laden: AufgabenLadestand;
  ladeFehler: string | null;
  liste: KlaraAufgabe[];
  ausstehend: AusstehendeAufgabe[];
  /** Je Aufgabenkennung der laufende oder gescheiterte Änderungsversuch. */
  aenderungen: Record<string, AufgabenAenderung>;
  /** Der letzte bestätigte Schritt, für die Ansage (`aria-live`). */
  meldung: string | null;
  generation: number;
}

const LEER: AufgabenZustand = {
  laden: "aus",
  ladeFehler: null,
  liste: [],
  ausstehend: [],
  aenderungen: {},
  meldung: null,
  generation: 0,
};

let zustand: AufgabenZustand = LEER;
const hoerer = new Set<() => void>();
let generation = 0;
let ladelauf = 0;

function setze(f: (z: AufgabenZustand) => AufgabenZustand): void {
  const neu = f(zustand);
  if (neu === zustand) {
    return;
  }
  zustand = neu;
  for (const h of hoerer) {
    h();
  }
}

export function leseAufgaben(): AufgabenZustand {
  return zustand;
}

export function useAufgaben(): AufgabenZustand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    leseAufgaben,
    leseAufgaben,
  );
}

/** Abmelden, Kontowechsel, Tests: alles vergessen. */
export function vergissAufgaben(): void {
  generation += 1;
  zustand = { ...LEER, generation };
  for (const h of hoerer) {
    h();
  }
}
beimVergessen(vergissAufgaben);

// ------------------------------------------------------------------------------------------------
// Reine Helfer.
// ------------------------------------------------------------------------------------------------

const RANG: Record<KlaraAufgabePrioritaet, number> = { hoch: 0, mittel: 1, niedrig: 2 };

/** Dieselbe Reihenfolge wie am Server: offen vor erledigt, dann Priorität, dann zuletzt geändert. */
export function aufgabenOrdnung(a: KlaraAufgabe, b: KlaraAufgabe): number {
  if (a.status !== b.status) {
    return a.status === "offen" ? -1 : 1;
  }
  return (
    RANG[a.prioritaet] - RANG[b.prioritaet] ||
    b.geaendertAm.localeCompare(a.geaendertAm) ||
    b.id.localeCompare(a.id)
  );
}

function mitAufgabe(liste: readonly KlaraAufgabe[], a: KlaraAufgabe): KlaraAufgabe[] {
  return [a, ...liste.filter((x) => x.id !== a.id)].sort(aufgabenOrdnung);
}

/** Der Vorgang „Aufgabe aus dieser Notiz" — für dieselbe Notiz immer derselbe. */
export function vorgangAusNotiz(notizId: string): string {
  return `aufgabe-aus-notiz-${notizId.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 100);
}

function aufgabenFehler(fehler: unknown, t: TFunction): string {
  if (fehler instanceof ApiError && fehler.status === 409) {
    const grund = fehler.details.grund;
    if (grund === "konflikt") {
      return t("klaraaufgabe.fehler.konflikt");
    }
    if (grund === "voll") {
      return t("klaraaufgabe.fehler.voll");
    }
  }
  if (fehler instanceof ApiError && fehler.status === 404) {
    return t("klaraaufgabe.fehler.weg");
  }
  return fehlerBild(fehler, t).text;
}

function kurz(text: string): string {
  const flach = text.trim().replace(/\s+/g, " ");
  return [...flach].length > 60 ? `${[...flach].slice(0, 59).join("")}…` : flach;
}

// ------------------------------------------------------------------------------------------------
// Abläufe gegen den Server.
// ------------------------------------------------------------------------------------------------

/** Liest die eigenen Aufgaben. `fuerGeneration`: gilt nur für diesen Stand (nicht nach Vergessen). */
export async function ladeAufgaben(
  t: TFunction,
  fuerGeneration: number = generation,
): Promise<void> {
  if (fuerGeneration !== generation) {
    return;
  }
  const gen = generation;
  ladelauf += 1;
  const lauf = ladelauf;
  // Eine schon gelesene Liste bleibt beim Nachlesen stehen; nur der erste Abruf zeigt „wird gelesen".
  setze((z) => ({ ...z, laden: z.laden === "bereit" ? z.laden : "laedt", ladeFehler: null }));
  try {
    const { aufgaben } = await klaraAufgabeApi.liste();
    if (gen !== generation || lauf !== ladelauf) {
      return;
    }
    setze((z) => ({ ...z, laden: "bereit", liste: [...aufgaben].sort(aufgabenOrdnung) }));
  } catch (fehler) {
    if (gen !== generation || lauf !== ladelauf) {
      return;
    }
    setze((z) => ({ ...z, laden: "fehler", ladeFehler: aufgabenFehler(fehler, t) }));
  }
}

async function versucheAnlegen(vorgang: string, t: TFunction): Promise<KlaraAufgabe | null> {
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
    const { aufgabe, wiederholt } = await klaraAufgabeApi.lege(vorgang, eintrag.eingabe);
    if (gen !== generation) {
      return null;
    }
    // Erst die Bestätigung des Servers macht daraus eine gespeicherte Aufgabe. Eine Wiederholung
    // sagt, dass es sie schon gab — und zeigt genau diese eine.
    setze((z) => ({
      ...z,
      ausstehend: z.ausstehend.filter((a) => a.vorgang !== vorgang),
      liste: mitAufgabe(z.liste, aufgabe),
      meldung: wiederholt
        ? t("klaraaufgabe.schonDa", { titel: aufgabe.titel })
        : t("klaraaufgabe.gespeichert", { titel: aufgabe.titel }),
    }));
    return aufgabe;
  } catch (fehler) {
    if (gen !== generation) {
      return null;
    }
    const text = aufgabenFehler(fehler, t);
    setze((z) => ({
      ...z,
      ausstehend: z.ausstehend.map((a) =>
        a.vorgang === vorgang ? { ...a, stand: "fehler" as const, fehler: text } : a,
      ),
      meldung: t("klaraaufgabe.nichtGespeichert", { grund: text }),
    }));
    return null;
  }
}

/**
 * „Als Aufgabe" an einer eigenen Notiz: Titel, Text und Ort übernimmt der SERVER aus der Notiz.
 * Für dieselbe Notiz ist es immer derselbe Vorgang — zweimal gedrückt ist eine Aufgabe.
 */
export function legeAufgabeAusNotiz(
  notiz: Pick<KlaraNotiz, "id" | "titel">,
  t: TFunction,
): Promise<KlaraAufgabe | null> {
  const vorgang = vorgangAusNotiz(notiz.id);
  if (zustand.ausstehend.some((a) => a.vorgang === vorgang)) {
    return versucheAnlegen(vorgang, t);
  }
  setze((z) => ({
    ...z,
    ausstehend: [
      ...z.ausstehend,
      {
        vorgang,
        eingabe: { weg: "notiz", quelle: { notizId: notiz.id } },
        vorschau: kurz(notiz.titel),
        stand: "laeuft",
        fehler: null,
      },
    ],
  }));
  return versucheAnlegen(vorgang, t);
}

/** „Erneut speichern": derselbe Vorgang — keine Doppelaufgabe. */
export function nochmalAnlegen(vorgang: string, t: TFunction): Promise<KlaraAufgabe | null> {
  return versucheAnlegen(vorgang, t);
}

/** Ein gescheitertes Anlegen bewusst verwerfen (nichts wurde gespeichert). */
export function verwirfAusstehend(vorgang: string): void {
  setze((z) => ({ ...z, ausstehend: z.ausstehend.filter((a) => a.vorgang !== vorgang) }));
}

function ohne<T>(r: Record<string, T>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(r).filter(([k]) => k !== id));
}

async function versucheAendern(
  id: string,
  aenderung: KlaraAufgabeAenderung,
  t: TFunction,
): Promise<boolean> {
  const gen = generation;
  const laeuft: AufgabenAenderung = { stand: "laeuft", fehler: null, aenderung };
  setze((z) => ({ ...z, aenderungen: { ...z.aenderungen, [id]: laeuft } }));
  try {
    const { aufgabe } = await klaraAufgabeApi.aendere(id, aenderung);
    if (gen !== generation) {
      return false;
    }
    const erledigt = aenderung.status === "erledigt" && aufgabe.status === "erledigt";
    const wiederOffen = aenderung.status === "offen" && aufgabe.status === "offen";
    setze((z) => ({
      ...z,
      liste: mitAufgabe(z.liste, aufgabe),
      aenderungen: ohne(z.aenderungen, id),
      meldung: erledigt
        ? t("klaraaufgabe.erledigtMeldung", { titel: aufgabe.titel })
        : wiederOffen
          ? t("klaraaufgabe.wiederOffenMeldung", { titel: aufgabe.titel })
          : t("klaraaufgabe.geaendert", { titel: aufgabe.titel }),
    }));
    return true;
  } catch (fehler) {
    if (gen !== generation) {
      return false;
    }
    const text = aufgabenFehler(fehler, t);
    const gescheitert: AufgabenAenderung = { stand: "fehler", fehler: text, aenderung };
    setze((z) => ({
      ...z,
      aenderungen: { ...z.aenderungen, [id]: gescheitert },
      meldung: t("klaraaufgabe.aenderungNichtGespeichert", { grund: text }),
    }));
    return false;
  }
}

/**
 * Ändert eine eigene Aufgabe mit der Fassung, die gerade angezeigt ist. Läuft an derselben Aufgabe
 * schon ein Versuch, geschieht nichts — ein Doppelklick ist keine zweite Änderung.
 */
export function aendereAufgabe(
  id: string,
  felder: Omit<KlaraAufgabeAenderung, "fassung">,
  t: TFunction,
): Promise<boolean> {
  const a = zustand.liste.find((x) => x.id === id);
  if (!a || zustand.aenderungen[id]?.stand === "laeuft") {
    return Promise.resolve(false);
  }
  return versucheAendern(id, { ...felder, fassung: a.fassung }, t);
}

/** „Erneut speichern" einer gescheiterten Änderung — dieselbe Änderung, dieselbe Fassung. */
export function nochmalAendern(id: string, t: TFunction): Promise<boolean> {
  const v = zustand.aenderungen[id];
  if (!v || v.stand !== "fehler") {
    return Promise.resolve(false);
  }
  return versucheAendern(id, v.aenderung, t);
}

/** Einen gescheiterten Versuch verwerfen und den Stand des Servers neu lesen. */
export function verwirfAenderung(id: string, t: TFunction): Promise<void> {
  setze((z) => ({ ...z, aenderungen: ohne(z.aenderungen, id) }));
  return ladeAufgaben(t);
}

export async function loescheAufgabe(id: string, t: TFunction): Promise<void> {
  const gen = generation;
  try {
    await klaraAufgabeApi.loesche(id);
    if (gen !== generation) {
      return;
    }
    setze((z) => ({
      ...z,
      liste: z.liste.filter((a) => a.id !== id),
      aenderungen: ohne(z.aenderungen, id),
      meldung: t("klaraaufgabe.geloescht"),
    }));
  } catch (fehler) {
    if (gen !== generation) {
      return;
    }
    setze((z) => ({ ...z, meldung: aufgabenFehler(fehler, t) }));
  }
}
