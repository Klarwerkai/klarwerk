// ================================================================================================
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — DER ECHTE FALL: SERVER, POSTGRESQL, CHROMIUM.
// ================================================================================================
//
// DIE KETTE, die diese Datei misst:
//
//     PostgreSQL (angebotene Testinstanz oder Testcontainer) → `buildPgServices` → `buildApp` auf
//     einem echten Port → die gebaute Fläche → Chromium, frisches Profil → „Wissen erfassen" (Blatt)
//     → `POST /api/knowledge/check` → Antwort UND Anzeige.
//
// DER BESTAND IST SO GEBAUT, DASS EIN PASSENDER EINTRAG HINTER DER GRENZE LIEGT (Kriterium 4):
//   · Satz A: 40 Störer tragen zwei Suchwörter des Entwurfs A im TITEL, sind dem Entwurf aber nicht
//     ähnlich (Trigramm-Nähe ≈ 0,11 < SIMILAR_MIN_SCORE 0,18 — gemessen, s. `STOERER_POLSTER`). Das
//     Ziel A trägt den Entwurf wörtlich als Aussage (Nähe ≈ 0,71), aber KEIN Suchwort im Titel. Die
//     Kandidatenauswahl (`deckelauswahl: "trefferguete"`) setzt Titelfunde vor Aussagefunde
//     (search-projection-repo-pg.ts, `CASE … title_text … statement_text`) — das Ziel ist also der
//     41. Treffer und fällt hinter CANDIDATE_LIMIT (40).
//   · Satz B (Gegenprobe): dieselbe Bauform mit nur 39 Störern. Das Ziel B ist der 40. Treffer,
//     liegt im Umfang und MUSS als Treffer erscheinen.
//
// ZWEI LAGEN DES ANTWORTWEGS, beide an derselben Instanz:
//   V1 · wie im Betrieb ohne Modell: `pending` (kein Konflikturteil). Die Antwort meldet Umfang und
//        Grenze; das Blatt nennt die Vorschau mit genau diesem Umfang und behauptet keine Neuheit.
//   V2 · mit Konflikturteil: `done`. Das ist die Lage, in der das Blatt bis hierher „Das ist neu"
//        zeigte. Gestellt ist dafür NUR der Urteilsgeber (`judgeConflict` → kein Urteil) und die
//        Verfügbarkeitsmeldung des Modells; Route, Egress-Entscheidung, Kandidatenwahl, Datenhaltung
//        und Fläche laufen echt. Der Entwurf ist über die echte Route als „intern" gespeichert —
//        sonst verweigert die Route den Urteilsgeber fail-safe.
//
// DER NACHWEIS IST EINE PRÜFFUNKTION (`nachweis.ts`, `verstoesse`): sie sammelt Verstöße, statt beim
// ersten abzubrechen. Das aktuelle Verhalten muss `[]` liefern.
//
// RÜCKNAHME, AUSFÜHRBAR (Ben, Runde 1, Befund B2) — Fall K4-R. Dieselbe Prüffunktion läuft gegen
// das ALTE Verhalten, an derselben Datenbank und im selben Chromium:
//   · ALTE FLÄCHE: gebaut aus dem Git-Stand VOR dieser Änderung (Elter des Commits, der
//     `apps/web/src/texte/vorschau.ts` anlegt; ist er noch nicht festgehalten, HEAD), mit
//     `git archive` in ein Wegwerfverzeichnis gelegt und mit demselben `vite build` gebaut.
//     Ein Wächter prüft, dass jener Stand wirklich der alte ist (kein `coverage` im Servercode).
//   · ALTER DRAHT: eine zweite `buildApp`-Instanz, deren Antwort auf `/api/knowledge/check` das Feld
//     `coverage` nicht trägt — genau die Drahtform des alten Servers (die Änderung am Server fügt
//     nur dieses Feld hinzu; `status`, `similar`, `conflicts` sind unverändert).
// Erwartet: V1 meldet UMFANG_FEHLT und ANZEIGE_OHNE_UMFANG, V2 zusätzlich NEUHEIT („Das ist neu").
// Fehlt Git oder scheitert der Bau der alten Fläche, wird der Fall ROT, nicht übersprungen.
//
// PRÜFGRENZE, LAUT GEMELDET (Bauform `tests/sharepoint-inhalt-gesamtweg/gesamtweg-pg-im-browser…`):
// ohne erreichbare PostgreSQL wird der Grund SICHTBAR gemeldet und übersprungen — dann ist dieser
// Nachweis NICHT erbracht. KEINE PRODUKTIVDATEN: nur eine Wegwerf-Datenbank mit „test" im Namen.
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { registerWebStatic } from "../../services/app/src/web-static";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  BREIT,
  anmelden,
  browserKennung,
  stelleFlaecheBereit,
} from "../fassungsrueckholung-echter-browser/weg";
import {
  type Browser,
  DIST,
  type Seite,
  fn,
  profil,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { Sitzung, type Strecke, ersteinrichtung } from "../gast-nutzerweg/strecke";
import { type Aufgeklappt, type Befund, type Lage, verstoesse } from "./nachweis";

// ------------------------------------------------------------------------------------------------
// DIAGNOSE (Ben, Runde 2, Befund B3): WAS HINTER EINEM HTTP 500 STEHT.
// ------------------------------------------------------------------------------------------------
//
// Der Serverlauf scheiterte beim Bestandsaufbau am vierten `POST /api/kos` mit „500 INTERNAL —
// Unerwarteter Fehler". Mehr stand im Prüfbericht nicht, und mehr KANN dort nicht stehen:
// `sendError` (services/app/src/http.ts) maskiert die Ursache nach außen, und für Fehler ohne
// Domänencode — darunter jeder PostgreSQL-SQLSTATE mit Ziffern (40P01, 23505, 57014 …) — schreibt
// es auch KEINE Logzeile; nur die Codes aus `INTERNAL_ONLY_CODES` werden protokolliert. Die Ursache
// ist damit im Produkt spurlos.
// Dieser Test hüllt deshalb `sendError` ein (`vi.mock`, gilt für jede Route dieser Datei): jeder
// Fehler, mit dem eine Route antwortet, landet mit Pfad, Code, Meldung und Stapelanfang in
// `SERVERFEHLER`, bevor das echte `sendError` unverändert antwortet. Jeder Fehlschlag dieses Tests
// nennt die Liste. Lokal gegen die echten Routen geprüft: ein Anlegefehler erscheint dort als
// „POST /api/kos code=INVALID_TYPE …".
const SERVERFEHLER = vi.hoisted(() => [] as string[]);
vi.mock("../../services/app/src/http", async (original) => {
  const echt = await original<typeof import("../../services/app/src/http")>();
  return {
    ...echt,
    sendError: (reply: Parameters<typeof echt.sendError>[0], error: unknown) => {
      const e = (error ?? {}) as { code?: unknown; message?: unknown; stack?: unknown };
      const stapel = typeof e.stack === "string" ? e.stack.split("\n").slice(0, 6).join(" | ") : "";
      SERVERFEHLER.push(
        `${reply.request.method} ${reply.request.url} · code=${String(e.code)} · ${String(e.message)} · ${stapel}`,
      );
      echt.sendError(reply, error);
    },
  };
});

const JOB = "[KLARWERK] VORSCHAU-REICHWEITE";
const WURZEL = join(__dirname, "..", "..");
const PG_SCHEMA = "postgresql:";
const ADMIN = "admin@vorschau-reichweite.test";
const T = i18n.getFixedT("de");

/** Der Deckel des Produkts (services/app/src/knowledge-check.ts, dort nicht exportiert). */
const DECKEL = 40;

const ENTWURF_A = "Kondensatableiter vor Schichtbeginn entleeren und Dampfsperre kontrollieren.";
const ENTWURF_B = "Rueckspuelfilter nach Hochwasser reinigen und Schieberstellung dokumentieren.";

/**
 * Beiwerk der Störer: lang genug, dass die Trigramm-Nähe zum Entwurf unter 0,18 fällt, und frei von
 * jedem Suchwort beider Entwürfe (die Vorauswahl sucht Teilzeichenketten). Gemessen mit
 * `trigramSimilarity`: Störer A ≈ 0,112, Störer B ≈ 0,122, Ziel A ≈ 0,714, Ziel B ≈ 0,733.
 */
const STOERER_POLSTER =
  "Allgemeine Hinweise zur Ablage: Ordner blau, Register gelb, Etiketten mit Datum versehen, Kopien im Archivraum hinterlegen, Rueckfragen an die Leitstelle richten, Telefonliste quartalsweise pruefen, Besucherausweise am Empfang abholen, Parkplatz nur mit Genehmigung benutzen.";

const ZIEL_A = "Betriebshinweis Anlage Nord";
const ZIEL_B = "Betriebshinweis Anlage Sued";

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
    throw new Error(`${JOB}: „${datenbank}" trägt kein „test" im Namen.`);
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

// ------------------------------------------------------------------------------------------------
// DIE ANWENDUNG — dieselbe `buildApp` wie im Betrieb, mit PostgreSQL und gebauter Fläche.
// ------------------------------------------------------------------------------------------------

interface Anwendung {
  strecke: Strecke;
  /** V2: das Modell gilt als verfügbar, der Urteilsgeber antwortet ohne Urteil. */
  modellAn: (an: boolean) => void;
  urteile: () => number;
  /** Wartet, bis die Hintergrundprüfung (`aiCheckWorker`) keine Arbeit mehr hat. */
  leerlauf: () => Promise<void>;
}

async function starteAnwendung(
  pool: Pool,
  opts: { dist: string; alterDraht: boolean },
): Promise<Anwendung> {
  const services = buildPgServices(pool);
  const reasoner = services.reasoner;
  const echterStatus = reasoner.status.bind(reasoner);
  let an = false;
  let urteile = 0;
  vi.spyOn(reasoner, "status").mockImplementation(() =>
    an ? { ...echterStatus(), active: true } : echterStatus(),
  );
  vi.spyOn(reasoner, "judgeConflict").mockImplementation(async () => {
    urteile += 1;
    return null;
  });
  const app = buildApp(services);
  if (opts.alterDraht) {
    // Die Drahtform des alten Servers: dieselbe Antwort ohne `coverage`.
    app.addHook("onSend", async (request, _reply, payload) => {
      if (!request.url.startsWith("/api/knowledge/check") || typeof payload !== "string") {
        return payload;
      }
      const { coverage: _weg, ...alt } = JSON.parse(payload) as Record<string, unknown>;
      return JSON.stringify(alt);
    });
  }
  await registerWebStatic(app, opts.dist);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    throw new Error(`${JOB}: der Server hat keinen Port gemeldet.`);
  }
  const basis = `http://127.0.0.1:${adresse.port}`;
  return {
    strecke: {
      app,
      basis,
      profil: (name, sprache) => new Sitzung(basis, name, sprache),
      schliessen: () => app.close(),
    },
    modellAn: (wert) => {
      an = wert;
    },
    urteile: () => urteile,
    leerlauf: async () => {
      await services.aiCheckWorker?.idle();
    },
  };
}

