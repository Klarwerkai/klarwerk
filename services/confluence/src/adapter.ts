// SCRUM-510: Confluence als Adapter #1 des quell-agnostischen Import-Vertrags (SourceAdapter). Der
// Adapter liest die Space-Seiten (read-only REST) und liefert normalisierte ImportItems — der Import-
// Kern (createImportCandidates → acceptToKo) kennt die Quelle nicht. Eine spätere Quelle (Jira-TEST,
// Adapter #2) ist NUR ein weiterer SourceAdapter, kein Umbau dieses Pfads.
//
// R2a (Encapsulation): nach außen (Paket-index) ist NUR createConfluenceAdapterFromEnv erreichbar — der
// Roh-Client, seine token-tragende Config und der env-Resolver bleiben modul-intern.

import type { ImportItem, SourceAdapter } from "../../library-analytics";
import {
  type ConfluenceAhnenBeschraenkung,
  type ConfluenceImportItem,
  type ConfluenceLeseEbene,
  type ConfluenceMapOptions,
  type ConfluenceRechtekontext,
  confluenceAhnenBefund,
  confluenceAncestorIds,
  confluenceAnhangsFelder,
  confluenceLeseEbene,
  isPageRestricted,
  mapConfluencePageToImportItem,
} from "./mapper";
import type { ConfluenceAbbruch, ConfluenceAttachment, ConfluencePage } from "./rest-client";
import {
  ConfluenceRestClient,
  type ConfluenceRestConfig,
  confluenceClientFromEnv,
  istAnhangsliste,
} from "./rest-client";

// SCRUM-510 WP2: Ergebnis eines vollständigen (paginierten) Space-Einlesens — normalisierte Items PLUS
// pro-Seite-Fehler (eine fehlerhafte Seite bricht den Lauf NICHT ab). `ref` ist die Herkunft (pageId
// oder Titel) zur ehrlichen Fehlerzuordnung, ohne Interna zu lecken.
export interface CollectResult {
  items: ConfluenceImportItem[];
  // WP-SAMMEL20-FIX (bens Fix 6a): errorClass = PII-freie Fehlerklasse (Error.name) je nicht
  // lesbarer Seite — der Erkundungs-Wire trägt NUR sie, nie die rohe Fehlermeldung. Additiv.
  failed: { ref: string; error: string; errorClass?: string }[];
  // SCRUM-510 (WP3): true, wenn der Space-Read am Seiten-Cap abgeschnitten wurde (nicht vollständig). Der
  // Import-Kern macht daraus einen ehrlichen „unvollständig"-Status — nie eine stille „fertig"-Meldung.
  truncated: boolean;
  // JOB 1042 D3: der Hierarchie-Befund über die EINGESAMMELTEN Seiten. Additiv und rein
  // diagnostisch — er verändert weder `items` noch `failed` (s. hierarchieBefund).
  hierarchie?: ConfluenceHierarchieBefund;
  // JOB 2683 D2: WARUM der Lauf vor dem letzten Cursor endete (Frist, Größe, Zeitbudget) — nur
  // gesetzt, wenn `truncated` aus einem Abbruch stammt. Reist bis zur Erkundungs-Fläche, damit
  // „unvollständig" dort einen Grund hat. Additiv; der Seiten-Cap trägt keinen Abbruch.
  abbruch?: ConfluenceAbbruch;
}

