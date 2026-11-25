import { join } from "node:path";
import { type Browser, type BrowserContext, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { WorkflowDefinition } from "../../services/app/src/teamworkflows-vertrag";
import { mitFlaeche } from "../gast-nutzerweg/browserweg";
import { stelleFlaecheBereit } from "../import-wiederoeffnen-nutzerweg/strecke";
import { anfrage } from "../teamassistenten/aufbau";
import { workflowUmfeld } from "./definition-fixture";

const dienste = assembleServices(inMemoryRepos());
const app = buildApp(dienste);
let umfeld: Awaited<ReturnType<typeof workflowUmfeld>>;
let browser: Browser;
let basis: string;
let workflowId: string;
let beschlussWorkflow: string;

const texte = {
  de: {
    vorschlagen: "Für das Firmenwissen vorschlagen",
    vor: "Wissensvorschlag vorbereiten",
    senden: "Zur Prüfung einreichen",
    offen: "Zur fachlichen Prüfung eingereicht",
    pruefen: "Workflow-Ergebnisse zur Prüfung",
    freigeben: "Als Firmenwissen freigeben",
    frei: "Als Firmenwissen freigegeben",
    titel: "Gastnetz bei der Übergabe",
    aussage: "Beim Kundentermin bleibt das Gastnetz vom internen Netz getrennt.",
  },
  en: {
    vorschlagen: "Propose for company knowledge",
    vor: "Prepare a knowledge proposal",
    senden: "Submit for review",
    offen: "Submitted for review",
    pruefen: "Workflow results to review",
    freigeben: "Approve as company knowledge",
    frei: "Approved as company knowledge",
    titel: "Guest network handover",
    aussage: "Guest devices must stay separate from the staff network during handover.",
  },
  nl: {
    vorschlagen: "Voorstellen als bedrijfskennis",
    vor: "Kennisvoorstel voorbereiden",
    senden: "Indienen ter beoordeling",
    offen: "Ingediend ter beoordeling",
    pruefen: "Te beoordelen workflowresultaten",
    freigeben: "Vrijgeven als bedrijfskennis",
    frei: "Vrijgegeven als bedrijfskennis",
    titel: "Gastnetwerk bij de overdracht",
    aussage: "Het gastnetwerk blijft bij de overdracht gescheiden van het personeelsnetwerk.",
  },
};

async function workflowFreigeben(definition: WorkflowDefinition) {
  const chef = anfrage(app, umfeld.autor.token);
  const angelegt = await chef("POST", umfeld.api, {
    teamId: umfeld.team.id,
    definition,
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const id = angelegt.json<{ id: string }>().id;
  const test = await chef("POST", `${umfeld.api}/${id}/pruefen`, {
    revision: 1,
    sprache: "en",
  });
  expect(test.json().pruefung.bestanden).toBe(true);
  const frei = await chef("POST", `${umfeld.api}/${id}/freigeben`, {
    revision: test.json().revision,
    version: 1,
  });
  expect(frei.statusCode, frei.body).toBe(200);
  return id;
}

beforeAll(async () => {
  stelleFlaecheBereit();
  await mitFlaeche().vorListen(app);
  umfeld = await workflowUmfeld(dienste, app);
  workflowId = await workflowFreigeben(umfeld.definition);
  beschlussWorkflow = await workflowFreigeben({
    ...umfeld.definition,
    name: "Teamentscheidung",
    schritte: umfeld.definition.schritte.filter((s) => s.typ !== "assistent"),
  });
  const admin = (await dienste.auth.listUsers()).find((u) => u.role === "admin");
  if (!admin) throw new Error("Testadministration fehlt");
  await dienste.auth.changeRole(umfeld.autor.id, "controller", admin.id);
  basis = await app.listen({ host: "127.0.0.1", port: 0 });
  browser = await chromium.launch({ headless: true });
}, 120000);
afterAll(async () => {
  await browser?.close();
  await app.close();
});

async function anmelden(konto: string, lang: keyof typeof texte) {
  const context = await browser.newContext({
    baseURL: basis,
    viewport: lang === "nl" ? { width: 390, height: 844 } : { width: 1150, height: 900 },
  });
  const login = await context.request.post("/api/auth/login", {
    data: { email: `${konto}@team.test`, password: "synthetisch123" },
  });
  expect(login.status()).toBe(200);
  await context.addInitScript((s) => localStorage.setItem("kw.sprache", s), lang);
  return context;
}

async function ergebnis(
  chef: BrowserContext,
  mitglied: BrowserContext,
  key: string,
  beschluss?: string,
) {
  const id = beschluss ? beschlussWorkflow : workflowId;
  const base = `${umfeld.api}/${id}/laeufe`;
  const start = await mitglied.request.post(base, {
    data: { version: 1, vorgang: key, fall: umfeld.aussage, sprache: "en" },
  });
  expect(start.status()).toBe(200);
  const l = await start.json();
  const schritt = `${base}/${l.id}/weiter`;
  const schritte = beschluss
    ? ([
        [chef, "annehmen", 1],
        [chef, "weiter", 2],
      ] as const)
    : ([
        [mitglied, "weiter", 1],
        [chef, "annehmen", 2],
        [chef, "weiter", 3],
      ] as const);
  for (const [user, aktion, revision] of schritte) {
    const result = await user.request.post(schritt, {
      data: { aktion, revision, notiz: aktion === "annehmen" ? beschluss : undefined },
    });
    expect(result.status(), await result.text()).toBe(200);
  }
  return `/teamworkflows?${new URLSearchParams({ workflow: id, lauf: l.id })}`;
}

it.each(["de", "en", "nl"] as const)(
  "reicht ein Workflow-Ergebnis ein, prüft die Quellfassung und öffnet den freigegebenen Beitrag und dessen Ursprung · %s",
  async (lang) => {
    const t = texte[lang];
    const mitglied = await anmelden("leser", lang);
    const chef = await anmelden("autorin", lang);
    try {
      const lauf = await ergebnis(chef, mitglied, `uebernahme-${lang}`);
      const sende = await mitglied.newPage();
      const review = await chef.newPage();
      sende.setDefaultTimeout(12000);
      review.setDefaultTimeout(12000);
      await sende.goto(lauf);
      await sende.getByRole("button", { name: t.vorschlagen }).press("Enter");
      const detail = sende.getByTestId("workflow-wissen-detail");
      await detail.getByText(t.vor, { exact: true }).waitFor();
      await sende.getByTestId("workflow-wissen-titel").fill(t.titel);
      await sende.getByTestId("workflow-wissen-aussage").fill(t.aussage);
      const quelle = detail.getByRole("link", { name: /Guest Wi-Fi/ });
      expect(await quelle.getAttribute("href")).toContain(
        `/wissen/${umfeld.ko.id}?fassung=1&ansicht=gespeichert`,
      );
      await detail.getByRole("blockquote").getByText(umfeld.aussage, { exact: true }).waitFor();
      await detail.getByRole("button", { name: t.senden }).click();
      await detail.getByText(t.offen, { exact: true }).waitFor();
      expect(await detail.getByRole("button", { name: t.freigeben }).count()).toBe(0);
      expect(await sende.getByTestId("workflow-wissen-artikel").count()).toBe(0);
      await review.goto(lang === "en" ? "/teamworkflows" : "/validierung");
      const inbox = review.getByTestId("workflow-wissenspruefungen");
      await inbox.getByRole("heading", { name: t.pruefen }).waitFor();
      await inbox.getByRole("link", { name: t.titel }).click();
      await review.waitForURL(/ergebnis=/);
      const r = review.getByTestId("workflow-wissen-detail");
      await r.getByText(t.aussage, { exact: true }).waitFor();
      await r.getByRole("link", { name: /Guest Wi-Fi/ }).waitFor();
      const bilder = process.env.KLARWERK_WORKFLOW_BILDER;
      if (bilder && lang === "de")
        await r.screenshot({ path: join(bilder, "WISSENSVORSCHLAG-PRUEFUNG-DE.png") });
      await r.getByRole("button", { name: t.freigeben }).click();
      await r.getByText(t.frei, { exact: true }).waitFor();
      await sende.reload();
      await sende.getByTestId("workflow-wissen-artikel").click();
      await sende.waitForURL(/\/wissen\/.+\?fassung=1/);
      await sende.getByTestId("bib-titel").getByText(t.titel, { exact: true }).waitFor();
      await sende.getByTestId("workflow-fassungsbeleg-quelle").waitFor();
      const ursprung = sende.getByTestId("workflow-beleg-ergebnis");
      expect(await ursprung.getAttribute("href")).toContain(`${lauf}&ergebnis=`);
      expect(await sende.getByTestId("workflow-beleg-quelle").getAttribute("href")).toContain(
        `/wissen/${umfeld.ko.id}?fassung=1&ansicht=gespeichert`,
      );
      await ursprung.click();
      await sende.waitForURL(/teamworkflows\?.*ergebnis=/);
      await sende
        .getByTestId("workflow-wissen-detail")
        .getByText(t.frei, { exact: true })
        .waitFor();
      if (lang === "nl")
        expect(
          await sende.evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
        ).toBe(true);
    } finally {
      await mitglied.close();
      await chef.close();
    }
  },
  90000,
);

it("lehnt einen Vorschlag mit sichtbarer Begründung ab", async () => {
  const mitglied = await anmelden("leser", "de");
  const chef = await anmelden("autorin", "de");
  try {
    const lauf = await ergebnis(chef, mitglied, "ablehnen");
    const p = await mitglied.newPage();
    const r = await chef.newPage();
    p.setDefaultTimeout(12000);
    r.setDefaultTimeout(12000);
    await p.goto(lauf);
    await p.getByTestId("workflow-wissen-oeffnen").click();
    await p.getByTestId("workflow-wissen-senden").click();
    await p.getByText(texte.de.offen, { exact: true }).waitFor();
    await r.goto(lauf);
    await r.getByTestId("workflow-wissen-ablehnen").click();
    expect(await r.getByTestId("workflow-wissen-ablehnen-bestaetigen").isDisabled()).toBe(true);
    await r.getByTestId("workflow-wissen-grund").fill("Der Anwendungsbereich ist zu weit gefasst.");
    await r.getByTestId("workflow-wissen-ablehnen-bestaetigen").click();
    await r.getByText("Vorschlag abgelehnt", { exact: true }).waitFor();
    await p.reload();
    const d = p.getByTestId("workflow-wissen-detail");
    await d
      .getByText("Grund für die Ablehnung · Der Anwendungsbereich ist zu weit gefasst.")
      .waitFor();
    expect(await p.getByTestId("workflow-wissen-artikel").count()).toBe(0);
  } finally {
    await mitglied.close();
    await chef.close();
  }
}, 90000);

it("legt einen menschlichen Beschluss mit Datum und Wortlaut zur Freigabe vor", async () => {
  const mitglied = await anmelden("leser", "de");
  const chef = await anmelden("autorin", "de");
  try {
    const wortlaut = "Für jede Übergabe wird ein gemeinsames Abnahmeprotokoll geführt.";
    const lauf = await ergebnis(chef, mitglied, "fachbeschluss", wortlaut);
    const p = await mitglied.newPage();
    const r = await chef.newPage();
    p.setDefaultTimeout(12000);
    r.setDefaultTimeout(12000);
    await p.goto(lauf);
    await p.getByTestId("workflow-wissen-oeffnen").click();
    const entscheidung = p.getByTestId("workflow-wissen-beschluss");
    await entscheidung.getByText("Workflowbeschluss · Einkaufsregel freigeben").waitFor();
    await entscheidung.getByRole("blockquote").getByText(wortlaut).waitFor();
    expect(await entscheidung.locator("time").getAttribute("datetime")).toBeTruthy();
    await p.getByTestId("workflow-wissen-senden").click();
    await p.getByText(texte.de.offen, { exact: true }).waitFor();
    await r.goto(lauf);
    await r
      .getByTestId("workflow-wissen-beschluss")
      .getByRole("blockquote")
      .getByText(wortlaut)
      .waitFor();
    await r.getByTestId("workflow-wissen-freigeben").click();
    await r.getByTestId("workflow-wissen-artikel").click();
    await r.getByTestId("workflow-fassungsbeleg-ergebnis").waitFor();
    expect(await r.getByTestId("workflow-beleg-quelle").count()).toBe(0);
  } finally {
    await mitglied.close();
    await chef.close();
  }
}, 90000);
