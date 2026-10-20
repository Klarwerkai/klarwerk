// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · DIE PERSÖNLICHEN ERINNERUNGEN —
// Entwurf aus Gespräch, Notiz oder Aufgabe, Klärung der Zeitangabe, Anlegen, Bedienung.
// ================================================================================================
//
// DIE WAHRHEIT IST DER SERVER (`/api/me/klara/erinnerungen`). Hier liegt nur, was gerade gezeigt wird,
// und der noch NICHT gespeicherte Entwurf — dieselbe Bauart wie `aufgaben.ts`:
//   · Ein Entwurf trägt EINEN Vorgangsschlüssel. „Erneut speichern" schickt denselben — zweimal
//     gedrückt ist eine Erinnerung.
//   · Eine Freitextangabe („morgen um neun") wird nur am Server gedeutet. Ist sie mehrdeutig, steht
//     die Klärung da; gespeichert wird erst ein eindeutiger Zeitplan (Datum UND Uhrzeit, Zone).
//   · Jede Bedienung nennt die gesehene Fassung; gezeigt wird danach der bestätigte Stand.
//
// AUSSERHALB VON REACT wie `aufgaben.ts`: die Hülle montiert Klara bei jeder Breitenänderung neu.
import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";
import { ApiError } from "../../api/client";
import {
  type ErinnerungBezug,
  type ErinnerungBezugEingabe,
  type ErinnerungEingabe,
  type ErinnerungEinstellungen,
  type KlaraErinnerung,
  type UebernommeneErinnerung,
  klaraErinnerungApi,
} from "../../api/klaraErinnerung";
import { beimVergessen, fehlerBild } from "./echt";

export type ErinnerungenLadestand = "aus" | "laedt" | "bereit" | "fehler";

/** Ein Entwurf — angefangen an einer Nachricht, Notiz, Aufgabe oder frei. */
export interface ErinnerungEntwurf {
  vorgang: string;
  bezug: ErinnerungBezugEingabe;
  /** Was die Person als Bezug sieht (Titel bzw. Auszug) — der Server liest den echten selbst. */
  bezugText: string;
  titel: string;
  stand: "offen" | "laeuft" | "fehler";
  fehler: string | null;
}

export interface ErinnerungenZustand {
  laden: ErinnerungenLadestand;
  ladeFehler: string | null;
  liste: KlaraErinnerung[];
  /** AW18-K08: mir bewusst übergebene Erinnerungen — nur Titel, Termine, Lage. */
  uebernommen: UebernommeneErinnerung[];
  /** P07: die Vorgaben des Einrichtungsassistenten — `null`, solange nicht gelesen. */
  einstellungen: ErinnerungEinstellungen | null;
  /** Der Assistent ist offen (freiwillig, jederzeit erneut aufrufbar). */
  assistentOffen: boolean;
  entwurf: ErinnerungEntwurf | null;
  /** Je Erinnerung: läuft gerade eine Bedienung bzw. ihr letzter Fehler. */
  laufend: Record<string, boolean>;
  fehler: Record<string, string>;
  meldung: string | null;
  generation: number;
}

const LEER: ErinnerungenZustand = {
  laden: "aus",
  ladeFehler: null,
  liste: [],
  uebernommen: [],
  einstellungen: null,
  assistentOffen: false,
  entwurf: null,
  laufend: {},
  fehler: {},
  meldung: null,
  generation: 0,
};

let zustand: ErinnerungenZustand = LEER;
const hoerer = new Set<() => void>();
let generation = 0;
let ladelauf = 0;

function setze(f: (z: ErinnerungenZustand) => ErinnerungenZustand): void {
  const neu = f(zustand);
  if (neu === zustand) {
    return;
  }
  zustand = neu;
  for (const h of hoerer) {
    h();
  }
}

export function leseErinnerungen(): ErinnerungenZustand {
  return zustand;
}

export function useErinnerungen(): ErinnerungenZustand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    leseErinnerungen,
    leseErinnerungen,
  );
}

export function vergissErinnerungen(): void {
  generation += 1;
  zustand = { ...LEER, generation };
  for (const h of hoerer) {
    h();
  }
}
beimVergessen(vergissErinnerungen);

/** Die Zeitzone dieses Geräts — Vorschlag, die Person wählt sie sichtbar. */
export function geraeteZeitzone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

