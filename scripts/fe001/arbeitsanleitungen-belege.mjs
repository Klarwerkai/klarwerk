// ================================================================================================
// FE-001 · PRÜFPAKET UND BILDBELEGE DER ARBEITSANLEITUNGEN — gegen eine FRISCHE, isolierte Instanz.
// ================================================================================================
//
// Zwei Aufrufe, derselbe Testbestand:
//
//   node scripts/fe001/arbeitsanleitungen-belege.mjs <basis-url> <ausgabeordner>
//       geht den Beispielablauf (anlegen → Kopf → drei Abschnitte über Titel suchen und Fassung
//       wählen → Reihenfolge → spätere Änderung eines Eintrags → Vergleich → vorlegen → Reload)
//       per Tastatur im echten Browser und legt Bilder bei 1280/1024/360 px ab. `MANIFEST.json`
//       bindet jedes Bild (SHA-256) an Commit, sauberen Arbeitsbaum, Build (`apps/web/dist`) und
//       die Version, die der laufende Server über `/health` meldet.
//
//   node scripts/fe001/arbeitsanleitungen-belege.mjs <basis-url> - --nur-bestand
//       richtet die Instanz ein und legt NUR die drei Beispieleinträge an (mit lesbarem
//       Dokumenttext) — der Ausgangspunkt der menschlichen Verständlichkeitsprobe
//       (`docs/Berater/FE-001_PRUEFPAKET_ARBEITSANLEITUNGEN_2026-09-26.md`).
//
// Die Schritte sind EXPORTIERT: `tests/fe001-arbeitsanleitungen/bilder-im-browser.integration.test.ts`
// nimmt die Pflichtbilder (Einstieg, Auswahl, Lesestand je 1280/1024/360 px) mit genau diesen
// Funktionen gegen eine PostgreSQL-Instanz auf — keine zweite Kopie der Bildlogik. Typen:
// `arbeitsanleitungen-belege.d.mts`.
//
// NIE gegen klarwerk.ai oder eine Instanz mit echten Inhalten richten: das Skript richtet ein
// Admin-Konto ein und legt Einträge an. Gedacht für `npm start` ohne DATABASE_URL (In-Memory) oder
// eine Wegwerf-Datenbank.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

/** Die drei Beispieleinträge — dieselben für Bildbelege und Verständlichkeitsprobe. */
export const BEISPIELBESTAND = [
  [
    "Arbeitsplatz im Homeoffice einrichten",
    "Bildschirm, Tastatur und Dockingstation anschließen und die Ergonomie prüfen.",
    "<h2>Aufbau</h2><p>Dockingstation anschließen, Bildschirm auf Augenhöhe stellen.</p><h2>Prüfen</h2><p>Kamera und Headset einmal testen.</p>",
  ],
  [
    "Sicher anmelden mit Zwei-Faktor",
    "Anmeldung nur mit Passwort und Bestätigung in der Authenticator-App.",
    "<h2>Erste Anmeldung</h2><p>Passwort setzen und die Authenticator-App koppeln.</p>",
  ],
  [
    "Hilfe bei IT-Problemen holen",
    "Bei Störungen zuerst das Ticketportal nutzen, im Notfall die Hotline anrufen.",
    "<p>Ticketportal: Kategorie wählen, Problem kurz beschreiben. Im Notfall die Hotline anrufen.</p>",
  ],
];

/** Suchbegriffe, mit denen ein Mensch die drei Einträge über ihren Titel findet. */
export const SUCHBEGRIFFE = ["Homeoffice", "anmelden", "IT-Problemen"];

/** Die geprüften Breiten (E9): Desktop, Laptop, schmal. */
export const BREITEN = [1280, 1024, 360];

/** Die Normalhöhe je Breite, bevor ein Vollbild auf die Inhaltshöhe gestreckt wird. */
function normalhoehe(breite) {
  return breite <= 400 ? 740 : 800;
}

const ANMELDUNG = { name: "Pia Beispiel", email: "pia@fe001.test", passwort: "fe001-Passwort-1" };

export function starteBrowser() {
  return chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
}

/** Ein Protokoll, das mitschreibt und zugleich auf die Konsole geht. */
export function neuesProtokoll() {
  const zeilen = [];
  return {
    zeilen,
    log: (z) => {
      zeilen.push(z);
      console.log(z);
    },
  };
}

