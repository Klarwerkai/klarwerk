import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// VERSTÄNDNISFRAGEN IM ECHTEN BROWSER (aufnahme:20260922:gesamt-lernwege, Nacharbeit 3, Befund Ben).
// ================================================================================================
//
// Geklickt wird gegen den Smoke-Server, ohne Hilfswege über die Schnittstelle — bis auf die
// Vorbereitung (zweites Konto, gültiger Eintrag), wie in `veroeffentlichung-browser.spec.ts`:
//   1. Die Verantwortliche (Konto der Ersteinrichtung, Administrator) legt an der Wissensansicht
//      einen Fragensatz zu Fassung V1 an: Titel, Rolle, Regel, Frage, Antworten, richtige Antwort,
//      Erläuterung, wörtliche Belegstelle → Entwurf ohne Befund.
//   2. Sie bearbeitet ihn (neue Version 2) und nimmt ihn an. Ohne Freigaberegel im Space ist das die
//      direkte Annahme durch Freigabeberechtigte (die Regel-Fälle stehen in
//      `tests/verstaendnisfragen/kontoregel.test.ts`).
//   3. Eine Leserin (eigener Kontext) sieht Regel und Abgrenzung, beantwortet, bekommt die
//      Rückmeldung mit Sprung an die Belegstelle der Fassung.
//   4. Sie lädt die Seite NEU: das Ergebnis steht da, die Rückmeldung lässt sich erneut abrufen —
//      dieselbe Versuchskennung, dasselbe Urteil.
//
// LÄUFT IM ISOLIERTEN KONTEXT (`chromium-zustand`): der Fall legt Konto, Eintrag, Fragensatz und
// Versuch an. Jeder Lauf hat eigene Namen. Alle Inhalte und Konten sind erfundene Testdaten.
//
// WAS NICHT GEMESSEN IST: Firefox/WebKit, die Space-Freigaberegel im Browser (am Draht belegt),
// und ob Menschen Regel und Rückmeldung verstehen.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

