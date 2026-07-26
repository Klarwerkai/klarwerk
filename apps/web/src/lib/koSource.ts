// Reine, DOM-freie Logik für externe Quellen am KO (SCRUM-129 / FE-KO-07).
import type { KoSource } from "../api/types";
import { DRAFT_LIMITS } from "./draftLimits";

export interface SourceFormInput {
  label: string;
  url: string;
  excerpt: string;
}

export const EMPTY_SOURCE_FORM: SourceFormInput = { label: "", url: "", excerpt: "" };

// Label ist Pflicht; URL/Excerpt optional.
export function isSourceFormValid(input: SourceFormInput): boolean {
  return input.label.trim().length > 0;
}

// AUFTRAG-mega3 Block A (bens Sammel-Review 3, Auflage C): ein teilweise ausgefülltes Quellenformular
// ist „schmutzig", sobald IRGENDEIN Feld vom leeren Ausgangswert (EMPTY_SOURCE_FORM) abweicht — auch
// wenn NUR das optionale URL-/Excerpt-Feld getippt wurde (dann ist es noch nicht `valid`, aber sehr wohl
// veränderter, verwerfbarer Inhalt). Grundlage des kanonischen Verwerfen-/Navigations-Prädikats.
export function isSourceFormDirty(input: SourceFormInput): boolean {
  return (
    input.label.trim().length > 0 || input.url.trim().length > 0 || input.excerpt.trim().length > 0
  );
}

// AUFTRAG-mega6 Block A (bens ROT 1): SPIEGEL der serverseitigen Allowlist (safeHttpUrl /
// normalizeSourceForm in services/capture/src/service.ts). Die Allowlist selbst bleibt unverändert —
// sie ist richtig. Falsch war nur, dass die Oberfläche sie nicht kannte: eine halb getippte
// („www.beispiel…") oder aktive („javascript:…") Adresse wurde beim Speichern serverseitig auf den
// Leerstring gesetzt, der Client räumte danach sein Formular und verglich die Antwort nicht — das
// Fragment verschwand STILL. Mit diesem Prädikat kann die Grenze VOR dem Save benannt werden.
//
// Ein leeres Feld ist „speicherbar": es gibt nichts zu verlieren.
export function isSavableSourceUrl(url: string): boolean {
  // Der Server schneidet vor dem Parsen auf die Längengrenze zu — hier identisch, damit beide
  // Seiten dieselbe Zeichenkette beurteilen.
  const candidate = url.trim().slice(0, DRAFT_LIMITS.sourceUrl);
  if (candidate.length === 0) {
    return true;
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Für die Anzeige gekürzt — eine sehr lange Adresse soll den Grenzen-Dialog nicht sprengen.
const URL_ECHO_LEN = 80;

// Alle nicht speicherbaren Adressen aus Quellenformular UND Warteliste, dedupliziert und
// anzeigefertig. Strukturell typisiert (kein Import aus captureSources → kein Zyklus).
export function unsavableSourceUrls(
  form: Pick<SourceFormInput, "url">,
  pending: readonly { url?: string }[],
): string[] {
  const candidates = [form.url, ...pending.map((p) => p.url ?? "")]
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && !isSavableSourceUrl(u));
  return [...new Set(candidates)].map((u) =>
    u.length > URL_ECHO_LEN ? `${u.slice(0, URL_ECHO_LEN)}…` : u,
  );
}

// AUFTRAG-mega15 Block B (bens SB-4): DER Vertrag der add-source-Aktion, wie ihn
// `apps/web/src/api/endpoints.ts` (KoAction) deklariert und der Server erwartet — Label, Adresse,
// Auszug. KEIN Herkunftsfeld: die Herkunft leitet der Server aus der Adresse ab
// (services/external-search/src/provenance.ts). Bis mega14 schickten zwei Aufrufstellen trotzdem
// ein `provider` mit; der deklarierte Typ kannte es nicht (Strukturtypisierung greift bei
// Variablen nicht) und der Server richtete seine Sperre danach aus — genau die Vertragsdrift,
// die bens SB-4 benennt. `toAddSourceRequest` ist die eine Stelle, die das abschneidet.
//
// AUFTRAG-mega16 Block A: dazu kommt `objectId` — der ANKER einer adresslosen Belegstelle. Er ist
// KEIN Herkunftsfeld: der Server liest ihn nicht als Behauptung, sondern schlägt ihn in der
// Anhangsliste DIESES Wissensobjekts nach. Ein erfundener Wert findet dort nichts.
export interface AddSourceRequest {
  label: string;
  url?: string;
  excerpt?: string;
  objectId?: string;
}

export function toAddSourceRequest(source: {
  label: string;
  url?: string | null;
  excerpt?: string | null;
  objectId?: string | null;
}): AddSourceRequest {
  const request: AddSourceRequest = { label: source.label };
  if (source.url) {
    request.url = source.url;
  }
  if (source.excerpt) {
    request.excerpt = source.excerpt;
  }
  if (source.objectId) {
    request.objectId = source.objectId;
  }
  return request;
}

// Payload für die add-source-Aktion (leere Optionalfelder weglassen).
export function toSourcePayload(input: SourceFormInput): AddSourceRequest {
  const payload: AddSourceRequest = { label: input.label.trim() };
  if (input.url.trim()) {
    payload.url = input.url.trim();
  }
  if (input.excerpt.trim()) {
    payload.excerpt = input.excerpt.trim();
  }
  return payload;
}

// Badge-Schlüssel: externe Quellen sind nie peer-validiert → klare Stufe-2-Markierung.
export function sourceBadgeKey(source: Pick<KoSource, "peerValidated">): string {
  return source.peerValidated ? "ko.sourceValidated" : "ko.sourceUnvalidated";
}
