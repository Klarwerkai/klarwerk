// ==================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-0177/R-1703/R-0205 — DIE KENNZEICHNUNG
// EINER EXTERNEN QUELLE IM ECHTEN BROWSER: DE/EN, TASTATUR, NEULADEN.
// ==================================================================================================
//
// Der Registereintrag nennt die offene Abnahme wörtlich: „Sichtbare Kennzeichnung über alle
// Aufrufer/Altquellen, DE/EN, Tastatur und nach Reload auf bezeichnetem Live-Stand prüfen;
// Quellenanhang darf Status/Validierung nicht erhöhen."
//
// WAS DIESE DATEI BELEGT — an der GEBAUTEN App über den ECHTEN Draht, nicht an einer jsdom-Montage:
//   B1  eine über `add-source` angehängte externe Quelle trägt in der Lesefläche der Bibliothek
//       sichtbar „extern · nicht peer-validiert", „Stufe 2" und „Extern · ungeprüft";
//   B2  der Weg dorthin geht mit der TASTATUR (Tab bis zum Sprung „Quellen", Eingabetaste);
//   B3  nach einem NEULADEN steht dieselbe Kennzeichnung wieder da — sie kommt vom Server, nicht
//       aus einem Zustand der Seite;
//   B4  auf ENGLISCH stehen die englischen Fassungen;
//   B5  der Quellenanhang hat Status und Vertrauen nicht erhöht (zurückgelesen vom Server).
//
// WAS SIE AUSDRÜCKLICH NICHT IST: die Abnahme auf dem BEZEICHNETEN LIVE-STAND. Der Smoke-Server
// läuft lokal mit In-Memory-Bestand; der Live-Nachweis gehört in den Veröffentlichungsablauf und
// wird dort mit Fassung dokumentiert. Prüfkarte, Konfliktansicht und Erfassungs-Warteliste sind in
// jsdom gegen dieselbe Komponente belegt (`tests/externe-quellen-kennzeichnung/…`), hier nicht.
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";
import { stelleSpracheEin, tabBis } from "./support/import-json-kasten";

interface Quelle {
  label: string;
  kind: string;
  peerValidated: boolean;
}

interface Wissen {
  id: string;
  status: string;
  trust: number;
  sources: Quelle[];
}

const TEXTE = {
  de: {
    pruefstand: "extern · nicht peer-validiert",
    stufe: "Stufe 2",
    herkunft: "Extern · ungeprüft",
  },
  en: {
    pruefstand: "external · not peer-validated",
    stufe: "Level 2",
    herkunft: "External · unchecked",
  },
} as const;

/** Je Lauf frisch — der Smoke-Server teilt EINEN Bestand über alle Dateien und Engines. */
function frischeMarke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function legeWissenAn(request: APIRequestContext, titel: string): Promise<Wissen> {
  const antwort = await request.post("/api/kos", {
    data: {
      title: titel,
      statement: `Aussage zu ${titel}. Sie ist lang genug, um die Formprüfung zu bestehen.`,
      type: "best_practice",
      category: "Betrieb",
      tags: [],
      confidentiality: "intern",
    },
  });
  const meldung = `Anlegen scheiterte: ${antwort.status()} ${await antwort.text()}`;
  expect(antwort.ok(), meldung).toBe(true);
  return (await antwort.json()) as Wissen;
}

/**
 * Der Weg eines Menschen ohne Maus: vom Seitenanfang mit Tab bis zum Sprung „Quellen", dann die
 * Eingabetaste. Zurück kommt der Listeneintrag der Quelle im aufgeklappten Abschnitt.
 */
async function quelleUeberTastatur(page: Page, label: string) {
  await expect(page.getByTestId("bib-lesen")).toBeVisible({ timeout: 15_000 });
  const weg = await tabBis(
    page,
    () => document.activeElement?.getAttribute("data-testid") === "bib-sprung-quellen",
  );
  const meldung = `der Sprung „Quellen" ist mit Tab nicht erreichbar (${weg.schritte} Schritte)`;
  expect(weg.erreicht, meldung).toBe(true);
  await page.keyboard.press("Enter");
  const eintrag = page.locator('[data-bib-abschnitt="quellen"] li').filter({ hasText: label });
  await expect(eintrag, "der Quelleneintrag erscheint nicht").toBeVisible({ timeout: 15_000 });
  return eintrag;
}

