// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 2 (Logik) · `R-1` bis `R-5` — DAS REINE, DOM-FREIE ORTSMODUL.
// ==================================================================================================
//
// Gegenstand: `apps/web/src/lib/librarySpace.ts` aus PLAN PRO 378 §4.2. Bauform und Ort folgen
// `lib/facetRail.ts` — dort liegt dieselbe Logik für den Bereichsfilter, und der Bereichsfilter ist
// der PRÄZEDENZFALL dieses ganzen Vertrags: er läuft seit mega10 über EIGENE URL-Parameter neben
// der Facettenauswahl, begründet mit „ein Bereich ist kein Facettenwert“ (`Library.tsx:142-145`).
// Der Ort ist ebenso wenig ein Facettenwert und folgt derselben, im Haus schon abgenommenen Form.
//
// DIESE DATEI IST VOLLSTÄNDIG ROT und muss es sein: das Modul existiert im Arbeitsbaum nicht. Jeder
// Fall wird EINZELN rot mit dem fehlenden Pfad in der Meldung (s. `support/wissensraum-ort-vertrag`).
//
// DIE EXPORTNAMEN SIND MIT DIESER PRÜFFLÄCHE GESETZT — PLAN 378 §4.2 benennt Modul und Aufgabe,
// nicht die Bezeichner. Neun Exporte:
//   LIBRARY_SPACE_PARAM · LIBRARY_SPACE_MAX_DEPTH · NO_SPACE
//   spaceFromParams · writeSpaceToParams · serializeSpace
//   spacePath · koHomePath · spaceResultCount
import { describe, expect, it } from "vitest";

import {
  ORT_MAX_TIEFE,
  ORT_URL_PARAM,
  koOhneOrt,
  ladeOrtArtefakt,
  lueckenhafteKetten,
  ortExport,
  ortFunktion,
  sichtbareKette,
} from "./support/wissensraum-ort-vertrag";

/** Die im Bestand sichtbaren Raumkennungen — der Server liefert sie bereits security-getrimmt. */
const BEKANNTE_RAEUME = ["raum-1", "raum-2", "raum-3"] as const;

describe("PRO 381 · R-1 — der `raum`-Parameter überlebt Lesen → Schreiben → Lesen", () => {
  it("R-1 (a): ein BEKANNTER Wert kommt unverändert durch den ganzen Kreislauf", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const param = ortExport(modul, "LIBRARY_SPACE_PARAM", "librarySpace");
    const lesen = ortFunktion(modul, "spaceFromParams", "librarySpace");
    const schreiben = ortFunktion(modul, "writeSpaceToParams", "librarySpace");

    // Der Parametername ist Teil des geteilten Links und deshalb Vertrag, keine Implementierung.
    expect(param).toBe(ORT_URL_PARAM);

    const gelesen = lesen(new URLSearchParams(`${ORT_URL_PARAM}=raum-2`), BEKANNTE_RAEUME);
    expect(gelesen).toBe("raum-2");

    const geschrieben = schreiben(new URLSearchParams(), gelesen) as URLSearchParams;
    expect(geschrieben.get(ORT_URL_PARAM)).toBe("raum-2");
    expect(lesen(geschrieben, BEKANNTE_RAEUME)).toBe("raum-2");
  });

  it("R-1 (b): ein UNBEKANNTER Wert wird verworfen statt angewendet", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const lesen = ortFunktion(modul, "spaceFromParams", "librarySpace");
    const kein = ortExport(modul, "NO_SPACE", "librarySpace");

    // Dieselbe Grenze, die `Library.tsx:200-215` (mega11 Block C) für Facettenwerte zieht: ein Wert
    // aus der Adresszeile, den es im Bestand nicht gibt, wird am EINGANG verworfen — nicht später
    // aufgeräumt. Ein Wert, der nie echte Auswahl war, kann auch nicht in eine gespeicherte Sicht
    // geraten (das ist die Verbindung zu `R-13`).
    //
    // Und hier zusätzlich sicherheitsrelevant: „unbekannt“ heisst bei einem getrimmten Bestand auch
    // „für dich nicht sichtbar“. Ein angewendeter Fremdwert wäre eine Sonde — man tippte Kennungen
    // in die Adresse und läse an der Reaktion ab, welche es gibt.
    expect(lesen(new URLSearchParams(`${ORT_URL_PARAM}=raum-fremd`), BEKANNTE_RAEUME)).toBe(kein);
    expect(lesen(new URLSearchParams(`${ORT_URL_PARAM}=`), BEKANNTE_RAEUME)).toBe(kein);
    expect(lesen(new URLSearchParams(), BEKANNTE_RAEUME)).toBe(kein);
    // Kein Bestand geladen → noch nichts bekannt → noch keine Auswahl (nicht: alles erlaubt).
    expect(lesen(new URLSearchParams(`${ORT_URL_PARAM}=raum-1`), [])).toBe(kein);
  });

  it("R-1 (c): „gesamtes Unternehmen“ entfernt den Parameter, statt ihn leer zu schreiben", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const schreiben = ortFunktion(modul, "writeSpaceToParams", "librarySpace");
    const kein = ortExport(modul, "NO_SPACE", "librarySpace");

    // `?raum=` wäre eine lügende Adresse: sie behauptet einen Geltungsbereich, der keiner ist.
    const zurueck = schreiben(
      new URLSearchParams(`${ORT_URL_PARAM}=raum-1&category=Anlage+1`),
      kein,
    ) as URLSearchParams;
    expect(zurueck.has(ORT_URL_PARAM)).toBe(false);
    // Und die Facettenauswahl bleibt unangetastet — der Ort ist additiv, kein Ersatz.
    expect(zurueck.get("category")).toBe("Anlage 1");
  });

  it("R-1 (d): `serializeSpace` ist stabil — die Schleifenbremse der URL-Fortschreibung", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const serialisieren = ortFunktion(modul, "serializeSpace", "librarySpace");
    const kein = ortExport(modul, "NO_SPACE", "librarySpace");

    // `Library.tsx:249-277` vergleicht die KANONISCHE Zeichenkette, nicht Objektidentität — sonst
    // drehte sich Effekt → setParams → Render → Effekt im Kreis. Der Ort tritt in denselben Effekt
    // ein und braucht dieselbe Eigenschaft.
    expect(serialisieren("raum-1")).toBe(serialisieren("raum-1"));
    expect(serialisieren("raum-1")).not.toBe(serialisieren("raum-2"));
    expect(serialisieren(kein)).toBe(serialisieren(kein));
    expect(typeof serialisieren(kein)).toBe("string");
  });
});

