import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-04 · NUTZER MIT ZUGANG UND VERANTWORTUNG IN DER ECHTEN APP — Bedienbeleg, Rechte, Tastatur.
// ================================================================================================
//
// produkt:20261009:admin-nutzer-uebersicht. Geklickt wird im echten Browser gegen den echten
// Smoke-Server (isolierter Testbestand); die Bilder hängen am nativen Bericht. Jeder Lauf hat seine
// eigenen, erfundenen Namen — gesucht wird nach der Laufmarke, damit fremde Konten anderer Specs
// die Zählung nicht stören.
//
//   Lieferbeleg · Nutzerliste mit fiktiven Statusfällen (aktiv, befristet, abgelaufen), kombinierte
//                 Suche/Filter mit Leerergebnis und Rücksetzen, Zähler → Bestand (K1/K2/K3).
//   K4          · Rolle und Befristung: Wirkung vor dem Senden, Bestätigung, Stand nach Reload und
//                 Prüfprotokoll — jeweils gegen den Server geprüft.
//   K5          · Mehrere Konten befristen: Vorschau je Konto, ein Konto mit Beiträgen scheitert
//                 einzeln und steht mit Grund im Ergebnis.
//   K6          · Ein nicht berechtigter Testnutzer (Betrachter) in einer EIGENEN Browsersitzung:
//                 direkte Serveraufrufe 403, die Verwaltungsfläche zeigt keine Kontenliste.
//   Bedienung   · 390 × 844 und 1280 × 800: ohne Überbreite, per Tastatur mit sichtbarem Fokus.
//
// WAS HIER NICHT GEMESSEN IST: der Zustand „gesperrt" (wartet auf Freigabe) — der Smoke-Server
// lässt keine Selbstregistrierung zu, und die Verwaltung legt Konten freigegeben an. Belegt ist er
// am Draht (`tests/admin-nutzer-uebersicht/routen.test.ts`, K2) und an der Fläche (gemounteter
// Test daneben). Ebenfalls nicht: ein unvertrauter Mensch und echte Mitarbeiterkonten.

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
  role: string;
  approved: boolean;
  accessExpiresAt?: string;
}

