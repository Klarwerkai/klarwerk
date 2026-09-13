// ================================================================================================
// JOB 3801 · DER ERSTE NUTZERWEG DER DEMO — EINMAL AM STÜCK GEMESSEN.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT (Auftrag §1): Jedes STÜCK des Wegs hat seine Prüfung —
// `tests/demo-zugang-start/**` den Startvertrag und den Start gegen eine leere Datenhaltung,
// `tests/capture/job2671-d2-jszip-vorpruefung.test.ts` den .docx-Import, `tests/bibliothek*` die
// Suche. Die STRECKE hatte keine: ob das, was Schritt 3 hinterlässt, für Schritt 4 reicht, wusste
// niemand. Diese Datei fährt sie — EINMAL, am Stück, an der echten App.
//
// WAS HIER NICHT NOCH EINMAL GEPRÜFT WIRD: die Stücke. Dass ein fehlender Pflichtwert den Start
// verhindert, dass die Beispieldatei und der Startvertrag nicht auseinanderlaufen, dass eine
// Zip-Bombe an der Vorprüfung fällt — alles das steht schon im Bestand und wird hier weder
// wiederholt noch nachgebaut.
//
// DIE PRÜFFOLGE STEHT GESAMMELT IN `pruefeStrecke`, und das ist der Kern der Bauform: genau dieselbe
// Folge läuft in D2 gegen eine Strecke, der der Import fehlt — und wird dort rot. Ein Durchstich, der
// auch ohne den gemessenen Schritt grün wäre, hätte nichts gemessen (Auftrag §8).
//
// RUNDE 2 (BEN, Korrekturpflichten 1 und 2): zwei Zusagen haben hier gefehlt, und ohne sie war die
// Strecke an der entscheidenden Stelle blind — der Prüfer hat beides mit Gegenproben gezeigt.
//   · Die eigene Arbeit des Menschen (Titel, AUSSAGE) und die Herkunftsangaben wurden nach dem
//     Sitzungswechsel nicht gelesen; die Fortsetzung sendete den alten Zustand zurück und
//     überbrückte den Verlust, den sie messen sollte. Jetzt wird BEIDES gelesen — aus der
//     Einzeladresse UND aus dem Listeneintrag, aus dem die Oberfläche wirklich fortsetzt.
//   · Vom Original wurde nur der Status geprüft. Jetzt werden Länge und SHA-256 verglichen.
//
// JOB 3825 (BEN zu R2, Prüfpunkt 6): der Suchschritt bewies nichts über das DOKUMENT. Er suchte mit
// „Überdruck" — einem Wort, das auch im selbst getippten Titel und in der selbst getippten Aussage
// steht. D2 hielt die Folge sogar fest: der Lauf OHNE Dokument traf trotzdem, und das galt als
// erwartet. Damit war die Strecke an ihrer wichtigsten Stelle blind — der Dokumentinhalt hätte
// unterwegs verlorengehen können, ohne dass eine Zeile rot wird. JETZT sucht sie ZUSÄTZLICH mit
// `DOKUMENTWORT` (nur in der Quelldatei), ein eigener Fall W1 misst diese Isolation am angelegten
// Objekt, und D2 ist der Unterscheider: alte Suche grün, Dokumentsuche rot.
//
// JOB 3825 RUNDE 2 (BEN, Korrekturpflicht 1): die neue NEGATIVAUSSAGE war selbst blind. „Nicht
// gefunden" ruhte allein auf dem Trefferwert, und der entsteht aus `alsListe` — das jedes
// Fehlerobjekt in eine leere Liste verwandelt. Der Prüfer liess die Suchroute mit HTTP 200 und
// `{error: …}` antworten: D2 und Ü1 blieben grün, obwohl gar keine Suche stattgefunden hatte.
// JETZT steht vor JEDER Trefferbewertung `pruefeSuchantwort` (Status UND Antwortform, mit dem
// Körper in der Meldung), und der neue Fall W2 hält diese Eigenschaft dauerhaft fest — als Fall,
// nicht als Verstellprobe, die beim nächsten Umbau niemand wiederholt.
//
// JOB 3849 (BEN zu 3825 R2, Prüfpunkt 6 — ausdrücklich bestellt): `pruefeSuchantwort` prüfte, DASS
// eine Liste kam, und nie, WAS darin steht. Am Stand davor gemessen: `["ko-1"]`, `[{}]`,
// `[{"id":""}]` und `[{"id":null}]` gingen als „erfolgreich nichts gefunden" durch — bei `["ko-1"]`
// stand das gesuchte Objekt buchstäblich in der Antwort; `[{"id":"ko-1"},null]` ergab sogar
// `trifft: true`, weil `.some` den formlosen zweiten Eintrag nie erreichte; `[null]` riss den Lauf
// mit einem `TypeError` aus `strecke.ts` ab. JETZT ist die EINTRAGSFORM die dritte Zusage, VOR jeder
// Trefferbewertung, mit Platz im Array und Istwert in der Meldung; W2 hält alle sieben Körper
// dauerhaft fest, und dieselbe Prüfung liegt auf der `similar`-Liste des Live-Checks.
//
// JOB 3849 RUNDE 2 (BEN Korrekturpflicht 1): die neue MELDUNG konnte selbst abstürzen. Ein gültiger,
// tief verschachtelter Körper kam durch `JSON.parse` und tötete dann den Istwert
// (`RangeError: Maximum call stack size exceeded`) — die Zusage „wirft nie" galt für die Bewertung
// und nicht für den Bericht. W2 (xiii)–(xv) hält jetzt auch das fest: tief, breit, und auf beiden
// Wegen. Eine Grenze, die erst nach dem vollständigen Serialisieren kürzt, ist keine Grenze.
//
// JOB 3866 (BEN zu 3849 R2, Prüfpunkt 6 — beide Punkte ausdrücklich bestellt): (xiii)–(xv) speisen
// ausschliesslich ARRAYS ein, der OBJEKTZWEIG derselben Druckhilfe war unvermessen. GEMESSEN am
// Stand davor: ein Eintrag mit zwölf Feldern über sechs Ebenen hält seine Grenze (436 Zeichen, voll
// verzweigt wie schmal), ein Feldname von 50 000 Zeichen ebenfalls — aber 5000 solche Einträge
// ergaben 1761 Zeichen, weil fünf genannte Plätze je 311 Zeichen bekamen. Die Zusage „die Meldung
// wächst nicht mit dem Eintrag" galt also für die ZAHL der Plätze und nicht für ihre LÄNGE; F9
// (5000 × `null`) konnte das nicht zeigen. F10–F12 halten beide Zweige fest. Und W3 misst den
// zweiten bestellten Punkt: dass die Ähnlichkeitsliste der Prüfroute wirklich durch diesen Leser
// VERKABELT ist — als Fall mit verfälschter HTTP-Antwort, nicht als Verstellprobe.
//
// JOB 3866 RUNDE 3 (BEN Korrekturpflicht 1 und 2): Runde 2 gab jedem genannten Platz weniger Zeichen
// und liess darunter die lückenhafte Buchführung von `drucke` stehen — Klammern, Doppelpunkte und
// Auslassungszeichen wurden geschrieben, aber nicht bezahlt, und `istwertVon` schnitt das Ergebnis
// hinterher auf Mass. Daran scheiterte auch die bestellte Gegenprobe zu F11: ohne
// `nimm(JSON.stringify(feld))` entstand der 50 000 Zeichen lange Schlüssel ganz und verschwand im
// Nachschnitt wieder, die Meldung blieb kurz, der Fall blieb grün. JETZT bezahlt `drucke` jedes
// ausgegebene Zeichen, es wird nichts mehr nachgeschnitten, F11 liest den abgeschnittenen Schlüssel
// selbst — und F13 misst die Schreibgrenze an dem einen Weg, der weder Plätze aufteilt noch kürzt.
import { describe, expect, it } from "vitest";
import {
  DOKUMENTWORT,
  EIGENER_TITEL,
  EIGENE_AUSSAGE,
  QUELLSATZ,
  SUCHWORT,
  type Streckenbefund,
  type Suchantwort,
  type Wiedersehen,
  fahreStrecke,
  liesSuchantwort,
  liesTrefferliste,
  schliesse,
} from "./strecke";

/**
 * DER ISOLATIONSWÄCHTER (JOB 3825, Lieferung 2) — die VORAUSSETZUNG jeder Aussage über die
 * Dokumentsuche, und deshalb steht er VOR ihr, nicht daneben.
 *
 * WARUM ES IHN GIBT: Bis hierher trug `strecke.ts` die Zusage „das Suchwort kommt NUR aus der
 * Datei" als Kommentar. Runde 2 zog mit `EIGENER_TITEL`/`EIGENE_AUSSAGE` einen zweiten Faden ein
 * und widerlegte sie — der Kommentar blieb trotzdem stehen und log ein Release lang mit. Ein
 * Kommentar kann eine Eigenschaft nicht halten; eine Messung kann es.
 *
 * Gemessen wird am TATSÄCHLICH angelegten Objekt, nicht an den Konstanten (s. `messeIsolation`).
 */
function pruefeIsolation(b: Streckenbefund): void {
  expect(
    b.isolation.gemessen,
    `die Isolation von „${DOKUMENTWORT}" liess sich nicht messen: ${b.isolation.fehlschlag}`,
  ).toBe(true);
  expect(
    b.isolation.imQuellsatz,
    `„${DOKUMENTWORT}" steht gar nicht im Satz aus der Quelldatei („${QUELLSATZ}") — dann ist es kein Dokumentwort und ein Treffer darauf belegt nichts`,
  ).toBe(true);
  expect(
    b.isolation.verletzteFelder,
    `„${DOKUMENTWORT}" steht nicht nur im Dokument, sondern auch in diesen Kurzfeldern des angelegten Objekts: ${b.isolation.verletzteFelder.join(", ") || "—"}. Ein Treffer könnte dann aus der eigenen Tipparbeit stammen statt aus der Datei.`,
  ).toEqual([]);
}

/**
 * DIE VORAUSSETZUNG JEDER AUSSAGE ÜBER EINE SUCHE — und zwar VOR der Trefferbewertung, nicht daneben
 * (JOB 3825 Runde 2, BEN Korrekturpflicht 1).
 *
 * WARUM ES SIE GIBT: „nicht gefunden" hing allein an `trifft === false`, und dieser Wert entstand aus
 * `alsListe`, das jeden Nicht-Listen-Körper in `[]` verwandelt. BEN liess die Suchroute mit HTTP 200
 * und `{error: "BEN_DOKUMENTSUCHE_DEFEKT"}` antworten: D2 und Ü1 blieben vollständig grün, obwohl
 * überhaupt keine Suche stattgefunden hatte. Ein Fehlerobjekt ist kein leeres Ergebnis, und ein
 * HTTP 200 allein belegt keine erfolgreiche Leersuche (Auftrag §9).
 *
 * Alle Zusagen tragen den KÖRPER in ihrer Meldung: eine rote Stelle soll sagen, WAS statt der Liste
 * kam, nicht nur „erwartet 200, war 503".
 *
 * JOB 3849 — DIE DRITTE ZUSAGE, und sie steht mit Absicht VOR der Trefferbewertung. Bis hierher
 * prüfte diese Funktion, DASS eine Liste kam, und nie, WAS darin steht. Gemessen am Stand davor:
 * `["ko-1"]`, `[{}]`, `[{"id":""}]` und `[{"id":null}]` gingen als „erfolgreich nichts gefunden"
 * durch — bei `["ko-1"]` stand das gesuchte Objekt buchstäblich in der Antwort. `[{"id":"ko-1"},null]`
 * lieferte sogar `trifft: true`, weil `.some` den formlosen zweiten Eintrag nie erreichte, und
 * `[null]` riss den Lauf mit einem `TypeError` ab, bevor eine dieser Zeilen überhaupt lief.
 *
 * Die Reihenfolge ist der Inhalt: Status → Listenform → EINTRAGSFORM → und erst danach darf ein
 * Aufrufer `trifft` lesen. Stünde die neue Zusage hinter der Trefferbewertung, käme F6 als Treffer
 * durch. Die Meldung trägt Platz im Array, Istwert des Eintrags und den Körper — ein blosser
 * Wahrheitswert wäre wieder die „erwartet 200, war 503"-Meldung, die hier schon einmal zu wenig war.
 */