describe("PRO 381 · R-2 — eine lückenhafte Kette ergibt KEINEN Pfad", () => {
  it("R-2 (a): jede Form einer Lücke ergibt `null` — nicht gekürzt, nicht mit Platzhalter", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const pfad = ortFunktion(modul, "spacePath", "librarySpace");

    // PLAN 378 §5.2 Regel 2: „Ein gekürzter Pfad verriete die TIEFE, ein vollständiger die NAMEN.“
    // Der Server liefert die Kette ganz oder gar nicht — aber die Oberfläche darf sich darauf nicht
    // verlassen, sonst hinge die Leckfreiheit an fremder Disziplin statt an eigener Bauform.
    for (const { name, kette } of lueckenhafteKetten()) {
      expect(pfad(kette), `lückenhafte Kette (${name}) ergab einen Pfad`).toBeNull();
    }
    // Und die entarteten Eingaben ebenso: nichts erfinden, nichts glätten.
    for (const entartet of [null, undefined, [], "", 0, {}, [undefined]]) {
      expect(
        pfad(entartet),
        `entartete Eingabe ${JSON.stringify(entartet)} ergab einen Pfad`,
      ).toBeNull();
    }
  });

  it("R-2 (b): eine VOLLSTÄNDIG sichtbare Kette ist ganz darstellbar — in ihrer Reihenfolge", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const pfad = ortFunktion(modul, "spacePath", "librarySpace");

    // Die Gegenprobe, ohne die (a) von einem Modul erfüllbar wäre, das immer `null` liefert.
    const kette = sichtbareKette(3);
    expect(pfad(kette)).toEqual(kette);
    // Wurzel zuerst, Standort zuletzt — die Reihenfolge trägt die Aussage „wo ich bin“.
    expect((pfad(kette) as Array<{ id: string }>)[0]?.id).toBe("raum-1");
  });
});

describe("PRO 381 · Tiefe 15 — KW-ARCH-WISSENSRAUM-ERSTE-WELLE-01 Entscheidung 4", () => {
  it("Tiefe (a): die beschlossene Höchsttiefe steht als Konstante im Modul und ist 15", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    expect(ortExport(modul, "LIBRARY_SPACE_MAX_DEPTH", "librarySpace")).toBe(ORT_MAX_TIEFE);
    expect(ORT_MAX_TIEFE).toBe(15);
  });

  it("Tiefe (b): eine Kette mit GENAU 15 sichtbaren Gliedern ist ganz darstellbar", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const pfad = ortFunktion(modul, "spacePath", "librarySpace");
    const kette = sichtbareKette(15);
    expect(pfad(kette)).toEqual(kette);
    expect(pfad(kette)).toHaveLength(15);
  });

  it("Tiefe (c): eine Kette JENSEITS der Höchsttiefe ergibt keinen Pfad — fail-closed, nie gekürzt", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const pfad = ortFunktion(modul, "spacePath", "librarySpace");

    // Die Zielstufe 1 kennt keine Kette tiefer als 15. Trifft trotzdem eine ein, ist die Lage
    // „unbekannt“ — und REF-0001 `:50` verlangt bei Stale-/Unknown-Lage fail-closed. Ein auf 15
    // GEKÜRZTER Pfad wäre die falsche Rettung: er verriete, dass es tiefer weitergeht (§5.2 Regel 2).
    expect(pfad(sichtbareKette(16))).toBeNull();
    expect(pfad(sichtbareKette(40))).toBeNull();
  });
});