// Der App-Rahmen scrollt in einem inneren Behälter; für ein Vollbild wird die Fensterhöhe auf die
// Inhaltshöhe gestellt (Breite = der geprüfte Viewport).
async function inhaltshoehe(seite) {
  return seite.evaluate(() => {
    let h = document.documentElement.scrollHeight;
    for (const e of document.querySelectorAll("*")) {
      const s = getComputedStyle(e);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && e.scrollHeight > e.clientHeight) {
        h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top);
      }
    }
    return Math.ceil(h);
  });
}

/**
 * Ein Bild bei GENAU dieser Breite. Ohne `nurFenster` wird die Höhe auf den Inhalt gestreckt
 * (höchstens 9000 px). Rückgabe: Datei, Adresse und der tatsächlich gesetzte Viewport — das Bild
 * hat exakt diese Maße (Gerätefaktor 1).
 */
async function fotoBei(seite, aus, name, breite, { nurFenster = false, log = () => {}, hauptaktion } = {}) {
  const normal = normalhoehe(breite);
  await seite.setViewportSize({ width: breite, height: normal });
  await seite.waitForTimeout(300);
  let hoehe = normal;
  if (!nurFenster) {
    hoehe = Math.max(normal, Math.min(await inhaltshoehe(seite), 9000));
    await seite.setViewportSize({ width: breite, height: hoehe });
    await seite.waitForTimeout(300);
  }
  // Unmittelbar vor der Aufnahme, im endgültigen Viewport: kein Hinweis, Hauptaktion frei (BEN-04).
  if (hauptaktion) {
    await hauptaktionFrei(seite, hauptaktion, `${name}@${breite}`);
  } else if (await hinweisSichtbar(seite)) {
    throw new Error(`${name}@${breite}: der Nutzungshinweis ist sichtbar — kein Bild.`);
  }
  const datei = join(aus, `${name}-${breite}.png`);
  await seite.screenshot({ path: datei });
  const url = seite.url();
  log(`FOTO ${datei} · ${url} · Viewport ${breite}x${hoehe}${nurFenster ? "" : " (Vollhöhe)"}`);
  return { datei, name, url, viewport: { width: breite, height: hoehe } };
}

/** Breite wechseln und warten: der Wechsel auf die schmale Hülle montiert die Seite neu. */
export async function aufBreite(seite, breite) {
  await seite.setViewportSize({ width: breite, height: normalhoehe(breite) });
  await seite.waitForTimeout(1500);
}

async function api(seite, methode, pfad, rumpf) {
  return seite.evaluate(
    async ([m, p, r]) => {
      const a = await fetch(p, {
        method: m,
        credentials: "include",
        headers: r ? { "Content-Type": "application/json" } : {},
        body: r ? JSON.stringify(r) : undefined,
      });
      return { status: a.status, text: await a.text() };
    },
    [methode, pfad, rumpf],
  );
}

/**
 * Der Nutzungshinweis (`NoticeBanner`) über die REGULÄRE Bestätigung „Verstanden — weiter".
 *
 * Ben, Lauf 4 Runde 3 (BEN-04): der Hinweis erscheint ASYNCHRON — erst wenn die Schalterauskunft
 * (`/api/features`) und der Vermerk am Konto (`/api/auth/notice`) im Browser angekommen sind. Eine
 * einmalige Existenzabfrage direkt nach dem Kopfband übersah einen später erscheinenden Hinweis; er
 * blieb stehen und verdeckte in den Einstiegsbildern die Hauptaktion. Deshalb entscheidet hier der
 * SERVER, ob der Hinweis fällig ist, und nicht der zufällige Zeichenstand der Seite:
 *
 *   · fällig (Schalter an, Vermerk `due`) → auf den Knopf WARTEN, ihn klicken, warten bis der
 *     Hinweis verschwunden ist, und am Server nachsehen, dass der Vermerk jetzt gesetzt ist;
 *   · nicht fällig → es darf auch keiner sichtbar sein.
 *
 * Kein Entfernen oder Verändern des Hinweises über das DOM. Scheitert einer der Schritte, wirft die
 * Funktion — ein Bild mit ungeklärtem Hinweis ist kein Beleg.
 */
