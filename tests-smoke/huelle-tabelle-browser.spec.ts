// AUFTRAG-huelle Block A — DIE TABELLE ÜBERLEBT DEN GANZEN WEG, IM ECHTEN BROWSER.
//
// DER BEFUND (ben in sammel92, der letzte Ship-Blocker): der Behälter-Zweig in `einheitenVon`
// (`editorFigures.ts`) hielt jede attributlose Hülle, die nur Bilder enthält, für bedeutungslos —
// und räumte eine attributlose Tabelle mit einem Bild in der Zelle rekursiv bis auf das Bild ab.
// Die ganze Tabelle verschwand, samt Zeilen und Zellen.
//
// WARUM DAS HIER STEHT UND NICHT NUR IN jsdom (I46, die Lehre aus mega87): eine Aussage über
// Browserverhalten wird im Browser gemessen. Die jsdom-Belege in
// `tests/capture/huelle-tagbewusste-grenze.test.ts` messen die Entscheidung AN DER FUNKTION, für
// jedes Struktur-Tag des Vertrags. Hier wird gemessen, dass die Tabelle den GANZEN Weg übersteht —
// echter HTML-Parser (Tabellen sind der Fall, in dem er am eigenwilligsten ist: implizites `tbody`,
// Foster-Parenting), echte Verankerung im contenteditable, beide Sanitizer beim Speichern, erneutes
// Öffnen, erneutes Normalisieren. Genau auf diesem Weg wäre der Verlust dem Nutzer aufgefallen: er
// hätte seine Messtabelle nach dem Speichern nicht mehr gehabt.
//
// UND EINE ZWEITE FRAGE, DIE NUR HIER BEANTWORTBAR IST: das Bild bleibt jetzt IN der Zelle stehen,
// statt herausgelöst zu werden. Bleibt es damit bedienbar (Klick auf die Beschreibung öffnet das
// Formular) und findet die Galerie es noch? Beides wird gemessen, nicht angenommen.
//
// HERMETISCH: kein Modell, kein Schlüssel, kein Netz, kein Egress. Die beiden Bilder sind winzige
// eingebettete Grafiken (PNG und GIF, damit sie unterscheidbar sind) — keine Datei auf der Platte,
// kein Objekt-Store, kein Upload.
//
// DIE DATENLAGE BLEIBT UNBERÜHRT: angelegt wird ein ENTWURF (kein Wissensobjekt), und er wird am
// Ende wieder gelöscht.
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Das Markup, an dem der Fehler hing, und JEDE Eigenschaft daran ist nötig, damit die Kante
// überhaupt berührt wird:
//   · Die Tabelle trägt AUF KEINER EBENE ein Attribut — ein einziges hätte die Auflösung schon
//     verhindert (genau daran ist der alte jsdom-Fall mit `class="kw-tabelle"` vorbeigelaufen).
//   · In der Zelle steht NICHTS als das Bild — ein Wort Text hätte sie ebenfalls gerettet.
//   · Und NEBEN der Tabelle steht ein zweites, direktes Bild: erst dadurch gilt die eingehende
//     figure als nicht-flach und der Umbau läuft überhaupt.
const AUS_WORD = `<h2>Befund</h2><figure><img src="${PNG}" alt="Schiene"><table><tbody><tr><td><img src="${GIF}" alt="Lager"></td></tr></tbody></table><figcaption></figcaption></figure>`;

const ERSTE = "Riefen in Laufrichtung bei Schmiermangel";
const ZWEITE = "Lagerschale aus der Messreihe";

const FUSSNOTE = "figcaption[data-kw-caption-open]";
const FELD = "#caption-form-text";
const EDITOR = '[contenteditable="true"]';

