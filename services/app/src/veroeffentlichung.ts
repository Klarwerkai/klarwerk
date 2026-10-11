import type { Pool } from "pg";
import { type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type {
  KnowledgeObject,
  KoVeroeffentlichung,
  VeroeffentlichungsMeldung,
} from "../../knowledge-object";
import type { AnforderungsStand, KenntnisnahmeStatus } from "./kenntnisnahme";
import {
  type KommunikationDienst,
  type KommunikationRepo,
  type ZustellZeile,
  tagVon,
  zusammenfassungsKennung,
} from "./kommunikationsregeln";

// ================================================================================================
// VERÖFFENTLICHUNG MIT BENACHRICHTIGUNGSWAHL (produkt:20261007:veroeffentlichungsoptionen).
// ================================================================================================
//
// WAS DAS IST. Wer fachlich freigeben darf (`ko.validate`, Controller/Admin), veröffentlicht die
// GÜLTIGE Fassung eines Eintrags für die berechtigten Leser — intern, nicht im Internet — und wählt
// dabei, wie gemeldet wird:
//   · still         — keine Meldung. Der Eintrag bleibt für Berechtigte auffindbar, der Vermerk steht
//                     im Verlauf und im Prüfprotokoll (`ko.veroeffentlicht`).
//   · normal        — je ein Eintrag in der vorhandenen Glocke für jede Person, die den Eintrag lesen
//                     darf (ohne die veröffentlichende).
//   · hervorgehoben — derselbe Empfängerkreis; die Meldung ist markiert und steht in der Glocke oben,
//                     bis sie gelesen ist. Sie erweitert keine Rechte: der Kreis ist derselbe wie bei
//                     „normal".
//
// WER DIE MELDUNG BEKOMMT (Ben, Nacharbeit 8): genau der Kreis, den die Vorschau angekündigt hat —
// festgehalten beim Veröffentlichen als je eine ZUSTELLUNG pro Empfänger in einer eigenen Ablage
// (`VeroeffentlichungsZustellungRepo`, Tabelle `veroeffentlichung_zustellungen`). Die Glocke
// liefert nur, was dem Konto zugestellt wurde, UND nur, solange es den Eintrag JETZT sehen darf
// (`sichtbareEintraege` in der Route). Wer erst später Leserechte bekommt, war nicht im
// angekündigten Kreis und bekommt die alte Meldung nicht. Die Empfängerkennungen stehen nur in
// dieser Ablage — am lesbaren Wissensobjekt steht allein ihre Anzahl.
//
// KEIN GLOBALES FENSTER: die Zustellungen werden je Konto gelesen. Stille oder fremde
// Veröffentlichungen erzeugen für dieses Konto keine Zustellung und können seine Meldungen deshalb
// nicht verdrängen; hervorgehobene Zustellungen werden IMMER geliefert, gewöhnliche die jüngsten
// `VEROEFFENTLICHUNG_MELDUNGEN_FENSTER` dieses Kontos.
//
// DREI DINGE BLEIBEN GETRENNT. Sichtbarkeit entscheidet allein `sichtbarkeit.ts` (Stufe, Space,
// Autor) — das Veröffentlichen ändert sie nicht. Die fachliche Freigabe ist der Status `validiert`
// aus dem Prüfweg — das Veröffentlichen setzt sie voraus und ändert sie nicht. Die Meldungswirkung
// ist allein die Wahl oben.
//
// KENNTNISNAHME BLEIBT. Eine ausdrücklich angeforderte Kenntnisnahme hat ihren eigenen Weg
// (`kenntnisnahme.ts`) und ihre eigene Glockenmeldung. „still" berührt sie nicht; die Vorschau nennt
// die offenen und die durch eine neue Fassung überholten Anforderungen, damit ein stilles Update sie
// nicht unbemerkt ins Leere laufen lässt.

/** Die drei Meldungswahlen — eine geschlossene Menge. */
export const MELDUNGEN: readonly VeroeffentlichungsMeldung[] = ["still", "normal", "hervorgehoben"];

/**
 * Wie viele GEWÖHNLICHE Zustellungen eines Kontos die Glocke höchstens liefert (die jüngsten).
 * Hervorgehobene zählen nicht dagegen — sie werden immer geliefert.
 */
export const VEROEFFENTLICHUNG_MELDUNGEN_FENSTER = 100;

/** Wie oft ein Abruf verwaiste Zustellungen höchstens entfernt und neu liest. */
const VERWAIST_RUNDEN = 10;

/** Ein fachlicher Fehler dieses Vorgangs — `grund` ist die maschinenlesbare Ursache. */
export class VeroeffentlichungFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 503,
    readonly grund: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "VeroeffentlichungFehler";
  }
}

