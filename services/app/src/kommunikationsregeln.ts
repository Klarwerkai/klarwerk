import type { Pool } from "pg";
import { type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { Mailer } from "../../notifications";
import type { Notification, NotificationKind } from "./notification-feed";

// ================================================================================================
// KOMMUNIKATIONSREGELN (produkt:20261007:veroeffentlichungsoptionen:admin-20261009 · ADMIN-12).
// ================================================================================================
//
// WAS DAS IST. Die zentrale Übersicht, WELCHES Ereignis WEN über WELCHEN Kanal WIE OFT erreicht —
// und die wenigen Stellen, an denen das Unternehmen und die einzelne Person daran etwas einstellen
// dürfen. Gebaut als Folgeauftrag der Veröffentlichung mit Meldungswahl (`veroeffentlichung.ts`):
// deren Empfängerkreis, Zustellungen und Glockenweg bleiben, wie sie sind, und werden hier nur
// erklärt, gefiltert und um einen nachvollziehbaren Zustellstatus ergänzt.
//
// VIER DINGE BLEIBEN GETRENNT:
//   · UNTERNEHMENSVORGABE — was die Verwaltung (`users.manage`) für alle festlegt: ob eine Meldung
//     persönlich abwählbar ist, ob sie sofort oder als tägliche Zusammenfassung kommt, ob sie
//     zusätzlich per Mail geht. Jede Änderung ist eine neue Fassung samt Protokolleintrag.
//   · PERSÖNLICHE EINSTELLUNG — die eigene Abwahl einer abwählbaren Meldung. Sie wirkt nur, solange
//     die Vorgabe die Abwahl erlaubt; nimmt die Verwaltung die Erlaubnis zurück, bleibt die Wahl
//     gespeichert, ist aber unwirksam (und wird so angezeigt).
//   · ZUSAMMENFASSUNG — gewöhnliche Veröffentlichungsmeldungen eines Tages werden zu EINER Meldung
//     gebündelt, die ab dem Folgetag in der Glocke steht. Was darin steht, wird beim Abruf
//     zusammengestellt: mit den Leserechten und der persönlichen Abwahl DIESES Zeitpunkts.
//   · VERBINDLICHE KENNTNISNAHME — hat ihren eigenen Weg (`kenntnisnahme.ts`). Sie ist weder
//     abwählbar noch zusammenfassbar, und „still" berührt sie nicht.
//
// NUR ANGESCHLOSSENE KANÄLE SIND AKTIV. Die Glocke ist immer da. Mail gilt als eingerichtet, wenn
// ein echter Versandweg (SMTP) verdrahtet ist — dieselbe Auskunft wie im Verarbeitungsverzeichnis
// (`mailVersand`). Push hat dieses Produkt nicht; er erscheint als „nicht angeschlossen" und lässt
// sich nirgends auswählen.
//
// ZUSTELLSTATUS. Je Veröffentlichung, Empfänger und Kanal eine Zeile (`meldung_zustellstatus`):
//   angelegt     — die Meldung ist für diese Person festgehalten;
//   zugestellt   — soweit belegt: die Glocke hat sie der Person ausgeliefert bzw. der Mailserver hat
//                  die Mail angenommen (mehr als die Annahme kann ein Mailserver nicht belegen);
//   fehlgeschlagen — der Mailserver hat abgelehnt;
//   entfallen    — zum Versandzeitpunkt kein Zugriff mehr oder persönlich abgewählt.
// „Gelesen" ist der vorhandene Gelesenstatus der Glocke, „bestätigt" die Kenntnisnahme — beide
// werden gelesen, nicht doppelt gespeichert.
//
// KEINE DOPPELTEN MELDUNGEN. Der Primärschlüssel (Vermerk, Empfänger, Kanal) sperrt doppelte Zeilen;
// eine Mail wird nur verschickt, nachdem ihre Zeile ATOMAR beansprucht wurde (`versuch_am` war
// leer). Eine Wiederaufnahme schickt deshalb nur, was noch nie versucht wurde.

// ------------------------------------------------------------------------------------------------
// DER EREIGNISKATALOG — geschlossen, aus dem vorhandenen Meldungsweg abgeleitet.
// ------------------------------------------------------------------------------------------------

export type KanalId = "glocke" | "mail" | "push";
export type Haeufigkeit = "sofort" | "taeglich";

export type EreignisId =
  | "veroeffentlichung"
  | "veroeffentlichung_hervorgehoben"
  | "kenntnisnahme"
  | "zuweisung"
  | "frische"
  | "reklamation"
  | "wirkung"
  | "loeschantrag"
  | "qualitaet";

/** Wer eine Meldung bekommt — als feste Regel des Codes, nicht als freier Text. */
export type Zielgruppe =
  | "leser_ohne_veroeffentlicher"
  | "ausgewaehlte_empfaenger"
  | "zugewiesene_pruefer"
  | "verantwortliche_person"
  | "autor"
  | "verwaltung"
  | "leser_mit_sicht";

export interface EreignisDefinition {
  id: EreignisId;
  /** Die Arten der Glocke, die zu diesem Ereignis gehören. */
  feedArten: readonly NotificationKind[];
  zielgruppe: Zielgruppe;
  /** Die Kanäle, über die das Ereignis fachlich gehen kann — angeschlossen oder nicht. */
  kanaele: readonly KanalId[];
  /** Verbindlich: eine ausdrücklich angeforderte Kenntnisnahme — nie abwählbar, nie gebündelt. */
  verbindlich: boolean;
  /** Erinnert der vorhandene Weg selbst (Frist, Erinnerung)? */
  erinnerung: boolean;
  /** Mail geht hier fest mit, sobald Mail eingerichtet ist (vorhandener Weg, nicht einstellbar). */
  mailFest: boolean;
  /** Was die Unternehmensvorgabe an diesem Ereignis einstellen darf. */
  einstellbar: { abwahl: boolean; zusammenfassung: boolean; mail: boolean };
}

const NICHTS = { abwahl: false, zusammenfassung: false, mail: false } as const;

export const EREIGNISSE: readonly EreignisDefinition[] = [
  {
    id: "veroeffentlichung",
    feedArten: ["veroeffentlichung"],
    zielgruppe: "leser_ohne_veroeffentlicher",
    kanaele: ["glocke", "mail", "push"],
    verbindlich: false,
    erinnerung: false,
    mailFest: false,
    einstellbar: { abwahl: true, zusammenfassung: true, mail: true },
  },
  {
    // Hervorgehoben: derselbe Kreis wie „normal" — die Markierung erweitert keine Rechte. Sie ist
    // nicht abwählbar und wird nie gebündelt, sonst wäre „wichtig" bedeutungslos.
    id: "veroeffentlichung_hervorgehoben",
    feedArten: ["veroeffentlichung"],
    zielgruppe: "leser_ohne_veroeffentlicher",
    kanaele: ["glocke", "mail", "push"],
    verbindlich: false,
    erinnerung: false,
    mailFest: false,
    einstellbar: { abwahl: false, zusammenfassung: false, mail: true },
  },
  {
    id: "kenntnisnahme",
    feedArten: ["kenntnisnahme"],
    zielgruppe: "ausgewaehlte_empfaenger",
    kanaele: ["glocke", "push"],
    verbindlich: true,
    erinnerung: true,
    mailFest: false,
    einstellbar: NICHTS,
  },
  {
    // Die Prüfzuweisung verschickt schon heute eine Mail (`notify.ts`), sobald Mail eingerichtet
    // ist.
    id: "zuweisung",
    feedArten: ["assignment", "return"],
    zielgruppe: "zugewiesene_pruefer",
    kanaele: ["glocke", "mail", "push"],
    verbindlich: false,
    erinnerung: false,
    mailFest: true,
    einstellbar: NICHTS,
  },
  {
    id: "frische",
    feedArten: ["frische"],
    zielgruppe: "verantwortliche_person",
    kanaele: ["glocke", "push"],
    verbindlich: false,
    erinnerung: true,
    mailFest: false,
    einstellbar: NICHTS,
  },
  {
    id: "reklamation",
    feedArten: ["reklamation"],
    zielgruppe: "verantwortliche_person",
    kanaele: ["glocke", "push"],
    verbindlich: false,
    erinnerung: false,
    mailFest: false,
    einstellbar: NICHTS,
  },
  {
    id: "wirkung",
    feedArten: ["impact"],
    zielgruppe: "autor",
    kanaele: ["glocke", "push"],
    verbindlich: false,
    erinnerung: false,
    mailFest: false,
    einstellbar: { abwahl: true, zusammenfassung: false, mail: false },
  },
  {
    id: "loeschantrag",
    feedArten: ["loeschantrag"],
    zielgruppe: "verwaltung",
    kanaele: ["glocke", "push"],
    verbindlich: false,
    erinnerung: true,
    mailFest: false,
    einstellbar: NICHTS,
  },
  {
    id: "qualitaet",
    feedArten: ["conflict", "escalation", "duplicate", "gap"],
    zielgruppe: "leser_mit_sicht",
    kanaele: ["glocke", "push"],
    verbindlich: false,
    erinnerung: false,
    mailFest: false,
    einstellbar: NICHTS,
  },
];

export function ereignis(id: EreignisId): EreignisDefinition {
  const def = EREIGNISSE.find((e) => e.id === id);
  if (!def) {
    throw new Error(`unbekanntes Ereignis ${id}`);
  }
  return def;
}

function istEreignis(wert: unknown): wert is EreignisId {
  return typeof wert === "string" && EREIGNISSE.some((e) => e.id === wert);
}

// ------------------------------------------------------------------------------------------------
// UNTERNEHMENSVORGABE — Fassungen.
// ------------------------------------------------------------------------------------------------

export interface Vorgabe {
  abwaehlbar: boolean;
  haeufigkeit: Haeufigkeit;
  mail: boolean;
}

export interface RegelFassung {
  /** 0: die Werksvorgabe — noch nie geändert. */
  version: number;
  vorgaben: Record<EreignisId, Vorgabe>;
  geaendertVon: string | null;
  geaendertAm: string | null;
}

/** Die Werksvorgabe: gewöhnliche Meldungen abwählbar, alles sofort, keine Mail. */
export function werksvorgabe(): RegelFassung {
  const vorgaben = {} as Record<EreignisId, Vorgabe>;
  for (const def of EREIGNISSE) {
    vorgaben[def.id] = { abwaehlbar: def.einstellbar.abwahl, haeufigkeit: "sofort", mail: false };
  }
  return { version: 0, vorgaben, geaendertVon: null, geaendertAm: null };
}

/** Eine gespeicherte Vorgabe, gegen den heutigen Katalog gelesen: fehlende Ereignisse ab Werk. */
function vollstaendig(vorgaben: Partial<Record<string, Vorgabe>>): Record<EreignisId, Vorgabe> {
  const ab = werksvorgabe().vorgaben;
  for (const def of EREIGNISSE) {
    const v = vorgaben[def.id];
    if (v) {
      ab[def.id] = {
        abwaehlbar: def.einstellbar.abwahl && v.abwaehlbar === true,
        haeufigkeit:
          def.einstellbar.zusammenfassung && v.haeufigkeit === "taeglich" ? "taeglich" : "sofort",
        mail: def.einstellbar.mail && v.mail === true,
      };
    }
  }
  return ab;
}

export class KommunikationFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 503,
    readonly code: string,
    message: string,
    readonly extra: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "KommunikationFehler";
  }
}