async function entwurfMitTabelle(page: Page): Promise<string> {
  const antwort = await page.request.post("/api/drafts", {
    data: {
      title: "Huelle-Rundlauf: Tabelle mit Bild",
      statement: "Eine attributlose Tabelle mit einem Bild in der Zelle.",
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
 * Die Tabelle steht vollständig da — und das Bild steckt NOCH IN IHRER ZELLE. Beides zusammen ist
 * der Punkt: „eine Tabelle ist da" wäre auch wahr, wenn das Bild daneben herausgefallen wäre.
 */
async function tabelleStehtVollstaendig(page: Page, wann: string): Promise<void> {
  await expect(
    page.locator(`${EDITOR} table`),
    `${wann}: die attributlose Tabelle wurde als bedeutungslose Hülle aufgelöst — die Messtabelle des Nutzers ist weg`,
  ).toHaveCount(1);
  await expect(
    page.locator(`${EDITOR} table > tbody > tr > td`),
    `${wann}: eine Ebene der Tabelle ist beim rekursiven Abräumen verloren gegangen`,
  ).toHaveCount(1);
  await expect(
    page.locator(`${EDITOR} table td img[src="${GIF}"]`),
    `${wann}: das Bild wurde aus der Zelle herausgerissen, statt an Ort und Stelle verankert zu werden`,
  ).toHaveCount(1);
}

/** Was die GALERIE zeigt — je Bild ein Thumbnail-Knopf mit der aktuellen Beschreibung als `alt`. */
async function galerie(page: Page): Promise<{ src: string; caption: string }[]> {
  return await page.locator('button[title] img[src^="data:image"]').evaluateAll((els) =>
    els.map((e) => ({
      src: (e.getAttribute("src") ?? "").slice(0, 24),
      caption: e.getAttribute("alt") ?? "",
    })),
  );
}

async function entwurfLoeschen(page: Page, id: string): Promise<void> {
  if (id) {
    await page.request.delete(`/api/drafts/${id}`);
  }
}

test("huelle: eine attributlose Tabelle mit Bild überlebt Laden, Beschreiben, Speichern und Wiederöffnen", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const id = await entwurfMitTabelle(page);
  try {
    await oeffneEntwurf(page, id);

    // DER SHIP-BLOCKER, in drei Zeilen: vor diesem Auftrag war die Tabelle nach dem Verankern weg.
    await tabelleStehtVollstaendig(page, "nach dem ersten Öffnen");

    // Und die Erhaltung darf nicht auf Kosten der Bedienbarkeit gehen: BEIDE Bilder — das direkte
    // und das in der Zelle — haben eine eigene, anklickbare Beschreibung.
    await expect(
      page.locator(FUSSNOTE),
      "Nicht beide Bilder haben eine eigene Bildbeschreibung — das Bild in der Tabelle ist unbedienbar",
    ).toHaveCount(2, { timeout: 15_000 });
    const kennungen = await page
      .locator(FUSSNOTE)
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-image-id")));
    expect(new Set(kennungen).size, "Beide Bilder tragen dieselbe Kennung").toBe(2);

    await beschreibe(page, 0, ERSTE);
    await beschreibe(page, 1, ZWEITE);
    await expect(page.locator(FUSSNOTE).nth(0)).toContainText(ERSTE);
    await expect(
      page.locator(FUSSNOTE).nth(1),
      "Die Beschreibung des Bildes in der Tabelle ist nicht dort gelandet",
    ).toContainText(ZWEITE);

    // Die Galerie unter dem Editor: findet sie das Bild noch, obwohl es jetzt in einer Tabellenzelle
    // steht statt herausgelöst daneben? (debounced, deshalb `poll`)
    await expect
      .poll(async () => await galerie(page), {
        message: "Die Galerie verliert das Bild, das in der Tabellenzelle steht",
        timeout: 10_000,
      })
      .toEqual([
        { src: PNG.slice(0, 24), caption: ERSTE },
        { src: GIF.slice(0, 24), caption: ZWEITE },
      ]);

    // DER KREIS: speichern und erneut öffnen. Erst wenn die Beschreibungen wirklich im abgelegten
    // Entwurf stehen, wird wieder geöffnet — sonst prüfte der zweite Teil den Zustand vor dem
    // Speichern und wäre grün, ohne etwas zu belegen.
    // JOB 3062: der Knopf heisst am neuen Blatt „Entwurf sichern" (`erfassen.entwurfSichern`); der
    // Weg dahinter ist unverändert derselbe (`POST/PUT /api/drafts`).
    await page.getByRole("button", { name: "Entwurf sichern", exact: true }).click();
    await expect
      .poll(
        async () => {
          const antwort = await page.request.get("/api/drafts");
          return antwort.ok() ? JSON.stringify(await antwort.json()) : "";
        },
        { message: "Der Entwurf trägt die beiden Beschreibungen nicht", timeout: 15_000 },
      )
      .toContain(ZWEITE);
    await oeffneEntwurf(page, id);

    // Nach dem Rundlauf durch BEIDE Sanitizer: die Tabelle steht immer noch, und die Zuordnung hält.
    await tabelleStehtVollstaendig(page, "nach dem Wiederöffnen");
    await expect(page.locator(FUSSNOTE)).toHaveCount(2, { timeout: 15_000 });
    await expect(
      page.locator(FUSSNOTE).nth(0),
      "Nach dem Wiederöffnen steht beim ersten Bild die falsche Beschreibung",
    ).toContainText(ERSTE);
    await expect(
      page.locator(FUSSNOTE).nth(1),
      "Nach dem Wiederöffnen steht beim Bild in der Tabelle die falsche Beschreibung",
    ).toContainText(ZWEITE);
  } finally {
    await entwurfLoeschen(page, id);
  }
});
