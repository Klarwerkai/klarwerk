// ================================================================================================
// JOB 4330 · DIE DISKUSSION BEKOMMT BODEN UND AUGEN — POSTGRESQL, SOCKET, CHROMIUM, NEUSTART.
// ================================================================================================
//
// DIE KETTE, die diese Datei schliesst und die sonst nirgends ganz gemessen ist:
//
//     `kos.data` (PostgreSQL) → `PgKoRepo` → `KoService` → `PUT`/`GET /api/kos/:id` über einen
//     ECHTEN Socket → die gebaute Fläche → Route `/wissen/:id` → `BibliothekLesen` →
//     `MehrAbschnitte` → Chromium mit ECHTEN Tastendrücken — und über einen NEUSTART der
//     Anwendung zurück in die Spalte, gelesen von einem dritten Konto in einem frischen Kontext.
//
// WAS ES DAZU SCHON GIBT UND WAS NICHT. `tests/wiki-diskussion/**` misst Beitrag, Antwortbezug,
// Klärungsstand, Idempotenz und Fehlerweg vollständig — aber über Speicherablagen
// (`huelle.ts:39-40`) und in jsdom mit gefälschtem Netz (`diskussion-in-der-flaeche.test.tsx:1`).
// Diese vierzehn Dateien bleiben unverändert und grün; sie messen schnell und breit, diese Datei
// misst tief und langsam. Es wird nichts abgelöst und nichts verdoppelt.
//
// ------------------------------------------------------------------------------------------------
// DREI DINGE WERDEN HIER ZUSÄTZLICH GEMESSEN — und jedes hat seinen belegten Anlass.
// ------------------------------------------------------------------------------------------------
//
//  (a) DIE UNABHÄNGIGE LESUNG. Jede Station wird DIREKT AM POOL nachgelesen, nicht über den Dienst,
//      der gerade geschrieben hat — und zwar der VOLLSTÄNDIGE Beitragssatz (Text, `author`,
//      `replyTo`, `koVersion`, `resolution`), nicht nur eine Anzahl. Das ist BENs Korrekturpflicht 1
//      aus `archiv/4263/runde-1/ben.md`: dort las die Stelle nur Version und Kernaussage, und ein
//      verlorener Bericht fiel niemandem auf.
//
//  (b) DER VOLLZUG JEDES KLICKS. Hinter jedem Tastendruck wird der TATSÄCHLICHE Abruf gelesen —
//      Status UND abgeschlossene Antwort (`diskussionsweg.ts`, `abrufHinter`/`mussDurchkommen`).
//      Ein Klick, der nichts auslöst, und ein 500, das als bestandener Schritt durchginge, sind die
//      beiden Löcher aus JOB 4322 R1 und JOB 4304 R2.
//
//  (c) DER APP-NEUSTART. Die Instanz wird heruntergefahren und gegen DIESELBE Datenbank neu
//      gestartet (Bauform `tests/fassungsrueckholung-echter-browser/rueckholung-pg.integration.test.ts`).
//      Ein Ergebnis, das nur im Prozessgedächtnis lebte, verschwindet hier.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WAS BEN GEFUNDEN HAT UND WAS DARAUS FOLGT.
// ------------------------------------------------------------------------------------------------
//
// BEN hat in Runde 1 das Produkt verstellt (`repo-pg.ts:426`: `koVersion` nur bei Beiträgen MIT
// `replyTo` verworfen) — und dieser Lauf blieb grün, „einschliesslich Neustart". Drei Stellen waren
// schuld, und alle drei sind hier geschlossen:
//
//   1. Der Sollwert kam aus der gelesenen Zeile. JETZT wird er MITGEFÜHRT: `fassung` beginnt bei 1
//      und bewegt sich ausschliesslich durch `ueberarbeite` — das mit `expectedVersion` schreibt,
//      also vom Server gegengezeichnet wird. Jeder Beitrag notiert seinen Sollwert VOR dem
//      Schreiben (`soll`), keiner danach.
//   2. Ein fehlendes `koVersion` wurde als `null` geglättet. JETZT wirft `alsBeitrag` beim Lesen.
//   3. Der Neustartvergleich mass gegen `nachE`, also gegen den womöglich schon unvollständigen
//      Iststand. JETZT misst er gegen den Soll-Satz — die Identität mit `nachE` kommt danach als
//      ZUSÄTZLICHE Aussage, nicht als einzige.
//
// UND DAMIT DER NACHWEIS NICHT WIEDER BLIND IST, kalibriert er sich selbst: an der Antwort, am
// Nachtrag und nach dem Neustart wird der Fassungsbezug IN DER SPALTE entfernt bzw. verstellt (mit
// dem Pool dieses Tests, das Produkt bleibt unangetastet), die Prüfung MUSS daran scheitern, und
// die Zeile wird bytegleich zurückgenommen (`kalibriereFassungsbezug`).
//
// ZWEI ÜBERARBEITUNGEN GEHÖREN DESHALB ZUM LAUF: ohne sie trügen alle drei Beiträge dieselbe
// Fassung 1, und ein Produkt, das eine feste Zahl schriebe, käme durch. So trägt der Beitrag die 1,
// die Antwort die 2 und der Nachtrag die 3 — und die älteren behalten ihre Zahl (D14-Kriterium 2:
// „Neue Beiträge mit Versions- und Antwortbezug").
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne erreichbare PostgreSQL wird der Grund
// SICHTBAR auf stderr gemeldet und übersprungen — ein stiller Skip sähe aus wie ein bestandener
// Lauf. Die Auswahlreihenfolge ist wörtlich die des Hauses nach JOB 4321 R3
// (`tests/ko/trash-tx-pg.integration.test.ts:109`): lokale URL über die Sicherung mit Vorrang —
// wurde eine ausdrücklich genannte URL abgelehnt, gibt es KEINEN stillen Container-Rückfall —,
// sonst Testcontainers, sonst ein sichtbarer Skip mit Grund. Übersprungen wird NUR die fehlende
// Voraussetzung „keine Datenbank erreichbar"; Erweiterung, Datenbank und `migrate()` laufen danach
// ungefangen und färben rot.
//
// KEINE PRODUKTIVDATEN: ausschliesslich Wegwerf-Datenbanken mit `test` im Namen, am Ende entfernt.
// KEINE PRODUKTÄNDERUNG: diese Datei misst; findet sie eine Lücke, bleibt der Fall rot.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { browserKennung, stelleFlaecheBereit } from "../fassungsrueckholung-echter-browser/weg";
import { type Browser, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  starteStrecke,
  wissensobjektAnlegen,
} from "../gast-nutzerweg/strecke";
import {
  istGleichzeitigeTrgmAnlage,
  stelleTrigrammErweiterungSicher,
} from "../office-pg-abnahme/rueckweg-erwartung";
import {
  ABSCHNITT,
  type Abruf,
  M,
  type Platz,
  T,
  anmelden,
  feldwert,
  frischesProfil,
  kalibriereSicht,
  mussDurchkommen,
  mussImFadenHaengen,
  mussSichtbar,
  oeffneDiskussion,
  schreibeAntwort,
  schreibeBeitrag,
  seitentext,
  sendeErneut,
  sichtText,
  stelleKlaerung,
  warteAuf,
  warteAufWeg,
} from "./diskussionsweg";

const JOB = "[KLARWERK] JOB 4330";

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

const EMAIL1 = "pg-fragende@diskussion-4330.test";
const EMAIL2 = "pg-antwortende@diskussion-4330.test";
const EMAIL3 = "pg-lesende@diskussion-4330.test";
const NAME1 = "Admin";
const NAME2 = "Zweite Hand";
const NAME3 = "Nur Lesen";
const TITEL = "Reinigung Spritzzone Linie 3 aus der Datenbank (JOB 4330)";

