import { type Browser, type Locator, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const BASIS = "/api/me/klara/erinnerungen";
const marke = () => crypto.randomUUID();
function termin(ms: number) {
  const t = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return { datum: `${t.year}-${t.month}-${t.day}`, uhrzeit: `${t.hour}:${t.minute}` };
}
async function eigeneSeite(browser: Browser, admin: Page) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL)
    throw new Error("Die Wissenspflegeprobe benötigt ihre konfigurierte Browserbasisadresse.");
  await ensureLoggedIn(admin);
  const email = `pflege-${marke()}@klarwerk.test`;
  const password = "Pflege-Browser-Synthetisch-2026!";
  const neu = await admin.request.post("/api/users", {
    data: { name: "Pflege Probe", email, password, role: "experte" },
  });
  expect(neu.status(), await neu.text()).toBe(201);
  const kontext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 900 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  });
  const p = await kontext.newPage();
  await p.goto("/");
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[type="password"]').first().fill(password);
  await p.locator('button[type="submit"]').click();
  await expect(p.getByTestId("kopfband")).toBeVisible();
  await p.getByTestId("notice-ack").click();
  await expect(p.getByTestId("notice-banner")).toHaveCount(0);
  const titel = `Fiktive Pflegequelle ${marke()}`;
  const q = await p.request.post("/api/kos", {
    data: {
      title: titel,
      statement: "Nur synthetische Prüfunterlage A-4.",
      type: "technik",
      category: "Browser-Pflegeprobe",
      confidentiality: "intern",
    },
  });
  expect(q.status(), await q.text()).toBe(201);
  return { p, titel };
}
async function bereich(p: Page) {
  await p.goto("/aufgaben");
  const b = p.getByTestId("aufgaben-erinnerungen");
  await expect(b).toBeVisible();
  return b;
}
async function entwerfen(b: Locator, vorlage: string, quelleTitel: string, ms: number) {
  await b.getByTestId("klara-erinnerung-neu").click();
  const f = b.getByTestId("klara-erinnerung-entwurf");
  await f.getByTestId("klara-erinnerung-titel").fill(`Fiktive Pflege ${vorlage}`);
  await f.getByTestId("klara-erinnerung-aktion").selectOption("routine_bericht");
  await f.getByLabel("Routinenvorlage").selectOption(vorlage);
  await expect(f.getByTestId("klara-erinnerung-art")).toHaveValue("serie");
  const t = termin(ms);
  await f.getByTestId("klara-erinnerung-datum").fill(t.datum);
  await f.getByTestId("klara-erinnerung-uhrzeit").fill(t.uhrzeit);
  await f.getByTestId("klara-erinnerung-zone-wahl").selectOption("Europe/Berlin");
  await f.getByTestId("klara-erinnerung-takt").selectOption("taeglich");
  await f.getByTestId("klara-erinnerung-ende").selectOption("anzahl");
  await f.getByLabel("Nach Anzahl", { exact: true }).fill("2");
  const w = f.getByTestId("wissenspflege-auswahl");
  await w.getByLabel("Wissensquelle suchen (mindestens zwei Zeichen)").fill(quelleTitel);
  await w.getByRole("checkbox", { name: quelleTitel, exact: true }).check();
  await expect(f.getByTestId("klara-erinnerung-speichern")).toBeDisabled();
  await w.getByRole("button", { name: "Quellenauswahl ohne Wirkung prüfen", exact: true }).click();
  await expect(w.getByTestId("wissenspflege-vorschau-bereit")).toBeVisible();
  return f;
}
async function speichern(p: Page, f: Locator) {
  const antwort = p.waitForResponse(
    (r) => r.url().endsWith(BASIS) && r.request().method() === "POST",
  );
  await f.getByTestId("klara-erinnerung-speichern").click();
  const r = await antwort;
  expect(r.status(), await r.text()).toBe(201);
  const e = (await r.json()).erinnerung;
  const zeile = p.locator(`[data-testid="klara-erinnerung-eintrag"][data-erinnerung="${e.id}"]`);
  await expect(zeile).toBeVisible();
  return { e, zeile };
}