async function nutzungshinweisBestaetigen(seite, log = () => {}) {
  const lies = async (pfad) => {
    const a = await api(seite, "GET", pfad);
    if (a.status !== 200) throw new Error(`Nutzungshinweis: ${pfad} antwortet ${a.status} ${a.text}`);
    return JSON.parse(a.text);
  };
  const schalter = (await lies("/api/features")).features?.hinweisbanner === true;
  const faellig = (await lies("/api/auth/notice")).due === true;
  if (!schalter || !faellig) {
    if (await hinweisSichtbar(seite)) {
      throw new Error("Nutzungshinweis sichtbar, obwohl der Server ihn nicht als fällig meldet.");
    }
    log(`Nutzungshinweis nicht fällig (Schalter ${schalter ? "an" : "aus"}, Vermerk fällig: ${faellig}).`);
    return;
  }
  // Die Hülle kennt mehrere Plätze für den Hinweis (schmal/breit) — gemeint ist der SICHTBARE.
  const knopf = seite.locator('[data-testid="notice-ack"]:visible');
  await knopf.waitFor({ state: "visible", timeout: 20000 });
  await knopf.click();
  await seite.waitForFunction(
    () => ![...document.querySelectorAll('[data-testid="notice-banner"]')].some((e) => e.checkVisibility()),
    undefined,
    { timeout: 20000 },
  );
  if ((await lies("/api/auth/notice")).due !== false) {
    throw new Error("Nutzungshinweis bestätigt, aber der Server meldet ihn weiter als fällig.");
  }
  log("Nutzungshinweis über „Verstanden — weiter“ bestätigt; der Server führt ihn als erledigt.");
}

/** Ist irgendwo ein Nutzungshinweis sichtbar? (Mehrere Plätze in der Hülle möglich.) */
async function hinweisSichtbar(seite) {
  return (await seite.locator('[data-testid="notice-banner"]:visible').count()) > 0;
}

/**
 * Vor jedem Pflichtbild: kein Nutzungshinweis sichtbar, und die Hauptaktion der Ansicht ist
 * sichtbar und an ihrem Mittelpunkt NICHT von einem anderen Element überdeckt. Wirft sonst — ein
 * Bild mit verdeckter Hauptaktion zählt nicht als Beleg (E2/E9).
 */
async function hauptaktionFrei(seite, hauptaktion, bezeichnung) {
  if (await hinweisSichtbar(seite)) {
    throw new Error(`${bezeichnung}: der Nutzungshinweis ist sichtbar — kein Bild.`);
  }
  await hauptaktion.scrollIntoViewIfNeeded();
  if (!(await hauptaktion.isVisible())) {
    throw new Error(`${bezeichnung}: die Hauptaktion ist nicht sichtbar — kein Bild.`);
  }
  const frei = await hauptaktion.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return oben !== null && (oben === el || el.contains(oben));
  });
  if (!frei) {
    throw new Error(`${bezeichnung}: die Hauptaktion ist von einem anderen Element verdeckt — kein Bild.`);
  }
}

/** Die Hauptaktion des Einstiegs: der Knopf „Neue Arbeitsanleitung erstellen" im Anlegeformular. */
function erstellenKnopf(seite) {
  return seite.locator('form:has(#ga-bereich-titel) button[type="submit"]');
}

/**
 * Ersteinrichtung über die echte Maske (frischer Bestand) und die drei Beispieleinträge über die
 * API. Rückgabe: die Kennungen der Einträge in der Reihenfolge von `BEISPIELBESTAND`.
 */
export async function richteEin(seite, basis, log = () => {}) {
  await seite.goto(basis);
  const pw = seite.locator('input[type="password"]');
  await pw.first().or(seite.getByTestId("kopfband")).waitFor({ timeout: 20000 });
  if (await pw.count()) {
    const name = seite.locator('form input:not([type="email"]):not([type="password"])');
    if (await name.count()) await name.first().fill(ANMELDUNG.name);
    await seite.locator('input[type="email"]').fill(ANMELDUNG.email);
    for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill(ANMELDUNG.passwort);
    await seite.locator('button[type="submit"]').click();
  }
  await seite.getByTestId("kopfband").waitFor({ timeout: 20000 });
  log(`Angemeldet als ${ANMELDUNG.name} (Ersteinrichtung, Rolle admin).`);
  await nutzungshinweisBestaetigen(seite, log);

  const ids = [];
  for (const [title, statement, bodyHtml] of BEISPIELBESTAND) {
    const a = await api(seite, "POST", "/api/kos", {
      confidentiality: "intern",
      title,
      statement,
      bodyHtml,
      type: "best_practice",
      category: "Einarbeitung",
    });
    if (a.status !== 201) throw new Error(`KO ${title}: ${a.status} ${a.text}`);
    const id = JSON.parse(a.text).id;
    ids.push(id);
    const v = await api(seite, "GET", `/api/kos/${id}/versions`);
    log(
      `Eintrag „${title}" angelegt (${a.status}); gespeicherte Fassungen: ${JSON.parse(v.text).map((x) => x.version).join(", ") || "keine"}`,
    );
  }
  return ids;
}

