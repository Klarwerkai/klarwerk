// ================================================================================================
// JOB 2408 · D1 — DIE DREI ÜBRIGEN EINSTIEGE: `revokeConsent`, `closeSession`, `invalidateSession`
// ================================================================================================
//
// DIE FEHLERKLASSE. Eine Transaktionsklammer garantiert Alles-oder-Nichts. Sie garantiert NICHT,
// dass das Alles das Richtige ist. Gehen zwei gleichartige Werte in vertauschter Reihenfolge in
// eine Abfrage, dann committet die Klammer den Dreher sauber: kein Typfehler, kein Rollback,
// kein rotes Tor. Nur ein dauerhaft falscher Bestand ohne jedes Signal.
//
// DAS IST NICHT THEORETISCH. `services/app/src/db.migrate.integration.test.ts:610-624` haelt
// einen Fall fest, der genau so passiert ist (BEN-Bericht 17, ROT-1): der produktive Adapter
// fuehrte `document_context_id` nicht in seiner SET-Liste; die Sitzung behielt in PostgreSQL die
// ALTE Dokumentbindung, waehrend der Server dem Client eine neue bestaetigte. Der Kommentar dort
// sagt: „Ein Spalten- oder SQL-Textvergleich haette den Befund NICHT gefunden."
//
// DIESE DATEI NIMMT DEN EINWAND ERNST. Sie ist im Kern eine Textauswertung — und deshalb prueft
// sie NICHT nur die Reihenfolge, sondern zusaetzlich die VOLLSTAENDIGKEIT: Fall D6 zeigt, dass
// jeder Wert, den ein Aufrufer uebergibt, tatsaechlich in einer abgesetzten Anweisung ankommt.
// Genau das war in ROT-1 verletzt. Was die Textauswertung NICHT kann, steht unter GRENZE.
//
// WAS GEMESSEN WURDE, BEVOR HIER ETWAS ENTSTAND (JOB 2408 D1, Klon `a02b4ce`):
//   - Eine Nachbardatei mit Testendung neben `klara-policy-store.ts` gibt es nicht. Der Pfad wird
//     hier nicht ausgeschrieben, weil `tests/structure/testverweise-aufloesbar.test.ts` jeden
//     ausgeschriebenen Testpfad als behauptete Abdeckung liest — und die gibt es ja gerade nicht.
//   - Drei Testdateien nennen die drei Einstiege ueberhaupt. KEINE davon sieht die Bindung:
//       `klara-session-service.test.ts`  → `InMemoryKlaraSessionRepo` (`:2`), kein SQL
//       `ka4-endzustand.test.ts`         → `InMemoryKlaraSessionRepo` (`:106`), kein SQL
//       `db.migrate.integration.test.ts` → echtes Pg-Repo, aber die vitest-Konfiguration schliesst
//                                          `**/*.integration.test.ts` aus; der Aufruf antwortet
//                                          `No test files found, exiting with code 1`.
//   - Die Bindung ist heute an allen drei Stellen KORREKT. Es wird nichts repariert; gebaut wird
//     die Deckung, die den naechsten Dreher sichtbar macht.
//
// GRENZE, ausdruecklich: Geprueft wird, WAS das Repo an die Datenbank sendet — Text und Werte.
// NICHT geprueft ist, was PostgreSQL daraus macht. Fuer den Weg „schreiben, Verbindung wechseln,
// wieder lesen" braucht es einen echten Server; dieser Test ersetzt ihn nicht und behauptet es
// nicht.
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { PgKlaraSessionRepo } from "../../services/reasoner";

interface Anweisung {
  text: string;
  params: readonly unknown[];
}

interface Doppel {
  pool: Pool;
  anweisungen: Anweisung[];
}

function poolDoppel(): Doppel {
  const anweisungen: Anweisung[] = [];
  const connect = async (): Promise<PoolClient> => {
    const client = {
      query: async (text: string, params?: readonly unknown[]) => {
        anweisungen.push({ text, params: params ?? [] });
        return { rows: [], rowCount: 1 };
      },
      release: () => undefined,
    };
    return client as unknown as PoolClient;
  };
  return { pool: { connect } as unknown as Pool, anweisungen };
}

