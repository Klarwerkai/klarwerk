import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { stelleFlaecheBereit } from "../import-wiederoeffnen-nutzerweg/strecke";
import { anfrage, fachbereich } from "../teamassistenten/aufbau";

const services = assembleServices(inMemoryRepos());
const app = buildApp(services);
let browser: Browser;
let basis: string;
let f: Awaited<ReturnType<typeof fachbereich>>;
beforeAll(async () => {
  stelleFlaecheBereit();
  await mitFlaeche().vorListen(app);
  f = await fachbereich(services, app);
  const autor = anfrage(app, f.autor.token);
  const pruefung = await autor("POST", `${f.pfad}/pruefen`, { revision: 1, sprache: "de" });
  expect(pruefung.json().pruefung.bestanden).toBe(true);
  const frei = await autor("POST", `${f.pfad}/freigeben`, {
    revision: pruefung.json().revision,
    version: 1,
  });
  expect(frei.statusCode).toBe(200);
  basis = await app.listen({ host: "127.0.0.1", port: 0 });
  browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
  await browser?.close();
  await app.close();
});

const texte = {
  de: {
    verwaltung: "Workflows verwalten",
    neu: "Workflow erstellen",
    name: "Netzfreigabe im Service",
    ausloeser: "Ein Gastnetz wird an den Kunden übergeben.",
    namen: ["Netzregel prüfen", "Übergabe freigeben", "Übergabeprotokoll speichern"],
    fehl: "Test für Version 1 fehlgeschlagen",
    erfolg: "Test für Version 2 bestanden",
    entscheidung: "Übergabe freigeben",
    klaerung: "Rückfrage offen",
    fertig: "Abgeschlossen",
    verlauf: "Gespeicherte Ergebnisse",
  },
  en: {
    verwaltung: "Manage workflows",
    neu: "Create workflow",
    name: "Service network approval",
    ausloeser: "A guest network is handed over to the customer.",
    namen: ["Check network policy", "Approve handover", "Save handover record"],
    fehl: "Version 1 failed the test",
    erfolg: "Version 2 passed the test",
    entscheidung: "Approve handover",
    klaerung: "Clarification needed",
    fertig: "Completed",
    verlauf: "Recorded results",
  },
  nl: {
    verwaltung: "Workflows beheren",
    neu: "Workflow maken",
    name: "Netwerkvrijgave voor service",
    ausloeser: "Een gastnetwerk wordt overgedragen aan de klant.",
    namen: ["Netwerkregel controleren", "Overdracht goedkeuren", "Overdrachtsverslag opslaan"],
    fehl: "Test voor versie 1 mislukt",
    erfolg: "Test voor versie 2 geslaagd",
    entscheidung: "Overdracht goedkeuren",
    klaerung: "Toelichting gevraagd",
    fertig: "Afgerond",
    verlauf: "Opgeslagen resultaten",
  },
};
async function anmelden(konto: string, lang: keyof typeof texte, schmal = false) {
  const context = await browser.newContext({
    baseURL: basis,
    viewport: schmal ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  });
  const login = await context.request.post("/api/auth/login", {
    data: { email: `${konto}@team.test`, password: "synthetisch123" },
  });
  expect(login.status()).toBe(200);
  await context.addInitScript((s) => localStorage.setItem("kw.sprache", s), lang);
  return context;
}