/** Einstieg: Übersicht öffnen und auf den Leerzustand warten. */
export async function oeffneEinstieg(seite, basis) {
  await seite.goto(`${basis}/gesamtanweisungen`);
  await seite.getByTestId("ga-liste-leer").waitFor();
}

/** Titel per Tastatur eintragen, Hauptaktion per Enter — Rückgabe: Adresse der neuen Anleitung. */
export async function anleitungAnlegen(seite, titel) {
  await seite.locator("#ga-bereich-titel").focus();
  await seite.keyboard.type(titel);
  await seite.keyboard.press("Enter");
  await seite.getByTestId("ga-seite").waitFor({ timeout: 15000 });
  return seite.url();
}

export const KOPF = {
  zweck: "Neue Mitarbeitende richten ihren Arbeitsplatz im Homeoffice selbst ein und melden sich sicher an.",
  geltungsbereich: "Alle Teams, erste Arbeitswoche",
  voraussetzungen: "Dienstlaptop und Zugangsdaten erhalten",
};

export async function kopfSpeichern(seite, log = () => {}) {
  await seite.locator("#ga-kopf-zweck").fill(KOPF.zweck);
  await seite.locator("#ga-kopf-geltungsbereich").fill(KOPF.geltungsbereich);
  await seite.locator("#ga-kopf-voraussetzungen").fill(KOPF.voraussetzungen);
  await seite.getByTestId("ga-kopf-speichern").click();
  await seite.getByTestId("ga-kopf-gespeichert").waitFor();
  log("Kopfangaben gespeichert (Server bestätigt).");
}

/** Auswahl per Tastatur: suchen → Treffer → erste Fassung → Vorschau steht. */
async function waehle(seite, begriff, koId) {
  await seite.locator("#ga-aufnahme-suche").fill("");
  await seite.locator("#ga-aufnahme-suche").focus();
  await seite.keyboard.type(begriff);
  await seite.keyboard.press("Enter");
  const treffer = seite.locator(`[data-testid="ga-aufnahme-treffer-eintrag"][data-ko="${koId}"]`);
  await treffer.waitFor();
  await treffer.focus();
  await seite.keyboard.press("Enter");
  const radio = seite.locator('input[name="ga-aufnahme-fassung"]').first();
  await radio.waitFor();
  await radio.focus();
  await seite.keyboard.press("Space");
  await seite.getByTestId("ga-aufnahme-vorschau").waitFor();
}

/** Die gewählte Fassung per Tastatur aufnehmen und warten, bis der Abschnitt im Lesestand steht. */
async function nimmGewaehltAuf(seite, begriff, log = () => {}) {
  const vorher = await seite.locator('[data-testid="ga-lesestand-baustein"]').count();
  await seite.getByTestId("ga-aufnahme-knopf").focus();
  log(
    `Fokus vor Enter: ${await seite.evaluate(() => document.activeElement?.getAttribute("data-testid"))} · gesperrt=${await seite.getByTestId("ga-aufnahme-knopf").isDisabled()}`,
  );
  await seite.keyboard.press("Enter");
  await seite.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n,
    vorher + 1,
  );
  log(`Aufgenommen per Tastatur: „${begriff}" → ${await seite.getByTestId("ga-aufnahme-erfolg").innerText()}`);
}

export async function nimmAuf(seite, begriff, koId, log = () => {}) {
  await waehle(seite, begriff, koId);
  await nimmGewaehltAuf(seite, begriff, log);
}