// ================================================================================================
// JOB 1042 D3 — DER BAUMBEFUND ÜBER DIE GESAMTE SAMMLUNG
// ================================================================================================
//
// Der Baumleser im Mapper urteilt je SEITE (fehlende ID, Zyklus). Zwei der vom Vollurteil
// verlangten Negativfälle (Prüflücke 5) sind aber erst über die GANZE Sammlung sichtbar: eine
// doppelt gelieferte Seiten-ID und ein Elternteil, den die Sammlung gar nicht enthält. Deshalb
// sitzt diese Auswertung hier und nicht im Mapper.
//
// ER MELDET, ER SPERRT NICHT. Ob ein Mangel den Import anhalten soll (fail-closed) oder nicht, ist
// die ausdrücklich offene Ownerentscheidung aus Korrekturpflicht 1. Bis sie getroffen ist, bleiben
// `items`, `failed` und `truncated` von diesem Befund UNBERÜHRT — er ist eine Auskunft.
export interface ConfluenceHierarchieBefund {
  /** Gelieferte Seiten insgesamt (auch doppelt gelieferte zählen einzeln). */
  seiten: number;
  /** Seiten mit vollständiger, verwendbarer ID-Kette. */
  mitKette: number;
  /** Seiten ohne jeden Vorfahren — die obersten Seiten des Containers. */
  wurzeln: number;
  /** Längste vorgefundene Kette (0, wenn es nur Wurzeln gibt). */
  maximaleTiefe: number;
  /** Seiten-IDs, deren Kette mindestens einen Vorfahren ohne ID enthält. */
  fehlendeId: string[];
  /** Seiten-IDs, die in ihrer eigenen Kette stehen oder einen Vorfahren doppelt führen. */
  zyklus: string[];
  /** Seiten-IDs, die in dieser Sammlung mehr als einmal vorkommen (je ID einmal genannt). */
  doppelteId: string[];
  /** Seiten-IDs, deren direkter Elternteil in dieser Sammlung fehlt. */
  verwaisterElternteil: string[];
}

/**
 * Wertet die Ahnenketten einer eingesammelten Seitenmenge aus. Reine Funktion, keine Nebenwirkung.
 *
 * Die Reihenfolge der gemeldeten IDs folgt der Liefer-Reihenfolge — ein Befund soll zwischen zwei
 * Läufen über denselben Bestand gleich aussehen.
 */
export function hierarchieBefund(pages: readonly ConfluencePage[]): ConfluenceHierarchieBefund {
  const vorhandeneIds = new Set(pages.map((p) => p.id?.trim()).filter((id): id is string => !!id));
  const gesehen = new Set<string>();
  const doppelteId: string[] = [];
  const fehlendeId: string[] = [];
  const zyklus: string[] = [];
  const verwaisterElternteil: string[] = [];
  let mitKette = 0;
  let wurzeln = 0;
  let maximaleTiefe = 0;

  for (const page of pages) {
    const id = page.id?.trim() ?? "";
    if (id) {
      if (gesehen.has(id) && !doppelteId.includes(id)) {
        doppelteId.push(id);
      }
      gesehen.add(id);
    }
    if (!Array.isArray(page.ancestors) || page.ancestors.length === 0) {
      wurzeln += 1;
      continue;
    }
    const befund = confluenceAhnenBefund(page);
    if (befund === "fehlende-id") {
      fehlendeId.push(id);
      continue; // ohne Kette lässt sich weder Tiefe noch Elternteil bestimmen
    }
    if (befund === "zyklus") {
      zyklus.push(id);
    }
    const kette = confluenceAncestorIds(page);
    if (!kette) {
      continue;
    }
    mitKette += 1;
    maximaleTiefe = Math.max(maximaleTiefe, kette.length);
    const elternteil = kette[kette.length - 1];
    if (elternteil !== undefined && !vorhandeneIds.has(elternteil)) {
      verwaisterElternteil.push(id);
    }
  }

  return {
    seiten: pages.length,
    mitKette,
    wurzeln,
    maximaleTiefe,
    fehlendeId,
    zyklus,
    doppelteId,
    verwaisterElternteil,
  };
}

// R-0162 (Nacharbeit 2): die Confluence-Inhaltszustände, die eine Seite aus dem Space nehmen.
// Nur sie lösen eine Entfernung aus; alles andere außer `current` ist eine offene Gegenprobe.
const GELOESCHTE_STATUS: ReadonlySet<string> = new Set(["trashed", "archived", "deleted"]);

/**
 * AUFNAHME 20260922 · confluence-import-rechte (R-0549): die Ahnenlage aus einer EINGESAMMELTEN
 * Seitenmenge. Jede gelieferte Seite trägt ihre eigene Leseeinschränkung; ein Vorfahr, der nicht in
 * der Sammlung steht (abgeschnittener Lauf, für das Dienstkonto nicht lesbar), bleibt `undefined` —
 * der Mapper stuft das Kind dann fail-closed als vertraulich ein.
 */
