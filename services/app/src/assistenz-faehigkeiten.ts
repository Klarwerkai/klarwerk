import { createHash, randomUUID } from "node:crypto";
import type { ExternalKnowledgeStage, SearchProvider } from "../../external-search";
import type { Confidentiality } from "../../knowledge-object";
import type { AssistenzProfil, AssistenzProfilRepo } from "./assistenz-profil";
import { sanitizeLogText } from "./log-sanitize";

// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) — SKILLS UND WERKZEUGE ALS BEGRENZTE
// FÄHIGKEITEN DER ASSISTENZ.
// ================================================================================================
//
// KEIN ZWEITER KERN. Diese Datei ist die Vertragsschicht zwischen einem Arbeitsauftrag und einem
// registrierten Adapter: Registry, Auswahl nach Zweck, Bindung vor der Ausführung, Prüfung der
// aktuellen Lage vor JEDEM Schritt, Idempotenz und Ergebnis mit Herkunft. Anmeldung, Rechte,
// KI-Policy, Freigabe externer Wissensabfrage und Credentials kommen aus den vorhandenen Wegen und
// werden injiziert (`LageQuelle`, `GeheimnisQuelle`, `Kostenbuch`); persönliche Favoriten und
// Routinen liegen im vorhandenen Assistenzprofil (`assistenz-profil.ts`).
//
// DIE GRENZEN (G16/G17, BPA-11):
//   · Eine Fähigkeit gibt es nur als geprüften, versionierten `Faehigkeitsvertrag`. Ein Vertrag, der
//     eine Aktion außerhalb von `ERLAUBTE_AKTIONEN` nennt (Shell, Plugininstallation, Anbieter- oder
//     Kontowechsel, Kostenfreigabe …), wird abgewiesen.
//   · Ein SKILL.md ist Dateiablage (`nimmSkillDateiAuf`): Beschreibung ja, Ausführung nie. Es gibt
//     keinen Weg von einer Ablage in die Registry; darin stehende Anweisungen werden nur gemeldet.
//   · Ein Adapter ist eine eigene administrative Installation (`installiereAdapter`) und muss genau
//     die Vertragsfassung tragen. Ohne Adapter bleibt die Fähigkeit ehrlich „nicht verfügbar".
//   · Eine ausdrücklich gewählte Fähigkeit wird verwendet oder ihre Unverfügbarkeit erklärt — kein
//     stiller Wechsel auf eine andere.
//   · Werkzeugantworten sind Daten: übernommen werden nur die Felder der Ergebnisform; darin
//     enthaltene Anweisungen ändern weder Ziel noch Rechte.
//   · Geheimnisse erreicht nur der Adapter über `kontext.geheimnis()`; Vorschau, Ergebnis, Meldung
//     und Protokoll tragen höchstens den NAMEN des Zugangs.

/** Schutzstufe eines Kontextteils; `null` (unbekannt) gilt wie die höchste Stufe (G05). */
export type KontextSchutz = "oeffentlich" | Confidentiality;

const SCHUTZ_RANG: Record<KontextSchutz, number> = {
  oeffentlich: 0,
  intern: 1,
  vertraulich: 2,
  streng_vertraulich: 3,
};

function schutzRang(s: KontextSchutz | null): number {
  return s === null ? SCHUTZ_RANG.streng_vertraulich : SCHUTZ_RANG[s];
}

export type Datenempfaenger =
  | { readonly art: "intern" }
  | {
      readonly art: "extern";
      /** Stabile Anbieterkennung, z. B. `wikimedia`, `perplexity`. */
      readonly anbieter: string;
      readonly anbieterName: string;
      readonly host: string;
    };

export type FaehigkeitsWirkung = "lesen" | "entwurf_schreiben";

/** Die einzigen Aktionen, die ein Vertrag überhaupt nennen darf. Lesen, Schreiben und Netz getrennt. */
export const ERLAUBTE_AKTIONEN = [
  "netz_anfrage_anbieter",
  "wissen_lesen",
  "entwurf_anlegen",
] as const;
export type ErlaubteAktion = (typeof ERLAUBTE_AKTIONEN)[number];

export interface Eingabefeld {
  readonly name: string;
  readonly maxLaenge: number;
  readonly pflicht: boolean;
}

export interface Ergebnisform {
  readonly art: "trefferliste" | "entwurf";
  /** Die einzigen Felder, die aus einer Werkzeugantwort übernommen werden. */
  readonly felder: readonly string[];
  /** `true`: ein Eintrag ohne gültige http(s)-Adresse im Feld `url` wird verworfen. */
  readonly quellenPflicht: boolean;
}

/** Ein deklarierter untergeordneter Schritt (Unterwerkzeug) mit eigenem Datenweg. */
export interface Unterschritt {
  readonly id: string;
  readonly datenempfaenger: Datenempfaenger;
  /** `true`, wenn der Schritt ein Modell nutzt (LLM, ASR, OCR, Embeddings …). */
  readonly modell: boolean;
}

export interface Faehigkeitsvertrag {
  readonly id: string;
  /** Vertragsfassung, z. B. `1.0.0`; der Adapter muss genau sie tragen. */
  readonly fassung: string;
  readonly name: string;
  readonly beschreibung: string;
  readonly zwecke: readonly string[];
  readonly datenempfaenger: Datenempfaenger;
  readonly wirkung: FaehigkeitsWirkung;
  /** `true`, wenn der Hauptschritt ein Modell nutzt — dann sperrt „Keine KI". */
  readonly modell: boolean;
  readonly aktionen: readonly string[];
  readonly eingaben: readonly Eingabefeld[];
  readonly ergebnis: Ergebnisform;
  /** Höchste Schutzstufe, deren Inhalt an den Empfänger gehen darf. */
  readonly hoechsteSchutzstufe: KontextSchutz;
  readonly grenzen: {
    readonly maxTreffer: number;
    readonly zeitlimitMs: number;
    /** `null`: Kosten je Aufruf sind nicht belegt — dann startet kein Aufruf. */
    readonly kostenJeAufrufCent: number | null;
    /**
     * produkt:20261013:produktbudget-anwender-admin (PBE-07): die Währung des belegten Tarifs. Ein
     * Kostenbuch mit Reservierung gibt ohne passende Währung nichts frei.
     */
    readonly kostenWaehrung?: string;
  };
  /** Budgetzuordnung im Kostenbuch; `null` = keine geklärte Zuordnung. */
  readonly kostenzuordnung: string | null;
  /** NAME des Zugangs im sicheren Credentialweg, nie ein Wert. */
  readonly credential: string | null;
  readonly ruecknahme: "keine_wirkung" | "entwurf_verwerfen";
  readonly unterschritte: readonly Unterschritt[];
  /** Skill-/Adapterverantwortung (Rolle, keine erfundene Person). */
  readonly verantwortlich: string;
}

export class FaehigkeitsVertragFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaehigkeitsVertragFehler";
  }
}

const KENNUNG = /^[a-z0-9][a-z0-9-]{1,62}$/;
const FASSUNG = /^\d+\.\d+\.\d+$/;

/** Weist jeden Vertrag ab, der mehr verspricht oder verlangt, als die Grenzen erlauben. */
export function pruefeVertrag(v: Faehigkeitsvertrag): void {
  if (!KENNUNG.test(v.id)) {
    throw new FaehigkeitsVertragFehler(`Ungültige Fähigkeitskennung „${v.id}".`);
  }
  if (!FASSUNG.test(v.fassung)) {
    throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: Fassung muss x.y.z sein.`);
  }
  if (v.zwecke.length === 0) {
    throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: mindestens ein Zweck ist nötig.`);
  }
  for (const a of v.aktionen) {
    if (!(ERLAUBTE_AKTIONEN as readonly string[]).includes(a)) {
      throw new FaehigkeitsVertragFehler(
        `Fähigkeit ${v.id}: die Aktion „${a}" ist für Fähigkeiten nicht zulässig.`,
      );
    }
  }
  if (v.datenempfaenger.art === "extern" && !v.aktionen.includes("netz_anfrage_anbieter")) {
    throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: externer Empfänger ohne Netzaktion.`);
  }
  if (v.wirkung === "entwurf_schreiben") {
    if (!v.aktionen.includes("entwurf_anlegen") || v.ruecknahme !== "entwurf_verwerfen") {
      throw new FaehigkeitsVertragFehler(
        `Fähigkeit ${v.id}: eine Schreibwirkung braucht die Aktion entwurf_anlegen und eine echte Rücknahme.`,
      );
    }
  } else if (v.aktionen.includes("entwurf_anlegen")) {
    throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: Lesefähigkeit darf nicht schreiben.`);
  }
  if (v.eingaben.length === 0 || v.eingaben.some((e) => e.maxLaenge < 1 || e.maxLaenge > 2000)) {
    throw new FaehigkeitsVertragFehler(
      `Fähigkeit ${v.id}: Eingaben brauchen 1–2000 Zeichen Grenze.`,
    );
  }
  if (v.ergebnis.felder.length === 0) {
    throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: die Ergebnisform braucht Felder.`);
  }
  if (v.grenzen.maxTreffer < 1 || v.grenzen.zeitlimitMs < 1) {
    throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: Treffer- und Zeitgrenze sind Pflicht.`);
  }
  const ids = new Set<string>();
  for (const u of v.unterschritte) {
    if (!KENNUNG.test(u.id) || ids.has(u.id)) {
      throw new FaehigkeitsVertragFehler(`Fähigkeit ${v.id}: Unterschritt „${u.id}" ungültig.`);
    }
    ids.add(u.id);
  }
}

