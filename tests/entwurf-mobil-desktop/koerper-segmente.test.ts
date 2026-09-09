// ================================================================================================
// JOB 3377 · ENTWURF-MOBIL-DESKTOP-R — DIE REINE RÜCKWANDLUNG TEXT → BODY.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, und warum es genau diese Fälle sind: JOB 3289 ist nach vier Runden an
// EINEM Satz gescheitert (BEN R4, GESAMTURTEIL ROT):
//
//     „Eigene gemountete Gegenprobe mit unverändertem <a href="https://klarwerk.de">Hand<br><br>buch</a>:
//      Nach Speichern steht <p>Hand</p><p>buch</p> im CaptureService."
//
// Ein Absatz mit innerer Leerzeile wurde beim Zerlegen des Textes AUSEINANDERGERISSEN, bevor die
// Ankererkennung ihn suchen konnte — er fand sich selbst nicht wieder und verlor sein Linkziel,
// OHNE dass der Mensch ihn angefasst hätte. Fall 1 und Fall 2 sind wörtlich BENs Gegenproben.
//
// Die Fälle 3 bis 5 halten die Gegenrichtung fest: ein WIRKLICH geänderter Absatz muss sein
// Ursprungssegment weiterhin nehmen (sonst wäre die Regel „alles ist neu" und die Formatierung nur
// zufällig gerettet), ein bloss VERSCHOBENER Absatz behält seine Auszeichnung, und ein fester Block
// behält seine Stellung auch dann, wenn sein Platzhalter versehentlich gelöscht wurde.
import { describe, expect, it } from "vitest";
import { draftBodyFromText, draftBodyText, splitDraftBody } from "../../apps/web/src/lib/draftBody";

// BENs Gegenfall, wörtlich: ein Verweis, dessen Text eine innere Leerzeile trägt.
const LINK_BODY =
  '<p><a href="https://klarwerk.de">Hand<br><br>buch</a></p><p><strong>A</strong></p>';

describe("JOB 3377 · Zerlegung: was das Handy zu sehen bekommt", () => {
  it("leerer Body ergibt keine Segmente (Neuanlage hat keinen Altbody)", () => {
    expect(splitDraftBody("")).toEqual([]);
    expect(splitDraftBody(null)).toEqual([]);
    expect(splitDraftBody(undefined)).toEqual([]);
  });

  it("ein Absatz mit innerer Leerzeile bleibt EIN Segment — hier ist 3289 gescheitert", () => {
    const segs = splitDraftBody(LINK_BODY);
    expect(segs).toHaveLength(2);
    expect(segs[0]?.art).toBe("format");
    expect(segs[0]?.text).toBe("Hand\n\nbuch");
    expect(segs[0]?.html).toBe('<p><a href="https://klarwerk.de">Hand<br><br>buch</a></p>');
    expect(segs[1]?.text).toBe("A");
  });

  it("feste Blöcke stehen als nummerierte Platzhalter an ihrer Stelle im Text", () => {
    const segs = splitDraftBody('<p>A</p><p><img src="x.png" alt="Pumpe"></p><p>B</p>');
    expect(segs[1]?.art).toBe("fest");
    expect(segs[1]?.marke).toBe("bild");
    expect(draftBodyText(segs)).toBe("A\n\n[[1: bild: Pumpe]]\n\nB");
  });

  it("Entities kommen als Klartext an und gehen als Entities zurück", () => {
    const segs = splitDraftBody("<p>Kies &amp; Sand</p>");
    expect(draftBodyText(segs)).toBe("Kies & Sand");
    expect(draftBodyFromText(segs, "Kies & Splitt")).toBe("<p>Kies &amp; Splitt</p>");
  });
});