/**
 * Ein Bestandseintrag über die ECHTE Route — und danach Leerlauf der Hintergrundprüfung.
 *
 * WARUM DER LEERLAUF (Ben, Runde 2, Befund B3). `POST /api/kos` antwortet 201 und stösst dann die
 * Hintergrundprüfung an (`aiCheckWorker.enqueue`, ko-routes.ts). Die schreibt unter PostgreSQL
 * echt parallel zum nächsten Anlegen — auf denselben Zähler `ko_schreibstand` und unter derselben
 * `FOR SHARE`-Steuerzeile der Suchprojektion — und hat bei 40 fast gleichen Störern echte
 * Dublettenarbeit. Mit Speicherablagen lief dieselbe Folge von acht Anlagen lokal durch (8 × 201);
 * unter PostgreSQL brach die vierte mit 500 ab. Der Bestandsaufbau ist VORBEREITUNG dieses Falls,
 * nicht sein Gegenstand: er legt deshalb Eintrag für Eintrag an und wartet, bis die Prüfung des
 * vorigen fertig ist — so, wie ein Mensch nacheinander erfasst. Die Route bleibt die echte.
 * Scheitert eine Anlage trotzdem, nennt die Meldung die protokollierte Serverursache.
 */
async function eintrag(
  anwendung: Anwendung,
  admin: Sitzung,
  titel: string,
  statement: string,
): Promise<string> {
  const antwort = await admin.sende("POST", "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement,
    type: "best_practice",
    category: "Werkstatt",
  });
  if (antwort.status !== 201) {
    throw new Error(
      `${JOB}: POST /api/kos (${titel}) → ${antwort.status} (erwartet 201): ${antwort.text}\nRoutenfehler am Server:\n${diagnose()}`,
    );
  }
  await anwendung.leerlauf();
  return (antwort.json as { id: string }).id;
}

