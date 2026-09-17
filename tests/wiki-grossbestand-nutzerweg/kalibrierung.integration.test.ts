// ================================================================================================
// JOB 4271 · DIE KALIBRIERUNG — DIESELBEN PRÜFUNGEN WIE IM HAUPTLAUF, UNTER VERSTELLUNG.
// ================================================================================================
//
// WAS RUNDE 1 FALSCH GEMACHT HAT, in BENs Worten: „Kalibrierungen für sämtliche Zusagen 3–6
// vervollständigen. Originalprüfungen unter Verstellung ausführen; Adminzugriff ersetzt keine
// Filtermutation." Runde 1 stellte NEBEN den Hauptlauf vier ähnliche, eigens geschriebene Fälle —
// ob die Fälle DES HAUPTLAUFS unter einer Verstellung rot werden, war damit nicht gezeigt. Für die
// Zusagen 4 und 6 gab es überhaupt keine Verstellung.
//
// SEIT RUNDE 2 GIBT ES HIER KEINE EIGENE PRÜFUNG MEHR. Jeder Fall unten ruft GENAU DIE FUNKTION
// aus `zusagen.ts`, die auch `findet-im-grossbestand.integration.test.ts` ruft — und belegt in drei
// Phasen:
//
//     BASELINE   die Funktion läuft am unverstellten Bestand durch (grün),
//     MUTATION   eine einzige benannte Verstellung — dieselbe Funktion WIRFT, und zwar an der
//                erwarteten Zusicherung (der Wortlaut wird geprüft, nicht nur „irgendein Fehler"),
//     RÜCKNAHME  die Verstellung wird zurückgenommen — dieselbe Funktion läuft wieder durch.
//
// Eine Mutation, die grün bliebe, wäre ein Befund über den Nachweis und kein Formfehler; `mussRot`
// sagt das ausdrücklich.
//
// ================================================================================================
// WARUM AUCH HIER KEIN PRODUKTBUCHSTABE VERSTELLT WIRD.
// ================================================================================================
//
// Der Auftrag verlangt die Verstellung „in einer isolierten Kopie" und verbietet, das Produkt im
// Arbeitsbaum anzufassen (§5.7, §10). Verstellt wird deshalb nicht der QUELLTEXT, sondern der
// ZUSTAND, in dem das unveränderte Produkt läuft — in einer eigenen Wegwerf-Datenbank und in
// eigenen Browserprofilen:
//
//   KZ3a  DER DECKEL          Die Anwärterzahl eines Suchbegriffs wird über den Serverdeckel
//                             gedrückt (und wieder darunter). Derselbe Begriff, dieselbe sichtbare
//                             Trefferzahl — nur die Frage, ob das Ziel noch darunter ist.
//   KZ3b  DIE TASTATUR        Die Trefferzeilen bekommen im laufenden Browser `tabIndex="-1"`.
//                             Genau daran ist JOB 4223 Runde 1 zerlegt worden (`browserweg.ts:20-38`).
//   KZ4a  DER INHALT          BENs eigene Mutation: der sichtbare Fliesstext wird durch eine
//                             Anweisung ersetzt, die das GEGENTEIL sagt — bei ERHALTENEM Suchwort
//                             und erhaltenem Titel. Runde 1 blieb dabei grün.
//   KZ4b  DIE FASSUNG         Die sichtbare Fassungszahl wird verstellt.
//   KZ5   DIE ABSCHIRMUNG     Die Stufe der fremden Einträge wandert von `vertraulich` auf `intern`.
//                             DAS ist die Filtermutation: derselbe Mensch, dieselbe Rolle, derselbe
//                             Code — nur hat der Sichtbarkeitsfilter nichts mehr auszuschliessen.
//                             (Adminzugriff wäre ein anderer Mensch und hat BEN zu Recht nicht
//                             genügt.)
//   KZ6   DER ENTZUG          Der Entzug wird zurückgenommen — der gesperrte Weg trägt wieder.
//   KZ1   DAS ZIEL FEHLT      Das Zieldokument wandert über den Produktweg in den Papierkorb und
//                             wieder heraus.
//
// KEINE PRODUKTIVDATEN: eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
// KEIN STILLER SKIP: ohne PostgreSQL steht der Grund auf stderr.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { LIBRARY_SEARCH_HIT_LIMIT } from "../../services/library-analytics/src/service";
import { type Browser, DIST, fn, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  mussGelingen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  type Eintragsplan,
  GEHEIMWORT,
  HERKUNFT,
  VOLLTEXT_BEGRIFF,
  ZIEL_KENNUNG,
  ZIEL_TITEL,
  bauplan,
  schreibeBericht,
  seedeGrossbestand,
} from "./bestand";
import { JOB, frischerNutzerInDerBibliothek } from "./nutzerweg";
import {
  type FrischeSeite,
  type Zielbeleg,
  liesZielAusDerSpalte,
  zusage3FindetUndOeffnet,
  zusage4RichtigeQuelleFassungInhalt,
  zusage5FremdeBleibenDraussen,
  zusage6EntzugSperrt,
} from "./zusagen";

