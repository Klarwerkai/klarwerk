// ================================================================================================
// RESTPRÜFUNG GESAMTANWEISUNG · A7 — DIE JOURNAL-ABSAGE AN DER ECHTEN, MONTIERTEN FLÄCHE: ÜBER
// NEULADEN UND PROZESSNEUSTART HINWEG.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT (BEN zu 4156): „A7 prüft Übersetzungsschlüssel, nicht die
// Bedienung". Die beiden bestehenden Nachweise reichen jeder nur halb:
//   · `tests/wiki-gesamtanweisung-abnahme/a7-desktop-journal-kein-stiller-verlust.test.ts` misst die
//     Absage am Draht per `app.inject` und die Sätze als SCHLÜSSEL im Katalog;
//   · `a10-absage-bleibt-bedienbar.test.tsx` misst die Bedienung am jsdom-DOM mit festgelegtem
//     `fetch` — ohne Server, ohne Journal, ohne Neuladen.
//
// HIER LÄUFT DAS PROGRAMM, DAS DIE INSEL-/DESKTOP-INSTALLATION FÄHRT: `node --import tsx
// services/app/src/server.ts` als eigener Betriebssystem-Prozess, mit der Umgebung, die
// `scripts/insel/release-texte.mjs` für den Journalbetrieb setzt (`NODE_ENV=production`,
// `KLARWERK_DEV_PERSIST=1`, eigene `KLARWERK_DEV_PERSIST_FILE`, `KLARWERK_ALLOW_INMEMORY_PROD=1`,
// KEIN `DATABASE_URL`). Der Server liefert die gebaute Fläche selbst aus. Gemessen wird:
//
//   1. GESPEICHERTE ARBEIT BLEIBT: ein Wissenseintrag, den das Journal hält, steht nach dem
//      Neuladen der Seite UND nach einem echten Prozessneustart (SIGTERM, neue PID, dieselbe
//      Journaldatei) weiter da — abgefragt aus der Seite heraus mit ihren Sitzungskeksen.
//   2. UNBESTÄTIGTE ARBEIT WIRD NICHT ALS GESPEICHERT AUSGEGEBEN: in DE/EN/NL tippt ein Mensch
//      einen Titel und löst „anlegen" per Tastatur aus. Der Absagesatz steht SICHTBAR in seiner
//      Sprache da, die Eingabe BLEIBT im Feld stehen, die Adresse springt nicht weiter, und am Draht
//      entsteht kein Eintrag. Nach dem Neuladen und nach dem Neustart zeigt die Liste
//      wahrheitsgemäss den Leersatz — keine Phantomzeile, kein Fehlersatz.
//
//   3. UNBESTÄTIGTE ARBEIT ÜBERSTEHT DAS NEULADEN: der abgelehnte Titel steht danach wieder im
//      Feld (`useUnbestaetigterTitel`, `GesamtanweisungBereich.tsx` — tab-gebunden, je Konto). Bis
//      zu dieser Prüfung ging er beim Neuladen still verloren; das war der offene A7-Befund.
//      Ein NEUES Profil nach dem Prozessneustart hat ihn ausdrücklich nicht: der Merker gehört zum
//      Tab, nicht zum Server.
//
// NICHT GEMESSEN: andere Browser als Chromium, Bildschirmleser, der Word-Add-in-Host.
// Kein `ctx.skip()`: fehlt die Fläche, baut `stelleFrischeFlaecheBereit` sie oder scheitert laut.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sprache } from "../../services/auth/src/meldungen";
import { type Browser, type Seite, fn, starteChromium, warte } from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, mussGelingen } from "../gast-nutzerweg/strecke";
import { LISTE, stelleFrischeFlaecheBereit } from "../gesamtanweisung-nutzerweg/liste-weg";
import {
  WURZEL,
  freierPort,
  meldeAnMitTastatur,
  mussSichtbarTragen,
  schneideMit,
  tabUndEnter,
  tippeAb,
  warteAufGesund,
} from "../gesamtanweisung-nutzerweg/weg";
import {
  FLAECHE_STEHT_AUF,
  GESAMTANWEISUNG_PFAD,
  SPRACHEN,
  profilFuer,
} from "../gesamtanweisung-tastaturweg/weg";
import { sprachbestand } from "../support/i18nBestand";
import { wissenseintrag } from "./bestand";

