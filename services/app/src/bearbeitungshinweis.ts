import type { Pool } from "pg";

// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · DER HINWEIS „HIER BEARBEITET GERADE JEMAND".
// ================================================================================================
//
// WAS DAS IST — UND WAS AUSDRÜCKLICH NICHT. Wer einen vorhandenen Wissenseintrag bearbeitet,
// meldet das hier an; wer denselben Eintrag lesen darf, sieht den Hinweis und dessen Ende. Es ist
// ein HINWEIS, keine Sperre und keine neue Rechteachse:
//   · niemand wird am Speichern gehindert — den Schutz vor stillem Überschreiben trägt weiterhin
//     allein der bedingte Schreibzugriff (`expectedVersion`/`KO_STALE`, JOB 3667/4075). Diese
//     Ablage wird vom Speicherweg weder gelesen noch geschrieben, sie kann ihn also auch nicht
//     ersetzen oder still neu versuchen lassen.
//   · wer den Hinweis setzen darf, entscheidet dasselbe Recht wie beim Bearbeiten (`ko.create`),
//     wer ihn lesen darf, dasselbe wie beim Lesen (`ko.read` + Sichtbarkeit) — beides an der Route.
//
// DIE TECHNISCHE BINDUNG (Entwurfsparameter, keine fachliche Freigabe):
//   · je Bearbeitung EINE Zeile, geschlüsselt über Eintrag, Konto UND Sitzung. Die Sitzung ist
//     die Kennung, die ein geöffnetes Formular für sich erzeugt (instanzgebunden). Weil das Konto
//     Teil des Schlüssels ist, kann ein fremdes Konto eine fremde Zeile weder erneuern noch
//     beenden — es erreicht mit derselben Sitzungskennung nur seine eigene.
//   · erneuert wird alle `BEARBEITUNG_ERNEUERN_SEKUNDEN`, abgelaufen ist eine Zeile nach
//     `BEARBEITUNG_ABLAUF_SEKUNDEN` ohne Erneuerung. Bricht die Verbindung ab, verschwindet der
//     Hinweis damit von selbst.
//   · DIE SERVERZEIT ENTSCHEIDET. In der PostgreSQL-Fassung ist das die Uhr der DATENBANK
//     (`now()`), nicht die eines App-Prozesses: laufen mehrere App-Prozesse gegen dieselbe
//     Datenbank, sehen sie denselben Hinweis mit demselben Ablauf, gleich welcher Prozess ihn
//     geschrieben hat und wie seine eigene Uhr geht.
//   · der Name ist die vorhandene sichtbare Nutzerbezeichnung — keine E-Mail, kein Kontakt.
//
// FLÜCHTIG IST ERLAUBT. Geht ein Hinweis verloren (Neustart der Speicherfassung), ist das kein
// Datenverlust: gespeicherte Inhalte liegen woanders, und das offene Formular meldet sich bei der
// nächsten Erneuerung ohnehin wieder an.

/** Nach so vielen Sekunden ohne Erneuerung ist ein Hinweis abgelaufen. */
export const BEARBEITUNG_ABLAUF_SEKUNDEN = 120;
/** In diesem Takt erneuert ein offenes Formular seinen Hinweis. */
export const BEARBEITUNG_ERNEUERN_SEKUNDEN = 30;

/** Eine laufende Bearbeitung, wie die Ablage sie kennt. */
export interface Bearbeitung {
  koId: string;
  nutzerId: string;
  /** Die sichtbare Nutzerbezeichnung zum Zeitpunkt der letzten Meldung. */
  nutzerName: string;
  sitzung: string;
  /** ISO-Zeitpunkt des Beginns (Serverzeit). */
  seit: string;
  /** ISO-Zeitpunkt, an dem der Hinweis ohne Erneuerung abläuft (Serverzeit). */
  bis: string;
}

/** Was eine Anfrage an die Ablage zurückbekommt: das Ergebnis UND die Uhr, die entschieden hat. */
export interface BearbeitungsStand {
  jetzt: string;
  bearbeitungen: Bearbeitung[];
}

export interface BearbeitungsRepo {
  /**
   * Beginnt oder erneuert GENAU die eigene Bearbeitung (Eintrag, Konto, Sitzung). War die Zeile
   * schon abgelaufen, beginnt sie neu (`seit` = jetzt) — das ist der Weg zurück nach einem
   * Verbindungsabbruch oder einem Neustart.
   */
  melde(
    koId: string,
    nutzer: { id: string; name: string },
    sitzung: string,
  ): Promise<{ jetzt: string; bearbeitung: Bearbeitung }>;
  /** Beendet GENAU die eigene Bearbeitung. `false`, wenn es sie (nicht mehr) gab. */
  beende(koId: string, nutzerId: string, sitzung: string): Promise<boolean>;
  /** Alle NICHT abgelaufenen Bearbeitungen dieses Eintrags, älteste zuerst. */
  laufende(koId: string): Promise<BearbeitungsStand>;
}

