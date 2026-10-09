// Reiner, DOM-freier JSON-Parser für den Re-Import (SCRUM-108).
// Validiert die Eingabe streng → keine stille Übernahme kaputter Daten.
import type { Confidentiality, ImportItemInput, KnowledgeType } from "../api/types";

const TYPES: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];

const isString = (value: unknown): value is string => typeof value === "string";
// Eine Prüfquelle für Ablehnung, Formatangabe und Mindestvorlage.
const FIELD_CHECKS = {
  title: isString,
  statement: isString,
  category: isString,
  type: (value: unknown) => isString(value) && TYPES.includes(value as KnowledgeType),
};

// ================================================================================================
// R-0139 / R-0169 (Nacharbeit 2, bens F1) — DIE OPTIONALEN QUELLANGABEN EINER DATEI.
// ================================================================================================
//
// Ein Eintrag darf seine Herkunft mitbringen: Anbieter, Kennung im Quellsystem, Quellfassung und
// Quell-URL. Bis hierher fielen sie in diesem Parser weg, und der Server sah sie nie. KEINE
// Pflichtfelder — `FIELD_CHECKS`, die Mindestvorlage und ihr Format bleiben unverändert. Fehlt ein
// Feld, ist es ehrlich „nicht geliefert"; ist es geliefert und unbrauchbar, wird der Eintrag mit
// dem Feldnamen abgelehnt (gleiche Meldung wie bei den Pflichtfeldern), statt still zu fallen.
//
// Die Grenzen sind die des Servers: Quellfassung ganzzahlig 0..999 999 999 (`MAX_SOURCE_VERSION`,
// services/library-analytics/src/repo.ts — hier abgeschrieben, weil der Webbau `services/` nicht
// einbindet), Quell-URL absolut http/https (`safeSourceUrl`, knowledge-object/src/source-url.ts).
const MAX_QUELLFASSUNG = 999_999_999;

const gefuellt = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const fehltOderLeer = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

