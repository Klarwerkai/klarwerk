// ================================================================================================
// JOB 2384 · D1 — DIE NUTZLAST VON `rebindSession`, NICHT DIE KLAMMER.
// ================================================================================================
//
// DER UNTERSCHIED ZU JOB 2376: Dort ist die KLAMMER geprueft — `casMitConsent` oeffnet, rollt
// zurueck, committet und gibt frei. Sie ist dieselbe Funktion fuer alle fuenf Einstiege. Hier
// geht es um das, was ein Einstieg IN sie hineingibt: den SQL-Text und die Parameterliste.
//
// WARUM DAS EINE EIGENE PRUEFUNG BRAUCHT: Eine falsche Nutzlast INNERHALB einer korrekten
// Klammer wird sauber committet. Es gibt keinen Teilzustand, keinen Fehler, kein Rollback —
// nur dauerhaft falsche Daten. Die Klammer schuetzt davor nicht; sie kann es gar nicht.
//
// DIE GEFAEHRLICHSTE FEHLERKLASSE IST EINE VERTAUSCHUNG. `rebindSession` setzt neun Werte:
//     SET document_context_id=$3, resolution_id=$4, policy_version=$5, configuration_version=$6,
//         last_activity_at=$7, expires_at=$8, consent_state=$9
// Vertauscht jemand `$3` und `$4`, schreibt das Produkt die Resolution in die Dokumentbindung
// und umgekehrt. Beides sind Kennungen, beides sind Zeichenketten — kein Typfehler, kein
// Laufzeitfehler, kein rotes Tor. Nur ein Bestand, der still falsch ist.
//
// DESHALB PRUEFT DIESE DATEI DIE ZUORDNUNG SPALTE -> PARAMETERPOSITION -> UEBERGEBENER WERT,
// nicht die Anwesenheit von Namen.
//
// IST-ZUSTAND VOR DIESEM BAU (JOB 2384 D1, gemessen):
//   - Neben `klara-policy-store.ts` liegt KEINE Nachbardatei mit Testendung; der Pfad wird hier
//     bewusst nicht ausgeschrieben, weil `tests/structure/testverweise-aufloesbar.test.ts` jeden
//     ausgeschriebenen Testpfad als behauptete Abdeckung liest — und die gibt es ja gerade nicht.
//   - `klara-session-service.test.ts` nutzt `InMemoryKlaraSessionRepo` (`:2`, `:42`) — dort
//     entsteht nie ein SQL-Text, die Nutzlast kann dort also gar nicht auffallen.
//   - `db.migrate.integration.test.ts` nutzt das Pg-Repo (`:12`, `:658`), ist aber aus der
//     Standardmenge ausgeschlossen: `No test files found, exiting with code 1`. In keinem
//     Bahnlauf sieht also irgendjemand diese Nutzlast.
//
// AUSDRUECKLICHE REICHWEITENGRENZE: Geprueft wird, WAS das Repo an die Datenbank sendet — der
// Text und die Werte. **NICHT geprueft ist, was PostgreSQL daraus macht**; dass `SET spalte=$n`
// den n-ten Parameter in diese Spalte schreibt, ist dokumentiertes Postgres-Verhalten und bleibt
// bis zu einem Integrationslauf eine UNBEWIESENE HYPOTHESE.
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { PgKlaraSessionRepo } from "../../services/reasoner";

// `KlaraRebindWerte` steht nicht im Index-Export, und der Index liegt ausserhalb des Schreibrechts
// dieses Durchgangs (`tests/**`). Statt eines Tiefimports wird der Typ aus der Methodensignatur
// abgeleitet: so bindet die Fixture an GENAU den Parameter, den `rebindSession` annimmt, und ein
// Feldwechsel am Produkt faellt hier als Typfehler auf statt still durchzugehen.
type RebindWerte = Parameters<PgKlaraSessionRepo["rebindSession"]>[2];

interface Anweisung {
  text: string;
  params: readonly unknown[];
}

interface Doppel {
  pool: Pool;
  anweisungen: Anweisung[];
}

