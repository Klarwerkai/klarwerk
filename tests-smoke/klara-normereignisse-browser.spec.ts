import { type Browser, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const TEXT = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const marke = () => crypto.randomUUID();
async function eigeneSeite(browser: Browser, admin: Page) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Die Normprobe benötigt ihre konfigurierte Browserbasisadresse.");
  await ensureLoggedIn(admin);
  const email = `norm-${marke()}@klarwerk.test`;
  const password = "Norm-Browser-Synthetisch-2026!";
  const neu = await admin.request.post("/api/users", {
    data: { name: "Norm Probe", email, password, role: "controller" },
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
      category: "Synthetische Normprobe",
      confidentiality: "intern",
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()) as { id: string; version: number; statement: string };
}
async function originalauftrag(p: Page) {
  const objektbezug = {
    pfad: "/kalender",
    seitenName: "Mein Kalender",
    objekt: "Fiktive Normprobe",
  };
  const r = await p.request.post("/api/me/klara/notizen", {
    data: {
      vorgang: `norm-${marke()}`,
      weg: "geschrieben",
      titel: "Fiktive Originalbekanntmachung",
      inhalt: TEXT,
      objektbezug,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  const n = (await r.json()).notiz;
  const journal = await p.request.post("/api/me/klara/gespraeche", { data: { objektbezug } });
  expect(journal.status(), await journal.text()).toBe(201);
  const g = (await journal.json()).gespraech;
  expect(g.nachrichten).toEqual([]);
  const ziel = {
    art: "neue_persoenliche_aufgabe",
    id: null,
    titel: "Fiktive Normprüfung A-4",
    stand: null,
    pfad: null,
  };
  const a = await p.request.post(`/api/me/klara/gespraeche/${g.id}/auftraege`, {
    data: {
      quelle: "getippt",
      wortlaut: "Die gewählte Originalnotiz als persönliche Normprüfaufgabe führen.",
      ziel: "Fiktive eigene Normprüfung",
      erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
      erlaubteZiele: [ziel],
      erlaubteQuellen: [`notiz:${n.id}`],
      ergebnis: "Persönliche Prüfung aus Originalnotiz",
      geplanteSchritte: 1,
      plan: [
        {
          aktion: "persoenliche_aufgabe_anlegen",
          ziel,
          ausSchritt: null,
          notizQuelle: { id: n.id, fassung: n.fassung, weg: "geschrieben" },
        },
      ],
    },
  });
  expect(a.status(), await a.text()).toBe(201);
  return {
    gespraechId: g.id as string,
    auftragId: (await a.json()).auftrag.id as string,
    notizId: n.id as string,
  };
}

test("AW21 · belegte Normgeschichte, bewusster Originalprüfauftrag und fachliche Ablösung mit genauer Fassung", async ({
  page,
  browser,
}, info) => {
  const p = await eigeneSeite(browser, page);
  try {
    const titel = `Fiktive Normbekanntmachung ${marke()}`;
    const q = await wissen(p, titel, TEXT);
    const anleitung = await wissen(
      p,
      `Fiktive Anleitung ${marke()}`,
      "Unveränderte fiktive Regel der bisherigen Anleitung.",
    );
    const gekoppelt = await p.request.post("/api/lifecycle/couple", {
      data: { assetRef: "Norm N-17", koId: anleitung.id },
    });
    expect(gekoppelt.status(), await gekoppelt.text()).toBe(204);
    const freigeben = async () => {
      const r = await page.request.put(`/api/kos/${anleitung.id}`, {
        data: { action: "admin-validate", duplicateAcknowledged: true },
      });
      expect(r.status(), await r.text()).toBe(200);
      return (await (await p.request.get(`/api/kos/${anleitung.id}`)).json()) as {
        id: string;
        version: number;
        statement: string;
      };
    };
    const bisher = await freigeben();
    const g = await originalauftrag(p);
    await p.goto("/kalender#normereignisse");
    const b = p.getByTestId("normereignisse");
    await expect(b).toBeVisible();
    await b.getByLabel("Bekanntmachungsquelle suchen (mindestens zwei Zeichen)").fill(titel);
    await b.getByRole("checkbox", { name: titel, exact: true }).check();
    await expect(
      b.getByRole("button", { name: "Bekanntmachungen ohne Wirkung prüfen", exact: true }),
    ).toBeDisabled();
    await b
      .getByRole("checkbox", {
        name: "Ich darf diese begrenzten Bekanntmachungen in diesem Umfang verarbeiten.",
        exact: true,
      })
      .check();
    await b
      .getByRole("button", { name: "Bekanntmachungen ohne Wirkung prüfen", exact: true })
      .click();
    await expect(b.getByTestId("norm-vorschau")).toContainText("Ankündigung");
    await expect(b.getByTestId("norm-vorschau")).toContainText("Gespeicherte Normzuordnung");
    expect((await (await p.request.get("/api/me/klara/normereignisse")).json()).normen).toEqual([]);
    const erfassen = async () => {
      const response = p.waitForResponse(
        (r) =>
          r.url().endsWith("/api/me/klara/normereignisse/erfassen") &&
          r.request().method() === "POST",
      );
      await b.getByRole("button", { name: "Ereignisbelege erfassen", exact: true }).click();
      expect((await response).status()).toBe(200);
      await expect(b.getByTestId("norm-vorschau")).toHaveCount(0);
    };
    await erfassen();
    const karte = b.getByTestId("normgeschichte");
    await expect(karte).toHaveCount(1);
    await expect(karte).toContainText("Fachliche Prüfung offen");
    await expect(karte.locator("p").filter({ hasText: "Eigener Ereignisbeleg fehlt" })).toHaveCount(
      3,
    );
    expect((await (await p.request.get(`/api/kos/${anleitung.id}`)).json()).statement).toBe(
      bisher.statement,
    );
    const pruefung = karte.getByTestId("norm-pruefauftrag");
    await pruefung.locator("summary").click();
    await pruefung
      .getByLabel("Vorhandener eigener Notizauftrag", { exact: true })
      .selectOption(g.auftragId);
    const vorBindung = (await (await p.request.get("/api/me/klara/normereignisse")).json()).fassung;
    await pruefung
      .getByRole("button", { name: "Diesen Originalauftrag verknüpfen", exact: true })
      .click();
    await expect(karte).toHaveAttribute("data-norm-fassung", String(vorBindung + 1));
    // Die neue Normfassung baut die Karte neu auf. Derselbe Originalauftrag wird erneut gelesen.
    await pruefung.locator("summary").click();
    await pruefung
      .getByRole("button", { name: "Originalprüfschritt ausführen oder nachlesen", exact: true })
      .click();
    const aufgabe = pruefung.getByRole("link", { name: "Originalaufgabe öffnen", exact: true });
    await expect(aufgabe).toBeVisible();
    const aufgaben = (await (await p.request.get("/api/me/klara/aufgaben")).json()).aufgaben;
    expect(aufgaben).toHaveLength(1);
    expect(aufgaben[0].bezug.notizId).toBe(g.notizId);
    const taskId = aufgaben[0].id;
    await aufgabe.click();
    await expect(p.getByText(TEXT, { exact: true }).first()).toBeVisible();
    await p.goto("/kalender#normereignisse");
    await expect(karte).toHaveCount(1);
    const qNeu = await p.request.put(`/api/kos/${q.id}`, {
      data: {
        action: "revise",
        changes: {
          statement: TEXT.replace(
            "; Geltung",
            "; Veröffentlichung am 2026-11-02; Inkrafttreten am 2027-01-01; Übergangsfrist am 2027-06-30; Geltung",
          ),
        },
      },
    });
    expect(qNeu.status(), await qNeu.text()).toBe(200);
    await b.getByLabel("Bekanntmachungsquelle suchen (mindestens zwei Zeichen)").fill(titel);
    await b.getByRole("checkbox", { name: titel, exact: true }).check();
    await b
      .getByRole("checkbox", {
        name: "Ich darf diese begrenzten Bekanntmachungen in diesem Umfang verarbeiten.",
        exact: true,
      })
      .check();
    await b
      .getByRole("button", { name: "Bekanntmachungen ohne Wirkung prüfen", exact: true })
      .click();
    await erfassen();
    await expect(karte.locator("p").filter({ hasText: "Eigener Ereignisbeleg fehlt" })).toHaveCount(
      0,
    );
    expect(
      (await (await p.request.get("/api/me/klara/aufgaben")).json()).aufgaben.map(
        (a: { id: string }) => a.id,
      ),
    ).toEqual([taskId]);
    const neu = await page.request.put(`/api/kos/${anleitung.id}`, {
      data: {
        action: "revise",
        changes: { statement: "Fiktive bewusst geprüfte Nachfolgeregel." },
      },
    });
    expect(neu.status(), await neu.text()).toBe(200);
    const nachfolger = await freigeben();
    const fach = karte.getByTestId("norm-fachform");
    await fach.locator("summary").click();
    await fach
      .getByLabel("Bisherige Anleitungsfassung", { exact: true })
      .selectOption(`${bisher.id}/${bisher.version}`);
    await fach
      .getByLabel("Freigegebene Nachfolgefassung", { exact: true })
      .selectOption(`${nachfolger.id}/${nachfolger.version}`);
    await fach
      .getByLabel("Begründung der fachlichen Annahme", { exact: true })
      .fill("Fiktive bewusste Fachannahme im Browser.");
    await fach
      .getByRole("checkbox", {
        name: "Diese konkrete freigegebene Fassung für den genannten Bereich als fachlichen Nachfolger annehmen.",
        exact: true,
      })
      .check();
    await fach
      .getByRole("button", { name: "Fachliche Ablösung dokumentieren", exact: true })
      .click();
    await expect(karte.getByTestId("norm-fachannahme")).toContainText("Norm Probe");
    const v3 = await page.request.put(`/api/kos/${anleitung.id}`, {
      data: {
        action: "revise",
        changes: { statement: "Spätere unbestätigte v3 darf nicht als angenommene v2 erscheinen." },
      },
    });
    expect(v3.status(), await v3.text()).toBe(200);
    await p.reload();
    await karte
      .getByTestId("norm-fachannahme")
      .getByRole("button", {
        name: `Freigegebene Nachfolgefassung · ${nachfolger.version}`,
        exact: true,
      })
      .click();
    await expect(karte.getByTestId("norm-fachfassung")).toContainText(nachfolger.statement);
    await expect(karte.getByTestId("norm-fachfassung")).not.toContainText("unbestätigte v3");
    await b.screenshot({ path: info.outputPath("normgeschichte-desktop.png") });
    await p.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await p.screenshot({ path: info.outputPath("normgeschichte-schmal.png") });
  } catch (err) {
    await p.screenshot({
      path: info.outputPath("norm-fehler-vor-kontextende.png"),
      fullPage: true,
    });
    throw err;
  } finally {
    await p.context().close();
  }
});
