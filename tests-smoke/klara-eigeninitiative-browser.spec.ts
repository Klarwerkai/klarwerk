// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) — UNTERSTÜTZUNG UND EIGENINITIATIVE IM BROWSER.
// ================================================================================================
//
// Eine Sonde am gebündelten Produkt, mit echtem Server, echter Anmeldung, echtem NEULADEN und echter
// NEUER ANMELDUNG in einem frischen Browserkontext (eigene Cookies, leerer Tab-Speicher). Sie fährt
// die Schritte, die die jsdom-Läufe in `tests/klara-eigeninitiative/` nur nachstellen:
//
//   K1  Die drei Modi stehen mit Erklärung in Klara; die Wahl wird am Konto gespeichert.
//   K2  „Nur auf Nachfrage“: kein Hinweis. „Passende Hinweise“: nach dem Neuladen ein Hinweis aus
//       dem Kontext der Seite, der selbst nichts sendet, speichert oder öffnet.
//   K3  „Später“ lässt ihn ruhen — nach dem Neuladen und nach neuer Anmeldung in einem frischen
//       Kontext ohne Tab-Speicher (dann hält ihn allein der Server zurück).
//   K4  „Ausdrücklich übertragene Aufgaben“: eine selbst erteilte Aufgabe steht mit Stand da, auch
//       nach dem Neuladen; der Modus gilt nach Neuladen und neuer Anmeldung. Rechte: ein zweites
//       Konto sieht weder Modus noch Aufgabe noch Entwurf des ersten, und eine fremde Kennung wird
//       mit 403 abgewiesen.
//
// Läuft im ISOLIERTEN Kontext (`chromium-zustand`, `ZUSTAND_SPEC`): die Sonde legt Konten, einen
// Entwurf und einen Auftrag an. Alle Inhalte sind fiktiv. Im Tor ist kein Modell aktiv; die Sonde
// braucht keines (Hinweise und Aufträge laufen ohne KI). Firefox und WebKit laufen im isolierten
// Projekt nicht mit; das Urteil einer echten Person ersetzt dieser Lauf nicht.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Eigeninitiative-Kennwort-1";
const BASIS = "/api/me/assistenz/eigeninitiative";
/** Länger als der Verzug, nach dem ein Hinweis frühestens erscheint (1,5 s), mit Puffer. */
const RUHE_MS = 3_500;

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `eigeninitiative-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Eigeninitiative ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

/** Eine NEUE Anmeldung: frischer Browserkontext — eigene Cookies, leerer Tab-Speicher. */
async function anmelden(browser: Browser, email: string): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
  await info.attach(`Klara 12 — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function zuFragen(page: Page): Promise<void> {
  await page.goto("/fragen");
  await expect(page.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("klara-figur")).toBeVisible({ timeout: 15_000 });
}

/** Öffnen und warten, bis Gespräch und Modus vom Server gelesen sind. */
async function oeffnen(page: Page): Promise<void> {
  if (!(await page.getByTestId("klara-gespraech").isVisible())) {
    await page.getByTestId("klara-figur").click();
  }
  await expect(page.getByTestId("klara-gespraech")).toBeVisible();
  await expect(page.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("klara-eigeninitiative")).toHaveAttribute("data-stand", "bereit", {
    timeout: 15_000,
  });
}

async function schliessen(page: Page): Promise<void> {
  if (await page.getByTestId("klara-gespraech").isVisible()) {
    await page.getByTestId("klara-schliessen").click();
  }
  await expect(page.getByTestId("klara-gespraech")).toHaveCount(0);
}

async function waehle(page: Page, modus: "nachfrage" | "hinweise" | "auftraege"): Promise<void> {
  const gespeichert = page.waitForResponse(
    (r) => new URL(r.url()).pathname === BASIS && r.request().method() === "PUT",
  );
  const auswahl = page.getByTestId(`klara-eigeninitiative-${modus}`).locator("input");
  // Der kontrollierte Radiozustand folgt erst der Serverbestätigung.
  await auswahl.click();
  expect((await gespeichert).status()).toBe(200);
  await expect(auswahl).toBeChecked();
  await expect(page.getByTestId("klara-eigeninitiative")).toHaveAttribute("data-modus", modus);
  await expect(page.getByTestId("klara-eigeninitiative-stand")).toContainText(
    "Für dein Konto gespeichert",
  );
}

