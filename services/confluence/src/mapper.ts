// SCRUM-510: Confluence-Seite → normalisiertes ImportItem (der quell-agnostische Import-Vertrag). Der
// Import-Kern (library-analytics) kennt Confluence nicht; nur dieser Mapper übersetzt die Confluence-
// Domäne in die generischen Felder. Titel/Body → KO-Inhalt; Space+pageId+URL → Provenienz/Ursprung (für
// Re-Sync-Idempotenz); Labels → Tags; Read-Restriktionen → Governance-Signal für die Vertraulichkeit.

import type { Confidentiality, KnowledgeType, KoSourceRestrictions } from "../../knowledge-object";
import type { ImportItem } from "../../library-analytics";
// JOB 2703 D2: die EINE Kuerzungsregel liegt in `structure` (D1: library-analytics, umgelegt).
import { kernaussageAusHtml } from "../../structure";
// WP-IC-PAKET-1b (bens ROT-1): decodeHtmlEntities auch für die NICHT-Body-Felder — Confluence liefert
// Entities nicht nur im Storage-HTML, sondern auch in Titel/Autor/Labels.
import { decodeHtmlEntities } from "../../structure";
import { type ConfluenceAttachment, type ConfluencePage, istAnhangsliste } from "./rest-client";
import { confluenceStorageToHtml } from "./storage";

// ================================================================================================
// R-0549 / R-0163 — DIE QUELLANGABEN, DIE DIESER ADAPTER AN EIN ITEM HÄNGT.
// ZUSAMMENFÜHRUNG (Nacharbeit 5): daneben steht mains R-0163-Form für die Dateiinhalte
// (`attachments`/`attachmentsIncomplete`, unten). Beide Felderpaare sind getrennt und reisen
// nebeneinander am Item.
// ================================================================================================
//
// Eine ERWEITERUNG des quellneutralen `ImportItem`, keine Änderung: dessen Typdatei ist eingefroren
// (FREEZE-144). Die Form ist feldgleich mit `ImportQuellangaben` in
// `services/library-analytics/src/quellangaben.ts`; dort ist sie Eingang und wird an der
// Ingest-Grenze gesäubert (`saeubereQuellangaben`), hier ist sie Ausgang. Der Vertrag zwischen
// beiden ist das JSON des Items — deshalb darf es hier keine Form geben, die dort fehlt.
export interface ImportAttachment {
  externalId: string;
  name: string;
  mime?: string;
  size?: number;
  url?: string;
}

// ================================================================================================
// R-0163 — DIE ANHÄNGE EINER SEITE, QUELLNEUTRAL.
// ================================================================================================
//
// `ImportItem` steht unter Freeze-144 (`tests/library-analytics-freeze144.test.ts`), dessen Freigabe
// der Bau nicht zeichnet. Das Feld reist deshalb wie `originalAuthor` als ZUSÄTZLICHES Feld am Item:
// der Import-Kern liest es als fremdes, ungeprüftes Feld (`leseImportAnhaenge` in
// `library-analytics/src/service.ts`) und übernimmt nur, was dort besteht. Die Begriffe sind
// quellneutral — ein Jira-Adapter füllt dieselbe Form.
export interface ConfluenceImportAnhang {
  // Kennung des Anhangs in der Quelle (Confluence: attachment id).
  externalId: string;
  // Dateiname, an der Quelle EINMAL dekodiert (wie Titel/Labels).
  name: string;
  mime: string;
  size?: number;
  sourceVersion?: number;
  // Quellinterner Abrufweg — nur der Adapter derselben Quelle löst ihn auf (`fetchAttachment`).
  abruf: string;
}

export type ConfluenceImportItem = ImportItem & {
  // Diese Lieferung (R-0549/R-0163 Herkunftsangaben).
  sourceReadRestriction?: { groups: string[]; users: string[] };
  sourceAttachments?: ImportAttachment[];
  sourceAttachmentsIncomplete?: boolean;
  // main, R-0163 (Dateiinhalte).
  attachments?: ConfluenceImportAnhang[];
  // Die Anhangsliste konnte nicht oder nicht vollständig gelesen werden. Fehlt das Feld, ist sie
  // vollständig — ein stilles „keine Anhänge" bei einem Lesefehler gibt es nicht.
  attachmentsIncomplete?: true;
  // AUFNAHME 20260922 · confluence-import-rechte: Stufe und Leser der Quelle (s. `ConfluenceQuellrechte`).
  // Der Mapper setzt es immer; optional, weil auch Einträge ohne Quellrechte (Bestand, Fixture-Doppel)
  // durch den Lauf reisen — der Import-Kern liest sie dann als „keine Quellrechte" (`quellrechteVon`).
  quellrechte?: ConfluenceQuellrechte;
};

/**
 * Ein Confluence-Anhang → quellneutraler Import-Anhang, oder `undefined`, wenn eine Pflichtangabe
 * fehlt (Kennung, Dateiname, Abrufweg). Kein geratener Name, kein erfundener Link.
 */
