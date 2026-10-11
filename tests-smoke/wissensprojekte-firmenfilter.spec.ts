import { expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// FIRMENFILTER IN DER ECHTEN APP — Partnerbereich anlegen, im Filter finden, Kontexte getrennt.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensprojekte` (K1, „Firmen- und Projektfilter stimmen“;
// Pedis Entscheidung Frage 51). Geklickt wird auf `/spaces`: ein Partnerbereich wird über das
// Formular angelegt (der Zugang ist dabei fest „nur Mitglieder“), ein Artikel kommt per Spacewechsel
// hinein, und der Firmenfilter zeigt ihn unter „Partnerbereich“, nicht unter „Öffentliche Quellen“.
//
// Die Smoke-Suite kennt ein Konto (Admin, hier zuständig). Erlaubte und NICHT erlaubte
// Partnerinhalte für verschiedene Konten misst `tests/wissensprojekte/firmenfilter.test.ts`.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

test.describe("Wissensprojekte · Firmenfilter in der echten App", () => {
  test("K1: Partnerbereich anlegen und im Firmenfilter getrennt von öffentlichen Quellen finden", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const name = `Projekt Partner ${m}`;
    const partner = `Partner ${m} GmbH`;

    await page.goto("/spaces");
    await page.getByTestId("space-neu").click();
    await page.getByTestId("space-name").fill(name);
    await page.getByTestId("space-zweck").fill(`Gemeinsame Arbeit mit ${partner}.`);
    await page.getByTestId("space-verantwortlich").selectOption({ label: SMOKE_NAME });
    await page.getByTestId("space-kontext").selectOption("partner");
    await page.getByTestId("space-partner").fill(partner);
    await expect(page.getByTestId("space-zugang")).toBeDisabled();
    await expect(page.getByTestId("space-zugang")).toHaveValue("mitglieder");
    await expect(page.getByTestId("space-kontext-hinweis")).toContainText(
      "ausdrücklich berechtigte",
    );
    await page.getByTestId("space-speichern").click();
    await expect(page.getByTestId("space-pflege")).toHaveCount(0, { timeout: 15_000 });

    const karte = page.getByTestId("space-eintrag").filter({ hasText: name });
    await expect(karte.getByTestId("space-kontext-anzeige")).toContainText(partner);
    const spaceId = await karte.getAttribute("data-space");
    expect(spaceId).toBeTruthy();

    const angelegt = await page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Abstimmung ${m}`,
        statement: `Die Abstimmung ${m} mit ${partner} gilt ab sofort.`,
        type: "best_practice",
        category: "Prüfmittel",
        tags: [`fp${m}`],
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const ko = (await angelegt.json()) as { id: string };
    const v = await page.request.post("/api/spaces/verschiebung/vorschau", {
      data: { koId: ko.id, zielSpaceId: spaceId },
    });
    expect(v.status(), await v.text()).toBe(200);
    const vj = (await v.json()) as { ziel: { id: string; version: number } };
    const wechsel = await page.request.post("/api/spaces/verschiebung", {
      data: {
        koId: ko.id,
        zielSpaceId: spaceId,
        basis: {
          quelleId: null,
          quelleVersion: null,
          zielId: vj.ziel.id,
          zielVersion: vj.ziel.version,
        },
      },
    });
    expect(wechsel.status(), await wechsel.text()).toBe(200);

    // Firmenfilter: Partnerbereich zeigt den Artikel, öffentliche Quellen nicht.
    await page.goto("/spaces");
    await page.locator('[data-testid="space-filter-kontext"][data-kontext="partner"]').click();
    const imPartner = page
      .getByTestId("space-kontext-artikel")
      .locator(`[data-testid="space-artikel"][data-ko="${ko.id}"]`);
    await expect(imPartner).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("space-eintrag").filter({ hasText: name })).toHaveCount(1);

    // Erst die Serverantwort des öffentlichen Filters abwarten — sonst wäre „nicht da“ nur „noch nicht
    // geladen“.
    const oeffentlich = page.waitForResponse(
      (r) => r.url().includes("/api/spaces/artikel?kontext=oeffentlich") && r.status() === 200,
    );
    await page.locator('[data-testid="space-filter-kontext"][data-kontext="oeffentlich"]').click();
    await oeffentlich;
    await expect(page.getByTestId("space-kontext-artikel")).toHaveAttribute(
      "data-kontext",
      "oeffentlich",
    );
    await expect(page.locator(`[data-testid="space-artikel"][data-ko="${ko.id}"]`)).toHaveCount(0);
    await expect(page.getByTestId("space-eintrag").filter({ hasText: name })).toHaveCount(0);
  });
});