export function ahnenAusSammlung(
  pages: readonly ConfluencePage[],
  // Nacharbeit 3: die im Rechte-Lauf VOLL aufgelösten Ebenen (Gruppenmitglieder, nachgefragte
  // Mailadressen). Ohne sie zählt nur, was die Seite selbst mitliefert.
  aufgeloest?: ReadonlyMap<ConfluencePage, ConfluenceLeseEbene>,
): ConfluenceAhnenBeschraenkung {
  const ebenen = new Map<string, ConfluenceLeseEbene>();
  for (const page of pages) {
    const id = page.id?.trim();
    if (id) {
      const neu = aufgeloest?.get(page) ?? confluenceLeseEbene(page);
      const alt = ebenen.get(id);
      // Doppelt geliefert: beschränkt gewinnt, und von zwei Leserlisten gilt die Schnittmenge.
      if (!alt || (!alt.beschraenkt && neu.beschraenkt)) {
        ebenen.set(id, neu);
      } else if (alt.beschraenkt && neu.beschraenkt) {
        ebenen.set(id, {
          beschraenkt: true,
          emails: alt.emails.filter((email) => neu.emails.includes(email)),
          ...(alt.unvollstaendig || neu.unvollstaendig ? { unvollstaendig: true as const } : {}),
        });
      }
    }
  }
  return (ancestorId) => ebenen.get(ancestorId);
}

// ================================================================================================
// AUFNAHME 20260922 · confluence-import-rechte (Ben, Nacharbeit 3, Befund F1) — DER RECHTE-LAUF.
// ================================================================================================
//
// EIN Lauf je Einsammeln bzw. je Nachladen: Space-Leserecht, Gruppenmitglieder und nachgefragte
// Mailadressen werden darin GENAU EINMAL abgerufen und für alle Seiten des Laufs wiederverwendet.
// Über Läufe hinweg wird nichts gehalten — Rechte ändern sich, und ein alter Stand wäre die falsche
// Auskunft. Jeder Abruf ist im Client fail-closed (Fehler → unbekannt bzw. weniger Leser).
class RechteLauf {
  /** VOR dem ersten Abruf gesetzt: die Rechte gelten höchstens ab diesem Zeitpunkt. */
  readonly beobachtetAm = new Date().toISOString();
  private readonly gruppen = new Map<
    string,
    Promise<{ emails: string[]; vollstaendig: boolean }>
  >();
  private readonly konten = new Map<string, Promise<string | undefined>>();

  constructor(private readonly client: ConfluenceRestClient) {}

  /** Das Leserecht des Space; `undefined` = nicht nachsehbar, anonym lesbar = nicht beschränkt. */
  async space(): Promise<ConfluenceLeseEbene | undefined> {
    const rechte = await this.client.getSpaceLeserechte();
    if (!rechte) {
      return undefined;
    }
    if (rechte.anonym) {
      return { beschraenkt: false, emails: [] };
    }
    return { beschraenkt: true, ...(await this.emailsVon(rechte.users, rechte.groups)) };
  }

  /** Die eigene Ebene einer Seite, VOLL aufgelöst (Benutzer und Mitglieder genannter Gruppen). */
  async ebene(page: ConfluencePage): Promise<ConfluenceLeseEbene> {
    if (!isPageRestricted(page)) {
      return { beschraenkt: false, emails: [] };
    }
    const lesen = page.restrictions?.read?.restrictions;
    return {
      beschraenkt: true,
      ...(await this.emailsVon(lesen?.user?.results ?? [], lesen?.group?.results ?? [])),
    };
  }