/** Ein Doppel, das TEXT UND PARAMETER mitschreibt — anders als in JOB 2376, wo die Reihenfolge zaehlte. */
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
 * DER KERN DIESER DATEI: die Zuordnung Spalte -> Wert, aus dem SQL-Text ABGELEITET.
 *
 * Sie liest die `SET`-Liste und loest jedes `spalte=$n` gegen die uebergebene Parameterliste auf.
 * Damit prueft der Fall nicht, dass ein Name irgendwo vorkommt, sondern dass GENAU DIESER Wert in
 * GENAU DIESE Spalte geschrieben wird. Eine Vertauschung von `$3` und `$4` faellt hier auf.
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

/** Die Bedingung des bedingten Uebergangs — alles zwischen `WHERE` und Ende. */
const bedingung = (a: Anweisung): string => a.text.slice(a.text.indexOf("WHERE")).trim();

function rebindWerte(): RebindWerte {
  return {
    documentContextId: "DOKUMENT-42",
    resolutionId: "AUFLOESUNG-7",
    policyVersion: "REGELWERK-3",
    configurationVersion: "KONFIG-9",
    lastActivityAt: "2026-08-26T08:10:00.000Z",
    expiresAt: "2026-08-26T09:10:00.000Z",
    consentState: "invalidated",
    revokedAt: "2026-08-26T08:09:59.000Z",
  };
}

/** Die Anweisung, die auf `klara_sessions` schreibt — der erste Schritt der Klammer. */
const sitzungsschritt = (d: Doppel): Anweisung => {
  const a = d.anweisungen.find((x) => x.text.includes("UPDATE klara_sessions"));
  if (!a) {
    throw new Error("kein UPDATE auf klara_sessions — die Nutzlast entstand gar nicht");
  }
  return a;
};

