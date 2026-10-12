// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-03/AA-04) — KLARA-TASTENKÜRZEL.
// ================================================================================================
//
// Drei Teile, alle ohne DOM-Typen (strukturell beschrieben, wie `lib/tastenkuerzel.ts`), damit die
// Regeln auch aus Tests ohne Browser gelesen werden:
//
//   1. DIE REGELN einer Kombination (`pruefeBelegung`): welche Kombination für eine Klara-Aktion
//      zulässig ist und mit welchem konkreten Grund eine andere abgelehnt wird — Doppelbelegung,
//      Befehlspalette (⌘K/Strg+K), Bearbeiten/Browser, macOS-Systembefehle, VoiceOver (⌃⌥). Die
//      Liste ist keine Garantie freier Kombinationen: fremde Programme sind aus dem Browser nicht
//      erkennbar, und die Oberfläche behauptet das auch nicht.
//   2. DIE ANZEIGE (`kuerzelZeichen`, `kuerzelWorte`): Mac-Symbole ⌃ ⌥ ⇧ ⌘ in Apple-Reihenfolge, sonst
//      „Strg+Alt+Umschalt+…“; dazu die ausgeschriebene Fassung für Screenreader und Tooltip. Die
//      Taste ist die Beschriftung, die die Person bei der Aufnahme gedrückt hat — auf deutschem
//      Layout also „Y“ für die physische Taste `KeyZ`. Erkannt wird über `code` (physische Taste).
//   3. DER SPEICHER (`useTastenkuerzel`) des vom Server bestätigten Stands — gebaut wie
//      `klaraEigeninitiative.ts`: an das Konto gebunden, bei Abmeldung und Kontowechsel verworfen,
//      dauerhaft nur am Server (`/api/me/assistenz/tastenkuerzel`).
//
// GELTUNGSBEREICH (Peters Wahl „Option 1“): innerhalb des aktiven Klarwerk-Fensters. Eine
// systemweite Auslösung ist vorgemerkt, nicht gebaut — die Oberfläche verspricht sie nicht.
import { useSyncExternalStore } from "react";
import {
  KLARA_KUERZEL_AKTIONEN,
  type KlaraKuerzelAktion,
  type KuerzelEintrag,
  type KuerzelKombination,
  type TastenkuerzelAntwort,
  tastenkuerzelApi,
} from "../api/assistenzTastenkuerzel";
import { ApiError } from "../api/client";
import type { Plattform } from "./tastenkuerzel";

export { KLARA_KUERZEL_AKTIONEN };
export type { KlaraKuerzelAktion, KuerzelEintrag, KuerzelKombination };

// ------------------------------------------------------------------------------------------------
// 1. Aus einem Tastenereignis eine Kombination machen.
// ------------------------------------------------------------------------------------------------

/** Die Felder eines `KeyboardEvent`, die hier gebraucht werden — für Tests einzeln setzbar. */
export interface TastenEreignis {
  readonly code: string;
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}

const ERLAUBTER_CODE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/;
const MODIFIKATOR_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
  "CapsLock",
  "Fn",
]);

/** Die Beschriftung aus dem Code allein: `KeyZ` → „Z“, `Digit4` → „4“, `F7` → „F7“. */
function tasteAusCode(code: string): string {
  if (code.startsWith("Key")) {
    return code.slice(3);
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }
  return code;
}

/**
 * Die Beschriftung, die die Person sieht: das erzeugte Zeichen, wenn es ein Buchstabe oder eine
 * Ziffer ist (so bleibt „Y“ auf deutschem Layout „Y“), sonst die Taste aus dem Code — Option/Alt
 * erzeugt auf dem Mac Sonderzeichen („∂“), die keine Beschriftung sind.
 */
export function tasteBeschriftung(code: string, key: string): string {
  if (code.startsWith("F")) {
    return code;
  }
  return /^[\p{L}\p{N}]$/u.test(key) ? key.toUpperCase() : tasteAusCode(code);
}

export type Aufnahme =
  | { readonly art: "kombination"; readonly kombination: KuerzelKombination }
  | { readonly art: "nurModifikator" }
  | { readonly art: "taste" };

/** Was eine gedrückte Taste für die Aufnahme bedeutet. */
export function aufnahmeAus(e: TastenEreignis): Aufnahme {
  if (MODIFIKATOR_CODES.has(e.code) || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
    return { art: "nurModifikator" };
  }
  if (!ERLAUBTER_CODE.test(e.code)) {
    return { art: "taste" };
  }
  return {
    art: "kombination",
    kombination: {
      code: e.code,
      taste: tasteBeschriftung(e.code, e.key),
      strg: e.ctrlKey,
      alt: e.altKey,
      umschalt: e.shiftKey,
      meta: e.metaKey,
    },
  };
}

