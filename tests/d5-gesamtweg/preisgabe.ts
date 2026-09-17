// ================================================================================================
// JOB 4304 · DIE PREISGABEPROBE — EINE SPERRE, DIE EINEN AUSZUG DURCHLÄSST, IST KEINE SPERRE.
// ================================================================================================
//
// WOGEGEN DIESE DATEI STEHT, wörtlich aus dem Prüfurteil von JOB 4281
// (`archiv/4281/runde-2/ben.md`, Punkt 6): „Zudem prüft Fachlauf:547 bei einem Download nach Entzug
// nur Ungleichheit zum vollständigen Original. Testvorschlag: ausschliesslich einen geschützten
// Auszug oder Dateinamen ausliefern und dessen Preisgabe ausdrücklich abweisen."
//
// Die abgelöste Zeile war `expect(inhalt).not.toBe(ORIGINALTEXT)` — eine GLEICHHEITSPROBE. Sie ist
// für jede Teilmenge des Geheimnisses erfüllt: die ersten Zeichen des Dokuments, seine Mitte, sein
// Dateiname, sein Titel. Genau das sind die Bruchstücke, aus denen eine Person, der das Leserecht
// entzogen wurde, das Geheimnis wieder zusammensetzt — oder aus denen sie zumindest erfährt, DASS
// es das Dokument gibt und wie es heisst.
//
// ================================================================================================
// WARUM BYTES UND NICHT ZEICHENKETTEN
// ================================================================================================
//
// Diese Prüfung trägt zwei Originale: eine Textdatei und ein Bild. Ein Bild hat keinen „Inhalt", den
// man mit `toContain` vergleichen könnte — es hat Bytes. Die Stücke sind deshalb `Buffer`, und der
// Vergleich läuft über `Buffer.prototype.includes`. Für die Lagen, in denen beim Menschen TEXT
// ankommt (der Wortlaut eines Fensters, der Rumpf einer Absage), gibt es `preisgabeImText`; es
// vergleicht denselben Stücken in BEIDEN naheliegenden Deutungen (UTF-8 und Latin-1), damit ein als
// Text durchgereichtes Byte-Bruchstück nicht durch die Auslegung entkommt.
//
// ================================================================================================
// EIN LEERES STÜCK IST KEINE PROBE — UND DESHALB EIN FEHLER
// ================================================================================================
//
// `Buffer.prototype.includes(leer)` ist IMMER wahr, `String.prototype.includes("")` ebenfalls. Eine
// Probe, die aus einem leeren Namen oder einem leeren Original gebildet würde, wäre also entweder
// immer rot oder — je nach Richtung der Zusicherung — immer grün. Beides wäre eine Messung, die
// nichts misst. `verboteneStuecke` WIRFT deshalb, statt ein leeres Stück zu bilden.

/** Die Quelle, an die nach dem Entzug des Leserechts niemand mehr herankommen darf. */
export interface GesperrteQuelle {
  /** Der Dateiname, unter dem das Original vor dem Entzug ausgeliefert wurde. */
  name: string;
  /** Der Titel des tragenden Wissensobjekts. */
  titel: string;
  /** Der Auszug (die Kernaussage), den die Quelle im Haus trägt. */
  auszug: string;
  /** Die Bytes des Originals — Text wie Bild, immer als Bytes. */
  original: Buffer;
  /**
   * Was diese Person VOR dem Entzug berechtigt erhalten hat und behalten darf — die Bezeichnung der
   * Quelle, ihr Titel, ihr Auszug. Titel und Auszug stehen ohnehin in `titel`/`auszug`; hier steht,
   * was sonst noch auf der schon ausgelieferten Seite gestanden hat.
   */
  bereitsErhalten?: readonly string[];
}

export interface VerbotenesStueck {
  /** Was dieses Stück ist — steht wörtlich in der Fehlermeldung des Falls. */
  was: string;
  stueck: Buffer;
  /**
   * Nur für Abschnitte über die ROHBYTES des Originals: ab welchem Byte sie dort stehen.
   *
   * Der engere Maßstab braucht die STELLE und nicht nur den Wortlaut — die Begründung steht bei
   * `unerhalteneStuecke`.
   */
  ab?: number;
}