function diagnose(): string {
  return SERVERFEHLER.length === 0 ? "(kein Routenfehler)" : SERVERFEHLER.join("\n");
}

// ------------------------------------------------------------------------------------------------
// DIE ALTE FLÄCHE — aus dem Git-Stand vor dieser Änderung gebaut.
// ------------------------------------------------------------------------------------------------

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: WURZEL, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

/** Der Stand vor dieser Änderung: Elter des Commits, der das Textmodul anlegt — sonst HEAD. */
function alterStand(): string {
  const anlage = git([
    "log",
    "--diff-filter=A",
    "--format=%H",
    "--",
    "apps/web/src/texte/vorschau.ts",
  ])
    .split("\n")
    .filter(Boolean);
  const erster = anlage[anlage.length - 1];
  const stand = erster ? `${erster}^` : "HEAD";
  // Wächter: jener Stand ist WIRKLICH der alte — sonst liefe die Rücknahme gegen das Neue.
  const server = git(["show", `${stand}:services/app/src/knowledge-check.ts`]);
  if (server.includes("coverage")) {
    throw new Error(`${JOB}: ${stand} trägt bereits \`coverage\` — das ist nicht der alte Stand.`);
  }
  return git(["rev-parse", stand]);
}

function baueAlteFlaeche(ziel: string): { dist: string; stand: string } {
  const stand = alterStand();
  execSync(`git archive ${stand} apps/web | tar -x -C "${ziel}"`, { cwd: WURZEL, stdio: "pipe" });
  const web = join(ziel, "apps/web");
  // Die Abhängigkeiten sind dieselben Pakete wie im Arbeitsbaum — verlinkt, nicht neu installiert.
  symlinkSync(join(WURZEL, "apps/web/node_modules"), join(web, "node_modules"), "dir");
  symlinkSync(join(WURZEL, "node_modules"), join(ziel, "node_modules"), "dir");
  const dist = join(ziel, "dist-alt");
  execFileSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: web,
    stdio: "pipe",
    timeout: 900_000,
  });
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error(`${JOB}: die alte Fläche wurde gebaut, aber ${dist}/index.html fehlt.`);
  }
  return { dist, stand };
}

