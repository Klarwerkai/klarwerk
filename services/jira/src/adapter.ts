// ================================================================================================
// R-0170 — JIRA ALS WEITERER ADAPTER DES QUELL-AGNOSTISCHEN IMPORT-VERTRAGS.
// ================================================================================================
//
// `library-analytics/src/types.ts` hält den Platz seit SCRUM-510 frei: „Ein Adapter (Confluence =
// #1, Jira-TEST später = #2) liest seine Quelle und liefert NORMALISIERTE ImportItems". Dieser Adapter
// besetzt ihn. Er baut KEINEN zweiten Import-Kern: was er liefert, sind `ImportItem`s, und alles
// danach (Kandidat, Prüfung, Wissensobjekt, Herkunfts-Anker) ist der vorhandene Weg.
//
// ER KENNT DEN SCHALTER NICHT — dieselbe Entscheidung wie bei SharePoint: über die ANWESENHEIT der
// Fläche entscheidet `schalterAn("jiraImport")` an der einen Registrierungsstelle in `build-app.ts`.
// Was dieses Modul entscheidet, ist allein, ob mit den hinterlegten Zugangsdaten ein Client zustande
// kommt.
//
// DIE LESERECHTE KOMMEN BEI JEDER ÜBERNAHME MIT, UND ZWAR FRISCH. Die Rollenbesetzung wird höchstens
// einmal je Adapter gelesen (eine Übernahme = ein Adapter, `makeAdapter()` je Anfrage) und an jeden
// Vorgang dieser Übernahme gehängt. Kann sie nicht gelesen werden, wird NICHTS übernommen
// (`rollen-nicht-lesbar`, Begründung in rest-client.ts). Die Auswahlliste liest sie nicht: ein Blick
// in die Quelle braucht keine Leserechte, und er soll nicht an ihnen scheitern.

import type { ImportItem } from "../../library-analytics";
import { istEpic, jiraZeitpunkt, mapJiraIssueToImportItem } from "./mapper";
import {
  type JiraIssue,
  JiraRequestError,
  type JiraRestClient,
  type JiraRollenbesetzung,
  jiraClientFromEnv,
  jiraFehlerlage,
} from "./rest-client";

/** Ein Eintrag der Auswahlliste — genug, um ihn zu erkennen und zu wählen, mehr nicht. */
export interface JiraVorgang {
  /** Der Vorgangsschlüssel (z. B. `WART-12`) — er wird der Herkunfts-Anker. */
  readonly key: string;
  readonly titel: string;
  /** Der Vorgangstyp, wie Jira ihn nennt (`Epic`, `Story`, `Bug` …), oder `null`. */
  readonly typ: string | null;
  readonly epic: boolean;
  /** Schlüssel des übergeordneten Vorgangs (z. B. des Epics), oder `null`. */
  readonly elternteil: string | null;
  readonly url: string;
  readonly geaendertAm: string | null;
}

/** Eine Seite der Auswahlliste. `weiter` ist der Cursor auf die nächste Seite, `null` = Ende. */
export interface JiraVorgangsliste {
  readonly vorgaenge: JiraVorgang[];
  readonly weiter: string | null;
}

/** Eine Seite des Projekts als übernahmefertige Items — samt den Vorgängen, die keine trugen. */
export interface JiraItemSeite {
  readonly items: ImportItem[];
  /** Schlüssel (oder `(ohne Schlüssel)`) der Vorgänge ohne Titel/Schlüssel — nie still verworfen. */
  readonly unbrauchbar: string[];
  readonly weiter: string | null;
}

export class JiraSourceAdapter {
  readonly source = "Jira";
  private rollen: Promise<JiraRollenbesetzung> | undefined;

  constructor(private readonly client: JiraRestClient) {}

  /** Das Projekt, auf das dieser Adapter gescoped ist (nicht geheim, für die Provenienz). */
  get projectKey(): string {
    return this.client.projectKey;
  }

  /** Kann dieser Adapter den Cursor deuten? (Die Route antwortet sonst mit einem ehrlichen 400.) */
  istGueltigeFortsetzung(weiter: string): boolean {
    return this.client.istGueltigerCursor(weiter);
  }

