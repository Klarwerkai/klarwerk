// ================================================================================================
// R-0170 — JIRA-VORGANG → NORMALISIERTES ImportItem (der quell-agnostische Import-Vertrag).
// ================================================================================================
//
// Der Import-Kern (`library-analytics`) kennt Jira nicht; nur dieser Mapper übersetzt die Jira-
// Domäne in die generischen Felder, die SCRUM-510 R2b dafür vorbereitet hat (`types.ts`:
// „Jira-Issue-Key", „Jira-Projekt", „Epic/Projekt"). Kein zweiter Kern, kein zweiter Weg.
//
//   Vorgang/Epic        → Titel (summary), Kernaussage und Volltext (description)
//   Schlüssel + Projekt → `externalId` (Re-Sync-Anker) und `sourceScope`/`category`
//   übergeordneter Vg.  → `sourcePath` (z. B. das Epic einer Story) — nur die EINE gelieferte Ebene
//   Projektrollen       → `sourceRestrictions` (Benutzer- und Gruppenkennungen der Quelle)
//   Sicherheitsstufe    → `confidentiality`
//
// ================================================================================================
// DIE PROJEKTROLLEN ALS LESERECHTE — WAS DAS HIER HEISST, UND WAS NICHT.
// ================================================================================================
//
// Wer über eine Projektrolle im Projekt steht, ist der Kreis, dem Jira den Vorgang zugänglich macht.
// Diese Kennungen reisen als `sourceRestrictions` bis an den Herkunftsanker des Wissensobjekts
// (`library-analytics` `buildSource`) — DIESELBE Form, die Confluence für die Leseeinschränkung einer
// Seite füllt (`KoSourceRestrictions`, package:confluence K6).
//
// KEINE RECHTEABBILDUNG IN KLARWERK. `KoSourceRestrictions` ist ausdrücklich eine Herkunftsangabe;
// kein Zugriffspfad wertet sie aus, und wie Quellkennungen auf KLARWERK-Konten wirken, gehört dem
// gesonderten Rechteauftrag (Entscheidung a7834397). Dieser Mapper nimmt das nicht vorweg.
//
// GELESEN WERDEN DIE ROLLEN, NICHT DAS BERECHTIGUNGSSCHEMA. Ob eine Rolle im Schema des Projekts
// „Projekte durchsuchen" trägt, steht in einem weiteren Vertrag, den dieser Mapper nicht liest. Der
// Zielzustand R-0170 nennt die Projektrollen als Leserechte — genau das wird übernommen.
//
// ================================================================================================
// DIE VERTRAULICHKEIT
// ================================================================================================
//
// Trägt der Vorgang eine Sicherheitsstufe (`fields.security`), ist er enger lesbar als das Projekt
// → „vertraulich". Ohne Stufe gilt er im Projekt als lesbar → „intern" — dieselbe Regel, die der
// Confluence-Mapper seit JOB 3089 (Pedis Entscheidung 23) für eine nicht eingeschränkte Seite eines
// Bereichs anwendet. Beide Fälle sind entschieden; das Feld steht deshalb immer.
//
// ================================================================================================
// DER QUELLSTAND
// ================================================================================================
//
// Ein Vorgang hat keine Revisionsnummer; er hat `updated`. Der Quellstand ist dieser Zeitpunkt IN
// MINUTEN seit 1970. Fehlt der Zeitpunkt oder ist er unlesbar, FEHLT das Feld.
//
// WARUM MINUTEN UND NICHT SEKUNDEN (Nacharbeit 1, gemessener Befund): Der Import-Kern weist einen
// Ankereintrag mit einer Fassung über `MAX_SOURCE_VERSION` = 999_999_999 ab
// (`library-analytics/src/repo.ts`, geprüft in `pruefeAnkerEintrag`) — die Grenze schützt die
// `::int`-Spalte. Sekunden seit 1970 liegen 2026 bei rund 1,79 Milliarden; JEDER Vorgang wurde damit
// als `LibraryError` abgewiesen, und kein Kandidat entstand. Minuten liegen 2026 bei rund 29,8
// Millionen und bleiben bis ins Jahr ~3870 unter der Grenze.
//
// ZWEI ÄNDERUNGEN IN DERSELBEN MINUTE (Nacharbeit 2, Bens Befund): sie ergeben hier denselben
// Quellstand. Unterschieden werden sie im Übernahmeweg (`services/app/src/routes/jira-import-
// routes.ts`, `naechsterStand`): ist der Stand nicht höher als der bekannte, der INHALT aber neu,
// wird der Vorgang unter `bekannt + 1` eingereiht; nur ein unveränderter Inhalt gilt als „schon da".

import type { Confidentiality, KoSourceRestrictions } from "../../knowledge-object";
import type { ImportItem } from "../../library-analytics";
import { kernaussageAusKlartext } from "../../structure";
import type { JiraIssue, JiraRollenbesetzung } from "./rest-client";

/** Der Anbietername am Herkunfts-Anker — der Schlüsselanteil des Re-Sync (provider+externalId). */
export const JIRA_PROVIDER = "Jira";

export interface JiraMapOptions {
  /** Basisadresse der Instanz — für die Originaladresse `…/browse/KEY`. */
  baseUrl: string;
  /** Der Projektschlüssel — landet als Kategorie und als quellneutraler Container-Anker. */
  projectKey: string;
  /**
   * Die gelesene Besetzung der Projektrollen. FEHLT sie, wurde sie nicht gelesen (Auswahlliste) —
   * dann entsteht kein `sourceRestrictions`. Der Übernahmeweg liest sie immer (adapter.ts).
   */
  rollen?: JiraRollenbesetzung;
}