test("AW20 · drei Vorlagen ohne Vorschauwirkung aktivieren, pausieren, ändern, fortsetzen und beenden", async ({
  page,
  browser,
}) => {
  const { p, titel } = await eigeneSeite(browser, page);
  try {
    const b = await bereich(p);
    for (const vorlage of ["offene_pruefungen", "quellaenderung", "aktualitaet"]) {
      const f = await entwerfen(b, vorlage, titel, Date.now() + 86_400_000);
      expect(
        (await (await p.request.get(BASIS)).json()).erinnerungen.filter(
          (e: { status: string }) => e.status === "aktiv",
        ),
      ).toHaveLength(0);
      expect((await (await p.request.get("/api/me/klara/notizen")).json()).notizen).toHaveLength(0);
      const { e, zeile } = await speichern(p, f);
      if (vorlage === "quellaenderung")
        await expect(zeile.getByTestId("klara-erinnerung-ergebnis")).toContainText(
          "Nur bei neuer Quellfassung",
        );
      await expect(zeile.getByTestId("klara-erinnerung-zone")).toContainText("Europe/Berlin");
      await zeile.getByTestId("klara-erinnerung-pausieren").click();
      await expect(zeile).toHaveAttribute("data-status", "pausiert");
      await zeile.getByTestId("klara-erinnerung-oeffnen").click();
      const editor = zeile.getByTestId("wissenspflege-aendern");
      await editor.locator("summary").click();
      await editor
        .getByLabel("Routinenvorlage")
        .selectOption(vorlage === "aktualitaet" ? "offene_pruefungen" : "aktualitaet");
      await expect(
        editor.getByRole("button", { name: "Geprüfte Änderung übernehmen", exact: true }),
      ).toBeDisabled();
      await editor
        .getByRole("button", { name: "Quellenauswahl ohne Wirkung prüfen", exact: true })
        .click();
      const aenderung = p.waitForResponse((r) => r.url().endsWith(`${BASIS}/${e.id}/routine`));
      await editor
        .getByRole("button", { name: "Geprüfte Änderung übernehmen", exact: true })
        .click();
      expect((await aenderung).status()).toBe(200);
      await zeile.getByTestId("klara-erinnerung-fortsetzen").click();
      await expect(zeile).toHaveAttribute("data-status", "aktiv");
      await zeile.getByTestId("klara-erinnerung-beenden").click();
      await expect(zeile).toHaveAttribute("data-status", "beendet");
    }
    await test.info().attach("Drei konfigurierte Pflegevorlagen", {
      body: await p.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  } finally {
    await p.context().close();
  }
});

test("AW20 · bestehender normaler Servertakt liefert eigenen Originalbericht ohne geöffnetes Klara-Gespräch", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const { p, titel } = await eigeneSeite(browser, page);
  try {
    const b = await bereich(p);
    const f = await entwerfen(b, "aktualitaet", titel, Date.now() + 120_000);
    const { e } = await speichern(p, f);
    await p.goto("/kalender");
    await expect
      .poll(
        async () => {
          const r = await p.request.get(`${BASIS}/${e.id}`);
          expect(r.status(), await r.text()).toBe(200);
          return (await r.json()).erinnerung.laeufe.some(
            (l: { ergebnis: { routine?: { notizId?: string } } }) => !!l.ergebnis.routine?.notizId,
          );
        },
        { timeout: 190_000, intervals: [2000, 5000] },
      )
      .toBe(true);
    const detail = (await (await p.request.get(`${BASIS}/${e.id}`)).json()).erinnerung;
    const notizId = detail.laeufe.find(
      (l: { ergebnis: { routine?: { notizId?: string } } }) => !!l.ergebnis.routine?.notizId,
    ).ergebnis.routine.notizId;
    const notizen = (await (await p.request.get("/api/me/klara/notizen")).json()).notizen;
    expect(notizen).toHaveLength(1);
    expect(notizen[0].id).toBe(notizId);
    expect(notizen[0].inhalt).toContain("Dies bestätigt keine fachliche Gültigkeit");
    const b2 = await bereich(p);
    const zeile = b2.locator(`[data-erinnerung="${e.id}"]`);
    await zeile.getByTestId("klara-erinnerung-oeffnen").click();
    await expect(zeile.getByTestId("wissenspflege-pruefstand")).toHaveAttribute(
      "data-stand",
      "vorbereitet",
    );
    await expect(
      zeile.getByRole("button", { name: "Originalbericht öffnen", exact: true }),
    ).toBeVisible();
    await test.info().attach("Normaler Servertakt mit tatsächlichem Originalbericht", {
      body: await p.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  } finally {
    await p.context().close();
  }
});