it.each(["de", "en", "nl"] as const)(
  "Entwurf, Test, Freigabe, Fall vom Team und Entscheidung im Browser · %s",
  async (lang) => {
    const wort = texte[lang];
    const autor = await anmelden("autorin", lang);
    const leser = await anmelden("leser", lang, lang === "nl");
    try {
      const page = await autor.newPage();
      page.setDefaultTimeout(12_000);
      await page.goto("/teamworkflows");
      await page.getByRole("button", { name: wort.verwaltung }).click();
      await page.getByRole("button", { name: wort.neu }).press("Enter");
      await page.getByTestId("workflow-name").fill(wort.name);
      await page.getByTestId("workflow-name").press("Tab");
      expect(
        await page.evaluate(
          'document.activeElement?.getAttribute("data-testid") === "workflow-ausloeser"',
        ),
      ).toBe(true);
      await page.getByTestId("workflow-ausloeser").fill(wort.ausloeser);
      await page.getByTestId("workflow-beispielfall").fill(f.aussage);
      for (const [i, typ] of (["assistent", "entscheidung", "aktion"] as const).entries()) {
        await page.getByTestId(`workflow-add-${typ}`).click();
        const step = page.getByTestId("workflow-schritt").nth(i);
        await step.getByTestId("schritt-titel").fill(wort.namen[i] ?? "");
        if (typ === "assistent") {
          await step.getByTestId("schritt-assistent").selectOption(f.id);
          await step.getByTestId("schritt-frage").fill(f.definition.beispiele[1]?.frage ?? "");
        }
      }
      await page.getByTestId("workflow-speichern").click();
      await page.waitForURL(/bearbeiten=/);
      const id = new URL(page.url()).searchParams.get("bearbeiten");
      if (!id) throw new Error("Kennung fehlt");
      expect((await leser.request.get(`/api/teamworkflows/${id}`)).status()).toBe(404);
      await page.getByTestId("workflow-pruefen").click();
      await page.getByTestId("workflow-pruefergebnis").getByText(wort.fehl).waitFor();
      expect(await page.getByTestId("workflow-freigeben").isDisabled()).toBe(true);
      await page.getByTestId("schritt-frage").fill("{{fall}}");
      await page.getByTestId("workflow-speichern").click();
      await page.getByTestId("workflow-pruefen").click();
      const bericht = page.getByTestId("workflow-pruefergebnis");
      await bericht.getByText(wort.erfolg).waitFor();
      expect(await bericht.getByRole("listitem").count()).toBe(3);
      const bilder = process.env.KLARWERK_WORKFLOW_BILDER;
      if (lang === "de" && bilder) {
        await page.getByTestId("toast-meldung").first().waitFor({ state: "hidden" });
        await page
          .getByTestId("workflow-editor")
          .screenshot({ path: join(bilder, "WORKFLOW-EDITOR-DE.png") });
      }
      const freigabe = page.waitForResponse(
        (r) => r.url().endsWith("/freigeben") && r.request().method() === "POST",
      );
      await page.getByTestId("workflow-freigeben").click();
      expect((await freigabe).status()).toBe(200);
      await page.getByTestId("workflow-freigeben").waitFor({ state: "visible" });
      const mitglied = await leser.newPage();
      mitglied.setDefaultTimeout(12_000);
      await mitglied.goto("/teamworkflows");
      expect(await mitglied.getByRole("button", { name: wort.verwaltung }).count()).toBe(0);
      await mitglied.getByRole("button", { name: new RegExp(wort.name) }).click();
      await mitglied.getByTestId("workflow-fall").waitFor();
      expect(await mitglied.getByTestId("workflow-starten").isDisabled()).toBe(true);
      await mitglied.getByTestId("workflow-fall").fill(f.aussage);
      await mitglied.getByTestId("workflow-starten").click();
      await mitglied.waitForURL(/lauf=/);
      const url = mitglied.url();
      await mitglied.getByTestId("workflow-weiter").press("Enter");
      await mitglied.getByText(wort.entscheidung, { exact: true }).waitFor();
      expect(await mitglied.getByTestId("workflow-annehmen").count()).toBe(0);
      if (lang === "de") {
        await page.getByTestId("workflow-ausloeser").fill("Ein neuer Vorgang für Version drei.");
        await page.getByTestId("workflow-speichern").click();
        await page.getByTestId("workflow-pruefen").click();
        await bericht.getByText("Test für Version 3 bestanden").waitFor();
        const zweiteFreigabe = page.waitForResponse(
          (r) => r.url().endsWith("/freigeben") && r.request().method() === "POST",
        );
        await page.getByTestId("workflow-freigeben").click();
        expect((await zweiteFreigabe).status()).toBe(200);
      }
      const pruefer = await autor.newPage();
      pruefer.setDefaultTimeout(12_000);
      await pruefer.goto(url);
      await pruefer.getByTestId("workflow-annehmen").waitFor();
      await pruefer.getByText(wort.ausloeser, { exact: false }).waitFor();
      expect(await pruefer.getByTestId("workflow-vorgang").innerText()).toContain("leser");
      expect(await pruefer.getByRole("blockquote").first().textContent()).toBe(f.aussage);
      await pruefer
        .getByRole("listitem")
        .filter({ has: pruefer.getByRole("blockquote") })
        .getByText(wort.namen[0] ?? "", { exact: true })
        .waitFor();
      if (lang === "de" && bilder) {
        await pruefer.getByTestId("toast-meldung").first().waitFor({ state: "hidden" });
        await pruefer
          .getByTestId("workflow-vorgang")
          .screenshot({ path: join(bilder, "WORKFLOW-ENTSCHEIDUNG-DE.png") });
      }
      await pruefer.getByTestId("workflow-notiz").fill("Handover record?");
      await pruefer.getByTestId("workflow-rueckfrage").click();
      await pruefer.getByTestId("workflow-stand").getByText(wort.klaerung).waitFor();
      await mitglied.reload();
      await mitglied.getByTestId("workflow-notiz").fill("Ticket 125");
      await mitglied.getByTestId("workflow-antworten").click();
      await mitglied.getByText("Ticket 125", { exact: true }).waitFor();
      await pruefer.reload();
      await pruefer.getByTestId("workflow-annehmen").click();
      await pruefer.getByTestId("workflow-weiter").click();
      await pruefer.getByTestId("workflow-stand").getByText(wort.fertig).waitFor();
      await pruefer.getByRole("heading", { name: wort.verlauf }).waitFor();
      await mitglied.reload();
      await mitglied.getByTestId("workflow-stand").getByText(wort.fertig).waitFor();
      expect(
        await mitglied
          .getByRole("link", { name: /Guest Wi-Fi/ })
          .first()
          .getAttribute("href"),
      ).toContain(encodeURIComponent(f.ko.id));
      if (lang === "nl")
        expect(
          await mitglied.evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
        ).toBe(true);
    } finally {
      await autor.close();
      await leser.close();
    }
  },
  100_000,
);