function neuerVorgang(): string {
  const zufall =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `erinnerung-${zufall}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
}

/** Ein kurzer Titelvorschlag aus fremdem Text (Nachricht, Notiz) — gekürzt, nicht erfunden. */
export function kurzText(text: string, max = 80): string {
  const flach = text.trim().replace(/\s+/g, " ");
  return [...flach].length > max ? `${[...flach].slice(0, max - 1).join("")}…` : flach;
}

function mitErinnerung(liste: readonly KlaraErinnerung[], e: KlaraErinnerung): KlaraErinnerung[] {
  return [e, ...liste.filter((x) => x.id !== e.id)];
}

export function erinnerungFehler(fehler: unknown, t: TFunction): string {
  if (fehler instanceof ApiError) {
    const grund = fehler.details.grund;
    if (fehler.status === 409 && grund === "konflikt") {
      return t("klaraerinnerung.fehler.konflikt");
    }
    if (fehler.status === 409 && grund === "zustand") {
      return t("klaraerinnerung.fehler.zustand");
    }
    if (grund === "vergangen") {
      return t("klaraerinnerung.fehler.vergangen");
    }
    if (fehler.status === 409 && grund === "voll") {
      return t("klaraerinnerung.fehler.voll");
    }
    if (fehler.status === 409 && grund === "empfaenger") {
      return t("klaraerinnerung.fehler.empfaenger");
    }
    if (fehler.status === 409 && grund === "fremd_geaendert") {
      return t("klaraerinnerung.fehler.fremdGeaendert");
    }
    if (fehler.status === 400 && grund === "wirkung_nicht_beauftragt") {
      return t("klaraerinnerung.fehler.wirkungNichtBeauftragt");
    }
    if (fehler.status === 404) {
      return t("klaraerinnerung.fehler.weg");
    }
    if (fehler.status === 400 && fehler.message) {
      return fehler.message;
    }
  }
  return fehlerBild(fehler, t).text;
}

export async function ladeErinnerungen(
  t: TFunction,
  fuerGeneration: number = generation,
): Promise<void> {
  if (fuerGeneration !== generation) {
    return;
  }
  const gen = generation;
  ladelauf += 1;
  const lauf = ladelauf;
  setze((z) => ({ ...z, laden: z.laden === "bereit" ? z.laden : "laedt", ladeFehler: null }));
  try {
    const { erinnerungen, uebernommen } = await klaraErinnerungApi.liste();
    if (gen !== generation || lauf !== ladelauf) {
      return;
    }
    setze((z) => ({
      ...z,
      laden: "bereit",
      liste: erinnerungen,
      uebernommen: uebernommen ?? [],
    }));
  } catch (fehler) {
    if (gen !== generation || lauf !== ladelauf) {
      return;
    }
    setze((z) => ({ ...z, laden: "fehler", ladeFehler: erinnerungFehler(fehler, t) }));
  }
}

/** Ein direkt verlinktes Ziel (`?erinnerung=<id>` aus der Glocke), das nicht in der Liste steht. */
export async function holeErinnerung(id: string, t: TFunction): Promise<void> {
  const gen = generation;
  try {
    const { erinnerung } = await klaraErinnerungApi.hole(id);
    if (gen === generation) {
      setze((z) => ({ ...z, liste: mitErinnerung(z.liste, erinnerung) }));
    }
  } catch (fehler) {
    if (gen === generation) {
      setze((z) => ({
        ...z,
        meldung: t("klaraerinnerung.zielNichtGeoeffnet", { grund: erinnerungFehler(fehler, t) }),
      }));
    }
  }
}

/** Was die Person als Bezug sieht. */
export function bezugAnzeige(b: ErinnerungBezug, t: TFunction): string {
  if (b.art === "notiz") {
    return t("klaraerinnerung.bezug.notiz", { titel: b.notizTitel });
  }
  if (b.art === "aufgabe") {
    return t("klaraerinnerung.bezug.aufgabe", { titel: b.aufgabeTitel });
  }
  if (b.art === "gespraech") {
    return t("klaraerinnerung.bezug.gespraech", { auszug: b.auszug });
  }
  return t("klaraerinnerung.bezug.frei");
}

/**
 * „Erinnern" an einer Nachricht, Notiz oder Aufgabe — oder frei: öffnet den Entwurf. Gespeichert
 * wird erst nach geklärter Zeitangabe; Schließen verwirft nur den Entwurf und speichert nichts.
 */
export function starteEntwurf(
  bezug: ErinnerungBezugEingabe,
  bezugText: string,
  titel: string,
): void {
  setze((z) => ({
    ...z,
    entwurf: { vorgang: neuerVorgang(), bezug, bezugText, titel, stand: "offen", fehler: null },
    meldung: null,
  }));
}

export function verwirfEntwurf(): void {
  setze((z) => ({ ...z, entwurf: null }));
}

/** Speichert den Entwurf — mit SEINEM Vorgangsschlüssel, auch bei „Erneut speichern". */
export async function speichereEntwurf(
  eingabe: Omit<ErinnerungEingabe, "bezug">,
  t: TFunction,
): Promise<KlaraErinnerung | null> {
  const entwurf = zustand.entwurf;
  if (!entwurf || entwurf.stand === "laeuft") {
    return null;
  }
  const gen = generation;
  setze((z) => ({
    ...z,
    entwurf: z.entwurf ? { ...z.entwurf, stand: "laeuft", fehler: null } : z.entwurf,
  }));
  try {
    const { erinnerung, wiederholt } = await klaraErinnerungApi.lege(entwurf.vorgang, {
      ...eingabe,
      bezug: entwurf.bezug,
    });
    if (gen !== generation) {
      return null;
    }
    setze((z) => ({
      ...z,
      entwurf: null,
      liste: mitErinnerung(z.liste, erinnerung),
      meldung: wiederholt
        ? t("klaraerinnerung.schonDa", { titel: erinnerung.titel })
        : t("klaraerinnerung.gespeichert", { titel: erinnerung.titel }),
    }));
    return erinnerung;
  } catch (fehler) {
    if (gen !== generation) {
      return null;
    }
    const text = erinnerungFehler(fehler, t);
    setze((z) => ({
      ...z,
      entwurf: z.entwurf ? { ...z.entwurf, stand: "fehler", fehler: text } : z.entwurf,
      meldung: t("klaraerinnerung.nichtGespeichert", { grund: text }),
    }));
    return null;
  }
}

function ohne<T>(r: Record<string, T>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(r).filter(([k]) => k !== id));
}

/**
 * Eine Bedienung an GENAU einer Erinnerung (Status, Termin, Klärung, Änderung). Läuft dort schon
 * eine, geschieht nichts — ein Doppelklick ist keine zweite Änderung.
 */
export async function bediene(
  id: string,
  aufruf: (
    fassung: number,
  ) => Promise<{ erinnerung: KlaraErinnerung } | { bisher: KlaraErinnerung; neu: KlaraErinnerung }>,
  erfolg: string,
  t: TFunction,
): Promise<boolean> {
  const e = zustand.liste.find((x) => x.id === id);
  if (!e || zustand.laufend[id]) {
    return false;
  }
  const gen = generation;
  setze((z) => ({ ...z, laufend: { ...z.laufend, [id]: true }, fehler: ohne(z.fehler, id) }));
  try {
    const antwort = await aufruf(e.fassung);
    if (gen !== generation) {
      return false;
    }
    setze((z) => {
      let liste = z.liste;
      if ("erinnerung" in antwort) {
        liste = mitErinnerung(liste, antwort.erinnerung);
      } else {
        liste = mitErinnerung(mitErinnerung(liste, antwort.neu), antwort.bisher);
      }
      return { ...z, liste, laufend: ohne(z.laufend, id), meldung: erfolg };
    });
    return true;
  } catch (fehler) {
    if (gen !== generation) {
      return false;
    }
    const text = erinnerungFehler(fehler, t);
    setze((z) => ({
      ...z,
      laufend: ohne(z.laufend, id),
      fehler: { ...z.fehler, [id]: text },
      meldung: t("klaraerinnerung.aenderungNichtGespeichert", { grund: text }),
    }));
    return false;
  }
}

export async function loescheErinnerung(id: string, t: TFunction): Promise<void> {
  const gen = generation;
  try {
    await klaraErinnerungApi.loesche(id);
    if (gen === generation) {
      setze((z) => ({
        ...z,
        liste: z.liste.filter((e) => e.id !== id),
        meldung: t("klaraerinnerung.geloescht"),
      }));
    }
  } catch (fehler) {
    if (gen === generation) {
      setze((z) => ({ ...z, meldung: erinnerungFehler(fehler, t) }));
    }
  }
}

// ------------------------------------------------------------------------------------------------
// P07 · DER EINRICHTUNGSASSISTENT — freiwillig, jederzeit erneut aufrufbar, Zeitzonenwahl.
// ------------------------------------------------------------------------------------------------

/** Liest die eigenen Vorgaben vom Server (ohne gespeicherte Zeile: Werkvorgaben, Fassung 0). */
export async function ladeEinstellungen(t: TFunction): Promise<void> {
  const gen = generation;
  try {
    const { einstellungen } = await klaraErinnerungApi.einstellungen();
    if (gen === generation) {
      setze((z) => ({ ...z, einstellungen }));
    }
  } catch (fehler) {
    if (gen === generation) {
      setze((z) => ({ ...z, meldung: erinnerungFehler(fehler, t) }));
    }
  }
}

export function oeffneAssistent(): void {
  setze((z) => ({ ...z, assistentOffen: true }));
}

/** Schließen ohne Speichern — freiwillig heißt: nichts wird ohne „Übernehmen" gespeichert. */
export function schliesseAssistent(): void {
  setze((z) => ({ ...z, assistentOffen: false }));
}

/** Speichert die im Assistenten gewählten Vorgaben; bestehende Erinnerungen bleiben unverändert. */
export async function speichereEinstellungen(
  wahl: {
    zeitzone: string;
    sommerzeit: KlaraErinnerung["sommerzeit"];
    verpasst: KlaraErinnerung["verpasst"];
  },
  t: TFunction,
): Promise<boolean> {
  const gen = generation;
  const fassung = zustand.einstellungen?.fassung ?? 0;
  try {
    const { einstellungen } = await klaraErinnerungApi.setzeEinstellungen({
      fassung,
      ...wahl,
      abschliessen: true,
    });
    if (gen !== generation) {
      return false;
    }
    setze((z) => ({
      ...z,
      einstellungen,
      assistentOffen: false,
      meldung: t("klaraerinnerung.assistent.gespeichert", { zone: wahl.zeitzone }),
    }));
    return true;
  } catch (fehler) {
    if (gen === generation) {
      setze((z) => ({
        ...z,
        meldung: t("klaraerinnerung.nichtGespeichert", { grund: erinnerungFehler(fehler, t) }),
      }));
    }
    return false;
  }
}

// ------------------------------------------------------------------------------------------------
// EQF-07 · ROUTINEN — Änderung in Worten (erst deuten, dann bewusst übernehmen), Rücknahme.
// ------------------------------------------------------------------------------------------------

/** Deutet eine Routinenänderung in Worten, ohne etwas zu ändern. `null`: Fehler (Meldung gesetzt). */
export async function deuteRoutine(
  id: string,
  text: string,
  t: TFunction,
): Promise<{ art: string; wochentag?: number; abschnitt?: string } | null> {
  const e = zustand.liste.find((x) => x.id === id);
  if (!e) {
    return null;
  }
  try {
    const { deutung } = await klaraErinnerungApi.aendereRoutine(id, e.fassung, text, false);
    return deutung;
  } catch (fehler) {
    setze((z) => ({ ...z, fehler: { ...z.fehler, [id]: erinnerungFehler(fehler, t) } }));
    return null;
  }
}

/** Übernimmt eine gedeutete Routinenänderung — dieselbe Bedienung wie jede andere (Fassung). */
export function uebernimmRoutine(id: string, text: string, t: TFunction): Promise<boolean> {
  return bediene(
    id,
    (fassung) => klaraErinnerungApi.aendereRoutine(id, fassung, text, true),
    t("klaraerinnerung.routine.geaendert"),
    t,
  );
}

/** Nimmt den Bericht eines Termins zurück (nur unverändert; sonst bleibt er, mit Grund). */
export function nimmRoutineErgebnisZurueck(
  id: string,
  vorkommenId: string,
  t: TFunction,
): Promise<boolean> {
  return bediene(
    id,
    () => klaraErinnerungApi.nimmErgebnisZurueck(id, vorkommenId),
    t("klaraerinnerung.routine.zurueckgenommen"),
    t,
  );
}

// ------------------------------------------------------------------------------------------------
// AW18-K08 · BEWUSSTE ÜBERGABE
// ------------------------------------------------------------------------------------------------

/** Die Zuständige gibt eine übergebene Erinnerung zurück; danach liest die Liste neu. */
export async function gibErinnerungZurueck(id: string, t: TFunction): Promise<void> {
  const gen = generation;
  try {
    await klaraErinnerungApi.gibZurueck(id);
    if (gen === generation) {
      setze((z) => ({
        ...z,
        uebernommen: z.uebernommen.filter((e) => e.id !== id),
        meldung: t("klaraerinnerung.uebergabe.zurueckgegeben"),
      }));
    }
  } catch (fehler) {
    if (gen === generation) {
      setze((z) => ({ ...z, meldung: erinnerungFehler(fehler, t) }));
    }
  }
}
