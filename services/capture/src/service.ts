import { randomUUID } from "node:crypto";
import type { CreateKoInput } from "../../knowledge-object";
import { sanitizeHtml } from "../../structure";
import type { DraftRepo } from "./repo";
import { CaptureError, type Draft, type DraftPayload } from "./types";

export interface CaptureServiceDeps {
  repo: DraftRepo;
  now?: () => number;
  genId?: () => string;
}

// SCRUM-524 P.1 (WP5): Entwürfe sind ein GETEILTER Pool (FR-CAP-06) und ihr bodyHtml wird beim Fortsetzen
// im Editor gerendert. Der bodyHtml wurde bisher ROH persistiert und erst beim Promote zum KO sanitisiert
// → ein gespeicherter <script>/onerror/javascript:-Payload konnte bei einem fremden Resume ausgeführt
// werden (Stored XSS). Fix: an der PERSISTENZ-Grenze (jedes Speichern) serverseitig mit dem etablierten
// Allowlist-Sanitizer säubern — dieselbe harte Grenze wie beim KO (NFR-SEC-04). Gültige Formatierung
// (fett/kursiv/Listen/Links) übersteht das; aktives Markup nicht. Leerer/kein Body bleibt unverändert.
function sanitizeDraftPayload(payload: DraftPayload): DraftPayload {
  if (typeof payload.bodyHtml !== "string" || !payload.bodyHtml.trim()) {
    return payload;
  }
  return { ...payload, bodyHtml: sanitizeHtml(payload.bodyHtml) };
}

function validateMetadata(payload: DraftPayload): void {
  // FR-CAP-08: nötige Validierungen 1–5 (Standard 3 wird erst beim KO gesetzt).
  if (payload.neededValidations !== undefined) {
    const n = payload.neededValidations;
    if (n < 1 || n > 5) {
      throw new CaptureError(
        "INVALID_NEEDED",
        "Nötige Validierungen müssen zwischen 1 und 5 liegen.",
      );
    }
  }
}

export class CaptureService {
  private readonly repo: DraftRepo;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: CaptureServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  async createDraft(rawPayload: DraftPayload, author: string): Promise<Draft> {
    validateMetadata(rawPayload);
    // SCRUM-524 P.1 (WP5): bodyHtml an der Persistenz-Grenze säubern, BEVOR er in den geteilten Pool geht.
    const payload = sanitizeDraftPayload(rawPayload);
    const at = new Date(this.now()).toISOString();
    const draft: Draft = {
      id: this.genId(),
      payload,
      originalAuthor: author,
      lastEditor: author,
      createdAt: at,
      updatedAt: at,
    };
    await this.repo.insert(draft);
    return draft;
  }

  // FR-CAP-06: jeder Schreibberechtigte sieht und nutzt den gemeinsamen Pool.
  listDrafts(): Promise<Draft[]> {
    return this.repo.list();
  }

  getDraft(id: string): Promise<Draft | undefined> {
    return this.repo.findById(id);
  }

  // FR-CAP-07: beim Fortsetzen bleibt der Originalautor erhalten.
  async continueDraft(id: string, changes: DraftPayload, editor: string): Promise<Draft> {
    const draft = await this.require(id);
    const merged: DraftPayload = { ...draft.payload, ...changes };
    validateMetadata(merged);
    // SCRUM-524 P.1 (WP5): auch beim Fortsetzen an der Persistenz-Grenze säubern (neuer/geänderter bodyHtml).
    const updated: Draft = {
      ...draft,
      payload: sanitizeDraftPayload(merged),
      lastEditor: editor,
      updatedAt: new Date(this.now()).toISOString(),
    };
    await this.repo.update(updated);
    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    await this.require(id);
    await this.repo.delete(id);
  }

  // Brücke zu knowledge-object: Autor = Originalautor des Entwurfs (FR-CAP-07).
  async toKoInput(id: string): Promise<CreateKoInput> {
    const draft = await this.require(id);
    const p = draft.payload;
    if (!p.title || !p.statement || !p.type || !p.category) {
      throw new CaptureError(
        "INCOMPLETE",
        "Entwurf hat noch keine vollständigen KO-Pflichtfelder.",
      );
    }
    return {
      title: p.title,
      statement: p.statement,
      type: p.type,
      category: p.category,
      author: draft.originalAuthor,
      conditions: p.conditions ?? [],
      measures: p.measures ?? [],
      tags: p.tags ?? [],
      // SCRUM-395: KEIN hartes 3 mehr — ohne Angabe entscheidet knowledge-object
      // (Admin-Standard-Prüferanzahl, sonst Modul-Default). Explizite Werte bleiben.
      ...(p.neededValidations !== undefined ? { neededValidations: p.neededValidations } : {}),
      asset: p.asset ?? null,
      bodyHtml: p.bodyHtml ?? null, // KW-STR: Body in den KO übernehmen (wird dort sanitisiert)
      // SCRUM-509 R2: die Vertraulichkeitsstufe des Entwurfs ans KO durchreichen (kein Verlust beim
      // Promote). ko.create prüft/lehnt ungültige Werte ab — keine stille Intern-Normalisierung.
      ...(p.confidentiality !== undefined ? { confidentiality: p.confidentiality } : {}),
    };
  }

  private async require(id: string): Promise<Draft> {
    const draft = await this.repo.findById(id);
    if (!draft) {
      throw new CaptureError("NOT_FOUND", "Entwurf nicht gefunden.");
    }
    return draft;
  }
}
