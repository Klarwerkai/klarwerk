// AUFTRAG-mega9 Block D-1 (KW-E2E-004): BEWEISSTUFE VOR DEM BAUEN.
//
// Der externe Prüfer meldete: mobiles Menü öffnen (390×844 und 768×1024), 25× Tab — der Fokus
// bleibe ausschließlich auf „Menü schließen", kein Menüpunkt sei per Tastatur erreichbar. Er nennt
// seine Testgrenze aber selbst: die Oberfläche war der Codex In-App-Browser, nicht ein echtes
// Chrome. Zwei Erklärungen decken das Symptom gleich gut ab:
//
//   1. Echter Codefehler — focusablesIn() findet im Panel nur den X-Knopf, die Falle kreist auf ihm.
//   2. Artefakt der Testumgebung — in manchen eingebetteten WebViews bewegt Tab den Fokus gar nicht;
//      er bliebe dort, wohin ihn der useEffect beim Öffnen gesetzt hat (X-Knopf).
//
// Vom Lesen aus sind die beiden nicht zu trennen. Deshalb protokolliert dieser Lauf in einem ECHTEN
// Chromium, was tatsächlich passiert: die vollständige Liste der im Panel gefundenen fokussierbaren
// Elemente und nach JEDEM Tab das aktive Element. Er behauptet nichts — er misst.
//
// Kein Teil von tools/check (Browser-Zwang). Aufruf: npx playwright test --config
// playwright.smoke.config.ts tests-smoke/mobile-drawer-focus-probe.spec.ts
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

// AUFTRAG-mega24 Block A: diese Sonde trug bis mega23 ein EIGENES Zugangsdatenpaar
// (`focusprobe@klarwerk.test`). Weil sie alphabetisch zuerst läuft, VERBRAUCHTE sie damit die
// einzige Ersteinrichtung des geteilten In-Memory-Servers und sperrte die beiden anderen Sonden
// aus. Alle Sonden benutzen jetzt EIN gemeinsames Konto (`support/auth.ts`).

const VIEWPORTS = [
  { name: "390x844 (Telefon)", width: 390, height: 844 },
  { name: "768x1024 (Tablet)", width: 768, height: 1024 },
];

// Derselbe Selektor, den MobileNavDrawer.focusablesIn benutzt — damit die Messung im Browser
// exakt das abbildet, was der Code zur Laufzeit sieht.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function describeActive(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) {
      return "(kein activeElement)";
    }
    const tag = el.tagName.toLowerCase();
    const label = el.getAttribute("aria-label") ?? "";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    const href = el.getAttribute("href") ?? "";
    const inDialog = el.closest("dialog") !== null;
    return `${tag}${label ? ` [aria-label="${label}"]` : ""}${href ? ` [href=${href}]` : ""}${
      text ? ` "${text}"` : ""
    }${inDialog ? " {im Dialog}" : " {AUSSERHALB des Dialogs}"}`;
  });
}

for (const vp of VIEWPORTS) {
  test(`D-1 Fokus-Protokoll im mobilen Menü — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await ensureLoggedIn(page);
    await page.goto("/start");

    // Menü öffnen (Hamburger). Der Drawer wird nur unterhalb der Desktop-Grenze gerendert.
    const burger = page.locator('button[aria-label="Menü öffnen"], button[aria-label="Menu"]');
    await expect(burger.first()).toBeVisible({ timeout: 10_000 });
    await burger.first().click();

    const dialog = page.locator("dialog[aria-modal='true']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // --- Messung 1: Was findet der Selektor im Panel WIRKLICH? -------------------------------
    const found = await page.evaluate((sel) => {
      const panel = document.querySelector("dialog[aria-modal='true']");
      if (!panel) {
        return [];
      }
      return [...panel.querySelectorAll(sel)]
        .filter(
          (el) =>
            !el.hasAttribute("hidden") && el.closest("[hidden],[aria-hidden='true']") === null,
        )
        .map((el, i) => {
          const tag = el.tagName.toLowerCase();
          const label = el.getAttribute("aria-label") ?? "";
          const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
          return `${i}: ${tag}${label ? ` [aria-label="${label}"]` : ""}${text ? ` "${text}"` : ""}`;
        });
    }, FOCUSABLE_SELECTOR);

    console.log(`\n===== ${vp.name} =====`);
    console.log(`Fokussierbare Elemente im Panel (focusablesIn-äquivalent): ${found.length}`);
    for (const line of found) {
      console.log(`   ${line}`);
    }

    // --- Messung 2: Fokus nach dem Öffnen, dann Schritt für Schritt Tab ----------------------
    console.log(`  nach dem Öffnen: ${await describeActive(page)}`);
    const trail: string[] = [];
    for (let i = 1; i <= 25; i++) {
      await page.keyboard.press("Tab");
      const active = await describeActive(page);
      trail.push(active);
      console.log(`  Tab ${String(i).padStart(2, " ")}: ${active}`);
    }

    // --- Messung 3: Shift+Tab rückwärts ------------------------------------------------------
    console.log("  --- Shift+Tab rückwärts ---");
    for (let i = 1; i <= 5; i++) {
      await page.keyboard.press("Shift+Tab");
      console.log(`  Shift+Tab ${i}: ${await describeActive(page)}`);
    }

    // Der Probe-Lauf misst und protokolliert; die Bewertung steht im Bericht. Eine einzige
    // Mindestzusicherung: das Panel enthält überhaupt fokussierbare Elemente.
    expect(found.length).toBeGreaterThan(0);
    // Und: der Fokus hat das Panel nie verlassen (Fokusfalle hält) — falls doch, ist DAS der Befund.
    const escaped = trail.filter((t) => t.includes("AUSSERHALB"));
    console.log(`  Fokus verließ den Dialog: ${escaped.length}× von 25`);
  });
}