function kanonisch(wert: unknown): string {
  if (Array.isArray(wert)) {
    return `[${wert.map(kanonisch).join(",")}]`;
  }
  if (wert !== null && typeof wert === "object") {
    const o = wert as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonisch(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(wert) ?? "null";
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Fingerabdruck einer Bindung ohne ihren Zeitstempel: dieselbe Auftragskennung mit demselben Inhalt
 * ist derselbe Auftrag, auch wenn er neu vorbereitet wurde.
 */
export function bindungsFingerabdruck(b: Faehigkeitsbindung): string {
  return sha256(kanonisch({ ...b, gebundenAm: undefined }));
}

/** Fingerabdruck des ganzen Vertrags — jede Änderung (auch ohne Fassungssprung) ändert ihn. */
export function vertragsFingerabdruck(v: Faehigkeitsvertrag): string {
  return sha256(kanonisch(v));
}

// ------------------------------------------------------------------------------------------------
// ADAPTER
// ------------------------------------------------------------------------------------------------

export interface AdapterKontext {
  readonly auftragId: string;
  readonly signal: AbortSignal;
  /** Der Zugang aus dem sicheren Credentialweg — nur hier, nie in Vorschau, Ergebnis oder Log. */
  geheimnis(): string | null;
  /**
   * Führt einen DEKLARIERTEN Unterschritt aus. Davor gelten erneut: dauerhafter Abbruch, aktuelle
   * Lage, aktuelle Konto- und Kontextrechte samt gebundener Kontextfassung und — gegen die Grenzen
   * dieses Empfängers — die tatsächlich weitergegebenen `daten` (ohne Angabe: die gebundene Eingabe).
   */
  unterschritt<T>(
    id: string,
    arbeit: () => Promise<T>,
    daten?: Readonly<Record<string, string>>,
  ): Promise<T>;
}

export interface AdapterAntwort {
  readonly status: "ok" | "teilweise" | "fehler";
  readonly eintraege: readonly unknown[];
  readonly meldung?: string;
  readonly verbrauchCent?: number;
  /** Kennung einer tatsächlich angelegten Wirkung (z. B. Entwurf) — Grundlage der Rücknahme. */
  readonly wirkungKennung?: string;
}

export interface FaehigkeitsAdapter {
  readonly faehigkeitId: string;
  readonly fassung: string;
  /** `echt`: tatsächlicher Anbieter-/Hostweg; `ersatz`: Test-/Stubtransport — nie ein Funktionsbeleg. */
  readonly transport: "echt" | "ersatz";
  fuehreAus(
    eingabe: Readonly<Record<string, string>>,
    kontext: AdapterKontext,
  ): Promise<AdapterAntwort>;
}

// ------------------------------------------------------------------------------------------------
// REGISTRY
// ------------------------------------------------------------------------------------------------

export interface RegistryEintrag {
  readonly vertrag: Faehigkeitsvertrag;
  readonly fingerabdruck: string;
  readonly adapter: FaehigkeitsAdapter | null;
  readonly aktiv: boolean;
}

export class Faehigkeitsregistry {
  private readonly eintraege = new Map<string, RegistryEintrag>();

  /** Administrativ: Vertrag aufnehmen oder ersetzen. Ein ersetzter Vertrag verliert seinen Adapter. */
  registriere(vertrag: Faehigkeitsvertrag): RegistryEintrag {
    pruefeVertrag(vertrag);
    const kopie = structuredClone(vertrag);
    const fingerabdruck = vertragsFingerabdruck(kopie);
    const alt = this.eintraege.get(kopie.id);
    const e: RegistryEintrag = {
      vertrag: kopie,
      fingerabdruck,
      adapter: alt !== undefined && alt.fingerabdruck === fingerabdruck ? alt.adapter : null,
      aktiv: alt?.aktiv ?? true,
    };
    this.eintraege.set(kopie.id, e);
    return e;
  }

  /** Administrativ und getrennt von der Registrierung: den Adapter einer Fassung installieren. */
  installiereAdapter(adapter: FaehigkeitsAdapter): void {
    const e = this.eintraege.get(adapter.faehigkeitId);
    if (!e) {
      throw new FaehigkeitsVertragFehler(
        `Adapter für unbekannte Fähigkeit „${adapter.faehigkeitId}" — erst den Vertrag registrieren.`,
      );
    }
    this.eintraege.set(e.vertrag.id, { ...e, adapter });
  }

  setzeAktiv(id: string, aktiv: boolean): void {
    const e = this.eintraege.get(id);
    if (e) {
      this.eintraege.set(id, { ...e, aktiv });
    }
  }

  eintrag(id: string): RegistryEintrag | null {
    return this.eintraege.get(id) ?? null;
  }

  liste(): readonly RegistryEintrag[] {
    return [...this.eintraege.values()];
  }
}

// ------------------------------------------------------------------------------------------------
// SKILL.md — NUR ABLAGE
// ------------------------------------------------------------------------------------------------

/** Muster, die in fremdem Skill-/Werkzeugtext als Anweisung erkannt und nie befolgt werden. */
const FREMDE_ANWEISUNG: readonly RegExp[] = [
  /\b(?:npm|pnpm|yarn|pip3?|brew|apt(?:-get)?)\s+install\b/i,
  /\bcurl\b[^\n]*\|\s*(?:ba|z)?sh\b/i,
  /\b(?:sudo|rm\s+-rf|chmod\s+\+x)\b/i,
  /\/?plugins?\s+(?:install|add|hinzufügen|installieren)\b/i,
  /\bignor(?:e|iere)\b[^\n]{0,40}\b(?:previous|vorherigen?|alle|all)\b/i,
  /\b(?:allowed-tools|bypassPermissions|dangerously)\b/i,
  /\b(?:alle|all|admin|volle?)\s+(?:rechte|permissions|zugriffe?)\b/i,
];

const SHELLBLOCK = /^```\s*(?:bash|sh|shell|zsh|console)\b/i;

export function enthaeltFremdeAnweisung(text: string): boolean {
  return FREMDE_ANWEISUNG.some((m) => m.test(text));
}

export interface SkillAblage {
  readonly stand: "nur_ablage";
  readonly herkunft: string;
  readonly fingerabdruck: string;
  readonly name: string | null;
  readonly beschreibung: string | null;
  readonly fassung: string | null;
  /** Erkannte Ausführungs-/Rechteanweisungen — gemeldet, nie befolgt. */
  readonly ignorierteAnweisungen: readonly string[];
  readonly hinweis: string;
}

/**
 * Liest ein SKILL.md als BESCHREIBUNG. Es entsteht keine Fähigkeit, kein Adapter, kein Recht und
 * kein Aufruf; die Registry kennt keinen Weg, eine Ablage aufzunehmen.
 */
export function nimmSkillDateiAuf(text: string, herkunft: string): SkillAblage {
  const kopf: Record<string, string> = {};
  const zeilen = text.split(/\r?\n/);
  if (zeilen[0]?.trim() === "---") {
    for (let i = 1; i < zeilen.length; i++) {
      const z = zeilen[i] ?? "";
      if (z.trim() === "---") {
        break;
      }
      const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(z);
      if (m?.[1] && m[2] !== undefined) {
        kopf[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  const ignoriert: string[] = [];
  for (const z of zeilen) {
    if (SHELLBLOCK.test(z.trim()) || enthaeltFremdeAnweisung(z)) {
      ignoriert.push(sanitizeLogText(z.trim().slice(0, 80), {}));
    }
  }
  return {
    stand: "nur_ablage",
    herkunft,
    fingerabdruck: sha256(text),
    name: kopf.name ?? null,
    beschreibung: kopf.description ?? kopf.beschreibung ?? null,
    fassung: kopf.version ?? kopf.fassung ?? null,
    ignorierteAnweisungen: ignoriert,
    hinweis:
      "Diese Skilldatei ist nur abgelegt. Ausführbar wird eine Fähigkeit erst mit geprüftem Vertrag und installiertem Adapter.",
  };
}

// ------------------------------------------------------------------------------------------------
// LAGE, ZUGÄNGE, KOSTEN — aus den vorhandenen Wegen injiziert
// ------------------------------------------------------------------------------------------------

export interface FaehigkeitsLage {
  /** Gespeicherte administrative KI-Abschaltung bzw. „Keine KI" für diesen Kontext. */
  readonly keineKi: boolean;
  readonly externeWissensabfrage: ExternalKnowledgeStage;
  /** Adminfreigabe, auch vertrauliche Inhalte an externe Empfänger zu geben. */
  readonly vertraulichNachExtern: boolean;
  /** Für externe Verarbeitung freigegebene Anbieterkennungen (P04). */
  readonly freigegebeneAnbieter: readonly string[];
}

export type LageQuelle = (wer: { mandant: string; nutzer: string }) => Promise<FaehigkeitsLage>;

export interface GeheimnisQuelle {
  hole(name: string): string | null;
}

/** Eine Reservierung gegen den Deckel einer Budgetzuordnung, unmittelbar vor der Wirkung. */
export interface KostenReservierung {
  readonly zuordnung: string;
  readonly cent: number;
  /**
   * Die Kostenidentität ist DIESE Ausführung: Konto, Auftragskennung (je Konto eindeutig) und
   * Versuch. Eine Auftragskennung allein ist mandantenweit nicht eindeutig, und jeder weitere
   * Versuch ist ein weiterer kostenwirksamer Aufruf.
   */
  readonly nutzer: string;
  readonly auftragId: string;
  readonly versuch: number;
  /** Anbieterkennung des Empfängers — eine Zuordnung gilt nur für ihren Anbieter. */
  readonly anbieter: string | null;
  /** Währung des belegten Tarifs (`grenzen.kostenWaehrung`); `null` = nicht belegt. */
  readonly waehrung: string | null;
}

/** Persistenter Kostenstand je Budgetzuordnung (G18). */
export interface Kostenbuch {
  rest(zuordnung: string): Promise<number | null>;
  /** `herkunft`: Konto und Versuch der Ausführung — dieselbe Identität wie bei `reserviere`. */
  verbuche(
    zuordnung: string,
    cent: number,
    auftragId: string,
    herkunft?: { readonly nutzer: string; readonly versuch: number },
  ): Promise<void>;
  /**
   * produkt:20261013:produktbudget-anwender-admin (PBE-06): reserviert die Kosten eines Aufrufs
   * ATOMAR gegen den Deckel, bevor die Wirkung startet — parallele Aufrufe können den Rest so nicht
   * beide verbrauchen. Dieselbe Ausführung (Konto, Auftrag, Versuch) reserviert nur einmal, und nur
   * mit gleichem Betrag und gleicher Währung. `false`: keine Wirkung.
   */
  reserviere?(r: KostenReservierung): Promise<boolean>;
}

export type VoraussetzungArt =
  | "registrierung"
  | "adapter"
  | "adapterfassung"
  | "deaktiviert"
  | "credential"
  | "budget"
  | "freigabe_extern"
  | "anbieter"
  | "eingabe"
  | "routine"
  | "fassung_geaendert"
  | "kontext_geaendert"
  | "keine_ki"
  | "vertraulich"
  | "kontextrecht";

export interface Voraussetzung {
  readonly art: VoraussetzungArt;
  readonly text: string;
}

/** Diese Arten sind Sperren der Datenregeln — alles andere ist eine offene Voraussetzung. */
const SPERR_ARTEN: readonly VoraussetzungArt[] = ["keine_ki", "vertraulich", "kontextrecht"];

/**
 * G04/G05: die AKTUELLEN Rechte des Kontos an Konto und gebundenem Arbeitsbereichskontext — vor
 * jeder Ausführung (auch im Hintergrund) und vor jeder Rückgabe eines gespeicherten Ergebnisses.
 * `ausfuehrung` prüft zusätzlich, dass jedes Kontextobjekt noch die gebundene Fassung trägt.
 * Ergebnis `null` heisst: erlaubt. Die Antwort nennt nie Titel oder Inhalt eines Objekts.
 */
export interface KontextPruefung {
  pruefe(
    nutzer: string,
    kontext: Faehigkeitsbindung["kontext"],
    anlass: "ausfuehrung" | "rueckgabe",
  ): Promise<Voraussetzung | null>;
  /**
   * Der AKTUELLE Inhalt der gebundenen Kontextobjekte — nur, wenn das Konto jedes sehen darf, sonst
   * `null`. Dient allein der Prüfung weitergegebener Daten vor einem externen Unterschritt; er wird
   * weder gebunden noch gespeichert noch gesendet.
   */
  lade?(nutzer: string, kontext: Faehigkeitsbindung["kontext"]): Promise<KontextTeil[] | null>;
}

function woerter(t: string): string[] {
  return t
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/** `true`, wenn `eingabe` einen Auszug (drei Wörter in Folge) aus `quelle` enthält. */
export function enthaeltAuszug(eingabe: string, quelle: string): boolean {
  const q = woerter(quelle);
  const e = ` ${woerter(eingabe).join(" ")} `;
  if (q.length < 3) {
    const phrase = q.join(" ");
    return phrase.length >= 8 && e.includes(` ${phrase} `);
  }
  for (let i = 0; i + 3 <= q.length; i++) {
    if (e.includes(` ${q.slice(i, i + 3).join(" ")} `)) {
      return true;
    }
  }
  return false;
}

function pruefeSchritt(
  empfaenger: Datenempfaenger,
  modell: boolean,
  hoechsteSchutzstufe: KontextSchutz,
  lage: FaehigkeitsLage,
  eingabe: Readonly<Record<string, string>> | null,
  kontext: readonly KontextTeil[],
): Voraussetzung[] {
  const out: Voraussetzung[] = [];
  if (modell && lage.keineKi) {
    out.push({
      art: "keine_ki",
      text: '„Keine KI" gilt: dieser Schritt nutzt ein Modell und läuft deshalb nicht.',
    });
  }
  if (empfaenger.art === "extern") {
    if (lage.externeWissensabfrage === "blocked") {
      out.push({
        art: "freigabe_extern",
        text: "Die externe Wissensabfrage ist in dieser Instanz gesperrt.",
      });
    }
    if (!lage.freigegebeneAnbieter.includes(empfaenger.anbieter)) {
      out.push({
        art: "anbieter",
        text: `${empfaenger.anbieterName} ist für externe Verarbeitung nicht freigegeben.`,
      });
    }
    if (eingabe) {
      const text = Object.values(eingabe).join("\n");
      const grenze = SCHUTZ_RANG[hoechsteSchutzstufe];
      const betroffen = kontext.filter((k) => {
        const rang = schutzRang(k.schutz);
        const zuHoch =
          rang > grenze || (rang >= SCHUTZ_RANG.vertraulich && !lage.vertraulichNachExtern);
        return zuHoch && enthaeltAuszug(text, k.text);
      });
      if (betroffen.length > 0) {
        out.push({
          art: "vertraulich",
          text: `Die Eingabe enthält geschützten Inhalt aus dem Arbeitsbereich; er geht nicht an ${empfaenger.anbieterName}.`,
        });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// AUFTRAG, BINDUNG, ERGEBNIS
// ------------------------------------------------------------------------------------------------

export interface KontextTeil {
  readonly kennung: string;
  readonly fassung: string;
  readonly schutz: KontextSchutz | null;
  /** Nur zur Prüfung auf geschützte Auszüge; wird weder gebunden noch gesendet. */
  readonly text: string;
}

export interface Faehigkeitsauftrag {
  readonly auftragId: string;
  readonly mandant: string;
  readonly nutzer: string;
  readonly sitzung: string;
  readonly arbeitsbereich: string | null;
  readonly zweck: string;
  /** Ausdrücklich gewählte Fähigkeit — dann nur sie oder eine ehrliche Unverfügbarkeit. */
  readonly gewaehlt: string | null;
  readonly eingabe: Readonly<Record<string, unknown>>;
  readonly kontext: readonly KontextTeil[];
  readonly ausloeser: "nutzerauftrag" | "routine";
}

export interface Faehigkeitsbindung {
  readonly auftragId: string;
  readonly mandant: string;
  readonly nutzer: string;
  readonly sitzung: string;
  readonly arbeitsbereich: string | null;
  readonly zweck: string;
  readonly ausloeser: "nutzerauftrag" | "routine";
  readonly faehigkeitId: string;
  readonly fassung: string;
  readonly vertragsFingerabdruck: string;
  readonly adapterFassung: string;
  readonly eingabe: Readonly<Record<string, string>>;
  readonly aktionen: readonly string[];
  readonly datenweg: string;
  readonly ergebnisform: Ergebnisform;
  readonly kontext: readonly {
    readonly kennung: string;
    readonly fassung: string;
    readonly schutz: KontextSchutz | null;
  }[];
  readonly gebundenAm: string;
}

export type AusfuehrungsStand =
  | "erfolgreich"
  | "teilweise"
  | "fehlgeschlagen"
  | "gesperrt"
  | "voraussetzung_fehlt"
  | "unverfuegbar"
  | "abgebrochen"
  | "laeuft";

export interface Faehigkeitsergebnis {
  readonly auftragId: string;
  readonly stand: AusfuehrungsStand;
  readonly faehigkeitId: string | null;
  readonly fassung: string | null;
  readonly vertragsFingerabdruck: string | null;
  readonly eintraege: readonly Readonly<Record<string, string>>[];
  /** Einträge, die die Ergebnisform verletzten (z. B. Quelle fehlt) und nicht übernommen wurden. */
  readonly verworfen: number;
  /** Übernommene Einträge mit Anweisungstext — bleiben Daten, werden nie ausgeführt. */
  readonly fremdeAnweisungen: number;
  readonly meldung: string;
  readonly voraussetzungen: readonly Voraussetzung[];
  readonly verbrauchCent: number | null;
  readonly transport: "echt" | "ersatz" | null;
  readonly wirkungKennung: string | null;
  readonly ruecklink: { readonly arbeitsbereich: string | null; readonly auftragId: string };
  readonly wiederholt: boolean;
  readonly versuch: number;
  readonly abgeschlossenAm: string | null;
}

export type ErgebnisTeil = Partial<Faehigkeitsergebnis> & {
  stand: AusfuehrungsStand;
  meldung: string;
};

export type Auswahl =
  | {
      readonly art: "faehigkeit";
      readonly eintrag: RegistryEintrag;
      readonly grund: "gewaehlt" | "zweck";
    }
  | {
      readonly art: "unverfuegbar";
      readonly faehigkeitId: string | null;
      readonly erklaerung: string;
      readonly voraussetzungen: readonly Voraussetzung[];
    }
  | {
      readonly art: "mehrere";
      readonly kandidaten: readonly string[];
      readonly erklaerung: string;
    };

export type Vorbereitung =
  | { readonly art: "gebunden"; readonly bindung: Faehigkeitsbindung; readonly vorschau: string }
  | {
      readonly art: "offen";
      readonly stand: "unverfuegbar" | "voraussetzung_fehlt" | "gesperrt" | "mehrere";
      readonly erklaerung: string;
      readonly voraussetzungen: readonly Voraussetzung[];
      readonly kandidaten: readonly string[];
    };

// ------------------------------------------------------------------------------------------------
// IDEMPOTENZ
// ------------------------------------------------------------------------------------------------

export type Anspruch =
  | { readonly art: "neu"; readonly versuch: number; readonly wiederaufnahme: boolean }
  | { readonly art: "laeuft" }
  | {
      readonly art: "vorhanden";
      readonly ergebnis: Faehigkeitsergebnis;
      readonly bindung: Faehigkeitsbindung;
    }
  | { readonly art: "anderer_auftrag" }
  /** Der Auftrag wurde vor dem Start dauerhaft abgebrochen; er ist jetzt beansprucht, um das zu
   *  vermerken, und startet nicht. */
  | { readonly art: "abgebrochen"; readonly versuch: number };

export type AuftragsZustand = "wartet" | "laeuft" | "fertig";

/**
 * Ein Auftrag in der dauerhaften Ablage: Bindung, Zustand, Versuch und Ergebnis. Die Kennung ist je
 * Konto die Auftrags- UND Wirkungsidentität — ein Wiederanlauf nach Neustart läuft unter derselben
 * Kennung, und ein schreibender Adapter erhält sie als Idempotenzschlüssel (`kontext.auftragId`).
 */
export interface AuftragsEintrag {
  readonly auftragId: string;
  readonly fingerabdruck: string;
  readonly bindung: Faehigkeitsbindung;
  readonly zustand: AuftragsZustand;
  readonly versuch: number;
  /** Der Prozess, der gerade ausführt (`laeuft`); sonst `null`. */
  readonly instanz: string | null;
  readonly seit: string;
  readonly ergebnis: Faehigkeitsergebnis | null;
  /**
   * Der Nutzer hat den Auftrag abgebrochen. Dauerhaft: ein wartender Auftrag startet danach nicht
   * mehr, ein laufender startet keinen abhängigen Unterschritt — auch in einem anderen Prozess.
   */
  readonly abbruch?: boolean;
  /**
   * Ergebnisinhalt und Eingabe sind nach der Aufbewahrungsgrenze entfernt. Die Auftrags- und
   * Wirkungsidentität (Kennung, Fingerabdruck, Stand, Wirkungskennung) bleibt erhalten — eine
   * Wiederholung derselben Kennung löst deshalb keine zweite Wirkung aus.
   */
  readonly gekuerzt?: boolean;
}

/**
 * Die dauerhafte Ablage der Aufträge eines Kontos. Schreiben nur als Vergleich-und-Tausch auf die
 * ganze Liste — zwei Prozesse oder zwei Anfragen können denselben Auftrag nicht beide beanspruchen.
 */
export interface FaehigkeitsAblage {
  liste(nutzer: string): Promise<readonly AuftragsEintrag[]>;
  ersetze(
    nutzer: string,
    alt: readonly AuftragsEintrag[],
    neu: readonly AuftragsEintrag[],
  ): Promise<boolean>;
  kontenMitOffenenAuftraegen(): Promise<readonly string[]>;
}

/**
 * Abgeschlossene Aufträge, deren ERGEBNISINHALT je Konto aufbewahrt wird. Ältere behalten nur ihre
 * Identität (`gekuerzt`) — Ergebnisaufbewahrung und Dublettenschutz sind getrennt.
 */
export const AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE = 30;

/** Ein `laeuft` eines ANDEREN Prozesses gilt nach dieser Frist als unterbrochen (Neustart, Absturz). */
export const LAUF_FRIST_MS = 15 * 60_000;

export const GEKUERZT_MELDUNG =
  "Der Ergebnisinhalt ist nach der Aufbewahrungsgrenze entfernt; der Auftrag wird nicht erneut ausgeführt.";

/** Nur Ergebnisinhalt und Eingabe fallen weg — Kennung, Fingerabdruck, Stand und Wirkung bleiben. */
function kuerzeEintrag(e: AuftragsEintrag): AuftragsEintrag {
  if (e.gekuerzt) {
    return e;
  }
  return {
    ...e,
    bindung: { ...e.bindung, eingabe: {} },
    ergebnis: e.ergebnis
      ? {
          ...e.ergebnis,
          eintraege: [],
          verworfen: 0,
          fremdeAnweisungen: 0,
          meldung: GEKUERZT_MELDUNG,
        }
      : null,
    gekuerzt: true,
  };
}

function kuerze(liste: readonly AuftragsEintrag[]): AuftragsEintrag[] {
  const behalten = new Set(
    liste
      .filter((e) => e.zustand === "fertig")
      .sort((a, b) => b.seit.localeCompare(a.seit))
      .slice(0, AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE)
      .map((e) => e.auftragId),
  );
  return liste.map((e) =>
    e.zustand === "fertig" && !behalten.has(e.auftragId) ? kuerzeEintrag(e) : e,
  );
}

/**
 * Ohne Wirkung gescheiterte Läufe dürfen unter derselben Kennung erneut versucht werden. Ein vom
 * Nutzer abgebrochener Auftrag nicht: der Abbruch ist endgültig für diese Kennung.
 */
function wiederholbar(e: Faehigkeitsergebnis): boolean {
  return (
    e.wirkungKennung === null &&
    (e.stand === "fehlgeschlagen" || e.stand === "gesperrt" || e.stand === "voraussetzung_fehlt")
  );
}

/** Für Tests und den Speicherbetrieb; im Produkt `ProfilFaehigkeitsAblage`. */
export class InMemoryFaehigkeitsAblage implements FaehigkeitsAblage {
  private readonly listen = new Map<string, AuftragsEintrag[]>();

  liste(nutzer: string): Promise<readonly AuftragsEintrag[]> {
    return Promise.resolve(structuredClone(this.listen.get(nutzer) ?? []));
  }

  ersetze(
    nutzer: string,
    alt: readonly AuftragsEintrag[],
    neu: readonly AuftragsEintrag[],
  ): Promise<boolean> {
    if (kanonisch(this.listen.get(nutzer) ?? []) !== kanonisch(alt)) {
      return Promise.resolve(false);
    }
    this.listen.set(nutzer, structuredClone([...neu]));
    return Promise.resolve(true);
  }

  kontenMitOffenenAuftraegen(): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.listen.entries()]
        .filter(([, l]) => l.some((e) => e.zustand !== "fertig"))
        .map(([n]) => n),
    );
  }
}

/**
 * Die Produktablage: die Aufträge liegen im vorhandenen persönlichen Assistenzprofil des Kontos
 * (`assistenz_profile`, Postgres im Betrieb) — kein zweiter Auftragsspeicher (G03). Sie sind damit
 * dort gesichert, wiederhergestellt und gelöscht, wo das Profil es ist.
 */
export class ProfilFaehigkeitsAblage implements FaehigkeitsAblage {
  constructor(private readonly repo: AssistenzProfilRepo) {}

  async liste(nutzer: string): Promise<readonly AuftragsEintrag[]> {
    return (await this.repo.hole(nutzer))?.faehigkeitsAuftraege ?? [];
  }

  ersetze(
    nutzer: string,
    alt: readonly AuftragsEintrag[],
    neu: readonly AuftragsEintrag[],
  ): Promise<boolean> {
    return this.repo.schreibeFaehigkeitsauftraege(nutzer, alt, neu);
  }

  kontenMitOffenenAuftraegen(): Promise<readonly string[]> {
    return this.repo.kontenMitOffenenFaehigkeitsauftraegen();
  }
}

// ------------------------------------------------------------------------------------------------
// AUSFÜHRUNG
// ------------------------------------------------------------------------------------------------

class SchrittGesperrt extends Error {
  constructor(readonly voraussetzungen: readonly Voraussetzung[]) {
    super("Unterschritt gesperrt");
    this.name = "SchrittGesperrt";
  }
}

class Abgebrochen extends Error {
  constructor() {
    super("Abgebrochen");
    this.name = "Abgebrochen";
  }
}

class Zeitlimit extends Error {
  constructor() {
    super("Zeitlimit");
    this.name = "Zeitlimit";
  }
}

export interface FaehigkeitsAusfuehrungDeps {
  readonly registry: Faehigkeitsregistry;
  readonly lage: LageQuelle;
  readonly geheimnisse: GeheimnisQuelle;
  readonly ablage: FaehigkeitsAblage;
  readonly kostenbuch?: Kostenbuch;
  readonly vormerkungen?: FaehigkeitsVormerkungen;
  /** Aktuelle Konto- und Kontextrechte (G04/G05). Fehlt sie, gilt kein Kontext als geprüft. */
  readonly kontext?: KontextPruefung;
  /** Standardlog; jede Zeile ist bereinigt und trägt keine Eingabe. */
  readonly protokoll?: (zeile: string) => void;
  readonly jetzt?: () => number;
  /** Kennung dieses Prozesses; ein neuer Prozess erkennt daran unterbrochene Läufe. */
  readonly instanz?: string;
}

/** Ein Auftrag in der Sicht des Kontos — Ergebnis nur, wenn die aktuellen Rechte es erlauben. */
export interface AuftragsSicht {
  readonly auftragId: string;
  readonly zustand: AuftragsZustand;
  readonly faehigkeitId: string;
  readonly fassung: string;
  readonly zweck: string;
  readonly arbeitsbereich: string | null;
  readonly versuch: number;
  readonly seit: string;
  readonly ergebnis: Faehigkeitsergebnis | null;
}

/** Eine Fähigkeit in der Übersicht des Kontos — Zugangsname ja, Zugangswert nie. */
export interface FaehigkeitsSicht {
  readonly id: string;
  readonly name: string;
  readonly beschreibung: string;
  readonly fassung: string;
  readonly zwecke: readonly string[];
  readonly datenempfaenger: Datenempfaenger;
  readonly wirkung: FaehigkeitsWirkung;
  readonly modell: boolean;
  readonly eingaben: readonly Eingabefeld[];
  readonly grenzen: Faehigkeitsvertrag["grenzen"];
  readonly zugang: string | null;
  readonly ruecknahme: Faehigkeitsvertrag["ruecknahme"];
  readonly verfuegbar: boolean;
  readonly voraussetzungen: readonly Voraussetzung[];
}

function datenwegText(v: Faehigkeitsvertrag): string {
  const ziel =
    v.datenempfaenger.art === "intern"
      ? "bleibt in Klarwerk"
      : `an ${v.datenempfaenger.anbieterName} (${v.datenempfaenger.host})`;
  const unter = v.unterschritte.map(
    (u) =>
      `${u.id}: ${u.datenempfaenger.art === "intern" ? "intern" : u.datenempfaenger.anbieterName}${u.modell ? ", Modell" : ""}`,
  );
  return unter.length > 0 ? `${ziel}; Unterschritte ${unter.join("; ")}` : ziel;
}

export class FaehigkeitsAusfuehrung {
  private readonly jetzt: () => number;
  private readonly instanz: string;
  /** Laufende Ausführungen dieses Prozesses, Schlüssel `nutzer␀auftragId`. */
  private readonly laufend = new Map<string, AbortController>();
  private abarbeitung: Promise<readonly Faehigkeitsergebnis[]> | null = null;

  constructor(private readonly deps: FaehigkeitsAusfuehrungDeps) {
    this.jetzt = deps.jetzt ?? Date.now;
    this.instanz = deps.instanz ?? randomUUID();
  }

  /** Die Registry dieser Ausführung — für die administrative Registrierung und Adapterinstallation. */
  get registry(): Faehigkeitsregistry {
    return this.deps.registry;
  }

  private static schluessel(nutzer: string, auftragId: string): string {
    return `${nutzer}\u0000${auftragId}`;
  }

  /** `true`, solange ein `laeuft` wirklich läuft: hier im Prozess oder anderswo innerhalb der Frist. */
  private lebt(e: AuftragsEintrag): boolean {
    if (e.zustand !== "laeuft") {
      return false;
    }
    if (
      e.instanz === this.instanz &&
      this.laufend.has(FaehigkeitsAusfuehrung.schluessel(e.bindung.nutzer, e.auftragId))
    ) {
      return true;
    }
    return this.jetzt() - Date.parse(e.seit) < LAUF_FRIST_MS;
  }

  /** Vergleich-und-Tausch auf die Auftragsliste eines Kontos, mit begrenzter Wiederholung. */
  private async aendereAuftraege<T>(
    nutzer: string,
    f: (liste: readonly AuftragsEintrag[]) => { neu: AuftragsEintrag[] | null; wert: T },
  ): Promise<T> {
    for (let versuch = 0; versuch < 8; versuch++) {
      const alt = await this.deps.ablage.liste(nutzer);
      const { neu, wert } = f(alt);
      if (neu === null || (await this.deps.ablage.ersetze(nutzer, alt, kuerze(neu)))) {
        return wert;
      }
    }
    throw new Error("Die Auftragsablage ist gerade belegt; bitte erneut versuchen.");
  }

  private beanspruche(bindung: Faehigkeitsbindung, fingerabdruck: string): Promise<Anspruch> {
    const stempel = this.stempel();
    return this.aendereAuftraege<Anspruch>(bindung.nutzer, (liste) => {
      const e = liste.find((x) => x.auftragId === bindung.auftragId);
      if (!e) {
        const neu: AuftragsEintrag = {
          auftragId: bindung.auftragId,
          fingerabdruck,
          bindung,
          zustand: "laeuft",
          versuch: 1,
          instanz: this.instanz,
          seit: stempel,
          ergebnis: null,
        };
        return { neu: [...liste, neu], wert: { art: "neu", versuch: 1, wiederaufnahme: false } };
      }
      if (e.fingerabdruck !== fingerabdruck) {
        return { neu: null, wert: { art: "anderer_auftrag" } };
      }
      if (this.lebt(e)) {
        return { neu: null, wert: { art: "laeuft" } };
      }
      if (e.zustand === "fertig" && e.ergebnis && !wiederholbar(e.ergebnis)) {
        return {
          neu: null,
          wert: { art: "vorhanden", ergebnis: e.ergebnis, bindung: e.bindung },
        };
      }
      const versuch = e.versuch + 1;
      if (e.abbruch) {
        // Dauerhaft abgebrochen (auch aus einem anderen Prozess): beanspruchen, nicht starten.
        const markiert: AuftragsEintrag = {
          ...e,
          zustand: "laeuft",
          versuch,
          instanz: this.instanz,
          seit: stempel,
        };
        return {
          neu: liste.map((x) => (x.auftragId === e.auftragId ? markiert : x)),
          wert: { art: "abgebrochen", versuch },
        };
      }
      const geaendert: AuftragsEintrag = {
        ...e,
        zustand: "laeuft",
        versuch,
        instanz: this.instanz,
        seit: stempel,
      };
      return {
        neu: liste.map((x) => (x.auftragId === e.auftragId ? geaendert : x)),
        // Ein `laeuft` ohne lebenden Lauf ist ein unterbrochener Lauf (Neustart): Wiederaufnahme
        // unter derselben Auftrags- und Wirkungsidentität.
        wert: { art: "neu", versuch, wiederaufnahme: e.zustand === "laeuft" },
      };
    });
  }

  private schreibeErgebnis(nutzer: string, ergebnis: Faehigkeitsergebnis): Promise<void> {
    const stempel = this.stempel();
    return this.aendereAuftraege<undefined>(nutzer, (liste) => ({
      neu: liste.map((x) =>
        x.auftragId === ergebnis.auftragId
          ? { ...x, zustand: "fertig" as const, instanz: null, seit: stempel, ergebnis }
          : x,
      ),
      wert: undefined,
    }));
  }

  /** G04/G05: aktuelle Rechte vor der Rückgabe eines gespeicherten Ergebnisses. */
  private async rueckgabeSperre(b: Faehigkeitsbindung): Promise<Voraussetzung | null> {
    if (!this.deps.kontext) {
      return null;
    }
    return this.deps.kontext.pruefe(b.nutzer, b.kontext, "rueckgabe");
  }

  /** Das gespeicherte Ergebnis ohne Inhalt — die ursprüngliche Wirkung wird nicht wiederholt. */
  private gesperrteRueckgabe(
    ergebnis: Faehigkeitsergebnis,
    sperre: Voraussetzung,
  ): Faehigkeitsergebnis {
    return {
      ...ergebnis,
      stand: "gesperrt",
      eintraege: [],
      verworfen: 0,
      fremdeAnweisungen: 0,
      wirkungKennung: null,
      meldung: sperre.text,
      voraussetzungen: [sperre],
      wiederholt: true,
    };
  }

  /** Die eigenen Aufträge, neueste zuerst — jedes Ergebnis erst nach aktueller Rechteprüfung. */
  async auftraege(nutzer: string): Promise<readonly AuftragsSicht[]> {
    const liste = [...(await this.deps.ablage.liste(nutzer))].sort((a, b) =>
      b.seit.localeCompare(a.seit),
    );
    const out: AuftragsSicht[] = [];
    for (const e of liste) {
      out.push(await this.sicht(e));
    }
    return out;
  }

  /** Ein eigener Auftrag — oder `null`, wenn es ihn für dieses Konto nicht gibt. */
  async auftrag(nutzer: string, auftragId: string): Promise<AuftragsSicht | null> {
    const e = (await this.deps.ablage.liste(nutzer)).find((x) => x.auftragId === auftragId);
    return e ? this.sicht(e) : null;
  }

  private async sicht(e: AuftragsEintrag): Promise<AuftragsSicht> {
    let ergebnis = e.ergebnis;
    if (ergebnis) {
      const sperre = await this.rueckgabeSperre(e.bindung);
      if (sperre) {
        ergebnis = { ...this.gesperrteRueckgabe(ergebnis, sperre), wiederholt: false };
      }
    }
    return {
      auftragId: e.auftragId,
      zustand: e.zustand === "laeuft" && !this.lebt(e) ? "wartet" : e.zustand,
      faehigkeitId: e.bindung.faehigkeitId,
      fassung: e.bindung.fassung,
      zweck: e.bindung.zweck,
      arbeitsbereich: e.bindung.arbeitsbereich,
      versuch: e.versuch,
      seit: e.seit,
      ergebnis,
    };
  }

  /** Alle registrierten Fähigkeiten mit ihrem JETZIGEN Stand für dieses Konto. */
  async uebersicht(wer: { mandant: string; nutzer: string }): Promise<readonly FaehigkeitsSicht[]> {
    const lage = await this.deps.lage(wer);
    const out: FaehigkeitsSicht[] = [];
    for (const e of this.deps.registry.liste()) {
      const v = e.vertrag;
      const offen = await this.voraussetzungen(e, lage);
      out.push({
        id: v.id,
        name: v.name,
        beschreibung: v.beschreibung,
        fassung: v.fassung,
        zwecke: v.zwecke,
        datenempfaenger: v.datenempfaenger,
        wirkung: v.wirkung,
        modell: v.modell,
        eingaben: v.eingaben,
        grenzen: v.grenzen,
        zugang: v.credential,
        ruecknahme: v.ruecknahme,
        verfuegbar: offen.length === 0,
        voraussetzungen: offen,
      });
    }
    return out;
  }

  private stempel(): string {
    return new Date(this.jetzt()).toISOString();
  }

  /** Ersetzt jeden bekannten Zugangswert; Protokollzeilen zusätzlich generisch bereinigt. */
  private ohneGeheimnis(text: string, geheimnisse: readonly string[]): string {
    let out = text;
    for (const g of geheimnisse) {
      if (g.length > 0) {
        out = out.split(g).join("[geheim]");
      }
    }
    return out;
  }

  private protokolliere(zeile: string, geheimnisse: readonly string[]): void {
    this.deps.protokoll?.(sanitizeLogText(this.ohneGeheimnis(zeile, geheimnisse), {}));
  }

  /** Alles, was eine Fähigkeit JETZT, unabhängig von der Eingabe, am Laufen hindert. */
  private async voraussetzungen(
    e: RegistryEintrag,
    lage: FaehigkeitsLage,
  ): Promise<Voraussetzung[]> {
    const v = e.vertrag;
    const out: Voraussetzung[] = [];
    if (!e.aktiv) {
      out.push({ art: "deaktiviert", text: `${v.name} ist deaktiviert.` });
    }
    if (!e.adapter) {
      out.push({
        art: "adapter",
        text: `Für ${v.name} ist kein geprüfter Adapter installiert; eine abgelegte Skilldatei reicht nicht.`,
      });
    } else if (e.adapter.fassung !== v.fassung) {
      out.push({
        art: "adapterfassung",
        text: `Der Adapter für ${v.name} trägt Fassung ${e.adapter.fassung}, der Vertrag ${v.fassung}.`,
      });
    }
    if (v.credential !== null && this.deps.geheimnisse.hole(v.credential) === null) {
      out.push({
        art: "credential",
        text: `Der Zugang ${v.credential} ist im sicheren Credentialweg nicht hinterlegt.`,
      });
    }
    const kosten = v.grenzen.kostenJeAufrufCent;
    if (kosten === null) {
      out.push({
        art: "budget",
        text: `Die Kosten je Aufruf von ${v.name} sind nicht belegt; ohne geklärtes Budget startet kein Aufruf.`,
      });
    } else if (kosten > 0) {
      const rest =
        v.kostenzuordnung && this.deps.kostenbuch
          ? await this.deps.kostenbuch.rest(v.kostenzuordnung)
          : null;
      if (rest === null || rest < kosten) {
        out.push({
          art: "budget",
          text: `Für ${v.name} ist kein ausreichendes zugeordnetes Budget vorhanden.`,
        });
      }
    }
    out.push(...pruefeSchritt(v.datenempfaenger, v.modell, v.hoechsteSchutzstufe, lage, null, []));
    for (const u of v.unterschritte) {
      for (const s of pruefeSchritt(
        u.datenempfaenger,
        u.modell,
        v.hoechsteSchutzstufe,
        lage,
        null,
        [],
      )) {
        if (!out.some((o) => o.art === s.art && o.text === s.text)) {
          out.push(s);
        }
      }
    }
    return out;
  }

  /** Wählt nach ausdrücklicher Wahl oder Zweck — nie still auf eine andere Fähigkeit. */
  async waehle(auftrag: Faehigkeitsauftrag): Promise<Auswahl> {
    const lage = await this.deps.lage({ mandant: auftrag.mandant, nutzer: auftrag.nutzer });
    const { registry } = this.deps;
    if (auftrag.gewaehlt !== null) {
      const e = registry.eintrag(auftrag.gewaehlt);
      if (!e) {
        return {
          art: "unverfuegbar",
          faehigkeitId: auftrag.gewaehlt,
          erklaerung: `Die gewählte Fähigkeit „${auftrag.gewaehlt}" ist nicht registriert. Es wird keine andere verwendet.`,
          voraussetzungen: [{ art: "registrierung", text: "Nicht registriert." }],
        };
      }
      const offen = await this.voraussetzungen(e, lage);
      if (offen.length > 0) {
        return {
          art: "unverfuegbar",
          faehigkeitId: e.vertrag.id,
          erklaerung: `${e.vertrag.name} ist gerade nicht verfügbar: ${offen.map((o) => o.text).join(" ")} Es wird keine andere Fähigkeit verwendet.`,
          voraussetzungen: offen,
        };
      }
      return { art: "faehigkeit", eintrag: e, grund: "gewaehlt" };
    }
    const passend = registry.liste().filter((e) => e.vertrag.zwecke.includes(auftrag.zweck));
    const bereit: RegistryEintrag[] = [];
    const offen: Voraussetzung[] = [];
    for (const e of passend) {
      const o = await this.voraussetzungen(e, lage);
      if (o.length === 0) {
        bereit.push(e);
      } else {
        offen.push(...o);
      }
    }
    const [einzige] = bereit;
    if (bereit.length === 1 && einzige) {
      return { art: "faehigkeit", eintrag: einzige, grund: "zweck" };
    }
    if (bereit.length > 1) {
      return {
        art: "mehrere",
        kandidaten: bereit.map((e) => e.vertrag.id),
        erklaerung: "Mehrere Fähigkeiten passen. Bitte eine auswählen.",
      };
    }
    return {
      art: "unverfuegbar",
      faehigkeitId: null,
      erklaerung:
        passend.length === 0
          ? `Für „${auftrag.zweck}" gibt es keine registrierte Fähigkeit.`
          : `Für „${auftrag.zweck}" ist gerade keine Fähigkeit verfügbar: ${offen.map((o) => o.text).join(" ")}`,
      voraussetzungen: offen,
    };
  }

  private pruefeEingabe(
    v: Faehigkeitsvertrag,
    roh: Readonly<Record<string, unknown>>,
  ): { eingabe: Record<string, string> } | { fehler: string } {
    const eingabe: Record<string, string> = {};
    for (const name of Object.keys(roh)) {
      if (!v.eingaben.some((f) => f.name === name)) {
        return { fehler: `Die Eingabe „${name}" ist für ${v.name} nicht erlaubt.` };
      }
    }
    for (const f of v.eingaben) {
      const wert = roh[f.name];
      if (wert === undefined || wert === null || wert === "") {
        if (f.pflicht) {
          return { fehler: `Die Eingabe „${f.name}" fehlt.` };
        }
        continue;
      }
      if (typeof wert !== "string") {
        return { fehler: `Die Eingabe „${f.name}" muss Text sein.` };
      }
      const t = wert.trim();
      if ([...t].length > f.maxLaenge) {
        return { fehler: `Die Eingabe „${f.name}" ist länger als ${f.maxLaenge} Zeichen.` };
      }
      eingabe[f.name] = t;
    }
    return { eingabe };
  }

  private async routineOffen(
    nutzer: string,
    e: RegistryEintrag,
    zweck: string,
  ): Promise<Voraussetzung | null> {
    const liste = this.deps.vormerkungen ? await this.deps.vormerkungen.liste(nutzer) : [];
    const ok = liste.some(
      (x) =>
        x.gueltig &&
        x.vormerkung.art === "routine" &&
        x.vormerkung.faehigkeitId === e.vertrag.id &&
        (x.vormerkung.zweck === null || x.vormerkung.zweck === zweck),
    );
    return ok
      ? null
      : {
          art: "routine",
          text: `Für ${e.vertrag.name} gibt es keine aktive, bestätigte Routine zu dieser Fassung.`,
        };
  }

  /** Wahl, Eingabeprüfung und Bindung VOR jeder Ausführung; die Vorschau nennt Zugangsnamen, nie Werte. */
  async bereiteVor(auftrag: Faehigkeitsauftrag): Promise<Vorbereitung> {
    const auswahl = await this.waehle(auftrag);
    if (auswahl.art === "mehrere") {
      return {
        art: "offen",
        stand: "mehrere",
        erklaerung: auswahl.erklaerung,
        voraussetzungen: [],
        kandidaten: auswahl.kandidaten,
      };
    }
    if (auswahl.art === "unverfuegbar") {
      const gesperrt = auswahl.voraussetzungen.some((o) => SPERR_ARTEN.includes(o.art));
      return {
        art: "offen",
        stand: gesperrt
          ? "gesperrt"
          : auswahl.voraussetzungen.some((o) => o.art !== "registrierung")
            ? "voraussetzung_fehlt"
            : "unverfuegbar",
        erklaerung: auswahl.erklaerung,
        voraussetzungen: auswahl.voraussetzungen,
        kandidaten: [],
      };
    }
    const e = auswahl.eintrag;
    const v = e.vertrag;
    const geprueft = this.pruefeEingabe(v, auftrag.eingabe);
    if ("fehler" in geprueft) {
      return {
        art: "offen",
        stand: "voraussetzung_fehlt",
        erklaerung: geprueft.fehler,
        voraussetzungen: [{ art: "eingabe", text: geprueft.fehler }],
        kandidaten: [],
      };
    }
    const lage = await this.deps.lage({ mandant: auftrag.mandant, nutzer: auftrag.nutzer });
    const sperren = pruefeSchritt(
      v.datenempfaenger,
      v.modell,
      v.hoechsteSchutzstufe,
      lage,
      geprueft.eingabe,
      auftrag.kontext,
    ).filter((s) => SPERR_ARTEN.includes(s.art));
    if (auftrag.ausloeser === "routine") {
      const r = await this.routineOffen(auftrag.nutzer, e, auftrag.zweck);
      if (r) {
        sperren.push(r);
      }
    }
    if (sperren.length > 0) {
      return {
        art: "offen",
        stand: "gesperrt",
        erklaerung: sperren.map((s) => s.text).join(" "),
        voraussetzungen: sperren,
        kandidaten: [],
      };
    }
    const bindung: Faehigkeitsbindung = {
      auftragId: auftrag.auftragId,
      mandant: auftrag.mandant,
      nutzer: auftrag.nutzer,
      sitzung: auftrag.sitzung,
      arbeitsbereich: auftrag.arbeitsbereich,
      zweck: auftrag.zweck,
      ausloeser: auftrag.ausloeser,
      faehigkeitId: v.id,
      fassung: v.fassung,
      vertragsFingerabdruck: e.fingerabdruck,
      adapterFassung: e.adapter?.fassung ?? "",
      eingabe: geprueft.eingabe,
      aktionen: [...v.aktionen],
      datenweg: datenwegText(v),
      ergebnisform: v.ergebnis,
      kontext: auftrag.kontext.map((k) => ({
        kennung: k.kennung,
        fassung: k.fassung,
        schutz: k.schutz,
      })),
      gebundenAm: this.stempel(),
    };
    const vorschau = [
      `${v.name} (Fassung ${v.fassung})`,
      `Datenweg: ${bindung.datenweg}`,
      `Wirkung: ${v.wirkung === "lesen" ? "nur lesen" : "legt einen Entwurf an (verwerfbar)"}`,
      `Eingabe: ${Object.entries(geprueft.eingabe)
        .map(([k, w]) => `${k} = ${w}`)
        .join(", ")}`,
      `Grenzen: höchstens ${v.grenzen.maxTreffer} Treffer, ${Math.round(v.grenzen.zeitlimitMs / 1000)} s, ${v.grenzen.kostenJeAufrufCent ?? "?"} Cent je Aufruf`,
      v.credential ? `Zugang: ${v.credential} (hinterlegt)` : "Zugang: keiner nötig",
    ].join("\n");
    return { art: "gebunden", bindung, vorschau };
  }

  private ergebnis(b: Faehigkeitsbindung, teil: ErgebnisTeil): Faehigkeitsergebnis {
    return {
      auftragId: b.auftragId,
      faehigkeitId: b.faehigkeitId,
      fassung: b.fassung,
      vertragsFingerabdruck: b.vertragsFingerabdruck,
      eintraege: [],
      verworfen: 0,
      fremdeAnweisungen: 0,
      voraussetzungen: [],
      verbrauchCent: null,
      transport: null,
      wirkungKennung: null,
      ruecklink: { arbeitsbereich: b.arbeitsbereich, auftragId: b.auftragId },
      wiederholt: false,
      versuch: 0,
      abgeschlossenAm: this.stempel(),
      ...teil,
    };
  }

  /**
   * Bricht einen eigenen wartenden oder laufenden Auftrag ab. Der Abbruch wird DAUERHAFT vermerkt:
   * ein wartender Auftrag startet nicht mehr (auch nicht nach Neustart oder in einem anderen
   * Prozess), ein laufender startet keinen abhängigen Unterschritt. `false`, wenn es keinen offenen
   * eigenen Auftrag dieser Kennung gibt.
   */
  async brecheAb(nutzer: string, auftragId: string): Promise<boolean> {
    const vermerkt = await this.aendereAuftraege<boolean>(nutzer, (liste) => {
      const e = liste.find((x) => x.auftragId === auftragId);
      if (!e || e.zustand === "fertig") {
        return { neu: null, wert: false };
      }
      if (e.abbruch) {
        return { neu: null, wert: true };
      }
      return {
        neu: liste.map((x) => (x.auftragId === auftragId ? { ...x, abbruch: true } : x)),
        wert: true,
      };
    });
    const c = this.laufend.get(FaehigkeitsAusfuehrung.schluessel(nutzer, auftragId));
    if (c) {
      c.abort();
      return true;
    }
    return vermerkt;
  }

  /** Steht für diesen Auftrag ein dauerhafter Abbruch? */
  private async abbruchVermerkt(nutzer: string, auftragId: string): Promise<boolean> {
    return (await this.deps.ablage.liste(nutzer)).some(
      (x) => x.auftragId === auftragId && x.abbruch === true,
    );
  }

  /**
   * Hintergrundjob: die Bindung wird DAUERHAFT als `wartet` abgelegt und später — auch nach einem
   * Neustart — mit der DANN gültigen Lage und den DANN gültigen Rechten ausgeführt.
   */
  async starteImHintergrund(
    bindung: Faehigkeitsbindung,
  ): Promise<{ auftragId: string; stand: AuftragsZustand | "anderer_auftrag" }> {
    const fingerabdruck = bindungsFingerabdruck(bindung);
    const stempel = this.stempel();
    const stand = await this.aendereAuftraege<AuftragsZustand | "anderer_auftrag">(
      bindung.nutzer,
      (liste) => {
        const e = liste.find((x) => x.auftragId === bindung.auftragId);
        if (e) {
          return {
            neu: null,
            wert: e.fingerabdruck === fingerabdruck ? e.zustand : "anderer_auftrag",
          };
        }
        const neu: AuftragsEintrag = {
          auftragId: bindung.auftragId,
          fingerabdruck,
          bindung,
          zustand: "wartet",
          versuch: 0,
          instanz: null,
          seit: stempel,
          ergebnis: null,
        };
        return { neu: [...liste, neu], wert: "wartet" };
      },
    );
    return { auftragId: bindung.auftragId, stand };
  }

  /**
   * Arbeitet wartende und unterbrochene Aufträge ALLER Konten aus der dauerhaften Ablage ab — beim
   * Start und im Takt (`server.ts`). Läuft schon eine Abarbeitung, wird auf sie gewartet.
   */
  arbeiteWarteschlangeAb(): Promise<readonly Faehigkeitsergebnis[]> {
    if (!this.abarbeitung) {
      this.abarbeitung = this.arbeiteAb().finally(() => {
        this.abarbeitung = null;
      });
    }
    return this.abarbeitung;
  }

  private async arbeiteAb(): Promise<readonly Faehigkeitsergebnis[]> {
    const out: Faehigkeitsergebnis[] = [];
    for (const konto of await this.deps.ablage.kontenMitOffenenAuftraegen()) {
      for (const e of await this.deps.ablage.liste(konto)) {
        if (e.zustand === "wartet" || (e.zustand === "laeuft" && !this.lebt(e))) {
          out.push(await this.fuehreAus(e.bindung));
        }
      }
    }
    return out;
  }

  /** Führt eine gebundene Fähigkeit aus. Jede Prüfung gilt am Ausführungszeitpunkt erneut. */
  async fuehreAus(bindung: Faehigkeitsbindung): Promise<Faehigkeitsergebnis> {
    const e = this.deps.registry.eintrag(bindung.faehigkeitId);
    if (!e) {
      return this.ergebnis(bindung, {
        stand: "unverfuegbar",
        meldung: "Die gebundene Fähigkeit ist nicht mehr registriert.",
        voraussetzungen: [{ art: "registrierung", text: "Nicht registriert." }],
      });
    }
    if (
      e.fingerabdruck !== bindung.vertragsFingerabdruck ||
      e.vertrag.fassung !== bindung.fassung
    ) {
      return this.ergebnis(bindung, {
        stand: "voraussetzung_fehlt",
        meldung: `${e.vertrag.name} wurde seit der Vorschau geändert (jetzt Fassung ${e.vertrag.fassung}). Bitte neu vorbereiten.`,
        voraussetzungen: [{ art: "fassung_geaendert", text: "Vertrag geändert." }],
      });
    }
    const v = e.vertrag;
    // Die Bindung ist ein Objekt in fremder Hand — Eingabe, Aktionen und Ergebnisform noch einmal
    // gegen den aktuellen Vertrag, nicht gegen sich selbst.
    const geprueft = this.pruefeEingabe(v, bindung.eingabe);
    const formGleich =
      kanonisch(bindung.ergebnisform) === kanonisch(v.ergebnis) &&
      kanonisch(bindung.aktionen) === kanonisch(v.aktionen);
    if ("fehler" in geprueft || !formGleich) {
      return this.ergebnis(bindung, {
        stand: "voraussetzung_fehlt",
        meldung: "fehler" in geprueft ? geprueft.fehler : "Die Bindung passt nicht zum Vertrag.",
        voraussetzungen: [{ art: "eingabe", text: "Bindung ungültig." }],
      });
    }

    const anspruch = await this.beanspruche(bindung, bindungsFingerabdruck(bindung));
    if (anspruch.art === "anderer_auftrag") {
      return this.ergebnis(bindung, {
        stand: "gesperrt",
        meldung: "Diese Auftragskennung gehört zu einem anderen Auftrag.",
      });
    }
    if (anspruch.art === "laeuft") {
      return this.ergebnis(bindung, {
        stand: "laeuft",
        meldung: "Dieser Auftrag läuft bereits.",
        abgeschlossenAm: null,
      });
    }
    if (anspruch.art === "vorhanden") {
      // G04/G05: eine Wiederholung liefert das gespeicherte Ergebnis nur nach AKTUELLER
      // Rechteprüfung; ist ein Recht entzogen, bleibt der Inhalt gesperrt — ohne die Wirkung neu
      // auszulösen und ohne den gespeicherten Stand zu verändern.
      const sperre = await this.rueckgabeSperre(anspruch.bindung);
      if (sperre) {
        return this.gesperrteRueckgabe(anspruch.ergebnis, sperre);
      }
      return { ...anspruch.ergebnis, wiederholt: true };
    }
    if (anspruch.art === "abgebrochen") {
      const r = this.ergebnis(bindung, {
        stand: "abgebrochen",
        meldung: "Der Auftrag wurde abgebrochen, bevor er startete; es wurde nichts ausgeführt.",
        versuch: anspruch.versuch,
      });
      await this.schreibeErgebnis(bindung.nutzer, r);
      return r;
    }
    const versuch = anspruch.versuch;
    const wiederaufnahme = anspruch.wiederaufnahme;

    const geheimnis = v.credential !== null ? this.deps.geheimnisse.hole(v.credential) : null;
    const verdeckt = geheimnis ? [geheimnis] : [];
    const abschluss = async (teil: ErgebnisTeil): Promise<Faehigkeitsergebnis> => {
      const r = this.ergebnis(bindung, {
        ...teil,
        meldung: this.ohneGeheimnis(teil.meldung, verdeckt),
        versuch,
      });
      await this.schreibeErgebnis(bindung.nutzer, r);
      this.protokolliere(
        `faehigkeit ${v.id}@${v.fassung} auftrag ${bindung.auftragId} versuch ${versuch}${wiederaufnahme ? " wiederaufnahme" : ""} stand ${r.stand}`,
        verdeckt,
      );
      return r;
    };

    const lage = await this.deps.lage({ mandant: bindung.mandant, nutzer: bindung.nutzer });
    const offen = await this.voraussetzungen(e, lage);
    // Die Kontexttexte liegen nicht in der Bindung; die Inhaltsprüfung lief in `bereiteVor`. Hier
    // gelten erneut alle eingabeunabhängigen Sperren und Voraussetzungen — und die AKTUELLEN Rechte
    // an Konto und Kontext samt gebundener Kontextfassung (G04), auch im Hintergrund.
    if (this.deps.kontext) {
      const k = await this.deps.kontext.pruefe(bindung.nutzer, bindung.kontext, "ausfuehrung");
      if (k) {
        offen.push(k);
      }
    }
    if (bindung.ausloeser === "routine") {
      const r = await this.routineOffen(bindung.nutzer, e, bindung.zweck);
      if (r) {
        offen.push(r);
      }
    }
    if (offen.length > 0) {
      const gesperrt = offen.some((o) => SPERR_ARTEN.includes(o.art) || o.art === "routine");
      return abschluss({
        stand: gesperrt ? "gesperrt" : "voraussetzung_fehlt",
        meldung: offen.map((o) => o.text).join(" "),
        voraussetzungen: offen,
      });
    }

    const adapter = e.adapter;
    if (!adapter) {
      return abschluss({ stand: "voraussetzung_fehlt", meldung: "Kein Adapter installiert." });
    }
    // Ein Abbruch, der nach dem Beanspruchen dauerhaft vermerkt wurde, gilt vor jeder Wirkung.
    if (await this.abbruchVermerkt(bindung.nutzer, bindung.auftragId)) {
      return abschluss({
        stand: "abgebrochen",
        meldung: "Der Auftrag wurde abgebrochen, bevor er startete; es wurde nichts ausgeführt.",
      });
    }
    // produkt:20261013:produktbudget-anwender-admin (PBE-06/07): die Kosten dieses Aufrufs ATOMAR
    // gegen den Deckel reservieren, gebunden an Anbieter und Tarifwährung. Ohne Reservierung keine
    // Wirkung. Eine Reservierung bleibt nach Fehler oder Zeitlimit bestehen: ob der Anbieter
    // abgerechnet hat, ist dann unbekannt, und Unbekanntes zählt gegen den Deckel.
    const vorab = v.grenzen.kostenJeAufrufCent;
    const reserviere = this.deps.kostenbuch?.reserviere?.bind(this.deps.kostenbuch);
    if (vorab !== null && vorab > 0 && v.kostenzuordnung && reserviere) {
      // Ein Fehler der Ablage ist kein Ja: ohne bestätigte Reservierung keine Wirkung.
      const reserviert = await reserviere({
        zuordnung: v.kostenzuordnung,
        cent: vorab,
        nutzer: bindung.nutzer,
        auftragId: bindung.auftragId,
        versuch,
        anbieter: v.datenempfaenger.art === "extern" ? v.datenempfaenger.anbieter : null,
        waehrung: v.grenzen.kostenWaehrung ?? null,
      }).catch(() => false);
      if (!reserviert) {
        const text = `Für ${v.name} ist kein ausreichendes, an Anbieter und Währung gebundenes Budget vorhanden; es wurde nichts ausgeführt.`;
        return abschluss({
          stand: "voraussetzung_fehlt",
          meldung: text,
          voraussetzungen: [{ art: "budget", text }],
        });
      }
    }
    const steuerung = new AbortController();
    const laufSchluessel = FaehigkeitsAusfuehrung.schluessel(bindung.nutzer, bindung.auftragId);
    this.laufend.set(laufSchluessel, steuerung);
    const kontext: AdapterKontext = {
      auftragId: bindung.auftragId,
      signal: steuerung.signal,
      geheimnis: () => geheimnis,
      unterschritt: async <T>(
        id: string,
        arbeit: () => Promise<T>,
        daten?: Readonly<Record<string, string>>,
      ): Promise<T> => {
        if (steuerung.signal.aborted) {
          throw new Abgebrochen();
        }
        const u = v.unterschritte.find((x) => x.id === id);
        if (!u) {
          throw new SchrittGesperrt([
            { art: "registrierung", text: `Unterschritt „${id}" ist im Vertrag nicht deklariert.` },
          ]);
        }
        // Ein dauerhafter Abbruch (auch aus einem anderen Prozess) stoppt jeden abhängigen Schritt.
        if (await this.abbruchVermerkt(bindung.nutzer, bindung.auftragId)) {
          steuerung.abort();
          throw new Abgebrochen();
        }
        const jetzt = await this.deps.lage({ mandant: bindung.mandant, nutzer: bindung.nutzer });
        const sperren: Voraussetzung[] = [];
        // G04/G05: die AKTUELLEN Konto- und Kontextrechte und die gebundenen Kontextfassungen —
        // ein Rechteentzug während des Adapters sperrt den folgenden Unterschritt.
        if (this.deps.kontext) {
          const k = await this.deps.kontext.pruefe(bindung.nutzer, bindung.kontext, "ausfuehrung");
          if (k) {
            sperren.push(k);
          }
        }
        // Die TATSÄCHLICH weitergegebenen Daten gegen die Grenzen genau dieses Empfängers: ohne
        // Angabe die gebundene Eingabe. Geprüft wird gegen den aktuellen Kontextinhalt; lässt er
        // sich für einen externen Empfänger nicht laden, geht nichts hinaus.
        const weiter = daten ?? bindung.eingabe;
        let texte: readonly KontextTeil[] = [];
        if (u.datenempfaenger.art === "extern" && bindung.kontext.length > 0) {
          const laden = this.deps.kontext?.lade?.bind(this.deps.kontext);
          const geladen = laden ? await laden(bindung.nutzer, bindung.kontext) : null;
          if (geladen === null) {
            sperren.push({
              art: "vertraulich",
              text: `Der Arbeitsbereichskontext ist für die Prüfung nicht verfügbar; nichts geht an ${u.datenempfaenger.anbieterName}.`,
            });
          } else {
            texte = geladen;
          }
        }
        sperren.push(
          ...pruefeSchritt(
            u.datenempfaenger,
            u.modell,
            v.hoechsteSchutzstufe,
            jetzt,
            weiter,
            texte,
          ),
        );
        if (sperren.length > 0) {
          throw new SchrittGesperrt(sperren);
        }
        return arbeit();
      },
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    let antwort: AdapterAntwort;
    try {
      const frist = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // Erst die Frist melden, dann abbrechen — sonst gewinnt der Abbruch das Rennen.
          reject(new Zeitlimit());
          steuerung.abort();
        }, v.grenzen.zeitlimitMs);
      });
      const abbruch = new Promise<never>((_, reject) => {
        steuerung.signal.addEventListener("abort", () => reject(new Abgebrochen()), { once: true });
      });
      antwort = await Promise.race([adapter.fuehreAus(geprueft.eingabe, kontext), frist, abbruch]);
    } catch (fehler) {
      if (fehler instanceof Zeitlimit) {
        return abschluss({
          stand: "fehlgeschlagen",
          meldung: `${v.name} hat das Zeitlimit überschritten; es gibt kein Ergebnis.`,
          transport: adapter.transport,
        });
      }
      if (fehler instanceof Abgebrochen) {
        return abschluss({
          stand: "abgebrochen",
          meldung: "Der Auftrag wurde abgebrochen; abhängige Schritte liefen nicht.",
          transport: adapter.transport,
        });
      }
      if (fehler instanceof SchrittGesperrt) {
        const gesperrt = fehler.voraussetzungen.some((o) => SPERR_ARTEN.includes(o.art));
        return abschluss({
          stand: gesperrt ? "gesperrt" : "voraussetzung_fehlt",
          meldung: fehler.voraussetzungen.map((o) => o.text).join(" "),
          voraussetzungen: fehler.voraussetzungen,
          transport: adapter.transport,
        });
      }
      const roh = fehler instanceof Error ? fehler.message : String(fehler);
      return abschluss({
        stand: "fehlgeschlagen",
        meldung: `${v.name} ist fehlgeschlagen: ${roh}`,
        transport: adapter.transport,
      });
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      this.laufend.delete(laufSchluessel);
    }

    // Werkzeugantwort = Daten. Nur deklarierte Felder als Text, Quellenpflicht, Trefferkappe.
    const eintraege: Record<string, string>[] = [];
    let verworfen = 0;
    let fremde = 0;
    for (const roh of Array.isArray(antwort.eintraege) ? antwort.eintraege : []) {
      if (eintraege.length >= v.grenzen.maxTreffer) {
        break;
      }
      if (roh === null || typeof roh !== "object") {
        verworfen += 1;
        continue;
      }
      const quelle = roh as Record<string, unknown>;
      const eintrag: Record<string, string> = {};
      for (const feld of v.ergebnis.felder) {
        const wert = quelle[feld];
        if (typeof wert === "string") {
          eintrag[feld] = this.ohneGeheimnis(wert, verdeckt);
        }
      }
      if (v.ergebnis.quellenPflicht && !/^https?:\/\/[^\s]+$/.test(eintrag.url ?? "")) {
        verworfen += 1;
        continue;
      }
      if (Object.values(eintrag).some(enthaeltFremdeAnweisung)) {
        fremde += 1;
      }
      eintraege.push(eintrag);
    }
    const stand: AusfuehrungsStand =
      antwort.status === "fehler"
        ? eintraege.length > 0
          ? "teilweise"
          : "fehlgeschlagen"
        : antwort.status === "teilweise" || verworfen > 0
          ? "teilweise"
          : "erfolgreich";
    const kosten =
      typeof antwort.verbrauchCent === "number" && antwort.verbrauchCent >= 0
        ? antwort.verbrauchCent
        : (v.grenzen.kostenJeAufrufCent ?? null);
    if (kosten !== null && kosten > 0 && v.kostenzuordnung && this.deps.kostenbuch) {
      await this.deps.kostenbuch.verbuche(v.kostenzuordnung, kosten, bindung.auftragId, {
        nutzer: bindung.nutzer,
        versuch,
      });
    }
    const meldung =
      stand === "erfolgreich"
        ? `${v.name}: ${eintraege.length} Ergebnis(se).`
        : stand === "teilweise"
          ? `${v.name}: nur ein Teilergebnis (${eintraege.length} übernommen, ${verworfen} verworfen)${antwort.meldung ? ` — ${antwort.meldung}` : ""}.`
          : `${v.name} ist fehlgeschlagen${antwort.meldung ? `: ${antwort.meldung}` : "."}`;
    return abschluss({
      stand,
      meldung,
      eintraege,
      verworfen,
      fremdeAnweisungen: fremde,
      verbrauchCent: kosten,
      transport: adapter.transport,
      wirkungKennung: typeof antwort.wirkungKennung === "string" ? antwort.wirkungKennung : null,
    });
  }
}

