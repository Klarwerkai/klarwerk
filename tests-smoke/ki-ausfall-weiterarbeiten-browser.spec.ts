import { type APIRequestContext, type Browser, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// produkt:20261010:poc-ki-ausfall-weiterarbeiten · PV-03-07 — ISOLIERTER KI-AUSFALL UND ERHOLUNG
// IM ECHTEN BROWSER AUF DER GEBAUTEN KANDIDATENFASSUNG.
// ================================================================================================
//
// AUSDRÜCKLICH EINE AGENTEN-/BROWSERPROBE (Playwright gegen den gebauten Smoke-Server), KEINE
// menschliche Abnahme und KEIN produktiver Providerausfall. Isoliert wird NUR die KI: der öffentliche
// KI-Status (`/api/reasoner/status`) und die Antwort von `POST /api/ask` werden im Browser
// eingespeist; Anmeldung, Seite, Bibliothek, Browserspeicher und Neuladen sind echt. Es wird kein
// Modell gerufen, nichts angelegt und nichts bezahlt; alle Inhalte sind fiktiv.
//
//   A1  Status „nicht erreichbar": eigener Störungssatz, Sendeknopf gesperrt, Wege ohne KI.
//   A2  Manueller Weg: die Bibliothek öffnet; zurück auf „Fragen" steht die Frage wieder da.
//   A3  Erholung ohne Neuladen: „KI-Status erneut prüfen" hebt die Sperre auf.
//   A4  Kapazität ausgeschöpft: belegte Ursache, Frage im Feld, Speicherort „dieser Browser".
//   A5  Neuladen: die Frage kommt aus dem Browserspeicher wieder.
//   A6  Erneuter Versuch: genau EINE weitere Anfrage; der Ersatz nennt seine Ursache.
//
// Ben nacharbeit-2 — DER ZUSAMMENHÄNGENDE WEG MIT FIKTIVER ROLLE (B1–B7). Frida (Experte, eigenes
// Konto, eigener Browserkontext) arbeitet über den Ausfall hinweg. Eingespeist werden NUR der
// KI-Status, der verlorene Antwortweg und das Ergebnis des Referenzprüfers; die Speicherung der
// Frage samt Lücke läuft gegen den ECHTEN Server:
//   B1  Ausfall: Frage begonnen und BEARBEITET, Fragekontext „Werk" gesetzt, Sendeknopf gesperrt.
//   B2  Manueller Weg „Wissen erfassen" und zurück, dann Neuladen: bearbeitete Frage und Kontext
//       kommen aus dem Arbeitsstand dieses Kontos wieder.
//   B3  Erholung über „KI-Status erneut prüfen".
//   B4  Zeitüberschreitung NACH tatsächlicher Speicherung: der Server legt die Lücke an, die Antwort
//       geht verloren (504). Der Kontext ging mit der Anfrage hinaus.
//   B5  Erneut versuchen: dieselbe Lückenkennung, genau EINE Lücke, Zähler 2 — kein Doppelobjekt.
//   B6  Referenzprüfer-Ausfall: offener Prüfstatus („nicht abgeschlossen"), keine Bestätigung;
//       die begrenzte erneute Prüfung endet nach dem zweiten Versuch ohne Bestätigung.
//   B7  Manuelle Fachbearbeitung: der Lückenvorgang ist offen und erreichbar.
// Weil B Bestand anlegt (Konto, Lücke), läuft die Datei im isolierten Projekt `chromium-zustand`.

const FRAGEFELD = '[data-testid="page-fragen"] form input';
const SENDEN = '[data-testid="page-fragen"] form button[type="submit"]';

/** Sichtbare Texte — wörtlich aus `apps/web/src/texte/kiausfall.ts` bzw. `woerterbuch/de.ts`. */
const T = {
  nichtErreichbar: "KI derzeit nicht erreichbar", // kiausfall.status.nichtErreichbar (Anfang)
  bestand: "Bestand durchsuchen", // ask.aiUnavailable.toLibrary
  kapazitaet: "Die KI-Kapazität ist gerade ausgeschöpft.", // kiausfall.fehler.kapazitaet.titel
  browser: "in diesem Browser für dein Konto gespeichert", // kiausfall.entwurf.browser (Teil)
  ersatz: "Ohne KI beantwortet: Der KI-Dienst hat nicht rechtzeitig geantwortet", // …zeitueberschreitung
} as const;

const MODELL = { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } };

const ERSATZANTWORT = {
  result: {
    answered: true,
    answer: "Der fiktive Kalibrierschrank wird halbjährlich geprüft.",
    knowledgeClass: "gesichert",
    trust: 80,
    sources: [],
    citedSources: [],
    steps: [],
    demo: true,
    captionSources: [],
    ersatzGrund: "zeitueberschreitung",
  },
  gap: null,
  receipt: "beleg-fiktiv",
};

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

/** Ein Bildschirmbeleg als Anhang des nativen Berichts. */
async function beleg(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

test("A1–A6: KI fällt isoliert aus und erholt sich — Frage, Wege ohne KI und Speicherort bleiben ehrlich", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const frage = `Wie oft wird der fiktive Kalibrierschrank KX-${marke()} geprüft?`;

  let lage: "unreachable" | "active" = "unreachable";
  await page.route("**/api/reasoner/status", (route) =>
    route.fulfill({
      json: lage === "unreachable" ? { ...MODELL, reachable: "unreachable" } : MODELL,
    }),
  );
  let askAufrufe = 0;
  await page.route("**/api/ask", (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    askAufrufe += 1;
    if (askAufrufe === 1) {
      return route.fulfill({
        status: 503,
        json: {
          error: "MODEL_BUSY",
          message: "KI-Modell derzeit ausgelastet. Bitte in Kürze erneut versuchen.",
        },
      });
    }
    return route.fulfill({ json: ERSATZANTWORT });
  });

  try {
    // A1 — Störung statt „kein Modell aktiv", Knopf gesperrt, Wege ohne KI.
    await page.goto("/fragen");
    await expect(page.getByTestId("page-fragen")).toBeVisible({ timeout: 20_000 });
    await page.locator(FRAGEFELD).fill(frage);
    await expect(page.getByText(T.nichtErreichbar).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SENDEN)).toBeDisabled();
    const alternative = page.getByTestId("ask-ai-alternative");
    await expect(alternative).toBeVisible();
    await beleg(page, "a1-nicht-erreichbar");
    expect(askAufrufe, "trotz Sperre ging eine Frage hinaus").toBe(0);

    // A2 — der manuelle Weg trägt, und die Frage überlebt die Navigation.
    await alternative.getByRole("link", { name: T.bestand }).click();
    await expect(page).toHaveURL(/\/bibliothek/, { timeout: 15_000 });
    await page.goto("/fragen");
    await expect(page.locator(FRAGEFELD)).toHaveValue(frage, { timeout: 15_000 });
    await expect(page.getByTestId("ask-wiederaufnahme")).toBeVisible();

    // A3 — Erholung: der Dienst antwortet wieder; ein Klick liest den Status neu.
    lage = "active";
    await page.getByTestId("ask-ki-status-erneut").click();
    await expect(page.locator(SENDEN)).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByText(T.nichtErreichbar)).toHaveCount(0);
    await beleg(page, "a3-erholt");

    // A4 — Kapazität ausgeschöpft: Ursache, Frage bleibt, Speicherort nachgelesen.
    await page.locator(SENDEN).click();
    await expect(page.getByTestId("ask-ki-kapazitaet")).toContainText(T.kapazitaet, {
      timeout: 15_000,
    });
    const ort = page.getByTestId("ask-entwurf-speicherort");
    await expect(ort).toHaveAttribute("data-ort", "browser");
    await expect(ort).toContainText(T.browser);
    await expect(page.getByTestId("ask-fehler-manuell")).toBeVisible();
    await expect(page.locator(FRAGEFELD)).toHaveValue(frage);
    await beleg(page, "a4-kapazitaet");
    expect(askAufrufe).toBe(1);

    // A5 — Neuladen: die Frage kommt aus dem Browserspeicher dieses Kontos.
    await page.reload();
    await expect(page.locator(FRAGEFELD)).toHaveValue(frage, { timeout: 20_000 });

    // A6 — erneuter Versuch: genau eine weitere Anfrage; der Ersatz nennt seine Ursache.
    await expect(page.locator(SENDEN)).toBeEnabled({ timeout: 15_000 });
    await page.locator(SENDEN).click();
    await expect(page.getByTestId("ask-answer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ask-ersatz-grund")).toContainText(T.ersatz);
    await expect(page.getByTestId("ask-ersatz-grund")).toHaveAttribute(
      "data-grund",
      "zeitueberschreitung",
    );
    expect(askAufrufe, "der erneute Versuch erzeugte mehr als eine Anfrage").toBe(2);
    await beleg(page, "a6-ersatz-mit-ursache");
  } finally {
    await page.unroute("**/api/ask").catch(() => undefined);
    await page.unroute("**/api/reasoner/status").catch(() => undefined);
  }
});

