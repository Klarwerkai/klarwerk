// produkt:wettbewerb:20261003:lernplattform — NEUTRALE BEISPIELDATEN, getrennt vom Produktbestand.
//
// Kein Kundendatensatz, keine echten Personen: ein erfundenes Ventil-Beispiel. Die Bausteine bauen
// den Exportdienst mit einem schmalen Bestand im Speicher und einem Medienleser, der genau die hier
// hinterlegten Bilder kennt.
import JSZip from "jszip";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  LmsExportService,
  type ScormEmpfaenger,
  type ScormExportEingabe,
  type ScormMedium,
  type ScormPaket,
} from "../../services/output";

/** Ein echtes 1×1-PNG — klein, aber ein gültiges Bild. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export const REFERENZ_EMPFAENGER: ScormEmpfaenger[] = [
  { id: "moodle-referenz", label: "Moodle 4.5 Referenz" },
];

export function beispielKo(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: `Titel ${p.id}`,
    statement: `Kernaussage ${p.id}`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Beispielanlage",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 2,
    originalAuthor: "beispiel-autor",
    author: "beispiel-autor",
    neededValidations: 2,
    assignments: [],
    confidentiality: "intern",
    asset: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    history: [
      { version: 1, at: "2026-09-01T08:00:00.000Z", author: "beispiel-autor", note: "angelegt" },
      {
        version: 2,
        at: "2026-09-15T08:00:00.000Z",
        author: "beispiel-autor",
        note: "überarbeitet",
      },
    ],
    comments: [],
    attachments: [],
    sources: [],
    ...p,
  } as KnowledgeObject;
}

export function bestand(
  kos: KnowledgeObject[],
  medien: Record<string, ScormMedium> = {},
  empfaenger: ScormEmpfaenger[] = REFERENZ_EMPFAENGER,
): { dienst: LmsExportService; kos: Map<string, KnowledgeObject> } {
  const karte = new Map(kos.map((k) => [k.id, k]));
  const dienst = new LmsExportService({
    koService: { get: async (id: string) => karte.get(id) },
    medien: async (objectId: string) => medien[objectId],
    empfaenger,
  });
  return { dienst, kos: karte };
}

export function eingabe(
  koIds: string[],
  extra: Partial<ScormExportEingabe> = {},
): ScormExportEingabe {
  return { koIds, sprache: "de", empfaenger: "moodle-referenz", ...extra };
}

export async function paketOderFehler(
  dienst: LmsExportService,
  e: ScormExportEingabe,
): Promise<ScormPaket> {
  const r = await dienst.exportiere(e);
  if (!("daten" in r)) {
    throw new Error(`Export blockiert: ${JSON.stringify(r.pruefung.befunde)}`);
  }
  return r;
}

/** Alle Dateien eines Pakets: Textdateien als Zeichenkette, Medien als Bytes. */
export async function entpacke(
  daten: Buffer,
): Promise<{ text: Map<string, string>; bytes: Map<string, Buffer> }> {
  const zip = await JSZip.loadAsync(daten);
  const text = new Map<string, string>();
  const bytes = new Map<string, Buffer>();
  for (const name of Object.keys(zip.files)) {
    const eintrag = zip.files[name];
    if (!eintrag || eintrag.dir) {
      continue;
    }
    const b = await eintrag.async("nodebuffer");
    bytes.set(name, b);
    if (!name.startsWith("medien/")) {
      text.set(name, b.toString("utf8"));
    }
  }
  return { text, bytes };
}
