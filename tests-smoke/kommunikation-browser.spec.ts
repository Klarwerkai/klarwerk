import { type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// ADMIN-12 · MELDUNGEN UND KANÄLE IN DER ECHTEN APP
// (produkt:20261007:veroeffentlichungsoptionen:admin-20261009).
// ================================================================================================
//
// Geklickt und getippt wird im echten Browser gegen den Smoke-Server:
//   K1 · Die Seite nennt je Ereignis Zielgruppe, Kanäle samt Zustand, Häufigkeit und Abwahl; die
//        eigene Abwahl geht per Tastatur und überlebt das Neuladen.
//   K2 · Die Wahl am Eintrag nennt die Wirkung nach den Regeln, bevor veröffentlicht wird.
//   K4 · Mail ist nur wählbar, wenn der Server Mailversand meldet; Push ist nie wählbar. Der
//        Zustellstatus zeigt die Leserin nach dem Abruf ihrer Glocke als „zugestellt“.
//   K6 · Die Verwaltung ändert eine Vorgabe per Tastatur; sie gilt nach dem Neuladen und steht im
//        Protokoll.
//   Desktop 1280 × 800 und 390 × 844: keine Überbreite, sichtbarer Fokus, Rückweg.
//
// LÄUFT IM ISOLIERTEN KONTEXT (`chromium-zustand`, `playwright.smoke.config.ts`): die Sonde legt
// ein Konto und einen gültigen Eintrag an und ändert Vorgaben. Geänderte Vorgaben und die eigene
// Abwahl werden am Ende zurückgestellt, damit die Veröffentlichungssonde denselben Ausgangsstand
// sieht. Alle Inhalte und Konten sind erfundene Testdaten; es wird keine Mail verschickt.
//
// WAS NICHT GEMESSEN IST: ein Versand über einen echten Mailserver (der Smoke-Server hat keinen),
// die Zusammenfassung am Folgetag (Servertest `tests/kommunikationsregeln/`) und ob Menschen die
// Erklärung verstehen.

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

async function ohneUeberbreite(page: Page, wo: string): Promise<void> {
  const breite = await page.evaluate(() => ({
    inhalt: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
  }));
  expect(breite.inhalt, `${wo}: waagerechte Überbreite`).toBeLessThanOrEqual(breite.fenster);
}

/** Der Fokus ist sichtbar: Umriss oder Hintergrund am fokussierten Element. */
async function fokusSichtbar(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) {
      return false;
    }
    const s = getComputedStyle(el);
    const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 1;
    return umriss || s.boxShadow !== "none" || el.matches(":focus-visible");
  });
}

interface Regeln {
  version: number;
  mailEingerichtet: boolean;
  ereignisse: Array<{ id: string; abwaehlbar: boolean }>;
}