const ADMIN = "kal-admin@grossbestand-4271.test";
const NUTZER = "kal-neuling@grossbestand-4271.test";
const PG_SCHEMA = "postgresql:";

/** Die Deckelfamilie: so viele Ablenker, dass sie mit dem Ziel ÜBER dem Serverdeckel liegt. */
const TERM_DECKEL = "Deckelprobegross";
const DECKEL_ABLENKER = 240;
/** Die Kennung des Kalibrierziels dieser Familie. */
const DECKEL_KENNUNG = "KA-4271-00002";
const DECKEL_TITEL = "Kalibrierziel ohne Begriff im Titel";
/**
 * Wie viele Ablenker in den Papierkorb müssen, damit Ziel + Ablenker gerade noch auf den Deckel
 * passen: 240 − 41 = 199 Ablenker plus ein Ziel = 200 Anwärter auf 200 Plätze.
 */
const UNTER_DEN_DECKEL = DECKEL_ABLENKER + 1 - LIBRARY_SEARCH_HIT_LIMIT;

/** Der Tab-Deckel, der in JEDER Phase von KZ3b gilt — sonst verglichen wir zwei Budgets. */
const TAB_DECKEL = 200;
/** Die Frist der Leersatz-Erwartung, gleich in Hauptlauf und Kalibrierung. */
const ZUSAGE6_FRIST = 60_000;

const ART = "best_practice" as const;

// ── DIE VERSTELLUNGEN AM LAUFENDEN BAUM ─────────────────────────────────────────────────────────

/** KZ3b — BENs Mutation aus JOB 4223, hier am laufenden Baum, nie am Quelltext des Produkts. */
const SETZE_TABINDEX = `() => {
  const zeilen = Array.prototype.slice.call(document.querySelectorAll('[data-testid="bib-zeile"]'));
  zeilen.forEach((z) => z.setAttribute("tabindex", "-1"));
  return zeilen.length;
}`;

const NIMM_TABINDEX_ZURUECK = `() => {
  const zeilen = Array.prototype.slice.call(document.querySelectorAll('[data-testid="bib-zeile"]'));
  zeilen.forEach((z) => z.removeAttribute("tabindex"));
  return zeilen.length;
}`;

/**
 * KZ4a — BENs Inhaltsmutation, wörtlich nach seiner Prüffrage: „Erhalte bei der Inhaltsmutation
 * Suchwort und Titel, ändere aber die Handlungsanweisung."
 *
 * Der neue Text sagt das GEGENTEIL der echten Anleitung (dort: erst lösen und entnehmen, dann
 * anfahren) und trägt das Suchwort weiterhin. Wer nur „enthält das Suchwort" prüft, merkt nichts.
 */
const FALSCHE_ANLEITUNG = `(begriff) => {
  const el = document.querySelector('[data-testid="bib-text"]');
  if (!el) return 0;
  window.__kw4271AltText = el.innerHTML;
  el.innerHTML = "<p>" + begriff + ": Presse SOFORT starten, den Pruefstift NICHT entnehmen.</p>";
  return el.innerHTML.length;
}`;

const NIMM_ANLEITUNG_ZURUECK = `() => {
  const el = document.querySelector('[data-testid="bib-text"]');
  if (!el || typeof window.__kw4271AltText !== "string") return false;
  el.innerHTML = window.__kw4271AltText;
  return true;
}`;

