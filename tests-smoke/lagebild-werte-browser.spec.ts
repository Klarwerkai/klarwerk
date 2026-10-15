import { type Browser, type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn, workspaceMarker } from "./support/auth";
import { schalteStufe2Ein } from "./support/import-json-kasten";

// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — REALE LAGEBILD-WERTE IM ECHTEN BROWSER (LWE-07).
// ================================================================================================
//
// Geklickt gegen den echten Smoke-Server, alle Konten, Spaces, Werte und Belege sind ERFUNDENE
// Testdaten. Diese technischen Proben sind keine Kunden- oder PoC-Bestätigung durch Menschen.
//
//   B1 · Kapital-Sicht (Verwaltung, Bereich „Ganzes Unternehmen“): Beispielrechnung ist als
//        geschätzt gekennzeichnet; ungültige und fehlende Angaben werden erklärt; gültige Werte
//        werden gespeichert, überstehen das Neuladen und ergeben dieselbe Formel wie die
//        Beispielrechnung — mit Kennzeichnung „eigene Annahme“.
//   B2 · Unbekannter Schreibausgang: die Antwort geht unterwegs verloren, nachdem der Server
//        geschrieben hat; „Erneut senden“ legt nichts doppelt an (Stand steigt genau einmal).
//   B3 · Paralleler Stand: eine andere Änderung kommt dazwischen — 409, die eigene Eingabe bleibt
//        im Formular, übernommen wird erst auf Klick.
//   B4 · Rollen im Arbeitsbereich: eine Anwenderin mit Schreibrecht pflegt die Werte ihres Space auf
//        der Spaceseite; eine Leserin sieht sie nur; eine fremde Person sieht weder Space noch Werte
//        und kann nicht schreiben (Server 403/404).
//
// MANDANT: eine Firma je Instanz (`instanzbindung.ts`); ein zweiter Mandant ist in dieser Suite
// nicht aufbaubar. Die Bereichsgrenze innerhalb der Instanz misst B4, die Instanzgrenze
// `tests/mandanten-isolation`.

const KENNWORT = "Lagebild-Passwort-1";

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

type Bereich = {
  bereich: string;
  werte: null | { version: number; werte: Record<string, { wert: number } | null> };
  fakten: { validatedKos: number; avgTrust: number };
};

async function bereichVon(page: Page, bereich: string): Promise<Bereich | undefined> {
  const res = await page.request.get("/api/management/lagebild-werte");
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as { bereiche: Bereich[] }).bereiche.find(
    (b) => b.bereich === bereich,
  );
}

async function validiertesObjekt(page: Page, m: string): Promise<void> {
  const angelegt = await page.request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: `Messplatz ${m}`,
      statement: `Der Messplatz ${m} wird vor jeder Schicht geprüft (erfunden).`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const ko = (await angelegt.json()) as { id: string };
  const gueltig = await page.request.put(`/api/kos/${ko.id}`, {
    data: { action: "admin-validate" },
  });
  expect(gueltig.status(), await gueltig.text()).toBe(200);
}

async function fuelle(
  page: Page,
  werte: { rate: string; stunden: string; reuse: string; beleg: string },
): Promise<void> {
  const karte = page.getByTestId("lagebild-werte");
  await karte.getByTestId("lagebild-von").fill("2025-07-01");
  await karte.getByTestId("lagebild-bis").fill("2025-09-30");
  await karte.getByTestId("lagebild-eingabe-hourlyRate").fill(werte.rate);
  await karte.getByTestId("lagebild-eingabe-hoursSavedPerValidatedKo").fill(werte.stunden);
  await karte.getByTestId("lagebild-herkunft-hoursSavedPerValidatedKo").selectOption("gemessen");
  await karte.getByTestId("lagebild-beleg-hoursSavedPerValidatedKo").fill(werte.beleg);
  await karte.getByTestId("lagebild-eingabe-reuseFactor").fill(werte.reuse);
}

/** Erwarteter Betrag nach der bestehenden Formel (knowledgeValuation.ts), deutsch formatiert. */
function erwarteteEur(fakten: Bereich["fakten"], rate: number, stunden: number, reuse: number) {
  const wert = Math.round(fakten.validatedKos * rate * stunden * reuse * (fakten.avgTrust / 100));
  return `${wert.toLocaleString("de-DE")} €`;
}

/** `/kapital` ist eine Stufe-2-Fläche der Verwaltung — eingeschaltet über den echten Bedienweg. */
async function verwaltungMitStufe2(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  await schalteStufe2Ein(page);
}

