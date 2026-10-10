import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-05 · DER GEMEINSAME ÜBERGABEABLAUF IN DER ECHTEN APP — ein Einstieg, Ausscheiden vollständig.
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server
// (produkt:20261007:ownership-uebergabe:admin-20261009). ISOLIERTER TEST mit erfundenen Konten:
// Paula scheidet aus; bei ihr liegen drei Beiträge, ein Entwurf und eine Prüfaufgabe. Nora
// (experte) und Otto (controller) übernehmen.
//   K1    · Ein Einstieg erklärt beide Umfänge; geöffnet ist nur einer, mit EINEM Nachfolgerfeld.
//   K2    · Zwei Pakete in der Vorschau; vor dem Bestätigen ist nichts geändert.
//   K3    · Danach Autor und Fassung unverändert (vom Server gelesen).
//   K5    · Zugang endet erst ohne Restbestand; beide Zugangswege erklärt, Vertretung sichtbar.
//   K6    · Nach dem Neuladen steht die Abschlussbilanz aus dem Prüfprotokoll da; Abbrechen ändert
//           nichts.
//   K4    · Ein Teilfehler wird genannt, „Offene erneut übertragen" holt den Rest nach.
//   Bedienung · 390 × 844 und 1280 × 800 ohne Überbreite, per Tastatur mit sichtbarem Fokus.
//
// WAS AM K4-FALL SIMULIERT IST — ehrlich benannt: der Smoke-Server hat keinen Störschalter. Der
// erste Ablaufaufruf wird deshalb unterwegs verändert: ein Beitrag wird aus der Anfrage genommen und
// der Rest als gezielte Übergabe mit unverändertem Zugang geschickt (der Server überträgt den
// Beitrag also WIRKLICH nicht). Die echte Antwort bekommt für ihn eine offene `SCHREIBFEHLER`-Zeile
// und den Status 207 — die Gestalt, die der Server bei einem Schreibfehler sendet (gemessen in
// `tests/uebergabe-ablauf/ablauf-api.test.ts`). Die Wiederholung läuft unverändert gegen den Server.

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
  name: string,
  email: string,
  role: string,
): Promise<string> {
  const res = await request.post("/api/users", {
    data: { name, email, password: SMOKE_PASS, role },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function beitragAnlegen(
  request: APIRequestContext,
  titel: string,
): Promise<{ id: string; version: number; author: string }> {
  const angelegt = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} wird vor jeder Schicht geprüft.`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return (await angelegt.json()) as { id: string; version: number; author: string };
}

/** Ein Beitrag, für den `owner` hauptverantwortlich ist (Autor bleibt das Smoke-Konto). */
async function beitragFuer(request: APIRequestContext, titel: string, owner: string) {
  const ko = await beitragAnlegen(request, titel);
  const gesetzt = await request.put(`/api/kos/${ko.id}`, {
    data: { action: "ownership", ownership: { owner } },
  });
  expect(gesetzt.status(), await gesetzt.text()).toBe(200);
  return ko;
}

async function lesen(request: APIRequestContext, koId: string) {
  const res = await request.get(`/api/kos/${koId}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as { version: number; author: string; ownership?: { owner?: string } };
}

/** Paula, Nora, Otto — und bei Paula drei Beiträge, ein Entwurf und eine Prüfaufgabe. */
async function buehne(page: Page, request: APIRequestContext) {
  const m = marke();
  const namen = { paula: `Paula ${m}`, nora: `Nora ${m}`, otto: `Otto ${m}` };
  const paulaMail = `paula-${m}@ablauf.test`;
  const ids = {
    paula: await kontoAnlegen(page.request, namen.paula, paulaMail, "experte"),
    nora: await kontoAnlegen(page.request, namen.nora, `nora-${m}@ablauf.test`, "experte"),
    otto: await kontoAnlegen(page.request, namen.otto, `otto-${m}@ablauf.test`, "controller"),
  };
  const k1 = await beitragFuer(page.request, `Messschieber ${m}`, ids.paula);
  const k2 = await beitragFuer(page.request, `Lehrring ${m}`, ids.paula);
  const k3 = await beitragFuer(page.request, `Prüfstift ${m}`, ids.paula);
  // Die Prüfaufgabe: ein Beitrag des Smoke-Kontos, Paula zur Prüfung zugewiesen.
  const p1 = await beitragAnlegen(page.request, `Prüfplan ${m}`);
  const zugewiesen = await page.request.put(`/api/kos/${p1.id}`, {
    data: { action: "assign", userIds: [ids.paula] },
  });
  expect(zugewiesen.status(), await zugewiesen.text()).toBe(204);
  // Der Entwurf: Paula legt ihn selbst an (eigener Anfragekontext, nicht die Sitzung der Seite).
  const anmeldung = await request.post("/api/auth/login", {
    data: { email: paulaMail, password: SMOKE_PASS },
  });
  expect(anmeldung.status()).toBe(200);
  const token = ((await anmeldung.json()) as { token: string }).token;
  const entwurf = await request.post("/api/drafts", {
    headers: { authorization: `Bearer ${token}` },
    data: {
      title: `Entwurf ${m}`,
      statement: "Fiktiver Entwurf für den Übergabeablauf.",
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(entwurf.status(), await entwurf.text()).toBe(201);
  const entwurfId = ((await entwurf.json()) as { id: string }).id;
  return { m, namen, ids, paulaMail, k1, k2, k3, p1, entwurfId };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function ablaufOeffnen(page: Page, personId: string): Promise<void> {
  await page.goto(`/admin?bereich=konten&detail=${encodeURIComponent(`nutzer:${personId}`)}`);
  await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("uebergabe-einstieg")).toBeVisible();
  await page.getByTestId("ablauf-oeffnen").click();
  await expect(page.getByTestId("ablauf-flaeche")).toBeVisible({ timeout: 15_000 });
}

const zeile = (page: Page, art: string, id: string) =>
  page.locator(`[data-testid="ablauf-zeile"][data-art="${art}"][data-id="${id}"]`);

/** Nora: zwei Beiträge und der Entwurf. Otto: der Rest (ein Beitrag, die Prüfaufgabe). */
async function verteilen(page: Page, b: Buehne): Promise<void> {
  await expect(page.getByTestId("ablauf-zeile")).toHaveCount(5, { timeout: 15_000 });
  for (const [art, id] of [
    ["beitrag", b.k1.id],
    ["beitrag", b.k2.id],
    ["entwurf", b.entwurfId],
  ] as const) {
    await zeile(page, art, id).getByTestId("ablauf-auswahl").check();
  }
  await page.getByTestId("ablauf-ziel").selectOption({ label: b.namen.nora });
  await page.getByTestId("ablauf-zuteilen").click();
  await page.getByTestId("ablauf-ziel").selectOption({ label: b.namen.otto });
  await page.getByTestId("ablauf-rest").click();
  await expect(page.getByTestId("ablauf-stand")).toHaveText("5 von 5 zugeteilt");
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.getByTestId("detail-nutzer").screenshot(),
    contentType: "image/png",
  });
}

test.describe("Übergabeablauf · ein Einstieg in der echten App", () => {
  test("K1/K2/K3/K5/K6: auf zwei Nachfolger verteilen, Zugang beenden, Bilanz nach Neuladen", async ({
    page,
    request,
  }) => {
    await ensureLoggedIn(page);
    const b = await buehne(page, request);
    await ablaufOeffnen(page, b.ids.paula);

    // K1: beide Umfänge erklärt — und in der Übergabe genau EIN Nachfolgerfeld.
    const einstieg = page.getByTestId("uebergabe-einstieg");
    await expect(einstieg.locator('[data-umfang="gezielt"]')).toBeVisible();
    await expect(einstieg.locator('[data-umfang="ausscheiden"]')).toBeVisible();
    await expect(einstieg.locator("select")).toHaveCount(1);
    await expect(page.getByTestId("verantwortung-bereich")).toHaveCount(0);
    // K5: beide Zugangswege getrennt erklärt, die Vertretung benannt (Otto darf prüfen).
    await expect(page.getByTestId("ablauf-zugang-beenden-erklaerung")).toBeVisible();
    await expect(page.getByTestId("ablauf-zugang-sperren-erklaerung")).toBeVisible();
    await expect(page.getByTestId("ablauf-vertretung")).toContainText(b.namen.otto);

    await verteilen(page, b);
    await page.getByTestId("ablauf-zugang-beenden").check();
    await page.getByTestId("ablauf-vorschau-holen").click();
    const vorschau = page.getByTestId("ablauf-vorschau");
    await expect(vorschau).toHaveAttribute("data-bestaetigbar", "ja", { timeout: 15_000 });
    await expect(vorschau.locator(`[data-an="${b.ids.nora}"]`)).toHaveAttribute("data-anzahl", "3");
    await expect(vorschau.locator(`[data-an="${b.ids.otto}"]`)).toHaveAttribute("data-anzahl", "2");
    await expect(vorschau.locator(`[data-an="${b.ids.nora}"]`)).toContainText(
      "bisher private Entwürfe",
    );
    await expect(vorschau.locator(`[data-an="${b.ids.otto}"]`)).toContainText(
      "offene Prüfaufgaben",
    );
    await expect(page.getByTestId("ablauf-zugang-plan")).toContainText("Zugang beendet");
    await bild(page, "1-vorschau-zwei-pakete");
    // Vor dem Bestätigen ist nichts geschehen.
    expect((await lesen(page.request, b.k1.id)).ownership?.owner).toBe(b.ids.paula);

    await page.getByTestId("ablauf-bestaetigen").click();
    const ergebnis = page.getByTestId("ablauf-ergebnis");
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "ja", { timeout: 15_000 });
    await expect(page.getByTestId("ablauf-ergebnis-zugang")).toHaveAttribute(
      "data-zugang",
      "abgelaufen",
    );
    await expect(page.getByTestId("ablauf-ergebnis-nachher")).toHaveAttribute(
      "data-beitraege",
      "0",
    );
    await bild(page, "2-abschlussbilanz");
    for (const [ko, an] of [
      [b.k1, b.ids.nora],
      [b.k2, b.ids.nora],
      [b.k3, b.ids.otto],
    ] as const) {
      const nachher = await lesen(page.request, ko.id);
      expect(nachher.ownership?.owner).toBe(an);
      expect(nachher.author).toBe(ko.author);
      expect(nachher.version).toBe(ko.version);
    }
    const anmeldung = await request.post("/api/auth/login", {
      data: { email: b.paulaMail, password: SMOKE_PASS },
    });
    expect(anmeldung.status()).toBe(403);

    // K6: Neuladen — die Bilanz kommt aus dem Prüfprotokoll.
    await page.reload();
    await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
    const bilanz = page.getByTestId("ablauf-letzte-bilanz");
    await expect(bilanz).toContainText("Ausscheiden", { timeout: 15_000 });
    await expect(bilanz).toContainText(`${b.namen.nora}: 2 Beiträge, 1 Vorgänge`);
    await expect(bilanz).toContainText(`${b.namen.otto}: 1 Beiträge, 1 Vorgänge`);
    await expect(page.getByTestId("ablauf-letzte-nachher")).toHaveAttribute("data-beitraege", "0");
    await expect(page.getByTestId("konto-protokoll")).toContainText("Übergabe abgeschlossen");
    await bild(page, "3-bilanz-nach-neuladen");
  });

  test("K6: Abbrechen nach der Vorschau ändert weder Zuordnung noch Zugang", async ({
    page,
    request,
  }) => {
    await ensureLoggedIn(page);
    const b = await buehne(page, request);
    await ablaufOeffnen(page, b.ids.paula);
    await verteilen(page, b);
    await page.getByTestId("ablauf-zugang-beenden").check();
    await page.getByTestId("ablauf-vorschau-holen").click();
    await expect(page.getByTestId("ablauf-vorschau")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("ablauf-abbrechen").click();
    await expect(page.getByTestId("ablauf-flaeche")).toHaveCount(0);
    await expect(page.getByTestId("ablauf-oeffnen")).toBeVisible();
    expect((await lesen(page.request, b.k1.id)).ownership?.owner).toBe(b.ids.paula);
    const anmeldung = await request.post("/api/auth/login", {
      data: { email: b.paulaMail, password: SMOKE_PASS },
    });
    expect(anmeldung.status()).toBe(200);
    await expect(page.getByTestId("ablauf-letzte-bilanz")).toContainText("Noch keine Übergabe");
  });

  test("K4: ein Teilfehler wird genannt, der Zugang bleibt — Wiederaufnahme holt den Rest nach", async ({
    page,
    request,
  }) => {
    await ensureLoggedIn(page);
    const b = await buehne(page, request);
    let erster = true;
    await page.route("**/api/verantwortung/ablauf", async (route) => {
      if (!erster || route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      erster = false;
      const eingabe = route.request().postDataJSON() as {
        beitraege: { koId: string; an: string }[];
      } & Record<string, unknown>;
      const zurueck = eingabe.beitraege.find((z) => z.koId === b.k2.id);
      const postData = JSON.stringify({
        ...eingabe,
        umfang: "gezielt",
        zugang: "behalten",
        beitraege: eingabe.beitraege.filter((z) => z.koId !== b.k2.id),
      });
      const antwort = await route.fetch({ postData });
      const echt = (await antwort.json()) as Record<string, unknown>;
      await route.fulfill({
        response: antwort,
        status: 207,
        json: {
          ...echt,
          vollstaendig: false,
          offen: [
            {
              art: "beitrag",
              id: b.k2.id,
              titel: `Lehrring ${b.m}`,
              an: zurueck?.an ?? b.ids.nora,
              anName: b.namen.nora,
              grund: "SCHREIBFEHLER",
              text: "Der Beitrag konnte nicht gespeichert werden. Er ist unverändert und kann erneut übertragen werden.",
            },
          ],
        },
      });
    });

    await ablaufOeffnen(page, b.ids.paula);
    await verteilen(page, b);
    await page.getByTestId("ablauf-zugang-beenden").check();
    await page.getByTestId("ablauf-vorschau-holen").click();
    await expect(page.getByTestId("ablauf-vorschau")).toHaveAttribute("data-bestaetigbar", "ja", {
      timeout: 15_000,
    });
    await page.getByTestId("ablauf-bestaetigen").click();

    const ergebnis = page.getByTestId("ablauf-ergebnis");
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "nein", { timeout: 15_000 });
    await expect(page.getByTestId("ablauf-offen").locator(`[data-id="${b.k2.id}"]`)).toContainText(
      "erneut übertragen",
    );
    await expect(page.getByTestId("ablauf-uebertragen").locator("li")).toHaveCount(4);
    await expect(page.getByTestId("ablauf-ergebnis-zugang")).toHaveAttribute(
      "data-zugang",
      "aktiv",
    );
    await bild(page, "4-teilfehler");
    expect((await lesen(page.request, b.k1.id)).ownership?.owner).toBe(b.ids.nora);
    expect((await lesen(page.request, b.k2.id)).ownership?.owner).toBe(b.ids.paula);
    const nochDa = await request.post("/api/auth/login", {
      data: { email: b.paulaMail, password: SMOKE_PASS },
    });
    expect(nochDa.status()).toBe(200);

    await page.getByTestId("ablauf-wiederaufnehmen").click();
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "ja", { timeout: 15_000 });
    await expect(page.getByTestId("ablauf-ergebnis-zugang")).toHaveAttribute(
      "data-zugang",
      "abgelaufen",
    );
    await expect(ergebnis).toContainText("4 lagen bereits beim Ziel");
    expect((await lesen(page.request, b.k2.id)).ownership?.owner).toBe(b.ids.nora);
    await bild(page, "5-wiederaufnahme");
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`Bedienung: ${breite} × ${hoehe} — ohne Überbreite, per Tastatur mit sichtbarem Fokus`, async ({
      page,
      request,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const b = await buehne(page, request);
      await page.goto(
        `/admin?bereich=konten&detail=${encodeURIComponent(`nutzer:${b.ids.paula}`)}`,
      );
      await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });

      const fokus = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {
            testId: el.getAttribute("data-testid") ?? "",
            sichtbar: el.matches(":focus-visible"),
            imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
          };
        });
      const ueberbreit = () =>
        page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

      // Mit der Tastatur öffnen.
      await page.getByTestId("ablauf-oeffnen").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("ablauf-flaeche")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("ablauf-zeile")).toHaveCount(5, { timeout: 15_000 });
      expect(await ueberbreit(), "die Übergabe ist breiter als das Fenster").toBe(false);

      // Tab bis zum ersten Haken; Leertaste hakt an, der Fokus ist sichtbar und im Fenster.
      for (let i = 0; i < 40 && (await fokus())?.testId !== "ablauf-auswahl"; i += 1) {
        await page.keyboard.press(tab);
      }
      const amHaken = await fokus();
      expect(amHaken?.testId, "der Haken ist per Tab nicht erreichbar").toBe("ablauf-auswahl");
      expect(amHaken?.sichtbar, "kein :focus-visible am Haken").toBe(true);
      expect(amHaken?.imFenster).toBe(true);
      await page.keyboard.press("Space");
      await expect(page.getByTestId("ablauf-auswahl").first()).toBeChecked();

      // Verteilen und Vorschau — auch dann ohne Überbreite.
      await page.getByTestId("ablauf-auswahl").first().uncheck();
      await verteilen(page, b);
      await page.getByTestId("ablauf-vorschau-holen").click();
      await expect(page.getByTestId("ablauf-vorschau")).toBeVisible({ timeout: 15_000 });
      expect(await ueberbreit(), "die Vorschau ist breiter als das Fenster").toBe(false);
      await bild(page, `6-vorschau-${breite}`);

      // Rückweg per Tastatur: Abbrechen schließt, ohne etwas zu ändern.
      await page.getByTestId("ablauf-abbrechen").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("ablauf-flaeche")).toHaveCount(0);
      await expect(page.getByTestId("ablauf-oeffnen")).toBeVisible();
      expect((await lesen(page.request, b.k1.id)).ownership?.owner).toBe(b.ids.paula);
    });
  }
});
