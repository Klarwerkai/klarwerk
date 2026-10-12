import { type ObjectStore, decodeDataUrl } from "../../object-store";
import { type MediaAnalysis, MediaAnalysisError, type Transcriber } from "./types";

// SCRUM-521 (WP1): Vertraulichkeits-Rangordnung (self-contained; media bleibt von knowledge-object
// entkoppelt). intern < vertraulich < streng_vertraulich.
const CONFIDENTIALITY_RANK: Record<string, number> = {
  intern: 0,
  vertraulich: 1,
  streng_vertraulich: 2,
};
const CONFIDENTIAL_FLOOR = 1; // = Rang von "vertraulich"; ab hier → kein externer Egress
// FUNKE-FIX P2 (bens Sammel-Nacht): der höchste Rang ("streng_vertraulich") — ein unbekannter/
// korrupter/unerwarteter KO-Stufenwert wird HIERAUF angehoben (fail-closed), nie freigegeben.
const CONFIDENTIALITY_TOP = 2;

// Die EGRESS-Entscheidung für ein Medienobjekt. `stored` = die serverseitig PERSISTIERTE Vertraulichkeit
// (Quelle der Wahrheit). `requested` = optionaler Wert aus dem Analyse-Request — darf NUR HOCHSTUFEN
// (restriktiver), nie herabstufen. Fehlt/ungültig `stored` → fail-safe vertraulich (kein Egress); ein
// ungültiger `requested` wird ignoriert (keine Hochstufung, aber auch keine Senkung).
// SCRUM-521 (WP2, nacht24): `koLevels` = die Vertraulichkeitsstufen ALLER KOs, die das Objekt als
// Anhang tragen (serverseitig aufgelöst). Die RESTRIKTIVSTE Stufe gewinnt — ein „intern"
// hochgeladenes Medium an einem vertraulichen KO bleibt vertraulich. KO-Stufen können nur ANHEBEN,
// nie senken.
// FUNKE-FIX P2 (bens Sammel-Nacht): Ein PRÄSENTER, aber unbekannter/korrupter/unerwarteter
// KO-Stufenwert wird jetzt auf den HÖCHSTEN Rang ANGEHOBEN (fail-closed, kein externer Egress) statt
// wie „intern" freigegeben — echte fail-safe-Tiefe. Ein genuin FEHLENDER Wert (undefined) bleibt der
// dokumentierte „intern"-Default (SCRUM-415) und hebt nicht an; die Kompositionswurzel reicht
// korrupte Werte unverändert durch, sodass sie hier hart blockieren.
export function mediaIsConfidential(
  stored?: string,
  requested?: string,
  koLevels?: readonly string[],
): boolean {
  const base =
    stored !== undefined && stored in CONFIDENTIALITY_RANK
      ? (CONFIDENTIALITY_RANK[stored] as number)
      : CONFIDENTIAL_FLOOR; // fehlt/ungültig → fail-safe vertraulich
  const up =
    requested !== undefined && requested in CONFIDENTIALITY_RANK
      ? (CONFIDENTIALITY_RANK[requested] as number)
      : -1; // ungültig/fehlend → keine Hochstufung (der Request kann nur restriktiver anheben)
  const koUp = (koLevels ?? []).reduce((max, level) => {
    // Bekannt → sein Rang; präsent aber unbekannt/korrupt → HÖCHSTER Rang (fail-closed).
    const rank =
      level in CONFIDENTIALITY_RANK ? (CONFIDENTIALITY_RANK[level] as number) : CONFIDENTIALITY_TOP;
    return Math.max(max, rank);
  }, -1);
  return Math.max(base, up, koUp) >= CONFIDENTIAL_FLOOR;
}

