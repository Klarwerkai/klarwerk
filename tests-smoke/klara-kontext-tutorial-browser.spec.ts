// ================================================================================================
// KLARA 03 (produkt:20261007:klara-kontext-tutorial) — KLARA BEGLEITET DAS TUTORIAL „FRAGEN“,
// IM ECHTEN BETRIEB UND IM ECHTEN LAYOUT.
// ================================================================================================
//
// Eine Sonde am gebündelten Produkt, mit echtem Server und echter Anmeldung (eigenes Konto wie in
// `klara-basis-browser.spec.ts`, damit sich die drei Engines kein Gespräch wegnehmen):
//   K4 · Klara zeigt den WIRKLICHEN Schritt des vorhandenen siebenstufigen Tutorials; eine
//        Zwischenfrage (echter Frageweg), „Pause“, „Fortsetzen“ und „Zurück“ halten ihn.
//   K5 · Die Hervorhebung deckt das echte Bedienelement — nach Scrollen und nach Grössenwechsel
//        gemessen an echten Boxen. Über die Breitengrenze (900 px) baut die Hülle neu; Klara öffnet
//        das Tutorial wieder an DEMSELBEN Schritt. Ein Schritt ohne Ziel auf der echten Seite wird
//        als Fehlziel benannt.
//
// Sie legt keine Wissensobjekte an. WAS SIE NICHT ERSETZT: das Urteil eines Menschen, ob die
// Begleitung verständlich ist; eine echte Modellantwort (im Tor ist keins aktiv).
import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Klara-Kontext-Kennwort-1";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `klara-kontext-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Klara Kontext ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

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

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) {
    throw new Error("Element ohne Box");
  }
  return b;
}

/** Deckt der Zeiger das Element? Gemessen an echten Boxen, mit 4 px Spiel. */
async function zeigerDeckt(page: Page, ziel: Locator, wann: string): Promise<void> {
  const zeiger = page.getByTestId("klara-zeiger");
  await expect
    .poll(
      async () => {
        const z = await zeiger.boundingBox();
        const f = await ziel.boundingBox();
        if (!z || !f) {
          return false;
        }
        return (
          Math.abs(z.x - f.x) < 4 &&
          Math.abs(z.y - f.y) < 4 &&
          Math.abs(z.width - f.width) < 4 &&
          Math.abs(z.height - f.height) < 4
        );
      },
      { message: `${wann}: der Zeiger deckt das echte Bedienelement nicht`, timeout: 5_000 },
    )
    .toBe(true);
}

