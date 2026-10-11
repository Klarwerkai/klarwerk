import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-10 · QUALITÄTSAUFGABEN UND RÜCKMELDUNGEN IN DER ECHTEN APP — Bedienbeleg, Tastatur, 390 px.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben. Geklickt wird im echten Browser gegen den echten
// Smoke-Server; die Bilder hängen am nativen Bericht. Alle Titel sind erfundene Testdaten, jeder
// Lauf hat eigene Namen.
//
//   Lieferbeleg · Verwaltung → „Alle Qualitätsaufgaben" → Revalidierung filtern → Bearbeiten öffnet
//                 genau diesen Fall im Lebenszyklus → Zurück: Filter stehen noch → Rückmeldung als
//                 Aufgabe übernehmen → derselbe Vorgang trägt sie, kein zweiter Eintrag.
//   K6          · 390 × 844 und 1280 × 800: ohne Überbreite, Filter und Arbeitsweg per Tastatur
//                 erreichbar, sichtbarer Fokus, hin und zurück.
//
// WAS HIER NICHT GEMESSEN IST: ein zweites Verwaltungskonto im Browser (die Smoke-Suite kennt
// genau ein Admin-Konto; der Mehrbenutzerfall steht am Draht in
// `tests/admin-qualitaetsaufgaben/qualitaetsaufgaben-api.test.ts`) und ein unvertrauter Mensch.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