test("Fragensatz anlegen, bearbeiten, annehmen; beantworten; Rückmeldung nach Neuladen", async ({
  page,
  browser,
}) => {
  await ensureLoggedIn(page);
  const m = marke();
  const leserinMail = `lena-${m}@klarwerk.test`;
  const leserinPass = "Leserin-Passwort-1";
  const beleg = `der Absperrschieber ${m} geschlossen und gesichert`;

  const konto = await page.request.post("/api/users", {
    data: { name: `Lena Lernende ${m}`, email: leserinMail, password: leserinPass, role: "viewer" },
  });
  expect(konto.status(), await konto.text()).toBe(201);
  const angelegt = await page.request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: `Schieberwartung Verständnis ${m}`,
      statement: `Vor der Wartung wird ${beleg}.`,
      type: "best_practice",
      category: "Wartung",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const ko = (await angelegt.json()) as { id: string };
  const gueltig = await page.request.put(`/api/kos/${ko.id}`, {
    data: { action: "admin-validate" },
  });
  expect(gueltig.status(), await gueltig.text()).toBe(200);

  // ---- 1. Anlegen an der Wissensansicht ----------------------------------------------------------
  await page.goto(`/wissen/${ko.id}`);
  const bereich = page.getByTestId("verstaendnis-bereich");
  await expect(bereich).toBeVisible({ timeout: 15_000 });
  await bereich.getByTestId("verstaendnis-anlegen").click();
  const editor = bereich.getByTestId("verstaendnis-editor");
  await expect(editor).toBeVisible();
  await editor.getByTestId("verstaendnis-feld-titel").fill(`Schieber · Verständnis ${m}`);
  await editor.locator('[data-testid="verstaendnis-feld-rolle"][data-rolle="viewer"]').check();
  await editor.getByTestId("verstaendnis-feld-mindest").fill("1");
  await editor.getByTestId("verstaendnis-feld-versuche").fill("2");
  await editor.getByTestId("verstaendnis-feld-frage").fill("Was geschieht vor der Wartung?");
  const optionen = editor.getByTestId("verstaendnis-feld-option");
  await optionen.nth(0).fill("Der Absperrschieber wird geschlossen und gesichert");
  await optionen.nth(1).fill("Der Schieber bleibt offen");
  await editor.getByTestId("verstaendnis-feld-richtig").nth(0).check();
  await editor
    .getByTestId("verstaendnis-feld-erlaeuterung")
    .fill("Die Anweisung verlangt Schliessen und Sichern vor der Wartung.");
  await editor.getByTestId("verstaendnis-feld-beleg").fill(beleg);
  await bild(page, "1-editor-ausgefuellt");
  await editor.getByTestId("verstaendnis-speichern").click();

  const bearbeitung = bereich.getByTestId("verstaendnis-bearbeitung");
  await expect(bearbeitung).toHaveAttribute("data-status", "entwurf", { timeout: 15_000 });
  await expect(bearbeitung.getByTestId("verstaendnis-status")).toContainText("Version 1");
  await expect(bearbeitung).toContainText("Alle Fragen sind aus Fassung 1 belegt.");
  await expect(bearbeitung.getByTestId("verstaendnis-annahme")).toContainText("direkte Annahme");

  // ---- 2. Bearbeiten (neue Version) und annehmen ---------------------------------------------------
  await bearbeitung.getByTestId("verstaendnis-bearbeiten").click();
  const editor2 = bereich.getByTestId("verstaendnis-editor");
  await editor2
    .getByTestId("verstaendnis-feld-titel")
    .fill(`Schieber · Verständnis ${m} (überarbeitet)`);
  await editor2.getByTestId("verstaendnis-speichern").click();
  await expect(bearbeitung.getByTestId("verstaendnis-status")).toContainText("Version 2", {
    timeout: 15_000,
  });
  await bearbeitung.getByTestId("verstaendnis-annehmen").click();
  await expect(bearbeitung).toHaveAttribute("data-status", "angenommen", { timeout: 15_000 });
  await bearbeitung.scrollIntoViewIfNeeded();
  await bild(page, "2-angenommen");

  // ---- 3./4. Die Leserin: beantworten, Rückmeldung, Neuladen ---------------------------------------
  const projektAdresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext(
    projektAdresse === undefined ? {} : { baseURL: projektAdresse },
  );
  try {
    const leserin = await kontext.newPage();
    await leserin.goto("/");
    await expect(leserin.locator('input[type="password"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await leserin.locator('input[type="email"]').fill(leserinMail);
    await leserin.locator('input[type="password"]').first().fill(leserinPass);
    await leserin.locator('button[type="submit"]').click();
    await expect(workspaceMarker(leserin)).toBeVisible({ timeout: 15_000 });
    if (await leserin.getByTestId("notice-ack").count()) {
      await leserin.getByTestId("notice-ack").click();
    }

    await leserin.goto(`/wissen/${ko.id}`);
    const flaeche = leserin.getByTestId("verstaendnis-bereich");
    await expect(flaeche).toBeVisible({ timeout: 15_000 });
    await expect(flaeche.getByTestId("verstaendnis-bearbeitung")).toHaveCount(0);
    await expect(flaeche.getByTestId("verstaendnis-abgrenzung")).toContainText(
      "kein Kompetenz- oder Befähigungsnachweis",
    );
    await expect(flaeche.getByTestId("verstaendnis-regel")).toContainText(
      "Bestanden ab 1 von 1 richtig beantworteten Fragen.",
    );
    await flaeche.getByTestId("verstaendnis-beantworten").click();
    await flaeche
      .locator('[data-frage="f1"] [data-testid="verstaendnis-option"][data-option="o1"]')
      .check();
    await flaeche.getByTestId("verstaendnis-abgeben").click();

    const rueck = flaeche.getByTestId("verstaendnis-rueckmeldung");
    await expect(rueck).toBeVisible({ timeout: 15_000 });
    await expect(rueck.getByTestId("verstaendnis-ergebnis")).toHaveAttribute(
      "data-bestanden",
      "ja",
    );
    await expect(rueck.getByTestId("verstaendnis-ergebnis")).toContainText("1 von 1 richtig");
    const versuchId = await rueck.getAttribute("data-versuch");
    expect(versuchId).toBeTruthy();
    const sprung = rueck.getByTestId("verstaendnis-zur-stelle");
    const href = (await sprung.getAttribute("href")) ?? "";
    const ziel = new URL(href, "http://lokal");
    expect(ziel.pathname).toBe(`/wissen/${ko.id}`);
    expect(ziel.searchParams.get("fassung")).toBe("1");
    expect(ziel.searchParams.get("stelle")).toBe(beleg);
    await rueck.scrollIntoViewIfNeeded();
    await bild(leserin, "3-rueckmeldung-nach-abgabe");

    // Neuladen: dasselbe Ergebnis, dieselbe Rückmeldung erneut abrufbar.
    await leserin.reload();
    const nachher = leserin.getByTestId("verstaendnis-bereich");
    await expect(nachher).toBeVisible({ timeout: 15_000 });
    const eigenes = nachher.getByTestId("verstaendnis-eigenes");
    await expect(eigenes).toHaveCount(1);
    await expect(eigenes).toHaveAttribute("data-bestanden", "ja");
    await eigenes.getByTestId("verstaendnis-rueck-anzeigen").click();
    const wieder = nachher.getByTestId("verstaendnis-rueckmeldung");
    await expect(wieder).toBeVisible({ timeout: 15_000 });
    await expect(wieder).toHaveAttribute("data-versuch", versuchId ?? "");
    await expect(wieder.getByTestId("verstaendnis-ergebnis")).toHaveAttribute(
      "data-bestanden",
      "ja",
    );
    await wieder.scrollIntoViewIfNeeded();
    await bild(leserin, "4-rueckmeldung-nach-neuladen");

    // Der Sprung an die Belegstelle führt in die Wissensansicht derselben Fassung.
    await wieder.getByTestId("verstaendnis-zur-stelle").click();
    await expect(leserin).toHaveURL(/stelle=/, { timeout: 15_000 });
    await expect(leserin).toHaveURL(/fassung=1/);
    await bild(leserin, "5-belegstelle");
  } finally {
    await kontext.close();
  }
});