it("verwendet nach verlorener Startantwort nur beim gleichen Fall dieselbe Vorgangskennung", async () => {
  const autor = anfrage(app, f.autor.token);
  const neu = await autor("POST", "/api/teamworkflows", {
    teamId: f.team.id,
    definition: {
      name: "Fallwiederholung",
      ausloeser: "Anfrage",
      schritte: [{ typ: "entscheidung", titel: "Prüfen", rolle: "mitglied" }],
    },
  });
  expect(neu.statusCode, neu.body).toBe(201);
  const id = neu.json().id;
  const pfad = `/api/teamworkflows/${id}`;
  const test = await autor("POST", `${pfad}/pruefen`, { revision: 1, sprache: "de" });
  const frei = await autor("POST", `${pfad}/freigeben`, {
    revision: test.json().revision,
    version: 1,
  });
  expect(frei.statusCode, frei.body).toBe(200);
  const context = await anmelden("leser", "de");
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    const url = `/teamworkflows?workflow=${id}`;
    const api = `${pfad}/laeufe`;
    let verlieren = true;
    const kennungen: string[] = [];
    let serverStatus = 0;
    await page.route(`**${api}`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      kennungen.push(route.request().postDataJSON().vorgang);
      if (!verlieren) return route.continue();
      verlieren = false;
      const gespeichert = await route.fetch();
      serverStatus = gespeichert.status();
      await route.abort("failed");
    });
    await page.goto(url);
    const startfall = async (text: string) => {
      await page.getByTestId("workflow-fall").fill(text);
      await page.getByTestId("workflow-starten").click();
    };
    await startfall("Besuch A");
    await page.getByRole("alert").filter({ hasText: "erneut" }).waitFor();
    expect(serverStatus).toBeGreaterThanOrEqual(200);
    expect(serverStatus).toBeLessThan(300);
    await page.reload();
    await startfall("Besuch A");
    await page.waitForURL(/lauf=/);
    expect(kennungen[0]).toBe(kennungen[1]);
    await page.goto(url);
    verlieren = true;
    await startfall("Besuch B");
    await page.getByRole("alert").filter({ hasText: "erneut" }).waitFor();
    await startfall("Besuch C");
    await page.waitForURL(/lauf=/);
    expect(kennungen[2]).not.toBe(kennungen[3]);
    expect((await (await context.request.get(api)).json()).laeufe).toHaveLength(3);
    expect(
      await page.evaluate(
        'Object.entries(sessionStorage).filter(([k])=>k.startsWith("kw.workflowstart.")).some(([k,v])=>(k+v).includes("Besuch"))',
      ),
    ).toBe(false);
  } finally {
    await context.close();
  }
}, 80_000);