// ================================================================================================
// DIE FENSTERPROBE — WARUM DREI FESTE LÄNGEN NICHT GENÜGEN (BEN, Runde 2, Korrekturpflicht 1)
// ================================================================================================
//
// Hier standen bis Runde 3 genau sechs Stücke: das vollständige Original, sein Anfang, seine Mitte,
// sein Ende (je 32 Byte) und zwei Base64-Formen. Das ist eine POSITIVLISTE, und BEN hat ihre Lücke
// gemessen statt sie zu vermuten: seine Mutation lieferte beim Navigationsklick nach dem Entzug die
// ersten **16 Byte** des geschützten Originals aus — kürzer als jedes meiner Stücke, also in keinem
// davon enthalten. G3 blieb GRÜN und meldete den geschützten Download sogar als „ohne
// Originalinhalt" (sein Messprotokoll `register/cloud/work/089bf35205ce451fbf2e997240a1578e`).
//
// DER FEHLER WAR DIE FRAGESTELLUNG. „Enthält die Antwort eines meiner ausgewählten Stücke?" ist
// beantwortbar mit „nein", während sehr wohl geschützter Inhalt ankommt. Die richtige Frage ist
// längenunabhängig: **„Enthält die Antwort IRGENDEINEN zusammenhängenden Abschnitt des Originals?"**
//
// Deshalb bildet diese Datei jetzt JEDES zusammenhängende Fenster von `FENSTER_BYTE` Byte über das
// Original (und ebenso über seine Base64-Form). Ein 16-Byte-Auszug enthält vier solcher Fenster und
// fällt damit auf; ein 12-Byte-Auszug ebenso; erst unterhalb der Fensterbreite wird nichts mehr
// erkannt — und das ist eine benannte, gemessene Grenze statt einer unbemerkten.
//
// WARUM 12 BYTE UND NICHT 4: ein zu schmales Fenster trifft zufällig. „ung XQ4" steht in jedem Text
// über dieses Bauteil, auch in einer Absage, die nichts preisgibt — die Probe wäre dann rot, wo
// nichts falsch ist, und damit wertlos. Zwölf Byte zusammenhängender Originaltext sind dagegen kein
// Zufall mehr. Die Grenze steht in `REST` der Rückgabe.
const FENSTER_BYTE = 12;
/** Base64 bläht 3 Byte auf 4 Zeichen — dasselbe Fenster, in seiner Base64-Breite. */
const FENSTER_BASE64 = 16;

/**
 * Jedes zusammenhängende Fenster dieser Breite — die längenunabhängige Fassung der Auszugsprobe.
 *
 * Ist das Original kürzer als ein Fenster, bleibt die Liste leer; dann trägt allein das Stück „das
 * vollständige Original". `originalStuecke` weist eine zu kurze Quelle ohnehin zurück.
 */
function fenster(
  was: string,
  daten: Buffer,
  breite: number,
  /** `true` nur für die Rohbytes des Originals — dann trägt jedes Stück seine Stelle. */
  amOriginal: boolean,
): VerbotenesStueck[] {
  const stuecke: VerbotenesStueck[] = [];
  for (let ab = 0; ab + breite <= daten.length; ab += 1) {
    stuecke.push({
      was: `ein ${breite}-Byte-Abschnitt ${was} ab Byte ${ab}`,
      stueck: daten.subarray(ab, ab + breite),
      ...(amOriginal ? { ab } : {}),
    });
  }
  return stuecke;
}

function stueck(was: string, daten: Buffer): VerbotenesStueck {
  if (daten.length === 0) {
    throw new Error(
      `JOB 4304: „${was}" wäre ein LEERES Stück — und ein leeres Stück steckt in jeder Antwort. Die Preisgabeprobe würde damit nichts mehr messen.`,
    );
  }
  return { was, stueck: daten };
}