// ------------------------------------------------------------------------------------------------
// SONDEN IN DER SEITE
// ------------------------------------------------------------------------------------------------

/**
 * Hält jede Antwort von `/api/knowledge/check` samt Anfragerumpf fest — die Antwort, die das Blatt
 * WIRKLICH bekommen hat, nicht eine zweite Anfrage des Tests daneben.
 */
const MITSCHNITT = `(() => {
  const echt = window.fetch.bind(window);
  window.__vorschau = [];
  window.fetch = async (eingabe, init) => {
    const antwort = await echt(eingabe, init);
    try {
      const url = typeof eingabe === "string" ? eingabe : (eingabe && eingabe.url) || "";
      if (url.indexOf("/knowledge/check") >= 0) {
        const rumpf = init && typeof init.body === "string" ? init.body : "";
        antwort.clone().json()
          .then((j) => window.__vorschau.push({ rumpf: rumpf, antwort: j }))
          .catch(() => {});
      }
    } catch (e) {}
    return antwort;
  };
})();`;

/** Text in das Schreibfeld des Blatts — über das echte Eingabeereignis (Bauform h3-wirkung). */
const SCHREIBEN = `async (text) => {
  const feld = document.querySelector('[data-testid="blatt-text"] [role=textbox]');
  feld.focus();
  feld.innerHTML = '<p>' + text + '</p>';
  feld.dispatchEvent(new InputEvent('input', { bubbles: true }));
  return (feld.textContent || '').trim();
}`;

