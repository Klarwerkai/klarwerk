// ================================================================================================
// OFFICE IM ARTIKEL · WAS DIE APP UM DEN WOPI-HOSTWEG HERUM BRAUCHT.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-artikel-editor` (Plan U2–U4 aus
// `docs/entscheidungen/office-im-artikel-integrationsweg.md`). Der Hostweg selbst steht unverändert
// in `office-wopi-host.ts`; diese Datei liefert die Teile, die ihn an Klarwerk binden:
//
//   · `leseOfficeEditorUmgebung` — Editor-Herkunft, WOPI-Adresse und Markenschlüssel aus der
//     Betreiberumgebung. Fehlt etwas, ist der Editor „nicht eingerichtet"; die Fläche sagt das.
//   · `editorAktion` — aus der Discovery des Editors die Adresse für Bearbeiten/Ansehen einer Endung.
//   · `wopiArtikel` / `koWopiZugriff` — der Vertrag `WopiArtikelZugriff` über den echten
//     Wissensobjektdienst (`KoService.uebernimmOfficeFassung`), statt der Attrappe der Probe.
//   · `anhangVerlauf` / `belegstellenZumAnhang` — welche Fassungen das Dokument geändert haben und
//     welche Belegstellen des Artikels an welchem Dokumentstand hängen.
//
// KEINE NEUE RECHTEACHSE: die Rechte kommen aus `ko.read` + `darfSehen`, `ko.create` und
// `users.manage` — dieselben wie an `revise` (`officeSchreibweg`).

import type { EvidenceRecord, KnowledgeObject, KoVersionSnapshot } from "../../knowledge-object";
import { officeFormatFuer } from "./office-wopi";
import type { WopiArtikel, WopiArtikelZugriff } from "./office-wopi-host";

// ------------------------------------------------------------------------------------------------
// UMGEBUNG
// ------------------------------------------------------------------------------------------------

export interface OfficeEditorUmgebung {
  /** Herkunft des Editors, wie der BROWSER ihn erreicht (`frame-src`, Formularziel). */
  readonly editorHerkunft: string;
  /** Wo der SERVER die Discovery liest; ohne eigene Angabe dieselbe Herkunft. */
  readonly discoveryUrl: string;
  /** Wie der EDITOR Klarwerk erreicht (Basis von `WOPISrc`), ohne abschließenden Schrägstrich. */
  readonly wopiBasis: string;
  /** Herkunft der Klarwerk-Seite im Browser (CheckFileInfo `PostMessageOrigin`). */
  readonly seitenHerkunft: string;
  readonly schluessel: Buffer;
}

export type OfficeEditorEinrichtung =
  | { readonly eingerichtet: true; readonly umgebung: OfficeEditorUmgebung }
  | { readonly eingerichtet: false; readonly fehlt: readonly string[] };

