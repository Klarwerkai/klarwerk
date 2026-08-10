// AUFTRAG-mega89 Block C — DER PRODUKTNAHE MEHRBILD-RUNDLAUF IM ECHTEN BROWSER.
//
// bens dritte Vor-Ship-Bedingung, wörtlich der Umfang: zwei Bilder in einer gemeinsamen eingehenden
// figure LADEN oder EINFÜGEN, BILD 1 UND BILD 2 GETRENNT BESCHREIBEN, SPEICHERN, ERNEUT ÖFFNEN und
// BEIDE ZUORDNUNGEN AUCH IN DER GALERIE prüfen. Der Kreis muss sich schließen — ein Test, der nur
// das Öffnen zeigt, belegt die Zuordnung nicht.
//
// WARUM DAS HIER STEHT UND NICHT NUR IN jsdom (die Lehre aus mega87, ab jetzt in jedem Auftrag):
// eine Aussage über Browserverhalten wird im Browser gemessen. Das Beschreiben läuft hier über
// echtes Tippen in ein contenteditable-Feld, das Speichern über die echte Schaltfläche der
// Vordertür, das Wiederöffnen über den echten Wiederaufnahme-Weg — und die Galerie ist die echte,
// gerenderte `BodyImageGallery` unter dem Editor, nicht ihre Ableitung.
//
// WARUM GELADEN UND NICHT EINGEFÜGT WIRD: das Einfügen bräuchte ein `ClipboardEvent` mit
// vorbelegtem `clipboardData`, und dessen Konstruktor-Unterstützung ist zwischen den drei Engines
// nicht einheitlich — ein Test, der in WebKit an der VORRICHTUNG scheitert, sagt nichts über das
// Produkt. Der Ladeweg ist außerdem der Weg, auf dem dieser Fall real auftritt: ein Entwurf, den
// Klara oder ein API-Aufrufer mit Word-Markup abgelegt hat. Die Einfüge-Hälfte desselben Falls
// steht deterministisch in `tests/capture/mega89-mehrbild-rundlauf-mounted.test.tsx`.
//
// HERMETISCH: kein Modell, kein Schlüssel, kein Netz, kein Egress. Die beiden Bilder sind winzige
// eingebettete Grafiken (PNG und GIF, damit sie unterscheidbar sind) — keine Datei auf der Platte,
// kein Objekt-Store, kein Upload. Der KI-Knopf im Formular ist ohne Modell deaktiviert und wird
// nicht berührt.
//
// DIE DATENLAGE BLEIBT UNBERÜHRT: angelegt wird ein ENTWURF (kein Wissensobjekt), und er wird am
// Ende wieder gelöscht — `ui-smoke.spec.ts` „mega49: die Datenlage dieses Laufs ist die zugesagte"
// misst das Prüf-Board (Wissensobjekte), dort entsteht nichts.
//
// Aufruf: npm run smoke:ui:gate (Chromium, hermetisch) oder npm run smoke:ui (drei Engines).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// AUFTRAG-mega90 Block C: der Rundlauf trägt jetzt zusätzlich TEXT ZWISCHEN DEN BILDERN.
//
// WARUM ER HIER STEHT UND NICHT NUR IN jsdom: bis mega90 sah der Umbau ausschließlich Elementknoten
// (`":scope > *"`), und ein direkter Textknoten einer eingehenden figure verschwand beim Flachmachen
// SPURLOS. Die jsdom-Belege in `tests/capture/mega90-verlustfreier-umbau.test.ts` messen das an der
// Funktion; hier wird gemessen, dass es den GANZEN Weg übersteht — laden, beschreiben, speichern
// (beide Sanitizer), erneut öffnen, erneut normalisieren. Genau auf diesem Weg wäre der Verlust dem
// Nutzer aufgefallen, und zwar erst nach dem Speichern.
const ZWISCHENTEXT = "Zwischen den Bildern: Ausbau am 12.05.";

// Genau das Markup, das aus Word kommt: EINE figure, ZWEI Bilder, EINE (leere) Fußnote — und Text
// dazwischen, wie ihn ein Word-Absatz mitbringt.
const AUS_WORD = `<h2>Befund</h2><figure><img src="${PNG}" alt="Schiene">${ZWISCHENTEXT}<img src="${GIF}" alt="Lager"><figcaption></figcaption></figure>`;

const ERSTE = "Riefen in Laufrichtung bei Schmiermangel";
const ZWEITE = "Lagerschale, Innenring ausgeschlagen";

const FUSSNOTE = "figcaption[data-kw-caption-open]";
const FELD = "#caption-form-text";

