// ================================================================================================
// KLARA 05 (produkt:20261008:klara-aktionen) — AUFTRÄGE AUSFÜHREN, STOPPEN UND RÜCKGÄNGIG MACHEN.
// ================================================================================================
//
// DER DATENWEG (AW-10), in dieser Reihenfolge und für getippte wie gesprochene Aufträge GLEICH:
//   1. ERKENNEN — `lib/klaraAuftragErkennung.ts`, feste Satzformen, kein Sprachmodell.
//   2. ZIEL KLÄREN — Namen werden über die vorhandenen Listen aufgelöst (`/api/kos`, `/api/drafts`,
//      Prüf-/Konflikt-/Lückenaufgaben wie „Meine Aufgaben“). Kein Treffer: nichts geschieht.
//      Mehrere: Rückfrage, BEVOR irgendetwas ausgeführt wird.
//   3. AUFTRAG MIT GRENZE — am Server im eigenen Gespräch (`/api/me/klara/…/auftraege`): Ziel,
//      erlaubte Aktionen, Ziele und Quellen, verantwortliche Person, Ergebnisanforderung. Stand
//      „vorgeschlagen“.
//   4. JE SCHRITT: am Server BEGINNEN (die Grenze prüft Aktion, Ziel, Fassung, Abbruch) → über den
//      VORHANDENEN Produktweg ausführen, der seine Rechte und Fassungen selbst prüft
//      (`endpoints.drafts`, `endpoints.ko`, Navigation) → am Server NACHLESEN → Ergebnis melden
//      („gespeichert“ bzw. „abgeschlossen“). Erst danach steht ein Erfolg da.
//   5. ABBRECHEN verhindert weitere Schritte; was schon gespeichert ist, bleibt sichtbar.
//      RÜCKGÄNGIG ist davon getrennt und nimmt eine gespeicherte Änderung über denselben Weg zurück
//      (Papierkorb bzw. vorherige Fassung mit Standvergleich) — oder sagt, warum nicht.
//
// VERBINDUNGSABBRUCH: Ist unklar, ob ein Schritt wirkte, steht „Ergebnis unklar“ da — nie ein Erfolg.
// „Erneut versuchen“ nutzt DENSELBEN Schrittschlüssel: am Server derselbe Schritt, beim Anlegen
// derselbe Vorgangsschlüssel (`operationId`), also kein zweiter Entwurf.
//
// WARUM AUSSERHALB VON REACT: wie `echt.ts` — die Hülle montiert Klara bei jeder Breitenänderung neu,
// ein laufender Auftrag darf dabei nicht verloren gehen. Der Zustand gehört dem Konto; `vergiss()`
// in `echt.ts` räumt ihn mit ab.
import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import {
  type KlaraAufgabenaktion,
  type KlaraAuftrag,
  type KlaraAuftragErgebnis,
  type KlaraAuftragSchritt,
  type KlaraAuftragZiel,
  type KlaraAuftragsQuelle,
  type KlaraSchrittStand,
  klaraAuftragApi,
} from "../../api/klaraAuftrag";
import type { DraftPayload } from "../../api/types";
import { fallHref } from "../../lib/fallAbsprung";
import { type ErkannterSchritt, erkenneAuftrag } from "../../lib/klaraAuftragErkennung";
import { leseobjektJetzt } from "../../lib/leseobjekt";
import { leserHref } from "../../lib/objektbezug";
import { isOpenGap, isUnresolvedConflict } from "../../lib/taskFilters";
import { beimVergessen, gespraechFuerAuftrag, leseEcht, objektbezugAus } from "./echt";
import type { Herkunft } from "./zustand";

/** So lange wartet Klara, bis ein geöffnetes Ziel wirklich auf dem Bildschirm steht. */
export const OEFFNEN_WARTEN_MS = 5000;
const MAX_KANDIDATEN = 6;

/** Was die Fläche der Ausführung mitgibt: Übersetzer, Navigation und der Ort von jetzt. */
export interface AuftragsUmgebung {
  t: TFunction;
  navigiere: (pfad: string) => void;
  /** `pathname + search` der Anwendung in diesem Augenblick. */
  ort: () => string;
}

export interface GeplanterSchritt {
  nr: number;
  /** Derselbe Schlüssel für jeden Versuch dieses Schritts — Grundlage der Wiederholsicherheit. */
  schluessel: string;
  erkannt: ErkannterSchritt;
  /** Das geklärte Ziel. `null`: offen (Rückfrage) oder Ergebnis eines früheren Schritts. */
  ziel: KlaraAuftragZiel | null;
  /** Bei mehreren Treffern: zur Wahl, bevor etwas geschieht. */
  kandidaten: KlaraAuftragZiel[];
  /**
   * Nacharbeit 4: bei „Aufgabe bearbeiten“ die geklärte Aktion. `null`, solange sie fehlt — dann
   * stehen die möglichen Aktionen (`aktionsoptionen`) bzw. Personen (`personen`) zur Wahl.
   */
  aufgabenaktion?: KlaraAufgabenaktion | null;
  aktionsoptionen?: KlaraAufgabenaktion[];
  personen?: { id: string; name: string }[];
}

/** Welche Aufgabenart ein Arbeitsort meint — dieselbe Zuordnung wie am Server und in „Meine Aufgaben“. */
function aufgabenart(pfad: string | null): "pruefung" | "konflikt" | "luecke" | null {
  if (!pfad) {
    return null;
  }
  if (pfad.startsWith("/wissen/")) {
    return "pruefung";
  }
  if (pfad.startsWith("/konflikte")) {
    return "konflikt";
  }
  return pfad.startsWith("/risiko") ? "luecke" : null;
}

/** Die vorhandenen Aktionen des Fachwegs je Aufgabenart, die Klara ausführen kann. */
function aktionenFuer(art: ReturnType<typeof aufgabenart>): KlaraAufgabenaktion[] {
  if (art === "luecke") {
    return [
      { art: "prioritaet", wert: "hoch" },
      { art: "prioritaet", wert: "mittel" },
      { art: "prioritaet", wert: "niedrig" },
      { art: "nur_oeffnen" },
    ];
  }
  if (art === "konflikt") {
    return [{ art: "eskalieren" }, { art: "nur_oeffnen" }];
  }
  return art === "pruefung" ? [{ art: "nur_oeffnen" }] : [];
}

/** Braucht dieser Schritt noch eine Angabe der Person, bevor etwas geschieht? */
function brauchtKlaerung(s: GeplanterSchritt): boolean {
  if (s.erkannt.ausSchritt === undefined && !s.ziel) {
    return true;
  }
  return s.erkannt.aktion === "aufgabe_bearbeiten" && !s.aufgabenaktion;
}

/** Die Zeile über der Rückfrage: zum Ziel — die Rückfrage zur Aufgabe trägt ihren eigenen Satz. */
function rueckfrageMeldung(geplant: readonly GeplanterSchritt[], t: TFunction): string | null {
  return geplant.some((s) => s.erkannt.ausSchritt === undefined && !s.ziel)
    ? t("klaraauftrag.rueckfrage")
    : null;
}

