// ================================================================================================
// AUFTRAG-mega69 BLOCK C + E + F — DIE WÄCHTER FÜR KLARAS EINE DATEI.
// ================================================================================================
//
// taskpane.html ist buildlos, dreisprachig und wurde am 30.07. zweimal geändert und ausgeliefert,
// ohne dass irgendwo etwas aufschlug (mega61/62 → Ship 9). Zwei Wächter dagegen:
//
//  1. UMLAUT-WÄCHTER (Block C): die sichtbaren deutschen Texte tragen echte Umlaute. Der Wächter
//     ist ein SAMMLER: er erhebt die tatsächlichen deutschen Oberflächentexte aus der Datei
//     (Werte des STRINGS.de-Objekts), nicht eine Liste bekannter Sätze. Bezeichner, Schlüssel und
//     Kommentare bleiben bewusst in Umschrift — der Sammler fasst sie gar nicht erst an.
//     BENANNTE GRENZE (enger statt falsch): ss→ß ist nicht maschinell von legitimem „ss"
//     unterscheidbar (muss, dass, Wasser) — der Wächter prüft ae/oe/ue-Umschrift; die beiden
//     ß-Fälle dieser Runde (schliessen, gross) sind behoben, künftige fängt er nicht.
//
//  2. AUSLIEFERUNGS-WÄCHTER (Block E/F): (a) der Stempel-Mechanismus steht — Platzhalter in der
//     Quelle, Anzeige-Element, Ersetzung im Build (vite.config.ts) — damit ändert sich die
//     sichtbare Kennung bei JEDER Auslieferung von selbst (keine von Hand gepflegte Zahl, nirgends
//     eine zweite). (b) ein INHALTS-PIN: ändert sich taskpane.html, wird dieser Test rot und
//     zwingt zu der Frage, die am 30.07. niemand gestellt hat — was bedeutet die Änderung für ein
//     bereits installiertes Add-in (Manifest-Cache? Sideload nötig? reicht der Stempel)? Erst nach
//     dieser bewussten Antwort wird der Pin aktualisiert. Genau EINE Stelle, keine Doppelpflege.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TASKPANE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");

function quelle(): string {
  return readFileSync(TASKPANE, "utf8");
}

/** Die deutschen OBERFLÄCHENTEXTE — Werte des STRINGS.de-Objekts, zeilenweise erhoben. */
function deutscheOberflaechentexte(src: string): Array<{ key: string; text: string }> {
  const start = src.indexOf("var STRINGS = {");
  const deStart = src.indexOf("de: {", start);
  const enStart = src.indexOf("en: {", deStart);
  const block = src.slice(deStart, enStart);
  const out: Array<{ key: string; text: string }> = [];
  for (const line of block.split("\n")) {
    // Nur Key-Wert-Zeilen — Kommentarzeilen (//) und Bezeichner bleiben außen vor. Schlüssel
    // dürfen Ziffern tragen (helpCan1 …) — genau daran ist eine frühere Messung vorbeigelaufen.
    const m = /^\s*([a-zA-Z0-9]+):\s*"(.*)",?\s*$/.exec(line);
    if (m?.[1] && m[2] !== undefined) {
      out.push({ key: m[1], text: m[2] });
    }
  }
  return out;
}

// Umschrift-Erkennung je WORT: ae/oe/ue, außer in Mustern, die in echtem Deutsch vorkommen
// (aue: „genaue", eue: „neue", que/Que: „Quelle", gue: Fremdwörter). Dazu eine EXPLIZITE, knappe
// Liste legitimer Wörter, die das Raster sonst träfe — jede Aufnahme braucht eine Begründung.
const LEGITIM = new Set([
  "Aktuelle", // aktuell — das „ue" ist echtes u+e, keine Umschrift von ü
  "zuerst", // zu-erst — Wortfuge, keine Umschrift
]);

function umschriftWoerter(text: string): string[] {
  const treffer: string[] = [];
  for (const wort of text.match(/[A-Za-zäöüÄÖÜß]+/g) ?? []) {
    if (LEGITIM.has(wort)) {
      continue;
    }
    if (/aue|eue|[gq]ue|Que/.test(wort)) {
      continue;
    }
    if (/ae|oe|ue|Ae|Oe|Ue/.test(wort)) {
      treffer.push(wort);
    }
  }
  return treffer;
}

