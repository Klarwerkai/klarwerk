// ================================================================================================
// JOB 4326 · WAS EIN GESPERRTER AKTEUR WIRKLICH SIEHT — fünf Rollen an fünf Türen, im Browser.
// ================================================================================================
//
// WAS DIESE DATEI MISST. Sie fährt die vollständige Kette einmal je Akteur und Tür:
// `users.role` in echtem PostgreSQL → `/auth/me` → `RoleContext` → `canSee`/`Guarded` → die GEBAUTE
// Fläche in einem echten Chromium über einen echten Socket → der Versuch am Draht MIT DEM KEKS
// DIESER SEITE → das Rechtetor (`http.ts:233-236`) → der Katalogsatz „Recht fehlt: …" → und zurück
// in die Tabellen `users` und `kos`. An jeder der fünf Türen sieht ein gesperrter Akteur entweder
// kein Bedienelement oder die Sperrkarte „Dieser Bereich gehört einer anderen Rolle"; der
// Berechtigte sieht dasselbe Element SICHTBAR (Playwright-Sichtbarkeit, nicht DOM-Anwesenheit), und
// der Bestand steht vor und nach jedem Versuch bytegleich da.
//
// WAS `tests/beta-rollenabnahme/**` WEITERHIN ALLEIN MISST — und diese Datei nicht ersetzt: alle
// registrierten Türen der App, alle fünf Akteure, alle Statuscodes und Fehlerschlüssel, schnell und
// vollständig über `app.inject`. Das bleibt die Regression; hier kommen für FÜNF dieser Türen die
// Fläche, der Socket, der Browser und die Datenbank hinzu. Die Erwartungen werden von dort
// IMPORTIERT (`tueren.ts`), nicht abgeschrieben — es entsteht keine zweite Erwartungsquelle.
//
// WAS HIER AUSDRÜCKLICH NICHT GEMESSEN IST (Auftrag §9): andere Browser als Chromium, die
// Sperrkarte auf Englisch und Niederländisch, der Word-Host, die übrigen Türen der Tabelle, die
// Admin-Vorschau „ansehen als" (`RoleContext.tsx:29-32` — eine Vorschau, keine Sitzung), abgelaufene
// Gäste (JOB 4223/4265) und die Vertraulichkeit (JOB 4281/4304). Ebenso wird hier NICHT entschieden,
// ob „Gast" eine eigene Rolle oder ein Kontomerkmal ist; gemessen werden die vier bestehenden Rollen
// (`buehne.ts:38-43`).
//
// PRÜFGRENZE, LAUT GEMELDET: Ohne echte PostgreSQL wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen — ein stiller Skip sähe aus wie ein bestandener Lauf. KEINE PRODUKTIVDATEN:
// ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { meldung } from "../../services/auth/src/meldungen";
import type { Role } from "../../services/auth/src/types";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { AKTEURE, type Akteur } from "../beta-rollenabnahme/buehne";
import { type Erwartung, eintrag, erwarteterCode } from "../beta-rollenabnahme/tabelle";
import {
  type Browser,
  DIST,
  type Kontext,
  type Seite,
  fn,
  mitFlaeche,
  profil,
  starteChromium,
} from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  mussGelingen,
  starteStrecke,
  wissensobjektAnlegen,
} from "../gast-nutzerweg/strecke";
import {
  BREIT,
  type Knopf,
  amDraht,
  anmeldenAnDerMaske,
  knopfBefund,
  oeffneTuer,
  sichtbarkeit,
  textTraeger,
} from "./flaeche";
import {
  type Bestandslesung,
  SPERRSATZ,
  TUEREN,
  type Tuer,
  type TuerAufbau,
  erfolgsstatus,
} from "./tueren";

const JOB = "[KLARWERK] JOB 4326";
const ADMIN = "rollen-admin@sichtbar-4326.test";
const KONTEN = {
  viewer: "rollen-viewer@sichtbar-4326.test",
  experte: "rollen-experte@sichtbar-4326.test",
  controller: "rollen-controller@sichtbar-4326.test",
} as const;
/** Die drei Konten, die der Admin anlegt — Rolle als `Role` und nicht als beliebige Zeichenkette. */
const ROLLENKONTEN = [
  { rolle: "viewer", email: KONTEN.viewer },
  { rolle: "experte", email: KONTEN.experte },
  { rolle: "controller", email: KONTEN.controller },
] as const satisfies readonly { rolle: Role; email: string }[];
const PRUEF_TITEL = "Wartungsplan zur Rollenabnahme (JOB 4326)";
const PAPIERKORB_TITEL = "Entsorgter Wartungsplan (JOB 4326)";
const NEUE_ANSCHRIFT = "niemals-entstanden@sichtbar-4326.test";
/** Der Schalter, hinter dem die beiden Kalibrierungen wohnen — sonst kein dauerhaft roter `it`. */
const KALIBRIERUNG = process.env.KLARWERK_KALIBRIERUNG === "1";

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

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

/**
 * Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler.
 *
 * Dieselbe Lage wie in `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:101-116` und
 * aus demselben Grund: das Tor baut `apps/web/dist`, hat aber keine Datenbank; der Integrationslauf
 * hat die Datenbank und kein `dist`. Der Helfer steht hier und nicht dort, weil der Auftrag jene
 * Datei unverändert lässt (§4) — eine additive Änderung an `gast-nutzerweg/**` wäre ein Diff
 * ausserhalb der Zielpfade.
 */
function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

/** Was in der Protokollzeile über Lauf und Umgebung steht — einmal gemessen, nie geraten. */
interface Umgebung {
  chromium: string;
  socket: string;
  postgres: string;
}