// ------------------------------------------------------------------------------------------------
// PERSÖNLICHE FAVORITEN UND BESTÄTIGTE ROUTINEN — IM VORHANDENEN ASSISTENZPROFIL
// ------------------------------------------------------------------------------------------------

export interface FaehigkeitsVormerkung {
  readonly faehigkeitId: string;
  readonly art: "favorit" | "routine";
  readonly zweck: string | null;
  readonly fassung: string;
  readonly vertragsFingerabdruck: string;
  readonly bestaetigtAm: string | null;
  readonly aktiv: boolean;
  readonly gespeichertAm: string;
}

export class FaehigkeitsVormerkungFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "FaehigkeitsVormerkungFehler";
  }
}

export class FaehigkeitsVormerkungen {
  private readonly jetzt: () => number;

  constructor(
    private readonly deps: {
      readonly profile: AssistenzProfilRepo;
      readonly registry: Faehigkeitsregistry;
      readonly jetzt?: () => number;
    },
  ) {
    this.jetzt = deps.jetzt ?? Date.now;
  }

  private async aendere(
    kontoId: string,
    f: (alt: readonly FaehigkeitsVormerkung[]) => FaehigkeitsVormerkung[],
  ): Promise<void> {
    for (let versuch = 0; versuch < 2; versuch++) {
      const alt = await this.deps.profile.hole(kontoId);
      const stempel = new Date(this.jetzt()).toISOString();
      const basis: AssistenzProfil = alt ?? {
        kontoId,
        name: null,
        avatar: null,
        bewegung: "standard",
        eingerichtetAm: null,
        fassung: 0,
        geaendertAm: stempel,
      };
      const neu: AssistenzProfil = {
        ...basis,
        faehigkeiten: f(basis.faehigkeiten ?? []),
        fassung: basis.fassung + 1,
        geaendertAm: stempel,
      };
      if (await this.deps.profile.schreibe(neu)) {
        return;
      }
    }
    throw new FaehigkeitsVormerkungFehler(409, "Das Profil wurde gleichzeitig geändert.");
  }

