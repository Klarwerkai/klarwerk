// ==================================================================================================
// JOB 4155 · WG-LUECKEN — G1 UND G7 IM ECHTEN BROWSER, AN DER GEBAUTEN APP.
// ==================================================================================================
//
// WARUM DIESE DATEI ÜBERHAUPT EXISTIERT, wo dieselben Zusagen in jsdom schon gemessen werden
// (`tests/wissensgraph-abnahme/eintragsansicht-direkt.test.tsx`): Der Auftrag beantwortet das in
// seinem Prüfpunkt 1 selbst — „Der Wortlaut wäre schon mit einem Feld im JSON erfüllt — der Zweck
// erst mit G1 und G7 im Browser." Drei Dinge sind ausserhalb eines Browsers nicht belegbar:
//
//   · DAS GEBÜNDELTE PRODUKT. jsdom fährt die Quelldateien. Ob der Bereich im AUSGELIEFERTEN
//     Bündel steht, sagt nur ein echter Lauf — genau die Fehlerklasse, für die es diese Suite gibt.
//   · DER ECHTE DRAHT. Hier gibt es keine Attrappe der Endpunkte: die Beziehung geht über
//     `POST /api/kos/:id/beziehungen` in den Bestand, und der Neuladen-Beleg holt sie von dort.
//   · GEOMETRIE. „Ohne Aufklappen sichtbar" heisst im Browser: der Bereich steht im Bild, und die
//     Zeile „Mehr" ist zugeklappt. jsdom rechnet kein Layout und könnte das nie sagen.
//
// DIE AUFTEILUNG DER ABNAHMEN, ehrlich benannt:
//   G1  hier — zwei sichtbare Einträge in der echten App verknüpfen; Art, Richtung und Herkunft
//       stehen an der Kante; die Bestätigung gilt erst, wenn der Server GESPEICHERT hat (belegt
//       durch ein Neuladen, nicht durch die Erfolgsmeldung).
//   G7  hier — dieselbe Beziehung von BEIDEN Seiten: aus der Eintragsansicht und aus dem
//       Wissensnetz. Die erlaubten Daten sind identisch, und der bestehende Schlagwortgraph bleibt,
//       was er war.
//   G2/G9 NICHT hier, sondern an echtem Postgres: Serverneustart und Dump/Restore sind keine
//       Browserfragen (`tests/wissensgraph-abnahme/neustart-und-restore.integration.test.ts`).
//       Der Smoke-Server fährt im Speicher; ein „Neustart" wäre hier ein leerer Bestand und kein
//       Nachweis.
import { type APIRequestContext, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

/** Der Beziehungsbereich in der Lesespalte (JOB 4153, eingebaut von JOB 4155). */
const BEREICH = '[data-testid="wissensbeziehungen"]';
/** Die zugeklappte Zeile „Mehr" — sie darf für den Bereich NICHT angefasst werden müssen. */
const MEHR = '[data-testid="bib-mehr"]';

interface AngelegtesKo {
  id: string;
  version: number;
}

/**
 * ==================================================================================================
 * JEDER FALL BEKOMMT SEINEN EIGENEN BESTAND — und warum das hier nicht optional ist.
 * ==================================================================================================
 *
 * Der Smoke-Server läuft mit EINEM Datenbestand im Speicher, und dieselbe Datei läuft je Engine
 * erneut (chromium, firefox, webkit). Feste Titel hiessen: derselbe Eintrag entsteht dreimal, die
 * Suche findet drei Treffer, und die Zählung „2 sichtbare Objekte" unten wäre eine 6. Ein Fall, der
 * am zweiten Durchgang rot wird, misst die Vorrichtung und nicht das Produkt.
 *
 * Die Marke ist deshalb JE FALL frisch und trägt einen Zufallsanteil — Zeit allein reicht nicht,
 * zwei Engines können in derselben Millisekunde starten.
 */
function frischeMarke(): { a: string; b: string; thema: string } {
  const marke = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    a: `WG-LUECKEN Quelle ${marke}`,
    b: `WG-LUECKEN Ziel ${marke}`,
    // Kleinbuchstaben ohne Trennzeichen: das Schlagwort wird 1:1 zum Thema (`themenVon`).
    thema: `wgluecken${marke}`.toLowerCase(),
  };
}

/**
 * Die VORBEREITUNG läuft über den Draht, nicht über die Oberfläche — und das ist Absicht.
 *
 * Gegenstand dieser Abnahme ist das VERKNÜPFEN, nicht das Anlegen. Zwei Einträge über das
 * Erfassungsformular zu tippen brächte den langen Weg samt KI-Prüfung und Formularregeln in eine
 * Prüfung, die davon nichts wissen will; scheiterte dort etwas, stünde hier ein roter Fall mit der
 * falschen Ursache. Der Klickweg, um den es geht, beginnt danach und wird vollständig geklickt.
 */
