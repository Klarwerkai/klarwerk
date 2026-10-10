import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-06 · TEAMS IN DER ECHTEN APP — Bedienbeleg, Wirkung vor Bestätigung, Entzug, Archiv, Rechte.
// ================================================================================================
//
// produkt:20261009:admin-teams. Geklickt wird im echten Browser gegen den echten Smoke-Server
// (isolierter Testbestand); die Bilder hängen am nativen Bericht. Jeder Lauf hat seine eigenen,
// erfundenen Namen (Laufmarke), damit fremde Konten und Teams anderer Specs nicht stören.
//
//   Lieferbeleg · zwei Teams mit ÜBERLAPPENDER Mitgliedschaft (Vera in beiden), Mitglieder mit zwei
//                 unabhängigen Rollen (Erik experte, Vera viewer), eine direkte Space-Mitgliedschaft.
//   K1          · Team in der Oberfläche anlegen (Zweck, Zuständigkeit, Mitglieder) und bearbeiten.
//   K2/K3       · „Entfernen …" zeigt ZUERST je Space vorher/nachher und den verbleibenden Weg über
//                 das andere Team; erst die Bestätigung schreibt. Globale Rolle unverändert.
//   K4          · Negativprobe: eine VOR dem Entzug angemeldete Sitzung bekommt danach 404.
//   K5          · Archivieren: Folgen je Space vorher, danach keine Mitgliederpflege mehr.
//   K6          · Nach Reload: Mitglieder, Status und Verlauf; Betrachterin: 403 und keine Karte.
//   Bedienung   · 390 × 844 und 1280 × 800: ohne Überbreite, per Tastatur, Fokus auf der Wirkung.
//
// WAS HIER NICHT GEMESSEN IST: ein echter, unvertrauter Mensch, echte Mitarbeiterkonten und
// PostgreSQL (der Smoke-Server läuft im Speicher) — der PG-Weg steht in
// `tests/admin-teams/teams-pg.integration.test.ts`.

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
  daten: {
    name: string;
    verantwortlich: string;
    mitglieder: { nutzer: string; recht: string }[];
    teams: { team: string; recht: string }[];
  },
): Promise<string> {
  const res = await request.post("/api/spaces", {
    data: { ...daten, zweck: `${daten.name} (fiktiv).`, zugang: "mitglieder", ansichten: [] },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function artikelIn(request: APIRequestContext, titel: string, spaceId: string) {
  const angelegt = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} wird vor jeder Schicht geprüft (fiktiv).`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const koId = ((await angelegt.json()) as { id: string }).id;
  const v = await request.post("/api/spaces/verschiebung/vorschau", {
    data: { koId, zielSpaceId: spaceId },
  });
  expect(v.status(), await v.text()).toBe(200);
  const vorschau = (await v.json()) as { ziel: { version: number }; grundlage: string };
  const w = await request.post("/api/spaces/verschiebung", {
    data: {
      koId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: null,
        quelleVersion: null,
        zielId: spaceId,
        zielVersion: vorschau.ziel.version,
        grundlage: vorschau.grundlage,
      },
    },
  });
  expect(w.status(), await w.text()).toBe(200);
  return koId;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const teamKarte = (page: Page) => page.getByTestId("team-karte");
const mitglied = (page: Page, id: string) =>
  page.locator(`[data-testid="team-mitglied"][data-konto="${id}"]`);

test.describe("ADMIN-06 · Teams und Mitgliedschaften", () => {
  test("Lieferbeleg: anlegen, Wirkung vor Entfernen, Entzug mit offener Sitzung, Archiv, Reload, Rechte (K1–K6)", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (baseURL === undefined) {
      throw new Error(
        "baseURL fehlt in der Smoke-Konfiguration — die Sitzungsprobe ist nicht prüfbar.",
      );
    }
    await ensureLoggedIn(page);
    const m = marke();
    const adminId = await ich(page.request);
    const erik = await kontoAnlegen(page.request, {
      name: `Erik Experte ${m}`,
      email: `erik-${m}@teams.test`,
      role: "experte",
    });
    const vera = await kontoAnlegen(page.request, {
      name: `Vera Viewer ${m}`,
      email: `vera-${m}@teams.test`,
      role: "viewer",
    });
    const fritz = await kontoAnlegen(page.request, {
      name: `Fritz Fachmann ${m}`,
      email: `fritz-${m}@teams.test`,
      role: "experte",
    });

    // --- K1 · Team A in der Oberfläche anlegen ------------------------------------------------
    await page.goto("/admin?bereich=konten");
    await page.getByTestId("zeile-teams").click();
    await expect(page.getByTestId("detail-teams")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("team-neu").click();
    const form = page.getByTestId("team-anlegen");
    await form.getByTestId("team-name").fill(`Messtechnik ${m}`);
    await form.getByTestId("team-zweck").fill("Gemeinsame Zuständigkeit für Messmittel (fiktiv).");
    await form.getByTestId("team-verantwortlich").selectOption(adminId);
    await form.locator(`[data-testid="team-anlegen-mitglied"][data-konto="${erik.id}"]`).check();
    await form.locator(`[data-testid="team-anlegen-mitglied"][data-konto="${vera.id}"]`).check();
    await bild(page, "1-team-anlegen");
    await form.getByTestId("team-anlegen-speichern").click();
    await expect(teamKarte(page)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/detail=team%3A/);
    const messId = (await teamKarte(page).getAttribute("data-team")) ?? "";
    expect(messId).not.toBe("");
    await expect(mitglied(page, erik.id)).toBeVisible();
    await expect(mitglied(page, vera.id)).toBeVisible();
    await expect(page.getByTestId("team-zustaendig")).toBeVisible();

    // Team B (überlappend: Vera) und die beiden Spaces über die API — derselbe Server.
    const qzRes = await page.request.post("/api/teams", {
      data: {
        name: `Qualitätszirkel ${m}`,
        zweck: "Zweites Team mit überlappender Mitgliedschaft (fiktiv).",
        verantwortlich: adminId,
        mitglieder: [vera.id, fritz.id],
      },
    });
    expect(qzRes.status(), await qzRes.text()).toBe(201);
    const qzId = ((await qzRes.json()) as { id: string }).id;
    const labor = await spaceAnlegen(page.request, {
      name: `Labor ${m}`,
      verantwortlich: adminId,
      mitglieder: [],
      teams: [
        { team: messId, recht: "lesen" },
        { team: qzId, recht: "schreiben" },
      ],
    });
    const werkstatt = await spaceAnlegen(page.request, {
      name: `Werkstatt ${m}`,
      verantwortlich: adminId,
      mitglieder: [{ nutzer: erik.id, recht: "lesen" }],
      teams: [{ team: messId, recht: "schreiben" }],
    });
    const koWerkstatt = await artikelIn(page.request, `Drehmoment ${m}`, werkstatt);
    const koLabor = await artikelIn(page.request, `Lehrdorn ${m}`, labor);

    // K4 · Die „offene" Sitzung der Betrachterin — angemeldet VOR dem Entzug.
    const fremd = await browser.newContext({ baseURL });
    try {
      const anmeldung = await fremd.request.post("/api/auth/login", {
        data: { email: vera.email, password: SMOKE_PASS },
      });
      expect(anmeldung.status(), await anmeldung.text()).toBe(200);
      expect((await fremd.request.get(`/api/kos/${koWerkstatt}`)).status()).toBe(200);
      expect((await fremd.request.get(`/api/kos/${koLabor}`)).status()).toBe(200);

      // K1 · Bearbeiten: Zweck ändern (ohne Mitgliederänderung keine Wirkungsvorschau nötig).
      await page.reload();
      await expect(teamKarte(page)).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("team-bearbeiten-knopf").click();
      await page
        .getByTestId("team-bearbeiten")
        .getByTestId("team-zweck")
        .fill("Messmittel und Prüfaufträge (fiktiv).");
      await page.getByTestId("team-speichern").click();
      await expect(page.getByTestId("team-zweck-anzeige")).toHaveText(
        "Messmittel und Prüfaufträge (fiktiv).",
      );
      await expect(page.getByTestId("team-spaces")).toContainText(`Labor ${m}`);
      await expect(page.getByTestId("team-spaces")).toContainText(`Werkstatt ${m}`);

      // --- K2/K3 · Vera entfernen: zuerst die Wirkung ----------------------------------------
      await mitglied(page, vera.id).getByTestId("team-mitglied-entfernen").click();
      const wirkung = page.getByTestId("team-wirkung");
      await expect(wirkung).toBeVisible({ timeout: 15_000 });
      const person = wirkung.locator(
        `[data-testid="team-wirkung-person"][data-konto="${vera.id}"]`,
      );
      await expect(person).toContainText(`Vera Viewer ${m}`);
      await expect(person.getByTestId("team-wirkung-rolle")).toContainText("bleibt unverändert");
      const zeileWerkstatt = person.locator(`[data-space="${werkstatt}"]`);
      await expect(zeileWerkstatt).toHaveAttribute("data-vorher", "schreiben");
      await expect(zeileWerkstatt).toHaveAttribute("data-nachher", "keins");
      const zeileLabor = person.locator(`[data-space="${labor}"]`);
      await expect(zeileLabor).toHaveAttribute("data-nachher", "schreiben");
      // Der verbleibende Weg ist benannt: das ANDERE Team.
      await expect(zeileLabor.getByTestId("team-wirkung-wege")).toContainText(
        `Qualitätszirkel ${m}`,
      );
      // Noch nichts geschrieben: die offene Sitzung sieht die Werkstatt weiter.
      expect((await fremd.request.get(`/api/kos/${koWerkstatt}`)).status()).toBe(200);
      await bild(page, "2-wirkung-vor-entfernen");
      await wirkung.getByTestId("team-wirkung-bestaetigen").click();
      await expect(wirkung).toHaveCount(0, { timeout: 15_000 });
      await expect(mitglied(page, vera.id)).toHaveCount(0);

      // K4 · dieselbe Sitzung, nächste Anfrage: Werkstatt 404, Labor (anderes Team) weiter da.
      expect((await fremd.request.get(`/api/kos/${koWerkstatt}`)).status()).toBe(404);
      expect((await fremd.request.get(`/api/spaces/${werkstatt}`)).status()).toBe(404);
      expect((await fremd.request.get(`/api/kos/${koLabor}`)).status()).toBe(200);
      // K3 · Die globale Rolle ist unverändert — am Konto gelesen.
      const konten = (await (await page.request.get("/api/users")).json()) as Konto[];
      expect(konten.find((k) => k.id === vera.id)?.role).toBe("viewer");

      // K6 · Unberechtigt: die Betrachterin verwaltet keine Teams — Server und Oberfläche.
      for (const [name, ruf] of [
        ["GET /api/teams", () => fremd.request.get("/api/teams")],
        [
          "POST /api/teams",
          () =>
            fremd.request.post("/api/teams", {
              data: { name: "Fremd", zweck: "x", verantwortlich: vera.id, mitglieder: [vera.id] },
            }),
        ],
        [
          "POST /api/teams/:id/vorschau",
          () => fremd.request.post(`/api/teams/${messId}/vorschau`, { data: { mitglieder: [] } }),
        ],
        [
          "POST /api/teams/:id/archivieren",
          () =>
            fremd.request.post(`/api/teams/${qzId}/archivieren`, {
              data: { version: 1, grundlage: "x" },
            }),
        ],
      ] as const) {
        const res = await ruf();
        expect(res.status(), `${name}: ${await res.text()}`).toBe(403);
      }
      const fremdeSeite = await fremd.newPage();
      await fremdeSeite.goto(`/admin?bereich=konten&detail=team%3A${messId}`);
      await expect(fremdeSeite.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
      await expect(fremdeSeite.getByTestId("detail-teams")).toHaveCount(0);
      await expect(fremdeSeite.getByTestId("team-karte")).toHaveCount(0);
      await bild(fremdeSeite, "3-betrachterin-ohne-teamverwaltung");

      // --- K6 · Reload: Mitglieder und Verlauf -----------------------------------------------
      await page.reload();
      await expect(teamKarte(page)).toBeVisible({ timeout: 15_000 });
      await expect(mitglied(page, erik.id)).toBeVisible();
      await expect(mitglied(page, vera.id)).toHaveCount(0);
      await expect(page.getByTestId("team-verlauf")).toContainText(`entfernt: Vera Viewer ${m}`);
      await bild(page, "4-team-nach-reload");

      // --- K5 · Team B archivieren: Folgen zuerst --------------------------------------------
      await page.goto(`/admin?bereich=konten&detail=team%3A${qzId}`);
      await expect(teamKarte(page)).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("team-archivieren").click();
      const folgen = page.getByTestId("team-wirkung");
      await expect(folgen).toBeVisible({ timeout: 15_000 });
      await expect(folgen.getByTestId("team-wirkung-spaces")).toContainText(`Labor ${m}`);
      const veraFolgen = folgen.locator(
        `[data-testid="team-wirkung-person"][data-konto="${vera.id}"] [data-space="${labor}"]`,
      );
      await expect(veraFolgen).toHaveAttribute("data-nachher", "keins");
      await expect(folgen).toContainText("Inhalte, Autorschaft, Fassungen und Prüfprotokoll");
      await bild(page, "5-folgen-vor-archivieren");
      await folgen.getByTestId("team-wirkung-bestaetigen").click();
      await expect(page.getByTestId("team-status")).toContainText("Archiviert", {
        timeout: 15_000,
      });
      await expect(page.getByTestId("team-archiviert-hinweis")).toBeVisible();
      await expect(page.getByTestId("team-mitglied-hinzu")).toHaveCount(0);
      await expect(page.getByTestId("team-mitglied-entfernen")).toHaveCount(0);
      expect((await fremd.request.get(`/api/kos/${koLabor}`)).status()).toBe(404);
      const ko = (await (await page.request.get(`/api/kos/${koLabor}`)).json()) as {
        author: string;
      };
      expect(ko.author).toBe(adminId);
      await page.reload();
      await expect(page.getByTestId("team-status")).toContainText("Archiviert", {
        timeout: 15_000,
      });
      await bild(page, "6-archiviert-nach-reload");

      // Die Teamliste trennt aktive und archivierte Teams.
      await page.locator('[data-testid="detail-teams"] [data-einst="zurueck"]').click();
      await expect(page.getByTestId("teams-archiv")).toContainText(`Qualitätszirkel ${m}`);
      await expect(page.getByTestId("teams-aktiv")).toContainText(`Messtechnik ${m}`);
    } finally {
      await fremd.close();
    }
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`Bedienung: ${breite} × ${hoehe} — ohne Überbreite, Entfernen per Tastatur, Fokus auf der Wirkung`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const m = marke();
      const adminId = await ich(page.request);
      const tara = await kontoAnlegen(page.request, {
        name: `Tara Tastatur ${m}`,
        email: `tara-${m}@teams.test`,
        role: "viewer",
      });
      const res = await page.request.post("/api/teams", {
        data: {
          name: `Tastaturteam ${m}`,
          zweck: "Bedienprobe (fiktiv).",
          verantwortlich: adminId,
          mitglieder: [tara.id],
        },
      });
      expect(res.status(), await res.text()).toBe(201);
      const teamId = ((await res.json()) as { id: string }).id;
      await spaceAnlegen(page.request, {
        name: `Raum ${m}`,
        verantwortlich: adminId,
        mitglieder: [],
        teams: [{ team: teamId, recht: "lesen" }],
      });

      await page.goto(`/admin?bereich=konten&detail=team%3A${teamId}`);
      await expect(teamKarte(page)).toBeVisible({ timeout: 15_000 });
      const ueberbreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(ueberbreit, "die Teamkarte ist breiter als das Fenster").toBe(false);

      const fokus = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {
            testId: el.getAttribute("data-testid") ?? "",
            id: el.id,
            sichtbar: el.matches(":focus-visible"),
            imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
          };
        });

      // Mit Tab vom Zurück-Knopf der Karte bis „Entfernen …", dann Enter.
      await page.locator('[data-testid="detail-teams"] [data-einst="zurueck"]').focus();
      for (let i = 0; i < 40 && (await fokus())?.testId !== "team-mitglied-entfernen"; i += 1) {
        await page.keyboard.press(tab);
      }
      const aufKnopf = await fokus();
      expect(aufKnopf?.testId, "„Entfernen …“ ist per Tab nicht erreichbar").toBe(
        "team-mitglied-entfernen",
      );
      expect(aufKnopf?.sichtbar, "kein :focus-visible auf „Entfernen …“").toBe(true);
      expect(aufKnopf?.imFenster).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("team-wirkung")).toBeVisible({ timeout: 15_000 });
      // Der Fokus springt auf die Überschrift der Wirkung — gelesen wird, was sich ändert.
      await expect.poll(async () => (await fokus())?.id).toBe("team-wirkung-titel");
      const wirkungBreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(wirkungBreit, "die Wirkung ist breiter als das Fenster").toBe(false);
      await bild(page, `7-wirkung-tastatur-${breite}`);

      // Abbrechen per Tastatur: nichts geschrieben, Tara bleibt Mitglied.
      for (let i = 0; i < 40 && (await fokus())?.testId !== "team-wirkung-abbrechen"; i += 1) {
        await page.keyboard.press(tab);
      }
      expect((await fokus())?.testId).toBe("team-wirkung-abbrechen");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("team-wirkung")).toHaveCount(0);
      await expect(mitglied(page, tara.id)).toBeVisible();
      const gelesen = (await (await page.request.get(`/api/teams/${teamId}`)).json()) as {
        team: { version: number; mitglieder: { nutzer: string }[] };
      };
      expect(gelesen.team.version).toBe(1);
      expect(gelesen.team.mitglieder.map((x) => x.nutzer)).toEqual([tara.id]);

      // Rückweg per Tastatur: in die Teamliste.
      await page.locator('[data-testid="detail-teams"] [data-einst="zurueck"]').focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/bereich=konten&detail=teams$/);
      await expect(page.getByTestId("teams-aktiv")).toContainText(`Tastaturteam ${m}`);
    });
  }
});