/** PFLICHTBILD Einstieg (E1/E2) bei dieser Breite — die Übersicht muss schon offen sein. */
export async function einstiegsbild(seite, aus, breite, log = () => {}) {
  await aufBreite(seite, breite);
  await seite.getByTestId("ga-liste-leer").waitFor();
  return fotoBei(seite, aus, "01-einstieg-leer", breite, { log, hauptaktion: erstellenKnopf(seite) });
}

/**
 * PFLICHTBILD Inhalts-/Fassungsauswahl (E4) bei dieser Breite. ERST die Breite, DANN die Auswahl:
 * der Wechsel auf die schmale Hülle montiert die Seite neu, eine vorher getroffene Wahl wäre weg.
 */
export async function auswahlbild(seite, aus, breite, begriff, koId, log = () => {}) {
  await aufBreite(seite, breite);
  await waehle(seite, begriff, koId);
  await seite.getByTestId("ga-aufnahme").scrollIntoViewIfNeeded();
  return fotoBei(seite, aus, "03-auswahl-fassung-vorschau", breite, {
    log,
    hauptaktion: seite.getByTestId("ga-aufnahme-knopf"),
  });
}

/** PFLICHTBILD gefüllter Lesestand (E5/E6) bei dieser Breite. */
export async function lesestandbild(seite, aus, breite, log = () => {}) {
  await aufBreite(seite, breite);
  await seite.getByTestId("ga-lesestand-dokument").waitFor();
  await seite.getByTestId("ga-lesestand").scrollIntoViewIfNeeded();
  return fotoBei(seite, aus, "04-lesestand-gefuellt", breite, {
    log,
    hauptaktion: seite.getByTestId("ga-lesestand-dokument"),
  });
}

export function sha256(datei) {
  return createHash("sha256").update(readFileSync(datei)).digest("hex");
}

