import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type KnowledgeObject, isConfidential } from "../../knowledge-object";
import { can } from "../../rbac";
import type { SessionUser } from "./http";
import {
  KI_ERGEBNISFORMATE,
  type KiAdapter,
  type KiAntwortEintrag,
  type KiApiBindung,
  type KiArbeitsbereich,
  type KiAuftragEintrag,
  type KiAussage,
  type KiBelegEintrag,
  type KiCodexWirkungEintrag,
  type KiErgebnis,
  type KiFaehigkeit,
  type KiFaehigkeitsuebersicht,
  type KiFreigabelage,
  type KiJob,
  type KiPaketPruefung,
  type KiQuelle,
  type KiUebergabePruefung,
  type KiVergleichszeile,
  type KiWegErgebnis,
  baueKontextpaket,
  ersetzeJob,
  klassifiziereBeleg,
  nimmAntwortAn,
  nimmJobWiederAuf,
  pruefeAnbieterweg,
  pruefePaketAktuell,
  pruefeUebergabe,
  starteOderFindeJob,
  stoppeJob,
  unterbrecheJob,
  vergleicheKiErgebnisse,
  vermerkeFehler,
  vermerkeSendung,
  weiseFaehigkeitenAus,
} from "./ki-arbeitsbegleitung";
import { type KiCodexDatei, wendeCodexAenderungenAn } from "./ki-codex-arbeitsbereich";
import type { KlaraGespraech, KlaraGespraechDienst } from "./klara-gespraech";
import { KLARA_SINGLE_TENANT_ID } from "./services/klara-session-service";
import type { Sichtbarkeitsfilter } from "./sichtbarkeit";

// ================================================================================================
// BPA-13 · DER DURCHGÄNGIGE ARBEITSWEG IM PRODUKT
// (Nacharbeit 2, Ben: „Der neue Kern wird ausschließlich von Unit-Tests aufgerufen")
// ================================================================================================
//
// Hier wird der reine Kern (`ki-arbeitsbegleitung.ts`) an das angeschlossen, was es im Produkt
// bereits gibt — ohne zweite Assistenz, zweite Policy oder zweite Ablage:
//
//   · ARBEITSBEREICH = das eigene Klara-Gespräch (Konto aus der Sitzung, Gesprächskennung als
//     Sitzung, Objektbezug als Dokument, dessen führender Space als Projekt). Jobstand, Paket,
//     Antworten und Belege liegen im BESTEHENDEN Verlauf (`KlaraGespraech.kiAuftraege`), mit dem
//     Standvergleich des Gesprächs beim Schreiben.
//   · RECHTE = je Aufruf frisch: `ko.read` und die eine Sichtbarkeitsregel
//     (`KiBetrachter.sichtbar`, an der Route aus `sichtbarkeit.ts` gebildet), Einstufung aus
//     `confidentiality`/`oeffentlich`.
//   · DOKUMENTFREIGABE = je Auftrag ausdrücklich je Quelle erteilt; zurückgenommen heisst
//     „geschlossen" und bleibt es für diesen Auftrag.
//   · FREIGABEN = je Aufruf frisch aus dem Reasoner (`lage`): KI-Abschaltung → „Keine KI",
//     `kiFreigabe.oeffentlicheKi` und `.vertraulicheInhalte`.
//   · API-WEG = der Reasoner, an GENAU den gewählten Anbieter gebunden (`build-app.ts`:
//     `imBindungsrahmen` + `bindeAnbieter`) — ohne stillen Ausweichweg; Beleg aus dem
//     Laufprotokoll.
//   · CODEX = Übergabe des Prompts an Codex (manuell) und die tatsächliche, begrenzte Dateiwirkung
//     des zurückgegebenen Ergebnisses in einem eigenen Ordner je Auftrag.
//
// Vor JEDER Übergabe — Erstsendung, Wiederaufnahme, erneutes Senden, manuelle Übergabe und
// Codex-Wirkung — werden Weg und gebundenes Paket neu geprüft (`pruefeUebergabe`).

export type KiArbeitsbegleitungGrund =
  | "eingabe"
  | "unbekannt"
  | "gesperrt"
  | "paket_veraltet"
  | "nicht_uebergeben"
  | "nicht_eingerichtet"
  | "konflikt";

export class KiArbeitsbegleitungFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KiArbeitsbegleitungGrund,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "KiArbeitsbegleitungFehler";
  }
}

/** Das Ergebnis eines echten, gebundenen Laufs über den Reasoner. */
export interface KiApiErgebnis {
  readonly inhalt: string;
  /** Kennung des Laufs im Modelllauf-Protokoll — `null`, wenn er nicht eindeutig zuzuordnen war. */
  readonly laufId: string | null;
  readonly modell: string | null;
  /** Vom Anbieter gemeldeter Verbrauch — `null`, wenn keiner gemeldet wurde. */
  readonly verbrauch: { readonly einheit: string; readonly menge: number } | null;
}