/**
 * Die Stücke des ORIGINALS selbst — vollständig, Anfang, Mitte, Ende, und beides in Base64.
 *
 * WARUM BASE64 DAZUGEHÖRT: das Produkt legt Originale als Data-URL ab (`kette.ts:250`) und gibt
 * Objektmetadaten als JSON zurück. Ein Fehlerzweig, der das gespeicherte Objekt „zur Diagnose"
 * mitschickte, gäbe das Geheimnis in Base64 preis, nicht in Rohbytes — die Rohbyte-Probe allein
 * bliebe grün.
 *
 * Diese Stücke sind der Maßstab für alles, was NACH dem Entzug geholt wird. Für die schon offene
 * Ausgangsseite gilt der engere Maßstab `unerhalteneStuecke` — die Begründung steht dort.
 */
export function originalStuecke(quelle: GesperrteQuelle): VerbotenesStueck[] {
  const gesamt = quelle.original.length;
  if (gesamt < 24) {
    throw new Error(
      `JOB 4304: das Original ist ${gesamt} Byte lang — zu kurz für eine Abschnittsprobe über ${FENSTER_BYTE} Byte.`,
    );
  }
  const alsBase64 = Buffer.from(quelle.original.toString("base64"), "ascii");
  return [
    stueck("das vollständige Original", quelle.original),
    stueck("das vollständige Original als Base64", alsBase64),
    ...fenster("des Originals", quelle.original, FENSTER_BYTE, true),
    ...fenster("des Originals in Base64", alsBase64, FENSTER_BASE64, false),
  ];
}

/**
 * Die Stücke, die die gesperrte Quelle KENNZEICHNEN, ohne ihr Inhalt zu sein: Dateiname, Titel,
 * Belegauszug.
 *
 * Sie stehen getrennt, weil sie eine andere Reichweite haben. Auf der Seite, die VOR dem Entzug
 * ausgeliefert wurde, dürfen Titel und Auszug weiter stehen — sie sind eine bereits ausgehändigte
 * Kopie, die keine Oberfläche zurückholen kann (die Begründung dazu steht im Fachlauf bei G3). Für
 * alles, was NACH dem Entzug geholt oder neu aufgebaut wird, gelten sie dagegen genauso wie der
 * Inhalt: ein Dateiname ist die Auskunft „dieses Dokument gibt es", und genau die soll der 404
 * verhindern.
 */
export function kennzeichenStuecke(quelle: GesperrteQuelle): VerbotenesStueck[] {
  return [
    stueck("der Dateiname der gesperrten Quelle", Buffer.from(quelle.name, "utf8")),
    stueck("der Titel der gesperrten Quelle", Buffer.from(quelle.titel, "utf8")),
    stueck("der Belegauszug der gesperrten Quelle", Buffer.from(quelle.auszug, "utf8")),
  ];
}

/** Alles zusammen — der Maßstab für alles, was NACH dem Entzug ausgeliefert wird. */
export function verboteneStuecke(quelle: GesperrteQuelle): VerbotenesStueck[] {
  return [...originalStuecke(quelle), ...kennzeichenStuecke(quelle)];
}