/** Der Zeiger steht auf dem Ziel — oder Klara benennt das Fehlziel; nie ins Leere. */
async function zeigerOderFehlziel(page: Page): Promise<void> {
  await expect(
    page.locator('[data-testid="klara-zeiger"], [data-testid="klara-tutorial-fehlziel"]').first(),
  ).toBeVisible();
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara 03 · Tutorial — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function oeffnen(page: Page): Promise<void> {
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
}

test("Klara 03 · Tutorial „Fragen“: wirklicher Schritt, Zwischenfrage, Pause, Zurück, Fortsetzen; Hervorhebung nach Scrollen und Grössenwechsel; Fehlziel", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const email = await eigenesKonto(page, "tutorial");
  const p = await anmelden(browser, email);
  await p.goto("/klara-vorschau");
  await expect(p.getByTestId("klara-figur")).toBeVisible({ timeout: 15_000 });
  await p.goto("/fragen");
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await oeffnen(p);
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();

  // --- K4 · Begleiten: Klara zeigt den wirklichen Schritt auf dem echten Bedienelement -----------
  await p.getByTestId("klara-modus-begleite").click();
  await expect(p.getByTestId("tutorial-bereich")).toBeVisible();
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 1 von 7");
  const zeiger = p.getByTestId("klara-zeiger");
  await expect(zeiger).toHaveAttribute("data-ort", "echt");
  const echtesFeld = p
    .getByTestId("page-fragen")
    .locator('input[data-tutorial-ziel="fragen.fragefeld"]');
  await zeigerDeckt(p, echtesFeld, "Schritt 1");
  await beleg(p, info, "1 Schritt 1, Zeiger auf dem echten Fragefeld");

  // --- K5 · Scrollen: der Zeiger folgt dem Element ------------------------------------------------
  const vorher = await box(echtesFeld);
  await p.evaluate(() => {
    const main = document.querySelector("main");
    if (main) {
      main.scrollTop += 160;
    }
    window.scrollBy(0, 160);
  });
  await zeigerDeckt(p, echtesFeld, "nach Scrollen");
  const nachScroll = await box(echtesFeld);
  await info.attach("Fragefeld vor/nach Scrollen (px)", {
    body: JSON.stringify({ vorher, nachScroll }),
    contentType: "application/json",
  });

  // --- K5 · Grössenwechsel innerhalb derselben Hülle (≥ 900 px) ----------------------------------
  await p.setViewportSize({ width: 1000, height: 700 });
  await zeigerDeckt(p, echtesFeld, "nach Grössenwechsel 1000 × 700");
  await beleg(p, info, "2 nach Scrollen und Grössenwechsel");

  // --- K4 · Schritt 2, Zwischenfrage über den echten Frageweg: das Tutorial hält am Schritt ------
  await p.getByTestId("klara-tutorial-weiter").click();
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 2 von 7");
  const aktuell = p.locator('[data-testid="tutorial-kapitel"][aria-current="step"]');
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-eingabe").fill("Was heisst hier Kontext?");
  await p.getByTestId("klara-eingabe").press("Enter");
  await expect(p.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "false");
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await expect(p.getByTestId("klara-tutorial-hinweis")).toContainText("Pausiert bei Schritt 2");
  expect((await frageweg).status()).toBe(200);
  await expect(
    p.locator('[data-testid="klara-nachricht"][data-von="klara"]').last(),
  ).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");

  // Fortsetzen, Pause, Fortsetzen — derselbe Schritt; Zurück und wieder Weiter.
  await p.getByTestId("klara-tutorial-fortsetzen").click();
  await expect(p.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "true");
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await p.getByTestId("klara-tutorial-pause").click();
  await expect(p.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "false");
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await p.getByTestId("klara-tutorial-zurueck").click();
  await expect(aktuell).toHaveAttribute("data-schritt", "verstehen");
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 1 von 7");
  await p.getByTestId("klara-tutorial-weiter").click();
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await beleg(p, info, "3 Zwischenfrage, Pause, Zurück — Schritt 2 gehalten");

  // --- K5 · Grössenwechsel ÜBER die Breitengrenze: Klara wird neu montiert, der Schritt bleibt ----
  // Nacharbeit 2 (gemessen): der Tutorialbereich behält seinen Schritt selbst — Klaras neu
  // montierte Begleitkarte zeigt ihn weiter an; es wird nichts wiederhergestellt.
  await p.setViewportSize({ width: 390, height: 844 });
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 2 von 7", {
    timeout: 10_000,
  });
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  // Gezeigt wird das Ziel dieses Schritts — oder Klara benennt, dass es fehlt; nie ins Leere.
  await expect(
    p.locator('[data-testid="klara-zeiger"], [data-testid="klara-tutorial-fehlziel"]').first(),
  ).toBeVisible();
  await beleg(p, info, "4 schmal 390: Tutorial weiter bei Schritt 2");
  await p.setViewportSize({ width: 1280, height: 800 });
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 2 von 7", {
    timeout: 10_000,
  });
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await zeigerOderFehlziel(p);

  // --- K4 · Neuladen: das Tutorial steht zu — Klara öffnet es wieder an DEMSELBEN Schritt --------
  await p.reload();
  await expect(p.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await oeffnen(p);
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 2 von 7", {
    timeout: 10_000,
  });
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await expect(p.getByTestId("klara-tutorial-hinweis")).toContainText("wieder bei Schritt 2");
  await zeigerOderFehlziel(p);
  await beleg(p, info, "4b nach Neuladen: Tutorial wieder bei Schritt 2");

  // --- K5 · Fehlziel: im Schritt „Antwort“ gibt es auf der echten Seite noch keine Antwort -------
  // Nacharbeit 4 (gemessen): „Antwort“ ist Schritt 4 von 7 (danach „5. Quelle“). Nach dem Neuladen
  // steht das Tutorial bei Schritt 2 — zwei Schritte weiter, nicht drei.
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  for (let i = 0; i < 2; i++) {
    await p.getByTestId("klara-tutorial-weiter").click();
  }
  await expect(p.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 4 von 7");
  await expect(aktuell).toHaveAttribute("data-schritt", "antwort");
  await expect(p.getByTestId("klara-tutorial-fehlziel")).toBeVisible();
  await expect(p.getByTestId("klara-tutorial-fehlziel")).toContainText(
    "auf der echten Seite gerade nicht zu sehen",
  );
  await beleg(p, info, "5 Fehlziel benannt");

  // Bewusst beendet: es wird nichts wieder geöffnet.
  await p.getByTestId("klara-tutorial-ende").click();
  await expect(p.getByTestId("klara-tutorial")).toHaveCount(0);
  await p.context().close();
});
