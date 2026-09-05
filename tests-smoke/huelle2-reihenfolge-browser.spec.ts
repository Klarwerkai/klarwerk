// AUFTRAG-huelle2 Block B, Pflichtprobe 5 — DIE UMGEKEHRTE REIHENFOLGE, IM ECHTEN BROWSER.
//
// DER BEFUND (ben in sammel96). Der tagbewusste Schutz aus `huelle` hat den Strukturverlust
// geschlossen und dabei eine Grenze VERSCHOBEN: erhaltene Strukturen wurden für die Paarung zu
// undurchsichtigen Einheiten. Steht das Bild in der Struktur VOR einem direkten Bild, ging die
// unmarkierte Fußnote trotzdem an das spätere direkte Bild — entgegen der im Modul dokumentierten
// Dokumentreihenfolge. Ein stiller fachlicher Zuordnungsfehler.
//
// UND WARUM ES NIEMAND GESEHEN HAT: `tests-smoke/huelle-tabelle-browser.spec.ts` setzt — wie alle
// Bühnen jener Runde — das direkte Bild VOR die Tabelle. In dieser Richtung geht die Fußnote
// ohnehin an das direkte Bild; die auslösende Lage wurde vermieden. Eine Rundreise, die nur die
// günstige Richtung fährt, ist keine Gegenprobe. Diese hier fährt die andere.
//
// WARUM IM BROWSER UND NICHT NUR IN jsdom (I46, die Lehre aus mega87): `paare()` arbeitet auf dem
// DOM, das der ECHTE HTML-Parser aus dem gespeicherten Markup gebaut hat — und bei Tabellen ist er
// am eigenwilligsten (implizites `tbody`, Foster-Parenting). Ob die Dokumentreihenfolge, die die
// Paarung sieht, dieselbe ist, die der Nutzer sieht, ist eine Aussage über den Browser. Sie wird
// hier gemessen und nicht aus der Struktur abgeleitet. Dazu kommt, was jsdom gar nicht beantworten
// kann: übersteht die Zuordnung BEIDE Sanitizer und das Wiederöffnen?
//
// HERMETISCH: kein Modell, kein Schlüssel, kein Netz, kein Egress. Die beiden Bilder sind winzige
// eingebettete Grafiken (PNG und GIF, damit sie unterscheidbar sind).
//
// DIE DATENLAGE BLEIBT UNBERÜHRT: angelegt wird ein ENTWURF (kein Wissensobjekt), am Ende gelöscht.
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// DIE UMGEKEHRTE REIHENFOLGE, und jede Eigenschaft daran ist nötig:
//   · Die Tabelle steht ZUERST — ihr Bild (GIF) ist damit das erste in Dokumentreihenfolge.
//   · Die Tabelle trägt auf KEINER Ebene ein Attribut, und in der Zelle steht NICHTS als das Bild.
//     Beides zusammen ist die Kante aus `huelle`, die weiterhin halten muss.
//   · Daneben steht ein zweites, DIREKTES Bild (PNG): erst dadurch gilt die figure als nicht-flach
//     und der Umbau läuft überhaupt.
//   · Und die figcaption ist GEFÜLLT und unmarkiert. Eine leere Fußnote könnte an jedem der beiden
//     Bilder landen, ohne dass es auffiele — der Fehler wäre unsichtbar.
const AUS_WORD = [
  "<h2>Befund</h2><figure>",
  `<table><tbody><tr><td><img src="${GIF}" alt="Lager"></td></tr></tbody></table>`,
  `<img src="${PNG}" alt="Schiene">`,
  "<figcaption>Riefen in Laufrichtung bei Schmiermangel</figcaption>",
  "</figure>",
].join("");

/** Der Text steht im eingehenden Markup und gehört dem ERSTEN Bild — dem in der Tabelle. */
const ERSTE = "Riefen in Laufrichtung bei Schmiermangel";
/** Wird im Browser nachgetragen und gehört dem direkten Bild daneben. */
const ZWEITE = "Schienenstueck aus derselben Messreihe";

const FUSSNOTE = "figcaption[data-kw-caption-open]";
const FELD = "#caption-form-text";
const EDITOR = '[contenteditable="true"]';
/** Die Fußnote IN der Tabelle — die des Bildes, das in Dokumentreihenfolge vorne steht. */
const FUSSNOTE_IN_TABELLE = `${EDITOR} table ${FUSSNOTE}`;
/** Und die daneben: eine Fußnote, die NICHT in der Tabelle steht. */
const FUSSNOTE_DANEBEN = `${EDITOR} > figure > ${FUSSNOTE}`;