/** Ein freigegebener Beitrag — nur daraus antwortet der Frageweg. */
async function freigegeben(request: APIRequestContext, titel: string): Promise<string> {
  const angelegt = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} gilt nur für diese erfundene Prüfung.`,
      type: "best_practice",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const id = ((await angelegt.json()) as { id: string }).id;
  const frei = await request.put(`/api/kos/${id}`, { data: { action: "admin-validate" } });
  expect(frei.status(), await frei.text()).toBe(200);
  return id;
}

/** Eine belegte Rückmeldung über den vorhandenen Weg: Frage → Beleg → Meldung. */
async function melden(request: APIRequestContext, koId: string, titel: string): Promise<string> {
  const frage = await request.post("/api/ask", { data: { question: titel } });
  expect(frage.status(), await frage.text()).toBe(200);
  const body = (await frage.json()) as { receipt?: string; result?: { citedSources?: string[] } };
  expect(body.result?.citedSources ?? [], "die Antwort zitiert den Beitrag nicht").toContain(koId);
  const res = await request.post("/api/ask/report", {
    data: { koId, receipt: body.receipt, grund: "antwort-falsch" },
  });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as { meldungId: string }).meldungId;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const zeileMit = (page: Page, titel: string) =>
  page.getByTestId("qa-zeile").filter({ hasText: titel });

test.describe("ADMIN-10 · Qualitätsaufgaben und Rückmeldungen", () => {
  test("Lieferbeleg: Verwaltung → Übersicht → Arbeitsweg → zurück mit Filter → Rückmeldung übernehmen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const revTitel = `Kühlmittel ${m} monatlich prüfen`;
    const meldTitel = `Spindel ${m} im Stillstand reinigen`;
    const rev = await freigegeben(page.request, revTitel);
    const revAnfordern = await page.request.put(`/api/kos/${rev}`, {
      data: { action: "request-revalidation" },
    });
    expect(revAnfordern.status()).toBe(204);
    const meldKo = await freigegeben(page.request, meldTitel);
    const meldungId = await melden(page.request, meldKo, meldTitel);

    // Der Einstieg ist die Verwaltung, nicht eine getippte Adresse.
    await page.goto("/admin");
    await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("ziel-qualitaetsaufgaben").click();
    await expect(page).toHaveURL(/\/qualitaetsaufgaben$/);
    await expect(zeileMit(page, revTitel)).toHaveCount(1, { timeout: 15_000 });
    await bild(page, "1-uebersicht");

    // Filter: Art = Revalidierung; die Zahl an der Option ist die Länge der Liste danach.
    const typ = page.getByTestId("qa-filter-typ");
    const option = await typ.locator('option[value="revalidierung"]').innerText();
    const versprochen = Number(/\((\d+)\)$/.exec(option.trim())?.[1] ?? "-1");
    await typ.selectOption("revalidierung");
    await expect(page).toHaveURL(/typ=revalidierung/);
    await expect(page.getByTestId("qa-zeile")).toHaveCount(versprochen);
    const zeile = zeileMit(page, revTitel);
    await expect(zeile.getByTestId("qa-zustaendig")).not.toBeEmpty();
    await expect(zeile.getByTestId("qa-frist")).toHaveText("Frist: nicht hinterlegt");
    await bild(page, "2-gefiltert-revalidierung");

    // Bearbeiten öffnet genau diesen Fall im bestehenden Arbeitsweg.
    await zeile.getByTestId("qa-oeffnen").click();
    await expect(page).toHaveURL(new RegExp(`/lebenszyklus\\?fall=${rev}$`));
    await bild(page, "3-arbeitsweg-lebenszyklus");

    // Zurück: dieselbe Auswahl, dieselbe Liste.
    await page.goBack();
    await expect(page).toHaveURL(/\/qualitaetsaufgaben\?typ=revalidierung$/);
    await expect(page.getByTestId("qa-filter-typ")).toHaveValue("revalidierung");
    await expect(zeileMit(page, revTitel)).toHaveCount(1, { timeout: 15_000 });

    // Rückmeldung übernehmen: Filter auf Rückmeldungen, Knopf, Meldung in der Live-Region.
    await page.getByTestId("qa-filter-typ").selectOption("rueckmeldung");
    const meldung = zeileMit(page, meldTitel);
    await expect(meldung).toHaveCount(1, { timeout: 15_000 });
    await meldung.getByTestId("qa-uebernehmen").click();
    await expect(page.getByTestId("qa-meldung")).toContainText("Übernommen", { timeout: 15_000 });
    // Die Meldung hängt jetzt an der Revalidierung — als Rückmeldung zählt sie nicht noch einmal.
    await expect(zeileMit(page, meldTitel)).toHaveCount(0);
    await page.getByTestId("qa-filter-typ").selectOption("revalidierung");
    const vorgang = zeileMit(page, meldTitel);
    await expect(vorgang).toHaveCount(1, { timeout: 15_000 });
    await expect(vorgang.getByTestId("qa-angehaengt")).toContainText(meldungId);
    await bild(page, "4-rueckmeldung-uebernommen");

    // Neuladen: Filter und Stand bleiben.
    await page.reload();
    await expect(page.getByTestId("qa-filter-typ")).toHaveValue("revalidierung");
    await expect(zeileMit(page, meldTitel)).toHaveCount(1, { timeout: 15_000 });
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`K6: ${breite} × ${hoehe} — Tastatur, sichtbarer Fokus, hin und zurück`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const titel = `Werkbank ${marke()} entstauben`;
      const ko = await freigegeben(page.request, titel);
      const anfordern = await page.request.put(`/api/kos/${ko}`, {
        data: { action: "request-revalidation" },
      });
      expect(anfordern.status()).toBe(204);

      await page.goto("/qualitaetsaufgaben?typ=revalidierung");
      await expect(zeileMit(page, titel)).toHaveCount(1, { timeout: 15_000 });
      const ueberbreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(ueberbreit, "die Übersicht ist breiter als das Fenster").toBe(false);
      await bild(page, `qualitaetsaufgaben-${breite}`);

      const aktiv = () =>
        page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? "");
      const fokusLage = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {
            sichtbar: el.matches(":focus-visible"),
            ring: getComputedStyle(el).boxShadow,
            umriss: getComputedStyle(el).outlineStyle,
            imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
          };
        });

      // Per Tab vom Rückweg-Link aus zur ersten Auswahl — der Fokus ist sichtbar.
      await page.getByRole("link", { name: "Zur Verwaltung" }).focus();
      for (let i = 0; i < 20 && (await aktiv()) !== "qa-filter-space"; i += 1) {
        await page.keyboard.press(tab);
      }
      expect(await aktiv(), "die Filter sind per Tab nicht erreichbar").toBe("qa-filter-space");
      const filterFokus = await fokusLage();
      expect(filterFokus?.imFenster).toBe(true);
      expect(
        filterFokus?.ring !== "none" || filterFokus?.umriss !== "none",
        "kein sichtbarer Fokus an der Auswahl",
      ).toBe(true);

      // Weiter per Tab bis „Bearbeiten" der eigenen Zeile, Enter öffnet den Arbeitsweg.
      const ziel = zeileMit(page, titel).getByTestId("qa-oeffnen");
      let erreicht = false;
      for (let i = 0; i < 80 && !erreicht; i += 1) {
        await page.keyboard.press(tab);
        erreicht = await ziel.evaluate((el) => el === document.activeElement);
      }
      expect(erreicht, "„Bearbeiten“ ist per Tab nicht erreichbar").toBe(true);
      expect((await fokusLage())?.imFenster).toBe(true);
      await bild(page, `fokus-bearbeiten-${breite}`);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/lebenszyklus\\?fall=${ko}$`));

      await page.goBack();
      await expect(page).toHaveURL(/\/qualitaetsaufgaben\?typ=revalidierung$/);
      await expect(zeileMit(page, titel)).toHaveCount(1, { timeout: 15_000 });
    });
  }
});
