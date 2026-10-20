// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) — ERINNERUNGEN IM BROWSER, ZUGESTELLT VOM
// SERVERPROZESS.
// ================================================================================================
//
// Eine Sonde am gebündelten Produkt mit echtem Server (`npm start`, also `server.ts` mit dem Takt der
// Erinnerungssteuerung), echter Anmeldung in einem eigenen Browserkontext und echtem Neuladen:
//
//   E1 (K1) „Morgen um neun erinnern“ → Klärung mit Wahl → Vorschau mit Datum, Uhrzeit, Zeitzone
//           (IANA, Versatz) und Ziel; „Abbrechen“ speichert nichts.
//   E2 (K3, K2, AW18-K12) Eine Erinnerung für in zwei Minuten anlegen, Klara NIE öffnen, die Seite
//           verlassen: der Server stellt sie über seinen eigenen Takt in die Glocke; die Meldung führt
//           zur Erinnerung (Lage „Abgeschlossen“); ein weiterer Takt stellt nicht noch einmal zu.
//
//   E3 (AW-18, Nacharbeit 2) @modell: bestellte Zusammenfassung einer eigenen Notiz — die
//           Steuerung des Servers fragt zum Termin das ECHTE Modell (vorhandener KI-Weg,
//           vertraulich, beide zentralen Freigaben für die Dauer des Falls); Ergebnis in Glocke und
//           Lauf. Nur im vollen `npm run smoke:ui`; im hermetischen Tor ausgenommen.
//   E4 (P07, AW18-K08, Nacharbeit 2) Einrichtungsassistent mit Zauberhut (Schließen speichert
//           nichts, Übernehmen gilt für neue Entwürfe, erneut aufrufbar) und bewusste Übergabe:
//           die Zuständige sieht Titel und Termine, nie die private Notiz, und kann zurückgeben.
//
// Läuft im ISOLIERTEN Kontext (`chromium-zustand`, `ZUSTAND_SPEC`): die Sonde legt ein Konto und
// Erinnerungen an. Alle Inhalte sind fiktiv. Ein Modell braucht nur E3. Das Urteil einer echten Person, ein
// echter Kundenhost und ein Neustart des Serverprozesses sind mit dieser Sonde NICHT belegt.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn, workspaceMarker } from "./support/auth";

const KENNWORT = "Erinnerung-Kennwort-1";
const BERLIN = "Europe/Berlin";
const BASIS = "/api/me/klara/erinnerungen";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Datum und Uhrzeit in Berlin — dieselbe Lesart wie am Server (Intl, IANA). */
function berlin(ms: number): { datum: string; uhrzeit: string } {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BERLIN,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((t) => [t.type, t.value]),
  );
  return {
    datum: `${teile.year}-${teile.month}-${teile.day}`,
    uhrzeit: `${teile.hour}:${teile.minute}`,
  };
}

function plusEinTag(datum: string): string {
  return new Date(Date.parse(`${datum}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

async function eigenesKonto(admin: Page): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `erinnerung-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: "Erinnerung Probe", email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const adresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(adresse === undefined ? {} : { baseURL: adresse }),
  });
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });
  if (await page.getByTestId("notice-ack").count()) {
    await page.getByTestId("notice-ack").click();
  }
  return page;
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara 10 — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function zuErinnerungen(
  page: Page,
  pfad = "/aufgaben",
): Promise<ReturnType<Page["getByTestId"]>> {
  await page.goto(pfad);
  const flaeche = page.getByTestId("aufgaben-erinnerungen");
  await expect(flaeche).toBeVisible({ timeout: 15_000 });
  await expect(
    flaeche
      .getByTestId("klara-erinnerungen-leer")
      .or(flaeche.getByTestId("klara-erinnerung-eintrag").first()),
  ).toBeVisible({ timeout: 15_000 });
  return flaeche;
}

