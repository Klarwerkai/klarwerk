import { join } from "node:path";
import { type Browser, type Locator, type Page, chromium } from "playwright";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { stelleFlaecheBereit } from "../import-wiederoeffnen-nutzerweg/strecke";

// Nur der externe Modellprozess wird ersetzt. Quelle, Freigabe, beide Antworten, HTTP und UI sind echt.
vi.mock("../../services/reasoner", async (original) => ({
  ...(await original<typeof import("../../services/reasoner")>()),
  createCappedLocalClientFromEnv: () => ({
    name: "vergleich-test-lokal",
    complete: async (_system: string, eingabe: string) => {
      const aussage = /^\[1\] [^\n]+?: (.+)$/m.exec(eingabe)?.[1];
      return aussage ? `${aussage} [1]` : "{}";
    },
  }),
}));

const dienste = assembleServices(inMemoryRepos());
const app = buildApp(dienste);
const konto = {
  name: "Prüferin",
  email: "vergleich@example.test",
  password: "fiktiver-testwert-123",
};
const titel = "Ventil bei Überdruck schließen";
const frage = "Was tun bei Überdruck am Ventil?";
const damals = "Bei Überdruck Ventil X manuell schließen.";
const heute = "Bei Überdruck Ventil Y automatisch schließen lassen.";
const archiv = "Archivversand verlangt einen Kurierbeleg.";
const tag = 86400000;
const jetzt = Date.now();
const stichtag = new Date(jetzt - 30 * tag).toISOString().slice(0, 10);
const sprachen = {
  de: ["Damals · Fassung 1", "Heute · Fassung 2"],
  en: ["Then · Version 1", "Today · Version 2"],
  nl: ["Toen · Versie 1", "Vandaag · Versie 2"],
} as const;
let id: string;
let basis: string;
let browser: Browser;

beforeAll(async () => {
  stelleFlaecheBereit();
  await mitFlaeche().vorListen(app);
  const autor = await dienste.auth.register(konto);
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(jetzt - 40 * tag);
    const felder = {
      author: autor.id,
      type: "best_practice",
      category: "Betrieb",
      confidentiality: "intern",
    } as const;
    const quelle = await dienste.ko.create({ ...felder, title: titel, statement: damals });
    const alt = await dienste.ko.create({ ...felder, title: "Archivversand", statement: archiv });
    await dienste.validation.adminValidate(quelle.id, autor.id);
    await dienste.validation.adminValidate(alt.id, autor.id);
    vi.setSystemTime(jetzt - 10 * tag);
    await dienste.ko.revise(quelle.id, { statement: heute }, autor.id);
    await dienste.validation.adminValidate(quelle.id, autor.id);
    // Für die zweite Frage ist nur die frühere belegte Wortwahl auffindbar.
    await dienste.ko.revise(
      alt.id,
      { title: "Lagerausgabe", statement: "Warenabholung benötigt einen Lieferschein." },
      autor.id,
    );
    await dienste.validation.adminValidate(alt.id, autor.id);
    id = quelle.id;
  } finally {
    vi.useRealTimers();
  }
  basis = await app.listen({ host: "127.0.0.1", port: 0 });
  browser = await chromium.launch({ headless: true });
}, 120000);

afterAll(async () => {
  await browser?.close();
  await app.close();
});

async function starten(sprache: keyof typeof sprachen, eingabe: string) {
  const context = await browser.newContext({
    baseURL: basis,
    viewport: { width: 1280, height: 960 },
  });
  const login = await context.request.post("/api/auth/login", {
    data: { email: konto.email, password: konto.password },
  });
  expect(login.status()).toBe(200);
  await context.addInitScript((s) => localStorage.setItem("kw.sprache", s), sprache);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto("/fragen");
  const feld = page.locator('[data-tutorial-ziel="fragen.fragefeld"]');
  await feld.fill(eingabe);
  await page.locator('[data-tutorial-ziel="fragen.absenden"]').click();
  await page.getByTestId("ask-vergleich-stichtag").fill(stichtag);
  return { context, page };
}

