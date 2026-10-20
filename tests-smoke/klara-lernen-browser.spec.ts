import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

async function funktionen(page: Page) {
  await page.goto("/profil?bereich=funktionen");
  await expect(page.getByTestId("vormachen-flaeche")).toBeVisible();
}

async function bericht(page: Page, quellen: string[], titel: string, text: string) {
  for (const id of quellen) {
    const gelesen = page.waitForResponse(
      (r) => r.url().includes(`/api/kos/${id}`) && r.request().method() === "GET",
    );
    await page.goto(`/wissen/${id}`);
    expect((await gelesen).status()).toBe(200);
  }
  await page.goto("/capture/frontdoor");
  await page.getByTestId("blatt-titel").fill(titel);
  await page.locator('[data-testid="blatt-text"] [contenteditable="true"]').fill(text);
  await page.getByTestId("blatt-werkzeug-vertraulichkeit").click();
  await page.getByRole("menuitem", { name: "Öffentlich-intern" }).click();
  const gespeichert = page.waitForResponse(
    (r) => r.url().endsWith("/api/drafts") && r.request().method() === "POST",
  );
  await page.getByTestId("blatt-entwurf-sichern").click();
  const antwort = await gespeichert;
  expect(antwort.status()).toBe(201);
  return (await antwort.json()).id as string;
}

test("H · zwei echte Vorführungen, geänderte Wiederholung, Pause und Beschaffungsfunktion", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await ensureLoggedIn(page);
  const quellen: string[] = [];
  for (const [title, statement] of [
    ["H Testprojekt Nord", "Fiktive Menge 20 Einheiten, Lieferung am 30.11.2026."],
    ["H Testzeitraum Oktober", "Fiktiver Zeitraum Oktober, eigener Testbericht."],
  ]) {
    const antwort = await page.request.post("/api/kos", {
      data: {
        title,
        statement,
        confidentiality: "intern",
        type: "best_practice",
        category: "Bericht",
      },
    });
    expect(antwort.status()).toBe(201);
    const id = (await antwort.json()).id;
    const frei = await page.request.put(`/api/kos/${id}`, { data: { action: "admin-validate" } });
    expect(frei.status()).toBe(200);
    quellen.push(id);
  }
  await funktionen(page);
  await page.getByTestId("vormachen-vorgang-quelle_lesen").check();
  await page.getByTestId("vormachen-vorgang-entwurf_anlegen").check();
  await page.getByTestId("vormachen-zweck").fill("Eigenen Bericht aus zwei Quellen erstellen");
  await page.getByTestId("vormachen-starten").click();
  await expect(page.getByTestId("vormachen-anzeige")).toHaveAttribute("data-zustand", "lernt");
  const a = await bericht(
    page,
    quellen,
    "H Bericht Nord Oktober",
    "Nord im Oktober: 20 Einheiten. Eigene Testdaten.",
  );
  const b = await bericht(
    page,
    quellen,
    "H Bericht Süd November",
    "Süd im November: 30 Einheiten. Eigene Testdaten.",
  );
  await funktionen(page);
  await page.getByTestId("vormachen-vorschau-laden").click();
  await expect(page.getByTestId("vormachen-ableitung")).toContainText("2");
  await info.attach("parametrisierte-vorschau", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  const notiz = await (await page.request.get("/api/me/vormachen")).json();
  expect(notiz.routinen).toEqual([]);
  await page.getByTestId("vormachen-bestaetigen").click();
  await expect(page.getByTestId("routine-lauf")).toBeVisible();
  await page.getByTestId("routine-lauf-titel").fill("H geänderter Folgebericht Dezember");
  await page
    .getByTestId("routine-lauf-inhalt")
    .fill("Dezember: 47 Einheiten im eigenen Folgeprojekt.");
  const eingaben = page.locator('[data-testid^="routine-lauf-eingabe-"]');
  for (let i = 0; i < (await eingaben.count()); i++) {
    await eingaben.nth(i).fill(quellen[i % quellen.length]);
  }
  await page.getByTestId("routine-lauf-ausfuehren").click();
  await expect(page.getByTestId("routine-lauf-ergebnis-link")).toBeVisible();
  await page.getByTestId("routine-lauf-ergebnis-link").click();
  await expect(page.getByTestId("blatt-titel")).toHaveValue("H geänderter Folgebericht Dezember");
  await expect(page.locator('[data-testid="blatt-text"] [contenteditable="true"]')).toContainText(
    "Dezember: 47 Einheiten im eigenen Folgeprojekt.",
  );
  await page.reload();
  await expect(page.getByTestId("blatt-titel")).toHaveValue("H geänderter Folgebericht Dezember");
  await expect(page.locator('[data-testid="blatt-text"] [contenteditable="true"]')).toContainText(
    "Dezember: 47 Einheiten im eigenen Folgeprojekt.",
  );
  await funktionen(page);
  await page.getByTestId("routine-lauf-pause").click();
  await expect(page.getByTestId("routine-lauf-ausfuehren")).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId("routine-lauf-ausfuehren")).toBeDisabled();
  await page
    .getByTestId("funktion-satz")
    .fill("So möchte ich künftig Angebote für 500 Stück Verpackung zum 30.11.2026 einholen.");
  // Dieser neue Beschaffungsfall stammt aus dem Satz, nicht aus dem vorherigen Berichtsgespräch.
  await page.getByTestId("funktion-aus-gespraech").uncheck();
  await page.getByTestId("funktion-entwurf").click();
  await expect(page.getByTestId("funktion-beispielwerte")).toContainText("500");
  await page.getByTestId("funktion-speichern").click();
  await expect(page.getByTestId("funktion-offen")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("funktion-offen")).toBeVisible();
  await info.attach("gemeinsame-funktionen", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  const funk = await (await page.request.get("/api/me/funktionen")).json();
  const beschaffung = funk.funktionen[0];
  expect(beschaffung.laeufe).toEqual([]);
  expect(beschaffung.zeitauftrag).toBeNull();
  await info.attach("tatsaechliche-ergebnisse", {
    body: JSON.stringify({
      vorfuehrungen: [a, b],
      quellen,
      beschaffung: beschaffung.id,
      nativerLernlauf: false,
      sprachbedienung: false,
    }),
    contentType: "application/json",
  });
});
