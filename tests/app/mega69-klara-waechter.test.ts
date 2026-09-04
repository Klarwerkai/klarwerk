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
//
// ================================================================================================
// JOB 537 · D4 (Pedis Entscheidung) — ES GIBT EINEN ZWEITEN WÄCHTER. BEIDE SIND GEWOLLT.
// ================================================================================================
//
// `tests/app/mega69-klara-merkmale.test.ts` steht seit JOB 537 D4 NEBEN dieser Datei. Pedi hat
// ausdrücklich „beide koexistieren, getrennte Schutzzwecke" entschieden und dabei „Pin ersetzen"
// und „Pin schliessen" verworfen. Die Arbeitsteilung, gemessen und nicht behauptet:
//
//   · DIESE Datei fragt „HAT SICH ETWAS BEWEGT?" — der Pin unten wird bei jeder Byteänderung rot,
//     auch bei einem Tippfehler in einem Kommentar. Er kann nicht sagen, WAS sich bewegt hat.
//   · Der Merkmalsvertrag fragt „FEHLT ETWAS TRAGENDES?" — er prüft zehn ausführbare Eigenschaften
//     und bleibt bei einer reinen Kommentaränderung grün.
//
// In JOB 537 D4 gemessen: eine eingefügte Kommentarzeile in taskpane.html macht den Pin rot und
// lässt alle 23 Fälle des Merkmalsvertrags grün. Eine zerstörte tragende Zeile macht BEIDE rot,
// und der Merkmalsvertrag benennt dabei, WELCHE Eigenschaft fehlt.
//
// WER EINEN DER BEIDEN FÜR EINE DUBLETTE HÄLT UND ENTFERNT, verliert genau eine der beiden Fragen.
// Wandert der Pin unten das nächste Mal, prüft der Merkmalsvertrag die Prosa-Zusagen mit, die in
// diesem Kommentar seit mega77 bei jedem Wandern wiederholt werden („kein neues Abrufziel, kein
// Manifest, keine geänderte CSP, kein neues Recht, keine geänderte Nutzlast").
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
    // ============================================================================================
    // JOB 1077 D7 (17.08.2026) — DER PIN WANDERT WEGEN DER FASSUNGSKETTE.
    // ============================================================================================
    // VORHERHASH taskpane.html: `8f5829557d111c2439dc922adb8023350dc9c2a388edff992a5c377a369cb2d0`.
    //
    // GEAENDERT WURDE, und zum ersten Mal seit langem ist es MEHR als Panelinhalt:
    //   · ein neues Meta `kw-loaded-version` mit dem PLATZHALTER `__KW_FASSUNG__` — keine Zahl,
    //     die jemand pflegt; ersetzt wird sie beim AUSLIEFERN (services/app/src/web-static.ts);
    //   · eine Anzeigezeile `#kw-fassung` und ein anfangs VERBORGENER Knopf `#kw-fassung-btn`,
    //     beide im vorhandenen `.muted`/`.ghost`-Muster, ohne neue Farbregel;
    //   · vier Woerterbuch-Schluessel je Sprache (`fassungAktuell`, `fassungWechsel`,
    //     `fassungUnbekannt`, `fassungCta`);
    //   · ein Schnittmarkenpaar `KW-KLARA-FASSUNG-START/END` um vier reine Funktionen
    //     (`kwGeladeneFassungAus`, `kwWechselOffen`, `kwVerfuegbareFassungLaden`,
    //     `kwWechselAusloesen`) und deren Verdrahtung am Skriptende.
    //
    // UND — die eigentliche Auslieferungsfolge — EIN NEUES ABRUFZIEL:
    //   `HEAD /word-addin/taskpane.html`.
    // Es ist DIE EIGENE ADRESSE dieser Seite, nicht eine fremde. KEIN Manifest, KEINE geaenderte
    // CSP (`connect-src 'self'` deckt den eigenen Ursprung), KEIN neues Recht (oeffentliche
    // statische Auslieferung), KEINE Nutzlast (HEAD sendet und empfaengt keinen Koerper), und
    // genau EIN Abruf je Laden des Aufgabenfensters — kein Intervall. Die ausfuehrliche Antwort
    // auf „CSP? Recht? Manifest?" steht bei `BEKANNTE_ABRUFZIELE` in
    // `tests/app/mega69-klara-merkmale.test.ts`.
    //
    // DER BAU-STEMPEL BLEIBT UNBERUEHRT: `__KLARA_STAND__` beantwortet „wann wurde gebaut",
    // `__KW_FASSUNG__` „ist meine Seite noch die, die ausgeliefert wird". Zwei Platzhalter, zwei
    // Ersetzer — der eine im Build, der andere im Server; gepinnt als eigener Fall (E5).
    //
    // AUSLIEFERUNGSFOLGE: KEIN erneutes Sideload. Ein installiertes Add-in holt die Datei beim
    // naechsten Oeffnen frisch. Antwortet ein AELTERER Server den Kopf nicht, bleibt die neue
    // Zeile ehrlich bei „Abgleich nicht moeglich" — nie bei „aktuell"; die Seite funktioniert im
    // Uebrigen unveraendert weiter.
    // ============================================================================================
    // JOB 1149 D2 (18.08.2026) — DER PIN WANDERT WEGEN DES DOKUMENT-BEGRIFFSBILDS (KA1).
    // ============================================================================================
    // VORHERHASH taskpane.html: `ee0f53d837343abec3c3e4e89545d3a118e7404842e1ba30e7d797407ff80059`.
    //
    // GEAENDERT WURDE IN JOB 1149 D1 GENAU EIN ZUSAMMENHAENGENDES PAAR VON SCHNITTMARKEN
    // (`KW-KA1-TERMS-START/END`), an zwei Stellen derselben Datei — keine Zeile ausserhalb:
    //   · im Abschnitt `#section-ask` eine Karte `#ka1-block` mit Liste `#ka1-terms` und der
    //     Leerzeile `#ka1-empty`, im vorhandenen `.card`/`.muted`-Muster, ohne neue Farbregel;
    //   · am Skriptende der Block, der aus dem offenen Dokument die Begriffsliste bildet: die
    //     GESPIEGELTE Suchregel des Hauses (Bereinigung, Zerlegung, Termbereinigung), ein Deckel,
    //     die Anzeige und die Woerterbuchschluessel, die sich selbst in `STRINGS` eintragen.
    //
    // DIE EIGENTLICHE AUSLIEFERUNGSFOLGE IST HIER, DASS ES KEINE GIBT — und das ist belegt, nicht
    // behauptet: KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEINE neue Nutzlast und vor
    // allem KEIN neues Abrufziel. Der Block sendet ueberhaupt nichts; die Begriffe entstehen
    // ausschliesslich im Aufgabenfenster aus dem Text, den Word ohnehin schon geliefert hat
    // (`readWholeDocument`). Gepinnt ist das doppelt in `tests/app/word-addin.test.ts`, Gruppe
    // „JOB 1149 · KA1": einmal zur LAUFZEIT (Spione auf den Sendewegen, die stumm bleiben) und
    // einmal STRUKTURELL (im ausgelieferten Markerblock steht kein Sendeweg) — ein Zweig, den keine
    // Fixture betritt, faellt damit trotzdem auf.
    //
    // KEINE ZWEITE SUCHWAHRHEIT: das Aufgabenfenster ist buildlos und kann die Hausregeln nicht
    // einbinden, es muss sie spiegeln. Gemessen wird deshalb nicht der Quelltext der Kopie, sondern
    // ihr VERHALTEN gegen `normalizeSearchTerms(queryTokens(normalizeSearchFragment(...)))` auf
    // zwoelf Fixtures — dieselbe Bauform wie bei `KW-WORDADDIN-HELPERS-*`. Laeuft die Kopie eines
    // Tages von der Hausregel weg, wird jener Test rot, bevor diese Zeile hier es wird.
    //
    // KEIN erneutes Sideload. Ein installiertes Add-in holt die Datei beim naechsten Oeffnen frisch;
    // zeigt der Office-Cache kurz den alten Stand, fehlt genau die Karte — nichts wird falsch.
    // ============================================================================================
    // JOB 1152 D3 (19.08.2026) — DER PIN WANDERT EIN ZWEITES MAL: KA4 KOMMT ZU KA1 DAZU.
    // ============================================================================================
    // ZWEI VORHERSTAENDE, weil dieser Pin zwei Wanderungen hinter sich hat und beide belegt sein
    // muessen:
    //   · vor KA1 (JOB 1149 D2): `ee0f53d837343abec3c3e4e89545d3a118e7404842e1ba30e7d797407ff80059`
    //   · vor KA4 (dieser Nachzug): `47f6cf2c72b229c562a99bc15dacd4bac919b60d21038ec418ccbf2ae3b1f39d`
    //
    // WARUM ZWEIMAL. KA1 und KA4 standen beide auf Base `9b87037` und haben BEIDE genau diese
    // Pinzeile ersetzt. KA1 wurde zuerst integriert (`90eddf2`); KA4 wird hier nachgezogen. Der
    // Begruendungsblock von JOB 1149 D2 darueber bleibt deshalb UNVERAENDERT stehen — er
    // beantwortet die Auslieferungsfrage fuer das Dokument-Begriffsbild und ist durch den KA4-
    // Nachzug nicht falsch geworden. Dieser Block kommt DAZU, er ersetzt ihn nicht.
    //
    // GEAENDERT WURDE DURCH KA4 — Panelinhalt und EIN zusaetzliches Kopfzeilenfeld am bestehenden
    // Abruf (unveraendert gegenueber JOB 1152 D1/D2, nur auf die neue Base uebertragen):
    //   · der Consent-Wortlaut nennt in DE/EN/NL jetzt DAS DOKUMENT statt nur die Sitzung
    //     (`s4ConsentTitel`, `s4ConsentText`) — die Zustimmung ist serverseitig an
    //     `documentContextId` gebunden, ein Rebind verwirft sie;
    //   · fuenf neue Woerterbuch-Schluessel je Sprache (`ka4FrageTitel`, `ka4FrageText`,
    //     `ka4FrageJa`, `ka4FrageNein`, `ka4Abgelehnt`);
    //   · ein Schnittmarkenpaar `KW-KA4-DOKUMENT-CONSENT-START/END` um vier reine Funktionen
    //     (`ka4DokumentSchluessel`, `ka4WurdeAbgelehnt`, `ka4Ablehnen`, `ka4DarfAktivFragen`),
    //     den Frageblock, seine Anzeige und seine zwei Ereignisbindungen;
    //   · ein anfangs VERBORGENER Block `#ka4-frage` und eine verborgene Zeile `#ka4-abgelehnt`,
    //     beide im vorhandenen `.primary`/`.ghost`/`.muted`-Muster, ohne neue Farbregel;
    //   · `performAsk` bekommt einen fuenften Parameter `bindungsKopf`; der Aufrufer reicht die
    //     bereits vorhandenen `klaraS4Header()` hinein.
    //
    // KA1 BLEIBT VOLLSTAENDIG: der uebertragene Delta ist zeilengenau derselbe wie gegen `9b87037`
    // (162 Einfuegungen, 9 Loeschungen, im Nachzug gemessen). Es kam nur KA4 hinzu; keine Zeile des
    // Begriffsbilds wurde angefasst. Die KA1-Zusagen bleiben von `tests/app/word-addin.test.ts`,
    // Gruppe „JOB 1149 · KA1", ausfuehrbar bewacht.
    //
    // AUSLIEFERUNGSFOLGE — unveraendert gegenueber D1/D2 und hier erneut am kombinierten Stand
    // geprueft:
    //   · KEIN Manifestwrite, KEIN erneutes Sideload. Ein installiertes Add-in holt die Paneldatei
    //     beim naechsten Oeffnen frisch; der bestehende Fassungsstempel (`__KW_FASSUNG__`) meldet
    //     den Wechsel von selbst.
    //   · KEINE neue Office-API und KEIN neues Recht — es kommt keine Word-JS-Faehigkeit hinzu.
    //   · KEINE geaenderte CSP und KEIN NEUES ABRUFZIEL: der Ask geht unveraendert an
    //     `POST /api/ask` am eigenen Ursprung. Neu sind allein drei KOPFZEILEN
    //     (`x-klara-session`, `x-klara-instance`, `x-klara-document`) — dieselben, die der
    //     Sitzungsweg dieses Panels laengst sendet. Same-origin, also kein Preflight.
    //   · KEINE neue Nutzlast: der Koerper ist unveraendert (`question`, `locale`, `mode`).
    //   · Ein AELTERER Server ignoriert die drei Kopfzeilen schlicht — nichts geht verloren.
    // ============================================================================================
    // JOB 1151 D3 (19.08.2026) — DER PIN WANDERT EIN DRITTES MAL: KA3 KOMMT ZU KA1 UND KA4 DAZU.
    // ============================================================================================
    // DREI VORHERSTAENDE, weil dieser Pin drei Wanderungen hinter sich hat und alle drei belegt
    // sein muessen:
    //   · vor KA1 (JOB 1149 D2): `ee0f53d837343abec3c3e4e89545d3a118e7404842e1ba30e7d797407ff80059`
    //   · vor KA4 (JOB 1152 D3): `47f6cf2c72b229c562a99bc15dacd4bac919b60d21038ec418ccbf2ae3b1f39d`
    //   · vor KA3 (dieser Nachzug): `440f752828424b538e0c69978b360d7f25092687c2a9b280faa19b1b77a4b737`
    //
    // WARUM DREIMAL. KA1, KA3 und KA4 standen ALLE DREI auf Base `9b87037` und haben alle drei
    // genau diese Pinzeile ersetzt. Integriert wurde zuerst KA1 (`90eddf2`), dann KA4 (`45ab152`);
    // KA3 wird hier nachgezogen. Die zwei Begruendungsbloecke darueber bleiben deshalb
    // UNVERAENDERT stehen — sie beantworten die Auslieferungsfrage fuer das Begriffsbild und fuer
    // die Dokument-Einwilligung und sind durch diesen Nachzug nicht falsch geworden. Dieser Block
    // kommt DAZU, er ersetzt keinen von beiden.
    //
    // GEAENDERT WURDE DURCH KA3 AUSSCHLIESSLICH PANELINHALT — eine einzige zusammenhaengende
    // Markenregion `KW-KA3-KARTEN-START/END` (253 Zeilen), unveraendert gegenueber JOB 1151 D1/D2
    // und im Nachzug byteweise uebertragen, nur an einer anderen STELLE eingesetzt:
    //   · `KA3_TASTENRUHE_MS = 30000` — die Tastenruhe aus Pedis Richtwert in OFFEN.md;
    //   · `ka3Vertrag`, `ka3KarteElement`, `ka3Normalisieren`, `ka3Zeichnen`, `ka3Neuzeichnen`,
    //     `ka3Ausfuehren`, `ka3Planen`, `ka3Stoppen`, `ka3EreignisBinden` — reine Ableitung und
    //     DOM-Erzeugung; die Karten entstehen programmatisch, damit die Datei genau EINE
    //     zusammenhaengende Aenderungsstelle traegt;
    //   · neue Woerterbuch-Schluessel je Sprache (`ka3*`), eingehaengt in das vorhandene
    //     `STRINGS`-Objekt; das Gegenstueck fuer die Web-Oberflaeche liegt in `apps/web/src/i18n.ts`
    //     (`klara.offer.label` / `.lead` / `.open`).
    //
    // ZUR STELLE, weil sie das Einzige ist, was der Nachzug wirklich geaendert hat: in D2 stand der
    // Block unmittelbar hinter `klaraS4StartAnfordern();`. Dort steht seit `90eddf2` der
    // KA1-Block. KA3 sitzt jetzt HINTER `KW-KA1-TERMS-END` — weiterhin am Skriptende und weiterhin
    // nach allem, was er braucht (`STRINGS`, `t`, `ASK_STATUS_KEYS`, `koDetailUrl`,
    // `officeUsable`, `markOfficeChecked`). Der KA1-Block dazwischen definiert nur eigene Namen.
    //
    // KA1 UND KA4 BLEIBEN VOLLSTAENDIG: der Diff dieses Durchgangs gegen `45ab152` enthaelt in
    // `taskpane.html` NUR die 253 KA3-Zeilen — keine Zeile des Begriffsbilds und keine Zeile der
    // Dokument-Einwilligung wurde angefasst. Beide bleiben ausfuehrbar bewacht
    // (`tests/app/word-addin.test.ts`, Gruppe „JOB 1149 · KA1"; `tests/app/word-addin-ask.test.ts`).
    //
    // KEIN NEUES ABRUFZIEL: die Karten fragen KEINEN Server. Sie beziehen ihren Bestand ueber die
    // clientseitige KA2-Naht `window.klaraBestandsblick(grund)` — eine Funktion im selben Fenster,
    // kein `fetch`. Fehlt sie, zeichnet KA3 nichts (fail-closed). Die Menge der `fetch(...)`-Ziele
    // ist gegen `45ab152` unveraendert; ausfuehrbar belegt durch `BEKANNTE_ABRUFZIELE` in
    // `tests/app/mega69-klara-merkmale.test.ts`, das gegen diesen Stand gruen steht.
    // Das „Ansehen" der Karte ist ein gewoehnlicher Verweis auf die eigene App-Domain, wie ihn die
    // vorhandene Quellenliste schon traegt — kein Abruf, keine Nutzlast.
    //
    // KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEINE geaenderte Nutzlast, KEIN neuer
    // Fremd-Ursprung und KEIN `setInterval` — die Tastenruhe ist ein Entprellen mit Generationen-
    // zaehler, es laeuft nie mehr als ein Durchgang.
    //
    // AUSLIEFERUNGSFOLGE fuer ein installiertes Add-in: KEIN erneutes Sideload. Die Datei wird beim
    // naechsten Oeffnen frisch vom Server geholt; bis dahin kann der Office-Cache kurz den alten
    // Stand zeigen — dann fehlen nur die Karten, alles Uebrige arbeitet unveraendert weiter. Der
    // Anwender verliert dabei nie den Cursor: die Karte wird ausserhalb des Eingabebereichs
    // gezeichnet und ruft nie `focus()` — das ist die Abnahme aus `OFFEN.md`, Abschnitt „1a-KA".
    // ==========================================================================================
    // NACHFUEHRUNG JOB 1153 · D3 — und die Pruefung, die der Waechter dafuer verlangt.
    // ==========================================================================================
    // Der Pin steigt hier zum dritten Mal fuer KA6: D1 hat die Schreibflaeche gebaut (Pin blieb
    // damals stehen und war zu Recht rot), D2 macht die Herkunft zur Invariante aller
    // Uebernahmewege, D3 oeffnet den vierten dieser Wege. Alle drei Staende liegen im Marker
    // `KW-KA6-SCHREIBEN`.
    //
    //   c3b06253… → 55345e78…  (D1, BASIC4: die Schreibflaeche)
    //   55345e78… → 6a833163…  (D2, BASIC3: Herkunft auf allen Wegen, fail-closed, Zustandswechsel)
    //   6a833163… → d163274d…  (D3, BASIC4: der Kopierknopf als offener Uebernahmeweg)
    //
    // AUSLIEFERUNGSFOLGEN, einzeln geprueft — dieselbe Liste, die dieser Waechter fuer KA3 fuehrt:
    //   · KEIN neues Abrufziel. D3 fuegt keinen einzigen `fetch(...)`-Aufruf hinzu; die Menge der
    //     Ziele bleibt unveraendert (`BEKANNTE_ABRUFZIELE` in mega69-klara-merkmale steht gruen).
    //   · KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEINE geaenderte Nutzlast, KEIN
    //     neuer Fremd-Ursprung.
    //   · KEIN `setInterval`, kein Takt, kein Autostart. D3 haengt an einem DRITTEN Wrapper um
    //     eine bereits gerufene Funktion (`updateInsertState`) — dieselbe Bauform wie D2 sie fuer
    //     `renderAskOutcome` und `composeOutputText` gewaehlt hat.
    //   · KEIN zusaetzlicher Schreibweg ins Dokument. Die beiden Schreibaufrufe bleiben, wo sie
    //     sind (`buildInsertAttempts`), hinter genau einem Klick. Der Kopierknopf schreibt in die
    //     Zwischenablage, nicht ins Dokument — die Kernzusage „Klara schreibt NIE selbsttaetig"
    //     bleibt an denselben zwei Aufrufen gemessen und steht unveraendert bei null.
    //   · HIER STEHT DIE AUSNAHME, und sie wird nicht weggeschrieben: D3 ist die erste
    //     KA6-Nachfuehrung, die ERWEITERT statt einzuschraenken. Der Kopierknopf war fuer einen
    //     KA6-Vorschlag bisher gesperrt und ist es ab jetzt nicht mehr. Das ist beauftragt (BENs
    //     D2-Urteil, ROT: „`disabled`, ‚gesperrt' oder ‚liefert nichts' erfuellt die Abnahme
    //     nicht") und es oeffnet keinen ungekennzeichneten Ausgang: der Knopf geht durch
    //     `copyAnswer` → `composeOutputText` → `ka6Ausgabetext`, also durch denselben einen
    //     Herkunftsbauer wie der Einfuegeklick. Geoeffnet wird nur bei
    //     `ka6VorschlagAktiv && ka6KiFormuliert`; der fail-closed-Fall aus D2 bleibt zu.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Die Datei wird beim naechsten
    //     Oeffnen frisch geholt; bis dahin kann der Office-Cache kurz den D2-Stand zeigen — dann
    //     bleibt der Kopierknopf bei KA6 gesperrt wie bisher. Das ist ein fehlender Komfort, kein
    //     falsch gekennzeichneter Text.
    //
    // G24 (JOB 1601/1610) — DIE NACHFUEHRUNG DIESES DURCHGANGS, mit denselben drei Fragen:
    //   · KEIN zusaetzlicher Schreibweg, kein neuer Ausgang. Geaendert ist genau eine
    //     Normalisierung (`aiGenerated`) plus die reine Pruefung `istKiKennzeichnung` daneben
    //     (Block `KW-KLARA-AI-MARK-*`). Die beiden Schreibaufrufe bleiben unberuehrt bei null.
    //   · DIE KENNZEICHNUNG WIRD STRENGER, NIE SCHWAECHER. Bisher rechnete das Fenster
    //     `Boolean(result.aiGenerated)` — damit schaltete auch ein beliebiges Objekt oder ein
    //     wahrer Skalar die Behauptung „Von kuenstlicher Intelligenz erzeugt" EIN. Jetzt gilt nur
    //     noch der echte Serververtrag (`{aiGenerated:true, task, mode}`). Sie erscheint also
    //     seltener, und zwar ausschliesslich bei Werten, die der Server nie sendet.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Die Datei wird beim naechsten
    //     Oeffnen frisch geholt; bis dahin kann der Office-Cache kurz den alten Stand zeigen —
    //     dann gilt dort weiter die alte, zu grosszuegige Regel. Das ist der Zustand von gestern,
    //     kein neues Risiko.
    //
    // W6 (JOB 1621) — DIE NACHFUEHRUNG DIESES DURCHGANGS, mit denselben drei Fragen:
    //   · KEIN zusaetzlicher Schreibweg, kein neuer Ausgang. Neu ist ein LESENDER Aufruf von
    //     `POST /api/check-text` (Block `KW-KLARA-W6-CHECKTEXT-*`). Die Route ist ein Dry-Run und
    //     antwortet `persisted:false`; die beiden Schreibaufrufe des Fensters bleiben bei null.
    //   · NICHTS WIRD SICHTBAR. Die Funktion ist INERT: sie haengt an keinem Anlass und an keinem
    //     Vertragsort — `window.klaraBestandsblick` gehoert PRO3 (1571 D3, Regel A). Solange sie
    //     niemand einsetzt, ruft sie niemand, und die Oberflaeche aendert sich nicht.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Bis der Office-Cache nachzieht,
    //     fehlt der Block schlicht — der Zustand von gestern, kein neues Risiko.
    //
    // PIN-HERKUNFT (CHEF, 21.08. 17:35): G24 und W6 haben taskpane.html BEIDE veraendert, jeder
    // von einem anderen Startpin aus. Deshalb passte WEDER der Pin aus 1610 (2c3a56b0…) NOCH der
    // aus 1621 (870b08d6…) — beide beschreiben je nur eine der beiden Aenderungen. Der Wert unten
    // ist der gemessene Hash der zusammengefuehrten Datei, die beide Blocks traegt.
    // PIN-NACHFUEHRUNG (PRO3, JOB 1571 · D5, 21.08. 19:05) — BEWUSST GEPRUEFT, NICHT ABGESCHRIEBEN:
    // Neu in der Datei ist GENAU EIN Block, `KW-KA2-BESTAND-START/END` (141 Zeilen), und darin die
    // unbedingte Zuweisung `window.klaraBestandsblick = ka2Bestandsblick;` (Regel A, Chef 21.08.
    // 15:00). AUSLIEFERUNGSFOLGEN, einzeln geprueft: KEIN neuer Abrufweg — der Block benutzt die
    // in `performAsk` laengst vorhandene `fetch`-Stelle und eroeffnet deshalb kein neues
    // Egress-Ziel (`BEKANNTE_ABRUFZIELE` unveraendert); KEIN Schreibweg ins Dokument; NICHTS wird
    // von sich aus sichtbar — KA3 entscheidet weiterhin allein, ob eine Karte steht. Fuer ein
    // installiertes Add-in gilt wie bei G24/W6: bis der Office-Cache nachzieht, fehlt der Block
    // schlicht, das ist der Zustand von gestern und kein neues Risiko.
    // Der alte Wert (82a91f30…) beschreibt den Stand OHNE KA2 und waere ab jetzt blind.
    //
    // PIN-NACHFUEHRUNG (PRO6, JOB 1963 · D2, 22.08.) — BEWUSST GEPRUEFT, NICHT ABGESCHRIEBEN.
    // Neu sind DREI Stellen, alle im KA3-Block: der Wortlaut `klaraOfferDeviation` in de/en/nl
    // (C3), das optionale vierte Feld `deviatesFrom` in `ka3Normalisieren` (C4) und der Zweig in
    // `ka3Zeichnen`, der die Wertung zeichnet — WENN es sie gibt. Die drei Fragen, einzeln:
    //   · KEIN zusaetzlicher Schreibweg, KEIN neuer Ausgang, KEINE neue Abrufstelle. Es wird
    //     ausschliesslich GEZEICHNET, was ein Anbieter ohnehin geschickt hat; `BEKANNTE_ABRUFZIELE`
    //     bleibt unveraendert und die beiden Schreibaufrufe des Fensters bleiben bei null. Der Text
    //     geht als `textContent` in die Seite, nie als Markup — er wird angezeigt, nicht ausgefuehrt.
    //   · OHNE WERTUNG AENDERT SICH NICHTS. Der Zweig haengt an `if (treffer.deviatesFrom)`; fehlt
    //     das Feld, entsteht kein Element, kein leeres Feld, keine Platzhalterzeile — die Karte
    //     sieht aus wie gestern. `ka3-fokusverhalten.test.ts` haelt genau das als eigenen Fall fest
    //     (C4-1) und faellt, sobald der Zweig unbedingt wird.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER — in drei Richtungen. Das Feld ist OPTIONAL: KA2 bleibt
    //     ein gueltiger Anbieter und schickt weiterhin genau drei Felder (`ka2-vertrag-
    //     bestandsblick.test.ts`, unangetastet). Titel, Status und Weg bleiben, wo sie waren; die
    //     Wertung kommt ZUSAETZLICH (C4-2). Und die S4-Moduszeile (`deviation`/`deviationKey`,
    //     Anbieter/Modell/Adminvorgabe) ist NICHT beruehrt — deshalb heisst das neue Feld
    //     `deviatesFrom` und nicht `deviation`.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Bis der Office-Cache nachzieht,
    //     fehlt die Wertungszeile schlicht — der Zustand von gestern, kein neues Risiko.
    // Der alte Wert (41f30bf3…) beschreibt den Stand VOR C3/C4 und waere ab jetzt blind.
    //
    // PIN-NACHFUEHRUNG (PRO6, JOB 1963 · D4, 22.08.) — BEWUSST GEPRUEFT, NICHT ABGESCHRIEBEN.
    // Neu ist der ERZEUGER der Wertung: `w6WertungAusRelation` im Block `KW-KLARA-W6-CHECKTEXT-*`
    // und die eine Zeile, die ihn in die Trefferform legt. `D2` hatte das Feld gezeichnet, aber
    // niemand fuellte es; jetzt fuellt es der Weg, der die Antwort ohnehin liest. Die drei Fragen:
    //   · KEIN zusaetzlicher Schreibweg, KEIN neuer Ausgang, KEINE neue Abrufstelle. Es kommt kein
    //     `fetch` hinzu — dieselbe eine Antwort wird nur weiter ausgewertet (`relation`, das schon
    //     mitkam und bisher verworfen wurde). `BEKANNTE_ABRUFZIELE` unveraendert bei 10, die zwei
    //     Schreibaufrufe des Fensters bleiben null, die Route bleibt unberuehrt (JOB 989/686/631).
    //   · WAS SICHTBAR WIRD, und wann NICHT. Die Wertung erscheint NUR bei den vier benannten
    //     Abweichungen des Vokabulars (`OverlapRelation`); bei `identisch` und bei jedem
    //     unbekannten Wert entsteht sie nicht — dort saehe die Karte aus wie zuvor. Belegt am
    //     GERENDERTEN Text, nicht am Quelltext: `ka3-fokusverhalten.test.tsx`, Faelle C5-1 bis C5-4
    //     fahren Antwort -> Erzeuger -> `ka3Normalisieren` -> `ka3Zeichnen` -> Kartentext.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER. Der Weg bleibt inert (kein Aufrufer, siehe Rueckgabe),
    //     `window.klaraBestandsblick` bleibt bei KA2 (Regel A), KA2 liefert unveraendert genau
    //     seine drei Felder, und die S4-Moduszeile ist nicht beruehrt. `w6-dublettenweg-
    //     checktext.test.ts` pinnt die Vertragsform weiterhin VOLLSTAENDIG — jetzt vierfeldrig,
    //     also enger als vorher, nicht lockerer.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Bis der Office-Cache nachzieht,
    //     bleibt die Wertung leer — der Zustand von gestern, kein neues Risiko.
    // Der alte Wert (db555534…) beschreibt den Stand VOR dem Erzeuger und waere ab jetzt blind.
    //
    // PIN-NACHFUEHRUNG (BASIC, JOB 2613 · D1, 27.08.) — BEWUSST GEPRUEFT, NICHT ABGESCHRIEBEN.
    // Neu ist `trimWordImagesToBudget` und sein Aufruf in `prepareWordDraftRequest`: Sprengt der
    // Entwurfs-Payload das Byte-Budget, faellt ab jetzt das GROESSTE Bild und wird erneut gemessen,
    // statt den ganzen HTML-Rumpf gegen reinen Text zu tauschen. Dazu ein Meldungsschluessel in
    // DE/EN/NL und die Zeile, die ihn zeigt. Die drei Fragen:
    //   · KEIN zusaetzlicher Schreibweg, KEIN neuer Ausgang, KEINE neue Abrufstelle. Es kommt kein
    //     `fetch` hinzu; es bleibt bei DEM einen POST auf /api/drafts, nur mit einem kleineren
    //     Rumpf. `BEKANNTE_ABRUFZIELE` unveraendert, die Schreibaufrufe des Fensters unveraendert.
    //     Der Trimmer ist eine reine Zeichenkettenfunktion ohne Office- und ohne Netzzugriff.
    //   · WAS SICHTBAR WIRD, und wann NICHT. Die neue Meldung erscheint AUSSCHLIESSLICH, wenn
    //     wirklich Bilder weggelassen wurden (`droppedImages > 0`) — also nur bei einem Dokument
    //     ueber dem Budget, das durch das Weglassen hineinpasst. Passt alles (der Normalfall), ist
    //     `droppedImages` 0 und das Panel sieht aus wie gestern. Belegt in
    //     `job2613-word-bilder-budget.test.ts`, Faelle B1 bis B4.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER, in drei Richtungen. Der Klartext-Rueckfall bleibt
    //     unveraendert fuer den Fall, dass es auch OHNE jedes Bild nicht reicht (B4) — genau die
    //     Kalibrierung von `mega45-word-textrueckfall.test.ts`, die unangetastet gruen laeuft. Der
    //     Bildweg aus mega74 (`holeWordBilder`/`fillWordImages`) ist NICHT beruehrt
    //     (`mega74-klara-bilder.test.ts`, 16 Faelle gruen). Und die ES5-Kopie im Panel ist
    //     mitgezogen, der Aequivalenztest in `word-addin.test.ts` (52 Faelle) bleibt gruen.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Bis der Office-Cache nachzieht,
    //     gilt das bisherige Alles-oder-nichts — der Zustand von gestern, kein neues Risiko.
    // Der alte Wert (e6ca187e…) beschreibt den Stand VOR dem Trimmer und waere ab jetzt blind.
    //
    // PIN-NACHFUEHRUNG BEIM EINBAU (CHEF, 28.08. 02:05). Der Klon von JOB 2613 D1 stand auf
    // 081f60f; dazwischen hat der Sanierungs-Commit 1ac6979 (Auslieferungsstand im Panel-Kopf
    // gespiegelt) taskpane.html geaendert, OHNE diesen Pin nachzufuehren — der Waechter war am
    // Produkt-HEAD 6f629a2 bereits rot (Pin e6ca187e… gegen Ist c392acf0…). Der Einbau fuehrt beide
    // Aenderungen per 3-Wege-Merge zusammen (0 Konfliktmarker); der Wert unten ist der Hash der
    // zusammengefuehrten Datei: Trimmer aus 2613 D1 plus Versionsspiegel aus 1ac6979, sonst nichts.
    // Der Wert 9a886961… aus der Rueckgabe beschreibt den Klonstand ohne den Versionsspiegel.
    //
    // ==========================================================================================
    // JOB 2613 D3 — NACHGEZOGEN. Die Auslieferungsfolgen, bewusst geprueft:
    // ==========================================================================================
    //   · WAS DAZUKAM: der `.docx`-Sendeweg fuer den Umfang „Ganzes Dokument". `getFileAsync` holt
    //     die ganze Datei in Scheiben, `POST /api/drafts/from-docx` verwandelt sie serverseitig.
    //     Grund: Der bisherige Weg holt Bilder EINZELN ueber `inlinePictures` nach — bei Pedi kam
    //     dabei kein einziges an (sein eigener Test, Panel-Stand 2026-08-28 01:41Z).
    //   · WAS SICH FUER EIN INSTALLIERTES ADD-IN AENDERT: nichts ohne erneutes Ausliefern. Und
    //     wenn ausgeliefert wird, greift zuerst der LAUFZEITVERSUCH — `getFileAsync` gehoert zum
    //     Requirement-Set „File 1.1", das Manifest nennt nur `WordApi 1.1`. Fehlt die Faehigkeit,
    //     laeuft exakt der heutige Weg weiter, mit seinen ehrlichen Meldungen. Kein stiller
    //     Abbruch, kein leerer Entwurf, KEINE Manifestaenderung.
    //   · WAS UNBERUEHRT BLEIBT: der Weg „Markierter Text" (unveraendert `readSelection`), beide
    //     Deep-Link-Altstellen (`k1-word-addin-origin-panel.test.ts` zaehlt weiterhin genau zwei),
    //     die Herkunft `word_addin`, alle vorhandenen Meldungstexte. Der neue Weg ERFINDET keine
    //     Meldung, sondern nutzt `sendImagesMissing`, wenn weniger Bilder ankommen als in der
    //     Quelle standen.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: der Server prueft wie zuvor Anmeldung VOR dem
    //     Body-Parsing und `ko.create` im Handler; die neue Route ist in der RBAC-Matrix
    //     (`routeGuardAudit.ts`) und im Lesewege-Register (`mega74-lesewege-sammler.test.ts`)
    //     eingetragen, nicht ausgenommen.
    //
    // PIN-NACHFUEHRUNG BEIM EINBAU (CHEF, 28.08. 15:20, JOB 2613 D3-D5). Der Klon stand auf 081f60f;
    // das Produkt trug taskpane.html bereits mit Trimmer (2613 D1) und Versionsspiegel (1ac6979),
    // Pin 991c3633…. Der Einbau fuehrt den .docx-Sendeweg aus D3 per 3-Wege-Merge dazu (0 Marker);
    // der Wert unten ist der Hash der zusammengefuehrten Datei. dc01023a… aus der Rueckgabe
    // beschreibt den Klonstand ohne Trimmer und Versionsspiegel.
    //
    // ============================================================================================
    // JOB 2621 D1 — PIN BEWUSST AKTUALISIERT (e6ca187e… -> 59000047…), Auslieferungsfolgen:
    //   · DREI ANZEIGE-WAHRHEITEN, keine Verhaltensaenderung: (1) ohne Sitzung sagt die
    //     Zustimmungszeile die URSACHE (s4SitzungNichtAngemeldet) statt „kein Stand vor";
    //     (2) Zustimmungszeile steht VOR der Sperrzeile, und bei erteilter Zustimmung heisst es
    //     „Trotzdem gesperrt: …" (s4BlockiertTrotzZustimmung); (3) der Auslieferungsstand ist
    //     zusaetzlich ins Kopfband gespiegelt (#kw-stand-kopf, aus DERSELBEN KLARA_STAND-Quelle —
    //     #kw-stand unten bleibt samt Tests unberuehrt).
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: ids, Wege und Vertraege unveraendert; zwei neue
    //     i18n-Schluessel je dreisprachig (mega35 gruen), Kopfband-Farbe aus der AA-belegten
    //     Palette (mega43 gruen). Gemessen in tests/app/job2621-panel-wahrheiten.test.ts.
    //   · Fuer ein installiertes Add-in: kein erneutes Sideload noetig; bis der Office-Cache
    //     nachzieht, zeigt das Panel die alten Saetze — kein neues Risiko.
    // ============================================================================================
    //
    // PIN-NACHFUEHRUNG BEIM EINBAU (CHEF, 28.08. 15:55, JOB 2621 D1). Klon auf 081f60f; das Produkt trug
    // taskpane.html bereits mit Trimmer (2613 D1), Versionsspiegel (1ac6979) und .docx-Sendeweg (2613 D3).
    // 3-Wege-Merge, ein Konflikt am Stand-Spiegel zugunsten der 2621-Fassung (eine Zuweisung, zwei
    // Stellen) aufgeloest. Der Wert unten ist der Hash der zusammengefuehrten Datei.
    //
    // ============================================================================================
    // JOB 2620 D4 — PIN BEWUSST AKTUALISIERT (5d08c403… -> 77b5d05e…), Auslieferungsfolgen:
    //   · NUR DARSTELLUNG in Tab 2 (Wissen erfassen) nach Vorlage WissenErfassen.dc.html: die
    //     Karte traegt id `capture-karte` und den Titel `captureCardTitle`, darin der gemessene
    //     Bilder-Kasten `capture-bilder-hinweis` (warn-Token inline) und unter dem Senden-Knopf der
    //     Pruefungs-Hinweis `send-review-note`; Reiterleiste 13px / 11px 0 9px / weisser Grund.
    //     Gemessen in tests/design/zielbild-wissen-erfassen.test.ts (25 Werte, an DIESER Datei).
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: Umfangs-Wahl, `send-btn`, `send-status`, `open-link`,
    //     der .docx-Sendeweg (Station 1, JOB 2613) und alle ids/Wege unveraendert (job2613-*,
    //     word-addin*, job2621 gruen); vier neue i18n-Schluessel je dreisprachig (mega35 gruen);
    //     `sendTitle`/`sendHint` bleiben im Woerterbuch, `sendHint` weiter sichtbar.
    //   · Fuer ein installiertes Add-in: kein erneutes Sideload noetig; bis der Office-Cache
    //     nachzieht, zeigt Tab 2 die alte Karte — kein neues Risiko.
    // ============================================================================================
    //
    // ============================================================================================
    // JOB 2620 D5 — PIN BEWUSST AKTUALISIERT (77b5d05e… -> bbc06097…), Auslieferungsfolgen:
    //   · NUR WORTLAUT, dreisprachig: der Bilder-Halbsatz ist aus `sendHint` und `helpCan1`
    //     entfernt — der gemessene Kasten `#capture-bilder-hinweis` traegt die Bilder-Aussage in
    //     Tab 2 genau einmal (tests/design/zielbild-wissen-erfassen-einmal.test.ts, je Sprache).
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: keine id, kein Weg, kein Schluessel geaendert;
    //     die Laufzeit-Meldung `sendImagesMissing` bleibt unberuehrt.
    //   · Fuer ein installiertes Add-in: kein erneutes Sideload noetig.
    // ============================================================================================
    // JOB 2703 D3: taskpane.html geaendert — die harten 500-Zeichen-Kuerzungen im Client
    // (prepareWordDraftRequest, „offene Frage senden") sind stillgelegt; der Server kuerzt kanonisch.
    //
    // ============================================================================================
    // JOB 2551 D3 — PIN BEWUSST AKTUALISIERT (c470e28f… -> 25babab0…), Auslieferungsfolgen:
    //   · NUR WORTLAUT: geaendert sind ausschliesslich die drei Woerterbuchwerte
    //     `sendImagesMissing` (de/en/nl). Kein neuer Ausgang, kein neuer Schreibweg, keine neue
    //     Abrufstelle; `t()`, `showSendStatus()` und beide Ausloesestellen sind unberuehrt.
    //   · WAS SICHTBAR WIRD: derselbe Anlass, anderer Satz. Der alte nannte nur den Verlust und
    //     erzwang bei genau EINEM fehlenden Bild Mehrzahl („1 Bilder"); der neue benennt Word als
    //     Ursache, sichert die Vollstaendigkeit des Textes zu, gibt einen Weg und kommt kollektiv
    //     ohne Mehrzahlform aus. Gemessen am GERENDERTEN Text, nicht am Quelltext:
    //     `tests/app/job2551-bildverlust-satz-mounted.test.ts`.
    //   · BEIDE WEGE: derselbe Schluessel traegt den HTML-Weg und den .docx-Weg
    //     (`sendeDocxDatei`). Der Text gilt fuer beide — das ist Absicht und war schon vorher so.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: `sendPlainFallback` und `sendOverBudget` sind nicht
    //     angefasst; ihre Trennung haelt der Fall B4.
    //   · Fuer ein installiertes Add-in: kein erneutes Sideload noetig. Bis der Office-Cache
    //     nachzieht, steht der alte Satz — der Zustand von gestern, kein neues Risiko.
    // ============================================================================================
    // ============================================================================================
    // JOB 2929 D1 — PIN BEWUSST AKTUALISIERT, Auslieferungsfolgen:
    // ============================================================================================
    //   · WAS SICH AENDERT: EIN Farbwert, sonst nichts. Der Inline-Stil des gespiegelten
    //     Stand-Feldes (`span#kw-stand-kopf`) trug `color: #9aa3ad` als LITERAL. Dieser Wert steht
    //     in keiner Palette — er war das einzige Vorkommen im ganzen Baum. Jetzt steht dort
    //     `var(--shell-muted)`, derselbe Token, den die Regel `#kw-stand-kopf` seit JOB 2621
    //     fuehrt und den der Kommentar ueber dem Element bereits VERSPRACH („Farbe ist die
    //     AA-belegte Kopfband-Palette (--shell-muted)").
    //   · KEINE STRUKTURAENDERUNG: kein Element, kein `id`, kein Attribut, kein Skriptweg, keine
    //     Zeichenkette angefasst. `document.getElementById("kw-stand-kopf")` trifft unveraendert
    //     dasselbe Element wie zuvor.
    //   · WAS SICHTBAR WIRD: nichts. Das Element ist ein zweites `kw-stand-kopf` neben dem
    //     darueber; `getElementById` liefert das ERSTE, also bekommt dieses hier nie Text und
    //     rendert nichts. Selbst wenn es Text truege, bliebe die Farbe AA-belegt:
    //     --shell-muted auf --ink = 5,01:1 (mega43/mega44 misst es, gruen). Der alte Wert
    //     #9AA3AD lag bei 7,07:1 — auch AA, aber eben nicht aus der Palette; die Zusicherung
    //     „keine zweite Wahrheit" wiegt hier schwerer als der hoehere Einzelwert.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: mega43 zaehlt nach der Aenderung 13 statt 14
    //     Kontrastpaare. Das ist kein verlorener Fall, sondern ein entfallener Sonderweg: das
    //     14. Paar existierte NUR, weil das Literal existierte. Seine Quelle steht jetzt beim
    //     Paar `--shell-muted auf --ink`. Die Untergrenze des Berichts (>= 11 Paare) ist gewahrt.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig.
    //
    // EINBAU-VERMERK (Chef, 01.09.): Der Klon von JOB 2929 D1 steht auf der Basis b4b0c12 und
    // nennt dort den Pin edb9dbc2…. `taskpane.html` hat sich auf main seither in 51543c5 und
    // 12ef99b geaendert (main-Pin vor diesem Einbau: 25babab0…). Uebernommen wurde deshalb die
    // AENDERUNG, nicht der Pin-Wert des Klons; der Wert unten ist der neu gerechnete Hash der
    // zusammengefuehrten main-Datei. Ein blindes Uebernehmen von edb9dbc2… haette den Waechter
    // gegen einen Stand gepinnt, den es auf main nie gab.
    //
    // ============================================================================================
    // JOB 3004 D1 — PIN BEWUSST AKTUALISIERT (6f8425a9… -> a175b9bd…), Auslieferungsfolgen:
    // ============================================================================================
    //   · WAS SICH AENDERT: der Antwortbereich des Fragen-Reiters traegt jetzt die Flaeche des
    //     Zielbilds Main.dc.html (27.08.): Frage-Pille, EINE Antwortkarte (Text, Einstufung,
    //     Herkunftszeile, Quellen-Chips), Aktionsleiste, Fusszeile und der Leitsatz. Die
    //     Frage-Karte (#ask-karte) tritt im Antwortzustand zurueck; Pille und „Neue Frage" fuehren
    //     zurueck. Sechs neue Woerterbuchschluessel (de/en/nl): askHerkunft, askChipStand,
    //     askFussHinweis, askNeueFrage, askFrageBearbeiten, klaraLeitsatz.
    //   · KEIN NEUER AUSGANG, KEINE NEUE ABRUFSTELLE: `#ask-answer-edit` bleibt das eine Feld,
    //     alle Ausgaenge laufen weiter durch composeOutputText; die Zahl der fetch-Ziele bleibt 11
    //     (mega69-klara-merkmale M7); keine Inline-Handler, kein zweites externes Skript.
    //   · UMGEZOGEN, NICHT ENTFALLEN: #ask-ai-notice (KI-Kennzeichnung) in die Antwortkarte,
    //     #ask-review-notice/#ask-rule-note/#ask-status unter die Antwortflaeche — dieselben
    //     Kennungen, Schluessel und Rueckrufe; mega61/mega75/mega81 messen sie unveraendert gruen.
    //   · ENTFERNT MIT GRUND: der Funke-Balken links am Quellenblock und die Status-Farbpillen
    //     (.src-badge-validiert/-pruefung) — die Quelle ist jetzt der Chip, der Status steht als
    //     Wort darin. Die Palette bleibt die Werkbank-Palette (mega43/mega44 gruen, alle Paare AA).
    //   · GEMESSEN: tests/design/zielbild-klara-main.test.ts — die dist-Fassung dieser Datei in
    //     Chromium, ein getComputedStyle-Vergleich je Zielbildwert (67 Faelle), Gegenprobe belegt.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig (kein Manifest-, kein
    //     Berechtigungs-, kein Ursprungswechsel). Bis der Office-Cache nachzieht, steht die alte
    //     Flaeche — der Zustand von gestern, kein neues Risiko.
    //   · RUNDE 4 (a175b9bd… -> 509fc831…; die Zwischenfassung d18d498a… der Runde 3 ist
    //     ZURUECKGENOMMEN): die Frage-Karte (#ask-karte mit #ask-input) ist im Antwortzustand
    //     VERBORGEN — EINE Flaeche, kein zweiter Bearbeitungsweg (ben, Runde 3). Runde 3 hatte sie
    //     per `order` unter die Antwortflaeche gerueckt, weil tests-smoke/word-taskpane-kopieren
    //     .spec.ts `#ask-input` als Einfuege-Empfaenger benutzte; die Sonde bringt jetzt ihren
    //     eigenen Empfaenger mit, kein Produktfeld ist mehr Testhilfe. Dazu tragen Pille, Karte,
    //     Aktionen und Fusszeile die Seitenraender der Vorlage selbst (`margin: 12px 16px 0` usw.;
    //     `#ask-answer-block` hebt die 14px Koerper-Polsterung auf wie das Kopfband). Ids,
    //     Reihenfolge im Quelltext und Rueckrufe unveraendert.
    //   · RUNDE 5 (509fc831… -> 0e5b3c19…): `#ask-sources li` setzt kein `display` mehr — die
    //     id-Regel (display: block) schlug die Klassenregel `.quelle-chip` (display: flex) und liess
    //     gap/align-items am Quellen-Chip wirkungslos (ben, Runde 4). Nur Stilblock, kein Markup,
    //     kein Skript.
    //
    // ============================================================================================
    // JOB 3016 D3 (03.09.2026) — PIN BEWUSST AKTUALISIERT (0e5b3c19… -> 6a8ea273…), Basis e8a35bf,
    // gegenueber der JOB-3004-Kette oben ZUSAETZLICH zum bestehenden Antwortbereich eingebaut:
    // ============================================================================================
    //   · WAS SICH AENDERT — der WARTEZUSTAND einer Frage, nach Zielbild PruefungLaeuft.dc.html
    //     Z.26-32: statt des gelben Warnkastens (#ask-status, `status warn`, Text askBusy) zeigt
    //     das Panel eine weisse Ladekarte `#ask-ladekarte` mit drei `.ladebalken` und darunter den
    //     Satz `#ask-ladekarte-satz` (derselbe Schluessel askBusy ueber data-t). Neu im Markup ist
    //     genau dieser Block (Marken KW-D3-LADEKARTE-START/END), neu im Stil sind sieben Regeln
    //     dafuer (Farben ausschliesslich als Werkbank-Token --surface/--hairline/--muted; mega43
    //     gruen), neu im Skript sind `askLaeuft` und `askWartezustand()`, gelesen in
    //     updateAskState().
    //   · VERHALTEN, das sich aendert — und zwar in Richtung MEHR Sperre, nicht weniger: waehrend
    //     der Suche ist ab jetzt auch `#ask-input` gesperrt (die Zusage des Satzes „die Eingabe ist
    //     so lange gesperrt" war bis dahin unwahr, JOB 3012 Fall W4). Freigegeben wird ueber JEDEN
    //     Ausgang an EINER Stelle (Antwort, Luecke, Frist, Fehler, 401) — fail-open, gemessen in
    //     tests/design/zielbild-pruefunglaeuft-messung.test.ts (F1-F4) und in Chromium
    //     (tests/design/zielbild-pruefunglaeuft.test.ts). #ask-status traegt unveraendert askEmpty,
    //     askAuth, askTimeout, askError, s4FragenGesperrt.
    //   · WORTLAUT: `askBusy` in DE/EN/NL traegt jetzt beide Haelften des Zielbildsatzes
    //     (Wissen freigegeben UND Eingabe gesperrt); mega35-Wortliste gruen (kein „geprueft",
    //     kein „gesichert").
    //   · KEIN neues Abrufziel, KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEINE
    //     geaenderte Nutzlast: performAsk und sein Aufruf sind unberuehrt; die Frist bleibt
    //     WORD_ADDIN_ASK_TIMEOUT_MS = 15000; resetAskResult() ist nicht angefasst.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Bis der Office-Cache nachzieht,
    //     steht der alte Warnkasten — der Zustand von gestern, kein neues Risiko.
    //   · RUNDE 2 (BEN, Korrekturpflicht 1; 6a8ea273… -> 170bbe00…): NUR zwei Stilwerte. Die
    //     Aussenabstaende von Karte und Satz tragen jetzt woertlich das Zielbild (`14px 16px 0`,
    //     `12px 16px 0`) statt `0` seitlich; kein Element, kein Text, kein Skriptweg angefasst.
    //     In Chromium hart gemessen (karte-/satz-aussenabstand, display flex; 50px-Gegenprobe rot).
    //   · RUNDE 4 (BEN; 170bbe00… -> 057f08bf…): SINGLE FLIGHT in askKlara. Das Tor `askLaeuft`
    //     faellt jetzt SYNCHRON vor dem asynchronen Word-Auswahlrueckruf; ein zweiter Klick in
    //     dieser Luecke startet weder einen zweiten Rueckruf noch einen zweiten Ask, und kein
    //     frueher Ausgang hebt Karte oder Sperre auf, solange ein Ask offen ist. Das Tor faellt bei
    //     leerer Frage, nach jedem Ergebnis und fail-open bei einem synchronen Fehler vor dem Fetch.
    //     KEIN neues Abrufziel, KEINE geaenderte Nutzlast — es gehen WENIGER Abrufe ab, nie mehr.
    //     Gemessen: zielbild-pruefunglaeuft-messung (G1/G2) und in Chromium (Fall D).
    //   · RUNDE 5 (BEN; 057f08bf… -> 0e0d26b9…): die AUSWAHLPHASE (Klick → Word-Rueckruf) ist ein
    //     begrenzter, fail-open Lauf mit eigenem Ticket: eine Auswahlfrist (WORD_ADDIN_ASK_TIMEOUT_MS)
    //     gibt frei, wenn Word den Rueckruf schuldig bleibt (neuer Schluessel `askSelectionTimeout`
    //     in DE/EN/NL); ein synchroner Fehler aus getSelectedDataAsync oder vor dem Fetch wird
    //     gefangen und als askError gezeigt (kein Wurf mehr aus dem Klick); verspaetete oder
    //     doppelte Rueckrufe eines beendeten Laufs werden ignoriert und loesen KEINEN Ask aus.
    //     KEIN neues Abrufziel, KEINE geaenderte Nutzlast; eine zusaetzliche Frist (setTimeout) je
    //     Klick, kein Intervall. Gemessen: zielbild-pruefunglaeuft-messung (G2/G3/G4) und in
    //     Chromium in echter Zeit (Faelle K1/K2).
    //   · RUNDE 6 (BEN; 0e0d26b9… -> 8c413f3b…): EINE ABSOLUTE GESAMTFRIST ab Klick. performAsk
    //     erhaelt nach dem Word-Rueckruf nur die vom Klick an verbleibende Zeit (mindestens 1 ms)
    //     statt erneut WORD_ADDIN_ASK_TIMEOUT_MS; die Konstante selbst ist unveraendert 15000. Zwei
    //     Zeilen im Skript (`klick`, `restfrist`), sonst nichts: kein Text, kein Element, kein
    //     Abrufziel. Gemessen: zielbild-pruefunglaeuft-messung (G5, Rueckruf bei 14 999 ms →
    //     Restfrist 1 ms) und Chromium in echter Zeit (K3: Rueckruf kurz vor 15 s, frei bei 15 s).
    //   · RUNDE 7 (BEN; 8c413f3b… -> ad497ff8…): der Word-Rueckruf liest die Uhr SELBST. Ist die
    //     Gesamtfrist beim Eintreffen des Rueckrufs aufgebraucht (`restfrist <= 0`, exakt bei oder
    //     nach 15 000 ms), endet der Lauf ueber denselben Auswahlfrist-Ausgang wie beim
    //     ausgebliebenen Rueckruf — OHNE POST; `Math.max(1, …)` ist entfallen. Der Ausgang ist in
    //     `auswahlAbgelaufen()` gebuendelt (Timer und Rueckruf rufen dieselbe Funktion). Kein Text,
    //     kein Element, kein Abrufziel. Gemessen: zielbild-pruefunglaeuft-messung (G6 exakt 15 000,
    //     G7 danach: 0 POST; G5 bei 14 999: ein POST mit 1 ms Rest).
    //   · JOB 3016 D7 (RUNDE 1 der Konfliktloesung, 03.09.2026): der Rebase auf main (das JOB-3004-
    //     D1-Zielbild „Main“ oben) traf dasselbe Ende der Datei wie die Ladekarte — beide Markup-
    //     Bloecke sind jetzt Geschwister im DOM (`#ask-answer-block` mit der Antwortkarte, dann
    //     `#ask-status`, dann die Ladekarte `#ask-ladekarte`/`#ask-ladekarte-satz`, dann die
    //     dauerhaften Hinweise `#ask-review-notice`/`#ask-rule-note`); Skript und Stil der Ladekarte
    //     waren bereits unveraendert gegen main mischbar. Der Pin unten ist der frisch aus der
    //     zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    //
    // ============================================================================================
    // JOB 3046 D2 (03.09.2026) — PIN BEWUSST AKTUALISIERT (0e5b3c19… -> 9235fa79…), Basis 9ae6c22.
    // Auslieferungsfolgen, einzeln geprueft:
    // ============================================================================================
    //   · WAS SICH AENDERT — die LUECKE einer Frage, nach Zielbild KeinWissen.dc.html Z.27-35:
    //     statt des gelben Warnkastens (`div.status.warn` mit askGapTitle, askGapBody, einer
    //     Zweitkopie von askRuleNote und `button.primary#ask-gap-send-btn`) zeigt `#ask-gap-block`
    //     die ruhige Flaeche `#ask-luecke` (Markenblock KW-D2-LUECKE-START/END): Lupe (inline-SVG,
    //     currentColor), der EINE Satz `#ask-luecke-satz` (derselbe Schluessel askGapTitle, neuer
    //     Wortlaut), die Hauptaktion `#ask-luecke-frage-aendern`, der Textlink `a#ask-gap-send-btn`
    //     (dieselbe Kennung, derselbe Handler sendOpenQuestion) und die Fusszeile `#ask-luecke-fuss`.
    //     Neu im Stil sind die Regeln des Blocks KW-D2-LUECKE (Farben ausschliesslich als Werkbank-
    //     Token --text/--muted/--surface/--hairline; mega43 gruen). Neu im Skript: `askFrageAendern`
    //     (resetAskResult + hideAskStatus + Fokus ans Ende von #ask-input — kein Abruf) und die
    //     Doppel-POST-Sperre des Textlinks ueber `aria-disabled` (ein <a> kennt kein `disabled`).
    //   · WORTLAUT (DE/EN/NL): askGapTitle neu (Z.29), askGapSendCta „… geben" (Z.31), neue
    //     Schluessel askGapFrageAendern (Z.30) und askGapFuss (Z.35); askGapBody in allen drei
    //     Sprachen ENTFERNT (kein toter Schluessel). mega35-Wortliste gruen; mega69-Umlaute gruen.
    //   · ENTFERNT, nicht daneben belassen: der Warnkasten der Luecke (`.status.warn` bleibt den
    //     echten Warnungen in #ask-status: askEmpty, askAuth, askForbiddenRead, askError,
    //     askTimeout, s4FragenGesperrt, truncated), askGapBody, die Zweitkopie der Regel (die Regel
    //     steht an ihrer EINEN Stelle #ask-rule-note unter der Antwortflaeche, JOB 3004; mega75
    //     misst sie dort). Die Konsole behaelt „Keine belastbare Grundlage." — Zielbild vor
    //     Paritaet (word-addin-ask pinnt beide Saetze bewusst).
    //   · KEIN neues Abrufziel, KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEINE
    //     geaenderte Nutzlast: performAsk, sendOpenQuestion (POST /api/drafts, origin word_addin,
    //     voller Fragetext) und resetAskResult sind unberuehrt bzw. rufen dieselben Wege; der
    //     Textlink traegt href="#" und unterbindet die Sprungnavigation (preventDefault).
    //   · GEMESSEN: tests/design/zielbild-keinwissen.test.ts (Chromium, 32 Werte je Vergleich,
    //     ein primary panelweit, „Frage ändern" per echtem Klick, Sendeweg des Textlinks) und
    //     tests/design/zielbild-keinwissen-messung.test.ts (jsdom: Struktur, Wortlaut, Verlustliste,
    //     Uebergaenge Luecke/Antwort/Warnungen/truncated).
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload. Bis der Office-Cache nachzieht,
    //     steht der alte Warnkasten — der Zustand von gestern, kein neues Risiko.
    //   · (3cc42ea2… war der Zwischenstand mit `opacity: 0.5` am gesperrten Textlink; mega43
    //     meldete die Abschwaechung ohne Ausnahme — entfernt, nur pointer-events/cursor bleiben.)
    //   · RUNDE 2 (BEN; 9235fa79… -> c952e6dc…): (1) der Lueckenblock steht NEBEN der Frage-Karte
    //     (#ask-karte), nicht mehr in ihr — kein Kasten-Ahne; er ist die Buehne der Vorlage
    //     (Flex-Spalte, `margin: 12px -14px 0`, Mindesthoehe = Rest des Fensters unter der Karte,
    //     vom Panel gemessen und als `--kw-luecke-buehne` gesetzt — lueckeBuehneAnpassen, dazu ein
    //     `resize`-Rueckruf), beim Erscheinen rollt das Panel die Frage-Karte an den oberen
    //     Fensterrand (scrollIntoView, mit Fallback). (2) Der Entwurfsversand traegt eine
    //     GENERATION (askErgebnisGeneration): resetAskResult() zaehlt hoch, loest die Sperre des
    //     Textlinks und das Buehnenmass; ein Ruecklauf einer aelteren Generation (Erfolg wie Fehler)
    //     veraendert weder Status noch Entwurfs-Link noch Sperre. KEIN neues Abrufziel, KEIN
    //     Manifest, KEINE geaenderte CSP, KEINE geaenderte Nutzlast — es wird WENIGER angezeigt,
    //     nie mehr. Gemessen: zielbild-keinwissen.test.ts (G Geometrie, K Ahnen, iv/v Ueberlappung)
    //     und zielbild-keinwissen-messung.test.ts (M25 Ahnen, F2 Ueberlappung).
    //   · KONFLIKTRUNDE 1 (04.09.2026, JOB 3046): der Rebase auf main traf dasselbe Dateiende wie
    //     JOB 3016 D3 (Ladekarte „Pruefung laeuft") — beide Markup-, Stil- und Skriptbloecke stehen
    //     unveraendert nebeneinander in der taskpane.html (Ladekarte fuer den Wartezustand, Luecke
    //     fuer die Antwortluecke; keiner beruehrt den anderen). Der Pin unten ist der frisch aus der
    //     zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    //
    // ============================================================================================
    // JOB 3017 D4 — PIN BEWUSST AKTUALISIERT (d2fe611c… -> 0b8ad771…), Auslieferungsfolgen:
    // ============================================================================================
    //   · WAS SICH AENDERT: Markup, Stilregeln, Woerterbuch und drei Skriptstellen des Panels —
    //     das ruhige Grundpanel nach SchlankesPanel.dc.html. Im Kopfband ersetzt die zweite
    //     Kopfzeile `#kw-kopf-zeile` (Anmeldezeile `#kw-anmeldung` links, Stand rechts) die ZWEI
    //     Spans `#kw-stand-kopf`; die Kennung kommt jetzt genau einmal vor (JOB 2929 hatte den
    //     Zwilling beschrieben, s. o.). Die Fragen-Karte heisst `#ask-karte` und traegt nur Feld
    //     und runden Sende-Pfeil (`#ask-btn` mit SVG statt Text, askCta als aria-label, askTitle
    //     als aria-label des Felds); unter der Karte steht GENAU EIN Satz (`#ask-review-notice`,
    //     askHint darin aufgegangen — der Schluessel `askHint` ist entfallen); `#ask-source-note`
    //     ist zustandsgebunden verborgen; Status-, Antwort- und Absage-Block stehen unter dem Satz
    //     als eigene Flaechen; `#ka1-block` rutscht UNTER die Karte; `#ask-rule-note` steht in
    //     der neuen Fusszeile `#kw-fuss` (askRuleNote traegt den Leitsatz „Keine KI-Antwort ohne
    //     Beleg · Vertrauliches bleibt vertraulich" plus die belegten Halbsaetze). Neue Skript-
    //     stellen: `renderKopfAnmeldung` (Spiegel von #session-status), `setzeAskSourceNote`,
    //     zwei aria-label-Zeilen in `renderStatics`.
    //   · KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein neuer Fremd-Ursprung, KEINE
    //     geaenderte CSP, KEIN neuer Abruf und keine geaenderte Nutzlast: die Menge der
    //     `fetch(...)`-Ziele ist unveraendert, `/api/auth/me` wird wie bisher gelesen und nur an
    //     einer zweiten Stelle angezeigt. Kein Farbliteral kommt hinzu (SVG-Striche ueber
    //     currentColor auf Token; mega43/44 gruen).
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: Pruefhinweis und KI-Kennzeichnung (mega61/mega81)
    //     bleiben mit ihren Schluesseln; die Regel askRuleNote nennt weiter „woertlich" und „nicht
    //     an eine externe KI" (mega75/mega77); der Vertrauenskopf bleibt im Kopfband (W1).
    //   · Gemessen: tests/design/zielbild-schlankes-panel.test.ts (Chromium, 360 px) und die
    //     nachgefuehrte Ruhezustands-Messung tests/design/zielbild-schlankespanel-messung.test.ts.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig; es holt die Datei beim
    //     naechsten Oeffnen frisch. Bis der Office-Cache nachzieht, steht das alte Panel.
    //   · RUNDE 2: `checkSession` nimmt nur einen NICHTLEEREN Servernamen als Anmeldung
    //     (`sessionName`); `user.email` und „?" als Ersatzname sind entfernt. Ein 200 ohne Namen
    //     zeigt den ehrlichen Hinweis sessionOff und laesst den Anmeldeweg sichtbar. Kein neuer
    //     Abruf, keine geaenderte Nutzlast.
    //   · KONFLIKTRUNDE 1 (04.09.2026, JOB 3017): der Rebase traf dieselbe Fragen-Flaeche wie JOB
    //     3004/3016/3046 auf main. Die JOB-3017-Umstellung (runder Sende-Pfeil, EIN Satz unter der
    //     Karte, Fusszeile #kw-fuss, KA1 unter der Karte, Kopfband-Anmeldezeile) ist auf den
    //     JOB-3004/3016/3046-Bestand aufgesetzt, nicht daneben: die Antwortkarte (Main.dc.html), die
    //     Ladekarte (PruefungLaeuft.dc.html) und die Luecke (KeinWissen.dc.html) sind UNVERAENDERT
    //     erhalten — nur die Fragen-Karte, die Fusszeile und das Kopfband tragen die Zielbild-Werte
    //     dieses Auftrags. Die frueher angenommene Zweitkopie von askRuleNote in der Luecke ist NICHT
    //     zurueckgekehrt: JOB 3046 hatte sie bereits entfernt (mega75-klara-ki-status.test.ts pinnt
    //     das weiterhin); die 2c7f216-Fassung von zielbild-schlankes-panel.test.ts nahm sie noch an
    //     (Basis vor JOB 3046) und ist entsprechend nachgefuehrt. Der Pin unten ist der frisch aus
    //     der zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    //   · NACHZUG-RUNDE 1 (04.09.2026, JOB 3017; 0b8ad771… -> de691947…): die beiden JOB-3017-
    //     Stilregeln fuer `#ask-answer-block` und `#ask-gap-block` (Karten-Rezept) sind ENTFERNT —
    //     sie standen im Stilblock HINTER den Regeln von JOB 3004 (Antwortflaeche `margin: 0 -14px`)
    //     und JOB 3046 (Lueckenbuehne) und schlugen beide Vorlagen um 13px in einen Kasten;
    //     `#ask-review-notice` steht im Rumpf jetzt HINTER Antwort- und Lueckenblock (im Ruhezustand
    //     unveraendert direkt unter der Karte, im Antwortzustand unter der Antwortflaeche); drei
    //     Markup-Kommentare gekuerzt (Rest-Seite des Probeschnitts wieder unter 500 Zeilen). Kein
    //     Skript, kein Woerterbuch, keine Kennung geaendert; kein Manifest, kein Endpunkt, kein Abruf.
    //   · KONFLIKTRUNDE 1 (04.09.2026, JOB 3018) — PIN BEWUSST AKTUALISIERT (de691947… -> f8dc1c93…):
    //     der Rebase auf main traf dasselbe Dateiende wie JOB 3018 D1 (P7, „kein toter Knopf ohne
    //     Grund"). JOB 3018 aendert unabhaengig von der Fragen-Flaeche oben: (a) EIN neuer
    //     i18n-Schluessel `officeDetecting` in DE/EN/NL; (b) ein dritter Zweig in `updateSendState`
    //     fuer die Lage „Erkennung laeuft noch" (`!officeChecked`); (c) EIN zusaetzlicher Aufruf
    //     `updateSendState()` im Startblock, vor der Office-Erkennung. WAS SICHTBAR WIRD: in der
    //     Spanne zwischen Laden und Office-Erkennung (bis zu OFFICE_READY_TIMEOUT_MS = 4000 ms)
    //     traegt der ohnehin gesperrte Senden-Knopf jetzt einen `title` mit dem Grund — vorher war
    //     er in dieser Spanne stumm gesperrt; sichtbar ist das NUR im Zeiger-Tooltip. KEIN NEUES
    //     ELEMENT, KEINE NEUE ID, KEIN NEUES ATTRIBUT AM MARKUP, kein neues Abrufziel, kein
    //     Manifest, keine geaenderte CSP, kein neues Recht, keine geaenderte Nutzlast. KEINE
    //     ZUSICHERUNG WIRD SCHWAECHER: `noOffice` behaelt Wortlaut UND Bedeutung, der Warnkasten
    //     `#office-hint` bleibt in der neuen Lage still (Klasse `hidden`, leerer Text) — belegt
    //     durch die Faelle A/B/C und den Fristfall in
    //     `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx`. Beide Aenderungen (JOB
    //     3004/3016/3046/3017-Kette oben UND JOB 3018 P7) stehen unveraendert nebeneinander in der
    //     zusammengefuehrten Datei; der Pin unten ist der frisch daraus gerechnete Hash, kein
    //     uebernommener Wert einer Seite.
    //
    // ============================================================================================
    // JOB 3019 D1 (03.09.2026) — DER PIN WANDERT, WEIL DIE MARKIERUNG JETZT MITREIST (KA5).
    // ============================================================================================
    // VORHERHASH taskpane.html: `6f8425a957c6a7b64203121e3413979c6a37c3501d819ff2334ea9fb7dad8f61`.
    //
    // ES IST DIESMAL MEHR ALS INHALT, und das wird hier ausdruecklich gesagt: DIE ABGESETZTE
    // NUTZLAST AENDERT SICH — zum ersten Mal, seit dieser Kommentar bei jedem Wandern „KEINE
    // geaenderte Nutzlast" verspricht. Der Ask-Koerper kann jetzt ein VIERTES Feld tragen:
    //   `body: JSON.stringify({ question, locale, mode: "retrieval-only", selection })`
    //
    // WAS GEAENDERT WURDE:
    //   · `prepareAskQuestion` kehrt die Vorrangregel um: der GETIPPTE Text ist die Frage, die
    //     Markierung reist als eigenes Feld mit (`selection`, eigener Deckel-Merker
    //     `selectionTruncated`). Bisher gewann die Markierung und der getippte Text wurde verworfen.
    //   · `performAsk` bekommt einen SECHSTEN Parameter `selection` (ans Ende, damit jeder Aufruf
    //     mit fuenf Argumenten byte-gleich bleibt) und setzt das Feld NUR, wenn es nicht leer ist.
    //   · `askKlara` reicht `prep.selection` durch — aus derselben, EINEN Markierungslesung.
    //   · `updateAskSourceNote` kennt drei Lagen statt zwei Ausgaenge.
    //   · Woerterbuch je Sprache: `askSourceSelectionOverride` sagt das Gegenteil von vorher (sein
    //     Kernsatz „der Text unten wird dabei NICHT gesendet" ist seit dieser Aenderung falsch),
    //     `askHint` und `askInputPlaceholder` behaupten nicht mehr, freies Fragen gehe nur ohne
    //     Markierung, und `askSelectionTruncated` kommt als neuer Schluessel dazu.
    //
    // DIE AUSLIEFERUNGSFOLGE, vor dem Wandern des Pins geprueft:
    //   · KEIN neues Abrufziel — die Menge der `fetch(...)`-Ziele ist gegen HEAD unveraendert
    //     (`mega69-klara-merkmale.test.ts` M6/M7 gruen). Es ist DIESELBE Route `POST /api/ask`.
    //   · KEIN neues Recht, KEINE geaenderte CSP, KEIN Manifest, kein neuer Fremd-Ursprung.
    //   · DER MODUS BLEIBT UNANGETASTET: `mode: "retrieval-only"` steht unveraendert im Koerper
    //     (M1 gruen, K1 kalibriert). Die Markierung geht damit an denselben Weg, der serverseitig
    //     KEIN Modell erreicht; ihr einziger Verbraucher ist `erweiterteSuchterme`
    //     (`services/ask/src/service.ts:513-515`), belegt durch `tests/ka5/`.
    //   · OHNE MARKIERUNG IST DER KOERPER BYTE-GLEICH DER BISHERIGE: `undefined` faellt bei
    //     `JSON.stringify` heraus. Durch AUSFUEHRUNG erhoben, nicht behauptet —
    //     `tests/klara-panel/ka5-markierung-reist-mit.test.tsx`, Faelle C und D.
    //   · EIN AELTERER SERVER ohne KA5 ignoriert das unbekannte Feld: `ask-routes.ts` liest den
    //     Rumpf ueber ein JSON-Schema; vor KA5 war `selection` dort schlicht nicht vorgesehen und
    //     wurde verworfen. Es geht dabei nichts verloren — die Frage ist vollstaendig im
    //     `question`-Feld, die Markierung war immer nur eine Suchschaerfung.
    //   · KEIN erneutes Sideload. Ein installiertes Add-in holt die Datei beim naechsten Oeffnen
    //     frisch; zeigt der Office-Cache kurz den alten Stand, gilt dort die alte Vorrangregel —
    //     der Zustand von gestern, kein neues Risiko.
    // ============================================================================================
    // JOB 3019 D2 (04.09.2026) — DER PIN WANDERT ZUM ZWEITEN MAL: BENs DREI KORREKTURPFLICHTEN.
    // ============================================================================================
    // VORHERHASH taskpane.html: `98672d01165e28d8bb4661a7bba6d0c83a93dba8d280a04d510a3f0be458e4b8`
    // (der Stand aus D1, integriert als `daa3b27`).
    //
    // GEAENDERT WURDE — dreierlei, alles Panelinhalt und Entscheidungslogik, KEIN neuer Ausgang:
    //   · DIE ZWEI DECKEL SPRECHEN JETZT GETRENNT UND VOLLSTAENDIG. `askTruncated` sagte in allen
    //     drei Sprachen „Die Markierung war laenger als {max} Zeichen"; seit KA5 wird aber das Feld
    //     `question` gekappt, und das ist in der Lage „beides" der GETIPPTE Text. Der Satz spricht
    //     jetzt ausschliesslich ueber die Frage. Neuer Schluessel `askBothTruncated` je Sprache
    //     fuer die vierte Lage, in der `askSelectionTruncated` faelschlich „deine Frage bleibt
    //     vollstaendig" versprach. Die Auswahl trifft die neue Funktion `askDeckelHinweis` an EINER
    //     Stelle; alle vier Kombinationen sind in
    //     `tests/klara-panel/ka5-markierung-reist-mit.test.tsx` (Faelle T0–T6, auch EN/NL) gemessen.
    //   · KA6 IST WIEDER ISOLIERT. `ka6Absenden` ruft nicht mehr `prepareAskQuestion`, sondern die
    //     neue `ka6Zurufgrundlage`: fuer einen Zuruf ist die Markierung das MATERIAL, nicht ein
    //     Suchbegriff. In D1 hatte KA6 die umgedrehte Ask-Vorrangregel still mitbekommen. Es bleibt
    //     bei EINER Kapp- und Trimmregel — `ka6Zurufgrundlage` rechnet weiter mit
    //     `prepareAskQuestion`, nur mit der Lage, die KA6 meint. Der KA6-Koerper ist damit wieder
    //     byte-gleich dem Stand vor KA5 (kein `selection`-Feld), durch Ausfuehrung erhoben in
    //     `tests/app/word-addin-ask.test.ts` (drei Zurufe, Koerper mitgeschrieben).
    //   · ZWEI SAETZE NANNTEN `{max}` ZWEIMAL. `t()` (taskpane.html:2683) ersetzt mit
    //     `String.replace` und damit nur das ERSTE Vorkommen — auf der Flaeche stand woertlich
    //     „nur die ersten {max} Zeichen". Beide Saetze nennen den Deckel jetzt genau einmal; der
    //     Fall T0 haelt die Regel fuer alle drei Deckel-Schluessel fest.
    //
    // AUSLIEFERUNGSFOLGEN, vor dem Wandern des Pins geprueft: KEIN neues Abrufziel (die Menge der
    // `fetch(...)`-Ziele ist gegen D1 unveraendert, `mega69-klara-merkmale.test.ts` M6/M7 gruen),
    // KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht. DIE NUTZLAST WIRD GEGENUEBER D1 NICHT
    // GROESSER, sondern in einem Fall wieder KLEINER: der KA6-Zuruf schickt kein `selection` mehr.
    // Der Ask-Koerper ist unveraendert gegenueber D1. `mode: "retrieval-only"` unangetastet (M1/K1
    // gruen). KEIN erneutes Sideload; die Datei wird beim naechsten Oeffnen frisch geholt.
    //
    // ============================================================================================
    // JOB 3019 KONFLIKTRUNDE 1 (04.09.2026) — PIN NEU GERECHNET NACH REBASE AUF DIE JOB-3018-KETTE.
    // ============================================================================================
    // `git rebase main` traf mit a0916ed (D1-D3 oben) auf die inzwischen auf main gelandete Kette
    // JOB 3004/3016/3046/3017/3018 (Antwortkarte, Ladekarte, Luecke, SchlankesPanel, Office-
    // Erkennung). a0916ed war auf einem AELTEREN main-Stand gebaut (vor JOB 3017): sein Diff fuegte
    // die alte, unstrukturierte Fragen-Karte (`div.card` mit `askTitle`/`askHint`/`askRuleNote`
    // direkt im Markup) ein zweites Mal ein — als Duplikat DERSELBEN Ids (#ask-status,
    // #ask-answer-block, #ask-rule-note, #ask-gap-block, ...), die JOB 3017 bereits in die neue
    // Struktur (#ask-karte, #antwortkarte, #ask-ladekarte, #ask-luecke, #kw-fuss) verschoben hatte.
    //
    // AUFLOESUNG — beide Seiten bleiben erhalten, aber nicht wortgleich uebernommen:
    //   · DAS DUPLIKAT-MARKUP IST ENTFERNT, nicht das Verhalten. Die alte Fragen-Karte (die a0916ed
    //     zwischen `KW-KA1-TERMS-END` und dem Schluss von `#section-ask` einfuegte) ist geloescht —
    //     sie war bereits durch JOB 3017 ersetzt; ihr Fortbestehen haette doppelte Ids erzeugt.
    //   · DAS KA5-VERHALTEN STEHT VOLLSTAENDIG: `prepareAskQuestion` (Vorrangregel getippt >
    //     Markierung), `performAsk` (sechster Parameter `selection`), `askKlara` (reicht
    //     `prep.selection` durch), `updateAskSourceNote`/`askDeckelHinweis` (drei Lagen, vier
    //     Deckel-Kombinationen) sind UNVERAENDERT aus a0916ed uebernommen — git hat sie sauber in
    //     die JOB-3017-Struktur gemischt, weil sie an anderen Zeilen standen als die HEAD-Aenderung.
    //     NUR die Verzweigung in `updateAskSourceNote` war doppelt geaendert (HEAD: `setzeAskSource-
    //     Note`-Hilfsfunktion fuer den Sichtbarkeits-Zustand; a0916ed: die KA5-Vorrangregel) — beide
    //     sind jetzt vereint: die KA5-Logik schreibt weiterhin ueber `setzeAskSourceNote`.
    //   · DIE WOERTERBUCH-KONFLIKTE SIND EINZELN ENTSCHIEDEN, JE NACH WAHRHEITSGEHALT:
    //     `askInputPlaceholder`/`askSourceSelectionOverride`/`askTruncated`/`askSelectionTruncated`/
    //     `askBothTruncated` tragen a0916eds KA5-Wortlaut (er macht eine seit KA5 falsche Zusage
    //     richtig). `askHint` ist NICHT zurueckgekehrt (JOB 3017 hat den Schluessel entfernt,
    //     `tests/app/word-addin.test.ts` pinnt seine Abwesenheit); sein KA5-Anliegen — die Karte
    //     behauptet nicht mehr, freies Fragen gehe nur ohne Markierung — steckt jetzt in
    //     `askReviewNotice`. `askBusy` bleibt HEADs JOB-3016-Wortlaut (er nennt BEIDE Haelften:
    //     freigegebenes Wissen UND gesperrte Eingabe — `askHint`s kuerzerer Text haette das
    //     verloren; `tests/design/zielbild-pruefunglaeuft-messung.test.ts` V3 verlangt beide).
    //     `askReviewNotice` behaelt HEADs EINEN-Satz-Form (Zielbild SchlankesPanel Z.44,
    //     `tests/design/zielbild-schlankes-panel.test.ts` L4 verlangt wörtlich/Quellen/Markier/
    //     prüfen in einem Satz) — der Halbsatz ueber die Markierung ist auf die KA5-Wahrheit
    //     nachgefuehrt („schärft die Suche" statt „wird gefragt").
    //   · KEIN neues Abrufziel, KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht: die JOB-3018-
    //     Kette (Antwortkarte/Ladekarte/Luecke/SchlankesPanel/Office-Erkennung) ist unveraendert
    //     erhalten, die KA5-Nutzlast (`selection`-Feld) ist unveraendert gegenueber a0916ed D2.
    //   · GEPRUEFT: `tests/klara-panel/ka5-markierung-reist-mit.test.tsx` (20/20 gruen),
    //     `tests/app/word-addin-ask.test.ts`, `tests/app/word-addin.test.ts`,
    //     `tests/i18n/mega35-word-wortliste.test.ts`, `tests/legal/mega61-ki-satz.test.ts`,
    //     `tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts`,
    //     `tests/design/zielbild-schlankes-panel.test.ts` (Chromium, 62/63, 1 bewusst uebersprungen)
    //     — alle gruen gegen die zusammengefuehrte Datei. Der Pin unten ist der frisch aus dieser
    //     Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    const PIN = "5af55de51ab7f278b98b3ce4fc8b8218f0fb1be968e245ed560b6e577c58b770";
    const ist = createHash("sha256").update(readFileSync(TASKPANE)).digest("hex");
    expect(
      ist,
      "taskpane.html wurde geändert — Auslieferungsfolgen bewusst prüfen (Kommentar oben), dann den Pin aktualisieren.",
    ).toBe(PIN);
  });
});
