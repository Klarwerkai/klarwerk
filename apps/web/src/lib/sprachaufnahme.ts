// ================================================================================================
// AUFNAHME gesamt-sprachassistent · R-0104 — SPRECHEN ÜBER DAS BROWSER-DIKTAT HINAUS.
// ================================================================================================
//
// Das Browser-Diktat (`lib/speechDictation.ts`) hängt an der Spracherkennung des Browsers: auf iOS
// gibt es sie nicht brauchbar, in Firefox gar nicht, und wo es sie gibt, entscheidet der Browser,
// wohin die Stimme geht. Der zweite Weg hier nimmt das Gesprochene als AUFNAHME auf und lässt es von
// der VORHANDENEN Transkription des Servers verschriftlichen — demselben Dienst, derselben zentralen
// Freigabe und derselben Vertraulichkeitsregel wie die Datei-Transkription (F-0121,
// `services/media/src/service.ts`). Neu ist nur der Eingang `POST /api/media/transcribe`, der die
// Aufnahme NICHT speichert.
//
// Der Diktatweg bleibt unverändert, auch sein Versprechen „kein Cloud-STT" — das gilt dem Diktat.
// Die Aufnahme ist ein eigener Knopf, und ihr Weg nach draussen ist der der Transkription.
//
// DIESE DATEI IST DOM-FREI (wie `speechSupport.ts`): sie wird von einem `.ts`-Test unter `tests/`
// importiert und fällt damit in den Root-Typcheck ohne DOM-lib. Der Rekorder selbst lebt im Haken
// `components/sprache/useSprachaufnahme.ts`.
//
// WAS DARAUS WIRD, ENTSCHEIDET DER MENSCH: Das Transkript wird an das Feld ANGEHÄNGT — im Blatt als
// Absatz, im Fragefeld als Text. Gesendet, gesichert oder eingereicht wird erst auf seinen Klick.

/** Die Formate, die der Transkriptionsdienst annimmt (`MEDIA_DATEIENDUNGEN`), in Vorzugsreihenfolge. */
export const AUFNAHME_FORMATE: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

/** Eine Aufnahme endet spätestens hier von selbst — der Dienst nimmt höchstens 20 MiB an. */
export const AUFNAHME_HOECHSTDAUER_MS = 5 * 60_000;

/**
 * Das erste Format, das der Browser aufnehmen kann — oder `null`, dann wählt der Browser selbst.
 * Ein Wurf der Abfrage zählt als „nicht unterstützt".
 */
export function waehleAufnahmeFormat(unterstuetzt: (mime: string) => boolean): string | null {
  for (const format of AUFNAHME_FORMATE) {
    try {
      if (unterstuetzt(format)) {
        return format;
      }
    } catch {
      // weiter mit dem nächsten
    }
  }
  return null;
}

/**
 * Der Medientyp ohne Parameter. `audio/webm;codecs=opus` würde die Data-URL des Servers
 * (`data:<typ>;base64,…`, `object-store/src/service.ts` `decodeDataUrl`) unlesbar machen.
 */
export function basisMime(mime: string): string {
  return (mime.split(";")[0] ?? "").trim().toLowerCase();
}

/**
 * Die Data-URL, die der Server liest — aus dem Medientyp der Aufnahme und ihrem Base64-Inhalt.
 * Fehlt der Typ, wird `audio/webm` angenommen: das ist das Format, das Chromium und Firefox ohne
 * Vorgabe aufnehmen.
 */
export function aufnahmeDataUrl(mime: string, base64: string): string {
  return `data:${basisMime(mime) || "audio/webm"};base64,${base64}`;
}

/** Die Base64-Hälfte einer Data-URL, wie `FileReader.readAsDataURL` sie liefert. */
export function base64AusDataUrl(dataUrl: string): string {
  const komma = dataUrl.indexOf(",");
  return komma < 0 ? "" : dataUrl.slice(komma + 1);
}

/** Die Antwort von `POST /api/media/transcribe` (`SprachTranskript` im Medienmodul). */
export interface SprachTranskriptAntwort {
  transcript: string | null;
  engineActive: boolean;
  engine: string | null;
  note: string;
}

/**
 * Was die Fläche mit der Antwort tut. `text` wird angehängt; `hinweis` ist der ehrliche Satz des
 * Servers (kein Dienst, keine Freigabe, vertraulich) — kein Fehler, sondern der Grund, warum es
 * diesmal keinen Text gibt. Erfunden wird nichts.
 */
export type Verschriftung =
  | { readonly art: "text"; readonly text: string; readonly engine: string | null }
  | { readonly art: "hinweis"; readonly note: string };

export function verschriftungAus(antwort: SprachTranskriptAntwort): Verschriftung {
  const text = (antwort.transcript ?? "").replace(/\s+/g, " ").trim();
  if (antwort.engineActive && text.length > 0) {
    return { art: "text", text, engine: antwort.engine };
  }
  return { art: "hinweis", note: antwort.note };
}

/** Der Server kennt `de` und `en`; alles andere verschriftlicht er deutsch. */
export function aufnahmeSprache(sprache: string): "de" | "en" {
  return sprache.toLowerCase().startsWith("en") ? "en" : "de";
}

export interface FertigeAufnahme {
  mime: string;
  base64: string;
  /** Oberflächensprache (`i18n.language`). */
  sprache: string;
  /** Die gewählte Stufe; fehlt sie, behandelt der Server die Aufnahme als vertraulich. */
  vertraulichkeit?: string | undefined;
}

/** Der Rumpf von `POST /api/media/transcribe`. */
export interface AufnahmeRumpf {
  data: string;
  locale: "de" | "en";
  confidentiality?: string;
}

/**
 * Der ganze Weg einer fertigen Aufnahme: Data-URL bauen, senden, Antwort deuten.
 *
 * `senden` ist `endpoints.media.transcribe` — injiziert, damit der Test zählen kann, OB und WAS
 * hinausgeht. Eine leere Aufnahme geht gar nicht erst hinaus.
 */
export async function verschrifteAufnahme(
  aufnahme: FertigeAufnahme,
  senden: (rumpf: AufnahmeRumpf) => Promise<SprachTranskriptAntwort>,
): Promise<Verschriftung | null> {
  if (aufnahme.base64.length === 0) {
    return null;
  }
  const antwort = await senden({
    data: aufnahmeDataUrl(aufnahme.mime, aufnahme.base64),
    locale: aufnahmeSprache(aufnahme.sprache),
    ...(aufnahme.vertraulichkeit ? { confidentiality: aufnahme.vertraulichkeit } : {}),
  });
  return verschriftungAus(antwort);
}

interface AufnahmeUmgebung {
  MediaRecorder?: unknown;
  navigator?: { mediaDevices?: { getUserMedia?: unknown } };
}

/**
 * Kann dieser Browser aufnehmen? `MediaRecorder` und `navigator.mediaDevices.getUserMedia` müssen
 * beide da sein. Über `globalThis` gelesen, weil diese Datei ohne DOM-Typen geprüft wird.
 */
export function aufnahmeMoeglich(umgebung: unknown = globalThis): boolean {
  const g = umgebung as AufnahmeUmgebung | null;
  return (
    typeof g?.MediaRecorder === "function" &&
    typeof g.navigator?.mediaDevices?.getUserMedia === "function"
  );
}
