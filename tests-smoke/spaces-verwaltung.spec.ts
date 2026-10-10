import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-07 · SPACES VERWALTEN IN DER ECHTEN APP (produkt:20261007:spaces:admin-20261009).
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server (isolierter Testbestand im
// Speicher); die Bilder hängen am nativen Bericht. Jeder Lauf hat eigene, erfundene Namen
// (Laufmarke), damit Konten, Teams und Spaces anderer Specs nicht stören.
//
//   K1 · Übersicht: Suche, Status-/Gruppenfilter, Gliederung nach Gruppe; Zweck, Zuständigkeit,
//        Mitgliederzahl, Status, Regeln; „Space · Wissensbereich" statt Funktionsseite. Filter
//        überleben das Neuladen (Adresse).
//   K2 · Detail: Zugriff je Person mit Herkunft (direkt / Team / zuständig).
//   K3 · Eine zweite, unberechtigte Sitzung: direkter Link auf Space und Artikel ohne Inhalt.
//   K4 · Artikelseite: die Vorschau des Spacewechsels nennt die Regeln vorher/nachher.
//   K5 · Archivieren: Folgen zuerst (Fokus auf der Überschrift), Begründung, Status nach Reload,
//        Verlauf mit Begründung, Wiederaufnahme.
//   K6 · Bestand zuordnen: Bilanz vorher, Übernahme, Protokoll nach Reload.
//   Bedienung · 390 × 844 und 1280 × 800: ohne Überbreite, Archivfolgen per Tastatur.
//
// WAS HIER NICHT GEMESSEN IST: ein echter, unvertrauter Mensch, echte Mitarbeiterkonten und
// PostgreSQL (der Smoke-Server läuft im Speicher). Die Rechtewirkung über alle Lesewege misst
// `tests/spaces/spaces-verwaltung-api.test.ts` am Draht.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

interface Konto {
  id: string;
  name: string;
  email: string;
}

async function kontoAnlegen(
  request: APIRequestContext,
  daten: { name: string; email: string; role: string },
): Promise<Konto> {
  const res = await request.post("/api/users", { data: { ...daten, password: SMOKE_PASS } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Konto;
}

async function ich(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/auth/me");
  expect(res.status()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

async function spaceAnlegen(
  request: APIRequestContext,
  daten: Record<string, unknown>,
): Promise<string> {
  const res = await request.post("/api/spaces", {
    data: { zugang: "mitglieder", ansichten: [], mitglieder: [], ...daten },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function artikel(request: APIRequestContext, titel: string, tags: string[] = []) {
  const res = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} wird vor jeder Schicht geprüft (fiktiv).`,
      type: "best_practice",
      category: "Prüfmittel",
      tags,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function hineinlegen(request: APIRequestContext, koId: string, spaceId: string) {
  const v = await request.post("/api/spaces/verschiebung/vorschau", {
    data: { koId, zielSpaceId: spaceId },
  });
  expect(v.status(), await v.text()).toBe(200);
  const p = (await v.json()) as { ziel: { version: number } };
  const w = await request.post("/api/spaces/verschiebung", {
    data: {
      koId,
      zielSpaceId: spaceId,
      basis: { quelleId: null, quelleVersion: null, zielId: spaceId, zielVersion: p.ziel.version },
    },
  });
  expect(w.status(), await w.text()).toBe(200);
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

const karte = (page: Page, id: string) =>
  page.locator(`[data-testid="space-eintrag"][data-space="${id}"]`);

test.describe("ADMIN-07 · Spaces mit Mitgliedern, Regeln und Verantwortlichen", () => {
  test("Lieferbeleg: Übersicht, Zugriffsherkunft, Regeln im Wechsel, Archiv, Bestand, Fremdsitzung (K1–K6)", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (baseURL === undefined) {
      throw new Error("baseURL fehlt in der Smoke-Konfiguration.");
    }
    await ensureLoggedIn(page);
    const m = marke();
    const adminId = await ich(page.request);
    const erik = await kontoAnlegen(page.request, {
      name: `Erik Experte ${m}`,
      email: `erik-${m}@admin07.test`,
      role: "experte",
    });
    const vera = await kontoAnlegen(page.request, {
      name: `Vera Viewer ${m}`,
      email: `vera-${m}@admin07.test`,
      role: "viewer",
    });
    const fritz = await kontoAnlegen(page.request, {
      name: `Fritz Fremd ${m}`,
      email: `fritz-${m}@admin07.test`,
      role: "experte",
    });
    const team = await page.request.post("/api/teams", {
      data: {
        name: `Messtechnik ${m}`,
        zweck: "Teamweg für den Lieferbeleg (fiktiv).",
        verantwortlich: adminId,
        mitglieder: [vera.id],
      },
    });
    expect(team.status(), await team.text()).toBe(201);
    const teamId = ((await team.json()) as { id: string }).id;
    const werkstatt = await spaceAnlegen(page.request, {
      name: `Werkstatt ${m}`,
      zweck: `Prüfmittel der Werkstatt ${m} (fiktiv).`,
      verantwortlich: adminId,
      mitglieder: [{ nutzer: erik.id, recht: "lesen" }],
      teams: [{ team: teamId, recht: "lesen" }],
      gruppe: `Produktion ${m}`,
      regeln: `Nur freigegebene Anweisungen ${m}.`,
    });
    const labor = await spaceAnlegen(page.request, {
      name: `Labor ${m}`,
      zweck: `Kalibrierung im Labor ${m} (fiktiv).`,
      verantwortlich: adminId,
      gruppe: `Qualität ${m}`,
      regeln: `Kalibrierschein Pflicht ${m}.`,
    });
    const koWerkstatt = await artikel(page.request, `Drehmoment ${m}`);
    await hineinlegen(page.request, koWerkstatt, werkstatt);

    // --- K1 · Übersicht mit Suche, Filter und Gruppierung --------------------------------------
    await page.goto("/spaces");
    await expect(page.getByTestId("spaces-art-hinweis")).toContainText("keine Funktionsseite", {
      timeout: 15_000,
    });
    await page.getByTestId("spaces-suche").fill(m);
    await expect(karte(page, werkstatt)).toBeVisible();
    await expect(karte(page, labor)).toBeVisible();
    await expect(page.getByTestId("spaces-treffer")).toContainText("von");
    const w = karte(page, werkstatt);
    await expect(w.getByTestId("space-art")).toContainText("Wissensbereich");
    await expect(w.getByTestId("space-status")).toContainText("Aktiv");
    await expect(w.getByTestId("space-zustaendig")).toBeVisible();
    await expect(w.getByTestId("space-mitgliederzahl")).toContainText("2 Mitglieder");
    await expect(w.getByTestId("space-regeln-text")).toContainText(
      `Nur freigegebene Anweisungen ${m}`,
    );
    await page.getByTestId("spaces-filter-gruppe").selectOption(`Qualität ${m}`);
    await expect(karte(page, werkstatt)).toHaveCount(0);
    await expect(karte(page, labor)).toBeVisible();
    await page.reload();
    // Die Filter stehen in der Adresse und überleben das Neuladen.
    await expect(page.getByTestId("spaces-suche")).toHaveValue(m, { timeout: 15_000 });
    await expect(karte(page, labor)).toBeVisible();
    await expect(karte(page, werkstatt)).toHaveCount(0);
    await page.getByTestId("spaces-filter-gruppe").selectOption("");
    await page.getByTestId("spaces-gruppieren").check();
    const abschnitt = page.getByTestId("spaces-abschnitt").filter({ hasText: `Produktion ${m}` });
    await expect(abschnitt).toHaveCount(1);
    await expect(abschnitt.locator(`[data-space="${werkstatt}"]`)).toBeVisible();
    await bild(page, "1-uebersicht-gegliedert");

    // --- K2 · Zugriff mit Herkunft --------------------------------------------------------------
    await karte(page, werkstatt).getByTestId("space-oeffnen").click();
    await expect(page.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
    const zugriff = page.getByTestId("space-zugriff");
    const person = (id: string) =>
      zugriff.locator(`[data-testid="space-zugriff-person"][data-konto="${id}"]`);
    await expect(person(erik.id).locator('[data-art="direkt"]')).toBeVisible({ timeout: 15_000 });
    await expect(person(vera.id).locator('[data-art="team"]')).toContainText(`Messtechnik ${m}`);
    await expect(person(adminId).locator('[data-art="zustaendig"]')).toBeVisible();
    await expect(person(fritz.id)).toHaveCount(0);
    await bild(page, "2-zugriff-herkunft");

    // --- K3 · Fremdsitzung: direkter Link ohne Inhalt --------------------------------------------
    const fremd = await browser.newContext({ baseURL });
    try {
      const anmeldung = await fremd.request.post("/api/auth/login", {
        data: { email: fritz.email, password: SMOKE_PASS },
      });
      expect(anmeldung.status(), await anmeldung.text()).toBe(200);
      expect((await fremd.request.get(`/api/kos/${koWerkstatt}`)).status()).toBe(404);
      expect((await fremd.request.get(`/api/spaces/${werkstatt}`)).status()).toBe(404);
      const suche = await fremd.request.get(`/api/library/search?q=${encodeURIComponent(m)}`);
      expect(await suche.text()).not.toContain(`Drehmoment ${m}`);
      const fremdeSeite = await fremd.newPage();
      await fremdeSeite.goto(`/spaces/${werkstatt}`);
      await expect(fremdeSeite.getByTestId("space-nicht-gefunden")).toBeVisible({
        timeout: 15_000,
      });
      await expect(fremdeSeite.locator("body")).not.toContainText(`Drehmoment ${m}`);
      await bild(fremdeSeite, "3-fremdsitzung-direkter-link");
    } finally {
      await fremd.close();
    }

    // --- K4 · Wechsel zeigt Regeln vorher/nachher ------------------------------------------------
    await page.goto(`/wissen/${koWerkstatt}`);
    const zeile = page.getByTestId("space-zeile");
    await expect(zeile).toBeVisible({ timeout: 15_000 });
    await zeile.getByTestId("space-zeile-ziel").selectOption({ label: `Labor ${m}` });
    await zeile.getByTestId("space-zeile-vorschau").click();
    const regeln = zeile.getByTestId("space-vorschau-regeln");
    await expect(regeln).toContainText(`Nur freigegebene Anweisungen ${m}`, { timeout: 15_000 });
    await expect(regeln).toContainText(`Kalibrierschein Pflicht ${m}`);
    await bild(page, "4-wechsel-regeln-vorher-nachher");
    // Nicht übernommen: der Artikel bleibt für den Archivfall in der Werkstatt.
    await zeile.getByRole("button", { name: "Abbrechen" }).click();

    // --- K5 · Archivieren mit Folgen, Begründung, Reload, Wiederaufnahme --------------------------
    await page.goto(`/spaces/${werkstatt}`);
    await page.getByTestId("space-archivieren").click();
    const folgen = page.getByTestId("space-archiv-folgen");
    await expect(folgen).toBeVisible({ timeout: 15_000 });
    await expect(folgen.getByTestId("space-archiv-lesen")).toContainText("Lesen bleibt");
    await expect(folgen.getByTestId("space-archiv-schreiben")).toContainText("Schreiben entfällt");
    await expect(folgen.getByTestId("space-archiv-aufgaben")).toContainText("1 von 1");
    await expect(page.getByTestId("space-archiv-bestaetigen")).toBeDisabled();
    await page.getByTestId("space-archiv-begruendung").fill(`Umzug der Werkstatt ${m}.`);
    await bild(page, "5-archivfolgen-vor-bestaetigung");
    await page.getByTestId("space-archiv-bestaetigen").click();
    await expect(page.getByTestId("space-status").first()).toContainText("Archiviert", {
      timeout: 15_000,
    });
    await page.reload();
    await expect(page.getByTestId("space-archiviert-hinweis")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("space-bearbeiten")).toHaveCount(0);
    await page.getByTestId("space-verlauf-knopf").click();
    await expect(
      page.locator('[data-testid="space-fassung"][data-vorgang="archiviert"]'),
    ).toContainText(`Umzug der Werkstatt ${m}.`);
    await bild(page, "6-archiviert-nach-reload");
    // In der Übersicht nicht still verschwunden: unter „Archiviert" zu finden.
    await page.goto(`/spaces?q=${m}&status=archiviert`);
    await expect(karte(page, werkstatt)).toBeVisible({ timeout: 15_000 });
    await expect(karte(page, labor)).toHaveCount(0);
    await karte(page, werkstatt).getByTestId("space-oeffnen").click();
    await page.getByTestId("space-archiv-begruendung").fill(`Umzug abgesagt ${m}.`);
    await page.getByTestId("space-wiederaufnehmen").click();
    await expect(page.getByTestId("space-archiv-meldung")).toContainText("wiederaufgenommen", {
      timeout: 15_000,
    });
    await page.reload();
    await page.getByTestId("space-verlauf-knopf").click();
    await expect(
      page.locator('[data-testid="space-fassung"][data-vorgang="wiederaufgenommen"]'),
    ).toContainText(`Umzug abgesagt ${m}.`, { timeout: 15_000 });

    // --- K6 · Bestand zuordnen ------------------------------------------------------------------
    const tag = `bestand-${m}`;
    const koBestand = await artikel(page.request, `Messschieber ${m}`, [tag]);
    await page.goto("/spaces");
    const bestand = page.getByTestId("space-bestand");
    await expect(bestand).toBeVisible({ timeout: 15_000 });
    await bestand.getByTestId("space-bestand-tag").fill(tag);
    await bestand.getByTestId("space-bestand-ziel").selectOption({ label: `Labor ${m}` });
    await bestand.getByTestId("space-bestand-pruefen").click();
    const plan = bestand.getByTestId("space-bestand-plan");
    await expect(plan).toBeVisible({ timeout: 15_000 });
    await expect(plan.getByTestId("space-bestand-bilanz")).toContainText("zuordenbar");
    const zuordnung = plan.locator(
      `[data-testid="space-bestand-zuordnung"][data-ko="${koBestand}"]`,
    );
    await expect(zuordnung).toContainText(`Labor ${m}`);
    await bild(page, "7-bestand-bilanz");
    await plan.getByTestId("space-bestand-uebernehmen").click();
    await expect(bestand.getByTestId("space-bestand-ergebnis")).toContainText("Zugeordnet: 1", {
      timeout: 15_000,
    });
    const ko = (await (await page.request.get(`/api/kos/${koBestand}`)).json()) as {
      spaceId?: string;
    };
    expect(ko.spaceId).toBe(labor);
    await page.reload();
    await expect(page.getByTestId("space-bestand-protokoll")).toBeVisible({ timeout: 15_000 });
    await bild(page, "8-bestand-protokoll-nach-reload");
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`Bedienung: ${breite} × ${hoehe} — ohne Überbreite, Archivfolgen per Tastatur mit Fokus`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const m = marke();
      const adminId = await ich(page.request);
      const id = await spaceAnlegen(page.request, {
        name: `Tastaturraum ${m}`,
        zweck: "Bedienprobe (fiktiv).",
        verantwortlich: adminId,
        gruppe: `Bedienung ${m}`,
        regeln: "Nur Probeinhalte.",
      });

      await page.goto(`/spaces?q=${m}`);
      await expect(karte(page, id)).toBeVisible({ timeout: 15_000 });
      expect(await ueberbreit(page), "die Übersicht ist breiter als das Fenster").toBe(false);
      await bild(page, `9-uebersicht-${breite}`);

      await page.goto(`/spaces/${id}`);
      await expect(page.getByTestId("space-detail")).toBeVisible({ timeout: 15_000 });
      expect(await ueberbreit(page), "die Detailseite ist breiter als das Fenster").toBe(false);

      const fokus = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el
            ? {
                testId: el.getAttribute("data-testid") ?? "",
                id: el.id,
                sichtbar: el.matches(":focus-visible"),
              }
            : null;
        });
      await page.getByTestId("space-verlauf-knopf").focus();
      for (let i = 0; i < 60 && (await fokus())?.testId !== "space-archivieren"; i += 1) {
        await page.keyboard.press(tab);
      }
      const aufKnopf = await fokus();
      expect(aufKnopf?.testId, "„Folgen prüfen“ ist per Tab nicht erreichbar").toBe(
        "space-archivieren",
      );
      expect(aufKnopf?.sichtbar, "kein :focus-visible auf dem Archivknopf").toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("space-archiv-folgen")).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => (await fokus())?.id).toBe("space-archiv-titel");
      expect(await ueberbreit(page), "die Archivfolgen sind breiter als das Fenster").toBe(false);
      await bild(page, `10-archivfolgen-tastatur-${breite}`);

      // Abbrechen per Tastatur: nichts geschrieben.
      for (let i = 0; i < 40 && (await fokus())?.testId !== "space-archiv-abbrechen"; i += 1) {
        await page.keyboard.press(tab);
      }
      expect((await fokus())?.testId).toBe("space-archiv-abbrechen");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("space-archiv-folgen")).toHaveCount(0);
      const gelesen = (await (await page.request.get(`/api/spaces/${id}`)).json()) as {
        space: { version: number; archiviert: boolean };
      };
      expect(gelesen.space).toMatchObject({ version: 1, archiviert: false });

      // Rückweg: „Alle Spaces" führt zur Übersicht.
      await page.getByRole("link", { name: "Alle Spaces" }).first().click();
      await expect(page).toHaveURL(/\/spaces$/);
    });
  }
});