export function mapConfluenceAttachment(
  att: ConfluenceAttachment,
): ConfluenceImportAnhang | undefined {
  const externalId = att.id?.trim();
  const name = att.title ? decodeHtmlEntities(att.title).trim() : "";
  const abruf = att._links?.download?.trim();
  if (!externalId || !name || !abruf) {
    return undefined;
  }
  const mime = (att.extensions?.mediaType ?? att.metadata?.mediaType ?? "").trim().toLowerCase();
  const size = att.extensions?.fileSize;
  return {
    externalId,
    name,
    mime: mime || "application/octet-stream",
    ...(typeof size === "number" && Number.isFinite(size) && size >= 0 ? { size } : {}),
    ...(typeof att.version?.number === "number" ? { sourceVersion: att.version.number } : {}),
    abruf,
  };
}

export interface ConfluenceMapOptions {
  baseUrl: string; // für die absolute Seiten-URL (Provenienz)
  spaceKey: string; // landet als Kategorie/Space-Anker
  defaultType?: KnowledgeType; // Wissensart, wenn die Quelle keine hergibt (Default best_practice)
}

// Eine Seite gilt als eingeschränkt, wenn user- ODER group-Read-Restriktionen gesetzt sind.
export function isPageRestricted(page: ConfluencePage): boolean {
  const read = page.restrictions?.read?.restrictions;
  const users = read?.user?.results ?? [];
  const groups = read?.group?.results ?? [];
  return users.length > 0 || groups.length > 0;
}

// ================================================================================================
// package:confluence (K6) — WER DIE SEITE IN DER QUELLE LESEN DARF, NICHT NUR OB.
// ================================================================================================
//
// `isPageRestricted` darüber verdichtet die Restriktionslisten auf Ja/Nein — für die Einstufung
// (`confidentiality`) genügt das. Für die Nachvollziehbarkeit genügt es nicht: WELCHE Benutzer und
// Gruppen die Quelle zulässt, ging bis hierher verloren, obwohl der Client beide Listen anfordert
// (rest-client.ts, EXPAND `restrictions.read.restrictions.user/group`).
//
// ÜBERNOMMEN WIRD, WAS DIE QUELLE ALS KENNUNG LIEFERT — nichts wird erfunden oder umgedeutet:
//   · Benutzer: `accountId` (Cloud); auf älteren Server-Instanzen `userKey`, sonst `username`.
//   · Gruppen:  `name`, sonst `id`.
// Ein Eintrag ohne eine dieser Kennungen wird nicht geraten, sondern ausgelassen; Doppelte fallen
// weg, die Quell-Reihenfolge bleibt. Liefert die Quelle keine einzige Kennung (offene Seite oder
// leere Listen), FEHLT das Ergebnis — kein leeres Objekt, das wie eine Angabe aussähe.
//
// KEINE RECHTEABBILDUNG: Diese Kennungen sind Herkunftsangaben am Quellenanker. Ob und wie sie auf
// KLARWERK-Konten oder -Rollen wirken, entscheidet der gesonderte Rechteauftrag.
function quellKennung(eintrag: unknown, felder: readonly string[]): string | undefined {
  if (!eintrag || typeof eintrag !== "object") {
    return undefined;
  }
  const werte = eintrag as Record<string, unknown>;
  for (const feld of felder) {
    const wert = werte[feld];
    if (typeof wert === "string" && wert.trim().length > 0) {
      return wert.trim();
    }
  }
  return undefined;
}

function kennungenAus(liste: unknown[] | undefined, felder: readonly string[]): string[] {
  const kennungen: string[] = [];
  for (const eintrag of liste ?? []) {
    const kennung = quellKennung(eintrag, felder);
    if (kennung !== undefined && !kennungen.includes(kennung)) {
      kennungen.push(kennung);
    }
  }
  return kennungen;
}

export function confluenceReadRestrictions(page: ConfluencePage): KoSourceRestrictions | undefined {
  const read = page.restrictions?.read?.restrictions;
  const users = kennungenAus(read?.user?.results, ["accountId", "userKey", "username"]);
  const groups = kennungenAus(read?.group?.results, ["name", "id"]);
  if (users.length === 0 && groups.length === 0) {
    return undefined;
  }
  return { users, groups };
}