export interface MediaAnalysisDeps {
  objects: ObjectStore;
  transcriber?: Transcriber | undefined;
  // SCRUM-521 (WP2): serverseitige Auflösung des KO-Kontexts — liefert die Vertraulichkeitsstufen
  // aller KOs, die das Objekt als Anhang tragen (leer = kein KO-Bezug). Optional injiziert, damit
  // media von knowledge-object entkoppelt bleibt (Verdrahtung in build-app). Wirft die Auflösung,
  // behandelt analyze() das fail-safe als vertraulich (nie „im Zweifel egressen").
  koConfidentiality?: ((objectId: string) => Promise<readonly string[]>) | undefined;
  /**
   * Auftrag gesamt-ki-freigaberegeln · DAS ERGEBNIS DER ZENTRALEN ADMINFREIGABE FÜR ÖFFENTLICHE KI.
   *
   * Die Transkription ist ein Weg zu einer öffentlichen KI (Whisper bei OpenAI). Pedis Entscheidung
   * (10.09. 21:25, wörtlich an `ReasonerKiFreigabe` in `services/reasoner/src/types.ts`): „Keine
   * Freigabe, kein Egress … Im Zweifel gilt: gesperrt." Bis hierher fragte dieser Weg die Freigabe
   * nie — ein nicht vertrauliches Medium ging auch ohne sie hinaus.
   *
   * Entschieden wird hier NICHT: die Wurzel (`build-app.ts`) reicht die Lesart des Kerns herein,
   * frisch je Analyse, wie für Klara (`zentralFreigegeben` in `klara-session-service.ts`). Dieselbe
   * Lesart gilt hier: nur `true` erlaubt; `false`, ein Wurf und ein fehlender Eintrag sperren gleich.
   * Die Vertraulichkeitsregel oben bleibt unverändert davor.
   */
  zentralFreigegeben?: (() => boolean) | undefined;
  /**
   * Auftrag gesamt-ki-freigaberegeln (Ben Nacharbeit 2) · DIE ZWEITE ADMINFREIGABE: auch als vertraulich
   * eingestufte Medien dürfen zur Transkription hinaus. Wie oben nur durchgereicht
   * (`Reasoner.vertraulicheAusleitungFreigegeben`), nur `true` zählt. Bis hierher sperrte dieser Weg
   * Vertrauliches unabhängig von der Freigabe — eine eigene Zusatzsperre gegen Pedis Entscheidung vom
   * 10.09. Die Einstufung selbst (`mediaIsConfidential`) bleibt unverändert und reist bis zum
   * Chokepoint (`cappedTranscriber`) mit, der dieselbe Freigabe fragt.
   */
  vertraulichFreigegeben?: (() => boolean) | undefined;
}

// Nur `true` zählt; ein Wurf der Auskunft ist keine Erlaubnis.
function nurWahr(auskunft: (() => boolean) | undefined): boolean {
  try {
    return auskunft?.() === true;
  } catch {
    return false;
  }
}

// SCRUM-382: Analyse eines hochgeladenen Video-/Audio-Objekts. Bewusst schmal:
// dieses Modul gewinnt NUR den Rohtext (Transkript); die Strukturierung zum
// KO-Vorschlag übernimmt danach der vorhandene Reasoner (/api/reasoner, task=structure).
export class MediaAnalysisService {
  private readonly objects: ObjectStore;
  private readonly transcriber: Transcriber | undefined;
  private readonly koConfidentiality:
    | ((objectId: string) => Promise<readonly string[]>)
    | undefined;
  private readonly zentralFreigegeben: (() => boolean) | undefined;
  private readonly vertraulichFreigegeben: (() => boolean) | undefined;

  constructor(deps: MediaAnalysisDeps) {
    this.objects = deps.objects;
    this.transcriber = deps.transcriber;
    this.koConfidentiality = deps.koConfidentiality;
    this.zentralFreigegeben = deps.zentralFreigegeben;
    this.vertraulichFreigegeben = deps.vertraulichFreigegeben;
  }

  // Nur `true` zählt (s. `MediaAnalysisDeps.zentralFreigegeben`).
  private oeffentlicheKiFreigegeben(): boolean {
    return nurWahr(this.zentralFreigegeben);
  }

  engineInfo(): { active: boolean; engine: string | null } {
    return { active: Boolean(this.transcriber), engine: this.transcriber?.name ?? null };
  }

