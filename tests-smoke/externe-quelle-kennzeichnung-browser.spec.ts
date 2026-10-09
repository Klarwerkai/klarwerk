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
// NACHARBEIT 6 (Bens Befund): DIE ÜBRIGEN AUFRUFER UND DER BESTAND — je DE/EN, Tastatur, Reload
// (gemeinsamer Ablauf: `support/externe-quellen-browserhilfe.ts`), jeder über seinen ECHTEN
// Speicherweg angelegt und vom Server wieder gelesen:
//   A1  BESTANDSQUELLE in der Bibliothek — eingespielt über den JSON-Import (`POST
//       /api/library/import`) und angenommen (`PUT /api/library/import/candidates/:id`), also der
//       Weg, auf dem Altbestand ins System kommt; nicht über `add-source`.
//   A2  PRÜFKARTE (`/validierung`) — dieselbe Bestandsquelle am Nachweis der Karte.
//   A3  KONFLIKTANSICHT (`/konflikte?fall=…`) — Konflikt über `action: "conflict"`; beide Seiten:
//       Bestandsquelle links, `add-source`-Quelle rechts.
//   A4  ERFASSUNGS-WARTELISTE — Entwurf mit `pendingSources` über `POST /api/drafts`, geöffnet
//       über `?draft=…&weg=formular`; nach Reload DERSELBE gespeicherte Entwurf.
//
// WAS SIE AUSDRÜCKLICH NICHT IST: die Abnahme auf dem BEZEICHNETEN LIVE-STAND. Der Smoke-Server
// läuft lokal mit In-Memory-Bestand; der Live-Nachweis gehört in den Veröffentlichungsablauf und
// wird dort mit Fassung dokumentiert. Ebenfalls NICHT hier: eine Altquelle OHNE `peerValidated`-
// Feld. Keine Schreibroute des Produkts erzeugt sie (`POST /api/kos` verwirft Client-`sources`,
// jeder Import- und Anhängeweg schreibt `false`); ihr fail-closed-Verhalten ist an der echten
// Clientkette belegt (`tests/app/f0205-extern-ungeprueft-chip.test.tsx` K3/K4).
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";
import {
  pruefeDeEnTastaturReload,
  tabBisIn,
  tabUndEnter,
} from "./support/externe-quellen-browserhilfe";
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

// ================================================================================================
// NACHARBEIT 6 — BESTAND UND DIE ÜBRIGEN AUFRUFER
// ================================================================================================

interface Angelegt {
  id: string;
  titel: string;
  /** Die Bezeichnung der externen Quelle, an der die Kennzeichnung gelesen wird. */
  label: string;
}

/** Setzt die Stufe der externen Wissensabfrage und gibt den vorgefundenen Wert zurück. */
async function setzeStufe(request: APIRequestContext, stufe: string): Promise<string> {
  const vorher = await request.get("/api/external/policy");
  expect(vorher.ok(), `Stufe nicht lesbar: ${vorher.status()}`).toBe(true);
  const alt = ((await vorher.json()) as { stage: string }).stage;
  const setzen = await request.put("/api/external/policy", { data: { stage: stufe } });
  expect(setzen.ok(), `Stufe nicht setzbar: ${setzen.status()}`).toBe(true);
  return alt;
}

/** Liest das Objekt vom Server und belegt: die Quelle ist extern und nicht peer-validiert. */
async function quelleIstUngeprueft(
  request: APIRequestContext,
  id: string,
  label: string,
): Promise<void> {
  const gelesen = await request.get(`/api/kos/${id}`);
  expect(gelesen.ok(), `Objekt ${id} nicht lesbar: ${gelesen.status()}`).toBe(true);
  const wissen = (await gelesen.json()) as Wissen;
  const quelle = wissen.sources.find((s) => s.label === label);
  expect(quelle, `die Quelle „${label}" fehlt am gespeicherten Objekt`).toBeDefined();
  expect(quelle?.kind).toBe("external");
  expect(quelle?.peerValidated).toBe(false);
}

/**
 * BESTAND: ein Eintrag mit Herkunft (externe Kennung, Fassung, Adresse, Anbieter) über den
 * JSON-Import eingereicht und angenommen — der Weg, auf dem Altbestand ins System kommt. Die
 * Quelle trägt dabei den Titel des Eintrags als Bezeichnung (`buildSource`).
 */