// JOB 3089 (N11) — QUELL-GOVERNANCE → VERTRAULICHKEIT. ABLÖSUNG VON SCRUM-511.
//
// DIE REGEL, IN EINEM SATZ: restringiert → „vertraulich", nicht restringiert → „intern" — und
// „intern" ist hier eine ECHTE Einstufung mit einem Erzeuger (die im Quellsystem nachgesehene,
// nicht vorhandene Leseeinschränkung), kein geratener Vorgabewert und kein stiller Default.
//
// WAS ABGELÖST IST: SCRUM-511 stand bis JOB 3089 an dieser Stelle und lautete „NIE ‚intern' aus dem
// Mapper" — eine nicht restringierte Seite lieferte `undefined`, woraus der Import-Kern fail-safe
// „vertraulich" machte (`library-analytics/src/service.ts:1568`). Folge im Betrieb: JEDE gewöhnliche
// Wiki-Seite wurde als vertraulich übernommen, und der Mensch las an ihr ein Vertraulichkeitszeichen.
//
// WER DAS ENTSCHIEDEN HAT: Pedi, Entscheidung 23 vom 05.09.2026, wörtlich: „Es ist nicht vertraulich
// … externe KI ist überall erlaubt". Vertraulich wird ab hier nur noch, was die Quelle ausdrücklich
// beschränkt (`isPageRestricted` darüber, unverändert) oder was ein Mensch selbst so markiert.
//
// DIESE FUNKTION LIEFERT DESHALB IMMER EINE STUFE (kein `| undefined` mehr): beide Fälle sind
// entschieden, ein dritter „weiß nicht" existiert an dieser Quelle nicht. Was der Import-Kern mit
// einer echten Leerstelle tut (andere Provider, die gar kein Governance-Signal liefern), bleibt
// davon unberührt — dort gilt sein fail-safe „vertraulich" weiter.
//
// AUFNAHME 20260922 · confluence-import-rechte (R-0549) — DIE VERERBTE BESCHRÄNKUNG.
//
// `restrictions.read` trägt nur die EIGENE Leseeinschränkung einer Seite. In Confluence gilt eine
// Leseeinschränkung aber auch für alle Unterseiten: wer die Elternseite nicht sehen darf, sieht das
// Kind ebenfalls nicht — obwohl dessen eigene Listen leer sind. Bis hierher wurde ein solches Kind
// „intern" und war damit in Klara für jeden mit `ko.read` offen. Das widerspricht wörtlich dem
// Zielzustand „wer sie in der Quelle sehen darf … und sonst niemand".
//
// Deshalb fragt die Einstufung, wenn der Aufrufer die Lage der Vorfahren kennt (`ahnen`), auch sie:
// ein beschränkter Vorfahr macht die Seite vertraulich. Ein Vorfahr, dessen Lage NICHT nachgesehen
// werden konnte (nicht in der Sammlung, für das Dienstkonto nicht lesbar, ohne ID), zählt ebenfalls
// als beschränkt — „intern" bleibt eine Einstufung mit Erzeuger (nachgesehene, nicht vorhandene
// Einschränkung), kein Vorgabewert für eine Lücke. Der Adapter liefert `ahnen` auf JEDEM seiner
// Wege; ohne `ahnen` beurteilt die Funktion nur die Seite selbst (reine Einzelseiten-Sicht).
//
// DIE LESER (Ben, Nacharbeit 2, Befund F1): die Stufe allein ersetzt keine quellgleiche Zuordnung.
// Der Mapper liefert deshalb zusätzlich die LESER einer beschränkten Seite — die Mailadressen der
// Benutzer, die die Quelle auf JEDER beschränkten Ebene (eigene Seite und jeder beschränkte Vorfahr)
// ausdrücklich nennt. Confluence verlangt das Durchkommen durch alle Ebenen; die Schnittmenge ist
// genau das. Die Zuordnung auf Klara-Konten fällt im Import-Kern (Mailadresse = Konto).
//
// NACHARBEIT 3 (Ben, Befund F1) — SPACE, GRUPPEN, KONTEN OHNE SICHTBARE MAILADRESSE. Die
// effektiven Leser sind die Schnittmenge aus dem Leserecht des SPACE und jeder beschränkten Ebene.
// Jede Ebene wird im Adapter VOLL aufgelöst (`ConfluenceRechtekontext`): genannte Benutzer,
// Mitglieder genannter Gruppen (über Confluence, Klara braucht dafür kein Gruppenmodell) und für
// Konten ohne mitgelieferte Mailadresse die Adresse aus `/rest/api/user/email`.
//
// UNBEKANNT IST NIE „ALLE": Ist das Space-Leserecht nicht nachsehbar, bekommt die Seite eine LEERE
// Leserliste — sie ist in Klara für niemanden lesbar, bis die Rechte lesbar sind. Nur ein ANONYM
// lesbarer Space trägt keine Space-Grenze. Die Vertraulichkeitsstufe hängt weiter allein an
// Seite und Vorfahren (R-2197): eine seitenoffene Seite bleibt „intern", nur ihr Leserkreis ist
// der des Space.
//
// VERBLEIBENDE GRENZEN, alle fail-closed (weniger Leser, nie mehr): ein Konto, dessen Mailadresse
// Atlassian auch auf Nachfrage nicht herausgibt, und ein Confluence-Konto ohne Klara-Konto mit
// derselben Adresse bekommen kein Leserecht; eine Gruppe mit mehr als 10.000 Mitgliedern oder ein
// abgebrochener Mitgliederabruf liefert nur die gelesenen.

