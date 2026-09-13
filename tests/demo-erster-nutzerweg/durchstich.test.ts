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
import { describe, expect, it } from "vitest";
import {
  DOKUMENTWORT,
  EIGENER_TITEL,
  EIGENE_AUSSAGE,
  QUELLSATZ,
  SUCHWORT,
  type Streckenbefund,
  type Wiedersehen,
  fahreStrecke,
  liesSuchantwort,
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
 * Beide Zusagen tragen den KÖRPER in ihrer Meldung: eine rote Stelle soll sagen, WAS statt der Liste
 * kam, nicht nur „erwartet 200, war 503".
 */
function pruefeSuchantwort(status: number, istListe: boolean, koerper: string, wo: string): void {
  expect(
    status,
    `${wo}: die Suche antwortete mit HTTP ${status} statt 200 — Körper: ${koerper}. Ein Fehlschlag ist kein leeres Ergebnis.`,
  ).toBe(200);
  expect(
    istListe,
    `${wo}: die Suche antwortete zwar mit HTTP 200, aber nicht mit einer Trefferliste — Körper: ${koerper}. Ein Fehlerobjekt ist kein leeres Ergebnis, und „nicht gefunden" wäre hier eine Behauptung ohne Messung.`,
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
        b.fund.sucheKoerper,
        `Ü1 · GET /api/library/search?q=${SUCHWORT}`,
      );
      pruefeSuchantwort(
        b.fund.sucheDokumentStatus,
        b.fund.sucheDokumentIstListe,
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

  it("W2 · ANTWORTFORM: ein Fehlerobjekt mit HTTP 200 und eine 503 sind kein Beleg für „nichts gefunden“", () => {
    // DER DAUERHAFTE GEGENFALL ZU BENS GEGENPROBE (Runde 1, Prüflücke 6). Er braucht keine Strecke:
    // gemessen wird das Paar, an dem die Blindheit hing — `liesSuchantwort` (was kam?) und
    // `pruefeSuchantwort` (darf man daraus „nicht gefunden" lesen?). Als reine Verstellprobe wäre
    // die Eigenschaft beim nächsten Umbau wieder weg; als Fall bleibt sie.
    const fehlerkoerper = JSON.stringify({ error: "BEN_DOKUMENTSUCHE_DEFEKT" });
    const wo = "W2";

    // (i) DIE ECHTE LEERE TREFFERLISTE MUSS DURCHGEHEN. Ohne diese Zeile wäre die Zusage nur
    //     streng und nicht richtig — Ü1 und D2 leben davon, dass eine leere Liste gilt.
    const leer = liesSuchantwort({ statusCode: 200, payload: "[]" }, "ko-1");
    expect(leer.istListe).toBe(true);
    expect(leer.trifft).toBe(false);
    expect(() => pruefeSuchantwort(leer.status, leer.istListe, leer.koerper, wo)).not.toThrow();

    // (ii) HTTP 200 MIT FEHLEROBJEKT — genau die Verstellung, unter der D2 und Ü1 grün blieben.
    const getarnt = liesSuchantwort({ statusCode: 200, payload: fehlerkoerper }, "ko-1");
    expect(getarnt.istListe, "ein Fehlerobjekt wurde als Trefferliste gelesen").toBe(false);
    // UND HIER STEHT DIE BLINDHEIT SELBST, festgehalten statt beschrieben: der Trefferwert allein
    // ist von einer echten Leersuche NICHT zu unterscheiden. Genau an ihm hingen beide
    // Negativaussagen, und genau deshalb reicht er nicht.
    expect(getarnt.trifft).toBe(false);
    expect(() => pruefeSuchantwort(getarnt.status, getarnt.istListe, getarnt.koerper, wo)).toThrow(
      /BEN_DOKUMENTSUCHE_DEFEKT/,
    );

    // (iii) HTTP 503 — Status UND Körper müssen in der Meldung stehen. Ein „erwartet 200, war 503"
    //       allein sagt dem Lesenden nicht, was der Server stattdessen ausgab.
    const kaputt = liesSuchantwort({ statusCode: 503, payload: fehlerkoerper }, "ko-1");
    const werfe503 = () => pruefeSuchantwort(kaputt.status, kaputt.istListe, kaputt.koerper, wo);
    expect(werfe503).toThrow(/HTTP 503/);
    expect(werfe503).toThrow(/BEN_DOKUMENTSUCHE_DEFEKT/);

    // (iv) UND GAR KEIN JSON — ein Fehlerblatt eines Vorschalters. Kein `catch`, das daraus eine
    //      leere Liste macht: es wird zum benannten Fehlschlag, mit dem Rumpf in der Meldung.
    const blatt = liesSuchantwort(
      { statusCode: 200, payload: "<html>Gateway Timeout</html>" },
      "ko-1",
    );
    expect(blatt.istListe).toBe(false);
    expect(() => pruefeSuchantwort(blatt.status, blatt.istListe, blatt.koerper, wo)).toThrow(
      /Gateway Timeout/,
    );
  });

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