/** KZ4b — die sichtbare Fassungszahl im Abschnitt „Provenienz" wird verstellt. */
const FALSCHE_FASSUNG = `() => {
  const prov = document.querySelector('[data-bib-abschnitt="provenienz"]');
  if (!prov) return "(kein Provenienz-Abschnitt)";
  const blaetter = Array.prototype.slice.call(prov.querySelectorAll("div"));
  for (let i = 0; i < blaetter.length; i += 1) {
    const d = blaetter[i];
    const text = d.textContent || "";
    if (d.children.length === 0 && /(^|[^A-Za-z0-9])v[0-9]+/.test(text)) {
      window.__kw4271AltFassung = text;
      d.textContent = text.replace(/v[0-9]+/, "v9");
      return text;
    }
  }
  return "(keine Fassungszeile gefunden)";
}`;

const NIMM_FASSUNG_ZURUECK = `() => {
  const prov = document.querySelector('[data-bib-abschnitt="provenienz"]');
  if (!prov || typeof window.__kw4271AltFassung !== "string") return false;
  const blaetter = Array.prototype.slice.call(prov.querySelectorAll("div"));
  for (let i = 0; i < blaetter.length; i += 1) {
    const d = blaetter[i];
    if (d.children.length === 0 && /(^|[^A-Za-z0-9])v[0-9]+/.test(d.textContent || "")) {
      d.textContent = window.__kw4271AltFassung;
      return true;
    }
  }
  return false;
}`;

/**
 * Die Deckelfamilie: viele gut beleumundete Ablenker und ein Ziel, das den Begriff NUR im
 * Fliesstext trägt — dieselbe Lage wie beim echten Zieldokument, damit die Treffergüte des Ziels
 * nicht heimlich die Rettung ist.
 */
function deckelfamilie(): Eintragsplan[] {
  const plan: Eintragsplan[] = [];
  for (let i = 0; i < DECKEL_ABLENKER; i += 1) {
    const nr = String(i).padStart(4, "0");
    plan.push({
      gruppe: "deckel",
      eingabe: {
        title: `Notiz ${TERM_DECKEL} ${nr}`,
        statement: `Beschluss ${TERM_DECKEL} ${nr}.`,
        type: ART,
        category: "Protokoll",
        author: "kal-protokoll",
        bodyHtml: `<p>Im Protokoll wurde ${TERM_DECKEL} beilaeufig erwaehnt (${nr}).</p>`,
      },
      validierung: { trust: 90, status: "validiert" },
    });
  }
  plan.push({
    // Es ist ein ZIEL — nur eben das der Deckelprobe. `seedeGrossbestand` liest das Zieldokument
    // des Hauptbauplans als `nachGruppe.ziel[0]`; der steht davor, und dieser Lauf holt sich seine
    // Kennungen ohnehin aus der Spalte (`kennungVon`).
    gruppe: "ziel",
    eingabe: {
      title: DECKEL_TITEL,
      statement: `Dokumentnummer ${DECKEL_KENNUNG}.`,
      type: ART,
      category: "Handbuch",
      author: "kal-anna",
      bodyHtml: `<p>Hier steht ${TERM_DECKEL} im Fliesstext und nirgends sonst.</p>`,
    },
    // Trust 1 — derselbe Platz in der Ordnung wie im echten Bestand.
    validierung: { trust: 1, status: "validiert" },
  });
  return plan;
}

/**
 * Der Kalibrierbestand: DERSELBE Bauplan wie der Hauptlauf, nur ohne seinen Füllbestand — dasselbe
 * Zieldokument, dieselben zwanzig Ablenker, dieselben 160 Deckel-Ablenker, dieselben fünfzig
 * fremden vertraulichen Einträge, dieselbe Herkunftsgruppe. Dazu die eine Deckelfamilie.
 */
function kalibrierplan(): Eintragsplan[] {
  return [...bauplan({ fuellbestand: 0 }), ...deckelfamilie()];
}

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
    throw new Error(`${JOB}: die Datenbank traegt kein test im Namen.`);
  }
  return `${PG_SCHEMA}//${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}@${v.host}:${v.port}/${datenbank}`;
}

function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 900_000,
  });
  return `gebaut in ${Date.now() - begonnen} ms`;
}

