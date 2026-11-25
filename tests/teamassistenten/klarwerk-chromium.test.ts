import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { stelleFlaecheBereit } from "../import-wiederoeffnen-nutzerweg/strecke";
import { fachbereich } from "./aufbau";
import { pruefeKlaraTeamfassung } from "./pruefeKlaraTeamfassung";

const s = assembleServices(inMemoryRepos());
const app = buildApp(s);
let browser: Browser;
let basis: string;
let f: Awaited<ReturnType<typeof fachbereich>>;

beforeAll(async () => {
  stelleFlaecheBereit();
  await mitFlaeche().vorListen(app);
  f = await fachbereich(s, app);
  expect(
    await s.teams.lege({
      ...f.team,
      id: "team-technik",
      name: "Technik",
      zweck: "Technische Regeln",
    }),
  ).toBe(true);
  basis = await app.listen({ host: "127.0.0.1", port: 0 });
  browser = await chromium.launch({ headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await app.close();
});

const worte = {
  de: {
    verwalten: "Assistenten verwalten",
    neu: "Assistent erstellen",
    hinzu: "Guest Wi-Fi hinzufügen",
    bestanden: "Alle Beispiele für Version 1 bestanden",
    aktiv: "Für das Team aktiv",
    belegt: "Belegt",
  },
  en: {
    verwalten: "Manage assistants",
    neu: "Create assistant",
    hinzu: "Add Guest Wi-Fi",
    bestanden: "All tests passed for version 1",
    aktiv: "Active for the team",
    belegt: "Supported",
  },
  nl: {
    verwalten: "Assistenten beheren",
    neu: "Assistent maken",
    hinzu: "Guest Wi-Fi toevoegen",
    bestanden: "Alle tests geslaagd voor versie 1",
    aktiv: "Actief voor het team",
    belegt: "Onderbouwd",
  },
};
async function profil(konto: string, sprache: keyof typeof worte) {
  const context = await browser.newContext({ baseURL: basis });
  const r = await context.request.post("/api/auth/login", {
    data: { email: `${konto}@team.test`, password: "synthetisch123" },
  });
  expect(r.status(), await r.text()).toBe(200);
  await context.addInitScript((lang) => localStorage.setItem("kw.sprache", lang), sprache);
  return context;
}
it.each(["de", "en", "nl"] as const)(
  "Fachbereich erstellt, prüft und veröffentlicht über Chromium · %s",
  async (sprache) => {
    const text = worte[sprache];
    const autor = await profil("autorin", sprache);
    const leser = await profil("leser", sprache);
    try {
      const page = await autor.newPage();
      page.setDefaultTimeout(12_000);
      await page.goto("/teamassistenten");
      await page.getByRole("button", { name: text.verwalten }).click();
      await page.getByRole("button", { name: text.neu, exact: true }).click();
      const teams = page.getByTestId("teamassistent-team");
      expect(await teams.locator("option").allTextContents()).toEqual(
        expect.arrayContaining(["Technik", "Einkauf"]),
      );
      await teams.selectOption("team-technik");
      const name = `Netzwerk ${sprache}`;
      await page.getByTestId("teamassistent-name").fill(name);
      await page.getByTestId("teamassistent-aufgabe").fill("Guest Wi-Fi");
      await page.getByTestId("teamassistent-sachfragen").uncheck();
      await page.getByTestId("teamassistent-quellensuche").fill("Guest");
      await page.getByRole("button", { name: text.hinzu, exact: true }).click();
      for (const beispiel of f.definition.beispiele)
        await page.getByTestId(`teamassistent-test-${beispiel.erwartet}`).fill(beispiel.frage);
      await page.getByTestId("teamassistent-speichern").click();
      await page.waitForURL(/bearbeiten=/);
      const id = new URL(page.url()).searchParams.get("bearbeiten");
      if (!id) throw new Error("Entwurfskennung fehlt");
      expect(await page.getByTestId("teamassistent-sachfragen").isChecked()).toBe(false);
      expect(await page.getByTestId("teamassistent-freigeben").isDisabled()).toBe(true);
      const api = `/api/teamassistenten/${id}`;
      expect((await leser.request.get(api)).status()).toBe(404);
      await page.getByTestId("teamassistent-pruefen").click();
      const pruefbericht = page.getByTestId("teamassistent-pruefergebnis");
      await pruefbericht.getByText(text.bestanden).waitFor();
      expect(await pruefbericht.getByRole("listitem").count()).toBe(3);
      await page.getByTestId("teamassistent-freigeben").click();
      await page.getByText(text.aktiv, { exact: false }).first().waitFor();
      const nutzung = await leser.newPage();
      nutzung.setDefaultTimeout(12_000);
      await nutzung.goto(`/teamassistenten?assistent=${id}`);
      expect(await nutzung.getByRole("button", { name: text.verwalten }).count()).toBe(0);
      const gewaehlt = nutzung.getByTestId("teamassistent-auswahl").locator("option:checked");
      expect(await gewaehlt.textContent()).toContain(`${name} · Technik`);
      await nutzung.getByTestId("teamassistent-frage").fill(f.aussage);
      await nutzung.getByTestId("teamassistent-senden").press("Enter");
      const antwort = nutzung.getByTestId("teamassistent-antwort");
      await antwort.getByRole("heading", { name: text.belegt }).waitFor();
      expect(await antwort.locator("blockquote").innerText()).toBe(f.aussage);
      expect(await antwort.getByRole("link").getAttribute("href")).toContain(
        encodeURIComponent(f.ko.id),
      );
      if (sprache === "de") await pruefeKlaraTeamfassung(nutzung, id, f.aussage, f.aussage);
      if (sprache === "de") {
        await nutzung.getByTestId("teamassistent-frage").fill(f.aussage);
        await nutzung.getByTestId("teamassistent-senden").press("Enter");
      }
      await antwort.getByRole("link").click();
      expect(await nutzung.getByTestId("quellenfokus-zitat").locator("mark").innerText()).toBe(
        f.aussage,
      );
      expect(await nutzung.getByTestId("gespeicherte-fassung").getAttribute("data-fassung")).toBe(
        String(f.ko.version),
      );
    } finally {
      await autor.close();
      await leser.close();
    }
  },
  90_000,
);
