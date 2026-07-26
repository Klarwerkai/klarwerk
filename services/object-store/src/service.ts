import { randomUUID } from "node:crypto";
import type { ObjectRepo } from "./repo";
import {
  MAX_OBJECT_BYTES,
  OBJECT_RETENTION_DAYS,
  ObjectError,
  type ObjectKind,
  type ObjectLifecycle,
  type ObjectPurpose,
  type ObjectRef,
  type StoredObject,
} from "./types";

export interface ObjectStoreDeps {
  repo: ObjectRepo;
  now?: () => number;
  genId?: () => string;
}

// SCRUM-45/46/48: Data-URL in rohe Bytes + MIME zerlegen (für den /raw-Bild-Endpoint).
// Rein/DOM-frei; gibt null bei nicht-base64-Data-URLs zurück.
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) {
    return null;
  }
  return { mime: m[1] as string, bytes: Buffer.from(m[2] as string, "base64") };
}

export interface PutObjectInput {
  name: string;
  mime: string;
  data: string;
  kind?: ObjectKind;
  // SCRUM-521 (WP1): beim Upload persistierte Vertraulichkeit (Level-String). Fehlt sie, bleibt sie
  // undefined → der Medien-Egress behandelt das Objekt fail-safe als vertraulich.
  confidentiality?: string;
  // AUFTRAG-mega20 Block C: WOZU wird hochgeladen? Optional im Typ (der Aufrufer muss nichts
  // erfinden), aber NIE geraten: fehlt die Angabe, steht am Objekt ausdrücklich „unknown" — und
  // „unknown" ist die konservativste Einstufung, nicht die bequemste.
  purpose?: ObjectPurpose;
  /** Wer hochlädt (Nutzer-Id). Herkunftsangabe, keine Berechtigung. */
  owner?: string;
  /** An welchen Entwurf das Objekt (vorläufig) gebunden ist. */
  draftId?: string;
}

// Leitet die Objektart aus dem MIME-Typ ab (überschreibbar via input.kind).
export function inferKind(mime: string): ObjectKind {
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/") || mime.startsWith("audio/")) {
    return "video";
  }
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("word")) {
    return "document";
  }
  return "binary";
}

export class ObjectStore {
  private readonly repo: ObjectRepo;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: ObjectStoreDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // SCRUM-121: Original/Binary ablegen → ObjectRef (nur Metadaten) zurück.
  async put(input: PutObjectInput): Promise<ObjectRef> {
    if (!input.name?.trim() || !input.mime?.trim()) {
      throw new ObjectError("INVALID", "name/mime fehlt.");
    }
    if (!input.data || input.data.length === 0) {
      throw new ObjectError("INVALID", "Kein Inhalt.");
    }
    if (input.data.length > MAX_OBJECT_BYTES) {
      throw new ObjectError("INVALID", "Objekt zu groß.");
    }
    const at = this.now();
    // AUFTRAG-mega20 Block C: die Lebenszyklus-Zuordnung entsteht im SELBEN Schreibvorgang wie das
    // Objekt. Ein zweiter Schritt könnte scheitern und ließe ein Objekt ohne Zuordnung zurück —
    // genau den Zustand, den dieser Block beseitigt.
    const lifecycle: ObjectLifecycle = {
      purpose: input.purpose ?? "unknown",
      ...(input.owner?.trim() ? { owner: input.owner.trim() } : {}),
      ...(input.draftId?.trim() ? { draftId: input.draftId.trim() } : {}),
      retainUntil: new Date(at + OBJECT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
    const ref: ObjectRef = {
      id: this.genId(),
      name: input.name,
      mime: input.mime,
      size: input.data.length,
      kind: input.kind ?? inferKind(input.mime),
      createdAt: new Date(at).toISOString(),
      lifecycle,
      // SCRUM-521 (WP1): Vertraulichkeit nur persistieren, wenn ein bekannter Level angegeben ist.
      ...(input.confidentiality ? { confidentiality: input.confidentiality } : {}),
    };
    await this.repo.insert({ ref, data: input.data });
    return ref;
  }

  // Vollständiges Objekt (Referenz + Inhalt) lesen.
  read(id: string): Promise<StoredObject | undefined> {
    return this.repo.findById(id);
  }

  // Nur Metadaten (ObjectRef) lesen.
  async metadata(id: string): Promise<ObjectRef | undefined> {
    return (await this.repo.findById(id))?.ref;
  }

  /**
   * AUFTRAG-mega20 Block C: der Bestand als reine METADATEN-Liste.
   *
   * Bewusst ohne Bytes — ein Lauf über den Bestand darf nicht sämtliche Originale in den Speicher
   * ziehen (bei 22-MB-PDFs wäre das der sichere Weg in den Absturz). Wer Inhalte braucht, liest
   * sie einzeln über `read`.
   */
  list(): Promise<ObjectRef[]> {
    return this.repo.list();
  }

  /**
   * AUFTRAG-mega20 Block C: ein Objekt ENDGÜLTIG entfernen.
   *
   * Es gab bis mega19 keinen Weg, ein hochgeladenes Objekt wieder loszuwerden — der Store war
   * append-only. Diese Methode schließt die Lücke im DATENVERTRAG; sie entscheidet NICHT, WANN
   * gelöscht werden darf. Der Waisen-Sweep ist ausdrücklich nicht Teil dieses Blocks, und diese
   * Methode ruft von sich aus niemand auf.
   *
   * Rückgabe `false` heißt „war nicht da" — kein Fehler: ein bereits entferntes Objekt ist genau
   * der Zustand, den der Aufrufer wollte.
   */
  delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}

/**
 * AUFTRAG-mega20 Block C: liegt das Objekt noch in seiner konservativen Schutzfrist?
 *
 * DIE ANTWORT AUF „laufender Upload gilt nicht als Waise". Zwischen Upload und erster Referenz
 * liegt ein Fenster, in dem das Objekt real unreferenziert ist und trotzdem gebraucht wird — der
 * Nutzer tippt noch, der Entwurf ist noch nicht gespeichert, der Einreich-Vorgang läuft noch.
 *
 * Altbestand OHNE Zuordnung gilt IMMER als geschützt (`true`). Das ist bewusst die unbequeme
 * Richtung: über ein Objekt ohne Zuordnung weiß niemand, wozu es da ist, und ein Lauf, der genau
 * darüber hinweggeht, würde zuerst die ältesten und damit am schwersten ersetzbaren Originale
 * treffen.
 */
export function isWithinRetention(ref: ObjectRef, now: number): boolean {
  const until = ref.lifecycle?.retainUntil;
  if (!until) {
    return true;
  }
  const parsed = Date.parse(until);
  if (Number.isNaN(parsed)) {
    return true; // unlesbare Frist ⇒ geschützt. Nie fail-open bei einer Löschentscheidung.
  }
  return now < parsed;
}

/**
 * AUFTRAG-mega20 Block C: ist das ein TRANSIENTES Medium?
 *
 * Der Marker existiert, damit ein späterer Lauf ein Analyse-Medium NICHT für einen verwaisten
 * Anhang hält. Beides ist unreferenziert; nur eines war je dafür gedacht, referenziert zu werden.
 * Ohne diese Unterscheidung müsste ein Sweep entweder alle Medien behalten (dann räumt er nichts
 * auf) oder alle unreferenzierten Objekte löschen (dann trifft er Anker).
 */
export function isTransientMedia(ref: ObjectRef): boolean {
  return ref.lifecycle?.purpose === "media";
}
