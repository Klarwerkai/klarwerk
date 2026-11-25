import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { stelleFlaecheBereit } from "../import-wiederoeffnen-nutzerweg/strecke";

// Der Modellprozess zitiert den ersten Beleg. Suche, fachliche Prüfung, Browser und HTTP sind echt.
vi.mock("../../services/reasoner", async (original) => ({
  ...(await original<typeof import("../../services/reasoner")>()),
  createCappedLocalClientFromEnv: () => ({
    name: "frageweg-test-lokal",
    complete: async (_system: string, eingabe: string) => {
      const aussage = /^\[1\] [^\n]+?: (.+)$/m.exec(eingabe)?.[1];
      return aussage ? `${aussage} [1]` : "{}";
    },
  }),
}));

const dienst = assembleServices(inMemoryRepos());
const app = buildApp(dienst);
const konto = {
  name: "Fachprüfung",
  email: "frageweg@example.test",
  password: "fiktiv-frageweg-123",
};
const beispiele = {
  de: {
    frage: "Welche Farbe hat der Eichpunkt?",
    vorher: "Der Eichpunkt ist grün.",
    nachher: "Der Eichpunkt ist golden.",
    hinweis: "Die Grundlage für diese Antwort hat sich geändert.",
    erneut: "Erneut versuchen",
  },
  en: {
    frage: "What colour is the inspection mark?",
    vorher: "The inspection mark is green.",
    nachher: "The inspection mark is gold.",
    hinweis: "The basis for this answer has changed.",
    erneut: "Try again",
  },
  nl: {
    frage: "Welke kleur heeft het keurmerk?",
    vorher: "Het keurmerk is groen.",
    nachher: "Het keurmerk is goudkleurig.",
    hinweis: "De basis voor dit antwoord is gewijzigd.",
    erneut: "Opnieuw proberen",
  },
} as const;
let basis: string;
let autor: string;
let browser: Browser;

beforeAll(async () => {
  stelleFlaecheBereit();
  await mitFlaeche().vorListen(app);
  autor = (await dienst.auth.register(konto)).id;
  basis = await app.listen({ host: "127.0.0.1", port: 0 });
  browser = await chromium.launch();
}, 120000);

afterAll(async () => {
  await browser?.close();
  await app.close();
});

it.each(["de", "en", "nl"] as const)(
  "%s: freigegebene Antwort, Quellenwechsel beim Auffrischen, erneute Frage und belegte Passage",
  async (sprache) => {
    const b = beispiele[sprache];
    const quelle = await dienst.ko.create({
      author: autor,
      type: "best_practice",
      category: "Qualität",
      confidentiality: "intern",
      title: b.frage,
      statement: b.vorher,
    });
    await dienst.validation.adminValidate(quelle.id, autor);
    const context = await browser.newContext({ baseURL: basis });
    try {
      const login = await context.request.post("/api/auth/login", {
        data: { email: konto.email, password: konto.password },
      });
      expect(login.status()).toBe(200);
      await context.addInitScript((s) => localStorage.setItem("kw.sprache", s), sprache);
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      await page.goto("/fragen");
      await page.locator('[data-tutorial-ziel="fragen.fragefeld"]').fill(b.frage);
      const senden = page.locator('[data-tutorial-ziel="fragen.absenden"]');
      const chip = page.getByTestId("ask-quellen-chip").filter({ hasText: b.frage });
      await senden.click();
      await chip.waitFor();
      expect(
        new URL((await chip.getAttribute("href")) ?? "", basis).searchParams.get("fassung"),
      ).toBe("1");
      const antworten = dienst.reasoner.answer.bind(dienst.reasoner);
      vi.spyOn(dienst.reasoner, "answer").mockImplementationOnce(async (...args) => {
        const alteAntwort = await antworten(...args);
        await dienst.ko.revise(quelle.id, { statement: b.nachher }, autor);
        await dienst.validation.adminValidate(quelle.id, autor);
        return alteAntwort;
      });
      const naechsteAntwort = () =>
        page.waitForResponse(
          (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/ask",
        );
      const [wechsel] = await Promise.all([naechsteAntwort(), senden.click()]);
      expect(wechsel.status()).toBe(409);
      const meldung = page.getByRole("alert").filter({ hasText: b.hinweis });
      await meldung.waitFor();
      expect(await chip.count()).toBe(0);
      expect(await page.getByText(b.vorher, { exact: false }).count()).toBe(0);
      // Beim erneuten Öffnen darf auch der gespeicherte Arbeitsstand die alte Antwort nicht zeigen.
      const wiederaufnahme = await context.newPage();
      await wiederaufnahme.goto("/fragen");
      await wiederaufnahme.locator('[data-tutorial-ziel="fragen.fragefeld"]').waitFor();
      expect(await wiederaufnahme.getByTestId("ask-quellen-chip").count()).toBe(0);
      expect(await wiederaufnahme.getByText(b.vorher, { exact: false }).count()).toBe(0);
      await wiederaufnahme.close();
      const [frisch] = await Promise.all([
        naechsteAntwort(),
        meldung.getByRole("button", { name: b.erneut }).click(),
      ]);
      expect(frisch.status()).toBe(200);
      await chip.waitFor();
      expect(await page.getByTestId("ask-result-anchor").innerText()).toContain(b.nachher);
      const link = new URL((await chip.getAttribute("href")) ?? "", basis);
      expect(link.pathname).toBe(`/wissen/${quelle.id}`);
      expect(link.searchParams.get("fassung")).toBe("2");
      await chip.click();
      await page
        .locator('[data-testid="bib-text"] mark[data-bib-belegstelle]')
        .filter({ hasText: b.nachher })
        .first()
        .waitFor();
    } finally {
      vi.restoreAllMocks();
      await context.close();
    }
  },
  90000,
);