/** Prüft die GERADE GELADENE Lesefläche — geladen wird beim Aufrufer (goto oder reload). */
async function pruefeKennzeichnung(
  page: Page,
  label: string,
  sprache: keyof typeof TEXTE,
): Promise<void> {
  const eintrag = await quelleUeberTastatur(page, label);
  const soll = TEXTE[sprache];
  await expect(eintrag).toContainText(soll.pruefstand);
  await expect(eintrag.getByTestId("quelle-stufe2")).toBeVisible();
  await expect(eintrag.getByTestId("quelle-stufe2")).toHaveText(soll.stufe);
  await expect(eintrag.getByTestId("quelle-extern-ungeprueft")).toBeVisible();
  await expect(eintrag.getByTestId("quelle-extern-ungeprueft")).toHaveText(soll.herkunft);
}

test.describe("R-0177/R-0205 · externe Quelle im echten Browser gekennzeichnet", () => {
  test("DE/EN, Tastatur und Neuladen: Stufe 2 und Extern · ungeprüft an der Quelle", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const marke = frischeMarke();
    const label = `Lexikonartikel Überdruckventil ${marke}`;

    // Die Stufe der externen Wissensabfrage lässt das Anhängen öffentlicher Quellen erst ab
    // `search_attach` zu (Standard: `search_on_click`). Sie wird für diesen Fall gesetzt und am Ende
    // auf den vorgefundenen Wert zurückgestellt — der Smoke-Server ist geteilt.
    const vorher = await page.request.get("/api/external/policy");
    expect(vorher.ok(), `Stufe nicht lesbar: ${vorher.status()}`).toBe(true);
    const alteStufe = ((await vorher.json()) as { stage: string }).stage;
    const setzen = await page.request.put("/api/external/policy", {
      data: { stage: "search_attach" },
    });
    expect(setzen.ok(), `Stufe nicht setzbar: ${setzen.status()}`).toBe(true);

    try {
      const wissen = await legeWissenAn(page.request, `EXTERN-KENNUNG ${marke}`);
      const angehaengt = await page.request.put(`/api/kos/${wissen.id}`, {
        data: {
          action: "add-source",
          source: { label, url: "https://de.wikipedia.org/wiki/%C3%9Cberdruckventil" },
        },
      });
      expect(
        angehaengt.ok(),
        `add-source scheiterte: ${angehaengt.status()} ${await angehaengt.text()}`,
      ).toBe(true);

      // B5: zurückgelesen vom Server — die Quelle ist extern und ungeprüft, das Objekt unverändert.
      const gelesen = await page.request.get(`/api/kos/${wissen.id}`);
      expect(gelesen.ok()).toBe(true);
      const nachher = (await gelesen.json()) as Wissen;
      const quelle = nachher.sources.find((s) => s.label === label);
      expect(quelle?.kind).toBe("external");
      expect(quelle?.peerValidated).toBe(false);
      expect(nachher.status).toBe(wissen.status);
      expect(nachher.trust).toBe(wissen.trust);

      // B1/B2: Deutsch, mit der Tastatur.
      await stelleSpracheEin(page, "de");
      await page.goto(`/wissen/${wissen.id}`);
      await pruefeKennzeichnung(page, label, "de");

      // B3: Neuladen DERSELBEN Seite — die Kennzeichnung kommt wieder vom Server.
      await page.reload();
      await pruefeKennzeichnung(page, label, "de");

      // B4: Englisch, derselbe Weg.
      await stelleSpracheEin(page, "en");
      await page.goto(`/wissen/${wissen.id}`);
      await pruefeKennzeichnung(page, label, "en");
    } finally {
      await stelleSpracheEin(page, "de");
      await page.request.put("/api/external/policy", { data: { stage: alteStufe } });
    }
  });
});
