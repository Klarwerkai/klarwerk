// ================================================================================================
// JOB 537 · D4 — DER MERKMALSVERTRAG. DER ZWEITE WÄCHTER, MIT DEM ZWEITEN SCHUTZZWECK.
// ================================================================================================
//
// PEDIS ENTSCHEIDUNG (JOB-537): „Beide koexistieren, getrennte Schutzzwecke." Verworfen wurden
// ausdrücklich „Ganzdatei-Pin durch Merkmalsvertrag ersetzen" und „Ganzdatei-Pin schliessen".
// Die Begründung: „Ein Ganzdatei-Pin schlägt bei jeder Änderung an, auch bei harmlosen. Ein
// Merkmalsvertrag prüft gezielt, was geschützt sein soll."
//
// DIE BEIDEN FRAGEN SIND VERSCHIEDEN, UND GENAU DARUM STEHEN HIER ZWEI WÄCHTER:
//
//   · `mega69-klara-waechter.test.ts` fragt: **„Hat sich etwas bewegt?"** Der Ganzdatei-Pin wird
//     bei JEDER Byteänderung rot — auch bei einem Tippfehler in einem Kommentar. Das ist kein
//     Mangel, das ist sein Zweck: er erzwingt die bewusste Frage nach den Auslieferungsfolgen.
//     Er kann aber NICHT sagen, WAS sich bewegt hat.
//
//   · Diese Datei fragt: **„Fehlt etwas Tragendes?"** Sie wird rot, wenn eine tragende Eigenschaft
//     der Datei verschwindet — und bleibt grün, wenn sich nur Kommentare oder Leerraum ändern.
//
// WARUM DAS KEINE DUBLETTE IST, UND WORAUS DIE ZEHN MERKMALE STAMMEN. Der Pin-Kommentar im
// Nachbarwächter ist über die Zeit zu einer langen Kette von Auslieferungsprotokollen gewachsen.
// Fast jeder Eintrag verspricht in Prosa DIESELBEN sechs Dinge: „KEIN neues Abrufziel, KEIN
// Manifest, KEINE geänderte CSP, KEIN neues Recht, KEINE geänderte Nutzlast, kein neuer
// Fremd-Ursprung." Diese Versprechen hat bisher NICHTS maschinell nachgeprüft — sie sind Text
// neben einer Zahl. **Der Merkmalsvertrag macht aus den Prosa-Zusagen des Pins ausführbare
// Zusicherungen.** Wandert der Pin das nächste Mal, prüft eine Maschine mit, ob die Begründung
// stimmt, die daneben geschrieben wird.
//
// ABGRENZUNG ZU DEN BESTEHENDEN WÄCHTERN, ausdrücklich: 26 Testdateien lesen `taskpane.html`
// bereits. Sie prüfen VERHALTEN an einer Vorrichtung (`klara-panel-fixture.ts`) — was das Panel
// TUT, wenn man es fährt. Diese Datei prüft die Datei als AUSLIEFERUNGSGEGENSTAND: welche
// tragenden Zeilen in ihr STEHEN. Das ist dieselbe Granularität, auf der der Pin arbeitet, nur
// selektiv. Wo sich eine Aussage inhaltlich mit einem Verhaltenswächter überschneidet, ist das in
// der Rückgabe zu JOB 537 D4 offengelegt und kein Zufall: ein Merkmal, das NIEMAND sonst prüft,
// wäre auch keins, das jemand vermisst.
//
// KALIBRIERUNG STATT BEHAUPTUNG: Zu jedem der zehn Merkmale steht ein Fall, der die Prüfung an
// einer VERFÄLSCHTEN Kopie der Quelle laufen lässt und verlangt, dass sie dort scheitert. Ein
// Wächter, den man nicht brechen kann, prüft nichts — dieselbe Bauform, die der Umlaut-Wächter
// nebenan seit mega69 trägt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TASKPANE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");

function quelle(): string {
  return readFileSync(TASKPANE, "utf8");
}

/**
 * Der ausführbare Teil der Datei — ohne Zeilenkommentare.
 *
 * DAS IST DER KERN DER TRENNUNG: Der Pin sieht jedes Byte, dieser Vertrag nur den Teil, der etwas
 * tut. Damit bleibt er bei einer Kommentaränderung grün, während der Pin rot wird — und genau das
 * ist der Unterschied der beiden Schutzzwecke, den Pedis Entscheidung erhalten wollte.
 */