interface AkteursKontext {
  akteur: Akteur;
  kontext: Kontext;
  seite: Seite;
}

/** `display:none` auf GENAU das Element, das `knopfBefund` beurteilt — für Kalibrierung 5b. */
const AUSBLENDEN = `(k) => {
  var e = null;
  if (k.art === "selektor") { e = document.querySelector(k.sel); }
  else {
    var wurzel = k.raum ? document.querySelector(k.raum) : document.body;
    var alle = wurzel ? Array.prototype.slice.call(wurzel.querySelectorAll('button, a[href], [role="button"], [role="menuitem"]')) : [];
    var treffer = alle.filter(function (x) { return String(x.textContent || "").indexOf(k.text) >= 0; });
    e = treffer.length > 0 ? treffer[0] : null;
  }
  if (!e) { return "(kein Element)"; }
  e.setAttribute("data-4326-ausgeblendet", "1");
  e.style.setProperty("display", "none", "important");
  return e.tagName.toLowerCase();
}`;

const EINBLENDEN = `() => {
  var alle = Array.prototype.slice.call(document.querySelectorAll('[data-4326-ausgeblendet]'));
  alle.forEach(function (e) { e.style.removeProperty("display"); e.removeAttribute("data-4326-ausgeblendet"); });
  return alle.length;
}`;

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · KORREKTURPFLICHT 2 — EIN AUSGEFALLENER MESSWEG IST KEIN KALIBRIERUNGSERFOLG.
// ------------------------------------------------------------------------------------------------
//
// BENs BEFUND: K1 fing in Runde 1 JEDEN Fehler aus `messeZelle` ab und verbuchte ihn als
// „KALIBRIERUNG GRIFF". Ein Chromium, der nicht startet, eine Abfrage, die wirft, ein Selektor,
// der nie kommt — alles hätte dieselbe Meldung erzeugt wie die Zusicherung, die kalibriert werden
// soll. Kalibriert ist eine Zusicherung aber nur, wenn GENAU SIE rot wird.
//
// Deshalb steht der Satz, den die Kalibrierung erwartet, EINMAL hier und wird zweimal gebraucht:
// einmal in der Meldung von `messeZelle`, einmal beim Einordnen in K1/K2. Zwei Abschriften wären
// die Stelle, an der die Kalibrierung eines Tages einen anderen Satz sucht als den, der kommt.
const SPERRE_VERLETZT = "ist SICHTBAR, obwohl die Rollenabnahme";
const GEGENPOL_VERLETZT = "ist für den BERECHTIGTEN Akteur nicht sichtbar";

/**
 * Die drei Arten, wie ein Kalibrierversuch ROT werden kann — und sie sind nicht dasselbe.
 *
 * Der vierte Ausgang („grün geblieben") kommt hier nicht vor: er wirft gar nicht, und der Aufrufer
 * erkennt ihn daran, dass `messeZelle` zurückkehrt.
 */
type Ausgang = "kalibriert" | "andere-zusicherung" | "messfehler";

/**
 * Eine Zusicherung von Vitest — oder ein Fehler des Messwegs?
 *
 * `expect(...).toBe(...)` wirft einen `AssertionError`; ein geworfener `Error` aus einer Abfrage,
 * einem Selektor, dem Browser oder dem Messaufbau dieser Datei trägt den Namen `Error`. Die
 * Unterscheidung hängt damit an EINER Eigenschaft, und sie ist belegt: der Kalibrierlauf zeigt für
 * jede Zelle, welcher Ausgang eingetreten ist — käme sie durcheinander, stünde das Ergebnis unter
 * „Messfehler" und nicht unter „kalibriert".
 *
 * KEIN eigener Fehler dieser Datei heisst `AssertionError`; die Vorbedingungen des Messaufbaus in
 * K2 werfen bewusst ein gewöhnliches `Error` mit dem Vorsatz `MESSAUFBAU`.
 */
function istZusicherung(fehler: unknown): boolean {
  return fehler instanceof Error && fehler.name === "AssertionError";
}

/** Welcher der drei roten Ausgänge war es? `erwarteterSatz` ist der Satz, den die Kalibrierung will. */
function ordneEin(fehler: unknown, erwarteterSatz: string, marke: string): Ausgang {
  if (!istZusicherung(fehler)) {
    return "messfehler";
  }
  return String((fehler as Error).message).includes(erwarteterSatz) &&
    String((fehler as Error).message).includes(marke)
    ? "kalibriert"
    : "andere-zusicherung";
}

/**
 * Eine Bestandslesung ist NUR gültig, wenn sie keine Mängel trägt — geprüft, bevor sie in einen
 * Vergleich geht (Runde 2, Korrekturpflicht 1).
 *
 * Sie steht als eigene Funktion da, damit VORHER und NACHHER durch dieselbe Prüfung gehen und
 * keine der beiden Seiten stillschweigend milder behandelt wird.
 */
function pruefeLesung(lesung: Bestandslesung, was: string): void {
  expect(
    lesung.maengel,
    `${was} ist keine gültige Bestandslesung — ${lesung.maengel.join(" · ")}. Gelesen: ${lesung.gelesen}. Zwei gleiche Fehlanzeigen sind kein „unverändert".`,
  ).toEqual([]);
}