/** Der API-Weg, wie die Wurzel ihn aus dem Reasoner bildet. */
export interface KiApiWeg {
  /** Wohin der API-Weg JETZT wirklich ginge (frisch je Aufruf). */
  bindung(): KiApiBindung;
  /** Die eingerichteten API-Adapter mit der letzten ECHTEN Probe dieses Prozesses. */
  adapter(): readonly KiAdapter[];
  /** Echte Verbindungsprobe (Modellaufruf) — nur auf ausdrückliche Anforderung. */
  pruefe(anbieter: string): Promise<{ readonly ok: boolean; readonly detail: string }>;
  /** Echter Lauf, an `anbieter` gebunden; scheitert er, gibt es keinen Ausweichweg. */
  fuehreAus(prompt: string, anbieter: string, vertraulich: boolean): Promise<KiApiErgebnis>;
}

export interface KiCodexEinrichtung {
  /** Basisordner; je Auftrag entsteht darunter ein eigener Arbeitsbereich. */
  readonly basis: string;
  readonly erlaubtePfade: readonly string[];
  /** Der Anbieter, an den der Codex-Prompt übergeben wird (P04-Kennung). */
  readonly anbieter: string;
  readonly version: string;
  /** Zeitpunkt, zu dem der Basisordner als beschreibbar geprüft wurde. */
  readonly geprueftAm: string;
}

/**
 * Wer fragt — und die EINE Sichtbarkeitsentscheidung für diese Person. Die Route bildet sie mit
 * `sichtbarkeitsfilterFuer(user)` (`sichtbarkeit.ts`) und reicht sie herein; der Dienst legt keine
 * eigene Auslegung an.
 */
export interface KiBetrachter {
  readonly user: SessionUser;
  readonly sichtbar: Sichtbarkeitsfilter;
}

export interface KiArbeitsbegleitungDeps {
  readonly gespraeche: Pick<KlaraGespraechDienst, "hole" | "aendereKiAuftraege">;
  readonly ko: { get(id: string): Promise<KnowledgeObject | undefined> };
  readonly lage: () => KiFreigabelage;
  readonly api?: KiApiWeg | undefined;
  readonly codex?: KiCodexEinrichtung | undefined;
  readonly mcpAktiv: () => boolean;
  readonly jetzt?: () => number;
}

export interface KiAuftragEingabe {
  ziel?: unknown;
  ergebnisformat?: unknown;
  offenePunkte?: unknown;
  anbieter?: unknown;
  faehigkeit?: unknown;
  quellen?: unknown;
  freigegebeneQuellen?: unknown;
}

/** Was nach aussen geht. Der Prompt nur, wenn das Paket JETZT noch übergeben werden dürfte. */
export interface KiAuftragSicht {
  readonly job: KiJob;
  readonly auftrag: KiAuftragEintrag["auftrag"];
  readonly quellen: readonly string[];
  readonly freigegebeneQuellen: readonly string[];
  readonly geschlosseneQuellen: readonly string[];
  readonly paketId: string;
  readonly quellenstand: KiAuftragEintrag["paket"]["quellenstand"];
  readonly ausgelassen: KiAuftragEintrag["paket"]["ausgelassen"];
  readonly paketAktuell: boolean;
  readonly paketGruende: ReadonlyArray<{ readonly quelleId: string; readonly grund: string }>;
  /** `null`, wenn Rechte, Freigaben oder Inhalte sich geändert haben (G05: Kopie gesperrt). */
  readonly prompt: string | null;
  readonly antworten: readonly KiAntwortEintrag[];
  readonly belege: readonly KiBelegEintrag[];
  readonly codexWirkungen: readonly KiCodexWirkungEintrag[];
  readonly angelegtAm: string;
  readonly geaendertAm: string;
}

export interface KiUebergabeErgebnis {
  readonly sicht: KiAuftragSicht;
  readonly gesendet: boolean;
  readonly text: string;
  /** Nur bei manueller Übergabe und nur nach frischer Prüfung: der zu übertragende Prompt. */
  readonly prompt: string | null;
}

const FAEHIGKEITEN: readonly KiFaehigkeit[] = [
  "prompt_manuell",
  "api",
  "browser_begleitung",
  "codex_auftrag",
];
const KEIN_SPACE = "ohne-space";
const ZIEL_MAX = 4_000;
const QUELLEN_MAX = 20;
const PUNKTE_MAX = 10;
const ANTWORT_MAX = 50_000;
const DATEIEN_MAX = 50;

function eingabe(message: string): KiArbeitsbegleitungFehler {
  return new KiArbeitsbegleitungFehler(400, "eingabe", message);
}

function nichtUebergeben(): KiArbeitsbegleitungFehler {
  return new KiArbeitsbegleitungFehler(
    409,
    "nicht_uebergeben",
    "Dieser Auftrag wurde noch nicht übergeben.",
  );
}

function text(wert: unknown, max: number, feld: string): string {
  if (typeof wert !== "string" || wert.trim().length === 0 || wert.length > max) {
    throw eingabe(`${feld} ist Pflicht und höchstens ${max} Zeichen lang.`);
  }
  return wert.trim();
}

function kennungen(wert: unknown, max: number, feld: string): string[] {
  if (wert === undefined || wert === null) return [];
  if (
    !Array.isArray(wert) ||
    wert.length > max ||
    wert.some((x) => typeof x !== "string" || x.length === 0 || x.length > 200)
  ) {
    throw eingabe(`${feld}: höchstens ${max} Kennungen.`);
  }
  return [...new Set(wert as string[])];
}