async function oeffneKapital(page: Page): Promise<void> {
  await page.goto("/kapital");
  await expect(page.getByTestId("lagebild-werte")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("lagebild-bereich-wahl")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("lagebild-bereich-wahl").selectOption("gesamt");
}

async function anmeldenIn(browser: Browser, email: string) {
  const adresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext(adresse === undefined ? {} : { baseURL: adresse });
  const seite = await kontext.newPage();
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  await seite.locator('input[type="email"]').fill(email);
  await seite.locator('input[type="password"]').first().fill(KENNWORT);
  await seite.locator('button[type="submit"]').click();
  await expect(workspaceMarker(seite)).toBeVisible({ timeout: 15_000 });
  if (await seite.getByTestId("notice-ack").count()) {
    await seite.getByTestId("notice-ack").click();
  }
  return { kontext, seite };
}

test.describe("Lagebild-Werte · reale Werte im echten Browser", () => {
  // B1–B3 teilen sich den Bereich „Ganzes Unternehmen“ des Smoke-Servers und zählen dessen Stand —
  // nacheinander, nicht gleichzeitig.
  test.describe.configure({ mode: "serial" });

  test("B1: Beispiel gekennzeichnet, Fehler erklärt, speichern, neu laden, gleiche Formel", async ({
    page,
  }) => {
    await verwaltungMitStufe2(page);
    const m = marke();
    await validiertesObjekt(page, m);
    await oeffneKapital(page);

    await expect(page.getByTestId("kapital-beispiel-kennzeichnung")).toContainText(
      "geschätzte Beispielwerte",
    );
    await expect(page.getByTestId("kapital-beispielrechnung")).not.toContainText(
      "Reale Werte für die Wissensbewertung",
    );

    const karte = page.getByTestId("lagebild-werte");
    const vorher = (await bereichVon(page, "gesamt"))?.werte?.version ?? 0;
    await karte.getByTestId("lagebild-bearbeiten").click();

    // Ungültig: Text statt Zahl — clientseitig erklärt, nichts gesendet.
    await karte.getByTestId("lagebild-eingabe-hourlyRate").fill("siebzig");
    await karte.getByTestId("lagebild-speichern").click();
    await expect(karte.getByTestId("lagebild-fehler")).toContainText(
      "Stundensatz: bitte eine Zahl eingeben.",
    );

    // Fehlend: gemessen ohne Beleg — der Server erklärt es, gespeichert wird nichts.
    await fuelle(page, { rate: "72,5", stunden: "1,5", reuse: "4", beleg: "" });
    await karte.getByTestId("lagebild-speichern").click();
    await expect(karte.getByTestId("lagebild-fehler")).toContainText("bitte den Beleg nennen", {
      timeout: 15_000,
    });
    expect((await bereichVon(page, "gesamt"))?.werte?.version ?? 0).toBe(vorher);

    await karte
      .getByTestId("lagebild-beleg-hoursSavedPerValidatedKo")
      .fill(`Zeiterfassung ${m} (erfunden)`);
    await karte.getByTestId("lagebild-speichern").click();
    await expect(karte.getByTestId("lagebild-meldung")).toContainText(
      `Gespeichert — Stand ${vorher + 1}.`,
      { timeout: 15_000 },
    );

    // Wiederöffnen: neu laden, der gespeicherte Stand steht da.
    await page.reload();
    await oeffneKapital(page);
    const anzeige = page.getByTestId("lagebild-anzeige");
    await expect(anzeige).toHaveAttribute("data-version", String(vorher + 1), { timeout: 15_000 });
    const stunden = anzeige.locator(
      '[data-testid="lagebild-zeile"][data-feld="hoursSavedPerValidatedKo"]',
    );
    await expect(stunden).toHaveAttribute("data-herkunft", "gemessen");
    await expect(stunden).toContainText(`Zeiterfassung ${m} (erfunden)`);
    await expect(
      anzeige.locator('[data-testid="lagebild-zeile"][data-feld="hourlyRate"]'),
    ).toContainText("72,5");

    const fakten = (await bereichVon(page, "gesamt"))?.fakten;
    expect(fakten).toBeDefined();
    await expect(page.getByTestId("lagebild-ergebnis-eur")).toHaveText(
      erwarteteEur(fakten as Bereich["fakten"], 72.5, 1.5, 4),
    );
    await expect(page.getByTestId("lagebild-art")).toHaveAttribute("data-art", "eigene_annahme");
  });

  test("B2: Antwort geht verloren, nachdem der Server schrieb — „Erneut senden“ legt nichts doppelt an", async ({
    page,
  }) => {
    await verwaltungMitStufe2(page);
    await oeffneKapital(page);
    const karte = page.getByTestId("lagebild-werte");
    const vorher = (await bereichVon(page, "gesamt"))?.werte?.version ?? 0;
    await karte.getByTestId("lagebild-bearbeiten").click();
    await fuelle(page, { rate: "65", stunden: "2", reuse: "3", beleg: "Auswertung B2 (erfunden)" });

    let erste = true;
    await page.route("**/api/management/lagebild-werte/gesamt", async (route) => {
      if (erste && route.request().method() === "PUT") {
        erste = false;
        // Der Server bekommt die Anfrage und schreibt — die Antwort erreicht den Browser nicht.
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await karte.getByTestId("lagebild-speichern").click();
    await expect(karte.getByTestId("lagebild-unbekannt")).toContainText(
      "Ob gespeichert wurde, ist unbekannt",
      { timeout: 15_000 },
    );
    await expect(karte.getByTestId("lagebild-eingabe-hourlyRate")).toHaveValue("65");
    expect((await bereichVon(page, "gesamt"))?.werte?.version).toBe(vorher + 1);

    await karte.getByTestId("lagebild-erneut").click();
    await expect(karte.getByTestId("lagebild-meldung")).toContainText("bereits gespeichert", {
      timeout: 15_000,
    });
    expect((await bereichVon(page, "gesamt"))?.werte?.version).toBe(vorher + 1);
  });

  test("B3: paralleler Stand — 409, eigene Eingabe bleibt, übernommen wird erst auf Klick", async ({
    page,
  }) => {
    await verwaltungMitStufe2(page);
    await oeffneKapital(page);
    const karte = page.getByTestId("lagebild-werte");
    let stand = (await bereichVon(page, "gesamt"))?.werte?.version ?? 0;
    if (stand === 0) {
      const erst = await page.request.put("/api/management/lagebild-werte/gesamt", {
        data: {
          zeitraumVon: "2025-07-01",
          zeitraumBis: "2025-09-30",
          werte: {
            hourlyRate: { wert: 60, herkunft: "eigene_eingabe" },
            hoursSavedPerValidatedKo: null,
            reuseFactor: null,
          },
          basisVersion: 0,
          anfrageId: `b3-erst-${marke()}`,
        },
      });
      expect(erst.status(), await erst.text()).toBe(200);
      stand = 1;
      await page.reload();
      await oeffneKapital(page);
    }
    await karte.getByTestId("lagebild-bearbeiten").click();
    await karte.getByTestId("lagebild-eingabe-hourlyRate").fill("77");

    // Eine andere Änderung kommt dazwischen (zweiter Tab, andere berechtigte Person).
    const dazwischen = await page.request.put("/api/management/lagebild-werte/gesamt", {
      data: {
        zeitraumVon: "2025-07-01",
        zeitraumBis: "2025-09-30",
        werte: {
          hourlyRate: { wert: 91, herkunft: "eigene_eingabe" },
          hoursSavedPerValidatedKo: null,
          reuseFactor: null,
        },
        basisVersion: stand,
        anfrageId: `b3-dazwischen-${marke()}`,
      },
    });
    expect(dazwischen.status(), await dazwischen.text()).toBe(200);

    await karte.getByTestId("lagebild-speichern").click();
    const konflikt = karte.getByTestId("lagebild-konflikt");
    await expect(konflikt).toContainText("Ihre Eingabe wurde nicht gespeichert", {
      timeout: 15_000,
    });
    await expect(konflikt.getByTestId("lagebild-anzeige")).toHaveAttribute(
      "data-version",
      String(stand + 1),
    );
    await expect(karte.getByTestId("lagebild-eingabe-hourlyRate")).toHaveValue("77");
    expect((await bereichVon(page, "gesamt"))?.werte?.werte.hourlyRate?.wert).toBe(91);

    await konflikt.getByTestId("lagebild-uebernehmen").click();
    await expect(karte.getByTestId("lagebild-form")).toHaveCount(0);
    await expect(
      page.locator('[data-testid="lagebild-zeile"][data-feld="hourlyRate"]').first(),
    ).toContainText("91", { timeout: 15_000 });
  });

  test("B4: Anwenderin pflegt ihren Arbeitsbereich, Leserin liest nur, Fremde sieht nichts", async ({
    page,
    browser,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const konten = {
      anna: { name: `Anna Anwenderin ${m}`, email: `anna-${m}@klarwerk.test`, role: "experte" },
      lena: { name: `Lena Leserin ${m}`, email: `lena-${m}@klarwerk.test`, role: "viewer" },
      fred: { name: `Fred Fremd ${m}`, email: `fred-${m}@klarwerk.test`, role: "experte" },
    };
    for (const k of Object.values(konten)) {
      const res = await page.request.post("/api/users", {
        data: { name: k.name, email: k.email, password: KENNWORT, role: k.role },
      });
      expect(res.status(), await res.text()).toBe(201);
    }
    const verzeichnis = (await (await page.request.get("/api/spaces/konten")).json()) as {
      konten: { id: string; name: string }[];
    };
    const id = (name: string): string => verzeichnis.konten.find((x) => x.name === name)?.id ?? "";
    const raum = await page.request.post("/api/spaces", {
      data: {
        name: `Werkstatt ${m}`,
        zweck: `Prüfstände der Werkstatt ${m} (erfunden).`,
        verantwortlich: id(SMOKE_NAME),
        zugang: "mitglieder",
        mitglieder: [
          { nutzer: id(konten.anna.name), recht: "schreiben" },
          { nutzer: id(konten.lena.name), recht: "lesen" },
        ],
        ansichten: [],
      },
    });
    expect(raum.status(), await raum.text()).toBe(201);
    const spaceId = ((await raum.json()) as { id: string }).id;

    // Anna (Schreibrecht) pflegt auf der Spaceseite.
    const anna = await anmeldenIn(browser, konten.anna.email);
    try {
      await anna.seite.goto(`/spaces/${spaceId}`);
      await expect(anna.seite.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
      await anna.seite.getByTestId("lagebild-space-knopf").click();
      const karte = anna.seite.getByTestId("lagebild-werte");
      await expect(karte).toHaveAttribute("data-bereich", spaceId, { timeout: 15_000 });
      await expect(karte.getByTestId("lagebild-leer")).toBeVisible();
      await karte.getByTestId("lagebild-bearbeiten").click();
      await fuelle(anna.seite, {
        rate: "58",
        stunden: "-0,5",
        reuse: "2",
        beleg: `Zusatzaufwand ${m} (erfunden)`,
      });
      await karte.getByTestId("lagebild-speichern").click();
      await expect(karte.getByTestId("lagebild-meldung")).toContainText("Gespeichert — Stand 1.", {
        timeout: 15_000,
      });
      await anna.seite.reload();
      await anna.seite.getByTestId("lagebild-space-knopf").click();
      await expect(anna.seite.getByTestId("lagebild-anzeige")).toHaveAttribute(
        "data-version",
        "1",
        { timeout: 15_000 },
      );
      await expect(
        anna.seite.locator('[data-testid="lagebild-zeile"][data-feld="hoursSavedPerValidatedKo"]'),
      ).toContainText("-0,5");
      // Ohne validierte Objekte im Raum: kein Geldwert, sondern der Grund.
      await expect(
        anna.seite.locator(
          '[data-testid="lagebild-grund"][data-grund="keine_validierten_objekte"]',
        ),
      ).toBeVisible();
    } finally {
      await anna.kontext.close();
    }

    // Lena (nur Leserecht, Rolle viewer) sieht die Werte, aber keinen Eingabeweg.
    const lena = await anmeldenIn(browser, konten.lena.email);
    try {
      await lena.seite.goto(`/spaces/${spaceId}`);
      await expect(lena.seite.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
      await lena.seite.getByTestId("lagebild-space-knopf").click();
      await expect(lena.seite.getByTestId("lagebild-anzeige")).toHaveAttribute(
        "data-version",
        "1",
        { timeout: 15_000 },
      );
      await expect(lena.seite.getByTestId("lagebild-nur-lesen")).toBeVisible();
      await expect(lena.seite.getByTestId("lagebild-bearbeiten")).toHaveCount(0);
      const versuch = await lena.seite.request.put(`/api/management/lagebild-werte/${spaceId}`, {
        data: { basisVersion: 1, anfrageId: `lena-${m}-0001` },
      });
      expect(versuch.status()).toBe(403);
    } finally {
      await lena.kontext.close();
    }

    // Fred (kein Mitglied) sieht weder den Raum noch seine Werte und kann nicht schreiben.
    const fred = await anmeldenIn(browser, konten.fred.email);
    try {
      await fred.seite.goto(`/spaces/${spaceId}`);
      await expect(fred.seite.getByTestId("space-nicht-gefunden")).toBeVisible({ timeout: 15_000 });
      await expect(fred.seite.getByTestId("lagebild-space-knopf")).toHaveCount(0);
      const lesen = await fred.seite.request.get("/api/management/lagebild-werte");
      expect(lesen.status()).toBe(200);
      const text = await lesen.text();
      expect(text).not.toContain(spaceId);
      expect(text).not.toContain(`Zusatzaufwand ${m}`);
      const schreiben = await fred.seite.request.put(`/api/management/lagebild-werte/${spaceId}`, {
        data: { basisVersion: 1, anfrageId: `fred-${m}-0001` },
      });
      expect(schreiben.status()).toBe(404);
    } finally {
      await fred.kontext.close();
    }

    // Der Stand ist unverändert der von Anna.
    expect((await bereichVon(page, spaceId))?.werte?.version).toBe(1);
  });
});