describe("JOB 3377 · Rückwandlung: unberührt heisst byte-gleich", () => {
  // FALL 1 (BEN R4, Korrekturpflicht 1, erste Hälfte): nichts angefasst — nichts verloren.
  it("unveränderter mehrzeiliger Verweis bleibt byte-gleich, samt Linkziel", () => {
    const segs = splitDraftBody(LINK_BODY);
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(LINK_BODY);
  });

  // FALL 2 (BEN R4, Korrekturpflicht 1, zweite Hälfte): ein NEUER Absatz davor darf kein
  // bestehendes Segment verbrauchen — Auszeichnung und Linkziel stehen danach noch da.
  it("NEU davor eingefügt: der Verweis behält href, der fette Absatz seine Fettung", () => {
    const segs = splitDraftBody(LINK_BODY);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(`<p>NEU</p>${LINK_BODY}`);
  });

  // Die GEGENRICHTUNG. Ohne sie wäre die Regel „alles ist neu" und jede erhaltene Formatierung
  // reiner Zufall.
  it("ein WIRKLICH geänderter Absatz nimmt sein Ursprungssegment und wird schlichter Text", () => {
    const segs = splitDraftBody("<p><strong>A</strong></p><p><em>B</em></p>");
    expect(draftBodyFromText(segs, "A geaendert\n\nB")).toBe("<p>A geaendert</p><p><em>B</em></p>");
  });

  it("ein bloss VERSCHOBENER Absatz behält seine Auszeichnung", () => {
    const segs = splitDraftBody("<p><strong>A</strong></p><p><em>B</em></p>");
    expect(draftBodyFromText(segs, "B\n\nA")).toBe("<p><em>B</em></p><p><strong>A</strong></p>");
  });

  it("ein gelöschter Platzhalter kostet kein Bild — es kehrt an SEINE Stelle zurück", () => {
    const segs = splitDraftBody('<p>A</p><p>B</p><p><img src="x.png" alt="Pumpe"></p><p>C</p>');
    // Der Mensch löscht A und den Platzhalter und ändert C.
    expect(draftBodyFromText(segs, "B\n\nGEAENDERT")).toBe(
      '<p>B</p><p><img src="x.png" alt="Pumpe"></p><p>GEAENDERT</p>',
    );
  });

  it("der Platzhalter trägt die Stellung: verschoben heisst verschoben", () => {
    const segs = splitDraftBody('<p>A</p><p><img src="x.png" alt="Pumpe"></p><p>B</p>');
    expect(draftBodyFromText(segs, "A\n\nB\n\n[[1: bild: Pumpe]]")).toBe(
      '<p>A</p><p>B</p><p><img src="x.png" alt="Pumpe"></p>',
    );
  });

  it("die VORSCHAU im Platzhalter darf überschrieben werden — Nummer und Marke tragen", () => {
    const segs = splitDraftBody('<p>A</p><p><img src="x.png" alt="Pumpe"></p><p>B</p>');
    expect(draftBodyFromText(segs, "A\n\n[[1: bild: irgendwas anderes]]\n\nB")).toBe(
      '<p>A</p><p><img src="x.png" alt="Pumpe"></p><p>B</p>',
    );
  });

  it("ein bewusst geleerter Textentwurf gibt einen leeren Body zurück (Löschsemantik bleibt)", () => {
    const segs = splitDraftBody("<p>A</p><p>B</p>");
    expect(draftBodyFromText(segs, "")).toBe("");
  });
});

// ================================================================================================
// RUNDE 2 — DIE DREI BEFUNDE VON BEN, JEWEILS OHNE EINGABE UND MIT `NEU` DAVOR.
// ================================================================================================
//
// Alle drei sind Datenverlust OHNE Nutzerhandlung: der Mensch setzt den Entwurf fort und drückt
// „Aktualisieren", sonst nichts. Genau deshalb steht jeder Fall zweimal da — einmal unberührt,
// einmal mit einem eingefügten Absatz davor, weil der Einschub in 3289 die Zuordnung verschob.

describe("JOB 3377 R2 · BEN 1: mehrdeutiger Klartext darf keine Absätze umordnen", () => {
  // Drei Absätze, deren Klartext sich überlappt: „A", „B" und ein dritter, der als „A\n\nB" liest.
  // Die gierige Längstsuche der Runde 1 band den ERSTEN Lauf an das DRITTE Segment.
  const MEHRDEUTIG = "<p><strong>A</strong></p><p><em>B</em></p><p>A<br><br>B</p>";

  it("ohne jede Eingabe bleibt der Body byte-gleich (kein Umordnen, keine verirrte Auszeichnung)", () => {
    const segs = splitDraftBody(MEHRDEUTIG);
    expect(draftBodyText(segs)).toBe("A\n\nB\n\nA\n\nB");
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(MEHRDEUTIG);
  });

  it("mit NEU davor stehen alle drei Absätze unverändert dahinter", () => {
    const segs = splitDraftBody(MEHRDEUTIG);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(
      `<p>NEU</p>${MEHRDEUTIG}`,
    );
  });

  it("der lange Lauf gewinnt weiterhin, wenn er die grössere Deckung hat", () => {
    // Hier ist „A\n\nB" wirklich EIN Absatz und der erste wurde gelöscht: die Zuordnung muss den
    // langen Lauf nehmen, nicht das kurze „A" — sonst zerfiele der Absatz in zwei.
    const segs = splitDraftBody("<p>A</p><p>A<br><br>B</p>");
    expect(draftBodyFromText(segs, "A\n\nB")).toBe("<p>A<br><br>B</p>");
  });
});