/** Breite und Höhe aus dem IHDR-Block einer PNG-Datei — ohne Bildbibliothek. */
export function pngMasse(datei) {
  const b = readFileSync(datei);
  const signatur = "89504e470d0a1a0a";
  if (b.length < 24 || b.subarray(0, 8).toString("hex") !== signatur || b.subarray(12, 16).toString("latin1") !== "IHDR") {
    return null;
  }
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function git(...a) {
  return execFileSync("git", a, { encoding: "utf8" }).trim();
}

/** Bindung an den Kandidaten: Commit, Arbeitsbaum, gebaute Fläche. */
export function kandidat() {
  const distIndex = "apps/web/dist/index.html";
  return {
    commit: git("rev-parse", "HEAD"),
    arbeitsbaumSauber: git("status", "--porcelain", "--untracked-files=no").length === 0,
    build: existsSync(distIndex)
      ? {
          indexHtmlSha256: sha256(distIndex),
          skripte: readFileSync(distIndex, "utf8").match(/assets\/[^"]+\.js/g) ?? [],
        }
      : null,
  };
}

// ── Kommandozeile: der ganze Beispielablauf mit allen Bildern ────────────────────────────────────
async function hauptlauf() {
  const BASIS = process.argv[2] ?? "http://127.0.0.1:3187";
  const AUS = process.argv[3] && process.argv[3] !== "-" ? process.argv[3] : ".local/run/fe001-belege";
  const NUR_BESTAND = process.argv.includes("--nur-bestand");
  if (!NUR_BESTAND) mkdirSync(AUS, { recursive: true });
  const { zeilen: protokoll, log } = neuesProtokoll();

  const browser = await starteBrowser();
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "de-DE" });
  const seite = await kontext.newPage();
  const konsole = [];
  seite.on("request", (r) => {
    if (r.url().includes("/api/gesamtanweisungen") && r.method() !== "GET") log(`REQ ${r.method()} ${new URL(r.url()).pathname}`);
  });
  seite.on("console", (m) => {
    if (m.type() === "error") konsole.push(m.text());
  });

  async function foto(name, breiten = [1280], nurFenster = false) {
    for (const b of breiten) await fotoBei(seite, AUS, name, b, { nurFenster, log });
    await seite.setViewportSize({ width: 1280, height: 800 });
    await seite.waitForTimeout(1200);
  }

  const ids = await richteEin(seite, BASIS, log);
  if (NUR_BESTAND) {
    log(`Testbestand angelegt. Anmeldung: ${ANMELDUNG.email} / ${ANMELDUNG.passwort} · Einstieg: ${BASIS}/gesamtanweisungen`);
    await browser.close();
    return;
  }

  // ── 1 · Einstieg (leer) ───────────────────────────────────────────────────────────────────────
  await oeffneEinstieg(seite, BASIS);
  for (const b of BREITEN) await einstiegsbild(seite, AUS, b, log);
  await aufBreite(seite, 1280);

  await anleitungAnlegen(seite, "Start im Homeoffice");
  await seite.getByTestId("ga-vergleich-zu-wenige").waitFor();
  const vergleichText = await seite.getByTestId("ga-vergleich").innerText();
  log(`Detail geöffnet: ${seite.url()} · Vergleich zeigt: ${vergleichText.replace(/\s+/g, " ").slice(0, 160)}`);
  log(`Vergleich enthält „Lädt": ${vergleichText.includes("Lädt")}`);
  await foto("02-detail-neu", [1280, 360]);

  // ── 2 · Worum geht es? ────────────────────────────────────────────────────────────────────────
  await kopfSpeichern(seite, log);

  // ── 3 · Auswahl per Tastatur: suchen → Treffer → Fassung ──────────────────────────────────────
  for (const b of BREITEN) await auswahlbild(seite, AUS, b, SUCHBEGRIFFE[0], ids[0], log);
  await aufBreite(seite, 1280);
  await nimmAuf(seite, SUCHBEGRIFFE[0], ids[0], log);
  await nimmAuf(seite, SUCHBEGRIFFE[1], ids[1], log);
  await nimmAuf(seite, SUCHBEGRIFFE[2], ids[2], log);

  // Leere Suche / keine Treffer (Beleg der Unterscheidung)
  await seite.locator("#ga-aufnahme-suche").fill("Raumfahrt");
  await seite.keyboard.press("Enter");
  await seite.getByTestId("ga-aufnahme-suche-leer").waitFor();
  log(`Keine Treffer: ${await seite.getByTestId("ga-aufnahme-suche-leer").innerText()}`);
  await seite.getByTestId("ga-aufnahme").scrollIntoViewIfNeeded();
  await foto("03b-suche-ohne-treffer", [1280]);

  // ── 3c · HTTP 403 beim Fassungsabruf — mit und ohne Zwischenspeicher (E4, Gegenprobe 27.09.) ──
  // SIMULATION IM BROWSER: `page.route` beantwortet NUR `GET /api/kos/<Eintrag 1>/versions` mit 403.
  // Kein Rechteentzug am Server, kein Aufnahme-POST in diesem Schritt.
  const versionsPfad = `/api/kos/${ids[0]}/versions`;
  async function sage403(an) {
    if (an) {
      await seite.route(`**${versionsPfad}`, (r) =>
        r.request().method() === "GET"
          ? r.fulfill({
              status: 403,
              contentType: "application/json",
              body: JSON.stringify({ error: "FORBIDDEN", message: "Keine Berechtigung: ko.read" }),
            })
          : r.continue(),
      );
    } else {
      await seite.unroute(`**${versionsPfad}`);
    }
  }
  async function absagebild(lage) {
    await seite.getByTestId("ga-aufnahme-fassungen-fehler").waitFor();
    const befund = {
      hinweis: (await seite.getByTestId("ga-aufnahme-fassungen-fehler").innerText()).replace(/\s+/g, " "),
      radios: await seite.locator('input[name="ga-aufnahme-fassung"]').count(),
      vorschau: await seite.getByTestId("ga-aufnahme-vorschau").count(),
      aufnahmeGesperrt: await seite.getByTestId("ga-aufnahme-knopf").isDisabled(),
      sperrgrund: await seite.getByTestId("ga-aufnahme-sperre").innerText(),
    };
    log(`403 (${lage}, simuliert): ${JSON.stringify(befund)}`);
  }
  async function waehle403() {
    await seite.locator("#ga-aufnahme-suche").fill("Homeoffice");
    await seite.keyboard.press("Enter");
    await seite.locator(`[data-testid="ga-aufnahme-treffer-eintrag"][data-ko="${ids[0]}"]`).click();
  }
  await waehle(seite, "Homeoffice", ids[0]);
  log("Eintrag 1 geladen, Fassung 1 gewählt (HTTP 200); warte 31 s, bis der gemerkte Stand veraltet ist.");
  await seite.waitForTimeout(31000);
  await sage403(true);
  // Kurz einen anderen Eintrag wählen und zurück: Eintrag 1 wird aus dem gemerkten Stand neu abgerufen.
  await seite.locator("#ga-aufnahme-suche").fill("IT-Problemen");
  await seite.keyboard.press("Enter");
  await seite.locator(`[data-testid="ga-aufnahme-treffer-eintrag"][data-ko="${ids[2]}"]`).click();
  await seite.locator('input[name="ga-aufnahme-fassung"]').first().waitFor();
  await waehle403();
  await absagebild("mit Cache");
  await seite.getByTestId("ga-aufnahme").scrollIntoViewIfNeeded();
  await foto("03c-fassungen-403-mit-cache", [1280]);
  await seite.reload();
  await seite.getByTestId("ga-lesestand-dokument").waitFor();
  await waehle403();
  await absagebild("ohne Cache, nach Reload");
  await seite.getByTestId("ga-aufnahme").scrollIntoViewIfNeeded();
  await foto("03d-fassungen-403-nach-reload", [1280]);
  // Schmale Ansicht: der Wechsel montiert die Seite neu — dort erneut wählen.
  await aufBreite(seite, 360);
  await waehle403();
  await absagebild("schmal 360 px");
  await fotoBei(seite, AUS, "03d-fassungen-403-nach-reload", 360, { log });
  await aufBreite(seite, 1280);
  await waehle403();
  await absagebild("zurück auf 1280 px");
  await sage403(false);
  await seite.getByTestId("ga-aufnahme-fassungen-fehler").getByRole("button").click();
  await seite.locator('input[name="ga-aufnahme-fassung"]').first().waitFor();
  log(
    `Nach erfolgreichem neuem Abruf: Fassung vorausgewählt=${(await seite.locator('input[name="ga-aufnahme-fassung"]:checked').count()) > 0}, Aufnahme gesperrt=${await seite.getByTestId("ga-aufnahme-knopf").isDisabled()}, Sperrgrund=${await seite.getByTestId("ga-aufnahme-sperre").innerText()}`,
  );

  // ── 4 · Reihenfolge ändern: den dritten Abschnitt nach oben ───────────────────────────────────
  const dritter = seite.locator('[data-testid="ga-lesestand-baustein"]').nth(2);
  await dritter.getByRole("button", { name: /nach oben verschieben/ }).click();
  await seite.waitForFunction(() =>
    (document.querySelectorAll('[data-testid="ga-lesestand-baustein"]')[1]?.textContent || "").includes("Hilfe bei IT-Problemen"),
  );
  log("Reihenfolge geändert: Hilfe bei IT-Problemen holen steht jetzt an Stelle 2.");

  // ── 5 · Spätere Änderung eines Einzelinhalts → Aktualisierungsvorschlag, keine stille Ersetzung
  const rev = await api(seite, "PUT", `/api/kos/${ids[1]}`, {
    action: "revise",
    expectedVersion: 1,
    changes: { statement: "Anmeldung nur mit Passwort und Bestätigung per Hardware-Schlüssel." },
  });
  log(`Eintrag Sicher anmelden überarbeitet: HTTP ${rev.status}`);
  await seite.reload();
  await seite.getByTestId("ga-lesestand-dokument").waitFor();
  await seite.waitForTimeout(500);
  log(`Aktualisierungsvorschläge sichtbar: ${await seite.getByTestId("ga-lesestand-vorschlag").count()}`);
  for (const b of BREITEN) await lesestandbild(seite, AUS, b, log);
  await aufBreite(seite, 1280);

  // ── 6 · Was hat sich geändert? ────────────────────────────────────────────────────────────────
  await seite.getByTestId("ga-vergleich-letzte").click();
  await seite.getByTestId("ga-vergleich-ergebnis").waitFor();
  log(`Vergleich (letzte Änderung): ${await seite.getByTestId("ga-vergleich-gesamt").innerText()}`);
  await seite.getByTestId("ga-vergleich").scrollIntoViewIfNeeded();
  await foto("05-vergleich", [1280]);

  // ── 7 · Vorlegen ──────────────────────────────────────────────────────────────────────────────
  await seite.getByTestId("ga-entscheidung-vorlegen").click();
  await seite.waitForFunction(() =>
    (document.querySelector('[data-testid="ga-entscheidung-stand"]')?.textContent || "").includes("Vorgelegt"),
  );
  log(`Vorgelegt. Erklärung: ${await seite.getByTestId("ga-entscheidung-erklaerung").innerText()}`);
  await seite.getByTestId("ga-entscheidung").scrollIntoViewIfNeeded();
  await foto("06-vorgelegt", [1280]);

  // ── 8 · Reload: alles gespeichert? ────────────────────────────────────────────────────────────
  await seite.reload();
  await seite.getByTestId("ga-lesestand-dokument").waitFor();
  const nachReload = await seite.getByTestId("ga-lesestand-dokument").innerText();
  log(
    `Nach Reload: Zweck vorhanden=${nachReload.includes("Neue Mitarbeitende")}, Abschnitte=${await seite.locator('[data-testid="ga-lesestand-baustein"]').count()}, Stand=${await seite.getByTestId("ga-entscheidung-stand").innerText()}`,
  );

  // ── 9 · Seitenhilfe ohne KI ───────────────────────────────────────────────────────────────────
  await seite.getByTestId("kopfband-zahnrad").click();
  await seite.getByTestId("zahnrad-seitenhilfe").click();
  await seite.getByTestId("seitenhilfe-liste").waitFor();
  log(`Seitenhilfe (Detail): ${(await seite.getByTestId("seitenhilfe-liste").innerText()).replace(/\s+/g, " ").slice(0, 200)}`);
  await foto("07-seitenhilfe-detail", [1280]);
  await seite.keyboard.press("Escape");

  // ── 10 · Übersicht mit Bestand ────────────────────────────────────────────────────────────────
  await seite.goto(`${BASIS}/gesamtanweisungen`);
  await seite.getByTestId("ga-liste-eintrag").first().waitFor();
  const zeile = await seite.getByTestId("ga-liste-eintrag").first().innerText();
  log(`Übersicht-Zeile: ${zeile.replace(/\s+/g, " ")}`);
  log(`Zeile enthält ISO-Zeit: ${/\d{4}-\d{2}-\d{2}T\d{2}:/.test(zeile)} · enthält UUID: ${/[0-9a-f]{8}-[0-9a-f]{4}-/.test(zeile)}`);
  await foto("08-uebersicht-mit-bestand", BREITEN);

  // ── 11 · Fokus sichtbar (Tastatur) ────────────────────────────────────────────────────────────
  await seite.locator("#ga-bereich-titel").focus();
  await seite.keyboard.press("Shift+Tab");
  await seite.keyboard.press("Tab");
  await seite.keyboard.press("Tab");
  const fokus = await seite.evaluate(() => {
    const a = document.activeElement;
    const s = a ? getComputedStyle(a) : null;
    return { tag: a?.tagName, text: a?.textContent?.slice(0, 40), boxShadow: s?.boxShadow, outline: s?.outlineStyle };
  });
  log(`Fokus nach Tab: ${JSON.stringify(fokus)}`);
  await foto("09-fokus-sichtbar", [1280], true);

  log(
    `Browser: Chromium ${browser.version()} (headless) · Konsolenfehler: ${konsole.length}${konsole.length ? ` — ${konsole.slice(0, 3).join(" | ")}` : ""}`,
  );
  // ── Bindung an den Kandidaten ─────────────────────────────────────────────────────────────────
  const gesundheit = await (await fetch(`${BASIS}/health`)).json().catch(() => ({}));
  const bilder = readdirSync(AUS)
    .filter((n) => n.endsWith(".png"))
    .sort()
    .map((n) => ({ datei: n, sha256: sha256(join(AUS, n)) }));
  const manifest = {
    kandidat: kandidat(),
    server: { basis: BASIS, health: gesundheit, datenhaltung: "In-Memory (frische Instanz)" },
    browser: `Chromium ${browser.version()} (headless)`,
    viewports: BREITEN,
    aufgenommen: new Date().toISOString(),
    bilder,
  };
  writeFileSync(join(AUS, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`Kandidat ${manifest.kandidat.commit} · Arbeitsbaum sauber: ${manifest.kandidat.arbeitsbaumSauber} · Bilder: ${bilder.length}`);
  writeFileSync(join(AUS, "protokoll.txt"), `${protokoll.join("\n")}\n`);
  await browser.close();
}

// Nur als Programm aufgerufen läuft der Ablauf — beim Import aus einem Test NICHT.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await hauptlauf();
}