  /**
   * Die Leser einer Ebene. Nacharbeit 6 (Befund F3): eine Gruppe, deren Mitglieder nicht
   * vollständig gelesen werden konnten — oder eine Gruppe ohne Namen —, macht die Ebene
   * `unvollstaendig`. Die Leser bleiben eine Untermenge (fail-closed), der Vermerk reist bis an
   * das Import-Item und das Wissensobjekt.
   */
  private async emailsVon(
    users: readonly unknown[],
    groups: readonly unknown[],
  ): Promise<{ emails: string[]; unvollstaendig?: true }> {
    const emails = new Set<string>();
    let unvollstaendig = false;
    for (const user of users) {
      const email = await this.emailVon(user);
      if (email) {
        emails.add(email);
      }
    }
    for (const gruppe of groups) {
      const name =
        gruppe && typeof gruppe === "object" ? (gruppe as { name?: unknown }).name : undefined;
      if (typeof name !== "string" || name.trim().length === 0) {
        unvollstaendig = true; // eine Gruppe ohne Namen lässt sich nicht nachsehen
        continue;
      }
      const mitglieder = await this.mitglieder(name);
      if (!mitglieder.vollstaendig) {
        unvollstaendig = true;
      }
      for (const email of mitglieder.emails) {
        emails.add(email);
      }
    }
    return { emails: [...emails], ...(unvollstaendig ? { unvollstaendig: true as const } : {}) };
  }

  private mitglieder(name: string): Promise<{ emails: string[]; vollstaendig: boolean }> {
    const bekannt = this.gruppen.get(name);
    if (bekannt) {
      return bekannt;
    }
    const abruf = (async () => {
      const { users, vollstaendig } = await this.client.getGruppenmitglieder(name);
      const emails: string[] = [];
      for (const user of users) {
        const email = await this.emailVon(user);
        if (email) {
          emails.push(email);
        }
      }
      return { emails, vollstaendig };
    })();
    this.gruppen.set(name, abruf);
    return abruf;
  }

  private emailVon(user: unknown): Promise<string | undefined> {
    if (!user || typeof user !== "object") {
      return Promise.resolve(undefined);
    }
    const { email, accountId } = user as { email?: unknown; accountId?: unknown };
    if (typeof email === "string" && email.trim().length > 0) {
      return Promise.resolve(email.trim().toLowerCase());
    }
    if (typeof accountId !== "string" || accountId.trim().length === 0) {
      return Promise.resolve(undefined);
    }
    const bekannt = this.konten.get(accountId);
    if (bekannt) {
      return bekannt;
    }
    const abruf = this.client.getKontoEmail(accountId);
    this.konten.set(accountId, abruf);
    return abruf;
  }
}

export class ConfluenceSourceAdapter implements SourceAdapter {
  readonly source = "Confluence";

  constructor(
    private readonly client: ConfluenceRestClient,
    private readonly mapOpts: ConfluenceMapOptions,
  ) {}

  async collect(): Promise<ConfluenceImportItem[]> {
    const pages = await this.client.listPages();
    const rechte = await this.rechteDerSammlung(pages);
    // Ohne Anhangsliste (`undefined`): die Space-Liste liest keine Anhänge (R-0163).
    return pages.map((page) =>
      mapConfluencePageToImportItem(
        page,
        this.mapOpts,
        undefined,
        rechte.ahnen,
        rechte.kontext(page),
      ),
    );
  }

  /**
   * Nacharbeit 3 (Befund F1): die Rechte einer eingesammelten Seitenmenge — Space EINMAL, jede
   * Seite voll aufgelöst, Vorfahren aus derselben aufgelösten Menge. Erst NACH dem Einlesen der
   * Seiten: scheitert schon das Listing, entsteht kein zusätzlicher Abruf.
   */
  private async rechteDerSammlung(pages: readonly ConfluencePage[]) {
    const lauf = new RechteLauf(this.client);
    const space = await lauf.space();
    const eigene = new Map<ConfluencePage, ConfluenceLeseEbene>();
    for (const page of pages) {
      eigene.set(page, await lauf.ebene(page));
    }
    return {
      ahnen: ahnenAusSammlung(pages, eigene),
      kontext: (page: ConfluencePage): ConfluenceRechtekontext => ({
        space,
        eigene: eigene.get(page) ?? confluenceLeseEbene(page),
        beobachtetAm: lauf.beobachtetAm,
      }),
    };
  }