// ================================================================================================
// DER ENGERE MASSSTAB — UND WARUM ES IHN GEBEN MUSS (gelesen, nicht vermutet)
// ================================================================================================
//
// Der Auszug einer Quelle ist ein ZITAT AUS IHREM ORIGINAL, und im Bestand dieser Prüfung ist das
// wörtlich so: `kette.ts:234-240` setzt
//     ORIGINALTEXT = "Betriebsanweisung XQ42, Abschnitt 4: Die Zylinderkopfdichtung XQ42 wird vor
//                     dem Wechsel entlastet."
//     BELEGSTELLE  = "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet."
// Die Belegstelle ist also das ENDE des Originals. Sie steht berechtigt auf der Antwortkarte, die
// VOR dem Entzug ausgeliefert wurde — und eine schon ausgehändigte Kopie holt keine Oberfläche
// zurück (dieselbe ehrliche Grenze, die der Fachlauf bei G3 ausschreibt).
//
// Würde man auf jene Seite den vollen Maßstab anlegen, meldete das Stück „das Ende des Originals"
// eine Preisgabe, wo keine ist: der Test wäre rot für ein Produkt, das alles richtig macht. Würde
// man umgekehrt auf ALLES den engeren Maßstab anlegen, ginge der Auszug nach dem Entzug straflos
// durch — genau die Lücke, gegen die dieser Auftrag gebaut ist.
//
// Deshalb zwei Maßstäbe, und der engere ist ausdrücklich der, der NUR für schon Ausgeliefertes
// gilt: er lässt genau die Stücke stehen, die diese Person nachweislich NIE berechtigt erhalten hat.
/**
 * WO im Original steht, was diese Person berechtigt erhalten hat — als Bytebereiche.
 *
 * WARUM ÜBER DIE STELLE UND NICHT ÜBER DEN WORTLAUT, gemessen in Runde 3: der Abschnitt ab Byte 36
 * lautet „ Die Zylinde" — elf Byte der berechtigt sichtbaren Belegstelle plus EIN Trennzeichen, das
 * von der Seite stammt und nicht aus dem Original. Ein Wortlautvergleich gegen die Belegstelle
 * findet ihn dort nicht (sie beginnt ohne Leerzeichen) und meldete deshalb eine Preisgabe, wo
 * nichts preisgegeben wird. Über die STELLE ist die Frage eindeutig: dieser Abschnitt überlappt den
 * Bereich, den die Person ohnehin hat.
 *
 * AUSGESCHLOSSEN WIRD JEDE ÜBERLAPPUNG, nicht nur die vollständige Enthaltung. Das ist bewusst
 * konservativ: es kostet die paar Abschnitte am Rand der Belegstelle und schliesst dafür jeden
 * Randfehler dieser Art aus. Was übrig bleibt, ist reichlich — für die Textquelle die gesamte erste
 * Hälfte des Originals, und genau dort liegt der Auszug, um den es geht.
 */
function haltebereiche(original: Buffer, erhalten: readonly string[]): [number, number][] {
  // Über Latin-1, damit die Stellen BYTEgenau sind: eine Zeichenkette aus Mehrbytezeichen hätte
  // sonst andere Indizes als der Puffer, gegen den die Abschnitte gebildet wurden.
  const roh = original.toString("latin1");
  const bereiche: [number, number][] = [];
  for (const hat of erhalten) {
    const nadel = Buffer.from(hat, "utf8").toString("latin1");
    if (nadel.length === 0) {
      continue;
    }
    let ab = roh.indexOf(nadel);
    while (ab >= 0) {
      bereiche.push([ab, ab + nadel.length]);
      ab = roh.indexOf(nadel, ab + 1);
    }
  }
  return bereiche;
}

/**
 * Die Stücke des Originals, die diese Person nie erhalten hat — der Maßstab für die schon offene
 * Ausgangsseite.
 *
 * WIRFT, wenn nichts übrig bleibt: ein Maßstab ohne Stücke prüfte nichts und wäre für jede Seite
 * grün. Das ist die Fehlerklasse „der Messweg fällt aus", und sie muss laut scheitern.
 */