/** Die Leseeinschränkung EINER Ebene (Space, Seite oder Vorfahr). */
export interface ConfluenceLeseEbene {
  beschraenkt: boolean;
  /** Kleingeschriebene Mailadressen der Leser dieser Ebene. */
  emails: string[];
  /** Nacharbeit 6: die Leser dieser Ebene konnten nicht vollständig gelesen werden (Gruppenabruf). */
  unvollstaendig?: true;
  /**
   * Nacharbeit 19 (Ben, K1): die Leser dieser Ebene wurden NICHT ermittelt — die Prüfung je Konto
   * ließ sich nicht abschließen (seit Nacharbeit 20 ohne Abbruchgrenze: etwa eine Seite ohne
   * Kennung). Kein Ergebnis, das übernommen werden darf (sonst würde eine nicht geprüfte Seite als
   * leere Leserliste gespeichert).
   */
  nichtErmittelt?: true;
}

/**
 * Was der Adapter über die Rechte außerhalb der Seite nachgesehen hat.
 *  · `space`: das Leserecht des Space; `undefined` = nicht nachsehbar (→ niemand).
 *  · `eigene`: die VOLL aufgelöste eigene Ebene der Seite (Benutzer und Gruppenmitglieder).
 *  · `beobachtetAm`: wann diese Rechte nachgesehen wurden (Aktualitätsschutz beim Abgleich).
 */
export interface ConfluenceRechtekontext {
  space: ConfluenceLeseEbene | undefined;
  eigene?: ConfluenceLeseEbene;
  beobachtetAm?: string;
}

/**
 * Die nachgesehene Leseeinschränkung eines Vorfahren; `undefined` = nicht nachgesehen bzw. für das
 * Dienstkonto nicht lesbar.
 */
export type ConfluenceAhnenBeschraenkung = (ancestorId: string) => ConfluenceLeseEbene | undefined;

/** Die eigene Ebene einer Seite, NUR aus dem, was die Seite selbst mitliefert (ohne Auflösung). */
export function confluenceLeseEbene(page: ConfluencePage): ConfluenceLeseEbene {
  const users = page.restrictions?.read?.restrictions?.user?.results ?? [];
  const emails = users
    .map((u) => (u && typeof u === "object" ? (u as { email?: unknown }).email : undefined))
    .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    .map((e) => e.trim().toLowerCase());
  return { beschraenkt: isPageRestricted(page), emails: [...new Set(emails)] };
}

/**
 * Alle beschränkten Ebenen der Seite (eigene zuerst), oder `undefined`, wenn eine Ebene unbekannt
 * ist (Vorfahr ohne ID oder nicht nachgesehen). Ohne `ahnen` nur die eigene Ebene.
 */
function beschraenkteEbenen(
  page: ConfluencePage,
  ahnen?: ConfluenceAhnenBeschraenkung,
  eigeneAufgeloest?: ConfluenceLeseEbene,
): ConfluenceLeseEbene[] | undefined {
  const eigene = eigeneAufgeloest ?? confluenceLeseEbene(page);
  const ebenen = eigene.beschraenkt ? [eigene] : [];
  if (!ahnen || !Array.isArray(page.ancestors)) {
    return ebenen;
  }
  for (const ancestor of page.ancestors) {
    const id = ahnenId(ancestor);
    const ebene = id === undefined ? undefined : ahnen(id);
    if (ebene === undefined) {
      return undefined;
    }
    if (ebene.beschraenkt) {
      ebenen.push(ebene);
    }
  }
  return ebenen;
}

/** Eigene ODER (bei bekannter Ahnenlage) vererbte Leseeinschränkung, fail-closed für Lücken. */
export function isPageEffectivelyRestricted(
  page: ConfluencePage,
  ahnen?: ConfluenceAhnenBeschraenkung,
): boolean {
  const ebenen = beschraenkteEbenen(page, ahnen);
  return ebenen === undefined || ebenen.length > 0;
}

/**
 * Die Leser der Seite (Schnittmenge über Space und alle beschränkten Ebenen), oder `undefined`,
 * wenn KEINE Ebene beschränkt (Space anonym lesbar, Seite und Vorfahren offen). Eine unbekannte
 * Ebene — auch ein nicht nachsehbarer Space — ergibt `[]`. Ohne `kontext` (reine
 * Einzelseiten-Sicht, nur in Tests) zählt allein die Seite selbst.
 */
export function confluenceQuellLeser(
  page: ConfluencePage,
  ahnen?: ConfluenceAhnenBeschraenkung,
  kontext?: ConfluenceRechtekontext,
): string[] | undefined {
  if (kontext && kontext.space === undefined) {
    return [];
  }
  const seitenEbenen = beschraenkteEbenen(page, ahnen, kontext?.eigene);
  if (seitenEbenen === undefined) {
    return [];
  }
  const ebenen = kontext?.space?.beschraenkt ? [kontext.space, ...seitenEbenen] : seitenEbenen;
  const [erste, ...weitere] = ebenen;
  if (!erste) {
    return undefined;
  }
  return erste.emails.filter((email) => weitere.every((e) => e.emails.includes(email)));
}

/**
 * Nacharbeit 6 (Befund F3): ist eine der Ebenen, aus denen die Leser entstehen (Space, Seite,
 * beschränkte Vorfahren), nicht vollständig gelesen worden? Dann sind die Leser eine Untermenge der
 * in der Quelle Berechtigten — das muss am Ergebnis stehen, nicht nur im Ablauf.
 */