const MARKE = "RESTPRUEFUNG A7 JOURNAL";
const ADMIN = "admin@restpruefung-a7.test";
const KO_TITEL = "Druckprobe dokumentieren (Restpruefung A7)";
const ABSAGE = "ANWEISUNG_ABLAGE_FLUECHTIG";

let ordner = "";
let journal = "";
let port = 0;
let basis = "";
let prozess: ChildProcessWithoutNullStreams | undefined;
const protokoll: string[] = [];
let browser: Browser | undefined;
let koId = "";

/** Die Umgebung der Insel im Journalbetrieb — vollständig neu gebaut, nichts geerbt. */
function journalUmgebung(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    KLARWERK_SKIP_KEYCHAIN: "1",
    KLARWERK_LOG_LEVEL: "warn",
    NODE_ENV: "production",
    APP_BASE_URL: basis,
    PORT: String(port),
    KLARWERK_DEV_PERSIST: "1",
    KLARWERK_DEV_PERSIST_FILE: journal,
    KLARWERK_ALLOW_INMEMORY_PROD: "1",
  };
}

async function starte(was: string): Promise<ChildProcessWithoutNullStreams> {
  protokoll.length = 0;
  const neu = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
    cwd: WURZEL,
    env: journalUmgebung(),
  });
  schneideMit(neu, protokoll);
  await warteAufGesund(basis, neu, protokoll, was);
  return neu;
}

async function beende(alt: ChildProcessWithoutNullStreams): Promise<void> {
  if (alt.exitCode !== null || alt.signalCode !== null) {
    return;
  }
  const aus = new Promise<void>((fertig) => alt.once("exit", () => fertig()));
  alt.kill("SIGTERM");
  await aus;
}

beforeAll(async () => {
  process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFrischeFlaecheBereit()}\n`);
  ordner = mkdtempSync(join(tmpdir(), "kw-restpruefung-a7-"));
  journal = join(ordner, "state.jsonl");
  // Wie `release-texte.mjs`: die Datei liegt vor dem ersten Start da.
  writeFileSync(journal, "", "utf8");
  port = await freierPort();
  basis = `http://127.0.0.1:${port}`;
  prozess = await starte("erster Start");
  browser = await starteChromium();

  const admin = new Sitzung(basis, "admin");
  mussGelingen(
    "POST /api/auth/setup",
    await admin.sende("POST", "/api/auth/setup", {
      name: "Admin",
      email: ADMIN,
      password: PASSWORT,
    }),
    201,
  );
  // DIE GESPEICHERTE ARBEIT: ein Wissenseintrag, den das Journal wirklich hält.
  koId = (await wissenseintrag(admin, KO_TITEL, "intern")).koId;
}, 900_000);

afterAll(async () => {
  await browser?.close();
  if (prozess) {
    await beende(prozess);
  }
  if (ordner) {
    rmSync(ordner, { recursive: true, force: true });
  }
}, 120_000);

function zeug(): { browser: Browser } {
  if (!browser || !prozess) {
    throw new Error(`${MARKE}: der Aufbau ist nicht durchgelaufen.\n${protokoll.join("")}`);
  }
  return { browser };
}

function satz(sprache: string, schluessel: string): string {
  const roh = sprachbestand(sprache)[schluessel] ?? "";
  expect(roh.length, `${MARKE}: „${schluessel}" fehlt im Katalog „${sprache}"`).toBeGreaterThan(0);
  return roh;
}

/** Ein Abruf AUS DER SEITE — mit den Keksen dieses Profils, gegen die Instanz, die sie ausliefert. */
async function ausDerSeite(seite: Seite, pfad: string): Promise<{ status: number; rumpf: string }> {
  return seite.evaluate<{ status: number; rumpf: string }>(
    fn(`(p) => fetch(p, { credentials: "include" })
      .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t })))
      .catch((e) => ({ status: -1, rumpf: String(e) }))`),
    pfad,
  );
}

