// SCRUM-510: Confluence als Adapter #1 des quell-agnostischen Import-Vertrags (SourceAdapter). Der
// Adapter liest die Space-Seiten (read-only REST) und liefert normalisierte ImportItems — der Import-
// Kern (createImportCandidates → acceptToKo) kennt die Quelle nicht. Eine spätere Quelle (Jira-TEST,
// Adapter #2) ist NUR ein weiterer SourceAdapter, kein Umbau dieses Pfads.
//
// R2a (Encapsulation): nach außen (Paket-index) ist NUR createConfluenceAdapterFromEnv erreichbar — der
// Roh-Client, seine token-tragende Config und der env-Resolver bleiben modul-intern.

import type { ImportItem, SourceAdapter } from "../../library-analytics";
import {
  type ConfluenceImportItem,
  type ConfluenceMapOptions,
  confluenceAhnenBefund,
  confluenceAncestorIds,
  confluenceAnhangsFelder,
  mapConfluencePageToImportItem,
} from "./mapper";
import type {
  ConfluenceAbbruch,
  ConfluenceAttachment,
  ConfluencePage,
  ConfluenceRestClient,
} from "./rest-client";
import { confluenceClientFromEnv, istAnhangsliste } from "./rest-client";

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

export class ConfluenceSourceAdapter implements SourceAdapter {
  readonly source = "Confluence";

  constructor(
    private readonly client: ConfluenceRestClient,
    private readonly mapOpts: ConfluenceMapOptions,
  ) {}

  async collect(): Promise<ConfluenceImportItem[]> {
    const pages = await this.client.listPages();
    return pages.map((page) => mapConfluencePageToImportItem(page, this.mapOpts));
  }

  // SCRUM-510 WP2: liest den GESAMTEN Space (Cursor-Pagination) und mappt jede Seite EINZELN. Scheitert
  // das Mapping einer Seite, wird sie als `failed` verbucht und der Lauf läuft weiter (never block).
  async collectAll(): Promise<CollectResult> {
    // JOB 2683 D2: der Abbruchgrund reist mit — bis hierher blieb er im Client hängen.
    const { pages, truncated, abbruch } = await this.client.listAllPages();
    const items: ConfluenceImportItem[] = [];
    const failed: CollectResult["failed"] = [];
    for (const page of pages) {
      try {
        // R-0163 (Runde 3): auch der Bereichsimport vervollständigt Anhangslisten, die der Expand
        // nicht ganz trug. Scheitert das Nachblättern, bleibt die Teilliste MIT Unvollständig-
        // Marke — die Annahme entfernt dann keine bestehende Anhangsquelle (library-analytics).
        items.push(mapConfluencePageToImportItem(await this.mitAllenAnhaengen(page), this.mapOpts));
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
    return mapConfluencePageToImportItem(
      await this.mitAllenAnhaengen(page),
      this.mapOpts,
      anhaenge,
    );
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
// R-1349: exportiert, damit Tests Client und Adapter selbst zusammensetzen — derselbe Weg, den
// `createConfluenceAdapterFromEnv` im Betrieb nimmt (Muster des SharePoint-Moduls).
export function adapterFromClient(client: ConfluenceRestClient): ConfluenceSourceAdapter {
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

// R-1349: Hier stand `adapterFromConfig`, ein Test-Einstieg mit token-tragender Config, den kein
// Produktweg rief. Er ist entfernt; Tests bauen über `tests/support/confluence-adapter.ts`
// (`adapterFromClient(new ConfluenceRestClient(config))`). Von außen führt der einzige Weg weiter
// über `createConfluenceAdapterFromEnv` (env→Client, Token in der Closure).