export interface VeroeffentlichungKoZugang {
  get(id: string): Promise<KnowledgeObject | undefined>;
  vermerkeVeroeffentlichung(
    id: string,
    bilde: (ko: KnowledgeObject) => KoVeroeffentlichung,
    nachher?: (vermerk: KoVeroeffentlichung, tx?: TxContext) => Promise<void>,
  ): Promise<{ ko: KnowledgeObject; vermerk: KoVeroeffentlichung }>;
}

// ================================================================================================
// DIE ZUSTELLUNGEN — der beim Veröffentlichen angekündigte Empfängerkreis, je Empfänger eine Zeile.
// ================================================================================================

/** Eine Zustellung: diese Veröffentlichung wurde diesem Konto gemeldet. */
export interface VeroeffentlichungsZustellung {
  vermerkId: string;
  koId: string;
  empfaengerId: string;
  /** ISO-Zeitpunkt der Veröffentlichung. */
  am: string;
  hervorgehoben: boolean;
}

export interface VeroeffentlichungsZustellungRepo {
  /**
   * Legt die Zustellungen einer Veröffentlichung an; eine Wiederholung legt nichts doppelt an.
   * `tx`: der Transaktionskontext von Vermerk und Beleg — die Zustellungen committen mit ihnen.
   */
  anlegen(zustellungen: readonly VeroeffentlichungsZustellung[], tx?: TxContext): Promise<void>;
  /** Entfernt einzelne Zustellungen (verwaiste: ihr Vermerk steht nicht am Eintrag). */
  entfernen(
    zustellungen: readonly Pick<VeroeffentlichungsZustellung, "vermerkId" | "empfaengerId">[],
  ): Promise<void>;
  /**
   * Die Zustellungen an dieses Konto: ALLE hervorgehobenen und die jüngsten `fenster`
   * gewöhnlichen — ein globaler Bestand fremder oder stiller Veröffentlichungen zählt hier nicht.
   */
  fuer(empfaengerId: string, fenster: number): Promise<VeroeffentlichungsZustellung[]>;
}

export class InMemoryVeroeffentlichungsZustellungRepo implements VeroeffentlichungsZustellungRepo {
  private readonly zeilen = new Map<string, VeroeffentlichungsZustellung>();

  /**
   * `haltbarkeitZugesagt`: der Betrieb sagt Haltbarkeit zu (Desktop-Journal), diese Ablage kann sie
   * nicht halten. Dann lehnt sie das Anlegen ab, statt eine Meldung anzunehmen und beim Neustart zu
   * verlieren — dieselbe Regel wie bei der Kenntnisnahme.
   */
  constructor(private readonly haltbarkeitZugesagt = false) {}

  async anlegen(zustellungen: readonly VeroeffentlichungsZustellung[]): Promise<void> {
    if (zustellungen.length === 0) {
      return;
    }
    if (this.haltbarkeitZugesagt) {
      throw new VeroeffentlichungFehler(
        503,
        "nicht_haltbar",
        "Diese Instanz kann Veröffentlichungsmeldungen nicht dauerhaft ablegen.",
      );
    }
    for (const z of zustellungen) {
      const schluessel = JSON.stringify([z.vermerkId, z.empfaengerId]);
      if (!this.zeilen.has(schluessel)) {
        this.zeilen.set(schluessel, { ...z });
      }
    }
  }

  async entfernen(
    zustellungen: readonly Pick<VeroeffentlichungsZustellung, "vermerkId" | "empfaengerId">[],
  ): Promise<void> {
    for (const z of zustellungen) {
      this.zeilen.delete(JSON.stringify([z.vermerkId, z.empfaengerId]));
    }
  }

  async fuer(empfaengerId: string, fenster: number): Promise<VeroeffentlichungsZustellung[]> {
    const eigene = [...this.zeilen.values()]
      .filter((z) => z.empfaengerId === empfaengerId)
      .sort((a, b) => b.am.localeCompare(a.am));
    const gewoehnlich = eigene.filter((z) => !z.hervorgehoben).slice(0, fenster);
    return [...eigene.filter((z) => z.hervorgehoben), ...gewoehnlich].map((z) => ({ ...z }));
  }
}

/**
 * Eine Zeile je (Veröffentlichung, Empfänger). Der Primärschlüssel sperrt doppelte Zustellungen;
 * der Index trägt den Abruf je Konto. Rein additiv und wiederholbar, ohne Fremdschlüssel.
 */
export const VEROEFFENTLICHUNG_SCHEMA = `
CREATE TABLE IF NOT EXISTS veroeffentlichung_zustellungen (
  vermerk_id text NOT NULL,
  ko_id text NOT NULL,
  empfaenger_id text NOT NULL,
  am timestamptz NOT NULL,
  hervorgehoben boolean NOT NULL,
  PRIMARY KEY (vermerk_id, empfaenger_id)
);
CREATE INDEX IF NOT EXISTS idx_veroeffentlichung_zustellungen_empfaenger
  ON veroeffentlichung_zustellungen(empfaenger_id, am DESC);
`;