function punkte(wert: unknown): string[] {
  if (wert === undefined || wert === null) return [];
  if (
    !Array.isArray(wert) ||
    wert.length > PUNKTE_MAX ||
    wert.some((x) => typeof x !== "string" || x.length > 500)
  ) {
    throw eingabe(`offenePunkte: höchstens ${PUNKTE_MAX} Punkte zu je 500 Zeichen.`);
  }
  return (wert as string[]).map((x) => x.trim()).filter((x) => x.length > 0);
}

function aussagen(wert: unknown, feld: string): KiAussage[] {
  if (!Array.isArray(wert) || wert.length > 100) {
    throw eingabe(`${feld}: höchstens 100 Aussagen.`);
  }
  return wert.map((roh, i) => {
    const o = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
    return {
      thema: text(o.thema, 300, `${feld}[${i}].thema`),
      wert: text(o.wert, 2_000, `${feld}[${i}].wert`),
      quellen: kennungen(o.quellen, QUELLEN_MAX, `${feld}[${i}].quellen`),
    };
  });
}

/** Schutzstufe aus der vorhandenen Einstufung — eine unbekannte Stufe bleibt `unbekannt` (G05). */
function schutzstufe(ko: KnowledgeObject): KiQuelle["schutzstufe"] {
  const c = ko.confidentiality;
  if (c === undefined || c === "intern") return ko.oeffentlich === true ? "oeffentlich" : "intern";
  if (isConfidential(c)) return "vertraulich";
  return "unbekannt";
}

export class KiArbeitsbegleitungDienst {
  private readonly deps: KiArbeitsbegleitungDeps;
  private readonly jetzt: () => number;

  constructor(deps: KiArbeitsbegleitungDeps) {
    this.deps = deps;
    this.jetzt = deps.jetzt ?? Date.now;
  }

  // ----------------------------------------------------------------------------------------------
  // Fähigkeiten und Weg
  // ----------------------------------------------------------------------------------------------

  private adapter(): KiAdapter[] {
    const liste: KiAdapter[] = [...(this.deps.api?.adapter() ?? [])];
    const c = this.deps.codex;
    if (c) {
      liste.push({
        faehigkeit: "codex_auftrag",
        anbieter: c.anbieter,
        version: c.version,
        geprueftAm: c.geprueftAm,
      });
    }
    return liste;
  }

  faehigkeiten(): KiFaehigkeitsuebersicht & { readonly lage: KiFreigabelage } {
    const uebersicht = weiseFaehigkeitenAus(this.adapter(), this.deps.mcpAktiv());
    return { ...uebersicht, lage: this.deps.lage() };
  }

  private weg(anbieter: string, faehigkeit: KiFaehigkeit): KiWegErgebnis {
    return pruefeAnbieterweg({
      gewaehlterAnbieter: anbieter,
      faehigkeit,
      lage: this.deps.lage(),
      adapter: this.adapter(),
      apiBindung: faehigkeit === "api" ? this.deps.api?.bindung() : undefined,
    });
  }

  /** Echte Verbindungsprobe für einen API-Anbieter (das Recht prüft die Route). */
  async pruefeVerbindung(anbieter: string): Promise<{ ok: boolean; detail: string }> {
    const api = this.deps.api;
    if (!api) {
      throw new KiArbeitsbegleitungFehler(409, "nicht_eingerichtet", "Kein API-Weg eingerichtet.");
    }
    if (!this.deps.lage().erlaubteAnbieter.includes(anbieter)) {
      throw new KiArbeitsbegleitungFehler(
        409,
        "gesperrt",
        "Dieser Anbieter ist nicht freigegeben.",
      );
    }
    return api.pruefe(anbieter);
  }

  // ----------------------------------------------------------------------------------------------
  // Arbeitsbereich und Quellen — je Aufruf frisch
  // ----------------------------------------------------------------------------------------------

  private async bereich(wer: KiBetrachter, g: KlaraGespraech): Promise<KiArbeitsbereich> {
    const koId = g.objektbezug.koId;
    const gelesen = koId ? await this.deps.ko.get(koId) : undefined;
    // Ein Bezugsobjekt, das die Person nicht (mehr) sehen darf, bindet nichts (G15, G05).
    const anker =
      gelesen && can(wer.user.role, "ko.read") && wer.sichtbar(gelesen) ? gelesen : undefined;
    return {
      mandantId: KLARA_SINGLE_TENANT_ID,
      nutzerId: wer.user.id,
      sitzungId: g.id,
      host: "web",
      arbeitsbereichId: `gespraech:${g.id}`,
      projektId: anker?.spaceId ?? KEIN_SPACE,
      ...(anker ? { dokumentId: anker.id, dokumentFassung: String(anker.version) } : {}),
    };
  }

