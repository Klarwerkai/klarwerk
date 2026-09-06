// @vitest-environment jsdom
// ================================================================================================
// JOB 3116 · R5 — DIE PRUEFLISTE SAGT, WORAUF DER WIEDERIMPORT GETROFFEN IST. MIT KENNUNG.
// ================================================================================================
//
// Das letzte Glied der Nutzenkette, und genau das Glied, das JOB 3081 ausdruecklich offen gelassen
// hat (`archiv/3081/runde-2/RUECKGABE.md`, Restpunkt). Bis hierher stand an einem Kandidaten des
// Anker-Strangs
//   · „Dublette" — im Anker-Strang heisst dieses Wort laut `types.ts` NUR „dasselbe Quellobjekt
//     zweimal in DIESEM Lauf", und die Kennung des getrashten Objekts sah niemand;
//   · „KO erzeugt" — obwohl der Re-Sync in ein BESTEHENDES Objekt zurueckfliesst und nichts
//     erzeugt wurde.
//
// GEMESSEN WIRD AM ECHTEN WEG: die Kandidaten entstehen ueber die ECHTE Route (dieselben zwei
// Faelle wie R4), die ECHTE Seite `ImportReview` wird gemountet, gelesen wird `textContent`. Die
// Kennung im sichtbaren Text ist DIESELBE, die die Route ausgewiesen hat — nicht irgendeine.
//
// ABLOESUNG, nicht Zusatz (Pruefpunkt 7): „Dublette" und „KO erzeugt" duerfen fuer diese beiden
// Faelle NICHT mehr danebenstehen. Zwei Woerter fuer einen Sachverhalt waeren eines zu viel, und
// eines davon waere falsch.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import type { ImportItem } from "../../services/library-analytics";
import {
  type FlaechenBruecke,
  type Gemountet,
  flaechenBruecke,
  mounteImportReview,
} from "./flaeche-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Vier Kandidaten stehen am Ende in der Liste: zwei Erstimporte (die den Bestand angelegt haben)
// und zwei Wiederimporte DESSELBEN Ankers. Die Titel sind verschieden, damit jede Zusicherung an
// GENAU einer Karte haengt — die Kennung des Ankers (provider + externalId) haelt die Paare
// zusammen, nicht der Titel.
const AKTIV: ImportItem = {
  title: "Erstimport Anlage 3",
  statement: "Den Filter der Anlage 3 jaehrlich wechseln",
  type: "best_practice",
  category: "Wartung",
  provider: "test",
  externalId: "q2c-flaeche-aktiv",
  sourceVersion: 1,
};
const WIEDER_AKTIV: ImportItem = { ...AKTIV, title: "Wiederimport Anlage 3", sourceVersion: 2 };
const GETRASHT: ImportItem = {
  ...AKTIV,
  title: "Erstimport Anlage 7",
  statement: "Die Pumpe der Anlage 7 monatlich pruefen",
  externalId: "q2c-flaeche-papierkorb",
};
const WIEDER_GETRASHT: ImportItem = {
  ...GETRASHT,
  title: "Wiederimport Anlage 7",
  sourceVersion: 2,
};

let b: FlaechenBruecke;
let m: Gemountet | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await flaechenBruecke();
});

afterEach(() => {
  m?.abbauen();
  m = null;
  b.abbauen();
});