  // SCRUM-510 WP2: liest den GESAMTEN Space (Cursor-Pagination) und mappt jede Seite EINZELN. Scheitert
  // das Mapping einer Seite, wird sie als `failed` verbucht und der Lauf läuft weiter (never block).
  async collectAll(): Promise<CollectResult> {
    // JOB 2683 D2: der Abbruchgrund reist mit — bis hierher blieb er im Client hängen.
    const { pages, truncated, abbruch } = await this.client.listAllPages();
    const items: ConfluenceImportItem[] = [];
    const failed: CollectResult["failed"] = [];
    const rechte = await this.rechteDerSammlung(pages);
    for (const page of pages) {
      try {
        // R-0163 (Runde 3): auch der Bereichsimport vervollständigt Anhangslisten, die der Expand
        // nicht ganz trug. Scheitert das Nachblättern, bleibt die Teilliste MIT Unvollständig-
        // Marke — die Annahme entfernt dann keine bestehende Anhangsquelle (library-analytics).
        // Die Rechte gehören zur gelieferten Seite (`kontext(page)`); das Nachblättern ändert nur
        // ihre Anhangsliste.
        items.push(
          mapConfluencePageToImportItem(
            await this.mitAllenAnhaengen(page),
            this.mapOpts,
            undefined,
            rechte.ahnen,
            rechte.kontext(page),
          ),
        );
      } catch (err) {
        failed.push({
          ref: page.id || page.title || "(unbekannt)",
          error: err instanceof Error ? err.message : "Mapping fehlgeschlagen",
          errorClass: err instanceof Error ? err.name : "unknown",
        });
      }
    }
    // JOB 1042 D3: der Befund wird über die GELIEFERTEN Seiten gebildet, nicht über die erfolgreich
    // gemappten. Eine Seite, deren Mapping scheitert, hat trotzdem eine Ahnenkette — und gerade sie
    // will man im Befund sehen.
    return {
      items,
      failed,
      truncated,
      hierarchie: hierarchieBefund(pages),
      ...(abbruch ? { abbruch } : {}),
    };
  }

  /**
   * JOB 2691 D1 (Befund R2-2): EIN Item frisch aus der Quelle, mit Volltext. Der Snapshot der
   * Erkundung haelt seit 2691 keinen `bodyHtml` mehr (bis zu 25.000 Seiten Storage-XHTML im
   * Prozessspeicher); wer anwendet, laedt die Seite hier je Id nach. `undefined` = die Seite gibt
   * es nicht mehr — der Aufrufer weist das ehrlich aus, statt still den Auszug zu importieren.
   */
  //
  // R-0163: HIER kommen die Anhänge dazu — beim Anwenden je Seite, nicht in der Erkundung (dort
  // wären es bis zu 25.000 zusätzliche Requests für einen Überblick). Scheitert das Lesen der
  // Anhangsliste, wird die Seite trotzdem geliefert, aber mit `attachmentsIncomplete` — der Text
  // geht nicht verloren, und niemand liest „keine Anhänge", wo nur nicht gelesen wurde.
  //
  // ZUSAMMENFÜHRUNG (Nacharbeit 5): das Item trägt BEIDE Anhangsangaben — die Herkunftsangaben
  // dieser Lieferung (`sourceAttachments`, über `mitAllenAnhaengen`) und die Dateiinhalts-Liste aus
  // mains R-0163 (`attachments`, über `listAttachments`). Ihre Felder sind getrennt.
  async fetchItem(externalId: string): Promise<ConfluenceImportItem | undefined> {
    const page = await this.client.getPageById(externalId);
    if (!page) {
      return undefined;
    }
    let anhaenge: { attachments: ConfluenceAttachment[]; unvollstaendig: boolean };
    try {
      const gelesen = await this.client.listAttachments(page.id);
      anhaenge = { attachments: gelesen.attachments, unvollstaendig: gelesen.truncated };
    } catch {
      anhaenge = { attachments: [], unvollstaendig: true };
    }
    // Nacharbeit 3 (Befund F1/F4): auch der Anwendungsweg sieht Space, Gruppen und Konten frisch
    // nach — die Rechte gelten zum Zeitpunkt dieses Abrufs (`beobachtetAm`).
    const lauf = new RechteLauf(this.client);
    const space = await lauf.space();
    const ahnen = await this.ahnenNachladen(page, lauf);
    const eigene = await lauf.ebene(page);
    return mapConfluencePageToImportItem(
      await this.mitAllenAnhaengen(page),
      this.mapOpts,
      anhaenge,
      ahnen,
      { space, eigene, beobachtetAm: lauf.beobachtetAm },
    );
  }