async function amServer(page: Page): Promise<{ modus: string; hinweise: { stand: string }[] }> {
  const r = await page.request.get(BASIS);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as { modus: string; hinweise: { stand: string }[] };
}

/** Schreibende Anfragen dieser Seite an Klara, Assistenzprofil und Entwürfe — ab jetzt. */
function handlungenMitschneiden(page: Page): () => string[] {
  const liste: string[] = [];
  page.on("request", (r) => {
    const pfad = new URL(r.url()).pathname;
    if (r.method() !== "GET" && /^\/api\/(me\/klara|me\/assistenz|drafts)/.test(pfad)) {
      liste.push(`${r.method()} ${pfad}`);
    }
  });
  return () => [...liste];
}

test("Klara 12 · Modi wählen, Hinweis anbieten und ruhen lassen, übertragene Aufgabe — über Neuladen, neue Anmeldung und Rechte", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const email = await eigenesKonto(page, "erste");
  const emailFremd = await eigenesKonto(page, "zweite");
  const titel = `Eigeninitiative Browserprobe ${marke()}`;

  // --- K1/K2 · Vorgabe still, drei Modi verständlich wählbar ------------------------------------
  let p = await anmelden(browser, email);
  await zuFragen(p);
  await p.waitForTimeout(RUHE_MS);
  await expect(p.getByTestId("klara-hinweis"), "Hinweis trotz „Nur auf Nachfrage“").toHaveCount(0);

  await oeffnen(p);
  const wahl = p.getByTestId("klara-eigeninitiative");
  await expect(wahl).toHaveAttribute("data-modus", "nachfrage");
  await expect(wahl).toContainText("Wann ich mich melde");
  await expect(p.getByTestId("klara-eigeninitiative-nachfrage")).toContainText("Nur auf Nachfrage");
  await expect(p.getByTestId("klara-eigeninitiative-nachfrage")).toContainText("bleibt still");
  await expect(p.getByTestId("klara-eigeninitiative-hinweise")).toContainText(
    "Passende Hinweise anbieten",
  );
  await expect(p.getByTestId("klara-eigeninitiative-hinweise")).toContainText(
    "Ein Hinweis tut selbst nichts",
  );
  await expect(p.getByTestId("klara-eigeninitiative-auftraege")).toContainText(
    "Ausdrücklich übertragene Aufgaben",
  );
  await expect(p.getByTestId("klara-eigeninitiative-auftraege")).toContainText(
    "mit deinen Rechten",
  );
  await expect(p.getByTestId("klara-eigeninitiative-stand")).toContainText("Vorgabe");
  await beleg(p, info, "1 drei Modi, Vorgabe „Nur auf Nachfrage“");

  await waehle(p, "hinweise");
  expect((await amServer(p)).modus).toBe("hinweise");
  await schliessen(p);

  // --- K2 · nach dem Neuladen: ein Hinweis aus dem Kontext, der selbst nichts tut ----------------
  const handlungen = handlungenMitschneiden(p);
  await p.reload();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  const hinweis = p.getByTestId("klara-hinweis");
  await expect(hinweis).toBeVisible({ timeout: 15_000 });
  const schluessel = (await hinweis.getAttribute("data-hinweis")) ?? "";
  expect(["tutorial:fragen", "seite:fragen"]).toContain(schluessel);
  await expect(p.getByTestId("klara-hinweis-text")).toContainText("Fragen");
  await expect(hinweis).toContainText("es passiert nichts ohne deinen Klick");
  await p.waitForTimeout(1_000);
  expect(handlungen(), "der Hinweis allein hat etwas geschrieben").toEqual([]);
  await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
  const entwuerfeVorher = await p.request.get("/api/drafts");
  expect(await entwuerfeVorher.json()).toEqual([]);
  await beleg(p, info, "2 Hinweis nach Neuladen — nur ein Angebot");

  // --- K3 · „Später“ — ruht nach Neuladen und nach neuer Anmeldung -------------------------------
  const abgelegt = p.waitForResponse(
    (r) => new URL(r.url()).pathname === `${BASIS}/hinweise` && r.request().method() === "POST",
  );
  await p.getByTestId("klara-hinweis-spaeter").click();
  expect((await abgelegt).status()).toBe(200);
  await expect(hinweis).toHaveCount(0);
  expect((await amServer(p)).hinweise.map((h) => h.stand)).toEqual(["zurueckgestellt"]);

  await p.reload();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await p.waitForTimeout(RUHE_MS);
  await expect(p.getByTestId("klara-hinweis"), "nach Neuladen erneut aufgedrängt").toHaveCount(0);
  await p.context().close();

  p = await anmelden(browser, email);
  expect(
    await p.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes("hinweise"))),
    "die neue Anmeldung trägt keinen Tab-Speicher der alten",
  ).toEqual([]);
  await zuFragen(p);
  await p.waitForTimeout(RUHE_MS);
  await expect(
    p.getByTestId("klara-hinweis"),
    "nach neuer Anmeldung erneut aufgedrängt",
  ).toHaveCount(0);
  await oeffnen(p);
  await expect(p.getByTestId("klara-eigeninitiative")).toHaveAttribute("data-modus", "hinweise");
  await beleg(p, info, "3 neue Anmeldung: Modus erhalten, Hinweis ruht");

  // --- K4 · übertragene Aufgabe sichtbar geführt, auch nach dem Neuladen -------------------------
  await waehle(p, "auftraege");
  await expect(p.getByTestId("klara-aufgaben")).toBeVisible();
  await expect(p.getByTestId("klara-aufgaben-leer")).toBeVisible();
  await p.getByTestId("klara-eingabe").fill(`Lege den Entwurf „${titel}“ an`);
  await p.getByTestId("klara-eingabe").press("Enter");
  await expect(p.getByTestId("klara-ausfuehrung").first()).toHaveAttribute("data-phase", "fertig", {
    timeout: 30_000,
  });
  const kartenStand = (await p
    .getByTestId("klara-ausfuehrung")
    .first()
    .getAttribute("data-stand")) as string;
  const aufgabe = p.getByTestId("klara-aufgabe");
  await expect(aufgabe).toHaveCount(1);
  await expect(aufgabe).toContainText(titel);
  await expect(aufgabe).toHaveAttribute("data-stand", kartenStand);
  await expect(p.getByTestId("klara-aufgaben")).toContainText("mit deinen Rechten");
  await beleg(p, info, "4 übertragene Aufgabe sichtbar geführt");

  await p.reload();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await oeffnen(p);
  await expect(p.getByTestId("klara-eigeninitiative")).toHaveAttribute("data-modus", "auftraege");
  await expect(p.getByTestId("klara-aufgabe")).toHaveCount(1, { timeout: 15_000 });
  await expect(p.getByTestId("klara-aufgabe")).toContainText(titel);
  await expect(p.getByTestId("klara-hinweis")).toHaveCount(0);
  await beleg(p, info, "5 nach Neuladen: Modus und Aufgabe vom Server");
  const ich = await p.request.get("/api/auth/me");
  const meineId = ((await ich.json()) as { id: string }).id;
  await p.context().close();

  // --- K4 · Rechte: ein zweites Konto sieht nichts davon -----------------------------------------
  const f = await anmelden(browser, emailFremd);
  const fremdStand = await amServer(f);
  expect(fremdStand.modus).toBe("nachfrage");
  expect(fremdStand.hinweise).toEqual([]);
  const fremdeKennung = await f.request.get(`${BASIS}?kontoId=${encodeURIComponent(meineId)}`);
  expect(fremdeKennung.status()).toBe(403);
  const fremdSchreiben = await f.request.put(BASIS, {
    data: { modus: "nachfrage", kontoId: meineId },
  });
  expect(fremdSchreiben.status()).toBe(403);
  const fremdeEntwuerfe = (await (await f.request.get("/api/drafts")).json()) as {
    payload?: { title?: string };
  }[];
  expect(fremdeEntwuerfe.map((d) => d.payload?.title)).not.toContain(titel);
  await zuFragen(f);
  await oeffnen(f);
  await waehle(f, "auftraege");
  await expect(f.getByTestId("klara-aufgaben-leer")).toBeVisible();
  await expect(f.getByTestId("klara-aufgabe")).toHaveCount(0);
  await beleg(f, info, "6 zweites Konto: eigene Vorgabe, keine fremde Aufgabe");
  await f.context().close();

  // Der Modus des ersten Kontos blieb trotz der abgewiesenen Fremdschreibversuche unverändert.
  const zurueck = await anmelden(browser, email);
  expect((await amServer(zurueck)).modus).toBe("auftraege");
  await zurueck.context().close();
});