describe("PRO 381 · R-3 — `null` und `undefined` ergeben DASSELBE leere Ergebnis (`V-2`)", () => {
  it("R-3 (a): kein Zweig erzeugt aus einer fehlenden Heimat einen Text", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const heimat = ortFunktion(modul, "koHomePath", "librarySpace");

    // ARCH-Entscheidung 7 (`V-2`): weder für `HOME_UNASSIGNED` noch für einen unsichtbaren
    // Heimatort erscheint in normalen Listen eine Heimatzeile. `HOME_UNASSIGNED` erscheint nur in
    // der separat security-getrimmten Zuordnungswarteschlange — die nicht Teil dieser Welle ist.
    //
    // Die drei Schreibweisen unten sind die drei Wege, auf denen eine fehlende Heimat am Client
    // ankommt: ausdrücklich `null` (Z-2/Z-3), gar nicht gesetzt (Altbestand), ausdrücklich
    // `undefined` (weggelassenes optionales Feld). Alle drei enden gleich — sonst wäre die
    // Schreibweise selbst die Auskunft.
    expect(heimat({ home: null })).toBeNull();
    expect(heimat({ home: undefined })).toBeNull();
    expect(heimat({})).toBeNull();
    expect(heimat({ home: null })).toEqual(heimat({ home: undefined }));
    expect(heimat({ home: null })).toEqual(heimat({}));
  });

  it("R-3 (b): auch ein durchgesickerter zweiter Marker erzeugt keinen Text", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const heimat = ortFunktion(modul, "koHomePath", "librarySpace");

    // §5.2 Regel 1: `Z-2` und `Z-3` sind auf der Leitung nicht unterscheidbar, und der Client soll
    // gar nicht erst einen Zweig haben, der einen zweiten Marker auswerten KÖNNTE.
    expect(heimat({ home: null, homeWithheld: true })).toBeNull();
    expect(heimat({ home: null, homeState: "WITHHELD" })).toBeNull();
    expect(heimat({ home: null, homeDepth: 7 })).toBeNull();
  });

  it("R-3 (c): Gegenprobe — eine sichtbare Heimat ergibt sehr wohl die Kette", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const heimat = ortFunktion(modul, "koHomePath", "librarySpace");
    const kette = sichtbareKette(2);
    expect(heimat({ home: { chain: kette } })).toEqual(kette);
  });
});

describe("PRO 381 · R-4 — der Ort wird NIE abgeleitet", () => {
  it("R-4 (a): Kategorie, Schlagwörter, Titel und Quellpfad ergeben keinen Ort", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const heimat = ortFunktion(modul, "koHomePath", "librarySpace");

    // PLAN 378 §4.3 Satz 3: „Die Oberfläche berechnet keinen Pfad. Sie zeichnet die Kette, die der
    // Server schickt — oder gar keine." Das Prüfobjekt trägt bewusst einen Titel, der wie ein Pfad
    // AUSSIEHT („Anlage 1 / Halle Nord / Ventilwartung“), Schlagwörter, die wie Räume klingen, und
    // eine Quell-URL mit Verzeichnisstruktur. Genau das sind die vier verlockenden Ableitungen.
    expect(heimat(koOhneOrt())).toBeNull();
  });

  it("R-4 (b): auch die Facettenwerte selbst ergeben keinen Ort", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const heimat = ortFunktion(modul, "koHomePath", "librarySpace");
    const ko = { ...koOhneOrt(), confidentiality: "vertraulich", author: "Halle Nord" };
    expect(heimat(ko)).toBeNull();
  });
});

describe("PRO 381 · R-5 — das Modul rechnet keine Zahl aus", () => {
  it("R-5: ohne Serverzahl gibt es keine Zahl — und `0` ist keine ehrliche Ersatzantwort", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const zahl = ortFunktion(modul, "spaceResultCount", "librarySpace");

    // PLAN 378 §4.3 Satz 4 / `P-3`: Zahlen kommen vom Server oder erscheinen nicht. Eine `0` wäre
    // eine Auskunft („in diesem Raum ist nichts“) — bei einem getrimmten Bestand ist sie falsch und
    // zugleich eine Existenzaussage über das, was der Betrachter nicht sehen darf.
    expect(zahl(undefined)).toBeNull();
    expect(zahl(null)).toBeNull();
    expect(zahl(Number.NaN)).toBeNull();
    expect(zahl(-1)).toBeNull();
    // Eine echte Serverzahl — auch die ehrliche Null — kommt unverändert durch.
    expect(zahl(0)).toBe(0);
    expect(zahl(7)).toBe(7);
  });
});