function pruefeSuchantwort(
  status: number,
  istListe: boolean,
  eintraegeGueltig: boolean,
  eintragsFehlschlag: string,
  koerper: string,
  wo: string,
): void {
  expect(
    status,
    `${wo}: die Suche antwortete mit HTTP ${status} statt 200 — Körper: ${koerper}. Ein Fehlschlag ist kein leeres Ergebnis.`,
  ).toBe(200);
  expect(
    istListe,
    `${wo}: die Suche antwortete zwar mit HTTP 200, aber nicht mit einer Trefferliste — Körper: ${koerper}. Ein Fehlerobjekt ist kein leeres Ergebnis, und „nicht gefunden" wäre hier eine Behauptung ohne Messung.`,
  ).toBe(true);
  expect(
    eintraegeGueltig,
    `${wo}: es kam zwar eine Liste, aber ihre Einträge sind nicht bewertbar — ${eintragsFehlschlag}. Körper: ${koerper}. Ein formloser Eintrag ist keine Nicht-Übereinstimmung: „nicht gefunden" wäre hier eine Behauptung ohne Messung, und ein gültiger Eintrag daneben heilt ihn nicht.`,
  ).toBe(true);
}

/**
 * DIE VORAUSSETZUNG JEDER AUSSAGE ÜBER DIE ÄHNLICHKEITSLISTE DES LIVE-CHECKS — dieselbe Reihenfolge
 * wie an den Suchen: erst die Form, dann der Treffer.
 *
 * EIGENE FUNKTION SEIT JOB 3866, und das ist ihr ganzer Zweck: W3 fährt GENAU diese Zusage gegen
 * eine verfälschte Antwort der Prüfroute. Stünde sie weiter als lose Zeile in `pruefeStrecke`, hätte
 * W3 sie nachbauen müssen — und ein nachgebauter Formbegriff misst die Strecke nicht (dieselbe Regel
 * wie bei (xii)).
 */
function pruefeAehnlichkeitsliste(b: Streckenbefund, wo: string): void {
  expect(
    b.fund.pruefungEintraegeGueltig,
    `${wo}: die Ähnlichkeitsliste des Live-Checks war nicht bewertbar — ${b.fund.pruefungEintragsFehlschlag}. Ohne bewertbare Einträge ist „die Prüfung findet nichts" eine Behauptung ohne Messung.`,
  ).toBe(true);
}

/**
 * WAS NACH DEM SITZUNGSWECHSEL VOLLSTÄNDIG ZURÜCKGEKOMMEN SEIN MUSS. Zweimal angewandt — auf die
 * Einzeladresse und auf den Listeneintrag —, weil ein Verlust auf nur EINEM der beiden Wege genau
 * die Art Halbheit ist, an der eine Vorführung scheitert: die Oberfläche setzt aus der Liste fort.
 */
function pruefeWiedersehen(w: Wiedersehen, objektId: string, wo: string): void {
  expect(w.titel, `${wo}: der eigene Titel überlebte den Sitzungswechsel nicht`).toBe(
    EIGENER_TITEL,
  );
  // DIE ZEILE, DIE IN RUNDE 1 GEFEHLT HAT. Die Aussage ist das, was der Mensch selbst geschrieben
  // hat — sie steht in keiner Quelldatei und ist durch nichts anderes wiederherstellbar.
  expect(w.aussage, `${wo}: die eigene Aussage kam nicht zurück`).toBe(EIGENE_AUSSAGE);
  expect(
    w.quellsatzDa,
    `${wo}: der übernommene Dokumentinhalt („${QUELLSATZ}") kam nicht zurück`,
  ).toBe(true);
  // DIE HERKUNFT (mega20 D): ohne diese beiden Felder stünde übernommener Text ohne Beleg da, und
  // der Quellenwiederaufruf in Schritt 5 wäre nicht mehr möglich.
  expect(w.ankerObjekte, `${wo}: das gesicherte Original ist nicht mehr am Entwurf`).toEqual([
    objektId,
  ]);
  expect(w.ankerName, `${wo}: das Ankerdokument trägt nicht mehr den Dateinamen`).toBe(
    "sample.docx",
  );
  expect(w.belegObjekte, `${wo}: die Belegstelle zeigt nicht mehr auf das Original`).toEqual([
    objektId,
  ]);
  expect(w.belegZitat, `${wo}: das Belegzitat aus der Quelldatei ist verloren`).toBe(QUELLSATZ);
}

/**
 * DIE ZUSICHERUNGEN DER GANZEN STRECKE — eine Funktion, zwei Verwendungen (Durchstich und
 * Red-first-Nachweis). Jede Zeile trägt ihren Grund in der Meldung, damit eine rote Stelle sagt,
 * WAS der Nutzer verloren hätte, nicht nur welcher Wert nicht passte.
 */
