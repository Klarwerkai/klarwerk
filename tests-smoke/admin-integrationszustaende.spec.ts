// ================================================================================================
// ADMIN-02 · DER BEOBACHTETE FALL IM ECHTEN BROWSER: SHAREPOINT OHNE ANGABEN, DESKTOP UND 390 × 844.
// ================================================================================================
//
// Der Smoke-Server läuft OHNE SharePoint-Schalter und ohne SharePoint-Angaben
// (`playwright.smoke.config.ts`, `smokeServerEnv`) — genau die Lage der UI-Beobachtung vom
// 09.10.2026, in der die Kachel „aktiv" sagte und der Bereich „nicht eingeschaltet". Gemessen wird
// am gebauten Bündel gegen den echten Server:
//
//   1. Galeriekachel UND Zugangskarte nennen denselben Zustand („ausgeschaltet"), keine sagt „aktiv".
//   2. Die Serverantwort (`GET /api/import/sharepoint/zugang`) trägt genau die Tatsachen, aus denen
//      die Fläche ableitet — kein Wert, nur Namen und Ja/Nein.
//   3. Der Verbindungstest ist per Tastatur erreichbar und startbar; er endet hier LOKAL
//      („ausgeschaltet", Umfang „nur Schalter und Angaben") — es geht kein Abruf an eine Gegenstelle.
//   4. Nach dem Neuladen steht derselbe Nachweis da.
//   5. Die Kachel führt zum Bereich, und der Browser-Rückweg funktioniert.
//   6. Kein waagerechter Überlauf bei 390 × 844; der Knopf liegt im Sichtfenster.
//
// GRENZE, ausdrücklich: ein echter Microsoft-365-Mandant ist hier nicht angebunden. Die Fälle
// „abgewiesener Zugang", „Zeitüberschreitung" und „Erfolg" stehen am Draht und am Dienst
// (`tests/admin-integrationszustaende/`) mit fiktiver Gegenstelle, nicht in diesem Browserlauf.
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import { schalteStufe2Ein } from "./support/import-json-kasten";

const GROESSEN = [
  { name: "Desktop 1280 × 900", width: 1280, height: 900 },
  { name: "Mobil 390 × 844", width: 390, height: 844 },
] as const;