const ANTWORT_DA = `(a) => (window.__vorschau || []).some(
  (e) => e.rumpf.indexOf(a.marke) >= 0 && e.antwort && e.antwort.status === a.status
)`;

const LETZTE_ANTWORT = `(a) => {
  const alle = (window.__vorschau || []).filter(
    (e) => e.rumpf.indexOf(a.marke) >= 0 && e.antwort && e.antwort.status === a.status
  );
  return alle.length === 0 ? null : alle[alle.length - 1].antwort;
}`;

const LAGE = `() => {
  const q = (s) => document.querySelector(s);
  const text = (e) => (e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : null);
  const chip = q('[data-testid="blatt-live-chip"]');
  return {
    chipLage: chip ? chip.getAttribute("data-lage") : null,
    chipText: text(chip),
    vorschau: text(q('[data-testid="blatt-live-vorschau"]')),
    seite: document.body.innerText,
  };
}`;

/** Den Chip aufklappen und lesen, was dann dasteht — Erklärung und ganze Zone. */
const AUFKLAPPEN = `async () => {
  const text = (e) => (e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : null);
  const knopf = document.querySelector('[data-testid="blatt-live-chip"] button');
  if (!knopf) return { erklaerung: null, chip: null };
  knopf.click();
  await new Promise((r) => setTimeout(r, 200));
  return {
    erklaerung: text(document.querySelector('[data-testid="live-vorschau-leer"]')),
    chip: text(document.querySelector('[data-testid="blatt-live-chip"]')),
  };
}`;

interface Antwort {
  status: string;
  similar: { id: string; title: string }[];
  conflicts: unknown[];
  coverage?: unknown;
}

async function antwortAbwarten(seite: Seite, marke: string, status: string): Promise<Antwort> {
  await warte(
    seite,
    ANTWORT_DA,
    `die Antwort „${status}" zu „${marke}"`,
    { marke, status },
    60_000,
  );
  // Die Antwort ist da; dem Blatt einen Takt zum Darstellen lassen.
  await seite.evaluate(fn("() => new Promise((r) => setTimeout(r, 500))"));
  const antwort = await seite.evaluate<Antwort | null>(fn(LETZTE_ANTWORT), { marke, status });
  if (!antwort) {
    throw new Error(`${JOB}: keine Antwort „${status}" zu „${marke}" im Mitschnitt.`);
  }
  return antwort;
}

async function blattOeffnen(seite: Seite, adresse: string): Promise<void> {
  await seite.goto(adresse, { waitUntil: "load" });
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="blatt-text"] [role=textbox]')`,
    `das Blatt steht (${adresse})`,
  );
}

async function entwurfAnlegen(admin: Sitzung, text: string, marke: string): Promise<string> {
  const entwurf = await admin.sende("POST", "/api/drafts", {
    title: `Vorschau ${marke}`,
    statement: "",
    bodyHtml: `<p>${text}</p>`,
    confidentiality: "intern",
    origin: "expert",
  });
  if (entwurf.status !== 201) {
    throw new Error(
      `${JOB}: POST /api/drafts (${marke}) → ${entwurf.status} (erwartet 201): ${entwurf.text}\nRoutenfehler am Server:\n${diagnose()}`,
    );
  }
  return (entwurf.json as { id: string }).id;
}