  // SCRUM-521 (WP1): Die Vertraulichkeit wird AUSSCHLIESSLICH serverseitig aus dem gespeicherten
  // Objekt (`stored.ref.confidentiality`) bestimmt — der Client kann sie NICHT herabstufen. Der
  // optionale `requestConfidentiality` aus dem Analyse-Request darf nur HOCHSTUFEN (restriktiver).
  // Fehlt der persistierte Wert, gilt fail-safe vertraulich → kein externer Egress.
  // SCRUM-502 R7: Vertrauliche Medien werden NICHT extern transkribiert — ehrlicher Hinweis statt
  // Egress. Der cappedTranscriber bleibt zusätzlich der Chokepoint-Wächter (belt & suspenders).
  async analyze(
    objectId: string,
    locale: "de" | "en",
    requestConfidentiality?: string,
  ): Promise<MediaAnalysis> {
    const stored = await this.objects.read(objectId);
    if (!stored) {
      throw new MediaAnalysisError("NOT_FOUND", "Objekt nicht gefunden.");
    }
    if (stored.ref.kind !== "video") {
      throw new MediaAnalysisError(
        "UNSUPPORTED_KIND",
        "Nur Video-/Audio-Objekte können transkribiert werden.",
      );
    }
    // SCRUM-521 (WP2): KO-Kontext serverseitig auflösen — die restriktivste Stufe aller KOs, die
    // das Objekt als Anhang tragen, gewinnt. Scheitert die Auflösung, gilt fail-safe vertraulich
    // (nie „im Zweifel egressen") — ehrlicher Status statt stiller Verarbeitung.
    let koLevels: readonly string[] = [];
    if (this.koConfidentiality) {
      try {
        koLevels = await this.koConfidentiality(objectId);
      } catch {
        koLevels = ["streng_vertraulich"]; // Auflösung unklar → kein externer Egress
      }
    }
    // Quelle der Wahrheit: der PERSISTIERTE Wert am Objekt. Request nur als Hochstufung.
    const confidential = mediaIsConfidential(
      stored.ref.confidentiality,
      requestConfidentiality,
      koLevels,
    );
    // gesamt-ki-freigaberegeln: Vertrauliches bleibt ohne die zweite Adminfreigabe drinnen; mit ihr
    // gilt dieselbe Kette wie für alles andere (Schlüssel, Grundfreigabe, Chokepoint).
    if (confidential && !nurWahr(this.vertraulichFreigegeben)) {
      // Vertrauliches Medium → kein externer Egress. Ehrlich, wie der Inaktiv-Zustand.
      return {
        objectId,
        transcript: null,
        engineActive: false,
        engine: null,
        note:
          "Vertrauliche Inhalte werden nicht an eine externe Transkriptions-KI gesendet. " +
          "Bitte den Inhalt manuell zusammenfassen oder die Vertraulichkeit anpassen.",
      };
    }
    if (!this.transcriber) {
      // G-2: kein erfundenes Transkript. Ehrlicher Inaktiv-Zustand mit klarem nächsten Schritt.
      return {
        objectId,
        transcript: null,
        engineActive: false,
        engine: null,
        note:
          "Transkription nicht aktiv — es ist kein Dienst-Schlüssel hinterlegt. " +
          "Schlüssel in der KLARWERK-App hinterlegen oder den Inhalt manuell zusammenfassen.",
      };
    }
    // Auftrag gesamt-ki-freigaberegeln: ohne die zentrale Adminfreigabe geht nichts an die
    // öffentliche Transkriptions-KI. Gefragt NACH dem Inaktiv-Zustand, damit „kein Schlüssel" und
    // „nicht freigegeben" unterscheidbar bleiben; der Anbieter bleibt benannt.
    if (!this.oeffentlicheKiFreigegeben()) {
      return {
        objectId,
        transcript: null,
        engineActive: false,
        engine: this.transcriber.name,
        note:
          "Die öffentliche KI ist vom Administrator nicht freigegeben — es wird nichts an den " +
          "Transkriptionsdienst gesendet. Bitte den Inhalt manuell zusammenfassen.",
      };
    }
    const decoded = decodeDataUrl(stored.data);
    if (!decoded) {
      throw new MediaAnalysisError("ENGINE_FAILED", "Objektdaten sind nicht lesbar.");
    }
    try {
      // confidential ist hier false oder durch die zweite Adminfreigabe gedeckt (oben geprüft); der
      // cappedTranscriber-Wächter fragt dieselbe Freigabe noch einmal (Belt & Suspenders).
      const transcript = await this.transcriber.transcribe(
        decoded.bytes,
        decoded.mime,
        locale,
        confidential,
      );
      return {
        objectId,
        transcript,
        engineActive: true,
        engine: this.transcriber.name,
        note: "Automatisches Transkript — bitte prüfen; es ist ein Entwurf, keine Wahrheit.",
      };
    } catch (err) {
      throw new MediaAnalysisError(
        "ENGINE_FAILED",
        `Transkription fehlgeschlagen: ${err instanceof Error ? err.message : "unbekannt"}`,
      );
    }
  }