  /** Speichert einen Favoriten oder eine ausdrücklich bestätigte Routine zur aktuellen Fassung. */
  async speichere(
    kontoId: string,
    eingabe: {
      faehigkeitId: string;
      art: "favorit" | "routine";
      zweck?: string | null;
      bestaetigt?: boolean;
    },
  ): Promise<FaehigkeitsVormerkung> {
    const e = this.deps.registry.eintrag(eingabe.faehigkeitId);
    if (!e) {
      throw new FaehigkeitsVormerkungFehler(404, "Diese Fähigkeit ist nicht registriert.");
    }
    if (eingabe.art === "routine" && eingabe.bestaetigt !== true) {
      throw new FaehigkeitsVormerkungFehler(
        400,
        "Eine Routine läuft nur nach ausdrücklicher Bestätigung.",
      );
    }
    const stempel = new Date(this.jetzt()).toISOString();
    const vm: FaehigkeitsVormerkung = {
      faehigkeitId: e.vertrag.id,
      art: eingabe.art,
      zweck: eingabe.zweck ?? null,
      fassung: e.vertrag.fassung,
      vertragsFingerabdruck: e.fingerabdruck,
      bestaetigtAm: eingabe.art === "routine" ? stempel : null,
      aktiv: true,
      gespeichertAm: stempel,
    };
    await this.aendere(kontoId, (alt) => [
      ...alt.filter((x) => !(x.faehigkeitId === vm.faehigkeitId && x.art === vm.art)),
      vm,
    ]);
    return vm;
  }