interface ZustellungsZeile {
  vermerk_id: string;
  ko_id: string;
  empfaenger_id: string;
  am: Date;
  hervorgehoben: boolean;
}

const ZUSTELLUNG_SPALTEN = "vermerk_id, ko_id, empfaenger_id, am, hervorgehoben";

function zustellungAus(zeile: ZustellungsZeile): VeroeffentlichungsZustellung {
  return {
    vermerkId: zeile.vermerk_id,
    koId: zeile.ko_id,
    empfaengerId: zeile.empfaenger_id,
    am: new Date(zeile.am).toISOString(),
    hervorgehoben: zeile.hervorgehoben,
  };
}

export class PgVeroeffentlichungsZustellungRepo implements VeroeffentlichungsZustellungRepo {
  constructor(private readonly pool: Pool) {}

  async anlegen(
    zustellungen: readonly VeroeffentlichungsZustellung[],
    tx?: TxContext,
  ): Promise<void> {
    if (zustellungen.length === 0) {
      return;
    }
    const ziel = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    await ziel.query(
      `INSERT INTO veroeffentlichung_zustellungen (${ZUSTELLUNG_SPALTEN})
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::boolean[])
       ON CONFLICT (vermerk_id, empfaenger_id) DO NOTHING`,
      [
        zustellungen.map((z) => z.vermerkId),
        zustellungen.map((z) => z.koId),
        zustellungen.map((z) => z.empfaengerId),
        zustellungen.map((z) => z.am),
        zustellungen.map((z) => z.hervorgehoben),
      ],
    );
  }

  async entfernen(
    zustellungen: readonly Pick<VeroeffentlichungsZustellung, "vermerkId" | "empfaengerId">[],
  ): Promise<void> {
    if (zustellungen.length === 0) {
      return;
    }
    await this.pool.query(
      `DELETE FROM veroeffentlichung_zustellungen z
       USING unnest($1::text[], $2::text[]) AS weg(vermerk_id, empfaenger_id)
       WHERE z.vermerk_id = weg.vermerk_id AND z.empfaenger_id = weg.empfaenger_id`,
      [zustellungen.map((z) => z.vermerkId), zustellungen.map((z) => z.empfaengerId)],
    );
  }

  async fuer(empfaengerId: string, fenster: number): Promise<VeroeffentlichungsZustellung[]> {
    const res = await this.pool.query<ZustellungsZeile>(
      `SELECT ${ZUSTELLUNG_SPALTEN} FROM veroeffentlichung_zustellungen
       WHERE empfaenger_id = $1 AND hervorgehoben
       UNION ALL
       (SELECT ${ZUSTELLUNG_SPALTEN} FROM veroeffentlichung_zustellungen
        WHERE empfaenger_id = $1 AND NOT hervorgehoben
        ORDER BY am DESC LIMIT $2)`,
      [empfaengerId, fenster],
    );
    return res.rows.map(zustellungAus);
  }
}

export interface VeroeffentlichungDienstDeps {
  ko: VeroeffentlichungKoZugang;
  /**
   * Die Konten, die den Eintrag JETZT lesen dürfen — dieselbe Regel wie der Empfängerkreis einer
   * Kenntnisnahme (`KenntnisnahmeDienst.moeglicheEmpfaenger`): freigegeben, nicht abgelaufen,
   * `ko.read` und `darfSehen`. Eine zweite Auslegung gibt es hier nicht.
   */
  leser: (ko: KnowledgeObject) => Promise<Array<{ id: string; name: string }>>;
  kontoNamen: () => Promise<Map<string, string>>;
  /** Die Kenntnisnahme-Anforderungen dieses Eintrags (`KenntnisnahmeDienst.uebersicht`). */
  kenntnisnahmen: (ko: KnowledgeObject) => Promise<AnforderungsStand[]>;
  /** Die festgehaltenen Zustellungen je Empfänger — der angekündigte Kreis, geschützt abgelegt. */
  zustellungen: VeroeffentlichungsZustellungRepo;
  jetzt: () => number;
  kennung: () => string;
  /**
   * ADMIN-12 (`kommunikationsregeln.ts`): Unternehmensvorgabe, persönliche Abwahl, Zustellstatus und
   * Mailversand. Fehlt er, gilt der Stand vor ADMIN-12 (nur Glocke, kein Zustellstatus).
   */
  kommunikation?: VeroeffentlichungKommunikation;
}

export interface VeroeffentlichungKommunikation {
  dienst: KommunikationDienst;
  repo: KommunikationRepo;
  /** Verschickt die noch nie versuchten Mails dieser Veröffentlichung (`mailsVersenden`). */
  versenden: (vermerk: {
    id: string;
    koId: string;
    fassung: number;
    hervorgehoben: boolean;
  }) => Promise<void>;
  /** Die Meldungskennungen, die dieses Konto als gelesen markiert hat (vorhandener Gelesenstatus). */
  gelesen: (kontoId: string) => Promise<ReadonlySet<string>>;
}