export function gleicheKombination(a: KuerzelKombination, b: KuerzelKombination): boolean {
  return (
    a.code === b.code &&
    a.strg === b.strg &&
    a.alt === b.alt &&
    a.umschalt === b.umschalt &&
    a.meta === b.meta
  );
}

/** Passt das Ereignis genau auf die Kombination (alle vier Modifikatoren gleich)? */
export function passt(e: TastenEreignis, k: KuerzelKombination): boolean {
  return (
    e.code === k.code &&
    e.ctrlKey === k.strg &&
    e.altKey === k.alt &&
    e.shiftKey === k.umschalt &&
    e.metaKey === k.meta
  );
}

/** Die Aktion, deren wirksame Belegung genau dieses Ereignis ist — sonst `null`. */
export function aktionFuer(
  e: TastenEreignis,
  eintraege: readonly KuerzelEintrag[],
): KlaraKuerzelAktion | null {
  for (const eintrag of eintraege) {
    if (eintrag.belegung && passt(e, eintrag.belegung)) {
      return eintrag.aktion;
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// 2. Die Regeln.
// ------------------------------------------------------------------------------------------------

export type KonfliktGrund =
  | "ohneModifikator"
  | "voiceover"
  | "taste"
  | "palette"
  | "einfach"
  | "browser"
  | "macos"
  | "doppelt";

export interface Konflikt {
  readonly grund: KonfliktGrund;
  /** Bei `doppelt`: die Aktion, die diese Kombination schon trägt. */
  readonly belegtVon?: KlaraKuerzelAktion;
}

/** Befehls-/Steuerungstaste + Umschalt (ohne Option): vom Browser bzw. Bearbeiten belegt. */
const MIT_UMSCHALT = new Set([..."ABCDFGHIJLMNOPQRSTVWYZ"]);
/** ⌥⌘ (Option + Befehl): macOS- und Browserbefehle (Dock, Ausblenden, Entwicklerwerkzeuge …). */
const OPTION_BEFEHL = new Set([..."BCDFHIJLMNPTUVW"]);
/** ⌃⌘ (Control + Befehl): Bildschirm sperren, Vollbild, Nachschlagen. */
const CONTROL_BEFEHL = new Set([..."DFQ"]);
/** ⌘⇧3/4/5/6: Bildschirmfotos (auch mit ⌃). */
const BILDSCHIRMFOTO = new Set([..."3456"]);
/** F4 (Tab schliessen), F5 (Neu laden; ⌘F5 = VoiceOver), F11 (Schreibtisch), F12 (Entwickler). */
const SYSTEM_F = new Set(["F4", "F5", "F11", "F12"]);

function buchstaben(k: KuerzelKombination): readonly string[] {
  return [tasteAusCode(k.code), k.taste.toUpperCase()];
}

/**
 * Darf `k` für `aktion` gespeichert werden? `null` heisst ja; sonst der konkrete Grund. Gilt
 * unabhängig vom Gerät, weil die Belegung am Konto liegt und auf Mac und Windows wirken soll.
 */
export function pruefeBelegung(
  k: KuerzelKombination,
  aktion: KlaraKuerzelAktion,
  eintraege: readonly KuerzelEintrag[],
): Konflikt | null {
  if (!k.strg && !k.meta) {
    return { grund: "ohneModifikator" };
  }
  // Control + Option ist die VoiceOver-Taste (macOS) und AltGr (Windows, z. B. „@“).
  if (k.strg && k.alt) {
    return { grund: "voiceover" };
  }
  if (!ERLAUBTER_CODE.test(k.code)) {
    return { grund: "taste" };
  }
  const zeichen = buchstaben(k);
  const trifft = (menge: ReadonlySet<string>): boolean => zeichen.some((z) => menge.has(z));
  // Die Befehlspalette hört auf JEDE Kombination aus ⌘ oder Strg mit K (`CommandPalette.tsx`) —
  // auch Control+Command+K würde sie mit öffnen.
  if (trifft(new Set(["K"]))) {
    return { grund: "palette" };
  }
  if (SYSTEM_F.has(k.code)) {
    return { grund: "browser" };
  }
  const einPrimaer = k.strg !== k.meta;
  if (einPrimaer && !k.alt && !k.umschalt) {
    return { grund: "einfach" };
  }
  if (k.meta && k.umschalt && trifft(BILDSCHIRMFOTO)) {
    return { grund: "macos" };
  }
  if (einPrimaer && k.umschalt && !k.alt && trifft(MIT_UMSCHALT)) {
    return { grund: "browser" };
  }
  if (k.meta && k.alt && trifft(OPTION_BEFEHL)) {
    return { grund: "macos" };
  }
  if (k.meta && k.strg && trifft(CONTROL_BEFEHL)) {
    return { grund: "macos" };
  }
  const doppelt = eintraege.find(
    (e) => e.aktion !== aktion && e.belegung !== null && gleicheKombination(e.belegung, k),
  );
  if (doppelt) {
    return { grund: "doppelt", belegtVon: doppelt.aktion };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// 3. Die Anzeige.
// ------------------------------------------------------------------------------------------------

/** Die kurze Form: „⌃⇧⌘Y“ auf Apple-Geräten, sonst „Strg+Umschalt+Y“ bzw. „Ctrl+Shift+Y“. */
export function kuerzelZeichen(
  k: KuerzelKombination,
  plattform: Plattform,
  sprache: string,
): string {
  if (plattform === "apple") {
    return `${k.strg ? "⌃" : ""}${k.alt ? "⌥" : ""}${k.umschalt ? "⇧" : ""}${k.meta ? "⌘" : ""}${k.taste}`;
  }
  const de = sprache.startsWith("de");
  const teile = [
    k.strg ? (de ? "Strg" : "Ctrl") : null,
    k.alt ? "Alt" : null,
    k.umschalt ? (de ? "Umschalt" : "Shift") : null,
    k.meta ? (de ? "Windows" : "Win") : null,
    k.taste,
  ].filter((teil): teil is string => teil !== null);
  return teile.join("+");
}

/** Die ausgeschriebene Form für Screenreader und Tooltip: „Control Umschalt Befehl Y“. */
export function kuerzelWorte(
  k: KuerzelKombination,
  plattform: Plattform,
  namen: { strg: string; alt: string; umschalt: string; meta: string },
): string {
  const teile = [
    k.strg ? namen.strg : null,
    k.alt ? namen.alt : null,
    k.umschalt ? namen.umschalt : null,
    k.meta ? namen.meta : null,
    k.taste,
  ].filter((teil): teil is string => teil !== null);
  return plattform === "apple" ? teile.join(" ") : teile.join(" + ");
}

// ------------------------------------------------------------------------------------------------
// 4. Der Ausführungsweg: ein Ereignis, das die vorhandenen Flächen ausführen.
// ------------------------------------------------------------------------------------------------

/** Name des Fensterereignisses, über das eine Klara-Aktion ausgelöst wird. */
export const KLARA_AKTION_EREIGNIS = "klarwerk:klara-aktion";

interface Fenster {
  dispatchEvent(e: unknown): boolean;
}

interface EreignisFabrik {
  new (typ: string, init: { detail: { aktion: KlaraKuerzelAktion } }): unknown;
}

/** Löst die Aktion aus — die zuständige Fläche (Gespräch, Seitenhilfe) führt sie aus. */
export function loeseKlaraAktionAus(aktion: KlaraKuerzelAktion): void {
  const g = globalThis as unknown as { window?: Fenster; CustomEvent?: EreignisFabrik };
  if (!g.window || !g.CustomEvent) {
    return;
  }
  g.window.dispatchEvent(new g.CustomEvent(KLARA_AKTION_EREIGNIS, { detail: { aktion } }));
}

// Während eine Kombination aufgenommen wird, löst kein Kürzel etwas aus.
let aufnahmeLaeuft = false;

export function setzeKuerzelAufnahme(laeuft: boolean): void {
  aufnahmeLaeuft = laeuft;
}

export function kuerzelAufnahmeLaeuft(): boolean {
  return aufnahmeLaeuft;
}

// ------------------------------------------------------------------------------------------------
// 5. Der Speicher des bestätigten Stands.
// ------------------------------------------------------------------------------------------------

export type TastenkuerzelLadestand = "leer" | "laedt" | "bereit" | "fehler";

export interface TastenkuerzelLage {
  readonly kontoId: string | null;
  readonly status: TastenkuerzelLadestand;
  readonly antwort: TastenkuerzelAntwort | null;
  /** Welche Änderung gerade unterwegs ist — eine Aktion oder „alle“. */
  readonly speichert: KlaraKuerzelAktion | "alle" | null;
}

const LEER: TastenkuerzelLage = { kontoId: null, status: "leer", antwort: null, speichert: null };

let lage: TastenkuerzelLage = LEER;
const hoerer = new Set<() => void>();

function setze(neu: TastenkuerzelLage): void {
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

export function tastenkuerzelLage(): TastenkuerzelLage {
  return lage;
}

export function useTastenkuerzel(): TastenkuerzelLage {
  return useSyncExternalStore(abonniere, tastenkuerzelLage, tastenkuerzelLage);
}

/** Die wirksamen Belegungen — nur der vom Server bestätigte Stand zählt. */
export function wirksameEintraege(l: TastenkuerzelLage): readonly KuerzelEintrag[] {
  return l.status === "bereit" && l.antwort ? l.antwort.aktionen : [];
}

function istKombination(wert: unknown): wert is KuerzelKombination {
  if (typeof wert !== "object" || wert === null) {
    return false;
  }
  const k = wert as Partial<KuerzelKombination>;
  return (
    typeof k.code === "string" &&
    typeof k.taste === "string" &&
    typeof k.strg === "boolean" &&
    typeof k.alt === "boolean" &&
    typeof k.umschalt === "boolean" &&
    typeof k.meta === "boolean"
  );
}

function istAntwort(wert: unknown): wert is TastenkuerzelAntwort {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    return false;
  }
  const aktionen = (wert as Partial<TastenkuerzelAntwort>).aktionen;
  return (
    Array.isArray(aktionen) &&
    aktionen.every(
      (e) =>
        (KLARA_KUERZEL_AKTIONEN as readonly string[]).includes(e?.aktion) &&
        (e.belegung === null || istKombination(e.belegung)) &&
        (e.quelle === "standard" || e.quelle === "eigen" || e.quelle === "entfernt"),
    )
  );
}

/** Liest die Kürzel des Kontos. Kommt die Antwort nach einem Kontowechsel, gilt sie nicht. */
export async function ladeTastenkuerzel(kontoId: string): Promise<void> {
  if (lage.kontoId !== kontoId) {
    setze({ ...LEER, kontoId, status: "laedt" });
  }
  try {
    const antwort: unknown = await tastenkuerzelApi.lesen();
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz/tastenkuerzel");
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

export type SpeicherErgebnis =
  | { readonly ok: true }
  | { readonly ok: false; readonly art: "doppelt"; readonly belegtVon: KlaraKuerzelAktion | null }
  | { readonly ok: false; readonly art: "abgelehnt" | "fehler" };

function fehlerArt(fehler: unknown): SpeicherErgebnis {
  if (fehler instanceof ApiError && fehler.details.grund === "doppelt") {
    const von = fehler.details.belegtVon;
    return {
      ok: false,
      art: "doppelt",
      belegtVon: (KLARA_KUERZEL_AKTIONEN as readonly unknown[]).includes(von)
        ? (von as KlaraKuerzelAktion)
        : null,
    };
  }
  if (fehler instanceof ApiError && fehler.status === 400) {
    return { ok: false, art: "abgelehnt" };
  }
  return { ok: false, art: "fehler" };
}

async function schreibe(
  kontoId: string,
  wer: KlaraKuerzelAktion | "alle",
  aufruf: () => Promise<unknown>,
): Promise<SpeicherErgebnis> {
  if (lage.kontoId !== kontoId || lage.speichert !== null) {
    return { ok: false, art: "fehler" };
  }
  setze({ ...lage, speichert: wer });
  try {
    const antwort = await aufruf();
    if (!istAntwort(antwort)) {
      throw new Error("Unerwartete Antwort auf /api/me/assistenz/tastenkuerzel");
    }
    if (lage.kontoId === kontoId) {
      setze({ ...lage, status: "bereit", antwort, speichert: null });
    }
    return { ok: true };
  } catch (fehler) {
    // Nichts wird vorgetäuscht: es gilt weiter der zuletzt bestätigte Stand.
    if (lage.kontoId === kontoId) {
      setze({ ...lage, speichert: null });
    }
    return fehlerArt(fehler);
  }
}

/** Belegt eine Aktion (`null` = entfernen, `"standard"` = auf den Standard zurück). */
export function setzeKuerzel(
  kontoId: string,
  aktion: KlaraKuerzelAktion,
  belegung: KuerzelKombination | null | "standard",
): Promise<SpeicherErgebnis> {
  return schreibe(kontoId, aktion, () => tastenkuerzelApi.setzen(aktion, belegung));
}

/** Stellt für alle Aktionen die definierten Standards wieder her. */
export function setzeAlleKuerzelZurueck(kontoId: string): Promise<SpeicherErgebnis> {
  return schreibe(kontoId, "alle", () => tastenkuerzelApi.alleZuruecksetzen());
}

/** Abmelden oder Kontowechsel: nichts vom bisherigen Stand bleibt im Browser stehen. */
export function verwerfeTastenkuerzel(): void {
  aufnahmeLaeuft = false;
  if (lage !== LEER) {
    setze(LEER);
  }
}
