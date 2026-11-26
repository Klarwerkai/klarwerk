import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { extname, resolve } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
let app: ReturnType<typeof buildApp>;
let server: Server;
let browser: Browser;
let origin = "";
let token = "";
let notizId = "";
const dist = resolve("apps/web/dist");

async function notizImBegleiterOeffnen(page: Page, id: string) {
  await page.goto(`${origin}/begleiter`);
  await page.getByTestId("begleiter-figur").click();
  await page.getByTestId("begleiter-nav-notizen").click();
  await page.locator(`[data-testid="klara-notiz-eintrag"][data-notiz="${id}"]`).click();
  const stand = page.getByTestId("wissen-ergebnis");
  await stand.waitFor();
  return stand;
}

beforeAll(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "F Browser", email: "browser@f.test", password: "synthetisch123" },
  });
  token = (
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "browser@f.test", password: "synthetisch123" },
    })
  ).json().token;
  server = createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      if (url.startsWith("/api/")) {
        const chunks: Buffer[] = [];
        for await (const b of req) chunks.push(Buffer.from(b));
        const raw = Buffer.concat(chunks);
        const headers = {
          ...req.headers,
          authorization: req.headers.authorization ?? `Bearer ${token}`,
        };
        delete headers.host;
        const r = await app.inject({
          method: req.method as "GET",
          url,
          headers,
          ...(raw.length ? { payload: raw } : {}),
        });
        res.writeHead(r.statusCode, r.headers);
        res.end(r.rawPayload);
        return;
      }
      const pathname = new URL(url, "http://localhost").pathname;
      const p = resolve(dist, `.${pathname}`);
      const file =
        p.startsWith(`${dist}/`) && existsSync(p) && statSync(p).isFile()
          ? p
          : resolve(dist, "index.html");
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".png": "image/png",
      };
      res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Adresse fehlt");
  origin = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true });
}, 60000);
afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => server?.close(() => r()));
  await app?.close();
});
it("F08 · echter Browser: gewählter Chat → privates Original → Vorschau → bewusste gemeinsame Übernahme → Rücklink", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/start`);
  await page.locator('[data-testid="klara-figur"]').click();
  await page.locator('[data-testid="klara-menue-knopf"]').click();
  await page.locator('[data-testid="klara-menue-funktionen"]').click();
  await page.locator('[data-testid="wissen-import"] summary').click();
  for (const [feld, wert] of Object.entries({
    titel: "F Browser Service",
    projekt: "Presse 4",
    abschnitt: "gewählter Chat / Antwort 1",
    fassung: "Exportfassung 1",
    text: "Ölstand nur bei stehender Presse prüfen.\nEmpfehlung: Pause.",
  })) {
    await page.locator(`[data-testid="wissen-import-${feld}"]`).fill(wert);
  }
  await page.locator('[data-testid="wissen-import-speichern"]').click();
  await page.locator('[data-testid="klara-notiz-offen"]').waitFor();
  notizId =
    (await page.locator('[data-testid="klara-notiz-offen"]').getAttribute("data-notiz")) ?? "";
  expect(notizId).not.toBe("");
  await page.getByTestId("wissen-pruefen").click();
  const referenz = page.getByTestId("notiz-quellenpruefung");
  await referenz.waitFor();
  expect(await referenz.getAttribute("data-status")).toBe("nicht_pruefbar");
  expect(await page.getByTestId("notiz-modellherkunft").count()).toBe(0);
  await page.locator('[data-testid="klara-wissen"] > button').click();
  await page.locator('[data-testid="wissen-stufe"]').selectOption("intern");
  await page.getByTestId("wissen-typ").selectOption("best_practice");
  await page.locator('[data-testid="wissen-kategorie"]').fill("Wartung");
  await page.locator('[data-testid="wissen-bedingungen"]').fill("Stillstand\nFachpersonal");
  await page.locator('[data-testid="wissen-vorschau"]').click();
  await page.locator('[data-testid="wissen-vorschau-inhalt"]').waitFor();
  expect(await page.getByTestId("wissen-vorschau-typ").innerText()).toContain("Best Practice");
  expect(await page.locator('[data-testid="wissen-vorschau-inhalt"]').textContent()).toContain(
    "Ölstand",
  );
  await page.locator('[data-testid="wissen-uebernehmen"]').dblclick();
  await page.locator('[data-testid="wissen-ergebnis"]').waitFor();
  const href = await page.locator('[data-testid="wissen-ergebnis"] a').getAttribute("href");
  expect(href).toMatch(/^\/wissen\//);
  const list = await app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(list.statusCode, list.body).toBe(200);
  const r = await app.inject({
    method: "GET",
    url: `/api/me/klara/notizen/${notizId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(r.statusCode).toBe(200);
  mkdirSync(".local/run/klara-f", { recursive: true });
  await page.locator('[data-testid="wissen-ergebnis"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/run/klara-f/f08-browser.png", fullPage: true });
  writeFileSync(
    ".local/run/klara-f/f08-browser.json",
    JSON.stringify(
      {
        browser: browser.version(),
        origin,
        notizId,
        beitrag: href,
        synthetisch: true,
        foreground: false,
      },
      null,
      2,
    ),
  );
  await page.close();

  const begleiter = await browser.newPage({ locale: "de-DE" });
  let neuePruefungen = 0;
  begleiter.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/wissen/pruefen")) neuePruefungen++;
  });
  const offen = await notizImBegleiterOeffnen(begleiter, notizId);
  await begleiter.getByTestId("notiz-pruefstand").waitFor();
  expect(await begleiter.getByTestId("notiz-quellenpruefung").getAttribute("data-status")).toBe(
    "nicht_pruefbar",
  );
  expect(neuePruefungen).toBe(0);
  expect(await offen.getByRole("link").getAttribute("href")).toBe(href);
  expect(await offen.innerText()).toContain("Zur Prüfung eingereicht");
  const pruefung = await app.inject({
    method: "PUT",
    url: `/api/kos/${href?.split("/").at(-1)}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { action: "admin-validate" },
  });
  expect(pruefung.statusCode, pruefung.body).toBe(200);
  const entschieden = await notizImBegleiterOeffnen(begleiter, notizId);
  expect(await entschieden.innerText()).toContain("Fachlich bestätigt");
  const beitrag = entschieden.getByRole("link");
  expect(await beitrag.getAttribute("href")).toBe(href);
  await beitrag.click();
  await begleiter.waitForURL((url) => url.pathname === href);
  for (const [sprache, erwartet] of [
    ["en", "Approved"],
    ["nl", "Goedgekeurd"],
  ] as const) {
    await begleiter.evaluate((wert) => localStorage.setItem("kw.sprache", wert), sprache);
    const uebersetzt = await notizImBegleiterOeffnen(begleiter, notizId);
    expect(await uebersetzt.innerText()).toContain(erwartet);
    expect(await uebersetzt.getByRole("link").getAttribute("href")).toBe(href);
  }
  await begleiter.close();
}, 60000);

it("F15 · Browser importiert private Besprechungsnotiz und speichert bewusst Aufgabe/Übergabe über echte Produktwege", async () => {
  const headers = { authorization: `Bearer ${token}` };
  const basisquelle = await app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers,
    payload: {
      vorgang: "f-browser-fristenregel",
      weg: "geschrieben",
      titel: "Fristenregel Browser",
      inhalt: "Keine Termine in dieser Notiz.",
      objektbezug: { pfad: "/kalender", seitenName: "Mein Kalender", objekt: "Fristenregel" },
    },
  });
  expect(basisquelle.statusCode, basisquelle.body).toBe(201);
  const regel = {
    aktiv: true,
    quellen: [{ art: "notiz", id: basisquelle.json().notiz.id }],
    arten: ["ablauf"],
    bereich: "persoenlich",
    zeitzone: "Europe/Berlin",
    aenderung: "klaeren",
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: "aw19-sollbestand-1",
  };
  const konfig = await app.inject({
    method: "PUT",
    url: "/api/me/klara/fristen/regel",
    headers,
    payload: { regel, fassung: 0 },
  });
  expect(konfig.statusCode, konfig.body).toBe(200);
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/start`);
  await page.locator('[data-testid="klara-figur"]').click();
  await page.locator('[data-testid="klara-menue-knopf"]').click();
  await page.locator('[data-testid="klara-menue-funktionen"]').click();
  await page.locator('[data-testid="besprechung-import"] summary').click();
  await page.locator('[data-testid="besprechung-import-titel"]').fill("F Browsermeeting");
  await page
    .locator('[data-testid="besprechung-import-text"]')
    .fill(
      "Beschluss: Testlauf durchführen.\nOffen: Vertragsstand klären.\nAufgabe: Lizenz prüfen.\nLizenz L-94: Ablaufdatum 2027-04-30.",
    );
  await page.locator('[data-testid="besprechung-berechtigt"]').check();
  await page.locator('[data-testid="besprechung-import-speichern"]').click();
  await page.locator('[data-testid="besprechung-auswertung"]').waitFor();
  await page.locator('[data-testid="besprechung-auswahl-zeile-4"]').check();
  await page.locator('[data-testid="besprechung-fristquelle"]').click();
  await page.getByText("Quelle gespeichert; aktive Regel angewendet.", { exact: false }).waitFor();
  expect(await page.locator('[data-testid="besprechung-friststand"]').innerText()).toContain(
    "2027-04-30",
  );
  const friststand = (
    await app.inject({ method: "GET", url: "/api/me/klara/fristen", headers })
  ).json();
  expect(friststand.regel).toMatchObject({
    ...regel,
    quellen: expect.arrayContaining(regel.quellen),
  });
  expect(friststand.regel.quellen).toHaveLength(2);
  expect(friststand.fristen).toHaveLength(1);
  await page.locator('[data-testid="besprechung-fristquelle"]').click();
  await page.locator('[data-testid="besprechung-fristquelle"]').waitFor({ state: "visible" });
  expect(
    (await app.inject({ method: "GET", url: "/api/me/kalender", headers }))
      .json()
      .eintraege.filter((e: { art: string }) => e.art === "frist"),
  ).toHaveLength(1);
  await page.screenshot({ path: ".local/run/klara-f/f15-fristen-browser.png", fullPage: true });
  await page.locator('[data-testid="besprechung-auswahl-zeile-4"]').uncheck();
  for (const id of ["zeile-1", "zeile-2", "zeile-3"])
    await page.locator(`[data-testid="besprechung-auswahl-${id}"]`).check();
  await page.locator('[data-testid="besprechung-eigene"]').check();
  await page.locator('[data-testid="besprechung-uebernehmen"]').click();
  await page.waitForFunction(
    `document.querySelector('[data-testid="klara-notiz-inhalt"]')?.value.includes("Transkriptfassung 1")`,
  );
  expect(await page.locator('[data-testid="klara-notiz-inhalt"]').inputValue()).toContain(
    "Transkriptfassung 1",
  );
  const p = await app.inject({
    method: "GET",
    url: "/api/me/klara/aufgaben",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(p.body).toContain("Lizenz prüfen.");
  await page.locator('[data-testid="klara-notiz-offen"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/run/klara-f/f15-browser.png", fullPage: true });
  await page.close();
}, 60000);

it("Einkaufsbeschluss: echte Klara-Notiz, Änderung zur Prüfung und wiederauffindbare gültige Fassung", async () => {
  const headers = { authorization: `Bearer ${token}` };
  async function auf(
    method: "GET" | "POST" | "PUT",
    url: string,
    payload?: Record<string, unknown>,
    h = headers,
  ) {
    const r = await app.inject({ method, url, headers: h, ...(payload ? { payload } : {}) });
    expect(r.statusCode, r.body).toBeLessThan(300);
    return r.json();
  }
  const titel = "Einkaufsfreigabe Brumalit";
  const alt = "Für den Einkauf von Brumalit ist ein Angebot erforderlich.";
  const neu = "Für den Einkauf von Brumalit sind drei Angebote erforderlich.";
  const ko = await auf("POST", "/api/kos", {
    title: titel,
    statement: alt,
    type: "best_practice",
    category: "Einkauf",
    confidentiality: "intern",
    neededValidations: 1,
  });
  const ziel = `/api/kos/${ko.id}`;
  await auf("PUT", ziel, { action: "rate", verdict: "up" });
  const m = await auf("POST", "/api/me/klara/besprechungen/import", {
    titel: "Beschaffungsrunde",
    meetingId: "browser-einkauf",
    berechtigt: true,
    text: `Beschluss: ${neu}\nOffen: Private Wortmeldung.`,
  });
  const n = await auf("POST", `/api/me/klara/besprechungen/${m.notiz.id}/uebernehmen`, {
    fassung: m.notiz.fassung,
    bewusst: true,
    auswahl: ["zeile-1"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(15000);
  try {
    const url = `${origin}/start?notiz=${n.notizId}`;
    await page.goto(url);
    await page.getByTestId("klara-notiz-offen").waitFor();
    const pane = page.getByTestId("klara-wissen");
    await pane.getByRole("button", { name: "Bewusst als Wissen übernehmen" }).click();
    await pane.getByTestId("wissen-art").selectOption("regel");
    await pane.getByLabel("Gültigen Eintrag suchen").fill("Brumalit");
    await pane.getByRole("button", { name: `${titel} · v1` }).click();
    await pane.getByLabel("Beleg in der privaten Notiz markieren").evaluate((el, text) => {
      const feld = el as unknown as {
        value: string;
        focus(): void;
        setSelectionRange(start: number, ende: number): void;
      };
      const start = feld.value.indexOf(text);
      if (start < 0) throw new Error("Beleg fehlt");
      feld.focus();
      feld.setSelectionRange(start, start + text.length);
    }, neu);
    await pane.getByRole("button", { name: "Markierten Auszug verwenden" }).click();
    expect(await pane.getByLabel("Vorgeschlagene Kernaussage").inputValue()).toBe(neu);
    await pane.getByRole("button", { name: "Vorschau zeigen" }).click();
    await pane.getByText("Wer den Eintrag lesen darf, sieht", { exact: false }).waitFor();
    await pane.getByRole("button", { name: "Änderung zur fachlichen Prüfung einreichen" }).click();
    await pane.getByRole("link", { name: "Eintrag und Prüfstand öffnen" }).waitFor();
    const stand = await auf("GET", ziel);
    expect(stand.statement).toBe(alt);
    const email = "regelpruefung@browser.test";
    const passwort = "synthetisch123";
    await auf("POST", "/api/users", {
      name: "Fachprüfung",
      role: "admin",
      email,
      password: passwort,
    });
    const p = await auf("POST", "/api/auth/login", { email, password: passwort });
    const fach = { authorization: `Bearer ${p.token}` };
    const pruefseite = await browser.newPage({ extraHTTPHeaders: fach, locale: "de-DE" });
    try {
      await pruefseite.goto(`${origin}/validierung`);
      await pruefseite.getByText("Offene Regelvorschläge aus Klara", { exact: false }).click();
      await pruefseite.getByRole("link", { name: titel, exact: true }).click();
      const vorschlag = pruefseite.getByTestId("bib-vorschlag");
      await vorschlag.waitFor();
      expect(await vorschlag.getAttribute("data-vorschlag-id")).toBe(stand.proposals[0].id);
      expect(await pruefseite.locator('[data-testid="bib-vorschlag"]:focus').count()).toBe(1);
      await vorschlag.getByTestId("bib-vorschlag-uebernehmen").click();
      await vorschlag.waitFor({ state: "detached" });
      const neuladen = pruefseite.waitForResponse((r) =>
        r.url().includes("/api/validation/board?ansicht=klara-regelvorschlaege"),
      );
      await pruefseite.goto(`${origin}/validierung`);
      expect(await (await neuladen).json()).toEqual([]);
      expect(await pruefseite.getByRole("link", { name: titel, exact: true }).count()).toBe(0);
    } finally {
      await pruefseite.close();
    }
    await auf(
      "PUT",
      ziel,
      {
        action: "revise-release",
        changes: { statement: "Für den Einkauf von Brumalit gelten inzwischen vier Angebote." },
        expectedVersion: 2,
      },
      fach,
    );
    await page.goto(url);
    const status = page.getByRole("region", { name: "Änderungsvorschläge aus dieser Notiz" });
    await status.getByRole("link", { name: titel }).waitFor();
    expect(await status.textContent()).toContain("v1 → v2");
    await status.getByRole("link", { name: /3/ }).click();
    const fassung = page.getByTestId("gespeicherte-fassung");
    await fassung.waitFor();
    expect(await fassung.getAttribute("data-fassung")).toBe("3");
    expect(await fassung.textContent()).toContain("vier Angebote");
    await page.goto(url);
    await status.getByRole("link", { name: titel }).click();
    await fassung.waitFor();
    expect(await fassung.getAttribute("data-fassung")).toBe("2");
    await fassung.getByText("Freigegeben von Fachprüfung", { exact: true }).waitFor();
    expect(await fassung.textContent()).toContain(neu);
    expect(await fassung.textContent()).not.toContain("vier Angebote");
    for (const [sprache, historie, teilen, suche, publikum] of [
      [
        "en",
        "Amendments from this note",
        "Consciously share as knowledge",
        "Find an approved entry",
        "Anyone who can read the entry",
      ],
      [
        "nl",
        "Wijzigingsvoorstellen uit deze notitie",
        "Bewust als kennis delen",
        "Zoek een goedgekeurd artikel",
        "Iedereen met leestoegang tot het artikel",
      ],
    ] as const) {
      await page.evaluate((wert) => localStorage.setItem("kw.sprache", wert), sprache);
      await page.goto(url);
      await page
        .getByRole("region", { name: historie })
        .getByRole("link", { name: titel })
        .waitFor();
      await pane.getByRole("button", { name: teilen }).click();
      await pane.getByTestId("wissen-art").selectOption("regel");
      await pane.getByLabel(suche).fill("Brumalit");
      await pane.getByRole("button", { name: `${titel} · v3` }).click();
      await pane.getByText(publikum, { exact: false }).waitFor();
    }
  } finally {
    await page.close();
  }
}, 60000);