// Die drei Beitragstexte tragen unverwechselbare Marken. Sie sind das Messinstrument: ein
// `not.toContain` über einen Allerweltssatz wäre wertlos, und ein zeichengleicher Vergleich fiele
// nicht auf, wenn zwei Beiträge denselben Wortlaut trügen.
const BEITRAG_A = "ᚠᚱᚨᚷᛖ4330 Gilt die Nassreinigung auch für Linie 3?";
const ANTWORT_B = "ᚨᚾᛏᚹᛟᚱᛏ4330 Ja, seit der Umrüstung im Mai.";
const NACHTRAG_E = "ᚾᚨᚲᚺᛏᚱᚨᚷ4330 Und die Spülzeit steht im Schichtbuch.";

// Die beiden Überarbeitungen bewegen die Fassungszahl zwischen den Beiträgen — damit trägt jeder
// Beitrag eine ANDERE erwartete Fassung (1 · 2 · 3) und der Nachweis unterscheidet den gelesenen
// Bezug von einer festen Zahl. Der Titel bleibt unangetastet: an ihm erkennt die Fläche den Eintrag.
const FASSUNG_ZWEI = "Zweite Fassung: Nassreinigung auch an Linie 3, seit der Umrüstung im Mai.";
const FASSUNG_DREI = "Dritte Fassung: Spülzeiten je Schicht im Schichtbuch dokumentieren.";

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/** Die Quelle darf genannt werden, das Passwort nicht (Form aus `trash-tx-pg.integration.test.ts`). */
function ohneGeheimnis(url: string): string {
  return url.replace(/\/\/[^@/]*@/, "//<anmeldung>@");
}

// ------------------------------------------------------------------------------------------------
// DIE UNABHÄNGIGE LESUNG — der VOLLSTÄNDIGE Fadenstand, direkt aus `kos.data`.
// ------------------------------------------------------------------------------------------------

interface Beitragszeile {
  id: string;
  author: string;
  text: string;
  at: string;
  replyTo: string | null;
  /**
   * DIE FASSUNG, GEGEN DIE DIESER BEITRAG GESCHRIEBEN WURDE — und niemals `null`.
   *
   * RUNDE 2, BENs BEFUND: hier stand `number | null`, und ein fehlendes Feld wurde zu `null`
   * geglättet. Ein PostgreSQL, das den Fassungsbezug jeder Antwort verliert, kam damit durch den
   * ganzen Lauf einschliesslich Neustart (Gegenprobe des Prüfers an `repo-pg.ts:426`). Ein
   * fehlender Fassungsbezug ist kein Wert, sondern ein Fehler; er wird beim Lesen geworfen.
   */
  koVersion: number;
  resolution: { state: string; by: string; at: string } | null;
}

/**
 * DER SOLLWERT EINES GESCHRIEBENEN BEITRAGS — abgeleitet aus dem, was die Strecke getan hat, und
 * NICHT aus der Zeile, die dabei herauskam.
 *
 * Das ist BENs Korrekturpflicht 1 aus Runde 1 wörtlich: „Leite Sollwerte jedes neu geschriebenen
 * Beitrags unabhängig von seiner gespeicherten Zeile ab." Ein Vergleich des Neustartstandes mit dem
 * zuvor GELESENEN Iststand beweist nur, dass sich nichts bewegt hat — nicht, dass das Gelesene
 * fachlich vollständig war.
 */
interface Sollbeitrag {
  /** Woher dieser Beitrag stammt — steht in jeder Fehlermeldung, damit sie auf die Station zeigt. */
  station: string;
  text: string;
  author: string;
  replyTo: string | null;
  /** Die Fassung, die im Augenblick des Schreibens galt (mitgeführt, nicht zurückgelesen). */
  koVersion: number;
  /** Der Klärungsstand am Wurzelbeitrag; `null` heisst: keiner. */
  stand: string | null;
}

interface Fadenstand {
  beitraege: Beitragszeile[];
  version: number;
  /**
   * GENAU DIE FELDER, an denen sich eine heimliche Freigabe zeigen würde — dieselbe Auswahl wie
   * `tests/wiki-diskussion/klaerungsstand.test.ts:48-59`, hier als eine Zeichenkette, damit
   * „bytegleich" auch bytegleich heisst.
   */
  freigabe: string;
}

function alsBeitrag(roh: Record<string, unknown>, wo: string, nr: number): Beitragszeile {
  const aufloesung = roh.resolution as { state: string; by: string; at: string } | undefined;
  const id = String(roh.id ?? "");
  const fassung = roh.koVersion;
  // KEINE GLÄTTUNG. Fehlt der Fassungsbezug oder ist er keine Zahl, endet die Lesung hier — sonst
  // trüge der Vergleich weiter unten ein `null` gegen ein `null` und bliebe grün.
  if (typeof fassung !== "number" || !Number.isFinite(fassung)) {
    throw new Error(
      `${JOB}: ${wo} · Beitrag ${id === "" ? `#${nr}` : id}: koVersion fehlt — in der Spalte steht statt einer Fassungszahl ${JSON.stringify(fassung ?? null)}.`,
    );
  }
  return {
    id,
    author: String(roh.author ?? ""),
    text: String(roh.text ?? ""),
    at: String(roh.at ?? ""),
    replyTo: roh.replyTo === undefined ? null : String(roh.replyTo),
    koVersion: fassung,
    resolution: aufloesung
      ? { state: String(aufloesung.state), by: String(aufloesung.by), at: String(aufloesung.at) }
      : null,
  };
}

/**
 * Der Stand, wie er WIRKLICH in der Spalte liegt.
 *
 * Nicht über `GET /api/kos/:id` und nicht über die Antwort des Schreibvorgangs: beide kämen aus dem
 * Dienst, der gerade geschrieben hat. Gelesen wird die Zeile selbst, mit einem eigenen Pool.
 */
async function liesFaden(pool: Pool, koId: string, wo: string): Promise<Fadenstand> {
  const res = await pool.query<{ data: Record<string, unknown> }>(
    "SELECT data FROM kos WHERE id = $1",
    [koId],
  );
  expect(res.rowCount, `${JOB}: ${wo} · in der Spalte steht keine Zeile zu ${koId}`).toBe(1);
  const daten = res.rows[0]?.data as Record<string, unknown>;
  const beitraege = (daten.comments ?? []) as Record<string, unknown>[];
  return {
    beitraege: beitraege.map((roh, i) => alsBeitrag(roh, wo, i + 1)),
    version: Number(daten.version),
    freigabe: JSON.stringify({
      status: daten.status,
      version: daten.version,
      trust: daten.trust,
      confidence: daten.confidence,
      neededValidations: daten.neededValidations,
      assignments: daten.assignments,
      ownership: daten.ownership,
      history: daten.history,
    }),
  };
}

/**
 * DER GELESENE STAND GEGEN DEN SOLL-SATZ — Feld für Feld, mit Namen an jeder Abweichung.
 *
 * `fassung` ist die mitgeführte Fassungszahl des Objekts: sie bewegt sich AUSSCHLIESSLICH durch
 * eine Überarbeitung (`service.ts:4374`), nie durch einen Beitrag, einen Klärungsstand oder das
 * Umstufen der Vertraulichkeit. Steht in der Spalte eine andere, hat einer dieser Wege heimlich
 * eine neue Fassung erzeugt.
 */
