import { type ObjectStore, decodeDataUrl } from "../../object-store";
import { type MediaAnalysis, MediaAnalysisError, type Transcriber } from "./types";

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

  // SCRUM-502 R7: `confidential` PFLICHT (fail-safe von der Route: fehlend/ungültig → vertraulich).
  // Vertrauliche Medien werden NICHT extern transkribiert — ehrlicher Hinweis statt Egress. Der
  // cappedTranscriber ist zusätzlich der Chokepoint-Wächter (belt & suspenders).
  async analyze(
    objectId: string,
    locale: "de" | "en",
    confidential: boolean,
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