/** Was eine Wahl bewirkt — gezählt für genau diesen Eintrag, vor dem Klick. */
export interface Meldungswirkung {
  /** Personen, die eine Meldung in der Glocke bekommen (sofort oder in der Zusammenfassung). */
  glocke: number;
  sofort: number;
  zusammenfassung: number;
  /** Personen aus dem Leserkreis, die diese Meldung persönlich abgewählt haben. */
  abgewaehlt: number;
  /** Davon zusätzlich per Mail (nur bei eingerichtetem Mailversand und passender Vorgabe). */
  mail: number;
}

export interface ZustellEmpfaenger {
  id: string;
  name: string;
  glocke: "angelegt" | "zugestellt" | "gelesen" | null;
  /** Warum eine Glockenmeldung (noch) nicht ausgeliefert ist. */
  hinweis: "abgewaehlt" | "zusammenfassung" | null;
  mail: { status: ZustellZeile["status"]; grund: ZustellZeile["grund"] } | null;
  /** Der Stand einer für DIESE Fassung angeforderten Kenntnisnahme — `null`: keine angefordert. */
  kenntnisnahme: KenntnisnahmeStatus | null;
}

export interface ZustellAuskunft {
  vermerkId: string;
  fassung: number;
  meldung: VeroeffentlichungsMeldung;
  am: string;
  mailEingerichtet: boolean;
  /** `false`: vor ADMIN-12 veröffentlicht — dafür wurde kein Zustellstatus festgehalten. */
  erfasst: boolean;
  zaehlung: {
    glocke: { angelegt: number; zugestellt: number; gelesen: number };
    mail: { angelegt: number; zugestellt: number; fehlgeschlagen: number; entfallen: number };
    kenntnisnahme: { offen: number; bestaetigt: number };
  };
  empfaenger: ZustellEmpfaenger[];
}

export interface KenntnisnahmeLage {
  /** Offene Empfänger (ausstehend/überfällig) einer Anforderung der AKTUELLEN Fassung. */
  offen: number;
  /** Unbestätigte Empfänger früherer Fassungen — durch eine neuere Fassung überholt. */
  ueberholt: number;
}

export interface VerlaufEintrag {
  id: string;
  fassung: number;
  art: KoVeroeffentlichung["art"];
  meldung: VeroeffentlichungsMeldung;
  von: { id: string; name: string };
  am: string;
  empfaenger: number;
}

/** Was jeder Leser über den Veröffentlichungsstand erfährt. */
export interface VeroeffentlichungsStand {
  koId: string;
  aktuelleFassung: number;
  /** Ist die aktuelle Fassung fachlich freigegeben (`validiert`)? */
  gueltig: boolean;
  /** Die zuletzt veröffentlichte Fassung — `null`: nie veröffentlicht. */
  veroeffentlichteFassung: number | null;
  /** Ist genau die aktuelle Fassung die veröffentlichte? */
  aktuelleIstVeroeffentlicht: boolean;
  verlauf: VerlaufEintrag[];
}

/** Was nur sieht, wer veröffentlichen darf: die Wirkung jeder Wahl, vor dem Klick. */
export interface Veroeffentlichungsvorschau extends VeroeffentlichungsStand {
  art: KoVeroeffentlichung["art"];
  /** `null`: zulässig. Sonst der Grund, warum diese Fassung jetzt nicht veröffentlicht werden kann. */
  hinderungsgrund: "keine_gueltige_fassung" | "bereits_veroeffentlicht" | null;
  sichtbarkeit: {
    stufe: string | null;
    spaceId: string | null;
    /** Alle Konten, die den Eintrag lesen dürfen — einschliesslich der veröffentlichenden Person. */
    leser: number;
  };
  /** Die Empfänger bei „normal" und „hervorgehoben" (bei „still": niemand). */
  empfaenger: Array<{ id: string; name: string }>;
  kenntnisnahmen: KenntnisnahmeLage;
  /**
   * ADMIN-12: die Wirkung JEDER Wahl nach den geltenden Regeln — derselbe Leserkreis, dieselbe
   * Sichtbarkeit, dieselbe Freigabe; nur die Meldungen unterscheiden sich.
   */
  meldungswirkung: Record<VeroeffentlichungsMeldung, Meldungswirkung>;
  mailEingerichtet: boolean;
}

export interface VeroeffentlichungsErgebnis {
  vermerk: VerlaufEintrag;
  kenntnisnahmen: KenntnisnahmeLage;
  /** ADMIN-12: der Zustellstatus unmittelbar nach dem Veröffentlichen (`null` ohne Regeln). */
  zustellung: ZustellAuskunft | null;
}