describe("mega69 C · Umlaut-Wächter: sichtbare deutsche Texte tragen echte Umlaute", () => {
  it("KALIBRIERUNG: der Erkenner schlägt auf Umschrift wirklich an", () => {
    // Ein Prüfer ohne Kalibrierung ist keine Prüfung: genau die Sätze, um die es ging.
    expect(
      umschriftWoerter("Von kuenstlicher Intelligenz erzeugt — bitte fachlich pruefen."),
    ).toEqual(["kuenstlicher", "pruefen"]);
    expect(umschriftWoerter("soweit Word sie uebergibt")).toEqual(["uebergibt"]);
    // … und schweigt bei echtem Deutsch, auch bei den bekannten Rasterfällen.
    expect(
      umschriftWoerter("Von künstlicher Intelligenz erzeugt — bitte fachlich prüfen."),
    ).toEqual([]);
    expect(
      umschriftWoerter("Aktuelle Seite, zuerst die Quellen, eine genaue neue Antwort"),
    ).toEqual([]);
  });

  it("der Sammler erhebt wirklich die deutsche Oberfläche (kein leerer grüner Wächter)", () => {
    const texte = deutscheOberflaechentexte(quelle());
    expect(texte.length).toBeGreaterThanOrEqual(80);
    // Stichprobe: ein DAUERHAFT sichtbarer Text des Fragen-Bereichs ist unter den erhobenen.
    // AUFTRAG-mega81 BLOCK B: hier stand `aiGeneratedNotice`. Das war eine Stichprobe auf einen
    // Satz, der seit mega81 zustandsgebunden ist — als Beleg dafür, dass der Sammler die SICHTBARE
    // Oberfläche erhebt, taugt nur ein Text, der wirklich dauerhaft dasteht.
    expect(texte.some((t) => t.key === "askReviewNotice")).toBe(true);
  });

  it("KEIN deutscher Oberflächentext steht in ASCII-Umschrift", () => {
    const verstoesse: string[] = [];
    for (const { key, text } of deutscheOberflaechentexte(quelle())) {
      for (const wort of umschriftWoerter(text)) {
        verstoesse.push(`${key}: „${wort}“ in „${text.slice(0, 60)}…“`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("die Datei sagt ihre Kodierung an (meta charset utf-8) und trägt echte Umlaute", () => {
    const src = quelle();
    expect(src).toContain('<meta charset="utf-8" />');
    // Beleg statt Behauptung: mindestens eine dauerhaft sichtbare Zeile trägt echte Mehrbyte-
    // Zeichen. AUFTRAG-mega81 BLOCK B: hier stand die Artikel-50-Zeile. Sie ist seit mega81
    // zustandsgebunden — als Kodierungsbeleg für die SICHTBARE Oberfläche wäre sie ein Text, den
    // im Regelfall niemand zu Gesicht bekommt. Der fachliche Prüfhinweis steht immer da.
    expect(src).toContain("Bitte vor Verwendung fachlich prüfen.");
  });
});

describe("mega69 E/F · Auslieferungs-Wächter: Stand wandert von selbst, Änderungen schlagen auf", () => {
  it("der Stempel-Mechanismus steht: Platzhalter, Anzeige-Element und Build-Ersetzung", () => {
    const src = quelle();
    // Quelle trägt den Platzhalter und das Anzeige-Element …
    expect(src).toContain('var KLARA_STAND = "__KLARA_STAND__"');
    expect(src).toContain('id="kw-stand"');
    // … und der Build ersetzt ihn (eine Stelle, keine Handpflege).
    const vite = readFileSync(join(WURZEL, "apps", "web", "vite.config.ts"), "utf8");
    expect(vite).toContain('name: "klara-stand"');
    expect(vite).toContain('replaceAll("__KLARA_STAND__"');
  });

  it("INHALTS-PIN: eine Änderung an taskpane.html wird rot, bevor sie still ausgeliefert wird", () => {
    // Wird dieser Fall rot: taskpane.html hat sich geändert. Das ist KEIN Verbot — es ist die
    // erzwungene bewusste Frage nach den Auslieferungsfolgen für installierte Add-ins
    // (Manifest-/Office-Cache, Sideload, Stempel). Danach: neuen Hash unten eintragen. Der Hash
    // steht NUR hier — niemand pflegt ihn an einer zweiten Stelle.
    // AUFTRAG-mega77 (A/B/C): Auslieferungsfolgen geprüft, bevor der Pin wanderte. Geändert wurden
    // NUR Panel-Inhalte — eine entfernte Anzeigefläche (der Ungeprüft-Zähler), drei entfernte und
    // vier umformulierte Wörterbuch-Schlüssel je Sprache sowie eine Zeitgrenze am Statusabruf.
    // KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein neuer Fremd-Ursprung: ein
    // installiertes Add-in braucht deshalb KEIN erneutes Sideload. Es holt die Datei beim nächsten
    // Öffnen frisch vom Server; bis dahin kann der Office-Cache kurz den alten Stand zeigen — das
    // ist das übliche Verhalten jeder Taskpane-Änderung und nicht neu. Der Stand-Stempel wandert
    // weiter von selbst über den Build (`__KLARA_STAND__`, s. Fall oben).
    // AUFTRAG-mega79 (A/B): Auslieferungsfolgen erneut geprüft, bevor der Pin wanderte. Geändert
    // wurden AUSSCHLIESSLICH Panel-Inhalte und Kommentare — fünf umformulierte Wörterbuch-Schlüssel
    // je Sprache (aiLage*, der Satz behauptete für Klaras Antwort ein Modell), ein erweiterter
    // HTML-Kommentar und zwei Schnittmarken (KW-KLARA-ASK-FETCH-START/END) um das UNVERÄNDERTE
    // `performAsk`. KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein neuer Fremd-Ursprung,
    // KEIN neuer Abruf und keine geänderte Nutzlast: der abgesetzte Rumpf ist byte-gleich
    // (`mode: "retrieval-only"`, in mega79 durch Ausführung erhoben). Ein installiertes Add-in
    // braucht deshalb KEIN erneutes Sideload; es holt die Datei beim nächsten Öffnen frisch.
    // AUFTRAG-mega81 (A/B): Auslieferungsfolgen erneut geprüft, bevor der Pin wanderte. Geändert
    // wurden AUSSCHLIESSLICH Panel-Inhalte und Kommentare: ein zusätzlicher Absatz im Fragen-
    // Bereich (`#ask-review-notice`), der bestehende `#ask-ai-notice` startet verborgen, ein neuer
    // Wörterbuch-Schlüssel je Sprache (`askReviewNotice`), ein aus dem Antwortkörper GELESENES
    // Feld (`aiGenerated`) und die Anzeige-Entscheidung `askAiNoticeVisible` samt Schnittmarken
    // (KW-KLARA-AI-NOTICE-START/END). KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein
    // neuer Fremd-Ursprung, KEIN neuer Abruf und keine geänderte Nutzlast: der abgesetzte Rumpf
    // bleibt byte-gleich (`mode: "retrieval-only"`, in mega79/mega81 durch Ausführung erhoben) —
    // es wird nur MEHR aus der ohnehin empfangenen Antwort gelesen. Ein installiertes Add-in
    // braucht deshalb KEIN erneutes Sideload; es holt die Datei beim nächsten Öffnen frisch.
    // AUFTRAG-W1-VERTRAUENSKOPF-08 (BASIC-0, Bündel A/B): Auslieferungsfolgen erneut geprüft,
    // bevor der Pin wanderte. Geändert wurden AUSSCHLIESSLICH Panel-Inhalte, Stilregeln und
    // Kommentare:
    //   · ein neuer, permanenter Kopfbereich im bestehenden `<header>` (`#klara-trust-head` mit
    //     `#klara-trust-mode` / `#klara-trust-detail`) samt `flex-wrap` an der bestehenden
    //     header-Regel; die bisherige KI-Zeile `#ask-ai-lage` ist dorthin UMGEZOGEN (nicht
    //     entfallen) — derselbe Schlüssel `aiLage*`, dieselbe Funktion `klaraAiLage`;
    //   · zwei feste, anfangs verborgene Zeilen im Antwortblock (`#ask-caveat-line`,
    //     `#ask-conflict-line`) und ein Ausschnittblock (`#ask-snippet-block`) — alle im
    //     vorhandenen `.status`-/Karten-Muster, ohne neue Farbregeln;
    //   · neue Wörterbuch-Schlüssel je Sprache (trustMode*, trustHeadLabel, askCaveat*,
    //     askConflict*, askSnippetLabel, askRole*);
    //   · drei aus dem OHNEHIN empfangenen Antwortkörper GELESENE Felder (`citedSources`,
    //     `steps[0].snippet`, `evidence.sourcesConflicted`) und die Anzeige-Ableitungen darauf
    //     (`klaraTrustHead`, `askEvidenceDetail`, `askSourceRole`, `askSnippetWorthShowing`).
    // KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein neuer Fremd-Ursprung, KEINE
    // geänderte CSP und KEIN neuer Abruf — die Menge der `fetch(...)`-Ziele ist gegen HEAD
    // byte-gleich, ebenso die abgesetzte Nutzlast (`mode: "retrieval-only"`, in
    // tests/app/w1-klara-vertrauenskopf.test.ts durch Ausführung erhoben). Es wird nur MEHR aus
    // der ohnehin empfangenen Antwort gelesen und an einem anderen Ort angezeigt. Ein
    // installiertes Add-in braucht deshalb KEIN erneutes Sideload; es holt die Datei beim
    // nächsten Öffnen frisch vom Server.
    // AUFTRAG-BASIC-W1-KLARA-KOPF-CONSENT-06 (BASIC-1): Auslieferungsfolgen erneut geprüft, bevor
    // der Pin wanderte. VORHERHASH taskpane.html:
    // `ebeb70a72ac91d0fa457cdb8623d1114c97cef38286f2855ab14e00d7e6d5e6d`.
    //
    // ES IST DIESMAL MEHR ALS INHALT — das wird hier ausdrücklich gesagt, statt es unter „Panel-
    // Inhalte" zu verbuchen. Geändert wurden:
    //   · eine zweite, EIGENS ETIKETTIERTE Gruppe im bestehenden permanenten Kopf (`#klara-s4`
    //     mit Etikett, Modus-Pille, Anbieter-/Modell-Zeile, Abweichungs-/Sperrzeile und
    //     Sitzungszeile); der BASIC-0-Teil darüber ist unberührt;
    //   · eine anfangs verborgene Zustimmungskarte (`#klara-consent-card`) im vorhandenen
    //     `.card`-/`.status`-Muster, mit zwei Schaltflächen ohne neue Farbregeln;
    //   · vier Stilregeln (`#klara-s4`, `.s4-label`, `.s4-line`, `.s4-line-muted`) ausschliesslich
    //     aus Tokenpaaren, die mega43 bereits als AA-tragfähig erhoben hat;
    //   · neue Wörterbuch-Schlüssel je Sprache (`s4*`);
    //   · zwei neue Schnittmarkenpaare (`KW-KLARA-S4-START/END` für die reine Ableitung,
    //     `KW-KLARA-S4-FETCH-START/END` für den Abruf).
    //
    // UND — das ist die eigentliche Auslieferungsfolge — VIER NEUE ABRUFZIELE:
    //   `POST /api/klara/sessions`, `GET /api/klara/ai-status`,
    //   `POST|DELETE /api/klara/sessions/{id}/consent`.
    // Alle vier sind SAME-ORIGIN auf derselben App-Domain, auf der dieses Aufgabenfenster liegt,
    // laufen mit derselben Sitzung wie `/api/ask` und stehen so im eingefrorenen Vertrag
    // `services/app/src/routes/klara-ai-routes.ts` (KW-W1-S4-R2-KOPF-FREEZE-17). Deshalb: KEIN
    // Manifest, KEIN neuer Fremd-Ursprung, KEINE geänderte CSP, KEIN neues Recht (alle vier
    // Routen verlangen `ko.read`, das Klara für `/api/ask` ohnehin braucht).
    //
    // DER ASK-WEG BLEIBT BYTE-GLEICH: dieselbe Nutzlast `mode: "retrieval-only"`, derselbe
    // Endpunkt, dasselbe `performAsk`. Hinzugekommen ist nur ein RIEGEL davor — sagt der Server
    // `executionAllowed: false`, geht gar keine Frage hinaus (in
    // tests/app/klara-session-consent-ui.test.ts durch Ausführung erhoben).
    //
    // Ein installiertes Add-in braucht deshalb KEIN erneutes Sideload; es holt die Datei beim
    // nächsten Öffnen frisch vom Server. Was es zusätzlich braucht, ist ein Server, der die
    // Klara-Routen registriert hat — ohne ihn steht der Sitzungsteil ehrlich auf „keine Sitzung"
    // und der Hausstand-Teil arbeitet unverändert weiter.
    // AUFTRAG-BASIC-W1-CONSENT-LIFECYCLE-R3-26 (BEN-Nachpruefung 22): Auslieferungsfolgen erneut
    // geprüft, bevor der Pin wanderte. VORHERHASH taskpane.html:
    // `7ab51f2fac94d8d1b218d2fd1bb4a0fb0c93824c7eb14f9f102e27aed09dff73`.
    //
    // GEÄNDERT WURDEN — und das ist diesmal mehr als Anzeige:
    //   · die Zustimmungszeile leitet ihren Text aus `consentState` UND `externalConsentRequired`
    //     ab (Befund 1: „keine erforderlich" stand neben einem bestehenden Bedarf);
    //   · ein clientseitiger RIEGEL nach gescheitertem Consent-/Rebindaufruf, der den
    //     autorisierenden Stand verwirft und nur durch einen bestätigten Serverstatus fällt
    //     (Befund 2);
    //   · die Payload-Klassen kommen ausschließlich aus `resolution.effectivePayloadClasses`
    //     (`KW-S4-22`); ohne sie gibt es keinen Zustimmungsknopf mehr;
    //   · eine anfangs verborgene Zeile `#klara-consent-blocked` für ausgeschlossene Klassen;
    //   · neue Wörterbuch-Schlüssel je Sprache; `s4ConsentUmfang` trägt jetzt `{klassen}` statt
    //     `{klasse}`.
    //
    // UND — die eigentlichen Auslieferungsfolgen — DREI NEUE LAUFZEIT-BINDUNGEN:
    //   · `pagehide` → `POST /api/klara/sessions/{id}/close` mit `keepalive` (Befund 3);
    //   · `visibilitychange` und `focus` → `GET /api/klara/ai-status` (Befund 4), gedrosselt;
    //   · ein Ablauftimer auf `resolution.expiresAt` → derselbe Statusabruf.
    //   · beim Wechsel unsaved→saved zusätzlich `POST …/document-context` (Befund 5).
    //
    // Alle vier Ziele sind SAME-ORIGIN auf derselben App-Domain, laufen mit derselben Sitzung wie
    // `/api/ask` und stehen so im eingefrorenen Vertrag. Deshalb: KEIN Manifest, KEIN neuer
    // Fremd-Ursprung, KEINE geänderte CSP, KEIN neues Recht — alle Routen verlangen `ko.read`.
    //
    // NEU IST DAGEGEN, dass das Fenster von sich aus wiederkehrend abruft. Die Frequenz hängt am
    // serverseitigen `expiresAt` und ist nach unten auf die vorhandene Poll-Konstante gedeckelt;
    // es gibt genau einen Abruf gleichzeitig und kein `setInterval`. Ein installiertes Add-in
    // braucht KEIN erneutes Sideload; es holt die Datei beim nächsten Öffnen frisch.
    // AUFTRAG-BASIC-W1-CONSENT-REFRESH-R4-34 (BEN-Nachprüfung 32, Befund 4): Auslieferungsfolgen
    // geprüft, bevor der Pin wanderte. VORHERHASH taskpane.html:
    // `0c579ffb4ce185980a2532d390dcd596fe49ef5d2a24500c67c00d20f8c87134`.
    //
    // GEÄNDERT WURDEN AUSSCHLIESSLICH ZWEI ANZEIGE-/ZUSTANDSSTELLEN — keine neue Fläche, kein
    // neues Wort, kein neuer Abruf:
    //   · `klaraS4Refresh` setzt die aufgefrischte Sicht nicht mehr aus der alten Sicht zusammen,
    //     sondern aus einer weissen Liste der Identitätsfelder (`klaraS4Sitzungsidentitaet`).
    //     `consentState` überlebt einen reinen Statusabruf damit NICHT mehr — er stand vorher als
    //     alter Wert neben einer neuen Auflösung und ergab die von BEN belegte Mischsicht.
    //   · `klaraS4ConsentKey` bekommt `externalConsentGranted` dazu und kann „erteilt" nicht mehr
    //     sagen, solange die Auflösung das nicht deckt.
    //
    // KEINE neuen Wörterbuch-Schlüssel, KEIN neues DOM-Element, KEIN neues Abrufziel, KEIN
    // Manifest, KEINE geänderte CSP, KEIN neues Recht. Die Menge der `fetch(...)`-Ziele ist
    // gegenüber Freeze 32 unverändert; es wird nur WENIGER aus dem alten Zustand übernommen.
    // Ein installiertes Add-in braucht deshalb KEIN erneutes Sideload.
    // AUFTRAG-BASIC-W1-ADDIN-STARTSEQUENZ-G2-G3-37 (Preflight-36-Befunde G2/G3):
    // Auslieferungsfolgen geprüft, bevor der Pin wanderte. VORHERHASH taskpane.html:
    // `5d9f33200cd76be82e11593bb166f98a996b74a856a7bc1a4eff153685bb944b`.
    //
    // GEÄNDERT WURDE AUSSCHLIESSLICH DER ZEITPUNKT DES ERSTEN SITZUNGSAUFBAUS:
    //   · `klaraS4Start()` wird nicht mehr synchron am Skriptende gerufen, sondern über
    //     `klaraS4StartAnfordern()` angefordert. Der Aufbau geschieht, sobald die BEREITS
    //     VORHANDENE begrenzte Office-Erkennung ein Ergebnis hat — durch ihren Rückruf oder durch
    //     ihre Frist `OFFICE_READY_TIMEOUT_MS`. Es gibt KEINE neue Frist und KEINE neue Erkennung.
    //   · `markOfficeChecked` öffnet dieses Tor genau einmal; ein später Rückruf nach der Frist
    //     erzeugt keine zweite Sitzung.
    //   · Der belegte Anmelde-Erfolg in `checkSession` holt eine FEHLENDE Sitzung genau einmal
    //     nach. Bleibt die Anmeldung aus, geschieht nichts — kein Wiederholzyklus.
    //   · Der `pagehide`-Kommentar unterscheidet jetzt Codepfad von offener Word-Evidenz.
    //
    // KEINE neue Fläche, KEIN neuer Wörterbuch-Schlüssel, KEIN neues Abrufziel, KEIN Manifest,
    // KEINE geänderte CSP, KEIN neues Recht. Die Menge der `fetch(...)`-Ziele ist gegenüber
    // Freeze 34 unverändert; es wird nur SPÄTER und SELTENER aufgebaut.
    //
    // Auslieferungsfolge für ein installiertes Add-in: die erste Sitzung entsteht jetzt bis zu
    // `OFFICE_READY_TIMEOUT_MS` (4 s) später als bisher — im Gegenzug entfällt die falsche
    // `unsaved`-Bindung samt anschließendem Rebind, der die gerade erteilte Zustimmung verwarf.
    // KEIN erneutes Sideload nötig; die Datei wird beim nächsten Öffnen frisch geholt.
    // AUFTRAG-BASIC-W1-LOGIN-NACHHOLUNG-BEN37-KORREKTUR-48 (roter BEN-Befund aus der Nachprüfung
    // zu Freeze 37): Auslieferungsfolgen geprüft, bevor der Pin wanderte. VORHERHASH
    // taskpane.html: `1f65b9f781499c6f73e1da947352e013a67dc78c2e105546d2dce0661e1f51d6`.
    //
    // GEÄNDERT WURDE AUSSCHLIESSLICH DIE LEBENSDAUER EINES RECHTS — nicht sein Ablauf:
    //   · neuer Merker `klaraS4NachholungVerbraucht`. Die Login-Nachholung war als „genau einmal"
    //     zugesichert, wurde aber bei JEDEM späteren positiven `/api/auth/me` erneut freigegeben,
    //     solange die Sitzung fehlte. BEN maß statt zwei Sitzungsaufbauten vier.
    //   · `klaraS4NachAnmeldung` kehrt jetzt zusätzlich bei verbrauchter Nachholung um und
    //     verbraucht das Recht genau dann, wenn es wirklich freigegeben wird.
    //
    // KEINE neue Fläche, KEIN neuer Wörterbuch-Schlüssel, KEIN neues DOM-Element, KEIN neues
    // Abrufziel, KEIN Manifest, KEINE geänderte CSP, KEIN neues Recht, KEINE neue Frist und KEINE
    // Zeitschleife. Die Menge der `fetch(...)`-Ziele ist gegenüber Freeze 37 unverändert.
    //
    // Auslieferungsfolge für ein installiertes Add-in: nach einem am Server GESCHEITERTEN
    // Nachholversuch wird bis zum erneuten Öffnen des Aufgabenfensters nicht mehr angeklopft. Der
    // Zustand „keine Sitzung" wird dann sichtbar gesagt, statt still weiter versucht zu werden —
    // ein wieder antwortender Server allein holt die Sitzung nicht mehr nach. Es wird also
    // SELTENER aufgebaut, nie öfter. KEIN erneutes Sideload nötig; die Datei wird beim nächsten
    // Öffnen frisch geholt.
    // ----------------------------------------------------------------------------------------
    // 10.08.2026 — DER PIN ZEIGTE AUF EINEN STAND, DEN ES NIRGENDS GAB.
    // ----------------------------------------------------------------------------------------
    //
    // Der bisherige Wert `6ab0fe9095323383f9a5edb61b0ab0e519746b55c73b0498d58e816b663df4de`
    // stimmt mit KEINER aufgezeichneten Fassung der Datei überein — gemessen:
    //   · `main` (8f74f82)                          → 0cf394b1946bbb495d832470ca97389d…
    //   · Archiv-Tag arbeitsbaum-20260810-ungeprueft → 0cf394b1946bbb495d832470ca97389d… (gleich)
    //   · Arbeitsbaum                                → 4bf88d4e465c4b4ac341780b4d204833…
    //
    // Der gepinnte Stand existierte also nur in der flüchtigen Arbeitskopie einer Bahn und ist mit
    // ihr verschwunden. Damit war die Kette der Vorherhashes über diesem Kommentar unterbrochen:
    // der letzte dokumentierte Übergang lässt sich nicht mehr nachvollziehen, weil sein Ergebnis
    // nie in eine Fassung gelangte, die jemand später lesen kann.
    //
    // DER FEHLENDE SCHRITT WIRD NICHT ERFUNDEN. Statt eine Begründung zu schreiben, die niemand
    // prüfen kann, steht hier die einzige Grundlinie, die es wirklich gibt — `main` — und der
    // gegen sie gemessene Unterschied:
    //   · +1534 Zeilen, −16; NUR diese eine Datei. `manifest.xml` ist unberührt (git diff --stat).
    //   · Alle neuen Abrufziele sind SAME-ORIGIN und haben ihr serverseitiges Gegenstück in
    //     `services/app/src/routes/klara-ai-routes.ts`, nachgezählt: `/api/klara/ai-status`,
    //     `/api/klara/sessions`, `…/:sessionId`, `…/:sessionId/document-context`,
    //     `…/:sessionId/consent` (POST und DELETE), `…/:sessionId/close`. Kein Fremd-Ursprung,
    //     keine geänderte CSP, kein neues Recht.
    //   · Die Flächen selbst sind durch Ausführung belegt: klara-ai-header (36),
    //     w1-klara-vertrauenskopf (33) und klara-session-consent-ui (17) sind grün.
    //
    // Auslieferungsfolge: KEIN erneutes Sideload. Ein installiertes Add-in holt die Datei beim
    // nächsten Öffnen frisch; ohne einen Server mit den Klara-Routen steht der Sitzungsteil
    // ehrlich auf „keine Sitzung", der Hausstand-Teil arbeitet unverändert weiter.
    // AUFTRAG-JOB507-D4 (10.08.2026): Auslieferungsfolgen geprueft, bevor der Pin wanderte.
    // VORHERHASH taskpane.html: `4bf88d4e465c4b4ac341780b4d20483394a2a25582e20b3bfe47b05180f85206`.
    //
    // GEAENDERT WURDE AUSSCHLIESSLICH DIE DEUTUNG EINES VORHANDENEN ANTWORTKOPFS:
    //   · `parseRetryAfterSeconds` samt Deckel `WORD_ADDIN_RETRY_AFTER_MAX_SECONDS = 3600` und
    //     der strengen IMF-fixdate-Pruefung `RETRY_AFTER_HTTP_DATE`. Grund laut Auftrag: `Date.parse`
    //     ist nachsichtig und liest auch „12.5" als Datum — eine erfundene Auskunft saehe dann aus
    //     wie eine echte. `null` heisst „unbekannt", `0` heisst „jetzt"; das ist nicht dasselbe.
    //   · Der Block ist der SPIEGEL von `apps/web/src/lib/wordAddin.ts#parseRetryAfterSeconds`;
    //     die ausfuehrliche Begruendung steht dort.
    //
    // KEIN neues Abrufziel (die Menge der `fetch(...)`-Ziele ist gegen den Vorgaengerstand
    // unveraendert), KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEINE neue Nutzlast.
    // Gedeutet wird nur ein Kopf, den der Server ohnehin schon sendet. Ein installiertes Add-in
    // braucht deshalb KEIN erneutes Sideload.
    //
    // ============================================================================================
    // K1.1 · JOB 660 D3 (12.08.2026) — DER PIN WANDERT WEGEN DER WORD-HERKUNFT.
    // ============================================================================================
    // VORHERHASH taskpane.html: `c72d6f9ba57ed888b91b1eb8f10ee09612ea5232de4b8c8570201cd9e71f276e`.
    //
    // GEAENDERT WURDEN GENAU VIER STELLEN, alle in derselben Sache: Entwuerfe aus dem Word-
    // Aufgabenfenster trugen im gespeicherten Herkunftsfeld `frontdoor` — dieselbe Herkunft wie ein
    // Entwurf aus der Web-Vordertuer. Der Server kennt `word_addin` als eigene Herkunft laengst
    // (services/capture/src/service.test.ts, Bloecke „JOB 510 R10" und „JOB 510 D3"); das Panel hat
    // sie nur nie gesendet.
    //   · Zeile 778  — `draftPostPayload`, Herkunft → `word_addin`
    //   · Zeile 4077 — Wissensluecken-Payload, Herkunft → `word_addin`
    //   · Zeile 3111 — zugehoeriger Kommentar nachgezogen
    //   · Zeile 4051 — zugehoeriger Kommentar nachgezogen
    //
    // AUSDRUECKLICH NICHT ANGEFASST — es sind APP-ROUTEN, keine Herkunftswerte:
    //   · Zeile 3167 und 4105 — `"/capture/frontdoor?draft=" + …` (Entwurf-fortsetzen-Mechanik)
    //   · Zeile 3164 — der Kommentar, der genau diese Route beschreibt
    // Ein Suchen-und-Ersetzen haette alle sieben Fundstellen erwischt und die Deep-Links zerstoert.
    // Der Wachhund dagegen ist `tests/app/k1-word-addin-origin-panel.test.ts`: er prueft BEIDE
    // Richtungen — Herkunft muss gewandert sein, die zwei Routen duerfen es nicht.
    //
    // AUSLIEFERUNGSFOLGE, vor dem Wandern des Pins geprueft: KEIN Manifest-, CSP-, Rechte- oder
    // Endpunktwechsel, KEINE neue Nutzlast, KEIN Sideload. Ein installiertes Add-in holt die
    // Paneldatei beim naechsten Oeffnen frisch; der Office-Cache kann bis dahin kurz den alten
    // Stand zeigen — dann sendet das Panel noch `frontdoor`. Der Server nimmt beide Werte
    // unveraendert an (BEKANNTE_HERKUENFTE), es geht also nichts verloren; die Unterscheidung
    // greift, sobald die Datei neu geladen ist.
    const PIN = "8f5829557d111c2439dc922adb8023350dc9c2a388edff992a5c377a369cb2d0";
    const ist = createHash("sha256").update(readFileSync(TASKPANE)).digest("hex");
    expect(
      ist,
      "taskpane.html wurde geändert — Auslieferungsfolgen bewusst prüfen (Kommentar oben), dann den Pin aktualisieren.",
    ).toBe(PIN);
  });
});