  /** EINE Seite der Vorgänge des Projekts zur Auswahl. Lesend, ohne Rollenabruf. */
  async listeVorgaenge(weiter: string | null): Promise<JiraVorgangsliste> {
    const seite = await this.client.listeVorgangsSeite(weiter);
    const vorgaenge: JiraVorgang[] = [];
    for (const issue of seite.issues) {
      const eintrag = this.zuVorgang(issue);
      if (eintrag) {
        vorgaenge.push(eintrag);
      }
    }
    return { vorgaenge, weiter: seite.weiter };
  }

  /**
   * EIN Vorgang als übernahmefertiges Item, MIT den Projektrollen als Leserechte. `undefined`
   * heisst: Jira hat geantwortet, aber der Vorgang trägt keinen Titel. Dass es ihn nicht (mehr)
   * gibt, kommt als Lage `nicht-gefunden` aus dem Client.
   */
  async holeItem(schluessel: string): Promise<ImportItem | undefined> {
    const issue = await this.client.holeVorgang(schluessel);
    return this.alsItem(issue, await this.leseRollen());
  }

  /** EINE Seite des Projekts als Items, MIT Leserechten — der Baustein der Projektübernahme. */
  async itemSeite(weiter: string | null): Promise<JiraItemSeite> {
    // Rollen ZUERST: sind sie nicht lesbar, wird auch keine Vorgangsseite mehr abgerufen.
    const rollen = await this.leseRollen();
    const seite = await this.client.listeVorgangsSeite(weiter);
    const items: ImportItem[] = [];
    const unbrauchbar: string[] = [];
    for (const issue of seite.issues) {
      const item = this.alsItem(issue, rollen);
      if (item) {
        items.push(item);
      } else {
        unbrauchbar.push(issue.key?.trim() || "(ohne Schlüssel)");
      }
    }
    return { items, unbrauchbar, weiter: seite.weiter };
  }

  private alsItem(issue: JiraIssue, rollen: JiraRollenbesetzung): ImportItem | undefined {
    return mapJiraIssueToImportItem(issue, {
      baseUrl: this.client.baseUrl,
      projectKey: this.client.projectKey,
      rollen,
    });
  }

  /**
   * Die Rollenbesetzung, höchstens einmal je Adapter gelesen. Ein 403 an dieser Stelle heisst nicht
   * „du darfst das Projekt nicht lesen", sondern „du darfst seine Rollen nicht lesen" — und wird
   * deshalb zu einer eigenen Lage, damit der Mensch den richtigen Satz liest.
   */
  private leseRollen(): Promise<JiraRollenbesetzung> {
    this.rollen ??= this.client.leseRollenbesetzung().catch((err: unknown) => {
      this.rollen = undefined;
      if (jiraFehlerlage(err) === "keine-berechtigung") {
        throw new JiraRequestError("rollen-nicht-lesbar");
      }
      throw err;
    });
    return this.rollen;
  }

  private zuVorgang(issue: JiraIssue): JiraVorgang | null {
    const key = issue.key?.trim();
    const titel = issue.fields?.summary?.trim();
    if (!key || !titel) {
      return null;
    }
    return {
      key,
      titel,
      typ: issue.fields?.issuetype?.name?.trim() || null,
      epic: istEpic(issue),
      elternteil: issue.fields?.parent?.key?.trim() || null,
      url: `${this.client.baseUrl}/browse/${encodeURIComponent(key)}`,
      geaendertAm: jiraZeitpunkt(issue.fields?.updated) ?? null,
    };
  }
}

/**
 * Baut den Adapter aus der Umgebung — oder gar nicht. `undefined` heisst „nicht eingerichtet"; der
 * Aufrufer macht daraus den EINEN Fehlercode, den Confluence und SharePoint dafür nennen
 * (`IMPORT_UNAVAILABLE`).
 */
export function createJiraAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
): JiraSourceAdapter | undefined {
  const client = jiraClientFromEnv(env);
  return client ? new JiraSourceAdapter(client) : undefined;
}