/** Eine Veröffentlichungsmeldung für die Glocke — die Route filtert noch über die Sichtbarkeit. */
export interface VeroeffentlichungsMeldungFuerGlocke {
  vermerkId: string;
  koId: string;
  title: string;
  fassung: number;
  art: KoVeroeffentlichung["art"];
  hervorgehoben: boolean;
  at: string;
}

/** Der Vermerk einer Veröffentlichung an DIESEM Eintrag — ein fremder oder erfundener ist ein 404. */
function vermerkVon(ko: KnowledgeObject, vermerkId: string): KoVeroeffentlichung {
  const vermerk = ko.veroeffentlichungen?.find((v) => v.id === vermerkId);
  if (!vermerk) {
    throw new VeroeffentlichungFehler(
      404,
      "vermerk_unbekannt",
      "Diese Veröffentlichung gibt es an diesem Eintrag nicht.",
    );
  }
  return vermerk;
}

export class VeroeffentlichungDienst {
  constructor(private readonly deps: VeroeffentlichungDienstDeps) {}

  private async verlauf(ko: KnowledgeObject): Promise<VerlaufEintrag[]> {
    const namen = await this.deps.kontoNamen();
    return [...(ko.veroeffentlichungen ?? [])].reverse().map((v) => ({
      id: v.id,
      fassung: v.fassung,
      art: v.art,
      meldung: v.meldung,
      von: { id: v.von, name: namen.get(v.von) ?? "" },
      am: v.am,
      empfaenger: v.empfaenger,
    }));
  }

  /** Der Stand für jeden Leser: welche Fassung veröffentlicht ist und welche gerade gilt. */
  async stand(ko: KnowledgeObject): Promise<VeroeffentlichungsStand> {
    const letzte = (ko.veroeffentlichungen ?? []).at(-1);
    return {
      koId: ko.id,
      aktuelleFassung: ko.version,
      gueltig: ko.status === "validiert",
      veroeffentlichteFassung: letzte ? letzte.fassung : null,
      aktuelleIstVeroeffentlicht: letzte !== undefined && letzte.fassung === ko.version,
      verlauf: await this.verlauf(ko),
    };
  }

  private async kenntnisnahmeLage(ko: KnowledgeObject): Promise<KenntnisnahmeLage> {
    const lage: KenntnisnahmeLage = { offen: 0, ueberholt: 0 };
    for (const a of await this.deps.kenntnisnahmen(ko)) {
      if (a.fassung === ko.version) {
        lage.offen += a.zaehlung.ausstehend + a.zaehlung.ueberfaellig;
      } else {
        lage.ueberholt += a.zaehlung.ueberholt;
      }
    }
    return lage;
  }

  private async empfaengerOhne(
    ko: KnowledgeObject,
    veroeffentlicher: string,
  ): Promise<{ leser: number; empfaenger: Array<{ id: string; name: string }> }> {
    const leser = await this.deps.leser(ko);
    return { leser: leser.length, empfaenger: leser.filter((k) => k.id !== veroeffentlicher) };
  }

  /** Die Vorschau für die veröffentlichende Person — Zustand, Sichtbarkeit und Empfänger. */
  async vorschau(
    ko: KnowledgeObject,
    veroeffentlicher: string,
  ): Promise<Veroeffentlichungsvorschau> {
    const stand = await this.stand(ko);
    const { leser, empfaenger } = await this.empfaengerOhne(ko, veroeffentlicher);
    const bisher = ko.veroeffentlichungen ?? [];
    return {
      ...stand,
      art: bisher.length > 0 ? "aktualisierung" : "neu",
      hinderungsgrund: !stand.gueltig
        ? "keine_gueltige_fassung"
        : stand.aktuelleIstVeroeffentlicht
          ? "bereits_veroeffentlicht"
          : null,
      sichtbarkeit: {
        stufe: ko.confidentiality ?? null,
        spaceId: typeof ko.spaceId === "string" ? ko.spaceId : null,
        leser,
      },
      empfaenger,
      kenntnisnahmen: await this.kenntnisnahmeLage(ko),
      meldungswirkung: await this.meldungswirkung(empfaenger.map((k) => k.id)),
      mailEingerichtet: this.deps.kommunikation?.dienst.mailEingerichtet() ?? false,
    };
  }