describe("JOB 3377 R2 · BEN 2: Nutzertext, der wie ein Platzhalter aussieht", () => {
  // Der Mensch hat einen Absatz, der wörtlich `[[1]]` lautet — ein Fussnotenzeichen, eine
  // Vorlagenmarke. Runde 1 las ihn als Steuerzeichen: sein Text verschwand, das Bild sprang hierher.
  const MIT_MARKE = '<p>[[1]]</p><p><img src="x.png" alt="Pumpe"></p>';

  it("ohne Eingabe behalten Text UND Bild Inhalt und Stellung", () => {
    const segs = splitDraftBody(MIT_MARKE);
    expect(draftBodyText(segs)).toBe("[[1]]\n\n[[1: bild: Pumpe]]");
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(MIT_MARKE);
  });

  it("mit NEU davor ebenso — der Einschub verschiebt nichts", () => {
    const segs = splitDraftBody(MIT_MARKE);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(`<p>NEU</p>${MIT_MARKE}`);
  });

  it("frisch getippter Text in Platzhalter-Schreibweise bleibt Text und holt kein Bild", () => {
    // Kein festes Segment, keine Marke: `[[1]]` und `[[1: irgendwas]]` sind gewöhnlicher Text.
    const segs = splitDraftBody("<p>A</p>");
    expect(draftBodyFromText(segs, "A\n\n[[1]]\n\n[[1: irgendwas]]")).toBe(
      "<p>A</p><p>[[1]]</p><p>[[1: irgendwas]]</p>",
    );
  });

  it("ein Absatz, der WÖRTLICH wie ein erzeugter Platzhalter lautet, gehört sich selbst", () => {
    // Der Grenzfall der verschärften Erkennung: der Text des ersten Absatzes ist zeichengleich mit
    // dem Platzhalter, den das Bild dahinter bekommt. Weil die unberührten Absätze ZUERST gebunden
    // werden, bleibt er Text — und das Bild bekommt den zweiten Platzhalter.
    const koerper = '<p>[[1: bild: Pumpe]]</p><p><img src="x.png" alt="Pumpe"></p>';
    const segs = splitDraftBody(koerper);
    expect(draftBodyText(segs)).toBe("[[1: bild: Pumpe]]\n\n[[1: bild: Pumpe]]");
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(koerper);
  });

  it("eine erfundene Marke ist kein Steuerzeichen — der Text bleibt, das Bild kehrt zurück", () => {
    // Die Marke ist der maschinelle Teil. Stimmt sie nicht mit dem festen Block überein (hier
    // `tabelle` gegen ein Bild), ist der Absatz gewöhnlicher Text; der Block kommt über Regel 5.
    const segs = splitDraftBody('<p>A</p><p><img src="x.png" alt="Pumpe"></p>');
    expect(draftBodyFromText(segs, "A\n\n[[1: tabelle: Pumpe]]")).toBe(
      '<p>A</p><p><img src="x.png" alt="Pumpe"></p><p>[[1: tabelle: Pumpe]]</p>',
    );
  });

  it("getipptes `[[1]]` ANSTELLE des echten Platzhalters kostet weder den Text noch das Bild", () => {
    // Der schärfste Fall: der Mensch löscht den erzeugten Platzhalter und tippt selbst `[[1]]`.
    // Läse die Erkennung das als Steuerzeichen, verschwände sein getippter Text spurlos — das Bild
    // stünde an dessen Stelle. So kommt beides zurück: das Bild über Regel 5, der Text als Text.
    const segs = splitDraftBody('<p>A</p><p><img src="x.png" alt="Pumpe"></p>');
    expect(draftBodyFromText(segs, "A\n\n[[1]]")).toBe(
      '<p>A</p><p><img src="x.png" alt="Pumpe"></p><p>[[1]]</p>',
    );
  });
});

describe("JOB 3377 R2 · BEN 3: der Zwischenraum zwischen zwei Blöcken", () => {
  const MIT_UMBRUCH = "<p>A</p>\n<p><strong>B</strong></p>\n";

  it("ohne Eingabe bleibt auch der gespeicherte Zeilenumbruch byte-gleich", () => {
    const segs = splitDraftBody(MIT_UMBRUCH);
    expect(draftBodyText(segs)).toBe("A\n\nB");
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(MIT_UMBRUCH);
  });

  it("mit NEU davor bleiben Umbruch und Fettung der unberührten Absätze erhalten", () => {
    const segs = splitDraftBody(MIT_UMBRUCH);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(
      `<p>NEU</p>${MIT_UMBRUCH}`,
    );
  });

  it("Zwischenraum um einen festen Block herum überlebt ebenfalls", () => {
    const mitBild = '<p>A</p>\n<p><img src="x.png" alt="Pumpe"></p>\n<p>B</p>';
    const segs = splitDraftBody(mitBild);
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(mitBild);
  });
});