/**
 * DER MESSWEG — für das aktuelle UND das alte Verhalten derselbe: V1 (ohne Modell, `pending`,
 * Entwurf A getippt) und V2 (mit Urteilsgeber, `done`, Entwurf A als gespeicherter Entwurf).
 */
async function messeZielHinterDerGrenze(
  browser: Browser,
  anwendung: Anwendung,
  admin: Sitzung,
  zielA: string,
): Promise<{ v1: Befund; v2: Befund }> {
  const basis = anwendung.strecke.basis;
  const { kontext, seite } = await profil(browser, BREIT, "de");
  try {
    await kontext.addInitScript(MITSCHNITT);
    await anmelden(seite, basis, ADMIN, "admin", {});

    anwendung.modellAn(false);
    await blattOeffnen(seite, `${basis}/erfassen`);
    await seite.evaluate<string>(fn(SCHREIBEN), ENTWURF_A);
    const a1 = await antwortAbwarten(seite, "Kondensatableiter", "pending");
    const v1: Befund = {
      lauf: "pending",
      antwort: a1,
      lage: await seite.evaluate<Lage>(fn(LAGE)),
      aufgeklappt: null,
      zielId: zielA,
      deckel: DECKEL,
    };

    anwendung.modellAn(true);
    const id = await entwurfAnlegen(admin, ENTWURF_A, "Kondensatableiter");
    await blattOeffnen(seite, `${basis}/erfassen?draft=${encodeURIComponent(id)}`);
    const a2 = await antwortAbwarten(seite, "Kondensatableiter", "done");
    const lage2 = await seite.evaluate<Lage>(fn(LAGE));
    const v2: Befund = {
      lauf: "done",
      antwort: a2,
      lage: lage2,
      aufgeklappt: await seite.evaluate<Aufgeklappt>(fn(AUFKLAPPEN)),
      zielId: zielA,
      deckel: DECKEL,
    };
    anwendung.modellAn(false);
    return { v1, v2 };
  } finally {
    await kontext.close();
  }
}

/** Die Gegenprobe: Entwurf B, dessen Ziel IM Umfang liegt, in beiden Lagen. */
async function gegenprobe(
  browser: Browser,
  anwendung: Anwendung,
  admin: Sitzung,
  zielB: string,
): Promise<void> {
  const basis = anwendung.strecke.basis;
  const { kontext, seite } = await profil(browser, BREIT, "de");
  try {
    await kontext.addInitScript(MITSCHNITT);
    await anmelden(seite, basis, ADMIN, "admin", {});
    anwendung.modellAn(false);
    await blattOeffnen(seite, `${basis}/erfassen`);
    await seite.evaluate<string>(fn(SCHREIBEN), ENTWURF_B);
    const b1 = await antwortAbwarten(seite, "Rueckspuelfilter", "pending");
    expect(
      b1.similar.map((s) => s.id),
      "V1: das Ziel B fehlt, obwohl im Umfang",
    ).toContain(zielB);
    const lage1 = await seite.evaluate<Lage>(fn(LAGE));
    expect(lage1.chipLage).toBe("similar");
    expect(lage1.chipText).toContain(ZIEL_B);

    anwendung.modellAn(true);
    const id = await entwurfAnlegen(admin, ENTWURF_B, "Rueckspuelfilter");
    await blattOeffnen(seite, `${basis}/erfassen?draft=${encodeURIComponent(id)}`);
    const b2 = await antwortAbwarten(seite, "Rueckspuelfilter", "done");
    expect(
      b2.similar.map((s) => s.id),
      "V2: das Ziel B fehlt, obwohl im Umfang",
    ).toContain(zielB);
    const lage2 = await seite.evaluate<Lage>(fn(LAGE));
    expect(lage2.chipLage).toBe("similar");
    expect(lage2.chipText).toContain(ZIEL_B);
    anwendung.modellAn(false);
  } finally {
    await kontext.close();
  }
}