  /**
   * ADMIN-12: die Wirkung jeder Wahl für diesen Kreis. „still" meldet niemandem (die Kenntnisnahme
   * hat ihren eigenen Weg); „normal" respektiert persönliche Abwahl und Zusammenfassung;
   * „hervorgehoben" erreicht denselben Kreis sofort und ist nicht abwählbar.
   */
  private async meldungswirkung(
    kreis: readonly string[],
  ): Promise<Record<VeroeffentlichungsMeldung, Meldungswirkung>> {
    const k = this.deps.kommunikation;
    const abgewaehlt = k ? (await k.dienst.wirksamAbgewaehlt("veroeffentlichung", kreis)).size : 0;
    const gebuendelt = k ? await k.dienst.zusammenfassungAktiv() : false;
    const mailNormal = k ? await k.dienst.mailAktiv("veroeffentlichung") : false;
    const mailWichtig = k ? await k.dienst.mailAktiv("veroeffentlichung_hervorgehoben") : false;
    const normal = kreis.length - abgewaehlt;
    return {
      still: { glocke: 0, sofort: 0, zusammenfassung: 0, abgewaehlt: 0, mail: 0 },
      normal: {
        glocke: normal,
        sofort: gebuendelt ? 0 : normal,
        zusammenfassung: gebuendelt ? normal : 0,
        abgewaehlt,
        mail: mailNormal ? normal : 0,
      },
      hervorgehoben: {
        glocke: kreis.length,
        sofort: kreis.length,
        zusammenfassung: 0,
        abgewaehlt: 0,
        mail: mailWichtig ? kreis.length : 0,
      },
    };
  }

  /**
   * Veröffentlicht die gültige Fassung `fassung` mit der gewählten Meldung. Die Zulässigkeit wird
   * unter dem KO-Lock am frisch gelesenen Objekt entschieden (`vermerkeVeroeffentlichung`).
   */
  async veroeffentlichen(
    ko: KnowledgeObject,
    eingabe: { fassung: number; meldung: VeroeffentlichungsMeldung },
    veroeffentlicher: string,
  ): Promise<VeroeffentlichungsErgebnis> {
    // Der angekündigte Kreis: dieselbe Liste, die die Vorschau zeigt — bei „still" niemand.
    const kreis =
      eingabe.meldung === "still"
        ? []
        : (await this.empfaengerOhne(ko, veroeffentlicher)).empfaenger.map((k) => k.id);
    const empfaenger = kreis.length;
    const id = this.deps.kennung();
    const am = new Date(this.deps.jetzt()).toISOString();
    // ADMIN-12: wer zusätzlich eine Mail bekommt — nur mit eingerichtetem Kanal und passender
    // Vorgabe; bei „normal" ohne die, die diese Meldung wirksam abgewählt haben.
    const k = this.deps.kommunikation;
    let mailKreis: string[] = [];
    if (k && eingabe.meldung === "hervorgehoben") {
      mailKreis = (await k.dienst.mailAktiv("veroeffentlichung_hervorgehoben")) ? kreis : [];
    } else if (k && eingabe.meldung === "normal") {
      if (await k.dienst.mailAktiv("veroeffentlichung")) {
        const ab = await k.dienst.wirksamAbgewaehlt("veroeffentlichung", kreis);
        mailKreis = kreis.filter((kontoId) => !ab.has(kontoId));
      }
    }
    // Ben, Nacharbeit 11: die Zustellungen entstehen ERST im Belegschritt des Vermerks — also nach
    // der fachlichen Prüfung in `bilde` und mit demselben Transaktionskontext (`nachher`). Ein
    // abgelehnter Versuch (409) hinterlässt deshalb keine Zeile, die gegen das Abruffenster zählt;
    // scheitert das Anlegen, gibt es auch keinen Vermerk.
    const { ko: danach, vermerk } = await this.deps.ko.vermerkeVeroeffentlichung(
      ko.id,
      (frisch) => {
        if (frisch.status !== "validiert") {
          throw new VeroeffentlichungFehler(
            409,
            "keine_gueltige_fassung",
            "Nur eine gültige (geprüfte) Fassung kann veröffentlicht werden.",
          );
        }
        if (frisch.version !== eingabe.fassung) {
          throw new VeroeffentlichungFehler(
            409,
            "fassung_veraltet",
            "Die angezeigte Fassung ist nicht mehr die aktuelle.",
            { aktuelleFassung: frisch.version },
          );
        }
        const bisher = frisch.veroeffentlichungen ?? [];
        if (bisher.some((v) => v.fassung === eingabe.fassung)) {
          throw new VeroeffentlichungFehler(
            409,
            "bereits_veroeffentlicht",
            "Diese Fassung ist bereits veröffentlicht.",
          );
        }
        return {
          id,
          fassung: frisch.version,
          art: bisher.length > 0 ? "aktualisierung" : "neu",
          meldung: eingabe.meldung,
          von: veroeffentlicher,
          am,
          empfaenger,
        };
      },
      async (geschrieben, tx) => {
        await this.deps.zustellungen.anlegen(
          kreis.map((empfaengerId) => ({
            vermerkId: geschrieben.id,
            koId: ko.id,
            empfaengerId,
            am: geschrieben.am,
            hervorgehoben: geschrieben.meldung === "hervorgehoben",
          })),
          tx,
        );
        // ADMIN-12: der Zustellstatus entsteht im selben Belegschritt — je Empfänger und Kanal
        // „angelegt". Ein abgelehnter Versuch hinterlässt deshalb auch hier keine Zeile.
        const zeile = (empfaengerId: string, kanal: ZustellZeile["kanal"]): ZustellZeile => ({
          vermerkId: geschrieben.id,
          koId: ko.id,
          empfaengerId,
          kanal,
          status: "angelegt",
          angelegtAm: geschrieben.am,
          versuchAm: null,
          ergebnisAm: null,
          grund: null,
        });
        await k?.repo.statusAnlegen(
          [...kreis.map((e) => zeile(e, "glocke")), ...mailKreis.map((e) => zeile(e, "mail"))],
          tx,
        );
      },
    );
    // Die Mails gehen erst NACH dem Festhalten raus; scheitert eine, bleibt die Veröffentlichung
    // gültig und die Zeile sagt „fehlgeschlagen".
    if (k && mailKreis.length > 0) {
      await k.versenden({
        id: vermerk.id,
        koId: ko.id,
        fassung: vermerk.fassung,
        hervorgehoben: vermerk.meldung === "hervorgehoben",
      });
    }
    const namen = await this.deps.kontoNamen();
    return {
      vermerk: {
        id: vermerk.id,
        fassung: vermerk.fassung,
        art: vermerk.art,
        meldung: vermerk.meldung,
        von: { id: vermerk.von, name: namen.get(vermerk.von) ?? "" },
        am: vermerk.am,
        empfaenger: vermerk.empfaenger,
      },
      kenntnisnahmen: await this.kenntnisnahmeLage(danach),
      zustellung: k ? await this.zustellstatus(danach, vermerk.id) : null,
    };
  }