export function unerhalteneStuecke(quelle: GesperrteQuelle): VerbotenesStueck[] {
  // `name` gehört dazu: der Dateiname STAND vor dem Entzug als Beschriftung des Links auf der
  // Seite. Für alles NEUE bleibt er verboten (`kennzeichenStuecke`) — auf der schon ausgelieferten
  // Seite ist er eine ausgehändigte Kopie wie Titel und Belegstelle.
  const erhalten = [quelle.titel, quelle.auszug, quelle.name, ...(quelle.bereitsErhalten ?? [])];
  const bereiche = haltebereiche(quelle.original, erhalten);
  const uebrig = originalStuecke(quelle).filter((s) => {
    // ZWEI REGELN, und beide werden gebraucht — jede allein hat in Runde 3 einen Fehlalarm erzeugt:
    //   · WORTLAUT: „Betriebsanwe" steht in der Quellenbezeichnung „Betriebsanweisung XQ42
    //     (Abschnitt 4)", die berechtigt auf der Seite steht. Im ORIGINAL findet man diese
    //     Bezeichnung nicht (dort steht „XQ42, Abschnitt 4:"), also greift keine Stellenregel.
    //   · STELLE: „ Die Zylinde" ist elf Byte Belegstelle plus ein Trennzeichen der Seite. Als
    //     Wortlaut steht es in keiner erhaltenen Zeichenkette, seine Stelle liegt aber mitten in
    //     der Belegstelle.
    const alsText = s.stueck.toString("utf8");
    if (erhalten.some((hat) => hat.includes(alsText))) {
      return false;
    }
    if (typeof s.ab === "number") {
      const von = s.ab;
      const bis = von + s.stueck.length;
      return !bereiche.some(([anfang, hinter]) => von < hinter && bis > anfang);
    }
    return true;
  });
  if (uebrig.length === 0) {
    throw new Error(
      "JOB 4304: von diesem Original ist kein Stück übrig, das die Person nicht ohnehin berechtigt erhalten hätte — dieser Maßstab misst nichts mehr.",
    );
  }
  return uebrig;
}

/** Welche Stücke in diesen Bytes stehen — leer heisst: nichts ist durchgekommen. */
export function preisgabeInBytes(
  geliefert: Buffer,
  stuecke: readonly VerbotenesStueck[],
): VerbotenesStueck[] {
  return stuecke.filter((s) => geliefert.includes(s.stueck));
}

// ================================================================================================
// DIE MASKIERUNG — GEMESSEN AN EINER GEGENPROBE, DIE ZUERST DURCHRUTSCHTE.
// ================================================================================================
//
// Die erste Fassung dieser Datei verglich nur `text` selbst. Die Gegenprobe (a) dieses Auftrags hat
// gezeigt, dass das zu wenig ist: mit einer Sperre, die ABSICHTLICH die ersten vierzig Byte des
// Bildes preisgab, meldete G7 nur den Dateinamen — das Byte-Bruchstück blieb unentdeckt
// (Arbeitsprüfung de0aeb98…, Cloud-Lauf 188af203…). Der Grund steht in der Fehlermeldung jenes
// Laufs: der Rumpf kam als
//     "auszug":"PNG\r\n\n   \rIHDR …"
// an. Die Bytes waren also DA — aber als JSON-MASKIERUNG, Zeichen für Zeichen, und eine
// Zeichenkettensuche nach den echten Bytes findet darin nichts.
//
// Eine Preisgabe, die nur maskiert ankommt, ist eine Preisgabe: wer den Rumpf liest, liest den
// Inhalt. Der Vergleich läuft deshalb zusätzlich gegen die aufgelöste Fassung.
function jsonEntmaskiert(text: string): string {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, ziffern: string) =>
      String.fromCharCode(Number.parseInt(ziffern, 16)),
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}

/**
 * Dieselbe Frage für etwas, das als TEXT beim Menschen ankommt.
 *
 * ZWEI DEUTUNGEN, und beide zählen: `toString("utf8")` ist die Lesart, in der ein durchgereichter
 * Textauszug erscheint; `toString("latin1")` die, in der ein durchgereichtes BYTE-Bruchstück
 * erscheint, wenn es irgendwo als Zeichenkette behandelt wurde. Nur eine von beiden zu prüfen
 * liesse genau die andere Hälfte durch.
 *
 * UND ZWEI FASSUNGEN DES TEXTES: wie er dasteht, und mit aufgelösten JSON-Maskierungen (Begründung
 * darüber — das ist keine Vorsichtsmassnahme, sondern ein gemessener Befund).
 */
export function preisgabeImText(
  text: string,
  stuecke: readonly VerbotenesStueck[],
): VerbotenesStueck[] {
  const fassungen = [text, jsonEntmaskiert(text)];
  return stuecke.filter((s) => {
    const alsUtf8 = s.stueck.toString("utf8");
    const alsLatin1 = s.stueck.toString("latin1");
    return fassungen.some((f) => f.includes(alsUtf8) || f.includes(alsLatin1));
  });
}