for (const groesse of GROESSEN) {
  test(`ADMIN-02 · SharePoint ohne Angaben — Kachel, Karte, Verbindungstest (${groesse.name})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: groesse.width, height: groesse.height });
    await ensureLoggedIn(page);
    await schalteStufe2Ein(page);

    const karte = page.getByTestId("sharepoint-zugang-state");
    const kachel = page.locator('#import-source-gallery [data-id="sharepoint"]');
    await expect(karte).toBeVisible({ timeout: 15_000 });

    // 2 — die Serverantwort, aus derselben angemeldeten Sitzung gelesen.
    const auskunft = await page.request.get("/api/import/sharepoint/zugang");
    expect(auskunft.status()).toBe(200);
    const zugang = (await auskunft.json()) as {
      enabled: boolean;
      credentialsUsable: boolean;
      credentials: { name: string; present: boolean }[];
    };
    expect(zugang.enabled, "der Smoke-Server schaltet SharePoint nicht ein").toBe(false);
    expect(zugang.credentialsUsable).toBe(false);
    for (const c of zugang.credentials) {
      expect(Object.keys(c).sort(), "je Variable nur Name und Ja/Nein").toEqual([
        "name",
        "present",
      ]);
    }

    // 1 — Kachel und Karte sagen dasselbe; keine sagt „aktiv".
    await expect(karte).toHaveAttribute("data-status", "ausgeschaltet");
    await expect(kachel).toHaveAttribute("data-status", "ausgeschaltet");
    await expect(kachel).toHaveAttribute("data-state", "unconfigured");
    await expect(kachel).not.toContainText("aktiv");
    await expect(page.getByTestId("sharepoint-naechster-schritt")).toHaveAttribute(
      "data-schritt",
      "integrationen.test.schritt.ausgeschaltet",
    );
    await expect(page.getByTestId("sharepoint-freischaltung")).toHaveAttribute("data-an", "no");

    // 6 — kein waagerechter Überlauf des Dokuments.
    const ueberlauf = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(ueberlauf, "waagerechter Überlauf in Pixeln").toBeLessThanOrEqual(1);

    // 3 — per Tastatur: fokussieren, Enter.
    const knopf = page.getByTestId("sharepoint-verbindungstest-starten");
    await knopf.scrollIntoViewIfNeeded();
    await knopf.focus();
    await expect(knopf).toBeFocused();
    const box = await knopf.boundingBox();
    expect(box, "der Knopf hat eine Fläche").not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(groesse.width + 1);
    const antwort = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/import/sharepoint/verbindungstest") &&
        r.request().method() === "POST",
    );
    await page.keyboard.press("Enter");
    const testAntwort = await antwort;
    expect(testAntwort.status()).toBe(200);
    const nachweis = (await testAntwort.json()) as Record<string, unknown>;
    expect(nachweis).toMatchObject({
      umfang: "konfiguration",
      ergebnis: "ausgeschaltet",
      dauerMs: null,
    });
    expect(Object.keys(nachweis).sort()).toEqual(["dauerMs", "ergebnis", "geprueftAm", "umfang"]);

    const zeile = page.getByTestId("sharepoint-verbindungstest-zeile");
    await expect(zeile).toHaveAttribute("data-ergebnis", "ausgeschaltet");
    await expect(zeile).toHaveAttribute("data-umfang", "konfiguration");
    // Der Status bleibt „ausgeschaltet" — ein Test macht eine ausgeschaltete Anbindung nicht nutzbar.
    await expect(karte).toHaveAttribute("data-status", "ausgeschaltet");

    await testInfo.attach(`admin02-${groesse.width}x${groesse.height}-karte.png`, {
      body: await page.getByTestId("sharepoint-verbindungstest").screenshot(),
      contentType: "image/png",
    });

    // 4 — nach dem Neuladen derselbe Nachweis.
    await page.reload();
    await expect(page.getByTestId("sharepoint-verbindungstest-zeile")).toHaveAttribute(
      "data-ergebnis",
      "ausgeschaltet",
      { timeout: 15_000 },
    );

    // 5 — die Kachel führt zum Bereich; der Browser-Rückweg führt zurück.
    const vorher = page.url();
    await page.locator('#import-source-gallery [data-id="sharepoint"]').click();
    await expect(page).toHaveURL(/#sharepoint-import$/);
    await page.goBack();
    await expect(page).toHaveURL(vorher);

    await testInfo.attach(`admin02-${groesse.width}x${groesse.height}-seite.png`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  });

  // ADMIN-02 Nacharbeit 2: Confluence am selben Modell und die Importliste. Der Smoke-Server gibt
  // den Confluence-Import nicht frei — Karte und Kachel müssen deshalb beide „ausgeschaltet" sagen,
  // und der Test endet lokal, ohne Abruf.
  test(`ADMIN-02 N2 · Confluence-Kachel und -Karte, Importliste (${groesse.name})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: groesse.width, height: groesse.height });
    await ensureLoggedIn(page);
    await schalteStufe2Ein(page);

    const status = page.getByTestId("import-access-status");
    const kachel = page.locator('#import-source-gallery [data-id="confluence"]');
    await expect(status).toBeVisible({ timeout: 15_000 });
    const auskunft = await page.request.get("/api/import/confluence/zugang");
    expect(auskunft.status()).toBe(200);
    expect(((await auskunft.json()) as { enabled: boolean }).enabled).toBe(false);
    await expect(status).toHaveAttribute("data-status", "ausgeschaltet");
    await expect(kachel).toHaveAttribute("data-status", "ausgeschaltet");
    await expect(kachel).not.toContainText("aktiv");

    // Verbindungstest per Tastatur, Ergebnis lokal, nach dem Neuladen noch da.
    const knopf = page.getByTestId("import-access-verbindungstest-starten");
    await knopf.scrollIntoViewIfNeeded();
    await knopf.focus();
    await expect(knopf).toBeFocused();
    const antwort = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/import/confluence/verbindungstest") &&
        r.request().method() === "POST",
    );
    await page.keyboard.press("Enter");
    expect(((await (await antwort).json()) as { ergebnis: string }).ergebnis).toBe("ausgeschaltet");
    await expect(page.getByTestId("import-access-verbindungstest-zeile")).toHaveAttribute(
      "data-umfang",
      "konfiguration",
    );
    await page.reload();
    await expect(page.getByTestId("import-access-verbindungstest-zeile")).toHaveAttribute(
      "data-ergebnis",
      "ausgeschaltet",
      { timeout: 15_000 },
    );

    // Importliste: Serverantwort und Fläche, ohne waagerechten Überlauf.
    const liste = await page.request.get("/api/admin/import/runs");
    expect(liste.status()).toBe(200);
    const daten = (await liste.json()) as { verfuegbar: boolean; runs: unknown[] };
    expect(daten.verfuegbar).toBe(true);
    const karte = page.getByTestId("import-laufliste-karte");
    await karte.scrollIntoViewIfNeeded();
    await expect(karte).toBeVisible();
    await expect(
      daten.runs.length === 0
        ? page.getByTestId("import-laufliste-leer")
        : page.getByTestId("import-laufliste"),
    ).toBeVisible();
    const ueberlauf = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(ueberlauf, "waagerechter Überlauf in Pixeln").toBeLessThanOrEqual(1);
    await testInfo.attach(`admin02-n2-${groesse.width}x${groesse.height}-liste.png`, {
      body: await karte.screenshot(),
      contentType: "image/png",
    });
  });
}