  private async quellen(
    wer: KiBetrachter,
    bereich: KiArbeitsbereich,
    ids: readonly string[],
    freigegeben: readonly string[],
    geschlossen: readonly string[],
  ): Promise<KiQuelle[]> {
    const liste: KiQuelle[] = [];
    for (const id of ids) {
      const ko = await this.deps.ko.get(id);
      if (!ko || !can(wer.user.role, "ko.read") || !wer.sichtbar(ko)) {
        // Keine Titel, keine Inhalte: nur „nicht lesbar" (G05).
        liste.push({
          quelleId: id,
          mandantId: bereich.mandantId,
          arbeitsbereichId: bereich.arbeitsbereichId,
          projektId: KEIN_SPACE,
          titel: "",
          fassung: "",
          lesbar: false,
          schutzstufe: "unbekannt",
          dokumentfreigabe: "fehlt",
          abschnitte: [],
        });
        continue;
      }
      const dokumentfreigabe = geschlossen.includes(id)
        ? "geschlossen"
        : freigegeben.includes(id)
          ? "erteilt"
          : "fehlt";
      liste.push({
        quelleId: ko.id,
        mandantId: bereich.mandantId,
        arbeitsbereichId: bereich.arbeitsbereichId,
        projektId: ko.spaceId ?? KEIN_SPACE,
        titel: ko.title,
        fassung: String(ko.version),
        lesbar: true,
        schutzstufe: schutzstufe(ko),
        dokumentfreigabe,
        abschnitte: [
          { abschnittId: "aussage", text: ko.statement },
          ...ko.measures.map((m, i) => ({ abschnittId: `massnahme-${i + 1}`, text: m })),
        ].filter((a) => a.text.trim().length > 0),
      });
    }
    return liste;
  }

  /** Das gebundene Paket gegen den AKTUELLEN Stand — Rechte, Freigaben, Inhalte, Projekt. */
  private async paketJetzt(
    wer: KiBetrachter,
    g: KlaraGespraech,
    e: KiAuftragEintrag,
  ): Promise<KiPaketPruefung> {
    const gebunden = e.paket.bindung;
    const quellen = await this.quellen(
      wer,
      gebunden,
      e.quellen,
      e.freigegebeneQuellen,
      e.geschlosseneQuellen,
    );
    const jetzt = await this.bereich(wer, g);
    if (jetzt.projektId !== gebunden.projektId) {
      return {
        aktuell: false,
        paketId: e.paket.paketId,
        gruende: e.paket.quellenstand.map((q) => ({
          quelleId: q.quelleId,
          grund: "anderes_projekt" as const,
        })),
        text: "Der Arbeitsbereich dieses Auftrags hat sich geändert. Bitte neu binden.",
      };
    }
    return pruefePaketAktuell(e.paket, quellen, this.deps.lage());
  }

  /** Vor JEDER Übergabe: frischer Weg UND frisches Paket. */
  private async pruefeFrisch(
    wer: KiBetrachter,
    g: KlaraGespraech,
    e: KiAuftragEintrag,
  ): Promise<KiUebergabePruefung> {
    const paket = await this.paketJetzt(wer, g, e);
    return pruefeUebergabe(e.job, this.weg(e.job.anbieter, e.job.faehigkeit), paket);
  }

  // ----------------------------------------------------------------------------------------------
  // Lesen
  // ----------------------------------------------------------------------------------------------

  private async eintrag(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
  ): Promise<{ g: KlaraGespraech; e: KiAuftragEintrag }> {
    const g = await this.deps.gespraeche.hole(wer.user.id, gid);
    const e = (g.kiAuftraege ?? []).find((x) => x.job.jobId === jobId);
    if (!e) {
      throw new KiArbeitsbegleitungFehler(404, "unbekannt", "KI-Auftrag nicht gefunden.");
    }
    return { g, e };
  }

  /**
   * Die Sicht prüft das Paket FRISCH: hat sich ein Recht, eine Freigabe oder ein Inhalt geändert,
   * geht der Prompt (die Kopie der Quelltexte) nicht mehr hinaus — auch nicht zum Ansehen (G05).
   */
  private async sicht(
    wer: KiBetrachter,
    g: KlaraGespraech,
    e: KiAuftragEintrag,
  ): Promise<KiAuftragSicht> {
    const p = await this.paketJetzt(wer, g, e);
    return {
      job: e.job,
      auftrag: e.auftrag,
      quellen: e.quellen,
      freigegebeneQuellen: e.freigegebeneQuellen,
      geschlosseneQuellen: e.geschlosseneQuellen,
      paketId: e.paket.paketId,
      quellenstand: e.paket.quellenstand,
      ausgelassen: e.paket.ausgelassen,
      paketAktuell: p.aktuell,
      paketGruende: p.aktuell ? [] : p.gruende,
      prompt: p.aktuell ? e.paket.prompt : null,
      antworten: e.antworten,
      belege: e.belege,
      codexWirkungen: e.codexWirkungen,
      angelegtAm: e.angelegtAm,
      geaendertAm: e.geaendertAm,
    };
  }

  async liste(wer: KiBetrachter, gid: string): Promise<KiAuftragSicht[]> {
    const g = await this.deps.gespraeche.hole(wer.user.id, gid);
    const sichten: KiAuftragSicht[] = [];
    for (const e of g.kiAuftraege ?? []) {
      sichten.push(await this.sicht(wer, g, e));
    }
    return sichten;
  }

  // ----------------------------------------------------------------------------------------------
  // Schreiben — immer über den Standvergleich des Gesprächs
  // ----------------------------------------------------------------------------------------------