/**
 * Eine Sitzungskennung, wie sie ein Formular erzeugt: 8 bis 80 Zeichen aus Buchstaben, Ziffern,
 * `-` und `_`. Alles andere ist kein Formular dieses Produkts und wird an der Route abgewiesen.
 */
export function istSitzungskennung(wert: unknown): wert is string {
  return typeof wert === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(wert);
}

// ================================================================================================
// DIE SPEICHERFASSUNG (Tests, Dev ohne Datenbank) — dieselbe Regel, die Uhr des Prozesses.
// ================================================================================================

export class InMemoryBearbeitungsRepo implements BearbeitungsRepo {
  private readonly zeilen = new Map<string, Bearbeitung>();

  constructor(
    private readonly uhr: () => number = Date.now,
    private readonly ablaufSekunden = BEARBEITUNG_ABLAUF_SEKUNDEN,
  ) {}

  private static schluessel(koId: string, nutzerId: string, sitzung: string): string {
    return JSON.stringify([koId, nutzerId, sitzung]);
  }

  melde(
    koId: string,
    nutzer: { id: string; name: string },
    sitzung: string,
  ): Promise<{ jetzt: string; bearbeitung: Bearbeitung }> {
    const jetzt = this.uhr();
    const schluessel = InMemoryBearbeitungsRepo.schluessel(koId, nutzer.id, sitzung);
    const vorher = this.zeilen.get(schluessel);
    const laeuftNoch = vorher !== undefined && Date.parse(vorher.bis) > jetzt;
    const bearbeitung: Bearbeitung = {
      koId,
      nutzerId: nutzer.id,
      nutzerName: nutzer.name,
      sitzung,
      seit: laeuftNoch ? vorher.seit : new Date(jetzt).toISOString(),
      bis: new Date(jetzt + this.ablaufSekunden * 1000).toISOString(),
    };
    this.zeilen.set(schluessel, bearbeitung);
    return Promise.resolve({
      jetzt: new Date(jetzt).toISOString(),
      bearbeitung: { ...bearbeitung },
    });
  }

  beende(koId: string, nutzerId: string, sitzung: string): Promise<boolean> {
    const schluessel = InMemoryBearbeitungsRepo.schluessel(koId, nutzerId, sitzung);
    const vorher = this.zeilen.get(schluessel);
    this.zeilen.delete(schluessel);
    return Promise.resolve(vorher !== undefined && Date.parse(vorher.bis) > this.uhr());
  }

  laufende(koId: string): Promise<BearbeitungsStand> {
    const jetzt = this.uhr();
    const bearbeitungen: Bearbeitung[] = [];
    for (const [schluessel, zeile] of this.zeilen) {
      if (Date.parse(zeile.bis) <= jetzt) {
        this.zeilen.delete(schluessel);
        continue;
      }
      if (zeile.koId === koId) {
        bearbeitungen.push({ ...zeile });
      }
    }
    bearbeitungen.sort((a, b) => a.seit.localeCompare(b.seit));
    return Promise.resolve({ jetzt: new Date(jetzt).toISOString(), bearbeitungen });
  }
}

// ================================================================================================
// DIE POSTGRESQL-FASSUNG — geteilt von allen App-Prozessen derselben Instanz.
// ================================================================================================

/**
 * Die Tabelle der laufenden Bearbeitungen. Rein additiv und wiederholbar (`CREATE … IF NOT
 * EXISTS`), ohne Fremdschlüssel auf `kos`: eine Zeile zu einem gelöschten Eintrag ist ein
 * verwaister Hinweis, der nach spätestens `BEARBEITUNG_ABLAUF_SEKUNDEN` ohnehin nicht mehr gelesen
 * wird — kein Grund, eine Migration oder ein Löschen scheitern zu lassen.
 */
