// ================================================================================================
// R-0549 / R-0163 (Confluence-Gesamtimport) — WAS DIE QUELLE ÜBER SICH SELBST SAGT.
// ================================================================================================
//
// Drei additive, JSON-persistierte Angaben an einem `ImportItem`: die Leserestriktion der
// Quellseite und ihre Anhänge. Sie stehen BEWUSST NICHT in `types.ts`: diese Datei ist eingefroren
// (FREEZE-144, `tests/library-analytics-freeze144.test.ts`), und eine Freigabe für eine Änderung
// liegt für diesen Auftrag nicht vor. Die Angaben sind deshalb eine ERWEITERUNG des Vertrags, keine
// Änderung: `ImportItem & ImportQuellangaben`. Ein Leser ohne sie liest das Item wie bisher.
//
// Sie sind HERKUNFTSANGABEN, keine Rechte: nichts in Klara verzweigt die Autorisierung über sie
// (s. `services/app/src/sichtbarkeit.ts`, Variante B ist nicht entschieden). Am JSON-Eingang sind
// sie Behauptungen eines Clients und werden deshalb in `saeubereQuellangaben` auf Form und Menge
// begrenzt. Der Confluence-Adapter erzeugt dieselbe Form (`services/confluence/src/mapper.ts`).
import type { ImportLaufBindung } from "./laufbindung";
import type { ImportItem } from "./types";

/** R-0163: ein Anhang eines Quellobjekts, quellneutral. */
interface ImportAttachment {
  externalId: string;
  name: string;
  mime?: string;
  size?: number;
  url?: string;
}

interface ImportQuellangaben {
  // R-0549: die Leserestriktion der Quelle, QUELLNEUTRAL (Gruppennamen, Benutzerkennungen). Nur
  // gesetzt, wenn die Quelle eine liefert; reist bis an den Herkunftsanker des Wissensobjekts.
  sourceReadRestriction?: { groups: string[]; users: string[] };
  // R-0163: die Anhänge des Quellobjekts (Dateiname, Typ, Größe, Abruf-URL). Beim Annehmen wird
  // jeder Anhang eine eigene Quelle am Wissensobjekt. `sourceAttachmentsIncomplete`: die Quelle
  // hat mehr Anhänge gemeldet, als gelesen wurden, oder die Liste war unbrauchbar.
  sourceAttachments?: ImportAttachment[];
  sourceAttachmentsIncomplete?: boolean;
  // R-0142 (Lauf 5): die Bindung an den Importlauf (`laufbindung.ts`). Nur der Server setzt sie;
  // die Säuberung unten entfernt jede mitgelieferte.
  importRun?: ImportLaufBindung;
}

export type ImportItemMitQuellangaben = ImportItem & ImportQuellangaben;

const MAX_QUELL_PRINZIPALE = 200;
// Lauf 3 R3 (Bens B9): der Deckel lag bei 200 — ein Erstimport übernahm von 201 Anhängen nur 200,
// und jede Wiederholung wählte wieder dieselben 200. Er steht jetzt auf der Höchstzahl, die der
// Confluence-Adapter überhaupt liefert (`MAX_ATTACHMENT_HOPS` × 50 in
// `services/confluence/src/rest-client.ts`); darüber ist die Liste als unvollständig markiert und der
// Lauf weist die Seite aus. Clients am JSON-Eingang begrenzt zusätzlich die Körpergrenze der Route.
const MAX_QUELL_ANHAENGE = 10_000;
const MAX_QUELL_TEXT = 512;

function kurzerText(wert: unknown): string | undefined {
  if (typeof wert !== "string") {
    return undefined;
  }
  const t = wert.trim();
  return t.length > 0 && t.length <= MAX_QUELL_TEXT ? t : undefined;
}

function textListe(werte: unknown): string[] {
  if (!Array.isArray(werte)) {
    return [];
  }
  const out = werte.map(kurzerText).filter((w): w is string => w !== undefined);
  return [...new Set(out)].slice(0, MAX_QUELL_PRINZIPALE);
}

/**
 * Die Ingest-Grenze der Quellangaben: nur Zeichenketten, gedeckelte Länge und Anzahl; URLs werden
 * erst beim Bau der Quellen über `safeSourceUrl` geprüft. Nichts davon verleiht ein Recht.
 */
export function saeubereQuellangaben(item: ImportItem): ImportItemMitQuellangaben {
  const {
    sourceReadRestriction: rohRestriktion,
    sourceAttachments: rohAnhaenge,
    sourceAttachmentsIncomplete: rohUnvollstaendig,
    importRun: _clientBindung,
    ...rest
  } = item as ImportItemMitQuellangaben;
  const groups = textListe(rohRestriktion?.groups);
  const users = textListe(rohRestriktion?.users);
  const anhaenge: ImportAttachment[] = [];
  // Lauf 3 R2 (Bens B2): jeder hier VERWORFENE Eintrag — unbrauchbar oder über dem Deckel — macht
  // die Liste unvollständig. Sonst hielte die Annahme einen vorhandenen, nur lokal abgeschnittenen
  // Anhang für in der Quelle entfernt und nähme ihn vom Objekt.
  let verworfen = false;
  for (const a of Array.isArray(rohAnhaenge) ? rohAnhaenge : []) {
    const externalId = kurzerText(a?.externalId);
    const name = kurzerText(a?.name);
    if (!externalId || !name || anhaenge.length >= MAX_QUELL_ANHAENGE) {
      verworfen = true;
      continue;
    }
    const mime = kurzerText(a.mime);
    const url = typeof a.url === "string" && a.url.length <= 4096 ? a.url : undefined;
    anhaenge.push({
      externalId,
      name,
      ...(mime ? { mime } : {}),
      ...(typeof a.size === "number" && Number.isFinite(a.size) && a.size >= 0
        ? { size: a.size }
        : {}),
      ...(url ? { url } : {}),
    });
  }
  return {
    ...rest,
    ...(groups.length > 0 || users.length > 0 ? { sourceReadRestriction: { groups, users } } : {}),
    ...(anhaenge.length > 0 ? { sourceAttachments: anhaenge } : {}),
    ...(rohUnvollstaendig === true || verworfen ? { sourceAttachmentsIncomplete: true } : {}),
  };
}
