// ================================================================================================
// FE-003 · DAS TUTORIAL „FRAGEN“ IM ECHTEN BROWSER — Desktop 1280, Laptop 1024, schmal 390 px.
// ================================================================================================
//
// Was jsdom nicht kann, prüft diese Sonde am laufenden Kandidaten (Kriterien E1, E5, E6):
//   · Lage des Knopfs „Tutorial“: unter dem Kopfband, links, nicht rechts vom Schriftzug, farblich
//     abgesetzt — gemessen an echten Boxen und berechneten Farben.
//   · Lesbarkeit und Erreichbarkeit je Breite: kein waagerechtes Überlaufen, Steuerung im Bild,
//     Demo nicht bis zur Unlesbarkeit verkleinert.
//   · Tastatur: Öffnen, Weiter per Eingabetaste, Escape schliesst, Fokus zurück zum Knopf.
//   · Reduzierte Bewegung (`reducedMotion: "reduce"`): die Beispielfrage steht sofort vollständig da.
//   · Netz: nach dem Öffnen geht KEINE veraendernde Anfrage (POST/PUT/PATCH/DELETE) hinaus — weder
//     beim Durchlaufen noch in der Übung noch beim Übergang „Eigene Frage stellen“; eine vorher
//     eingegebene echte Frage bleibt stehen.
//   · Andere Seiten tragen keinen Knopf.
//
// Im hermetischen Tor (`smoke:ui:gate`) ist KEIN Modell aktiv — genau der KI-aus-Fall, für den das
// Tutorial gebaut ist. Die angehängten Bilder sind technische Prüfbelege der gerenderten Oberfläche,
// KEIN Tutorial-Inhalt.
import { type Page, type Request, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const BREITEN = [
  { name: "Desktop 1280", width: 1280, height: 800 },
  { name: "Laptop 1024", width: 1024, height: 768 },
  { name: "schmal 390", width: 390, height: 844 },
];

const SCHRITTE = 7;
const BEISPIELFRAGE = "Wie viele Homeoffice-Tage sind erlaubt?";

function veraendernd(anfragen: Request[]): string[] {
  return anfragen
    .filter((r) => r.url().includes("/api/") && !["GET", "HEAD", "OPTIONS"].includes(r.method()))
    .map((r) => `${r.method()} ${new URL(r.url()).pathname}`);
}

async function keinWaagerechterUeberlauf(page: Page, wann: string): Promise<void> {
  const b = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    breite: window.innerWidth,
    bereich: (() => {
      const el = document.querySelector<HTMLElement>('[data-testid="tutorial-bereich"]');
      return el ? { scroll: el.scrollWidth, client: el.clientWidth } : null;
    })(),
  }));
  expect(b.scroll, `${wann}: die Seite läuft waagerecht über`).toBeLessThanOrEqual(b.breite + 1);
  if (b.bereich) {
    expect(b.bereich.scroll, `${wann}: der Tutorial-Bereich läuft über`).toBeLessThanOrEqual(
      b.bereich.client + 1,
    );
  }
}