/**
 * Loest die `SET`-Liste einer Anweisung gegen ihre Parameterliste auf: `spalte -> Wert`.
 *
 * Das ist der Kern. Geprueft wird damit nicht, ob ein Name irgendwo im Text vorkommt, sondern
 * welcher uebergebene Wert in welcher Spalte landet. Ein Dreher zweier gleichartiger Parameter
 * ist genau hier sichtbar und sonst nirgends.
 */
function belegung(a: Anweisung): Record<string, unknown> {
  const setTeil = a.text.slice(a.text.indexOf("SET") + 3, a.text.indexOf("WHERE"));
  const raus: Record<string, unknown> = {};
  for (const treffer of setTeil.matchAll(/(\w+)\s*=\s*\$(\d+)/g)) {
    const spalte = treffer[1];
    const stelle = Number(treffer[2]);
    if (spalte) {
      raus[spalte] = a.params[stelle - 1];
    }
  }
  return raus;
}

const bedingung = (a: Anweisung): string => a.text.slice(a.text.indexOf("WHERE")).trim();

const sitzungsschritt = (d: Doppel): Anweisung => {
  const a = d.anweisungen.find((x) => x.text.includes("UPDATE klara_sessions"));
  if (!a) {
    throw new Error("kein UPDATE auf klara_sessions — die Nutzlast entstand gar nicht");
  }
  return a;
};

const zustimmungsschritt = (d: Doppel): Anweisung => {
  const a = d.anweisungen.find((x) => x.text.includes("klara_session_consents"));
  if (!a) {
    throw new Error("die Zustimmungsseite wurde nicht angefasst");
  }
  return a;
};

// Jeder Wert ein eigener Sentinel. Nur so laesst sich „versickert" von „vertauscht" unterscheiden:
// haetten zwei Felder denselben Wert, bliebe ein Dreher zwischen ihnen unsichtbar.
const WERTE_REVOKE = {
  lastActivityAt: "ZEIT-LETZTE-AKTIVITAET",
  expiresAt: "ZEIT-ABLAUF",
  revokedAt: "ZEIT-WIDERRUF",
};
const WERTE_CLOSE = {
  closedAt: "ZEIT-GESCHLOSSEN",
  lastActivityAt: "ZEIT-LETZTE-AKTIVITAET",
};
const WERTE_INVALIDATE = {
  consentState: "expired",
  revokedAt: "ZEIT-WIDERRUF",
} as const;

// ================================================================================================
// JOB 2507 · D1 — DIE PRUEFLUECKE, DIE ALLE FAELLE OBEN DURCHLASSEN
// ================================================================================================
//
// WAS OBEN FEHLT. Die Faelle D1 bis D7 pruefen die Zustimmungsseite ueber PARAMETERPOSITIONEN
// (`c.params[1]`, `c.params[2]`) und ueber die MENGE der belegten Werte. Beides ueberlebt einen
// reinen Spaltendreher: Wird aus
//
//     UPDATE klara_session_consents SET status=$2, revoked_at=$3
//     UPDATE klara_session_consents SET status=$3, revoked_at=$2
//
// dann bleibt die Parameterliste `[sessionId, "revoked", zeitpunkt]` UNVERAENDERT, und die Menge
// der belegten Werte bleibt dieselbe — nur anders verteilt. GEMESSEN am 26.08. (JOB 2408 D2):
// die Mutation laesst 13 von 13 Faellen gruen.
//
// WAS DAS BEDEUTET: `status` traegt danach einen Zeitstempel und `revoked_at` das Wort "revoked".
// Die Zustimmung ist die Stelle, an der ein Mensch Ja oder Nein sagt. Ein Dreher dort laesst einen
// Widerruf als Zustimmung zaehlen — und dreizehn gruene Tests sagen, alles sei in Ordnung.
//
// WIE DIESE FAELLE ES ANDERS MACHEN: Sie pruefen nicht die FORM der Anweisung, sondern den
// ZUSTAND NACH DEM AUFRUF. Das Doppel unten WENDET die Anweisungen an, statt sie zu
// protokollieren. Danach wird die Zeile gelesen: Steht in `status` wirklich der Status und in
// `revoked_at` wirklich der Zeitpunkt? Ein Dreher kann das nicht ueberleben, gleich in welcher
// Form er geschrieben ist.
//
// GRENZE, ausdruecklich: Das anwendende Doppel ist eine MINI-DATENBANK, kein PostgreSQL. Es
// versteht `UPDATE <tabelle> SET spalte=$n[, …] WHERE <bedingung>` und von der Bedingung nur die
// Gleichheitsvergleiche. Bewiesen ist damit die WIRKUNG DER BINDUNG — welcher Wert in welcher
// Spalte landet. NICHT bewiesen ist, dass PostgreSQL dieselbe Anweisung ebenso ausfuehrt.