// ------------------------------------------------------------------------------------------------
// B1–B7 · der zusammenhängende Weg mit fiktiver Rolle (Ben nacharbeit-2).
// ------------------------------------------------------------------------------------------------

const PASS = "Ausfall-Passwort-1";
const WERK = "Werk Nord (fiktiv)";

async function kontoAnlegen(
  admin: APIRequestContext,
  name: string,
  email: string,
  role: string,
): Promise<void> {
  const res = await admin.post("/api/users", { data: { name, email, password: PASS, role } });
  expect(res.status(), await res.text()).toBe(201);
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const adresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext(adresse === undefined ? {} : { baseURL: adresse });
  const seite = await kontext.newPage();
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  await seite.locator('input[type="email"]').fill(email);
  await seite.locator('input[type="password"]').first().fill(PASS);
  await seite.locator('button[type="submit"]').click();
  await expect(workspaceMarker(seite)).toBeVisible({ timeout: 15_000 });
  if (await seite.getByTestId("notice-ack").count()) {
    await seite.getByTestId("notice-ack").click();
  }
  return seite;
}

/** Ein eingespeister Referenzprüfer-Ausfall — dieselbe Form, die der Prüfdienst liefert. */
function referenzAusfall(grund: string, nummer: number): Record<string, unknown> {
  return {
    richtlinie: "referenzpruefung-v1",
    pruefId: "ref_fiktiv_ausfall",
    status: "nicht_pruefbar",
    grund,
    rollen: { antwort: "cloud", pruefer: null },
    aussagen: [],
    hinweise: [],
    globaleAktualitaet: "nicht_behauptet",
    ausCache: false,
    messung: { dauerMs: 0, modellaufrufe: 1 },
    versuch: { nummer, hoechstens: 2 },
  };
}

interface FridasLuecke {
  id: string;
  question?: string;
  askCount?: number;
}

async function luecken(seite: Page, m: string): Promise<FridasLuecke[]> {
  const res = await seite.request.get("/api/gaps");
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as FridasLuecke[]).filter((g) => (g.question ?? "").includes(m));
}

