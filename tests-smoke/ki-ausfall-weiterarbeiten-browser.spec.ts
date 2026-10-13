import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

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
