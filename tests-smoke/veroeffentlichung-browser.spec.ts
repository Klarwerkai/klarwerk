import { type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// VERÖFFENTLICHUNG MIT BENACHRICHTIGUNGSWAHL IN DER ECHTEN APP (produkt:20261007:veroeffentlichungsoptionen).
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den Smoke-Server:
//   K1 · An einem gültigen Eintrag erklärt jede Wahl SOFORT Zustand, Sichtbarkeit und Empfänger —
//        es gibt keine Vorauswahl, der Knopf ist erst nach der Wahl frei.
//   K3 · „Hervorgehoben" erreicht eine Leserin in der vorhandenen Glocke: markiert und oben.
//   K4 · Die Leserin sieht dieselbe veröffentlichte Fassung und keine Veröffentlichungswahl.
//
// LÄUFT IM ISOLIERTEN KONTEXT (`chromium-zustand`, `playwright.smoke.config.ts`): der Fall legt ein
// zweites Konto und einen gültigen Eintrag an; im geteilten Bestand sähen andere Sonden beides.
// Jeder Lauf hat eigene Namen. Alle Inhalte und Konten sind erfundene Testdaten.
//
// WAS NICHT GEMESSEN IST: „still" und die Kenntnisnahme im Browser (Server- und Flächentests in
// `tests/veroeffentlichungsoptionen/`), und ob Menschen die Erklärung verstehen.

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

test("K1/K3/K4: die Wahl erklärt ihre Wirkung, „hervorgehoben“ erreicht die Leserin oben in der Glocke", async ({
  page,
  browser,
}) => {
  await ensureLoggedIn(page);
  const m = marke();
  const leserinName = `Lea Leserin ${m}`;
  const leserinMail = `lea-${m}@klarwerk.test`;
  const leserinPass = "Leserin-Passwort-1";

  const konto = await page.request.post("/api/users", {
    data: { name: leserinName, email: leserinMail, password: leserinPass, role: "viewer" },
  });
  expect(konto.status(), await konto.text()).toBe(201);

  const angelegt = await page.request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: `Schieberwartung ${m}`,
      statement: `Vor der Wartung ${m} wird der Absperrschieber geschlossen und gesichert.`,
      type: "best_practice",
      category: "Wartung",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const ko = (await angelegt.json()) as { id: string; title: string };
  const gueltig = await page.request.put(`/api/kos/${ko.id}`, {
    data: { action: "admin-validate" },
  });
  expect(gueltig.status(), await gueltig.text()).toBe(200);

  // ---- Die Freigebende: Wahl und Wirkung --------------------------------------------------------
  await page.goto(`/wissen/${ko.id}`);
  const bereich = page.getByTestId("veroeffentlichung-bereich");
  await expect(bereich).toBeVisible({ timeout: 15_000 });
  await expect(bereich.getByTestId("veroeffentlichung-stand")).toHaveText(
    "Noch nicht veröffentlicht.",
  );
  await expect(bereich.getByTestId("veroeffentlichung-wirkung")).toHaveCount(0);
  const knopf = bereich.getByTestId("veroeffentlichung-absenden");
  await expect(knopf).toBeDisabled();
  await bereich.scrollIntoViewIfNeeded();
  await bild(page, "1-vor-der-wahl");

  await bereich.locator('[data-testid="veroeffentlichung-wahl"][value="still"]').check();
  await expect(bereich.getByTestId("veroeffentlichung-wirkung-empfaenger")).toContainText(
    "Benachrichtigung: niemand.",
  );
  await expect(bereich.getByTestId("veroeffentlichung-wirkung-zustand")).toContainText(
    "Fassung V1 ist danach veröffentlicht (neue Veröffentlichung)",
  );
  await expect(bereich.getByTestId("veroeffentlichung-wirkung-sichtbarkeit")).toContainText(
    "Sichtbarkeit: unverändert",
  );

  await bereich.locator('[data-testid="veroeffentlichung-wahl"][value="hervorgehoben"]').check();
  const empfaenger = bereich.getByTestId("veroeffentlichung-wirkung-empfaenger");
  await expect(empfaenger).toContainText(leserinName);
  await expect(empfaenger).toContainText("Niemand bekommt dadurch zusätzliche Leserechte.");
  await expect(knopf).toHaveText("Fassung V1 veröffentlichen (Hervorgehoben)");
  await bild(page, "2-wirkung-hervorgehoben");

  await knopf.click();
  await expect(bereich.getByTestId("veroeffentlichung-erfolg")).toContainText(
    "Fassung V1 ist veröffentlicht.",
    { timeout: 15_000 },
  );
  await expect(bereich.getByTestId("veroeffentlichung-stand")).toContainText(
    "Veröffentlicht: Fassung V1 am",
  );
  await expect(bereich.getByTestId("veroeffentlichung-stand")).toContainText(SMOKE_NAME);
  await expect(bereich.getByTestId("veroeffentlichung-verlauf-zeile").first()).toHaveAttribute(
    "data-meldung",
    "hervorgehoben",
  );
  await bild(page, "3-veroeffentlicht");

  // ---- Die Leserin: Glocke und Lesefläche ------------------------------------------------------
  // Der eigene Kontext erbt die Projektadresse nicht von selbst; ohne gesetzte Adresse bleibt sie weg
  // (exactOptionalPropertyTypes: `undefined` ist kein zulässiger Wert).
  const projektAdresse = test.info().project.use.baseURL;
  const leserinKontext = await browser.newContext(
    projektAdresse === undefined ? {} : { baseURL: projektAdresse },
  );
  try {
    const leserin = await leserinKontext.newPage();
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

    await leserin.getByTestId("kopfband-meldungen").click();
    const erste = leserin.getByTestId("meldung-oeffnen").first();
    await expect(erste).toHaveAttribute("data-art", "veroeffentlichung", { timeout: 15_000 });
    await expect(erste).toContainText("Wichtig · Neu veröffentlicht (V1):");
    await expect(erste).toContainText(ko.title);
    await bild(leserin, "4-glocke-der-leserin");

    await erste.click();
    await expect(leserin).toHaveURL(new RegExp(`/wissen/${ko.id}`), { timeout: 15_000 });
    const lesen = leserin.getByTestId("veroeffentlichung-bereich");
    await expect(lesen).toBeVisible({ timeout: 15_000 });
    await expect(lesen.getByTestId("veroeffentlichung-stand")).toContainText(
      "Veröffentlicht: Fassung V1 am",
    );
    await expect(lesen.getByTestId("veroeffentlichung-aktuell")).toHaveText(
      "Die aktuelle Fassung V1 ist die veröffentlichte.",
    );
    await expect(lesen.getByTestId("veroeffentlichung-wahl")).toHaveCount(0);
    await lesen.scrollIntoViewIfNeeded();
    await bild(leserin, "5-leseflaeche-der-leserin");
  } finally {
    await leserinKontext.close();
  }
});