interface Zeile {
  [spalte: string]: string | number | null;
}

interface Speicher {
  klara_sessions: Zeile[];
  klara_session_consents: Zeile[];
}

/**
 * Ein Doppel, das UPDATE-Anweisungen WIRKLICH ANWENDET.
 *
 * Der Unterschied zu `poolDoppel` oben ist der ganze Punkt dieses Durchgangs: Dort wird
 * aufgezeichnet, was gesendet wurde; hier wird ausgefuehrt, was es bewirkt. Eine Zusicherung
 * ueber die Wirkung kann eine falsche Spaltenbindung nicht durchlassen — sie liest ja nach.
 */
function anwendendesDoppel(anfang: Speicher): { pool: Pool; speicher: Speicher } {
  const speicher: Speicher = {
    klara_sessions: anfang.klara_sessions.map((z) => ({ ...z })),
    klara_session_consents: anfang.klara_session_consents.map((z) => ({ ...z })),
  };

  /** Die Gleichheitsbedingungen einer WHERE-Klausel: `spalte=$n` und `spalte='literal'`. */
  const passt = (zeile: Zeile, bedingungsText: string, params: readonly unknown[]): boolean => {
    for (const t of bedingungsText.matchAll(/(\w+)\s*=\s*(?:\$(\d+)|'([^']*)')/g)) {
      const spalte = t[1] ?? "";
      const wert = t[2] !== undefined ? params[Number(t[2]) - 1] : t[3];
      if (zeile[spalte] !== wert) {
        return false;
      }
    }
    return true;
  };

  const connect = async (): Promise<PoolClient> => {
    const client = {
      query: async (text: string, params?: readonly unknown[]) => {
        const p = params ?? [];
        const roh = text.trim();
        const m = /^UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]*)$/i.exec(roh);
        if (!m) {
          // BEGIN, COMMIT, ROLLBACK und alles andere: keine Wirkung auf den Speicher.
          return { rows: [], rowCount: 0 };
        }
        const tabelle = m[1] ?? "";
        const zeilen = speicher[tabelle as keyof Speicher];
        if (!zeilen) {
          throw new Error(`unbekannte Tabelle im Doppel: ${tabelle}`);
        }
        let getroffen = 0;
        for (const zeile of zeilen) {
          if (!passt(zeile, m[3] ?? "", p)) {
            continue;
          }
          getroffen += 1;
          const setTeil = m[2] ?? "";
          for (const t of setTeil.matchAll(/(\w+)\s*=\s*(?:\$(\d+)|'([^']*)')/g)) {
            const spalte = t[1] ?? "";
            zeile[spalte] = (t[2] !== undefined ? p[Number(t[2]) - 1] : t[3]) as Zeile[string];
          }
          // `spalte = spalte + 1` ist keine Zuweisung eines Parameters, sondern ein AUSDRUCK.
          // Ohne diesen Zweig bliebe `session_revision` stehen — und die Revisionsfortschreibung,
          // die den naechsten CAS traegt, waere als Wirkung nicht pruefbar. Beim Bau ist genau
          // das aufgefallen: W1 meldete `expected 7 not to be 7`.
          for (const t of setTeil.matchAll(/(\w+)\s*=\s*\1\s*\+\s*(\d+)/g)) {
            const spalte = t[1] ?? "";
            zeile[spalte] = Number(zeile[spalte] ?? 0) + Number(t[2]);
          }
        }
        return { rows: [], rowCount: getroffen };
      },
      release: () => undefined,
    };
    return client as unknown as PoolClient;
  };

  return { pool: { connect } as unknown as Pool, speicher };
}