// ------------------------------------------------------------------------------------------------
// ZUSTELLSTATUS.
// ------------------------------------------------------------------------------------------------

export type ZustellKanal = "glocke" | "mail";
export type ZustellStatus = "angelegt" | "zugestellt" | "fehlgeschlagen" | "entfallen";
export type EntfallGrund = "kein_zugriff" | "abgewaehlt";

export interface ZustellZeile {
  vermerkId: string;
  koId: string;
  empfaengerId: string;
  kanal: ZustellKanal;
  status: ZustellStatus;
  angelegtAm: string;
  /** Wann der Versand begonnen hat (nur Mail) — gesetzt beim Beanspruchen, nie zurückgesetzt. */
  versuchAm: string | null;
  ergebnisAm: string | null;
  /** Feste Ursache, nie eine Servermeldung (die könnte eine Adresse tragen). */
  grund: EntfallGrund | "mailserver_abgelehnt" | null;
}

export interface PersoenlicheWahl {
  ereignis: EreignisId;
  abgewaehlt: boolean;
  geaendertAm: string;
}

export interface KommunikationRepo {
  fassungen(): Promise<RegelFassung[]>;
  /** Legt die Fassung an; `false`, wenn diese Version schon besteht (gleichzeitige Änderung). */
  fassungAnlegen(fassung: RegelFassung): Promise<boolean>;
  persoenlich(kontoId: string): Promise<PersoenlicheWahl[]>;
  /** Die wirksam gespeicherten Abwahlen eines Ereignisses für diese Konten. */
  abgewaehlteKonten(ereignis: EreignisId, kontoIds: readonly string[]): Promise<Set<string>>;
  persoenlichSetzen(kontoId: string, wahl: PersoenlicheWahl): Promise<void>;
  /** Legt Zustellzeilen an; eine Wiederholung legt nichts doppelt an. */
  statusAnlegen(zeilen: readonly ZustellZeile[], tx?: TxContext): Promise<void>;
  statusFuer(vermerkId: string): Promise<ZustellZeile[]>;
  /** Beansprucht ATOMAR alle nie versuchten Mailzeilen — nur sie werden verschickt. */
  mailBeanspruchen(vermerkId: string, am: string): Promise<ZustellZeile[]>;
  ergebnis(
    vermerkId: string,
    empfaengerId: string,
    kanal: ZustellKanal,
    status: Exclude<ZustellStatus, "angelegt">,
    grund: ZustellZeile["grund"],
    am: string,
  ): Promise<void>;
  /** Die Glocke hat diese Meldungen der Person ausgeliefert — nur `angelegt` wird `zugestellt`. */
  glockeZugestellt(empfaengerId: string, vermerkIds: readonly string[], am: string): Promise<void>;
}