describe("Vorschau-Reichweite · Server, PostgreSQL und Chromium", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let container: StartedTestContainer | undefined;
  let browser: Browser | undefined;
  let pool: Pool | undefined;
  let verfuegbar = false;
  let flaeche = "nicht hergestellt";
  let quelleDerDatenbank = "keine";
  const datenbank = `klarwerk_vorschau_test_${`${Date.now()}`.slice(-9)}`;
  const wegwerf = mkdtempSync(join(tmpdir(), "klarwerk-vorschau-alt-"));
  /** Vom aktuellen Lauf angelegt, vom Rücknahmelauf wiederbenutzt (dieselbe Datenbank). */
  let bestand: { admin: Sitzung; zielA: string } | undefined;
  const anwendungen: Anwendung[] = [];

  beforeAll(async () => {
    let url = "";
    let grund = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
      quelleDerDatenbank = "lokale Testinstanz (KLARWERK_PG_TEST_URL)";
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `${PG_SCHEMA}//postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelleDerDatenbank = "Testcontainer postgres:16-alpine";
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (!url) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN — Grund: ${grund}. Der echte Server-/Browserfall mit PostgreSQL ist damit NICHT belegt.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(`${JOB} UEBERSPRUNGEN: die Datenbankadresse nennt keinen Rechner.\n`);
      return;
    }
    // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Fehler ist ein echter.
    adminPool = new Pool({ connectionString: url });
    await adminPool.query(`CREATE DATABASE ${datenbank}`);
    flaeche = stelleFlaecheBereit();
    browser = await starteChromium();
    pool = createPool(pgUrl(verbindung, datenbank));
    await migrate(pool);
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    try {
      for (const a of anwendungen) {
        await a.strecke.schliessen().catch(() => undefined);
      }
      await browser?.close();
    } finally {
      vi.restoreAllMocks();
      await pool?.end().catch(() => undefined);
      if (adminPool) {
        await adminPool
          .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
          .catch(() => undefined);
        await adminPool.end();
      }
      await container?.stop().catch(() => undefined);
      rmSync(wegwerf, { recursive: true, force: true });
    }
  }, 180_000);

  it("K4 — ein passender Eintrag hinter der Grenze: Antwort meldet begrenzten Umfang, das Blatt behauptet keine Neuheit; im Umfang erscheint der Treffer", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser || !pool) {
      ctx.skip();
      return;
    }
    process.stderr.write(
      `${JOB} K4 GELAUFEN · Fläche: ${flaeche} · Browser: ${browserKennung(browser)} · Datenbank aus: ${quelleDerDatenbank}\n`,
    );
    const anwendung = await starteAnwendung(pool, { dist: DIST, alterDraht: false });
    anwendungen.push(anwendung);
    const { sitzung: admin } = await ersteinrichtung(anwendung.strecke, ADMIN);

    // ── DER BESTAND, über die echte Route angelegt. ─────────────────────────────────────────
    for (let i = 1; i <= DECKEL; i += 1) {
      const nr = String(i).padStart(2, "0");
      await eintrag(
        anwendung,
        admin,
        `Kondensatableiter Dampfsperre Merkblatt ${nr}`,
        `${STOERER_POLSTER} Blatt ${nr}.`,
      );
    }
    const zielA = await eintrag(anwendung, admin, ZIEL_A, ENTWURF_A);
    for (let i = 1; i <= DECKEL - 1; i += 1) {
      const nr = String(i).padStart(2, "0");
      await eintrag(
        anwendung,
        admin,
        `Rueckspuelfilter Schieberstellung Merkblatt ${nr}`,
        `${STOERER_POLSTER} Blatt ${nr}.`,
      );
    }
    const zielB = await eintrag(anwendung, admin, ZIEL_B, ENTWURF_B);
    bestand = { admin, zielA };
    // B3, ausdrücklich festgehalten: was der Server beim Bestandsaufbau an Routenfehlern meldete —
    // getrennt von den Fehlern der Messung danach.
    process.stderr.write(
      `${JOB} K4 · Bestandsaufbau: ${2 * DECKEL + 1} Einträge mit 201 · Routenfehler beim Aufbau: ${diagnose()}\n`,
    );

    // Unabhängig am Pool nachgesehen: das Ziel A liegt WIRKLICH im Bestand, und mit ihm gibt es
    // mehr passende Einträge als der Deckel fasst.
    const passendA = await pool.query<{ anzahl: string }>(
      `SELECT count(*)::text AS anzahl FROM kos
        WHERE data->>'title' ILIKE '%kondensatableiter%' OR data->>'statement' ILIKE '%kondensatableiter%'`,
    );
    expect(passendA.rows[0]?.anzahl, "Satz A hat nicht Deckel + 1 passende Einträge").toBe(
      String(DECKEL + 1),
    );
    const zeileA = await pool.query<{ statement: string }>(
      "SELECT data->>'statement' AS statement FROM kos WHERE id = $1",
      [zielA],
    );
    expect(zeileA.rows[0]?.statement, "das Ziel A steht nicht in der Tabelle").toBe(ENTWURF_A);

    // ── DER NACHWEIS gegen das aktuelle Verhalten: keine Verstöße. ──────────────────────────
    const { v1, v2 } = await messeZielHinterDerGrenze(browser, anwendung, admin, zielA);
    expect(
      verstoesse(v1, T),
      `V1 · ${JSON.stringify(v1.lage.vorschau)} · Server: ${diagnose()}`,
    ).toEqual([]);
    expect(
      verstoesse(v2, T),
      `V2 · ${JSON.stringify(v2.lage.chipText)} · Server: ${diagnose()}`,
    ).toEqual([]);

    // ── DIE GEGENPROBE: liegt der Eintrag im Umfang, erscheint der Treffer. ─────────────────
    await gegenprobe(browser, anwendung, admin, zielB);
    process.stderr.write(
      `${JOB} K4 · Urteilsaufrufe: ${anwendung.urteile()} · Serverfehler: ${diagnose()}\n`,
    );
  }, 1_200_000);

  it("K4-R — RÜCKNAHME: mit alter Fläche und altem Draht schlägt derselbe Nachweis fehl", async (ctx) => {
    if (!verfuegbar || !browser || !pool) {
      ctx.skip();
      return;
    }
    // Ohne den Bestand aus K4 misst dieser Fall nichts — dann ist das ein Fehler, kein Übersprung.
    if (!bestand) {
      throw new Error(`${JOB}: K4-R braucht den Bestand aus K4, der fehlt (K4 ist gescheitert).`);
    }
    const alt = baueAlteFlaeche(wegwerf);
    process.stderr.write(`${JOB} K4-R GELAUFEN · alte Fläche aus ${alt.stand}\n`);
    const altAnwendung = await starteAnwendung(pool, { dist: alt.dist, alterDraht: true });
    anwendungen.push(altAnwendung);

    const { v1, v2 } = await messeZielHinterDerGrenze(
      browser,
      altAnwendung,
      bestand.admin,
      bestand.zielA,
    );
    const r1 = verstoesse(v1, T);
    const r2 = verstoesse(v2, T);
    process.stderr.write(
      `${JOB} K4-R · Verstöße V1: ${r1.join(", ")} · V2: ${r2.join(", ")} · Serverfehler: ${diagnose()}\n`,
    );
    // Der Nachweis schlägt fehl — und zwar aus den Gründen, um die es geht.
    expect(r1).toEqual(expect.arrayContaining(["UMFANG_FEHLT", "ANZEIGE_OHNE_UMFANG"]));
    expect(r2).toEqual(expect.arrayContaining(["UMFANG_FEHLT", "ANZEIGE_OHNE_UMFANG", "NEUHEIT"]));
    // Kalibrierung: die alte Fläche zeigt tatsächlich den alten Satz, nicht irgendeinen Fehler.
    expect(v2.lage.chipLage).toBe("new");
    expect(v2.lage.chipText).toContain(T("erfassen.live.neu"));
  }, 1_800_000);
});