  /**
   * Schreibt einen geänderten Eintrag, wenn sein Job noch im gelesenen Stand ist. So kann ein
   * zweiter, gleichzeitiger Klick keine zweite Sendung auslösen (AC08).
   */
  private async schreibe(
    wer: KiBetrachter,
    gid: string,
    vorher: KiJob,
    f: (e: KiAuftragEintrag, jetzt: string) => KiAuftragEintrag,
  ): Promise<{ g: KlaraGespraech; e: KiAuftragEintrag }> {
    const halter: { e?: KiAuftragEintrag } = {};
    const g = await this.deps.gespraeche.aendereKiAuftraege(wer.user.id, gid, (liste, jetzt) =>
      liste.map((e) => {
        if (e.job.jobId !== vorher.jobId) return e;
        if (e.job.status !== vorher.status || e.job.sendungen !== vorher.sendungen) {
          throw new KiArbeitsbegleitungFehler(
            409,
            "konflikt",
            "Der Auftrag wurde gleichzeitig an anderer Stelle geändert. Bitte neu laden.",
          );
        }
        halter.e = { ...f(e, jetzt), geaendertAm: jetzt };
        return halter.e;
      }),
    );
    if (!halter.e) {
      throw new KiArbeitsbegleitungFehler(404, "unbekannt", "KI-Auftrag nicht gefunden.");
    }
    return { g, e: halter.e };
  }

  /** AC01–AC05: natürlicher Auftrag → gebundenes Paket → Job im Verlauf (idempotent). */
  async bereite(wer: KiBetrachter, gid: string, roh: KiAuftragEingabe): Promise<KiAuftragSicht> {
    const ziel = text(roh.ziel, ZIEL_MAX, "ziel");
    const format = text(roh.ergebnisformat, 40, "ergebnisformat");
    if (!(KI_ERGEBNISFORMATE as readonly string[]).includes(format)) {
      throw eingabe(`ergebnisformat muss einer der Werte ${KI_ERGEBNISFORMATE.join(", ")} sein.`);
    }
    const anbieter = text(roh.anbieter, 40, "anbieter");
    const faehigkeit = roh.faehigkeit as KiFaehigkeit;
    if (!FAEHIGKEITEN.includes(faehigkeit)) {
      throw eingabe(`faehigkeit muss einer der Werte ${FAEHIGKEITEN.join(", ")} sein.`);
    }
    const offen = punkte(roh.offenePunkte);
    const ids = kennungen(roh.quellen, QUELLEN_MAX, "quellen");
    const freigegeben = kennungen(roh.freigegebeneQuellen, QUELLEN_MAX, "freigegebeneQuellen");
    if (freigegeben.some((id) => !ids.includes(id))) {
      throw eingabe("freigegebeneQuellen darf nur gewählte Quellen enthalten.");
    }

    const g = await this.deps.gespraeche.hole(wer.user.id, gid);
    const weg = this.weg(anbieter, faehigkeit);
    if (!weg.erlaubt) {
      throw new KiArbeitsbegleitungFehler(409, "gesperrt", weg.text, { sperre: weg.sperre });
    }
    const bereich = await this.bereich(wer, g);
    const quellen = await this.quellen(wer, bereich, ids, freigegeben, []);
    const gebaut = baueKontextpaket(
      { ziel, ergebnisformat: format, offenePunkte: offen },
      bereich,
      quellen,
      this.deps.lage(),
      this.jetzt(),
    );
    if (!gebaut.ok) {
      throw eingabe(gebaut.text);
    }
    const paket = gebaut.paket;
    const halter: { e?: KiAuftragEintrag } = {};
    const neu = await this.deps.gespraeche.aendereKiAuftraege(wer.user.id, gid, (liste, jetzt) => {
      const gefunden = starteOderFindeJob(
        liste.map((e) => e.job),
        paket,
        weg,
        offen,
      );
      if (!gefunden.neu) {
        halter.e = liste.find((e) => e.job.jobId === gefunden.job.jobId);
        return liste;
      }
      halter.e = {
        auftrag: { ziel, ergebnisformat: paket.ergebnisformat, offenePunkte: offen },
        quellen: ids,
        freigegebeneQuellen: freigegeben,
        geschlosseneQuellen: [],
        paket,
        job: gefunden.job,
        antworten: [],
        belege: [],
        codexWirkungen: [],
        angelegtAm: jetzt,
        geaendertAm: jetzt,
      };
      return [...liste, halter.e];
    });
    if (!halter.e) {
      throw new KiArbeitsbegleitungFehler(409, "konflikt", "Auftrag wurde nicht angelegt.");
    }
    return this.sicht(wer, neu, halter.e);
  }