const schluessel = (z: Pick<ZustellZeile, "vermerkId" | "empfaengerId" | "kanal">): string =>
  JSON.stringify([z.vermerkId, z.empfaengerId, z.kanal]);

export class InMemoryKommunikationRepo implements KommunikationRepo {
  private readonly regelFassungen: RegelFassung[] = [];
  private readonly wahlen = new Map<string, PersoenlicheWahl>();
  private readonly zeilen = new Map<string, ZustellZeile>();

  /**
   * `haltbarkeitZugesagt`: der Betrieb sagt Haltbarkeit zu (Desktop-Journal), diese Ablage kann sie
   * nicht halten — dann lehnt sie Schreibvorgänge ab, statt sie beim Neustart zu verlieren. Dieselbe
   * Regel wie die Zustellungen der Veröffentlichung.
   */
  constructor(private readonly haltbarkeitZugesagt = false) {}

  private pruefeHaltbarkeit(): void {
    if (this.haltbarkeitZugesagt) {
      throw new KommunikationFehler(
        503,
        "NICHT_HALTBAR",
        "Diese Instanz kann Kommunikationsregeln und Zustellstatus nicht dauerhaft ablegen.",
      );
    }
  }

  async fassungen(): Promise<RegelFassung[]> {
    return this.regelFassungen.map((f) => structuredClone(f));
  }

  async fassungAnlegen(fassung: RegelFassung): Promise<boolean> {
    this.pruefeHaltbarkeit();
    if (this.regelFassungen.some((f) => f.version === fassung.version)) {
      return false;
    }
    this.regelFassungen.push(structuredClone(fassung));
    return true;
  }

  async persoenlich(kontoId: string): Promise<PersoenlicheWahl[]> {
    return [...this.wahlen.entries()]
      .filter(([k]) => JSON.parse(k)[0] === kontoId)
      .map(([, w]) => ({ ...w }));
  }

  async abgewaehlteKonten(
    ereignisId: EreignisId,
    kontoIds: readonly string[],
  ): Promise<Set<string>> {
    return new Set(
      kontoIds.filter(
        (id) => this.wahlen.get(JSON.stringify([id, ereignisId]))?.abgewaehlt === true,
      ),
    );
  }

  async persoenlichSetzen(kontoId: string, wahl: PersoenlicheWahl): Promise<void> {
    this.pruefeHaltbarkeit();
    this.wahlen.set(JSON.stringify([kontoId, wahl.ereignis]), { ...wahl });
  }

  async statusAnlegen(zeilen: readonly ZustellZeile[]): Promise<void> {
    if (zeilen.length === 0) {
      return;
    }
    this.pruefeHaltbarkeit();
    for (const z of zeilen) {
      if (!this.zeilen.has(schluessel(z))) {
        this.zeilen.set(schluessel(z), { ...z });
      }
    }
  }

  async statusFuer(vermerkId: string): Promise<ZustellZeile[]> {
    return [...this.zeilen.values()]
      .filter((z) => z.vermerkId === vermerkId)
      .map((z) => ({ ...z }));
  }

  async mailBeanspruchen(vermerkId: string, am: string): Promise<ZustellZeile[]> {
    const beansprucht: ZustellZeile[] = [];
    for (const z of this.zeilen.values()) {
      if (
        z.vermerkId === vermerkId &&
        z.kanal === "mail" &&
        z.status === "angelegt" &&
        z.versuchAm === null
      ) {
        z.versuchAm = am;
        beansprucht.push({ ...z });
      }
    }
    return beansprucht;
  }