function pruefeSoll(
  gelesen: Fadenstand,
  soll: readonly Sollbeitrag[],
  fassung: number,
  wo: string,
): void {
  expect(
    gelesen.beitraege.length,
    `${JOB}: ${wo} · in der Spalte stehen ${gelesen.beitraege.length} Beiträge, erwartet waren ${soll.length}`,
  ).toBe(soll.length);
  expect(
    gelesen.version,
    `${JOB}: ${wo} · das Objekt steht auf Fassung ${gelesen.version}, erwartet war ${fassung} — nur eine Überarbeitung darf diese Zahl bewegen`,
  ).toBe(fassung);
  gelesen.beitraege.forEach((ist, i) => {
    const s = soll[i] as Sollbeitrag;
    const wer = `${wo} · Beitrag ${i + 1} („${s.station}")`;
    expect(ist.text, `${JOB}: ${wer} · der Text steht nicht zeichengleich in der Spalte`).toBe(
      s.text,
    );
    expect(ist.author, `${JOB}: ${wer} · hängt am falschen Konto`).toBe(s.author);
    expect(
      ist.replyTo,
      `${JOB}: ${wer} · Antwortbezug erwartet ${JSON.stringify(s.replyTo)}, gefunden ${JSON.stringify(ist.replyTo)}`,
    ).toBe(s.replyTo);
    // DIE STELLE, AN DER RUNDE 1 BLIND WAR.
    expect(
      ist.koVersion,
      `${JOB}: ${wer} · Fassungsbezug (koVersion) erwartet ${s.koVersion} — die Fassung, die beim Schreiben galt —, gefunden ${ist.koVersion}`,
    ).toBe(s.koVersion);
    expect(
      ist.resolution?.state ?? null,
      `${JOB}: ${wer} · Klärungsstand erwartet ${JSON.stringify(s.stand)}, gefunden ${JSON.stringify(ist.resolution?.state ?? null)}`,
    ).toBe(s.stand);
  });
}

// ------------------------------------------------------------------------------------------------
// DIE KALIBRIERUNG DES FASSUNGSBEZUGS — ohne eine einzige Produktänderung.
// ------------------------------------------------------------------------------------------------
//
// BEN hat in Runde 1 das Produkt verstellt (`repo-pg.ts:426`) und gezeigt, dass dieser Lauf davon
// nichts merkte. Die Lehre daraus gehört in den Lauf selbst: die Verstellung wird HIER erzeugt —
// in der Spalte, mit dem Pool dieses Tests, bei unangetastetem Produkt — und der unveränderte
// Nachweis MUSS daran scheitern, benannt nach Station und Beitrag. Danach wird sie BYTEGLEICH
// zurückgenommen (`data::text` vorher/nachher) und der Nachweis steht wieder.
//
// Das ist dieselbe Form wie `kalibriereSicht` in `diskussionsweg.ts`, nur eine Schicht tiefer: dort
// wird ein Element ausgeblendet, hier ein Feld der Zeile. Beides läuft in JEDEM Lauf mit; eine
// Kalibrierung, die nur einmal von Hand gefahren wurde, schützt die nächste Runde nicht.
type Verstellung = "entfernt" | "verstellt";

/** Die Zeile, wie PostgreSQL sie zurückgibt — Zeichen für Zeichen, für den Bytevergleich. */
async function rohZeile(pool: Pool, koId: string): Promise<string> {
  const res = await pool.query<{ data: string }>(
    "SELECT data::text AS data FROM kos WHERE id = $1",
    [koId],
  );
  expect(res.rowCount, `${JOB}: für die Kalibrierung steht keine Zeile zu ${koId}`).toBe(1);
  return String(res.rows[0]?.data ?? "");
}

/** Eine Fassungszahl, die keine der gefahrenen Fassungen ist — sonst bliebe „verstellt" wirkungslos. */
const FALSCHE_FASSUNG = 99;

async function kalibriereFassungsbezug(
  pool: Pool,
  koId: string,
  index: number,
  art: Verstellung,
  wo: string,
  pruefung: () => Promise<void>,
): Promise<string> {
  const vorher = await rohZeile(pool, koId);
  if (art === "entfernt") {
    await pool.query(
      "UPDATE kos SET data = jsonb_set(data, ARRAY['comments', $2::text], (data->'comments'->$3::int) - 'koVersion') WHERE id = $1",
      [koId, String(index), index],
    );
  } else {
    await pool.query(
      "UPDATE kos SET data = jsonb_set(data, ARRAY['comments', $2::text, 'koVersion'], to_jsonb($3::int)) WHERE id = $1",
      [koId, String(index), FALSCHE_FASSUNG],
    );
  }
  const verstellt = await rohZeile(pool, koId);
  expect(
    verstellt,
    `${JOB}: KALIBRIERUNG ${wo} (${art}) — die Verstellung hat die Zeile gar nicht verändert`,
  ).not.toBe(vorher);
  let gefangen: unknown;
  try {
    await pruefung();
  } catch (fehler) {
    gefangen = fehler;
  }
  // ZUERST ZURÜCKNEHMEN, dann urteilen: ein Fehlschlag der Kalibrierung darf den Faden nicht
  // verstellt zurücklassen und alle folgenden Stationen mitreissen.
  await pool.query("UPDATE kos SET data = $2::jsonb WHERE id = $1", [koId, vorher]);
  const nachher = await rohZeile(pool, koId);
  expect(nachher, `${JOB}: KALIBRIERUNG ${wo} (${art}) — die Rücknahme ist nicht bytegleich`).toBe(
    vorher,
  );
  expect(
    gefangen,
    `${JOB}: KALIBRIERUNG ${wo} (${art}) — der Nachweis blieb GRÜN, obwohl der Fassungsbezug von Beitrag ${index + 1} in der Spalte ${art} war. Genau das war BENs Gegenprobe aus Runde 1.`,
  ).toBeDefined();
  const meldung = String((gefangen as { message?: string })?.message ?? gefangen);
  expect(
    meldung,
    `${JOB}: KALIBRIERUNG ${wo} (${art}) — die Meldung nennt die Station nicht: ${meldung}`,
  ).toContain(wo);
  expect(
    meldung,
    `${JOB}: KALIBRIERUNG ${wo} (${art}) — die Meldung nennt den Fassungsbezug nicht: ${meldung}`,
  ).toMatch(/koVersion/);
  // Und nach der Rücknahme steht der Nachweis wieder — sonst hätte die Kalibrierung etwas kaputt
  // gemacht, statt etwas zu zeigen.
  await pruefung();
  return `${JOB} · KALIBRIERUNG ${wo} (${art}, Beitrag ${index + 1}) → rot: ${meldung.split("\n")[0]}`;
}

/**
 * EINE ECHTE ÜBERARBEITUNG ÜBER DEN PRODUKTWEG — der einzige Weg, der die Fassungszahl bewegt.
 *
 * Sie ist kein Schritt des gemessenen Diskussionsweges, sondern die Lage, in der er gemessen wird:
 * ohne sie trügen alle drei Beiträge dieselbe 1, und ein Produkt, das eine feste Zahl schriebe,
 * käme durch. `expectedVersion` ist dabei der bedingte Schreibzugriff (`ko-routes.ts:2428`) — wäre
 * die mitgeführte Fassung falsch, lehnte der Server hier ab. Der Sollwert ist damit nicht geraten,
 * sondern vom Server gegengezeichnet, und zwar BEVOR der nächste Beitrag geschrieben wird.
 */
async function ueberarbeite(
  admin: Sitzung,
  koId: string,
  bisher: number,
  satz: string,
): Promise<number> {
  const antwort = await admin.sende("PUT", `/api/kos/${koId}`, {
    action: "revise",
    expectedVersion: bisher,
    changes: { statement: satz },
  });
  expect(
    antwort.status,
    `${JOB}: die Überarbeitung von Fassung ${bisher} auf ${bisher + 1} misslang: ${antwort.text}`,
  ).toBe(200);
  expect(
    (antwort.json as { version?: number }).version,
    `${JOB}: die Überarbeitung meldet nicht die Fassung ${bisher + 1}`,
  ).toBe(bisher + 1);
  return bisher + 1;
}

/** Die Rolle, wie sie in der Datenbank steht — nicht die aus der Antwort von eben. */
async function rolleAmPool(pool: Pool, email: string): Promise<string> {
  const res = await pool.query<{ role: string }>("SELECT role FROM users WHERE email = $1", [
    email,
  ]);
  return res.rows[0]?.role ?? "(kein Konto)";
}