/** Ausgangslage: eine Sitzung mit Revision 7 und eine wirksame Zustimmung. */
function ausgangslage(): Speicher {
  return {
    klara_sessions: [
      {
        session_id: "SITZUNG-1",
        session_revision: 7,
        consent_state: "granted",
        last_activity_at: "ALT",
        expires_at: "ALT",
        closed_at: null,
      },
    ],
    klara_session_consents: [{ session_id: "SITZUNG-1", status: "granted", revoked_at: null }],
  };
}

describe("JOB 2408 · die Nutzlast der drei übrigen Einstiege", () => {
  it("D1 · revokeConsent (:796): zwei gleichartige Zeitstempel, jeder in seiner Spalte", async () => {
    const d = poolDoppel();
    await new PgKlaraSessionRepo(d.pool).revokeConsent("SITZUNG-1", 7, WERTE_REVOKE);

    // `last_activity_at=$3, expires_at=$4` — beides Zeitstempel, beides Zeichenketten. Ein Dreher
    // setzte die Sitzung auf einen Ablauf in der Vergangenheit oder verlaengerte sie stillschweigend.
    const b = belegung(sitzungsschritt(d));
    expect(b.last_activity_at, "die letzte Aktivität trägt den falschen Zeitpunkt").toBe(
      "ZEIT-LETZTE-AKTIVITAET",
    );
    expect(b.expires_at, "der Ablauf trägt den falschen Zeitpunkt").toBe("ZEIT-ABLAUF");

    // Der Zustand steht als Literal im Text, nicht als Parameter — er kann gar nicht verrutschen.
    expect(sitzungsschritt(d).text).toContain("consent_state='revoked'");

    // Die Zustimmungsseite bekommt den WIDERRUFS-Zeitpunkt, nicht einen der beiden anderen.
    const c = zustimmungsschritt(d);
    expect(c.params[1], "der neue Zustimmungsstatus ist nicht `revoked`").toBe("revoked");
    expect(c.params[2], "der Widerrufszeitpunkt stammt nicht aus `revokedAt`").toBe(
      "ZEIT-WIDERRUF",
    );
  });

  it("D2 · closeSession (:817): zwei gleichartige Zeitstempel, jeder in seiner Spalte", async () => {
    const d = poolDoppel();
    await new PgKlaraSessionRepo(d.pool).closeSession("SITZUNG-1", 7, WERTE_CLOSE);

    // `closed_at=$3, last_activity_at=$4`. Ein Dreher datierte den Schluss auf die letzte
    // Aktivität zurück und die Aktivität auf den Schluss vor — beides plausibel aussehende Werte.
    const b = belegung(sitzungsschritt(d));
    expect(b.closed_at, "der Schlusszeitpunkt trägt den falschen Wert").toBe("ZEIT-GESCHLOSSEN");
    expect(b.last_activity_at, "die letzte Aktivität trägt den falschen Wert").toBe(
      "ZEIT-LETZTE-AKTIVITAET",
    );
    expect(sitzungsschritt(d).text).toContain("consent_state='invalidated'");

    // BEFUND, festgehalten statt bewertet: die Zustimmungsseite bekommt `closedAt` als
    // Widerrufszeitpunkt — einen eigenen `revokedAt` gibt es in dieser Signatur nicht. Das ist
    // plausibel (Schliessen entwertet), steht aber nirgends geschrieben. Der Fall haelt den
    // Ist-Zustand fest, damit eine spätere Änderung nicht unbemerkt bleibt.
    expect(zustimmungsschritt(d).params[2]).toBe("ZEIT-GESCHLOSSEN");
  });

  it("D3 · invalidateSession (:838): ein Parameter in der SET-Liste — hier gibt es nichts zu drehen", async () => {
    const d = poolDoppel();
    await new PgKlaraSessionRepo(d.pool).invalidateSession("SITZUNG-1", 7, WERTE_INVALIDATE);

    // Diese Stelle ist gegen die Fehlerklasse IMMUN, und das ist ein Ergebnis: `SET consent_state=$3`
    // führt genau einen Parameter. Der Fall hält die Immunität fest — kommt eine zweite Spalte
    // dazu, ist die Stelle drehbar und dieser Fall muss erweitert werden.
    const b = belegung(sitzungsschritt(d));
    expect(
      Object.keys(b),
      "die SET-Liste führt nicht mehr genau eine parametrisierte Spalte",
    ).toEqual(["consent_state"]);
    expect(b.consent_state).toBe("expired");

    // Derselbe Wert geht in BEIDE Tabellen — der Sitzungszustand und der Zustimmungsstatus.
    // Auch das ist Ist-Zustand, festgehalten, nicht bewertet (siehe Ownerfrage O1 aus JOB 2384).
    const c = zustimmungsschritt(d);
    expect(c.params[1]).toBe("expired");
    expect(c.params[2]).toBe("ZEIT-WIDERRUF");
  });

  it("D4 · alle drei tragen denselben bedingten Übergang: Sitzung UND erwartete Revision", async () => {
    const faelle = [
      {
        name: "revokeConsent",
        lauf: (r: PgKlaraSessionRepo) => r.revokeConsent("SITZUNG-1", 7, WERTE_REVOKE),
      },
      {
        name: "closeSession",
        lauf: (r: PgKlaraSessionRepo) => r.closeSession("SITZUNG-1", 7, WERTE_CLOSE),
      },
      {
        name: "invalidateSession",
        lauf: (r: PgKlaraSessionRepo) => r.invalidateSession("SITZUNG-1", 7, WERTE_INVALIDATE),
      },
    ];

    for (const fall of faelle) {
      const d = poolDoppel();
      await fall.lauf(new PgKlaraSessionRepo(d.pool));
      const a = sitzungsschritt(d);

      // Ohne die Revision im Compare ginge ein Widerruf auf veraltetem Stand durch und
      // überschriebe eine zwischenzeitliche Änderung.
      expect(bedingung(a), `${fall.name}: die Sitzung fehlt im Compare`).toContain("session_id=$1");
      expect(bedingung(a), `${fall.name}: die Revision fehlt im Compare`).toContain(
        "session_revision=$2",
      );
      expect(a.params[0], `${fall.name}: die Sitzungskennung steht nicht an Stelle 1`).toBe(
        "SITZUNG-1",
      );
      expect(a.params[1], `${fall.name}: die erwartete Revision steht nicht an Stelle 2`).toBe(7);

      // Und die Revision wird relativ fortgeschrieben, nicht absolut gesetzt.
      expect(
        /session_revision\s*=\s*session_revision\s*\+\s*1/.test(a.text),
        `${fall.name}: die Revision wird nicht relativ fortgeschrieben`,
      ).toBe(true);
    }
  });

  it("D5 · die Zustimmungsseite trifft nur die WIRKSAME Zeile — bei allen dreien", async () => {
    const laeufe = [
      (r: PgKlaraSessionRepo) => r.revokeConsent("SITZUNG-1", 7, WERTE_REVOKE),
      (r: PgKlaraSessionRepo) => r.closeSession("SITZUNG-1", 7, WERTE_CLOSE),
      (r: PgKlaraSessionRepo) => r.invalidateSession("SITZUNG-1", 7, WERTE_INVALIDATE),
    ];

    for (const lauf of laeufe) {
      const d = poolDoppel();
      await lauf(new PgKlaraSessionRepo(d.pool));
      const c = zustimmungsschritt(d);

      // Ohne `status='granted'` würden auch längst widerrufene Zustimmungen erneut entwertet und
      // ihr Widerrufszeitpunkt überschrieben — ein stiller Verlust von Nachweisen.
      expect(c.text, "der Compare auf die wirksame Zeile fehlt").toContain("status='granted'");
      expect(c.params[0], "die Entwertung trifft die falsche Sitzung").toBe("SITZUNG-1");
    }
  });

  it("D6 · KEIN ÜBERGEBENER WERT VERSICKERT — die Klasse aus BEN-Bericht 17 (ROT-1)", async () => {
    // ROT-1 war kein Dreher, sondern ein FEHLEN: `documentContextId` wurde übergeben, die SET-Liste
    // führte die Spalte nicht, der Wert verschwand — und der Server bestätigte dem Client trotzdem.
    // Reihenfolge zu prüfen genügt dagegen nicht; geprüft werden muss, dass jeder übergebene Wert
    // dort ankommt, wo er hingehört.
    //
    // WARUM DIESER FALL SEINE ERSTE FASSUNG NICHT BEHALTEN HAT. Zuerst prüfte er nur, ob ein Wert
    // IRGENDWO als Parameter auftaucht. Die Gegenmutation M3 (Spalte `closed_at` aus der SET-Liste
    // entfernt — exakt die ROT-1-Form) ließ ihn GRÜN: `closedAt` wird zusätzlich auf der
    // Zustimmungsseite abgesetzt, und die Sentinelsuche fand ihn dort. Ein Wert, der in der
    // falschen Tabelle ankommt, ist aber genauso verloren wie einer, der nirgends ankommt.
    // Deshalb sagt das Register jetzt für jedes Feld, in WELCHER Anweisung es erscheinen muss.
    const REGISTER = [
      {
        name: "revokeConsent",
        lauf: (r: PgKlaraSessionRepo) => r.revokeConsent("SITZUNG-1", 7, WERTE_REVOKE),
        // beide Fristen gehören in die Sitzung; der Widerrufszeitpunkt allein zur Zustimmung
        inSitzung: { lastActivityAt: "ZEIT-LETZTE-AKTIVITAET", expiresAt: "ZEIT-ABLAUF" },
        inZustimmung: { revokedAt: "ZEIT-WIDERRUF" },
      },
      {
        name: "closeSession",
        lauf: (r: PgKlaraSessionRepo) => r.closeSession("SITZUNG-1", 7, WERTE_CLOSE),
        // `closedAt` gehört in BEIDE — als Schlusszeitpunkt und als Entwertungszeitpunkt
        inSitzung: { closedAt: "ZEIT-GESCHLOSSEN", lastActivityAt: "ZEIT-LETZTE-AKTIVITAET" },
        inZustimmung: { closedAt: "ZEIT-GESCHLOSSEN" },
      },
      {
        name: "invalidateSession",
        lauf: (r: PgKlaraSessionRepo) => r.invalidateSession("SITZUNG-1", 7, WERTE_INVALIDATE),
        inSitzung: { consentState: "expired" },
        inZustimmung: { consentState: "expired", revokedAt: "ZEIT-WIDERRUF" },
      },
    ];

    const versickert: string[] = [];
    for (const eintrag of REGISTER) {
      const d = poolDoppel();
      await eintrag.lauf(new PgKlaraSessionRepo(d.pool));

      // GEGEN DIE BELEGTEN SPALTEN, nicht gegen die Parameterliste: bei ROT-1 blieb der Wert im
      // Aufruf stehen und nur die Spalte fiel aus der SET-Liste. Wer `params` prüft, sieht ihn
      // weiterhin und hält ihn für geschrieben — genau der Irrtum, den M3 hier aufgedeckt hat.
      const sitzungswerte = new Set(
        Object.values(belegung(sitzungsschritt(d))).map((p) => String(p)),
      );
      for (const [feld, wert] of Object.entries(eintrag.inSitzung)) {
        if (!sitzungswerte.has(wert)) {
          versickert.push(`${eintrag.name}.${feld} fehlt in der Sitzungsanweisung ("${wert}")`);
        }
      }

      const zustimmungswerte = new Set(
        Object.values(belegung(zustimmungsschritt(d))).map((p) => String(p)),
      );
      for (const [feld, wert] of Object.entries(eintrag.inZustimmung)) {
        if (!zustimmungswerte.has(wert)) {
          versickert.push(`${eintrag.name}.${feld} fehlt in der Zustimmungsanweisung ("${wert}")`);
        }
      }
    }

    expect(
      versickert,
      "Ein Aufrufer übergibt diesen Wert, und die Anweisung, die ihn schreiben müsste, trägt ihn " +
        "nicht — genau die Lage aus BEN-Bericht 17 ROT-1: der Server bestätigt eine Änderung, die " +
        "nie geschrieben wird.",
    ).toEqual([]);
  });

  it("D7 · KALIBRIERUNG: die Auswertung sieht Dreher UND Fehlen überhaupt", async () => {
    // Ohne diesen Fall wären D1–D3 auch dann grün, wenn `belegung()` immer ein leeres Objekt
    // liefert, und D6 auch dann, wenn die Sentinelsuche nichts findet. Beides sind stille
    // Ausfälle — dieselbe Fehlerklasse, an der in diesem Zyklus vier Wächter gescheitert sind.
    const gedreht: Anweisung = {
      text: "UPDATE klara_sessions SET closed_at=$3, last_activity_at=$4 WHERE session_id=$1 AND session_revision=$2",
      params: ["s", 1, "ZEIT-LETZTE-AKTIVITAET", "ZEIT-GESCHLOSSEN"],
    };
    const b = belegung(gedreht);
    expect(b.closed_at, "die Auswertung sieht einen Dreher nicht").toBe("ZEIT-LETZTE-AKTIVITAET");
    expect(b.last_activity_at).toBe("ZEIT-GESCHLOSSEN");

    // Und die Vollständigkeitsprüfung aus D6 muss ein Fehlen wirklich melden: hier fehlt die
    // Spalte `closed_at` in der SET-Liste, der Wert wird also nirgends abgesetzt.
    const unvollstaendig: Anweisung = {
      text: "UPDATE klara_sessions SET last_activity_at=$3 WHERE session_id=$1 AND session_revision=$2",
      params: ["s", 1, "ZEIT-LETZTE-AKTIVITAET"],
    };
    const abgesetzt = new Set(unvollstaendig.params.map((p) => String(p)));
    expect(abgesetzt.has("ZEIT-GESCHLOSSEN"), "ein fehlender Wert fiele nicht auf").toBe(false);
    expect(Object.keys(belegung(unvollstaendig))).toEqual(["last_activity_at"]);
  });
});