/** Die Liste steht und sagt „nichts gespeichert" — sichtbar, ohne Zeile und ohne Fehlersatz. */
async function listeIstEhrlichLeer(seite: Seite, sprache: string, wann: string): Promise<void> {
  await warte(
    seite,
    "(sel) => !!document.querySelector(sel)",
    `${wann} (${sprache}): der Leersatz der Liste`,
    `[data-testid="${LISTE}-leer"]`,
    45_000,
  );
  await mussSichtbarTragen(
    seite,
    `[data-testid="${LISTE}-leer"]`,
    satz(sprache, "ga.liste.leer"),
    `${wann} (${sprache}): Leersatz`,
  );
  const lage = await seite.evaluate<{ zeilen: number; fehler: boolean }>(
    fn(`(m) => ({
      zeilen: document.querySelectorAll('[data-testid="' + m + '-eintrag"]').length,
      fehler: !!document.querySelector('[data-testid="' + m + '-fehler"]'),
    })`),
    LISTE,
  );
  expect(
    lage,
    `${MARKE}: ${wann} (${sprache}) — Phantomzeile oder Fehlersatz in der Liste`,
  ).toEqual({
    zeilen: 0,
    fehler: false,
  });
}

/** Die gespeicherte Arbeit ist da — gefragt über die montierte API mit den Keksen der Seite. */
async function gespeicherteArbeitIstDa(seite: Seite, wann: string): Promise<void> {
  const ko = await ausDerSeite(seite, `/api/kos/${koId}`);
  expect(
    ko.status,
    `${MARKE}: ${wann} — der gespeicherte Eintrag fehlt: ${ko.rumpf.slice(0, 200)}`,
  ).toBe(200);
  expect(
    ko.rumpf,
    `${MARKE}: ${wann} — der gespeicherte Eintrag trägt seinen Titel nicht`,
  ).toContain(KO_TITEL);
  const liste = await ausDerSeite(seite, "/api/gesamtanweisungen");
  expect(liste.status, `${MARKE}: ${wann} — Liste: ${liste.rumpf.slice(0, 200)}`).toBe(200);
  expect(JSON.parse(liste.rumpf), `${MARKE}: ${wann} — die Ablage meldet einen Eintrag`).toEqual({
    eintraege: [],
  });
}