  /**
   * ADMIN-12: der Zustellstatus einer Veröffentlichung je Empfänger — angelegt, zugestellt (soweit
   * belegt), fehlgeschlagen/entfallen (Mail), gelesen (Glocke) und bestätigt (Kenntnisnahme).
   */
  async zustellstatus(ko: KnowledgeObject, vermerkId: string): Promise<ZustellAuskunft> {
    const vermerk = vermerkVon(ko, vermerkId);
    const k = this.deps.kommunikation;
    const zeilen = k ? await k.repo.statusFuer(vermerkId) : [];
    const namen = await this.deps.kontoNamen();
    const kenntnis = new Map<string, KenntnisnahmeStatus>();
    for (const a of await this.deps.kenntnisnahmen(ko)) {
      if (a.fassung === vermerk.fassung) {
        for (const e of a.empfaenger) {
          kenntnis.set(e.id, e.status);
        }
      }
    }
    // Ben, Nacharbeit 2: auch Empfänger einer Kenntnisnahme dieser Fassung gehören in die
    // Auskunft — bei „still" haben sie keine Versandzeile, ihre Kenntnisnahme läuft aber weiter.
    const ids = [...new Set([...zeilen.map((z) => z.empfaengerId), ...kenntnis.keys()])];
    const abgewaehlt =
      k && vermerk.meldung === "normal"
        ? await k.dienst.wirksamAbgewaehlt("veroeffentlichung", ids)
        : new Set<string>();
    const gebuendelt =
      k && vermerk.meldung === "normal" ? await k.dienst.zusammenfassungAktiv() : false;
    const sammelKennung = zusammenfassungsKennung(tagVon(vermerk.am));
    const auskunft: ZustellAuskunft = {
      vermerkId,
      fassung: vermerk.fassung,
      meldung: vermerk.meldung,
      am: vermerk.am,
      mailEingerichtet: k?.dienst.mailEingerichtet() ?? false,
      erfasst: zeilen.length > 0 || vermerk.empfaenger === 0 || kenntnis.size > 0,
      zaehlung: {
        glocke: { angelegt: 0, zugestellt: 0, gelesen: 0 },
        mail: { angelegt: 0, zugestellt: 0, fehlgeschlagen: 0, entfallen: 0 },
        kenntnisnahme: { offen: 0, bestaetigt: 0 },
      },
      empfaenger: [],
    };
    for (const id of ids) {
      const glockeZeile = zeilen.find((z) => z.empfaengerId === id && z.kanal === "glocke");
      const mailZeile = zeilen.find((z) => z.empfaengerId === id && z.kanal === "mail");
      let glocke: ZustellEmpfaenger["glocke"] = null;
      if (glockeZeile?.status === "zugestellt") {
        const gelesen = k ? await k.gelesen(id) : new Set<string>();
        glocke =
          gelesen.has(`pub-${vermerkId}`) || gelesen.has(sammelKennung) ? "gelesen" : "zugestellt";
      } else if (glockeZeile) {
        glocke = "angelegt";
      }
      const hinweis: ZustellEmpfaenger["hinweis"] =
        glocke !== "angelegt"
          ? null
          : abgewaehlt.has(id)
            ? "abgewaehlt"
            : gebuendelt
              ? "zusammenfassung"
              : null;
      if (glocke) {
        auskunft.zaehlung.glocke[glocke] += 1;
      }
      if (mailZeile) {
        auskunft.zaehlung.mail[mailZeile.status] += 1;
      }
      const kn = kenntnis.get(id) ?? null;
      if (kn === "bestaetigt") {
        auskunft.zaehlung.kenntnisnahme.bestaetigt += 1;
      } else if (kn === "ausstehend" || kn === "ueberfaellig") {
        auskunft.zaehlung.kenntnisnahme.offen += 1;
      }
      auskunft.empfaenger.push({
        id,
        name: namen.get(id) ?? "",
        glocke,
        hinweis,
        mail: mailZeile ? { status: mailZeile.status, grund: mailZeile.grund } : null,
        kenntnisnahme: kn,
      });
    }
    auskunft.empfaenger.sort((a, b) => a.name.localeCompare(b.name));
    return auskunft;
  }