/** Ein Epic: Jira führt es als Vorgangstyp der Hierarchiestufe 1 (Cloud) bzw. unter dem Namen „Epic". */
export function istEpic(issue: JiraIssue): boolean {
  const typ = issue.fields?.issuetype;
  return typ?.hierarchyLevel === 1 || typ?.name?.trim().toLowerCase() === "epic";
}

/**
 * `updated` → ISO-Zeichenkette. Jira schreibt den Versatz ohne Doppelpunkt (`+0200`); daraus wird
 * `+02:00`, damit jeder Leser denselben Zeitpunkt liest. `undefined`, wenn unlesbar.
 */
export function jiraZeitpunkt(roh: string | undefined): string | undefined {
  const wert = roh?.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (!wert) {
    return undefined;
  }
  const ms = Date.parse(wert);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined;
}

/** Der Quellstand eines Vorgangs — Minuten seit 1970, oder `undefined` (nie eine Ersatzzahl). */
export function jiraQuellstand(issue: JiraIssue): number | undefined {
  const iso = jiraZeitpunkt(issue.fields?.updated);
  return iso === undefined ? undefined : Math.floor(Date.parse(iso) / 60_000);
}

/**
 * Die Projektrollen als Leserechte — oder `undefined`, wenn die Besetzung nicht gelesen wurde oder
 * keine einzige Kennung trägt. Kein leeres Objekt, das wie eine Angabe aussähe.
 */
export function jiraLeserechte(
  rollen: JiraRollenbesetzung | undefined,
): KoSourceRestrictions | undefined {
  if (!rollen || (rollen.users.length === 0 && rollen.groups.length === 0)) {
    return undefined;
  }
  return { users: [...rollen.users], groups: [...rollen.groups] };
}

function vertraulichkeit(issue: JiraIssue): Confidentiality {
  return issue.fields?.security ? "vertraulich" : "intern";
}

/**
 * Klartext → der HTML-Rumpf des Import-Vertrags: maskiert, Absätze erhalten. Jira-Wiki-Markup wird
 * NICHT gedeutet — es bleibt zeichengleich als Text stehen (dieselbe Zurückhaltung wie der
 * SharePoint-Mapper bei Klartextdateien).
 */
function klartextAlsHtml(text: string): string {
  const maskiere = (s: string): string =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((absatz) => absatz.trim())
    .filter((absatz) => absatz.length > 0)
    .map((absatz) => `<p>${maskiere(absatz).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

/**
 * Vorgang → ImportItem. Wirft NICHT: ein Vorgang ohne Schlüssel oder ohne Titel ist keine
 * importierbare Quelle, und `undefined` sagt das dem Aufrufer.
 */
export function mapJiraIssueToImportItem(
  issue: JiraIssue,
  opts: JiraMapOptions,
): ImportItem | undefined {
  const key = issue.key?.trim();
  const titel = issue.fields?.summary?.trim();
  if (!key || !titel) {
    return undefined;
  }
  const roh = issue.fields?.description;
  const beschreibung = typeof roh === "string" && roh.trim().length > 0 ? roh : undefined;
  const typ = issue.fields?.issuetype?.name?.trim();
  const rohLabels: unknown = issue.fields?.labels;
  const labels = (Array.isArray(rohLabels) ? rohLabels : [])
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const tags = [...new Set([...(typ ? [typ] : []), ...labels])];
  const elternteil = issue.fields?.parent?.fields?.summary?.trim();
  const autor =
    issue.fields?.reporter?.displayName?.trim() || issue.fields?.creator?.displayName?.trim();
  const stand = jiraQuellstand(issue);
  const geaendert = jiraZeitpunkt(issue.fields?.updated);
  const leserechte = jiraLeserechte(opts.rollen);
  return {
    title: titel,
    // Die Kernaussage ist der Anfang der Beschreibung, sonst der Titel — beides steht in der Quelle.
    statement: beschreibung ? kernaussageAusKlartext(beschreibung) || titel : titel,
    type: "best_practice",
    category: opts.projectKey,
    ...(autor ? { author: autor } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    confidentiality: vertraulichkeit(issue),
    externalId: key,
    sourceScope: opts.projectKey,
    // Die EINE Ebene, die Jira am Vorgang mitliefert (Cloud: das Epic einer Story, der Vorgang
    // eines Untervorgangs). Weiter hinauf wird nicht gelesen und nichts erfunden.
    ...(elternteil ? { sourcePath: [elternteil] } : {}),
    ...(stand !== undefined ? { sourceVersion: stand } : {}),
    ...(leserechte ? { sourceRestrictions: leserechte } : {}),
    url: `${opts.baseUrl.replace(/\/+$/, "")}/browse/${encodeURIComponent(key)}`,
    provider: JIRA_PROVIDER,
    ...(beschreibung ? { bodyHtml: klartextAlsHtml(beschreibung) } : {}),
    ...(geaendert ? { updatedAt: geaendert } : {}),
    // Jira liefert JSON mit bereits dekodierten Zeichenketten — die Anzeige dekodiert NICHT erneut.
    textCodec: "decoded",
  };
}