/** Der Entwurf mit dem Word-Markup — angelegt über die echte Schnittstelle der Sitzung. */
async function entwurfMitWordMarkup(page: Page): Promise<string> {
  const antwort = await page.request.post("/api/drafts", {
    data: {
      title: "Mehrbild-Rundlauf mega89",
      statement: "Zwei Bilder in einer eingehenden Figure.",
      type: "best_practice",
      category: "Anlage 1",
      bodyHtml: AUS_WORD,
    },
  });
  expect(antwort.status(), "Der Entwurf konnte nicht angelegt werden").toBe(201);
  const draft = (await antwort.json()) as { id: string };
  return draft.id;
}

async function oeffneEntwurf(page: Page, id: string): Promise<void> {
  await page.goto(`/capture/frontdoor?draft=${id}`);
  await expect(page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first()).toBeVisible(
    {
      timeout: 15_000,
    },
  );
}

/** Das Formular über den Weg aus mega84 öffnen: Klick auf die Beschreibung selbst. */
async function beschreibe(page: Page, i: number, text: string): Promise<void> {
  await page.locator(FUSSNOTE).nth(i).click();
  const feld = page.locator(FELD);
  await expect(feld, `Das Formular für Bild ${i + 1} hat sich nicht geöffnet`).toBeVisible({
    timeout: 10_000,
  });
  await feld.click();
  await page.keyboard.type(text);
  await page.locator('[data-testid="caption-form-save"]').click();
  await expect(page.locator(FELD)).toHaveCount(0, { timeout: 10_000 });
}

/**
 * Was die GALERIE zeigt: je Bild ein Thumbnail-Knopf, dessen `title` und dessen `alt` die AKTUELLE
 * Beschreibung sind (`BodyImageGallery`). Die Bilder im Fließtext stehen in keinem solchen Knopf.
 */
async function galerie(page: Page): Promise<{ src: string; caption: string }[]> {
  return await page.locator('button[title] img[src^="data:image"]').evaluateAll((els) =>
    els.map((e) => ({
      src: (e.getAttribute("src") ?? "").slice(0, 24),
      caption: e.getAttribute("alt") ?? "",
    })),
  );
}

/**
 * AUFTRAG-mega90 Block C: die FOLGE des Fließtextes auf oberster Ebene — Text als Text, jede figure
 * als ihr Bild. Gelesen wird die Reihenfolge und nicht nur die Anwesenheit: „der Text ist noch da"
 * wäre auch dann wahr, wenn er ans Ende gerutscht wäre.
 */
async function folge(page: Page): Promise<string[]> {
  return await page
    .getByRole("textbox", { name: "Wissensseite — Fließtext" })
    .first()
    .evaluate((el) => {
      const aus: string[] = [];
      for (const kind of Array.from(el.childNodes)) {
        if (kind.nodeType === 3) {
          const text = (kind.textContent ?? "").trim();
          if (text !== "") {
            aus.push(`text:${text}`);
          }
          continue;
        }
        if (kind.nodeType !== 1) {
          continue;
        }
        const element = kind as Element;
        if (element.tagName.toLowerCase() === "figure") {
          const img = element.querySelector(":scope > img");
          aus.push(`bild:${(img?.getAttribute("src") ?? "").slice(0, 24)}`);
          continue;
        }
        aus.push(`${element.tagName.toLowerCase()}`);
      }
      return aus;
    });
}

/** Steht der Text nach dem Umbau noch GENAU ZWISCHEN den beiden Bildern? */
async function textStehtZwischenDenBildern(page: Page, wann: string): Promise<void> {
  const gefunden = await folge(page);
  const erstes = gefunden.indexOf(`bild:${PNG.slice(0, 24)}`);
  const text = gefunden.indexOf(`text:${ZWISCHENTEXT}`);
  const zweites = gefunden.indexOf(`bild:${GIF.slice(0, 24)}`);
  expect(
    text,
    `${wann}: der Text zwischen den Bildern ist verschwunden. Gefundene Folge: ${JSON.stringify(gefunden)}`,
  ).toBeGreaterThanOrEqual(0);
  expect(erstes, `${wann}: das erste Bild fehlt`).toBeGreaterThanOrEqual(0);
  expect(zweites, `${wann}: das zweite Bild fehlt`).toBeGreaterThanOrEqual(0);
  expect(
    erstes < text && text < zweites,
    `${wann}: der Text steht nicht mehr zwischen den beiden Bildern. Gefundene Folge: ${JSON.stringify(gefunden)}`,
  ).toBe(true);
}

async function entwurfLoeschen(page: Page, id: string): Promise<void> {
  if (id) {
    await page.request.delete(`/api/drafts/${id}`);
  }
}