async function legeBestandAn(request: APIRequestContext, marke: string): Promise<Angelegt> {
  const titel = `Bestand Ventil A ${marke}`;
  const eingang = await request.post("/api/library/import", {
    data: {
      items: [
        {
          title: titel,
          statement: `Künstlicher Altbestand ${marke}: Ventil A wird vor dem Öffnen entlastet.`,
          type: "best_practice",
          category: "Betrieb",
          externalId: `ALT-${marke}`,
          sourceVersion: 3,
          url: `https://example.invalid/altbestand/ventil-a-${marke}`,
          provider: "Synthetischer Bestand",
          confidentiality: "intern",
        },
      ],
    },
  });
  const eingangText = await eingang.text();
  expect(eingang.ok(), `Import scheiterte: ${eingang.status()} ${eingangText}`).toBe(true);
  const kandidat = (JSON.parse(eingangText) as { kandidaten: { id: string }[] }).kandidaten[0];
  expect(kandidat, `kein Kandidat eingereiht: ${eingangText}`).toBeDefined();

  const annahme = await request.put(`/api/library/import/candidates/${kandidat?.id}`, {
    data: { action: "accept" },
  });
  const annahmeText = await annahme.text();
  expect(annahme.ok(), `Annahme scheiterte: ${annahme.status()} ${annahmeText}`).toBe(true);
  const koId = (JSON.parse(annahmeText) as { koId?: string }).koId;
  expect(koId, `die Annahme legte kein Objekt an: ${annahmeText}`).toBeTruthy();

  await quelleIstUngeprueft(request, koId ?? "", titel);
  return { id: koId ?? "", titel, label: titel };
}

/** Ein Objekt mit einer über `add-source` angehängten öffentlichen Quelle (Stufe ≥ search_attach). */
async function legeMitQuelleAn(request: APIRequestContext, marke: string): Promise<Angelegt> {
  const titel = `Gegenseite Ventil B ${marke}`;
  const label = `Lexikonartikel Ventil B ${marke}`;
  const wissen = await legeWissenAn(request, titel);
  const angehaengt = await request.put(`/api/kos/${wissen.id}`, {
    data: {
      action: "add-source",
      source: { label, url: "https://de.wikipedia.org/wiki/Ventil" },
    },
  });
  const text = await angehaengt.text();
  expect(angehaengt.ok(), `add-source scheiterte: ${angehaengt.status()} ${text}`).toBe(true);
  await quelleIstUngeprueft(request, wissen.id, label);
  return { id: wissen.id, titel, label };
}

