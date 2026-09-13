// @vitest-environment jsdom
// ================================================================================================
// JOB 3834 · DER „NÄCHSTE SCHRITT“ DER IMPORT-SEITENHILFE LIEGT IN EINEM ZUGEKLAPPTEN KASTEN.
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI FESTNAGELT (Codex, GRÜN-Urteil zu JOB 3742, `archiv/3742/runde-2/
// ben.md:33`: „Neufund an unverändertem Code“): Die Seitenhilfe von `/import` gibt einen klaren
// Marschbefehl — „Nächster Schritt: einen Vorschlag lesen und ihn annehmen, ablehnen oder eine
// Rückfrage stellen.“ Die Prüfliste, in der diese Vorschläge liegen, ist aber *children* einer
// standardmäßig EINGEKLAPPTEN Sektion (`Stufe2.tsx:961` → `ImportHistory.tsx:25`, bewusst ohne
// `open`), und der Hinweistext IN genau diesem Kasten (`imp.history.hint`) sagt dem Neuling
// ausdrücklich, er brauche diesen Bereich nicht.
//
// WAS GEMESSEN IST
//   W1  Die gemountete Seite MELDET ihre Seitenhilfe wirklich an — am echten Sammler
//       (`shell/SeitenhilfeContext.tsx`), verglichen mit den Werten AM SCHLÜSSEL.
//   W2  Die Datengrundlage: zwei offene Kandidaten werden nach dem Aufklappen wirklich als Karten
//       gezeichnet, und JEDE EINZELNE Karte trägt „Annehmen“ UND „Ablehnen“ — kartenbezogen
//       gemessen, nicht als seitenweite Anzahl (Korrekturpflicht 1 aus Runde 1: zwei Annehmen an
//       Karte A und zwei Ablehnen an Karte B ergäben dieselben Summen und keinen entscheidbaren
//       Vorschlag). Erst belegen, dann bewerten (Lehre 3825 R1).
//       Dazu zwei Kalibrierungen: leerer Bestand und GESCHEITERTER Abruf zeichnen keine Karte.
//   W3  DER MANGEL: frisch gemountet trägt `details#import-review-queue` kein `open`, und alle
//       Kandidatenkarten sind Nachfahren genau dieses geschlossenen Kastens.
//   W4a DER WIDERSPRUCH am Wörterbuch, in DE/EN/NL, am Schlüssel gelesen (ohne Rückfall auf „de“).
//   W4b DERSELBE Widerspruch an der gemounteten Seite, über HERKUNFTSPROBEN: ein verstellter
//       Wörterbuchwert muss an der gemessenen Stelle wieder auftauchen. Damit hängt die Aussage am
//       SCHLÜSSEL und nicht am Wortlaut (Lehre 3798 R1; Literalbefund aus JOB 3832: gleiche Wörter
//       können aus verschiedenen Schlüsseln stammen).
//   W5  Der Nachführ-Pin selbst: die Meldung, die W3 und W4 ausgeben, nennt Route, beide Schlüssel,
//       den Kasten und BEIDE Wege der Reparatur.
//
// WAS AUSDRÜCKLICH NICHT GEMESSEN IST
//   Kein Browser, kein Layout — deshalb steht in W3 die DOM-VERWANDTSCHAFT (`details.contains`) und
//   nirgends eine Aussage über „sichtbar“; jsdom kennt keine Darstellung, eine
//   Sichtbarkeitsbehauptung wäre hier unbelegt. Kein echtes HTTP, keine echte Persistenz. EN und NL
//   werden NUR am Wörterbuch gemessen, nicht an einer gemounteten Seite. Cache, laufende oder
//   gescheiterte Auffrischung und Offline sind nicht gemessen: die Bühne setzt den Bestand direkt
//   und fährt keinen zweiten Abruf. Fensterbreiten sind nicht gemessen.
//
// DIESE DATEI REPARIERT NICHTS. Sie hält den HEUTIGEN Zustand fest, und ihre Verneinungen in W3 und
// W4 sind bei seiner Behebung UMZUDREHEN (Muster 3801/3810/3811/3832). Umdrehen heisst hier genau
// das, was die Fehlermeldungen wörtlich ansagen: W3/W4 in ihrer heutigen, verneinenden Fassung
// löschen und an ihre Stelle den Beleg des neuen, zutreffenden Wortlauts setzen — nicht ersatzlos
// streichen und nicht aufweichen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die Attrappe liegt in `bestand.ts` — sie kennt kein Produkt und lädt deshalb auch aus dieser
// Fabrik heraus gefahrlos (siehe Dateikopf dort).
vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { endpointsAttrappe } = await import("./bestand");
  return { endpoints: endpointsAttrappe() };
});