test("B1–B7: Frida arbeitet über den Ausfall — bearbeiteter Entwurf und Kontext, Antwortverlust ohne Doppellücke, Referenzprüfer offen", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  await ensureLoggedIn(page);
  const m = marke();
  const mail = `frida-${m}@ausfall.test`;
  await kontoAnlegen(page.request, `Frida ${m}`, mail, "experte");
  const frida = await anmelden(browser, mail);

  const entwurf = `Wie wird die Zyrlax-${m}-Spannrolle justiert`;
  const bearbeitet = `Wie wird die Zyrlax-${m}-Spannrolle nachjustiert?`;
  const refFrage = `Wie oft wird der fiktive Qorvex-${m}-Filter getauscht?`;

  let lage: "unreachable" | "active" = "unreachable";
  await frida.route("**/api/reasoner/status", (route) =>
    route.fulfill({
      json: lage === "unreachable" ? { ...MODELL, reachable: "unreachable" } : MODELL,
    }),
  );
  let durchlauf = 0;
  let gespeichert: { gap?: { id: string } | null } | null = null;
  let gesendeterKontext: unknown = null;
  await frida.route("**/api/ask", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    durchlauf += 1;
    if (durchlauf === 1) {
      // B4: der Server SPEICHERT wirklich (echte Anfrage), die Antwort geht unterwegs verloren.
      gesendeterKontext = (route.request().postDataJSON() as { fragekontext?: unknown })
        .fragekontext;
      const echt = await route.fetch();
      expect(echt.status(), await echt.text()).toBe(200);
      gespeichert = (await echt.json()) as { gap?: { id: string } | null };
      return route.fulfill({
        status: 504,
        json: {
          error: "ZEITUEBERSCHREITUNG",
          message: "Gateway-Zeitüberschreitung (eingespeist).",
        },
      });
    }
    if (durchlauf === 2) {
      // B5: der erneute Versuch geht unverändert an den echten Server.
      return route.continue();
    }
    // B6: eine beantwortete Frage, deren Referenzprüfer ausgefallen ist.
    return route.fulfill({
      json: {
        result: {
          answered: true,
          answer: "Der fiktive Filter wird monatlich getauscht.",
          knowledgeClass: "gesichert",
          trust: 80,
          sources: [],
          citedSources: [],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "beleg-fiktiv",
        referenzpruefung: referenzAusfall("pruefer_fehler", 1),
      },
    });
  });
  let erneutePruefungen = 0;
  await frida.route("**/api/ask/referenzpruefung/**", (route) => {
    erneutePruefungen += 1;
    return route.fulfill({ json: { referenzpruefung: referenzAusfall("zeitlimit", 2) } });
  });

  try {
    // B1 — Ausfall: Frage beginnen, Kontext setzen, Frage bearbeiten.
    await frida.goto("/fragen");
    await expect(frida.getByTestId("page-fragen")).toBeVisible({ timeout: 20_000 });
    await frida.locator(FRAGEFELD).fill(entwurf);
    const umschalten = frida.getByTestId("ask-fragekontext-umschalten");
    await umschalten.click();
    await frida.getByTestId("ask-fragekontext-werk").fill(WERK);
    await umschalten.click();
    await expect(frida.getByTestId("ask-fragekontext-zeile")).toContainText(WERK);
    await frida.locator(FRAGEFELD).fill(bearbeitet);
    await expect(frida.getByText(T.nichtErreichbar).first()).toBeVisible({ timeout: 15_000 });
    await expect(frida.locator(SENDEN)).toBeDisabled();
    await beleg(frida, "b1-frida-ausfall-bearbeitet");

    // B2 — manueller Weg und zurück, dann Neuladen: bearbeiteter Entwurf und Kontext bleiben.
    await expect
      .poll(() =>
        frida.evaluate(
          (text) =>
            Object.keys(localStorage).some(
              (k) =>
                k.startsWith("kw.fragen.arbeitsstand.v1:") &&
                (localStorage.getItem(k) ?? "").includes(text),
            ),
          bearbeitet,
        ),
      )
      .toBe(true);
    await frida
      .getByTestId("ask-ai-alternative")
      .getByRole("link", { name: "Wissen erfassen" })
      .click();
    await expect(frida).toHaveURL(/\/erfassen/, { timeout: 15_000 });
    await frida.goto("/fragen");
    await expect(frida.locator(FRAGEFELD)).toHaveValue(bearbeitet, { timeout: 15_000 });
    await expect(frida.getByTestId("ask-fragekontext-zeile")).toContainText(WERK);
    await expect(frida.getByTestId("ask-wiederaufnahme")).toBeVisible();
    await frida.reload();
    await expect(frida.locator(FRAGEFELD)).toHaveValue(bearbeitet, { timeout: 20_000 });
    await expect(frida.getByTestId("ask-fragekontext-zeile")).toContainText(WERK);
    await beleg(frida, "b2-frida-wiederaufgenommen");

    // B3 — Erholung.
    lage = "active";
    await frida.getByTestId("ask-ki-status-erneut").click();
    await expect(frida.locator(SENDEN)).toBeEnabled({ timeout: 15_000 });

    // B4 — Zeitüberschreitung nach tatsächlicher Speicherung.
    await frida.locator(SENDEN).click();
    const kasten = frida.getByTestId("ask-error");
    await expect(kasten).toBeVisible({ timeout: 20_000 });
    await expect(frida.locator(FRAGEFELD)).toHaveValue(bearbeitet);
    await expect(frida.getByTestId("ask-entwurf-speicherort")).toHaveAttribute(
      "data-ort",
      "browser",
    );
    expect(gesendeterKontext, "der Fragekontext ging nicht mit der Anfrage hinaus").toMatchObject({
      werk: WERK,
    });
    const ersteId = (gespeichert as { gap?: { id: string } | null } | null)?.gap?.id ?? "";
    expect(ersteId, "der Server hat keine Lücke gespeichert").not.toBe("");
    const nachVerlust = await luecken(frida, m);
    expect(nachVerlust.map((g) => g.id)).toEqual([ersteId]);
    await beleg(frida, "b4-antwort-verloren-gespeichert");

    // B5 — erneut versuchen: dieselbe Lücke, kein Doppelobjekt.
    await kasten.getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(frida.getByTestId("ask-error")).toHaveCount(0, { timeout: 20_000 });
    await expect(frida.getByTestId("ask-gap")).toBeVisible({ timeout: 20_000 });
    expect(durchlauf, "der erneute Versuch erzeugte mehr als eine Anfrage").toBe(2);
    const nachWiederholung = await luecken(frida, m);
    expect(
      nachWiederholung.map((g) => g.id),
      "eine zweite Lücke entstand",
    ).toEqual([ersteId]);
    expect(nachWiederholung[0]?.askCount).toBe(2);
    await beleg(frida, "b5-dieselbe-luecke");

    // B6 — Referenzprüfer-Ausfall: offener Prüfstatus, keine Bestätigung, begrenzte Wiederholung.
    await frida.locator(FRAGEFELD).fill(refFrage);
    await frida.locator(SENDEN).click();
    await expect(frida.getByTestId("ask-answer")).toBeVisible({ timeout: 20_000 });
    const pruefung = frida.getByTestId("referenzpruefung");
    await expect(pruefung).toHaveAttribute("data-status", "nicht_pruefbar");
    await expect(pruefung).toHaveAttribute("data-gesamt", "nicht_abgeschlossen");
    await expect(frida.getByTestId("quellenstatus-marke")).toHaveAttribute(
      "data-gesamt",
      "nicht_abgeschlossen",
    );
    await expect(frida.locator('[data-gesamt="quellen_geprueft"]')).toHaveCount(0);
    await beleg(frida, "b6-referenzpruefer-ausfall-offen");
    await frida.getByTestId("referenzpruefung-erneut").click();
    await expect(pruefung).toHaveAttribute("data-gesamt", "nicht_abgeschlossen", {
      timeout: 15_000,
    });
    await expect(frida.getByTestId("referenzpruefung-erneut")).toHaveCount(0);
    expect(erneutePruefungen).toBe(1);
    await expect(frida.locator('[data-gesamt="quellen_geprueft"]')).toHaveCount(0);

    // B7 — manuelle Fachbearbeitung der offenen Lücke bleibt erreichbar.
    await frida.goto(`/luecke/${ersteId}`);
    await expect(frida.getByTestId("luecke-vorgang-stand")).toBeVisible({ timeout: 15_000 });
    await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
      "Keine Fachzuständigkeit",
    );
    await beleg(frida, "b7-luecke-offen-manuell");
  } finally {
    await frida
      .context()
      .close()
      .catch(() => undefined);
  }
});