// ================================================================================================
// RUNDE 3 — BENS LETZTER BEFUND: EIN ABSATZ OHNE SICHTBAREN TEXT IST TROTZDEM EIN ABSATZ.
// ================================================================================================
//
// BEN R2 (GESAMTURTEIL ROT, Korrekturpflicht 1), wörtlich gemessen:
//
//     „Ohne Eingabe: <p><strong></strong></p><p>A</p> wird im echten CaptureService zu <p>A</p>.
//      Mit NEU davor verschwindet derselbe unberührte Absatz."
//
// Der Grund lag in der Einstufung: ein AUSGEZEICHNETER Absatz galt als bearbeitbar, auch wenn seine
// Textfassung leer ist. Bearbeitbare Segmente hängen aber am Klartext — und ein Absatz, der im Text
// gar nicht erscheint, findet dort auch keinen Anker. Regel 5 überging ihn dann als „bearbeitbar",
// und er fiel heraus. Ein FLACHER leerer Absatz (`<p></p>`) war längst richtig eingestuft; nur die
// ausgezeichnete Fassung fehlte. Diese Fälle halten die Unterscheidung fest.

describe("JOB 3377 R3 · BEN: unberührte Absätze ohne sichtbaren Text", () => {
  const LEER_FORMATIERT = "<p><strong></strong></p><p>A</p>";

  it("ein ausgezeichneter Absatz ohne Text ist `leer` — wie der flache, und ohne Platzhalter", () => {
    const segs = splitDraftBody(LEER_FORMATIERT);
    expect(segs).toHaveLength(2);
    expect(segs[0]?.art).toBe("leer");
    expect(segs[0]?.html).toBe("<p><strong></strong></p>");
    // Er hat dem Menschen nichts zu sagen: er steht NICHT im Textfeld — und trotzdem bleibt er.
    expect(draftBodyText(segs)).toBe("A");
  });

  it("ohne jede Eingabe bleibt er byte-gleich stehen", () => {
    const segs = splitDraftBody(LEER_FORMATIERT);
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(LEER_FORMATIERT);
  });

  it("mit NEU davor steht er unverändert dahinter", () => {
    const segs = splitDraftBody(LEER_FORMATIERT);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(
      `<p>NEU</p>${LEER_FORMATIERT}`,
    );
  });

  it("auch mit `<br>` darin — sichtbar leer ist sichtbar leer", () => {
    const mitBr = "<p><em><br></em></p><p>A</p>";
    const segs = splitDraftBody(mitBr);
    expect(segs[0]?.art).toBe("leer");
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(mitBr);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(`<p>NEU</p>${mitBr}`);
  });

  it("am ENDE des Bodys bleibt er ebenso — auch wenn ein Satz angehängt wird", () => {
    const amEnde = '<p>A</p><p><a href="https://klarwerk.de"></a></p>';
    const segs = splitDraftBody(amEnde);
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(amEnde);
    expect(draftBodyFromText(segs, `${draftBodyText(segs)}\n\nNachtrag`)).toBe(
      `${amEnde}<p>Nachtrag</p>`,
    );
  });

  it("zwischen zwei Absätzen behält er seine Stelle, auch wenn davor eingefügt wird", () => {
    const dazwischen = "<p>A</p><p><strong></strong></p><p>B</p>";
    const segs = splitDraftBody(dazwischen);
    expect(draftBodyText(segs)).toBe("A\n\nB");
    expect(draftBodyFromText(segs, draftBodyText(segs))).toBe(dazwischen);
    expect(draftBodyFromText(segs, `NEU\n\n${draftBodyText(segs)}`)).toBe(
      `<p>NEU</p>${dazwischen}`,
    );
  });

  it("ein Absatz mit sichtbarem Text bleibt bearbeitbar — die Gegenrichtung", () => {
    // Ohne diesen Fall wäre die Regel „alles Ausgezeichnete ist unantastbar", und eine echte
    // Änderung käme nie durch.
    const segs = splitDraftBody("<p><strong>A</strong></p>");
    expect(segs[0]?.art).toBe("format");
    expect(draftBodyFromText(segs, "A geaendert")).toBe("<p>A geaendert</p>");
  });
});