/** Der lokalisierte Kalendertag, wie ihn das Produkt schreibt (`toLocaleDateString(i18n.language)`). */
function tagAnzeige(zeitpunkt: string): string {
  return new Date(zeitpunkt).toLocaleDateString("de");
}

type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

describe("JOB 4330 D · der Faden am Dokument, gegen echtes PostgreSQL im echten Browser", () => {
  let verwaltung: Pool | undefined;
  let container: StartedTestContainer | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let laufzustand: Laufzustand | undefined;
  let pgFassung = "(nicht gelesen)";
  let chromiumFassung = "(nicht gestartet)";
  let flaeche = "nicht hergestellt";
  let gemeldet = false;
  const stempel = `${Date.now()}`.slice(-9);
  const fadenDb = `klarwerk_diskussion_test_${stempel}`;
  const aufbauDb = `klarwerk_diskussionaufbau_test_${stempel}`;
  const protokoll: string[] = [];

  /** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — nie beides und nie keines. */
  function meldeLaufzustand(): void {
    if (gemeldet) {
      return;
    }
    gemeldet = true;
    if (!laufzustand) {
      process.stderr.write(`${JOB}: KEIN LAUFZUSTAND — beforeAll lief nicht durch.\n`);
    } else if (laufzustand.gelaufen) {
      process.stderr.write(`${JOB} GELAUFEN gegen ${laufzustand.quelle}.\n`);
    } else {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN — Grund: ${laufzustand.grund}. Die fünf Stationen, der Neustart und die unabhängige Lesung wurden NICHT geprüft.\n`,
      );
    }
  }

  beforeAll(async () => {
    let url = "";
    let quelle = "";
    let grund = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
      quelle = `lokale Testinstanz · ${ohneGeheimnis(lokal)}`;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = `Testcontainer postgres:16-alpine · ${ohneGeheimnis(url)}`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (url) {
      verwaltung = new Pool({ connectionString: url });
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Fehler fliegt und färbt rot.
        const wer = await verwaltung.query<{ version: string }>("SELECT version() AS version");
        pgFassung = wer.rows[0]?.version ?? "(PostgreSQL-Version nicht lesbar)";
        await verwaltung.query(`CREATE DATABASE ${fadenDb}`);
        await verwaltung.query(`CREATE DATABASE ${aufbauDb}`);
        verbindung = zerlege(url);
        if (!verbindung) {
          throw new Error(`${JOB}: die Testdatenbank-URL nennt keinen Rechnernamen.`);
        }
        flaeche = stelleFlaecheBereit();
        browser = await starteChromium();
        chromiumFassung = browserKennung(browser);
        laufzustand = { gelaufen: true, quelle };
      }
    }
    if (!laufzustand) {
      laufzustand = { gelaufen: false, grund };
    }
    meldeLaufzustand();
  }, 1_800_000);

  afterAll(async () => {
    await browser?.close();
    for (const name of [fadenDb, aufbauDb]) {
      await verwaltung
        ?.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
        .catch(() => undefined);
    }
    await verwaltung?.end();
    await container?.stop();
    if (protokoll.length > 0) {
      process.stderr.write(`${JOB} · PROTOKOLL DER STATIONEN:\n${protokoll.join("\n")}\n`);
    }
  }, 180_000);

  function requireLauf(ctx: { skip: () => void }): { pool: Pool; browser: Browser } {
    if (!laufzustand?.gelaufen || !verbindung || !browser) {
      meldeLaufzustand(); // kein Skip ohne sichtbaren Grund
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return { pool: createPool(pgUrl(verbindung, fadenDb)), browser };
  }

  // ----------------------------------------------------------------------------------------------
  // D0 · DER ZEUGE — er ruft nie `requireLauf` und macht in JEDEM Lauf eine Aussage.
  // ----------------------------------------------------------------------------------------------
  // Er färbt eine Maschine ohne Datenbank NICHT rot: beide Zustände sind erlaubt. Verlangt ist nur,
  // dass der Lauf sagt, welcher vorliegt. Ohne ihn sind „gemessen" und „übersprungen" dasselbe Bild.
  it("D0 · der Lauf bezeugt seinen eigenen Zustand — übersprungen ist von gelaufen unterscheidbar", () => {
    meldeLaufzustand();
    expect(laufzustand, `${JOB}: beforeAll hat keinen Laufzustand hinterlassen`).toBeDefined();
    const z = laufzustand as Laufzustand;
    if (z.gelaufen) {
      expect(z.quelle.length, `${JOB}: „gelaufen" ohne benannte Quelle`).toBeGreaterThan(0);
      expect(browser, `${JOB}: „gelaufen", aber kein Browser`).toBeDefined();
    } else {
      expect(z.grund.length, `${JOB}: „übersprungen" ohne benannten Grund`).toBeGreaterThan(0);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // D1 · DER GEMEINSAME ERSTAUFBAU IST KONKURRENZFEST (Lieferung 2).
  // ----------------------------------------------------------------------------------------------
  //
  // Die Promptverbesserung aus JOB 4321 R1 wörtlich: „Eigene Schemata isolieren keine
  // datenbankweiten Erweiterungen. Prüfe den gemeinsamen Erstaufbau auf einer frischen Datenbank mit
  // gezielt überlappenden Initialisierungen; `IF NOT EXISTS` allein gilt nicht als
  // Konkurrenznachweis."
  //
  // WAS HIER GEMEINSAM IST UND WAS NICHT — gemessen am eigenen Aufbau, nicht vermutet. Jede
  // Wegwerf-Datenbank dieses Laufs gehört ihr allein; `migrate()` läuft darin genau einmal. Das
  // einzige Ding, das sich NICHT durch eine eigene Datenbank und erst recht nicht durch ein eigenes
  // Schema isolieren lässt, ist `pg_extension`: es ist datenbankweit, und `KO_SCHEMA` legt `pg_trgm`
  // mit `IF NOT EXISTS` an. Genau dort lag der Abbruch aus JOB 4321 R1, und genau dort wird hier
  // überlappt.
  it("D1 · vier gleichzeitige Erstaufbauten auf einer frischen Datenbank — und der Fehler, den sie überstehen, ist real", async (ctx) => {
    if (!laufzustand?.gelaufen || !verbindung) {
      meldeLaufzustand();
      ctx.skip();
      return;
    }
    const pools = [0, 1, 2, 3].map(() => createPool(pgUrl(verbindung as Verbindung, aufbauDb)));
    try {
      // ── GEZIELT ÜBERLAPPEND: vier Sitzungen, ein Augenblick, dieselbe frische Datenbank. ──────
      const ergebnisse = await Promise.allSettled(
        pools.map((p) => stelleTrigrammErweiterungSicher(p)),
      );
      const gescheitert = ergebnisse
        .map((e, i) => (e.status === "rejected" ? `#${i}: ${String(e.reason)}` : ""))
        .filter((s) => s !== "");
      expect(
        gescheitert,
        `${JOB}: der gemeinsame Erstaufbau hat einen gleichzeitigen Aufrufer verloren`,
      ).toEqual([]);
      const wieOft = await (pools[0] as Pool).query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM pg_extension WHERE extname = 'pg_trgm'",
      );
      expect(
        wieOft.rows[0]?.anzahl,
        `${JOB}: pg_trgm liegt nicht genau einmal in der Datenbank`,
      ).toBe("1");

      // ── DIE KALIBRIERUNG: die Fehlerklasse, die der Schutz auffängt, ist auf DIESEM Server real.
      //
      // Ohne sie wäre „konkurrenzfest" nur die Beobachtung, dass heute nichts schiefging — und
      // genau das ist der Satz „`IF NOT EXISTS` allein gilt nicht als Konkurrenznachweis". Die
      // nackte Anweisung trifft denselben eindeutigen Index (`pg_extension_name_index`), auf den
      // auch zwei gleichzeitige Anlagen laufen; der Schutz erkennt ihren Code als überholte Anlage.
      let roherFehler: unknown;
      try {
        await (pools[1] as Pool).query("CREATE EXTENSION pg_trgm");
      } catch (fehler) {
        roherFehler = fehler;
      }
      expect(
        roherFehler,
        `${JOB}: KALIBRIERUNG — die nackte Anlage lief durch, obwohl pg_trgm schon liegt. Dann misst D1 nichts.`,
      ).toBeDefined();
      expect(
        (roherFehler as { code?: string }).code,
        `${JOB}: KALIBRIERUNG — die nackte Anlage scheiterte an etwas anderem als „gibt es schon": ${String(roherFehler)}`,
      ).toBe("42710");
      expect(
        istGleichzeitigeTrgmAnlage(roherFehler),
        `${JOB}: KALIBRIERUNG — der Schutz erkennt genau diesen Fehler nicht als überholte Anlage`,
      ).toBe(true);

      // ── UND DER RESTLICHE AUFBAU TRÄGT DARAUF AUF. ───────────────────────────────────────────
      await migrate(pools[0] as Pool);
      const tabellen = await (pools[0] as Pool).query<{ kos: string | null; users: string | null }>(
        "SELECT to_regclass('public.kos')::text AS kos, to_regclass('public.users')::text AS users",
      );
      expect(
        [tabellen.rows[0]?.kos, tabellen.rows[0]?.users],
        `${JOB}: nach dem Erstaufbau fehlen Tabellen auf der frischen Datenbank`,
      ).toEqual(["kos", "users"]);
    } finally {
      for (const p of pools) {
        await p.end().catch(() => undefined);
      }
    }
  }, 300_000);

  // ----------------------------------------------------------------------------------------------
  // D2 · DER GANZE FADEN — fünf Stationen, ein Neustart, eine unabhängige Lesung.
  // ----------------------------------------------------------------------------------------------
  it("D2 · Beitrag, Antwort, Erledigen, Wiederöffnen und der Wiederholungsweg — im echten Browser, nachgelesen in der Spalte, über einen Neustart hinweg", async (ctx) => {
    const { pool, browser: chrom } = requireLauf(ctx);
    const tastatur: Record<string, number> = {};
    const plaetze: Platz[] = [];
    let strecke: Strecke | undefined;
    let nachNeustart: Strecke | undefined;
    const melde = (station: string, basis: string, anzahl: number, stand: string): void => {
      const zeile = `${JOB} · Chromium ${chromiumFassung} · Socket ${basis.replace(/^https?:\/\//, "")} · PostgreSQL ${pgFassung} · Station ${station} · Beiträge ${anzahl} · Stand ${stand}`;
      protokoll.push(zeile);
      process.stderr.write(`${zeile}\n`);
    };
    try {
      process.stderr.write(`${JOB} D2 läuft · Fläche: ${flaeche}\n`);
      await stelleTrigrammErweiterungSicher(pool);
      await migrate(pool);
      strecke = await starteStrecke({ pool, ...mitFlaeche() });
      const basis = strecke.basis;

      // ══ DIE KONTEN — über den echten Produktweg, und in der Datenbank nachgelesen. ═══════════
      const erst = await ersteinrichtung(strecke, EMAIL1);
      const adminApi: Sitzung = erst.sitzung;
      const idEins = erst.admin.id;
      const zweite = await gastAnlegen(adminApi, { name: NAME2, email: EMAIL2, role: "experte" });
      expect(zweite.status, zweite.text).toBe(201);
      const idZwei = (zweite.json as { id: string }).id;
      const dritte = await gastAnlegen(adminApi, { name: NAME3, email: EMAIL3, role: "viewer" });
      expect(dritte.status, dritte.text).toBe(201);
      expect(
        [
          await rolleAmPool(pool, EMAIL1),
          await rolleAmPool(pool, EMAIL2),
          await rolleAmPool(pool, EMAIL3),
        ],
        `${JOB}: die Rollen stehen nicht so in der Datenbank, wie sie über den Produktweg gesetzt wurden`,
      ).toEqual(["admin", "experte", "viewer"]);

      const koId = await wissensobjektAnlegen(adminApi, TITEL);
      // ══ DIE MITGEFÜHRTE FASSUNG UND DER SOLL-SATZ ════════════════════════════════════════════
      //
      // Ab hier steht neben dem Lauf eine zweite, unabhängige Buchführung: `fassung` (die Zahl,
      // die beim Anlegen 1 ist und sich nur durch `ueberarbeite` bewegt) und `soll` (was JEDER
      // Beitrag tragen muss). Kein Sollwert wird je aus einer gelesenen Zeile übernommen.
      let fassung = 1;
      const soll: Sollbeitrag[] = [];
      const start = await liesFaden(pool, koId, "Ausgangslage");
      expect(start.beitraege, `${JOB}: das frische Wissensobjekt trägt schon Beiträge`).toEqual([]);
      expect(
        start.version,
        `${JOB}: ein frisch angelegtes Wissensobjekt steht nicht auf Fassung 1`,
      ).toBe(fassung);

      // ══ STATION (a) · BEITRAG ════════════════════════════════════════════════════════════════
      const eins = await frischesProfil(chrom);
      plaetze.push(eins);
      expect(
        (await eins.kontext.cookies()).some((k) => k.name === "kw_session"),
        `${JOB}: ein frisches Profil trägt bereits einen Sitzungskeks`,
      ).toBe(false);
      await anmelden(eins.seite, basis, EMAIL1, "k1", tastatur);
      await oeffneDiskussion(eins.seite, basis, koId, TITEL, "k1", tastatur);
      // §9 „leer": der Leersatz steht da, und zwar sichtbar — nicht bloss im DOM.
      await mussSichtbar(eins.seite, ABSCHNITT, T("ko.commentsEmpty"), "Station a · der Leersatz");

      // DER SOLLWERT WIRD VOR DEM SCHREIBEN NOTIERT, nicht danach abgelesen: es gilt die Fassung,
      // die in DIESEM Augenblick steht.
      soll.push({
        station: "a · Beitrag",
        text: BEITRAG_A,
        author: idEins,
        replyTo: null,
        koVersion: fassung,
        stand: null,
      });
      mussDurchkommen(
        await schreibeBeitrag(eins, BEITRAG_A, "k1", tastatur),
        "Station a · Beitrag",
      );
      const nachA = await liesFaden(pool, koId, "Station a");
      pruefeSoll(nachA, soll, fassung, "Station a");
      expect(
        nachA.beitraege,
        `${JOB}: Station a hat nicht genau einen Beitrag hinterlassen`,
      ).toHaveLength(1);
      const frage = nachA.beitraege[0] as Beitragszeile;
      const frageId = frage.id;
      expect(frageId.length, `${JOB}: Station a · der Beitrag hat keine Kennung`).toBeGreaterThan(
        0,
      );
      expect(frage.author, `${JOB}: Station a · der Beitrag hängt am falschen Konto`).toBe(idEins);
      expect(
        frage.text,
        `${JOB}: Station a · der Text steht nicht zeichengleich in der Spalte`,
      ).toBe(BEITRAG_A);
      expect(
        frage.koVersion,
        `${JOB}: Station a · der Fassungsbezug ist nicht die beim Schreiben geltende Fassung ${fassung}`,
      ).toBe(fassung);
      expect(
        frage.resolution,
        `${JOB}: Station a · der frische Beitrag trägt schon einen Stand`,
      ).toBeNull();
      expect(
        Number.isNaN(Date.parse(frage.at)),
        `${JOB}: Station a · der Zeitpunkt „${frage.at}" ist keiner`,
      ).toBe(false);
      await warteAuf(
        eins.seite,
        M.beitrag(frageId),
        "Station a · der Beitrag steht auf der Fläche",
      );
      await kalibriereSicht(eins.seite, M.beitrag(frageId), BEITRAG_A, "Station a · der Beitrag");
      melde("a", basis, nachA.beitraege.length, "offen");

      // ══ DAS DOKUMENT WIRD ÜBERARBEITET — die Fassung zieht weiter, der alte Bezug bleibt ═════
      //
      // Ohne diesen Schritt trügen alle drei Beiträge dieselbe 1, und „der Fassungsbezug stimmt"
      // hiesse nur „es steht irgendeine Zahl da". Gemessen wird beides: der ALTE Beitrag behält
      // seine 1 (historische Tatsache, `versionsbezug.test.ts:56-59` — hier gegen echtes
      // PostgreSQL), und der NÄCHSTE trägt die neue Zahl.
      fassung = await ueberarbeite(adminApi, koId, fassung, FASSUNG_ZWEI);
      pruefeSoll(
        await liesFaden(pool, koId, "nach der ersten Überarbeitung"),
        soll,
        fassung,
        "nach der ersten Überarbeitung",
      );

      // ══ STATION (b) · ANTWORT, im FRISCHEN Browserkontext ════════════════════════════════════
      const zwei = await frischesProfil(chrom);
      plaetze.push(zwei);
      expect(
        (await zwei.kontext.cookies()).some((k) => k.name === "kw_session"),
        `${JOB}: das zweite Profil hat etwas vom ersten geerbt`,
      ).toBe(false);
      await anmelden(zwei.seite, basis, EMAIL2, "k2", tastatur);
      await oeffneDiskussion(zwei.seite, basis, koId, TITEL, "k2", tastatur);
      await mussSichtbar(
        zwei.seite,
        M.beitrag(frageId),
        BEITRAG_A,
        "Station b · der Zweite sieht den Beitrag des Ersten",
      );

      soll.push({
        station: "b · Antwort",
        text: ANTWORT_B,
        author: idZwei,
        replyTo: frageId,
        koVersion: fassung,
        stand: null,
      });
      mussDurchkommen(
        await schreibeAntwort(zwei, frageId, ANTWORT_B, "k2", tastatur),
        "Station b · Antwort",
      );
      const nachB = await liesFaden(pool, koId, "Station b");
      pruefeSoll(nachB, soll, fassung, "Station b");
      expect(
        nachB.beitraege,
        `${JOB}: Station b hat keinen zweiten Beitrag hinterlassen`,
      ).toHaveLength(2);
      const antwort = nachB.beitraege[1] as Beitragszeile;
      expect(
        antwort.koVersion,
        `${JOB}: Station b · die Antwort trägt nicht die beim Schreiben geltende Fassung ${fassung}`,
      ).toBe(fassung);
      expect(antwort.id, `${JOB}: Station b · die Antwort trägt keine frische Kennung`).not.toBe(
        frageId,
      );
      expect(antwort.replyTo, `${JOB}: Station b · der Antwortbezug fehlt in der Spalte`).toBe(
        frageId,
      );
      expect(antwort.author, `${JOB}: Station b · die Antwort hängt am falschen Konto`).toBe(
        idZwei,
      );
      expect(antwort.text, `${JOB}: Station b · der Antworttext steht nicht zeichengleich da`).toBe(
        ANTWORT_B,
      );
      expect(nachB.beitraege[0], `${JOB}: Station b hat den ersten Beitrag verändert`).toEqual(
        frage,
      );
      await warteAuf(
        zwei.seite,
        M.beitrag(antwort.id),
        "Station b · die Antwort steht auf der Fläche",
      );
      // DER FADEN: Enthaltensein, nicht Reihenfolge (H1).
      await mussImFadenHaengen(zwei.seite, frageId, antwort.id);
      // Und die Kalibrierung trifft das TEXTTRAGENDE KIND, während der Container stehen bleibt:
      // ein sichtbarer Faden belegt nicht, dass jede seiner Zeilen sichtbar ist (JOB 4295 R3).
      await kalibriereSicht(
        zwei.seite,
        M.beitrag(frageId),
        ANTWORT_B,
        "Station b · die Antwort im Faden",
        M.beitrag(antwort.id),
      );
      // ══ KALIBRIERUNG (a) · DER FASSUNGSBEZUG DER ANTWORT ════════════════════════════════════
      //
      // BENs Gegenprobe aus Runde 1, hier im Lauf selbst und ohne Produktänderung: erst das Feld
      // ENTFERNT (sein Fall), dann auf eine falsche Zahl VERSTELLT (der stille Fall, den ein
      // blosses „ist vorhanden" nicht fände). Beide Male muss Station b rot werden.
      for (const art of ["entfernt", "verstellt"] as const) {
        protokoll.push(
          await kalibriereFassungsbezug(pool, koId, 1, art, "Station b", async () => {
            pruefeSoll(await liesFaden(pool, koId, "Station b"), soll, fassung, "Station b");
          }),
        );
      }
      melde("b", basis, nachB.beitraege.length, "offen");

      // ══ STATION (c) · ERLEDIGT — und die Freigabe bewegt sich NICHT ══════════════════════════
      const freigabeVorher = nachB.freigabe;
      mussDurchkommen(
        await stelleKlaerung(eins, frageId, "erledigt", "k1", tastatur),
        "Station c · erledigt",
      );
      (soll[0] as Sollbeitrag).stand = "erledigt";
      const nachC = await liesFaden(pool, koId, "Station c");
      pruefeSoll(nachC, soll, fassung, "Station c");
      const standC = (nachC.beitraege[0] as Beitragszeile).resolution;
      expect(standC?.state, `${JOB}: Station c · der Faden steht nicht auf erledigt`).toBe(
        "erledigt",
      );
      expect(standC?.by, `${JOB}: Station c · der Urheber des Standes stimmt nicht`).toBe(idEins);
      expect(
        Number.isNaN(Date.parse(String(standC?.at))),
        `${JOB}: Station c · der Zeitpunkt des Standes ist keiner`,
      ).toBe(false);
      // D14-KRITERIUM 3: „ohne fachliche Freigabe vorzutäuschen" — bytegleich, nicht „ähnlich".
      expect(
        nachC.freigabe,
        `${JOB}: Station c · das Erledigen hat den fachlichen Freigabestand des Objekts bewegt`,
      ).toBe(freigabeVorher);
      expect(nachC.beitraege, `${JOB}: Station c hat die Beitragszahl verändert`).toHaveLength(2);
      await warteAuf(eins.seite, M.klaerung(frageId), "Station c · der Erledigt-Vermerk erscheint");
      const vermerkC = T("ko.diskussion.erledigtVon", {
        name: NAME1,
        datum: tagAnzeige(String(standC?.at)),
      });
      await kalibriereSicht(
        eins.seite,
        M.klaerung(frageId),
        vermerkC,
        "Station c · der Erledigt-Vermerk mit Urheber",
      );
      // DER WORTLAUT: geklärt, nie freigegeben oder geprüft (`sprachen.test.ts`, H3b).
      expect(
        (await sichtText(eins.seite, M.klaerung(frageId)))?.toLowerCase() ?? "",
        `${JOB}: Station c · der Vermerk behauptet eine fachliche Freigabe`,
      ).not.toMatch(/freigegeben|freigabe|geprüft|validiert/);
      melde("c", basis, nachC.beitraege.length, "erledigt");

      // ══ DIE ZWEITE ÜBERARBEITUNG — damit der Nachtrag aus Station e eine DRITTE Fassung trägt ═
      //
      // Sie liegt bewusst NACH dem Freigabevergleich von Station c (der prüft bytegleich zwischen
      // b und c) und VOR dem erneuten Öffnen der Fläche in Station d, damit der Zweite mit einem
      // frisch geladenen Stand weiterarbeitet.
      fassung = await ueberarbeite(adminApi, koId, fassung, FASSUNG_DREI);
      pruefeSoll(
        await liesFaden(pool, koId, "nach der zweiten Überarbeitung"),
        soll,
        fassung,
        "nach der zweiten Überarbeitung",
      );

      // ══ STATION (d) · WIEDER OFFEN — durch einen ANDEREN Menschen ════════════════════════════
      //
      // Der Zweite lädt die Seite neu (sein Browser weiss vom Stand des Ersten nichts) und öffnet
      // den Faden wieder. Ein anderer Urheber ist Absicht: nur so belegt `resolution.by`, dass der
      // Stand am Handelnden hängt und nicht an einer festen Zeichenkette.
      await oeffneDiskussion(zwei.seite, basis, koId, TITEL, "k2b", tastatur);
      await mussSichtbar(
        zwei.seite,
        M.klaerung(frageId),
        vermerkC,
        "Station d · der Zweite sieht den Erledigt-Vermerk",
      );
      mussDurchkommen(
        await stelleKlaerung(zwei, frageId, "offen", "k2", tastatur),
        "Station d · wieder offen",
      );
      (soll[0] as Sollbeitrag).stand = "offen";
      const nachD = await liesFaden(pool, koId, "Station d");
      pruefeSoll(nachD, soll, fassung, "Station d");
      const standD = (nachD.beitraege[0] as Beitragszeile).resolution;
      expect(standD?.state, `${JOB}: Station d · der Faden steht nicht wieder auf offen`).toBe(
        "offen",
      );
      expect(standD?.by, `${JOB}: Station d · der Urheber des Standes ist nicht der Zweite`).toBe(
        idZwei,
      );
      expect(
        Date.parse(String(standD?.at)) >= Date.parse(String(standC?.at)),
        `${JOB}: Station d · der neue Stand trägt einen älteren Zeitpunkt als der alte`,
      ).toBe(true);
      // BEIDE BEITRÄGE UNVERÄNDERT — Feld für Feld, nicht nur der Anzahl nach.
      expect(nachD.beitraege, `${JOB}: Station d hat die Beitragszahl verändert`).toHaveLength(2);
      expect(nachD.beitraege[1], `${JOB}: Station d hat die Antwort verändert`).toEqual(antwort);
      expect(
        { ...(nachD.beitraege[0] as Beitragszeile), resolution: null },
        `${JOB}: Station d hat am Wurzelbeitrag mehr als den Stand verändert`,
      ).toEqual({ ...frage, resolution: null });
      melde("d", basis, nachD.beitraege.length, "offen");

      // ══ STATION (e) · DIE REALE FEHLERANTWORT UND DER WIEDERHOLUNGSWEG ═══════════════════════
      //
      // DIE LAGE WIRD ÜBER DEN WEG DES PRODUKTS HERGESTELLT, nicht durch Verstellen einer Datei:
      // der Erste stuft das Dokument auf „vertraulich" (`PUT /api/kos/:id {action:"confidentiality"}`).
      // Für den Zweiten — Experte, nicht Verfasser — ist es damit nicht mehr sichtbar, und JEDE
      // Diskussionsaktion antwortet mit 404 (`tests/wiki-diskussion/zugriff-entzogen.test.ts:45`).
      // Das Umstufen ist KEIN Schritt des gemessenen Weges, sondern die Lage, in der er gemessen
      // wird; es läuft deshalb über die API-Sitzung des Ersten und nicht über seine Fläche.
      const zu = await adminApi.sende("PUT", `/api/kos/${koId}`, {
        action: "confidentiality",
        level: "vertraulich",
      });
      expect(zu.status, `${JOB}: Station e · das Umstufen misslang: ${zu.text}`).toBe(200);

      const gescheiterteAbrufe = await schreibeAntwort(zwei, frageId, NACHTRAG_E, "k2e", tastatur);
      expect(gescheiterteAbrufe.length, `${JOB}: Station e · kein Abruf hinter dem Absenden`).toBe(
        1,
      );
      const abgewiesen = gescheiterteAbrufe[0] as Abruf;
      expect(
        `${abgewiesen.status} · ${abgewiesen.abschluss}`,
        `${JOB}: Station e · erwartet war die reale Abweisung des Servers, gekommen ist: ${abgewiesen.rumpf}`,
      ).toBe("404 · abgeschlossen");
      // DER SATZ DES SERVERS wird aus SEINER Antwort geschnitten, nicht hier eingetippt.
      const serversatz = String(
        (JSON.parse(abgewiesen.rumpf) as { message?: string }).message ?? "",
      );
      expect(
        serversatz.length,
        `${JOB}: Station e · die Abweisung nennt gar keinen Grund`,
      ).toBeGreaterThan(10);
      await warteAuf(zwei.seite, M.fehler, "Station e · der Fehlersatz erscheint");
      // DIE SICHTBARE MELDUNG, zusammengesetzt GENAU wie `MehrAbschnitte.tsx` (`diskussionsFehlerSatz`):
      // der eigene Satz, dann der Grund des Servers. Nur diese Verkettung bekommt ein Mensch zu sehen.
      await kalibriereSicht(
        zwei.seite,
        M.fehler,
        `${T("ko.diskussion.sendeFehler")} ${serversatz}`,
        "Station e · die reale Fehlerantwort auf der Fläche",
      );
      // H4: DER GETIPPTE TEXT STEHT NOCH IM FELD.
      expect(
        await feldwert(zwei.seite, M.antwortfeld(frageId)),
        `${JOB}: Station e · der mühsam getippte Text ist beim Scheitern verschwunden`,
      ).toBe(NACHTRAG_E);
      const beiAbweisung = await liesFaden(pool, koId, "Station e · nach der Abweisung");
      pruefeSoll(beiAbweisung, soll, fassung, "Station e · nach der Abweisung");
      expect(
        beiAbweisung.beitraege,
        `${JOB}: Station e · trotz Abweisung ist ein Beitrag in der Spalte entstanden`,
      ).toEqual(nachD.beitraege);

      // DER SICHTBARE NÄCHSTE SCHRITT WIRD BEFOLGT. Die Lage wird vorher zurückgenommen — sonst
      // führte der Wiederholungsweg in dieselbe Wand und bewiese über seine Wirkung nichts.
      const auf = await adminApi.sende("PUT", `/api/kos/${koId}`, {
        action: "confidentiality",
        level: "intern",
      });
      expect(auf.status, `${JOB}: Station e · das Zurückstufen misslang: ${auf.text}`).toBe(200);
      // Auch der Nachtrag bekommt seinen Sollwert VOR dem Schreiben: es gilt die dritte Fassung,
      // nicht die, unter der der gescheiterte Versuch getippt wurde.
      soll.push({
        station: "e · Nachtrag (Wiederholungsweg)",
        text: NACHTRAG_E,
        author: idZwei,
        replyTo: frageId,
        koVersion: fassung,
        stand: null,
      });
      mussDurchkommen(await sendeErneut(zwei, "k2e", tastatur), "Station e · Erneut senden");
      await warteAufWeg(
        zwei.seite,
        M.fehler,
        "Station e · der Fehlersatz verschwindet nach dem Erfolg",
      );

      const nachE = await liesFaden(pool, koId, "Station e");
      pruefeSoll(nachE, soll, fassung, "Station e");
      expect(
        nachE.beitraege,
        `${JOB}: Station e · der Wiederholungsweg hat keinen (oder mehr als einen) Beitrag hinterlassen`,
      ).toHaveLength(3);
      const nachtrag = nachE.beitraege[2] as Beitragszeile;
      expect(
        nachtrag.koVersion,
        `${JOB}: Station e · der Nachtrag trägt nicht die beim Wiederholen geltende Fassung ${fassung}`,
      ).toBe(fassung);
      expect(nachtrag.text, `${JOB}: Station e · der gespeicherte Inhalt stimmt nicht`).toBe(
        NACHTRAG_E,
      );
      expect(
        nachtrag.replyTo,
        `${JOB}: Station e · der Antwortbezug ging beim Wiederholen verloren`,
      ).toBe(frageId);
      expect(nachtrag.author, `${JOB}: Station e · der Nachtrag hängt am falschen Konto`).toBe(
        idZwei,
      );
      expect(nachtrag.id, `${JOB}: Station e · der Nachtrag trägt keine frische Kennung`).not.toBe(
        antwort.id,
      );
      expect(
        nachE.beitraege.slice(0, 2),
        `${JOB}: Station e hat die beiden älteren Beiträge verändert`,
      ).toEqual(nachD.beitraege);
      // ══ KALIBRIERUNG (b) · DER FASSUNGSBEZUG DES NACHTRAGS ══════════════════════════════════
      for (const art of ["entfernt", "verstellt"] as const) {
        protokoll.push(
          await kalibriereFassungsbezug(pool, koId, 2, art, "Station e", async () => {
            pruefeSoll(await liesFaden(pool, koId, "Station e"), soll, fassung, "Station e");
          }),
        );
      }
      melde("e", basis, nachE.beitraege.length, String(nachE.beitraege[0]?.resolution?.state));

      // ══ DER NEUSTART — dieselbe Datenbank, ein anderer Horchplatz ════════════════════════════
      //
      // Die beiden bisherigen Profile werden vorher geschlossen: ihre Seiten zeigen auf einen Port,
      // den es gleich nicht mehr gibt, und ihre Hintergrundabrufe liefen ins Leere.
      for (const platz of plaetze.splice(0, plaetze.length)) {
        await platz.kontext.close();
      }
      const alterPlatz = strecke.basis;
      await strecke.schliessen();
      strecke = undefined;
      nachNeustart = await starteStrecke({ pool, ...mitFlaeche() });
      expect(
        nachNeustart.basis,
        `${JOB}: der Neustart horcht am selben Platz wie vorher — dann wäre nichts neu gestartet`,
      ).not.toBe(alterPlatz);

      // ══ EIN VIERTER, FRISCHER KONTEXT — Konto 3 sieht den Faden ══════════════════════════════
      //
      // Dass die ANMELDUNG nach dem Neustart überhaupt gelingt, ist selbst ein Beleg: die Konten
      // stehen in derselben Datenbank und nicht im Prozessgedächtnis.
      const drei = await frischesProfil(chrom);
      plaetze.push(drei);
      await anmelden(drei.seite, nachNeustart.basis, EMAIL3, "k3", tastatur);
      await oeffneDiskussion(drei.seite, nachNeustart.basis, koId, TITEL, "k3", tastatur);
      await mussSichtbar(drei.seite, M.beitrag(frageId), BEITRAG_A, "Neustart · der erste Beitrag");
      await mussSichtbar(drei.seite, M.beitrag(frageId), ANTWORT_B, "Neustart · die Antwort");
      await mussSichtbar(drei.seite, M.beitrag(frageId), NACHTRAG_E, "Neustart · der Nachtrag");
      await mussImFadenHaengen(drei.seite, frageId, antwort.id);
      await mussImFadenHaengen(drei.seite, frageId, nachtrag.id);
      await kalibriereSicht(
        drei.seite,
        M.beitrag(frageId),
        ANTWORT_B,
        "Neustart · die Antwort im Faden",
        M.beitrag(antwort.id),
      );
      // DER OFFENE STAND — mit Urheber, und der Knopf beweist ihn ein zweites Mal.
      await mussSichtbar(
        drei.seite,
        M.klaerung(frageId),
        T("ko.diskussion.wiederGeoeffnetVon", {
          name: NAME2,
          datum: tagAnzeige(String(standD?.at)),
        }),
        "Neustart · der Wieder-offen-Vermerk",
      );
      expect(
        [
          (await sichtText(drei.seite, M.erledigen(frageId))) === null,
          (await sichtText(drei.seite, M.oeffnen(frageId))) === null,
        ],
        `${JOB}: Neustart · die Fläche bietet nicht „${T("ko.diskussion.alsGeklaertMarkieren")}" an — sie hält den Faden also nicht für offen`,
      ).toEqual([false, true]);
      expect(
        await seitentext(drei.seite),
        `${JOB}: Neustart · der Titel des Eintrags steht gar nicht auf der Seite`,
      ).toContain(TITEL);

      // ══ DIE UNABHÄNGIGE LESUNG NACH DEM NEUSTART — am Pool, vollständig ══════════════════════
      const nachNeu = await liesFaden(pool, koId, "nach dem Neustart");
      // ZUERST GEGEN DEN SOLL-SATZ, nicht gegen den vorher gelesenen Stand: ein Vergleich mit
      // `nachE` bewiese nur, dass sich nichts bewegt hat — auch dann, wenn schon `nachE`
      // unvollständig gewesen wäre (BEN, Runde 1, Prüfpunkt 4).
      pruefeSoll(nachNeu, soll, fassung, "nach dem Neustart");
      expect(
        nachNeu.beitraege.map((b) => b.koVersion),
        `${JOB}: nach dem Neustart stehen nicht die drei erwarteten Fassungsbezüge in der Spalte`,
      ).toEqual(soll.map((s) => s.koVersion));
      expect(
        nachNeu.beitraege.map((b) => b.text),
        `${JOB}: nach dem Neustart stehen nicht genau die drei geschriebenen Texte in der Spalte`,
      ).toEqual([BEITRAG_A, ANTWORT_B, NACHTRAG_E]);
      // UND ERST DANACH die Identität: Kennungen und Zeitpunkte sind dieselben geblieben — ein
      // neu erzeugter, inhaltlich passender Satz wäre kein erhaltener.
      expect(
        nachNeu.beitraege,
        `${JOB}: nach dem Neustart steht in der Spalte ein anderer Fadenstand als davor`,
      ).toEqual(nachE.beitraege);
      expect(
        nachNeu.version,
        `${JOB}: nach dem Neustart trägt das Objekt eine andere Fassungsnummer`,
      ).toBe(nachE.version);
      // ══ KALIBRIERUNG (c) · AUCH NACH DEM NEUSTART IST DER NACHWEIS NICHT BLIND ══════════════
      //
      // BENs Gegenprobe überlebte in Runde 1 ausdrücklich „einschliesslich Neustart". Deshalb wird
      // die Verstellung genau hier noch einmal gefahren: der Neustartnachweis muss sie sehen.
      protokoll.push(
        await kalibriereFassungsbezug(pool, koId, 1, "entfernt", "nach dem Neustart", async () => {
          pruefeSoll(
            await liesFaden(pool, koId, "nach dem Neustart"),
            soll,
            fassung,
            "nach dem Neustart",
          );
        }),
      );
      melde(
        "f (Neustart)",
        nachNeustart.basis,
        nachNeu.beitraege.length,
        String(nachNeu.beitraege[0]?.resolution?.state),
      );

      // DER SOLL-SATZ IM KLARTEXT — damit ein Mensch die drei Fassungsbezüge nachlesen kann, ohne
      // den Test zu lesen.
      const sollzeile = `${JOB} · Fassungsbezug (Soll, aus der Strecke geführt): ${soll
        .map((s) => `${s.station} → koVersion ${s.koVersion}`)
        .join(" · ")}`;
      protokoll.push(sollzeile);
      process.stderr.write(`${sollzeile}\n`);
      // Die gezählten Tab-Anschläge stehen im Befund: eine Zahl, die niemand nachliest, wäre keine.
      process.stderr.write(
        `${JOB} · Tastaturwege (Anschläge je Schritt): ${JSON.stringify(tastatur)}\n`,
      );
    } finally {
      // DER POOL WIRD IMMER BEENDET — auch wenn das Schliessen der Anwendung scheitert (Lehre
      // JOB 4223 R3). Kein `throw` im äusseren `finally`, das den Fehler des `try`-Blocks
      // überschriebe (biome `noUnsafeFinally`).
      try {
        for (const platz of plaetze) {
          await platz.kontext.close().catch(() => undefined);
        }
        await strecke?.schliessen();
        await nachNeustart?.schliessen();
      } finally {
        await pool.end();
      }
    }
  }, 2_400_000);
});
