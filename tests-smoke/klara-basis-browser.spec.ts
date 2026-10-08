// ================================================================================================
// KLARA 01 (produkt:20261008:klara-basis) — die bewegliche Klara im ECHTEN Betrieb, im Browser.
// ================================================================================================
//
// Drei Sonden am gebündelten Produkt, mit echtem Server und echter Anmeldung:
//   1. Einwilligung → Frage über den echten Frageweg → Kennzeichnung GENAU nach der Antwort des
//      Servers (`demo: false` ⇒ „KI-Antwort", sonst „Ohne KI") → Seitenwechsel → Neuladen → neue
//      Anmeldung in einem frischen Browserkontext → eine fremde Person sieht nichts davon.
//   2. Schmal (390 px) mit reduzierter Bewegung: Öffnen, Einwilligen und Fragen allein mit der
//      Tastatur; Figur, Eingabe und Bedienung bleiben im Bild — auch nach Seitenwechsel und im Vollbild.
//   3. Der tatsächliche Zustand: Stoppen einer laufenden Anfrage, eine fehlgeschlagene Speicherung mit
//      erneutem Speichern, eine abgelaufene Anmeldung (echter 401 des Servers).
//
// EIGENE KONTEN: die Smoke-Suite teilt sonst EIN Konto über alle Dateien und drei Browser. Ein
// Gespräch gehört einer Person — damit sich die Läufe der drei Engines nicht gegenseitig „das
// aktuelle Gespräch" wegnehmen, legt jede Sonde über den Admin der Suite ein eigenes Konto an.
//
// WAS DIESE SONDEN NICHT ERSETZEN: Im hermetischen Tor ist kein Modell aktiv — die Antworten sind
// dort „Ohne KI". Dass eine Modellantwort als „KI-Antwort" erscheint, belegt
// `tests/klara-basis/klara-echt-am-server.test.tsx` mit dem kontrollierten Modelladapter; eine Antwort
// eines echten Anbieters und das Urteil eines Menschen belegt kein Lauf hier. Zwei Stellen sind
// Transport-Attrappen (`page.route`): eine Frage, die erst auf den Stopp reagiert, und eine einmal
// scheiternde Speicherung.
import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Klara-Basis-Kennwort-1";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Ein eigenes Konto (Rolle Experte), angelegt vom Admin der Suite über den echten Adminweg. */
async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `klara-basis-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Klara Basis ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(page: Page, email: string): Promise<void> {
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
}

async function neuerKontext(
  browser: Browser,
  email: string,
  groesse: { width: number; height: number },
): Promise<{ kontext: BrowserContext; seite: Page }> {
  const kontext = await browser.newContext({ viewport: groesse });
  const seite = await kontext.newPage();
  await anmelden(seite, email);
  return { kontext, seite };
}

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) {
    throw new Error("Element ohne Box");
  }
  return b;
}

async function imFenster(page: Page, l: Locator, wann: string): Promise<void> {
  const v = page.viewportSize();
  if (!v) {
    throw new Error("keine Fenstergrösse");
  }
  await expect
    .poll(
      async () => {
        const b = await box(l);
        const waagrecht = b.x >= 0 && b.x + b.width <= v.width + 1;
        const senkrecht = b.y >= 0 && b.y + b.height <= v.height + 1;
        return waagrecht && senkrecht;
      },
      { message: `${wann}: ausserhalb des Fensters`, timeout: 5_000 },
    )
    .toBe(true);
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara 01 — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

/** Klara öffnen und warten, bis das gespeicherte Gespräch vom Server gelesen ist. */
async function oeffnen(page: Page): Promise<Locator> {
  const figur = page.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  const gespraech = page.getByTestId("klara-gespraech");
  if (!(await gespraech.isVisible())) {
    await figur.click();
  }
  await expect(gespraech).toBeVisible();
  await expect(page.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  return gespraech;
}

const nachrichten = (page: Page) => page.locator('[data-testid="klara-nachricht"]');
const letzteKlara = (page: Page) =>
  page.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();
/**
 * Die KENNZEICHNUNG „KI-Antwort“ an einer Nachricht. Hinweis- und Bedienhilfetexte nennen das Wort
 * zu Recht (sie erklären, wann es steht) — gemessen wird das Kennzeichen, nicht jeder Text.
 */
const kiKennzeichen = (page: Page) =>
  page.getByTestId("klara-echt-kennzeichen").filter({ hasText: /^KI-Antwort$/ });

test("Klara 01 · echte Frage, Kennzeichnung nach Server, Seitenwechsel, Neuladen, neue Anmeldung, fremde Person", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const email = await eigenesKonto(page, "eins");
  const groesse = { width: 1280, height: 800 };
  const { kontext, seite: p } = await neuerKontext(browser, email, groesse);

  await p.goto("/klara-vorschau");
  const figur = p.getByTestId("klara-figur");
  await expect(figur).toHaveAttribute("data-betrieb", "echt", { timeout: 15_000 });
  const gespraech = await oeffnen(p);
  await expect(p.getByTestId("klara-betrieb")).toHaveAttribute("data-betrieb", "echt");
  await expect(p.getByTestId("klara-demo-hinweis")).toHaveCount(0);

  // Ohne Einwilligung geht nichts los.
  const frage = `Klara-Basis-Probe ${marke()}: Wie wird die Anlage gesichert?`;
  await p.getByTestId("klara-eingabe").fill(frage);
  await expect(p.getByTestId("klara-senden")).toBeDisabled();
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();

  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-eingabe").press("Enter");
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  const koerper = (await antwort.json()) as { result: { demo: boolean; answered: boolean } };
  const klara = letzteKlara(p);
  await expect(klara).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  // Die Kennzeichnung folgt dem, was der Server über DIESE Antwort sagt — nicht umgekehrt.
  const erwartet = koerper.result.answered && !koerper.result.demo ? "ki" : "ohne_ki";
  await expect(klara).toHaveAttribute("data-modus", erwartet);
  if (erwartet === "ohne_ki") {
    await expect(kiKennzeichen(p)).toHaveCount(0);
  }
  await expect(gespraech).not.toContainText("Demo-Antwort");
  await expect(p.getByTestId("klara-letzter-schritt")).toHaveAttribute("data-stand", "beantwortet");
  await info.attach("Antwort des Fragewegs (demo, answered)", {
    body: JSON.stringify({ demo: koerper.result.demo, answered: koerper.result.answered }),
    contentType: "application/json",
  });
  await beleg(p, info, "1 Frage beantwortet und gekennzeichnet");
  const beginn = ((await p.getByTestId("klara-gespraech-beginn").textContent()) ?? "").trim();
  expect(beginn).toContain("Begonnen auf");

  // Seitenwechsel: Figur, Verlauf und Ursprung bleiben.
  await p.getByTestId("klara-vorschau-zu-fragen").click();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await expect(p.getByTestId("klara-ort-seite")).toHaveText("Fragen");
  await expect(nachrichten(p)).toHaveCount(2);
  await expect(p.getByTestId("klara-gespraech-beginn")).toContainText(beginn);
  await expect(p.getByTestId("klara-gespraech-beginn-link")).toHaveAttribute(
    "href",
    "/klara-vorschau",
  );
  await imFenster(p, figur, "nach Seitenwechsel");

  // Neuladen: alles kommt vom Server zurück.
  await p.reload();
  await oeffnen(p);
  await expect(nachrichten(p)).toHaveCount(2, { timeout: 15_000 });
  await expect(nachrichten(p).first()).toContainText(frage);
  await expect(p.getByTestId("klara-gespraech-beginn")).toContainText(beginn);
  await expect(p.getByTestId("klara-letzter-schritt")).toHaveAttribute("data-stand", "beantwortet");
  await beleg(p, info, "2 nach dem Neuladen");

  // Erneute Anmeldung: neuer Browserkontext, keine Browser-Speicher, dasselbe Gespräch.
  const zwei = await neuerKontext(browser, email, groesse);
  await zwei.seite.goto("/klara-vorschau");
  await oeffnen(zwei.seite);
  await expect(nachrichten(zwei.seite)).toHaveCount(2, { timeout: 15_000 });
  await expect(nachrichten(zwei.seite).first()).toContainText(frage);
  await expect(zwei.seite.getByTestId("klara-gespraech-beginn")).toContainText(beginn);
  await beleg(zwei.seite, info, "3 nach neuer Anmeldung");

  // Eine fremde Person (der Admin der Suite) sieht dieses Gespräch nicht.
  await page.goto("/klara-vorschau");
  const fremd = await oeffnen(page);
  await expect(fremd).not.toContainText(frage);

  await zwei.kontext.close();
  await kontext.close();
});

test("Klara 01 · schmal mit Tastatur, Seitenwechsel und Vollbild: Figur und Gespräch bleiben bedienbar", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const email = await eigenesKonto(page, "schmal");
  const { kontext, seite: p } = await neuerKontext(browser, email, { width: 390, height: 844 });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto("/klara-vorschau");
  const figur = p.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  await imFenster(p, figur, "schmal, Startplatz");

  // Nur Tastatur: öffnen, einwilligen, fragen.
  await figur.focus();
  await p.keyboard.press("Enter");
  const gespraech = p.getByTestId("klara-gespraech");
  await expect(gespraech).toBeVisible();
  await expect(p.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  expect(Math.round((await box(gespraech)).width)).toBe(390);
  await p.getByTestId("klara-einwilligung-erteilen").focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  const eingabe = p.getByTestId("klara-eingabe");
  await eingabe.focus();
  await p.keyboard.type("Was kann ich hier tun?");
  for (const id of ["klara-eingabe", "klara-senden", "klara-schliessen"]) {
    await imFenster(p, p.getByTestId(id), `schmal, ${id}`);
  }
  await p.keyboard.press("Enter");
  await expect(letzteKlara(p)).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  const animation = await p
    .getByTestId("klara-avatar")
    .evaluate((img) => getComputedStyle(img).animationName);
  expect(animation).toBe("none");
  await beleg(p, info, "schmal, Frage per Tastatur");

  // Escape schliesst, der Fokus kehrt zur Figur zurück.
  await p.keyboard.press("Escape");
  await expect(gespraech).toHaveCount(0);
  await expect(figur).toBeFocused();

  // Seitenwechsel im schmalen Fenster: Figur bleibt im Bild, das Gespräch geht weiter.
  await p.goto("/fragen");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  await imFenster(p, figur, "schmal, nach Seitenwechsel");
  await figur.focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  await expect(nachrichten(p)).toHaveCount(2, { timeout: 15_000 });

  // Vollbild: Figur und Eingabe bleiben im Bild.
  await p.getByTestId("klara-vollbild").click();
  const imVollbild = await p
    .waitForFunction(() => document.fullscreenElement !== null, undefined, { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  await imFenster(p, figur, imVollbild ? "im Vollbild" : "nach Vollbild-Anforderung");
  await imFenster(p, p.getByTestId("klara-eingabe"), "Eingabe im Vollbild");
  await info.attach("Vollbild vom Browser gewährt", {
    body: String(imVollbild),
    contentType: "text/plain",
  });
  await beleg(p, info, "schmal, Vollbild");
  if (imVollbild) {
    await p.evaluate(() => document.exitFullscreen());
  }
  await kontext.close();
});

test("Klara 01 · Stopp, fehlgeschlagene Speicherung und abgelaufene Anmeldung zeigen den tatsächlichen Zustand", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const email = await eigenesKonto(page, "zustand");
  const { kontext, seite: p } = await neuerKontext(browser, email, { width: 1280, height: 800 });
  await p.goto("/klara-vorschau");
  await oeffnen(p);
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();

  // --- Stopp: ATTRAPPE eines Fragewegs, der erst nach dem Stopp freigegeben wird. ---------------
  let freigeben: () => void = () => {};
  const freigabe = new Promise<void>((r) => {
    freigeben = r;
  });
  await p.route("**/api/ask", async (route) => {
    await freigabe;
    await route.abort().catch(() => {});
  });
  await p.getByTestId("klara-eingabe").fill("Eine Frage, die ich stoppe");
  await p.getByTestId("klara-senden").click();
  const stopp = p.getByTestId("klara-stoppen");
  await expect(stopp).toBeVisible();
  await expect(p.getByTestId("klara-laeuft-seit")).toContainText("Anfrage läuft seit");
  await expect(p.getByTestId("klara-figur")).toHaveAttribute("data-status", "laeuft");
  await stopp.click();
  await expect(letzteKlara(p)).toHaveAttribute("data-modus", "abgebrochen", { timeout: 15_000 });
  await expect(letzteKlara(p)).toHaveAttribute("data-gespeichert", "ja");
  await expect(letzteKlara(p)).toContainText("Anfrage gestoppt");
  await expect(p.getByTestId("klara-letzter-schritt")).toHaveAttribute("data-stand", "abgebrochen");
  await beleg(p, info, "Anfrage gestoppt");
  freigeben();
  await p.unrouteAll({ behavior: "ignoreErrors" });

  // --- Fehlgeschlagene Speicherung: ATTRAPPE, die genau EINE Ablage scheitern lässt. ------------
  let einmal = true;
  await p.route("**/api/me/klara/gespraeche/*/nachrichten", async (route) => {
    if (einmal) {
      einmal = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "SERVER", message: "Dienst kurz weg." }),
      });
      return;
    }
    await route.continue();
  });
  await p.getByTestId("klara-eingabe").fill("Eine Frage, deren Ablage scheitert");
  await p.getByTestId("klara-senden").click();
  const du = nachrichten(p).filter({ hasText: "deren Ablage scheitert" });
  await expect(du).toHaveAttribute("data-gespeichert", "nein", { timeout: 15_000 });
  await expect(du).toContainText("Nicht gespeichert");
  // Die Frage selbst läuft trotzdem; ihre Antwort wird regulär abgelegt.
  await expect(p.getByTestId("klara-stoppen")).toHaveCount(0, { timeout: 15_000 });
  await expect(nachrichten(p)).toHaveCount(4);
  await expect(letzteKlara(p)).toHaveAttribute("data-gespeichert", "ja");
  await beleg(p, info, "Speicherung gescheitert, sichtbar");
  await du.getByTestId("klara-nochmal-speichern").click();
  await expect(du).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await p.unrouteAll({ behavior: "ignoreErrors" });

  // --- Abgelaufene Anmeldung: der echte Server antwortet 401. -----------------------------------
  await kontext.clearCookies();
  await p.getByTestId("klara-eingabe").fill("Eine Frage nach dem Abmelden");
  await p.getByTestId("klara-senden").click();
  const fehler = letzteKlara(p);
  await expect(fehler).toHaveAttribute("data-modus", "fehler", { timeout: 15_000 });
  await expect(fehler).toContainText("Anmeldung ist abgelaufen");
  await expect(fehler).toHaveAttribute("data-gespeichert", "nein");
  await expect(nachrichten(p).filter({ hasText: "nach dem Abmelden" })).toHaveAttribute(
    "data-gespeichert",
    "nein",
  );
  await expect(kiKennzeichen(p)).toHaveCount(0);
  await beleg(p, info, "Anmeldung abgelaufen, nichts als gespeichert ausgegeben");
  await kontext.close();
});

// ================================================================================================
// K1 · TATSÄCHLICHE MODELLANTWORT (Bens Befund, nacharbeit-3).
// ================================================================================================
//
// Kein Adapter, keine Attrappe: die Instanz, gegen die dieser Lauf geht, beantwortet die Frage mit
// IHREM eingerichteten Modell. Gemessen werden die drei Dinge, die Ben verlangt: erfolgreiche
// Generierung (Serverantwort `answered`, `demo: false`, `aiGenerated.mode = "model"`), der angezeigte
// Antworttext in der beweglichen Klara und die Kennzeichnung „KI-Antwort".
//
// MELDET DIE INSTANZ KEIN NUTZBARES MODELL (das hermetische Tor: kein Anbieter, kein Schlüssel), wird
// der Fall mit Grund ÜBERSPRUNGEN und der Status als Anhang abgelegt — er gilt dann ausdrücklich als
// NICHT belegt, nicht als bestanden. Ein Modell aufzusetzen oder vorzutäuschen ist nicht Sache dieses
// Tests.
test("Klara 01 · tatsächliche Modellantwort in der beweglichen Klara (nur mit eingerichtetem Modell)", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const statusAntwort = await page.request.get("/api/reasoner/status");
  const status = (await statusAntwort.json()) as {
    active?: boolean;
    reachable?: string;
    kiAbgeschaltet?: boolean;
    tasks?: { answer?: boolean };
  };
  await info.attach("Modellstatus der Instanz", {
    body: JSON.stringify(status),
    contentType: "application/json",
  });
  const modellNutzbar =
    status.active === true &&
    status.tasks?.answer === true &&
    status.kiAbgeschaltet !== true &&
    status.reachable !== "unreachable";
  test.skip(
    !modellNutzbar,
    "Diese Instanz meldet kein nutzbares Modell für „answer“ — K1 (tatsächliche Modellantwort) bleibt hier OFFEN, nicht bestanden.",
  );

  // Ein geprüfter Eintrag, dessen Aussage die Frage vollständig deckt (Tor 1, R-0473).
  const m = marke();
  const angelegt = await page.request.post("/api/kos", {
    data: {
      title: `Ventil ${m} entlüften`,
      statement: `Das Ventil ${m} wird vor dem Start zehn Sekunden lang entlüftet.`,
      type: "best_practice",
      category: "Betrieb",
      confidentiality: "intern",
      neededValidations: 1,
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const ko = (await angelegt.json()) as { id: string };
  const frei = await page.request.put(`/api/kos/${ko.id}`, { data: { action: "admin-validate" } });
  expect(frei.status(), await frei.text()).toBe(200);

  const email = await eigenesKonto(page, "modell");
  const { kontext, seite: p } = await neuerKontext(browser, email, { width: 1280, height: 800 });
  await p.goto("/klara-vorschau");
  await oeffnen(p);
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();

  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-eingabe").fill(`Wie wird das Ventil ${m} vor dem Start entlüftet?`);
  await p.getByTestId("klara-eingabe").press("Enter");
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  const koerper = (await antwort.json()) as {
    result: {
      answered: boolean;
      answer: string | null;
      demo: boolean;
      aiGenerated?: { mode?: string };
    };
  };
  await info.attach("Antwort des Fragewegs", {
    body: JSON.stringify(koerper.result),
    contentType: "application/json",
  });
  // Erfolgreiche Generierung durch das Modell der Instanz.
  expect(koerper.result.answered, "der Frageweg hat nicht geantwortet").toBe(true);
  expect(koerper.result.demo, "die Antwort entstand ohne Modell").toBe(false);
  expect(koerper.result.aiGenerated?.mode).toBe("model");

  // Angezeigt in der beweglichen Klara, gekennzeichnet als „KI-Antwort“.
  const klara = letzteKlara(p);
  await expect(klara).toHaveAttribute("data-gespeichert", "ja", { timeout: 30_000 });
  await expect(klara).toHaveAttribute("data-modus", "ki");
  await expect(klara.getByTestId("klara-echt-kennzeichen")).toHaveText("KI-Antwort");
  const ausschnitt = (koerper.result.answer ?? "")
    .replace(/\[\d+\]/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
  expect(ausschnitt.length, "die Modellantwort ist leer").toBeGreaterThan(0);
  await expect(klara).toContainText(ausschnitt);
  await beleg(p, info, "tatsächliche Modellantwort in Klara");
  await kontext.close();
});