  /**
   * ADMIN-12: Wiederaufnahme eines unterbrochenen Versands. Verschickt nur Mails, die noch nie
   * versucht wurden — eine bereits versuchte, zugestellte oder fehlgeschlagene Mail geht nicht
   * ein zweites Mal raus, und an der Glocke ändert sich nichts.
   */
  async zustellungFortsetzen(ko: KnowledgeObject, vermerkId: string): Promise<ZustellAuskunft> {
    const vermerk = vermerkVon(ko, vermerkId);
    if (this.deps.kommunikation && vermerk.meldung !== "still") {
      await this.deps.kommunikation.versenden({
        id: vermerk.id,
        koId: ko.id,
        fassung: vermerk.fassung,
        hervorgehoben: vermerk.meldung === "hervorgehoben",
      });
    }
    return this.zustellstatus(ko, vermerkId);
  }

  /**
   * Die Veröffentlichungsmeldungen dieses Kontos für die vorhandene Glocke — ausschliesslich aus
   * den Zustellungen AN dieses Konto (der beim Veröffentlichen angekündigte Kreis). Eine Zustellung
   * zählt nur, wenn ihr Vermerk am Eintrag steht und nicht „still" ist. Ob das Konto den Eintrag
   * JETZT sehen darf, prüft die Route (`sichtbareEintraege`) — hier wird keine zweite Regel
   * geschrieben.
   *
   * VERWAISTE ZEILEN (Ben, Nacharbeit 11): eine Zustellung, deren Eintrag besteht, deren Vermerk
   * dort aber fehlt, stammt aus einem gescheiterten Versuch (etwa aus der Zeit, als Zustellungen
   * noch vor der Prüfung geschrieben wurden). Sie wird entfernt und das Fenster neu gelesen, damit
   * sie keinen Platz einer gültigen Meldung belegt. Eine Zustellung zu einem gerade nicht lesbaren
   * Eintrag (Papierkorb) bleibt stehen — eine Wiederherstellung soll die Meldung nicht verlieren.
   */
  async meldungenFuer(nutzerId: string): Promise<VeroeffentlichungsMeldungFuerGlocke[]> {
    const kos = new Map<string, KnowledgeObject | undefined>();
    for (let runde = 0; ; runde += 1) {
      const zustellungen = await this.deps.zustellungen.fuer(
        nutzerId,
        VEROEFFENTLICHUNG_MELDUNGEN_FENSTER,
      );
      const meldungen: VeroeffentlichungsMeldungFuerGlocke[] = [];
      const verwaist: VeroeffentlichungsZustellung[] = [];
      for (const zustellung of zustellungen) {
        if (!kos.has(zustellung.koId)) {
          kos.set(zustellung.koId, await this.deps.ko.get(zustellung.koId));
        }
        const ko = kos.get(zustellung.koId);
        if (!ko) {
          continue;
        }
        const vermerk = ko.veroeffentlichungen?.find((v) => v.id === zustellung.vermerkId);
        if (!vermerk) {
          verwaist.push(zustellung);
          continue;
        }
        if (vermerk.meldung === "still" || vermerk.von === nutzerId) {
          continue;
        }
        meldungen.push({
          vermerkId: vermerk.id,
          koId: ko.id,
          title: ko.title,
          fassung: vermerk.fassung,
          art: vermerk.art,
          hervorgehoben: vermerk.meldung === "hervorgehoben",
          at: vermerk.am,
        });
      }
      // Jede Runde entfernt alle verwaisten Zeilen ihres Fensters; die Obergrenze verhindert nur,
      // dass ein fehlerhafter Bestand den Abruf endlos aufhält.
      if (verwaist.length === 0 || runde >= VERWAIST_RUNDEN) {
        return meldungen;
      }
      await this.deps.zustellungen.entfernen(verwaist);
    }
  }
}
