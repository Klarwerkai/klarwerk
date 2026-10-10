// ================================================================================================
// ASSISTENZ IM PRODUKT (produkt:20261010:assistenz-produkteinstieg) — DER NORMALE EINSTIEG IM BROWSER.
// ================================================================================================
//
// Zwei Sonden am gebündelten Produkt, mit echtem Server und echter Anmeldung — und OHNE vorherigen
// Aufruf von `/klara-vorschau`, ohne gesetzten Sitzungsspeicher:
//   1. Desktop 1280 × 800: Start (nach der Anmeldung), Fragen und eine Artikelseite zeigen die
//      Assistenz beschriftet im Produktbetrieb. Öffnen → Einwilligung → echte Frage → Seitenwechsel
//      → Minimieren → erneut Öffnen → Neuladen: dasselbe Gespräch, derselbe Bezug, dieselbe
//      angefangene Eingabe. Hilfeknopf und Assistenz schliessen einander; die Vorschau ist getrennt
//      und gekennzeichnet, „Vorschau beenden“ führt zurück in den Produktbetrieb.
//   2. 390 × 844 mit reduzierter Bewegung, nur Tastatur: Finden (Tab), sichtbarer Fokus, Touch-Ziele,
//      Öffnen, Gespräch, Seitenwechsel, Minimieren, erneut Öffnen, Neuladen, Rückweg mit Escape.
//
// Läuft im ISOLIERTEN Kontext (`chromium-zustand`, `ZUSTAND_SPEC`): Sonde 1 legt für die
// Artikelseite einen fiktiven, freigegebenen Beitrag an. Eigene Konten wie in
// `klara-basis-browser.spec.ts`. Alle Inhalte sind fiktiv.
//
// WAS DIESE SONDEN NICHT ERSETZEN: Im Tor ist kein Modell aktiv — die Antworten sind „Ohne KI“.
// Eine Antwort eines echten Anbieters, die Live-Instanz und das Urteil eines Menschen belegt dieser
// Lauf nicht; Firefox und WebKit laufen im isolierten Projekt nicht mit.
import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Assistenz-Produkt-Kennwort-1";
const NEUTRAL = "Deine Assistenz";
const ANGEFANGEN = "Angefangene Frage, noch nicht gesendet";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `assistenz-produkt-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Assistenz Produkt ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(
  browser: Browser,
  email: string,
  groesse: { width: number; height: number },
): Promise<Page> {
  const kontext = await browser.newContext({ viewport: groesse });
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  return page;
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Assistenz im Produkt — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) {
    throw new Error("Element ohne Box");
  }
  return b;
}

function ueberlappen(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function imFenster(page: Page, l: Locator, wann: string): Promise<void> {
  const v = page.viewportSize();
  if (!v) {
    throw new Error("keine Fenstergrösse");
  }
  const b = await box(l);
  expect(b.x >= 0 && b.x + b.width <= v.width + 1, `${wann}: waagrecht ausserhalb`).toBe(true);
  expect(b.y >= 0 && b.y + b.height <= v.height + 1, `${wann}: senkrecht ausserhalb`).toBe(true);
}

// produkt:20261010:assistenz-name-avatar (K6): ohne gespeichertes Profil heisst der Hilfeknopf
// neutral — kein fester Produktname mehr.
const hilfeKnopf = (page: Page) =>
  page.locator('button[data-klara="1"][aria-label="Assistenz öffnen — Hilfe zu dieser Seite"]');
const hilfeFlaeche = (page: Page) =>
  page.locator('section[data-klara="1"][aria-label="Deine Assistenz"]');
const nachrichten = (page: Page) => page.locator('[data-testid="klara-nachricht"]');
const letzteKlara = (page: Page) =>
  page.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();

/** Der Einstieg ist da — ohne Vorschau, im Produktbetrieb, sichtbar beschriftet. */
async function einstiegSichtbar(page: Page, wo: string): Promise<Locator> {
  const figur = page.getByTestId("klara-figur");
  await expect(figur, `${wo}: Assistenz fehlt`).toBeVisible({ timeout: 15_000 });
  await expect(figur).toHaveAttribute("data-betriebsart", "produkt");
  await expect(figur).toHaveAttribute("data-betrieb", "echt");
  await expect(figur).toHaveAccessibleName(
    `${NEUTRAL} – persönliches Gespräch öffnen oder schließen`,
  );
  await expect(page.getByTestId("klara-figur-name")).toHaveText(NEUTRAL);
  await expect(page.getByTestId("klara-figur-demo")).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("klarwerk.klaraVorschau.aktiv")),
    `${wo}: Vorschau-Schalter gesetzt`,
  ).toBeNull();
  // Die Figur samt Beschriftung verdeckt den Hilfeknopf nicht.
  await expect(hilfeKnopf(page)).toBeVisible();
  const huelle = await box(page.getByTestId("klara-figur-huelle"));
  const name = await box(page.getByTestId("klara-figur-name"));
  const hilfe = await box(hilfeKnopf(page));
  const verdeckt = ueberlappen(huelle, hilfe) || ueberlappen(name, hilfe);
  expect(verdeckt, `${wo}: verdeckt Hilfe`).toBe(false);
  await imFenster(page, figur, wo);
  return figur;
}

/** Die (geschlossene) Figur samt Beschriftung liegt nicht über Fragefeld und Absenden der Seite. */
async function fragenBedienbar(page: Page, wo: string): Promise<void> {
  await expect(page.getByTestId("klara-gespraech")).toHaveCount(0);
  const huelle = await box(page.getByTestId("klara-figur-huelle"));
  for (const ziel of ["fragen.fragefeld", "fragen.absenden"]) {
    const el = page
      .locator(`[data-testid="page-fragen"] [data-tutorial-ziel="${ziel}"]:visible`)
      .first();
    await expect(el, `${wo}: ${ziel} fehlt`).toBeVisible();
    expect(ueberlappen(huelle, await box(el)), `${wo}: Figur verdeckt ${ziel}`).toBe(false);
  }
}

/** Öffnen und warten, bis das gespeicherte Gespräch vom Server gelesen ist. */
async function oeffnen(page: Page): Promise<Locator> {
  const gespraech = page.getByTestId("klara-gespraech");
  if (!(await gespraech.isVisible())) {
    await page.getByTestId("klara-figur").click();
  }
  await expect(gespraech).toBeVisible();
  await expect(page.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  return gespraech;
}

test("Assistenz im Produkt · Desktop: ohne Vorschau sichtbar auf Start, Fragen und Artikel, echtes Gespräch, Seitenwechsel, Minimieren, Neuladen", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);

  // Ein fiktiver, freigegebener Beitrag für die Artikelseite.
  const m = marke();
  const titel = `Probedichtung AP${m} wechseln`;
  const angelegt = await page.request.post("/api/kos", {
    data: {
      title: titel,
      statement: `Die Probedichtung AP${m} wird vor dem Wechsel entlastet.`,
      type: "best_practice",
      category: "Betrieb",
      confidentiality: "intern",
      neededValidations: 1,
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const koId = ((await angelegt.json()) as { id: string }).id;
  const frei = await page.request.put(`/api/kos/${koId}`, { data: { action: "admin-validate" } });
  expect(frei.status(), await frei.text()).toBe(200);

  const email = await eigenesKonto(page, "desktop");
  const p = await anmelden(browser, email, { width: 1280, height: 800 });

  // --- K1/K5 · Start nach normaler Anmeldung ------------------------------------------------------
  await einstiegSichtbar(p, "Start");
  await beleg(p, info, "1 Start · Einstieg sichtbar");

  // --- K2/K3/K4 · Öffnen, Produktbetrieb, echtes Gespräch ------------------------------------------
  const gespraech = await oeffnen(p);
  await expect(p.getByTestId("klara-panel-titel")).toHaveText(NEUTRAL);
  await expect(p.getByTestId("klara-betrieb")).toHaveAttribute("data-betrieb", "echt");
  await expect(p.getByTestId("klara-betrieb-demo")).toHaveCount(0);
  await expect(p.getByTestId("klara-demo-hinweis")).toHaveCount(0);
  await expect(p.getByTestId("klara-beenden")).toHaveCount(0);
  await expect(p.getByTestId("klara-offen")).toBeVisible();
  await expect(p.getByTestId("klara-zur-vorschau")).toBeVisible();
  for (const id of ["klara-bezug", "klara-modi", "klara-bedienhilfe", "klara-eingabe"]) {
    await expect(p.getByTestId(id), id).toBeVisible();
  }

  const frage = `Assistenz-Probe ${marke()}: Wie wird die Anlage gesichert?`;
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-eingabe").fill(frage);
  await p.getByTestId("klara-eingabe").press("Enter");
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  await expect(letzteKlara(p)).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await expect(nachrichten(p)).toHaveCount(2);
  await expect(gespraech).not.toContainText("Demo-Antwort");
  await beleg(p, info, "2 echtes persönliches Gespräch");

  // Bezug wählen und eine Frage anfangen, ohne sie zu senden.
  await p.getByTestId("klara-bezug-frei").click();
  await expect(p.getByTestId("klara-bezug")).toHaveAttribute("data-bezug", "frei");
  await p.getByTestId("klara-eingabe").fill(ANGEFANGEN);

  // --- Seitenwechsel zu Fragen (in der App) ---------------------------------------------------------
  await p.getByTestId("klara-zu-fragen").click();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await expect(p.getByTestId("klara-ort-seite")).toHaveText("Fragen");
  await expect(nachrichten(p)).toHaveCount(2);
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(ANGEFANGEN);

  // --- Minimieren, erneut öffnen ------------------------------------------------------------------
  await p.getByTestId("klara-minimieren").click();
  await expect(gespraech).toHaveCount(0);
  await expect(p.getByTestId("klara-figur")).toHaveAttribute("data-minimiert", "true");
  await expect(p.getByTestId("klara-figur-name")).toHaveText(NEUTRAL);
  await oeffnen(p);
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(ANGEFANGEN);
  await expect(p.getByTestId("klara-bezug")).toHaveAttribute("data-bezug", "frei");

  // --- Neuladen auf Fragen (direkter Besuch) -------------------------------------------------------
  await p.reload();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await oeffnen(p);
  await expect(nachrichten(p)).toHaveCount(2, { timeout: 15_000 });
  await expect(nachrichten(p).first()).toContainText(frage);
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(ANGEFANGEN);
  await expect(p.getByTestId("klara-bezug")).toHaveAttribute("data-bezug", "frei");
  await expect(p.getByTestId("klara-gespraech")).toHaveCount(1);
  await beleg(p, info, "3 Fragen nach Neuladen");
  await p.getByTestId("klara-schliessen").click();
  await fragenBedienbar(p, "Desktop, Fragen");

  // --- Artikelseite (direkter Besuch) ---------------------------------------------------------------
  await p.goto(`/wissen/${koId}`);
  await einstiegSichtbar(p, "Artikel");
  await oeffnen(p);
  await expect(p.getByTestId("klara-ort-seite")).toHaveText("Wissen");
  await expect(p.getByTestId("klara-ort-objekt")).toHaveText(`„${titel}“`, { timeout: 15_000 });
  await expect(nachrichten(p)).toHaveCount(2);
  await beleg(p, info, "4 Artikel mit Seitenkontext");

  // --- Nie zwei offene Flächen; die Figur verdeckt die Hilfefläche nicht ----------------------------
  await hilfeKnopf(p).click();
  await expect(hilfeFlaeche(p)).toBeVisible();
  await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
  await expect(p.getByTestId("klara-figur")).toBeHidden();
  await beleg(p, info, "4b Hilfe offen, Assistenz tritt zurück");
  await hilfeKnopf(p).click();
  await expect(hilfeFlaeche(p)).toHaveCount(0);
  await expect(p.getByTestId("klara-figur")).toBeVisible();
  await oeffnen(p);
  await expect(hilfeFlaeche(p)).toHaveCount(0);

  // --- Vorschau getrennt und gekennzeichnet; zurück in den Produktbetrieb ----------------------------
  await p.getByTestId("klara-zur-vorschau").click();
  await expect(p).toHaveURL(/\/klara-vorschau$/);
  await expect(p.getByTestId("klara-figur")).toHaveAttribute("data-betriebsart", "vorschau");
  await expect(p.getByText("Vorschau · fiktive Demodaten").first()).toBeVisible();
  await beleg(p, info, "5 getrennte Vorschau");
  await oeffnen(p);
  await expect(p.getByTestId("klara-betrieb")).toHaveAttribute("data-betrieb", "echt");
  await p.getByTestId("klara-beenden").click();
  await expect(p.getByTestId("klara-figur")).toHaveAttribute("data-betriebsart", "produkt", {
    timeout: 15_000,
  });
  await einstiegSichtbar(p, "nach Vorschau beenden");
  // Vorschau-Ende verwirft nur den Vorschau-Anteil: angefangene persönliche Frage und
  // Bezugsauswahl sind nach der Rückkehr und nach dem Neuladen noch da.
  await oeffnen(p);
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(ANGEFANGEN);
  await expect(p.getByTestId("klara-bezug")).toHaveAttribute("data-bezug", "frei");
  await expect(nachrichten(p)).toHaveCount(2);
  await p.reload();
  await expect(p.getByTestId("klara-figur")).toHaveAttribute("data-betriebsart", "produkt", {
    timeout: 15_000,
  });
  await oeffnen(p);
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(ANGEFANGEN);
  await expect(p.getByTestId("klara-bezug")).toHaveAttribute("data-bezug", "frei");
  await expect(nachrichten(p)).toHaveCount(2, { timeout: 15_000 });
  await beleg(p, info, "6 nach Vorschau-Ende und Neuladen: Frage und Bezug erhalten");
  await p.context().close();
});

test("Assistenz im Produkt · 390x844 mit Tastatur: Finden, Öffnen, Gespräch, Seitenwechsel, Minimieren, Neuladen, Fokus und Touch-Ziele", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const email = await eigenesKonto(page, "schmal");
  const p = await anmelden(browser, email, { width: 390, height: 844 });
  await p.emulateMedia({ reducedMotion: "reduce" });

  // --- Finden: Start nach der Anmeldung, mit Tab erreichbar ----------------------------------------
  const figur = await einstiegSichtbar(p, "schmal, Start");
  const figurBox = await box(figur);
  expect(figurBox.width, "Touch-Ziel zu klein").toBeGreaterThanOrEqual(44);
  expect(figurBox.height, "Touch-Ziel zu klein").toBeGreaterThanOrEqual(44);
  const kopfband = await box(p.getByTestId("kopfband"));
  expect(ueberlappen(figurBox, kopfband), "verdeckt Kopfband").toBe(false);
  let erreicht = false;
  for (let i = 0; i < 250 && !erreicht; i++) {
    await p.keyboard.press("Tab");
    erreicht = await p.evaluate(
      () => document.activeElement?.getAttribute("data-testid") === "klara-figur",
    );
  }
  expect(erreicht, "Assistenz ist mit Tab nicht erreichbar").toBe(true);
  const umriss = await figur.evaluate((el) => {
    const s = getComputedStyle(el);
    return { stil: s.outlineStyle, breite: Number.parseFloat(s.outlineWidth) };
  });
  expect(umriss.stil, "kein sichtbarer Fokus").not.toBe("none");
  expect(umriss.breite).toBeGreaterThan(0);
  await beleg(p, info, "schmal 1 · Fokus auf dem Einstieg");

  // --- Öffnen, echtes Gespräch ----------------------------------------------------------------------
  await p.keyboard.press("Enter");
  const gespraech = p.getByTestId("klara-gespraech");
  await expect(gespraech).toBeVisible();
  await expect(p.getByTestId("klara-panel-titel")).toBeFocused();
  await expect(p.getByTestId("klara-panel-titel")).toHaveText(NEUTRAL);
  await expect(p.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  expect(Math.round((await box(gespraech)).width)).toBe(390);
  for (const id of ["klara-minimieren", "klara-schliessen"]) {
    const b = await box(p.getByTestId(id));
    expect(b.height, `${id}: Touch-Ziel zu niedrig`).toBeGreaterThanOrEqual(24);
    await imFenster(p, p.getByTestId(id), `schmal, ${id}`);
  }
  await p.getByTestId("klara-einwilligung-erteilen").focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  const eingabe = p.getByTestId("klara-eingabe");
  await eingabe.focus();
  await p.keyboard.type("Was kann ich hier tun?");
  await imFenster(p, eingabe, "schmal, Eingabe");
  await p.keyboard.press("Enter");
  await expect(letzteKlara(p)).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await expect(nachrichten(p)).toHaveCount(2);
  await beleg(p, info, "schmal 2 · Gespräch per Tastatur");

  // --- Seitenwechsel per Tastatur, angefangene Eingabe bleibt ---------------------------------------
  await eingabe.focus();
  await p.keyboard.type(ANGEFANGEN);
  await p.getByTestId("klara-zu-fragen").focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await expect(p.getByTestId("klara-ort-seite")).toHaveText("Fragen");
  await expect(eingabe).toHaveValue(ANGEFANGEN);

  // --- Minimieren und erneut öffnen per Tastatur ----------------------------------------------------
  await p.getByTestId("klara-minimieren").focus();
  await p.keyboard.press("Enter");
  await expect(gespraech).toHaveCount(0);
  await expect(figur).toBeFocused();
  await expect(figur).toHaveAttribute("data-minimiert", "true");
  const mini = await box(figur);
  expect(mini.width, "verkleinert: Touch-Ziel zu klein").toBeGreaterThanOrEqual(44);
  await fragenBedienbar(p, "schmal, verkleinert");
  await p.keyboard.press("Enter");
  await expect(gespraech).toBeVisible();
  await expect(eingabe).toHaveValue(ANGEFANGEN);

  // --- Neuladen ------------------------------------------------------------------------------------
  await p.reload();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await expect(figur).toBeVisible({ timeout: 15_000 });
  await expect(figur).toHaveAttribute("data-betriebsart", "produkt");
  await oeffnen(p);
  await expect(nachrichten(p)).toHaveCount(2, { timeout: 15_000 });
  await expect(eingabe).toHaveValue(ANGEFANGEN);
  await beleg(p, info, "schmal 3 · nach Neuladen");

  // --- Rückweg: Escape schliesst, der Fokus kehrt zum Einstieg zurück -------------------------------
  await eingabe.focus();
  await p.keyboard.press("Escape");
  await expect(gespraech).toHaveCount(0);
  await expect(figur).toBeFocused();
  await imFenster(p, figur, "schmal, nach Rückweg");
  await fragenBedienbar(p, "schmal, Fragen");
  await beleg(p, info, "schmal 4 · Rückweg, Fragen bedienbar");
  await p.context().close();
});
