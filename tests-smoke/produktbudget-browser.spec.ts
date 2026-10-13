import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin · PRODUKTBUDGETS IN DER ECHTEN APP (PBE-10).
// ================================================================================================
//
// Geklickt und getippt wird im echten Browser gegen den Smoke-Server (Speicherbetrieb, kein Modell,
// kein Netz nach aussen):
//   B1 · Verwaltung › KI › Produktbudgets: Betrag, Währung, Anbieter, Geltung, Zeitraum, Verbrauch,
//        Rest, Stand; Perplexity ersetzt 30 USD/Monat; Nr. 32 offen; der feste Satz steht da.
//   B2 · Speichern und Neuladen: der neue Betrag gilt nach dem Neuladen.
//   B3 · Unklarer Ausgang: der Server speichert, die Antwort geht verloren — die Eingabe bleibt,
//        erneutes Speichern wirkt nicht doppelt (eine Provenienzzeile).
//   B4 · Konkurrierende Änderung: 409, neuer Stand daneben, Eingabe bleibt; erst ausdrücklich bezogen
//        wird gespeichert. Gleichzeitige Schreiber auf derselben Fassung: genau einer gewinnt.
//   B5 · Ungültiger Betrag: Meldung, Eingabe bleibt, nichts geschrieben.
//   B6 · Rolle: ein fiktives Viewer-Konto bekommt 403 lesend und schreibend.
//   390 × 844: keine Überbreite.
//
// LÄUFT IM ISOLIERTEN KONTEXT (`chromium-zustand`): die Sonde ändert Budgets und legt ein Konto an.
// Am Ende steht das Perplexity-Budget wieder auf der Originalvorgabe 20 EUR einmalig. Alle Konten
// und Werte sind erfunden.
//
// WAS NICHT GEMESSEN IST: ein Neustart des Servers (der Smoke-Server hält seinen Bestand im
// Speicher; haltbar ist der Postgres-Betrieb, belegt in
// `tests/produktbudget/produktbudget-pg.integration.test.ts`), ein realer Anbieteraufruf oder eine
// reale Abrechnung — beides bleibt beim jeweiligen ursprünglichen Funktionsauftrag.

const WEG = "/api/admin/produktbudget";

interface Bereich {
  bereich: string;
  betragCent: number;
  waehrung: string;
  zeitraum: string;
  fassung: number;
  letzteAenderungen: { aenderungId: string }[];
}

async function lies(page: Page): Promise<Bereich[]> {
  const res = await page.request.get(WEG);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { bereiche: Bereich[] }).bereiche;
}