function istQuellUrl(value: unknown): boolean {
  if (!gefuellt(value)) {
    return false;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function istQuellfassung(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  return (
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_QUELLFASSUNG
  );
}

// R-0179 (Nacharbeit 3, Bens Befund „veraltet"): der STAND der Quelle — wann der Inhalt dort zuletzt
// geändert wurde. Dieselbe Form wie `istImportZeitpunkt` des Servers
// (services/library-analytics/src/types.ts): volle ISO-Zeit mit Zone, ein gültiger Tag. Nur daraus
// kann die Befundübersicht „veraltet" bewerten; ohne Stand bleibt der Eintrag „nicht bewertet".
// BEWUSST KEIN ABLEHNUNGSGRUND: ein eigener Bibliotheksexport trägt `updatedAt` des Objekts, und
// ein Altbestandswert in anderer Form darf den Wiederimport nicht abweisen. Ein unbrauchbarer Stand
// reist nicht mit — der Eintrag ist dann für „veraltet" ehrlich nicht bewertet.
const IMPORT_ZEITPUNKT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function istQuellStand(value: unknown): value is string {
  return (
    typeof value === "string" && IMPORT_ZEITPUNKT.test(value) && Number.isFinite(Date.parse(value))
  );
}

// ================================================================================================
// R-0179 (Nacharbeit 4, Bens Befund) — DIE EINSTUFUNG DER QUELLE REIST MIT.
// ================================================================================================
//
// Bis hierher fiel `confidentiality` in diesem Parser weg: eine Datei, die „vertraulich" einstufte,
// kam ohne Einstufung beim Server an — und die Befundübersicht nannte sie „bewertet, ohne
// Schutzbefund". Jetzt gilt derselbe Vertrag wie an der Ingest-Grenze des Servers
// (`sanitizeImportConfidentiality`, services/library-analytics/src/service.ts):
//   · fehlt die Angabe oder ist sie leer → sie fehlt (beim Anlegen gilt „intern", N11);
//   · ein gültiger Wert bleibt; Gross-/Kleinschreibung und „streng vertraulich" mit Leer- oder
//     Bindestrich werden auf den Schlüssel gebracht (Tabellen schreiben ihn selten wörtlich);
//   · jeder andere gesetzte Wert wird RESTRIKTIV „vertraulich" — nie still verworfen und nie
//     herabgestuft. Kein Ablehnungsgrund: eine unklare Einstufung ist ein Schutzsignal, kein
//     Formfehler.
const EINSTUFUNGEN: readonly Confidentiality[] = ["intern", "vertraulich", "streng_vertraulich"];

export function einstufungAusDatei(value: unknown): Confidentiality | undefined {
  if (fehltOderLeer(value)) {
    return undefined;
  }
  const schluessel =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  return EINSTUFUNGEN.find((e) => e === schluessel) ?? "vertraulich";
}

const QUELL_CHECKS: Record<string, (value: unknown) => boolean> = {
  provider: (value) => fehltOderLeer(value) || gefuellt(value),
  externalId: (value) => fehltOderLeer(value) || gefuellt(value),
  sourceVersion: istQuellfassung,
  url: (value) => fehltOderLeer(value) || istQuellUrl(value),
  // R-0169 (Nacharbeit 5): die INTERNE Dokumentkennung, die Klarwerk beim ersten Import vergeben
  // hat (Importantwort `dokumentFassungen`, Objekt `dokumentHerkunft`). Mitgebracht wird die
  // nächste Fassung derselben Akte. Ob sie hier vergeben wurde, entscheidet der Server — der Parser
  // prüft nur die Form; eine externe `externalId` ist etwas anderes und bleibt getrennt.
  dokumentId: (value) => fehltOderLeer(value) || gefuellt(value),
};

export const IMPORT_JSON_FORMAT = {
  requiredFields: Object.keys(FIELD_CHECKS),
  types: TYPES,
  example: JSON.stringify(
    [
      Object.fromEntries(
        Object.keys(FIELD_CHECKS).map((field) => [field, field === "type" ? TYPES[0] : "..."]),
      ),
    ],
    null,
    2,
  ),
};

type ImportParseKind = "syntax" | "not-array" | "not-object" | "fields";

export class ImportParseError extends Error {
  constructor(
    message: string,
    readonly kind: ImportParseKind,
    readonly index: number | null = null,
    readonly fields: readonly string[] = [],
  ) {
    super(message);
    this.name = "ImportParseError";
  }
}

// Nur vertrauenswürdige Feldnamen und Zähler, niemals Inhalte der fremden Datei.
export function importParseNotice(error: ImportParseError): {
  key: string;
  params: { n: number | null; fields: string; types: string };
} {
  const keys: Record<ImportParseKind, string> = {
    syntax: "imp.json.syntax",
    "not-array": "imp.json.notArray",
    "not-object": "imp.json.notObject",
    fields: "imp.json.fields",
  };
  return {
    key: keys[error.kind],
    params: {
      n: error.index === null ? null : error.index + 1,
      fields: error.fields.join(", "),
      types: TYPES.join(", "),
    },
  };
}

export function parseImportItems(text: string): ImportItemInput[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportParseError("invalid-json", "syntax");
  }
  if (!Array.isArray(data)) {
    throw new ImportParseError("not-array", "not-array");
  }
  return data.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new ImportParseError(`item-${i}-not-object`, "not-object", i);
    }
    const o = raw as Record<string, unknown>;
    const fields = Object.entries(FIELD_CHECKS)
      .filter(([field, accepts]) => !accepts(o[field]))
      .map(([field]) => field);
    // R-0139 / R-0169 (Nacharbeit 2, bens F1): gelieferte Quellangaben werden GEPRÜFT, nicht still
    // verworfen und nicht still repariert — dieselbe Haltung wie bei den Pflichtfeldern oben.
    const quellFehler = Object.entries(QUELL_CHECKS)
      .filter(([field, accepts]) => !accepts(o[field]))
      .map(([field]) => field);
    fields.push(...quellFehler);
    if (fields.length > 0) {
      throw new ImportParseError(`item-${i}-fields`, "fields", i, fields);
    }
    // Die Tabelle oben hat alle Pflichtfelder geprüft.
    const item: ImportItemInput = {
      title: o.title as string,
      statement: o.statement as string,
      type: o.type as KnowledgeType,
      category: o.category as string,
    };
    if (Array.isArray(o.tags)) {
      item.tags = o.tags.filter((t): t is string => typeof t === "string");
    }
    if (typeof o.author === "string") {
      item.author = o.author;
    }
    // UX-20b-R (Bens Befund R-0150/R-1731): die Urheberin reist mit. Ein eigener Export trägt sie
    // als `originalAuthor`; fiel das Feld hier weg, machte der Server den früheren `author` (den
    // Reviewer der Quellinstanz) zum Wissensträger. Nur nicht-leerer Text — wie beim Volltext unten.
    if (typeof o.originalAuthor === "string" && o.originalAuthor.trim().length > 0) {
      item.originalAuthor = o.originalAuthor;
    }
    // ==========================================================================================
    // JOB 4293 — DER VOLLTEXT REIST MIT, ODER ER FEHLT EHRLICH.
    // ==========================================================================================
    //
    // WAS FALSCH WAR: Diese Funktion baute das Item aus genau sechs Feldern. Ein exportiertes
    // Wissensobjekt trägt daneben `bodyHtml` — den ganzen Dokumenttext. Er fiel HIER weg, noch
    // bevor irgendein Dienst ihn sehen konnte; der Nutzer sah eine erfolgreiche Übernahme und
    // hatte danach nur noch den Anriss. Der Server konnte es die ganze Zeit
    // (`services/library-analytics/src/types.ts`, `ImportItem.bodyHtml`).
    //
    // KEIN PFLICHTFELD: `FIELD_CHECKS` bleibt unangetastet. Eine Datei ohne Volltext ist weiterhin
    // gültig und wird weiterhin angenommen — die Prüfkarte sagt dann, dass dieser Eintrag keinen
    // Volltext trägt (`imp.fullText.missing`), statt einen zu behaupten.
    //
    // KEINE REKONSTRUKTION AUS `statement`: fehlt der Volltext in der Datei, fehlt er. `statement`
    // ist seit JOB 2703 der ERSTE ABSATZ (höchstens 500 Zeichen) und nicht der Text; ihn hier
    // einzusetzen hiesse, eine Vollständigkeit zu behaupten, die niemand geliefert hat.
    //
    // NICHT-LEER als Bedingung, wie bei `textfeld` in `importTextVolltext.ts`: ein `""` oder
    // `"   "` ist kein Volltext, sondern ein leeres Feld — und es würde die Karte dazu bringen,
    // einen leeren Kasten aufzuklappen, statt die Grenze zu benennen.
    if (typeof o.bodyHtml === "string" && o.bodyHtml.trim().length > 0) {
      item.bodyHtml = o.bodyHtml;
    }
    // R-0139 / R-0169 (Nacharbeit 2): die geprüften Quellangaben reisen mit. Leerer Text zählt als
    // nicht geliefert (wie beim Volltext); `QUELL_CHECKS` oben hat Form und Wertebereich geprüft.
    if (gefuellt(o.provider)) {
      item.provider = o.provider.trim();
    }
    if (gefuellt(o.externalId)) {
      item.externalId = o.externalId.trim();
    }
    if (typeof o.sourceVersion === "number") {
      item.sourceVersion = o.sourceVersion;
    }
    if (gefuellt(o.url)) {
      item.url = o.url.trim();
    }
    if (gefuellt(o.dokumentId)) {
      item.dokumentId = o.dokumentId.trim();
    }
    if (istQuellStand(o.updatedAt)) {
      item.updatedAt = o.updatedAt;
    }
    // R-0179 (Nacharbeit 4): die Einstufung der Quelle — Regel an `einstufungAusDatei`.
    const einstufung = einstufungAusDatei(o.confidentiality);
    if (einstufung !== undefined) {
      item.confidentiality = einstufung;
    }
    return item;
  });
}