describe("JOB 4271 · Kalibrierung — dieselben Prüfungen, unter Verstellung", () => {
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  let strecke: Strecke | undefined;
  let services: AppServices | undefined;
  let bestandsgroesse = 0;
  let zielKoId = "";
  let deckelZielId = "";
  let fremde: string[] = [];
  let beleg: Zielbeleg | undefined;
  /** Was jede Phase gemessen hat — wird am Ende als Laufartefakt geschrieben. */
  const belege: Record<string, string> = {};
  const kalDb = `klarwerk_kalibrierung_test_${`${Date.now()}`.slice(-9)}`;

  const frischeSeite: FrischeSeite = () =>
    frischerNutzerInDerBibliothek(browser as Browser, (strecke as Strecke).basis, NUTZER, PASSWORT);

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} KALIBRIERUNG UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL. Der Lauf gilt als UEBERSPRUNGEN, nicht als bestanden.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(`${JOB} KALIBRIERUNG UEBERSPRUNGEN: keine lesbare Verbindung.\n`);
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${kalDb}`);
    pool = createPool(pgUrl(verbindung, kalDb));
    await migrate(pool);

    services = buildPgServices(pool);
    const plan = kalibrierplan();
    bestandsgroesse = plan.length;
    const saat = await seedeGrossbestand(
      services.ko,
      async () => {
        const r = await (pool as Pool).query<{ n: string }>("SELECT count(*)::text AS n FROM kos");
        return Number(r.rows[0]?.n ?? "0");
      },
      plan,
    );
    fremde = saat.nachGruppe["fremd-vertraulich"];
    belege.seedmanifest = schreibeBericht(`kalibrier-seedmanifest-${kalDb}.json`, saat.manifest);
    process.stderr.write(
      `${JOB} KALIBRIERUNG Bestand: ${saat.manifest.gespeicherteAnzahl} gespeicherte Eintraege (geplant ${bestandsgroesse}) · Manifest: ${belege.seedmanifest} · Flaeche: ${stelleFlaecheBereit()}\n`,
    );
    expect(saat.manifest.gespeicherteAnzahl, "der Kalibrierbestand steht nicht vollstaendig").toBe(
      bestandsgroesse,
    );

    await services.ko.activateSearchProjectionV2();

    // Die technischen Kennungen kommen aus der SPALTE, nicht aus dem Seedergebnis und nie aus einer
    // Suche — dieselbe Regel wie im Hauptlauf.
    zielKoId = await kennungVon(ZIEL_KENNUNG);
    deckelZielId = await kennungVon(DECKEL_KENNUNG);
    beleg = await liesZielAusDerSpalte(pool, zielKoId);

    browser = await starteChromium();
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    const adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
    mussGelingen(
      "Testnutzer anlegen",
      await gastAnlegen(adminApi, { name: "Kalibriernutzer", email: NUTZER, role: "viewer" }),
      201,
    );
    verfuegbar = true;
  }, 1_800_000);

  afterAll(async () => {
    await browser?.close();
    try {
      await strecke?.schliessen();
    } finally {
      await pool?.end();
    }
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${kalDb} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
    const datei = schreibeBericht(`kalibrierbelege-${kalDb}.json`, belege);
    process.stderr.write(
      `${JOB} KALIBRIERBELEGE (abgelegt unter ${datei}): ${JSON.stringify(belege, null, 1)}\n`,
    );
  }, 300_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // KZ3a · ZUSAGE 3 — DER DECKEL. Dieselbe Funktion, derselbe Begriff, dieselbe Trefferzahl.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Die einzige Verstellung ist die Zahl der ANWÄRTER: 200 (gerade auf dem Deckel) gegen 241
  // (darüber). In beiden Phasen zeigt die Fläche 200 Treffer — der Unterschied ist einzig, ob das
  // Ziel darunter ist. Damit misst dieser Fall den Deckel und nicht die Listenlänge.
  it("KZ3a · Zusage 3 wird rot, sobald die Anwaerter ueber den Serverdeckel steigen — und wieder gruen darunter", async (ctx) => {
    if (!bereit(ctx)) {
      return;
    }
    const auftrag = {
      begriff: TERM_DECKEL,
      zielKoId: deckelZielId,
      zielTitel: DECKEL_TITEL,
      gesamtbestand: bestandsgroesse,
      erwarteteTreffer: LIBRARY_SEARCH_HIT_LIMIT,
      tabDeckel: 600,
    };

    // BASELINE: 41 Ablenker in den Papierkorb → 200 Anwaerter auf 200 Plaetze.
    const weggeraeumt = await ablenkerInDenPapierkorb(UNTER_DEN_DECKEL);
    expect(weggeraeumt.length, "es wurden nicht genug Ablenker weggeraeumt").toBe(UNTER_DEN_DECKEL);
    const gruen = await zusage3FindetUndOeffnet(frischeSeite, auftrag);
    expect(gruen.stand.zaehler).toBe(LIBRARY_SEARCH_HIT_LIMIT);
    belege.kz3aBaseline = `${DECKEL_ABLENKER - UNTER_DEN_DECKEL} Ablenker + 1 Ziel = ${LIBRARY_SEARCH_HIT_LIMIT} Anwaerter auf ${LIBRARY_SEARCH_HIT_LIMIT} Plaetze; Ziel in ${gruen.oeffnungsschritte} Tab-Anschlaegen geoeffnet, ${gruen.stand.zaehler} Treffer sichtbar.`;

    // MUTATION: dieselben 41 zurueck in den Bestand → 241 Anwaerter, Ziel faellt heraus.
    for (const id of weggeraeumt) {
      await (services as AppServices).ko.restore(id, "kal-4271");
    }
    belege.kz3aMutation = await mussRot(
      "KZ3a",
      () => zusage3FindetUndOeffnet(frischeSeite, auftrag),
      "steht NICHT in der sichtbaren Trefferliste",
    );

    // RUECKNAHME: wieder unter den Deckel — dieselbe Funktion traegt wieder.
    const nochmal = await ablenkerInDenPapierkorb(UNTER_DEN_DECKEL);
    expect(nochmal.length).toBe(UNTER_DEN_DECKEL);
    const wiederGruen = await zusage3FindetUndOeffnet(frischeSeite, auftrag);
    belege.kz3aRuecknahme = `zurueckgenommen: Ziel wieder in der Liste, geoeffnet in ${wiederGruen.oeffnungsschritte} Tab-Anschlaegen.`;
  }, 1_800_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // KZ3b · ZUSAGE 3 — DIE TASTATUR. `tabIndex="-1"` an den Trefferzeilen.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("KZ3b · Zusage 3 wird rot, sobald die Trefferzeile aus der Tabulatorreihenfolge faellt", async (ctx) => {
    if (!bereit(ctx)) {
      return;
    }
    const auftrag = {
      begriff: ZIEL_KENNUNG,
      zielKoId,
      zielTitel: ZIEL_TITEL,
      gesamtbestand: bestandsgroesse,
      erwarteteTreffer: 1,
      tabDeckel: TAB_DECKEL,
    };

    const gruen = await zusage3FindetUndOeffnet(frischeSeite, auftrag);
    belege.kz3bBaseline = `unverstellt in ${gruen.oeffnungsschritte} Tab-Anschlaegen geoeffnet (Deckel ${TAB_DECKEL}).`;

    belege.kz3bMutation = await mussRot(
      "KZ3b",
      () =>
        zusage3FindetUndOeffnet(frischeSeite, {
          ...auftrag,
          zwischenSucheUndOeffnen: async (seite) => {
            const n = await seite.evaluate<number>(fn(SETZE_TABINDEX));
            expect(n, "keine einzige Zeile wurde verstellt").toBeGreaterThan(0);
          },
        }),
      "nicht erreichbar",
    );

    const wieder = await zusage3FindetUndOeffnet(frischeSeite, {
      ...auftrag,
      zwischenSucheUndOeffnen: async (seite) => {
        await seite.evaluate<number>(fn(SETZE_TABINDEX));
        const n = await seite.evaluate<number>(fn(NIMM_TABINDEX_ZURUECK));
        expect(n, "die Ruecknahme fand keine Zeile").toBeGreaterThan(0);
      },
    });
    belege.kz3bRuecknahme = `gesetzt und zurueckgenommen: wieder erreichbar in ${wieder.oeffnungsschritte} Tab-Anschlaegen.`;
  }, 1_200_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // KZ4 · ZUSAGE 4 — DER INHALT UND DIE FASSUNG. Das ist BENs Befund aus Runde 1.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("KZ4 · Zusage 4 wird rot bei gegenteiligem Fliesstext (Suchwort erhalten) und bei falscher Fassung", async (ctx) => {
    if (!bereit(ctx)) {
      return;
    }
    const z = beleg as Zielbeleg;
    const auftrag = {
      begriff: ZIEL_KENNUNG,
      gesamtbestand: bestandsgroesse,
      tabDeckel: TAB_DECKEL,
    };

    const gruen = await zusage4RichtigeQuelleFassungInhalt(frischeSeite, z, auftrag);
    belege.kz4Baseline = `unverstellt: Fliesstext (${gruen.stand.fliesstext.length} Zeichen), Quellen ${JSON.stringify(gruen.stand.quellenChips)}, Fassung v${gruen.stand.fassung} — gleich der Spalte.`;

    // ── MUTATION a: die gegenteilige Anleitung, Suchwort und Titel erhalten ────────────────────
    belege.kz4aMutation = await mussRot(
      "KZ4a",
      () =>
        zusage4RichtigeQuelleFassungInhalt(frischeSeite, z, {
          ...auftrag,
          vorDerPruefung: async (seite) => {
            const n = await seite.evaluate<number>(fn(FALSCHE_ANLEITUNG), VOLLTEXT_BEGRIFF);
            expect(n, "der Fliesstext wurde nicht verstellt").toBeGreaterThan(0);
          },
        }),
      "der SICHTBARE Fliesstext ist nicht der Fliesstext aus der Spalte",
    );
    // Und der Beleg, dass die Mutation wirklich BENs Mutation war: das Suchwort stand noch drin.
    expect(belege.kz4aMutation, "die Mutation hat das Suchwort mit entfernt").toContain(
      VOLLTEXT_BEGRIFF,
    );

    const zurueckA = await zusage4RichtigeQuelleFassungInhalt(frischeSeite, z, {
      ...auftrag,
      vorDerPruefung: async (seite) => {
        await seite.evaluate<number>(fn(FALSCHE_ANLEITUNG), VOLLTEXT_BEGRIFF);
        expect(
          await seite.evaluate<boolean>(fn(NIMM_ANLEITUNG_ZURUECK)),
          "die Ruecknahme des Fliesstextes griff nicht",
        ).toBe(true);
      },
    });
    belege.kz4aRuecknahme = `gesetzt und zurueckgenommen: ${zurueckA.stand.fliesstext.length} Zeichen, wieder gleich der Spalte.`;

    // ── MUTATION b: die falsche Fassung ────────────────────────────────────────────────────────
    belege.kz4bMutation = await mussRot(
      "KZ4b",
      () =>
        zusage4RichtigeQuelleFassungInhalt(frischeSeite, z, {
          ...auftrag,
          vorDerPruefung: async (seite) => {
            const alt = await seite.evaluate<string>(fn(FALSCHE_FASSUNG));
            expect(alt, `die Fassungszeile wurde nicht gefunden: ${alt}`).toMatch(/v[0-9]+/);
          },
        }),
      "steht nicht die aktive Fassung",
    );

    const zurueckB = await zusage4RichtigeQuelleFassungInhalt(frischeSeite, z, {
      ...auftrag,
      vorDerPruefung: async (seite) => {
        await seite.evaluate<string>(fn(FALSCHE_FASSUNG));
        expect(
          await seite.evaluate<boolean>(fn(NIMM_FASSUNG_ZURUECK)),
          "die Ruecknahme der Fassungszeile griff nicht",
        ).toBe(true);
      },
    });
    belege.kz4bRuecknahme = `gesetzt und zurueckgenommen: wieder v${zurueckB.stand.fassung}.`;
  }, 1_800_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // KZ5 · ZUSAGE 5 — DIE FILTERMUTATION. Adminzugriff ersetzt sie nicht (BEN).
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Verstellt wird das, WORAUF der Sichtbarkeitsfilter schaut: die Stufe der fremden Einträge.
  // Derselbe Mensch, dieselbe Rolle, derselbe Code — nur hat der Filter nichts mehr auszuschliessen.
  it("KZ5 · Zusage 5 wird rot, sobald die fremden Eintraege nicht mehr vertraulich sind", async (ctx) => {
    if (!bereit(ctx)) {
      return;
    }
    const auftrag = {
      begriff: VOLLTEXT_BEGRIFF,
      gesamtbestand: bestandsgroesse,
      fremde,
      geheimwort: GEHEIMWORT,
      vorschauen: 10,
    };

    const gruen = await zusage5FremdeBleibenDraussen(frischeSeite, auftrag);
    belege.kz5Baseline = `unverstellt: ${gruen.stand.zaehler} Treffer, ${gruen.geoeffneteVorschauen} Vorschauen offen, keiner der ${fremde.length} fremden Eintraege in Liste, Rumpf (${gruen.rumpflaenge} Zeichen) oder Vorschau.`;

    // MUTATION: `vertraulich` → `intern`. Ein Herabstufen braucht `mayDowngrade` — das ist die
    // Prüfer-/Admin-Entscheidung, die das Produkt an dieser Stelle verlangt (service.ts:2940-2945).
    await stufeSetzen(fremde, "intern", true);
    await bestaetigeStufe(fremde, "intern");
    belege.kz5Mutation = await mussRot(
      "KZ5",
      () => zusage5FremdeBleibenDraussen(frischeSeite, auftrag),
      "steht in der Trefferliste",
    );

    // RUECKNAHME.
    await stufeSetzen(fremde, "vertraulich", false);
    await bestaetigeStufe(fremde, "vertraulich");
    const wieder = await zusage5FremdeBleibenDraussen(frischeSeite, auftrag);
    belege.kz5Ruecknahme = `zurueckgenommen: wieder ${wieder.stand.zaehler} Treffer, keiner der fremden Eintraege sichtbar.`;
  }, 1_800_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // KZ6 · ZUSAGE 6 — DER ENTZUG. Die Zusage muss ohne Entzug rot sein, sonst sagt sie nichts.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("KZ6 · Zusage 6 wird rot, sobald der Rechteentzug zurueckgenommen ist", async (ctx) => {
    if (!bereit(ctx)) {
      return;
    }
    const auftrag = {
      kennung: ZIEL_KENNUNG,
      herkunft: HERKUNFT,
      zielKoId,
      zielTitel: ZIEL_TITEL,
      gesamtbestand: bestandsgroesse,
      herkunftsgruppeNachEntzug: 11,
      frist: ZUSAGE6_FRIST,
    };

    // BASELINE: der Entzug steht — derselbe Weg wie in G5.
    await stufeSetzen([zielKoId], "vertraulich", false);
    await bestaetigeStufe([zielKoId], "vertraulich");
    await zusage6EntzugSperrt(frischeSeite, auftrag);
    belege.kz6Baseline =
      "entzogen: der Kennungsweg zeigt den Leersatz, die Herkunftsgruppe hat 11 statt 12 Mitglieder.";

    // MUTATION: der Entzug wird zurueckgenommen — derselbe Fall MUSS jetzt scheitern.
    await stufeSetzen([zielKoId], "intern", true);
    await bestaetigeStufe([zielKoId], "intern");
    belege.kz6Mutation = await mussRot(
      "KZ6",
      () => zusage6EntzugSperrt(frischeSeite, auftrag),
      "nicht eingetreten in",
    );

    // RUECKNAHME der Mutation: wieder entzogen, der Fall traegt wieder.
    await stufeSetzen([zielKoId], "vertraulich", false);
    await bestaetigeStufe([zielKoId], "vertraulich");
    await zusage6EntzugSperrt(frischeSeite, auftrag);
    belege.kz6Ruecknahme = "wieder entzogen: derselbe Fall laeuft wieder durch.";

    // Und der Bestand geht in seinen Ausgangszustand zurueck — KZ1 braucht ein sichtbares Ziel.
    await stufeSetzen([zielKoId], "intern", true);
    await bestaetigeStufe([zielKoId], "intern");
  }, 1_800_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // KZ1 · ZUSAGE 3 — DAS ZIEL FEHLT IM BESTAND (Auftrag, Lieferung 7 i).
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("KZ1 · Zusage 3 wird rot, sobald das Zieldokument im Papierkorb liegt — und wieder gruen nach dem Zurueckholen", async (ctx) => {
    if (!bereit(ctx)) {
      return;
    }
    const auftrag = {
      begriff: ZIEL_KENNUNG,
      zielKoId,
      zielTitel: ZIEL_TITEL,
      gesamtbestand: bestandsgroesse,
      tabDeckel: TAB_DECKEL,
    };

    const gruen = await zusage3FindetUndOeffnet(frischeSeite, auftrag);
    belege.kz1Baseline = `unverstellt: ${gruen.stand.zaehler} Treffer zur Kennung, geoeffnet in ${gruen.oeffnungsschritte} Tab-Anschlaegen.`;

    await (services as AppServices).ko.delete(zielKoId, "kal-4271");
    const weg = await (pool as Pool).query<{ weg: string | null }>(
      "SELECT data->>'deletedAt' AS weg FROM kos WHERE id = $1",
      [zielKoId],
    );
    expect(weg.rows[0]?.weg, "in der Spalte steht kein Loeschzeitpunkt").toBeTruthy();
    belege.kz1Mutation = await mussRot(
      "KZ1",
      () => zusage3FindetUndOeffnet(frischeSeite, auftrag),
      "steht NICHT in der sichtbaren Trefferliste",
    );

    await (services as AppServices).ko.restore(zielKoId, "kal-4271");
    const wieder = await zusage3FindetUndOeffnet(frischeSeite, auftrag);
    belege.kz1Ruecknahme = `zurueckgeholt: wieder ${wieder.stand.zaehler} Treffer, geoeffnet in ${wieder.oeffnungsschritte} Tab-Anschlaegen.`;
  }, 1_800_000);

  // ── WERKZEUG ────────────────────────────────────────────────────────────────────────────────

  /**
   * Die Verstellung MUSS die Prüfung rot machen — und zwar an der erwarteten Zusicherung.
   *
   * Bleibt sie grün, ist das kein Formfehler, sondern ein Befund über den Nachweis: dann misst die
   * Prüfung nicht, was sie zu messen behauptet. Wirft sie aus einem ANDEREN Grund, ist die
   * Kalibrierung ebenfalls wertlos — deshalb wird der Wortlaut geprüft.
   */
  async function mussRot(
    was: string,
    lauf: () => Promise<unknown>,
    erwartet: string,
  ): Promise<string> {
    let fehler = "";
    try {
      await lauf();
    } catch (e) {
      fehler = String(e);
    }
    expect(
      fehler,
      `${was}: die Pruefung blieb GRUEN, obwohl verstellt wurde — dann misst sie nicht, was sie zu messen behauptet`,
    ).not.toBe("");
    expect(
      fehler,
      `${was}: rot geworden, aber aus einem anderen Grund als erwartet („${erwartet}")`,
    ).toContain(erwartet);
    process.stderr.write(`${JOB} ${was} ROT-BELEG: ${fehler.slice(0, 400)}\n`);
    return fehler;
  }

  /** Die technische Kennung zu einer fachlichen Dokumentnummer — aus der Datenbank, nicht aus der Suche. */
  async function kennungVon(dokumentnummer: string): Promise<string> {
    const r = await (pool as Pool).query<{ id: string }>(
      "SELECT id FROM kos WHERE data->>'statement' LIKE $1",
      [`%${dokumentnummer}%`],
    );
    expect(r.rows.length, `die Dokumentnummer ${dokumentnummer} ist nicht eindeutig`).toBe(1);
    return r.rows[0]?.id as string;
  }

  /** So viele Ablenker der Deckelfamilie in den Papierkorb — über den Produktweg. */
  async function ablenkerInDenPapierkorb(anzahl: number): Promise<string[]> {
    const r = await (pool as Pool).query<{ id: string }>(
      `SELECT id FROM kos
         WHERE data->>'title' LIKE $1 AND NOT (data ? 'deletedAt')
         ORDER BY data->>'title'
         LIMIT $2`,
      [`Notiz ${TERM_DECKEL} %`, anzahl],
    );
    for (const zeile of r.rows) {
      await (services as AppServices).ko.delete(zeile.id, "kal-4271");
    }
    return r.rows.map((z) => z.id);
  }

  /** Die Vertraulichkeitsstufe setzen — über den Produktweg, nicht per UPDATE. */
  async function stufeSetzen(
    ids: readonly string[],
    stufe: string,
    herabstufen: boolean,
  ): Promise<void> {
    for (const id of ids) {
      await (services as AppServices).ko.setConfidentiality(id, stufe, "kal-4271", {
        mayDowngrade: herabstufen,
      });
    }
  }

  /** Und unabhängig in der Spalte nachgesehen — nicht an der Antwort des Aufrufs abgelesen. */
  async function bestaetigeStufe(ids: readonly string[], stufe: string): Promise<void> {
    const r = await (pool as Pool).query<{ n: string }>(
      "SELECT count(*)::text AS n FROM kos WHERE id = ANY($1::text[]) AND data->>'confidentiality' = $2",
      [[...ids], stufe],
    );
    expect(Number(r.rows[0]?.n ?? "0"), `nicht alle Eintraege stehen auf „${stufe}"`).toBe(
      ids.length,
    );
  }

  function bereit(ctx: { skip: () => void }): boolean {
    if (!verfuegbar || !browser || !strecke || !pool || !beleg) {
      process.stderr.write(
        `${JOB} KALIBRIERFALL UEBERSPRUNGEN: die Vorbedingungen stehen nicht (PostgreSQL, Chromium, gebaute Flaeche). Der Fall gilt als UEBERSPRUNGEN, nicht als bestanden.\n`,
      );
      ctx.skip();
      return false;
    }
    return true;
  }
});
