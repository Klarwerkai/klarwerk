import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// WISSENSPROJEKT (SPACE) LÖSCHEN IN DER ECHTEN APP — erst die Folgen, dann die Löschung.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensprojekte` (K1, Originalpunkt `package:projekte`).
// Geklickt wird auf `/spaces/:id` gegen den echten Smoke-Server:
//   · Trägt noch ein Artikel den Space, nennt die Löschvorschau ihn mit Titel und Verweis, und der
//     Bestätigungsknopf ist gesperrt — vor der Löschung ist sichtbar, was mit Artikeln geschähe.
//   · Ist der Artikel hinausverschoben (gewöhnlicher Spacewechsel mit Rechtevorschau), sagt die
//     Vorschau „kein Artikel betroffen“; die Löschung führt zur Übersicht ohne den Space, und der
//     Artikel ist mit derselben Fassung weiter erreichbar.
//
// Der Spacewechsel läuft hier über den Draht, nicht über die Spacezeile — den geklickten Wechsel
// misst `spaces-browser.spec.ts`. Die Rechte mehrerer Konten misst `tests/wissensprojekte/
// space-loeschen.test.ts`; die Smoke-Suite kennt genau ein Konto (Admin). Alle Inhalte sind
// erfundene Testdaten; jeder Lauf hat eigene Namen.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function wechsel(request: APIRequestContext, koId: string, zielSpaceId: string | null) {
  const v = await request.post("/api/spaces/verschiebung/vorschau", {
    data: { koId, zielSpaceId },
  });
  expect(v.status(), await v.text()).toBe(200);
  const vj = (await v.json()) as {
    quelle: { id: string; version: number } | null;
    ziel: { id: string; version: number } | null;
    grundlage: string;
  };
  const res = await request.post("/api/spaces/verschiebung", {
    data: {
      koId,
      zielSpaceId,
      basis: {
        quelleId: vj.quelle?.id ?? null,
        quelleVersion: vj.quelle?.version ?? null,
        zielId: vj.ziel?.id ?? null,
        zielVersion: vj.ziel?.version ?? null,
        grundlage: vj.grundlage,
      },
    },
  });
  expect(res.status(), await res.text()).toBe(200);
}

async function loeschvorschauOeffnen(page: Page, spaceId: string): Promise<void> {
  await page.goto(`/spaces/${spaceId}`);
  await expect(page.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("space-loeschen-knopf").click();
  await expect(page.getByTestId("space-loeschen-folgen")).toBeVisible({ timeout: 15_000 });
}

test.describe("Wissensprojekte · Space löschen in der echten App", () => {
  test("K1: Folgen vorab, gesperrt solange ein Artikel ihn trägt, danach gelöscht", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const name = `Altprojekt ${m}`;

    const konten = (await (await page.request.get("/api/spaces/konten")).json()) as {
      konten: { id: string; name: string }[];
    };
    const ich = konten.konten.find((k) => k.name === SMOKE_NAME);
    expect(ich, "das Smoke-Konto steht in der Kontenliste").toBeDefined();
    const angelegt = await page.request.post("/api/spaces", {
      data: {
        name,
        zweck: `Abgeschlossenes Projekt ${m}.`,
        verantwortlich: ich?.id,
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [{ name: "Prüfstände", tag: `ps${m}` }],
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const space = (await angelegt.json()) as { id: string };

    const artikel = await page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Prüfstand ${m}`,
        statement: `Der Prüfstand ${m} wird vor jeder Schicht kalibriert.`,
        type: "best_practice",
        category: "Prüfmittel",
        tags: [`ps${m}`],
      },
    });
    expect(artikel.status(), await artikel.text()).toBe(201);
    const ko = (await artikel.json()) as { id: string; version: number };
    await wechsel(page.request, ko.id, space.id);

    // Mit Artikel: die Folgen stehen da, der Artikel ist genannt, Löschen ist gesperrt.
    await loeschvorschauOeffnen(page, space.id);
    const karte = page.getByTestId("space-loeschen");
    await expect(karte.getByTestId("space-loeschen-folgen")).toContainText("1 gespeicherten");
    await expect(karte.getByTestId("space-loeschen-gesperrt")).toContainText(
      "Löschen ist erst möglich",
    );
    const genannt = karte.locator(`[data-testid="space-loeschen-artikel"][data-ko="${ko.id}"]`);
    await expect(genannt).toContainText(`Prüfstand ${m}`);
    await expect(karte.getByTestId("space-loeschen-bestaetigen")).toBeDisabled();

    // Artikel hinaus — danach betrifft die Löschung keinen Artikel mehr.
    await wechsel(page.request, ko.id, null);
    await loeschvorschauOeffnen(page, space.id);
    await expect(page.getByTestId("space-loeschen-leer")).toContainText("Kein Artikel");
    await page.getByTestId("space-loeschen-bestaetigen").click();

    await expect(page).toHaveURL(/\/spaces\?geloescht=1$/, { timeout: 15_000 });
    await expect(page.getByTestId("space-geloescht")).toBeVisible();
    await expect(page.getByTestId("space-eintrag").filter({ hasText: name })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("space-eintrag").filter({ hasText: name })).toHaveCount(0, {
      timeout: 15_000,
    });

    // Der Space ist weg, der Artikel nicht — dieselbe Fassung, ohne Space.
    expect((await page.request.get(`/api/spaces/${space.id}`)).status()).toBe(404);
    const nachher = (await (await page.request.get(`/api/kos/${ko.id}`)).json()) as {
      version: number;
      spaceId?: string;
    };
    expect(nachher.version).toBe(ko.version);
    expect(nachher.spaceId).toBeUndefined();
  });
});