async function fassungOeffnen(seite: Page, link: Locator, version: number, aussage: string) {
  expect(await link.getAttribute("href")).toBe(
    `/wissen/${id}?fassung=${version}&ansicht=gespeichert`,
  );
  const [quelle] = await Promise.all([
    seite.context().waitForEvent("page", { timeout: 10000 }),
    link.click({ modifiers: ["ControlOrMeta"] }),
  ]);
  await quelle
    .getByTestId("gespeicherte-fassung-aussage")
    .filter({ hasText: aussage })
    .waitFor({ timeout: 10000 });
  await quelle.close();
}

it.each(["de", "en", "nl"] as const)(
  "%s: Frage, Stichtag, alte und heutige Antwort und beide gespeicherten Fassungen öffnen",
  async (sprache) => {
    const { page, context } = await starten(sprache, frage);
    try {
      await page.getByTestId("ask-vergleich-start").click();
      await page.getByTestId("ask-vergleich-damals").getByText(damals, { exact: false }).waitFor();
      await page.getByTestId("ask-vergleich-heute").getByText(heute, { exact: false }).waitFor();
      const quelle = page.getByTestId("ask-vergleich-quelle").filter({ hasText: titel });
      await quelle.getByTestId("ask-vergleich-grund-ueberarbeitet").waitFor();
      const bilder = process.env.KLARWERK_VERGLEICH_BILDER;
      if (bilder)
        await page
          .getByTestId("ask-vergleich-ergebnis")
          .screenshot({ path: join(bilder, `VERGLEICH-${sprache}.png`) });
      await fassungOeffnen(
        page,
        quelle.getByRole("link", { name: sprachen[sprache][0] }),
        1,
        damals,
      );
      await fassungOeffnen(
        page,
        quelle.getByRole("link", { name: sprachen[sprache][1] }),
        2,
        heute,
      );
    } finally {
      await context.close();
    }
  },
  60000,
);

it("der Vergleich ist auch nach einer heutigen Wissenslücke erreichbar", async () => {
  const { page, context } = await starten("de", "Archivversand Kurierbeleg?");
  try {
    await page.getByTestId("ask-gap").waitFor();
    await page.getByTestId("ask-vergleich-start").click();
    await page.getByTestId("ask-vergleich-damals").getByText(archiv, { exact: false }).waitFor();
    await page
      .getByTestId("ask-vergleich-heute")
      .getByText("Keine belastbare Grundlage", { exact: false })
      .waitFor();
  } finally {
    await context.close();
  }
}, 60000);

it("ein zwischenzeitlich geänderter Stand lässt sich erneut prüfen; eine verspätete Antwort gehört weiter zum alten Datum", async () => {
  const { page, context } = await starten("en", frage);
  const pfad = "**/api/ask/vergleich";
  try {
    // Der Frontend-Fehlerpfad stellt die reale 409-Vertragsantwort nach.
    await page.route(
      pfad,
      (route) =>
        route.fulfill({
          status: 409,
          json: { error: "VERGLEICHSSTAND_GEAENDERT", message: "Stand geändert" },
        }),
      { times: 1 },
    );
    const start = page.getByTestId("ask-vergleich-start");
    await start.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "The sources or your access changed" })
      .waitFor();
    // Die nächste echte Antwort erst nach dem Wechsel des Stichtags an den Browser ausliefern.
    let freigeben: () => void = () => {};
    const warte = new Promise<void>((resolve) => {
      freigeben = resolve;
    });
    await page.route(
      pfad,
      async (route) => {
        const response = await route.fetch();
        await warte;
        await route.fulfill({ response });
      },
      { times: 1 },
    );
    const unterwegs = page.waitForRequest((r) => r.url().endsWith("/api/ask/vergleich"));
    await start.click();
    await unterwegs;
    const anderesDatum = new Date(jetzt - 5 * tag).toISOString().slice(0, 10);
    await page.getByTestId("ask-vergleich-stichtag").fill(anderesDatum);
    const ausgeliefert = page.waitForResponse((r) => r.url().endsWith("/api/ask/vergleich"));
    freigeben();
    await ausgeliefert;
    expect(await page.getByTestId("ask-vergleich-ergebnis").count()).toBe(0);
    await start.click();
    await page.getByTestId("ask-vergleich-damals").getByText(heute, { exact: false }).waitFor();
    await page.getByTestId("ask-vergleich-heute").getByText(heute, { exact: false }).waitFor();
  } finally {
    await context.close();
  }
}, 60000);