/**
 * Nacharbeit 4 (Ben): klärt die Aktion an einer Aufgabe, BEVOR etwas geschieht. Genannt und
 * passend: übernehmen (beim Zuweisen die Person über das Personenverzeichnis auflösen). Nicht
 * genannt: die Aktionen des Fachwegs zur Wahl — gibt es nur „öffnen“, ist das die Aktion.
 */
async function klaereAufgabe(
  s: GeplanterSchritt,
  t: TFunction,
): Promise<GeplanterSchritt | { fehler: string }> {
  if (s.erkannt.aktion !== "aufgabe_bearbeiten" || !s.ziel || s.aufgabenaktion) {
    return s;
  }
  const moeglich = aktionenFuer(aufgabenart(s.ziel.pfad));
  const genannt = s.erkannt.aufgabenaktion;
  if (!genannt) {
    if (moeglich.length === 1 && moeglich[0]?.art === "nur_oeffnen") {
      return { ...s, aufgabenaktion: { art: "nur_oeffnen" }, aktionsoptionen: [] };
    }
    return { ...s, aufgabenaktion: null, aktionsoptionen: moeglich };
  }
  const passt =
    genannt.art === "zuweisen"
      ? aufgabenart(s.ziel.pfad) === "luecke"
      : moeglich.some((m) => m.art === genannt.art);
  if (!passt) {
    return { fehler: t("klaraauftrag.aufgabenaktion.passtNicht", { titel: s.ziel.titel }) };
  }
  if (genannt.art === "prioritaet" || genannt.art === "eskalieren") {
    return { ...s, aufgabenaktion: genannt, aktionsoptionen: [] };
  }
  const verzeichnis = await endpoints.directory.list();
  const treffer = passende(verzeichnis, (p) => p.name, genannt.person).slice(0, MAX_KANDIDATEN);
  if (treffer.length === 0) {
    return { fehler: t("klaraauftrag.unbekanntePerson", { name: genannt.person }) };
  }
  if (treffer.length === 1) {
    const p = treffer[0] as { id: string; name: string };
    return { ...s, aufgabenaktion: { art: "zuweisen", personId: p.id, personName: p.name } };
  }
  return { ...s, aufgabenaktion: null, personen: treffer };
}

/** Was nur dieser Browser über einen Schritt weiss — der Server bleibt die Wahrheit über den Stand. */
export interface LokalerSchritt {
  /** `laeuft`: wird gerade ausgeführt; `unklar`: Verbindung weg, Ergebnis nicht bestätigt. */
  lage?: "laeuft" | "unklar" | "entfallen" | "nicht_ausgefuehrt";
  meldung?: string;
  /** Beim Bearbeiten: die Felder vor der Änderung — für Rückgängig. */
  vorher?: DraftPayload;
  ruecknahme?: "laeuft" | "fehler" | null;
  ruecknahmeMeldung?: string;
}

export type Phase =
  | "pruefen"
  | "rueckfrage"
  | "unbekannt"
  | "laeuft"
  | "angehalten"
  | "fertig"
  | "fehler";

export interface Ausfuehrung {
  lokalId: string;
  quelle: KlaraAuftragsQuelle;
  wortlaut: string;
  herkunft: Herkunft;
  phase: Phase;
  meldung: string | null;
  geplant: GeplanterSchritt[];
  auftrag: KlaraAuftrag | null;
  gespraechId: string | null;
  lokal: Record<number, LokalerSchritt>;
  abbruch: boolean;
}

interface Zustand {
  liste: Ausfuehrung[];
  geladenFuer: string | null;
}

const LEER: Zustand = { liste: [], geladenFuer: null };
let zustand: Zustand = LEER;
let generation = 0;
const hoerer = new Set<() => void>();
let zaehler = 0;

beimVergessen(() => {
  generation += 1;
  zustand = LEER;
  for (const h of hoerer) {
    h();
  }
});

function setzeZustand(f: (z: Zustand) => Zustand): void {
  const neu = f(zustand);
  if (neu === zustand) {
    return;
  }
  zustand = neu;
  for (const h of hoerer) {
    h();
  }
}

function setze(lokalId: string, f: (a: Ausfuehrung) => Ausfuehrung): void {
  setzeZustand((z) => ({
    ...z,
    liste: z.liste.map((a) => (a.lokalId === lokalId ? f(a) : a)),
  }));
}

function setzeLokal(lokalId: string, nr: number, teil: LokalerSchritt | null): void {
  setze(lokalId, (a) => {
    const lokal = { ...a.lokal };
    if (teil === null) {
      const vorher = lokal[nr]?.vorher;
      lokal[nr] = vorher ? { vorher } : {};
    } else {
      lokal[nr] = { ...(lokal[nr] ?? {}), ...teil };
    }
    return { ...a, lokal };
  });
}

function hole(lokalId: string): Ausfuehrung | undefined {
  return zustand.liste.find((a) => a.lokalId === lokalId);
}

export function leseAusfuehrungen(): Ausfuehrung[] {
  return zustand.liste;
}

function leseListe(): Ausfuehrung[] {
  return zustand.liste;
}

export function useAusfuehrungen(): Ausfuehrung[] {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    leseListe,
    leseListe,
  );
}

/** Läuft gerade ein Auftrag? Dann nimmt Klara keinen zweiten an. */
export function auftragLaeuft(): boolean {
  return zustand.liste.some((a) => a.phase === "pruefen" || a.phase === "laeuft");
}

export function schliesseAusfuehrung(lokalId: string): void {
  setzeZustand((z) => ({ ...z, liste: z.liste.filter((a) => a.lokalId !== lokalId) }));
}

// ------------------------------------------------------------------------------------------------
// Reine Helfer.
// ------------------------------------------------------------------------------------------------