  // ==============================================================================================
  // AUFNAHME gesamt-sprachassistent · R-0104 — GESPROCHENES ÜBER DAS BROWSER-DIKTAT HINAUS.
  // ==============================================================================================
  //
  // Eine Sprachaufnahme aus Erfassen oder Fragen wird mit DEMSELBEN Transkriber und denselben drei
  // Sperren wie `analyze()` verschriftlicht — in derselben Reihenfolge: Vertraulichkeit, kein Dienst,
  // keine zentrale Freigabe. Der Unterschied ist allein die Herkunft der Bytes: sie kommen aus dem
  // Rumpf und werden NICHT im Objektspeicher abgelegt. Eine gesprochene Frage ist kein Anhang; sie
  // dort zu speichern, hiesse eine Aufnahme aufzubewahren, die niemand aufbewahren wollte.
  //
  // DIE STUFE: Es gibt kein gespeichertes Objekt, also gilt die beim Einsenden genannte Stufe — wie
  // beim Upload (`POST /api/objects` persistiert die Stufe des Clients). Fehlt sie oder ist sie
  // unbekannt, gilt fail-safe vertraulich (`mediaIsConfidential`), nie „intern".
  async transcribeRecording(
    dataUrl: string,
    locale: "de" | "en",
    confidentiality?: string,
  ): Promise<SprachTranskript> {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) {
      throw new MediaAnalysisError("UNSUPPORTED_KIND", "Die Aufnahme ist nicht lesbar.");
    }
    if (!/^(audio|video)\//.test(decoded.mime)) {
      throw new MediaAnalysisError(
        "UNSUPPORTED_KIND",
        "Nur Audio- oder Videoaufnahmen können verschriftlicht werden.",
      );
    }
    if (decoded.bytes.length === 0) {
      throw new MediaAnalysisError("UNSUPPORTED_KIND", "Die Aufnahme ist leer.");
    }
    if (decoded.bytes.length > SPRACHAUFNAHME_MAX_BYTES) {
      throw new MediaAnalysisError("UNSUPPORTED_KIND", "Die Aufnahme ist zu lang.");
    }
    const confidential = mediaIsConfidential(confidentiality);
    if (confidential && !nurWahr(this.vertraulichFreigegeben)) {
      return {
        transcript: null,
        engineActive: false,
        engine: null,
        note:
          "Vertrauliche Inhalte werden nicht an eine externe Transkriptions-KI gesendet. " +
          "Bitte den Text eintippen oder die Vertraulichkeit anpassen.",
      };
    }
    if (!this.transcriber) {
      return {
        transcript: null,
        engineActive: false,
        engine: null,
        note:
          "Transkription nicht aktiv — es ist kein Dienst-Schlüssel hinterlegt. " +
          "Bitte den Text eintippen oder das Browser-Diktat nutzen.",
      };
    }
    if (!this.oeffentlicheKiFreigegeben()) {
      return {
        transcript: null,
        engineActive: false,
        engine: this.transcriber.name,
        note:
          "Die öffentliche KI ist vom Administrator nicht freigegeben — es wird nichts an den " +
          "Transkriptionsdienst gesendet. Bitte den Text eintippen.",
      };
    }
    try {
      const transcript = await this.transcriber.transcribe(
        decoded.bytes,
        decoded.mime,
        locale,
        confidential,
      );
      return {
        transcript,
        engineActive: true,
        engine: this.transcriber.name,
        note: "Automatisches Transkript — bitte prüfen; es ist ein Entwurf, keine Wahrheit.",
      };
    } catch (err) {
      throw new MediaAnalysisError(
        "ENGINE_FAILED",
        `Transkription fehlgeschlagen: ${err instanceof Error ? err.message : "unbekannt"}`,
      );
    }
  }
}

/**
 * Obergrenze einer Sprachaufnahme (dekodiert). Sie liegt unter der Dateigrenze des
 * Transkriptionsdienstes (25 MB bei Whisper) und reicht für mehrere Minuten komprimierter Sprache.
 */
export const SPRACHAUFNAHME_MAX_BYTES = 20 * 1024 * 1024;

/** Ergebnis einer Sprachaufnahme — `MediaAnalysis` ohne Objektkennung, weil nichts gespeichert wird. */
export type SprachTranskript = Omit<MediaAnalysis, "objectId">;