  /**
   * Erst-, Wiederholungs- und manuelle Übergabe. Weg UND Paket werden unmittelbar davor frisch
   * geprüft; der Sendestand wird VOR dem Anbieteraufruf geschrieben (kein Doppelverbrauch).
   */
  async uebergib(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
    optionen: { readonly erneutSendenBestaetigt?: boolean } = {},
  ): Promise<KiUebergabeErgebnis> {
    const { g, e } = await this.eintrag(wer, gid, jobId);
    const pruefung = await this.pruefeFrisch(wer, g, e);
    if (!pruefung.erlaubt) {
      throw new KiArbeitsbegleitungFehler(
        409,
        pruefung.grund === "paket_veraltet" ? "paket_veraltet" : "gesperrt",
        pruefung.text,
        pruefung.paket,
      );
    }
    const schritt =
      e.job.status === "vorbereitet"
        ? { ...vermerkeSendung(e.job, pruefung.freigabe), text: "Übergabe freigegeben." }
        : nimmJobWiederAuf(e.job, pruefung, optionen);
    if (!schritt.senden) {
      // Nichts wird gesendet — aber ein bestätigter Wartezustand wird festgehalten.
      const stand =
        schritt.job.status !== e.job.status
          ? await this.schreibe(wer, gid, e.job, (alt) => ({ ...alt, job: schritt.job }))
          : { g, e };
      return {
        sicht: await this.sicht(wer, stand.g, stand.e),
        gesendet: false,
        text: schritt.text,
        prompt: null,
      };
    }
    // Der Sendestand steht fest, BEVOR irgendetwas hinausgeht.
    const gesendet = await this.schreibe(wer, gid, e.job, (alt) => ({ ...alt, job: schritt.job }));
    if (gesendet.e.job.faehigkeit !== "api") {
      // Manuelle Übergabe (auch an Codex): Klarwerk sendet selbst nichts; der Nutzer überträgt
      // genau diesen, eben geprüften Prompt.
      return {
        sicht: await this.sicht(wer, gesendet.g, gesendet.e),
        gesendet: true,
        text: schritt.text,
        prompt: gesendet.e.paket.prompt,
      };
    }
    return this.fuehreApiAus(wer, gid, gesendet.e, schritt.text);
  }

  private async fuehreApiAus(
    wer: KiBetrachter,
    gid: string,
    e: KiAuftragEintrag,
    hinweis: string,
  ): Promise<KiUebergabeErgebnis> {
    const api = this.deps.api;
    if (!api) {
      throw new KiArbeitsbegleitungFehler(409, "nicht_eingerichtet", "Kein API-Weg eingerichtet.");
    }
    const vertraulich = await this.paketEnthaeltVertrauliches(wer, e);
    let ergebnis: KiApiErgebnis;
    try {
      ergebnis = await api.fuehreAus(e.paket.prompt, e.job.anbieter, vertraulich);
    } catch (fehler) {
      const grund =
        fehler instanceof Error ? fehler.message : "Der Anbieter hat nicht geantwortet.";
      const stand = await this.schreibe(wer, gid, e.job, (alt) => ({
        ...alt,
        job: vermerkeFehler(alt.job, grund.slice(0, 500)),
      }));
      return {
        sicht: await this.sicht(wer, stand.g, stand.e),
        gesendet: true,
        text: grund,
        prompt: null,
      };
    }
    const g = await this.deps.gespraeche.hole(wer.user.id, gid);
    const aktuell = await this.bereich(wer, g);
    const adapter = this.adapter().find(
      (a) => a.faehigkeit === "api" && a.anbieter === e.job.anbieter,
    );
    const stand = await this.schreibe(wer, gid, e.job, (alt, jetzt) =>
      this.mitAntwort(alt, jetzt, {
        inhalt: ergebnis.inhalt,
        anbieter: alt.job.anbieter,
        modell: ergebnis.modell,
        weg: "api",
        aktuell,
        beleg: {
          am: jetzt,
          modell: ergebnis.modell,
          anbieterAnfrageId: ergebnis.laufId,
          ...klassifiziereBeleg({
            faehigkeit: "api",
            adapter,
            anbieterAnfrageId: ergebnis.laufId ?? undefined,
            verbrauch: ergebnis.verbrauch ?? undefined,
          }),
        },
      }),
    );
    return {
      sicht: await this.sicht(wer, stand.g, stand.e),
      gesendet: true,
      text: hinweis,
      prompt: null,
    };
  }

  /** Enthält das Paket Text aus einer als vertraulich eingestuften Quelle (aktueller Stand)? */
  private async paketEnthaeltVertrauliches(
    wer: KiBetrachter,
    e: KiAuftragEintrag,
  ): Promise<boolean> {
    const quellen = await this.quellen(
      wer,
      e.paket.bindung,
      e.paket.quellenstand.map((q) => q.quelleId),
      e.freigegebeneQuellen,
      e.geschlosseneQuellen,
    );
    return quellen.some((q) => q.schutzstufe === "vertraulich");
  }

  private mitAntwort(
    e: KiAuftragEintrag,
    jetzt: string,
    a: {
      readonly inhalt: string;
      readonly anbieter: string;
      readonly modell: string | null;
      readonly weg: "api" | "manuell";
      readonly aktuell: Pick<KiArbeitsbereich, "dokumentId" | "dokumentFassung">;
      readonly beleg: KiBelegEintrag;
    },
  ): KiAuftragEintrag {
    const annahme = nimmAntwortAn(
      [e.job],
      {
        jobId: e.job.jobId,
        sitzungId: e.job.bindung.sitzungId,
        anbieter: a.anbieter,
        inhalt: a.inhalt,
      },
      a.aktuell,
    );
    if (!annahme.angenommen) {
      throw new KiArbeitsbegleitungFehler(409, "gesperrt", `Antwort abgelehnt (${annahme.grund}).`);
    }
    return {
      ...e,
      job: annahme.job,
      antworten: [
        ...e.antworten,
        {
          am: jetzt,
          inhalt: a.inhalt,
          anbieter: a.anbieter,
          modell: a.modell,
          weg: a.weg,
          paketId: annahme.paketId,
          anwendbar: annahme.anwendbar,
          hinweis: annahme.hinweis,
        },
      ],
      belege: [...e.belege, a.beleg],
    };
  }

