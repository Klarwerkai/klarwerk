import { type Browser, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const TEXT = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const ERLAUBNIS =
  "Ich darf die begrenzten Normbekanntmachungen dieser Auswahl verarbeiten und beauftrage die Vorbereitung ihrer Ereignisbelege im Quellenwatch. Keine fachliche Annahme.";
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
    throw new Error("Die Normwatchprobe benötigt ihre konfigurierte Browserbasisadresse.");
  await ensureLoggedIn(admin);
  const email = `normwatch-${marke()}@klarwerk.test`;
  const password = "Normwatch-Browser-Synthetisch-2026!";
  const neu = await admin.request.post("/api/users", {
    data: { name: "Normwatch Probe", email, password, role: "experte" },
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
  return p;
}
async function wissen(p: Page, title: string, statement: string) {
  const r = await p.request.post("/api/kos", {
    data: {
      title,
      statement,
      type: "technik",
      category: "Synthetischer Normwatch",
      confidentiality: "intern",
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()) as { id: string; statement: string };
}

test("AW21 · ausdrücklich bestellter Quellenwatch ergänzt Normgeschichte im normalen Servertakt ohne geöffnetes Gespräch", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const p = await eigeneSeite(browser, page);
  try {
    const titel = `Fiktive Normwatchquelle ${marke()}`;
    const q = await wissen(p, titel, TEXT);
    const anleitung = await wissen(
      p,
      `Fiktive geltende Anleitung ${marke()}`,
      "Bisherige fiktive Anleitungsregel bleibt freigegeben und unverändert.",
    );
    const kopplung = await p.request.post("/api/lifecycle/couple", {
      data: { assetRef: "Norm N-17", koId: anleitung.id },
    });
    expect(kopplung.status(), await kopplung.text()).toBe(204);
    const frei = await page.request.put(`/api/kos/${anleitung.id}`, {
      data: { action: "admin-validate", duplicateAcknowledged: true },
    });
    expect(frei.status(), await frei.text()).toBe(200);
    // Nur der Ausgangsbeleg ist bewusst manuell erfasst; der spätere Publikationsbeleg kommt ausschließlich im realen Takt.
    const anfang = await p.request.post("/api/me/klara/normereignisse/erfassen", {
      data: { quellen: [q.id], bekanntmachungErlaubt: true },
    });
    expect(anfang.status(), await anfang.text()).toBe(200);
    const vorher = await anfang.json();
    const normId: string = vorher.normen[0].id;
    expect(vorher.normen[0].ereignisse).toHaveLength(1);
    expect(vorher.normen[0].ereignisse[0].art).toBe("angekuendigt");
    await p.goto("/aufgaben");
    const b = p.getByTestId("aufgaben-erinnerungen");
    await expect(b).toBeVisible();
    const spaeter = p.getByRole("button", { name: "Später", exact: true });
    if (await spaeter.isVisible()) await spaeter.click();
    await b.getByTestId("klara-erinnerung-neu").click();
    const f = b.getByTestId("klara-erinnerung-entwurf");
    await f.getByTestId("klara-erinnerung-titel").fill("Fiktiver Normwatch im normalen Takt");
    await f.getByTestId("klara-erinnerung-aktion").selectOption("routine_bericht");
    await f.getByLabel("Routinenvorlage").selectOption("quellaenderung");
    const t = termin(Date.now() + 90_000);
    await f.getByTestId("klara-erinnerung-datum").fill(t.datum);
    await f.getByTestId("klara-erinnerung-uhrzeit").fill(t.uhrzeit);
    await f.getByTestId("klara-erinnerung-zone-wahl").selectOption("Europe/Berlin");
    await f.getByTestId("klara-erinnerung-takt").selectOption("taeglich");
    await f.getByTestId("klara-erinnerung-ende").selectOption("anzahl");
    await f.getByLabel("Nach Anzahl", { exact: true }).fill("2");
    const w = f.getByTestId("wissenspflege-auswahl");
    await w.getByLabel("Wissensquelle suchen (mindestens zwei Zeichen)").fill(titel);
    await w.getByRole("checkbox", { name: titel, exact: true }).check();
    await w
      .getByRole("button", { name: "Quellenauswahl ohne Wirkung prüfen", exact: true })
      .click();
    await expect(w.getByTestId("wissenspflege-vorschau-bereit")).toBeVisible();
    await w.getByRole("checkbox", { name: ERLAUBNIS, exact: true }).check();
    await expect(f.getByTestId("klara-erinnerung-speichern")).toBeDisabled();
    await w
      .getByRole("button", { name: "Quellenauswahl ohne Wirkung prüfen", exact: true })
      .click();
    await expect(w.getByTestId("wissenspflege-vorschau-bereit")).toBeVisible();
    expect((await (await p.request.get("/api/me/klara/normereignisse")).json()).fassung).toBe(
      vorher.fassung,
    );
    const erstellt = p.waitForResponse(
      (r) => r.url().endsWith("/api/me/klara/erinnerungen") && r.request().method() === "POST",
    );
    await f.getByTestId("klara-erinnerung-speichern").click();
    const r = await erstellt;
    expect(r.status(), await r.text()).toBe(201);
    const e = (await r.json()).erinnerung;
    expect(e.routine.wissenspflege.normbekanntmachungen).toBe("belege_vorbereiten");
    expect((await (await p.request.get("/api/me/klara/normereignisse")).json()).fassung).toBe(
      vorher.fassung,
    );
    const publik = await p.request.put(`/api/kos/${q.id}`, {
      data: {
        action: "revise",
        changes: {
          statement: TEXT.replace("; Geltung", "; Veröffentlichung am 2026-11-02; Geltung"),
        },
      },
    });
    expect(publik.status(), await publik.text()).toBe(200);
    await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
    await expect
      .poll(
        async () => {
          const n = (
            await (await p.request.get("/api/me/klara/normereignisse")).json()
          ).normen.find((n: { id: string }) => n.id === normId);
          return n?.ereignisse.map((e: { art: string }) => e.art) ?? [];
        },
        { timeout: 130_000, intervals: [1000, 3000, 5000] },
      )
      .toEqual(["angekuendigt", "veroeffentlicht"]);
    const ergebnis = (await (await p.request.get(`/api/me/klara/erinnerungen/${e.id}`)).json())
      .erinnerung;
    expect(ergebnis.laeufe[0].ergebnis.routine.wissenspflege.normbekanntmachungen.stand).toBe(
      "belege_vorbereitet",
    );
    const notizen = (await (await p.request.get("/api/me/klara/notizen")).json()).notizen;
    expect(notizen).toHaveLength(1);
    expect(ergebnis.laeufe[0].ergebnis.routine.notizId).toBe(notizen[0].id);
    const original = await (await p.request.get(`/api/kos/${anleitung.id}`)).json();
    expect(original.status).toBe("validiert");
    expect(original.statement).toBe(anleitung.statement);
    const n = (await (await p.request.get("/api/me/klara/normereignisse")).json()).normen[0];
    expect(n.id).toBe(normId);
    expect(n.annahmen).toEqual([]);
    await p.reload();
    await expect(p.getByTestId("wissenspflege-pruefstand").first()).toContainText(
      "Normereignisbelege im bestellten Umfang vorbereitet",
    );
    await p.goto("/kalender#normereignisse");
    const karte = p.getByTestId("normgeschichte");
    await expect(karte).toHaveCount(1);
    await expect(karte).toContainText("Veröffentlichung · 2026-11-02");
    await karte.screenshot({ path: info.outputPath("normwatch-nach-echtem-takt.png") });
  } catch (err) {
    await p.screenshot({ path: info.outputPath("normwatch-fehler-vor-ende.png"), fullPage: true });
    throw err;
  } finally {
    await p.context().close();
  }
});
