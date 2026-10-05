// ================================================================================================
// BELEGDATEI-NEULADEN · DIE BELEGDATEI NACH PROZESSNEUSTART UND UMBENENNUNG, GEGEN ECHTES PG
// ================================================================================================
//
// DIE ZWEI PRÜFLÜCKEN, GEGEN DIE DIESE DATEI STEHT, hat der Prüfer zu JOB 4077 wörtlich benannt
// (`archiv/4077/runde-2/ben-antwort.md`, Punkt 6, „nicht blockierend"):
//   „PostgreSQL-Neuladen nach Prozessneustart ergänzend testen. Außerdem Umbenennung eines Anhangs
//    mit erneuter Board-Abfrage prüfen; die aktuelle Auflösung erfolgt beim Anzeigen."
// und unter NICHT GEPRÜFT: „echter PostgreSQL-Bestand".
//
// WAS ES VORHER GAB UND WARUM ES NICHT REICHT:
//   · `tests/quelle-dateiname-am-nachweis/*` (JOB 4077) — Anker und Board-Zeile, aber im
//     Anwendungsspeicher (`buildServices()`), ohne Datenbank und ohne Neustart.
//   · `tests/klara-quellen-nutzerweg/kette-postgres.integration.test.ts` PG3 (JOB 4224) — eine
//     ZWEITE App-Instanz im SELBEN Node-Prozess auf demselben Pool. Das ist kein Prozessneustart,
//     und diese Datei holt ihre Datenbank über Testcontainers, die auf dem Prüfplatz fehlen
//     (`tests/d5-gesamtweg/platz.ts`, Kopf).
//
// DIE KETTE, DIE HIER STEHT — keine neue Quellenlogik, nur der vorhandene Anker (JOB 4077):
//   Prozess 1 (eigener Betriebssystemprozess, `starteKlarwerk`): Admin über `/api/auth/setup`,
//   Leser über `/api/users`; Eintrag mit ZWEI gleichnamigen Anhängen (Köder zuerst), Belegstelle
//   an den zweiten verankert → SIGTERM, Prozess nachweislich weg → Anker in der Zeile `kos`
//   nachgelesen → UMBENENNUNG des verankerten Anhangs im gespeicherten Bestand → Prozess 2 auf
//   derselben Datenbank → `/api/validation/board` (die Route der Prüfseite `/validierung`) und
//   `/api/kos/:id` (Bibliothek) → `quellennachweis`/`originalweg` (die Ableitungen der Fläche) →
//   `/api/objects/:id/raw` → dieselben Bytes wie vor dem Neustart → dieselbe Kette in Chromium.
//
// WARUM DIE UMBENENNUNG IN DER DATENBANK GESCHIEHT: das Produkt hat HEUTE KEINEN Umbenennen-Weg
// für Anhänge (`ko-routes.ts` kennt `attach` und `detach`, sonst nichts). Einen zu bauen wäre eine
// neue Anforderung jenseits der Quelle. Gemessen wird deshalb die Eigenschaft, die Ben benennt:
// der Name wird beim ANZEIGEN aus dem gespeicherten Anhang aufgelöst — ändert er sich im Bestand,
// folgt der Nachweis, und Kennung und Inhalt bleiben dieselben. Die Änderung erfolgt, während
// KEIN Prozess läuft; es gibt also keinen Zwischenspeicher, der sie verdecken könnte.
//
// „ÜBER DIE OBERFLÄCHE" HEISST HIER (Runde 2, BENs Befund 2): die GEBAUTE Fläche, ausgeliefert vom
// zweiten Serverprozess über einen echten Socket, in einem echten Chromium — kein abgefangener
// Aufruf, keine gemockte Route. Anmeldung über die Maske, dann `/wissen/:id`: der Kopfknopf
// „Quellen" klappt den Abschnitt auf, dort steht der AUFGELÖSTE Dateiname (`bib-quelle-datei`).
// Danach F5 und dieselbe Messung noch einmal. Der Kopfknopf „Anhänge" führt zu den Anhängen; der
// Öffnen-Knopf des Anhangs mit dem NEUEN Namen wird geklickt. Sein Ziel wird an `window.open`
// MITGESCHRIEBEN (die Originalfunktion läuft weiter, der Tab öffnet sich) und im selben
// Browserprofil mit dessen Anmeldung abgeholt: Ziel = Kennung der verankerten Datei, Bytes = ECHT.
// Zuletzt die Prüfseite (`/validierung`, im Kopfband „Prüfen"): Eintrag in der Warteschlange
// wählen, „Mehr" der Karte aufklappen — die Prüfkarte nennt denselben neuen Namen.
//
// GEGENPROBEN (Runde 2, von Hand, nicht Teil des Laufs): eine nur in `dist` verfälschte Auflösung
// (`quellennachweis` nimmt den ersten Anhang) macht den Fall an „Bibliothek, erstes Laden" rot; ein
// nur in `dist` verfälschter Öffnen-Knopf (öffnet den ersten Anhang) macht ihn am Dateiziel rot.
//
// PRÜFGRENZE, SICHTBAR: ohne `KLARWERK_PG_TEST_URL` und ohne Container-Laufzeit steht der Grund auf
// stderr und die Fälle melden `skipped`, nie `passed`. Eine erreichbare Datenbank, auf der etwas
// scheitert, wird ROT — nie ein Skip; ebenso ein fehlendes Chromium. Wie jede
// `*.integration.test.ts` läuft die Datei NICHT im Tor (`vitest.config.ts`, `AUSSCHLUSS`), sondern
// als eigener Aufruf (fehlt `apps/web/dist`, wird die Fläche vorher gebaut):
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts tests/belegdatei-neuladen
//
// DAS PROTOKOLL DES LAUFS (PIDs, Ports, PostgreSQL-Fassung, Chromium, Downloadziel) steht am Ende
// auf stderr, Zeile `[KLARWERK] BELEGDATEI-NEULADEN PROTOKOLL`.
//
// KEINE PRODUKTIVDATEN: eine eigene Wegwerf-Datenbank mit `test` im Namen (erzwungen in `pgUrl`),
// am Ende mit `DROP … WITH (FORCE)` entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { originalweg } from "../../apps/web/src/lib/askCitedSources";
import { quellennachweis } from "../../apps/web/src/lib/koSource";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Instanz,
  type Verbindung,
  WURZEL,
  pgUrl,
  prozessLebt,
  sende,
  starteKlarwerk,
  zerlege,
} from "../beziehungs-restore-nutzerweg/vorrichtung";
import {
  type Browser,
  DIST,
  type Seite,
  fn,
  profil,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";

const MARKE = "[KLARWERK] BELEGDATEI-NEULADEN";
const PASSWORT = "Belegdatei-Neuladen-2026!";
const ADMIN = { name: "Beleg Admin", email: "beleg-admin@neuladen.test" };
const LESER = { name: "Beleg Leser", email: "beleg-leser@neuladen.test" };

const NAME = "Pruefprotokoll.pdf";
const NEUER_NAME = "Pruefprotokoll-freigegeben.pdf";
// Nullbytes und hohe Bytes: daran fällt jede Umkodierung auf dem Weg durch PG auf.
const ECHT = Buffer.concat([Buffer.from("%PDF-1.4 Belegdatei ECHT\n"), Buffer.from([0, 255, 7])]);
const KOEDER = Buffer.from("%PDF-1.4 Belegdatei KOEDER\n");
const FREMD = Buffer.from("%PDF-1.4 Belegdatei FREMD vertraulich\n");
const ERFUNDEN = "gibt-es-nicht-belegdatei-neuladen";
const TITEL = "Dichtungswechsel L4";

const dataUrl = (b: Buffer): string => `data:application/pdf;base64,${b.toString("base64")}`;

let container: StartedTestContainer | undefined;
let verbindung: Verbindung | undefined;
let basisUrl: string | undefined;
let grund = "";

beforeAll(async () => {
  let url = guardedLocalPgTestUrl();
  if (!url && process.env.KLARWERK_PG_TEST_URL) {
    grund = "KLARWERK_PG_TEST_URL wurde von guardedLocalPgTestUrl abgelehnt";
  } else if (!url) {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    } catch (fehler) {
      grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar (${String(fehler)})`;
    }
  }
  if (url) {
    verbindung = zerlege(url);
    basisUrl = url;
    if (!verbindung) {
      grund = "die Test-URL nennt keinen Rechnernamen";
    }
  }
  if (grund) {
    process.stderr.write(`${MARKE} ÜBERSPRUNGEN: ${grund}\n`);
    return;
  }
  // DIE FLÄCHE MUSS VOR DEM ERSTEN SERVERSTART DA SEIN: `server.ts` prüft `dist` einmal beim Start.
  // Scheitert der Bau, wird das ROT gemeldet (im Fall unten), nicht übersprungen.
  if (!existsSync(join(DIST, "index.html"))) {
    execFileSync("npx", ["vite", "build"], {
      cwd: join(WURZEL, "apps/web"),
      stdio: "pipe",
      timeout: 600_000,
    });
  }
}, 900_000);

afterAll(async () => {
  await container?.stop().catch(() => undefined);
});

/** Rohbytes über den echten Socket — `sende` liest Text, hier zählt jedes Byte. */
async function roh(
  basis: string,
  token: string,
  objectId: string,
): Promise<{ status: number; bytes: Buffer; text: string; cache: string | null }> {
  const res = await fetch(`${basis}/api/objects/${objectId}/raw`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    bytes,
    text: bytes.toString("utf8"),
    cache: res.headers.get("cache-control"),
  };
}

async function erwarte<T>(
  antwort: Promise<{ status: number; text: string; json: unknown }>,
  status: number,
): Promise<T> {
  const a = await antwort;
  expect(a.status, a.text).toBe(status);
  return a.json as T;
}

async function anmelden(basis: string, email: string): Promise<string> {
  const a = await erwarte<{ token: string }>(
    sende(basis, "POST", "/api/auth/login", undefined, { email, password: PASSWORT }),
    200,
  );
  return a.token;
}

async function objekt(basis: string, token: string, inhalt: Buffer, stufe?: string) {
  const o = await erwarte<{ id: string }>(
    sende(basis, "POST", "/api/objects", token, {
      name: NAME,
      mime: "application/pdf",
      data: dataUrl(inhalt),
      ...(stufe ? { confidentiality: stufe } : {}),
    }),
    201,
  );
  return o.id;
}

async function eintrag(basis: string, token: string, titel: string, stufe: string) {
  const k = await erwarte<{ id: string }>(
    sende(basis, "POST", "/api/kos", token, {
      title: titel,
      statement: `Belegsatz zu ${titel}.`,
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: stufe,
    }),
    201,
  );
  return k.id;
}

async function anhaengen(basis: string, token: string, koId: string, objectId: string) {
  await erwarte(
    sende(basis, "PUT", `/api/kos/${koId}`, token, {
      action: "attach",
      attachment: { name: NAME, mime: "application/pdf", objectId },
    }),
    200,
  );
}

function belegstelle(basis: string, token: string, koId: string, objectId: string) {
  return sende(basis, "PUT", `/api/kos/${koId}`, token, {
    action: "add-source",
    source: { label: "Seite 4", excerpt: "Absatz 2", objectId },
  });
}

async function boardZeile(basis: string, token: string, koId: string): Promise<KnowledgeObject> {
  const zeilen = await erwarte<KnowledgeObject[]>(
    sende(basis, "GET", "/api/validation/board", token),
    200,
  );
  const zeile = zeilen.find((z) => z.id === koId);
  expect(zeile, `der Eintrag ${koId} fehlt auf dem Board`).toBeDefined();
  return zeile as KnowledgeObject;
}

// ------------------------------------------------------------------------------------------------
// DIE OBERFLÄCHE — dieselbe Typhülle um Playwright wie alle PG-Browserwege (`browserweg.ts`).
// ------------------------------------------------------------------------------------------------

const SCHIRM = { width: 1280, height: 900 };

/** Anmeldung über die MASKE — derselbe Weg wie `tests/wissensnetz-nutzerweg/strecke.ts` (`melde`). */
async function anmeldenImBrowser(seite: Seite, basis: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
  await seite.fill("#auth-email", ADMIN.email);
  await seite.fill("#auth-password", PASSWORT);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    '() => !document.querySelector("#auth-email")',
    "die Anmeldung trägt",
    undefined,
    45_000,
  );
}

/** Texte aller Elemente mit diesem Prüfmerkmal, so wie ein Mensch sie liest (`innerText`). */
function texte(seite: Seite, testid: string): Promise<string[]> {
  return seite.evaluate<string[]>(
    fn(`(id) => Array.prototype.map.call(
          document.querySelectorAll('[data-testid="' + id + '"]'),
          (e) => (e.innerText || '').trim())`),
    testid,
  );
}

/** `/wissen/:id` laden, „Quellen" über den Kopfknopf aufklappen und den Dateinamen ablesen. */
async function dateinameInDerBibliothek(seite: Seite, basis: string, koId: string) {
  await seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="bib-sprung-quellen"]')`,
    "der Kopfknopf „Quellen“ steht",
    undefined,
    45_000,
  );
  await seite.click('[data-testid="bib-sprung-quellen"]');
  await warte(
    seite,
    `() => { const d = document.querySelector('[data-bib-abschnitt="quellen"]');
             return !!(d && d.open && d.querySelector('[data-testid="bib-quelle-datei"]')); }`,
    "der Abschnitt „Quellen“ zeigt die Belegdatei",
  );
  return texte(seite, "bib-quelle-datei");
}

/**
 * Den Anhang mit diesem sichtbaren Namen über SEINEN Öffnen-Knopf öffnen: Ziel und Bytes.
 * Der Knopf ruft `window.open(href)` (`MehrAbschnitte.tsx`, `openAttachment`).
 */
async function anhangOeffnen(
  seite: Seite,
  name: string,
): Promise<{ url: string; datei: string; bytes: Buffer }> {
  await seite.click('[data-testid="bib-sprung-anhaenge"]');
  await warte(
    seite,
    `() => { const d = document.querySelector('[data-bib-abschnitt="anhaenge"]');
             return !!(d && d.open && d.querySelector('[data-bib-anhang]')); }`,
    "der Abschnitt „Anhänge“ steht offen",
  );
  const kennung = await seite.evaluate<string | null>(
    fn(`(name) => { const k = Array.prototype.find.call(
            document.querySelectorAll('[data-bib-anhang]'),
            (b) => { const s = b.querySelector('span[title]'); return !!s && s.getAttribute('title') === name; });
          return k ? k.getAttribute('data-bib-anhang') : null; }`),
    name,
  );
  expect(kennung, `kein Anhang mit dem sichtbaren Namen „${name}“`).not.toBeNull();
  // DAS ZIEL WIRD AM KNOPF MITGESCHRIEBEN, nicht vorhergesagt: `window.open` wird umhüllt, die
  // Originalfunktion läuft unverändert weiter (der Tab öffnet sich wie für einen Menschen). Den
  // Download im neuen Tab selbst zu fangen ist in Playwright ein Wettlauf — das Ereignis kann vor
  // dem Anhängen des Zuhörers feuern (gemessen: „neuer Tab" ohne Antwort und ohne Download).
  await seite.evaluate(
    fn(`() => { const echt = window.open.bind(window); window.__kwGeoeffnet = [];
                window.open = (u, ...rest) => { window.__kwGeoeffnet.push(String(u)); return echt(u, ...rest); }; }`),
  );
  await seite.click(`[data-bib-anhang="${kennung}"]`);
  await warte(
    seite,
    "() => (window.__kwGeoeffnet || []).length > 0",
    "der Öffnen-Knopf ruft ein Ziel auf",
  );
  // DIE BYTES KOMMEN AUS DEMSELBEN BROWSERPROFIL, mit dessen Anmeldung — also genau das, was der
  // geöffnete Tab bekommt (gleicher Ursprung, Sitzungscookie, kein eigener Kopf aus dem Test).
  const geholt = await seite.evaluate<{ ziel: string; status: number; b64: string; kopf: string }>(
    fn(`async () => { const ziel = window.__kwGeoeffnet[0];
          const r = await fetch(ziel, { credentials: 'same-origin' });
          const u = new Uint8Array(await r.arrayBuffer()); let s = '';
          for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
          return { ziel, status: r.status, b64: btoa(s), kopf: r.headers.get('content-disposition') || '' }; }`),
  );
  expect(geholt.status, `das Ziel ${geholt.ziel} antwortet nicht mit 200`).toBe(200);
  return {
    url: new URL(geholt.ziel, seite.url()).toString(),
    datei: geholt.kopf,
    bytes: Buffer.from(geholt.b64, "base64"),
  };
}

describe("Belegdatei nach echtem Prozessneustart und Umbenennung (PostgreSQL)", () => {
  it("Anker, Name, Kennung und Bytes über SIGTERM, Umbenennung und neuen Prozess", async (ctx) => {
    if (!verbindung || !basisUrl) {
      process.stderr.write(`${MARKE} ÜBERSPRUNGEN: ${grund}\n`);
      ctx.skip();
      return;
    }
    const datenbank = `klarwerk_beleg_${`${Date.now()}`.slice(-8)}_test`;
    const verwaltung = new Pool({ connectionString: basisUrl });
    verwaltung.on("error", (f) => process.stderr.write(`${MARKE} HINWEIS: ${String(f)}\n`));
    let pool: Pool | undefined;
    let instanz: Instanz | undefined;
    let browser: Browser | undefined;
    const protokoll: string[] = [];
    try {
      await verwaltung.query(`CREATE DATABASE ${datenbank}`);
      const datenbankUrl = pgUrl(verbindung, datenbank);
      pool = new Pool({ connectionString: datenbankUrl });
      pool.on("error", (f) => process.stderr.write(`${MARKE} HINWEIS: ${String(f)}\n`));
      const fassung = await pool.query<{ v: string }>("SELECT version() AS v");
      protokoll.push(`pg=${(fassung.rows[0]?.v ?? "?").split(" ").slice(0, 2).join(" ")}`);
      protokoll.push(`db=${datenbank}`);

      // ── PROZESS 1: Bestand über die echten Routen ────────────────────────────────────────
      instanz = await starteKlarwerk({ datenbankUrl, was: "Prozess 1" });
      const b1 = instanz.basis;
      protokoll.push(`prozess1=pid:${instanz.pid},port:${new URL(b1).port}`);
      const setup = await erwarte<{ token: string }>(
        sende(b1, "POST", "/api/auth/setup", undefined, { ...ADMIN, password: PASSWORT }),
        201,
      );
      const admin1 = setup.token;
      await erwarte(
        sende(b1, "POST", "/api/users", admin1, { ...LESER, password: PASSWORT, role: "experte" }),
        201,
      );

      const koId = await eintrag(b1, admin1, TITEL, "intern");
      const koeder = await objekt(b1, admin1, KOEDER);
      const echt = await objekt(b1, admin1, ECHT);
      // Der Köder liegt ZUERST in der Liste und trägt DENSELBEN Namen: eine Auflösung über den
      // Namen träfe ihn.
      await anhaengen(b1, admin1, koId, koeder);
      await anhaengen(b1, admin1, koId, echt);
      await erwarte(belegstelle(b1, admin1, koId, echt), 200);

      // Ein vertraulicher FREMDER Eintrag mit eigenem Anhang — für die Abweisung nach dem Neustart.
      const fremdKo = await eintrag(b1, admin1, "Lieferantenpreis Ventile", "vertraulich");
      const fremd = await objekt(b1, admin1, FREMD, "vertraulich");
      await anhaengen(b1, admin1, fremdKo, fremd);

      const vorher = await roh(b1, admin1, echt);
      expect(vorher.status).toBe(200);
      expect(vorher.bytes.equals(ECHT), "die Bytes vor dem Neustart").toBe(true);

      // ── SIGTERM: der Prozess ist WIRKLICH weg ────────────────────────────────────────────
      const pid1 = instanz.pid;
      await instanz.beende();
      expect(prozessLebt(pid1), `Prozess ${pid1} lebt nach SIGTERM weiter`).toBe(false);
      await expect(fetch(`${b1}/health`)).rejects.toThrow();

      // ── DER ANKER STEHT IN DER DATENBANKZEILE, nicht im Speicher eines Prozesses ─────────
      const zeile = await pool.query<{ anker: string | null; namen: string[] }>(
        `SELECT data->'sources'->0->>'objectId' AS anker,
                ARRAY(SELECT a->>'name' FROM jsonb_array_elements(data->'attachments') a) AS namen
           FROM kos WHERE id = $1`,
        [koId],
      );
      expect(zeile.rows[0]?.anker, "der Anker fehlt in der Zeile `kos`").toBe(echt);
      expect(zeile.rows[0]?.namen).toEqual([NAME, NAME]);

      // ── UMBENENNUNG im gespeicherten Bestand, während KEIN Prozess läuft ─────────────────
      const umbenannt = await pool.query(
        `UPDATE kos SET data = jsonb_set(data, '{attachments}', (
            SELECT jsonb_agg(CASE WHEN a->>'objectId' = $2
                                  THEN jsonb_set(a, '{name}', to_jsonb($3::text)) ELSE a END
                             ORDER BY o)
              FROM jsonb_array_elements(data->'attachments') WITH ORDINALITY AS t(a, o)))
          WHERE id = $1`,
        [koId, echt, NEUER_NAME],
      );
      expect(umbenannt.rowCount, "die Umbenennung traf keine Zeile").toBe(1);

      // ── PROZESS 2 auf derselben Datenbank ────────────────────────────────────────────────
      instanz = await starteKlarwerk({ datenbankUrl, was: "Prozess 2 auf derselben Datenbank" });
      const b2 = instanz.basis;
      protokoll.push(`prozess2=pid:${instanz.pid},port:${new URL(b2).port}`);
      expect(instanz.pid, "der neue Prozess trägt dieselbe PID").not.toBe(pid1);
      const admin2 = await anmelden(b2, ADMIN.email);
      const leser2 = await anmelden(b2, LESER.email);

      // Die Prüfseite (`/pruefen`) liest das Board — Bens Wortlaut „erneute Board-Abfrage".
      const board = await boardZeile(b2, admin2, koId);
      expect(board.sources?.[0]?.objectId, "der Anker hat den Neustart nicht überlebt").toBe(echt);
      expect(board.attachments?.map((a) => [a.objectId, a.name])).toEqual([
        [koeder, NAME],
        [echt, NEUER_NAME],
      ]);
      const quelle = board.sources?.[0];
      expect(quelle).toBeDefined();
      if (quelle) {
        expect(quellennachweis(quelle, board.attachments ?? [], "de").datei).toBe(NEUER_NAME);
      }

      // Die Bibliothek liest `/api/kos/:id` — dieselbe Auflösung, derselbe Weg zu den Bytes.
      const ko = await erwarte<KnowledgeObject>(sende(b2, "GET", `/api/kos/${koId}`, admin2), 200);
      const weg = originalweg(ko, "de");
      expect(weg.quellen[0]?.datei).toEqual({
        objectId: echt,
        name: NEUER_NAME,
        href: `/api/objects/${echt}/raw`,
      });
      expect(weg.freieDateien.map((d) => [d.objectId, d.name])).toEqual([[koeder, NAME]]);

      const nachher = await roh(b2, admin2, echt);
      expect(nachher.status).toBe(200);
      expect(nachher.bytes.equals(ECHT), "die Bytes nach Neustart und Umbenennung").toBe(true);
      const alsLeser = await roh(b2, leser2, echt);
      expect(alsLeser.status, "Gegenprobe: der Leser darf die interne Belegdatei öffnen").toBe(200);
      expect(alsLeser.bytes.equals(ECHT)).toBe(true);

      // ── DIE OBERFLÄCHE des zweiten Prozesses, im echten Chromium ─────────────────────────
      browser = await starteChromium();
      protokoll.push(
        `chromium=${(browser as unknown as { version?(): string }).version?.() ?? "unbekannt"}`,
      );
      const { kontext, seite } = await profil(browser, SCHIRM);
      await anmeldenImBrowser(seite, b2);

      // Bibliothek: der aufgelöste Name — und nach F5 derselbe.
      expect(await dateinameInDerBibliothek(seite, b2, koId), "Bibliothek, erstes Laden").toEqual([
        NEUER_NAME,
      ]);
      await seite.reload({ waitUntil: "domcontentloaded" });
      expect(
        await dateinameInDerBibliothek(seite, b2, koId),
        "Bibliothek nach dem Neuladen",
      ).toEqual([NEUER_NAME]);

      // Dateiziel und Inhalt: der Öffnen-Knopf des Anhangs mit dem NEUEN Namen führt zur
      // verankerten Kennung und liefert ihre Bytes — nicht die des gleichnamigen Köders.
      const geoeffnet = await anhangOeffnen(seite, NEUER_NAME);
      protokoll.push(`download=${new URL(geoeffnet.url).pathname},datei:${geoeffnet.datei}`);
      expect(new URL(geoeffnet.url).pathname).toBe(`/api/objects/${echt}/raw`);
      expect(geoeffnet.bytes.equals(ECHT), "die Bytes des Downloads aus der Fläche").toBe(true);

      // Prüfseite (`/validierung`, im Kopfband „Prüfen"): dieselbe Board-Route, jetzt gezeichnet.
      await seite.goto(`${b2}/validierung`, { waitUntil: "domcontentloaded" });
      // Den Eintrag in der Warteschlange über seinen TITEL wählen (auf dem Board steht auch der
      // fremde Eintrag), dann „Mehr" der Karte über die echte Zusammenfassung aufklappen —
      // dieselbe Bedienung wie in `tests/pruefen-quellennachweis/lange-quellen-schmal-chromium.test.ts`.
      const eintragKnopf = `[data-testid="pruefen-warteschlange-eintrag"]:has([data-text="titel"])`;
      await warte(
        seite,
        `(t) => Array.prototype.some.call(document.querySelectorAll('${eintragKnopf}'),
                 (b) => (b.querySelector('[data-text="titel"]').textContent || '').trim() === t)`,
        "der Eintrag steht in der Warteschlange",
        TITEL,
        45_000,
      );
      await seite.click(`${eintragKnopf} >> text="${TITEL}"`);
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="pruefen-mehr-karte"] > summary')`,
        "die Karte des Eintrags steht",
      );
      await seite.click('[data-testid="pruefen-mehr-karte"] > summary');
      await warte(
        seite,
        `() => { const d = document.querySelector('[data-testid="pruefen-mehr-karte"]');
                 return !!(d && d.open && d.querySelector('[data-testid="pruefen-quelle-datei"]')); }`,
        "„Mehr“ der Prüfkarte zeigt die Belegdatei",
      );
      expect(await texte(seite, "pruefen-quelle-datei"), "Prüfkarte").toEqual([NEUER_NAME]);
      await kontext.close();

      // ── ABWEISUNG nach dem Neustart: fremde Kennung, alter und neuer sichtbarer Name ─────
      for (const kandidat of [fremd, NAME, NEUER_NAME, ERFUNDEN]) {
        const res = await belegstelle(b2, admin2, koId, kandidat);
        expect(res.status, `Anker „${kandidat}" wurde nicht abgewiesen: ${res.text}`).toBe(403);
      }
      const danach = await erwarte<KnowledgeObject>(
        sende(b2, "GET", `/api/kos/${koId}`, admin2),
        200,
      );
      expect(danach.sources?.map((s) => s.objectId)).toEqual([echt]);

      // Unberechtigt: der vertrauliche fremde Anhang sieht für den Leser aus wie nicht vorhanden.
      const fremdLeser = await roh(b2, leser2, fremd);
      const erfundenLeser = await roh(b2, leser2, ERFUNDEN);
      expect(fremdLeser.status).toBe(404);
      expect(fremdLeser.text).toBe(erfundenLeser.text);
      expect(fremdLeser.cache).toBe(erfundenLeser.cache);
      expect(fremdLeser.text).not.toContain("FREMD");
      protokoll.push("ergebnis=alle-zusicherungen-durchlaufen");
    } finally {
      process.stderr.write(`${MARKE} PROTOKOLL ${protokoll.join(" · ")}\n`);
      await browser?.close().catch(() => undefined);
      await instanz?.beende().catch(() => undefined);
      await pool?.end().catch(() => undefined);
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch((f) => process.stderr.write(`${MARKE} HINWEIS: Abbau — ${String(f)}\n`));
      await verwaltung.end().catch(() => undefined);
    }
  }, 600_000);
});
