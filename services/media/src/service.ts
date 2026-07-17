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

// Die EGRESS-Entscheidung für ein Medienobjekt. `stored` = die serverseitig PERSISTIERTE Vertraulichkeit
// (Quelle der Wahrheit). `requested` = optionaler Wert aus dem Analyse-Request — darf NUR HOCHSTUFEN
// (restriktiver), nie herabstufen. Fehlt/ungültig `stored` → fail-safe vertraulich (kein Egress); ein
// ungültiger `requested` wird ignoriert (keine Hochstufung, aber auch keine Senkung).
export function mediaIsConfidential(stored?: string, requested?: string): boolean {
  const base =
    stored !== undefined && stored in CONFIDENTIALITY_RANK
      ? (CONFIDENTIALITY_RANK[stored] as number)
      : CONFIDENTIAL_FLOOR; // fehlt/ungültig → fail-safe vertraulich
  const up =
    requested !== undefined && requested in CONFIDENTIALITY_RANK
      ? (CONFIDENTIALITY_RANK[requested] as number)
      : -1; // ungültig/fehlend → keine Hochstufung
  return Math.max(base, up) >= CONFIDENTIAL_FLOOR;
}

export interface MediaAnalysisDeps {
  objects: ObjectStore;
  transcriber?: Transcriber | undefined;
}

// SCRUM-382: Analyse eines hochgeladenen Video-/Audio-Objekts. Bewusst schmal:
// dieses Modul gewinnt NUR den Rohtext (Transkript); die Strukturierung zum
// KO-Vorschlag übernimmt danach der vorhandene Reasoner (/api/reasoner, task=structure).
export class MediaAnalysisService {
  private readonly objects: ObjectStore;
  private readonly transcriber: Transcriber | undefined;

  constructor(deps: MediaAnalysisDeps) {
    this.objects = deps.objects;
    this.transcriber = deps.transcriber;
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
    // Quelle der Wahrheit: der PERSISTIERTE Wert am Objekt. Request nur als Hochstufung.
    const confidential = mediaIsConfidential(stored.ref.confidentiality, requestConfidentiality);
    if (confidential) {
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
    const decoded = decodeDataUrl(stored.data);
    if (!decoded) {
      throw new MediaAnalysisError("ENGINE_FAILED", "Objektdaten sind nicht lesbar.");
    }
    try {
      // confidential ist hier false (oben geprüft); der cappedTranscriber-Wächter bleibt als Belt.
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
}