describe("JOB 2384 · die Nutzlast von rebindSession", () => {
  it("N1 · JEDER WERT LANDET IN SEINER SPALTE — die Vertauschungsprobe", async () => {
    const d = poolDoppel();
    const w = rebindWerte();

    await new PgKlaraSessionRepo(d.pool).rebindSession("SITZUNG-1", 7, w);

    const b = belegung(sitzungsschritt(d));

    // Die beiden, deren Vertauschung niemand bemerken wuerde: beide sind Kennungen, beide
    // Zeichenketten. Genau hier faellt ein `$3`/`$4`-Dreher auf.
    expect(b.document_context_id, "die Dokumentbindung traegt den falschen Wert").toBe(
      "DOKUMENT-42",
    );
    expect(b.resolution_id, "die Resolution traegt den falschen Wert").toBe("AUFLOESUNG-7");

    // Und die uebrigen fuenf, damit die Probe vollstaendig ist.
    expect(b.policy_version).toBe("REGELWERK-3");
    expect(b.configuration_version).toBe("KONFIG-9");
    expect(b.last_activity_at).toBe("2026-08-26T08:10:00.000Z");
    expect(b.expires_at).toBe("2026-08-26T09:10:00.000Z");
    expect(b.consent_state).toBe("invalidated");
  });

  it("N2 · DIE ZUSAGE GEGEN DEN ZWEISCHRITT: Dokumentbindung und Resolution im SELBEN UPDATE", async () => {
    const d = poolDoppel();
    await new PgKlaraSessionRepo(d.pool).rebindSession("SITZUNG-1", 7, rebindWerte());

    // Der Quelltext sagt zu (`klara-policy-store.ts:704-708`): „Der Zweischritt aus R3 — erst
    // `resolution_id = null`, danach die neue — ist damit fort; ein Leser sieht nie eine aktive
    // Sitzung ohne Resolution." Diese Zusage ist genau dann wahr, wenn beide Spalten in
    // DERSELBEN Anweisung gesetzt werden.
    const mitDokument = d.anweisungen.filter((a) => a.text.includes("document_context_id="));
    const mitResolution = d.anweisungen.filter((a) => a.text.includes("resolution_id="));

    expect(mitDokument, "die Dokumentbindung wird nicht genau einmal gesetzt").toHaveLength(1);
    expect(mitResolution, "die Resolution wird nicht genau einmal gesetzt").toHaveLength(1);
    expect(
      mitDokument[0]?.text,
      "Dokumentbindung und Resolution stehen in ZWEI Anweisungen — der Zweischritt ist zurueck",
    ).toBe(mitResolution[0]?.text);

    // Und kein Zwischenschritt setzt die Resolution auf null.
    expect(
      d.anweisungen.some((a) => /resolution_id\s*=\s*null/i.test(a.text)),
      "es gibt einen Zwischenschritt, der die Resolution leert",
    ).toBe(false);
  });

  it("N3 · DAS TOR: die Bedingung traegt Sitzung UND erwartete Revision", async () => {
    const d = poolDoppel();
    await new PgKlaraSessionRepo(d.pool).rebindSession("SITZUNG-1", 7, rebindWerte());
    const a = sitzungsschritt(d);

    // Ohne die Revision im Compare wuerde ein Rebind auf veraltetem Stand durchgehen und eine
    // zwischenzeitliche Aenderung ueberschreiben — verlorene Aktualisierung.
    expect(bedingung(a)).toContain("session_id=$1");
    expect(bedingung(a)).toContain("session_revision=$2");
    expect(a.params[0], "die Sitzungskennung steht nicht an Stelle 1").toBe("SITZUNG-1");
    expect(a.params[1], "die erwartete Revision steht nicht an Stelle 2").toBe(7);
  });

  it("N4 · DIE REVISION WIRD FORTGESCHRIEBEN, nicht gesetzt", async () => {
    const d = poolDoppel();
    await new PgKlaraSessionRepo(d.pool).rebindSession("SITZUNG-1", 7, rebindWerte());

    // `session_revision = session_revision + 1` — relativ, nicht absolut. Ein fester Wert waere
    // ein zweiter Weg, denselben Compare zu verlieren.
    expect(
      /session_revision\s*=\s*session_revision\s*\+\s*1/.test(sitzungsschritt(d).text),
      "die Revision wird nicht relativ fortgeschrieben",
    ).toBe(true);
  });

  it("N5 · DER ZWEITE SCHRITT entwertet die WIRKSAME Zustimmung — mit dem Zeitpunkt aus den Werten", async () => {
    const d = poolDoppel();
    const w = rebindWerte();
    await new PgKlaraSessionRepo(d.pool).rebindSession("SITZUNG-1", 7, w);

    const consent = d.anweisungen.find((a) => a.text.includes("klara_session_consents"));
    expect(consent, "die Zustimmungsseite wurde nicht angefasst").toBeDefined();

    // Der Compare ist `status='granted'` — nur die WIRKSAME Zeile wird entwertet, nicht eine
    // bereits widerrufene oder abgelaufene.
    expect(consent?.text, "der Compare auf die wirksame Zeile fehlt").toContain("status='granted'");
    expect(consent?.params[0], "die Entwertung trifft die falsche Sitzung").toBe("SITZUNG-1");
    expect(consent?.params[1], "der neue Status ist nicht `invalidated`").toBe("invalidated");
    expect(consent?.params[2], "der Entwertungszeitpunkt stammt nicht aus den Werten").toBe(
      "2026-08-26T08:09:59.000Z",
    );
  });

  it("N6 · KALIBRIERUNG: die Ableitung Spalte -> Wert sieht eine Vertauschung ueberhaupt", async () => {
    // Ohne diesen Fall waere N1 auch dann gruen, wenn `belegung()` immer ein leeres Objekt
    // liefert — dieselbe Fehlerklasse, an der die KA-Reihe gescheitert ist.
    const gedreht: Anweisung = {
      text: "UPDATE klara_sessions SET document_context_id=$3, resolution_id=$4 WHERE session_id=$1 AND session_revision=$2",
      params: ["s", 1, "AUFLOESUNG-7", "DOKUMENT-42"],
    };
    const b = belegung(gedreht);

    // Genau die Lage, die N1 fangen soll: die Werte sind vertauscht, und die Ableitung zeigt es.
    expect(b.document_context_id).toBe("AUFLOESUNG-7");
    expect(b.resolution_id).toBe("DOKUMENT-42");
    expect(Object.keys(b).sort()).toEqual(["document_context_id", "resolution_id"]);
  });
});