  /** AC07: das Ergebnis einer manuellen Übergabe zurückgeben — gebunden an den Ursprung. */
  async ergebnis(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
    roh: { inhalt?: unknown; anbieter?: unknown },
  ): Promise<KiAuftragSicht> {
    const inhalt = text(roh.inhalt, ANTWORT_MAX, "inhalt");
    const anbieter = text(roh.anbieter, 40, "anbieter");
    const { g, e } = await this.eintrag(wer, gid, jobId);
    if (e.job.faehigkeit === "api") {
      throw eingabe("Antworten des API-Wegs kommen vom Anbieter, nicht aus der Eingabe.");
    }
    if (e.job.sendungen === 0) throw nichtUebergeben();
    if (anbieter !== e.job.anbieter) {
      throw new KiArbeitsbegleitungFehler(
        409,
        "gesperrt",
        `Dieser Auftrag gehört zu ${e.job.anbieter}. Ein fremdes Ergebnis wird nicht übernommen.`,
      );
    }
    const aktuell = await this.bereich(wer, g);
    const stand = await this.schreibe(wer, gid, e.job, (alt, jetzt) =>
      this.mitAntwort(alt, jetzt, {
        inhalt,
        anbieter,
        modell: null,
        weg: "manuell",
        aktuell,
        beleg: {
          am: jetzt,
          modell: null,
          anbieterAnfrageId: null,
          ...klassifiziereBeleg({ faehigkeit: "prompt_manuell", manuellesErgebnis: true }),
        },
      }),
    );
    return this.sicht(wer, stand.g, stand.e);
  }

  async unterbrich(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
    teilergebnis?: unknown,
  ): Promise<KiAuftragSicht> {
    const teil =
      teilergebnis === undefined || teilergebnis === null
        ? undefined
        : text(teilergebnis, ANTWORT_MAX, "teilergebnis");
    const { e } = await this.eintrag(wer, gid, jobId);
    const stand = await this.schreibe(wer, gid, e.job, (alt) => ({
      ...alt,
      job: unterbrecheJob(alt.job, teil),
    }));
    return this.sicht(wer, stand.g, stand.e);
  }

  async stoppe(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
  ): Promise<{ sicht: KiAuftragSicht; text: string }> {
    const { e } = await this.eintrag(wer, gid, jobId);
    const s = stoppeJob(e.job);
    const stand = await this.schreibe(wer, gid, e.job, (alt) => ({ ...alt, job: s.job }));
    return { sicht: await this.sicht(wer, stand.g, stand.e), text: s.text };
  }

  /** AC03: die dokumentbezogene Freigabe einer Quelle für diesen Auftrag schliessen. */
  async schliesseFreigabe(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
    quelleId: unknown,
  ): Promise<KiAuftragSicht> {
    const id = text(quelleId, 200, "quelleId");
    const { e } = await this.eintrag(wer, gid, jobId);
    if (!e.quellen.includes(id)) {
      throw eingabe("Diese Quelle gehört nicht zu diesem Auftrag.");
    }
    const stand = await this.schreibe(wer, gid, e.job, (alt) => ({
      ...alt,
      freigegebeneQuellen: alt.freigegebeneQuellen.filter((x) => x !== id),
      geschlosseneQuellen: [...new Set([...alt.geschlosseneQuellen, id])],
    }));
    return this.sicht(wer, stand.g, stand.e);
  }

  /**
   * Ein verändertes Paket AUSDRÜCKLICH neu binden: aktueller Stand, neue Paketkennung, neuer Job;
   * der alte Job wird `ersetzt`. Geschlossene Freigaben bleiben geschlossen.
   */
  async bindeNeu(wer: KiBetrachter, gid: string, jobId: string): Promise<KiAuftragSicht> {
    const { g, e } = await this.eintrag(wer, gid, jobId);
    const weg = this.weg(e.job.anbieter, e.job.faehigkeit);
    if (!weg.erlaubt) {
      throw new KiArbeitsbegleitungFehler(409, "gesperrt", weg.text, { sperre: weg.sperre });
    }
    const bereich = await this.bereich(wer, g);
    const quellen = await this.quellen(
      wer,
      bereich,
      e.quellen,
      e.freigegebeneQuellen,
      e.geschlosseneQuellen,
    );
    const gebaut = baueKontextpaket(e.auftrag, bereich, quellen, this.deps.lage(), this.jetzt());
    if (!gebaut.ok) throw eingabe(gebaut.text);
    const paket = gebaut.paket;
    const halter: { e?: KiAuftragEintrag } = {};
    const neu = await this.deps.gespraeche.aendereKiAuftraege(wer.user.id, gid, (liste, jetzt) => {
      const gefunden = starteOderFindeJob(
        liste.map((x) => x.job),
        paket,
        weg,
        e.auftrag.offenePunkte,
      );
      if (!gefunden.neu) {
        halter.e = liste.find((x) => x.job.jobId === gefunden.job.jobId);
        return liste;
      }
      halter.e = {
        ...e,
        paket,
        job: gefunden.job,
        antworten: [],
        belege: [],
        codexWirkungen: [],
        angelegtAm: jetzt,
        geaendertAm: jetzt,
      };
      const ersetzt = liste.map((x) =>
        x.job.jobId === e.job.jobId
          ? { ...x, job: ersetzeJob(x.job, gefunden.job), geaendertAm: jetzt }
          : x,
      );
      return [...ersetzt, halter.e];
    });
    if (!halter.e) {
      throw new KiArbeitsbegleitungFehler(409, "konflikt", "Auftrag wurde nicht neu gebunden.");
    }
    return this.sicht(wer, neu, halter.e);
  }