export const KO_BEARBEITUNG_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_bearbeitungen (
  ko_id text NOT NULL,
  nutzer_id text NOT NULL,
  sitzung text NOT NULL,
  nutzer_name text NOT NULL,
  seit timestamptz NOT NULL,
  bis timestamptz NOT NULL,
  PRIMARY KEY (ko_id, nutzer_id, sitzung)
);
CREATE INDEX IF NOT EXISTS idx_ko_bearbeitungen_ko ON ko_bearbeitungen(ko_id, bis);
`;

interface BearbeitungsZeile {
  ko_id: string;
  nutzer_id: string;
  sitzung: string;
  nutzer_name: string;
  seit: Date;
  bis: Date;
}

function ausZeile(zeile: BearbeitungsZeile): Bearbeitung {
  return {
    koId: zeile.ko_id,
    nutzerId: zeile.nutzer_id,
    nutzerName: zeile.nutzer_name,
    sitzung: zeile.sitzung,
    seit: new Date(zeile.seit).toISOString(),
    bis: new Date(zeile.bis).toISOString(),
  };
}

export class PgBearbeitungsRepo implements BearbeitungsRepo {
  constructor(
    private readonly pool: Pool,
    private readonly ablaufSekunden = BEARBEITUNG_ABLAUF_SEKUNDEN,
  ) {}

  async melde(
    koId: string,
    nutzer: { id: string; name: string },
    sitzung: string,
  ): Promise<{ jetzt: string; bearbeitung: Bearbeitung }> {
    // EINE Anweisung: Beginn und Erneuerung entscheiden sich an derselben Datenbankuhr. Eine
    // abgelaufene Zeile beginnt neu (`seit` = jetzt), eine laufende behält ihren Beginn.
    const res = await this.pool.query<BearbeitungsZeile & { jetzt: Date }>(
      `INSERT INTO ko_bearbeitungen (ko_id, nutzer_id, sitzung, nutzer_name, seit, bis)
       VALUES ($1, $2, $3, $4, now(), now() + make_interval(secs => $5))
       ON CONFLICT (ko_id, nutzer_id, sitzung) DO UPDATE SET
         nutzer_name = EXCLUDED.nutzer_name,
         seit = CASE WHEN ko_bearbeitungen.bis > now() THEN ko_bearbeitungen.seit ELSE now() END,
         bis = EXCLUDED.bis
       RETURNING ko_id, nutzer_id, sitzung, nutzer_name, seit, bis, now() AS jetzt`,
      [koId, nutzer.id, sitzung, nutzer.name, this.ablaufSekunden],
    );
    const zeile = res.rows[0];
    if (!zeile) {
      throw new Error("Bearbeitungshinweis wurde nicht geschrieben.");
    }
    return { jetzt: new Date(zeile.jetzt).toISOString(), bearbeitung: ausZeile(zeile) };
  }

  async beende(koId: string, nutzerId: string, sitzung: string): Promise<boolean> {
    const res = await this.pool.query<{ bis: Date; jetzt: Date }>(
      `DELETE FROM ko_bearbeitungen WHERE ko_id=$1 AND nutzer_id=$2 AND sitzung=$3
       RETURNING bis, now() AS jetzt`,
      [koId, nutzerId, sitzung],
    );
    const zeile = res.rows[0];
    return zeile !== undefined && new Date(zeile.bis).getTime() > new Date(zeile.jetzt).getTime();
  }

  async laufende(koId: string): Promise<BearbeitungsStand> {
    // Abgelaufene Zeilen dieses Eintrags werden beim Lesen mit entfernt — sie sagen nichts mehr.
    // Gelesen wird danach mit DERSELBEN Uhr, die auch das Entfernen entschieden hat.
    await this.pool.query("DELETE FROM ko_bearbeitungen WHERE ko_id=$1 AND bis <= now()", [koId]);
    // Die Uhr steht als eigene Zeile vorn: auch ohne laufende Bearbeitung kommt sie zurück, und
    // es gibt keinen Rückfall auf die Uhr eines App-Prozesses.
    const res = await this.pool.query<
      { jetzt: Date } & (BearbeitungsZeile | { [K in keyof BearbeitungsZeile]: null })
    >(
      `WITH uhr AS (SELECT now() AS jetzt)
       SELECT uhr.jetzt, b.ko_id, b.nutzer_id, b.sitzung, b.nutzer_name, b.seit, b.bis
       FROM uhr LEFT JOIN ko_bearbeitungen b ON b.ko_id=$1 AND b.bis > uhr.jetzt
       ORDER BY b.seit, b.nutzer_id, b.sitzung`,
      [koId],
    );
    const erste = res.rows[0];
    if (!erste) {
      throw new Error("Die Datenbankuhr hat nicht geantwortet.");
    }
    const bearbeitungen: Bearbeitung[] = [];
    for (const zeile of res.rows) {
      if (zeile.ko_id !== null) {
        bearbeitungen.push(ausZeile(zeile as BearbeitungsZeile));
      }
    }
    return { jetzt: new Date(erste.jetzt).toISOString(), bearbeitungen };
  }
}
