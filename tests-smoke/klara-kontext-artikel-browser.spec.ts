// ================================================================================================
// KLARA 03 (produkt:20261007:klara-kontext-tutorial) — ARTIKEL, MARKIERUNG, BEZUG UND QUELLEN IM
// ECHTEN BROWSER.
// ================================================================================================
//
// Läuft im ISOLIERTEN Kontext (`chromium-zustand`, eigener Server — `playwright.smoke.config.ts`,
// `ZUSTAND_SPEC`): die Sonde legt einen freigegebenen Beitrag an und stuft ihn später vertraulich.
// Im geteilten Bestand hätte das andere Sonden gestört.
//
//   K1 · „Dieser Artikel“: Seite, Titel, Fassung, Prüfstatus und Modus aus dem Appzustand;
//        Bezug wechseln (Seite, Markierung, frei).
//   K2 · Mit der echten Maus markiert (Dreifachklick), „Klara fragen“; nach Fokuswechsel (Klick in
//        Klaras Eingabe, Tab) und nach Seitenwechsel mit Neuladen steht die Markierung mit derselben
//        Herkunft und Fassung da.
//   K3 · „Erklären“ geht mit der Markierung als Zitat an den echten Frageweg; die Antwort nennt ihre
//        Quelle mit Fassung und Prüfstatus — oder Klara benennt die fehlende Grundlage. Was der
//        Server geantwortet hat, hängt als Beleg am Bericht. „Übersetzen“ ohne Leseübersetzung sagt,
//        dass die Grundlage fehlt.
//   K6 · Danach vertraulich gestuft: die Markierung geht nicht mehr an den Frageweg, der Grund steht da.
//
// Im Tor ist kein Modell aktiv — die Antwort kommt „ohne KI“. Eine echte Modellantwort und das
// Urteil eines Menschen belegt dieser Lauf nicht.
import {
  type Browser,
  type Page,
  type Request,
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

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara 03 · Artikel — ${name}`, {
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

interface AskKoerper {
  result: {
    answered: boolean;
    demo: boolean;
    belastbarkeit?: { quellen?: { koId: string; version: number; validiert: boolean }[] };
  };
}

test("Klara 03 · Artikel: Kontext, Markierung über Fokus- und Seitenwechsel, Bezug, Erklären mit Quelle und Fassung, Rechte", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);

  // Der Beitrag — angelegt und freigegeben vom Admin dieses isolierten Servers.
  const m = marke();
  const titel = `Dichtung QX7${m} wechseln`;
  const aussage = `Die Dichtung QX7${m} wird vor dem Wechsel entlastet.`;
  const angelegt = await page.request.post("/api/kos", {
    data: {
      title: titel,
      statement: aussage,
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
  const gelesen = await page.request.get(`/api/kos/${koId}`);
  const fassung = ((await gelesen.json()) as { version: number }).version;

  const email = await eigenesKonto(page, "artikel");
  const p = await anmelden(browser, email);
  const anfragen: Request[] = [];
  p.on("request", (r) => anfragen.push(r));
  await p.goto("/klara-vorschau");
  await expect(p.getByTestId("klara-figur")).toBeVisible({ timeout: 15_000 });

  // --- K1 · „Dieser Artikel“ aus dem Appzustand -------------------------------------------------
  await p.goto(`/wissen/${koId}`);
  await oeffnen(p);
  await expect(p.getByTestId("klara-ort-seite")).toHaveText("Wissen");
  await expect(p.getByTestId("klara-ort-objekt")).toHaveText(`„${titel}“`, { timeout: 15_000 });
  await expect(p.getByTestId("klara-ort-fassung")).toHaveText(`Fassung ${fassung}`);
  await expect(p.getByTestId("klara-ort-pruefstatus")).toHaveAttribute(
    "data-pruefstatus",
    "geprueft",
  );
  await expect(p.getByTestId("klara-ort-modus")).toHaveAttribute("data-modus", "lesen");
  await expect(p.getByTestId("klara-bezug-zeile")).toHaveText("Dieser Artikel");
  await beleg(p, info, "1 Dieser Artikel mit Fassung und Prüfstatus");

  // --- K2 · echte Mausmarkierung → „Klara fragen“ --------------------------------------------------
  // Nacharbeit 2 (gemessen): das kompakt geöffnete Gespräch liegt bei 1280 px über dem Lesetext und
  // fängt den Klick ab. Wie eine Person schliesst die Sonde es zum Markieren; „Klara fragen“ öffnet
  // es mit der Markierung wieder.
  await p.getByTestId("klara-schliessen").click();
  await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
  const absatz = p.locator('[data-testid="bib-text"] p', { hasText: aussage }).first();
  await absatz.click({ clickCount: 3 });
  await expect(p.getByTestId("klara-auswahl-knopf")).toBeVisible();
  await p.getByTestId("klara-auswahl-knopf").click();
  await expect(p.getByTestId("klara-gespraech")).toBeVisible();
  await expect(p.getByTestId("klara-auswahl-text")).toContainText(aussage);
  const herkunft = p.getByTestId("klara-auswahl-herkunft");
  await expect(herkunft).toContainText(titel);
  await expect(herkunft).toContainText(`Fassung ${fassung}`);
  await expect(herkunft).toContainText("geprüft");
  await expect(herkunft).toContainText(/Absatz \d+/);
  const herkunftText = ((await herkunft.textContent()) ?? "").trim();
  await expect(p.getByTestId("klara-bezug-zeile")).toHaveText("Dieser Artikel · markierter Absatz");

  // Fokuswechsel: Klick in Klaras Eingabe, dann Tab — die Markierung bleibt.
  await p.getByTestId("klara-eingabe").click();
  await p.keyboard.press("Tab");
  await expect(p.getByTestId("klara-auswahl-text")).toContainText(aussage);
  await beleg(p, info, "2 Markierung mit Herkunft und Fassung");

  // Seitenwechsel mit Neuladen: dieselbe Herkunft, der Bezug nennt die Markierung von dort.
  await p.goto("/fragen");
  await oeffnen(p);
  await expect(p.getByTestId("klara-ort-seite")).toHaveText("Fragen");
  await expect(herkunft).toHaveText(herkunftText);
  await expect(p.getByTestId("klara-bezug-zeile")).toHaveText(`Markierung aus „${titel}“`);

  // --- K1 · Kontextwechsel ---------------------------------------------------------------------
  await p.getByTestId("klara-bezug-frei").click();
  await expect(p.getByTestId("klara-bezug-zeile")).toHaveText(
    "Freies Gespräch – ohne Seite und Markierung",
  );
  await p.getByTestId("klara-bezug-seite").click();
  await expect(p.getByTestId("klara-bezug-zeile")).toHaveText("Diese Frage");
  await p.getByTestId("klara-bezug-markierung").click();
  await expect(p.getByTestId("klara-bezug")).toHaveAttribute("data-bezug", "markierung");
  await beleg(p, info, "3 auf Fragen: Markierung aus dem Artikel, Bezug gewählt");

  // --- K3 · „Erklären“ über den echten Frageweg -----------------------------------------------
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-aktion-erklaeren").click();
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  const gesendet = JSON.parse(antwort.request().postData() ?? "{}") as { question?: string };
  expect(gesendet.question).toBe(`Was gilt für „${aussage}“?`);
  const koerper = (await antwort.json()) as AskKoerper;
  await info.attach("Antwort des Fragewegs (answered, demo, Quellen mit Fassung)", {
    body: JSON.stringify({
      answered: koerper.result.answered,
      demo: koerper.result.demo,
      quellen: koerper.result.belastbarkeit?.quellen ?? null,
    }),
    contentType: "application/json",
  });
  const klara = p.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();
  await expect(klara).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  const angabe = koerper.result.belastbarkeit?.quellen?.find((q) => q.koId === koId);
  if (koerper.result.answered) {
    const quelle = klara.locator(`[data-testid="klara-quelle"][data-ko="${koId}"]`);
    await expect(quelle).toBeVisible();
    if (angabe) {
      await expect(quelle).toHaveAttribute("data-fassung", String(fassung));
      await expect(quelle).toHaveAttribute("data-geprueft", angabe.validiert ? "ja" : "nein");
      await expect(quelle).toContainText(`Fassung ${fassung}`);
    } else {
      // Der Frageweg nannte für diese Quelle keine Fassung — Klara sagt das, statt eine zu raten.
      await expect(quelle).toHaveAttribute("data-geprueft", "unbekannt");
    }
  } else {
    await expect(klara.getByTestId("klara-grundlage-fehlt")).toBeVisible();
    await expect(klara.getByTestId("klara-quelle")).toHaveCount(0);
  }
  const du = p.locator('[data-testid="klara-nachricht"][data-von="du"]').last();
  await expect(du.getByTestId("klara-nachricht-bezug")).toHaveAttribute("data-bezug", "markierung");
  await expect(du.getByTestId("klara-nachricht-bezug")).toContainText(`Fassung ${fassung}`);
  await beleg(p, info, "4 Erklären: Antwort mit Quelle, Fassung und Prüfstatus");

  // Übersetzen: im Tor gibt es keine Leseübersetzung — Klara sagt, dass die Grundlage fehlt.
  await p.getByTestId("klara-uebersetzen-sprache").selectOption("en");
  const vorUebersetzung = await p
    .locator('[data-testid="klara-nachricht"][data-von="klara"]')
    .count();
  await p.getByTestId("klara-aktion-uebersetzen").click();
  await expect(p.locator('[data-testid="klara-nachricht"][data-von="klara"]')).toHaveCount(
    vorUebersetzung + 1,
    { timeout: 15_000 },
  );
  // produkt:20261010:assistenz-name-avatar: ohne persönlichen Namen heisst es neutral „Assistenz".
  await expect(klara).toContainText("Assistenz übersetzt nicht frei");

  // --- K6 · jetzt vertraulich: die Markierung geht nicht mehr an den Frageweg --------------------
  const gestuft = await page.request.put(`/api/kos/${koId}`, {
    data: { action: "confidentiality", level: "vertraulich" },
  });
  expect(gestuft.status(), await gestuft.text()).toBe(200);
  const abHier = anfragen.length;
  await p.getByTestId("klara-aktion-erklaeren").click();
  await expect(p.getByTestId("klara-auswahl-gesperrt")).toContainText("keinen Zugriff");
  const danach = anfragen.slice(abHier).map((r) => new URL(r.url()).pathname);
  expect(danach).toContain(`/api/kos/${koId}`);
  expect(danach).not.toContain("/api/ask");
  await beleg(p, info, "5 nach dem Entzug: Markierung gesperrt, Grund benannt");
  await p.context().close();
});