describe("JOB 4326 · fünf Rollen an fünf Türen im echten Chromium gegen echtes PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  let flaeche = "nicht hergestellt";
  let pool: Pool | undefined;
  let strecke: Strecke | undefined;
  let adminApi: Sitzung | undefined;
  let umgebung: Umgebung | undefined;
  let aufbau: TuerAufbau | undefined;
  const rollenDb = `klarwerk_rollensicht_test_${`${Date.now()}`.slice(-9)}`;
  const protokoll: string[] = [];

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die Kette aus Browser, Fläche und echter PostgreSQL ist damit nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${rollenDb}`);
    flaeche = stelleFlaecheBereit();
    browser = await starteChromium();

    // ── Der Stand, gegen den alle Fälle dieser Datei messen. ──────────────────────────────────
    pool = createPool(pgUrl(verbindung, rollenDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
    for (const konto of ROLLENKONTEN) {
      mussGelingen(
        `Konto ${konto.rolle}`,
        await gastAnlegen(adminApi, {
          name: `Prüfkonto ${konto.rolle}`,
          email: konto.email,
          role: konto.rolle,
        }),
        201,
      );
    }
    const pruefKo = await wissensobjektAnlegen(adminApi, PRUEF_TITEL);
    const papierkorbKo = await wissensobjektAnlegen(adminApi, PAPIERKORB_TITEL);
    mussGelingen(
      `DELETE /api/kos/${papierkorbKo}`,
      await adminApi.sende("DELETE", `/api/kos/${papierkorbKo}`),
      204,
    );
    aufbau = { pruefKo, papierkorbKo, neueAnschrift: NEUE_ANSCHRIFT };

    const pgVersion = await pool.query<{ version: string }>("SELECT version() AS version");
    umgebung = {
      chromium: (browser as unknown as { version(): string }).version(),
      socket: strecke.basis.replace(/^https?:\/\//, ""),
      postgres: (pgVersion.rows[0]?.version ?? "(keine Auskunft)").split(" on ")[0] ?? "(leer)",
    };
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    if (protokoll.length > 0) {
      process.stderr.write(
        `${JOB} PROTOKOLL (${protokoll.length} Zeilen):\n${protokoll.join("\n")}\n`,
      );
    }
    await browser?.close();
    try {
      await strecke?.schliessen();
    } finally {
      await pool?.end();
    }
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${rollenDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
  }, 300_000);

  /** Der Stand dieses Laufs — einmal geprüft, danach ohne `undefined`-Fragen benutzbar. */
  function stand(): {
    pool: Pool;
    strecke: Strecke;
    adminApi: Sitzung;
    umgebung: Umgebung;
    aufbau: TuerAufbau;
    browser: Browser;
  } {
    if (!pool || !strecke || !adminApi || !umgebung || !aufbau || !browser) {
      throw new Error(
        `${JOB}: der Prüfstand steht nicht — dieser Fall hätte übersprungen werden müssen.`,
      );
    }
    return { pool, strecke, adminApi, umgebung, aufbau, browser };
  }

  /** Ein frisches Browserprofil je Akteur, angemeldet — oder anonym, ohne jeden Keks. */
  async function kontextFuer(akteur: Akteur): Promise<AkteursKontext> {
    const { strecke: s, browser: b } = stand();
    const { kontext, seite } = await profil(b, BREIT);
    if (akteur !== "anonym") {
      const email = akteur === "admin" ? ADMIN : KONTEN[akteur];
      await anmeldenAnDerMaske(seite, s.basis, email, PASSWORT);
    }
    return { akteur, kontext, seite };
  }

  /**
   * EINE ZELLE: ein Akteur an einer Tür, mit allen Nachweisen, die sein Soll verlangt.
   *
   * Sie steht als eigene Funktion da, weil die Kalibrierung 5a sie UNVERÄNDERT gegen einen
   * erhöhten Bestand fahren muss. Zwei Abschriften — eine für den Nachweis, eine für die
   * Kalibrierung — wären genau die Bauform, in der die Kalibrierung eines Tages etwas anderes
   * prüft als der Nachweis, den sie kalibriert.
   */
  async function messeZelle(
    k: AkteursKontext,
    tuer: Tuer,
    /**
     * Ein Eingriff NACH dem Laden der Tür und VOR jeder Messung — der einzige Weg, mit dem die
     * Kalibrierung 5b die Fläche verstellen kann, ohne dass diese Funktion sich ändert. Sie ist es,
     * die kalibriert wird; eine zweite, danebengeschriebene Fassung prüfte eines Tages etwas
     * anderes als der Nachweis.
     */
    nachOeffnen?: (seite: Seite) => Promise<void>,
  ): Promise<string> {
    const { pool: p, strecke: s, umgebung: u, aufbau: a } = stand();
    const soll: Erwartung = eintrag(tuer.erwartet[k.akteur]).soll;
    const marke = `${tuer.nr} ${tuer.methode} ${tuer.route(a)}`;
    const wer = `${k.akteur} an ${marke}`;

    const vorher = await tuer.bestand(p, a);
    pruefeLesung(vorher, `${wer}: der ${tuer.bestandsname}-Bestand VORHER`);
    await oeffneTuer(k.seite, `${s.basis}${tuer.seite}`, tuer.knopf, SPERRSATZ, wer);
    if (nachOeffnen) {
      await nachOeffnen(k.seite);
    }

    // ── (a) NICHTS ZUM ANKLICKEN — oder, beim Berechtigten, das sichtbare Bedienelement. ──────
    const knopf = await knopfBefund(k.seite, tuer.knopf);
    expect(
      knopf.verfahren,
      `${wer}: die Sichtbarkeit wurde nicht mit \`Element.checkVisibility\` gemessen (${knopf.grund}) — ohne dieses Verfahren ist der Nachweis nicht erbracht`,
    ).toBe("checkVisibility");

    let flaechenbefund: string;
    if (soll === "erlaubt") {
      expect(
        knopf.sichtbar,
        `${wer}: ${tuer.knopf.name} ${GEGENPOL_VERLETZT} (da=${knopf.da}, ${knopf.grund}). Ohne diesen Gegenpol beweist „kein Knopf" beim Gesperrten nichts.`,
      ).toBe(true);
      expect(
        knopf.text.length,
        `${wer}: ${tuer.knopf.name} ist sichtbar, trägt aber keinen gerenderten Text (\`innerText\` leer)`,
      ).toBeGreaterThan(0);
      // REGELN.md 9: „Ein sichtbarer Container belegt nicht, dass sein gesamter `innerText`
      // sichtbar ist." Für T4 IST das Bedienelement eine Karte, also ein Container. Deshalb wird
      // zusätzlich die BESCHRIFTUNG an dem Element gemessen, das sie in eigenen Textknoten trägt —
      // aus dem Sprachkatalog gelesen, nicht abgeschrieben.
      const schrift = await textTraeger(k.seite, tuer.beschriftung);
      expect(
        schrift.sichtbar,
        `${wer}: die Beschriftung „${tuer.beschriftung}" ist nicht sichtbar (da=${schrift.da}, ${schrift.grund}) — ein sichtbarer Rahmen ohne sichtbaren Text ist kein Zugang`,
      ).toBe(true);
      flaechenbefund = `"${schrift.text.replace(/\s+/g, " ").slice(0, 80)}"`;
    } else if (k.akteur === "anonym") {
      const maske = await sichtbarkeit(k.seite, "#auth-email");
      expect(
        maske.sichtbar,
        `${wer}: der Deep-Link zeigt einem Unangemeldeten keine sichtbare Anmeldemaske (#auth-email: da=${maske.da}, ${maske.grund})`,
      ).toBe(true);
      expect(
        knopf.sichtbar,
        `${wer}: ${tuer.knopf.name} ist für einen Unangemeldeten sichtbar (${knopf.grund})`,
      ).toBe(false);
      flaechenbefund = "Anmeldemaske (kein Knopf)";
    } else {
      expect(
        knopf.sichtbar,
        `${wer}: ${tuer.knopf.name} ${SPERRE_VERLETZT} für diesen Akteur „${soll}" führt (${knopf.grund}, Text: „${knopf.text}")`,
      ).toBe(false);
      const karte = await textTraeger(k.seite, SPERRSATZ);
      expect(
        karte.sichtbar,
        `${wer}: die Sperrkarte „${SPERRSATZ}" ist nicht sichtbar (da=${karte.da}, ${karte.grund}) — weder Knopf noch Erklärung, das ist die stille Sackgasse`,
      ).toBe(true);
      flaechenbefund = `"${karte.text.replace(/\s+/g, " ")}"`;
    }

    // ── Der Navigationspunkt derselben Tür, dort wo es ihn gibt. ──────────────────────────────
    let menuebefund = "";
    if (tuer.menuepunkt && k.akteur !== "anonym") {
      if (tuer.menuepunkt.oeffnen) {
        await k.seite.click(tuer.menuepunkt.oeffnen);
      }
      const punkt = await sichtbarkeit(k.seite, tuer.menuepunkt.sel);
      expect(
        punkt.sichtbar,
        `${wer}: ${tuer.menuepunkt.name} ist ${punkt.sichtbar ? "sichtbar" : "nicht sichtbar"}, erwartet war ${soll === "erlaubt" ? "sichtbar" : "nicht sichtbar"} (${punkt.grund})`,
      ).toBe(soll === "erlaubt");
      menuebefund = ` · Menüpunkt: ${punkt.sichtbar ? "sichtbar" : "nicht sichtbar"}`;
      if (tuer.menuepunkt.oeffnen) {
        await k.seite.click(tuer.menuepunkt.oeffnen);
      }
    }

    // ── (b) DER VERSUCH AM DRAHT — nur beim Gesperrten. ───────────────────────────────────────
    //
    // Am BERECHTIGTEN wird ausdrücklich nichts ausgelöst (Lieferung 4): gemessen ist dort die
    // Sichtbarkeit, nicht der Vorgang — der ist in `schreibende-tueren-am-draht.test.ts` gemessen.
    let drahtbefund = "nicht ausgeführt (kein Vorgang am Berechtigten)";
    if (soll !== "erlaubt") {
      const antwort = await amDraht(k.seite, tuer.methode, tuer.route(a), tuer.rumpf(a));
      const erwarteterStatus = soll === "401" ? 401 : 403;
      expect(
        antwort.status,
        `${wer}: die Tür antwortete ${antwort.status} statt ${erwarteterStatus} — Rumpf: ${antwort.rumpf.slice(0, 400)}`,
      ).toBe(erwarteterStatus);
      const code = erwarteterCode(tuer.codes ? { codes: tuer.codes } : {}, soll);
      expect(
        antwort.error,
        `${wer}: der Fehlerschlüssel lautet „${antwort.error}" statt „${code}" — eine ${erwarteterStatus} allein belegt nicht, dass DAS TOR nein gesagt hat`,
      ).toBe(code);
      expect(
        antwort.message.length,
        `${wer}: die Antwort trägt keine Meldung (\`message\` leer) — ein Rohfehler ohne Satz`,
      ).toBeGreaterThan(0);
      expect(
        `${antwort.rumpf} ${antwort.message}`,
        `${wer}: die Antwort trägt einen Rohfehler statt einer Katalogmeldung — ${antwort.rumpf.slice(0, 400)}`,
      ).not.toContain("Internal Server Error");
      expect(
        antwort.message,
        `${wer}: die Meldung enthält eine fünfstellige Ziffernfolge (SQLSTATE-Verdacht): „${antwort.message}"`,
      ).not.toMatch(/\d{5}/);
      if (soll === "403" && tuer.recht !== null) {
        expect(
          antwort.message,
          `${wer}: die Meldung ist nicht der Katalogsatz zu „${tuer.recht}" — gelesen: „${antwort.message}"`,
        ).toBe(meldung("PERMISSION_MISSING", "de", [tuer.recht]));
      }
      drahtbefund = `${antwort.status} ${antwort.error} · „${antwort.message}"`;
    }

    // ── (c) DER BESTAND IST DERSELBE — und BEIDE Lesungen sind für sich gültig. ───────────────
    //
    // RUNDE 2, BENs Gegenprobe: bis hierher verglich diese Stelle zwei TEXTE. Verfehlte die
    // Abfrage ihr Objekt, standen links und rechts zwei gleiche Ersatztexte, und der Vergleich war
    // grün. Deshalb geht jede Lesung zuerst EINZELN durch `pruefeLesung` (genau eine Zeile,
    // Pflichtfelder gefüllt, Inhaltszusage erfüllt) und erst danach in den Gleichheitsvergleich.
    const nachher = await tuer.bestand(p, a);
    pruefeLesung(nachher, `${wer}: der ${tuer.bestandsname}-Bestand NACHHER`);
    expect(
      nachher.wert,
      `${wer}: der ${tuer.bestandsname}-Bestand hat sich verändert (${vorher.wert} → ${nachher.wert}) — die Sperre hat nicht getragen`,
    ).toBe(vorher.wert);

    return `Chromium ${u.chromium} · Socket ${u.socket} · PostgreSQL ${u.postgres} · ${k.akteur} · ${marke} · sichtbar: ${flaechenbefund}${menuebefund} · Draht: ${drahtbefund} · ${tuer.bestandsname}: ${vorher.wert}→${nachher.wert}`;
  }

  it("R1 — fünf Akteure, fünf Türen: kein Knopf oder Sperrkarte, Katalogmeldung, Bestand unverändert", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const { pool: p, adminApi: api, aufbau: a } = stand();
    process.stderr.write(`${JOB} R1 läuft · Fläche: ${flaeche}\n`);

    // ── Die Rolle steht in der DATENBANK, nicht nur in der Antwort von eben. ──────────────────
    for (const konto of ROLLENKONTEN) {
      const zeile = await p.query<{ role: string }>("SELECT role FROM users WHERE email = $1", [
        konto.email,
      ]);
      expect(
        zeile.rows[0]?.role,
        `die Rolle von ${konto.email} steht nicht als „${konto.rolle}" in users`,
      ).toBe(konto.rolle);
    }
    const papierkorb = await p.query<{ anzahl: string }>(
      "SELECT count(*)::text AS anzahl FROM kos WHERE id = $1 AND deleted_at_key IS NOT NULL",
      [a.papierkorbKo],
    );
    expect(papierkorb.rows[0]?.anzahl, "das Papierkorbobjekt liegt nicht im Papierkorb").toBe("1");

    // T5 trägt einen zweiten Bestandsgriff: die Selbstauskunft der Instanz über den Demobestand.
    const demoVorher = await api.sende("GET", "/api/admin/demo-seed");
    expect(
      (demoVorher.json as { present?: unknown }).present,
      "vor dem Lauf liegt schon ein Demobestand",
    ).toBe(false);

    for (const akteur of AKTEURE) {
      const k = await kontextFuer(akteur);
      try {
        for (const tuer of TUEREN) {
          const zeile = await messeZelle(k, tuer);
          protokoll.push(zeile);
          process.stderr.write(`${JOB} ${zeile}\n`);
        }
      } finally {
        await k.kontext.close();
      }
    }

    const demoNachher = await api.sende("GET", "/api/admin/demo-seed");
    expect(
      (demoNachher.json as { present?: unknown }).present,
      "nach allen Versuchen führt die Instanz einen Demobestand — eine der Sperren an T5 hat nicht getragen",
    ).toBe(false);
    expect(protokoll.length, "es fehlen Protokollzeilen (5 Akteure × 5 Türen)").toBe(
      AKTEURE.length * TUEREN.length,
    );
  }, 900_000);

  // ------------------------------------------------------------------------------------------------
  // KALIBRIERUNG 5a — DIE ROLLE IM BESTAND ERHÖHT: VIER SCHRITTE, JEDER EINZELN BELEGT.
  // ------------------------------------------------------------------------------------------------
  //
  // RUNDE 2 · BENs KORREKTURPFLICHT 2, wörtlich: „K1 erreicht die geforderten erfolgreichen
  // Drahtantworten 201/200 nicht: `messeZelle` scheitert vorher an der Sichtbarkeit … fängt diesen
  // Fehler und beendet die Zelle. Lieferung 5a ist damit unvollständig." Und: „ein gezielt
  // ausgelöster Messfehler darf nicht als ‚KALIBRIERUNG GRIFF' gelten."
  //
  // DESHALB STEHEN JETZT VIER SCHRITTE DA, in dieser Reihenfolge, und keiner davon versteckt sich
  // hinter einem anderen:
  //
  //   A · ERHÖHEN. `UPDATE users SET role = 'admin'`, im Bestand nachgelesen.
  //   B · DIE ERHÖHUNG WIRKT — an der Fläche UND am Draht. Je Tür: der Knopf ist jetzt SICHTBAR;
  //       der Versuch am Draht antwortet mit dem ERFOLGSSTATUS der Rollenabnahme (T4: 201,
  //       T5: 200, `erfolgsstatus` aus `schreibende-tueren.ts`); und der Bestand hat sich danach
  //       WIRKLICH verändert. Ohne den letzten Punkt bewiese ein 200 nichts — `demo-seed` antwortet
  //       auch dann 200, wenn es nichts tut (`schreibende-tueren.ts` begründet das an seiner Zeile).
  //   C · DIE SPERRPRÜFUNG ZERBRICHT. `messeZelle` UNVERÄNDERT — dieselbe Funktion, die R1 grün
  //       fährt. Ihr Fehler wird EINGEORDNET (`ordneEin`): nur eine Zusicherung, die den Satz
  //       `SPERRE_VERLETZT` UND die Marke dieser Zelle trägt, gilt als kalibriert. Jede andere
  //       Zusicherung und jeder Messwegfehler sind eigene, getrennt gemeldete rote Ausgänge.
  //   D · ZURÜCKSTELLEN, und zwar nachgewiesen: Rolle zurück auf `viewer`, im Bestand nachgelesen,
  //       und die Tür antwortet dem zurückgestellten Konto WIEDER 403 mit dem Katalogsatz. Eine
  //       Rückstellung, die nur in der Spalte steht, ist an der Tür nicht belegt.
  //
  // Die Nebenwirkungen von B (ein angelegtes Konto, ein geladener Demobestand) werden danach über
  // die echten Wege des Admins abgeräumt und das Ergebnis gemeldet.
  it("K1 — Kalibrierung a: erhöhte Rolle im Bestand macht die Sperrprüfung rot", async (ctx) => {
    if (!verfuegbar || !KALIBRIERUNG) {
      process.stderr.write(
        `${JOB} K1 UEBERSPRUNGEN: ${verfuegbar ? "KLARWERK_KALIBRIERUNG ist nicht 1 — die Kalibrierung ist ein eigener, absichtlich roter Lauf" : "kein Prüfstand (keine PostgreSQL)"}\n`,
      );
      ctx.skip();
      return;
    }
    const { pool: p, strecke: s, adminApi: api, aufbau: a } = stand();
    const k = await kontextFuer("viewer");
    const tueren = ["T4", "T5"].map((nr) => {
      const tuer = TUEREN.find((t) => t.nr === nr);
      if (!tuer) {
        throw new Error(`${JOB}: Tür ${nr} fehlt in TUEREN`);
      }
      return tuer;
    });
    const gruenGeblieben: string[] = [];
    const andereZusicherung: string[] = [];
    const messfehler: string[] = [];
    const kalibriert: string[] = [];
    try {
      // ── A · ERHÖHEN ─────────────────────────────────────────────────────────────────────────
      await p.query("UPDATE users SET role = 'admin' WHERE email = $1", [KONTEN.viewer]);
      const erhoeht = await p.query<{ role: string }>("SELECT role FROM users WHERE email = $1", [
        KONTEN.viewer,
      ]);
      expect(erhoeht.rows[0]?.role, "die Erhöhung ist nicht im Bestand angekommen").toBe("admin");
      process.stderr.write(
        `${JOB} K1 A: role(${KONTEN.viewer}) = admin (im Bestand nachgelesen)\n`,
      );

      // ── B · DIE ERHÖHUNG WIRKT: Knopf sichtbar, Draht 201/200, Bestand verändert ────────────
      for (const tuer of tueren) {
        const marke = `${tuer.nr} ${tuer.methode} ${tuer.route(a)}`;
        const soll = erfolgsstatus(tuer.methode, tuer.registrierteRoute);
        const vorher = await tuer.bestand(p, a);
        pruefeLesung(vorher, `K1 B ${tuer.nr}: der ${tuer.bestandsname}-Bestand VORHER`);
        await oeffneTuer(
          k.seite,
          `${s.basis}${tuer.seite}`,
          tuer.knopf,
          SPERRSATZ,
          `K1 B ${marke}`,
        );
        const knopf = await knopfBefund(k.seite, tuer.knopf);
        expect(
          knopf.sichtbar,
          `K1 B ${marke}: ${tuer.knopf.name} ist nach der Rollenerhöhung NICHT sichtbar (da=${knopf.da}, ${knopf.grund}) — dann ist die Erhöhung an der Fläche nicht angekommen und die Kalibrierung misst nicht, was sie behauptet`,
        ).toBe(true);
        const antwort = await amDraht(k.seite, tuer.methode, tuer.route(a), tuer.rumpf(a));
        expect(
          soll,
          `K1 B ${marke}: der Draht antwortete ${antwort.status} ${antwort.error}, erwartet war einer von [${soll.join(", ")}] — Rumpf: ${antwort.rumpf.slice(0, 400)}`,
        ).toContain(antwort.status);
        const nachher = await tuer.bestand(p, a);
        pruefeLesung(nachher, `K1 B ${tuer.nr}: der ${tuer.bestandsname}-Bestand NACHHER`);
        expect(
          nachher.wert,
          `K1 B ${marke}: der Vorgang meldete Erfolg (${antwort.status}), aber der ${tuer.bestandsname}-Bestand ist unverändert (${vorher.wert}) — ein Erfolgsstatus ohne Wirkung belegt keinen ausgeführten Vorgang`,
        ).not.toBe(vorher.wert);
        const zeile = `K1 B · ${marke} · Knopf sichtbar: "${knopf.text.replace(/\s+/g, " ").slice(0, 60)}" · Draht: ${antwort.status} (erlaubt [${soll.join(", ")}]) · ${tuer.bestandsname}: ${vorher.wert}→${nachher.wert}`;
        kalibriert.push(zeile);
        process.stderr.write(`${JOB} ${zeile}\n`);
      }

      // ── C · DIE SPERRPRÜFUNG ZERBRICHT — und NUR sie zählt als Kalibrierung ────────────────
      for (const tuer of tueren) {
        const marke = `${tuer.nr} ${tuer.methode} ${tuer.route(a)}`;
        try {
          const zeile = await messeZelle(k, tuer);
          gruenGeblieben.push(`${tuer.nr}: GRÜN GEBLIEBEN — ${zeile}`);
        } catch (fehler) {
          const erste = String(fehler).split("\n")[0] ?? "(keine Meldung)";
          switch (ordneEin(fehler, SPERRE_VERLETZT, marke)) {
            case "kalibriert":
              kalibriert.push(`K1 C · ${tuer.nr}: rot wie verlangt — ${erste}`);
              break;
            case "andere-zusicherung":
              andereZusicherung.push(`${tuer.nr}: ${erste}`);
              break;
            default:
              messfehler.push(`${tuer.nr}: ${erste}`);
          }
        }
      }

      // ── D · ZURÜCKSTELLEN, an der Tür belegt ───────────────────────────────────────────────
      await p.query("UPDATE users SET role = 'viewer' WHERE email = $1", [KONTEN.viewer]);
      const zurueck = await p.query<{ role: string }>("SELECT role FROM users WHERE email = $1", [
        KONTEN.viewer,
      ]);
      expect(zurueck.rows[0]?.role, "die Rolle ist im Bestand nicht zurückgestellt").toBe("viewer");
      for (const tuer of tueren) {
        const marke = `${tuer.nr} ${tuer.methode} ${tuer.route(a)}`;
        await oeffneTuer(
          k.seite,
          `${s.basis}${tuer.seite}`,
          tuer.knopf,
          SPERRSATZ,
          `K1 D ${marke}`,
        );
        const antwort = await amDraht(k.seite, tuer.methode, tuer.route(a), tuer.rumpf(a));
        expect(
          antwort.status,
          `K1 D ${marke}: nach der Rückstellung antwortet die Tür ${antwort.status} statt 403 — die Rückstellung ist an der Tür nicht belegt. Rumpf: ${antwort.rumpf.slice(0, 300)}`,
        ).toBe(403);
        if (tuer.recht !== null) {
          expect(
            antwort.message,
            `K1 D ${marke}: nach der Rückstellung fehlt der Katalogsatz zu „${tuer.recht}" — gelesen: „${antwort.message}"`,
          ).toBe(meldung("PERMISSION_MISSING", "de", [tuer.recht]));
        }
        const zeile = `K1 D · ${marke} · zurückgestellt · Draht: ${antwort.status} ${antwort.error} · „${antwort.message}"`;
        kalibriert.push(zeile);
        process.stderr.write(`${JOB} ${zeile}\n`);
      }
      // Die Nebenwirkungen von B über die echten Admin-Wege abräumen, Ergebnis gemeldet.
      const entferntKonto = await api.sende("GET", "/api/users");
      const konto = (entferntKonto.json as { id: string; email: string }[]).find(
        (u) => u.email === a.neueAnschrift,
      );
      const loeschung = konto
        ? (await api.sende("DELETE", `/api/auth/users/${konto.id}`)).status
        : 0;
      const purge = await api.sende("DELETE", "/api/admin/demo-seed");
      process.stderr.write(
        `${JOB} K1 D: Nebenwirkungen abgeräumt — Konto ${a.neueAnschrift}: ${konto ? `DELETE → ${loeschung}` : "war nicht angelegt"} · Demobestand: DELETE → ${purge.status}\n`,
      );

      // ── Die drei roten Ausgänge, getrennt. Nur der letzte ist der gewollte. ────────────────
      expect(
        messfehler,
        `${JOB} K1: der Messweg ist ausgefallen (keine Zusicherung von Vitest) — das ist KEIN Kalibrierungserfolg, sondern ein Fehler des Prüfstands.`,
      ).toEqual([]);
      expect(
        andereZusicherung,
        `${JOB} K1: rot wurde eine ANDERE Zusicherung als die kalibrierte („${SPERRE_VERLETZT}") — damit ist die Sperrprüfung nicht kalibriert.`,
      ).toEqual([]);
      expect(
        gruenGeblieben,
        `${JOB} K1: die Sperrprüfung blieb für den ERHÖHTEN viewer grün — sie hängt damit nicht an der Rolle im Bestand, und der Nachweis aus R1 wäre nicht kalibriert.`,
      ).toEqual([]);
      throw new Error(
        `${JOB} K1 — KALIBRIERUNG GRIFF (dieser Fall ist absichtlich rot; Exit 1 ist hier das Ergebnis):\n${kalibriert.join("\n")}`,
      );
    } finally {
      // Sicherheitsnetz OHNE Zusicherung: der belegte Rückweg steht oben in Schritt D. Warf etwas
      // davor, stellt diese Zeile die Rolle trotzdem zurück — sie ist idempotent.
      await p
        .query("UPDATE users SET role = 'viewer' WHERE email = $1", [KONTEN.viewer])
        .catch(() => undefined);
      const netz = await p
        .query<{ role: string }>("SELECT role FROM users WHERE email = $1", [KONTEN.viewer])
        .catch(() => undefined);
      process.stderr.write(
        `${JOB} K1 Sicherheitsnetz: role(${KONTEN.viewer}) = ${netz?.rows[0]?.role ?? "(nicht lesbar)"}\n`,
      );
      await k.kontext.close();
    }
  }, 900_000);

  // ------------------------------------------------------------------------------------------------
  // KALIBRIERUNG 5b — DEN SICHTBAREN KNOPF AUSBLENDEN: DER GEGENPOL MUSS DARAN ZERBRECHEN.
  // ------------------------------------------------------------------------------------------------
  //
  // REGELN.md 9: „Kalibriere jede Sichtbarkeitsbehauptung durch gezieltes Ausblenden genau dieses
  // Elements bei sonst unveränderter Fläche." Genau das steht hier — und es ist der Fall, an dem ein
  // Nachweis über `querySelector !== null` NICHT auffiele: das Element bleibt im DOM, nur sichtbar
  // ist es nicht mehr. Kalibriert werden BEIDE Griffformen: T4 über den Selektor, T5 über die
  // Beschriftung.
  it("K2 — Kalibrierung b: ausgeblendeter Knopf macht den Gegenpol rot", async (ctx) => {
    if (!verfuegbar || !KALIBRIERUNG) {
      process.stderr.write(
        `${JOB} K2 UEBERSPRUNGEN: ${verfuegbar ? "KLARWERK_KALIBRIERUNG ist nicht 1 — die Kalibrierung ist ein eigener, absichtlich roter Lauf" : "kein Prüfstand (keine PostgreSQL)"}\n`,
      );
      ctx.skip();
      return;
    }
    const { aufbau: a } = stand();
    const k = await kontextFuer("admin");
    const gruenGeblieben: string[] = [];
    const andereZusicherung: string[] = [];
    const messfehler: string[] = [];
    const kalibriert: string[] = [];
    try {
      for (const nr of ["T4", "T5"]) {
        const tuer = TUEREN.find((t) => t.nr === nr);
        if (!tuer) {
          throw new Error(`${JOB}: Tür ${nr} fehlt in TUEREN`);
        }
        const marke = `${tuer.nr} ${tuer.methode} ${tuer.route(a)}`;
        // Der Eingriff läuft NACH dem Laden und VOR jeder Messung — derselbe Ablauf wie in R1,
        // eine einzige Fläche verstellt.
        //
        // RUNDE 2: Die beiden Vorbedingungen werfen einen GEWÖHNLICHEN Fehler und keine Zusicherung.
        // Das ist Absicht: sie gehören zum MESSAUFBAU, nicht zum kalibrierten Nachweis, und
        // `ordneEin` soll sie als Messfehler erkennen statt als Kalibrierungserfolg (BENs Befund).
        const ausblenden = async (seite: Seite): Promise<void> => {
          const getroffen = await seite.evaluate<string>(fn(AUSBLENDEN), tuer.knopf as Knopf);
          const danach = await knopfBefund(seite, tuer.knopf);
          process.stderr.write(
            `${JOB} K2 ${nr}: <${getroffen}> mit display:none verstellt · danach da=${danach.da} sichtbar=${danach.sichtbar} (${danach.grund})\n`,
          );
          if (getroffen === "(kein Element)") {
            throw new Error(
              `MESSAUFBAU K2 ${nr}: das Ausblenden hat kein Element getroffen — dann kalibriert dieser Fall nichts.`,
            );
          }
          if (!danach.da) {
            throw new Error(
              `MESSAUFBAU K2 ${nr}: das Element ist nach dem Ausblenden nicht mehr im DOM — dann prüfte der Gegenpol Anwesenheit statt Sichtbarkeit, und die Kalibrierung sagte nichts über REGELN.md 9.`,
            );
          }
        };
        try {
          const zeile = await messeZelle(k, tuer, ausblenden);
          gruenGeblieben.push(`${nr}: GRÜN GEBLIEBEN — ${zeile}`);
        } catch (fehler) {
          const erste = String(fehler).split("\n")[0] ?? "(keine Meldung)";
          switch (ordneEin(fehler, GEGENPOL_VERLETZT, marke)) {
            case "kalibriert":
              kalibriert.push(`K2 · ${nr}: rot wie verlangt — ${erste}`);
              break;
            case "andere-zusicherung":
              andereZusicherung.push(`${nr}: ${erste}`);
              break;
            default:
              messfehler.push(`${nr}: ${erste}`);
          }
        }
        await k.seite.evaluate<number>(fn(EINBLENDEN)).catch(() => -1);
      }
      expect(
        messfehler,
        `${JOB} K2: der Messweg oder der Messaufbau ist ausgefallen (keine Zusicherung von Vitest) — das ist KEIN Kalibrierungserfolg.`,
      ).toEqual([]);
      expect(
        andereZusicherung,
        `${JOB} K2: rot wurde eine ANDERE Zusicherung als die kalibrierte („${GEGENPOL_VERLETZT}") — damit ist der Gegenpol nicht kalibriert.`,
      ).toEqual([]);
      expect(
        gruenGeblieben,
        `${JOB} K2: der Gegenpol blieb grün, obwohl genau sein Element mit \`display:none\` verstellt war — er misst DOM-Anwesenheit statt Sichtbarkeit (REGELN.md 9).`,
      ).toEqual([]);
      throw new Error(
        `${JOB} K2 — KALIBRIERUNG GRIFF (dieser Fall ist absichtlich rot; Exit 1 ist hier das Ergebnis):\n${kalibriert.join("\n")}`,
      );
    } finally {
      const zurueck = await k.seite.evaluate<number>(fn(EINBLENDEN)).catch(() => -1);
      process.stderr.write(`${JOB} K2 zurückgestellt: ${zurueck} Element(e) wieder eingeblendet\n`);
      await k.kontext.close();
    }
  }, 900_000);
});
