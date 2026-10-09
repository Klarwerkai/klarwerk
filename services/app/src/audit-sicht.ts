// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — WAS DAS PROTOKOLL ÜBER EIN OBJEKT ZEIGEN DARF.
// ================================================================================================
//
// Das Prüfprotokoll steht jedem mit `ko.validate` offen. `ko.validate` öffnet aber nicht jedes
// Objekt: ein führender Space bleibt geschlossen, auch für Controller und Admin (`sichtbarkeit.ts`,
// `spaceErlaubt`), und ein Objekt im Papierkorb oder endgelöscht ist gar nicht mehr zu öffnen.
// Einige Einträge tragen dennoch eine KOPIE von Objektangaben in ihrer Nutzlast — `answer.helpful`
// und `answer.not_helpful` den Titel (`koTitle`), die Metadatenwechsel Kategorie, Schlagworte,
// Fachgebiet und Geltung (`vorher`/`nachher`), `overlap.in-progress` einen Freitext (`note`)
// (Inventar: docs/datenschutz/pruefprotokoll-nutzdaten.md). Über das Protokoll, seine Seiten und
// seinen Export käme damit ein Titel heraus, den dieselbe Person am Objekt selbst nicht lesen darf.
//
// DIESE DATEI STELLT KEINE NEUE SICHTBARKEITSFRAGE. Sie stellt dieselbe Frage wie jeder Leseweg —
// `darfSehen` aus `./sichtbarkeit` — und wendet die Antwort auf zwei Dinge an:
//
//   1. OBJEKTTITEL UND RÜCKLINK. Die Verwalteransicht nennt den betroffenen Beitrag beim Titel und
//      verlinkt ihn — aber nur, wenn der Betrachter ihn JETZT öffnen darf. Sonst bleibt es bei der
//      Kennung, die das Protokoll ohnehin trägt.
//   2. INHALTSFELDER IN DER NUTZLAST. Ist auch nur ein Bezugsobjekt eines Eintrags für den
//      Betrachter nicht (mehr) sichtbar oder nicht auflösbar, gehen die Inhaltsfelder heraus, und
//      der Eintrag sagt ausdrücklich, welche (`geschwaerzt`). Fail-closed: ein endgelöschtes Objekt
//      ist nicht auflösbar, sein Titel bleibt deshalb ebenfalls verborgen.
//
// Die KETTE SELBST bleibt unberührt: gespeichert, gehasht und geprüft wird weiter der vollständige
// Eintrag (`AuditService.verifyReport`, `inspection` im Export). Geschwärzt wird nur die AUSGABE an
// diesen Betrachter.
import type { AuditEntry } from "../../audit";
import type { SessionUser } from "./http";
import { type SichtbarkeitsFakten, darfSehen } from "./sichtbarkeit";

/** Was die Sicht über ein Objekt wissen muss: die Sichtbarkeitsfakten, den Titel, den Papierkorb. */
export type AuditObjektFakten = SichtbarkeitsFakten & {
  title?: unknown;
  deletedAt?: string | null | undefined;
};

export interface AuditObjektZugang {
  get: (id: string) => Promise<AuditObjektFakten | undefined>;
}

/** Ein ausgegebener Eintrag — bei Schwärzung mit den Namen der entfernten Felder. */
export type AuditSichtEintrag = AuditEntry & { geschwaerzt?: string[] };

/** Ein sichtbares Objekt, wie die Verwalteransicht es nennen darf. */
export interface AuditObjektSicht {
  titel: string;
}

/**
 * Die Inhaltsfelder je Aktion (aus dem Nutzdaten-Inventar). Dazu gelten Titelfelder bei JEDER
 * Aktion als Inhalt — ein künftiger Eintrag mit `title` fällt damit nicht still durch.
 */
const INHALT_JE_AKTION: Readonly<Record<string, readonly string[]>> = {
  "answer.helpful": ["koTitle"],
  "answer.not_helpful": ["koTitle"],
  "overlap.in-progress": ["note"],
  "ko.category-changed": ["vorher", "nachher", "category"],
  "ko.tags-changed": ["vorher", "nachher"],
  "ko.domain-changed": ["vorher", "nachher"],
  "ko.geltung-changed": ["vorher", "nachher"],
};
const TITELFELDER: readonly string[] = ["koTitle", "title", "titel"];

/** Die Inhaltsfelder, die DIESER Eintrag tatsächlich trägt. */
export function auditInhaltsfelder(entry: Pick<AuditEntry, "action" | "payload">): string[] {
  const kandidaten = new Set([...(INHALT_JE_AKTION[entry.action] ?? []), ...TITELFELDER]);
  return [...kandidaten].filter((feld) => entry.payload[feld] !== undefined);
}

/**
 * Die Objekte, auf die sich die Inhaltsfelder eines Eintrags beziehen: die Beteiligten eines
 * Befunds (`koIds`), sonst ein ausdrücklich genanntes `koId`, sonst das Ziel des Eintrags.
 */
function bezugsobjekte(entry: AuditEntry): string[] {
  const koIds = entry.payload.koIds;
  if (Array.isArray(koIds)) {
    const ids = koIds.filter((id): id is string => typeof id === "string" && id !== "");
    if (ids.length > 0) {
      return ids;
    }
  }
  const koId = entry.payload.koId;
  if (typeof koId === "string" && koId !== "") {
    return [koId];
  }
  return [entry.target];
}

export interface AuditSicht {
  /** Titel des Objekts, wenn der Betrachter es jetzt öffnen darf — sonst `undefined`. */
  objekt(id: string): Promise<AuditObjektSicht | undefined>;
  /** Der Eintrag, wie ihn dieser Betrachter sehen darf. */
  eintrag(entry: AuditEntry): Promise<AuditSichtEintrag>;
}

/**
 * Die Sicht EINES Betrachters für EINE Antwort. Jedes Objekt wird höchstens einmal gelesen.
 *
 * Fehlt der Zugang (ein Aufbau ohne Objektdienst), ist nichts sichtbar: keine Titel, und
 * Inhaltsfelder werden geschwärzt — enger, nie weiter (dieselbe Richtung wie mega76 Block A).
 */
export function auditSichtFuer(
  user: SessionUser,
  zugang: AuditObjektZugang | undefined,
): AuditSicht {
  const gelesen = new Map<string, Promise<AuditObjektSicht | undefined>>();

  const objekt = (id: string): Promise<AuditObjektSicht | undefined> => {
    if (id === "" || typeof zugang?.get !== "function") {
      return Promise.resolve(undefined);
    }
    let ergebnis = gelesen.get(id);
    if (ergebnis === undefined) {
      ergebnis = zugang.get(id).then(
        (ko) => {
          if (!ko || ko.deletedAt || !darfSehen(user, ko)) {
            return undefined;
          }
          return { titel: typeof ko.title === "string" ? ko.title : "" };
        },
        // Ein Lesefehler ist keine Freigabe.
        () => undefined,
      );
      gelesen.set(id, ergebnis);
    }
    return ergebnis;
  };

  const eintrag = async (entry: AuditEntry): Promise<AuditSichtEintrag> => {
    const felder = auditInhaltsfelder(entry);
    if (felder.length === 0) {
      return entry;
    }
    for (const id of bezugsobjekte(entry)) {
      if ((await objekt(id)) === undefined) {
        const payload = Object.fromEntries(
          Object.entries(entry.payload).filter(([feld]) => !felder.includes(feld)),
        );
        return { ...entry, payload, geschwaerzt: felder };
      }
    }
    return entry;
  };

  return { objekt, eintrag };
}