  /**
   * R-0549: beim Nachladen EINER Seite gibt es keine Sammlung — die Vorfahren werden je ID frisch
   * nachgesehen, auf demselben Netzweg (`getPageById`). Ein Vorfahr, den das Dienstkonto nicht lesen
   * darf (404), bleibt unbekannt und macht die Seite vertraulich, ohne zuordenbare Leser.
   */
  private async ahnenNachladen(
    page: ConfluencePage,
    lauf: RechteLauf,
  ): Promise<ConfluenceAhnenBeschraenkung> {
    // Nacharbeit 2 (Befund F1): KEIN Abbruch mehr beim ersten beschränkten Vorfahren — für die
    // Leser zählt jede beschränkte Ebene (Schnittmenge), nicht nur die Einstufung.
    const ebenen = new Map<string, ConfluenceLeseEbene>();
    if (Array.isArray(page.ancestors)) {
      for (const ancestor of page.ancestors) {
        const id = ancestor?.id?.trim();
        if (!id || ebenen.has(id)) {
          continue; // ohne ID entscheidet der Mapper fail-closed
        }
        const ahne = await this.client.getPageById(id);
        if (!ahne) {
          continue;
        }
        ebenen.set(id, await lauf.ebene(ahne));
      }
    }
    return (ancestorId) => ebenen.get(ancestorId);
  }

  /**
   * R-0163: trug der Expand nicht alle Anhänge (`_links.next`), wird die Liste dieser einen Seite
   * über `/child/attachment` vollständig nachgeblättert. Gelingt das nicht (Fehler oder
   * Höchstzahl), bleibt die Seite mit ihrer Teilliste UND der Unvollständig-Marke stehen — nie wird
   * eine Teilliste als vollständig ausgegeben.
   */
  private async mitAllenAnhaengen(page: ConfluencePage): Promise<ConfluencePage> {
    // Lauf 2: auch eine mitgelieferte, aber unbrauchbare Liste wird einzeln nachgefragt. Fehlt die
    // Liste ganz, fragt der Adapter nicht nach — der Mapper meldet die Lage dann als unvollständig.
    const liste = page.children?.attachment;
    if (!page.id || liste === undefined || (istAnhangsliste(liste) && !liste._links?.next)) {
      return page;
    }
    try {
      const { attachments, complete } = await this.client.listAttachmentsStreng(page.id);
      return {
        ...page,
        children: {
          attachment: {
            results: attachments,
            ...(complete ? {} : { _links: { next: "unvollständig" } }),
          },
        },
      };
    } catch {
      return page;
    }
  }

  /**
   * R-0163 (Ben, Nacharbeit 2): der SCHREIBENDE Bereichsimport (`runConfluenceImport`) reiht die
   * Items aus `collectAll` ein — die tragen keine Anhangsliste, weil die Erkundung bewusst ohne
   * Anhangsabrufe läuft. Bevor ein solches Item in die Review-Queue geht, holt diese Methode die
   * Anhangsliste seiner Seite nach und setzt dieselben Felder wie `fetchItem`
   * (`confluenceAnhangsFelder`). Scheitert das Lesen, geht das Item mit `attachmentsIncomplete`
   * weiter — der Text geht nicht verloren, und niemand liest „keine Anhänge".
   */
  async withAttachments(item: ImportItem): Promise<ImportItem> {
    const pageId = item.externalId?.trim();
    if (!pageId) {
      return item;
    }
    let anhaenge: { attachments: ConfluenceAttachment[]; unvollstaendig: boolean };
    try {
      const gelesen = await this.client.listAttachments(pageId);
      anhaenge = { attachments: gelesen.attachments, unvollstaendig: gelesen.truncated };
    } catch {
      anhaenge = { attachments: [], unvollstaendig: true };
    }
    return { ...item, ...confluenceAnhangsFelder(anhaenge) };
  }