async function entwurfAnlegen(page: Page): Promise<string> {
  const antwort = await page.request.post("/api/drafts", {
    data: {
      title: "Huelle2-Rundlauf: Struktur vor direktem Bild",
      statement: "Eine attributlose Tabelle mit Bild steht VOR dem direkten Bild.",
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

/**
 * DIE ZUORDNUNG, wie der Nutzer sie sieht: der Text steht bei dem Bild, zu dem er gehört — und die
 * Tabelle steht dabei vollständig da. Beides zusammen ist der Punkt: „die Zuordnung stimmt" wäre
 * auch wahr, wenn man die Tabelle dafür aufgelöst hätte, und genau das darf der Fix nicht tun.
 */
async function zuordnungStimmt(page: Page, wann: string, zweite: string): Promise<void> {
  await expect(
    page.locator(`${EDITOR} table > tbody > tr > td`),
    `${wann}: die attributlose Tabelle wurde aufgelöst — die Struktur des Nutzers ist weg`,
  ).toHaveCount(1);
  await expect(
    page.locator(`${EDITOR} table td img[src="${GIF}"]`),
    `${wann}: das Bild wurde aus der Zelle herausgerissen, statt die Fußnote zu ihm zu bewegen`,
  ).toHaveCount(1);
  await expect(
    page.locator(FUSSNOTE),
    `${wann}: nicht beide Bilder haben eine eigene Bildbeschreibung`,
  ).toHaveCount(2, { timeout: 15_000 });

  await expect(
    page.locator(FUSSNOTE_IN_TABELLE),
    `${wann}: beim Bild IN der Tabelle steht nicht seine Beschreibung. Es steht in Dokumentreihenfolge VOR dem direkten Bild und muss die vorhandene, unmarkierte Fußnote bekommen — sonst liest der Nutzer sie unter dem falschen Bild.`,
  ).toHaveText(ERSTE);
  await expect(
    page.locator(FUSSNOTE_DANEBEN),
    `${wann}: beim direkten Bild steht die falsche Beschreibung`,
  ).toHaveText(zweite);
}

/** Das Formular über den Weg aus mega84 öffnen: Klick auf die Beschreibung selbst. */
async function beschreibe(page: Page, wo: string, text: string): Promise<void> {
  await page.locator(wo).click();
  const feld = page.locator(FELD);
  await expect(feld, "Das Formular hat sich nicht geöffnet").toBeVisible({ timeout: 10_000 });
  await feld.click();
  await page.keyboard.type(text);
  await page.locator('[data-testid="caption-form-save"]').click();
  await expect(page.locator(FELD)).toHaveCount(0, { timeout: 10_000 });
}

test("huelle2: steht die Struktur VOR dem direkten Bild, bleibt die Beschreibung beim richtigen Bild", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const id = await entwurfAnlegen(page);
  try {
    await oeffneEntwurf(page, id);

    // DER SHIP-BLOCKER, in zwei Zeilen: vor diesem Auftrag stand ERSTE beim direkten Bild und die
    // Fußnote in der Tabelle war leer. Die zweite ist hier noch leer, weil sie nie geschrieben wurde.
    await zuordnungStimmt(page, "nach dem ersten Öffnen", "");

    // Die Kennungen müssen verschieden sein — eine doppelte data-image-id wäre der Schaden, an dem
    // die naheliegende Reparatur gescheitert wäre.
    const kennungen = await page
      .locator(FUSSNOTE)
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-image-id")));
    expect(
      kennungen.filter((k) => k === null || k === ""),
      "Eine Fußnote hat keine Kennung",
    ).toEqual([]);
    expect(new Set(kennungen).size, "Beide Fußnoten tragen dieselbe Kennung").toBe(2);

    // Und die Bedienbarkeit hängt an derselben Zuordnung: das Formular des Bildes in der Tabelle
    // muss dessen vorhandenen Text zeigen, nicht einen leeren Anfang. Gespeichert wird unverändert
    // — das schließt das Formular und belegt zugleich, dass der Rundlauf durchs Formular nichts
    // verliert. (`#caption-form-text` ist ein contenteditable, kein Eingabefeld: `toHaveText`.)
    await page.locator(FUSSNOTE_IN_TABELLE).click();
    await expect(
      page.locator(FELD),
      "Das Formular des Bildes in der Tabelle zeigt nicht dessen vorhandene Beschreibung — der Klick führt zum falschen Bild",
    ).toHaveText(ERSTE, { timeout: 10_000 });
    await page.locator('[data-testid="caption-form-save"]').click();
    await expect(page.locator(FELD)).toHaveCount(0, { timeout: 10_000 });

    await beschreibe(page, FUSSNOTE_DANEBEN, ZWEITE);
    await zuordnungStimmt(page, "nach dem Beschreiben", ZWEITE);

    // DER KREIS: speichern und erneut öffnen. Erst wenn der Text wirklich im abgelegten Entwurf
    // steht, wird wieder geöffnet — sonst prüfte der zweite Teil den Zustand vor dem Speichern.
    // JOB 3062: der Knopf heisst am neuen Blatt „Entwurf sichern" (`erfassen.entwurfSichern`); der
    // Weg dahinter ist unverändert derselbe (`POST/PUT /api/drafts`).
    await page.getByRole("button", { name: "Entwurf sichern", exact: true }).click();
    await expect
      .poll(
        async () => {
          const antwort = await page.request.get("/api/drafts");
          return antwort.ok() ? JSON.stringify(await antwort.json()) : "";
        },
        { message: "Der Entwurf trägt die zweite Beschreibung nicht", timeout: 15_000 },
      )
      .toContain(ZWEITE);
    await oeffneEntwurf(page, id);

    // Nach dem Rundlauf durch BEIDE Sanitizer hält die Zuordnung — und die Tabelle steht immer noch.
    await zuordnungStimmt(page, "nach dem Wiederöffnen", ZWEITE);
  } finally {
    if (id) {
      await page.request.delete(`/api/drafts/${id}`);
    }
  }
});