// ----------------------------------------------------------------------------------------------
// JOB 2507 · DIE WIRKUNGSFAELLE — sie lesen den Zustand NACH dem Aufruf.
// ----------------------------------------------------------------------------------------------

it("W1 · revokeConsent: nach dem Aufruf trägt die Zustimmungszeile Status UND Zeitpunkt in IHRER Spalte", async () => {
  const d = anwendendesDoppel(ausgangslage());
  await new PgKlaraSessionRepo(d.pool).revokeConsent("SITZUNG-1", 7, WERTE_REVOKE);

  const c = d.speicher.klara_session_consents[0];
  // DER KERN. Bei vertauschten Platzhaltern stünde hier der Zeitstempel im Status —
  // ein Widerruf, der als Zustimmung zählt, weil `status` gar keinen Status mehr trägt.
  expect(c?.status, "der Status der Zustimmung trägt den falschen Wert").toBe("revoked");
  expect(c?.revoked_at, "der Widerrufszeitpunkt trägt den falschen Wert").toBe("ZEIT-WIDERRUF");

  // Und die Sitzungsseite, ebenfalls als Wirkung gelesen statt als Anweisungstext.
  const s = d.speicher.klara_sessions[0];
  expect(s?.consent_state).toBe("revoked");
  expect(s?.last_activity_at, "die letzte Aktivität trägt den falschen Zeitpunkt").toBe(
    "ZEIT-LETZTE-AKTIVITAET",
  );
  expect(s?.expires_at, "der Ablauf trägt den falschen Zeitpunkt").toBe("ZEIT-ABLAUF");
  expect(s?.session_revision, "die Revision wurde nicht fortgeschrieben").not.toBe(7);
});