test("mega89: zwei Bilder in EINER eingehenden Figure — getrennt beschreiben, speichern, erneut öffnen, Galerie", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const id = await entwurfMitWordMarkup(page);
  try {
    await oeffneEntwurf(page, id);

    // DER SHIP-BLOCKER, in zwei Zeilen: vor mega89 lag hier eine figure IN einer figure, und Bild 1
    // fand die Fußnote von Bild 2.
    await expect(
      page.locator(FUSSNOTE),
      "Aus zwei Bildern sind nicht zwei eigene Bildbeschreibungen geworden",
    ).toHaveCount(2, { timeout: 15_000 });
    await expect(
      page.locator('[contenteditable="true"] figure figure'),
      "Eine figure liegt in einer figure — genau die Verschachtelung, aus der der Datenschaden folgt",
    ).toHaveCount(0);

    const kennungen = await page
      .locator(FUSSNOTE)
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-image-id")));
    expect(new Set(kennungen).size, "Beide Bilder tragen dieselbe Kennung").toBe(2);

    // AUFTRAG-mega90 Block C: schon beim ERSTEN Öffnen darf der Umbau den Text nicht verlieren.
    await textStehtZwischenDenBildern(page, "nach dem ersten Öffnen");

    await beschreibe(page, 0, ERSTE);
    await beschreibe(page, 1, ZWEITE);
    await expect(page.locator(FUSSNOTE).nth(0)).toContainText(ERSTE);
    await expect(page.locator(FUSSNOTE).nth(1)).toContainText(ZWEITE);
    await expect(
      page.locator(FUSSNOTE).nth(0),
      "Die Beschreibung des zweiten Bildes ist beim ersten gelandet",
    ).not.toContainText(ZWEITE);

    // Die Galerie unter dem Editor — dieselbe, die auch die Leseansicht zeigt (debounced, deshalb
    // wird auf sie gewartet statt sie einmal abzufragen).
    await expect
      .poll(async () => await galerie(page), {
        message: "Die Galerie zeigt nicht beide Bilder mit ihrer eigenen Beschreibung",
        timeout: 10_000,
      })
      .toEqual([
        { src: PNG.slice(0, 24), caption: ERSTE },
        { src: GIF.slice(0, 24), caption: ZWEITE },
      ]);

    // DER KREIS: speichern und erneut öffnen. Erst wenn BEIDE Beschreibungen wirklich im abgelegten
    // Entwurf stehen, wird wieder geöffnet — sonst prüfte der zweite Teil den Zustand vor dem
    // Speichern und wäre grün, ohne etwas zu belegen.
    await page.getByRole("button", { name: "Als Entwurf speichern" }).click();
    await expect
      .poll(
        async () => {
          const antwort = await page.request.get("/api/drafts");
          if (!antwort.ok()) {
            return "";
          }
          // Die Liste ist die Quelle, aus der die Oberfläche fortsetzt; ihre genaue Verschachtelung
          // ist hier nicht der Prüfling, sondern nur die Adresse — geprüft wird der Inhalt.
          return JSON.stringify(await antwort.json());
        },
        { message: "Der Entwurf trägt die beiden Beschreibungen nicht", timeout: 15_000 },
      )
      .toContain(ZWEITE);
    await oeffneEntwurf(page, id);

    await expect(page.locator(FUSSNOTE)).toHaveCount(2, { timeout: 15_000 });
    await expect(
      page.locator(FUSSNOTE).nth(0),
      "Nach dem Wiederöffnen steht beim ersten Bild die falsche Beschreibung",
    ).toContainText(ERSTE);
    await expect(page.locator(FUSSNOTE).nth(1)).toContainText(ZWEITE);
    await expect(page.locator('[contenteditable="true"] figure figure')).toHaveCount(0);

    // AUFTRAG-mega90 Block C — DER EIGENTLICHE SATZ DIESES BLOCKS: der Text zwischen den Bildern hat
    // Umbau, Beschreiben, beide Sanitizer, das Speichern und das erneute Öffnen überstanden — und er
    // steht immer noch an derselben Stelle.
    await textStehtZwischenDenBildern(page, "nach dem Wiederöffnen");

    // …und beide sind weiterhin BEDIENBAR, jede mit IHREM Text.
    await page.locator(FUSSNOTE).nth(1).click();
    await expect(page.locator(FELD)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(FELD)).toContainText(ZWEITE);
    await expect(page.locator(FELD)).not.toContainText(ERSTE);
  } finally {
    await entwurfLoeschen(page, id);
  }
});