function herkunftVon(roh: string | undefined): string | undefined {
  if (!roh) {
    return undefined;
  }
  try {
    const url = new URL(roh);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Liest die Einrichtung des eingebetteten Editors. Der Schlüssel (`KLARWERK_WOPI_SCHLUESSEL`) ist
 * base64 oder hex und muss mindestens 32 Byte ergeben; er erscheint nie in einer Antwort oder einem
 * Protokolleintrag.
 */
export function leseOfficeEditorUmgebung(env: NodeJS.ProcessEnv): OfficeEditorEinrichtung {
  const fehlt: string[] = [];
  const editorHerkunft = herkunftVon(env.KLARWERK_OFFICE_EDITOR_URL);
  if (!editorHerkunft) {
    fehlt.push("KLARWERK_OFFICE_EDITOR_URL");
  }
  // Ohne eigene Angabe erreicht der Editor Klarwerk unter derselben Adresse wie der Browser.
  const seitenHerkunft = herkunftVon(env.APP_BASE_URL);
  const wopiBasis = herkunftVon(env.KLARWERK_WOPI_HOST_URL) ?? seitenHerkunft;
  if (!wopiBasis) {
    fehlt.push("KLARWERK_WOPI_HOST_URL");
  }
  const roh = env.KLARWERK_WOPI_SCHLUESSEL ?? "";
  const schluessel = /^[0-9a-f]+$/i.test(roh)
    ? Buffer.from(roh, "hex")
    : Buffer.from(roh, "base64");
  if (schluessel.length < 32) {
    fehlt.push("KLARWERK_WOPI_SCHLUESSEL");
  }
  if (!editorHerkunft || !wopiBasis || fehlt.length > 0) {
    return { eingerichtet: false, fehlt };
  }
  const intern = herkunftVon(env.KLARWERK_OFFICE_EDITOR_INTERN_URL) ?? editorHerkunft;
  return {
    eingerichtet: true,
    umgebung: {
      editorHerkunft,
      discoveryUrl: `${intern}/hosting/discovery`,
      wopiBasis,
      seitenHerkunft: seitenHerkunft ?? wopiBasis,
      schluessel,
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DISCOVERY
// ------------------------------------------------------------------------------------------------

function attribute(tag: string): Record<string, string> {
  const werte: Record<string, string> = {};
  for (const treffer of tag.matchAll(/([A-Za-z_:-]+)="([^"]*)"/g)) {
    // Die Discovery schreibt die WOPI-Platzhalter `<…>` als `&lt;…&gt;`; `&amp;` zuletzt.
    werte[treffer[1] as string] = (treffer[2] as string)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }
  return werte;
}

export interface DiscoveryAktion {
  readonly name: string;
  readonly ext: string;
  /** Der `name` des umschließenden `<app>`: bei Collabora oft der Medientyp. */
  readonly app: string;
  readonly urlsrc: string;
}

/** Alle `<action>` der Discovery mit ihrem `<app>`. */
export function leseDiscovery(xml: string): DiscoveryAktion[] {
  const aktionen: DiscoveryAktion[] = [];
  for (const app of xml.matchAll(/<app\s([^>]*)>([\s\S]*?)<\/app>/g)) {
    const appName = attribute(app[1] as string).name ?? "";
    for (const aktion of (app[2] as string).matchAll(/<action\s[^>]*>/g)) {
      const a = attribute(aktion[0]);
      if (a.name && a.urlsrc) {
        aktionen.push({ name: a.name, ext: a.ext ?? "", app: appName, urlsrc: a.urlsrc });
      }
    }
  }
  return aktionen;
}

/**
 * Die Editor-Adresse für einen Anhang: Pfad und Abfrage der passenden `urlsrc` (WOPI-Platzhalter
 * `<…>` entfernt) an der Herkunft, die der Browser erreicht, dazu `WOPISrc`. `undefined`, wenn die
 * Discovery für Endung und Medientyp keine solche Aktion nennt.
 */
export function editorAktion(args: {
  aktionen: readonly DiscoveryAktion[];
  aktion: "edit" | "view";
  endung: string;
  mime: string;
  editorHerkunft: string;
  wopiSrc: string;
}): string | undefined {
  const passend = (a: DiscoveryAktion) =>
    a.name === args.aktion && (a.ext === args.endung || a.app === args.mime);
  const treffer = args.aktionen.find(passend);
  if (!treffer) {
    return undefined;
  }
  const quelle = new URL(treffer.urlsrc.replace(/<[^>]*>/g, ""));
  const abfrage = new URLSearchParams(quelle.search);
  abfrage.set("WOPISrc", args.wopiSrc);
  return `${args.editorHerkunft}${quelle.pathname}?${abfrage.toString()}`;
}

// ------------------------------------------------------------------------------------------------
// ARTIKEL ↔ HOSTWEG
// ------------------------------------------------------------------------------------------------

export function wopiArtikel(ko: KnowledgeObject): WopiArtikel {
  return {
    koId: ko.id,
    version: ko.version,
    status: ko.status,
    author: ko.author,
    attachments: (ko.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      mime: a.mime,
      ...(a.objectId === undefined ? {} : { objectId: a.objectId }),
      ...(a.size === undefined ? {} : { size: a.size }),
    })),
  };
}

/** Der schmale Teil des Wissensobjektdienstes, den der Hostweg braucht. */
export interface OfficeKoDienst {
  get(id: string): Promise<KnowledgeObject | undefined>;
  uebernimmOfficeFassung(
    id: string,
    input: {
      anhangId: string;
      objectId: string;
      size: number;
      expectedVersion: number;
      restoredFrom?: number;
    },
    actor: string,
  ): Promise<{ ko: KnowledgeObject; belegOffen: boolean }>;
}

export function koWopiZugriff(ko: OfficeKoDienst): WopiArtikelZugriff {
  return {
    async lies(koId) {
      const gelesen = await ko.get(koId);
      return gelesen ? wopiArtikel(gelesen) : undefined;
    },
    async uebernimm(args) {
      try {
        const { ko: neu } = await ko.uebernimmOfficeFassung(
          args.koId,
          {
            anhangId: args.anhangId,
            objectId: args.objectId,
            size: args.size,
            expectedVersion: args.expectedVersion,
          },
          args.nutzerId,
        );
        return { version: neu.version };
      } catch (fehler) {
        // Mehrere App-Prozesse: den Verlierer weist erst der bedingte UPDATE der Ablage ab
        // (`STALE_WRITE`, repo-pg.ts). Für den Hostweg ist das dieselbe Tatsache wie `KO_STALE`.
        if (fehlerCode(fehler) === "STALE_WRITE") {
          throw Object.assign(new Error("Der Eintrag wurde inzwischen geändert."), {
            code: "KO_STALE",
          });
        }
        throw fehler;
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------
// VERLAUF UND BELEGSTELLEN
// ------------------------------------------------------------------------------------------------

export interface AnhangFassung {
  /** Artikelfassung, ab der dieser Dokumentstand galt. */
  readonly version: number;
  readonly at: string;
  readonly author: string;
  readonly objectId: string;
  /** Wahr für den Stand, der heute am Artikel hängt. */
  readonly aktuell: boolean;
  /** Aus welcher früheren Fassung dieser Stand zurückgeholt wurde. */
  readonly restoredFrom?: number;
}

/**
 * Jeder Dokumentstand eines Anhangs, ältester zuerst: eine Zeile je Wechsel der `objectId`.
 *
 * ZWEI QUELLEN, weil keine allein vollständig ist: Ein nach dem Anlegen angehängtes Dokument steht in
 * KEINEM Fassungs-Snapshot (`addAttachment` schreibt keinen), wohl aber in der append-only Belegkette
 * (`kind: "attachment"`, mit der Fassung, an der es hing). Umgekehrt kann ein Beleg fehlen
 * (`belegOffen`), der Snapshot der Übernahme aber stehen. Beide werden je (Fassung, Objekt) vereinigt.
 */
export function anhangVerlauf(
  ko: KnowledgeObject,
  fassungen: readonly KoVersionSnapshot[],
  belege: readonly EvidenceRecord[],
  anhangId: string,
): AnhangFassung[] {
  const aktuell = (ko.attachments ?? []).find((a) => a.id === anhangId)?.objectId;
  const kandidaten = new Map<string, Omit<AnhangFassung, "aktuell">>();
  for (const b of belege) {
    if (b.kind === "attachment" && b.attachmentId === anhangId && b.objectId) {
      const schluessel = `${b.koVersion}:${b.objectId}`;
      if (!kandidaten.has(schluessel)) {
        kandidaten.set(schluessel, {
          version: b.koVersion,
          at: b.createdAt,
          author: b.createdBy,
          objectId: b.objectId,
        });
      }
    }
  }
  for (const f of fassungen) {
    const objectId = f.snapshot.attachments?.find((a) => a.id === anhangId)?.objectId;
    if (objectId && !kandidaten.has(`${f.version}:${objectId}`)) {
      kandidaten.set(`${f.version}:${objectId}`, {
        version: f.version,
        at: f.at,
        author: f.author,
        objectId,
      });
    }
  }
  const herkunft = new Map(
    ko.history
      .filter((h) => h.anhangGeaendert === anhangId && h.anhangZurueckAus !== undefined)
      .map((h) => [h.version, h.anhangZurueckAus as number] as const),
  );
  const zeilen: AnhangFassung[] = [];
  let vorher: string | undefined;
  for (const k of [...kandidaten.values()].sort(
    (a, b) => a.version - b.version || a.at.localeCompare(b.at),
  )) {
    if (k.objectId === vorher) {
      continue;
    }
    vorher = k.objectId;
    const restoredFrom = herkunft.get(k.version);
    zeilen.push({ ...k, aktuell: false, ...(restoredFrom === undefined ? {} : { restoredFrom }) });
  }
  // Nur die JÜNGSTE Zeile mit dem heutigen Objekt ist „aktuell" — ein zurückgeholter Stand taucht
  // sonst zweimal als aktuell auf.
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const zeile = zeilen[i] as AnhangFassung;
    if (zeile.objectId === aktuell) {
      zeilen[i] = { ...zeile, aktuell: true };
      break;
    }
  }
  return zeilen;
}

export interface BelegstelleZumAnhang {
  readonly quelleId: string;
  readonly label: string;
  readonly excerpt: string | null;
  /**
   * `aktuell`: die Belegstelle hängt am heutigen Dokument. `frueher`: sie wurde aus einem früheren
   * Dokumentstand abgeleitet — die Aussage ist seit der Dokumentänderung NICHT neu geprüft.
   */
  readonly stand: "aktuell" | "frueher";
  /** Bei `frueher`: die Fassung, ab der jener Dokumentstand galt (falls im Verlauf zu finden). */
  readonly ausFassung?: number;
}

/**
 * Die Belegstellen (`ko.sources`), die an einem Stand dieses Anhangs hängen (`KoSource.objectId`,
 * vom Server gegen die Anhangsliste bestätigt). Dokumentänderungen ändern keine Belegstelle; sie
 * werden hier nur ehrlich ihrem Dokumentstand zugeordnet.
 */
export function belegstellenZumAnhang(
  ko: KnowledgeObject,
  verlauf: readonly AnhangFassung[],
  anhangId: string,
): BelegstelleZumAnhang[] {
  const aktuell = (ko.attachments ?? []).find((a) => a.id === anhangId)?.objectId;
  const fruehere = new Map(verlauf.map((z) => [z.objectId, z.version] as const));
  const ergebnis: BelegstelleZumAnhang[] = [];
  for (const quelle of ko.sources ?? []) {
    if (!quelle.objectId) {
      continue;
    }
    if (quelle.objectId === aktuell) {
      ergebnis.push({
        quelleId: quelle.id,
        label: quelle.label,
        excerpt: quelle.excerpt,
        stand: "aktuell",
      });
    } else if (fruehere.has(quelle.objectId)) {
      ergebnis.push({
        quelleId: quelle.id,
        label: quelle.label,
        excerpt: quelle.excerpt,
        stand: "frueher",
        ausFassung: fruehere.get(quelle.objectId) as number,
      });
    }
  }
  return ergebnis;
}

export function fehlerCode(fehler: unknown): string {
  return fehler && typeof fehler === "object" && "code" in fehler
    ? String((fehler as { code: unknown }).code)
    : "";
}

/** Die Endung eines Office-Anhangs, wenn er einer ist. */
export function officeEndung(anhang: { name: string; mime: string }): string | undefined {
  return officeFormatFuer(anhang.name, anhang.mime)?.endung;
}
