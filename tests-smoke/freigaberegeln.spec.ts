import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-09 · FREIGABEREGEL EINES SPACE IN DER ECHTEN APP (produkt:20261009:admin-freigaberegeln).
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server (isolierter Testbestand im
// Speicher); die Bilder hängen am nativen Bericht. Jeder Lauf hat eigene, erfundene Namen
// (Laufmarke), damit Konten und Spaces anderer Specs nicht stören. Die globale
// Standard-Prüferanzahl wird NICHT verändert — sie gehört allen Specs.
//
//   K1 · Detailseite: Regel (Standard), Schritte, Prüfer mit Weg, Vorgänge — kein Freigabeknopf.
//   K2 · Regel ändern: Vorschau alt/neu und Wirkung VOR der Bestätigung; nach Reload gilt sie,
//        der Verlauf nennt die neue Space-Fassung.
//   K4 · Schritte trennen Einreichen, Freigabe und Veröffentlichen.
//   Bedienung · 390 × 844 und 1280 × 800: ohne Überbreite; Regeländerung per Tastatur mit Fokus
//        auf der Vorschau; Abbrechen schreibt nichts; ein unzulässiger Wert nennt den Grund.
//
// WAS HIER NICHT GEMESSEN IST: echte Mitarbeiterkonten, PostgreSQL (der Smoke-Server läuft im
// Speicher) und die Entscheidungswege selbst — Prüfpunkt, Fassungsbindung, Selbstprüfung und
// Vertretung misst `tests/freigaberegeln/freigaberegeln-api.test.ts` am Draht.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function kontoAnlegen(
  request: APIRequestContext,
  daten: { name: string; email: string; role: string },
): Promise<string> {
  const res = await request.post("/api/users", { data: { ...daten, password: SMOKE_PASS } });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function ich(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/auth/me");
  expect(res.status()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function ueberbreit(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Ein Space mit zwei Prüfern und einem laufenden Beitrag — alles fiktiv. */
async function aufbau(request: APIRequestContext, m: string) {
  const adminId = await ich(request);
  const carla = await kontoAnlegen(request, {
    name: `Carla Controller ${m}`,
    email: `carla-${m}@admin09.test`,
    role: "controller",
  });
  const paul = await kontoAnlegen(request, {
    name: `Paul Prüfer ${m}`,
    email: `paul-${m}@admin09.test`,
    role: "controller",
  });
  const space = await request.post("/api/spaces", {
    data: {
      name: `Prüfstand ${m}`,
      zweck: `Freigaberegel-Probe ${m} (fiktiv).`,
      verantwortlich: adminId,
      zugang: "mitglieder",
      mitglieder: [
        { nutzer: carla, recht: "lesen" },
        { nutzer: paul, recht: "lesen" },
      ],
      ansichten: [],
    },
  });
  expect(space.status(), await space.text()).toBe(201);
  const spaceId = ((await space.json()) as { id: string }).id;
  const ko = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: `Bügelmessschraube ${m}`,
      statement: `Die Bügelmessschraube ${m} wird täglich am Einstellmass geprüft (fiktiv).`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(ko.status(), await ko.text()).toBe(201);
  const koId = ((await ko.json()) as { id: string }).id;
  const v = await request.post("/api/spaces/verschiebung/vorschau", {
    data: { koId, zielSpaceId: spaceId },
  });
  expect(v.status(), await v.text()).toBe(200);
  const p = (await v.json()) as { ziel: { version: number }; grundlage: string };
  const w = await request.post("/api/spaces/verschiebung", {
    data: {
      koId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: null,
        quelleVersion: null,
        zielId: spaceId,
        zielVersion: p.ziel.version,
        grundlage: p.grundlage,
      },
    },
  });
  expect(w.status(), await w.text()).toBe(200);
  return { spaceId, koId, carla, paul };
}

test.describe("ADMIN-09 · Freigaberegeln und Prüfzuständigkeiten administrieren", () => {
  test("Lieferbeleg: Übersicht, Vorschau mit Wirkung, Übernahme und Zustand nach Reload (K1, K2, K4)", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const { spaceId, koId, carla, paul } = await aufbau(page.request, m);

    // --- K1 · Übersicht ohne eigene Regel ------------------------------------------------------
    await page.goto(`/spaces/${spaceId}`);
    const karte = page.getByTestId("space-freigaberegel");
    await expect(karte).toBeVisible({ timeout: 15_000 });
    await expect(karte.getByTestId("freigabe-regel-standard")).toBeVisible({ timeout: 15_000 });
    await expect(karte.getByTestId("freigabe-schritte").locator("li")).toHaveCount(5);
    await expect(karte.getByTestId("freigabe-schritte")).toContainText("Veröffentlichen");
    await expect(karte.getByTestId("freigabe-selbst")).toContainText("eigenen Beitrag");
    const prueferin = karte.locator(
      `[data-testid="freigabe-pruefer-person"][data-konto="${carla}"]`,
    );
    await expect(prueferin).toHaveAttribute("data-berechtigt", "ja");
    const vorgang = karte.locator(`[data-testid="freigabe-vorgang"][data-ko="${koId}"]`);
    await expect(vorgang).toHaveAttribute("data-zustand", "eingereicht");
    await expect(vorgang.getByTestId("freigabe-vorgang-zustimmungen")).toContainText(
      "noch nicht freigegeben",
    );
    // Die Fläche gibt nichts frei: kein Freigabe-, Validierungs- oder Kennzeichnungsknopf.
    const freigabeKnoepfe = karte.getByRole("button", {
      name: /freigeben|validieren|kennzeichnen/i,
    });
    await expect(freigabeKnoepfe).toHaveCount(0);
    await bild(page, "1-regeluebersicht-standard");

    // --- K2 · Regel ändern: Vorschau vor Bestätigung -----------------------------------------------
    await karte.getByTestId("freigabe-aendern").click();
    const pflege = karte.getByTestId("freigabe-pflege");
    // 5: höher als jede Standard-Prüferanzahl — die Wirkung ist damit eindeutig, gleich welcher
    // Standard auf dem gemeinsamen Smoke-Server gilt.
    await pflege.getByTestId("freigabe-pflege-zustimmungen").selectOption("5");
    await pflege.locator(`[data-testid="freigabe-pflege-pruefer"][data-konto="${carla}"]`).check();
    await pflege.locator(`[data-testid="freigabe-pflege-pruefer"][data-konto="${paul}"]`).check();
    await pflege.getByTestId("freigabe-pflege-frist").fill("5");
    await pflege.getByTestId("freigabe-pflege-begruendung").fill(`Probe ${m}.`);
    await pflege.getByTestId("freigabe-pruefen").click();
    const vorschau = pflege.getByTestId("freigabe-vorschau");
    await expect(vorschau).toBeVisible({ timeout: 15_000 });
    await expect(vorschau.getByTestId("freigabe-vorschau-alt")).toContainText("Standard");
    await expect(vorschau.getByTestId("freigabe-vorschau-neu")).toContainText("5 Zustimmungen");
    await expect(vorschau.getByTestId("freigabe-vorschau-laufend")).toContainText(
      "Laufende Vorgänge: 1",
    );
    await expect(
      vorschau.locator(`[data-testid="freigabe-vorschau-vorgang"][data-ko="${koId}"]`),
    ).toContainText(`Bügelmessschraube ${m}`);
    await expect(vorschau.getByTestId("freigabe-vorschau-freigegeben")).toContainText(
      "nichts wird rückwirkend",
    );
    await bild(page, "2-vorschau-alt-neu-wirkung");
    // Vor der Bestätigung ist nichts geschrieben.
    const vorherAntwort = await page.request.get(`/api/spaces/${spaceId}/freigaberegel`);
    expect(((await vorherAntwort.json()) as { regel: unknown }).regel).toBeNull();
    await vorschau.getByTestId("freigabe-uebernehmen").click();
    await expect(karte.getByTestId("freigabe-meldung")).toContainText("Die neue Regel gilt", {
      timeout: 15_000,
    });

    // --- Nach Reload: die Regel gilt, der Verlauf nennt sie ----------------------------------------
    await page.reload();
    const neu = page.getByTestId("space-freigaberegel");
    await expect(neu.getByTestId("freigabe-regel-zustimmungen")).toContainText("5 Zustimmungen", {
      timeout: 15_000,
    });
    await expect(neu.getByTestId("freigabe-regel-gruppe")).toContainText(`Carla Controller ${m}`);
    await expect(neu.getByTestId("freigabe-regel-frist")).toContainText("5 Tage");
    await expect(neu.getByTestId("freigabe-verlauf-eintrag").first()).toContainText(`Probe ${m}.`);
    // Der laufende Vorgang braucht jetzt 5 Zustimmungen — und heisst weiter „nicht freigegeben".
    const laufend = neu.locator(`[data-testid="freigabe-vorgang"][data-ko="${koId}"]`);
    const zustimmungen = laufend.getByTestId("freigabe-vorgang-zustimmungen");
    await expect(zustimmungen).toContainText("0 von 5 Zustimmungen");
    await expect(zustimmungen).toContainText("noch nicht freigegeben");
    await page.getByTestId("space-verlauf-knopf").click();
    await expect(
      page.locator('[data-testid="space-fassung"][data-vorgang="freigaberegel"]'),
    ).toContainText("Freigaberegel geändert");
    await bild(page, "3-regel-nach-reload");
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`Bedienung: ${breite} × ${hoehe} — ohne Überbreite, Regeländerung per Tastatur, verständlicher Fehler`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const m = marke();
      const { spaceId } = await aufbau(page.request, m);

      await page.goto(`/spaces/${spaceId}`);
      await expect(page.getByTestId("space-freigaberegel")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("freigabe-regel-standard")).toBeVisible({ timeout: 15_000 });
      expect(await ueberbreit(page), "die Detailseite ist breiter als das Fenster").toBe(false);

      const fokus = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el
            ? {
                testId: el.getAttribute("data-testid") ?? "",
                tag: el.tagName,
                sichtbar: el.matches(":focus-visible"),
              }
            : null;
        });
      await page.getByTestId("space-verlauf-knopf").focus();
      for (let i = 0; i < 80 && (await fokus())?.testId !== "freigabe-aendern"; i += 1) {
        await page.keyboard.press(tab);
      }
      const aufKnopf = await fokus();
      expect(aufKnopf?.testId, "„Regel ändern“ ist per Tab nicht erreichbar").toBe(
        "freigabe-aendern",
      );
      expect(aufKnopf?.sichtbar, "kein :focus-visible auf „Regel ändern“").toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("freigabe-pflege")).toBeVisible({ timeout: 15_000 });

      // Ein unzulässiger Wert: der Server nennt den Grund, nichts wird geschrieben.
      await page.getByTestId("freigabe-pflege-frist").fill("0");
      await page.getByTestId("freigabe-pruefen").click();
      await expect(page.getByTestId("freigabe-pflege-meldung")).toContainText("nicht zulässig", {
        timeout: 15_000,
      });
      await bild(page, `4-fehler-${breite}`);
      await page.getByTestId("freigabe-pflege-frist").fill("");

      // Vorschau per Tastatur: der Fokus springt auf ihre Überschrift.
      await page.getByTestId("freigabe-pruefen").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("freigabe-vorschau")).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => (await fokus())?.tag).toBe("H3");
      expect(await ueberbreit(page), "die Vorschau ist breiter als das Fenster").toBe(false);
      await bild(page, `5-vorschau-tastatur-${breite}`);

      // Abbrechen per Tastatur: nichts geschrieben.
      for (let i = 0; i < 40 && (await fokus())?.testId !== "freigabe-vorschau-abbrechen"; i += 1) {
        await page.keyboard.press(tab);
      }
      expect((await fokus())?.testId).toBe("freigabe-vorschau-abbrechen");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("freigabe-vorschau")).toHaveCount(0);
      const gelesen = (await (await page.request.get(`/api/spaces/${spaceId}`)).json()) as {
        space: { version: number; freigabe?: unknown };
      };
      expect(gelesen.space.version).toBe(1);
      expect(gelesen.space.freigabe).toBeUndefined();

      // Rückweg: „Alle Spaces" führt zur Übersicht.
      await page.getByRole("link", { name: "Alle Spaces" }).first().click();
      await expect(page).toHaveURL(/\/spaces$/);
    });
  }
});