  /** AC09: zwei Ergebnisse DESSELBEN Pakets gegen die Originalpassagen vergleichen. */
  async vergleiche(
    wer: KiBetrachter,
    gid: string,
    roh: { jobA?: unknown; jobB?: unknown; aussagenA?: unknown; aussagenB?: unknown },
  ): Promise<readonly KiVergleichszeile[]> {
    const a = await this.eintrag(wer, gid, text(roh.jobA, 200, "jobA"));
    const b = await this.eintrag(wer, gid, text(roh.jobB, 200, "jobB"));
    if (a.e.paket.paketId !== b.e.paket.paketId) {
      throw eingabe("Verglichen werden nur Ergebnisse zum selben Kontextpaket.");
    }
    const ergebnis = (x: KiAuftragEintrag, liste: KiAussage[]): KiErgebnis => {
      const letzte = x.antworten.at(-1);
      if (!letzte) {
        throw new KiArbeitsbegleitungFehler(
          409,
          "unbekannt",
          "Zu diesem Auftrag gibt es noch keine Antwort.",
        );
      }
      return {
        jobId: x.job.jobId,
        anbieter: x.job.anbieter,
        modell: letzte.modell,
        antwortFassung: letzte.am,
        aussagen: liste,
      };
    };
    return vergleicheKiErgebnisse(
      a.e.paket,
      ergebnis(a.e, aussagen(roh.aussagenA, "aussagenA")),
      ergebnis(b.e, aussagen(roh.aussagenB, "aussagenB")),
    );
  }

  /**
   * AC06: das zurückgegebene Ergebnis eines Codex-Auftrags im eigenen Arbeitsbereich dieses
   * Auftrags WIRKLICH schreiben — nur erlaubte Dateien, nie Löschen, nie Betriebsaktionen.
   * Vorher: frische Prüfung von Weg und Paket wie bei jeder Übergabe.
   */
  async wendeCodexAn(
    wer: KiBetrachter,
    gid: string,
    jobId: string,
    roh: { dateien?: unknown; aktionen?: unknown },
  ): Promise<KiAuftragSicht> {
    const c = this.deps.codex;
    if (!c) {
      throw new KiArbeitsbegleitungFehler(
        409,
        "nicht_eingerichtet",
        "Für Programmieraufträge ist kein Arbeitsbereich eingerichtet.",
      );
    }
    const roheDateien = roh.dateien;
    if (
      !Array.isArray(roheDateien) ||
      roheDateien.length === 0 ||
      roheDateien.length > DATEIEN_MAX
    ) {
      throw eingabe(`dateien: 1 bis ${DATEIEN_MAX} Einträge.`);
    }
    const dateien: KiCodexDatei[] = roheDateien.map((x: unknown, i: number) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      const art = o.art;
      if (art !== "anlegen" && art !== "aendern" && art !== "loeschen") {
        throw eingabe(`dateien[${i}].art muss anlegen, aendern oder loeschen sein.`);
      }
      return {
        pfad: text(o.pfad, 500, `dateien[${i}].pfad`),
        art,
        ...(typeof o.inhalt === "string" ? { inhalt: o.inhalt } : {}),
      };
    });
    const aktionen = kennungen(roh.aktionen, 20, "aktionen");
    const { g, e } = await this.eintrag(wer, gid, jobId);
    if (e.job.faehigkeit !== "codex_auftrag") {
      throw eingabe("Nur ein Programmierauftrag erzeugt Dateien.");
    }
    if (e.job.sendungen === 0) throw nichtUebergeben();
    const paket = await this.paketJetzt(wer, g, e);
    const pruefung = pruefeUebergabe(e.job, this.weg(e.job.anbieter, e.job.faehigkeit), paket);
    if (!pruefung.erlaubt) {
      throw new KiArbeitsbegleitungFehler(
        409,
        pruefung.grund === "paket_veraltet" ? "paket_veraltet" : "gesperrt",
        pruefung.text,
        pruefung.paket,
      );
    }
    const wurzel = join(c.basis, e.job.jobId);
    await mkdir(wurzel, { recursive: true });
    const wirkung = await wendeCodexAenderungenAn(
      { paketId: e.paket.paketId, wurzel, erlaubtePfade: c.erlaubtePfade },
      dateien,
      aktionen,
    );
    const stand = await this.schreibe(wer, gid, e.job, (alt, jetzt) => ({
      ...alt,
      codexWirkungen: [...alt.codexWirkungen, { am: jetzt, ...wirkung }],
    }));
    return this.sicht(wer, stand.g, stand.e);
  }
}