async function legeAn(
  request: APIRequestContext,
  title: string,
  thema: string,
): Promise<AngelegtesKo> {
  const antwort = await request.post("/api/kos", {
    data: {
      title,
      statement: `Aussage zu ${title}. Sie ist lang genug, um die Formprüfung zu bestehen.`,
      type: "best_practice",
      category: "Betrieb",
      tags: [thema],
      // ==========================================================================================
      // DIE EINSTUFUNG IST PFLICHT, UND DAS IST KEINE FORMALIE (Runde 1, Torlauf: `400
      // MISSING_CONFIDENTIALITY` — „Vertraulichkeitsstufe fehlt — ein Wissensobjekt entsteht nur
      // mit ausdrücklicher Einstufung.").
      // ==========================================================================================
      //
      // Runde 1 liess das Feld weg und liess den Server damit raten — genau das tut er nicht, und
      // zu Recht: eine geratene Stufe wäre eine Rechteentscheidung, die niemand getroffen hat.
      //
      // `intern` UND NICHT `vertraulich`: Diese Abnahme misst, dass zwei SICHTBARE Einträge
      // verknüpft werden und die Beziehung von beiden Seiten gelesen werden kann (G1/G7). Eine
      // vertrauliche Einstufung machte den Gegenendpunkt für einen Teil der Betrachter unsichtbar
      // — dann prüfte dieser Fall die Sichtbarkeitsnaht statt des Verknüpfungswegs, und rot wäre
      // er aus dem falschen Grund. Dass eine Kante zu einem UNSICHTBAREN Gegenstück nicht
      // erscheint und nicht gezählt wird, steht an seiner eigenen Stelle
      // (`tests/wissensgraph-abnahme/netz-verknuepfungszahlen.test.ts` L3 und
      // `graph-kuratierte-kanten-am-draht.test.ts`).
      confidentiality: "intern",
    },
  });
  expect(
    antwort.ok(),
    `Anlegen von „${title}" scheiterte: ${antwort.status()} ${await antwort.text()}`,
  ).toBe(true);
  const ko = (await antwort.json()) as AngelegtesKo;
  expect(typeof ko.id).toBe("string");
  return ko;
}

