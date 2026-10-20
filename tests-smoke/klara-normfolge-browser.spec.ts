import { type Browser, type Page, expect, test } from "@playwright/test";
import type { NormStand } from "../apps/web/src/api/klaraNormereignisse";
import type { KlaraAufgabe } from "../services/app/src/klara-aufgabe";
import { ensureLoggedIn } from "./support/auth";

const TEXT = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const ERLAUBNIS =
  "Ich darf die begrenzten Normbekanntmachungen dieser Auswahl verarbeiten und beauftrage die Vorbereitung ihrer Ereignisbelege im Quellenwatch. Keine fachliche Annahme.";
const FOLGE =
  "Bei neuen belegten Normereignissen persönliche Prüfaufgaben für mich anlegen. Gleiche Meldungen und Kopien behalten dieselbe Aufgabe. Keine fachliche Annahme einer Anleitung.";
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
  const email = `normfolge-${marke()}@klarwerk.test`;
  const password = "Normfolge-Browser-Synthetisch-2026!";
  const neu = await admin.request.post("/api/users", {
    data: { name: "Normfolge Probe", email, password, role: "experte" },
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

test("AW21 · ausdrücklich bestellte Normfolgeprüfung erzeugt im normalen Servertakt eine eigene Originalaufgabe", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const p = await eigeneSeite(browser, page);
  try {
    const spaeter = p.getByRole("button", { name: "Später", exact: true });
    if (await spaeter.isVisible()) await spaeter.click();
    const titel = `Fiktive Normfolgequelle ${marke()}`;
    const q = await wissen(p, titel, TEXT);
    const anleitung = await wissen(
      p,
      `Fiktive geltende Anleitung ${marke()}`,
      "Bisherige fiktive Anleitungsregel bleibt freigegeben und unverändert.",
    );
    const gekoppelt = await p.request.post("/api/lifecycle/couple", {
      data: { assetRef: "Norm N-17", koId: anleitung.id },
    });
    expect(gekoppelt.status(), await gekoppelt.text()).toBe(204);
    const frei = await page.request.put(`/api/kos/${anleitung.id}`, {
      data: { action: "admin-validate", duplicateAcknowledged: true },
    });
    expect(frei.status(), await frei.text()).toBe(200);
    const vorher = await (await p.request.get(`/api/kos/${anleitung.id}`)).json();
    // Wirkliches eigenes bewusst begonnenes leeres Gespräch als Ausgangsbestand; keine erfundene Nachricht.
    const g = await p.request.post("/api/me/klara/gespraeche", {
      data: {
        objektbezug: {
          pfad: "/aufgaben",
          seitenName: "Meine Aufgaben",
          objekt: "Fiktiver eigener Gesprächsbestand",
        },
      },
    });
    expect(g.status(), await g.text()).toBe(201);
    const menschlicherEingang = (await g.json()).gespraech;
    expect(menschlicherEingang.nachrichten).toEqual([]);
    const aufgaben = async (): Promise<KlaraAufgabe[]> =>
      (await (await p.request.get("/api/me/klara/aufgaben")).json()).aufgaben;
    const normen = async (): Promise<NormStand> =>
      await (await p.request.get("/api/me/klara/normereignisse")).json();
    expect(await aufgaben()).toEqual([]);
    expect((await normen()).normen).toEqual([]);
    await p.goto("/aufgaben");
    const b = p.getByTestId("aufgaben-erinnerungen");
    await b.getByTestId("klara-erinnerung-neu").click();
    const f = b.getByTestId("klara-erinnerung-entwurf");
    const erinnerungTitel = `Fiktive eigene Normfolgeprüfung ${marke()}`;
    await f.getByTestId("klara-erinnerung-titel").fill(erinnerungTitel);
    await f.getByTestId("klara-erinnerung-aktion").selectOption("routine_bericht");
    await f.getByLabel("Routinenvorlage").selectOption("quellaenderung");
    await f.getByTestId("klara-erinnerung-zone-wahl").selectOption("Europe/Berlin");
    await f.getByTestId("klara-erinnerung-takt").selectOption("taeglich");
    await f.getByTestId("klara-erinnerung-ende").selectOption("anzahl");
    await f.getByLabel("Nach Anzahl", { exact: true }).fill("2");
    const w = f.getByTestId("wissenspflege-auswahl");
    await w.getByLabel("Wissensquelle suchen (mindestens zwei Zeichen)").fill(titel);
    await w.getByRole("checkbox", { name: titel, exact: true }).check();
    await w.getByRole("checkbox", { name: ERLAUBNIS, exact: true }).check();
    await w
      .getByRole("button", { name: "Quellenauswahl ohne Wirkung prüfen", exact: true })
      .click();
    await expect(w.getByTestId("wissenspflege-vorschau-bereit")).toBeVisible();
    await w.getByRole("checkbox", { name: FOLGE, exact: true }).check();
    await expect(f.getByTestId("klara-erinnerung-speichern")).toBeDisabled();
    await w
      .getByRole("button", { name: "Quellenauswahl ohne Wirkung prüfen", exact: true })
      .click();
    await expect(w.getByTestId("wissenspflege-vorschau-bereit")).toBeVisible();
    expect(await aufgaben()).toEqual([]);
    expect((await normen()).normen).toEqual([]);
    // Normaler echter Termin mit 30–89 Sekunden Vorlauf nach Rundung auf Minuten, keine Fakeclock.
    const t = termin(Date.now() + 90_000);
    await f.getByTestId("klara-erinnerung-datum").fill(t.datum);
    await f.getByTestId("klara-erinnerung-uhrzeit").fill(t.uhrzeit);
    const response = p.waitForResponse(
      (r) => r.url().endsWith("/api/me/klara/erinnerungen") && r.request().method() === "POST",
    );
    await f.getByTestId("klara-erinnerung-speichern").click();
    const gespeichert = await response;
    expect(gespeichert.status(), await gespeichert.text()).toBe(201);
    const e = (await gespeichert.json()).erinnerung;
    expect(e.routine.wissenspflege.quellen).toEqual([q.id]);
    expect(e.routine.wissenspflege).toMatchObject({
      normbekanntmachungen: "belege_vorbereiten",
      folgepruefung: "persoenliche_normpruefaufgabe",
    });
    expect(await aufgaben()).toEqual([]);
    expect((await normen()).normen).toEqual([]);
    await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
    await expect
      .poll(async () => (await aufgaben()).length, {
        timeout: 140_000,
        intervals: [1000, 3000, 5000],
      })
      .toBe(1);
    await expect
      .poll(
        async () => (await normen()).normen[0]?.ereignisse[0]?.pruefauftrag?.auftragId ?? null,
        { timeout: 10_000, intervals: [100, 300, 1000] },
      )
      .not.toBeNull();
    await expect
      .poll(
        async () => {
          const stand = (await (await p.request.get(`/api/me/klara/erinnerungen/${e.id}`)).json())
            .erinnerung;
          return stand.laeufe[0]?.ergebnis.wissenspflege?.normbekanntmachungen?.folgepruefung
            ?.stand;
        },
        { timeout: 10_000, intervals: [100, 300, 1000] },
      )
      .toBe("am_original");
    const task = (await aufgaben())[0];
    if (!task) throw new Error("Tatsächliche persönliche Normaufgabe fehlt");
    const stand = await normen();
    const n = stand.normen[0];
    const ereignis = n?.ereignisse[0];
    if (!n || !ereignis?.pruefauftrag) throw new Error("Gespeicherter Originalprüfauftrag fehlt");
    expect(stand.normen).toHaveLength(1);
    expect(n.ereignisse).toHaveLength(1);
    expect(ereignis.art).toBe("angekuendigt");
    expect(n.annahmen).toEqual([]);
    const ref = ereignis.pruefauftrag;
    const original = await p.request.get(`/api/me/klara/gespraeche/${ref.gespraechId}`);
    expect(original.status(), await original.text()).toBe(200);
    const journal = (await original.json()).gespraech;
    expect(journal.nachrichten).toEqual([]);
    const auftragsAntwort = await p.request.get(
      `/api/me/klara/gespraeche/${ref.gespraechId}/auftraege`,
    );
    expect(auftragsAntwort.status(), await auftragsAntwort.text()).toBe(200);
    const auftraege = (await auftragsAntwort.json()).auftraege;
    expect(auftraege).toHaveLength(1);
    expect(auftraege[0].id).toBe(ref.auftragId);
    expect(auftraege[0].quelle).toBe("d_routine");
    expect(auftraege[0].schritte[0].ergebnis.id).toBe(task.id);
    const aktiv = (await (await p.request.get("/api/me/klara/gespraech")).json()).gespraech;
    expect(aktiv.id).toBe(menschlicherEingang.id);
    expect(aktiv.nachrichten).toEqual([]);
    const notizen = (await (await p.request.get("/api/me/klara/notizen")).json()).notizen;
    expect(notizen).toHaveLength(1);
    expect(notizen[0].inhalt).toContain("Automatisch vorbereitete persönliche Normprüfung");
    expect(notizen[0].inhalt).toContain(anleitung.id);
    const nachher = await (await p.request.get(`/api/kos/${anleitung.id}`)).json();
    expect(nachher.statement).toBe(vorher.statement);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.status).toBe("validiert");
    await p.reload();
    await p
      .getByTestId("aufgaben-erinnerungen")
      .getByRole("button", { name: erinnerungTitel, exact: true })
      .click();
    await expect(p.getByTestId("wissenspflege-pruefstand").first()).toContainText(
      "Prüfaufträge im Originalverlauf nachlesen.",
    );
    await p.goto("/kalender#normereignisse");
    const karte = p.getByTestId("normgeschichte");
    await expect(karte).toContainText("Fachliche Prüfung offen");
    await expect(karte.getByTestId("norm-fachannahme")).toHaveCount(0);
    await karte.getByTestId("norm-pruefauftrag").locator("summary").click();
    const link = karte.getByRole("link", { name: "Originalaufgabe öffnen", exact: true });
    await expect(link).toBeVisible();
    await expect(
      karte.getByRole("button", {
        name: "Originalprüfschritt ausführen oder nachlesen",
        exact: true,
      }),
    ).toHaveCount(0);
    await karte.screenshot({ path: info.outputPath("normfolge-original-nach-echtem-takt.png") });
    await link.click();
    await expect(
      p.getByTestId("klara-aufgabe-eintrag").filter({ hasText: task.titel }).first(),
    ).toBeVisible();
  } finally {
    await p.context().close();
  }
});