  async ergebnis(
    vermerkId: string,
    empfaengerId: string,
    kanal: ZustellKanal,
    status: Exclude<ZustellStatus, "angelegt">,
    grund: ZustellZeile["grund"],
    am: string,
  ): Promise<void> {
    const z = this.zeilen.get(schluessel({ vermerkId, empfaengerId, kanal }));
    if (z && z.status === "angelegt") {
      z.status = status;
      z.grund = grund;
      z.ergebnisAm = am;
    }
  }

  async glockeZugestellt(
    empfaengerId: string,
    vermerkIds: readonly string[],
    am: string,
  ): Promise<void> {
    for (const vermerkId of vermerkIds) {
      const z = this.zeilen.get(schluessel({ vermerkId, empfaengerId, kanal: "glocke" }));
      if (z && z.status === "angelegt") {
        z.status = "zugestellt";
        z.ergebnisAm = am;
      }
    }
  }
}

/**
 * Drei Tabellen: die Fassungen der Unternehmensvorgabe (Primärschlüssel = Version, damit zwei
 * gleichzeitige Änderungen nicht beide gewinnen), die persönlichen Abwahlen und der Zustellstatus
 * (Primärschlüssel sperrt doppelte Zeilen). Rein additiv und wiederholbar, ohne Fremdschlüssel.
 */