it("W2 · closeSession: derselbe Nachweis am zweiten Einstieg", async () => {
  const d = anwendendesDoppel(ausgangslage());
  await new PgKlaraSessionRepo(d.pool).closeSession("SITZUNG-1", 7, WERTE_CLOSE);

  const c = d.speicher.klara_session_consents[0];
  expect(c?.status, "der Status der Zustimmung trägt den falschen Wert").toBe("invalidated");
  expect(c?.revoked_at, "der Entwertungszeitpunkt trägt den falschen Wert").toBe(
    "ZEIT-GESCHLOSSEN",
  );

  const s = d.speicher.klara_sessions[0];
  expect(s?.closed_at, "der Schlusszeitpunkt trägt den falschen Wert").toBe("ZEIT-GESCHLOSSEN");
  expect(s?.last_activity_at, "die letzte Aktivität trägt den falschen Wert").toBe(
    "ZEIT-LETZTE-AKTIVITAET",
  );
});

it("W3 · invalidateSession: derselbe Nachweis am dritten Einstieg", async () => {
  const d = anwendendesDoppel(ausgangslage());
  await new PgKlaraSessionRepo(d.pool).invalidateSession("SITZUNG-1", 7, WERTE_INVALIDATE);

  const c = d.speicher.klara_session_consents[0];
  expect(c?.status, "der Status der Zustimmung trägt den falschen Wert").toBe("expired");
  expect(c?.revoked_at, "der Widerrufszeitpunkt trägt den falschen Wert").toBe("ZEIT-WIDERRUF");
  expect(d.speicher.klara_sessions[0]?.consent_state).toBe("expired");
});

