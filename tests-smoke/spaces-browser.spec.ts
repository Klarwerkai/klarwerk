import { type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// SPACES IN DER ECHTEN APP — anlegen, bearbeiten, Artikel per Rechtevorschau hineinlegen, Ansicht.
// ================================================================================================
//
// Geklickt wird der ganze Weg im echten Browser gegen den echten Smoke-Server (produkt:20261007:spaces):
//   K1 · Space mit Zweck, Zuständigkeit und Ansicht auf `/spaces` anlegen; nach dem Neuladen steht
//        er da; bearbeiten erzeugt Fassung 2 im Verlauf.
//   K4 · Auf der Artikelseite den Space wechseln: erst die Rechtewirkung, dann die Übernahme —
//        Fassung und Historie bleiben (Server bestätigt es in der Meldung und in der Vorschau).
//   K5 · Die Spacezeile nennt Spacezuständigkeit und Artikelverantwortung als getrennte Angaben.
//   K2 · Derselbe Artikel (Kennung + Fassung) erscheint im Space und in dessen gespeicherter Ansicht.
//   K3 · Klara nennt den tatsächlichen Spacekontext des Artikels.
//
// JEDER LAUF HAT SEINE EIGENEN NAMEN: der Smoke-Server hält seinen Bestand im Speicher über alle
// Fälle und Wiederholungen. Alle Inhalte sind erfundene Testdaten.
//
// WAS NICHT GEMESSEN IST: mehrere echte Menschen mit verschiedenen Rechten. Die Smoke-Suite kennt
// genau ein Konto (Admin). Die Rechtewirkung für Mitglieder/Nichtmitglieder misst
// `tests/spaces/spaces-api.test.ts` am Draht.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function spaceAnlegen(page: Page, name: string, tag: string): Promise<void> {
  await page.goto("/spaces");
  await expect(page.getByTestId("page-spaces")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("space-neu").click();
  await page.getByTestId("space-name").fill(name);
  await page.getByTestId("space-zweck").fill(`Prüfmittel der ${name}.`);
  await page.getByTestId("space-verantwortlich").selectOption({ label: SMOKE_NAME });
  await page.getByTestId("space-zugang").selectOption("mitglieder");
  await page.getByTestId("space-ansicht-hinzu").click();
  await page.getByTestId("space-ansicht-name").fill("Prüfmittel");
  await page.getByTestId("space-ansicht-tag").fill(tag);
  await page.getByTestId("space-speichern").click();
  await expect(page.getByTestId("space-pflege")).toHaveCount(0, { timeout: 15_000 });
}

test.describe("Spaces · der Weg in der echten App", () => {
  test("K1: Space anlegen, neu laden, bearbeiten — Fassung 2 im Verlauf", async ({ page }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const name = `Werkstatt ${m}`;
    await spaceAnlegen(page, name, `pm${m}`);

    await page.reload();
    const karte = page.getByTestId("space-eintrag").filter({ hasText: name });
    await expect(karte, "der Space hat das Neuladen nicht überlebt").toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(karte).toContainText(`Prüfmittel der ${name}.`);
    await expect(karte.getByTestId("space-zustaendig")).toContainText(SMOKE_NAME);

    await karte.getByTestId("space-oeffnen").click();
    await expect(page.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("space-bearbeiten").click();
    await page.getByTestId("space-zweck").fill(`Prüfmittel und Kalibrierung der ${name}.`);
    await page.getByTestId("space-speichern").click();
    await expect(page.getByTestId("space-pflege")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("space-zweck-anzeige")).toContainText("Kalibrierung");
    await page.getByTestId("space-verlauf-knopf").click();
    await expect(page.getByTestId("space-fassung")).toHaveCount(2);
  });

  test("K4/K5/K2/K3: Artikel per Rechtevorschau in den Space legen, dort und in der Ansicht finden", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const name = `Werkstatt ${m}`;
    const tag = `pm${m}`;
    await spaceAnlegen(page, name, tag);

    const angelegt = await page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Messplatz ${m}`,
        statement: `Der Messplatz ${m} wird vor jeder Schicht geprüft.`,
        type: "best_practice",
        category: "Prüfmittel",
        tags: [tag],
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const ko = (await angelegt.json()) as { id: string; version: number };

    await page.goto(`/wissen/${ko.id}`);
    const zeile = page.getByTestId("space-zeile");
    await expect(zeile).toBeVisible({ timeout: 15_000 });
    await expect(zeile.getByTestId("space-zeile-space")).toContainText("Kein Space");
    await expect(zeile.getByTestId("space-zeile-verantwortung")).toContainText(SMOKE_NAME);

    await zeile.getByTestId("space-zeile-ziel").selectOption({ label: name });
    await zeile.getByTestId("space-zeile-vorschau").click();
    const vorschau = zeile.getByTestId("space-vorschau");
    await expect(vorschau).toBeVisible({ timeout: 15_000 });
    await expect(vorschau).toContainText("Rechtewirkung vor der Übernahme");
    await expect(vorschau.getByTestId("space-vorschau-verlieren")).toBeVisible();
    await expect(vorschau.getByTestId("space-vorschau-bleibt")).toContainText(
      `Fassung ${ko.version}`,
    );
    // Vor der Übernahme ist noch nichts geschehen.
    await expect(zeile.getByTestId("space-zeile-space")).toContainText("Kein Space");

    await zeile.getByTestId("space-zeile-uebernehmen").click();
    await expect(zeile.getByTestId("space-zeile-meldung")).toContainText(
      "Fassung und Historie sind unverändert",
      { timeout: 15_000 },
    );
    await expect(zeile.getByTestId("space-zeile-space")).toContainText(name);
    // K5: zwei getrennte Angaben — Spacezuständigkeit und Artikelverantwortung.
    await expect(zeile.getByTestId("space-zeile-zustaendig")).toContainText(SMOKE_NAME);
    await expect(zeile.getByTestId("space-zeile-verantwortung")).toBeVisible();

    // Der Server bestätigt: dieselbe Fassung, derselbe Autor.
    const nachher = (await (await page.request.get(`/api/kos/${ko.id}`)).json()) as {
      version: number;
      spaceId?: string;
    };
    expect(nachher.version).toBe(ko.version);

    // K3: Klara kennt den tatsächlichen Spacekontext dieses Artikels.
    await page.locator('button[data-klara="1"]').click();
    await expect(page.getByTestId("klara-space-kontext")).toContainText(name, {
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");

    // K2: derselbe Artikel im Space und in der gespeicherten Ansicht.
    await zeile.getByTestId("space-zeile-space").getByRole("link", { name }).click();
    await expect(page.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
    const imSpace = page.locator(`[data-testid="space-artikel"][data-ko="${ko.id}"]`);
    await expect(imSpace).toHaveCount(1, { timeout: 15_000 });
    await expect(imSpace).toHaveAttribute("data-version", String(ko.version));
    await page.getByTestId("space-reiter-ansicht").click();
    const inAnsicht = page.locator(`[data-testid="space-artikel"][data-ko="${ko.id}"]`);
    await expect(inAnsicht).toHaveCount(1, { timeout: 15_000 });
    await expect(inAnsicht).toHaveAttribute("data-version", String(ko.version));
    await expect(page.getByText("Ansicht „Prüfmittel“")).toBeVisible();
  });

  // Nacharbeit 3 (Ben, K4): während eine Vorschau für Ziel A noch unterwegs ist, wählt der Mensch
  // Ziel B. Die verspätete Antwort für A darf weder angezeigt noch übernommen werden; übernommen
  // wird genau das Ziel, dessen Rechtewirkung zuletzt angezeigt wurde.
  test("K4: eine verspätete Vorschau für ein abgewähltes Ziel wird verworfen", async ({ page }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const spaceA = `Ziel A ${m}`;
    const spaceB = `Ziel B ${m}`;
    await spaceAnlegen(page, spaceA, `pa${m}`);
    await spaceAnlegen(page, spaceB, `pb${m}`);

    const angelegt = await page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Zielwechsel ${m}`,
        statement: `Der Zielwechsel ${m} wird geprüft.`,
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const ko = (await angelegt.json()) as { id: string };

    let erste = true;
    await page.route("**/api/spaces/verschiebung/vorschau", async (route) => {
      if (erste) {
        erste = false;
        await new Promise((fertig) => setTimeout(fertig, 2_000));
      }
      await route.continue();
    });

    await page.goto(`/wissen/${ko.id}`);
    const zeile = page.getByTestId("space-zeile");
    await expect(zeile).toBeVisible({ timeout: 15_000 });
    const auswahl = zeile.getByTestId("space-zeile-ziel");
    await auswahl.selectOption({ label: spaceA });
    const antwortA = page.waitForResponse("**/api/spaces/verschiebung/vorschau");
    await zeile.getByTestId("space-zeile-vorschau").click();
    // Noch während die Vorschau für A unterwegs ist: Ziel B wählen.
    await auswahl.selectOption({ label: spaceB });
    await antwortA;
    // Der Prüfknopf ist während der laufenden Vorschau gesperrt; frei wird er erst, nachdem die
    // Antwort für A verarbeitet ist — erst danach sagt „keine Vorschau sichtbar" etwas aus.
    await expect(zeile.getByTestId("space-zeile-vorschau")).toBeEnabled({ timeout: 15_000 });
    await expect(zeile.getByTestId("space-vorschau")).toHaveCount(0);
    await expect(zeile.getByTestId("space-zeile-uebernehmen")).toHaveCount(0);

    await zeile.getByTestId("space-zeile-vorschau").click();
    const vorschau = zeile.getByTestId("space-vorschau");
    await expect(vorschau).toContainText(`Nach: ${spaceB}`, { timeout: 15_000 });
    await expect(vorschau).not.toContainText(spaceA);
    await zeile.getByTestId("space-zeile-uebernehmen").click();
    await expect(zeile.getByTestId("space-zeile-meldung")).toContainText(
      "Fassung und Historie sind unverändert",
      { timeout: 15_000 },
    );
    await expect(zeile.getByTestId("space-zeile-space")).toContainText(spaceB);
    await expect(zeile.getByTestId("space-zeile-space")).not.toContainText(spaceA);
  });
});