test("ADMIN-12 · 1280 × 800: Übersicht, Vorgabe per Tastatur, Neuladen, Protokoll und Zustellstatus", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  const m = marke();
  const leserinName = `Lea Leserin ${m}`;
  const leserinMail = `lea-${m}@klarwerk.test`;
  const leserinPass = "Leserin-Passwort-1";
  const konto = await page.request.post("/api/users", {
    data: { name: leserinName, email: leserinMail, password: leserinPass, role: "viewer" },
  });
  expect(konto.status(), await konto.text()).toBe(201);

  const vorher = (await (await page.request.get("/api/kommunikation/regeln")).json()) as Regeln;
  const wirkungVorher = vorher.ereignisse.find((e) => e.id === "wirkung")?.abwaehlbar ?? true;
  try {
    // ---- Übersicht ---------------------------------------------------------------------------------
    await page.goto("/kommunikation");
    await expect(page.getByTestId("page-kommunikation")).toBeVisible({ timeout: 15_000 });
    const normal = page.locator(
      '[data-testid="kommunikation-ereignis"][data-ereignis="veroeffentlichung"]',
    );
    await expect(normal.getByTestId("kommunikation-zielgruppe")).toHaveText(
      "Alle, die den Eintrag lesen dürfen — außer der veröffentlichenden Person",
    );
    await expect(normal.locator('[data-kanal="glocke"]')).toHaveAttribute("data-zustand", "aktiv");
    await expect(normal.locator('[data-kanal="push"]')).toHaveAttribute(
      "data-zustand",
      "nicht_angeschlossen",
    );
    const kenntnis = page.locator(
      '[data-testid="kommunikation-ereignis"][data-ereignis="kenntnisnahme"]',
    );
    await expect(kenntnis.getByTestId("kommunikation-abwahl")).toHaveText(
      "verbindlich — muss bestätigt werden",
    );
    // Mail ist genau dann wählbar, wenn der Server Mailversand meldet.
    const mailFeld = page.locator(
      '[data-testid="kommunikation-vorgabe"][data-ereignis="veroeffentlichung"] [data-testid="kommunikation-vorgabe-mail"]',
    );
    if (vorher.mailEingerichtet) {
      await expect(mailFeld).toBeEnabled();
    } else {
      await expect(mailFeld).toBeDisabled();
      await expect(normal.locator('[data-kanal="mail"]')).toHaveAttribute(
        "data-zustand",
        "nicht_eingerichtet",
      );
    }
    await ohneUeberbreite(page, "1280 × 800");
    await bild(page, "1-uebersicht-desktop");

    // ---- Vorgabe ändern, nur mit der Tastatur ------------------------------------------------------
    const abwahl = page.locator(
      '[data-testid="kommunikation-vorgabe"][data-ereignis="wirkung"] [data-testid="kommunikation-vorgabe-abwaehlbar"]',
    );
    await abwahl.focus();
    await expect(abwahl).toBeFocused();
    expect(await fokusSichtbar(page), "Fokus am Kästchen unsichtbar").toBe(true);
    await page.keyboard.press("Space");
    await expect(abwahl).toBeChecked({ checked: !wirkungVorher });
    const speichern = page.getByTestId("kommunikation-vorgaben-speichern");
    await speichern.focus();
    await page.keyboard.press("Enter");
    const ergebnis = page.getByTestId("kommunikation-vorgaben-ergebnis");
    await expect(ergebnis).toHaveText(/^Gespeichert als Fassung \d+\.$/, { timeout: 15_000 });
    const fassung = Number(/(\d+)/.exec((await ergebnis.textContent()) ?? "")?.[1]);
    expect(fassung).toBe(vorher.version + 1);
    await bild(page, "2-vorgabe-gespeichert");

    await page.reload();
    await expect(page.getByTestId("kommunikation-vorgaben-stand")).toContainText(
      `Fassung ${fassung} · geändert von ${SMOKE_NAME}`,
      { timeout: 15_000 },
    );
    await expect(abwahl).toBeChecked({ checked: !wirkungVorher });
    await expect(page.getByTestId("kommunikation-protokoll-zeile").first()).toContainText(
      `Fassung ${fassung} · ${SMOKE_NAME}`,
    );

    // ---- Wirkung am Eintrag und Zustellstatus ------------------------------------------------------
    const angelegt = await page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Rundschreiben Messmittel ${m}`,
        statement: `Messmittel ${m} werden vor Schichtbeginn auf Beschädigung geprüft.`,
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

    await page.goto(`/wissen/${ko.id}`);
    const bereich = page.getByTestId("veroeffentlichung-bereich");
    await expect(bereich).toBeVisible({ timeout: 15_000 });
    await bereich.locator('[data-testid="veroeffentlichung-wahl"][value="normal"]').check();
    const regel = bereich.getByTestId("veroeffentlichung-regelwirkung");
    await expect(regel).toBeVisible();
    await expect(regel.getByTestId("veroeffentlichung-regel-mail")).toBeVisible();
    await bild(page, "3-regelwirkung-vor-dem-veroeffentlichen");
    await bereich.getByTestId("veroeffentlichung-absenden").click();
    await expect(bereich.getByTestId("veroeffentlichung-erfolg")).toContainText(
      "Fassung V1 ist veröffentlicht.",
      { timeout: 15_000 },
    );

    // Die Leserin meldet sich an: die Oberfläche lädt ihre Glocke (Zähler) — „zugestellt“. Erst
    // das Öffnen der Liste markiert die Meldungen als gesehen — „gelesen“.
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
      const glockeGeladen = leserin.waitForResponse(
        (r) => r.url().endsWith("/api/notifications") && r.request().method() === "GET",
        { timeout: 15_000 },
      );
      await leserin.locator('button[type="submit"]').click();
      await expect(workspaceMarker(leserin)).toBeVisible({ timeout: 15_000 });
      await glockeGeladen;
      if (await leserin.getByTestId("notice-ack").count()) {
        await leserin.getByTestId("notice-ack").click();
      }

      const umschalten = bereich.getByTestId("veroeffentlichung-zustellung-umschalten").first();
      await umschalten.focus();
      expect(await fokusSichtbar(page), "Fokus am Zustellstatus unsichtbar").toBe(true);
      await page.keyboard.press("Enter");
      await expect(umschalten).toHaveAttribute("aria-expanded", "true");
      const zeile = bereich
        .getByTestId("veroeffentlichung-zustellung-person")
        .filter({ hasText: leserinName });
      await expect(zeile).toHaveAttribute("data-glocke", "zugestellt", { timeout: 15_000 });
      await zeile.scrollIntoViewIfNeeded();
      await bild(page, "4-zustellstatus-zugestellt");

      const gesehen = leserin.waitForResponse(
        (r) => r.url().endsWith("/api/notifications/seen") && r.status() === 200,
        { timeout: 15_000 },
      );
      await leserin.getByTestId("kopfband-meldungen").click();
      await expect(
        leserin.locator('[data-testid="meldung-oeffnen"][data-art="veroeffentlichung"]').first(),
      ).toBeVisible({ timeout: 15_000 });
      await gesehen;

      // Zuklappen und wieder öffnen fragt den Status neu.
      await page.keyboard.press("Enter");
      await expect(umschalten).toHaveAttribute("aria-expanded", "false");
      await page.keyboard.press("Enter");
      await expect(zeile).toHaveAttribute("data-glocke", "gelesen", { timeout: 15_000 });
      await bild(page, "5-zustellstatus-gelesen");
    } finally {
      await leserinKontext.close();
    }
  } finally {
    // Ausgangsstand wiederherstellen — die Veröffentlichungssonde soll dieselben Regeln sehen.
    const jetzt = (await (await page.request.get("/api/kommunikation/regeln")).json()) as Regeln;
    const zurueck = await page.request.put("/api/admin/kommunikation/regeln", {
      data: { version: jetzt.version, vorgaben: { wirkung: { abwaehlbar: wirkungVorher } } },
    });
    expect(zurueck.status(), await zurueck.text()).toBe(200);
  }
});

test("ADMIN-12 · 390 × 844: eigene Abwahl per Tastatur, Neuladen, kein Überlauf, Wege hin und zurück", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ensureLoggedIn(page);

  // Hin über das Profil.
  await page.goto("/profil");
  const profilZeile = page.getByTestId("zeile-kommunikation");
  await expect(profilZeile).toBeVisible({ timeout: 15_000 });
  await profilZeile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/kommunikation$/, { timeout: 15_000 });
  await expect(page.getByTestId("page-kommunikation")).toBeVisible({ timeout: 15_000 });
  await ohneUeberbreite(page, "390 × 844");

  const feld = page.locator(
    '[data-testid="kommunikation-meine-zeile"][data-ereignis="veroeffentlichung"] input[type="checkbox"]',
  );
  const vorher = await feld.isChecked();
  try {
    await feld.focus();
    await expect(feld).toBeFocused();
    expect(await fokusSichtbar(page), "Fokus am Kästchen unsichtbar").toBe(true);
    await page.keyboard.press("Space");
    await expect(page.getByTestId("kommunikation-meine-gespeichert")).toHaveText("Gespeichert.", {
      timeout: 15_000,
    });
    await expect(feld).toBeChecked({ checked: !vorher });
    await bild(page, "1-abwahl-schmal");

    await page.reload();
    await expect(feld).toBeChecked({ checked: !vorher, timeout: 15_000 });
    // Die verbindliche Kenntnisnahme ist nicht abwählbar.
    await expect(
      page.locator(
        '[data-testid="kommunikation-meine-zeile"][data-ereignis="kenntnisnahme"] input[type="checkbox"]',
      ),
    ).toBeDisabled();
    await ohneUeberbreite(page, "390 × 844 nach dem Neuladen");
    await bild(page, "2-nach-dem-neuladen-schmal");
  } finally {
    const zurueck = await page.request.put("/api/meldungsregeln/meine", {
      data: { ereignis: "veroeffentlichung", abgewaehlt: !vorher },
    });
    expect(zurueck.status(), await zurueck.text()).toBe(200);
  }

  // Zurück in die Verwaltung — per Tastatur.
  const rueckweg = page.getByTestId("kommunikation-zurueck");
  await rueckweg.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  const ziel = page.getByTestId("ziel-kommunikation");
  await expect(ziel).toHaveAttribute("href", "/kommunikation");
});
