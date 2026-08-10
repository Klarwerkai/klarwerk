import { spacePath } from "../../lib/librarySpace";

// ==================================================================================================
// AUFTRAG PRO 390 — DIE HEIMATZEILE AM TREFFER (`P-2`).
// ==================================================================================================
//
// Eine ruhige Zeile, die sagt, WO ein Beitrag zu Hause ist. Gebaut exakt nach dem Muster von
// `KoAuthorLine.tsx`: die Wahrheit kommt fertig herein, die Zeile kürzt, der volle Text steht im
// `title`. Sie entscheidet nichts und rechnet nichts.
//
// ── DIE ZWEI EIGENSCHAFTEN, DIE HIER SICHERHEITSRELEVANT SIND ────────────────────────────────────
//
// 1. **Fehlt die Heimat, steht hier NICHTS.** Nicht ein Platzhalter, nicht ein Gedankenstrich,
//    nicht ein leeres Feld, das Höhe belegt — die Komponente rendert `null` und damit gar kein
//    Element. Das ist kein Feinschliff, sondern der Kern der Sicherheitsvariante `V-2`: Ein Beitrag
//    ohne Zuordnung und ein Beitrag mit einem für diesen Betrachter UNSICHTBAREN Zuhause kommen auf
//    der Leitung zeichengleich an — und sie müssen die Fläche zeichengleich verlassen. Bliebe hier
//    ein leerer Knoten stehen, wäre schon dessen Vorhandensein eine abzählbare Spur.
//
// 2. **Diese Komponente liest GENAU EIN Feld: `home`.** Sie kennt weder Kategorie noch Schlagwörter
//    noch Titel noch Quellpfad des Beitrags — sie bekommt sie gar nicht erst. Die Regel „der Ort
//    wird nie abgeleitet" ist damit nicht Disziplin, sondern Bauform: es gibt keinen Zweig, der
//    eine Ableitung auch nur versuchen könnte.
//
// Die Projektion selbst liegt NICHT hier, sondern in `lib/librarySpace`. Das ist Absicht: dort ist
// sie DOM-frei geprüft (Lückenschluss, Höchsttiefe 15, `null`/fehlend gleichbehandelt), und eine
// zweite Fassung in einer Komponente wäre eine zweite Wahrheit, die irgendwann auseinanderläuft.
//
// ── WARUM HIER KEINE BESCHRIFTUNG STEHT ──────────────────────────────────────────────────────────
//
// `KoAuthorLine` schreibt „Autor: …" vor den Namen. Diese Zeile schreibt bewusst NICHTS davor und
// zeigt ausschließlich die Namen, die der Server geliefert hat. Grund: das Wort für den Ort ist
// eine offene Ownerentscheidung (PLAN PRO 378 §9, Sperren `B-1`/`B-2`/`B-3`; `B-6` entscheidet
// zusätzlich über die Kollision mit dem Datumsfilter). Ein hier erfundenes Wort nähme dem Owner die
// Wahl ab und stünde danach in jeder Trefferzeile.
//
// Ein Schlüssel aus dem Wörterbuch wäre keine Lösung, sondern ein bekannter Mangel: `i18n.ts` hat
// keinen `parseMissingKeyHandler`, ein fehlender Schlüssel erscheint dem Nutzer deshalb WÖRTLICH.
// Genau diesen Fall hat AUFTRAG-81 im Bestand repariert. Solange die Wörter offen sind, ist „nur
// die servergelieferten Namen" die einzige Darstellung, die weder erfindet noch kaputt aussieht.
// Kommt die Entscheidung, ist das Voranstellen einer Beschriftung eine Zeile.

export interface KoHomeLineProps {
  /**
   * Das Feld `home` des Wissensobjekts, unverändert so, wie der Server es geliefert hat.
   *
   * Bewusst `unknown` und nicht ein enger Typ: Diese Zeile ist die Grenze zur Serverantwort, und
   * die Prüfung dieser Grenze gehört in die Projektion (`spacePath`), nicht in eine Typzusicherung,
   * die zur Laufzeit nichts hält. Fehlt das Feld, ist es `null` oder ist es Unsinn — das Ergebnis
   * ist in allen drei Fällen dasselbe.
   */
  home?: unknown;
}

export function KoHomeLine({ home }: KoHomeLineProps): JSX.Element | null {
  const path = spacePath(home);
  // Kein Pfad heisst: keine Zeile. Nicht eine leere Zeile — gar keine.
  if (path === null) {
    return null;
  }
  const text = path.map((node) => node.name).join(" › ");
  // Der volle Text liegt im `title`; sichtbar kürzt die Zeile über CSS. Dasselbe Verhalten wie bei
  // der Autorzeile — kein mitten im Namen gekappter Ort ohne Auflösung.
  return (
    <div title={text} className="truncate font-mono text-[11px] text-muted-2">
      {text}
    </div>
  );
}