function pruefeStrecke(b: Streckenbefund): void {
  // ---- 1 · LEERE ERSTEINRICHTUNG -------------------------------------------------------------
  expect(b.leer.statusVorAnmeldung, "die leere Instanz gibt keine Auskunft über sich").toBe(200);
  expect(b.leer.needsSetup, "der leere Stand sagt nicht, dass er leer ist").toBe(true);
  // BEN (Prüflücke 6): ZUERST Status und Form, DANN die Zahl. Eine 500er-Antwort ergäbe über
  // `Array.isArray` ebenfalls „0 Einträge" — ein Serverfehler sähe aus wie eine saubere Leere, und
  // genau das ist die Sorte Leere, die eine Vorführung platzen lässt.
  expect(b.leer.bestandStatus, "die Bestandsroute antwortete nicht mit 200").toBe(200);
  expect(b.leer.bestandIstListe, "der Bestand kam nicht als Liste — das ist keine Leere").toBe(
    true,
  );
  expect(b.leer.entwuerfeStatus, "die Entwurfsroute antwortete nicht mit 200").toBe(200);
  expect(b.leer.entwuerfeIstListe, "die Entwürfe kamen nicht als Liste").toBe(true);
  expect(b.leer.wissensobjekte, "der Bestand war nicht leer").toBe(0);
  expect(b.leer.entwuerfe, "es lagen schon Entwürfe da").toBe(0);

  // ---- 2 · KONTO ------------------------------------------------------------------------------
  expect(b.konto.status, "die Ersteinrichtung legte kein Konto an").toBe(201);
  // „Eine Rolle, die die folgenden Schritte decken darf" (Auftrag §2.2): das erste Konto ist Admin
  // und freigegeben — ohne Freigabe käme es nicht einmal durch die Anmeldung.
  expect(b.konto.rolle, "das erste Konto trägt nicht die deckende Rolle").toBe("admin");
  expect(b.konto.freigegeben, "das erste Konto ist nicht freigegeben").toBe(true);
  expect(b.konto.needsSetupDanach, "die Instanz hält sich danach weiter für leer").toBe(false);
  // „Kontrolliert angelegt": es gibt genau EINE Ersteinrichtung.
  expect(b.konto.zweiteEinrichtung, "eine zweite Ersteinrichtung wäre möglich").toBe(409);

  // ---- 3 · DIE ECHTE QUELLE KOMMT HEREIN ------------------------------------------------------
  expect(b.quelle.entwurfStatus, "aus der echten Datei entstand kein Entwurf").toBe(201);
  expect(
    b.quelle.quellsatzImEntwurf,
    `der Satz aus der Quelldatei („${QUELLSATZ}") steht nicht im Entwurf — der Import hat Inhalt verloren`,
  ).toBe(true);
  expect(b.quelle.objektStatus, "das Original wurde nicht gesichert").toBe(201);
  expect(b.quelle.objektName, "das gesicherte Original trägt nicht den Dateinamen").toBe(
    "sample.docx",
  );

  // ---- 4 · SPEICHERN, WEGGEHEN, WIEDERKOMMEN --------------------------------------------------
  expect(b.entwurf.speichernStatus, "der Entwurf liess sich nicht speichern").toBe(200);
  expect(b.entwurf.abmeldenStatus, "das Abmelden scheiterte").toBe(204);
  // DER NEUAUFBAU IST ECHT, und beide Hälften werden gemessen: die alte Sitzung ist TOT (sonst wäre
  // „wiederkommen" nur „nie weggegangen"), und die neue ist eine ANDERE.
  expect(b.entwurf.alteSitzung, "die abgemeldete Sitzung las weiter — kein echter Neuaufbau").toBe(
    401,
  );
  expect(b.entwurf.zweiteAnmeldung, "die zweite Anmeldung gelang nicht").toBe(200);
  expect(b.entwurf.sitzungTauschte, "die Sitzungskennung blieb dieselbe").toBe(true);
  expect(b.entwurf.wiederoeffnenStatus, "der Entwurf war nicht wieder zu öffnen").toBe(200);
  // Ein zurückgehaltener Body wäre hier das Symptom: `anchorsMissing` sagt, dass das Original fehlt.
  expect(b.entwurf.ankerFehlend, "ein gesichertes Original fehlte").toEqual([]);
  // Die Oberfläche setzt aus der LISTE fort, nicht über die Einzeladresse (capture/src/service.ts,
  // `listDraftsForResume`). Fehlte er dort, käme der Mensch nie an den Entwurf.
  expect(b.entwurf.listeStatus, "die Entwurfsliste antwortete nicht").toBe(200);
  expect(b.entwurf.inListe, "der Entwurf fehlte in der Liste, aus der man fortsetzt").toBe(true);
  // BEIDE Wege müssen ALLES zurückgeben — eigene Arbeit, übernommenen Inhalt und Herkunft.
  pruefeWiedersehen(b.entwurf.einzel, b.quelle.objektId, "GET /api/drafts/:id");
  pruefeWiedersehen(b.entwurf.liste, b.quelle.objektId, "Eintrag aus GET /api/drafts");

  // ---- 5 · ERLAUBTE PRÜFUNG, SUCHE, QUELLENWIEDERAUFRUF ---------------------------------------
  // DIE FORTSETZUNG SPEIST SICH AUS WIEDERGELADENEN DATEN — und das ist selbst eine Zusage, keine
  // Bauweise. Stünde hier „alt" oder „einzel", hätte die Strecke den Sitzungswechsel umgangen und
  // alles Folgende wäre wertlos (BEN, Korrekturpflicht 1).
  expect(
    b.entwurf.fortsetzungAus,
    "Schritt 5 nahm seinen Inhalt NICHT aus dem Listeneintrag der neuen Sitzung",
  ).toBe("liste");
  expect(
    b.fund.ankerQuelle,
    "die Herkunftsangabe der Anlage stammte nicht aus dem wiedergeladenen Entwurf",
  ).toBe("wiedergeladen");
  expect(
    b.fund.anlageStatus,
    `aus dem Entwurf entstand kein Wissensobjekt (${b.fund.anlageFehler || "ohne Fehlercode"})`,
  ).toBe(201);
  // UND WAS IM BESTAND LANDET, IST SEIN SATZ. Das Ende der Kette: aus der Datei über Speichern,
  // Abmelden, Wiederanmelden und Fortsetzen bis ins Wissensobjekt, ohne dass unterwegs ein Wort
  // aus dem Zustand der alten Sitzung nachgeliefert wurde.
  expect(b.fund.koTitel, "das Wissensobjekt trägt nicht den eigenen Titel").toBe(EIGENER_TITEL);
  expect(b.fund.koAussage, "das Wissensobjekt trägt nicht die eigene Aussage").toBe(EIGENE_AUSSAGE);
  expect(b.fund.pruefungStatus, "die erlaubte Prüfung war nicht erlaubt").toBe(200);
  expect(b.fund.pruefungOhneAnmeldung, "dieselbe Prüfung lief auch ohne Anmeldung").toBe(401);
  // ZUERST DIE FORM DER ÄHNLICHKEITSLISTE, DANN IHR TREFFER (JOB 3849, Lieferung 6). Dieselbe
  // Schwäche wie an den Suchen, nur an der Prüfroute: `similar: ["ko-1"]` hätte hier ein stilles
  // „die Prüfung findet den Doppelgänger nicht" ergeben, `similar: [null]` einen `TypeError` mitten
  // in `fahreStrecke`. Derselbe Prüfweg, kein zweiter Formbegriff (`liesTrefferliste`).
  pruefeAehnlichkeitsliste(b, "POST /api/knowledge/check");
  expect(b.fund.pruefungTrifft, "die Prüfung fand das eben Geschriebene nicht").toBe(true);
  // EHRLICHKEIT VOR OPTIK, und hier ist sie messbar: ohne Modell läuft KEIN Widerspruchsprüfer, und
  // der Live-Check sagt das („pending"), statt „done" zu behaupten. Ein „done" an dieser Stelle wäre
  // die starke Aussage ohne ihre Voraussetzung.
  expect(b.fund.pruefungStand, "die Prüfung behauptet ein Urteil, das sie nicht gefällt hat").toBe(
    "pending",
  );
  pruefeSuchantwort(
    b.fund.sucheStatus,
    b.fund.sucheIstListe,
    b.fund.sucheEintraegeGueltig,
    b.fund.sucheEintragsFehlschlag,
    b.fund.sucheKoerper,
    `GET /api/library/search?q=${SUCHWORT}`,
  );
  // DER DURCHGEHENDE FADEN: das Angelegte ist nach Sitzungswechsel und Anlage auffindbar. Dass
  // `SUCHWORT` auch im selbst getippten Titel steht, ist hier kein Mangel — dieser Schritt misst
  // den Faden als Ganzes. Was er NICHT belegt, ist die Dokumentsuche; die steht darunter.
  expect(b.fund.sucheTrifft, "das Geschriebene ist nicht auffindbar").toBe(true);

  // ---- DIE DOKUMENTSUCHE, ISOLIERT (JOB 3825) -------------------------------------------------
  // ZUERST DIE VORAUSSETZUNG. Ohne sie wäre alles Folgende eine starke Aussage ohne ihren Grund:
  // ein Treffer auf ein Wort, das auch im Titel steht, sagt nichts über das Dokument.
  pruefeIsolation(b);
  pruefeSuchantwort(
    b.fund.sucheDokumentStatus,
    b.fund.sucheDokumentIstListe,
    b.fund.sucheDokumentEintraegeGueltig,
    b.fund.sucheDokumentEintragsFehlschlag,
    b.fund.sucheDokumentKoerper,
    `GET /api/library/search?q=${DOKUMENTWORT}`,
  );
  // DAS NUTZERVERSPRECHEN DER DEMO, und erst hier ist es gemessen: „die Anwendung findet, was in
  // MEINEM DOKUMENT steht." `DOKUMENTWORT` hat der Mensch nirgends getippt — es kann nur über
  // Import, Entwurf, Sitzungsneuaufbau und Anlage bis in die Suchprojektion gekommen sein.
  expect(
    b.fund.sucheDokumentTrifft,
    `„${DOKUMENTWORT}" steht nur in der Quelldatei und wurde nicht gefunden — der Dokumentinhalt ist unterwegs verlorengegangen`,
  ).toBe(true);
  // UND DER TIEFERE BELEG. Die Route liefert `KnowledgeObject[]` und trägt die `matched`-Flags
  // nicht mit; ein Treffer allein sagt darum nur „irgendein Feld passte". Gefragt wird deshalb
  // derselbe Suchvertrag eine Ebene tiefer. Ein FEHLENDER Treffer ist ein benannter Fehlschlag —
  // die Flags werden nie aus einem `undefined` heraus behauptet.
  expect(
    b.fund.dokumentTreffer.gefunden,
    `der gemeinsame Suchvertrag lieferte keinen Treffer auf das angelegte Objekt: ${b.fund.dokumentTreffer.fehlschlag}`,
  ).toBe(true);
  expect(b.fund.dokumentTreffer.flaggen, "der Treffer kam ohne seine matched-Flags").toBeDefined();
  expect(
    b.fund.dokumentTreffer.flaggen,
    "der Treffer kam NICHT aus dem Dokumentrumpf",
  ).toMatchObject({ body: true, title: false, statement: false, category: false, tag: false });
  // DER QUELLENWIEDERAUFRUF — die Frage jedes Demo-Besuchers: „und woher steht das?" Der Beleg am
  // Fund zeigt auf GENAU das Original, das in Schritt 3 gesichert wurde.
  expect(b.fund.belegObjektId, "der Fund trägt keinen Beleg auf ein Original").not.toBe("");
  expect(b.fund.belegObjektId, "der Beleg zeigt auf ein anderes Original als das gesicherte").toBe(
    b.quelle.objektId,
  );
  expect(b.fund.quelleStatus, "die Quelle war vom Fund aus nicht wieder erreichbar").toBe(200);
  expect(b.fund.quelleName, "die wiedergefundene Quelle ist nicht die Datei von Schritt 3").toBe(
    "sample.docx",
  );
  expect(b.fund.rohbytesStatus, "die Bytes des Originals waren nicht abrufbar").toBe(200);
  // BEN (Korrekturpflicht 2): HTTP 200 heisst nur, dass IRGENDETWAS kam. Wer in der Demo auf die
  // Quelle klickt, will die Datei, die er hereingebracht hat — nicht eine Antwort mit dem richtigen
  // Status. Länge zuerst, weil ihre Meldung lesbar ist; der Abdruck fängt alles Übrige.
  expect(b.fund.rohLaenge, "das heruntergeladene Original hat eine andere Länge").toBe(
    b.quelle.laenge,
  );
  expect(b.fund.rohAbdruck, "das heruntergeladene Original ist nicht Byte für Byte die Datei").toBe(
    b.quelle.abdruck,
  );
}