  /**
   * R-0163: die Rohbytes EINES Anhangs über seinen quellinternen Abrufweg (`abruf` am Import-
   * Anhang). Origin-Pin, Frist, Größenkante und Weiterleitungsregel liegen im Client.
   */
  async fetchAttachment(abruf: string): Promise<{ bytes: Buffer; mime?: string }> {
    return this.client.downloadAttachment(abruf);
  }

  /**
   * R-0162 (Abgleich): der Quell-Container, den dieser Adapter liest — derselbe Wert, den der Mapper
   * als `sourceScope` an jedes Item schreibt. Der Abgleich zieht Löschungen nur für Anker DIESES
   * Containers nach; ein Anker aus einem anderen Space ist mit diesem Lauf nicht beurteilbar.
   */
  get sourceScope(): string {
    return this.mapOpts.spaceKey;
  }

  /**
   * R-0162 (Abgleich): die GEGENPROBE vor jedem Nachziehen einer Löschung. Dass eine Seite in der
   * Liste fehlt, reicht nicht — erst wenn die Quelle sie auch je Id nicht mehr liefert (404) oder
   * sie einen AUSDRÜCKLICH unterstützten Lösch-/Archivzustand trägt (GELOESCHTE_STATUS), gilt sie
   * als gelöscht. `current` oder ein fehlendes Statusfeld heißt: die Seite existiert. Jeder andere
   * Statuswert (null, Zahl, unbekannter String) ist eine unklare Antwort und WIRFT — ebenso Netz-
   * und Serverfehler und eine 2xx-Antwort ohne gültige Seite (getPageStateById). Der Aufrufer
   * verbucht das als „nicht prüfbar" und ändert nichts.
   */
  async isGoneAtSource(externalId: string): Promise<boolean> {
    const zustand = await this.client.getPageStateById(externalId);
    if (!zustand.gefunden) {
      return true;
    }
    const status: unknown = zustand.page.status;
    if (status === undefined || status === "current") {
      return false;
    }
    if (typeof status === "string" && GELOESCHTE_STATUS.has(status)) {
      return true;
    }
    const err = new Error("Confluence-Einzelantwort mit unbekanntem Seitenstatus");
    err.name = "ConfluenceStatusUnbekannt";
    throw err;
  }
}

function isConfluenceImportEnabled(env: Record<string, string | undefined>): boolean {
  const flag = env.KLARWERK_CONFLUENCE_IMPORT;
  return flag === "1" || flag === "true";
}

// Baut den Adapter aus einem fertigen Client (nicht-geheime baseUrl/spaceKey für die Provenienz).
function adapterFromClient(client: ConfluenceRestClient): ConfluenceSourceAdapter {
  return new ConfluenceSourceAdapter(client, {
    baseUrl: client.baseUrl,
    spaceKey: client.spaceKey,
  });
}

// SCRUM-510/515 (Flag + inerter Trigger): baut den Adapter NUR, wenn das Flag KLARWERK_CONFLUENCE_IMPORT
// AN ist UND die Confluence-Credentials/Space vollständig + https konfiguriert sind. Ist das Flag AUS
// (Default), fehlt die Config oder ist baseUrl nicht https, gibt es keinen Adapter (undefined) → es
// existiert KEIN aktiver Import-Pfad. Der Token wird dabei nie als Wert nach außen gereicht (R2a).
export function createConfluenceAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
): ConfluenceSourceAdapter | undefined {
  if (!isConfluenceImportEnabled(env)) {
    return undefined;
  }
  const client = confluenceClientFromEnv(env);
  return client ? adapterFromClient(client) : undefined;
}

// Test-/Wiederverwendungs-Einstieg mit injizierbarem fetchFn. Nimmt eine token-tragende Config und ist
// daher BEWUSST modul-intern (nicht über die Paket-index exportiert) — von außen führt der einzige Weg
// über createConfluenceAdapterFromEnv (env→Client, Token in der Closure).
export function adapterFromConfig(config: ConfluenceRestConfig): ConfluenceSourceAdapter {
  return adapterFromClient(new ConfluenceRestClient(config));
}
