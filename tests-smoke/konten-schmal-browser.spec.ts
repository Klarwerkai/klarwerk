import { type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// N-0025 · DIE SCHMALE KONTENLISTE IM ECHTEN BROWSER (aufnahme:20260922:gesamt-nutzerverwaltung)
// ================================================================================================
//
// Der Befund (live 05./06.09.2026, v1.0.0-beta.1.111/.119, 390×844): Bereichsnavigation und
// Kontenliste standen nebeneinander, der Namens-Span hatte 0 px Breite bei 87/103 px Textbreite
// (`overflow:hidden`); sichtbar blieb nur „Administrator". Vorschlag: „Auf schmalen Ansichten die
// Bereichsauswahl über dem Inhalt anordnen; Namen und Rolle pro Konto untereinander mit
// ausreichend Breite zeigen."
//
// Der Quellstand trägt dafür heute zwei Verträge, die hier an der Kontenliste nachgemessen werden:
//   · `components/einstellungen/Seite.tsx` (JOB 3155): unterhalb von `sm` steht die Reiterleiste
//     ÜBER dem Inhalt, der Inhalt bekommt die volle Breite.
//   · `components/einstellungen/Zeilenkarte.tsx` (JOB 3117): nichts wird gekürzt; reicht die Breite
//     nicht, rückt der Wert (Rolle) UNTER die Beschriftung (Kontoname).
// `tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts` misst die Reiterleiste
// und das Rollenraster, aber keine Kontozeile — diese Lücke schließt diese Datei.
//
// NUR LESEND: der Smoke-Server teilt seinen Bestand über alle Sonden. Fall 1 misst das echte
// Ersteinrichtungskonto. Fall 2 braucht einen Namen, der bei 390 px nicht neben die Rolle passt;
// er wird NUR in der Antwort von `GET /api/users` für diese eine Seite ergänzt (Kopie des echten
// Eintrags, eigene Kennung) — am Server entsteht kein Konto. Gemessen wird damit das Layout, nicht
// die Kontenanlage; die belegen `tests/app/wp4-admin-create-user.test.ts` und
// `tests/audit-gesamt/aktionsmatrix-12-3.test.ts`.

const SCHMAL = { width: 390, height: 844 } as const;
const LANGER_NAME = "Maximiliane Hohenstein-Kowalczyk-Brandenburger";
const ZEILE = 'button[data-einst="zeile"]';

interface Zeilenmass {
  name: string;
  labelBreite: number;
  labelScroll: number;
  labelOben: number;
  labelRechts: number;
  wertText: string;
  wertBreite: number;
  wertOben: number;
}

async function kontenzeilenMessen(page: Page): Promise<Zeilenmass[]> {
  return page.evaluate((zeileSel) => {
    const zeilen = document.querySelectorAll<HTMLElement>(
      `[data-testid="flaeche-nutzer"] ${zeileSel}`,
    );
    return [...zeilen].map((zeile) => {
      const label = zeile.querySelector<HTMLElement>('[data-einst="label"]');
      const wert = zeile.querySelector<HTMLElement>('[data-einst="wert"]');
      const l = label?.getBoundingClientRect();
      const w = wert?.getBoundingClientRect();
      return {
        name: (label?.textContent ?? "").trim(),
        labelBreite: l?.width ?? 0,
        labelScroll: label?.scrollWidth ?? 0,
        labelOben: l?.top ?? 0,
        labelRechts: l?.right ?? 0,
        wertText: (wert?.textContent ?? "").trim(),
        wertBreite: w?.width ?? 0,
        wertOben: w?.top ?? 0,
      };
    });
  }, ZEILE);
}

async function seitenBreite(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/** Name und Rolle stehen vollständig im Bild: nicht 0 px, nicht abgeschnitten, nicht rechts raus. */
function namePruefen(z: Zeilenmass): void {
  const ungekuerzt = Math.ceil(z.labelBreite) + 1;
  expect(z.labelBreite, `Kontoname „${z.name}“ hat 0 px`).toBeGreaterThan(0);
  expect(z.labelScroll, `Kontoname „${z.name}“ ist abgeschnitten`).toBeLessThanOrEqual(ungekuerzt);
  expect(z.labelRechts, `Kontoname „${z.name}“ ragt rechts hinaus`).toBeLessThanOrEqual(
    SCHMAL.width,
  );
  expect(z.wertText).toContain("Administrator");
  expect(z.wertBreite, `Rolle zu „${z.name}“ hat 0 px`).toBeGreaterThan(0);
}

async function kontenSchmalOeffnen(page: Page): Promise<void> {
  await page.setViewportSize(SCHMAL);
  await ensureLoggedIn(page);
  await page.goto("/admin?bereich=konten");
  await expect(page.getByTestId("page-admin")).toBeVisible({ timeout: 15_000 });
  const ersteZeile = page.getByTestId("flaeche-nutzer").locator(ZEILE).first();
  await expect(ersteZeile).toBeVisible({ timeout: 15_000 });
}

test.describe("N-0025 · Kontenliste bei 390 px", () => {
  test("N-0025 · 390×844: Bereichsauswahl über der Kontenliste, Name und Rolle vollständig sichtbar", async ({
    page,
  }) => {
    await kontenSchmalOeffnen(page);

    const lage = await page.evaluate(() => {
      const reiter = document.querySelector('[data-einst="reiterspalte"]');
      const spalte = document.querySelector('[data-einst="spalte"]');
      return {
        reiterUnten: reiter?.getBoundingClientRect().bottom ?? Number.NaN,
        spalteOben: spalte?.getBoundingClientRect().top ?? Number.NaN,
        spalteBreite: spalte?.getBoundingClientRect().width ?? 0,
      };
    });
    const ueber = "die Bereichsauswahl steht nicht über dem Inhalt";
    expect(lage.reiterUnten, ueber).toBeLessThanOrEqual(lage.spalteOben);
    const breit = "die Kontenliste bekommt nicht die Breite";
    expect(lage.spalteBreite, breit).toBeGreaterThanOrEqual(SCHMAL.width * 0.75);
    expect(await seitenBreite(page), "seitlicher Überlauf").toBeLessThanOrEqual(SCHMAL.width);

    const zeilen = await kontenzeilenMessen(page);
    const eigene = zeilen.find((z) => z.name === SMOKE_NAME);
    expect(eigene, `Zeile „${SMOKE_NAME}“ fehlt: ${JSON.stringify(zeilen)}`).toBeDefined();
    if (eigene) {
      namePruefen(eigene);
    }

    // Der Name ist nicht nur gezeichnet, sondern gezielt wählbar: die Zeile öffnet genau dieses Konto.
    await page.getByTestId("flaeche-nutzer").locator(ZEILE, { hasText: SMOKE_NAME }).click();
    await expect(page.getByTestId("detail-nutzer")).toContainText(SMOKE_NAME, { timeout: 10_000 });
  });

  test("N-0025 · 390×844: ein langer Kontoname wird nicht gekürzt, die Rolle rückt darunter", async ({
    page,
  }) => {
    await page.route(/\/api\/users(\?.*)?$/, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const antwort = await route.fetch();
      const liste = (await antwort.json()) as Record<string, unknown>[];
      const vorlage = liste[0];
      const zusatz = vorlage
        ? [{ ...vorlage, id: "n0025-nur-im-browser", name: LANGER_NAME, email: "n0025@x.test" }]
        : [];
      await route.fulfill({ response: antwort, json: [...liste, ...zusatz] });
    });
    await kontenSchmalOeffnen(page);

    const zeilen = await kontenzeilenMessen(page);
    const lang = zeilen.find((z) => z.name === LANGER_NAME);
    expect(lang, `Zeile mit langem Namen fehlt: ${JSON.stringify(zeilen)}`).toBeDefined();
    if (lang) {
      namePruefen(lang);
      const darunter = "die Rolle steht nicht unter dem langen Namen";
      expect(lang.wertOben, darunter).toBeGreaterThan(lang.labelOben);
    }
    expect(await seitenBreite(page), "seitlicher Überlauf").toBeLessThanOrEqual(SCHMAL.width);
  });
});