  /** Die eigenen Vormerkungen mit ehrlichem Stand gegen die aktuelle Registry. */
  async liste(
    kontoId: string,
  ): Promise<readonly { vormerkung: FaehigkeitsVormerkung; gueltig: boolean; hinweis: string }[]> {
    const p = await this.deps.profile.hole(kontoId);
    return (p?.faehigkeiten ?? []).map((vm) => {
      const e = this.deps.registry.eintrag(vm.faehigkeitId);
      const hinweis = !vm.aktiv
        ? "Deaktiviert."
        : !e
          ? "Die Fähigkeit ist nicht mehr registriert."
          : !e.aktiv
            ? "Die Fähigkeit ist administrativ deaktiviert."
            : e.fingerabdruck !== vm.vertragsFingerabdruck
              ? "Die Fähigkeit wurde geändert; bitte neu bestätigen."
              : "Bereit.";
      return { vormerkung: vm, gueltig: hinweis === "Bereit.", hinweis };
    });
  }

  async deaktiviere(kontoId: string, faehigkeitId: string): Promise<void> {
    const p = await this.deps.profile.hole(kontoId);
    if (!(p?.faehigkeiten ?? []).some((x) => x.faehigkeitId === faehigkeitId)) {
      throw new FaehigkeitsVormerkungFehler(404, "Keine Vormerkung zu dieser Fähigkeit.");
    }
    await this.aendere(kontoId, (alt) =>
      alt.map((x) => (x.faehigkeitId === faehigkeitId ? { ...x, aktiv: false } : x)),
    );
  }
}