import { isOpenImportCandidate } from "../../apps/web/src/lib/importCandidateStatus";
import {
  TITEL_A,
  TITEL_B,
  lesBestand,
  setzeAbrufFehler,
  setzeBestand,
  zweiOffeneKandidaten,
} from "./bestand";
import {
  KASTEN_WAHL,
  ROUTE,
  SPRACHEN,
  abbauen,
  behaelter,
  gestrafft,
  hilfeAnmeldungen,
  kandidatenkarten,
  kandidatentitel,
  karteVonTitel,
  kasten,
  knopfbeschriftungen,
  knopfbeschriftungenIn,
  montiereImport,
  oeffneKasten,
  setzeSprache,
  verstelleWert,
  wert,
} from "./buehne";

// ------------------------------------------------------------------------------------------------
// Die vier Schlüssel, um die es geht — einmal benannt, nirgends abgetippt.
// ------------------------------------------------------------------------------------------------
const TITEL_SCHLUESSEL = "seitenhilfe.import.titel";
const TEXT_SCHLUESSEL = "seitenhilfe.import.text";
const HINWEIS_SCHLUESSEL = "imp.history.hint";
const ABSCHNITT_SCHLUESSEL = "imp.history.title";

const ANMELDESTELLE = "apps/web/src/pages/Stufe2.tsx:927 (HelpTip der Import-Seite)";
const KASTENSTELLE = "apps/web/src/components/ImportHistory.tsx:25 (details ohne open)";
const PRUEFLISTENSTELLE = "apps/web/src/pages/Stufe2.tsx:961 (Prüfliste als children der Sektion)";

// ------------------------------------------------------------------------------------------------
// DER NACHFÜHR-PIN (Lieferung 7, Muster JOB 3804 DU4b) — W5 prüft ihn.
// ------------------------------------------------------------------------------------------------
const NACHFUEHRUNG = [
  "NACHFÜHRUNG: Wird diese Zeile rot, ist der Mangel behoben.",
  `Jetzt W3/W4 löschen und die Seitenhilfe von ${ROUTE} gegen ihren neuen, zutreffenden Wortlaut belegen.`,
  `Es hängen zusammen: Route ${ROUTE} · Schlüssel ${TEXT_SCHLUESSEL} (angemeldet in ${ANMELDESTELLE})`,
  `· Schlüssel ${HINWEIS_SCHLUESSEL} · Kasten ${KASTEN_WAHL} (${KASTENSTELLE}) · ${PRUEFLISTENSTELLE}.`,
  "Zwei Wege der Reparatur, beide zulässig: den Satz nachführen, sodass er den nötigen Klick nennt,",
  "ODER den Kasten aufklappen, sodass der Satz nichts Falsches mehr verspricht.",
  "Welcher Weg gilt, ist eine Entscheidung über das Produkt und gehört nicht in diesen Test.",
].join(" ");

/** Jede Meldung von W3/W4 nennt den Befund, die Stelle und die ausgeschriebene Nachführung. */
function meldung(befund: string, stelle: string): string {
  return `${befund}\nSichtbar geworden an: ${stelle}\n${NACHFUEHRUNG}`;
}