describe("Restprüfung A7 · Journalbetrieb: Absage an der echten Fläche, nichts still verloren, nichts erfunden", () => {
  for (const sprache of SPRACHEN) {
    it(`(${sprache}) anlegen per Tastatur → sichtbare Absage, Eingabe bleibt, keine Weiterleitung; nach dem Neuladen ehrlich leer`, async () => {
      const { browser: b } = zeug();
      const { kontext, seite } = await profilFuer(b, sprache as Sprache);
      const titel = `Anlage anfahren (${sprache}, Restpruefung A7)`;
      try {
        await meldeAnMitTastatur(seite, basis, ADMIN, PASSWORT);
        await seite.goto(`${basis}${GESAMTANWEISUNG_PFAD}`, { waitUntil: "domcontentloaded" });
        await warte(seite, FLAECHE_STEHT_AUF, `die Fläche steht auf „${sprache}"`, sprache, 45_000);
        await listeIstEhrlichLeer(seite, sprache, "vor dem Versuch");

        await tippeAb(seite, "#ga-bereich-titel", titel, `Titel (${sprache})`, 250, true);
        await tabUndEnter(
          seite,
          '[data-testid="ga-bereich-anlegen"] button[type="submit"]',
          `Anlegen (${sprache})`,
          20,
          false,
        );
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-bereich-fehler"]')`,
          `${sprache}: der Absagesatz`,
          undefined,
          45_000,
        );
        await mussSichtbarTragen(
          seite,
          '[data-testid="ga-bereich-fehler"]',
          satz(sprache, "ga.ablageFluechtig"),
          `${sprache}: Absagesatz in Anwendersprache`,
        );
        const lage = await seite.evaluate<{ pfad: string; wert: string; seite: boolean }>(
          fn(`() => ({
            pfad: window.location.pathname,
            wert: document.querySelector("#ga-bereich-titel")?.value ?? "(kein Feld)",
            seite: !!document.querySelector('[data-testid="ga-seite"]'),
          })`),
        );
        expect(
          lage,
          `${MARKE}: ${sprache} — Weiterleitung trotz Absage oder Eingabe verloren`,
        ).toEqual({
          pfad: GESAMTANWEISUNG_PFAD,
          wert: titel,
          seite: false,
        });
        await gespeicherteArbeitIstDa(seite, `${sprache}, nach der Absage`);

        // DAS NEULADEN — die Seite verliert ihren Zustand, der Server nicht.
        await seite.reload({ waitUntil: "domcontentloaded" });
        await warte(seite, FLAECHE_STEHT_AUF, `nach dem Neuladen „${sprache}"`, sprache, 45_000);
        await listeIstEhrlichLeer(seite, sprache, "nach dem Neuladen");
        await gespeicherteArbeitIstDa(seite, `${sprache}, nach dem Neuladen`);
        // DIE UNBESTÄTIGTE ARBEIT IST NOCH DA: der abgelehnte Titel steht nach dem Neuladen wieder im
        // Feld — SICHTBAR gemessen am Feldwert UND am Knopf, der damit bedienbar ist. Eine alte
        // Absage steht nicht mehr da: sie gehörte zum Versuch vor dem Neuladen, nicht zum Titel.
        await warte(
          seite,
          `(t) => document.querySelector("#ga-bereich-titel")?.value === t`,
          `${sprache}: der abgelehnte Titel nach dem Neuladen im Feld`,
          titel,
          45_000,
        );
        const nachher = await seite.evaluate<{ wert: string; knopfAn: boolean; fehler: boolean }>(
          fn(`() => ({
            wert: document.querySelector("#ga-bereich-titel")?.value ?? "(kein Feld)",
            knopfAn: document.querySelector('[data-testid="ga-bereich-anlegen"] button[type="submit"]')?.disabled === false,
            fehler: !!document.querySelector('[data-testid="ga-bereich-fehler"]'),
          })`),
        );
        expect(
          nachher,
          `${MARKE}: ${sprache} — die unbestätigte Eingabe hat das Neuladen nicht überstanden`,
        ).toEqual({ wert: titel, knopfAn: true, fehler: false });
        process.stderr.write(
          `${MARKE} A7 (${sprache}): Titelfeld nach dem Neuladen = „${nachher.wert}" · Knopf bedienbar: ${nachher.knopfAn}\n`,
        );
      } finally {
        await kontext.close();
      }
    }, 600_000);
  }

  it("nach einem echten Prozessneustart aus derselben Journaldatei: Konto und Eintrag da, keine Anweisung erfunden", async () => {
    const { browser: b } = zeug();
    const alt = prozess as ChildProcessWithoutNullStreams;
    const pidVorher = alt.pid;
    await beende(alt);
    await expect(fetch(`${basis}/health`)).rejects.toThrow();
    prozess = await starte("Neustart");
    expect(prozess.pid, `${MARKE}: derselbe Prozess — dann war es kein Neustart`).not.toBe(
      pidVorher,
    );

    // Das Journal trägt Konto und Eintrag — und kein Wort über eine Gesamtanweisung.
    const inhalt = readFileSync(journal, "utf8");
    expect(inhalt, `${MARKE}: der Eintrag fehlt im Journal`).toContain(koId);
    expect(inhalt, `${MARKE}: das Journal verspricht eine Gesamtanweisung`).not.toContain(
      "gesamtanweisung",
    );

    const { kontext, seite } = await profilFuer(b, "de");
    try {
      // Die Anmeldung selbst ist der erste Beleg: das Konto kam aus dem Journal.
      await meldeAnMitTastatur(seite, basis, ADMIN, PASSWORT);
      await seite.goto(`${basis}${GESAMTANWEISUNG_PFAD}`, { waitUntil: "domcontentloaded" });
      await warte(seite, FLAECHE_STEHT_AUF, "nach dem Neustart „de“", "de", 45_000);
      await listeIstEhrlichLeer(seite, "de", "nach dem Prozessneustart");
      await gespeicherteArbeitIstDa(seite, "nach dem Prozessneustart");

      // Und die Tür lehnt weiter ab, statt nach dem Neustart still zu bestätigen.
      const versuch = await seite.evaluate<{ status: number; rumpf: string }>(
        fn(`() => fetch("/api/gesamtanweisungen", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ titel: "nach dem Neustart" }),
        }).then((r) => r.text().then((t) => ({ status: r.status, rumpf: t })))`),
      );
      expect(versuch.status, `${MARKE}: nach dem Neustart bestätigt die Anlage`).not.toBe(201);
      expect((JSON.parse(versuch.rumpf) as { error: string }).error).toBe(ABSAGE);
    } finally {
      await kontext.close();
    }
    process.stderr.write(
      `${MARKE} PROTOKOLL · Socket 127.0.0.1:${port} · pid1=${String(pidVorher)} pid2=${String(prozess.pid)} · Journal ${inhalt.length} Zeichen\n`,
    );
  }, 600_000);
});