export function confluenceLeserUnvollstaendig(
  page: ConfluencePage,
  ahnen?: ConfluenceAhnenBeschraenkung,
  kontext?: ConfluenceRechtekontext,
): boolean {
  const seitenEbenen = beschraenkteEbenen(page, ahnen, kontext?.eigene) ?? [];
  const ebenen = kontext?.space?.beschraenkt ? [kontext.space, ...seitenEbenen] : seitenEbenen;
  return ebenen.some((e) => e.unvollstaendig === true);
}

export function confluenceGovernanceConfidentiality(
  page: ConfluencePage,
  ahnen?: ConfluenceAhnenBeschraenkung,
): Confidentiality {
  return isPageEffectivelyRestricted(page, ahnen) ? "vertraulich" : "intern";
}

/**
 * Die Quellrechte am Import-Eintrag. `ImportItem` selbst ist eingefroren (Freeze-144,
 * library-analytics/src/types.ts); das Feld reist wie `originalAuthor` als zusätzliches, im
 * Import-Kern geprüftes Feld mit. `emails` ist genau dann gesetzt, wenn die Quelle beschränkt
 * (Space, Seite oder Vorfahr). `beobachtetAm`: wann der Adapter die Rechte nachgesehen hat.
 */
export interface ConfluenceQuellrechte {
  stufe: Confidentiality;
  emails?: string[];
  beobachtetAm?: string;
  /** Nacharbeit 6: die Leser sind eine Untermenge — ein Gruppenabruf blieb unvollständig. */
  leserUnvollstaendig?: true;
  /** Nacharbeit 19: die Leser wurden nicht ermittelt — der Eintrag darf keine Rechte setzen. */
  leserNichtErmittelt?: true;
}

// ================================================================================================
// R-0549 — WER DIE SEITE IN DER QUELLE LESEN DARF, GEHT NICHT MEHR VERLOREN.
// ================================================================================================
//
// Bis hierher wurde aus der Restriktion genau ein Bit (restringiert ja/nein) und daraus die Stufe.
// Welche Gruppen und Benutzer lesen dürfen, fiel weg: zwei Seiten mit verschiedenen erlaubten
// Gruppen ergaben dasselbe Item. Diese Funktion bewahrt die Identitäten — Gruppen über ihren
// Namen, Benutzer über ihre stabile Kennung (Cloud `accountId`, Server/Data Center `username`
// bzw. `userKey`), nie über den Anzeigenamen.
//
// DURCHGESETZT WIRD HIER NICHTS. Klara kennt keine Leserechte je Gruppe oder Person; die
// Sichtbarkeit hängt an Rolle, Stufe und Autor (`services/app/src/sichtbarkeit.ts`), und eine
// Freigabe je Nutzer ist dort ausdrücklich als nicht entschiedene „Variante B" benannt. Die
// Angabe reist als Herkunft bis an den Anker; ihre Durchsetzung braucht diese Entscheidung.
export function confluenceReadRestriction(
  page: ConfluencePage,
): { groups: string[]; users: string[] } | undefined {
  const read = page.restrictions?.read?.restrictions;
  const groups = ((read?.group?.results ?? []) as { name?: unknown }[])
    .map((g) => (typeof g?.name === "string" ? g.name.trim() : ""))
    .filter((name) => name.length > 0);
  const users = (
    (read?.user?.results ?? []) as { accountId?: unknown; username?: unknown; userKey?: unknown }[]
  )
    .map((u) => [u?.accountId, u?.username, u?.userKey].find((v) => typeof v === "string" && v))
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim());
  if (groups.length === 0 && users.length === 0) {
    return undefined;
  }
  const sortiert = (werte: string[]) => [...new Set(werte)].sort();
  return { groups: sortiert(groups), users: sortiert(users) };
}

// ================================================================================================
// R-0163 — DIE ANHÄNGE EINER SEITE.
// ================================================================================================
//
// Aus der Anhangsliste werden Name, Typ, Größe und die absolute Abruf-URL (auf der gepinnten
// Confluence-Adresse). Ein Eintrag ohne Kennung oder Namen wird verworfen — ohne sie lässt er sich
// weder wiederfinden noch benennen. Die Abruf-URL führt zur Datei in Confluence; wer sie öffnet,
// braucht dort Leserecht — der Link verspricht nicht mehr.
export function confluenceAttachments(
  attachments: readonly ConfluenceAttachment[],
  baseUrl: string,
): ImportAttachment[] {
  const basis = baseUrl.replace(/\/+$/, "");
  const out: ImportAttachment[] = [];
  for (const a of attachments) {
    const externalId = a?.id?.trim();
    const name = a?.title ? decodeHtmlEntities(a.title).trim() : "";
    if (!externalId || !name) {
      continue;
    }
    const mime = (a.extensions?.mediaType ?? a.metadata?.mediaType)?.trim();
    const size = a.extensions?.fileSize;
    const download = a._links?.download;
    out.push({
      externalId,
      name,
      ...(mime ? { mime } : {}),
      ...(typeof size === "number" && Number.isFinite(size) && size >= 0 ? { size } : {}),
      ...(download?.startsWith("/") ? { url: `${basis}${download}` } : {}),
    });
  }
  return out;
}