test.describe("Nacharbeit 6 · Bestand und übrige Aufrufer im echten Browser", () => {
  test("A1 · Bestandsquelle in der Bibliothek: DE/EN, Tastatur, Reload", async ({ page }) => {
    await ensureLoggedIn(page);
    const bestand = await legeBestandAn(page.request, frischeMarke());

    await pruefeDeEnTastaturReload(
      page,
      `/wissen/${bestand.id}`,
      async (p) => {
        await expect(p.getByTestId("bib-lesen")).toBeVisible({ timeout: 15_000 });
        await tabUndEnter(p, p.getByTestId("bib-sprung-quellen"), "Sprung „Quellen“");
      },
      (p) => [p.locator('[data-bib-abschnitt="quellen"] li').filter({ hasText: bestand.label })],
    );
  });

  test("A2 · Prüfkarte: Bestandsquelle — DE/EN, Tastatur, Reload", async ({ page }) => {
    await ensureLoggedIn(page);
    const bestand = await legeBestandAn(page.request, frischeMarke());

    await pruefeDeEnTastaturReload(
      page,
      "/validierung",
      async (p) => {
        const liste = p.getByTestId("pruefen-warteschlange-eintrag");
        const eintrag = liste.filter({ hasText: bestand.titel });
        await tabUndEnter(p, eintrag, "Prüfobjekt in der Warteschlange");
        const karte = p.getByTestId("pruefen-karte");
        await expect(karte).toContainText(bestand.titel, { timeout: 15_000 });
        const mehr = karte.getByTestId("pruefen-mehr-karte").locator("summary");
        await tabUndEnter(p, mehr, "„Mehr“ der Prüfkarte");
      },
      (p) => [p.getByTestId("pruefen-quellennachweis").filter({ hasText: bestand.label })],
    );
  });

  test("A3 · Konfliktansicht: beide Seiten — DE/EN, Tastatur, Reload", async ({ page }) => {
    await ensureLoggedIn(page);
    const marke = frischeMarke();
    const alteStufe = await setzeStufe(page.request, "search_attach");
    let konfliktId = "";
    try {
      const bestand = await legeBestandAn(page.request, marke);
      const gegenseite = await legeMitQuelleAn(page.request, marke);
      const anlage = await page.request.put(`/api/kos/${bestand.id}`, {
        data: {
          action: "conflict",
          conflict: {
            koA: bestand.id,
            koB: gegenseite.id,
            type: "context",
            description: `Künstlicher Kontextkonflikt ${marke}`,
          },
        },
      });
      const anlageText = await anlage.text();
      expect(anlage.ok(), `Konflikt nicht angelegt: ${anlage.status()} ${anlageText}`).toBe(true);
      konfliktId = (JSON.parse(anlageText) as { id: string }).id;
      expect(konfliktId).toBeTruthy();

      await pruefeDeEnTastaturReload(
        page,
        `/konflikte?fall=${encodeURIComponent(konfliktId)}`,
        async (p) => {
          await expect(p.getByTestId("pruefen-flaeche")).toContainText(bestand.titel, {
            timeout: 15_000,
          });
          const mehrA = p.getByTestId("pruefen-mehr-konflikt-a").locator("summary");
          await tabUndEnter(p, mehrA, "„Mehr“ der linken Seite");
          const mehrB = p.getByTestId("pruefen-mehr-konflikt-b").locator("summary");
          await tabUndEnter(p, mehrB, "„Mehr“ der rechten Seite");
        },
        (p) => {
          const links = p.getByTestId("pruefen-mehr-konflikt-a").getByTestId("quelle-beleg");
          const rechts = p.getByTestId("pruefen-mehr-konflikt-b").getByTestId("quelle-beleg");
          const quelleLinks = links.filter({ hasText: bestand.label });
          const quelleRechts = rechts.filter({ hasText: gegenseite.label });
          return [quelleLinks, quelleRechts];
        },
      );
    } finally {
      if (konfliktId) {
        await page.request.post(`/api/conflicts/${encodeURIComponent(konfliktId)}/dismiss`, {
          data: {},
        });
      }
      await page.request.put("/api/external/policy", { data: { stage: alteStufe } });
    }
  });

  test("A4 · Erfassungs-Warteliste: gespeicherter Entwurf — DE/EN, Tastatur, Reload", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const marke = frischeMarke();
    const label = `Entwurfsquelle Altbestand ${marke}`;
    // Ein frisch geladener Entwurf ist nicht verändert; sollte eine Verlassen-Wache dennoch fragen,
    // wird sie bestätigt — der Fall misst die Kennzeichnung, nicht die Wache.
    page.on("dialog", (dialog) => dialog.accept());

    const anlage = await page.request.post("/api/drafts", {
      data: {
        title: `Entwurf mit Quelle ${marke}`,
        statement: `Künstlicher Entwurf ${marke} für Speichern, Wiederöffnen und Reload.`,
        type: "best_practice",
        category: "Betrieb",
        pendingSources: [
          {
            label,
            url: `https://example.invalid/altbestand/entwurf-${marke}`,
            excerpt: "Künstlicher Entwurf für Speichern, Wiederöffnen und Reload.",
            sourceProvider: "Synthetischer Bestand",
          },
        ],
      },
    });
    const anlageText = await anlage.text();
    expect(anlage.status(), `Entwurf nicht angelegt: ${anlageText}`).toBe(201);
    const entwurfId = (JSON.parse(anlageText) as { id: string }).id;
    try {
      // Gespeichert ist, was der Server zurückgibt — nicht, was gesendet wurde.
      const gelesen = await page.request.get(`/api/drafts/${encodeURIComponent(entwurfId)}`);
      expect(gelesen.ok()).toBe(true);
      expect(await gelesen.text()).toContain(label);

      await pruefeDeEnTastaturReload(
        page,
        `/capture/frontdoor?draft=${encodeURIComponent(entwurfId)}&weg=formular`,
        async (p) => {
          const eintrag = p.locator("li").filter({ hasText: label });
          await expect(eintrag, "der gespeicherte Entwurf zeigt seine Quelle nicht").toBeVisible({
            timeout: 20_000,
          });
          await tabBisIn(p, eintrag, "Quelleneintrag der Warteliste");
        },
        (p) => [p.locator("li").filter({ hasText: label })],
      );
    } finally {
      await page.request.delete(`/api/drafts/${encodeURIComponent(entwurfId)}`);
    }
  });
});