function ausfuehrbar(src: string): string {
  return src
    .split("\n")
    .filter((zeile) => !/^\s*\/\//.test(zeile))
    .join("\n");
}

/** Die Ziele aller `fetch(...)`-Aufrufe als Rohtext des ersten Arguments. */
function abrufziele(src: string): string[] {
  const ziele: string[] = [];
  for (const treffer of ausfuehrbar(src).matchAll(/\bfetch\(\s*([^,)]+)/g)) {
    const roh = treffer[1]?.trim();
    if (roh) {
      ziele.push(roh);
    }
  }
  return ziele;
}

// ================================================================================================
// DIE ZEHN MERKMALE — je ein reines Prädikat über der Quelle.
// ================================================================================================
//
// Jedes Prädikat liefert die VERSTÖSSE, nicht ein Boolean: ein rot gewordener Fall soll sagen,
// WAS fehlt, nicht nur DASS etwas fehlt.

/** M1 · Die Ask-Nutzlast trägt den server-garantierten Modus. Ohne ihn ginge markierter
 *  Dokumenttext potenziell an ein Modell — die tragendste Zusage dieser Datei. */
function m1RetrievalOnly(src: string): boolean {
  return /body:\s*JSON\.stringify\(\{[^}]*mode:\s*"retrieval-only"/.test(ausfuehrbar(src));
}

/** M2 · Der Ausführungsriegel steht VOR dem Absenden, nicht nur am Knopf. Ein Gate, das nur ein
 *  `disabled`-Attribut ist, ist kein Gate — so steht es im Quelltext selbst. */
function m2Riegel(src: string): boolean {
  const code = ausfuehrbar(src);
  const fn = code.indexOf("function askKlala") >= 0 ? -1 : code.indexOf("function askKlara()");
  if (fn < 0) {
    return false;
  }
  const rumpf = code.slice(fn, code.indexOf("readAskSelection", fn));
  return /if\s*\(\s*klaraS4FragenGesperrt\(\)\s*\)/.test(rumpf) && /return;/.test(rumpf);
}

/** M3 · Die Freigabe wird strikt geprüft (`=== true`), nicht auf Wahrheitswert. Fail-closed: eine
 *  Antwort ohne das Feld darf nicht als „erlaubt" durchgehen. */
function m3StrikteFreigabe(src: string): boolean {
  return /executionAllowed\s*===\s*true/.test(ausfuehrbar(src));
}

/** M4/M5 · Beide Sendestellen tragen die Herkunft `word_addin` (JOB 660 K1.1). Ohne sie sähe ein
 *  Entwurf aus dem Word-Fenster aus wie einer aus der Web-Vordertür. */
function m4Herkunft(src: string): number {
  return (ausfuehrbar(src).match(/origin:\s*"word_addin"/g) ?? []).length;
}

/** M5 · Die zwei Deep-Link-ROUTEN bleiben Routen. Ein Suchen-und-Ersetzen auf „frontdoor" hätte
 *  sie mit erwischt und die Entwurf-fortsetzen-Mechanik zerstört (JOB 660 D3, ausdrücklich). */
function m5DeepLinks(src: string): number {
  return (ausfuehrbar(src).match(/"\/capture\/frontdoor\?draft="/g) ?? []).length;
}

/** M6 · KEIN Abrufziel verlässt den eigenen Ursprung. Genau das versprechen die Pin-Kommentare
 *  bei jedem Wandern in Prosa („kein neuer Fremd-Ursprung"). */
function m6FremdeZiele(src: string): string[] {
  return abrufziele(src).filter((ziel) => /^["'`]?(https?:)?\/\//.test(ziel));
}

/** M7 · Die Menge der Abrufziele ist der bekannte Bestand. Ein NEUES Ziel ist die
 *  Auslieferungsfolge, die ein Pin allein nicht benennen kann. */
// ================================================================================================
// JOB 1077 D7 — DIE BEWUSSTE ANTWORT ZUM ZEHNTEN ABRUFZIEL (9 → 10).
// ================================================================================================
//
// Diese Zahl wird nicht „nachgezogen", weil ein Test rot war. M7 hat genau die Frage gestellt, für
// die er gebaut wurde — „CSP? Recht? Manifest?" —, und hier steht die Antwort, bevor die Zahl steigt.
//
// DAS NEUE ZIEL: ein `HEAD` auf `/word-addin/taskpane.html` (`kwFassungAbgleichen`). Es ist das
// ungewöhnlichste Ziel dieser Liste, weil es KEINE fremde Adresse ist, sondern DIE EIGENE: genau der
// Pfad, von dem diese Seite selbst geladen wurde. Die Seite fragt ihren eigenen Server, ob sie noch
// die ausgelieferte Fassung ist.
//
//   · CSP:      unverändert. `connect-src 'self'` deckt die eigene Adresse; es kommt kein Ursprung
//               hinzu, den die Seite nicht ohnehin schon benutzt hat, um zu existieren.
//   · Recht:    keines. Die Auslieferung ist öffentlich statisch — dieselbe Route, die den GET
//               beantwortet, beantwortet den HEAD (`services/app/src/web-static.ts`).
//   · Manifest: unverändert. Kein neuer Pfad, keine neue Domain, keine neue Berechtigung; die
//               K7-Kennung `?v=<Version>` bleibt unberührt (gepinnt in
//               `tests/app/word-addin-taskpane-version-contract.test.ts`, B5).
//   · Nutzlast: keine. `HEAD` sendet keinen Körper und empfängt keinen; gelesen wird EIN Kopf.
//   · Frequenz: einmal je Laden des Aufgabenfensters. Kein Intervall, kein Wiederholzyklus.
//
// AUSLIEFERUNGSFOLGE für ein installiertes Add-in: KEIN erneutes Sideload. Antwortet ein älterer
// Server den Kopf nicht, bleibt die Zeile ehrlich bei „Abgleich nicht möglich" — nie bei „aktuell".
// ================================================================================================
// JOB 2613 D3 — DIE BEWUSSTE ANTWORT ZUM ELFTEN ABRUFZIEL (10 → 11).
// ================================================================================================
//
// Auch diese Zahl wird nicht „nachgezogen", weil ein Test rot war. M7 stellt die Frage, für die er
// gebaut ist — „CSP? Recht? Manifest?" —, und hier steht die Antwort, bevor die Zahl steigt.
//
// DAS NEUE ZIEL: `POST /api/drafts/from-docx` (`sendeDocxDatei`). Es schickt die GANZE `.docx` an
// den eigenen Server, statt Bilder einzeln über `inlinePictures` nachzuholen. Der Grund ist Pedis
// eigener Befund (Panel-Stand 2026-08-28 01:41Z): Auf dem alten Weg kam bei ihm KEIN Bild an.
//
//   · CSP:      unverändert. `connect-src 'self'` deckt die eigene Adresse; es kommt kein Ursprung
//               hinzu — dieselbe Herkunft, die das Panel ohnehin für `/api/drafts` nutzt.
//   · Recht:    keines zusätzlich. Die Route verlangt `ko.create` wie `POST /api/drafts` und prüft
//               die Anmeldung VOR dem Body-Parsing (`capture-routes.ts`, `requireAuthedBeforeParse`).
//               Eingetragen in der RBAC-Matrix (`tests/security/routeGuardAudit.ts`) und im
//               Lesewege-Register (`tests/security/mega74-lesewege-sammler.test.ts`).
//   · Manifest: UNVERÄNDERT — und das ist der heikelste Punkt. `getFileAsync` gehört zum
//               Requirement-Set „File 1.1", das Manifest nennt nur `WordApi 1.1`
//               (`klara-manifest.xml:33-37`). Es wird NICHT erweitert: das erzwänge eine
//               Neuinstallation durch Pedi, und das ist seine Entscheidung. Stattdessen
//               Laufzeitversuch mit Rückfall auf den heutigen Weg.
//   · Nutzlast: die `.docx` als Base64. Deutlich grösser als die bisherigen Aufrufe — deshalb hat
//               die Route ein eigenes Limit von 30 MiB (wie `/api/objects`), nicht die 5 MiB von
//               `/api/drafts`.
//   · Frequenz: einmal je Sendevorgang mit Umfang „Ganzes Dokument". Kein Intervall.
//
// AUSLIEFERUNGSFOLGE für ein installiertes Add-in: KEIN erneutes Sideload nötig, um den ALTEN Weg
// weiter zu nutzen. Fehlt „File 1.1" auf dem Host, greift der Rückfall und alles bleibt wie heute.
const BEKANNTE_ABRUFZIELE = 11;
function m7Abrufmenge(src: string): number {
  return abrufziele(src).length;
}

/** M8 · Der Auslieferungsstempel bleibt ein PLATZHALTER, den der Build ersetzt. Eine von Hand
 *  gepflegte Zahl wäre die Doppelpflege, die mega69 Block E gerade abgeschafft hat. */
function m8Stempel(src: string): boolean {
  return /var KLARA_STAND = "__KLARA_STAND__"/.test(ausfuehrbar(src));
}

/** M9 · Keine Inline-Ereignisattribute. Sie würden einer anderen CSP folgen als der Rest der
 *  Datei — der Quelltext sagt das an Ort und Stelle. (Der Server-Header ist Sache von
 *  `word-addin-csp.test.ts`; hier geht es um die DATEI.) */
function m9InlineHandler(src: string): string[] {
  return (ausfuehrbar(src).match(/\son(click|load|error|submit|change|input)\s*=/g) ?? []).map(
    (t) => t.trim(),
  );
}

/** M10 · Jeder Abruf reist mit der Sitzung. Ohne `credentials: "include"` bekäme das Fenster
 *  stillschweigend Anmeldefehler statt Daten. */
function m10SitzungAnJedemAbruf(src: string): number {
  return (ausfuehrbar(src).match(/credentials:\s*"include"/g) ?? []).length;
}

describe("JOB 537 D4 · Merkmalsvertrag: die tragenden Eigenschaften von taskpane.html stehen", () => {
  it('M1: die Ask-Nutzlast trägt `mode: "retrieval-only"`', () => {
    expect(
      m1RetrievalOnly(quelle()),
      "Der server-garantierte Modus fehlt in der abgesetzten Nutzlast. Markierter Dokumenttext " +
        "könnte damit an ein Modell gehen — die tragendste Zusage dieser Datei.",
    ).toBe(true);
  });

  it("M2: der Ausführungsriegel steht VOR dem Absenden in `askKlara`", () => {
    expect(
      m2Riegel(quelle()),
      "Der Riegel vor `readAskSelection` fehlt. Ein gesperrter Knopf ist die Anzeige; diese " +
        "Prüfung ist die Wirkung — ohne sie verlässt die Anfrage trotz `executionAllowed: false` " +
        "das Aufgabenfenster.",
    ).toBe(true);
  });

  it("M3: die Freigabe wird strikt geprüft (`executionAllowed === true`)", () => {
    expect(
      m3StrikteFreigabe(quelle()),
      "Fail-open: eine Antwort ohne das Feld gälte als erlaubt.",
    ).toBe(true);
  });

  it("M4: beide Sendestellen tragen die Herkunft `word_addin`", () => {
    expect(m4Herkunft(quelle()), "Entwurf und Wissenslücke müssen BEIDE die Herkunft senden.").toBe(
      2,
    );
  });

  it("M5: die Deep-Link-Routen sind unversehrt geblieben", () => {
    // JOB 2613 D3: von zwei auf DREI Stellen — und die Sache dahinter ist unverändert.
    // Was M5 schützt, ist die ROUTE: dass `/capture/frontdoor?draft=` eine App-Route bleibt und
    // nicht von einem Suchen-und-Ersetzen auf „frontdoor" zur Herkunft umgeschrieben wird
    // (JOB 660 D3). Die dritte Stelle ist `zeigeEntwurfsLink` — der Deep-Link des neuen
    // `.docx`-Sendewegs, der auf DASSELBE Ziel zeigt wie die beiden anderen.
    //
    // WARUM NICHT AUF EINE STELLE ZUSAMMENGEFÜHRT: Die beiden Altstellen tragen zusätzlich den
    // Ausdruck mit `draft.id`, den `k1-word-addin-origin-panel.test.ts:94-100` mit GENAU ZWEI
    // pinnt. Ein Zusammenführen hätte jenen Wächter gebrochen — gemessen, nicht vermutet
    // (JOB 2613 D3, erster Anlauf: dort stand 1 statt 2, und der Test war rot).
    expect(
      m5DeepLinks(quelle()),
      "Die Entwurf-fortsetzen-Routen fehlen. Genau sie hätte ein Suchen-und-Ersetzen auf " +
        "„frontdoor“ mit erwischt (JOB 660 D3).",
    ).toBe(3);
  });

  it("M6: KEIN Abrufziel verlässt den eigenen Ursprung", () => {
    expect(m6FremdeZiele(quelle()), "Fremd-Ursprung im Abruf — Auslieferungsfolge.").toEqual([]);
  });

  it("M7: die Menge der Abrufziele ist der bekannte Bestand", () => {
    expect(
      m7Abrufmenge(quelle()),
      "Die Zahl der Abrufziele hat sich geändert. Das ist die Auslieferungsfolge, die der " +
        "Ganzdatei-Pin anzeigt, aber nicht benennen kann: neue Ziele brauchen eine bewusste " +
        "Antwort (CSP? Recht? Manifest?). Danach wird diese Zahl hier bewusst angehoben.",
    ).toBe(BEKANNTE_ABRUFZIELE);
  });

  it("M8: der Auslieferungsstempel bleibt ein Platzhalter für den Build", () => {
    expect(m8Stempel(quelle()), "Ohne Platzhalter wäre der Stand eine Handpflege.").toBe(true);
  });

  it("M9: keine Inline-Ereignisattribute", () => {
    expect(m9InlineHandler(quelle()), "Inline-Handler folgen einer anderen CSP.").toEqual([]);
  });

  it("M10: jeder Abruf reist mit der Sitzung", () => {
    expect(
      m10SitzungAnJedemAbruf(quelle()),
      'Es gibt Abrufe ohne `credentials: "include"` — sie bekämen Anmeldefehler statt Daten.',
    ).toBeGreaterThanOrEqual(BEKANNTE_ABRUFZIELE - 1);
  });
});

describe("JOB 537 D4 · Kalibrierung: jedes Merkmal wird an seiner eigenen Verfälschung rot", () => {
  const src = quelle();

  it("K1: ohne den Modus in der Nutzlast schlägt M1 an", () => {
    expect(
      m1RetrievalOnly(
        src.replace('locale: locale, mode: "retrieval-only"', 'locale: locale, mode: "cloud"'),
      ),
    ).toBe(false);
  });

  it("K2: ohne den Riegel schlägt M2 an", () => {
    expect(m2Riegel(src.replace("if (klaraS4FragenGesperrt()) {", "if (false) {"))).toBe(false);
  });

  it("K3: bei nachsichtiger Prüfung schlägt M3 an", () => {
    expect(m3StrikteFreigabe(src.replaceAll("executionAllowed === true", "executionAllowed"))).toBe(
      false,
    );
  });

  it("K4: fällt eine Sendestelle auf `frontdoor` zurück, schlägt M4 an", () => {
    expect(m4Herkunft(src.replace('origin: "word_addin"', 'origin: "frontdoor"'))).toBe(1);
  });

  it("K5: zerstört ein Suchen-und-Ersetzen eine Deep-Link-Route, schlägt M5 an", () => {
    // `String.replace` mit einem Textmuster trifft das ERSTE Vorkommen. Von den drei Stellen
    // (JOB 2613 D3) bleiben danach zwei — M5 erwartet drei und schlägt an. Genau das ist die
    // Kalibrierung: der Wächter merkt es, wenn EINE Route zur Herkunft umgeschrieben wird.
    expect(
      m5DeepLinks(src.replace('"/capture/frontdoor?draft="', '"/capture/word_addin?draft="')),
    ).toBe(2);
  });

  it("K6: ein fremder Ursprung im Abruf schlägt M6 an", () => {
    expect(
      m6FremdeZiele(
        src.replace('fetch("/api/auth/me"', 'fetch("https://fremd.example/api/auth/me"'),
      ),
    ).toEqual(['"https://fremd.example/api/auth/me"']);
  });

  it("K7: ein zusätzliches Abrufziel schlägt M7 an", () => {
    expect(m7Abrufmenge(`${src}\n<script>fetch("/api/neu");</script>`)).toBe(
      BEKANNTE_ABRUFZIELE + 1,
    );
  });

  it("K8: eine von Hand gepflegte Standzahl schlägt M8 an", () => {
    expect(
      m8Stempel(
        src.replace('var KLARA_STAND = "__KLARA_STAND__"', 'var KLARA_STAND = "2026-08-13"'),
      ),
    ).toBe(false);
  });

  it("K9: ein Inline-Handler schlägt M9 an", () => {
    expect(m9InlineHandler(src.replace('id="kw-stand"', 'id="kw-stand" onclick="x()"'))).toEqual([
      "onclick=",
    ]);
  });

  it("K10: fällt die Sitzung an einem Abruf weg, sinkt die Zahl aus M10", () => {
    const vorher = m10SitzungAnJedemAbruf(src);
    expect(m10SitzungAnJedemAbruf(src.replace('credentials: "include",', ""))).toBe(vorher - 1);
  });
});

describe("JOB 537 D4 · Koexistenz: die beiden Wächter reagieren nachweislich VERSCHIEDEN", () => {
  // Das ist der eigentliche Beleg für Pedis Entscheidung. Ein zweiter Wächter, der auf dieselben
  // Änderungen anschlägt wie der erste, wäre eine Dublette und keine Koexistenz.
  //
  // BEWUSST ALS VERGLEICH FORMULIERT, nicht als absolute Zusage: diese drei Fälle behaupten nicht,
  // dass die Merkmale erfüllt SIND — das prüfen M1-M10 — sondern dass die zehn Prüfungen auf einen
  // Kommentar NICHT und auf eine zerstörte Zeile SEHR WOHL reagieren. So bleiben sie auch dann
  // aussagekräftig, wenn die Datei gerade verfälscht ist (etwa während einer Gegenmutation):
  // Sie messen die EMPFINDLICHKEIT der Wächter, nicht den Zustand der Datei.
  const src = quelle();
  const nurKommentar = `${src}\n<!-- ein harmloser Kommentar -->\n`;

  function alleMerkmale(s: string): unknown[] {
    return [
      m1RetrievalOnly(s),
      m2Riegel(s),
      m3StrikteFreigabe(s),
      m4Herkunft(s),
      m5DeepLinks(s),
      m6FremdeZiele(s),
      m7Abrufmenge(s),
      m8Stempel(s),
      m9InlineHandler(s),
      m10SitzungAnJedemAbruf(s),
    ];
  }

  it("Z1: eine reine Kommentarzeile ändert an ALLEN zehn Merkmalen nichts", () => {
    expect(alleMerkmale(nurKommentar)).toEqual(alleMerkmale(src));
  });

  it("Z2: derselbe Kommentar verändert die Datei — der Ganzdatei-Pin MUSS darauf anschlagen", () => {
    // Kein zweiter Hash an einer zweiten Stelle: hier wird nur gezeigt, dass die Byteform sich
    // ändert. DASS der Pin darauf reagiert, prüft `mega69-klara-waechter.test.ts` selbst.
    // Zusammen mit Z1 ist das der Beleg für Pedis Entscheidung: derselbe Eingriff, zwei
    // verschiedene Antworten — „etwas hat sich bewegt" ja, „etwas Tragendes fehlt" nein.
    expect(nurKommentar).not.toBe(src);
  });

  it("Z3: eine zerstörte tragende Zeile macht BEIDE Wächter rot", () => {
    // Die Probe ist eine EIGENE, vollständige Miniaturquelle — nicht die Live-Datei. Sonst hinge
    // dieser Fall daran, dass die echte Datei gerade unversehrt ist, und wäre genau dann
    // aussagelos, wenn man ihn braucht.
    const probe = 'body: JSON.stringify({ question: q, locale: locale, mode: "retrieval-only" }),';
    const zerstoert = probe.replace('mode: "retrieval-only"', 'mode: "cloud"');
    expect(m1RetrievalOnly(probe)).toBe(true);
    expect(m1RetrievalOnly(zerstoert)).toBe(false); // dieser Wächter
    expect(zerstoert).not.toBe(probe); // und die Byteform, auf die der Pin sieht
  });
});