// ------------------------------------------------------------------------------------------------
// PRODUKTVERTRÄGE UND ADAPTER
// ------------------------------------------------------------------------------------------------

/** Öffentliche Recherche über den vorhandenen, kostenfreien Wikipedia-Weg (external-search). */
export const WIKIPEDIA_SUCHE: Faehigkeitsvertrag = {
  id: "wikipedia-suche",
  fassung: "1.0.0",
  name: "Wikipedia-Suche",
  beschreibung: "Sucht öffentliche Artikel; liefert Titel, Adresse und Auszug als Quelle.",
  zwecke: ["oeffentliche_recherche"],
  datenempfaenger: {
    art: "extern",
    anbieter: "wikimedia",
    anbieterName: "Wikipedia (Wikimedia)",
    host: "wikipedia.org",
  },
  wirkung: "lesen",
  modell: false,
  aktionen: ["netz_anfrage_anbieter"],
  eingaben: [{ name: "suchbegriff", maxLaenge: 200, pflicht: true }],
  ergebnis: { art: "trefferliste", felder: ["titel", "url", "auszug"], quellenPflicht: true },
  hoechsteSchutzstufe: "oeffentlich",
  grenzen: { maxTreffer: 10, zeitlimitMs: 6_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Werkzeugverantwortung external-search",
};

/**
 * Der persönliche Perplexity-Skill als kontrollierte Produktfähigkeit (O09). Kosten je Aufruf und
 * Budgetzuordnung sind NICHT belegt — deshalb startet ohne Klärung kein Aufruf. Der Zugang liegt
 * ausschließlich im sicheren Credentialweg unter dem Namen `PERPLEXITY_API_KEY`.
 */
export const PERPLEXITY_SUCHE: Faehigkeitsvertrag = {
  id: "perplexity-suche",
  fassung: "1.0.0",
  name: "Perplexity-Suche",
  beschreibung: "Begrenzte Websuche über die Perplexity Search API; liefert Originalquellen.",
  zwecke: ["web_recherche"],
  datenempfaenger: {
    art: "extern",
    anbieter: "perplexity",
    anbieterName: "Perplexity",
    host: "api.perplexity.ai",
  },
  wirkung: "lesen",
  modell: true,
  aktionen: ["netz_anfrage_anbieter"],
  eingaben: [{ name: "suchbegriff", maxLaenge: 400, pflicht: true }],
  ergebnis: {
    art: "trefferliste",
    felder: ["titel", "url", "auszug", "datum"],
    quellenPflicht: true,
  },
  hoechsteSchutzstufe: "oeffentlich",
  grenzen: { maxTreffer: 5, zeitlimitMs: 15_000, kostenJeAufrufCent: null },
  kostenzuordnung: null,
  credential: "PERPLEXITY_API_KEY",
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Werkzeug-/KI-/Budgetverantwortung (O09)",
};

/** Adapter über einen vorhandenen `SearchProvider` (z. B. `createWikipediaProvider`). */
export function suchAdapter(
  vertrag: Faehigkeitsvertrag,
  provider: SearchProvider,
  transport: "echt" | "ersatz",
): FaehigkeitsAdapter {
  return {
    faehigkeitId: vertrag.id,
    fassung: vertrag.fassung,
    transport,
    async fuehreAus(eingabe) {
      try {
        const treffer = await provider.search(eingabe.suchbegriff ?? "");
        return {
          status: "ok",
          eintraege: treffer.map((t) => ({ titel: t.title, url: t.url, auszug: t.snippet })),
          verbrauchCent: 0,
        };
      } catch (fehler) {
        return {
          status: "fehler",
          eintraege: [],
          meldung: fehler instanceof Error ? fehler.message : "Die Suche ist fehlgeschlagen.",
        };
      }
    },
  };
}

export type PostFetch = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export const PERPLEXITY_SUCH_ENDPUNKT = "https://api.perplexity.ai/search";

/**
 * Kontrollierter Perplexity-Adapter. Der Zugang kommt nur aus `kontext.geheimnis()`; Fehlertexte
 * nennen nur den Status, nie Header oder Schlüssel. Mit injiziertem `fetchImpl` ist der Transport
 * `ersatz` — ein solcher Lauf belegt keine reale Anbieterwirkung.
 */
export function perplexitySuchAdapter(deps: { fetchImpl?: PostFetch } = {}): FaehigkeitsAdapter {
  const doFetch = deps.fetchImpl ?? (globalThis.fetch as unknown as PostFetch);
  return {
    faehigkeitId: PERPLEXITY_SUCHE.id,
    fassung: PERPLEXITY_SUCHE.fassung,
    transport: deps.fetchImpl ? "ersatz" : "echt",
    async fuehreAus(eingabe, kontext) {
      const schluessel = kontext.geheimnis();
      if (!schluessel) {
        return { status: "fehler", eintraege: [], meldung: "Zugang fehlt." };
      }
      let res: Awaited<ReturnType<PostFetch>>;
      try {
        res = await doFetch(PERPLEXITY_SUCH_ENDPUNKT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${schluessel}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            query: eingabe.suchbegriff ?? "",
            max_results: PERPLEXITY_SUCHE.grenzen.maxTreffer,
          }),
          signal: kontext.signal,
        });
      } catch {
        return { status: "fehler", eintraege: [], meldung: "Perplexity ist nicht erreichbar." };
      }
      if (!res.ok) {
        return {
          status: "fehler",
          eintraege: [],
          meldung: `Perplexity antwortete mit ${res.status}.`,
        };
      }
      let daten: unknown;
      try {
        daten = await res.json();
      } catch {
        return { status: "fehler", eintraege: [], meldung: "Die Antwort war nicht lesbar." };
      }
      const results = (daten as { results?: unknown }).results;
      if (!Array.isArray(results)) {
        return { status: "fehler", eintraege: [], meldung: "Die Antwort enthielt keine Treffer." };
      }
      return {
        status: "ok",
        eintraege: results.map((r) => {
          const x = (r ?? {}) as Record<string, unknown>;
          return { titel: x.title, url: x.url, auszug: x.snippet, datum: x.date };
        }),
      };
    },
  };
}