async function kontoAnlegen(
  request: APIRequestContext,
  daten: { name: string; email: string; role: string; accessExpiresAt?: string },
): Promise<Konto> {
  const res = await request.post("/api/users", { data: { ...daten, password: SMOKE_PASS } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Konto;
}

/** Ein Beitrag, für den `owner` hauptverantwortlich ist (Autor bleibt das Smoke-Konto). */
async function beitragFuer(request: APIRequestContext, titel: string, owner: string) {
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
  const ko = (await angelegt.json()) as { id: string };
  const gesetzt = await request.put(`/api/kos/${ko.id}`, {
    data: { action: "ownership", ownership: { owner } },
  });
  expect(gesetzt.status(), await gesetzt.text()).toBe(200);
  return ko;
}

async function kontoVomServer(request: APIRequestContext, id: string): Promise<Konto | undefined> {
  const res = await request.get("/api/users");
  expect(res.status()).toBe(200);
  return ((await res.json()) as Konto[]).find((k) => k.id === id);
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const nutzerZeilen = (page: Page) =>
  page.locator('[data-testid="flaeche-nutzer"] button[data-einst="zeile"]');
const zeileVon = (page: Page, name: string) => nutzerZeilen(page).filter({ hasText: name });

test.describe("ADMIN-04 · Nutzer mit Zugang und Verantwortung", () => {
  test("Lieferbeleg: fiktive Statusfälle, Suche + Filter gemeinsam, Leerergebnis, Zähler → Bestand (K1/K2/K3)", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const aktiv = await kontoAnlegen(page.request, {
      name: `Anja Aktiv ${m}`,
      email: `anja-${m}@nutzer.test`,
      role: "experte",
    });
    await kontoAnlegen(page.request, {
      name: `Bruno Befristet ${m}`,
      email: `bruno-${m}@extern.test`,
      role: "viewer",
      // Mittag UTC: derselbe Kalendertag in jeder Zeitzone des Prüfrechners.
      accessExpiresAt: "2099-12-31T12:00:00.000Z",
    });
    await kontoAnlegen(page.request, {
      name: `Clara Abgelaufen ${m}`,
      email: `clara-${m}@extern.test`,
      role: "viewer",
      accessExpiresAt: "2020-01-31T12:00:00.000Z",
    });
    const ko = await beitragFuer(page.request, `Lehrdorn ${m}`, aktiv.id);

    await page.goto("/admin?bereich=konten");
    await expect(page.getByTestId("nutzer-filter")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("nutzer-suche").fill(m);
    await expect(nutzerZeilen(page)).toHaveCount(3, { timeout: 15_000 });
    // K2 · der Zugang steht an der Zeile, aus dem Konto abgeleitet.
    await expect(zeileVon(page, `Bruno Befristet ${m}`)).toContainText("befristet bis 31.12.2099");
    await expect(zeileVon(page, `Clara Abgelaufen ${m}`)).toContainText("abgelaufen am 31.1.2020");
    // K3 · Beiträge getrennt von anderen offenen Vorgängen.
    await expect(zeileVon(page, `Anja Aktiv ${m}`)).toContainText("Beiträge: 1");
    await bild(page, "1-kontenliste-statusfaelle");

    // K1 · Suche + Zugang + Rolle gemeinsam; die Adresse trägt alle drei.
    await page.getByTestId("nutzer-filter-zugang").selectOption("abgelaufen");
    await expect(nutzerZeilen(page)).toHaveCount(1);
    await expect(nutzerZeilen(page).first()).toContainText(`Clara Abgelaufen ${m}`);
    await page.getByTestId("nutzer-filter-rolle").selectOption("experte");
    await expect(nutzerZeilen(page)).toHaveCount(0);
    const leer = page.getByTestId("nutzer-filter-leer");
    await expect(leer).toBeVisible();
    await expect(leer).toContainText(`Suche „${m}“`);
    await expect(leer).toContainText("Rolle: Experte");
    await expect(leer).toContainText("Zugang: abgelaufen");
    await expect(page).toHaveURL(new RegExp(`suche=${m}&rolle=experte&filter=abgelaufen`));
    await bild(page, "2-leeres-ergebnis-mit-filtern");
    // Neuladen behält die Filter.
    await page.reload();
    await expect(page.getByTestId("nutzer-filter-leer")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("nutzer-filter-zuruecksetzen").click();
    await expect(page).toHaveURL(/\/admin\?bereich=konten$/);
    await expect(page.getByTestId("nutzer-filter-leer")).toHaveCount(0);
    await expect(page.getByTestId("nutzer-suche")).toHaveValue("");

    // K3 · der Zähler öffnet den Bestand dieser Person.
    await page.getByTestId("nutzer-suche").fill(`anja ${m}`);
    await zeileVon(page, `Anja Aktiv ${m}`).click();
    await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("konto-zugang")).toContainText("Aktiv, unbefristet");
    await expect(page.getByTestId("konto-zugang")).toContainText(
      "Letzte Anmeldung und Einladungen erfasst Klarwerk nicht.",
    );
    // Karte und Server zählen dasselbe — Beiträge und Vorgänge getrennt.
    const zahlen = await page.request.get("/api/verantwortung/uebersicht");
    expect(zahlen.status()).toBe(200);
    const anja = (
      (await zahlen.json()) as {
        personen: {
          id: string;
          beitraege: number;
          vorgaenge: { entwuerfe: number; luecken: number; pruefaufgaben: number } | null;
        }[];
      }
    ).personen.find((p) => p.id === aktiv.id);
    expect(anja?.beitraege).toBe(1);
    expect(anja?.vorgaenge).not.toBeNull();
    const v = anja?.vorgaenge;
    await expect(page.getByTestId("konto-beitraege")).toHaveAttribute("data-anzahl", "1");
    await expect(page.getByTestId("konto-vorgaenge")).toHaveAttribute(
      "data-anzahl",
      String((v?.entwuerfe ?? 0) + (v?.luecken ?? 0) + (v?.pruefaufgaben ?? 0)),
    );
    await page.getByTestId("konto-beitraege-oeffnen").click();
    await expect(page.getByTestId("verantwortung-flaeche")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="verantwortung-zeile"]')).toHaveCount(1);
    await expect(
      page.locator(`[data-testid="verantwortung-zeile"][data-ko="${ko.id}"]`),
    ).toBeVisible();
    await bild(page, "3-zaehler-oeffnet-bestand");
  });

  test("K4: Rolle und Befristung — Wirkung vorher, Bestätigung, Stand nach Reload, Prüfprotokoll", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const dora = await kontoAnlegen(page.request, {
      name: `Dora Rolle ${m}`,
      email: `dora-${m}@nutzer.test`,
      role: "experte",
    });
    await page.goto("/admin?bereich=konten");
    await page.getByTestId("nutzer-suche").fill(m);
    await zeileVon(page, `Dora Rolle ${m}`).click();
    await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });

    // Wählen sendet nicht — erst die Wirkung, dann die Bestätigung.
    await page.getByTestId("konto-rolle").selectOption("controller");
    await expect(page.getByTestId("rolle-wirkung")).toBeVisible();
    await expect(page.getByTestId("rolle-wirkung-dazu")).toContainText("prüfen");
    await bild(page, "4-rolle-wirkung-vor-aenderung");
    expect((await kontoVomServer(page.request, dora.id))?.role).toBe("experte");
    await page.getByTestId("rolle-uebernehmen").click();
    await expect(page.getByTestId("rolle-bestaetigt")).toContainText(
      "Die Rolle ist jetzt Controller (vom Server bestätigt).",
    );
    expect((await kontoVomServer(page.request, dora.id))?.role).toBe("controller");
    const vermerkRolle = page.locator(
      '[data-testid="konto-vermerk"][data-action="user.role-change"]',
    );
    await expect(vermerkRolle.first()).toContainText("Experte → Controller", { timeout: 15_000 });

    // Befristung: Wirkung vor dem Speichern.
    await page.getByRole("button", { name: "Befristung setzen" }).click();
    await page.getByTestId("detail-nutzer").locator('input[type="date"]').fill("2099-10-31");
    await expect(page.getByTestId("frist-wirkung")).toContainText(`Dora Rolle ${m}`);
    await expect(page.getByTestId("frist-wirkung")).toContainText("31.10.2099");
    expect((await kontoVomServer(page.request, dora.id))?.accessExpiresAt).toBeUndefined();
    await page.getByRole("button", { name: "Befristung speichern" }).click();
    await expect(page.locator('[data-einst="gastfrist-stand"]')).toContainText("31.10.2099", {
      timeout: 15_000,
    });

    // Neuladen: Rolle, Befristung und beide Vermerke stehen weiter da — vom Server.
    await page.reload();
    await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("konto-rolle")).toHaveValue("controller");
    await expect(page.locator('[data-einst="gastfrist-stand"]')).toContainText("31.10.2099");
    await expect(page.getByTestId("konto-zugang")).toContainText("Aktiv, befristet");
    await expect(
      page.locator('[data-testid="konto-vermerk"][data-action="user.access-expiry-set"]').first(),
    ).toContainText("bis 31.10.2099", { timeout: 15_000 });
    const audit = await page.request.get("/api/audit");
    expect(audit.status()).toBe(200);
    const eintraege = (await audit.json()) as {
      action: string;
      target: string;
      payload: Record<string, unknown>;
    }[];
    expect(
      eintraege.some(
        (e) =>
          e.action === "user.role-change" &&
          e.target === dora.id &&
          e.payload.previousRole === "experte" &&
          e.payload.role === "controller",
      ),
    ).toBe(true);
    const server = await kontoVomServer(page.request, dora.id);
    expect(
      eintraege.some(
        (e) =>
          e.action === "user.access-expiry-set" &&
          e.target === dora.id &&
          e.payload.expiresAt === server?.accessExpiresAt,
      ),
    ).toBe(true);
    await bild(page, "5-nach-reload-rolle-befristung-protokoll");
  });

  test("K5: mehrere Konten befristen — Vorschau je Konto, Teilfehler mit Grund", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const emil = await kontoAnlegen(page.request, {
      name: `Emil Verantwortet ${m}`,
      email: `emil-${m}@nutzer.test`,
      role: "experte",
    });
    const fritz = await kontoAnlegen(page.request, {
      name: `Fritz Frei ${m}`,
      email: `fritz-${m}@nutzer.test`,
      role: "viewer",
    });
    await beitragFuer(page.request, `Spannzange ${m}`, emil.id);

    await page.goto(`/admin?bereich=konten&suche=${m}`);
    await expect(nutzerZeilen(page)).toHaveCount(2, { timeout: 15_000 });
    await page.getByTestId("sammel-schalter").check();
    await page.getByTestId("sammel-alle").click();
    await page.getByTestId("sammel-aktion").selectOption("befristen");
    await page.getByTestId("sammel-tag").fill("2099-11-30");
    await expect(page.getByTestId("sammel-ausfuehren")).toBeDisabled();
    await page.getByTestId("sammel-vorschau-holen").click();
    const vorschau = page.getByTestId("sammel-vorschau");
    await expect(vorschau.locator('[data-art="wirkt"]')).toHaveCount(2);
    await bild(page, "6-sammel-vorschau");
    expect((await kontoVomServer(page.request, fritz.id))?.accessExpiresAt).toBeUndefined();

    await page.getByTestId("sammel-ausfuehren").click();
    const ergebnis = page.getByTestId("sammel-ergebnis");
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "nein", { timeout: 15_000 });
    await expect(ergebnis).toContainText("Nur teilweise ausgeführt: 1 erledigt, 1 fehlgeschlagen.");
    const emilZeile = ergebnis.locator(`[data-id="${emil.id}"]`);
    await expect(emilZeile).toHaveAttribute("data-ok", "nein");
    await expect(emilZeile).toContainText("hauptverantwortlich");
    await expect(ergebnis.locator(`[data-id="${fritz.id}"]`)).toHaveAttribute("data-ok", "ja");
    await bild(page, "7-sammel-teilfehler");
    expect((await kontoVomServer(page.request, emil.id))?.accessExpiresAt).toBeUndefined();
    expect((await kontoVomServer(page.request, fritz.id))?.accessExpiresAt).toBeDefined();
  });

  test("K6: ein nicht berechtigter Testnutzer erreicht weder Liste noch Änderung — auch nicht direkt", async ({
    page,
    browser,
    baseURL,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const vera = await kontoAnlegen(page.request, {
      name: `Vera Betrachterin ${m}`,
      email: `vera-${m}@nutzer.test`,
      role: "viewer",
    });
    const ziel = await kontoAnlegen(page.request, {
      name: `Zora Ziel ${m}`,
      email: `zora-${m}@nutzer.test`,
      role: "experte",
    });
    const vorher = await kontoVomServer(page.request, ziel.id);

    // Eine EIGENE Browsersitzung für die Betrachterin — nichts teilt sie mit dem Admin. Ohne
    // Basisadresse wäre jeder relative Aufruf unten ein Fehlgriff statt einer Rechteprobe.
    if (baseURL === undefined) {
      throw new Error(
        "baseURL fehlt in der Smoke-Konfiguration — die Rechteprobe ist nicht prüfbar.",
      );
    }
    const fremd = await browser.newContext({ baseURL });
    try {
      const anmeldung = await fremd.request.post("/api/auth/login", {
        data: { email: vera.email, password: SMOKE_PASS },
      });
      expect(anmeldung.status(), await anmeldung.text()).toBe(200);
      const rufe: [string, () => ReturnType<APIRequestContext["get"]>][] = [
        ["GET /api/users", () => fremd.request.get("/api/users")],
        [
          "GET /api/verantwortung/uebersicht",
          () => fremd.request.get("/api/verantwortung/uebersicht"),
        ],
        [
          "PUT /api/users/:id role",
          () => fremd.request.put(`/api/users/${ziel.id}`, { data: { role: "admin" } }),
        ],
        [
          "PUT /api/users/:id eigene Rolle",
          () => fremd.request.put(`/api/users/${vera.id}`, { data: { role: "admin" } }),
        ],
        [
          "PUT /api/users/:id Befristung",
          () =>
            fremd.request.put(`/api/users/${ziel.id}`, {
              data: { accessExpiresAt: "2020-01-01T00:00:00.000Z" },
            }),
        ],
        ["POST approve", () => fremd.request.post(`/api/auth/users/${ziel.id}/approve`)],
        ["DELETE /api/users/:id", () => fremd.request.delete(`/api/users/${ziel.id}`)],
      ];
      for (const [name, ruf] of rufe) {
        const res = await ruf();
        expect(res.status(), `${name}: ${await res.text()}`).toBe(403);
      }
      // Die Oberfläche: keine Kontenliste, keine Kontokarte.
      const fremdeSeite = await fremd.newPage();
      await fremdeSeite.goto(`/admin?bereich=konten&detail=nutzer%3A${ziel.id}`);
      await expect(fremdeSeite.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
      await expect(fremdeSeite.getByTestId("flaeche-nutzer")).toHaveCount(0);
      await expect(fremdeSeite.getByTestId("detail-nutzer")).toHaveCount(0);
      await expect(fremdeSeite.getByText(ziel.email)).toHaveCount(0);
      await bild(fremdeSeite, "8-betrachterin-ohne-verwaltung");
    } finally {
      await fremd.close();
    }
    // Unverändert, vom Admin aus gelesen.
    expect(await kontoVomServer(page.request, ziel.id)).toEqual(vorher);
    expect((await kontoVomServer(page.request, vera.id))?.role).toBe("viewer");
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`Bedienung: ${breite} × ${hoehe} — ohne Überbreite, Suche und Konto per Tastatur`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const m = marke();
      await kontoAnlegen(page.request, {
        name: `Tara Tastatur ${m}`,
        email: `tara-${m}@nutzer.test`,
        role: "viewer",
        accessExpiresAt: "2099-12-31T12:00:00.000Z",
      });
      await page.goto("/admin?bereich=konten");
      await expect(page.getByTestId("nutzer-filter")).toBeVisible({ timeout: 15_000 });

      const ueberbreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(ueberbreit, "die Kontenliste ist breiter als das Fenster").toBe(false);

      const fokus = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {
            testId: el.getAttribute("data-testid") ?? "",
            text: el.textContent ?? "",
            sichtbar: el.matches(":focus-visible"),
            ring: getComputedStyle(el).boxShadow + getComputedStyle(el).outlineStyle,
            imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
          };
        });

      // Mit Tab aus der Themenspalte in das Suchfeld, dann tippen.
      await page.getByTestId("reiter-uebersicht").focus();
      for (let i = 0; i < 40 && (await fokus())?.testId !== "nutzer-suche"; i += 1) {
        await page.keyboard.press(tab);
      }
      const imSuchfeld = await fokus();
      expect(imSuchfeld?.testId, "das Suchfeld ist per Tab nicht erreichbar").toBe("nutzer-suche");
      expect(imSuchfeld?.imFenster).toBe(true);
      await page.keyboard.type(m);
      await expect(nutzerZeilen(page)).toHaveCount(1, { timeout: 15_000 });
      await bild(page, `9-suche-tastatur-${breite}`);

      // Weiter mit Tab bis zur Kontozeile; Enter öffnet die Karte.
      for (let i = 0; i < 40 && !(await fokus())?.text.includes(`Tara Tastatur ${m}`); i += 1) {
        await page.keyboard.press(tab);
      }
      const aufZeile = await fokus();
      expect(aufZeile?.text, "die Kontozeile ist per Tab nicht erreichbar").toContain(
        `Tara Tastatur ${m}`,
      );
      expect(aufZeile?.sichtbar, "kein :focus-visible auf der Zeile").toBe(true);
      expect(aufZeile?.imFenster).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("konto-zugang")).toContainText("Aktiv, befristet");
      const karteBreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(karteBreit, "die Kontokarte ist breiter als das Fenster").toBe(false);
      await bild(page, `10-kontokarte-${breite}`);

      // Rückweg per Tastatur: der Zurück-Knopf der Karte führt in die gefilterte Liste.
      await page.locator('[data-testid="detail-nutzer"] [data-einst="zurueck"]').focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`bereich=konten&suche=${m}$`));
      await expect(nutzerZeilen(page)).toHaveCount(1);
    });
  }
});