// AUFTRAG-mega27 A2: Elternkette → QUELLNEUTRALER Pfad. Die Elterntitel in Quell-Reihenfolge
// (Wurzel zuerst), OHNE die Seite selbst. Confluence liefert `ancestors` bereits so sortiert.
// Dekodierung wie bei Titel/Autor/Labels (WP-IC-PAKET-1b ROT-1): EINMAL hier an der Quelle — der
// Marker textCodec="decoded" am Item gilt für diese Werte mit, die Anzeige dekodiert NICHT erneut.
//
// KEIN FELD OHNE ERZEUGER, KEINE ERFUNDENE WURZEL: fehlt der Expand, ist die Seite selbst eine
// Wurzelseite oder tragen alle Ahnen leere Titel, liefert diese Funktion `undefined` — der Mapper
// lässt das Feld dann WEG. Kein leeres Array, kein Platzhalter-Ordner, kein aus dem Titel geratener
// Pfad. Eine Seite ohne Elternkette hängt später sichtbar direkt unter dem Quell-Container.
export function confluenceSourcePath(page: ConfluencePage): string[] | undefined {
  if (!Array.isArray(page.ancestors)) {
    return undefined;
  }
  const path = page.ancestors
    .map((ancestor) => (ancestor?.title ? decodeHtmlEntities(ancestor.title).trim() : ""))
    .filter((title) => title.length > 0);
  return path.length > 0 ? path : undefined;
}

// ================================================================================================
// JOB 1042 D3 — DIE IDENTITÄT DER ELTERNKETTE, NEBEN IHREM NAMEN
// ================================================================================================
//
// DER BEFUND (Vollurteil zu D2, Z. 48-50): „Der tatsächliche Informationsverlust liegt im Mapper:
// Vorfahren-IDs verschwinden, Titel bleiben." Nachgemessen: `rest-client.ts:43` fordert
// `ancestors` samt `id` an — die Identität KOMMT an und wird zwei Zeilen später weggeworfen.
//
// WARUM DER TITELPFAD BLEIBT, WIE ER IST: er ist die ANZEIGE (Ordnerbaum, Vorschau, Dreizustand)
// und dort richtig. Was ihm fehlt, ist Dauerhaftigkeit: benennt jemand einen Elternordner um,
// ändert sich der Pfad, obwohl es derselbe Ordner ist. Titel und Identität bekommen deshalb
// GETRENNTE Rollen (Urteil, Hinweise Z. 263-265) — nicht ein Feld, das beides halb kann.
//
// KEINE ORDNUNG, KEINE ERFINDUNG: `ancestors` trägt je Ahne genau `id` und `title`, also keine
// Geschwisterposition. Ein `ordinal` würde hier weder aus der Antwortreihenfolge noch aus einer
// Titelsortierung abgeleitet (Urteil Z. 267-268) — es fehlt schlicht, und das ist die ehrliche
// Angabe. Die TIEFE braucht kein eigenes Feld: sie ist die Länge dieser Kette.

/**
 * Der Zustand EINER Ahnenkette. Dieser Typ BENENNT einen Mangel — er entscheidet nicht, was der
 * Import daraufhin tut. Die fail-closed Regel für fehlende IDs ist eine offene Ownerentscheidung
 * (Korrekturpflicht 1 des Vollurteils) und wird hier bewusst nicht vorweggenommen.
 */
export type ConfluenceAhnenBefund = "ok" | "fehlende-id" | "zyklus";

/** Getrimmte ID eines Ahnen, oder `undefined` wenn keine brauchbare vorliegt. */
function ahnenId(ancestor: { id?: string } | undefined): string | undefined {
  const id = ancestor?.id?.trim();
  return id && id.length > 0 ? id : undefined;
}

/**
 * Die STABILE Elternkette: die Vorfahren-IDs in Quell-Reihenfolge (Wurzel zuerst), ohne die Seite
 * selbst — dieselbe Form und dieselbe Zurückhaltung wie `confluenceSourcePath`.
 *
 * `undefined` heisst „keine verwendbare Kette" und deckt ZWEI Fälle ab: die Seite ist eine
 * Wurzelseite, ODER mindestens ein Ahne trägt keine ID. Der zweite Fall ist der wichtige: eine
 * TEILWEISE Kette wäre schlimmer als gar keine, weil jede Zuordnung zwischen Titel und ID ab dem
 * Loch verschoben wäre. Welcher der beiden Fälle vorliegt, sagt `confluenceAhnenBefund`.
 */
export function confluenceAncestorIds(page: ConfluencePage): string[] | undefined {
  if (!Array.isArray(page.ancestors) || page.ancestors.length === 0) {
    return undefined;
  }
  const ids: string[] = [];
  for (const ancestor of page.ancestors) {
    const id = ahnenId(ancestor);
    if (id === undefined) {
      return undefined; // lückenhaft ⇒ keine Kette (s. o.)
    }
    ids.push(id);
  }
  return ids;
}