async function perplexity(page: Page): Promise<Bereich> {
  const b = (await lies(page)).find((x) => x.bereich === "perplexity-poc");
  if (!b) {
    throw new Error("Perplexity-Bereich fehlt");
  }
  return b;
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

async function karteOeffnen(page: Page): Promise<void> {
  await page.goto("/admin?bereich=ki");
  await page.getByTestId("zeile-ki-produktbudget").click();
  await expect(page.getByTestId("detail-produktbudget")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("produktbudget-bereich-perplexity-poc")).toBeVisible();
}

function zufall(): string {
  return Math.random().toString(16).slice(2, 10);
}

test("Produktbudgets · Anzeige, Speichern, Neuladen, unklarer Ausgang, Konflikt, Rolle", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  const eingabe = page.getByTestId("pb-eingabe-betrag-perplexity-poc");
  const speichern = page.getByTestId("pb-speichern-perplexity-poc");
  const meldung = page.getByTestId("pb-meldung-perplexity-poc");
  const betrag = page.getByTestId("pb-betrag-perplexity-poc");

  try {
    // ---- B1 · Anzeige -----------------------------------------------------------------------------
    const start = await perplexity(page);
    await karteOeffnen(page);
    await expect(betrag).toHaveText(
      `${Math.floor(start.betragCent / 100)},${String(start.betragCent % 100).padStart(2, "0")} ${start.waehrung}`,
    );
    await expect(page.getByTestId("pb-anbieter-perplexity-poc")).toHaveText("Perplexity");
    await expect(page.getByTestId("pb-abgeloest-perplexity-poc")).toContainText("30,00 USD");
    await expect(page.getByTestId("pb-verbraucht-perplexity-poc")).toBeVisible();
    await expect(page.getByTestId("pb-verbleibend-perplexity-poc")).toBeVisible();
    await expect(page.getByTestId("pb-stand-perplexity-poc")).toBeVisible();
    // PBE-12: Peters bestätigte Gesamtperiode — gespeichert gelesen, nicht aus Beispielen.
    const gespeichert = await lies(page);
    expect(gespeichert.map((b) => [b.bereich, b.betragCent, b.waehrung, b.zeitraum])).toEqual([
      ["perplexity-poc", start.betragCent, "EUR", "einmalig"],
      ["nr32-claude", 2000, "EUR", "einmalig"],
      ["nr32-chatgpt", 2000, "EUR", "einmalig"],
    ]);
    for (const id of ["nr32-claude", "nr32-chatgpt"]) {
      await expect(page.getByTestId(`pb-zeitraum-${id}`)).toHaveText("einmalig, ohne Erneuerung");
      await expect(page.getByTestId(`pb-kostenweg-${id}`)).toHaveText(
        "möglich im Rahmen des Rests",
      );
      await expect(page.getByTestId(`pb-frage-${id}`)).toHaveCount(0);
    }
    await expect(page.getByTestId("produktbudget-ehrlichkeit")).toContainText(
      "keine Aufladung beim Anbieter",
    );
    await bild(page, "produktbudget-1280-anzeige");

    // ---- B2 · Speichern und Neuladen --------------------------------------------------------------
    await eingabe.fill("23,40");
    await speichern.click();
    await expect(meldung).toHaveText("Gespeichert.");
    await expect(betrag).toHaveText("23,40 EUR");
    await page.reload();
    await expect(page.getByTestId("detail-produktbudget")).toBeVisible({ timeout: 15_000 });
    await expect(betrag).toHaveText("23,40 EUR");
    await expect(page.getByTestId("pb-stand-perplexity-poc")).toContainText("Fassung");
    expect((await perplexity(page)).betragCent).toBe(2340);

    // ---- B3 · unklarer Ausgang: gespeichert, aber die Antwort geht verloren -----------------------
    let verschluckt = false;
    await page.route(`**${WEG}/perplexity-poc`, async (route) => {
      if (!verschluckt) {
        verschluckt = true;
        await route.fetch(); // der Server bekommt und speichert die Änderung …
        await route.abort("connectionreset"); // … der Browser sieht nur den Abbruch.
        return;
      }
      await route.continue();
    });
    await eingabe.fill("22,10");
    await speichern.click();
    await expect(meldung).toContainText("Ob gespeichert wurde, ist unklar");
    await expect(eingabe).toHaveValue("22,10");
    const nachVerlust = await perplexity(page);
    expect(nachVerlust.betragCent, "der Server hat die erste Sendung gespeichert").toBe(2210);
    const kennung = nachVerlust.letzteAenderungen[0]?.aenderungId;
    await speichern.click();
    await expect(meldung).toHaveText("Gespeichert.");
    await page.unroute(`**${WEG}/perplexity-poc`);
    const nachWiederholung = await perplexity(page);
    expect(nachWiederholung.fassung).toBe(nachVerlust.fassung);
    expect(
      nachWiederholung.letzteAenderungen.filter((a) => a.aenderungId === kennung),
      "die Wiederholung legte einen zweiten Eintrag an",
    ).toHaveLength(1);

    // ---- B4 · konkurrierende Änderung --------------------------------------------------------------
    await karteOeffnen(page);
    const gesehen = await perplexity(page);
    const fremd = await page.request.put(`${WEG}/perplexity-poc`, {
      data: {
        betrag: "24",
        waehrung: "EUR",
        zeitraum: "einmalig",
        fassung: gesehen.fassung,
        aenderungId: `smoke-fremd-${zufall()}`,
      },
    });
    expect(fremd.status()).toBe(200);
    await eingabe.fill("25");
    await speichern.click();
    await expect(meldung).toContainText("inzwischen geändert");
    await expect(betrag).toHaveText("24,00 EUR");
    await expect(eingabe).toHaveValue("25");
    await page.getByTestId("pb-konflikt-uebernehmen-perplexity-poc").click();
    await speichern.click();
    await expect(meldung).toHaveText("Gespeichert.");
    await expect(betrag).toHaveText("25,00 EUR");

    const fassung = (await perplexity(page)).fassung;
    const gleichzeitig = await Promise.all(
      ["11", "12", "13", "14"].map((b) =>
        page.request.put(`${WEG}/perplexity-poc`, {
          data: {
            betrag: b,
            waehrung: "EUR",
            zeitraum: "einmalig",
            fassung,
            aenderungId: `smoke-parallel-${b}-${zufall()}`,
          },
        }),
      ),
    );
    const status = gleichzeitig.map((r) => r.status()).sort();
    expect(status).toEqual([200, 409, 409, 409]);
    expect((await perplexity(page)).fassung).toBe(fassung + 1);

    // ---- B5 · ungültiger Betrag ---------------------------------------------------------------------
    await karteOeffnen(page);
    const vorUngueltig = await perplexity(page);
    await eingabe.fill("-3");
    await speichern.click();
    await expect(meldung).toContainText("Betrag ab 0");
    await expect(eingabe).toHaveValue("-3");
    expect((await perplexity(page)).fassung).toBe(vorUngueltig.fassung);

    // ---- 390 × 844 ---------------------------------------------------------------------------------
    await page.setViewportSize({ width: 390, height: 844 });
    await karteOeffnen(page);
    await ohneUeberbreite(page, "390 × 844");
    await bild(page, "produktbudget-390");

    // ---- B6 · Rolle --------------------------------------------------------------------------------
    const m = zufall();
    const mail = `viewer-budget-${m}@klarwerk.test`;
    const konto = await page.request.post("/api/users", {
      data: {
        name: `Vera Viewer ${m}`,
        email: mail,
        password: "Viewer-Passwort-1",
        role: "viewer",
      },
    });
    expect(konto.status(), await konto.text()).toBe(201);
    // Ein eigener Kontext = eine eigene Sitzung; die Adresse des Servers kommt aus dem Projekt.
    const basis = test.info().project.use.baseURL;
    const fremderKontext = await browser.newContext(basis ? { baseURL: basis } : {});
    try {
      const login = await fremderKontext.request.post("/api/auth/login", {
        data: { email: mail, password: "Viewer-Passwort-1" },
      });
      expect(login.status()).toBe(200);
      const token = ((await login.json()) as { token?: string }).token ?? "";
      const kopf = { authorization: `Bearer ${token}` };
      expect((await fremderKontext.request.get(WEG, { headers: kopf })).status()).toBe(403);
      const versuch = await fremderKontext.request.put(`${WEG}/perplexity-poc`, {
        headers: kopf,
        data: {
          betrag: "999",
          waehrung: "EUR",
          zeitraum: "einmalig",
          fassung: 0,
          aenderungId: `smoke-viewer-${m}`,
        },
      });
      expect(versuch.status()).toBe(403);

      // ---- B7 · PBE-12: Zuweisung durch die Verwaltung (in der Karte), Unterlimit am Server ----
      type Konto = { id: string; email: string };
      const roh = (await (await page.request.get("/api/users")).json()) as unknown;
      const nutzer: Konto[] = Array.isArray(roh)
        ? (roh as Konto[])
        : ((roh as { users?: Konto[] }).users ?? []);
      const viewerId = nutzer.find((u) => u.email === mail)?.id ?? "";
      expect(viewerId).not.toBe("");
      await page.setViewportSize({ width: 1280, height: 800 });
      await karteOeffnen(page);
      await page.getByTestId("pb-zuweisung-konto-nr32-chatgpt").selectOption(viewerId);
      await page.getByTestId("pb-zuweisung-betrag-nr32-chatgpt").fill("6");
      await page.getByTestId("pb-zuweisung-speichern-nr32-chatgpt").click();
      await expect(page.getByTestId(`pb-konto-nr32-chatgpt-${viewerId}`)).toContainText("6,00 EUR");
      await bild(page, "produktbudget-zuweisung");

      const eigen = await fremderKontext.request.get("/api/me/produktbudget", { headers: kopf });
      expect(eigen.status()).toBe(200);
      const eigenJson = (await eigen.json()) as { bereiche: Record<string, unknown>[] };
      const chatgpt = eigenJson.bereiche.find((b) => b.bereich === "nr32-chatgpt");
      expect(chatgpt).toMatchObject({ zeitraum: "einmalig", zuweisungCent: 600, fassung: 1 });
      const meinWeg = "/api/me/produktbudget/nr32-chatgpt";
      const zuHoch = await fremderKontext.request.put(meinWeg, {
        headers: kopf,
        data: { unterlimit: "6,01", fassung: 1 },
      });
      expect(zuHoch.status()).toBe(400);
      const innerhalb = await fremderKontext.request.put(meinWeg, {
        headers: kopf,
        data: { unterlimit: "4", fassung: 1 },
      });
      expect(innerhalb.status(), await innerhalb.text()).toBe(200);
      // Die globale Zuweisung bleibt der Verwaltung vorbehalten.
      const fremdeZuweisung = await fremderKontext.request.put(
        `${WEG}/nr32-chatgpt/konten/${viewerId}`,
        { headers: kopf, data: { zuweisung: "20", fassung: 2 } },
      );
      expect(fremdeZuweisung.status()).toBe(403);
      await karteOeffnen(page);
      await expect(page.getByTestId(`pb-konto-nr32-chatgpt-${viewerId}`)).toContainText("4,00 EUR");
    } finally {
      await fremderKontext.close();
    }
  } finally {
    // Zurück auf die Originalvorgabe — über denselben Produktweg, mit der dann gültigen Fassung.
    await page.unroute(`**${WEG}/perplexity-poc`).catch(() => undefined);
    const jetzt = await perplexity(page);
    if (jetzt.betragCent !== 2000 || jetzt.zeitraum !== "einmalig" || jetzt.waehrung !== "EUR") {
      const zurueck = await page.request.put(`${WEG}/perplexity-poc`, {
        data: {
          betrag: "20",
          waehrung: "EUR",
          zeitraum: "einmalig",
          fassung: jetzt.fassung,
          aenderungId: `smoke-zurueck-${zufall()}`,
        },
      });
      expect(zurueck.status()).toBe(200);
    }
  }
});