export const KOMMUNIKATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS kommunikationsregel_fassungen (
  version integer PRIMARY KEY,
  vorgaben jsonb NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS meldungsregel_persoenlich (
  konto_id text NOT NULL,
  ereignis text NOT NULL,
  abgewaehlt boolean NOT NULL,
  geaendert_am timestamptz NOT NULL,
  PRIMARY KEY (konto_id, ereignis)
);
CREATE TABLE IF NOT EXISTS meldung_zustellstatus (
  vermerk_id text NOT NULL,
  ko_id text NOT NULL,
  empfaenger_id text NOT NULL,
  kanal text NOT NULL,
  status text NOT NULL,
  angelegt_am timestamptz NOT NULL,
  versuch_am timestamptz,
  ergebnis_am timestamptz,
  grund text,
  PRIMARY KEY (vermerk_id, empfaenger_id, kanal)
);
`;

interface StatusZeileDb {
  vermerk_id: string;
  ko_id: string;
  empfaenger_id: string;
  kanal: ZustellKanal;
  status: ZustellStatus;
  angelegt_am: Date;
  versuch_am: Date | null;
  ergebnis_am: Date | null;
  grund: ZustellZeile["grund"];
}

const STATUS_SPALTEN =
  "vermerk_id, ko_id, empfaenger_id, kanal, status, angelegt_am, versuch_am, ergebnis_am, grund";

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

function zeileAus(z: StatusZeileDb): ZustellZeile {
  return {
    vermerkId: z.vermerk_id,
    koId: z.ko_id,
    empfaengerId: z.empfaenger_id,
    kanal: z.kanal,
    status: z.status,
    angelegtAm: new Date(z.angelegt_am).toISOString(),
    versuchAm: iso(z.versuch_am),
    ergebnisAm: iso(z.ergebnis_am),
    grund: z.grund,
  };
}

export class PgKommunikationRepo implements KommunikationRepo {
  constructor(private readonly pool: Pool) {}

  async fassungen(): Promise<RegelFassung[]> {
    const res = await this.pool.query<{
      version: number;
      vorgaben: Partial<Record<string, Vorgabe>>;
      geaendert_von: string;
      geaendert_am: Date;
    }>(
      `SELECT version, vorgaben, geaendert_von, geaendert_am
       FROM kommunikationsregel_fassungen ORDER BY version`,
    );
    return res.rows.map((r) => ({
      version: r.version,
      vorgaben: vollstaendig(r.vorgaben),
      geaendertVon: r.geaendert_von,
      geaendertAm: new Date(r.geaendert_am).toISOString(),
    }));
  }

  async fassungAnlegen(fassung: RegelFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO kommunikationsregel_fassungen (version, vorgaben, geaendert_von, geaendert_am)
       VALUES ($1, $2, $3, $4) ON CONFLICT (version) DO NOTHING`,
      [
        fassung.version,
        JSON.stringify(fassung.vorgaben),
        fassung.geaendertVon,
        fassung.geaendertAm,
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async persoenlich(kontoId: string): Promise<PersoenlicheWahl[]> {
    const res = await this.pool.query<{
      ereignis: string;
      abgewaehlt: boolean;
      geaendert_am: Date;
    }>(
      `SELECT ereignis, abgewaehlt, geaendert_am
       FROM meldungsregel_persoenlich WHERE konto_id = $1`,
      [kontoId],
    );
    return res.rows
      .filter((r) => istEreignis(r.ereignis))
      .map((r) => ({
        ereignis: r.ereignis as EreignisId,
        abgewaehlt: r.abgewaehlt,
        geaendertAm: new Date(r.geaendert_am).toISOString(),
      }));
  }

  async abgewaehlteKonten(
    ereignisId: EreignisId,
    kontoIds: readonly string[],
  ): Promise<Set<string>> {
    if (kontoIds.length === 0) {
      return new Set();
    }
    const res = await this.pool.query<{ konto_id: string }>(
      `SELECT konto_id FROM meldungsregel_persoenlich
       WHERE ereignis = $1 AND abgewaehlt AND konto_id = ANY($2::text[])`,
      [ereignisId, kontoIds],
    );
    return new Set(res.rows.map((r) => r.konto_id));
  }

  async persoenlichSetzen(kontoId: string, wahl: PersoenlicheWahl): Promise<void> {
    await this.pool.query(
      `INSERT INTO meldungsregel_persoenlich (konto_id, ereignis, abgewaehlt, geaendert_am)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (konto_id, ereignis) DO UPDATE SET abgewaehlt = $3, geaendert_am = $4`,
      [kontoId, wahl.ereignis, wahl.abgewaehlt, wahl.geaendertAm],
    );
  }

  async statusAnlegen(zeilen: readonly ZustellZeile[], tx?: TxContext): Promise<void> {
    if (zeilen.length === 0) {
      return;
    }
    const ziel = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    await ziel.query(
      `INSERT INTO meldung_zustellstatus
         (vermerk_id, ko_id, empfaenger_id, kanal, status, angelegt_am)
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[]
       )
       ON CONFLICT (vermerk_id, empfaenger_id, kanal) DO NOTHING`,
      [
        zeilen.map((z) => z.vermerkId),
        zeilen.map((z) => z.koId),
        zeilen.map((z) => z.empfaengerId),
        zeilen.map((z) => z.kanal),
        zeilen.map((z) => z.status),
        zeilen.map((z) => z.angelegtAm),
      ],
    );
  }

  async statusFuer(vermerkId: string): Promise<ZustellZeile[]> {
    const res = await this.pool.query<StatusZeileDb>(
      `SELECT ${STATUS_SPALTEN} FROM meldung_zustellstatus WHERE vermerk_id = $1`,
      [vermerkId],
    );
    return res.rows.map(zeileAus);
  }

  async mailBeanspruchen(vermerkId: string, am: string): Promise<ZustellZeile[]> {
    const res = await this.pool.query<StatusZeileDb>(
      `UPDATE meldung_zustellstatus SET versuch_am = $2
       WHERE vermerk_id = $1 AND kanal = 'mail' AND status = 'angelegt' AND versuch_am IS NULL
       RETURNING ${STATUS_SPALTEN}`,
      [vermerkId, am],
    );
    return res.rows.map(zeileAus);
  }

  async ergebnis(
    vermerkId: string,
    empfaengerId: string,
    kanal: ZustellKanal,
    status: Exclude<ZustellStatus, "angelegt">,
    grund: ZustellZeile["grund"],
    am: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE meldung_zustellstatus SET status = $4, grund = $5, ergebnis_am = $6
       WHERE vermerk_id = $1 AND empfaenger_id = $2 AND kanal = $3 AND status = 'angelegt'`,
      [vermerkId, empfaengerId, kanal, status, grund, am],
    );
  }

  async glockeZugestellt(
    empfaengerId: string,
    vermerkIds: readonly string[],
    am: string,
  ): Promise<void> {
    if (vermerkIds.length === 0) {
      return;
    }
    await this.pool.query(
      `UPDATE meldung_zustellstatus SET status = 'zugestellt', ergebnis_am = $3
       WHERE empfaenger_id = $1 AND kanal = 'glocke' AND status = 'angelegt'
         AND vermerk_id = ANY($2::text[])`,
      [empfaengerId, vermerkIds, am],
    );
  }
}

// ------------------------------------------------------------------------------------------------
// DIE ZUSAMMENFASSUNG UND DIE PERSÖNLICHE ABWAHL IN DER GLOCKE — rein, ohne Ablage.
// ------------------------------------------------------------------------------------------------

/** Der Kalendertag (UTC) eines Zeitpunkts — die Einheit der täglichen Zusammenfassung. */
export function tagVon(isoZeit: string): string {
  return isoZeit.slice(0, 10);
}

/** Die Kennung der Zusammenfassung eines Tages — in Glocke, Gelesen- und Zustellstatus. */
export function zusammenfassungsKennung(tag: string): string {
  return `sum-veroeffentlichung-${tag}`;
}

/** Der Versandzeitpunkt der Zusammenfassung eines Tages: Beginn des Folgetags (UTC). */
export function versandzeitpunkt(tag: string): string {
  const d = new Date(`${tag}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export type ZusammenfassungEintrag = NonNullable<
  Notification["zusammenfassung"]
>["eintraege"][number];

export interface RegelLage {
  /** Wirksam abgewählte Ereignisse (Vorgabe erlaubt UND die Person hat abgewählt). */
  abgewaehlt: ReadonlySet<EreignisId>;
  /** Gewöhnliche Veröffentlichungen als tägliche Zusammenfassung? */
  zusammenfassung: boolean;
  jetzt: number;
}

const PUB_PRAEFIX = "pub-";

/**
 * Wendet die Regeln auf den bereits über die Sichtbarkeit gefilterten Feed einer Person an.
 *
 *   · abgewählte gewöhnliche Veröffentlichungen und Wirkungsrückmeldungen fallen weg;
 *   · bei täglicher Zusammenfassung werden gewöhnliche Veröffentlichungen eines vergangenen Tages
 *     zu EINER Meldung gebündelt; die des laufenden Tages warten auf ihre Zusammenfassung;
 *   · hervorgehobene Veröffentlichungen und alle übrigen Arten (Kenntnisnahme!) bleiben unberührt.
 *
 * `zugestellt` nennt die Veröffentlichungen, die die Glocke damit ausliefert — einzeln oder in
 * einer Zusammenfassung.
 */
export function meldungsregelnAnwenden(
  feed: readonly Notification[],
  lage: RegelLage,
): { feed: Notification[]; zugestellt: string[] } {
  const heute = tagVon(new Date(lage.jetzt).toISOString());
  const bleibt: Notification[] = [];
  const zugestellt: string[] = [];
  const tage = new Map<string, ZusammenfassungEintrag[]>();
  for (const n of feed) {
    if (n.kind === "impact" && lage.abgewaehlt.has("wirkung")) {
      continue;
    }
    if (n.kind !== "veroeffentlichung" || !n.id.startsWith(PUB_PRAEFIX)) {
      bleibt.push(n);
      continue;
    }
    const vermerkId = n.id.slice(PUB_PRAEFIX.length);
    if (n.hervorgehoben === true) {
      bleibt.push(n);
      zugestellt.push(vermerkId);
      continue;
    }
    if (lage.abgewaehlt.has("veroeffentlichung")) {
      continue;
    }
    if (!lage.zusammenfassung) {
      bleibt.push(n);
      zugestellt.push(vermerkId);
      continue;
    }
    const tag = tagVon(n.at);
    if (tag >= heute) {
      continue;
    }
    const liste = tage.get(tag) ?? [];
    liste.push({
      vermerkId,
      koId: n.koId ?? "",
      title: n.title,
      fassung: n.fassung ?? 0,
      art: n.art ?? "neu",
    });
    tage.set(tag, liste);
  }
  for (const [tag, eintraege] of tage) {
    eintraege.sort((a, b) => a.title.localeCompare(b.title));
    bleibt.push({
      id: zusammenfassungsKennung(tag),
      kind: "veroeffentlichung",
      title: eintraege.map((e) => e.title).join(", "),
      at: versandzeitpunkt(tag),
      zusammenfassung: { tag, anzahl: eintraege.length, eintraege },
    });
    zugestellt.push(...eintraege.map((e) => e.vermerkId));
  }
  bleibt.sort((a, b) => b.at.localeCompare(a.at));
  return { feed: bleibt, zugestellt };
}

// ------------------------------------------------------------------------------------------------
// DER DIENST.
// ------------------------------------------------------------------------------------------------

export type KanalZustand = "aktiv" | "aus" | "nicht_eingerichtet" | "nicht_angeschlossen";

export interface EreignisUebersicht {
  id: EreignisId;
  zielgruppe: Zielgruppe;
  verbindlich: boolean;
  erinnerung: boolean;
  kanaele: Array<{ kanal: KanalId; zustand: KanalZustand; einstellbar: boolean }>;
  haeufigkeit: Haeufigkeit;
  abwaehlbar: boolean;
  einstellbar: EreignisDefinition["einstellbar"];
  /** Die gespeicherte Vorgabe — `mail` auch dann, wenn der Kanal gerade nicht eingerichtet ist. */
  vorgabe: Vorgabe;
}

export interface RegelUebersicht {
  version: number;
  geaendertVon: { id: string; name: string } | null;
  geaendertAm: string | null;
  mailEingerichtet: boolean;
  ereignisse: EreignisUebersicht[];
}

export interface PersoenlicheZeile {
  ereignis: EreignisId;
  /** Erlaubt die Unternehmensvorgabe gerade die Abwahl? */
  abwaehlbar: boolean;
  /** Was die Person gespeichert hat. */
  abgewaehlt: boolean;
  /** Wirkt die Abwahl gerade? (gespeichert UND erlaubt) */
  wirksam: boolean;
  verbindlich: boolean;
}

export interface Regelaenderung {
  ereignis: EreignisId;
  feld: keyof Vorgabe;
  vorher: boolean | Haeufigkeit;
  nachher: boolean | Haeufigkeit;
}

export interface KommunikationDienstDeps {
  repo: KommunikationRepo;
  /** Ist ein echter Mailversand verdrahtet? Bei jedem Aufruf frisch gelesen. */
  mailEingerichtet: () => boolean;
  kontoNamen: () => Promise<Map<string, string>>;
  jetzt: () => number;
}

function feldWert(wert: unknown, feld: keyof Vorgabe): boolean | Haeufigkeit | undefined {
  if (wert === undefined) {
    return undefined;
  }
  if (feld === "haeufigkeit") {
    if (wert === "sofort" || wert === "taeglich") {
      return wert;
    }
  } else if (typeof wert === "boolean") {
    return wert;
  }
  throw new KommunikationFehler(400, "VALIDATION", `Ungültiger Wert für „${feld}".`, { feld });
}

export class KommunikationDienst {
  constructor(private readonly deps: KommunikationDienstDeps) {}

  /** Die geltende Fassung — ohne gespeicherte Änderung die Werksvorgabe (Version 0). */
  async regeln(): Promise<RegelFassung> {
    const alle = await this.deps.repo.fassungen();
    return alle.at(-1) ?? werksvorgabe();
  }

  async fassungen(): Promise<Array<RegelFassung & { name: string }>> {
    const namen = await this.deps.kontoNamen();
    return (await this.deps.repo.fassungen())
      .reverse()
      .map((f) => ({ ...f, name: f.geaendertVon ? (namen.get(f.geaendertVon) ?? "") : "" }));
  }

  private kanalZustand(def: EreignisDefinition, kanal: KanalId, vorgabe: Vorgabe): KanalZustand {
    if (kanal === "glocke") {
      return "aktiv";
    }
    if (kanal === "push") {
      return "nicht_angeschlossen";
    }
    if (!this.deps.mailEingerichtet()) {
      return "nicht_eingerichtet";
    }
    return def.mailFest || vorgabe.mail ? "aktiv" : "aus";
  }

  /** Die zentrale Übersicht: Ereignis → Zielgruppe, Kanäle, Häufigkeit, Abwahl, Pflicht. */
  async uebersicht(): Promise<RegelUebersicht> {
    const f = await this.regeln();
    const namen = await this.deps.kontoNamen();
    const mail = this.deps.mailEingerichtet();
    return {
      version: f.version,
      geaendertVon: f.geaendertVon
        ? { id: f.geaendertVon, name: namen.get(f.geaendertVon) ?? "" }
        : null,
      geaendertAm: f.geaendertAm,
      mailEingerichtet: mail,
      ereignisse: EREIGNISSE.map((def) => {
        const v = f.vorgaben[def.id];
        return {
          id: def.id,
          zielgruppe: def.zielgruppe,
          verbindlich: def.verbindlich,
          erinnerung: def.erinnerung,
          kanaele: def.kanaele.map((kanal) => ({
            kanal,
            zustand: this.kanalZustand(def, kanal, v),
            // Nur ein angeschlossener, nicht fest verdrahteter Kanal ist wählbar.
            einstellbar: kanal === "mail" && def.einstellbar.mail && mail,
          })),
          haeufigkeit: v.haeufigkeit,
          abwaehlbar: v.abwaehlbar,
          einstellbar: def.einstellbar,
          vorgabe: { ...v },
        };
      }),
    };
  }

  /**
   * Speichert eine NEUE Fassung. `version` nennt die zuletzt gesehene Fassung — eine inzwischen
   * gespeicherte fremde Änderung wird nicht überschrieben (409). Ohne Änderung keine Fassung.
   */
  async speichern(
    eingabe: unknown,
    von: string,
  ): Promise<{ vorher: RegelFassung; nachher: RegelFassung; aenderungen: Regelaenderung[] }> {
    const body = eingabe && typeof eingabe === "object" ? (eingabe as Record<string, unknown>) : {};
    const gesehen = body.version;
    if (typeof gesehen !== "number" || !Number.isInteger(gesehen) || gesehen < 0) {
      throw new KommunikationFehler(400, "VALIDATION", "Die gesehene Fassung (version) fehlt.");
    }
    const roh = body.vorgaben;
    if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
      throw new KommunikationFehler(400, "VALIDATION", "Die Vorgaben fehlen.");
    }
    const vorher = await this.regeln();
    if (gesehen !== vorher.version) {
      throw new KommunikationFehler(
        409,
        "VERALTET",
        "Die Regeln wurden inzwischen geändert. Bitte neu laden.",
        { aktuelleVersion: vorher.version },
      );
    }
    const vorgaben = structuredClone(vorher.vorgaben);
    const aenderungen: Regelaenderung[] = [];
    for (const [id, wert] of Object.entries(roh as Record<string, unknown>)) {
      if (!istEreignis(id)) {
        throw new KommunikationFehler(400, "UNBEKANNTES_EREIGNIS", `Unbekanntes Ereignis „${id}".`);
      }
      if (!wert || typeof wert !== "object" || Array.isArray(wert)) {
        throw new KommunikationFehler(400, "VALIDATION", `Ungültige Vorgabe für „${id}".`);
      }
      const def = ereignis(id);
      const felder = wert as Record<string, unknown>;
      for (const feld of Object.keys(felder)) {
        if (feld !== "abwaehlbar" && feld !== "haeufigkeit" && feld !== "mail") {
          // Insbesondere „push": diesen Kanal gibt es hier nicht.
          throw new KommunikationFehler(
            400,
            "NICHT_EINSTELLBAR",
            `„${feld}" ist nicht einstellbar.`,
            { ereignis: id, feld },
          );
        }
      }
      const ziel = vorgaben[id];
      const erlaubt: Record<keyof Vorgabe, boolean> = {
        abwaehlbar: def.einstellbar.abwahl,
        haeufigkeit: def.einstellbar.zusammenfassung,
        mail: def.einstellbar.mail,
      };
      for (const feld of ["abwaehlbar", "haeufigkeit", "mail"] as const) {
        const neu = feldWert(felder[feld], feld);
        if (neu === undefined || neu === ziel[feld]) {
          continue;
        }
        if (!erlaubt[feld]) {
          throw new KommunikationFehler(
            400,
            "NICHT_EINSTELLBAR",
            def.verbindlich
              ? "Eine verbindliche Kenntnisnahme ist weder abwählbar noch zusammenfassbar."
              : `„${feld}" ist an diesem Ereignis nicht einstellbar.`,
            { ereignis: id, feld },
          );
        }
        aenderungen.push({ ereignis: id, feld, vorher: ziel[feld], nachher: neu });
        (ziel as unknown as Record<string, boolean | Haeufigkeit>)[feld] = neu;
      }
      if (ziel.mail && ziel.haeufigkeit === "taeglich") {
        throw new KommunikationFehler(
          400,
          "MAIL_NUR_SOFORT",
          "Mail gibt es nur bei sofortiger Meldung; die Zusammenfassung steht in der Glocke.",
          { ereignis: id },
        );
      }
    }
    const mailEin = aenderungen.some((a) => a.feld === "mail" && a.nachher === true);
    if (mailEin && !this.deps.mailEingerichtet()) {
      throw new KommunikationFehler(
        409,
        "KANAL_NICHT_EINGERICHTET",
        "Mailversand ist in dieser Instanz nicht eingerichtet und kann nicht aktiviert werden.",
      );
    }
    if (aenderungen.length === 0) {
      return { vorher, nachher: vorher, aenderungen };
    }
    const nachher: RegelFassung = {
      version: vorher.version + 1,
      vorgaben,
      geaendertVon: von,
      geaendertAm: new Date(this.deps.jetzt()).toISOString(),
    };
    if (!(await this.deps.repo.fassungAnlegen(nachher))) {
      throw new KommunikationFehler(
        409,
        "VERALTET",
        "Die Regeln wurden gleichzeitig geändert. Bitte neu laden.",
        { aktuelleVersion: (await this.regeln()).version },
      );
    }
    return { vorher, nachher, aenderungen };
  }

  /** Die persönlichen Einstellungen — je Ereignis, mit dem, was gerade wirkt. */
  async persoenlich(kontoId: string): Promise<PersoenlicheZeile[]> {
    const f = await this.regeln();
    const gespeichert = new Map(
      (await this.deps.repo.persoenlich(kontoId)).map((w) => [w.ereignis, w.abgewaehlt]),
    );
    return EREIGNISSE.map((def) => {
      const abwaehlbar = f.vorgaben[def.id].abwaehlbar;
      const abgewaehlt = gespeichert.get(def.id) === true;
      return {
        ereignis: def.id,
        abwaehlbar,
        abgewaehlt,
        wirksam: abwaehlbar && abgewaehlt,
        verbindlich: def.verbindlich,
      };
    });
  }

  async persoenlichSetzen(kontoId: string, eingabe: unknown): Promise<PersoenlicheZeile[]> {
    const body = eingabe && typeof eingabe === "object" ? (eingabe as Record<string, unknown>) : {};
    if (!istEreignis(body.ereignis) || typeof body.abgewaehlt !== "boolean") {
      throw new KommunikationFehler(
        400,
        "VALIDATION",
        "Ereignis oder Wahl fehlt oder ist ungültig.",
      );
    }
    const f = await this.regeln();
    if (body.abgewaehlt && !f.vorgaben[body.ereignis].abwaehlbar) {
      throw new KommunikationFehler(
        409,
        "NICHT_ABWAEHLBAR",
        ereignis(body.ereignis).verbindlich
          ? "Eine verbindliche Kenntnisnahme kann nicht abgewählt werden."
          : "Diese Meldung ist nach der Unternehmensvorgabe nicht abwählbar.",
      );
    }
    await this.deps.repo.persoenlichSetzen(kontoId, {
      ereignis: body.ereignis,
      abgewaehlt: body.abgewaehlt,
      geaendertAm: new Date(this.deps.jetzt()).toISOString(),
    });
    return this.persoenlich(kontoId);
  }

  mailEingerichtet(): boolean {
    return this.deps.mailEingerichtet();
  }

  /** Kommen gewöhnliche Veröffentlichungen als tägliche Zusammenfassung? */
  async zusammenfassungAktiv(): Promise<boolean> {
    return (await this.regeln()).vorgaben.veroeffentlichung.haeufigkeit === "taeglich";
  }

  /** Die Lage einer Person für die Glocke — wirksame Abwahl und Zusammenfassung. */
  async lageFuer(kontoId: string): Promise<RegelLage> {
    const abgewaehlt = new Set<EreignisId>(
      (await this.persoenlich(kontoId)).filter((z) => z.wirksam).map((z) => z.ereignis),
    );
    return {
      abgewaehlt,
      zusammenfassung: await this.zusammenfassungAktiv(),
      jetzt: this.deps.jetzt(),
    };
  }

  /** Wendet die Regeln auf den Feed an und hält fest, was die Glocke damit zugestellt hat. */
  async glocke(kontoId: string, feed: readonly Notification[]): Promise<Notification[]> {
    const ergebnis = meldungsregelnAnwenden(feed, await this.lageFuer(kontoId));
    await this.deps.repo.glockeZugestellt(
      kontoId,
      ergebnis.zugestellt,
      new Date(this.deps.jetzt()).toISOString(),
    );
    return ergebnis.feed;
  }

  /** Von diesen Konten: wer hat das Ereignis WIRKSAM abgewählt? */
  async wirksamAbgewaehlt(
    ereignisId: EreignisId,
    kontoIds: readonly string[],
  ): Promise<Set<string>> {
    const f = await this.regeln();
    if (!f.vorgaben[ereignisId].abwaehlbar) {
      return new Set();
    }
    return this.deps.repo.abgewaehlteKonten(ereignisId, kontoIds);
  }

  async hatAbgewaehlt(ereignisId: EreignisId, kontoId: string): Promise<boolean> {
    return (await this.wirksamAbgewaehlt(ereignisId, [kontoId])).has(kontoId);
  }

  /** Geht eine Veröffentlichung dieser Wahl zusätzlich per Mail? Nur mit eingerichtetem Kanal. */
  async mailAktiv(ereignisId: EreignisId): Promise<boolean> {
    if (!this.deps.mailEingerichtet()) {
      return false;
    }
    const v = (await this.regeln()).vorgaben[ereignisId];
    return v.mail && v.haeufigkeit === "sofort";
  }
}

// ------------------------------------------------------------------------------------------------
// DER MAILVERSAND EINER VERÖFFENTLICHUNG — beanspruchen, Rechte jetzt prüfen, senden, festhalten.
// ------------------------------------------------------------------------------------------------

export interface MailVersandDeps {
  repo: KommunikationRepo;
  mailer: Mailer;
  /** Konto → Adresse; nur zum Senden gelesen, nie gespeichert. */
  adressen: () => Promise<Map<string, string>>;
  /** Darf dieses Konto den Eintrag JETZT lesen? (dieselbe Regel wie der Empfängerkreis) */
  darfLesen: (kontoId: string, koId: string) => Promise<boolean>;
  /** Hat dieses Konto die gewöhnliche Veröffentlichung JETZT wirksam abgewählt? */
  abgewaehlt: (kontoId: string) => Promise<boolean>;
  jetzt: () => number;
}

/**
 * Verschickt die noch nie versuchten Mails einer Veröffentlichung. Die Mail nennt weder Titel noch
 * Inhalt — sie verweist in die Anwendung, wo die Sichtbarkeit erneut gilt.
 */
export async function mailsVersenden(
  deps: MailVersandDeps,
  vermerk: { id: string; koId: string; fassung: number; hervorgehoben: boolean },
): Promise<void> {
  const am = () => new Date(deps.jetzt()).toISOString();
  const beansprucht = await deps.repo.mailBeanspruchen(vermerk.id, am());
  if (beansprucht.length === 0) {
    return;
  }
  const adressen = await deps.adressen();
  for (const z of beansprucht) {
    const festhalten = (
      status: Exclude<ZustellStatus, "angelegt">,
      grund: ZustellZeile["grund"],
    ): Promise<void> => deps.repo.ergebnis(vermerk.id, z.empfaengerId, "mail", status, grund, am());
    // Die Rechte gelten zum VERSANDZEITPUNKT, nicht zum Zeitpunkt des Veröffentlichens.
    if (!(await deps.darfLesen(z.empfaengerId, vermerk.koId))) {
      await festhalten("entfallen", "kein_zugriff");
      continue;
    }
    if (!vermerk.hervorgehoben && (await deps.abgewaehlt(z.empfaengerId))) {
      await festhalten("entfallen", "abgewaehlt");
      continue;
    }
    const an = adressen.get(z.empfaengerId);
    try {
      if (!an) {
        throw new Error("keine Adresse");
      }
      await deps.mailer.send({
        to: an,
        subject: vermerk.hervorgehoben
          ? "KLARWERK: Wichtige Veröffentlichung"
          : "KLARWERK: Neue Veröffentlichung",
        text: [
          `Eine Fassung (V${vermerk.fassung}) eines Eintrags, den du lesen darfst, wurde veröffentlicht.`,
          `Öffne sie in KLARWERK: /wissen/${vermerk.koId}`,
          "",
          "— KLARWERK",
        ].join("\n"),
      });
      await festhalten("zugestellt", null);
    } catch {
      await festhalten("fehlgeschlagen", "mailserver_abgelehnt");
    }
  }
}