/** Die zwei Faelle auf dem Produktweg: Anker aktiv (Re-Sync) und Anker im Papierkorb. */
async function zweiFaelle(): Promise<{ aktiveKennung: string; getrashteKennung: string }> {
  const reiheEin = async (item: ImportItem) => {
    const res = await b.app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers: b.kopf,
      payload: { items: [item] },
    });
    expect(res.statusCode, res.body).toBe(201);
    return (res.json() as { id: string }[])[0]?.id as string;
  };
  const accept = async (id: string) => {
    const res = await b.app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${id}`,
      headers: b.kopf,
      payload: { action: "accept" },
    });
    expect(res.statusCode, res.body).toBe(200);
    return (res.json() as { koId: string | null }).koId as string;
  };

  const aktiveKennung = await accept(await reiheEin(AKTIV));
  await reiheEin(WIEDER_AKTIV);

  const getrashteKennung = await accept(await reiheEin(GETRASHT));
  const geloescht = await b.app.inject({
    method: "DELETE",
    url: `/api/kos/${getrashteKennung}`,
    headers: b.kopf,
  });
  expect(geloescht.statusCode, geloescht.body).toBe(204);
  await reiheEin(WIEDER_GETRASHT);

  return { aktiveKennung, getrashteKennung };
}

describe("JOB 3116 · R5 — die gemountete Pruefliste nennt Zustand und Kennung", () => {
  it("R5a · DE: der Papierkorb-Fall nennt Zustand und Kennung, der Re-Sync-Fall die Wiederverwendung", async () => {
    const { aktiveKennung, getrashteKennung } = await zweiFaelle();
    m = await mounteImportReview();

    expect(
      m.karte("Wiederimport Anlage 7"),
      "Der Papierkorb-Fall nennt den Zustand UND die Kennung des getrashten Objekts — und das schwaechere Dubletten-Abzeichen steht nicht mehr daneben.",
    ).toEqual(["Zur Prüfung vorgemerkt", `liegt im Papierkorb, Kennung ${getrashteKennung}`]);
    expect(
      m.karte("Wiederimport Anlage 3"),
      "Der Wiederimport auf einen aktiven Anker sagt, dass er zurueckfliesst — und wohin.",
    ).toEqual(["Zur Prüfung vorgemerkt", `vorhanden, Kennung ${aktiveKennung} wiederverwendet`]);
    expect(
      m.karte("Erstimport Anlage 3"),
      "GEGENRICHTUNG: der Kandidat, der wirklich ein Objekt erzeugt hat, traegt weiterhin sein Abzeichen.",
    ).toEqual(["Angenommen", "KO erzeugt"]);
    expect(m.text, "Kein roher i18n-Schluessel an der Flaeche.").not.toContain("ext.finding.");
  });

  it("R5b · EN: derselbe Satz in der zweiten Sprache, dieselben Kennungen", async () => {
    const { aktiveKennung, getrashteKennung } = await zweiFaelle();
    await i18n.changeLanguage("en");
    m = await mounteImportReview();

    expect(m.karte("Wiederimport Anlage 7")).toEqual([
      "Marked for review",
      `in the trash, ID ${getrashteKennung}`,
    ]);
    expect(m.karte("Wiederimport Anlage 3")).toEqual([
      "Marked for review",
      `existing, ID ${aktiveKennung} reused`,
    ]);
    expect(m.text).not.toContain("ext.finding.");
  });

  // ================================================================================================
  // R5d — DER GEMESSENE FALL SELBST: NACH dem Annehmen stand hier „KO erzeugt".
  // ================================================================================================
  //
  // Das ist der Zustand aus Codex' Befund: der Reviewer hat entschieden, der Kandidat steht auf
  // „angenommen" MIT gesetzter `koId` — der Kennung des BESTEHENDEN Objekts (Re-Sync/Upsert). Bis
  // JOB 3116 machte `candidateFindings` daraus `acceptedKo` und die Karte behauptete eine Anlage,
  // die nie stattfand. Ohne diesen Fall haenge die Abloesung an einem Kandidaten im Status „neu",
  // an dem „KO erzeugt" ohnehin nie gestanden haette — die Zusicherung waere leer.
  it("R5d · derselbe Kandidat NACH dem Annehmen: die Wiederverwendung steht da, das Erzeugt-Abzeichen nicht", async () => {
    const { aktiveKennung } = await zweiFaelle();
    const liste = await b.app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: b.kopf,
    });
    const wiederimport = (liste.json() as { id: string; item: { title: string } }[]).find(
      (k) => k.item.title === WIEDER_AKTIV.title,
    );
    const beschieden = await b.app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${wiederimport?.id}`,
      headers: b.kopf,
      payload: { action: "accept" },
    });
    expect(beschieden.statusCode, beschieden.body).toBe(200);
    expect(
      (beschieden.json() as { koId: string | null }).koId,
      "Vorbedingung: der Accept hat wirklich die BESTEHENDE Kennung zurueckgegeben.",
    ).toBe(aktiveKennung);

    m = await mounteImportReview();

    expect(
      m.karte(WIEDER_AKTIV.title),
      "Erzeugt wurde nichts — der Inhalt ist in ein vorhandenes Objekt zurueckgeflossen, und genau das steht da.",
    ).toEqual(["Angenommen", `vorhanden, Kennung ${aktiveKennung} wiederverwendet`]);
  });

  it("R5c · die genannte Kennung ist DIESELBE, die die Route ausweist — nicht irgendeine", async () => {
    const { aktiveKennung, getrashteKennung } = await zweiFaelle();
    const liste = await b.app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: b.kopf,
    });
    const kandidaten = liste.json() as {
      dublettenbefund?: { ergebnis: string; treffer?: { koId: string } };
    }[];
    const amDraht = (ergebnis: string) =>
      kandidaten.find((k) => k.dublettenbefund?.ergebnis === ergebnis)?.dublettenbefund?.treffer
        ?.koId;

    expect(amDraht("im_papierkorb")).toBe(getrashteKennung);
    expect(amDraht("wiederverwendet")).toBe(aktiveKennung);

    m = await mounteImportReview();
    expect(m.text).toContain(getrashteKennung);
    expect(m.text).toContain(aktiveKennung);
  });
});