async function imBild(page: Page, testId: string, wann: string): Promise<void> {
  const box = await page.getByTestId(testId).first().boundingBox();
  const breite = page.viewportSize()?.width ?? 0;
  expect(box, `${wann}: ${testId} nicht gerendert`).not.toBeNull();
  if (box) {
    expect(box.x, `${wann}: ${testId} links abgeschnitten`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${wann}: ${testId} rechts abgeschnitten`).toBeLessThanOrEqual(
      breite + 1,
    );
  }
}

for (const b of BREITEN) {
  test(`FE-003 · Tutorial „Fragen“ — ${b.name}`, async ({ page }, info) => {
    await page.setViewportSize({ width: b.width, height: b.height });
    await ensureLoggedIn(page);
    await page.goto("/fragen");
    await expect(page.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });

    // --- E1 · Lage und Farbe des Knopfs -----------------------------------------------------
    const kopf = page.getByTestId("kopfband");
    const knopf = page.getByTestId("tutorial-knopf");
    await expect(knopf).toBeVisible();
    await expect(knopf).toHaveText("Tutorial");
    const kopfBox = await kopf.boundingBox();
    const knopfBox = await knopf.boundingBox();
    const markeBox = await page.locator(".kw-kopfband-marke").first().boundingBox();
    expect(kopfBox && knopfBox && markeBox).toBeTruthy();
    if (kopfBox && knopfBox && markeBox) {
      const unterkante = kopfBox.y + kopfBox.height;
      expect(knopfBox.y, "der Knopf steht nicht unter dem Kopfband").toBeGreaterThanOrEqual(
        unterkante - 1,
      );
      expect(
        knopfBox.y - unterkante,
        "der Knopf steht nicht direkt unter dem Kopfband",
      ).toBeLessThan(24);
      expect(knopfBox.x, "der Knopf steht rechts vom Schriftzug").toBeLessThanOrEqual(
        markeBox.x + 4,
      );
      if (b.width >= 900) {
        expect(
          Math.abs(knopfBox.x - markeBox.x),
          "breit steht der Knopf bündig unter dem Schriftzug",
        ).toBeLessThanOrEqual(8);
      }
    }
    const farben = await page.evaluate(() => {
      const bg = (sel: string) =>
        getComputedStyle(document.querySelector(sel) as Element).backgroundColor;
      return {
        kopf: bg('[data-testid="kopfband"]'),
        knopf: bg('[data-testid="tutorial-knopf"]'),
        schrift: getComputedStyle(
          document.querySelector('[data-testid="tutorial-knopf"]') as Element,
        ).color,
      };
    });
    expect(farben.knopf, "der Knopf hat die Farbe des Kopfbands").not.toBe(farben.kopf);
    expect(farben.knopf).not.toBe(farben.schrift);

    // Eine echte, noch nicht gesendete Frage — sie muss alles überstehen.
    const echtesFeld = page
      .getByTestId("page-fragen")
      .locator('input[data-tutorial-ziel="fragen.fragefeld"]');
    await echtesFeld.fill("Meine echte Frage");

    // --- Netzbeobachtung ab dem Öffnen ------------------------------------------------------
    const anfragen: Request[] = [];
    page.on("request", (r) => anfragen.push(r));

    // --- Öffnen per Tastatur ----------------------------------------------------------------
    await knopf.focus();
    await page.keyboard.press("Enter");
    const bereich = page.getByTestId("tutorial-bereich");
    await expect(bereich).toBeVisible();
    await expect(knopf).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(":focus")).toHaveText("Tutorial: Fragen");
    await expect(
      page.getByTestId("tutorial-demo").locator("[data-tutorial-ziel]").first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await keinWaagerechterUeberlauf(page, `${b.name}, geöffnet`);
    for (const id of [
      "tutorial-weiter",
      "tutorial-abspielen",
      "tutorial-wiederholen",
      "tutorial-schliessen",
      "tutorial-demo",
    ]) {
      await imBild(page, id, b.name);
    }
    // Nicht bis zur Unlesbarkeit verkleinert: Erklärung ≥ 13 px, Demo-Feld ≥ 13 px Schrift.
    const schrift = await page.evaluate(() => ({
      erklaerung: Number.parseFloat(
        getComputedStyle(document.querySelector('[data-testid="tutorial-erklaerung"] p') as Element)
          .fontSize,
      ),
      demoBreite: (
        document.querySelector('[data-testid="tutorial-demo"]') as HTMLElement
      ).getBoundingClientRect().width,
    }));
    expect(schrift.erklaerung).toBeGreaterThanOrEqual(13);
    expect(schrift.demoBreite, "die Demo ist zu schmal zum Lesen").toBeGreaterThanOrEqual(280);
    // Titel und Lernziel werden nicht neben den Knöpfen zusammengedrückt (Beraterbefund: bei
    // 390 px nur 62,7 px Textspalte, fast Wort-für-Wort-Umbruch). Gemessen an der Textspalte des
    // Kopfs gegen die Breite des Bereichs.
    const kopfSpalte = await page.evaluate(() => {
      const breite = (sel: string) =>
        (document.querySelector(sel) as HTMLElement).getBoundingClientRect().width;
      return {
        text: breite('[data-testid="tutorial-kopftext"]'),
        bereich: breite('[data-testid="tutorial-bereich"]'),
      };
    });
    expect(kopfSpalte.text, `${b.name}: Titel/Lernziel-Spalte zu schmal`).toBeGreaterThanOrEqual(
      Math.min(256, kopfSpalte.bereich * 0.7),
    );
    await info.attach(`FE-003 geöffnet — ${b.name} (technischer Prüfbeleg)`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });

    // --- Alle Schritte per Tastatur: Weiter + Eingabetaste ---------------------------------
    for (let nr = 1; nr < SCHRITTE; nr++) {
      await expect(page.getByTestId("tutorial-fortschritt")).toContainText(`${nr}`);
      await page.getByTestId("tutorial-weiter").focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByTestId("tutorial-demo").locator("[data-tutorial-ziel]").first(),
      ).toBeVisible();
      await expect(page.locator("[data-tutorial-ziel-fehlt]")).toHaveCount(0);
      await keinWaagerechterUeberlauf(page, `${b.name}, Schritt ${nr + 1}`);
    }
    await expect(page.getByTestId("tutorial-fortschritt")).toContainText(`${SCHRITTE}`);

    // --- Übung in der Demo ------------------------------------------------------------------
    const demoFeld = page.getByTestId("tutorial-demo").locator("input");
    await demoFeld.fill("Meine Übungsfrage");
    await demoFeld.press("Enter");
    await expect(page.getByTestId("tutorial-demo")).toContainText("Übungsantwort", {
      timeout: 10_000,
    });
    // Chip: wirkt und schliesst wieder (Runde 2, Befund 2).
    const chip = page.getByTestId("tutorial-demo-chip");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("tutorial-demo-chip-hinweis")).toBeVisible();
    await chip.click();
    await expect(chip).toHaveAttribute("aria-expanded", "false");
    // Der tatsächliche Weg der Seite (Runde 2, Befund 1): „…“ → „Mehr …“ → Quellenliste.
    await page.getByTestId("tutorial-demo-menue").click();
    await page.getByTestId("tutorial-demo-menue-punkt-mehr").click();
    const blatt = page.getByTestId("tutorial-demo-mehr");
    await expect(blatt).toBeVisible();
    await expect(blatt.locator('[data-tutorial-ziel="fragen.quellenliste"]')).toBeVisible();
    await imBild(page, "tutorial-demo-mehr", `${b.name}, Blatt „Mehr“`);
    await info.attach(`FE-003 Übung, Blatt „Mehr“ — ${b.name} (technischer Prüfbeleg)`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    await page.keyboard.press("Escape");
    await expect(blatt).toHaveCount(0);
    await expect(bereich, "Escape im Blatt schliesst nicht das Tutorial").toBeVisible();

    // --- Übergang zur echten Seite -----------------------------------------------------------
    await page.getByTestId("tutorial-eigene-frage").click();
    await expect(bereich).toHaveCount(0);
    await expect(echtesFeld).toBeFocused();
    await expect(echtesFeld).toHaveValue("Meine echte Frage");
    await page.waitForTimeout(500);
    expect(veraendernd(anfragen), "das Tutorial hat etwas verändert oder gesendet").toEqual([]);

    // --- Escape schliesst, Fokus zurück, Seite bedienbar --------------------------------------
    await knopf.click();
    await expect(bereich).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bereich).toHaveCount(0);
    await expect(knopf).toBeFocused();
    await echtesFeld.fill("Meine echte Frage, ergänzt");
    await expect(echtesFeld).toHaveValue("Meine echte Frage, ergänzt");
    expect(veraendernd(anfragen)).toEqual([]);
  });
}

test("FE-003 · reduzierte Bewegung: die Beispielfrage steht sofort vollständig da", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  await page.goto("/fragen");
  await page.getByTestId("tutorial-knopf").click();
  await page.locator('[data-testid="tutorial-kapitel"][data-schritt="formulieren"]').click();
  await expect(page.getByTestId("tutorial-demo").locator("input")).toHaveValue(BEISPIELFRAGE);
  await expect(page.getByTestId("tutorial-reduziert")).toBeVisible();
  const animation = await page.evaluate(() => {
    const el = document.querySelector('[data-tutorial-aktiv="true"]');
    return el ? getComputedStyle(el).animationName : "kein-ziel";
  });
  expect(animation, "trotz reduzierter Bewegung leuchtet das Ziel auf").toBe("none");
});

test("FE-003 · andere Seiten tragen kein Tutorial", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  for (const pfad of ["/start", "/bibliothek"]) {
    await page.goto(pfad);
    await expect(page.getByTestId("kopfband")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(
      page.getByTestId("tutorial-knopf"),
      `${pfad} trägt einen Tutorial-Knopf`,
    ).toHaveCount(0);
    await expect(page.getByTestId("tutorial-bereich")).toHaveCount(0);
  }
});

// RUNDE 3 (Bens Befund): die laufende Vorführung öffnet im Kapitel „Quelle“ das modale Blatt
// „Mehr“. Die Modalgrenze der Seite sperrt dann den Tutorial-Bereich — Pause und Erklärung müssen
// trotzdem erreichbar sein, und zwar im Blatt selbst. Playwright klickt nur bedienbare Elemente;
// ein Knopf unter `inert` liesse diesen Test scheitern.
for (const b of [BREITEN[0], BREITEN[2]]) {
  if (!b) {
    continue;
  }
  test(`FE-003 · laufende Vorführung im Blatt „Mehr“: Pause bleibt bedienbar — ${b.name}`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: b.width, height: b.height });
    await ensureLoggedIn(page);
    await page.goto("/fragen");
    await page.getByTestId("tutorial-knopf").click();
    await page.locator('[data-testid="tutorial-kapitel"][data-schritt="quelle"]').click();
    await page.getByTestId("tutorial-abspielen").click();
    const blatt = page.getByTestId("tutorial-demo-mehr");
    await expect(blatt, "die Vorführung öffnet das Blatt").toBeVisible({ timeout: 15_000 });
    const rahmenGesperrt = await page.evaluate(
      () =>
        document.querySelector('[data-testid="tutorial-abspielen"]')?.closest("[inert]") !== null,
    );
    expect(rahmenGesperrt, "die Modalgrenze der Seite bleibt unangetastet").toBe(true);
    const pause = blatt.getByTestId("tutorial-abspielen-blatt");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await imBild(page, "tutorial-abspielen-blatt", `${b.name}, Blatt`);
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await blatt.getByTestId("tutorial-begleitung-erklaerung").locator("summary").click();
    await expect(blatt.getByTestId("tutorial-begleitung-erklaerung")).toContainText(
      "Um eine Aussage zu prüfen",
    );
    // Auch per Tastatur: Fokus auf den Knopf, Eingabetaste spielt weiter.
    await pause.focus();
    await page.keyboard.press("Enter");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(blatt).toHaveCount(0);
    await expect(page.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "false");
  });
}