describe("JOB 3801 · der erste Nutzerweg, am Stück", () => {
  it("D1 · DURCHSTICH: leer → Konto → echte Quelle → Entwurf wiedergefunden → auffindbar mit Quelle", async () => {
    const lauf = await fahreStrecke();
    try {
      pruefeStrecke(lauf.befund);
      // Der Verlauf ist kein Schmuck: er ist die Liste der WIRKLICH gefallenen Adressen. Eine
      // Strecke, die nur die Hälfte der Schritte fährt, wäre sonst an den Einzelwerten nicht zu
      // erkennen. Gezählt wird gegen den gemessenen Stand dieses Laufs.
      // 21 bis JOB 3801; die zweite Suche mit `DOKUMENTWORT` (JOB 3825) ist die 22. Adresse.
      expect(lauf.befund.verlauf.length).toBe(22);
      expect([...new Set(lauf.befund.verlauf.map((s) => s.schritt))]).toEqual([
        "1 leer",
        "2 konto",
        "3 quelle",
        "4 entwurf",
        "5 fund",
      ]);
    } finally {
      await schliesse(lauf);
    }
  }, 120_000);

  it("D2 · §8 NICHT TRIVIAL GRÜN: ohne den Import wird dieselbe Prüffolge rot — am Dokumentinhalt", async () => {
    // Derselbe Weg, ein Schritt fehlt: die Quelle kommt NICHT herein, der Mensch tippt selbst.
    // Konto, Speichern, Sitzungsneuaufbau und Anlage laufen unverändert und bleiben grün.
    //
    // UND HIER STEHT DER KERN (JOB 3825). Die alte Suche bleibt grün, OBWOHL nie ein Dokument da
    // war — `SUCHWORT` steht eben auch im selbst getippten Titel, der Treffer entsteht aus der
    // eigenen Tipparbeit. Bis Runde 2 war das der blinde Fleck: an dieser einen Zusage hätte man
    // nicht unterscheiden können, ob der Dokumentinhalt die Strecke überlebt hat oder nie da war.
    // Die Suche nach `DOKUMENTWORT` unterscheidet es — sie ist hier ROT, während sie in D1 grün
    // ist. Genau dieser Unterschied ist das, was die Strecke jetzt über das Dokument beweist.
    const lauf = await fahreStrecke({ ohne: "import" });
    try {
      expect(() => pruefeStrecke(lauf.befund)).toThrow(/Quelldatei/);
      // Und der Gegenbeweis in derselben Messung: der Rest der Strecke ist NICHT mitgefallen. Wäre
      // er es, stünde die rote Stelle für „irgendetwas ging schief" und nicht für den Import.
      expect(lauf.befund.konto.rolle).toBe("admin");
      expect(lauf.befund.entwurf.wiederoeffnenStatus).toBe(200);
      expect(lauf.befund.fund.anlageStatus).toBe(201);
      pruefeSuchantwort(
        lauf.befund.fund.sucheStatus,
        lauf.befund.fund.sucheIstListe,
        lauf.befund.fund.sucheEintraegeGueltig,
        lauf.befund.fund.sucheEintragsFehlschlag,
        lauf.befund.fund.sucheKoerper,
        `D2 · GET /api/library/search?q=${SUCHWORT}`,
      );
      expect(
        lauf.befund.fund.sucheTrifft,
        `„${SUCHWORT}" steht im selbst getippten Titel — dieser Treffer muss auch ohne Dokument kommen`,
      ).toBe(true);
      // ZUERST DIE VORAUSSETZUNG, DANN DIE NEGATIVAUSSAGE — und diese Reihenfolge ist der ganze
      // Inhalt von BENs Korrekturpflicht 1. Vorher stand hier nur der Status; ein `{error: …}` mit
      // HTTP 200 kam damit als „erfolgreich nichts gefunden" durch, und die unterscheidende Zeile
      // darunter war eine Behauptung ohne Messung.
      pruefeSuchantwort(
        lauf.befund.fund.sucheDokumentStatus,
        lauf.befund.fund.sucheDokumentIstListe,
        lauf.befund.fund.sucheDokumentEintraegeGueltig,
        lauf.befund.fund.sucheDokumentEintragsFehlschlag,
        lauf.befund.fund.sucheDokumentKoerper,
        `D2 · GET /api/library/search?q=${DOKUMENTWORT}`,
      );
      // DIE UNTERSCHEIDENDE ZEILE. Ohne Dokument gibt es keinen Dokumenttreffer. Wäre sie `true`,
      // käme der Treffer aus etwas anderem als der Datei, und der Nachweis wäre wertlos.
      expect(
        lauf.befund.fund.sucheDokumentTrifft,
        `„${DOKUMENTWORT}" wurde gefunden, obwohl nie ein Dokument da war — dann steht das Wort nicht nur in der Datei`,
      ).toBe(false);
      // Und dieselbe Aussage eine Stufe tiefer: der gemeinsame Suchvertrag findet das Objekt nicht,
      // und er sagt WARUM, statt fünf Flags aus dem Nichts zu behaupten.
      expect(lauf.befund.fund.dokumentTreffer.gefunden).toBe(false);
      expect(lauf.befund.fund.dokumentTreffer.flaggen).toBeUndefined();
      expect(lauf.befund.fund.dokumentTreffer.fehlschlag).not.toBe("");
      // Das Wort ist auch hier isoliert — die rote Stelle ist der fehlende Import, nicht ein
      // schlecht gewähltes Suchwort.
      pruefeIsolation(lauf.befund);
      // Das Produkt hat nichts erfunden: ohne Dokument steht kein Dokumentsatz im Entwurf — weder
      // beim Anlegen noch nach dem Sitzungswechsel, und auf keinem der beiden Ladewege.
      expect(lauf.befund.quelle.quellsatzImEntwurf).toBe(false);
      expect(lauf.befund.entwurf.einzel.quellsatzDa).toBe(false);
      expect(lauf.befund.entwurf.liste.quellsatzDa).toBe(false);
      // Die EIGENE Arbeit kam trotzdem zurück — der Import fehlt, der Mensch nicht. Und die
      // Fortsetzung lief auch hier über wiedergeladene Daten: die rote Stelle ist der Import, nicht
      // ein ausgefallener Ladeweg.
      expect(lauf.befund.entwurf.liste.aussage).toBe(EIGENE_AUSSAGE);
      expect(lauf.befund.entwurf.fortsetzungAus).toBe("liste");
      expect(lauf.befund.fund.ankerQuelle).toBe("wiedergeladen");
    } finally {
      await schliesse(lauf);
    }
  }, 120_000);

  it("Ü1 · ÜBERGANG 4→5: ohne gesichertes Original hält der Weg an, statt halb zu gelingen", async () => {
    // DER ÜBERGANG, DEN NIEMAND GEFAHREN IST: der Entwurf beruft sich auf ein Original, das es nicht
    // gibt. Die Stücke allein können das nicht zeigen — es entsteht erst zwischen Speichern (4) und
    // Anlegen (5). Gemessen wird, dass BEIDE Tore greifen und das Ergebnis vollständig ausbleibt.
    const lauf = await fahreStrecke({ ohne: "quellensicherung" });
    try {
      const b = lauf.befund;
      // Der Entwurf kommt zurück — aber OHNE den übernommenen Text, und er sagt, welches Original
      // fehlt (services/capture/src/service.ts, `resumeDraft`).
      expect(b.entwurf.wiederoeffnenStatus).toBe(200);
      expect(b.entwurf.einzel.titel, "die eigene Arbeit wurde mitzerstört").toBe(EIGENER_TITEL);
      expect(b.entwurf.einzel.aussage, "die eigene Arbeit wurde mitzerstört").toBe(EIGENE_AUSSAGE);
      expect(b.entwurf.einzel.quellsatzDa, "Dokumentinhalt kam ohne seine Herkunft zurück").toBe(
        false,
      );
      expect(b.entwurf.ankerFehlend).toEqual(["erfunden-nie-gesichert"]);
      // Die AUSDÜNNUNG greift auf BEIDEN Ladewegen: Herkunftsangaben auf ein verschwundenes Original
      // sind keine Belege, also kommen sie gar nicht zurück (`withAnchorCheck`).
      expect(b.entwurf.einzel.ankerObjekte).toEqual([]);
      expect(b.entwurf.einzel.belegObjekte).toEqual([]);
      expect(b.entwurf.liste.ankerObjekte).toEqual([]);
      expect(b.entwurf.liste.belegObjekte).toEqual([]);
      // GENAU DESHALB steht hier `"alt"`: der wiedergeladene Entwurf trägt keine Herkunft mehr, die
      // Anlage kann sie nur noch aus dem Formularzustand behaupten. Das ist der Fall des Clients,
      // der die Quelle noch zu kennen glaubt — und der einzige, in dem das Ankertor überhaupt
      // gefragt wird.
      expect(b.fund.ankerQuelle).toBe("alt");
      expect(b.entwurf.fortsetzungAus).toBe("alt");
      // Und die Anlage findet nicht statt — mit benanntem Grund, nicht als Serverfehler.
      expect(b.fund.anlageStatus).toBe(400);
      expect(b.fund.anlageFehler).toBe("MISSING_DRAFT_ANCHOR");
      // NICHTS IST HALB ENTSTANDEN: kein Objekt, kein Fund, keine Quelle.
      expect(b.fund.koId).toBe("");
      // Auf BEIDEN Suchwegen nichts — es entsteht gar kein Objekt, also auch keins, das ein
      // Dokumentwort tragen könnte. Aber „nichts" gilt erst, wenn BEIDE Suchen mit einer echten
      // Trefferliste geantwortet haben: hier sind beide Aussagen negativ, hier ruht also alles auf
      // der Antwortform (BEN, Korrekturpflicht 1). Erst die Voraussetzung, dann die Aussage.
      pruefeSuchantwort(
        b.fund.sucheStatus,
        b.fund.sucheIstListe,
        b.fund.sucheEintraegeGueltig,
        b.fund.sucheEintragsFehlschlag,
        b.fund.sucheKoerper,
        `Ü1 · GET /api/library/search?q=${SUCHWORT}`,
      );
      pruefeSuchantwort(
        b.fund.sucheDokumentStatus,
        b.fund.sucheDokumentIstListe,
        b.fund.sucheDokumentEintraegeGueltig,
        b.fund.sucheDokumentEintragsFehlschlag,
        b.fund.sucheDokumentKoerper,
        `Ü1 · GET /api/library/search?q=${DOKUMENTWORT}`,
      );
      expect(b.fund.sucheTrifft).toBe(false);
      expect(b.fund.sucheDokumentTrifft).toBe(false);
      // Und der Dienst wurde ehrlich gar nicht erst gefragt, statt ein „nicht getroffen" zu
      // behaupten, für das es kein Objekt gibt.
      expect(b.fund.dokumentTreffer.gefragt).toBe(false);
      expect(b.fund.dokumentTreffer.flaggen).toBeUndefined();
      expect(b.isolation.gemessen, "ohne angelegtes Objekt ist die Isolation nicht messbar").toBe(
        false,
      );
      expect(b.fund.belegObjektId).toBe("");
      expect(b.fund.quelleStatus).toBe(404);
    } finally {
      await schliesse(lauf);
    }
  }, 120_000);

  it("W1 · ISOLATIONSWÄCHTER: das Dokumentwort steht in der Datei — und in keinem Kurzfeld des angelegten Objekts", async () => {
    // EIN EIGENER, DAUERHAFTER FALL, und das ist Absicht: die Eigenschaft, auf der der ganze
    // Dokumentnachweis ruht, soll für sich rot werden können — mit einer Meldung, die das Wort und
    // das verletzende Feld nennt. Als blosse Zeile innerhalb der Strecke wäre sie beim nächsten
    // Umbau wieder das, was sie bis JOB 3825 war: ein Kommentar, den niemand nachmisst.
    const lauf = await fahreStrecke();
    try {
      pruefeIsolation(lauf.befund);
      // Und die Gegenrichtung in derselben Messung: `SUCHWORT` ist NICHT isoliert. Ohne diese
      // Zeile könnte der Wächter zahnlos sein, ohne dass es auffiele — sie zeigt, dass er den
      // Unterschied wirklich sieht und nicht jedes Wort durchwinkt.
      expect(
        EIGENER_TITEL.toLowerCase().includes(SUCHWORT.toLowerCase()),
        `„${SUCHWORT}" steht nicht mehr im eigenen Titel — dann misst D2 den Unterschied nicht mehr`,
      ).toBe(true);
      expect(
        EIGENER_TITEL.toLowerCase().includes(DOKUMENTWORT.toLowerCase()),
        `„${DOKUMENTWORT}" steht im eigenen Titel`,
      ).toBe(false);
    } finally {
      await schliesse(lauf);
    }
  }, 120_000);

  it("W2 · ANTWORTFORM: ein Fehlerobjekt, eine 503 und ein formloser Listeneintrag sind kein Beleg für „nichts gefunden“", () => {
    // DER DAUERHAFTE GEGENFALL ZU BENS GEGENPROBE (Runde 1, Prüflücke 6). Er braucht keine Strecke:
    // gemessen wird das Paar, an dem die Blindheit hing — `liesSuchantwort` (was kam?) und
    // `pruefeSuchantwort` (darf man daraus „nicht gefunden" lesen?). Als reine Verstellprobe wäre
    // die Eigenschaft beim nächsten Umbau wieder weg; als Fall bleibt sie.
    const fehlerkoerper = JSON.stringify({ error: "BEN_DOKUMENTSUCHE_DEFEKT" });
    const wo = "W2";
    /** Genau die Zusage, die die Strecke an allen sechs Stellen fährt — keine nachgebaute. */
    const zusageZu = (a: Suchantwort): void =>
      pruefeSuchantwort(
        a.status,
        a.istListe,
        a.eintraegeGueltig,
        a.eintragsFehlschlag,
        a.koerper,
        wo,
      );

    // (i) DIE ECHTE LEERE TREFFERLISTE MUSS DURCHGEHEN. Ohne diese Zeile wäre die Zusage nur
    //     streng und nicht richtig — Ü1 und D2 leben davon, dass eine leere Liste gilt.
    const leer = liesSuchantwort({ statusCode: 200, payload: "[]" }, "ko-1");
    expect(leer.istListe).toBe(true);
    expect(leer.eintraegeGueltig).toBe(true);
    expect(leer.trifft).toBe(false);
    expect(() => zusageZu(leer)).not.toThrow();

    // (ii) HTTP 200 MIT FEHLEROBJEKT — genau die Verstellung, unter der D2 und Ü1 grün blieben.
    const getarnt = liesSuchantwort({ statusCode: 200, payload: fehlerkoerper }, "ko-1");
    expect(getarnt.istListe, "ein Fehlerobjekt wurde als Trefferliste gelesen").toBe(false);
    // Und der neue Messwert deutet die fehlende Liste NICHT in bewertbare Einträge um: er sagt
    // ehrlich, dass gar nichts zu bewerten war (JOB 3849).
    expect(getarnt.eintraegeGueltig).toBe(false);
    // UND HIER STEHT DIE BLINDHEIT SELBST, festgehalten statt beschrieben: der Trefferwert allein
    // ist von einer echten Leersuche NICHT zu unterscheiden. Genau an ihm hingen beide
    // Negativaussagen, und genau deshalb reicht er nicht.
    expect(getarnt.trifft).toBe(false);
    expect(() => zusageZu(getarnt)).toThrow(/BEN_DOKUMENTSUCHE_DEFEKT/);

    // (iii) HTTP 503 — Status UND Körper müssen in der Meldung stehen. Ein „erwartet 200, war 503"
    //       allein sagt dem Lesenden nicht, was der Server stattdessen ausgab.
    const kaputt = liesSuchantwort({ statusCode: 503, payload: fehlerkoerper }, "ko-1");
    const werfe503 = () => zusageZu(kaputt);
    expect(werfe503).toThrow(/HTTP 503/);
    expect(werfe503).toThrow(/BEN_DOKUMENTSUCHE_DEFEKT/);

    // (iv) UND GAR KEIN JSON — ein Fehlerblatt eines Vorschalters. Kein `catch`, das daraus eine
    //      leere Liste macht: es wird zum benannten Fehlschlag, mit dem Rumpf in der Meldung.
    const blatt = liesSuchantwort(
      { statusCode: 200, payload: "<html>Gateway Timeout</html>" },
      "ko-1",
    );
    expect(blatt.istListe).toBe(false);
    expect(() => zusageZu(blatt)).toThrow(/Gateway Timeout/);

    // ============================================================================================
    // (v)–(xi) JOB 3849 · DIE EINTRÄGE SELBST. Bis hierher prüfte W2, DASS eine Liste kam — nicht,
    // WAS darin steht. Ein Server, der `["ko-1"]` statt `[{"id":"ko-1"}]` liefert, kam damit als
    // „erfolgreich nichts gefunden" durch, obwohl das gesuchte Objekt buchstäblich in der Antwort
    // stand; `[null]` riss den Lauf mit einem `TypeError` ab, bevor irgendeine Zusage greifen
    // konnte. Beides sind Fälle, keine Verstellproben — dieselbe Begründung wie oben.
    // ============================================================================================
    const formlos = (payload: string) => {
      // WIRFT NIE — das ist selbst die halbe Zusage. Stünde hier ein `TypeError`, wäre der Lauf an
      // einer JS-Meldung zu Ende, bevor irgendeine Aussage über die Suche gemacht werden könnte.
      const a = liesSuchantwort({ statusCode: 200, payload }, "ko-1");
      return { antwort: a, zusage: () => zusageZu(a) };
    };

    // (v) F1 · `[null]` — der Eintrag, an dem die alte Lesart ABSTÜRZTE statt zu messen.
    const f1 = formlos("[null]");
    expect(f1.antwort.trifft, "F1: ein formloser Eintrag darf nie ein Treffer sein").toBe(false);
    expect(f1.zusage, "F1: `[null]` ging als Trefferliste durch").toThrow(/Platz 0/);
    expect(f1.zusage).toThrow(/null/);

    // (vi) F2 · `[{}]` — ein Objekt ohne jede Kennung.
    const f2 = formlos("[{}]");
    expect(f2.antwort.trifft, "F2: ein Eintrag ohne Kennung darf nie ein Treffer sein").toBe(false);
    expect(f2.zusage, "F2: `[{}]` ging als Trefferliste durch").toThrow(/Platz 0/);
    expect(f2.zusage).toThrow(/\{\}/);

    // (vii) F3 · `["ko-1"]` — DER FALL, DER DEN UNTERSCHIED MACHT. Das gesuchte Objekt STEHT in der
    //       Antwort; nur seine Form fehlt. Wer hier „nicht gefunden" liest, behauptet das Gegenteil
    //       dessen, was der Server geschickt hat. Deshalb muss der Istwert in der Meldung stehen.
    const f3 = formlos('["ko-1"]');
    expect(f3.antwort.trifft, "F3: eine blosse Zeichenkette ist kein Treffer").toBe(false);
    expect(f3.zusage, 'F3: `["ko-1"]` ging als leere Trefferliste durch').toThrow(/Platz 0/);
    expect(f3.zusage, "F3: die Meldung nennt den Istwert nicht").toThrow(/"ko-1"/);

    // (viii) F4 · `[{"id":""}]` — eine leere Kennung ist keine Kennung.
    const f4 = formlos('[{"id":""}]');
    expect(f4.antwort.trifft, "F4: eine leere Kennung darf nie ein Treffer sein").toBe(false);
    expect(f4.zusage, "F4: eine leere Kennung ging als gültiger Eintrag durch").toThrow(/Platz 0/);

    // (ix) F5 · `[{"id":null}]` — das Feld ist da, der Wert ist es nicht.
    const f5 = formlos('[{"id":null}]');
    expect(f5.antwort.trifft, "F5: `id: null` darf nie ein Treffer sein").toBe(false);
    expect(f5.zusage, 'F5: `{"id":null}` ging als gültiger Eintrag durch').toThrow(/Platz 0/);
    expect(f5.zusage).toThrow(/\{"id":null\}/);

    // (x) F6 · EIN GÜLTIGER EINTRAG HEILT KEINEN FORMLOSEN. Sonst genügte ein einziger sauberer
    //     Treffer, um eine kaputte Liste als gemessen auszugeben — und der Platz im Array wäre die
    //     einzige Angabe, die den zweiten Eintrag noch auffindbar macht.
    const f6 = formlos('[{"id":"ko-1"},null]');
    expect(f6.antwort.trifft, "F6: ein gültiger erster Eintrag heilte den formlosen zweiten").toBe(
      false,
    );
    expect(f6.zusage, "F6: der formlose zweite Eintrag ging durch").toThrow(/Platz 1/);

    // (xi) F7 · UND DIE BEIDEN GUTEN FÄLLE — ohne sie wäre die Zusage nur streng und nicht richtig,
    //      dieselbe Begründung wie bei (i). D1 lebt vom Treffer, Ü1 und D2 von der leeren Liste.
    const f7a = formlos('[{"id":"ko-1"}]');
    expect(f7a.antwort.trifft, "F7: der gültige Treffer wurde nicht mehr gefunden").toBe(true);
    expect(f7a.zusage, "F7: eine gültige Trefferliste wurde abgewiesen").not.toThrow();
    const f7b = formlos("[]");
    expect(f7b.antwort.eintraegeGueltig, "F7: die leere Liste gilt als bewertbar").toBe(true);
    expect(f7b.antwort.trifft, "F7: die leere Liste trifft nicht").toBe(false);
    expect(f7b.zusage, "F7: die echte leere Liste wurde abgewiesen").not.toThrow();

    // (xii) DIESELBE PRÜFUNG AUF DER `similar`-SEITE DES LIVE-CHECKS. Sie hing an genau demselben
    //       rohen `.some((s) => s.id === koId)` — nur ausserhalb jedes `try`, mitten in
    //       `fahreStrecke`. Gemessen wird der WIRKLICH benutzte Prüfweg (`liesTrefferliste`), nicht
    //       ein zweiter, hier nachgebauter Formbegriff.
    const sNull = liesTrefferliste([null]);
    expect(sNull.gueltig, "similar `[null]` galt als bewertbare Ähnlichkeitsliste").toBe(false);
    expect(sNull.fehlschlag, "die Meldung nennt den Platz nicht").toMatch(/Platz 0/);
    expect(sNull.eintraege, "aus einer formlosen Liste darf kein Treffer gerechnet werden").toEqual(
      [],
    );
    const sText = liesTrefferliste(["ko-1"]);
    expect(sText.gueltig, 'similar `["ko-1"]` galt als bewertbare Ähnlichkeitsliste').toBe(false);
    expect(sText.fehlschlag, "die Meldung nennt den Istwert nicht").toMatch(/"ko-1"/);
    expect(sText.eintraege).toEqual([]);
    // Und die Gegenrichtung, damit die Zusage nicht nur streng ist: die echte Liste geht durch.
    const sGut = liesTrefferliste([{ id: "ko-1", score: 0.9 }]);
    expect(sGut.gueltig, "eine gültige Ähnlichkeitsliste wurde abgewiesen").toBe(true);
    expect(sGut.eintraege.some((aehnlich) => aehnlich.id === "ko-1")).toBe(true);

    // ============================================================================================
    // (xiii)–(xv) JOB 3849 RUNDE 2 · DIE DIAGNOSE DARF NICHT SELBST ABSTÜRZEN. BEN Korrekturpflicht 1,
    // von ihm gemessen, hier als Fall festgehalten: `"[".repeat(10000)+"0"+"]".repeat(10000)` ist
    // gültiges JSON, `JSON.parse` nimmt es an (es arbeitet iterativ) — und dann starb die MELDUNG
    // daran. `JSON.stringify` im Istwert läuft REKURSIV und warf `RangeError: Maximum call stack size
    // exceeded`, hoch durch `liesTrefferliste`, `liesSuchantwort`, `fahreStrecke`. Ein Wächter, der
    // beim Melden eines Fehlers stirbt, sagt über die Suche nichts — genau der Abbruch, gegen den (v)
    // angetreten ist, nur eine Stelle weiter: nicht mehr in der Bewertung, sondern im Bericht.
    // ============================================================================================
    const tiefePayload = `${"[".repeat(10_000)}0${"]".repeat(10_000)}`;

    // (xiii) F8 · DER TIEFE EINTRAG. Zuerst die Zusage selbst: hier darf NICHTS fliegen.
    expect(
      () => liesSuchantwort({ statusCode: 200, payload: tiefePayload }, "ko-1"),
      "F8: die Diagnose stürzte selbst ab, statt den Eintrag zu melden",
    ).not.toThrow();
    const f8 = formlos(tiefePayload);
    expect(f8.antwort.istListe, "F8: der tiefe Körper ist sehr wohl eine Liste").toBe(true);
    expect(
      f8.antwort.eintraegeGueltig,
      "F8: ein verschachtelter Eintrag ist kein Objekt mit Kennung",
    ).toBe(false);
    expect(f8.antwort.trifft, "F8: aus einem unbewertbaren Eintrag darf kein Treffer folgen").toBe(
      false,
    );
    expect(f8.zusage, "F8: der tiefe Eintrag ging als Trefferliste durch").toThrow(
      /Platz 0 war \[/,
    );
    // UND DIE GRENZE GILT BEIM SCHREIBEN, nicht erst danach: vollständig serialisieren und dann
    // kürzen war genau der Fehler — gekürzt wurde ein Text, der nie zustande kam.
    expect(
      f8.antwort.eintragsFehlschlag.length,
      `F8: die Meldung wuchs mit der Schachtelung: ${f8.antwort.eintragsFehlschlag.slice(0, 200)}`,
    ).toBeLessThan(600);
    expect(
      f8.antwort.eintragsFehlschlag,
      "F8: die Meldung verschweigt, dass gekürzt wurde",
    ).toMatch(/…/);

    // (xiv) F9 · DIESELBE GRENZE IN DER BREITE. 5000 formlose Einträge dürfen keine 5000-fache
    //       Meldung bauen: sie nennt den ersten Platz, sagt wie viele es insgesamt sind, und hört auf.
    const breit = formlos(JSON.stringify(new Array(5000).fill(null)));
    expect(breit.antwort.eintraegeGueltig, "F9: 5000 leere Einträge galten als bewertbar").toBe(
      false,
    );
    expect(breit.antwort.trifft).toBe(false);
    expect(
      breit.antwort.eintragsFehlschlag,
      "F9: die Meldung nennt den ersten Platz nicht",
    ).toMatch(/Platz 0/);
    expect(breit.antwort.eintragsFehlschlag, "F9: die Meldung nennt die Gesamtzahl nicht").toMatch(
      /5000/,
    );
    expect(
      breit.antwort.eintragsFehlschlag.length,
      "F9: die Meldung wuchs mit der Länge der Liste",
    ).toBeLessThan(600);

    // (xv) UND DIESELBE ABSICHERUNG AUF DER `similar`-SEITE — derselbe Leser, deshalb derselbe Fall
    //      und kein zweiter Formbegriff. Ohne diese Zeilen wäre die Härtung nur für die Suche belegt.
    const tiefeListe = JSON.parse(tiefePayload) as unknown;
    expect(
      () => liesTrefferliste(tiefeListe),
      "similar: die Diagnose stürzte selbst ab, statt den Eintrag zu melden",
    ).not.toThrow();
    const sTief = liesTrefferliste(tiefeListe);
    expect(sTief.gueltig, "similar: ein tief verschachtelter Eintrag galt als bewertbar").toBe(
      false,
    );
    expect(sTief.eintraege, "similar: aus einer formlosen Liste darf kein Treffer folgen").toEqual(
      [],
    );
    expect(sTief.fehlschlag, "similar: die Meldung nennt den Platz nicht").toMatch(/Platz 0/);
    expect(sTief.fehlschlag.length, "similar: die Meldung wuchs mit der Schachtelung").toBeLessThan(
      600,
    );

    // ============================================================================================
    // (xvi)–(xviii) JOB 3866 · DERSELBE SATZ, DER ANDERE ZWEIG: OBJEKTE. (xiii)–(xv) speisen
    // ausschliesslich ARRAYS ein — der Objektzweig der Druckhilfe (`strecke.ts`, `drucke`, Fall
    // `"object"`) wurde von keinem Fall betreten. BEN hat ihn zu 3849 R2 (Prüfpunkt 6) ausdrücklich
    // benannt: „tiefe Objektverschachtelung und sehr lange Feldnamen als Diagnosefälle".
    // ============================================================================================
    const EBENEN = 6;
    const FELDER_JE_EBENE = 12;

    // DIE FORM, UND WARUM SIE SO GEBAUT IST. Verlangt sind 12 Felder je Ebene über 6 Ebenen. Von
    // den zwölf führt EINES weiter, die elf anderen sind Zahlen — und das ist eine Messfrage, keine
    // Bequemlichkeit: eine Verzweigung, bei der ALLE zwölf weiterführen, hat auf Ebene 6
    // 12^6 = 2.985.984 Blätter. Als Objekt ginge das noch (s. `vollVerzweigt`), als JSON-TEXT wären
    // es ~24 MB für EINEN Eintrag — und Lieferung 1 verlangt jeden Fall auch über `liesSuchantwort`,
    // F12 sogar 5000-fach. Das tiefe Feld steht ZUERST, sonst wäre der Vorrat von den elf flachen
    // Feldern aufgebraucht, bevor der Drucker je eine Ebene tiefer käme, und der Fall misst die
    // Tiefe gar nicht.
    const tiefesObjekt = (ebenen: number): Record<string, unknown> => {
      const ebene: Record<string, unknown> = {};
      ebene.f0 = ebenen > 1 ? tiefesObjekt(ebenen - 1) : 0;
      for (let i = 1; i < FELDER_JE_EBENE; i += 1) ebene[`f${i}`] = i;
      return ebene;
    };
    // UND DIE VOLLE VERZWEIGUNG — nur auf dem direkten Weg, wo kein Text entstehen muss. Alle zwölf
    // Felder jeder Ebene zeigen auf DASSELBE Kindobjekt: der Drucker kennt keine Verweise und sieht
    // genau die Struktur, die 2.985.984 einzelne Blätter ergäben, ohne dass sie entstehen. Kein
    // Zyklus — gebaut wird von unten nach oben.
    const vollVerzweigt = (): Record<string, unknown> => {
      let ebene: unknown = 0;
      for (let e = 0; e < EBENEN; e += 1) {
        const naechste: Record<string, unknown> = {};
        for (let i = 0; i < FELDER_JE_EBENE; i += 1) naechste[`f${i}`] = ebene;
        ebene = naechste;
      }
      return ebene as Record<string, unknown>;
    };
    const langerFeldname = "x".repeat(50_000);

    /** Beide Wege aus Lieferung 1 in einer Messung: der direkte Leser UND die HTTP-Antwort. */
    const beideWege = (eintraege: readonly unknown[]) => {
      const payload = JSON.stringify(eintraege);
      return {
        direkt: liesTrefferliste(eintraege),
        ueberHttp: liesSuchantwort({ statusCode: 200, payload }, "ko-1"),
      };
    };

    /**
     * Die Zeichengrenze einer Meldung, mit dem TATSÄCHLICH gemessenen Wert in ihrer eigenen roten
     * Zeile (Lehre JOB 3826 R1: die Diagnose aus dem gelieferten Ergebnis ableiten, nicht aus dem
     * Sollwert). Ein blosses „expected 1761 to be less than 600" sagt nicht, WAS da so lang wurde.
     */
    const bleibtKurz = (was: string, meldung: string): void => {
      expect(
        meldung.length,
        `${was}: die Meldung wuchs mit dem Eintrag — ${meldung.length} Zeichen, Anfang: ${meldung.slice(0, 200)}`,
      ).toBeLessThan(600);
    };

    // (xvi) F10 · DAS TIEFE, BREITE OBJEKT. Zuerst wieder die Zusage selbst: hier darf NICHTS
    //       fliegen — der Objektzweig rekursiert genauso wie der Arrayzweig, an dem JOB 3849
    //       Runde 1 gestorben ist.
    const f10Eintraege = [tiefesObjekt(EBENEN)];
    expect(
      () => beideWege(f10Eintraege),
      "F10: die Diagnose stürzte am tiefen Objekt ab, statt es zu melden",
    ).not.toThrow();
    const f10 = beideWege(f10Eintraege);
    expect(f10.ueberHttp.istListe, "F10: der Körper ist sehr wohl eine Liste").toBe(true);
    expect(
      f10.direkt.gueltig,
      "F10: ein tief verschachteltes Objekt ist kein Eintrag mit Kennung",
    ).toBe(false);
    expect(
      f10.ueberHttp.eintraegeGueltig,
      "F10: derselbe Eintrag galt über HTTP als bewertbar",
    ).toBe(false);
    expect(
      f10.ueberHttp.trifft,
      "F10: aus einem unbewertbaren Eintrag darf kein Treffer folgen",
    ).toBe(false);
    expect(
      f10.direkt.eintraege,
      "F10: aus einer formlosen Liste darf kein Treffer gerechnet werden",
    ).toEqual([]);
    expect(f10.direkt.fehlschlag, "F10: die Meldung nennt den Platz nicht").toMatch(/Platz 0/);
    // UND SIE SAGT, WARUM SIE AUFHÖRT. Ohne die Tiefensperre des Objektzweigs stünde hier ein
    // aufgerollter Baum statt einer Angabe — das ist die Zeile, die Gegenprobe (a) rot macht.
    expect(
      f10.direkt.fehlschlag,
      "F10: die Meldung verschweigt, dass die Tiefe abgeschnitten wurde",
    ).toMatch(/zu tief, Felder: 12/);
    bleibtKurz("F10 direkt", f10.direkt.fehlschlag);
    bleibtKurz("F10 über HTTP", f10.ueberHttp.eintragsFehlschlag);
    // UND DIESELBE FORM VOLL VERZWEIGT — alle zwölf Felder jeder Ebene führen weiter, was auf Ebene 6
    // 2.985.984 Blätter wären. Nur der direkte Weg, weil davon kein JSON-Text gebaut werden kann.
    const f10VollEintrag = vollVerzweigt();
    const f10Voll = liesTrefferliste([f10VollEintrag]);
    expect(f10Voll.gueltig, "F10: die voll verzweigte Form galt als bewertbar").toBe(false);
    bleibtKurz("F10 voll verzweigt", f10Voll.fehlschlag);

    // (xvii) F11 · DER SEHR LANGE FELDNAME. 50 000 Zeichen in EINEM Schlüssel: die Meldung darf ihn
    //        nicht mitschleppen, sondern muss ihn abschneiden und das sagen. WAS DAS ABSCHNEIDET, IST
    //        `nimm(…)` im Objektzweig von `strecke.ts` — und genau darauf zielt die bestellte
    //        Gegenprobe (b). In Runde 2 fiel sie nicht auf, weil `istwertVon` das Ergebnis hinterher
    //        noch einmal schnitt: der Schlüssel entstand ganz und verschwand danach wieder, die
    //        Meldung blieb kurz, und der Fall belegte nichts. Seit Runde 3 schneidet nichts mehr
    //        nach, und die Zeile unten liest den abgeschnittenen Schlüssel selbst.
    const f11Eintraege = [{ [langerFeldname]: 1 }];
    expect(
      () => beideWege(f11Eintraege),
      "F11: die Diagnose stürzte am langen Feldnamen ab, statt ihn zu melden",
    ).not.toThrow();
    const f11 = beideWege(f11Eintraege);
    expect(f11.direkt.gueltig, "F11: ein Objekt ohne Kennung galt als Eintrag mit Kennung").toBe(
      false,
    );
    expect(
      f11.ueberHttp.eintraegeGueltig,
      "F11: derselbe Eintrag galt über HTTP als bewertbar",
    ).toBe(false);
    expect(
      f11.ueberHttp.trifft,
      "F11: aus einem unbewertbaren Eintrag darf kein Treffer folgen",
    ).toBe(false);
    expect(f11.direkt.fehlschlag, "F11: die Meldung nennt den Platz nicht").toMatch(/Platz 0/);
    // DER SCHLÜSSEL SELBST, angeschnitten und mit „…" beendet. Seit JOB 3897 wird an dieser Stelle
    // ZWEIMAL geschnitten: einmal VOR `JSON.stringify` (das spart den Zwischenwert — was diese Zeile
    // gerade NICHT sieht, dafür F14b) und einmal in `nimm` (das kürzt die Ausgabe und setzt das
    // „…", und das ist die Spur hier).
    //
    // WAS OHNE `nimm` DASTÜNDE, GEMESSEN STATT VERMUTET (JOB 3897 R2, BEN-Korrekturpflicht 1): NICHT
    // mehr der ganze Name — das galt bis zum Vorschneiden und ist seither falsch. Es stünde das schon
    // vorgeschnittene Präfix da, auf DIESEM Weg 58 Zeichen (Vorrat 60 je genanntem Platz minus die
    // zwei Klammern), und zwar OHNE Kürzungsmerkmal: `{"xxx…58…":1}`. Genau daran wird die Zeile
    // unten rot — sie prüft das „…", nicht die Länge.
    expect(
      f11.direkt.fehlschlag,
      `F11: die Meldung verschweigt, dass der Feldname abgeschnitten wurde: ${f11.direkt.fehlschlag.slice(0, 200)}`,
    ).toMatch(/"x{10,}…/);
    bleibtKurz("F11 direkt", f11.direkt.fehlschlag);
    bleibtKurz("F11 über HTTP", f11.ueberHttp.eintragsFehlschlag);

    // (xviii) F12 · BEIDES ZUSAMMEN, und DAS ist die Stelle, an der die Grenze wirklich gefallen ist.
    //         5000 Einträge, von denen jeder ein solches Objekt ist. GEMESSEN am Stand vor diesem
    //         Job: `fehlschlag` war 1761 Zeichen lang — fünf genannte Plätze à 311 Zeichen. F9
    //         (5000 × `null`) konnte das nicht zeigen: `null` druckt sich in vier Zeichen aus, und
    //         damit blieb die Meldung auch ohne die zweite Grenze klein.
    const f12Eintraege = new Array(5000).fill(tiefesObjekt(EBENEN)) as unknown[];
    expect(
      () => beideWege(f12Eintraege),
      "F12: die Diagnose stürzte an 5000 tiefen Objekten ab",
    ).not.toThrow();
    const f12 = beideWege(f12Eintraege);
    expect(f12.direkt.gueltig, "F12: 5000 tiefe Objekte galten als bewertbar").toBe(false);
    expect(
      f12.ueberHttp.eintraegeGueltig,
      "F12: dieselben Einträge galten über HTTP als bewertbar",
    ).toBe(false);
    expect(f12.ueberHttp.trifft, "F12: aus unbewertbaren Einträgen darf kein Treffer folgen").toBe(
      false,
    );
    expect(f12.direkt.fehlschlag, "F12: die Meldung nennt den ersten Platz nicht").toMatch(
      /Platz 0/,
    );
    expect(f12.direkt.fehlschlag, "F12: die Meldung nennt die Gesamtzahl nicht").toMatch(/5000/);
    expect(f12.direkt.fehlschlag, "F12: die Meldung zählt den Rest nicht").toMatch(
      /und 4995 weitere/,
    );
    bleibtKurz("F12 direkt", f12.direkt.fehlschlag);
    bleibtKurz("F12 über HTTP", f12.ueberHttp.eintragsFehlschlag);

    // ============================================================================================
    // (xix) F13 · DIE SCHREIBGRENZE ALLEIN — und warum F10–F12 sie NICHT für sich messen.
    //
    // F10–F12 laufen über `liesTrefferliste`, und die verteilt ihren Vorrat auf fünf genannte Plätze
    // (`ISTWERT_JE_MELDUNG`). Diese Aufteilung hält die MELDUNG kurz, auch wenn die Buchführung in
    // `drucke` darunter Zeichen ausgibt, die sie nicht verbucht — und Runde 2 dieses Jobs ist genau
    // daran gescheitert: sie baute die Aufteilung und liess die lückenhafte Buchführung stehen, weil
    // `istwertVon` das Ergebnis zusätzlich noch nachträglich schnitt (BEN Korrekturpflicht 1).
    //
    // DER WEG „es kam gar keine Liste" hat beides nicht: ein einziger Istwert, der volle Vorrat
    // `ISTWERT_ZEICHEN`, keine Plätze, kein Schnitt danach. Was hier gemessen wird, ist `drucke` und
    // sonst nichts. Deshalb ist F13 die Zeile, die die Gegenproben (b) und (d) rot machen.
    // ============================================================================================
    expect(liesTrefferliste(0).gueltig, "F13: eine blosse Zahl ist keine Trefferliste").toBe(false);
    // Der Rahmen dieser Meldung GEMESSEN statt abgezählt: `0` druckt sich in genau einem Zeichen aus,
    // also ist alles ausser diesem einen Zeichen Rahmen. Was danach übrig bleibt, ist der Istwert.
    const f13Rahmen = liesTrefferliste(0).fehlschlag.length - 1;
    // Der Vorrat ist `ISTWERT_ZEICHEN` = 300. Dazu kommt ein Überhang: ein abgeschnittenes Stück
    // kostet ein Zeichen mehr, als noch übrig war, und jede Ebene prüft den Vorrat erst danach — der
    // Überhang hängt also an `ISTWERT_TIEFE` (4) und nicht am Eintrag. 320 lässt ihn zu und schlägt
    // an, sobald eine Klammer, ein Doppelpunkt oder ein Auslassungszeichen unbezahlt bleibt.
    const F13_GRENZE = 320;
    // GEBAUT WIRD HIER NICHTS NEU: F13 nimmt genau die Formen, die F10 und F11 schon in der Hand
    // haben, und schickt sie durch den anderen Weg. Das ist auch eine Kostenfrage — gemessen
    // (Lieferung 7): mit eigens gebauten Formen kostete F13 rund 0,6 s, mit den geliehenen nichts,
    // was sich vom Rauschen des geteilten Prüfplatzes abheben liesse.
    const f13Faelle: readonly (readonly [string, unknown])[] = [
      ["tiefes, breites Objekt", f10Eintraege[0]],
      ["voll verzweigtes Objekt", f10VollEintrag],
      ["50 000 Zeichen im Feldnamen", f11Eintraege[0]],
      ["50 000 Zeichen im Wert", { text: langerFeldname }],
    ];
    for (const [was, rohe] of f13Faelle) {
      const gemessen = liesTrefferliste(rohe);
      expect(gemessen.gueltig, `F13 ${was}: ein Objekt galt als Trefferliste`).toBe(false);
      const istwert = gemessen.fehlschlag.length - f13Rahmen;
      expect(
        istwert,
        `F13 ${was}: der Istwert wurde geschrieben, ohne bezahlt zu werden — ${istwert} Zeichen statt höchstens ${F13_GRENZE}, Anfang: ${gemessen.fehlschlag.slice(0, 200)}`,
      ).toBeLessThanOrEqual(F13_GRENZE);
    }

    // (xx) UND DIE GEGENRICHTUNG — ohne sie wäre die Zusage nur streng und nicht richtig, dieselbe
    //       Begründung wie bei (xi). Ein GÜLTIGER Eintrag darf eine tief verschachtelte Ladung im
    //       Feld `payload` tragen: geprüft wird die Kennung, nicht die Schlichtheit des Eintrags.
    const gutTief = liesTrefferliste([{ id: "ko-1", payload: tiefesObjekt(EBENEN) }]);
    expect(
      gutTief.gueltig,
      `ein gültiger Eintrag mit tiefer Ladung wurde abgewiesen: ${gutTief.fehlschlag}`,
    ).toBe(true);
    expect(gutTief.fehlschlag, "ein gültiger Eintrag erzeugte einen Fehlschlag").toBe("");
    expect(
      gutTief.eintraege.some((treffer) => treffer.id === "ko-1"),
      "der gültige Treffer ging verloren",
    ).toBe(true);

    // ============================================================================================
    // (xxi) F14a · DIE AUSGABE BLEIBT WORTGLEICH — und dieser Fall ist AUSDRÜCKLICH KEIN roter Fall.
    //
    // JOB 3897 schneidet den Schlüssel schon VOR `JSON.stringify` (`strecke.ts`, Fall `"object"`).
    // Das darf die Meldung nicht verändern, nur den Weg dorthin verbilligen. F14a hält genau das
    // fest: vor wie nach der Reparatur grün. Wer ihn später rot sieht, hat die AUSGABE verändert —
    // nicht eine Gegenprobe bestanden. Was die Reparatur wirklich bewirkt, misst F14b darunter.
    //
    // VERGLICHEN WIRD JEDER FALL MIT SEINER EIGENEN ERWARTETEN ZEICHENKETTE, gerechnet nach der
    // ABGELÖSTEN Fassung (`JSON.stringify` des GANZEN Schlüssels, danach `nimm`) — nicht die zwei
    // Fassungen gegeneinander. Ein Vergleich zweier Läufe desselben Standes wäre immer grün.
    // ============================================================================================
    // Der Rahmen der Meldung, GEMESSEN wie in F13: `0` druckt sich in genau einem Zeichen aus, also
    // trennt dieses eine Zeichen Kopf und Fuss. Was dazwischen steht, ist der Istwert selbst.
    const f14Rahmen = liesTrefferliste(0).fehlschlag.split("0");
    expect(f14Rahmen, "F14a: der Rahmen der Meldung ist nicht mehr eindeutig").toHaveLength(2);
    const [meldungKopf, meldungFuss] = f14Rahmen as [string, string];
    const istwertAus = (rohe: unknown): string => {
      const meldung = liesTrefferliste(rohe).fehlschlag;
      expect(
        meldung.startsWith(meldungKopf) && meldung.endsWith(meldungFuss),
        `F14a: die Meldung hat einen anderen Rahmen: ${meldung.slice(0, 200)}`,
      ).toBe(true);
      return meldung.slice(meldungKopf.length, meldung.length - meldungFuss.length);
    };
    // `ISTWERT_ZEICHEN` aus `strecke.ts`, hier als Zahl aufgeschrieben, weil die Konstante dort
    // nicht ausgeführt wird (kein `export`). Sie gilt auf diesem Weg ungeteilt: „es kam gar keine
    // Liste" bekommt den VOLLEN Vorrat, keine fünf Plätze à `ISTWERT_JE_MELDUNG` wie eine Liste.
    const ISTWERT_ZEICHEN_HIER = 300;
    /**
     * Die erwartete Ausgabe für `{ <schluessel>: 1 }`, gerechnet nach der Fassung VOR JOB 3897.
     * Zwei Zeichen sind vor der Schleife für `{}` bezahlt (`strecke.ts`, `zahle("{}")`), danach
     * schneidet `nimm` bei Überlänge und hängt „…" an; der Wert `1` kommt nur noch durch, wenn nach
     * Schlüssel und Doppelpunkt Vorrat übrig ist.
     */
    const wieVorDerReparatur = (schluessel: string): string => {
      let vorrat = ISTWERT_ZEICHEN_HIER - 2;
      const voll = JSON.stringify(schluessel);
      const gedruckterSchluessel = voll.length > vorrat ? `${voll.slice(0, vorrat)}…` : voll;
      vorrat -= gedruckterSchluessel.length + 1;
      return `{${gedruckterSchluessel}:${vorrat > 0 ? "1" : "…"}}`;
    };
    // NUL als benannte Konstante und nicht als unsichtbares Zeichen im Quelltext: dort wäre es von
    // einem Leerzeichen nicht zu unterscheiden, und genau diese Verwechslung hat in Runde 1 den
    // bestellten Fall (iii) gekostet (BENs Promptverbesserung).
    const NUL = "\u0000";
    const f14aFaelle: readonly (readonly [string, string])[] = [
      ["50 000 × x — der Schlüssel aus F11", langerFeldname],
      ['50 000 × " — jedes Zeichen verdoppelt sich beim Serialisieren', '"'.repeat(50_000)],
      ["50 000 × Leerzeichen — wird beim Serialisieren NICHT länger", " ".repeat(50_000)],
      // DER BESTELLTE FALL (iii) AUS LIEFERUNG 2, sichtbar geschrieben statt als unsichtbares
      // Zeichen (BEN zu R1): NUL wird beim Serialisieren zur sechsstelligen Escape-Folge
      // (Backslash, u, vier Ziffern), also sechs Zeichen für eines. U+0001 bleibt daneben stehen —
      // dieselbe Form, ein anderer Zeichenwert; der Fall kostet nichts und zeigt, dass die Rechnung
      // nicht am Sonderfall „Zeichenwert 0" hängt.
      ["50 000 × NUL — sechs Zeichen für eines", NUL.repeat(50_000)],
      ["50 000 × U+0001 — jedes Zeichen wird sechs Zeichen lang", "\u0001".repeat(50_000)],
      // DER EINZIGE FALL, IN DEM DER SCHNITT DIE SERIALISIERUNG WIRKLICH ANDERS BEGINNEN LÄSST: das
      // führende `x` schiebt die Emoji-Paare auf ungerade Plätze, der Schnitt bei 298 trennt also ein
      // Paar. Der abgeschnittene Rest ist eine einzelne Ersatzstelle und wird zu `\ud83d` (sechs
      // Zeichen) statt roh geschrieben — was erst NACH dem 298. Zeichen steht und deshalb nichts an
      // der Ausgabe ändert. Ohne diesen Fall bliebe die Begründung an der Reparatur eine Behauptung.
      ["ein Ersatzzeichenpaar wird mittendrin geschnitten", `x${"😀".repeat(1_000)}`],
      ["genau so lang wie der Vorrat an dieser Stelle (298)", "x".repeat(298)],
      ["ein Zeichen kürzer (297)", "x".repeat(297)],
      ["das längste, das ganz durchkommt (296)", "x".repeat(296)],
      ["der leere Schlüssel", ""],
    ];
    for (const [was, schluessel] of f14aFaelle) {
      const gemessen = istwertAus({ [schluessel]: 1 });
      expect(
        gemessen,
        `F14a ${was}: die Reparatur hat die Meldung verändert, nicht nur verbilligt — ${gemessen.slice(0, 200)}`,
      ).toBe(wieVorDerReparatur(schluessel));
    }
    // UND DIE GRENZE NOCH EINMAL AUSGESCHRIEBEN, ohne jede Rechnung: 298 und 297 Zeichen tragen
    // BEIDE ein „…", weil die zwei Anführungszeichen mitzählen; erst bei 296 kommt der Schlüssel
    // ganz durch. Diese drei Zeilen fielen auch dann noch auf, wenn `wieVorDerReparatur` sich irrte.
    //
    // WIE EMPFINDLICH DAS IST, GEMESSEN STATT GESCHÄTZT (JOB 3897, drei Verstellungen am Schnitt in
    // `strecke.ts`): EIN Zeichen zu früh geschnitten bleibt bytegleich und macht NICHTS rot — das
    // schliessende Anführungszeichen fällt ohnehin weg. Zwei Zeichen zu früh macht F11 rot (das „…"
    // verschwindet). Ein verändertes Escaping macht F14a rot und F11 nicht — das ist der Teil, den
    // nur diese Fälle bewachen: F11 kennt nur ein `x`, das beim Serialisieren nie länger wird.
    expect(istwertAus({ "": 1 }), "F14a: der leere Schlüssel").toBe('{"":1}');
    expect(istwertAus({ ["x".repeat(296)]: 1 }), "F14a: 296 Zeichen kommen ganz durch").toBe(
      `{"${"x".repeat(296)}":…}`,
    );
    expect(istwertAus({ ["x".repeat(297)]: 1 }), "F14a: 297 Zeichen werden geschnitten").toBe(
      `{"${"x".repeat(297)}…:…}`,
    );
    expect(istwertAus({ ["x".repeat(298)]: 1 }), "F14a: 298 Zeichen werden geschnitten").toBe(
      `{"${"x".repeat(297)}…:…}`,
    );

    // ============================================================================================
    // (xxii) F14b · WAS DER SERIALISIERER ZU SEHEN BEKOMMT — der rote Fall dieses Jobs.
    //
    // F11 und F14a lesen das ERGEBNIS, und das ist vor wie nach der Reparatur dasselbe. Der
    // Unterschied liegt im ZWISCHENWERT: `nimm(JSON.stringify(feld))` baute erst den ganzen
    // serialisierten Schlüssel und behielt davon 300 Zeichen. Gemessen wird deshalb, WIE LANG das
    // Argument war, das `JSON.stringify` bekommen hat — nicht, was hinten herauskam.
    //
    // WARUM NICHT DER SPEICHER, obwohl der Auftrag ihn bestellt hat: siehe den Block darunter.
    // ============================================================================================
    const f14bFaelle: readonly (readonly [string, string])[] = [
      ...f14aFaelle,
      ["2 Millionen Anführungszeichen", '"'.repeat(2_000_000)],
    ];
    const gesehen: number[] = [];
    const echteSerialisierung = JSON.stringify;
    try {
      // Der Horchposten ruft die echte Fassung auf und verändert nichts an ihr — er zählt nur mit,
      // wie lang das Argument war. Zurückgesetzt wird er im `finally`, damit kein späterer Fall in
      // dieser Datei mit einer verstellten Serialisierung läuft.
      JSON.stringify = ((wert: unknown, ...rest: readonly unknown[]) => {
        if (typeof wert === "string") gesehen.push(wert.length);
        return (echteSerialisierung as unknown as (...args: readonly unknown[]) => string)(
          wert,
          ...rest,
        );
      }) as typeof JSON.stringify;
      for (const [was, schluessel] of f14bFaelle) {
        gesehen.length = 0;
        liesTrefferliste({ [schluessel]: 1 });
        // OHNE DIESE ZEILE WÄRE DER FALL BLIND: sieht der Horchposten gar keinen Aufruf, misst er
        // nichts und bliebe trotzdem grün — genau die Art Zusicherung, an der JOB 3866 Runde 2
        // gescheitert ist.
        expect(
          gesehen.length,
          `F14b ${was}: der Serialisierer wurde gar nicht gerufen — die Probe misst nichts`,
        ).toBeGreaterThan(0);
        const laengste = Math.max(...gesehen);
        expect(
          laengste,
          `F14b ${was}: der Schlüssel entstand ganz, bevor er geschnitten wurde — ${laengste} Zeichen gingen in JSON.stringify, obwohl höchstens ${ISTWERT_ZEICHEN_HIER} davon überleben können`,
        ).toBeLessThanOrEqual(ISTWERT_ZEICHEN_HIER);
      }
    } finally {
      JSON.stringify = echteSerialisierung;
    }
    expect(JSON.stringify, "F14b: der Horchposten blieb stehen").toBe(echteSerialisierung);

    // ============================================================================================
    // (xxiii) DIE BESTELLTE SPEICHERPROBE — GEBAUT, FÜNFMAL GEMESSEN UND WIEDER VERWORFEN.
    //
    // Bestellt war (JOB 3897, Lieferung 3): ein Schlüssel aus 20 Millionen Anführungszeichen, der
    // Zuwachs aus `process.memoryUsage()` um den Aufruf herum, Maximum aus `heapUsed` und `rss`,
    // fünf Läufe, Grenze 16 MB. Genau so gebaut und gefahren — und die Zahlen tragen die Grenze
    // nicht (Zuwachs je Lauf, in derselben Reihenfolge gemessen):
    //   · VORHER  (`nimm(JSON.stringify(feld))`):  38,1 · −14,2 · 36,6 · 0,0 · 0,0 MB
    //   · NACHHER (`feld.slice(…)` davor):          0,0 ·   0,0 ·  0,0 · 0,0 · 0,0 MB
    //   · Nullmessung (kurzer Schlüssel), beide Stände: fünfmal 0,0 MB — sie schlägt nicht an.
    //
    // NUR ZWEI DER FÜNF VORHER-LÄUFE lagen über 16 MB (38,1 und 36,6), verlangt waren vier — die
    // Zahl stand in Runde 1 falsch als „drei" hier und ist nachgezählt (BEN). Der Grund ist bekannt
    // und macht die Bauart untauglich: gemessen wird VOR und NACH dem Aufruf, nicht währenddessen.
    // Sobald der Haufen einmal um 40 MB gewachsen ist, findet der nächste 40-MB-Zwischenwert schon
    // Platz und ist beim zweiten Messpunkt längst wieder eingesammelt — Zuwachs 0,0 MB, obwohl
    // dieselbe Verschwendung stattgefunden hat. Eine solche Probe wird still blind, sobald irgendein
    // Fall vor ihr den Haufen wachsen lässt, und meldet dann grün, ohne etwas zu messen; das ist der
    // Fehler aus JOB 3866 Runde 2, und deshalb steht sie hier NICHT (Lieferung 5, die Notbremse).
    //
    // AN IHRER STELLE STEHT F14b: dieselbe Aussage, aber gezählt statt geschätzt — was in
    // `JSON.stringify` hineingeht, hängt weder an der Aufräumlaufzeit noch an der Reihenfolge der
    // Fälle. Vorher 50 000 (bzw. 2 000 000) Zeichen, nachher höchstens 300.
    // ============================================================================================
  });

  it("W3 · VERKABELUNG: eine verfälschte Ähnlichkeitsliste der Prüfroute erreicht die Zusage der Strecke", async () => {
    // BENs ZWEITER BESTELLTER PUNKT zu 3849 R2, wörtlich: „Die dauerhafte `similar`-Probe misst den
    // Leser (durchstich.test.ts:729); ein dauerhafter HTTP-Gegenfall würde zusätzlich dessen
    // VERKABELUNG bewachen." W2 (xii)/(xv) rufen `liesTrefferliste` direkt auf — sie belegen, dass
    // der Leser richtig liest, und NICHT, dass `fahreStrecke` die Antwort der Prüfroute durch ihn
    // schickt. Das hing bis heute an einer Verstellung, die BEN nach seiner Messung wieder
    // zurückgenommen hat; hier bleibt es.
    //
    // Die Verfälschung sitzt als onSend-Hook auf GENAU `POST /api/knowledge/check` und liefert
    // `similar: ["ko-1"]` — die Form fehlt, das Gesuchte steht buchstäblich in der Antwort. Sie
    // hinterlässt nichts: sie hängt an der zweiten App DIESES Laufs und stirbt mit ihr.
    const lauf = await fahreStrecke({ verfaelsche: "similar-formlos" });
    try {
      const b = lauf.befund;
      // (1) DER WEG BIS HIERHER IST HEIL. Wäre er es nicht, stünde die rote Stelle für
      //     „irgendetwas ging schief" statt für die Ähnlichkeitsliste (dieselbe Bauweise wie D2).
      expect(b.konto.rolle).toBe("admin");
      expect(b.fund.anlageStatus, "ohne angelegtes Objekt misst dieser Fall nichts").toBe(201);
      expect(b.fund.pruefungStatus, "die Prüfroute antwortete gar nicht mit 200").toBe(200);
      expect(b.fund.pruefungOhneAnmeldung, "die Verfälschung hat die 401 mitgenommen").toBe(401);
      // (2) UND DIE VERFÄLSCHUNG BLIEB AN IHRER ADRESSE: beide Suchen sind unberührt.
      expect(b.fund.sucheEintraegeGueltig, "die Verfälschung traf auch die Suche").toBe(true);
      expect(b.fund.sucheTrifft).toBe(true);
      // (3) DER KERN. Die verfälschte Liste kommt als BENANNTER Fehlschlag an — mit Platz und
      //     Istwert —, nicht als „die Prüfung findet nichts" und nicht als `TypeError`.
      expect(
        b.fund.pruefungEintraegeGueltig,
        `die formlose Ähnlichkeitsliste galt als bewertbar — dann läuft sie nicht mehr durch liesTrefferliste. Gemeldet wurde: „${b.fund.pruefungEintragsFehlschlag}"`,
      ).toBe(false);
      expect(b.fund.pruefungEintragsFehlschlag, "die Meldung nennt den Platz nicht").toMatch(
        /Platz 0/,
      );
      expect(b.fund.pruefungEintragsFehlschlag, "die Meldung nennt den Istwert nicht").toMatch(
        /"ko-1"/,
      );
      expect(
        b.fund.pruefungTrifft,
        "aus einer formlosen Ähnlichkeitsliste wurde ein Treffer gerechnet",
      ).toBe(false);
      // (4) UND BIS ZUR ZUSAGE DER STRECKE, mit der ECHTEN Prüffolge statt einer nachgebauten:
      //     genau die Funktion, die D1 an dieser Stelle fährt, wird hier rot — und ihre Meldung
      //     trägt den Grund. Ohne diese Zeile bliebe offen, ob der Messwert je eine Zusage erreicht.
      expect(() => pruefeAehnlichkeitsliste(b, "W3")).toThrow(/Platz 0/);
      expect(() => pruefeStrecke(b), "die ganze Prüffolge übersah die verfälschte Liste").toThrow(
        /Ähnlichkeitsliste/,
      );
    } finally {
      await schliesse(lauf);
    }
  }, 120_000);

  it("Ü2 · die Strecke ist isoliert: ein zweiter Lauf sieht wieder eine leere Installation", async () => {
    // WARUM DAS HIERHER GEHÖRT und kein Selbstzweck ist: Schritt 1 behauptet „der Stand ist leer".
    // Diese Behauptung wäre wertlos, wenn sie nur beim allerersten Lauf stimmte — dann hinge die
    // ganze Strecke an der Reihenfolge der Testdateien, und ein zweiter Durchgang (oder ein zweiter
    // Wächter daneben) läse die Reste des ersten als Bestand.
    const erster = await fahreStrecke();
    try {
      expect(erster.befund.leer.needsSetup).toBe(true);
      expect(erster.befund.fund.anlageStatus).toBe(201);
    } finally {
      await schliesse(erster);
    }
    const zweiter = await fahreStrecke();
    try {
      expect(zweiter.befund.leer.needsSetup, "der zweite Lauf erbte das Konto des ersten").toBe(
        true,
      );
      expect(zweiter.befund.leer.wissensobjekte, "der zweite Lauf erbte den Bestand").toBe(0);
      expect(zweiter.befund.leer.entwuerfe, "der zweite Lauf erbte die Entwürfe").toBe(0);
      // Und er ist wirklich ein eigener Bestand, nicht derselbe mit anderen Kennungen.
      expect(zweiter.befund.quelle.objektId).not.toBe(erster.befund.quelle.objektId);
      pruefeStrecke(zweiter.befund);
    } finally {
      await schliesse(zweiter);
    }
  }, 180_000);
});