test("Klara 10 · E1 „Morgen um neun“: Klärung, Vorschau mit Zone und Ziel, Abbrechen speichert nichts", async ({
  page,
  browser,
}, info) => {
  const nutzer = await anmelden(browser, await eigenesKonto(page));
  const flaeche = await zuErinnerungen(nutzer);
  await flaeche.getByTestId("klara-erinnerung-neu").click();
  await flaeche.getByTestId("klara-erinnerung-zone-wahl").selectOption(BERLIN);
  await flaeche.getByTestId("klara-erinnerung-titel").fill("Halle 3 lüften");
  await flaeche.getByTestId("klara-erinnerung-wann").fill("Morgen um neun erinnern");
  await flaeche.getByTestId("klara-erinnerung-deuten").click();
  const klaerung = flaeche.getByTestId("klara-erinnerung-klaerung");
  await expect(klaerung).toBeVisible({ timeout: 15_000 });
  await expect(flaeche.getByTestId("klara-erinnerung-speichern")).toBeDisabled();
  await beleg(nutzer, info, "1-klaerung");

  const morgen = plusEinTag(berlin(Date.now()).datum);
  await klaerung
    .locator(
      `[data-testid="klara-erinnerung-option"][data-datum="${morgen}"][data-uhrzeit="09:00"]`,
    )
    .click();
  const vorschau = flaeche.getByTestId("klara-erinnerung-vorschau");
  await expect(vorschau).toBeVisible({ timeout: 15_000 });
  await expect(vorschau.getByTestId("klara-erinnerung-zone")).toHaveText(
    /^Europe\/Berlin \(UTC[+-]\d{2}:\d{2}\)$/,
  );
  await expect(vorschau.getByTestId("klara-erinnerung-naechste")).toContainText("09:00");
  await expect(vorschau.getByTestId("klara-erinnerung-ziel")).toContainText("Glocke");
  await expect(flaeche.getByTestId("klara-erinnerung-speichern")).toBeEnabled();
  await beleg(nutzer, info, "2-vorschau");

  await flaeche.getByTestId("klara-erinnerung-abbrechen").click();
  await expect(flaeche.getByTestId("klara-erinnerung-entwurf")).toHaveCount(0);
  const r = await nutzer.request.get(BASIS);
  expect((await r.json()) as unknown).toEqual({ erinnerungen: [], uebernommen: [] });
  await nutzer.context().close();
});

test("Klara 10 · E2 Gespräch nie geöffnet: der Server stellt in die Glocke zu — genau einmal", async ({
  page,
  browser,
}, info) => {
  // Zwei Minuten Vorlauf plus bis zu einem Takt (60 s) plus Puffer und die Wiederholungsprobe.
  test.setTimeout(480_000);
  const nutzer = await anmelden(browser, await eigenesKonto(page));
  const titel = `Zählerstand ${marke()}`;
  const ziel = berlin(Date.now() + 150_000);

  const flaeche = await zuErinnerungen(nutzer);
  await flaeche.getByTestId("klara-erinnerung-neu").click();
  await flaeche.getByTestId("klara-erinnerung-zone-wahl").selectOption(BERLIN);
  await flaeche.getByTestId("klara-erinnerung-titel").fill(titel);
  await flaeche.getByTestId("klara-erinnerung-datum").fill(ziel.datum);
  await flaeche.getByTestId("klara-erinnerung-uhrzeit").fill(ziel.uhrzeit);
  await expect(flaeche.getByTestId("klara-erinnerung-vorschau")).toBeVisible({ timeout: 15_000 });
  await flaeche.getByTestId("klara-erinnerung-speichern").click();
  const eintrag = flaeche.getByTestId("klara-erinnerung-eintrag").first();
  await expect(eintrag).toHaveAttribute("data-lage", "geplant", { timeout: 15_000 });
  const id = (await eintrag.getAttribute("data-erinnerung")) ?? "";
  expect(id).not.toBe("");
  await beleg(nutzer, info, "3-gespeichert");

  // Klara bleibt zu; die Person verlässt die Seite.
  await nutzer.goto("/start");
  await expect(nutzer.getByTestId("klara-gespraech")).toHaveCount(0);

  const zahl = async (): Promise<number> => {
    const r = await nutzer.request.get("/api/notifications");
    const liste = (await r.json()) as { kind: string; erinnerungId?: string }[];
    return liste.filter((n) => n.kind === "erinnerung" && n.erinnerungId === id).length;
  };
  await expect.poll(zahl, { timeout: 330_000, intervals: [5_000] }).toBe(1);

  await nutzer.reload();
  await nutzer.getByTestId("kopfband-meldungen").click();
  const meldung = nutzer.locator('[data-testid="meldung-oeffnen"][data-art="erinnerung"]').first();
  await expect(meldung).toContainText(titel, { timeout: 15_000 });
  await beleg(nutzer, info, "4-glocke");
  await meldung.click();
  await expect(nutzer).toHaveURL(new RegExp(`/aufgaben\\?erinnerung=${id}`));
  const geoeffnet = nutzer
    .locator(`[data-testid="klara-erinnerung-eintrag"][data-erinnerung="${id}"]`)
    .first();
  await expect(geoeffnet).toHaveAttribute("data-lage", "abgeschlossen", { timeout: 15_000 });
  await expect(geoeffnet.getByTestId("klara-erinnerung-lauf").first()).toHaveAttribute(
    "data-status",
    "zugestellt",
  );
  await beleg(nutzer, info, "5-abgeschlossen");

  // Ein weiterer Takt (60 s) stellt nicht noch einmal zu.
  await nutzer.waitForTimeout(70_000);
  expect(await zahl()).toBe(1);
  await nutzer.context().close();
});