it("W4 · DIE WIRKSAME ZEILE: eine bereits widerrufene Zustimmung wird NICHT erneut angefasst", async () => {
  // Der Compare `status='granted'` als Wirkung gelesen: Die zweite Zeile ist längst widerrufen
  // und behält ihren Zeitpunkt. Ohne den Compare würde ihr Nachweis überschrieben — ein
  // stiller Verlust, den keine Formprüfung sichtbar macht.
  const anfang = ausgangslage();
  anfang.klara_session_consents.push({
    session_id: "SITZUNG-1",
    status: "revoked",
    revoked_at: "FRUEHERER-WIDERRUF",
  });
  const d = anwendendesDoppel(anfang);

  await new PgKlaraSessionRepo(d.pool).revokeConsent("SITZUNG-1", 7, WERTE_REVOKE);

  const alt = d.speicher.klara_session_consents[1];
  expect(alt?.revoked_at, "der frühere Widerrufszeitpunkt wurde überschrieben").toBe(
    "FRUEHERER-WIDERRUF",
  );
  // Die wirksame Zeile dagegen wurde entwertet.
  expect(d.speicher.klara_session_consents[0]?.status).toBe("revoked");
});

it("W5 · KALIBRIERUNG: das anwendende Doppel wendet wirklich an — und nicht wahllos", async () => {
  // Ohne diesen Fall wären W1–W4 auch dann grün, wenn das Doppel nie etwas schreibt und die
  // Ausgangslage zufällig passt. Beide Richtungen, an einer Anweisung von Hand.
  const d = anwendendesDoppel(ausgangslage());
  const client = await d.pool.connect();

  await client.query("UPDATE klara_session_consents SET status=$2 WHERE session_id=$1", [
    "SITZUNG-1",
    "PROBE",
  ]);
  expect(d.speicher.klara_session_consents[0]?.status, "das Doppel schreibt nicht").toBe("PROBE");

  // Gegenprobe: eine Bedingung, die nicht zutrifft, darf NICHTS ändern.
  await client.query("UPDATE klara_session_consents SET status=$2 WHERE session_id=$1", [
    "FREMDE-SITZUNG",
    "DARF-NICHT",
  ]);
  expect(
    d.speicher.klara_session_consents[0]?.status,
    "das Doppel schreibt auch ohne passende Bedingung",
  ).toBe("PROBE");

  // Und die Trefferzahl stimmt — sie steuert im Produkt den CAS-Ausgang.
  const treffer = await client.query(
    "UPDATE klara_sessions SET consent_state=$2 WHERE session_id=$1",
    ["FREMDE-SITZUNG", "X"],
  );
  expect((treffer as { rowCount: number }).rowCount, "die Trefferzahl ist erfunden").toBe(0);
});