test.describe("JOB 4155 · WG-LUECKEN · gesetzte Beziehungen in der echten App", () => {
  test("G1: zwei Einträge verknüpfen — Art, Richtung und Herkunft stehen da, und die Bestätigung überlebt das Neuladen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const { a: TITEL_A, b: TITEL_B, thema } = frischeMarke();
    const a = await legeAn(page.request, TITEL_A, thema);
    await legeAn(page.request, TITEL_B, thema);

    await page.goto(`/wissen/${a.id}`);
    await expect(page.getByTestId("bib-lesen")).toBeVisible({ timeout: 15_000 });

    // ------------------------------------------------------------------------------------------
    // DIE KERNZUSAGE DIESES AUFTRAGS (Lieferung 5), im Browser: OHNE EINEN KLICK.
    // ------------------------------------------------------------------------------------------
    // Gemessen wird VOR jeder Interaktion und mit `toBeVisible` — also wirklich im Bild und nicht
    // nur im Baum. Dass die Zeile „Mehr" dabei zugeklappt ist, steht daneben: sonst könnte der
    // Bereich auch deshalb sichtbar sein, weil irgendetwas sie geöffnet hat.
    await expect(
      page.locator(BEREICH),
      "der Beziehungsbereich steht nicht in der Lesespalte",
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(MEHR)).toHaveAttribute("aria-expanded", "false");

    // Und er steht OBERHALB der Zeile „Mehr" — geometrisch, nicht nur in der Dokumentordnung.
    const bereichY = (await page.locator(BEREICH).boundingBox())?.y ?? Number.POSITIVE_INFINITY;
    const mehrY = (await page.locator(MEHR).boundingBox())?.y ?? 0;
    expect(bereichY, "die Zeile Mehr steht über dem Beziehungsbereich").toBeLessThan(mehrY);

    // ------------------------------------------------------------------------------------------
    // DER KLICKWEG — vollständig über die Oberfläche.
    // ------------------------------------------------------------------------------------------
    await page.getByTestId("wb-suche").fill(TITEL_B);
    const treffer = page.getByTestId("wb-treffer").filter({ hasText: TITEL_B }).first();
    await expect(treffer, "der zweite Eintrag ist über die Suche nicht erreichbar").toBeVisible({
      timeout: 15_000,
    });
    await treffer.click();

    await expect(page.getByTestId("wb-ziel")).toContainText(TITEL_B);
    await page.getByTestId("wb-art").selectOption("ergaenzt");
    await page.getByTestId("wb-richtung").selectOption("gerichtet");
    await page.getByTestId("wb-setzen-knopf").click();

    // Die Erfolgsmeldung des Produkts. Sie ist der ERSTE Beleg — nicht der einzige.
    await expect(page.getByTestId("wb-setzen-erfolg")).toBeVisible({ timeout: 15_000 });

    // ------------------------------------------------------------------------------------------
    // DIE DAUERHAFTE SPEICHERUNG: das Neuladen holt die Beziehung vom SERVER zurück.
    // ------------------------------------------------------------------------------------------
    // Ohne diesen Schritt bewiese der Fall nur, dass die Fläche etwas anzeigt, was sie selbst
    // geschrieben hat. Nach `reload()` ist jeder Zustand des Browsers weg; was jetzt dasteht,
    // kommt aus `GET /api/kos/:id/beziehungen`.
    await page.reload();
    await expect(page.locator(BEREICH)).toBeVisible({ timeout: 15_000 });
    const kante = page.getByTestId("wb-kante").first();
    await expect(kante, "die Beziehung hat das Neuladen nicht überlebt").toBeVisible({
      timeout: 15_000,
    });

    // ART, RICHTUNG UND HERKUNFT stehen an der Kante — alle drei, in Anwendersprache.
    await expect(kante).toContainText(TITEL_B);
    await expect(kante.getByTestId("wb-herkunft"), "das Herkunftsetikett fehlt").toBeVisible();
    const kantentext = (await kante.innerText()).toLowerCase();
    expect(kantentext, `Art oder Richtung fehlen an der Kante: ${kantentext}`).toContain("ergänzt");
  });

  test("G7: dieselbe Beziehung von beiden Seiten — und der Schlagwortgraph bleibt, was er war", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const { a: TITEL_A, b: TITEL_B, thema } = frischeMarke();
    const a = await legeAn(page.request, TITEL_A, thema);
    const b = await legeAn(page.request, TITEL_B, thema);

    // Die Beziehung entsteht hier über den DRAHT und nicht über die Oberfläche: dass der Klickweg
    // trägt, ist Gegenstand von G1 und wird dort vollständig geklickt. G7 fragt etwas anderes —
    // ob DIESELBE gespeicherte Beziehung von BEIDEN Flächen gleich gelesen wird.
    const gesetzt = await page.request.post(`/api/kos/${a.id}/beziehungen`, {
      data: {
        zielId: b.id,
        art: "ergaenzt",
        richtung: "gerichtet",
        beitragSchluessel: `g7-${thema}`,
        gesehen: { quelleVersion: a.version, zielVersion: b.version },
      },
    });
    expect(
      [200, 201],
      `Verknüpfen scheiterte: ${gesetzt.status()} ${await gesetzt.text()}`,
    ).toContain(gesetzt.status());

    // ------------------------------------------------------------------------------------------
    // SEITE 1 — DIE EINTRAGSANSICHT.
    // ------------------------------------------------------------------------------------------
    await page.goto(`/wissen/${a.id}`);
    await expect(page.locator(BEREICH)).toBeVisible({ timeout: 15_000 });
    const ausDetail = await page.getByTestId("wb-kante").first().innerText();
    expect(ausDetail, "die Beziehung steht in der Eintragsansicht nicht").toContain(TITEL_B);

    // ------------------------------------------------------------------------------------------
    // SEITE 2 — DAS WISSENSNETZ. Dieselbe Beziehung, dieselbe Rechtenaht, andere Fläche.
    // ------------------------------------------------------------------------------------------
    await page.goto("/wissensnetz");
    await expect(page.getByTestId("netz-metrik")).toBeVisible({ timeout: 20_000 });

    // DER GRUNDSATZ steht da — „keine Kante" heisst nie „geprüft konfliktfrei". Das ist die
    // Ehrlichkeitsauflage des Vertrags, und sie muss im BILD stehen, nicht nur im Wörterbuch.
    await expect(page.getByTestId("netz-verknuepfung-grundsatz")).toBeVisible();

    // Die Zeile des gemeinsamen Themas trägt die Verknüpfungszahlen — sie sind ERHOBEN, also darf
    // dort keine Auslassung stehen.
    const themenzeile = page.locator(`[data-testid="metrik-thema"][data-thema="${thema}"]`);
    await expect(themenzeile, `das Thema ${thema} steht nicht im Wissensnetz`).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("netz-verknuepfung-ausgelassen")).toHaveCount(0);
    const zahlen = themenzeile.getByTestId("metrik-thema-verknuepfung");
    await expect(
      zahlen,
      "die Verknüpfungszahlen fehlen — der Kantenport kommt nicht an",
    ).toBeVisible();
    // BEIDE Einträge des Themas sind verknüpft: die Kante gehört beiden Enden.
    await expect(zahlen).toContainText("2");

    // ------------------------------------------------------------------------------------------
    // DER BESTEHENDE SCHLAGWORTGRAPH IST UNBERÜHRT.
    // ------------------------------------------------------------------------------------------
    // Die gesetzte Beziehung ist eine ZWEITE Menge und keine Ergänzung der abgeleiteten Kanten. Am
    // Wissensnetz heisst das: das gemeinsame Schlagwort erzeugt weiterhin seine eigene Auskunft,
    // und die Zahl der sichtbaren Objekte des Themas ist von der Beziehung unberührt.
    await expect(themenzeile.getByTestId("metrik-thema-objekte")).toContainText("2");
  });
});