/** Der Kasten oder ein rotes Ergebnis mit ausgeschriebener Nachführung — nie ein stilles `null`. */
function kastenOderRot(): HTMLDetailsElement {
  const k = kasten();
  if (k === null) {
    throw new Error(
      meldung(
        `Auf der gemounteten Seite ${ROUTE} gibt es ${KASTEN_WAHL} nicht mehr. Gezeichnet wurde: ` +
          `${gestrafft(behaelter()).slice(0, 400)}`,
        KASTENSTELLE,
      ),
    );
  }
  return k;
}

/** Was die Seite und der Server gerade tragen — für die Diagnose, nicht als Sollwert (Lehre 3826). */
function diagnose(): string {
  return (
    `Server-Bestand: ${JSON.stringify(lesBestand().map((k) => ({ id: k.id, status: k.status })))} · ` +
    `gezeichnet im Kasten: „${gestrafft(kasten()).slice(0, 300)}“`
  );
}

beforeEach(async () => {
  await setzeSprache("de");
  setzeBestand(zweiOffeneKandidaten());
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

// ================================================================================================
// W1 · DIE SEITE MELDET IHRE SEITENHILFE AN — gemessen am echten Sammler der gemounteten Seite.
// ================================================================================================
describe("JOB 3834 W1 · die Seitenhilfe von /import ist wirklich angemeldet", () => {
  it("W1: die Anmeldung trägt genau die Werte der beiden Schlüssel", async () => {
    const titel = wert("de", TITEL_SCHLUESSEL);
    const text = wert("de", TEXT_SCHLUESSEL);
    expect(titel.length, `${TITEL_SCHLUESSEL} hat im Wörterbuch keinen Wert`).toBeGreaterThan(0);
    expect(text.length, `${TEXT_SCHLUESSEL} hat im Wörterbuch keinen Wert`).toBeGreaterThan(0);

    await montiereImport();
    const angemeldet = hilfeAnmeldungen();
    const treffer = angemeldet.filter((a) => a.titel === titel && a.text === text);
    expect(
      treffer.length,
      `Die Seite ${ROUTE} meldet ihre Seitenhilfe nicht (mehr) an. Erwartet war das Paar ` +
        `${TITEL_SCHLUESSEL} + ${TEXT_SCHLUESSEL}; die gemountete Seite hat ${angemeldet.length} ` +
        `Anmeldung(en) beim echten Sammler abgegeben: ${JSON.stringify(angemeldet)}. ` +
        `Zu prüfen ist ${ANMELDESTELLE}.`,
    ).toBe(1);
  });
});

// ================================================================================================
// W2 · ERST DIE DATENGRUNDLAGE, DANN JEDE BEWERTUNG (Lehre 3825 R1, Korrekturpflicht 1).
// ================================================================================================
describe("JOB 3834 W2 · die Prüfliste zeichnet wirklich zwei entscheidbare Vorschläge", () => {
  it("W2: aufgeklappt stehen zwei Karten da, jede mit „Annehmen“ und „Ablehnen“", async () => {
    const kandidaten = zweiOffeneKandidaten();
    for (const k of kandidaten) {
      expect(
        isOpenImportCandidate(k.status),
        `der Probe-Kandidat ${k.id} zählt mit Status „${k.status}“ nicht als OFFEN — dann trägt er auch keine Entscheidungsknöpfe und W2 misst nichts`,
      ).toBe(true);
    }
    setzeBestand(kandidaten);
    await montiereImport();
    await oeffneKasten();

    expect(
      kandidatentitel(),
      `Die aufgeklappte Prüfliste zeichnet die beiden offenen Vorschläge nicht. ${diagnose()}`,
    ).toEqual([TITEL_A, TITEL_B]);

    // JEDE KARTE EINZELN (Korrekturpflicht 1 aus Runde 1): eine seitenweite Anzahl von zweimal
    // „Annehmen“ und zweimal „Ablehnen“ ist auch dann erfüllt, wenn Karte A zwei Annehmen-Knöpfe
    // trägt und Karte B zwei Ablehnen-Knöpfe — dann ist kein einziger Vorschlag entscheidbar. Die
    // Karte wird über die DOM-Verwandtschaft abgegrenzt (`karteVonTitel`), der Kandidat über die
    // Kennung aus dem gesetzten Bestand benannt.
    const seitenweit = knopfbeschriftungen();
    for (const k of kandidaten) {
      const karte = karteVonTitel(k.item.title);
      const knoepfeDerKarte = knopfbeschriftungenIn(karte);
      for (const key of ["imp.accept", "imp.reject"]) {
        const beschriftung = wert("de", key);
        expect(beschriftung.length, `${key} hat im Wörterbuch keinen Wert`).toBeGreaterThan(0);
        expect(
          knoepfeDerKarte.filter((b) => b === beschriftung).length,
          `Kandidat ${k.id} („${k.item.title}“): „${beschriftung}“ (${key}) steht nicht genau ` +
            `einmal in SEINER eigenen Karte. Knöpfe dieser Karte: ${JSON.stringify(knoepfeDerKarte)}. ` +
            `Seitenweit gezeichnet: ${JSON.stringify(seitenweit)} — eine seitenweite Anzahl genügt ` +
            `nicht, entscheidbar ist ein Vorschlag nur an seiner eigenen Karte. ${diagnose()}`,
        ).toBe(1);
      }
    }

    // Und kein Entscheidungsknopf ausserhalb der beiden Karten: seitenweit genau je zwei.
    for (const key of ["imp.accept", "imp.reject"]) {
      const beschriftung = wert("de", key);
      expect(
        seitenweit.filter((b) => b === beschriftung).length,
        `„${beschriftung}“ (${key}) steht seitenweit nicht genau zweimal — dann sitzt ein ` +
          `Entscheidungsknopf ausserhalb der beiden Karten. Gezeichnete Knöpfe: ${JSON.stringify(seitenweit)}`,
      ).toBe(2);
    }
  });

  it("W2-KALIBRIERUNG leer: ohne Bestand zeichnet dieselbe Seite KEINE Karte", async () => {
    // Ohne diesen Fall könnte W3 grün sein, weil gar nichts geladen wurde.
    setzeBestand([]);
    await montiereImport();
    await oeffneKasten();
    expect(kandidatentitel(), `ohne Bestand zeichnet die Seite Karten. ${diagnose()}`).toEqual([]);
    expect(
      gestrafft(kastenOderRot()),
      "der leere Bestand wird nicht als leer benannt — dann sagt die Fläche über den Abruf nichts",
    ).toContain(wert("de", "imp.queueEmpty"));
  });

  it("W2-KALIBRIERUNG Fehler: ein GESCHEITERTER Abruf ist keine leere Trefferliste", async () => {
    // Lehre 3825 R1: ein Fehlerobjekt darf nie als „nichts offen“ durchgehen. Die Seite muss den
    // Fehler benennen; eine Aussage über die Karten ist in diesem Zustand nicht zu haben.
    setzeBestand(zweiOffeneKandidaten());
    setzeAbrufFehler("JOB 3834 Probe: der Abruf der Prüfliste scheitert");
    await montiereImport();
    await oeffneKasten();
    expect(
      kandidatentitel(),
      `nach einem gescheiterten Abruf zeichnet die Seite Karten. ${diagnose()}`,
    ).toEqual([]);
    expect(
      gestrafft(kastenOderRot()),
      `der gescheiterte Abruf wird nicht als Fehler benannt. ${diagnose()}`,
    ).toContain(wert("de", "state.error"));
  });
});

// ================================================================================================
// W3 · DER MANGEL, FESTGENAGELT: der versprochene nächste Schritt liegt im zugeklappten Kasten.
// ================================================================================================
describe("JOB 3834 W3 · der „nächste Schritt“ ist ohne einen zusätzlichen Klick nicht erreichbar", () => {
  it("W3: frisch gemountet ist der Kasten ZU — und die Prüfliste liegt darin", async () => {
    setzeBestand(zweiOffeneKandidaten());
    await montiereImport();
    const k = kastenOderRot();

    expect(
      k.hasAttribute("open"),
      meldung(
        `${KASTEN_WAHL} steht auf ${ROUTE} jetzt OFFEN. Damit ist der „nächste Schritt“ aus ` +
          `${TEXT_SCHLUESSEL} ohne zusätzlichen Klick erreichbar.`,
        KASTENSTELLE,
      ),
    ).toBe(false);

    // Die Datengrundlage, im Fall selbst belegt (W2 messt sie eigens): ohne Karten sagt die
    // Verwandtschaft unten nichts.
    const karten = kandidatenkarten();
    expect(
      karten.length,
      `W3 hat keine Datengrundlage: die Seite zeichnet keine zwei Kandidatenkarten. ${diagnose()}`,
    ).toBe(2);

    for (const karte of karten) {
      expect(
        k.contains(karte),
        meldung(
          `Die Kandidatenkarte „${gestrafft(karte)}“ liegt NICHT mehr im zugeklappten Abschnitt ${KASTEN_WAHL}. Gemessen ist die DOM-Verwandtschaft, nicht die Sichtbarkeit: jsdom kennt kein Layout.`,
          PRUEFLISTENSTELLE,
        ),
      ).toBe(true);
    }
  });
});

// ================================================================================================
// W4a · DER WIDERSPRUCH AM WÖRTERBUCH — DE/EN/NL, jeder Wert AM SCHLÜSSEL und ohne Rückfall.
// ================================================================================================
/** Der Verweis auf die Prüfliste, je Sprache das eine Wort, das ihn trägt. */
const PRUEFLISTENWORT: Readonly<Record<string, string>> = {
  de: "Prüfliste",
  en: "review list",
  nl: "controlelijst",
};
/** Der Marschbefehl („Nächster Schritt: …“). */
const SCHRITTWORT: Readonly<Record<string, string>> = {
  de: "Nächster Schritt:",
  en: "Next step:",
  nl: "Volgende stap:",
};
/** Die Abwahl des Bereichs im Hinweistext DESSELBEN Kastens. */
const ABWAHLWORT: Readonly<Record<string, string>> = {
  de: "brauchst du diesen Bereich nicht",
  en: "do not need this area",
  nl: "heb je dit gedeelte niet nodig",
};
/** Wörter, mit denen der Satz den nötigen Klick nennen WÜRDE — heute nennt er ihn nicht. */
const AUFKLAPPWORT: Readonly<Record<string, readonly string[]>> = {
  de: ["aufklapp", "ausklapp", "aufgeklappt"],
  en: ["expand", "unfold", "open the"],
  nl: ["uitklapp", "openklapp", "openvouw"],
};

describe("JOB 3834 W4a · zwei hinterlegte Sätze, die sich widersprechen (DE/EN/NL)", () => {
  for (const lng of SPRACHEN) {
    it(`W4a/${lng}: die Seitenhilfe schickt in den Kasten, dessen eigener Hinweis ihn abwählt`, () => {
      const hilfe = wert(lng, TEXT_SCHLUESSEL);
      const hinweis = wert(lng, HINWEIS_SCHLUESSEL);
      const abschnitt = (wert(lng, ABSCHNITT_SCHLUESSEL).split(":")[0] ?? "").trim();
      expect(
        hilfe.length,
        `${lng}: ${TEXT_SCHLUESSEL} fehlt in der eigenen Ressource`,
      ).toBeGreaterThan(0);
      expect(
        hinweis.length,
        `${lng}: ${HINWEIS_SCHLUESSEL} fehlt in der eigenen Ressource`,
      ).toBeGreaterThan(0);
      expect(
        abschnitt.length,
        `${lng}: ${ABSCHNITT_SCHLUESSEL} trägt keinen Abschnittsnamen`,
      ).toBeGreaterThan(0);

      // 1. Die eine Seite des Widerspruchs: der Satz verweist auf die Prüfliste und befiehlt weiter.
      expect(
        hilfe,
        meldung(
          `${lng}: ${TEXT_SCHLUESSEL} nennt die Prüfliste („${PRUEFLISTENWORT[lng]}“) nicht mehr.`,
          `Wörterbuch, Schlüssel ${TEXT_SCHLUESSEL}`,
        ),
      ).toContain(PRUEFLISTENWORT[lng]);
      expect(
        hilfe,
        meldung(
          `${lng}: ${TEXT_SCHLUESSEL} trägt den Marschbefehl („${SCHRITTWORT[lng]}“) nicht mehr.`,
          `Wörterbuch, Schlüssel ${TEXT_SCHLUESSEL}`,
        ),
      ).toContain(SCHRITTWORT[lng]);

      // 2. Die andere Seite: der Hinweis IM selben Kasten wählt den Bereich ab.
      expect(
        hinweis,
        meldung(
          `${lng}: ${HINWEIS_SCHLUESSEL} wählt den Bereich nicht mehr ab ` +
            `(„${ABWAHLWORT[lng]}“) — der Widerspruch könnte behoben sein.`,
          `Wörterbuch, Schlüssel ${HINWEIS_SCHLUESSEL}`,
        ),
      ).toContain(ABWAHLWORT[lng]);

      // 3. UND DER MANGEL: der Satz sagt kein Wort über den Kasten und über den nötigen Klick.
      //    Diese beiden Verneinungen sind bei der Reparatur UMZUDREHEN.
      expect(
        hilfe,
        meldung(
          `${lng}: ${TEXT_SCHLUESSEL} nennt jetzt den Abschnitt „${abschnitt}“ — der Satz führt den Leser also zum Kasten, statt ihn im Dunkeln zu lassen.`,
          `Wörterbuch, Schlüssel ${TEXT_SCHLUESSEL} gegen ${ABSCHNITT_SCHLUESSEL}`,
        ),
      ).not.toContain(abschnitt);
      for (const w of AUFKLAPPWORT[lng] ?? []) {
        expect(
          hilfe.toLowerCase(),
          meldung(
            `${lng}: ${TEXT_SCHLUESSEL} nennt jetzt den nötigen Klick („${w}“).`,
            `Wörterbuch, Schlüssel ${TEXT_SCHLUESSEL}`,
          ),
        ).not.toContain(w);
      }
    });
  }
});

// ================================================================================================
// W4b · DERSELBE WIDERSPRUCH AN DER GEMOUNTETEN SEITE — über Herkunftsproben, nicht über Wörter.
// ================================================================================================
//
// WARUM HERKUNFTSPROBEN: zwei Schlüssel können zeichengleichen Text tragen (Literalbefund JOB
// 3832). Wer den gezeichneten WORTLAUT sucht, findet ihn dann auch dort, wo ein anderer Schlüssel
// spricht. Gemessen wird deshalb umgekehrt: der Wert des Schlüssels wird verstellt, und die
// verstellte Marke MUSS an der behaupteten Stelle wieder auftauchen.
const MARKE_HILFE = "JOB3834-HERKUNFT-SEITENHILFE";
const MARKE_HINWEIS = "JOB3834-HERKUNFT-ABSCHNITTSHINWEIS";
// Gegenprobe (e) greift genau hier an: wird dieser Schlüssel auf einen zeichengleichen, aber nicht
// gezeichneten Zwilling umgebogen, muss W4b rot werden.
const HERKUNFT_HINWEIS_SCHLUESSEL = HINWEIS_SCHLUESSEL;

describe("JOB 3834 W4b · Prüfliste und abwählender Hinweis liegen im SELBEN zugeklappten Kasten", () => {
  it("W4b: beide Texte stammen von ihren Schlüsseln, und beide Enden treffen sich im Kasten", async () => {
    const zurueckHilfe = verstelleWert("de", TEXT_SCHLUESSEL, MARKE_HILFE);
    const zurueckHinweis = verstelleWert("de", HERKUNFT_HINWEIS_SCHLUESSEL, MARKE_HINWEIS);
    try {
      setzeBestand(zweiOffeneKandidaten());
      await montiereImport();
      const k = kastenOderRot();

      // 1. Der Marschbefehl kommt aus GENAU diesem Schlüssel und wird von der Seite angemeldet.
      const angemeldet = hilfeAnmeldungen();
      expect(
        angemeldet.filter((a) => a.text === MARKE_HILFE).length,
        meldung(
          `Die Seitenhilfe von ${ROUTE} speist sich nicht (mehr) aus ${TEXT_SCHLUESSEL}: der ` +
            `verstellte Wert tauchte in keiner Anmeldung auf. Angemeldet war ${JSON.stringify(angemeldet)}.`,
          ANMELDESTELLE,
        ),
      ).toBe(1);

      // 2. Der abwählende Hinweis kommt aus GENAU diesem Schlüssel — und steht NUR im Kasten.
      const traeger = [...behaelter().querySelectorAll("*")].filter(
        (e) => e.children.length === 0 && (e.textContent ?? "").includes(MARKE_HINWEIS),
      );
      expect(
        traeger.length,
        meldung(
          `Der Abschnittshinweis wird nicht (mehr) aus ${HERKUNFT_HINWEIS_SCHLUESSEL} gezeichnet: der verstellte Wert steht nirgends auf der Seite.`,
          "apps/web/src/components/ImportHistory.tsx:39",
        ),
      ).toBeGreaterThan(0);
      for (const t of traeger) {
        expect(
          k.contains(t),
          meldung(
            `Der Text aus ${HERKUNFT_HINWEIS_SCHLUESSEL} steht außerhalb von ${KASTEN_WAHL} — dann wählt er nicht mehr den Bereich ab, in dem die Prüfliste liegt.`,
            "apps/web/src/components/ImportHistory.tsx:39",
          ),
        ).toBe(true);
      }

      // 3. Und die Prüfliste liegt im selben Kasten wie dieser Hinweis — das ist der Widerspruch.
      const karten = kandidatenkarten();
      expect(
        karten.length,
        `W4b hat keine Datengrundlage: die Seite zeichnet keine zwei Kandidatenkarten. ${diagnose()}`,
      ).toBe(2);
      for (const karte of karten) {
        expect(
          k.contains(karte),
          meldung(
            `Die Prüfliste liegt nicht mehr im selben Abschnitt wie der Text aus ${HERKUNFT_HINWEIS_SCHLUESSEL}; der Widerspruch der beiden Sätze trägt dann nicht mehr.`,
            PRUEFLISTENSTELLE,
          ),
        ).toBe(true);
      }
    } finally {
      zurueckHinweis();
      zurueckHilfe();
    }
  });
});

// ================================================================================================
// W5 · DER NACHFÜHR-PIN: die Meldung von W3/W4 sagt selbst, was bei Behebung zu tun ist.
// ================================================================================================
describe("JOB 3834 W5 · die Fehlermeldung schreibt ihre eigene Nachführung aus", () => {
  it("W5: sie nennt Route, beide Schlüssel, den Kasten und beide Wege der Reparatur", () => {
    const text = meldung("Probe-Befund", "Probe-Stelle");
    expect(text, "der Befund selbst fehlt in der Meldung").toContain("Probe-Befund");
    expect(text, "die Stelle fehlt in der Meldung").toContain("Probe-Stelle");
    for (const pflicht of [
      ROUTE,
      TEXT_SCHLUESSEL,
      HINWEIS_SCHLUESSEL,
      KASTEN_WAHL,
      ANMELDESTELLE,
      KASTENSTELLE,
      PRUEFLISTENSTELLE,
      "W3/W4 löschen",
      "den Satz nachführen",
      "den Kasten aufklappen",
    ]) {
      expect(text, `die Nachführung nennt „${pflicht}“ nicht`).toContain(pflicht);
    }
  });
});