interface ReasonerTaskConfig {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

interface Glockenmeldung {
  id: string;
  kind: string;
  erinnerungId?: string;
  erinnerungZusammenfassung?: { status: string; text?: string; ki?: boolean };
}

test("Klara 10 · E3 bestellte Zusammenfassung: tatsächliche Modellantwort kommt mit der Erinnerung in die Glocke @modell", async ({
  page: admin,
  browser,
}, info) => {
  // Nacharbeit 2 (Ben, Befund 6): der Nachweis am VORHANDENEN KI-Weg mit echtem Modell. Läuft nur
  // im vollen `npm run smoke:ui` (Schlüssel ausschließlich über die Betreiber-Einspeisung).
  test.setTimeout(480_000);
  const anhang = (name: string, body: unknown) =>
    info.attach(name, { body: JSON.stringify(body), contentType: "application/json" });
  await ensureLoggedIn(admin);
  const konfig = await admin.request.get("/api/reasoner/config");
  expect(konfig.status(), await konfig.text()).toBe(200);
  const vorher = ((await konfig.json()) as { taskConfig: ReasonerTaskConfig }).taskConfig;
  const freigabe = async (kiFreigabe: ReasonerTaskConfig["kiFreigabe"]) => {
    const r = await admin.request.put("/api/reasoner/config", {
      data: { global: vorher.global, perTask: vorher.perTask, kiFreigabe },
    });
    expect(r.status(), await r.text()).toBe(200);
  };
  let nutzer: Page | undefined;
  try {
    // Die Zusammenfassung ist ein vertraulicher persönlicher Inhalt: beide zentralen Freigaben,
    // protokolliert, am Ende auf den vorherigen Stand zurück.
    await freigabe({ oeffentlicheKi: true, vertraulicheInhalte: true });
    const statusAntwort = await admin.request.get("/api/reasoner/status");
    const status = (await statusAntwort.json()) as Record<string, unknown>;
    await anhang("modellstatus", status);
    // Beide Freigaben stehen: der Status meldet die VERTRAULICHE Ausleitung als frei
    // (`ReasonerService.status`: "frei_vertraulich") — genau die Vorbedingung der Zusammenfassung.
    expect(status.extern).toBe("frei_vertraulich");
    expect(status.active).toBe(true);
    expect(status.reachable).not.toBe("unreachable");
    expect(status.kiAbgeschaltet).not.toBe(true);

    nutzer = await anmelden(browser, await eigenesKonto(admin));
    const quelle =
      "Angebot Kühlanlage Halle 4: Die Firma Beispielkälte bietet zwei Verdichter für 18.400 Euro an. Lieferzeit sechs Wochen. Das Angebot gilt bis Freitag; vorher muss die Statik der Dachfläche geprüft werden.";
    const notiz = await nutzer.request.post("/api/me/klara/notizen", {
      data: {
        vorgang: `ke-e3-notiz-${marke()}`,
        weg: "geschrieben",
        titel: "Angebot Kühlanlage",
        inhalt: quelle,
        objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "Angebot Kühlanlage" },
      },
    });
    expect(notiz.status(), await notiz.text()).toBe(201);
    const notizId = ((await notiz.json()) as { notiz: { id: string } }).notiz.id;

    const ziel = berlin(Date.now() + 150_000);
    const angelegt = await nutzer.request.post(BASIS, {
      data: {
        vorgang: `ke-e3-${marke()}`,
        titel: "Angebot zusammenfassen",
        zeitzone: BERLIN,
        zeitplan: { art: "einmalig", datum: ziel.datum, uhrzeit: ziel.uhrzeit },
        bezug: { art: "notiz", notizId },
        aktion: "inhalt_zusammenfassen",
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const erinnerung = (
      (await angelegt.json()) as {
        erinnerung: { id: string; anzeige: { erwartetesErgebnis: string } };
      }
    ).erinnerung;
    expect(erinnerung.anzeige.erwartetesErgebnis).toBe("meldung_mit_zusammenfassung");

    // Klara bleibt zu; der Server stellt über seinen Takt zu und fragt dabei das Modell.
    await nutzer.goto("/start");
    const meldung = async (): Promise<Glockenmeldung | undefined> => {
      const r = await nutzer?.request.get("/api/notifications");
      const liste = ((await r?.json()) ?? []) as Glockenmeldung[];
      return liste.find((n) => n.kind === "erinnerung" && n.erinnerungId === erinnerung.id);
    };
    await expect
      .poll(async () => (await meldung())?.id ?? null, { timeout: 330_000 })
      .not.toBeNull();
    const zugestellt = await meldung();
    await anhang("glockenmeldung", zugestellt);
    const z = zugestellt?.erinnerungZusammenfassung;
    expect(z?.status, "die Zusammenfassung ist nicht erstellt (KI nicht verfügbar?)").toBe(
      "erstellt",
    );
    expect(z?.ki, "geantwortet hat der gekennzeichnete Ersatz, nicht ein Modell").toBe(true);
    expect((z?.text ?? "").trim().length).toBeGreaterThan(0);
    expect(z?.text).not.toBe(quelle);

    const lauf = await nutzer.request.get(`${BASIS}/${erinnerung.id}`);
    const laeufe = (
      (await lauf.json()) as {
        erinnerung: { laeufe: { status: string; ergebnis: { zusammenfassung?: unknown } }[] };
      }
    ).erinnerung.laeufe;
    expect(laeufe[0]?.status).toBe("zugestellt");
    expect(laeufe[0]?.ergebnis.zusammenfassung).toEqual(z);

    await nutzer.reload();
    await nutzer.getByTestId("kopfband-meldungen").click();
    await expect(nutzer.getByTestId("glocke-erinnerung-zusammenfassung").first()).toHaveAttribute(
      "data-status",
      "erstellt",
      { timeout: 15_000 },
    );
    await beleg(nutzer, info, "6-zusammenfassung-glocke");
  } finally {
    await freigabe(vorher.kiFreigabe ?? { oeffentlicheKi: false, vertraulicheInhalte: false });
    await nutzer?.context().close();
  }
});

test("Klara 10 · E4 Einrichtungsassistent mit Zauberhut und bewusste Übergabe — nur Titel und Termine bei der Zuständigen", async ({
  page: admin,
  browser,
}, info) => {
  const emailA = await eigenesKonto(admin);
  const emailB = await eigenesKonto(admin);
  const a = await anmelden(browser, emailA);

  // P07: freiwillig, erneut aufrufbar, Zeitzonenwahl — Schließen speichert nichts.
  let flaeche = await zuErinnerungen(a);
  const hut = flaeche.getByTestId("klara-erinnerung-assistent");
  await expect(hut).toContainText("🎩");
  await hut.click();
  const dialog = flaeche.getByTestId("klara-erinnerung-assistent-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("dir", "ltr");
  await dialog.getByTestId("klara-erinnerung-assistent-schliessen").click();
  await expect(dialog).toHaveCount(0);
  const leer = (await (await a.request.get(`${BASIS}/einstellungen`)).json()) as {
    einstellungen: { fassung: number };
  };
  expect(leer.einstellungen.fassung).toBe(0);
  await hut.click();
  await dialog.getByTestId("klara-erinnerung-assistent-zeitzone").selectOption("Asia/Tokyo");
  await dialog.getByTestId("klara-erinnerung-assistent-weiter").click();
  await dialog.getByTestId("klara-erinnerung-assistent-verpasst").selectOption("nur_melden");
  await beleg(a, info, "7-assistent");
  await dialog.getByTestId("klara-erinnerung-assistent-uebernehmen").click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  flaeche = await zuErinnerungen(a);
  await expect(flaeche.getByTestId("klara-erinnerung-assistent")).toContainText(
    "Einstellungen ändern",
    { timeout: 15_000 },
  );
  await flaeche.getByTestId("klara-erinnerung-neu").click();
  await expect(flaeche.getByTestId("klara-erinnerung-zone-wahl")).toHaveValue("Asia/Tokyo");
  await flaeche.getByTestId("klara-erinnerung-abbrechen").click();

  // AW18-K08: bewusste Übergabe einer reinen Erinnerung an B — mit privater Notiz.
  const morgen = plusEinTag(berlin(Date.now()).datum);
  const r = await a.request.post(BASIS, {
    data: {
      vorgang: `ke-e4-${marke()}`,
      titel: "Schlüssel Tor 2 abgeben",
      notiz: "Privat: Code 4711 nicht weitergeben",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: morgen, uhrzeit: "09:00" },
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  const id = ((await r.json()) as { erinnerung: { id: string } }).erinnerung.id;
  flaeche = await zuErinnerungen(a);
  const eintrag = flaeche.locator(
    `[data-testid="klara-erinnerung-eintrag"][data-erinnerung="${id}"]`,
  );
  await eintrag.getByTestId("klara-erinnerung-oeffnen").click();
  await eintrag.getByTestId("klara-erinnerung-uebergabe-an").fill(emailB);
  await eintrag.getByTestId("klara-erinnerung-uebergeben").click();
  await expect(eintrag.getByTestId("klara-erinnerung-uebergabe")).toHaveAttribute(
    "data-zustaendig",
    "uebergeben",
    { timeout: 15_000 },
  );
  await beleg(a, info, "8-uebergeben");

  const b = await anmelden(browser, emailB);
  const flaecheB = await zuErinnerungenMitUebernahme(b);
  const uebernommen = flaecheB.locator(
    `[data-testid="klara-erinnerung-uebernommen"][data-erinnerung="${id}"]`,
  );
  await expect(uebernommen).toContainText("Schlüssel Tor 2 abgeben");
  await expect(flaecheB).not.toContainText("4711");
  await beleg(b, info, "9-mir-uebergeben");
  await uebernommen.getByTestId("klara-erinnerung-zurueckgeben").click();
  await expect(uebernommen).toHaveCount(0, { timeout: 15_000 });
  const zurueck = (await (await a.request.get(`${BASIS}/${id}`)).json()) as {
    erinnerung: { zustaendig: string };
  };
  expect(zurueck.erinnerung.zustaendig).toBe("selbst");
  await a.context().close();
  await b.context().close();
});

/** Wie `zuErinnerungen`, aber bereit auch dann, wenn nur „Mir übergeben“ etwas zeigt. */
async function zuErinnerungenMitUebernahme(page: Page): Promise<ReturnType<Page["getByTestId"]>> {
  await page.goto("/aufgaben");
  const flaeche = page.getByTestId("aufgaben-erinnerungen");
  await expect(flaeche).toBeVisible({ timeout: 15_000 });
  await expect(flaeche.getByTestId("klara-erinnerung-uebernommen").first()).toBeVisible({
    timeout: 15_000,
  });
  return flaeche;
}