function neuerSchluessel(nr: number): string {
  const zufall =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${zufall}-${nr}`;
}

export function entwurfPfad(id: string): string {
  return `/erfassen?draft=${encodeURIComponent(id)}`;
}

/** Der Schritt am Server zu einem geplanten Schritt — oder `undefined`, solange er nicht begann. */
export function serverSchritt(
  a: Pick<Ausfuehrung, "auftrag">,
  schluessel: string,
): KlaraAuftragSchritt | undefined {
  return a.auftrag?.schritte.find((s) => s.schluessel === schluessel);
}

const ENDE: readonly KlaraSchrittStand[] = [
  "gespeichert",
  "abgeschlossen",
  "fehlgeschlagen",
  "zurueckgenommen",
];

function vergleich(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** Genaue Treffer zuerst; nur wenn es keinen gibt, die, die den Namen enthalten. */
function passende<T>(eintraege: readonly T[], titel: (x: T) => string, name: string): T[] {
  const gesucht = vergleich(name);
  const genau = eintraege.filter((x) => vergleich(titel(x)) === gesucht);
  if (genau.length > 0) {
    return genau;
  }
  return eintraege.filter((x) => vergleich(titel(x)).includes(gesucht));
}

function warte(bedingung: () => boolean, ms: number): Promise<boolean> {
  return new Promise((fertig) => {
    const start = Date.now();
    const sehen = (): void => {
      if (bedingung()) {
        fertig(true);
        return;
      }
      if (Date.now() - start > ms) {
        fertig(false);
        return;
      }
      setTimeout(sehen, 40);
    };
    sehen();
  });
}

/** Netz weg (oder Antwort verloren): ob der Server gehandelt hat, ist unbekannt. */
function istVerbindungsfehler(fehler: unknown): boolean {
  return !(fehler instanceof ApiError) && !(fehler instanceof SyntaxError);
}

/** Der tatsächliche Grund in Worten — nie ein geschöntes „hat nicht geklappt“. */
export function fehlerGrund(fehler: unknown, t: TFunction): string {
  if (fehler instanceof ApiError) {
    if (fehler.status === 401) {
      return t("klaraauftrag.fehler.anmeldung");
    }
    if (fehler.status === 403) {
      return t("klaraauftrag.fehler.recht");
    }
    if (fehler.status === 404) {
      return t("klaraauftrag.fehler.nichtGefunden");
    }
    if (fehler.status === 409 && fehler.code === "DRAFT_STALE") {
      return t("klaraauftrag.fehler.versionGeaendert");
    }
    return t("klaraauftrag.fehler.server", { status: fehler.status, grund: fehler.message });
  }
  return t("klaraauftrag.fehler.netz");
}

const GRENZGRUENDE = [
  "abgebrochen",
  "abgeschlossen",
  "ausserhalb_auftrag",
  "fassung_veraltet",
  "erweiterung",
] as const;

/** Was die Grenze am Server zu einem Schritt oder einer Korrektur sagt — in der Sprache der Fläche. */
function grenzGrund(grund: string, sonst: string, t: TFunction): string {
  return (GRENZGRUENDE as readonly string[]).includes(grund)
    ? t(`klaraauftrag.grenze.${grund}`)
    : sonst;
}

// ------------------------------------------------------------------------------------------------
// 2. Ziele klären — über die vorhandenen Listen, unter den Rechten der Person.
// ------------------------------------------------------------------------------------------------

async function wissensobjekte(name: string): Promise<KlaraAuftragZiel[]> {
  const kos = await endpoints.ko.list();
  return passende(kos, (k) => k.title, name).map((k) => ({
    art: "wissensobjekt" as const,
    id: k.id,
    titel: k.title,
    stand: typeof k.version === "number" ? String(k.version) : null,
    pfad: leserHref({ koId: k.id, fassung: null }),
  }));
}

async function entwuerfe(name: string): Promise<KlaraAuftragZiel[]> {
  const liste = await endpoints.drafts.list();
  return passende(liste, (d) => d.payload.title ?? "", name).map((d) => ({
    art: "entwurf" as const,
    id: d.id,
    titel: d.payload.title ?? "",
    stand: d.updatedAt,
    pfad: entwurfPfad(d.id),
  }));
}

/** Dieselben Quellen und Ziele wie „Meine Aufgaben“ (`pages/MyTasks.tsx`): Prüfung, Konflikt, Lücke. */
async function aufgaben(name: string): Promise<KlaraAuftragZiel[]> {
  const [board, konflikte, luecken] = await Promise.allSettled([
    endpoints.validation.board(),
    endpoints.conflicts.list(),
    endpoints.gaps.list(),
  ]);
  const alle: KlaraAuftragZiel[] = [
    ...(board.status === "fulfilled" ? board.value : []).map((k) => ({
      art: "aufgabe" as const,
      id: k.id,
      titel: k.title,
      stand: null,
      pfad: `/wissen/${encodeURIComponent(k.id)}`,
    })),
    ...(konflikte.status === "fulfilled" ? konflikte.value : [])
      .filter(isUnresolvedConflict)
      .map((c) => ({
        art: "aufgabe" as const,
        id: c.id,
        titel: c.description,
        stand: null,
        pfad: fallHref("/konflikte", c.id),
      })),
    ...(luecken.status === "fulfilled" ? luecken.value : [])
      .filter((g) => isOpenGap(g) && !g.redacted)
      .map((g) => ({
        art: "aufgabe" as const,
        id: g.id,
        titel: g.question,
        stand: null,
        pfad: fallHref("/risiko", g.id),
      })),
  ];
  if (alle.length === 0 && [board, konflikte, luecken].every((r) => r.status === "rejected")) {
    throw board.status === "rejected" ? board.reason : new Error("Aufgaben nicht lesbar");
  }
  return passende(alle, (x) => x.titel, name);
}

async function kandidatenFuer(e: ErkannterSchritt): Promise<KlaraAuftragZiel[]> {
  switch (e.suche) {
    case "neu":
      return [{ art: "neuer_entwurf", id: null, titel: e.name, stand: null, pfad: null }];
    case "wissensobjekt":
      return wissensobjekte(e.name);
    case "entwurf":
      return entwuerfe(e.name);
    case "aufgabe":
      return aufgaben(e.name);
    case "beliebig": {
      const [kos, ents] = await Promise.allSettled([wissensobjekte(e.name), entwuerfe(e.name)]);
      if (kos.status === "rejected" && ents.status === "rejected") {
        throw kos.reason;
      }
      return [
        ...(kos.status === "fulfilled" ? kos.value : []),
        ...(ents.status === "fulfilled" ? ents.value : []),
      ];
    }
  }
}

// ------------------------------------------------------------------------------------------------
// 1.–3. Erkennen, klären, Auftrag mit Grenze anlegen.
// ------------------------------------------------------------------------------------------------

/**
 * Nimmt einen getippten oder gesprochenen Text an.
 *   `kein_auftrag` — kein Ausführungsauftrag: der Text geht seinen bisherigen Weg (Frage).
 *   `belegt`       — ein Auftrag läuft noch; Klara nimmt keinen zweiten an und sendet auch nichts.
 *   `gestartet`    — Klara klärt das Ziel und führt danach aus.
 */
export function starteAuftrag(
  text: string,
  quelle: KlaraAuftragsQuelle,
  herkunft: Herkunft,
  u: AuftragsUmgebung,
): "gestartet" | "kein_auftrag" | "belegt" {
  const erkannt = erkenneAuftrag(text);
  if (!erkannt) {
    return "kein_auftrag";
  }
  if (auftragLaeuft()) {
    return "belegt";
  }
  zaehler += 1;
  const lokalId = `ausfuehrung-${Date.now().toString(36)}-${zaehler}`;
  const a: Ausfuehrung = {
    lokalId,
    quelle,
    wortlaut: text.trim(),
    herkunft,
    phase: "pruefen",
    meldung: null,
    geplant: erkannt.schritte.map((e, i) => ({
      nr: i + 1,
      schluessel: neuerSchluessel(i + 1),
      erkannt: e,
      ziel: null,
      kandidaten: [],
    })),
    auftrag: null,
    gespraechId: null,
    lokal: {},
    abbruch: false,
  };
  setzeZustand((z) => ({ ...z, liste: [a, ...z.liste].slice(0, 5) }));
  void klaere(lokalId, u);
  return "gestartet";
}

async function klaere(lokalId: string, u: AuftragsUmgebung): Promise<void> {
  const gen = generation;
  const a = hole(lokalId);
  if (!a) {
    return;
  }
  const geplant: GeplanterSchritt[] = [];
  for (const s of a.geplant) {
    if (s.erkannt.ausSchritt !== undefined) {
      geplant.push(s);
      continue;
    }
    try {
      const treffer = (await kandidatenFuer(s.erkannt)).slice(0, MAX_KANDIDATEN);
      geplant.push(
        treffer.length === 1
          ? { ...s, ziel: treffer[0] ?? null, kandidaten: [] }
          : { ...s, ziel: null, kandidaten: treffer },
      );
    } catch (fehler) {
      if (gen !== generation) {
        return;
      }
      setze(lokalId, (x) => ({
        ...x,
        phase: "fehler",
        meldung: u.t("klaraauftrag.fehler.klaeren", { grund: fehlerGrund(fehler, u.t) }),
      }));
      return;
    }
  }
  if (gen !== generation) {
    return;
  }
  // Nacharbeit 4: die Aktion an einer Aufgabe klären (genannt, zur Wahl, Person auflösen).
  for (let i = 0; i < geplant.length; i++) {
    const s = geplant[i] as GeplanterSchritt;
    try {
      const r = await klaereAufgabe(s, u.t);
      if ("fehler" in r) {
        setze(lokalId, (x) => ({ ...x, geplant, phase: "fehler", meldung: r.fehler }));
        return;
      }
      geplant[i] = r;
    } catch (fehler) {
      setze(lokalId, (x) => ({
        ...x,
        phase: "fehler",
        meldung: u.t("klaraauftrag.fehler.klaeren", { grund: fehlerGrund(fehler, u.t) }),
      }));
      return;
    }
  }
  if (gen !== generation) {
    return;
  }
  const unbekannt = geplant.filter(
    (s) => s.erkannt.ausSchritt === undefined && !s.ziel && s.kandidaten.length === 0,
  );
  if (unbekannt.length > 0) {
    setze(lokalId, (x) => ({
      ...x,
      geplant,
      phase: "unbekannt",
      meldung: u.t("klaraauftrag.unbekannt", {
        namen: unbekannt.map((s) => `„${s.erkannt.name}“`).join(", "),
      }),
    }));
    return;
  }
  const offen = geplant.some(brauchtKlaerung);
  setze(lokalId, (x) => ({
    ...x,
    geplant,
    phase: offen ? "rueckfrage" : "pruefen",
    meldung: rueckfrageMeldung(geplant, u.t),
  }));
  if (!offen) {
    await legeAnUndFuehreAus(lokalId, u);
  }
}

/** Nach einer Antwort auf eine Rückfrage: weiter klären — oder, wenn alles geklärt ist, anlegen. */
async function weiterNachRueckfrage(
  lokalId: string,
  geplantNeu: GeplanterSchritt[],
  u: AuftragsUmgebung,
): Promise<void> {
  const gen = generation;
  const geplant = [...geplantNeu];
  for (let i = 0; i < geplant.length; i++) {
    try {
      const r = await klaereAufgabe(geplant[i] as GeplanterSchritt, u.t);
      if (gen !== generation) {
        return;
      }
      if ("fehler" in r) {
        setze(lokalId, (x) => ({ ...x, geplant, phase: "fehler", meldung: r.fehler }));
        return;
      }
      geplant[i] = r;
    } catch (fehler) {
      setze(lokalId, (x) => ({
        ...x,
        phase: "fehler",
        meldung: u.t("klaraauftrag.fehler.klaeren", { grund: fehlerGrund(fehler, u.t) }),
      }));
      return;
    }
  }
  const offen = geplant.some(brauchtKlaerung);
  setze(lokalId, (x) => ({
    ...x,
    geplant,
    phase: offen ? "rueckfrage" : "pruefen",
    meldung: rueckfrageMeldung(geplant, u.t),
  }));
  if (!offen) {
    await legeAnUndFuehreAus(lokalId, u);
  }
}

/** Rückfrage beantwortet: genau dieses Ziel. Erst wenn alles geklärt ist, geschieht etwas. */
export function waehleZiel(lokalId: string, nr: number, index: number, u: AuftragsUmgebung): void {
  const a = hole(lokalId);
  if (!a || a.phase !== "rueckfrage") {
    return;
  }
  const geplant = a.geplant.map((s) => {
    const gewaehlt = s.nr === nr ? s.kandidaten[index] : undefined;
    return gewaehlt ? { ...s, ziel: gewaehlt, kandidaten: [] } : s;
  });
  void weiterNachRueckfrage(lokalId, geplant, u);
}

/** Nacharbeit 4: Rückfrage zur Aufgabe beantwortet — genau diese Aktion des Fachwegs. */
export function waehleAufgabenaktion(
  lokalId: string,
  nr: number,
  index: number,
  u: AuftragsUmgebung,
): void {
  const a = hole(lokalId);
  if (!a || a.phase !== "rueckfrage") {
    return;
  }
  const geplant = a.geplant.map((s) => {
    const gewaehlt = s.nr === nr ? s.aktionsoptionen?.[index] : undefined;
    return gewaehlt ? { ...s, aufgabenaktion: gewaehlt, aktionsoptionen: [] } : s;
  });
  void weiterNachRueckfrage(lokalId, geplant, u);
}

/** Nacharbeit 4: Rückfrage zur Person beantwortet — genau dieser Mensch aus dem Verzeichnis. */
export function waehlePerson(
  lokalId: string,
  nr: number,
  index: number,
  u: AuftragsUmgebung,
): void {
  const a = hole(lokalId);
  if (!a || a.phase !== "rueckfrage") {
    return;
  }
  const geplant = a.geplant.map((s) => {
    const p = s.nr === nr ? s.personen?.[index] : undefined;
    return p
      ? {
          ...s,
          aufgabenaktion: { art: "zuweisen" as const, personId: p.id, personName: p.name },
          personen: [],
        }
      : s;
  });
  void weiterNachRueckfrage(lokalId, geplant, u);
}

/** Dieselbe Regel wie am Server: gleiche Art und Kennung, ein neuer Entwurf über seinen Titel. */
function gleichesZiel(a: KlaraAuftragZiel, b: KlaraAuftragZiel): boolean {
  if (a.art !== b.art) {
    return false;
  }
  return a.id === null && b.id === null ? a.titel === b.titel : a.id === b.id;
}

function eindeutigeZiele(geplant: readonly GeplanterSchritt[]): KlaraAuftragZiel[] {
  const ziele: KlaraAuftragZiel[] = [];
  for (const s of geplant) {
    const z = s.ziel;
    if (z && !ziele.some((x) => gleichesZiel(x, z))) {
      ziele.push(z);
    }
  }
  return ziele;
}

function zielText(s: GeplanterSchritt, t: TFunction): string {
  const titel = s.ziel?.titel ?? s.erkannt.name;
  if (s.erkannt.aktion === "entwurf_bearbeiten" && s.erkannt.aenderung) {
    return s.erkannt.aenderung.art === "ergaenzen"
      ? t("klaraauftrag.zielText.ergaenzen", { titel, text: s.erkannt.aenderung.text })
      : t("klaraauftrag.zielText.umbenennen", { titel, neu: s.erkannt.aenderung.titel });
  }
  const aa = s.aufgabenaktion;
  if (s.erkannt.aktion === "aufgabe_bearbeiten" && aa && aa.art !== "nur_oeffnen") {
    return t(`klaraauftrag.zielText.aufgabe.${aa.art}`, { titel, ...aktionsWerte(aa, t) });
  }
  return t(`klaraauftrag.zielText.${s.erkannt.aktion}`, { titel });
}

/** Die Werte einer Aufgabenaktion für Texte (Priorität in Worten, Name der Person). */
function aktionsWerte(aa: KlaraAufgabenaktion, t: TFunction): { wert?: string; person?: string } {
  if (aa.art === "prioritaet") {
    return { wert: t(`klaraauftrag.prioritaet.${aa.wert}`) };
  }
  return aa.art === "zuweisen" ? { person: aa.personName } : {};
}

/** Die Bezeichnung einer Aufgabenaktion zur Wahl in der Rückfrage. */
export function aufgabenaktionText(aa: KlaraAufgabenaktion, t: TFunction): string {
  return t(`klaraauftrag.aufgabenaktion.${aa.art}`, aktionsWerte(aa, t));
}

/** Ergebnisanforderung je Schritt: eine ausgeführte Aufgabenaktion ist etwas anderes als Öffnen. */
function ergebnisAnforderung(s: GeplanterSchritt, t: TFunction): string {
  const aa = s.aufgabenaktion;
  if (s.erkannt.aktion === "aufgabe_bearbeiten" && aa && aa.art !== "nur_oeffnen") {
    return t("klaraauftrag.ergebnisAnforderung.aufgabenaktion");
  }
  return t(`klaraauftrag.ergebnisAnforderung.${s.erkannt.aktion}`);
}

function kuerzen(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

async function legeAnUndFuehreAus(lokalId: string, u: AuftragsUmgebung): Promise<void> {
  const gen = generation;
  const a = hole(lokalId);
  if (!a) {
    return;
  }
  const { t } = u;
  const ziele = eindeutigeZiele(a.geplant);
  const aktionen = [...new Set(a.geplant.map((s) => s.erkannt.aktion))];
  const quellen = [
    t("klaraauftrag.quelle.eingabe", { quelle: t(`klaraauftrag.quelleArt.${a.quelle}`) }),
    ...ziele
      .filter((z) => z.id !== null)
      .map((z) => kuerzen(t("klaraauftrag.quelle.ziel", { titel: z.titel }), 200)),
  ];
  try {
    const hatteGespraech = Boolean(leseEcht().gespraech?.id);
    const gespraechId = await gespraechFuerAuftrag(objektbezugAus(a.herkunft));
    if (gen !== generation) {
      return;
    }
    // Ein eben begonnenes Gespräch hat keine früheren Aufträge, die noch zu laden wären.
    if (!hatteGespraech) {
      setzeZustand((z) => ({ ...z, geladenFuer: gespraechId }));
    }
    const { auftrag } = await klaraAuftragApi.lege(gespraechId, {
      quelle: a.quelle,
      wortlaut: kuerzen(a.wortlaut, 2000),
      ziel: kuerzen(a.geplant.map((s) => zielText(s, t)).join(" · "), 600),
      erlaubteAktionen: aktionen,
      erlaubteZiele: ziele,
      erlaubteQuellen: [...new Set(quellen)].slice(0, 10),
      ergebnis: kuerzen(
        [...new Set(a.geplant.map((s) => ergebnisAnforderung(s, t)))].join(" · "),
        600,
      ),
      geplanteSchritte: a.geplant.length,
      // Nacharbeit 2: der gebundene Plan — der Server führt später nur genau diese Schritte aus.
      plan: a.geplant.map((s) => ({
        aktion: s.erkannt.aktion,
        ziel: s.erkannt.ausSchritt === undefined ? s.ziel : null,
        ausSchritt: s.erkannt.ausSchritt === undefined ? null : s.erkannt.ausSchritt + 1,
        ...(s.erkannt.inhalt ? { inhalt: s.erkannt.inhalt } : {}),
        ...(s.erkannt.aenderung ? { aenderung: s.erkannt.aenderung } : {}),
        // Nacharbeit 4: die geklärte Aktion an der Aufgabe — Teil der Grenze, nicht der Ausführung.
        ...(s.aufgabenaktion ? { aufgabenaktion: s.aufgabenaktion } : {}),
      })),
    });
    if (gen !== generation) {
      return;
    }
    setze(lokalId, (x) => ({ ...x, auftrag, gespraechId, phase: "laeuft" }));
  } catch (fehler) {
    if (gen !== generation) {
      return;
    }
    setze(lokalId, (x) => ({
      ...x,
      phase: "fehler",
      meldung: t("klaraauftrag.fehler.anlegen", { grund: fehlerGrund(fehler, t) }),
    }));
    return;
  }
  await fuehreAus(lokalId, u, gen);
}

// ------------------------------------------------------------------------------------------------
// 4. Ausführen — Schritt für Schritt, jeder am Server begonnen, ausgeführt, nachgelesen, gemeldet.
// ------------------------------------------------------------------------------------------------

/**
 * Ist dieser Stand des Auftrags mindestens so neu wie der gezeigte? Eine verspätete Antwort (etwa
 * die eines Schritts, der lief, während die Person abbrach oder korrigierte) trägt den Stand von
 * damals — sie darf den neueren (abgebrochen, Fassung 2) nicht überschreiben.
 */
function nichtAelter(neu: KlaraAuftrag, alt: KlaraAuftrag | null): boolean {
  if (!alt || alt.id !== neu.id) {
    return true;
  }
  if (neu.geaendertAm !== alt.geaendertAm) {
    return neu.geaendertAm > alt.geaendertAm;
  }
  return neu.verlauf.length >= alt.verlauf.length;
}

function uebernimmAuftrag(lokalId: string, auftrag: KlaraAuftrag): void {
  setze(lokalId, (x) => (nichtAelter(auftrag, x.auftrag) ? { ...x, auftrag } : x));
}

async function melde(
  lokalId: string,
  s: GeplanterSchritt,
  ziel: KlaraAuftragZiel,
  stand: KlaraSchrittStand,
  extra: { grund?: string } = {},
): Promise<KlaraAuftragSchritt> {
  const a = hole(lokalId);
  if (!a?.auftrag || !a.gespraechId) {
    throw new Error("Auftrag fehlt.");
  }
  const r = await klaraAuftragApi.schritt(a.gespraechId, a.auftrag.id, s.schluessel, {
    nr: s.nr,
    aktion: s.erkannt.aktion,
    ziel,
    auftragFassung: a.auftrag.fassung,
    stand,
    ...extra,
  });
  uebernimmAuftrag(lokalId, r.auftrag);
  return r.schritt;
}

/** Das Ziel eines Schritts — bei „… und öffne ihn“ das tatsächliche Ergebnis des Vorschritts. */
function zielDes(a: Ausfuehrung, s: GeplanterSchritt): KlaraAuftragZiel | null {
  if (s.erkannt.ausSchritt === undefined) {
    return s.ziel;
  }
  const quelle = a.geplant[s.erkannt.ausSchritt];
  const vorher = quelle ? serverSchritt(a, quelle.schluessel) : undefined;
  const e = vorher?.ergebnis;
  if (!e || (vorher?.stand !== "gespeichert" && vorher?.stand !== "abgeschlossen")) {
    return null;
  }
  return { art: e.art, id: e.id, titel: e.titel, stand: e.stand, pfad: e.pfad };
}

/**
 * Nacharbeit 2: Öffnen am Bildschirm — erst NACH der Bestätigung des Ziels am Server, und nur mit
 * dessen Pfad. Danach wird nachgesehen, ob es wirklich offen ist (Ort, beim Wissensobjekt die
 * Meldung der Lesefläche selbst).
 */
async function oeffneBestaetigt(e: KlaraAuftragErgebnis, u: AuftragsUmgebung): Promise<boolean> {
  if (!e.pfad.startsWith("/") || e.pfad.startsWith("//")) {
    return false;
  }
  u.navigiere(e.pfad);
  const zielOrt = e.pfad.split("?")[0] ?? e.pfad;
  const ortStimmt = (): boolean => (u.ort().split("?")[0] ?? "") === zielOrt;
  const ziehtAuf =
    e.art === "wissensobjekt" ? () => ortStimmt() && leseobjektJetzt()?.koId === e.id : ortStimmt;
  return warte(ziehtAuf, OEFFNEN_WARTEN_MS);
}

/**
 * Ein Fehler, den der Server nicht selbst festhielt (etwa eine 500 vor dem Beginn): ehrlich als
 * Fehlschlag melden. Der Browser kann damit nie einen Erfolg behaupten — nur ein Scheitern.
 */
async function meldeFehlschlag(lokalId: string, s: GeplanterSchritt, grund: string): Promise<void> {
  const a = hole(lokalId);
  if (!a) {
    return;
  }
  const quelle = s.erkannt.ausSchritt === undefined ? null : a.geplant[s.erkannt.ausSchritt];
  const ziel: KlaraAuftragZiel = zielDes(a, s) ??
    quelle?.ziel ?? {
      art: "neuer_entwurf",
      id: null,
      titel: s.erkannt.name,
      stand: null,
      pfad: null,
    };
  try {
    await melde(lokalId, s, ziel, "begonnen");
  } catch {
    // schon begonnen oder ausserhalb — der Fehlschlag unten sagt dann, was der Server zulässt
  }
  await melde(lokalId, s, ziel, "fehlgeschlagen", { grund: kuerzen(grund, 300) });
}

type Weiter = "weiter" | "stopp";

async function fuehreSchrittAus(
  lokalId: string,
  nr: number,
  u: AuftragsUmgebung,
  gen: number,
): Promise<Weiter> {
  const { t } = u;
  const a = hole(lokalId);
  const s = a?.geplant.find((x) => x.nr === nr);
  if (!a || !s || !a.auftrag || !a.gespraechId) {
    return "stopp";
  }
  setzeLokal(lokalId, nr, { lage: "laeuft", meldung: "" });

  // 1. Nacharbeit 2 (Ben): der SERVER führt den Planschritt aus — er beginnt ihn unter der Grenze,
  //    ruft die vorhandenen Türen mit der Anmeldung der Person auf und liest nach. Der Browser
  //    schickt nur Nummer und Fassung und kann kein Ergebnis behaupten.
  let r: { auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean };
  try {
    r = await klaraAuftragApi.fuehreAus(a.gespraechId, a.auftrag.id, s.schluessel, {
      nr: s.nr,
      auftragFassung: a.auftrag.fassung,
    });
  } catch (fehler) {
    if (gen !== generation) {
      return "stopp";
    }
    if (fehler instanceof ApiError && fehler.status === 409) {
      const grund = String(fehler.details.grund ?? "");
      const meldung = grenzGrund(grund, fehler.message, t);
      if (grund === "abgebrochen") {
        setzeLokal(lokalId, nr, { lage: "nicht_ausgefuehrt", meldung });
        setze(lokalId, (x) => ({ ...x, abbruch: true }));
        return "stopp";
      }
      setzeLokal(lokalId, nr, { lage: "entfallen", meldung });
      return grund === "fassung_veraltet" ? "stopp" : "weiter";
    }
    if (istVerbindungsfehler(fehler)) {
      // Ob der Server gehandelt hat, ist unbekannt: „Erneut versuchen“ nutzt denselben Schlüssel,
      // der Server antwortet dann mit dem festgehaltenen Stand statt neu auszuführen.
      setzeLokal(lokalId, nr, { lage: "unklar", meldung: t("klaraauftrag.fehler.unklar") });
      return "stopp";
    }
    try {
      await meldeFehlschlag(lokalId, s, fehlerGrund(fehler, t));
    } catch {
      setzeLokal(lokalId, nr, { lage: "unklar", meldung: t("klaraauftrag.fehler.protokoll") });
      return "stopp";
    }
    setzeLokal(lokalId, nr, null);
    return "weiter";
  }
  if (gen !== generation) {
    return "stopp";
  }
  uebernimmAuftrag(lokalId, r.auftrag);

  // 2. Öffnen und Aufgabe: der Server hat Zielidentität und aktuelle Berechtigung bestätigt
  //    (`geprueft`). Erst jetzt wechselt der Bildschirm — und abgeschlossen wird nur dieses Ziel.
  const schritt = r.schritt;
  // Nacharbeit 4 (Ben): gespeichert, aber das Nachlesen blieb aus — Kennung bekannt, Stand
  // ungeklärt. „Erneut versuchen“ holt mit demselben Schlüssel nur das Nachlesen nach.
  if (schritt.stand === "begonnen" && schritt.schreibwirkung && !schritt.geprueft) {
    setzeLokal(lokalId, nr, { lage: "unklar", meldung: t("klaraauftrag.fehler.unbestaetigt") });
    return "stopp";
  }
  if (schritt.stand === "begonnen" && schritt.geprueft) {
    const offen = await oeffneBestaetigt(schritt.geprueft, u);
    if (gen !== generation) {
      return "stopp";
    }
    try {
      if (offen) {
        await melde(lokalId, s, schritt.ziel, "abgeschlossen");
      } else {
        const grund = t("klaraauftrag.fehler.nichtGeoeffnet", { titel: schritt.geprueft.titel });
        await melde(lokalId, s, schritt.ziel, "fehlgeschlagen", { grund: kuerzen(grund, 300) });
      }
    } catch {
      if (gen !== generation) {
        return "stopp";
      }
      setzeLokal(lokalId, nr, { lage: "unklar", meldung: t("klaraauftrag.fehler.protokoll") });
      return "stopp";
    }
  }
  setzeLokal(lokalId, nr, null);
  return "weiter";
}

async function fuehreAus(lokalId: string, u: AuftragsUmgebung, gen: number): Promise<void> {
  setze(lokalId, (x) => ({ ...x, phase: "laeuft", meldung: null }));
  const start = hole(lokalId);
  for (const s of start?.geplant ?? []) {
    const a = hole(lokalId);
    if (!a || gen !== generation) {
      return;
    }
    const vorhanden = serverSchritt(a, s.schluessel);
    const lage = a.lokal[s.nr]?.lage;
    if ((vorhanden && ENDE.includes(vorhanden.stand)) || lage === "entfallen") {
      continue;
    }
    // Abbrechen verhindert jeden WEITEREN Schritt — geprüft vor jedem Beginn, hier und am Server.
    if (a.abbruch || a.auftrag?.abgebrochenAm) {
      // Schon gespeichert, nur das Nachlesen fehlt: das ist kein weiterer Schritt — nachlesen.
      if (vorhanden?.stand === "begonnen" && vorhanden.schreibwirkung) {
        await fuehreSchrittAus(lokalId, s.nr, u, gen);
        continue;
      }
      setzeLokal(lokalId, s.nr, { lage: "nicht_ausgefuehrt" });
      continue;
    }
    // Eine Korrektur kann den Schritt aus der Grenze genommen haben: dann entfällt er.
    const grenze = a.auftrag;
    const z = zielDes(a, s);
    const zielDraussen =
      z !== null &&
      s.erkannt.ausSchritt === undefined &&
      !grenze?.erlaubteZiele.some((x) => gleichesZiel(x, z));
    if (grenze && (!grenze.erlaubteAktionen.includes(s.erkannt.aktion) || zielDraussen)) {
      setzeLokal(lokalId, s.nr, { lage: "entfallen", meldung: u.t("klaraauftrag.entfallen") });
      continue;
    }
    const weiter = await fuehreSchrittAus(lokalId, s.nr, u, gen);
    if (weiter === "stopp") {
      break;
    }
  }
  if (gen !== generation) {
    return;
  }
  const ende = hole(lokalId);
  const unklar = Object.values(ende?.lokal ?? {}).some((l) => l.lage === "unklar");
  setze(lokalId, (x) => ({ ...x, phase: unklar ? "angehalten" : "fertig" }));
}

/** Nach „Ergebnis unklar“: derselbe Schritt mit demselben Schlüssel, danach die übrigen. */
export function wiederhole(lokalId: string, u: AuftragsUmgebung): void {
  const a = hole(lokalId);
  if (!a || a.phase !== "angehalten" || !a.auftrag) {
    return;
  }
  if (a.geplant.length === 0) {
    void liesUngeklaerteNach(lokalId, u);
    return;
  }
  void fuehreAus(lokalId, u, generation);
}

/**
 * Nacharbeit 4: nach dem Neuladen kennt dieser Browser keinen Plan — ein ungeklärter Schritt
 * (gespeichert, Nachlesen ausstehend) wird trotzdem am Server nachgelesen: derselbe Schlüssel, keine
 * neue Schreibwirkung. Weitere Schritte beginnt das nicht.
 */
async function liesUngeklaerteNach(lokalId: string, u: AuftragsUmgebung): Promise<void> {
  const gen = generation;
  const a = hole(lokalId);
  if (!a?.auftrag || !a.gespraechId) {
    return;
  }
  for (const s of a.auftrag.schritte) {
    if (s.stand !== "begonnen" || !s.schreibwirkung || s.geprueft) {
      continue;
    }
    try {
      const r = await klaraAuftragApi.fuehreAus(a.gespraechId, a.auftrag.id, s.schluessel, {
        nr: s.nr,
        auftragFassung: s.auftragFassung,
      });
      if (gen !== generation) {
        return;
      }
      uebernimmAuftrag(lokalId, r.auftrag);
    } catch (fehler) {
      if (gen !== generation) {
        return;
      }
      setze(lokalId, (x) => ({ ...x, meldung: fehlerGrund(fehler, u.t) }));
      return;
    }
  }
}

// ------------------------------------------------------------------------------------------------
// 5. Abbrechen, Korrigieren, Rückgängig.
// ------------------------------------------------------------------------------------------------

/** Keine weiteren Schritte. Was schon gespeichert ist, bleibt gespeichert und sichtbar. */
export async function brecheAuftragAb(lokalId: string, u: AuftragsUmgebung): Promise<void> {
  const a = hole(lokalId);
  if (!a) {
    return;
  }
  setze(lokalId, (x) => ({ ...x, abbruch: true }));
  if (a.auftrag && a.gespraechId) {
    try {
      const { auftrag } = await klaraAuftragApi.abbrechen(a.gespraechId, a.auftrag.id);
      uebernimmAuftrag(lokalId, auftrag);
    } catch (fehler) {
      setze(lokalId, (x) => ({
        ...x,
        meldung: u.t("klaraauftrag.fehler.abbrechen", { grund: fehlerGrund(fehler, u.t) }),
      }));
    }
  }
  // Lief gerade nichts (Rückfrage, angehalten), ist der Auftrag hier zu Ende.
  if (a.phase !== "laeuft" && a.phase !== "pruefen") {
    setze(lokalId, (x) => {
      const lokal = { ...x.lokal };
      for (const s of x.geplant) {
        const amServer = serverSchritt(x, s.schluessel);
        if (!amServer && lokal[s.nr]?.lage !== "entfallen") {
          lokal[s.nr] = { ...(lokal[s.nr] ?? {}), lage: "nicht_ausgefuehrt" };
        }
      }
      // Nacharbeit 4: ein gespeicherter Schritt, dessen Nachlesen aussteht, bleibt nachlesbar.
      const wirkungOffen = (x.auftrag?.schritte ?? []).some(
        (s) => s.stand === "begonnen" && s.schreibwirkung && !s.geprueft,
      );
      return { ...x, lokal, phase: wirkungOffen ? "angehalten" : "fertig" };
    });
  }
}

/** Welche geplanten Schritte noch nicht begonnen haben — nur sie kann eine Korrektur weglassen. */
export function offeneSchritte(a: Ausfuehrung): GeplanterSchritt[] {
  // Ein Schritt, der gerade am Server läuft (oder dessen Antwort unklar ist), ist nicht mehr offen:
  // der Server kann ihn schon ausgeführt haben.
  return a.geplant.filter((s) => {
    const lage = a.lokal[s.nr]?.lage;
    return (
      !serverSchritt(a, s.schluessel) &&
      lage !== "entfallen" &&
      lage !== "laeuft" &&
      lage !== "unklar"
    );
  });
}

/**
 * Korrektur: die Person behält nur die angekreuzten offenen Schritte. Die neue Fassung der Grenze
 * ist ENGER (der Server weist jede Erweiterung ab); was schon geschah, bleibt stehen.
 */
export async function korrigiereAuftrag(
  lokalId: string,
  behalten: readonly number[],
  u: AuftragsUmgebung,
): Promise<void> {
  const a = hole(lokalId);
  if (!a?.auftrag || !a.gespraechId) {
    return;
  }
  const offen = offeneSchritte(a);
  const geschehen = a.geplant.filter(
    (s) => !offen.includes(s) && a.lokal[s.nr]?.lage !== "entfallen",
  );
  const bleiben = [...geschehen, ...offen.filter((s) => behalten.includes(s.nr))];
  const ziele = eindeutigeZiele(bleiben).filter((z) =>
    a.auftrag?.erlaubteZiele.some((x) => gleichesZiel(x, z)),
  );
  const aktionen = [...new Set(bleiben.map((s) => s.erkannt.aktion))];
  if (ziele.length === 0 || aktionen.length === 0) {
    return;
  }
  try {
    const { auftrag } = await klaraAuftragApi.korrigiere(a.gespraechId, a.auftrag.id, {
      erlaubteAktionen: aktionen,
      erlaubteZiele: ziele,
      geplanteSchritte: bleiben.length,
      grund: u.t("klaraauftrag.korrektur.grund", {
        weg: offen.length - offen.filter((s) => behalten.includes(s.nr)).length,
      }),
    });
    setze(lokalId, (x) => {
      const lokal = { ...x.lokal };
      for (const s of offen) {
        if (!behalten.includes(s.nr)) {
          const meldung = u.t("klaraauftrag.entfallen");
          lokal[s.nr] = { ...(lokal[s.nr] ?? {}), lage: "entfallen", meldung };
        }
      }
      return { ...x, auftrag, lokal, meldung: null };
    });
  } catch (fehler) {
    setze(lokalId, (x) => ({
      ...x,
      meldung:
        fehler instanceof ApiError && fehler.status === 409
          ? grenzGrund(String(fehler.details.grund ?? ""), fehler.message, u.t)
          : fehlerGrund(fehler, u.t),
    }));
  }
}

/**
 * Rückgängig — NICHT dasselbe wie Abbrechen. Nimmt eine gespeicherte, rücknehmbare Änderung über
 * den vorhandenen Weg zurück: ein angelegter Entwurf geht in den Papierkorb (dort wiederherstellbar),
 * eine Bearbeitung bekommt ihre vorherigen Felder — mit Standvergleich, nie über eine spätere
 * Änderung hinweg. Danach wird am Server nachgelesen.
 */
export async function nimmZurueck(lokalId: string, nr: number, u: AuftragsUmgebung): Promise<void> {
  const { t } = u;
  const a = hole(lokalId);
  // Der Schritt, wie der Server ihn kennt — auch nach dem Neuladen, ohne Plan dieses Browsers.
  const amServer = a?.auftrag?.schritte.find((x) => x.nr === nr);
  if (!a || !amServer?.ruecknehmbar || !amServer.ergebnis || !a.auftrag || !a.gespraechId) {
    return;
  }
  setzeLokal(lokalId, nr, { ruecknahme: "laeuft", ruecknahmeMeldung: "" });
  try {
    // Nacharbeit 2 (Ben): die Rücknahme läuft am Server — mit dem nachgelesenen Ergebnisstand als
    // erwartetem Stand am vorhandenen Lösch- bzw. Speicherweg. Wurde der Entwurf inzwischen
    // geändert, antwortet der Server 409 und der Entwurf bleibt erhalten.
    const r = await klaraAuftragApi.nimmZurueck(a.gespraechId, a.auftrag.id, amServer.schluessel);
    uebernimmAuftrag(lokalId, r.auftrag);
    setzeLokal(lokalId, nr, { ruecknahme: null, ruecknahmeMeldung: "" });
  } catch (fehler) {
    const grund = fehler instanceof ApiError ? String(fehler.details.grund ?? "") : "";
    let meldung = t("klaraauftrag.ruecknahme.fehler", { grund: fehlerGrund(fehler, t) });
    if (grund === "geaendert") {
      meldung = t("klaraauftrag.ruecknahme.geaendert");
    } else if (grund === "nicht_ruecknehmbar") {
      meldung = t("klaraauftrag.ruecknahme.ohneVorher");
    }
    setzeLokal(lokalId, nr, { ruecknahme: "fehler", ruecknahmeMeldung: meldung });
  }
}

// ------------------------------------------------------------------------------------------------
// Nach Neuladen: die Aufträge des eigenen Gesprächs vom Server — Stand und Schritte, wie sie sind.
// ------------------------------------------------------------------------------------------------

function ausGeladenem(x: KlaraAuftrag, herkunft: Herkunft, gespraechId: string): Ausfuehrung {
  const offen = x.stand === "laeuft" || x.stand === "vorgeschlagen";
  return {
    lokalId: `geladen-${x.id}`,
    quelle: x.quelle,
    wortlaut: x.wortlaut,
    herkunft,
    phase: offen ? "angehalten" : "fertig",
    meldung: null,
    geplant: [],
    auftrag: x,
    gespraechId,
    lokal: {},
    abbruch: Boolean(x.abgebrochenAm),
  };
}

export async function ladeAuftraege(gespraechId: string, herkunft: Herkunft): Promise<void> {
  if (zustand.geladenFuer === gespraechId) {
    return;
  }
  const gen = generation;
  // Was nach dem Beginn dieses Ladens entsteht, gehört zu dieser Sitzung und steht schon da.
  const seit = Date.now();
  setzeZustand((z) => ({ ...z, geladenFuer: gespraechId }));
  try {
    const { auftraege } = await klaraAuftragApi.liste(gespraechId);
    if (gen !== generation) {
      return;
    }
    setzeZustand((z) => {
      const bekannt = new Set(z.liste.map((a) => a.auftrag?.id).filter(Boolean));
      const neu = auftraege
        .filter((x) => !bekannt.has(x.id) && Date.parse(x.angelegtAm) < seit)
        .slice(-3)
        .reverse()
        .map((x) => ausGeladenem(x, herkunft, gespraechId));
      return { ...z, liste: [...z.liste, ...neu].slice(0, 5) };
    });
  } catch {
    if (gen === generation) {
      setzeZustand((z) => ({ ...z, geladenFuer: null }));
    }
  }
}

/** Für Tests und das Ende der Vorschau: alles Gezeigte vergessen (am Server bleibt alles). */
export function vergissAusfuehrungen(): void {
  generation += 1;
  setzeZustand(() => LEER);
}