/**
 * Der Befund zur Ahnenkette einer Seite — die Diagnose, nicht die Reaktion.
 *
 * `ok` schliesst die WURZELSEITE ausdrücklich ein: keine Ahnen zu haben ist kein Mangel, sondern
 * die Lage der obersten Seite. Ein `zyklus` liegt vor, wenn die Seite in ihrer eigenen Kette steht
 * oder ein Vorfahr darin doppelt vorkommt — beides kann Confluence nicht liefern und deutet auf
 * beschädigte oder manipulierte Antwortdaten.
 */
export function confluenceAhnenBefund(page: ConfluencePage): ConfluenceAhnenBefund {
  if (!Array.isArray(page.ancestors) || page.ancestors.length === 0) {
    return "ok";
  }
  const ids = confluenceAncestorIds(page);
  if (ids === undefined) {
    return "fehlende-id";
  }
  const eigene = page.id?.trim();
  if (eigene && ids.includes(eigene)) {
    return "zyklus";
  }
  return new Set(ids).size === ids.length ? "ok" : "zyklus";
}

// R-0163: `anhaenge` ist die gelesene Anhangsliste der Seite. Fehlt das Argument, wurde sie nicht
// gelesen (Erkundung/Space-Liste) — das Item trägt dann KEIN `attachments`-Feld. `unvollstaendig`
// stammt aus dem Lesen der Liste (Abbruch, Fehler) und reist sichtbar mit.
export function mapConfluencePageToImportItem(
  page: ConfluencePage,
  opts: ConfluenceMapOptions,
  anhaenge?: { attachments: readonly ConfluenceAttachment[]; unvollstaendig: boolean },
  // confluence-import-rechte: Ahnenlage und Rechtekontext (Space, aufgelöste eigene Ebene). Hinter
  // `anhaenge`, damit dessen Aufrufer unverändert bleiben; ohne sie gilt die Einzelseiten-Sicht.
  ahnen?: ConfluenceAhnenBeschraenkung,
  kontext?: ConfluenceRechtekontext,
): ConfluenceImportItem {
  const bodyHtml = confluenceStorageToHtml(page.body?.storage?.value ?? "");
  // JOB 2703 D1 (Review R2-3): hier stand `htmlToPlainText(bodyHtml)` — der GESAMTE Klartext der
  // Seite wurde zur Kernaussage, während der Volltext ohnehin als `bodyHtml` mitreist. Jetzt: der
  // erste Absatz, höchstens 500 Zeichen, an einer Satzgrenze (die eine Hilfsfunktion in
  // library-analytics, Begründung dort). `bodyHtml` bleibt unverändert der Volltext.
  const plain = kernaussageAusHtml(bodyHtml);
  // WP-IC-PAKET-1b (bens ROT-1): ALLE textuellen Quellfelder EINMAL an der Quelle dekodieren — nicht
  // nur das Body-Statement (htmlToPlainText). Titel (auch als Statement-Fallback), Autor und Labels
  // tragen sonst rohe Entities in Kandidaten, Themen-Ableitung (explore/select) und angenommene KOs.
  const title = decodeHtmlEntities(page.title);
  const tags = (page.metadata?.labels?.results ?? [])
    .map((l) => (l.name ? decodeHtmlEntities(l.name).trim() : undefined))
    .filter((n): n is string => !!n);
  const webui = page._links?.webui;
  const url = webui ? `${opts.baseUrl.replace(/\/+$/, "")}${webui}` : undefined;
  const rawAuthor = page.version?.by?.displayName?.trim();
  const author = rawAuthor ? decodeHtmlEntities(rawAuthor) : undefined;
  // IC-1: Provenienz-Datum der letzten Version (Confluence version.when, ISO) → nur wenn vorhanden.
  const updatedAt = page.version?.when?.trim();
  const governance = confluenceGovernanceConfidentiality(page, ahnen);
  const leser = confluenceQuellLeser(page, ahnen, kontext);
  const leserUnvollstaendig =
    leser !== undefined && confluenceLeserUnvollstaendig(page, ahnen, kontext);
  // package:confluence (K6): die konkreten Kennungen der Lese-Einschränkung — oder gar nichts.
  const sourceRestrictions = confluenceReadRestrictions(page);
  // AUFTRAG-mega27 A2: die Elternkette (Wurzel zuerst, ohne die Seite selbst) — oder gar nichts.
  const sourcePath = confluenceSourcePath(page);
  // R-0549: wer lesen darf (nur bei restringierten Seiten). R-0163: die Anhänge aus dem Expand.
  const readRestriction = confluenceReadRestriction(page);
  // Lauf 2: nur eine brauchbare Liste ohne Folgeseite ist VOLLSTÄNDIG. Fehlt sie oder ist sie
  // unbrauchbar, ist die Anhangslage unbekannt — nie „keine Anhänge" (sonst entfernte die Annahme
  // bestehende Anhangsquellen auf eine Nicht-Antwort hin).
  const anhangsliste = page.children?.attachment;
  const gelieferteAnhaenge = Array.isArray(anhangsliste?.results) ? anhangsliste.results : [];
  const attachments = confluenceAttachments(gelieferteAnhaenge, opts.baseUrl);
  // Lauf 3 R2 (Bens B3): verwirft `confluenceAttachments` einen Eintrag (etwa ohne Titel), ist die
  // Liste NICHT vollständig übernommen — auch wenn die Antwort als Liste brauchbar war.
  const anhaengeBekannt =
    istAnhangsliste(anhangsliste) &&
    !anhangsliste._links?.next &&
    attachments.length === gelieferteAnhaenge.length;

  return {
    title,
    // Kernaussage: Plaintext des Body (Fallback dekodierter Titel, damit statement nie leer ist); der
    // volle Rich-Body reist als bodyHtml mit und wird serverseitig sanitisiert (KoService.create).
    statement: plain || title,
    type: opts.defaultType ?? "best_practice",
    category: opts.spaceKey,
    ...(author ? { author } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    // JOB 3089 (N11): die Stufe steht IMMER am Item — Confluence entscheidet beide Fälle
    // (restringiert → vertraulich, offen → intern, s. oben). Kein bedingtes Weglassen mehr: ein
    // fehlendes Feld hiesse „diese Quelle weiss es nicht", und das ist seit Entscheidung 23 falsch.
    confidentiality: governance,
    // AUFNAHME 20260922 · confluence-import-rechte: Stufe UND Leser der Quelle (s. oben).
    quellrechte: {
      stufe: governance,
      ...(leser !== undefined ? { emails: leser } : {}),
      ...(kontext?.beobachtetAm ? { beobachtetAm: kontext.beobachtetAm } : {}),
      ...(leserUnvollstaendig ? { leserUnvollstaendig: true as const } : {}),
      ...(kontext?.space?.nichtErmittelt ? { leserNichtErmittelt: true as const } : {}),
    },
    // SCRUM-510 R2b: quellneutrale Provenienz — externalId = Confluence-pageId (Re-Sync-Anker),
    // sourceScope = Confluence-Space. Der Import-Kern kennt nur diese neutralen Begriffe.
    externalId: page.id,
    sourceScope: opts.spaceKey,
    // AUFTRAG-mega27 A2: quellneutrale HIERARCHIE innerhalb des Containers. Ein Jira-Adapter füllt
    // dasselbe Feld später mit Epic/Projekt — der Import-Kern kennt weiterhin kein Confluence-Symbol.
    ...(sourcePath ? { sourcePath } : {}),
    ...(readRestriction ? { sourceReadRestriction: readRestriction } : {}),
    ...(attachments.length > 0 ? { sourceAttachments: attachments } : {}),
    ...(anhaengeBekannt ? {} : { sourceAttachmentsIncomplete: true }),
    ...(typeof page.version?.number === "number" ? { sourceVersion: page.version.number } : {}),
    ...(sourceRestrictions ? { sourceRestrictions } : {}),
    ...(url ? { url } : {}),
    provider: "Confluence",
    ...(bodyHtml ? { bodyHtml } : {}),
    // IC-1: Provenienz-Datum (nur wenn die Quelle es liefert) — für die Read-only-Erkundung.
    ...(updatedAt ? { updatedAt } : {}),
    // WP-IC-PAKET-1c (bens ROT-2): Decode-Marker — die Textfelder sind hier KANONISCH dekodiert;
    // die Anzeige darf sie nicht erneut dekodieren (Doppel-Dekodier-Kette bei Literal-Entities).
    textCodec: "decoded",
    // R-0163: Anhänge und Bilder der Seite — nur, wenn die Liste gelesen wurde und etwas trägt.
    ...(anhaenge ? confluenceAnhangsFelder(anhaenge) : {}),
  };
}

/**
 * R-0163: die Anhangsfelder eines Items aus einer gelesenen Anhangsliste — die EINE Regel für
 * beide Wege, auf denen eine Seite in die Review-Queue kommt (`fetchItem` beim Anwenden,
 * `withAttachments` im Bereichsimport). Ein Eintrag ohne Pflichtangabe oder eine abgeschnittene
 * Liste macht das Item sichtbar unvollständig; eine leere, vollständige Liste setzt kein Feld.
 */
export function confluenceAnhangsFelder(anhaenge: {
  attachments: readonly ConfluenceAttachment[];
  unvollstaendig: boolean;
}): Pick<ConfluenceImportItem, "attachments" | "attachmentsIncomplete"> {
  const gemappt = anhaenge.attachments.map(mapConfluenceAttachment);
  const attachments = gemappt.filter((a): a is ConfluenceImportAnhang => a !== undefined);
  const unvollstaendig = anhaenge.unvollstaendig || attachments.length < gemappt.length;
  return {
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(unvollstaendig ? { attachmentsIncomplete: true as const } : {}),
  };
}
