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
    //     Gemessen damals in `zielbild-wissen-erfassen.test.ts` (25 Werte, an DIESER Datei) — die
    //     Datei ist mit JOB 3057 K2 geloescht (Zielbild 27.08. durch Erfassen.dc.html ersetzt);
    //     die Flaeche misst seither tests/design/zielbild-k2-erfassen.test.ts.
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
    //   · GEMESSEN: zielbild-klara-main.test.ts (damals unter tests/design; in JOB 3056 durch
    //     tests/design/zielbild-k1-antwort.test.ts ersetzt) — die dist-Fassung dieser Datei in
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
    //     zielbild-pruefunglaeuft-messung (F1-F4) und in Chromium (zielbild-pruefunglaeuft) —
    //     beide damals unter tests/design, mit der Ladekarte in JOB 3056 gefallen (§9: Laden zeigt
    //     der Sendeknopf; Wartezustand jetzt in tests/design/zielbild-k1-ruhe.test.ts F5).
    //     #ask-status traegt unveraendert askEmpty,
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
    //   · Gemessen: zielbild-schlankes-panel (Chromium, 360 px) und die nachgefuehrte Ruhezustands-
    //     Messung zielbild-schlankespanel-messung — beide damals unter tests/design, in JOB 3056
    //     durch tests/design/zielbild-k1-ruhe.test.ts ersetzt (Pedis Mockup vom 04.09.).
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
    // ============================================================================================
    // JOB 3056 K1 (04.09.2026) — DER PIN WANDERT WEGEN DES PAGES-MASSSTABS (Pedis Mockups).
    // ============================================================================================
    // VORHERHASH taskpane.html: `f8dc1c9368a3016622265c7f71077554a5abc8ca82c88988ff44f02bf175e2cc`.
    //
    // GEAENDERT WURDE DAS SICHTFELD — Stilblock, Rumpf und die Anzeige-Funktionen des Skripts.
    // Pedis Urteil (04.09. 06:50): „Text über Text über Text … Absolut unmöglich." Massstab Apple
    // Pages: Knopf und Feld erklaeren sich selbst, Erklaertext gehoert hinter das Zahnrad.
    //   · KOPF: nur „Klara", der Umschalter Fragen | Erfassen als Segment und das Zahnrad; im
    //     Antwortzustand, in den Einstellungen und in der Hilfe ein Zurueck-Chevron (#kw-zurueck).
    //     GELOESCHT aus dem Kopf: Sprachwahl, #kw-kopf-zeile/#kw-anmeldung/#kw-stand-kopf,
    //     #klara-trust-head, #klara-s4 — alle leben an neuem Ort weiter (s. u.).
    //   · RUHE: Lupe + EIN Satz (askRuheSatz) in der Mitte, das Frage-Feld unten (Platzhalter
    //     „Frage", runder Sendeknopf grau/Funke). Nicht angemeldet / nicht erreichbar: EIN Satz +
    //     EIN Knopf in der Mitte (#session-block; #session-card, greet*, loginHint sind aus dem
    //     Sichtfeld). Laden = drehender Kreis im Sendeknopf (askBusy als aria-label); die Ladekarte
    //     #ask-ladekarte/#ask-ladekarte-satz ist GELOESCHT.
    //   · ANTWORT: Frage als gedaempfte Zeile, Karte mit Text und Chips „n · Titel", „Einfuegen" /
    //     „Kopieren", das Feld unten. GELOESCHT: #ask-review-notice, Herkunftszeile im Sichtfeld,
    //     #antwortkarte-fuss (askFussHinweis), #ask-neue-frage-btn (→ Chevron), #klara-leitsatz,
    //     Chip-Fassung. Neu: #ask-mehr-btn/#ask-mehr-block (Einstufung, Vorbehalt, Konflikt,
    //     Ausschnitt, Quellen-Details), #ask-vorbehalt (EIN lagebezogener Satz), #ask-retry-btn.
    //   · LUECKE: ohne Fusszeile (#ask-luecke-fuss GELOESCHT; askGapFuss steht in der Hilfe), ohne
    //     gemessenes Buehnenmass (Flex-Kind der fensterhohen Spalte).
    //   · EINSTELLUNGEN (#kw-einstellungen, ueber das Zahnrad): Sprache (#lang-*), „Text in Word
    //     mitlesen" (#einst-mitlesen — ersetzt askSourceSelection/askSourceManual), „Externe KI
    //     erlauben" (= #klara-consent-grant/-revoke als Schalter, #klara-consent-card darunter),
    //     „Vom Admin eingestellt" (KI = #klara-s4-mode oder „–", Wissen, Server), „In dieser
    //     Sitzung" (#klara-s4-provider/-session/-deviation), Konto (#einst-konto-name, #logout-btn)
    //     und der Fuss „Klara <Stand>" (#kw-stand — der Kopf-Spiegel ist weg) mit Fassungszeile.
    //   · HILFE (#kw-hilfe, „Wie Klara antwortet"): greet*, askReviewNotice, #ask-rule-note,
    //     askGapFuss, #klara-trust-head (derselbe Abruf /api/reasoner/status), help*, loginHint,
    //     loginReturn.
    //   · KA6 „Schreiben auf Zuruf": ein Untermenue des Felds — sichtbar nur mit Text im Feld oder
    //     Markierung in Word (ka6Kontext), Erklaersatz als Tooltip.
    //   · WOERTERBUCH je Sprache: neu askRuheSatz, askMehr, askWeniger, retryCta, askOffline,
    //     einst* (11); geaendert tabCapture („Erfassen"), askInputPlaceholder („Frage"), loginCta
    //     („Anmelden"), askInsertCta („Einfuegen"); ENTFERNT askFussHinweis, klaraLeitsatz,
    //     askSourceSelection, askSourceManual, s4SitzungKeine.
    //   · STIL: drei Mockup-Farben (#9AA2B1, #C9C2B6, #EEEAE3) als benannte Mockup-Ausnahmen
    //     (mega43), Fenster als Flex-Spalte, Tokens --shell-* entfallen.
    //
    // UND — die Auslieferungsfolge — EIN NEUES ABRUFZIEL: `POST /api/auth/logout` („Abmelden").
    // Es ist die BESTEHENDE Abmelde-Route der App, same-origin, ohne Nutzlast; die bewusste
    // Antwort auf „CSP? Recht? Manifest?" steht in tests/app/mega69-klara-merkmale.test.ts (11 → 12).
    // KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht, KEIN neuer Fremd-Ursprung. Der Ask-Weg
    // bleibt byte-gleich (`mode: "retrieval-only"`, dieselben Bindungskopfzeilen).
    //
    // AUSLIEFERUNGSFOLGE fuer ein installiertes Add-in: KEIN erneutes Sideload; die Datei wird beim
    // naechsten Oeffnen frisch geholt. Wer den Office-Cache noch kurz sieht, hat das alte Panel —
    // beide Fassungen sprechen dieselben Routen. Gemessen in Chromium an der ausgelieferten Datei:
    // tests/design/zielbild-k1-*.test.ts und k1-funktionsinventar.test.ts.
    //
    //   · RUNDE 4 (04.09.2026, Codex-Pflichten) — PIN BEWUSST AKTUALISIERT (58e7f49f… -> 00247c74…):
    //     (1) FUSSNOTENZIFFERN: der Antworttext bleibt das Feld #ask-answer-edit (mega35/36: EIN
    //     Feld, alle Ausgaenge), jetzt in einem Rahmen #ask-answer-text mit einem unsichtbaren
    //     Spiegel #ask-answer-spiegel und den echten <sup class="fussnote"> in #ask-fussnoten
    //     (renderAskFussnoten/askFussnotenSetzen; Chips tragen data-quelle). Eine Ziffer bekommt
    //     nur, was `citedSources` traegt — keine Rolle wird erfunden. (2) SITZUNGSLAGEN:
    //     renderSitzungsflaeche kennt GENAU EINE Lage (laedt/angemeldet/anmelden/erneut/warten) und
    //     zeigt je Lage hoechstens EINEN Knopf; beim ersten Abruf steht NICHTS in der Mitte.
    //     (3) ABMELDEN: ein bestaetigter Logout (2xx) verwirft sofort den KI-/S4-Stand, die geplante
    //     Auffrischung und jede laufende Antwort (klaraS4Verwerfen, Epoche) — „–" bis zum frischen
    //     Abruf. KEIN neues Abrufziel, KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht; der
    //     Ask-Weg und die Nutzlasten sind byte-gleich. Belegt in tests/app/k1-sitzungslagen,
    //     k1-abmelden-verwirft-sitzung, k1-fussnoten-zuordnung (jsdom) und zielbild-k1-antwort N1-N3,
    //     Z1-Z3 (Chromium).
    //
    //   · RUNDE 6 (05.09.2026, Codex Runde 5) — PIN BEWUSST AKTUALISIERT (00247c74… -> beffccb4…):
    //     der Quellen-Ruecklauf (resolveAskSources in renderAskOutcome) traegt jetzt die Generation
    //     des Ergebniszustands UND das Ergebnisobjekt; ein Ruecklauf einer frueheren Frage wird
    //     verworfen und aendert weder Chips, Ziffern, Quellen-Zeile noch das Ausgabetor. KEIN neues
    //     Abrufziel, nichts sonst. Belegt in tests/app/k1-quellen-rennen (jsdom) und
    //     zielbild-k1-antwort V1-V3 (Chromium).
    //
    //   · RUNDE 8 (05.09.2026, Codex Runde 7, Pflicht 9) — PIN BEWUSST AKTUALISIERT (beffccb4… -> e476ec49…):
    //     klaraS4Anzeige verwirft eine ABGELAUFENE Aufloesung ganz (Modus, Anbieter, Modell,
    //     Zustimmung, Freigabe) und meldet nur den Zustand s4StateVeraltet — die KI-Zeile zeigt
    //     „–", Fragen ist gesperrt, bis ein frischer Abruf erfolgreich ist. KEIN neues Abrufziel,
    //     nichts sonst. Belegt in tests/app/k1-abgelaufene-aufloesung (jsdom) und
    //     klara-ai-header Block C (Ablauf-Test mit modeKey/provider/model/askAllowed).
    //
    //   · RUNDE 9 (05.09.2026, Codex Runde 8, Korrekturpflichten 1+2) — PIN BEWUSST AKTUALISIERT
    //     (e476ec49… -> 5483e0e7…): die ABLAUFSPERRE `klaraS4Abgelaufen`. Sobald eine Aufloesung
    //     abgelaufen ist, bleibt Fragen fail-closed ueber ausstehende, scheiternde (5xx, Netz, Frist)
    //     und unerreichbare Folgeabrufe hinweg; nur eine frische, nicht abgelaufene Antwort von
    //     GET /api/klara/ai-status (klaraS4Uebernehmen) loest sie. askKlara zeichnet nach dem
    //     Rueckweg am Gate den Knopf neu. KEIN neues Abrufziel, nichts sonst. Belegt in
    //     tests/app/k1-abgelaufene-aufloesung „R9 Nutzerweg" (503 und Netz: Knopf gesperrt, Klick
    //     und Programmaufruf ohne POST /api/ask, frische Aufloesung gibt frei, dann genau ein Ask).
    //
    //   · RUNDE 10 (05.09.2026, Codex Runde 9, Korrekturpflichten 1+2) — PIN BEWUSST AKTUALISIERT
    //     (5483e0e7… -> 832ad99c…): der BEWAHRTE ABLAUFZEITPUNKT `klaraS4BestaetigtBisMs`. Bis Runde 9
    //     mass klaraS4AblaufMerken an Sicht und Phase — beide loescht ein Fehlschlag VOR dem Ablauf,
    //     und der spaetere Ablauf blieb unerkannt (Frage ging ohne frischen KI-Stand ab). Jetzt traegt
    //     klaraS4Uebernehmen die Frist jeder bestaetigten Aufloesung in eine eigene Variable ein,
    //     die nur klaraS4Verwerfen (Abmelden) loescht; klaraS4AblaufMerken misst AUSSCHLIESSLICH an
    //     ihr. KEIN neues Abrufziel, kein neuer Text, nichts sonst. Belegt in
    //     tests/app/k1-abgelaufene-aufloesung „R10 Zeitloch" (frisch → 503/Netz vor Ablauf → Uhr
    //     ueber expiresAt → Tippen sperrt → weiterer Fehlschlag → 0× POST /api/ask → frisches GET
    //     gibt frei, genau ein Ask).
    //
    // ============================================================================================
    // JOB 3056 KONFLIKTRUNDE 1 (05.09.2026) — PIN NEU GERECHNET NACH REBASE AUF DIE GELANDETE
    // KA5-KETTE (JOB 3019, main).
    // ============================================================================================
    // VORHERHASH taskpane.html: `832ad99c58f0c2025b98b0a2cf38dafd2bbfcda3af2480504e487156e2c0309c`
    // (Runde 10 oben). `git rebase main` traf mit 57da0eb (D10, Runden 1-10 oben) auf die
    // inzwischen auf main gelandete KA5-Kette (JOB 3019 D1-D3): `prepareAskQuestion` kehrt seither
    // die Vorrangregel um (getippter Text gewinnt, die Markierung reist als eigenes Feld
    // `selection` mit), `performAsk`/`askKlara` reichen `prep.selection` durch, und main hatte dafuer
    // eine eigene, VIER-lagige Herkunftszeile samt Deckel-Wahrheitstabelle gebaut (`askDeckelHinweis`,
    // `askSourceSelection`, `askSourceManual`, `askSelectionTruncated`, `askBothTruncated`,
    // getestet in `ka5-markierung-reist-mit.test.tsx` unter tests/klara-panel).
    //
    // AUFLOESUNG — die KA5-Nutzlast bleibt, die main-eigene Herkunftszeile weicht dem Ruhe-Umbau:
    //   · `prepareAskQuestion`/`performAsk`/`askKlara` STEHEN UNVERAENDERT — dieselbe Umkehr der
    //     Vorrangregel, derselbe sechste Parameter `selection`, dieselbe Suchschaerfung serverseitig
    //     (`services/ask/src/service.ts:513-515`). Der Ask-Koerper ist byte-gleich dem Stand vor
    //     dieser Runde.
    //   · `updateAskSourceNote` bleibt K1s EINE-Satz-Fassung (nur der Verwerfungsfall — Markierung
    //     UND Eingabe da — bekommt einen Satz), aber die Bedingung ist auf KA5s TATSAECHLICHE
    //     Vorrangregel nachgefuehrt: main haette mit `prep.from === "selection" && auchGetippt`
    //     NIE gefeuert (unter KA5 gewinnt bei Eingabe immer `from: "manual"`); jetzt entscheidet
    //     `prep.from === "manual" && prep.selection.length > 0` — die Lage, in der die Markierung
    //     zusaetzlich mitreist. `askMarkierungDa` (KA6-Kontext) liest seither `prep.selection.length
    //     > 0` mit, nicht mehr ausschliesslich `prep.from === "selection"`, sonst waere eine
    //     Markierung bei getippter Frage fuer KA6 unsichtbar gewesen.
    //   · `askDeckelHinweis` UND die Woerterbuchschluessel `askSourceSelection`, `askSourceManual`,
    //     `askSelectionTruncated`, `askBothTruncated` sind GELOESCHT — sie bedienten ausschliesslich
    //     die abgeloeste Vier-Lagen-Herkunftszeile; die Statuszeile nach der Antwort zeigt
    //     `askTruncated` unveraendert (renderAskOutcome), dort bleibt nichts stumm.
    //     `askSourceSelectionOverride` traegt jetzt durchgehend KA5s korrigierten Wortlaut
    //     („… wird mitgesendet und schärft die Suche"), nicht mehr D10s vor-KA5-Wortlaut („… wird
    //     dabei NICHT gesendet").
    //   · `ka5-markierung-reist-mit.test.tsx` (unter tests/klara-panel) ist GELOESCHT: die Datei
    //     mass fast ausschliesslich die abgeloeste Vier-Lagen-Herkunftszeile (Faelle B, T0-T6).
    //     `prepareAskQuestion` des ausgelieferten Skripts (`selection`/`selectionTruncated`) bleibt
    //     gedeckt durch `tests/app/word-addin-ask.test.ts` Teil 3; die neue Herkunftszeile durch
    //     `tests/design/k1-funktionsinventar.test.ts` (Lage `markierungUndText`).
    //     NACHZUG-RUNDE 1 (05.09.2026): der abgesendete KOERPER (Faelle A/C/D — `question`,
    //     `selection`, fehlendes Feld) war damit NICHT mehr gedeckt; er ist es wieder durch
    //     `tests/app/k1-ask-koerper-markierung.test.tsx` (dieselbe Vorrichtung wie die
    //     k1-Laufzeittests). taskpane.html selbst ist in dieser Runde UNVERAENDERT, der Pin steht.
    //   · KEIN neues Abrufziel, KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht: `POST
    //     /api/ask` und `POST /api/auth/logout` (Runde 4) sind unveraendert; `mode: "retrieval-only"`
    //     unangetastet.
    //   · GEPRUEFT: `tests/app/word-addin-ask.test.ts`, `tests/app/word-addin.test.ts`,
    //     `tests/app/mega74-klara-bilder.test.ts`, `tests/i18n/mega35-word-wortliste.test.ts`,
    //     `tests/design/k1-funktionsinventar.test.ts` — der Pin unten ist der frisch aus der
    //     zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    // ============================================================================================
    // JOB 3057 KONFLIKTRUNDE 6 (05.09.2026) — PIN NEU GERECHNET NACH REBASE AUF DIE OBIGE
    // JOB-3056-KETTE (VORHERHASH `9b103cd7a6b07ad2f05f50c8b1744c74dd9de7a1c0581177a77d4eb6b4b13096`).
    // ============================================================================================
    // JOB 3057 K2 (05.09.2026) — PIN BEWUSST AKTUALISIERT (f8dc1c93… -> 903bce9a…), Auslieferungsfolgen:
    // ============================================================================================
    //   · WAS SICH AENDERT: die Flaeche „Erfassen" (#section-capture) nach Zielbild Erfassen.dc.html
    //     (Pedi, 04.09.): Markup, Stilregeln, Woerterbuch und Skript. NEU im Markup: die
    //     Markierungskarte (`#capture-kicker`, `#capture-absaetze`, `#capture-leer`, die Ergebniszeile
    //     `#capture-ergebnis` mit `#open-link`, der Bilder-Satz `#capture-bilder-ergebnis`/`#capture-
    //     bilder-satz`/`#capture-bilder-link`), die Zeile „Titel" (`#capture-felder`, `#capture-titel`),
    //     `#capture-aktion` um den EINEN `#send-btn`, die Knoepfe `#office-hint-btn` und
    //     `#send-status-btn`, der Textlink `#capture-dokument-link`, das „?"-Menue (`#capture-mehr-btn`,
    //     `#capture-mehr` mit `#capture-hinweis-umfang`, `#capture-bilder-hinweis` (umgezogen),
    //     `#capture-hinweis-pruefung`, `#capture-hinweis-seiten`). ENTFERNT (ersetzt, nicht daneben):
    //     die Radiogruppe `#scope-selection`/`#scope-document`/`#scope-pages`(-label), `#scope-pages-
    //     hint`, `#send-review-note`, `#open-block`. Woerterbuch: neue Schluessel `capture*`,
    //     `sendOffline`, `sendImagesMissingOne`, `sendImagesDroppedOne`, `sendImagesBoth`; entfernt
    //     `scopeSelection`, `scopeDocument`, `scopePages`, `scopePagesOff`; auf EINEN Satz gekuerzt
    //     `noOffice`, `sendError`, `sendTooLarge`, `sendForbidden`, `sendRateLimited*`, `sendImages*`,
    //     `sendOverBudget`, `sendPlainFallback`; `sendOk` heisst „Entwurf gesendet", `openLink` „Oeffnen".
    //     Skript: `sendeEntwurf(scope)` (sendSelection/sendDocument), `captureMarkierungLesen`,
    //     `captureOfficeAnschliessen`, `renderCapture`, `bilderSatz`/`bilderBilanz`,
    //     `zeigeEntwurfsErgebnis`, `hideSendStatus`, `sendeFehlerText`; `prepareWordDraftRequest`
    //     bekommt einen dritten Parameter (Titel), Zwilling in wordAddin.ts, Aequivalenz gepinnt.
    //   · KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein neuer Fremd-Ursprung, KEINE
    //     geaenderte CSP, KEIN neues Abrufziel: die Menge der `fetch(...)`-Ziele ist unveraendert
    //     (`/api/drafts`, `/api/drafts/from-docx`, Anmelde-/Statuswege wie bisher). Die Nutzlast von
    //     `/api/drafts` hat dieselbe Form (title, statement, bodyHtml, origin) — `title` kann jetzt
    //     der von Hand gesetzte Titel sein; `/api/drafts/from-docx` bekommt optional `title`, ein
    //     Feld, das die Route seit JOB 2613 annimmt (DocxDraftRequest.title, capture-routes.ts).
    //   · MEHR OFFICE-LESEN, KEIN NETZ: die Karte liest die Markierung (Text-Zugriff) bei Office-
    //     Bereitschaft, bei jedem DocumentSelectionChanged und beim Reiterwechsel; das ist ein
    //     Lesen im Fenster, kein Abruf. „Neu laden" ist `window.location.reload()`.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: Entwuerfe werden nie automatisch validiert (der
    //     Pruefhinweis steht im „?"-Menue), die Bilder-Wahrheit bleibt (Vorab-Kasten im Menue, das
    //     Ergebnis als EIN Satz aus gezaehlten Zahlen, Word als Ursache benannt — JOB 2551 misst
    //     weiter), „gesendet" nur nach 201, nie „Entwurf" ohne Serverbestaetigung.
    //   · Gemessen: tests/design/zielbild-k2-erfassen.test.ts (Chromium, 360 px, jeder Zielbildwert
    //     und alle Zustaende), zielbild-k2-kein-erklaertext.test.ts (Textmesser),
    //     k2-funktionsinventar.test.ts (jede heutige Funktion an ihrem neuen Ort ausgefuehrt).
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig; es holt die Datei beim
    //     naechsten Oeffnen frisch. Bis der Office-Cache nachzieht, steht die alte Flaeche.
    //   · RUNDE 3 (BEN, 903bce9a… -> d8725b6d…): Sendebestaetigungen sind an ihren SENDELAUF und an
    //     die beim Senden gezeigte Markierung gebunden (`captureSendeLauf`, `sendeLaufAktuell`,
    //     `zeigeEntwurfsErgebnis(url, bilder, gesendet)`). Ein Ruecklauf eines ueberholten Laufs
    //     veraendert weder Karte noch Status noch Link; hat die Markierung waehrend des Sendens
    //     gewechselt, ersetzt die Bestaetigung die neue Markierung NICHT, sondern steht als EIN Satz
    //     + Knopf „Oeffnen" im Statusfeld (`showSendStatus(..., "open", url)`, `window.open` mit
    //     noopener — dieselbe Navigation wie der Link der Ergebniszeile). KEIN neuer Schluessel,
    //     KEIN neues Element, KEIN neues Abrufziel, kein Manifest, keine CSP, keine Nutzlast.
    //     Gemessen: zielbild-k2-erfassen.test.ts R1/R2 (gehaltene Antwort, Markierungswechsel,
    //     vertauschte Reihenfolge, ueberholter Fehler).
    //   · Beide Kommentarketten (JOB 3056 K1 oben UND JOB 3057 K2/Runde 3 hier) stehen unveraendert
    //     nebeneinander in der zusammengefuehrten Datei — MIT EINER KORREKTUR: `#section-capture`
    //     trug noch `margin: 0 -14px` (die Kompensation der 14px Koerperpolsterung von VOR JOB
    //     3056); K1s Kopf steht jetzt direkt am Fensterrand (`body { padding: 0 }`), die
    //     Kompensation zog die Karte deshalb 14px zu weit nach links/rechts (16px Sollmass maass
    //     nur noch 2px, zielbild-k2-erfassen.test.ts Z.28/Z.49 rot). Die Regel steht jetzt auf
    //     `margin: 0`, wie `#section-ask` es bereits ohne Kompensation haelt. Der Pin unten ist der
    //     frisch aus dieser Korrektur gerechnete Hash, kein uebernommener Wert einer Seite.
    //   · RUNDE 4 (Tor auf dem integrierten Stand, 9607c0b6… -> a5e8fcec…): NUR EINE STILGRUPPE IST
    //     ENTFERNT — die zweite `.tabs`-Regelgruppe (JOB 2620 D4: weisse Leiste, 13px, 11px 0 9px,
    //     Unterstreichung), die im Stilblock HINTER K1s Segment-Umschalter stand und ihn in der
    //     Kaskade ueberschrieb (zielbild-k1-ruhe K4/K5/K6: Grund #FFFFFF statt #EEEAE3, Polster
    //     11px 0 9px statt 5px 12px). Der Umschalter „Fragen | Erfassen" ist K1 (JOB 3056, Ruhe.dc.html
    //     Z.20-23) und gehoert nicht zur Erfassen-Flaeche. Kein Markup, kein Skript, kein Schluessel,
    //     kein Abrufziel geaendert; genau eine `.tabs`-Gruppe bleibt (oben, K1). KEIN Sideload noetig.
    //
    // JOB 3079 · V2 (05.09.2026): Auslieferungsfolgen erneut geprüft, bevor der Pin wanderte.
    // VORHERHASH taskpane.html (Stand vor dieser JOB-3079-Kette, also VOR dem Rebase auf die obige
    // JOB-3057-Kette): `9b103cd7a6b07ad2f05f50c8b1744c74dd9de7a1c0581177a77d4eb6b4b13096`.
    //
    // DER ANLASS IST DIESMAL EINE PRODUKTENTSCHEIDUNG, keine Anzeigekorrektur, und das steht hier
    // ausdrücklich: mit `KLARA_EXTERNAL_EXECUTION_MIGRATED = true`
    // (`services/reasoner/src/klara-policy.ts`) kann Klaras Antwort in diesem Fenster ab jetzt
    // WIRKLICH über einen externen Anbieter entstehen — dann nämlich, wenn der Mensch für genau
    // dieses Dokument zugestimmt hat. Geändert wurden AUSSCHLIESSLICH Panel-Inhalte und Ableitungen
    // auf ohnehin empfangenen Feldern:
    //   · die fünf `aiLage*`-Texte je Sprache sagen nur noch, was IM HAUS arbeitet; der Zusatz
    //     „immer ohne KI-Modell" ist dort entfallen, weil er unbedingt war und es nicht mehr ist;
    //   · sechs neue Wörterbuch-Schlüssel je Sprache (`weg*`) tragen die Aussage über DIESES
    //     Fenster, je Zustand einer, samt Anbietername im einen Zustand mit Modell;
    //   · ein neues Schnittmarkenpaar `KW-KLARA-WEG-START/END` um die reine Ableitung
    //     `klaraWegKey`/`klaraWegParam` und die Klassen-Lesbarmachung `klaraS4KlassenListe`;
    //   · `renderAiLage` setzt den zweiten Satz aus dieser Ableitung; `renderKlaraS4` ruft
    //     `renderAiLage` mit, damit Kopf und Gruppe nicht auseinanderlaufen;
    //   · der Zustimmungskasten stellt dem technischen Umfang einen Klartextsatz voran
    //     (`s4ConsentSatz`, `s4KlassenUnd`, `s4Klasse_question`, `s4Klasse_candidate_texts`) —
    //     er ZITIERT die Klassen der Auflösung, die jetzt zwei sind statt einer.
    // KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht, kein neuer Fremd-Ursprung, KEINE
    // geänderte CSP, KEIN neues Abrufziel: die Menge der `fetch(...)`-Ziele und der abgesetzte
    // Ask-Rumpf (`mode: "retrieval-only"`) sind unverändert. Was sich ändert, liegt SERVERSEITIG —
    // dieselbe Anfrage wird bei gedeckter Zustimmung anders beantwortet, und das Panel sagt es.
    // Ein installiertes Add-in braucht deshalb KEIN erneutes Sideload; es holt die Datei beim
    // nächsten Öffnen frisch vom Server.
    // GEPRÜFT: `tests/ka4-freischaltung`, `tests/klara-freigabe`,
    // `tests/app/mega79-klara-antwort-ohne-modell.test.ts`,
    // `tests/app/pro375-terminologie-vertrag.test.ts`,
    // `tests/app/w1-klara-vertrauenskopf.test.ts`, `tests/app/klara-ai-header.test.ts`,
    // `tests/app/job2621-panel-wahrheiten.test.ts`, `tests/app/w1-klara-lifecycle-taskpane.test.tsx`.
    //
    // JOB 3079 RUNDE 2 (BEN-Korrekturpflicht 1): Auslieferungsfolgen erneut geprüft. VORHERHASH
    // taskpane.html: `857fd8746718c547cd2ba2f8a463cdfb3bae8ed014ede3dd4558d62a61fb46fd`.
    // GEÄNDERT WURDE AUSSCHLIESSLICH ANZEIGE, aus zwei ohnehin empfangenen NEUEN Vertragsfeldern:
    //   · `klaraS4Anzeige` liest `resolution.externalConsentProvider`/`…Model` und reicht sie als
    //     `consentProvider`/`consentModel` durch (Helfer `zeichenkette`, im selben Schnittblock);
    //   · `consentPossible` verlangt jetzt zusätzlich einen bestimmten Empfänger — ohne ihn gibt es
    //     KEINEN Zustimmungsknopf mehr (fail-closed, dieselbe Bauform wie bei den Datenklassen);
    //   · der Zustimmungskasten nennt diesen Empfänger statt des Ausführungsanbieters. Vorher stand
    //     dort wörtlich „… gehen an Klarwerk (deterministisch)", weil vor der Zustimmung nichts
    //     extern rechnet — der Kasten fragt aber, was bei einem JA geschieht.
    // KEIN Manifest, KEIN neues Abrufziel, KEINE geänderte CSP, KEIN neues Recht, kein neuer
    // Wörterbuchschlüssel, kein geänderter Ask-Rumpf. Ein installiertes Add-in braucht KEIN
    // erneutes Sideload; ein ALTER Panelstand gegen einen neuen Server zeigt den Zustimmungsknopf
    // nicht mehr an, statt einen falschen Empfänger zu nennen — die sichere Richtung.
    //
    // JOB 3079 KONFLIKTRUNDE 1 (05.09.2026) — `git rebase main` traf mit der JOB-3079-Kette (V2,
    // Runde 2 oben) auf die inzwischen auf main gelandete JOB-3057-Kette (Runden 1-4 oben, VORHER
    // fälschlich als `9b103cd7…` referenziert — der tatsächliche main-Stand vor diesem Rebase ist
    // `a5e8fcec7f194e6372aced2f3339cc155ece2072a32615faa455606517f637ba`, der Pin der JOB-3057-Kette).
    // BEIDE SEITEN BLEIBEN INHALTLICH ERHALTEN: die Erfassen-Fläche aus JOB 3056/3057 (Markup,
    // Stilregeln, Wörterbuch, Skript) UND die Zustimmungs-/aiLage-Änderungen aus JOB 3079 (V2 +
    // Runde 2, KLARA_EXTERNAL_EXECUTION_MIGRATED) stehen nebeneinander in der zusammengeführten
    // Datei. Kein Markup, kein Skript und kein Wörterbuchschlüssel einer Seite wurde entfernt, um
    // die andere Seite zu erhalten. Der Pin von diesem Stand (vor der folgenden Konfliktrunde) war
    // `1b12e66f84331623c3786337743b012adaf73fc52ed0e74bf1208029914591ce`.
    //
    // ============================================================================================
    // JOB 3091 M2 (06.09.2026) — PIN BEWUSST AKTUALISIERT (a5e8fcec… -> 28707701…), Auslieferungsfolgen:
    // ============================================================================================
    //   · WAS SICH AENDERT: NUR das Skript, ein neuer Block `KW-KA6-MEMO-START` … `KW-KA6-MEMO-END`
    //     am Ende des KA6-Blocks (vor `KW-KA6-SCHREIBEN-END`). Kein Markup-Byte geaendert: die neuen
    //     Elemente entstehen im Skript (`#ka6-memo-angebot` mit `#ka6-memo-btn`, `#ka6-memo-keine-
    //     quelle`, `#ka6-memo-status` als letztes Kind von `#antwortkarte`; die Karte `#ka6-memo-block`
    //     mit `#ka6-memo-entwurf`, `#ka6-memo-herkunft`, `#ka6-memo-anbieter`, `#ka6-memo-einfuegen`,
    //     `#ka6-memo-verwerfen`, `#ka6-memo-karte-status` vor `#ka6-block`). Kein Stilblock geaendert.
    //     Woerterbuch: 14 neue Schluessel `ka6Memo*` je Sprache (KA6_MEMO_TEXTE, eingehaengt wie
    //     KA6_TEXTE); kein bestehender Schluessel geaendert.
    //   · EIN NEUES ABRUFZIEL, benannt: `POST /api/klara/sessions/{id}/zuruf` — same-origin, ueber den
    //     BESTEHENDEN Sitzungsabruf `klaraS4AbrufDieserSitzung` (derselbe `fetch(pfad, …)`, dieselben
    //     drei Bindungskopfzeilen, dieselbe Epoche): die Menge der `fetch(...)`-Aufrufstellen ist
    //     unveraendert (mega69-klara-merkmale M6/M7 gruen), das ZIEL ist neu. Nutzlast: `art`,
    //     `text` (Auftragssatz + gestellte Frage) und `koIds` (die validierten Quellen der Antwort).
    //     Sie geht NUR nach Klick auf „Memo aus dieser Quelle" ab und nur, wenn die serverseitige
    //     Aufloesung `executionAllowed` sagt; ohne Zustimmung antwortet der Server 403 und das Panel
    //     zeigt den Zustimmungsweg von KA4/JOB 3079 (kein zweiter Dialog).
    //   · KEIN Manifest, KEIN neues Recht (ko.read wie alle Klara-Endpunkte), KEINE geaenderte CSP,
    //     kein Fremd-Ursprung, kein Speicher (kein localStorage/Cookie), KEIN Autostart, KEIN Timer.
    //   · SCHREIBEN NUR AUF KLICK: der einzige Schreibweg ist `ka6MemoEinfuegen` ueber den bestehenden
    //     `performInsert(text, buildInsertAttempts())` — gemessen in tests/ka6-memo-panel/
    //     memo-panel-mounted.test.ts (P3: null Schreibaufrufe nach dem ersten Klick; P4: genau einer
    //     nach dem zweiten, Herkunftszeile als letzter Absatz).
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: der Anbieter kommt aus der Serverantwort (klara-ai-header
    //     Block E gruen), „KI"-Behauptungen bleiben zustandsgebunden (mega81 gruen), die Chips, das
    //     Zielbild K1 (Kinder von #ask-answer-block) und die KA6-Schreibflaeche sind unveraendert.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig; es holt die Datei beim
    //     naechsten Oeffnen frisch. Der Server muss die Route registrieren (build-app.ts) — bis dahin
    //     antwortet der Klick ehrlich mit „konnte nicht geholt werden (HTTP 404)", nichts wird geschrieben.
    //
    // JOB 3091 KONFLIKTRUNDE 1 (06.09.2026) — `git rebase main` traf mit der JOB-3091-Kette (KA6-Memo,
    // M2 oben) auf die JOB-3079-Kette (V2 + Runde 2 oben, KLARA_EXTERNAL_EXECUTION_MIGRATED). BEIDE
    // SEITEN BLEIBEN INHALTLICH ERHALTEN: die Zustimmungs-/aiLage-Aenderungen aus JOB 3079 UND der
    // KA6-Memo-Block (Skript, Woerterbuch, neues Abrufziel) aus JOB 3091 stehen nebeneinander in der
    // zusammengefuehrten Datei. Kein Markup, kein Skript und kein Woerterbuchschluessel einer Seite
    // wurde entfernt, um die andere Seite zu erhalten. Der Pin unten ist der frisch aus der
    // zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    //
    // JOB 3091 RUNDE 2 (06.09.2026, cedc50cf… -> b65b9736…) — PIN BEWUSST AKTUALISIERT: GENAU EIN neuer
    // Schluessel `ka6MemoServerKenntWegNicht` (de/en/nl) und ein `status === 404`-Zweig in
    // `ka6MemoAnfordern`. Kennt der Server die Memo-Route nicht (build-app.ts registriert sie noch
    // nicht — ausserhalb der Zielpfade von JOB 3091, RUECKGABE ABWEICHUNGEN), sagt das Panel GENAU DAS
    // statt eines generischen Netzfehlers, und nichts wird geschrieben (memo-panel-mounted P6c).
    // Kein Markup, kein Stil, kein Abrufziel, keine Nutzlast, kein Recht, keine CSP geaendert; die
    // 3079-Seite ist unberuehrt. KEIN Sideload noetig.
    //
    // JOB 3091 RUNDE 3 (06.09.2026, b65b9736… -> 1fe01eb0…) — PIN BEWUSST AKTUALISIERT: NUR DREI
    // WOERTER. `ka6MemoKeineQuelle` sagt in de/en/nl „validierte“/„validated“/„gevalideerde“ statt
    // „geprüfte“/„verified“/„gecontroleerde“ Quelle — mega35 (Wortliste der Word-Flaeche) erlaubt
    // „geprüft/verified/gecontroleerd“ ausschliesslich im Einstufungshinweis; „validiert“ ist die
    // Statusangabe des Objekts und dort ausdruecklich zugelassen. Kein Markup, kein Skript, kein
    // Abrufziel, keine Nutzlast geaendert. KEIN Sideload noetig.
    //
    // JOB 3091 RUNDE 4 (06.09.2026, 1fe01eb0… -> e1e4599a…, BEN Korrekturpflicht 1) — PIN BEWUSST
    // AKTUALISIERT: ein gescheiterter Quellenabruf (`resolveAskSources` → `status: "unknown"`) las sich
    // bis R3 als „keine validierte Quelle". Jetzt haelt der Memo-Block „nicht feststellbar" getrennt:
    // NEU der Schluessel `ka6MemoQuelleUnbekannt` (de/en/nl, ohne die Wortliste mega35 zu beruehren),
    // das Element `#ka6-memo-quelle-unbekannt` im Skript, `ka6MemoQuellenUnbekanntIn` und die
    // Vier-Lagen-Zeichnung in `ka6MemoAngebotZeichnen`. Kein Markup, kein Stil, kein Abrufziel,
    // keine Nutzlast, kein Recht, keine CSP geaendert. KEIN Sideload noetig. Gemessen:
    // memo-panel-mounted P2b (HTTP 503 und Netzfehler) und P2c (EN).
    // ============================================================================================
    // JOB 3092 · S6 (06.09.2026) — DER PIN WANDERT WEGEN DER BELEGTEN ANTWORT (W5 + W6).
    // ============================================================================================
    // VORHERHASH taskpane.html: `a5e8fcec7f194e6372aced2f3339cc155ece2072a32615faa455606517f637ba`.
    //
    // GEAENDERT WURDEN — Panelinhalt, Stilregeln, Woerterbuch und Skript, +424/−10 Zeilen:
    //   · DREI neue, anfangs verborgene Markup-Stellen: `#ask-herkunft` und `#ask-ungeprueft` in der
    //     Antwortkarte (unter dem Antworttext), `#ask-gap-ungeprueft` im Lueckenblock (Geschwister
    //     von `#ask-luecke`, dessen Kinder in Chromium exakt gepinnt sind), `#capture-dubletten`
    //     (Satz + Liste) in der Markierungskarte der Erfassen-Flaeche.
    //   · Stilregeln nur an diesen Markup-Elementen, ausschliesslich aus Tokens (--muted, --text);
    //     Links tragen die Linkfarbe des Fensters (mega43 bleibt gruen, gemessen).
    //   · 19 neue Woerterbuch-Schluessel je Sprache (askHerkunft*, askUngeprueft*, captureDub*).
    //     Vier deutsche tragen „geprüft" als Objekt- bzw. Vorgangsaussage — in
    //     tests/i18n/mega35-word-wortliste.test.ts als OBJEKTAUSSAGEN benannt und begrenzt.
    //   · `performAsk` LIEST zusaetzlich das Feld `ungeprueft` NEBEN `result` (JOB 1591 D1, nur auf
    //     dem Sitzungsweg) und traegt es in beide Ausgaenge (`answered`, `gap`). Der abgesetzte Rumpf
    //     bleibt byte-gleich (`question`, `locale`, `mode: "retrieval-only"`, `selection`).
    //   · `resolveAskSources` liest zusaetzlich `version` und markiert einen gescheiterten Abruf
    //     (`geladen: false`) — Lehre JOB 3091 R3: kein Pruefstand aus einem 503.
    //   · Neue Zeichenfunktionen `renderAskHerkunft`/`renderAskUngeprueft` (Aufruf aus
    //     renderAskOutcome, dem Quellen-Ruecklauf, resetAskResult und setLang) und
    //     `captureDublettenPruefen`/`renderCaptureDubletten` (Aufruf aus renderCapture,
    //     updateSendState und setLang).
    //   · `w6DublettenAusCheckText` (Block KW-KLARA-W6-CHECKTEXT) liefert die LAGE des Laufs mit
    //     (leer | treffer | fehler | zu-kurz) und je Treffer additiv relation/koStatus/koCategory;
    //     `treffer` bleibt in jedem Nicht-Erfolgsfall leer, `status` bleibt null (KA3 unberuehrt).
    //
    // DIE EIGENTLICHE AUSLIEFERUNGSFOLGE: `POST /api/check-text` WIRD JETZT WIRKLICH GERUFEN — je
    // Markierung (>= 40 Zeichen) auf der Erfassen-Flaeche genau einmal, nur mit Anmeldung, mit
    // `source: "transient-document"` und derselben Sitzung (`credentials: "include"`). Das Ziel
    // stand seit W6 (JOB 1621) im Weg und war inert; die Menge der `fetch(...)`-Literale ist
    // unveraendert (M7 = 12; der Aufruf reicht `fetch.bind(window)` hinein wie der KA2-Weg).
    // SAME-ORIGIN, KEIN Manifest, KEINE geaenderte CSP, KEIN neues Recht (Sitzungsweg: `ko.read`
    // wie /api/ask; Add-in-Weg: `checktext.validated`). Die Route existiert serverseitig NUR bei
    // aktivem Add-on-Flag (build-app.ts, `addonApiEnabled()`); ohne sie antwortet der Server 404,
    // und das Panel sagt ehrlich „Pruefung nicht moeglich." — nie „nichts gefunden".
    // Der Text der Markierung verlaesst den Ursprung nicht: Stufe 1 der Route ist deterministisch
    // (kein Modell, kein Embedder — check-text-routes.ts), `want: "deep"` wird nicht gesendet.
    // KEIN Intervall, KEIN Wiederholzyklus: derselbe Text wird nicht erneut geprueft.
    //
    // Ein installiertes Add-in braucht KEIN erneutes Sideload; es holt die Datei beim naechsten
    // Oeffnen frisch. Bis der Office-Cache nachzieht, fehlen Herkunftszeilen und Dublettenauskunft —
    // nichts wird falsch. Gemessen: tests/s6-belegte-antwort (16 Faelle, gemountet),
    // tests/app/w6-dublettenweg-checktext.test.ts, mega43, mega69-klara-merkmale; Chromium
    // (zielbild-k1-kein-erklaertext, zielbild-k2-kein-erklaertext, k2-buehne) nachgefuehrt, im Tor
    // gemessen.
    //
    // JOB 3092 KONFLIKTRUNDE 1 (06.09.2026) -- `git rebase main` traf mit der JOB-3092-Kette (S6,
    // belegte Antwort + Dublettenweg oben) auf die inzwischen auf main gelandete JOB-3091-Kette
    // (KA6-Memo, Runden 1-4 oben, PIN e1e4599a...). BEIDE SEITEN BLEIBEN INHALTLICH ERHALTEN: der
    // KA6-Memo-Block (Skript, Woerterbuch, Abrufziel) aus JOB 3091 UND der Herkunfts-/Ungeprueft-Block
    // samt Dublettenweg aus JOB 3092 (S6, W5+W6) stehen nebeneinander in der zusammengefuehrten
    // Datei. Kein Markup, kein Skript und kein Woerterbuchschluessel einer Seite wurde entfernt, um
    // die andere Seite zu erhalten. Der Pin unten ist der frisch aus der zusammengefuehrten Datei
    // gerechnete Hash, kein uebernommener Wert einer Seite.
    // JOB 3092 RUNDE 2 (BEN, 06.09.2026) — VORHERHASH
    // `c7d70dee3ed286b025102dcb4823892d42e21858db16eb2dcab6a08520475b09`. Geaendert wurden NUR
    // Panelinhalte im Dublettenweg, +43/−6 Zeilen: `w6DublettenAusCheckText` meldet die Kuerzung
    // auf 8.000 Zeichen als `gekuerzt` und eine Trefferliste mit Eintrag ohne Kennung als Lage
    // „fehler" (statt stiller Leere); `captureDublettenPruefen`/`renderCaptureDubletten` zeigen fuer
    // gekuerzte Laeufe eigene Saetze (zwei neue Schluessel je Sprache, captureDub*Gekuerzt); eine
    // neue Markierungslesung darf einen fehlgeschlagenen Lauf wiederholen. KEIN neues Abrufziel,
    // KEIN Manifest, KEINE CSP, KEIN Recht, dieselbe Nutzlast (Text bleibt auf 8.000 geschnitten —
    // jetzt sichtbar). Kein Sideload noetig.
    // JOB 3093 M3 (06.09.2026) — Auslieferungsfolgen, angesetzt auf a5e8fcec… (vor der JOB-3091/3092-
    // Kette oben, siehe RUECKGABE des urspruenglichen Auftrags):
    //   · WAS SICH AENDERT: „Haben wir das schon?" (PRIORITAETEN N1 b, Pedi 05.09.). NEU im Markup,
    //     in der Ruhe unter dem Begriffsbild: `#bestand-block` mit dem Knopf `#bestand-btn`, der
    //     Ergebnisflaeche `#bestand-ergebnis` (Standzeile `#bestand-stand`, Liste `#bestand-liste`).
    //     Sichtbar NUR angemeldet UND mit offenem Word-Dokument; im Browser ohne Office bleibt die
    //     Ruhe unveraendert (zielbild-k1-ruhe / -kein-erklaertext messen ohne Office). Stilregeln
    //     `#bestand-*` nur mit Palette-Tokens. Woerterbuch: 13 neue Schluessel `bestand*` je Sprache
    //     (mega35 nimmt `bestandNochNichtGeprueft`/`bestandLeer` als Objektstand-Aussagen aus).
    //     Skript: Block KW-N1-BESTAND-START/END (`bestandPruefen`, `bestandTextLesen`,
    //     `bestandTrefferAus`, `bestandZeichnen`, `bestandNeuzeichnen`); zwei Einzeiler-Hooks in
    //     `updateAskState` und `markOfficeChecked` (Knopf folgt Sitzung und Office-Erkennung).
    //   · EIN NEUES ABRUFZIEL, bewusst beantwortet (mega69-klara-merkmale, M7 12 -> 13):
    //     `POST /api/check-text` ueber die Sitzung, ohne `want:"deep"` (deterministisch, kein Modell,
    //     kein Embedder, Dry-Run). Recht `ko.read` wie `/api/ask`. KEIN Manifest, KEINE CSP-Aenderung,
    //     kein Fremd-Ursprung, keine neue Office-API.
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: Entwuerfe erscheinen nie (keine Wissensobjekte, Pedi
    //     05.09. 12:03); „nichts gefunden" steht nur nach einer frischen erfolgreichen Antwort und
    //     datiert; ein Fehler heisst „Pruefung nicht moeglich"; der letzte Stand bleibt datiert stehen.
    //   · Gemessen: tests/n1-bestand-im-panel/bestand-im-panel-mounted.test.ts (Panel in jsdom),
    //     tests/n1-bestand-im-panel/fundort-im-server.test.ts (echte Route).
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig; es holt die Datei beim
    //     naechsten Oeffnen frisch. Bis der Office-Cache nachzieht, fehlt der Knopf.
    //
    // JOB 3093 KONFLIKTRUNDE 1 (06.09.2026) — `git rebase main` traf mit der JOB-3093-Kette (M3,
    // Bestand-Block oben) auf die inzwischen auf main gelandete JOB-3091/3092-Kette (KA6-Memo,
    // Herkunfts-/Ungeprueft-Block samt Dublettenweg oben, PIN 0067c5e9…). BEIDE SEITEN BLEIBEN
    // INHALTLICH ERHALTEN: der KA6-Memo-Block, der Herkunfts-/Ungeprueft-Block samt Dublettenweg aus
    // JOB 3091/3092 UND der neue Bestand-Block aus JOB 3093 stehen nebeneinander in der
    // zusammengefuehrten Datei. Kein Markup, kein Skript und kein Woerterbuchschluessel einer Seite
    // wurde entfernt, um die andere Seite zu erhalten. Der Pin unten ist der frisch aus der
    // zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    //   · RUNDE 2 (Tor rot: k1-sitzungslagen „kein Knopf in der Mitte", 3343c3c4… -> 7818aee1…):
    //     `#bestand-block` steht jetzt NEBEN `#ask-ruhe` (Geschwister, wie die KA3-Karte), nicht in
    //     der Mitte; er folgt zusaetzlich der Flaechenlage (`kwFlaecheZeichnen`: in Antwort und
    //     Luecke verborgen). KEIN eigener Uebersetzer und KEIN neues Abrufziel mehr (M7 zurueck auf
    //     12): der Block ruft `w6DublettenAusCheckText` mit `fetch.bind(window)` wie die Erfassen-
    //     Flaeche (JOB 3092). W6 traegt dafuer einen fuenften Parameter `titel` (→ `title` im
    //     Koerper; die Erfassen-Flaeche reicht ihre Zeile „Titel" durch) und je Treffer additiv
    //     `pruefstand`, `version`, `fundort`. Woerterbuch: nur noch 7 Schluessel `bestand*` je
    //     Sprache — die Lagesaetze sind die von captureDub* (ein Wortlaut je Lage).
    //   · RUNDE 3 (BEN: Trefferliste ueberlebte den Benutzerwechsel, 7818aee1… -> a7cbb7da…): der
    //     Bestandsstand haengt jetzt an der Sitzung. Neu im Block: `bestandSitzung`,
    //     `bestandSitzungsKennung`, `bestandVerwerfen`, `bestandSitzungMelden`; zwei Einzeiler-
    //     Hooks (`checkSession` meldet die Identitaet der /api/auth/me-Antwort, `abmelden` verwirft
    //     beim bestaetigten Logout neben klaraS4Verwerfen); 401/403 auf die Pruefung verwerfen den
    //     Stand, nennen den Grund (`bestandVerweigert`, ein neuer Schluessel je Sprache) und lesen
    //     die Sitzung neu. W6 traegt im Fehlerfall den HTTP-Status (`http`), additiv. KEIN neues
    //     Abrufziel, kein Manifest, keine CSP, keine neue Nutzlast.
    //
    // JOB 3094 KONFLIKTRUNDE 1 (06.09.2026) — `git rebase main` traf mit der JOB-3094-Kette (KA7,
    // Konfliktkarte unten) auf die inzwischen auf main gelandete JOB-3093-Kette (M3, Bestand-Block
    // oben, Runden 1-3, PIN a7cbb7da…). BEIDE SEITEN BLEIBEN INHALTLICH ERHALTEN: der Bestand-Block
    // aus JOB 3093 UND der KA7-Konfliktkarten-Block aus JOB 3094 stehen nebeneinander in der
    // zusammengefuehrten Datei. Kein Markup, kein Skript und kein Woerterbuchschluessel einer Seite
    // wurde entfernt, um die andere Seite zu erhalten. Der Pin unten ist der frisch aus der
    // zusammengefuehrten Datei gerechnete Hash, kein uebernommener Wert einer Seite.
    // ============================================================================================
    // JOB 3094 KA7 (06.09.2026) — Auslieferungsfolgen des KA7-Blocks, angesetzt auf a5e8fcec… (vor
    // der JOB-3091/3092/3093-Kette oben, siehe RUECKGABE des urspruenglichen Auftrags vor dem Rebase):
    // ============================================================================================
    //   · WAS SICH AENDERT: GENAU EIN Skriptblock am Ende (KW-KA7-KONFLIKT-START/END), kein Markup
    //     im Rumpf, kein Stil. Der Block erzeugt zur Laufzeit den Knopf „Passt das zur Regelung?"
    //     (#ka7-btn) mit Karte (#ka7-karte) NEBEN der Ruhe und den Einreich-Hinweis
    //     (#ka7-einreich-hinweis) an der Markierungskarte; 37 Woerterbuchschluessel je Sprache
    //     (ka7*), in STRINGS eingehaengt wie KA3/KA6. Runde 5 (Tor-Befund mega35-word-wortliste):
    //     „geprueft"/„gecontroleerd" nur noch in den drei Leersaetzen (Auftrag §5.3, Zeitstempel eines
    //     gelaufenen Laufs, in mega35 als Vorgangsaussage eingetragen); Stand- und Kuerzungssatz sagen
    //     „Abgleich"; der Pruefstand nutzt die 3093-Schluessel askStatusValidiert/
    //     bestandNochNichtGeprueft/askStatusUnknown statt drei eigener (ka7Pruefstand* entfernt).
    //     Runde 6 (Codex R5): (1) „gelaufen: false" mit Zahlen wird zu „Pruefung nicht belastbar:
    //     <Grund> — m von n Quellen ohne belastbares Urteil" (neuer Grund `urteil_verworfen`, neues
    //     Antwortfeld `verworfen`, aelterer Server ohne das Feld = 0), nie zur Leere; (2) eine
    //     Wiederholung fuer DENSELBEN Text haelt den frueheren Befund (Karte, Entscheidung, Stand-
    //     Satz mit seiner Uhrzeit, Einreich-Hinweis) waehrend des Laufs und nach 503 mit Vorbehalt
    //     („Befund von HH:MM … fehlgeschlagen/laeuft"); ein anderer Text traegt nichts weiter. Acht
    //     Schluessel je Sprache dazu (ka7GrundUrteilVerworfen, ka7NichtBelastbar, ka7Vorher*,
    //     ka7EinreichVorbehalt*), ka7StandAusfall umformuliert. KEIN neues Abrufziel, kein Manifest,
    //     keine CSP, kein Schreibweg; gemessen: konfliktkarte-mounted P11–P14.
    //     Runde 7 (Codex R6): Teil-Ausfall MIT neuen Treffern (HTTP 200, Konflikte, gelaufen:false)
    //     vereinigt die neuen Treffer mit den frueher bekannten, nicht entkraefteten Konflikten
    //     (`ka7Vereinigen`, Zeile mit `data-vorbehalt` und „Befund von HH:MM — weder bestaetigt
    //     noch entkraeftet"; Kopf „nicht belastbar … gelten weiter"; Einreich-Hinweis „Nicht
    //     aufgefrischt: …"). Vier Schluessel je Sprache dazu (ka7ZeileVorbehalt, ka7KopfVorbehalt,
    //     ka7EinreichVorbehaltTeil, ka7VorbehaltEintrag). Kein neues Abrufziel, kein Manifest, keine
    //     CSP, kein Schreibweg; gemessen: konfliktkarte-mounted P15/P15b/P15c.
    // ============================================================================================
    // JOB 3174 M4b (07.09.2026) — Auslieferungsfolgen der drei Nachtraege am KA7-Block:
    // ============================================================================================
    //   · WAS SICH AENDERT: NUR der KA7-Block (KW-KA7-KONFLIKT-START/END), kein Markup im Rumpf,
    //     kein Stil, kein neues Abrufziel (M7 bleibt 13), kein Manifest, keine CSP, kein Schreibweg
    //     in Word, KEIN Speicherweg (weiterhin kein localStorage/sessionStorage/roamingSettings).
    //   · (1) DOPPELUNG IST KEINE ABWEICHUNG: `ka7Uebersetzen` liest jetzt auch `duplicates` (Teil
    //     des Antwortvertrags der Route, check-text-routes.ts `toResponse`) und prueft bei jedem
    //     `conflicts`-Eintrag das Trefferverhaeltnis `type`. Bekannter Konflikttyp → „Abweichung";
    //     `doppelung`/`duplicate` (die beiden Woerter aus services/conflicts/src/detect.ts:158-160)
    //     → Doppelungsliste; fehlender oder unbekannter Typ → Lage „fehler" (nicht raten, wie beim
    //     Treffer ohne Kennung). Ein Koerper OHNE `duplicates` ist keine Antwort dieser Route mehr →
    //     „Pruefung nicht moeglich", nie „keine Abweichung". Die Karte traegt dafuer zwei neue
    //     Stellen (#ka7-doppelung-satz, #ka7-doppelung-liste), erzeugt zur Laufzeit wie der Rest;
    //     die Beziehung steht im Wortlaut der Erfassen-Flaeche (W6_RELATION_KEYS), kein zweiter.
    //   · (2) DER WIEDER GEOEFFNETE ENTWURF: der Einreich-Hinweis (#ka7-einreich-hinweis) sagt jetzt
    //     auch, wenn fuer den Entwurf KEINE frische Pruefung vorliegt — samt dem Grund, den der
    //     Stand fuer ihn nennt — und bekommt einen Knopf daneben (#ka7-einreich-pruefen), der
    //     `ka7Pruefen` ruft: derselbe Aufruf wie der Knopf im Fragen-Reiter, KEIN zweiter Pfad zur
    //     Route und kein zusaetzliches Abrufziel. Ein Entwurf ohne moegliche Pruefung (zu kurz,
    //     abgemeldet, kein Word) und ein frischer, belastbar leerer Lauf schweigen wie bisher.
    //     RUNDE 2 (Tor-Befund tests/design/zielbild-k2-kein-erklaertext.test.ts, T1-T4 und K rot):
    //     Runde 1 stellte einen 72-Zeichen-SATZ auf eine Flaeche, die Pedi wortlos haelt (JOB 3057
    //     K2 §5.7). Runde 2 versteckte die Aussage stattdessen bei geschlossener KI-Weiche — und
    //     nahm dem Entwurf damit genau die Auskunft, um die es geht (BEN R2, Korrekturpflicht 1).
    //     RUNDE 3, so steht es jetzt:
    //       · auf der FLAECHE eine kurze BESCHRIFTUNG unter 40 Zeichen — „Keine frische Pruefung",
    //         „Pruefung laeuft …" oder, nach einem belastbar leeren Lauf, „Kein Widerspruch · HH:MM".
    //         Sie steht IMMER, auch ohne KI-Freigabe: der Pruefstand ist eine Tatsache ueber diesen
    //         Entwurf. Gemessen in Chromium (zielbild-k2-kein-erklaertext T1) und gemountet (P17e:
    //         jede Beschriftung in DE/EN/NL unter 40).
    //       · der LANGE Satz im „?"-Menue (#ka7-mehr-hinweis, zur Laufzeit an #capture-mehr
    //         angehaengt, `data-t` traegt ihn durch den Sprachwechsel) — dort, wo diese Flaeche ihre
    //         Erklaertexte haelt (§5a). Gemessen: P17d.
    //       · der KNOPF nur bei offener KI-Weiche (`ka7ExterneKi() === "erlaubt"`); sonst gaebe es
    //         nichts zu starten. Gemessen: P17c (erlaubt / verweigert / noch ungeklaert).
    //       · KEIN Grundsatz mehr auf der Flaeche („Pruefung nicht moeglich: …" ist ein Satz und
    //         steht auf der Karte im Fragen-Reiter, wo er immer stand).
    //     Damit die Weiche nach ihrer ASYNCHRONEN Aufloesung ankommt, folgt der Hinweis zusaetzlich
    //     `renderKlaraS4` (Wrapper wie KA6, Zeile ~9459: Original zuerst und unveraendert).
    //     T1 des Textmessers ist nachgefuehrt: EIN Eintrag mehr, `beschriftung:#ka7-einreich-hinweis`
    //     — als Beschriftung, nicht mit eigener Rolle, damit die 40-Zeichen-Regel FUER ihn gilt.
    //   · (3) Die Zeitprobe ist ein TEST-Nachtrag (P16 ersetzt P15c); der Ausliefercode dazu bleibt
    //     unveraendert (`ka7Vereinigen`, `kopie.vorbehaltZeit = alt.vorbehaltZeit || vorher.zeit`).
    //   · NEUN Woerterbuchschluessel je Sprache dazu aus den Runden 1-4 (Runde 5 unten legt zwei
    //     weitere nach): (ka7DoppelungEine, ka7DoppelungMehrere,
    //     ka7DoppelungAuchKonflikt, ka7ZeileAuchDoppelung, ka7EntwurfOhnePruefung,
    //     ka7EntwurfOhneWiderspruch, ka7EntwurfPruefenCta, ka7EntwurfLaeuft, ka7EntwurfMenuText).
    //     Die Pruefstands- und Beziehungssaetze in der Doppelungsliste nutzen die BESTEHENDEN
    //     Schluessel; die Gruende eines Laufs stehen nur auf der Karte, nicht am Entwurf.
    //   · Gemessen: konfliktkarte-mounted P16/P17/P17b/P17c/P17d/P17e/P18/P18b/P18c/P18d (und
    //     P10b/P14, die den kurzen Pruefstand statt der bisherigen Leere pruefen); in Chromium
    //     zusaetzlich zielbild-k2-kein-erklaertext, zielbild-k2-erfassen, k2-funktionsinventar und
    //     die vier K1-Zielbilder.
    //   · EIN Abrufziel mehr (M7 12 → 13, bewusst beantwortet in mega69-klara-merkmale.test.ts):
    //     `POST /api/check-text` in der TIEFEN Stufe — derselbe Pfad wie der W6-Weg, aber mit
    //     `want: "deep"` und `confidentiality: "intern"`, NUR nach der KA4-Weiche (Einwilligung fuer
    //     dieses Dokument UND Ausfuehrung freigegeben, aus dem Serverstand). Ohne sie geht nichts ab.
    //   · KEIN Manifest, KEINE CSP-Aenderung, KEIN neues Recht (ko.read wie bisher), KEIN neuer
    //     Fremd-Ursprung, KEIN Schreibweg in Word (kein insertText/setSelectedDataAsync/Word.run).
    //   · KEINE ZUSICHERUNG WIRD SCHWAECHER: Ask-Weg, W6-Weg, KA3/KA6-Bloecke, Sendeknopf und
    //     Entwurfsnutzlast sind unveraendert; die Wrapper (updateAskState, kwFlaecheZeichnen,
    //     renderCapture, klaraS4Verwerfen, setLang) rufen das Original zuerst und unveraendert.
    //   · Gemessen: tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts (13 Faelle, jsdom, das
    //     ausgelieferte Skript); Chromium-Zielbilder laufen im Tor.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig; es holt die Datei beim
    //     naechsten Oeffnen frisch. Ein aelterer Server ohne `konfliktpruefung` fuehrt zur Lage
    //     „Pruefung nicht moeglich", nie zu „keine Abweichung".
    //
    // ============================================================================================
    // JOB 3096 · M5 (07.09.2026) — DER PIN WANDERT WEGEN DES BILDES AUS DEM BESTAND. VORHERHASH
    // taskpane.html (Basis 1.103, fc4173d, vor der JOB-3079/3091-3094-Kette oben):
    // a5e8fcec7f194e6372aced2f3339cc155ece2072a32615faa455606517f637ba
    // ============================================================================================
    //   · EIN neuer Skriptblock KW-M5-BILD-START/END zwischen KW-KA3-KARTEN-END und
    //     KW-KA6-SCHREIBEN-START: „Bild dazu?" — Knopf und Karte entstehen zur Laufzeit als
    //     #m5-bild-block NEBEN der Ruhe-Mitte (unter #ask-ruhe eingehaengt wie die KA3-Karte; die
    //     Mitte selbst bleibt Lupe + EIN Satz, k1-sitzungslagen gruen). KEIN Markup-, KEIN
    //     Stilblock-Hunk; Farben nur ueber vorhandene Klassen `card`, `ghost`, `primary`, `muted`,
    //     `status`, Inline-Stile ohne Farbliteral. Woerterbuch M5_BILD_TEXTE (de/en/nl) haengt sich
    //     in STRINGS ein wie KA3/KA6.
    //   · Abrufziel: EIN neues `fetch(` (`m5Abruf`) fuer `GET /api/library/images` und, erst beim
    //     Einfuegen, `GET /api/objects/<id>/raw` — die bewusste Antwort (CSP/Recht/Manifest/Nutzlast)
    //     steht in mega69-klara-merkmale.test.ts beim Zaehler (13 → 14 nach diesem Rebase).
    //   · Word: `Word.run` mit WordApi 1.1 (`Range.paragraphs`, `Paragraph.insertParagraph`,
    //     `Paragraph.insertInlinePictureFromBase64`); kein Manifestwechsel, KEIN Sideload noetig.
    //   · Drei Wrapper (Original zuerst, Nachtrag danach): `updateAskState` (Knopfzustand),
    //     `sessionName` (Identitaet → Stand verwerfen), `klaraS4Verwerfen` (Logout → verwerfen).
    //   Gemessen: tests/m5-bild-im-panel/bild-vorschlag-mounted.test.ts (16 Faelle).
    //
    // JOB 3096 KONFLIKTRUNDE 1 (07.09.2026) — `git rebase main` traf mit der JOB-3096-Kette (M5,
    // Bildblock oben) auf die inzwischen auf main gelandete JOB-3094-Kette (KA7, Konfliktkarte
    // oben, PIN 241dde4e…). BEIDE SEITEN BLEIBEN INHALTLICH ERHALTEN: der KA7-Konfliktkarten-Block
    // aus JOB 3094 UND der M5-Bildblock aus JOB 3096 stehen nebeneinander in der zusammengefuehrten
    // Datei. Kein Markup, kein Skript und kein Woerterbuchschluessel einer Seite wurde entfernt, um
    // die andere Seite zu erhalten. Der Pin unten ist der frisch aus der zusammengefuehrten Datei
    // gerechnete Hash, kein uebernommener Wert einer Seite.
    //
    // JOB 3096 RUNDE 2 (07.09.2026, 56ebdf6b… -> 29c03b18…): NUR ZWEI NIEDERLAENDISCHE WOERTERBUCH-
    // WERTE GEAENDERT — `m5BildTitel`/`m5BildLeer` (nl) sagen „nagekeken {zeit}" statt
    // „gecontroleerd {zeit}", weil die Wortliste der Word-Flaeche (tests/i18n/mega35-word-wortliste)
    // „gecontroleerd" als Zusage-Wort verbietet (dieselbe Loesung wie 3092/3094: EN/NL ohne das
    // Wort, DE „(geprueft <Zeit>)" als registrierte Vorgangsaussage). Kein Markup, kein Skript,
    // kein Abrufziel, kein Manifest geaendert. KEIN Sideload noetig.
    //
    // JOB 3174 KONFLIKTRUNDE 1 (07.09.2026, 29c03b18… -> f7408633…) — `git rebase main` traf mit
    // der JOB-3174-Kette (M4b, drei Nachtraege am KA7-Block oben: Doppelung, wiedergeoeffneter
    // Entwurf, Zeitprobe) auf die inzwischen auf main gelandete JOB-3096-Kette (M5, Bildblock,
    // Kommentar direkt oben). BEIDE SEITEN BLEIBEN INHALTLICH ERHALTEN: der M4b-Nachtrag aus JOB
    // 3174 UND der M5-Bildblock aus JOB 3096 stehen nebeneinander in der zusammengefuehrten Datei;
    // git hat taskpane.html selbst konfliktfrei zusammengefuehrt (nur der Pin-Kommentar hier war
    // strittig). Kein Markup, kein Skript und kein Woerterbuchschluessel einer Seite wurde entfernt,
    // um die andere Seite zu erhalten. Der Pin unten ist der frisch aus der zusammengefuehrten Datei
    // gerechnete Hash, kein uebernommener Wert einer Seite.
    // JOB 3174 RUNDE 5 (BEN R4, Korrekturpflicht 1) — DER PIN WANDERT EIN LETZTES MAL IN DIESEM
    // JOB. VORHERHASH taskpane.html:
    // `378b3fb4f48fc52c37907cecf59af35d5f4a0d0ecec223e61b6e3ed7d10b69e4`.
    // Auslieferungsfolgen bewusst geprueft: geaendert wurde NUR der Kurzstatus am Entwurf
    // (#ka7-einreich-hinweis) in der Lage „leer" — er machte aus JEDEM leeren Lauf „Kein
    // Widerspruch · HH:MM", auch wenn null Quellen vorgelegt waren (die Route meldet dann
    // `gelaufen: true, kandidaten: 0`) oder nur der Anfang der Markierung geprueft wurde
    // (`gekuerzt`). Das war eine Sachauskunft ueber einen Bestand, den niemand befragt hat.
    // Jetzt traegt der Kurzstatus dieselbe Dreiteilung wie die Karte seit JOB 3094
    // (ka7LeerOhneQuelle / ka7LeerGekuerzt / ka7Leer): „Keine Vergleichsquelle · HH:MM",
    // „Teil geprueft · kein Widerspruch · HH:MM", „Kein Widerspruch · HH:MM". ZWEI
    // Woerterbuchschluessel je Sprache dazu (ka7EntwurfOhneQuelle,
    // ka7EntwurfOhneWiderspruchTeil), beide als BESCHRIFTUNG unter 40 Zeichen in DE/EN/NL
    // (P17e). KEIN neues Abrufziel (M7 bleibt 13), kein Markup, kein Stil, kein Manifest, keine
    // CSP, kein neues Recht, kein Speicherweg und keine geaenderte Nutzlast — es wird nur MEHR
    // aus dem ohnehin gehaltenen Stand (`kandidaten`, `gekuerzt`) gelesen. Ein installiertes
    // Add-in braucht KEIN erneutes Sideload; es holt die Datei beim naechsten Oeffnen frisch.
    // Gemessen: konfliktkarte-mounted P17f (null Quellen, Karte UND Entwurf, DE/EN), P17g
    // (gekuerzt), P17b (der unveraenderte Regelfall), P17e (Laengen in DE/EN/NL).
    // JOB 3174 RUNDE 6 (Tor R5 rot an tests/i18n/mega35-word-wortliste.test.ts:149) — DER PIN
    // WANDERT WEGEN EINES EINZIGEN WORTES. VORHERHASH taskpane.html:
    // `902b7d0d05da4a0879eb17c983536cf54fde5b0357e971021f55b33853c757bf`.
    // Auslieferungsfolgen bewusst geprueft: geaendert wurde AUSSCHLIESSLICH der deutsche Wortlaut
    // EINES Schluessels — ka7EntwurfOhneWiderspruchTeil, „Teil geprueft · kein Widerspruch · {zeit}"
    // → „Teilabgleich · kein Widerspruch · {zeit}". Grund: die Word-Flaeche haelt seit AUFTRAG-mega35
    // B einen Wortlistenvertrag — „geprueft"/„gesichert" (und die englischen/niederlaendischen
    // Entsprechungen) stehen NUR im Einstufungshinweis und in den dort EINZELN benannten
    // Vorgangsaussagen (ka7Leer, ka7LeerGekuerzt, ka7LeerOhneQuelle, captureDub*, m5Bild*). Die
    // Ausnahmeliste wurde NICHT verlaengert und die Schutzregel NICHT aufgeweicht: die Beschriftung
    // sagt dasselbe mit dem eigenen Wort dieses Blocks („Abgleich", ka7Label). EN und NL sind
    // unveraendert (ihre verbotenen Woerter sind „verified"/„assured" bzw.
    // „gecontroleerd"/„gewaarborgd" — keines kam vor). KEIN Verhalten, KEINE Weiche, KEINE Zahl,
    // KEIN Abrufziel, KEIN Markup, KEIN Stil, KEIN Manifest, KEINE CSP, KEIN Speicherweg geaendert;
    // ein installiertes Add-in braucht KEIN erneutes Sideload.
    // Gemessen: mega35-word-wortliste (vorher rot mit genau diesem Schluessel, danach gruen),
    // konfliktkarte-mounted P17g (neuer Wortlaut) und P17e (Laenge UND Wortliste in DE/EN/NL).
    //
    // JOB 3243 KONFLIKTRUNDE 1 (08.09.2026, f7408633… -> 8a2c5e06…) — `git rebase main` traf mit
    // der JOB-3243-Kette (M3c-UI, Quellenfund-Block im Panel) auf die inzwischen auf main gelandete
    // JOB-3174-Kette (M4b, KA7-Kurzstatus-Nachtraege oben, PIN aceff50d…). BEIDE SEITEN BLEIBEN
    // INHALTLICH ERHALTEN: der M4b-Nachtrag aus JOB 3174 UND der M3c-Quellenfund-Block aus JOB 3243
    // stehen nebeneinander in der zusammengefuehrten Datei; git hat taskpane.html selbst
    // konfliktfrei zusammengefuehrt (nur der Pin-Kommentar hier war strittig). Kein Markup, kein
    // Skript und kein Woerterbuchschluessel einer Seite wurde entfernt, um die andere Seite zu
    // erhalten. Der Pin unten ist der frisch aus der zusammengefuehrten Datei gerechnete Hash, kein
    // uebernommener Wert einer Seite.
    // JOB 3243 · M3c-UI (08.09.2026, 29c03b18… -> 6907b9ca…) — AUSLIEFERUNGSFOLGEN GEPRUEFT, BEVOR
    // DER PIN WANDERTE. Geaendert wurden Markup, Stilregeln, Woerterbuch und EIN Skriptblock:
    //   · Markup: EIN neuer Kasten `#quellenfund-block` (Stand, Liste) INNERHALB des vorhandenen
    //     `#bestand-block`, verborgen bis zum ersten erfolgreichen Lauf. Keine neue KW-Marke (das
    //     3093-Markup traegt aus demselben Grund keine — marken-skelett misst genau solche
    //     Bruchstuecke). In der Ruhe steht kein Zeichen mehr im Bild als vorher, deshalb bleiben die
    //     Textmesser K1/K2 unberuehrt.
    //   · Stil: `#quellenfund-*`-Regeln im Muster der `#bestand-*`-Regeln daneben — Rahmen
    //     `--hairline` auf `--surface`, Gedaempftes ueber die vorhandene Klasse `muted`, KEINE
    //     eigene `color` und kein Farbliteral (mega43 B1 kann eine Laufzeitklasse keiner Flaeche
    //     zuordnen; deshalb dieselbe Zurueckhaltung wie bei JOB 3093).
    //   · Woerterbuch: sieben neue Schluessel je Sprache (`quellenfund*`), keiner entfernt. Sie
    //     sagen „durchsucht" statt „geprueft" — die Wortliste der Word-Flaeche verbietet „geprueft"
    //     ausserhalb ihrer eingetragenen Schluessel (tests/i18n/mega35-word-wortliste.test.ts), und
    //     die Datei ist nicht Zielpfad von JOB 3243. Dieselbe Loesung wie JOB 3096 R2 fuer NL.
    //   · Skript: `w6Quellenfundlage`/`w6Zahl` im Block KW-KLARA-W6-CHECKTEXT sowie
    //     `quellenfundZeichnen` und die zwei gemeinsamen Zeilenbauer `bestandZeile`/`bestandKnoten`
    //     im Block KW-N1-BESTAND — KEIN neuer Block, KEINE neue Marke.
    //   · ABRUFZIELE UNVERAENDERT: kein neues `fetch(`. Der bestehende Ruf an `/api/check-text`
    //     traegt jetzt zusaetzlich `nichtEingestuft: true` im Rumpf und — NUR bei vollstaendiger
    //     Klara-Bindung — die drei bereits vergebenen Kopfzeilen x-klara-session/-instance/
    //     -document, die dasselbe Fenster an `/api/klara/*` seit W1-KLARA-KOPF-CONSENT-06 schickt.
    //     Same-Origin, dieselbe Sitzung, kein neuer Fremd-Ursprung, keine CSP-Folge.
    //   KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht: ein installiertes Add-in braucht
    //   deshalb KEIN erneutes Sideload; es holt die Datei beim naechsten Oeffnen frisch vom Server.
    //
    // JOB 3243 RUNDE 2 (08.09.2026, 8a2c5e06… -> 0196530d…) — DER ZEILENDECKEL DES INLINE-SKRIPTS.
    // Tor R1 war rot an `tests/klara-zerlegung/schnittflaechen.test.ts` B3 („expected 10660 to be
    // less than 10500"). Geaendert wurde deshalb NUR die Bauform, nicht die Zusage:
    //   · der eigene Ein-/Ausklapp-Knopf ist entfallen; `#quellenfund-block` IST jetzt ein
    //     `<details open>` mit der Lagezeile als `<summary>` — nativ, ohne eigenen Zustand, ohne
    //     Klick-Rueckruf und ohne die zwei Woerterbuchschluessel dafuer. Ohne Treffer blendet das
    //     Attribut `data-leer` den Griff per Stilregel aus (kein Dreieck ohne Inhalt).
    //   · die Trefferzeilen BEIDER Listen entstehen jetzt in EINER Funktion (`bestandZeile`), die
    //     Textknoten in `bestandKnoten` — vorher zwei Kopien mit je eigener Pruefstand-Pille und
    //     eigenem Weg in die Bibliothek. Deshalb entfallen auch `quellenfundOeffnen` (der Sprung
    //     nutzt `bestandOeffnen`, EIN Wortlaut), `quellenfundGanz` und `quellenfundTeilOhneZahl`.
    //   Kein Endpunkt, kein Recht, keine Nutzlast und kein Manifest beruehrt; die Klassennamen
    //   `quellenfund-satz`/`-deckung` heissen jetzt `quellenfund-titel`/`-fakten` (Stilregeln
    //   mitgefuehrt). Gemessen: B3 gruen bei 10494 Zeilen (6 unter der Schranke — P11/JOB 3227,
    //   der Schnitt, ist damit faellig), tests/m3-dokumentweg-panel (24 Faelle in zwei Dateien).
    //
    // JOB 3243 RUNDE 3 (08.09.2026, 0196530d… -> ee6ff2ac…) — BENs KORREKTURPFLICHT 1, EINE ZEILE
    // LOGIK. `w6Quellenfundlage` ersetzte ein FEHLENDES oder falsch typisiertes `sourceHits` durch
    // `[]` und gab es mit `gelaufen: true` als durchsuchte Abwesenheit aus — „Kein Quellenfund im
    // durchsuchten Bestand." ueber einer Liste, die der Server nie geliefert hat. Jetzt verlangt die
    // Bedingung BEIDES (`gelaufen === true` UND `Array.isArray(sourceHits)`); alles andere heisst
    // „nicht durchsucht". KEINE Anzeige-, Markup-, Stil- oder Woerterbuchaenderung, kein Endpunkt,
    // kein Recht, keine Nutzlast, kein Manifest — ein installiertes Add-in braucht KEIN Sideload.
    // Das Inline-Skript schrumpft dabei um eine Zeile (10494 -> 10493, B3 weiter gruen).
    // Gemessen: tests/m3-dokumentweg-panel (29 Faelle; Q9a vier Formen des fehlenden Arrays, Q9b
    // die Kalibrierung dagegen), vor der Korrektur woertlich rot mit
    // „expected 'Kein Quellenfund im durchsuchten Best…' to be 'Quellenfund nicht durchsucht.'".
    // ============================================================================================
    // JOB 3281 · WORD-VERGLEICH (08.09.2026, ee6ff2ac… -> s. PIN unten) — AUSLIEFERUNGSFOLGEN
    // BEWUSST GEPRUEFT, BEVOR DER PIN WANDERTE.
    // ============================================================================================
    //   · WAS SICH AENDERT: NUR das Skript, EIN neuer Block `KW-WORDVERGLEICH-START` …
    //     `KW-WORDVERGLEICH-END` am Ende des Inline-Skripts (hinter `KW-KA7-KONFLIKT-END`). KEIN
    //     Markup-Byte und KEIN Stil-Byte geaendert: die neuen Elemente entstehen im Skript
    //     (`#wv-block` mit `#wv-btn`, `#wv-abbrechen`, `#wv-entfernen` und der Karte `#wv-karte`
    //     mit `#wv-stand`, `#wv-legende`, `#wv-liste`), eingehaengt hinter `#ka7-block` — genau
    //     die Bauform, die JOB 3094 fuer die Konfliktkarte gewaehlt hat. Der Block ist verborgen,
    //     solange nicht angemeldet, kein Word-Dokument offen oder die Ruhe nicht im Bild ist; die
    //     Textmesser K1/K2 sehen ihn deshalb nicht.
    //   · WOERTERBUCH: 38 neue Schluessel je Sprache (`wv*`, Tabelle WV_TEXTE, eingehaengt wie
    //     KA6_MEMO_TEXTE/KA7_TEXTE); KEIN bestehender Schluessel geaendert oder entfernt. Sie
    //     sagen „abgeglichen"/„durchsucht" statt „geprueft" — die Wortliste der Word-Flaeche
    //     (tests/i18n/mega35-word-wortliste.test.ts) verbietet das Wort ausserhalb ihrer
    //     eingetragenen Schluessel, und die Ausnahmeliste dort wurde NICHT verlaengert.
    //   · ABRUFZIELE UNVERAENDERT: KEIN neues `fetch(`. Der Absatzvergleich laeuft ueber den
    //     BESTEHENDEN Uebersetzer `w6DublettenAusCheckText` mit einem hereingereichten `fetchFn`
    //     (`fetch.bind(window)`, wie `bestandPruefen` es seit JOB 3093 tut) — same-origin,
    //     dieselbe Sitzung, derselbe Endpunkt `/api/check-text`, dieselben Kopfzeilen.
    //     mega69-klara-merkmale M6/M7 bleiben gruen (gemessen).
    //   · GEAENDERTE NUTZLAST, UND ZWAR NUR IM FREIGEGEBENEN FALL: der Rumpf traegt zusaetzlich
    //     `want: "deep"` — AUSSCHLIESSLICH dann, wenn `ka7ExterneKi()` „erlaubt" sagt, also die
    //     KA4-Einwilligung fuer DIESES Dokument vorliegt und die Ausfuehrung freigegeben ist.
    //     Das ist derselbe eine Riegel, den JOB 3094 fuer den Konfliktabgleich gebaut hat; ein
    //     zweiter waere ein zweiter Weg zur selben Entscheidung. Ohne Einwilligung geht der Rumpf
    //     zeichengleich wie der Bestandsweg hinaus, und das Fenster sagt, dass Rot in diesem Lauf
    //     nicht entstehen kann. FREQUENZ: ein Abruf je nicht-leerem Absatz, nur auf Klick,
    //     abbrechbar; kein Intervall, kein Autostart, kein Speicher.
    //   · WORD-SEITIG NEU, benannt: `Word.run` mit `body.paragraphs`,
    //     `load("items/text,items/font/highlightColor")`, dem SCHREIBEN von
    //     `paragraph.font.highlightColor` und `paragraph.getRange().select()`. Das ist WordApi 1.1
    //     bzw. 1.2 (`Paragraph.getRange`) — keine neue Berechtigung: `ReadWriteDocument` besteht
    //     seit dem Einfuegeweg. Es wird KEIN Text geschrieben: kein `insertText`, kein
    //     `insertHtml`, kein `insertParagraph`, kein `insertOoxml`, kein `setSelectedDataAsync`
    //     (gehalten von tests/app/word-addin-wortvergleich.test.ts V2 an den Bytes).
    //   · FARBEN: die vier Word-Namen `BrightGreen`/`Yellow`/`Turquoise`/`Red`. KEIN Farbliteral,
    //     kein `rgb(`, keine neue Stilregel — die Werkbank-Palette (mega43 B1) bleibt die eine
    //     Farbwahrheit, und die Legende nennt die Farbnamen als Text statt ein Kaestchen zu malen,
    //     das ohnehin nicht traefe, was Word im Dokument setzt.
    //   · IDENTITAET EINES ABSATZES ist (Text-Hash + Vorkommen), nicht der Hash und nicht die
    //     Nummer: zwei woertlich gleiche Absaetze sind zwei Posten und zwei Stellen. Geschrieben
    //     wird nur auf einen Absatz OHNE Hervorhebung oder mit genau der Farbe, die Klara selbst
    //     zuletzt gesetzt hat — geprueft beim Lesen UND unmittelbar vor dem Schreiben. Gemerkt wird
    //     erst nach bestaetigtem `sync`; scheitert er, steht keine Farbe im Dokument, und das Panel
    //     bietet auch keine Ruecknahme dafuer an (Ben 08.09.).
    //   · KEIN Manifest, KEIN neuer Endpunkt, KEIN neues Recht (`ko.read` wie alle Klara-Wege),
    //     KEINE geaenderte CSP, kein Fremd-Ursprung, kein `localStorage`/Cookie.
    //   · Fuer ein installiertes Add-in: KEIN erneutes Sideload noetig; es holt die Datei beim
    //     naechsten Oeffnen frisch vom Server. Ein AELTERER Server ohne `sourceHits`/
    //     `konfliktpruefung` fuehrt nicht zu falschen Farben: fehlende Felder heissen „nicht
    //     durchsucht"/„nicht abgeglichen" und damit KEINE Farbe (Faelle B2/B5).
    //   · GEMESSEN: tests/word-vergleich (32 Faelle in drei Dateien),
    //     tests/app/word-addin-wortvergleich.test.ts (6 Faelle), tests/i18n/mega35-word-wortliste,
    //     tests/app/mega43-klara-werkbank-palette, tests/app/mega69-klara-merkmale,
    //     tests/klara-zerlegung (marken-skelett, probeschnitt), tests/m3-dokumentweg-panel,
    //     tests/design/zielbild-k1-kein-erklaertext (Ruhe weiterhin 50 Zeichen — der Block ist
    //     verborgen), tests/design/zielbild-k2-kein-erklaertext, tests/design/k1-/k2-funktionsinventar.
    //
    // JOB 3281 · RUNDE 3 (08.09.2026) — AUSLIEFERUNGSFOLGEN ERNEUT GEPRUEFT, BEVOR DER PIN WANDERTE.
    // VORHERHASH taskpane.html: `0c5340595b47dc26455380bbd34a8ec762e59a4486560e2fba0438fe0606702a`.
    //
    // ANLASS: Codex-Vorpruefung R2 (`4f344967`) hatte statisch zwei Stellen abgeleitet, an denen
    // ein UEBERHOLTER Lauf den Zustand des LAUFENDEN Laufs anfasst. Beide sind jetzt gemessen und
    // geschlossen (tests/word-vergleich/zwei-laeufe-und-spaete-antworten.test.ts, 6 Faelle).
    //
    // GEAENDERT WURDEN AUSSCHLIESSLICH FUENF STELLEN IM VERGLEICHSBLOCK — keine neue Flaeche, kein
    // neues Wort, kein neues DOM-Element, kein neues Abrufziel:
    //   · die drei Ausstiege eines ueberholten Laufs (`wvPruefen`-Rueckruf, `wvSchritt`, die
    //     `.then`-Kette am Absatz) setzen `wvLaeuft` nicht mehr auf `false`, sondern steigen stumm
    //     aus. Die Fahne gehoert dem Lauf mit der aktuellen Kennung; jede Stelle, die `wvLauf`
    //     erhoeht, setzt sie selbst.
    //   · `wvSchluss` prueft die Kennung VOR dem Raeumen der Fahne (vorher danach).
    //   · `wvSchluss` zeichnet, BEVOR der Schreiblauf beginnt. Ohne das stand im Fenster weiter
    //     „Absatz n von n …" mit sichtbarem Abbruchknopf, solange Word den bestaetigenden `sync`
    //     nicht zurueckgab — ein Knopf, der nichts mehr tut. Sichtbare Folge: nach dem letzten
    //     Absatz wird der Startknopf frei und der Abbruchknopf verschwindet, auch wenn die Farben
    //     noch unterwegs sind; scheitert der Schreiblauf, ergaenzt `wvFarbenFehler` den Standsatz
    //     wie bisher.
    //   · `wvSchreibfehler` wird nur noch fuer den AKTUELLEN Lauf gesetzt. Die Merkliste dagegen
    //     bleibt ungefiltert: was Word bestaetigt hat, steht wirklich im Dokument und muss
    //     zuruecknehmbar bleiben, auch wenn inzwischen ein neuer Vergleich laeuft.
    //
    // KEIN neuer Woerterbuch-Schluessel, KEIN neues `fetch(`, KEIN Manifest, KEINE geaenderte CSP,
    // kein neues Recht, keine neue Word-API. Die Frequenz bleibt „ein Abruf je nicht-leerem
    // Absatz, nur auf Klick". Ein installiertes Add-in braucht KEIN erneutes Sideload.
    // GEMESSEN: tests/word-vergleich (38 Faelle in vier Dateien), tests/app/word-addin (150 Faelle
    // in sieben Dateien), Waechterlauf (Inventar, Inhalts-Pin, Aufrufer, Theme, Frische, Tor).
    //
    // JOB 3281 · RUNDE 4 (08.09.2026) — AUSLIEFERUNGSFOLGEN ERNEUT GEPRUEFT, BEVOR DER PIN WANDERTE.
    // VORHERHASH taskpane.html: `77cc166fc1d5c4f5e9b88e0a58efea9abb1be95f4fe25355a1d37372989c9e71`.
    //
    // ANLASS: Ben (Pruefung der Runde 3) hat einen Ablauf gemessen, den Runde 3 offen liess. Die
    // Runde-3-Absicherung greift, WENN der bestaetigende Schreib-`sync` haengt — da stehen Klaras
    // Farben schon im Dokument. Einen `sync` FRUEHER, beim Laden der Absaetze fuers Faerben, gab es
    // keine Kennungspruefung: haengt er, laeuft der naechste Vergleich vollstaendig durch, und der
    // ueberholte Lauf faerbt danach seine Kategorien darueber. Sichtbar wurde das als Widerspruch
    // zwischen Fenster („Ähnlich") und Dokument („Turquoise").
    //
    // GEAENDERT WURDE GENAU EINE STELLE: der Schreib-Rueckruf in `wvSchluss` steigt stumm aus, wenn
    // die Laufkennung nicht mehr die aktuelle ist — vor dem ersten Schreibvorgang. Ein ueberholter
    // Lauf schreibt damit nichts und merkt nichts vor. Sichtbare Folge: die Farben des LAUFENDEN
    // Vergleichs bleiben stehen, und das Fenster beschreibt weiterhin genau das Dokument.
    //   · Die Merkliste bleibt weiter ungefiltert (Runde 3): was Word einem fertigen Lauf bestaetigt
    //     hat, steht wirklich im Dokument und bleibt zuruecknehmbar — das ist die Gegenrichtung und
    //     wird eigens gemessen (Z6, Z7b).
    //
    // KEIN neues DOM-Element, KEIN neues Wort, KEIN neuer Woerterbuch-Schluessel, KEIN neues
    // `fetch(`, KEIN Manifest, KEINE geaenderte CSP, kein neues Recht, keine neue Word-API. Die
    // Frequenz bleibt „ein Abruf je nicht-leerem Absatz, nur auf Klick". Ein installiertes Add-in
    // braucht KEIN erneutes Sideload.
    // GEMESSEN: tests/word-vergleich (40 Faelle in vier Dateien), tests/app/word-addin (150 Faelle
    // in sieben Dateien), Waechterlauf (Inventar, Inhalts-Pin, Aufrufer, Theme, Frische, Tor).
    //
    // JOB 3366 · KI-FRAGMENT-SICHTBAR (09.09.2026) — AUSLIEFERUNGSFOLGEN GEPRUEFT, BEVOR DER PIN
    // WANDERTE. VORHERHASH taskpane.html: `a83c661194ca024ba9501d0a21af428a5f9aff1e7ad04a3b7d8a297216bda77b`.
    //
    // ANLASS: Eine am Token-Limit abgeschnittene Modellantwort sah im Panel aus wie eine ganze.
    // Der Abbruch war seit JOB 3239 serverintern bekannt und stand seit JOB 3276 R3 als Lauf-Spur
    // fuer den Aufrufer bereit — nur las ihn auf dem Antwortweg niemand.
    //
    // GEAENDERT WURDE IM FENSTER GENAU DREIERLEI:
    //   · EIN neues DOM-Element `<p id="ask-fragment">` in der Antwortkarte, Geschwister des
    //     Ungeprueft-Satzes, mit zwei Stilregeln (Masse wie `#ask-ungeprueft`, Farbe `--warn-text`).
    //   · EIN neuer Woerterbuch-Schluessel `askFragment` in ALLEN DREI Sprachen (de/en/nl),
    //     wortgleich mit `ai.truncated.hint` der Web-App.
    //   · `performAsk` LIEST das bereits gesendete Antwortfeld `result.abgeschnitten` (Beweislast-
    //     Umkehr wie bei `citedSources`: nur ein Objekt mit nichtleerem `finishReason` gilt) und
    //     traegt es am Ergebnis NUR MIT, wenn es eine Tatsache ist (`{ abgeschnitten: true }`, sonst
    //     gar kein Feld — der Spiegel-Vertrag mit `apps/web/src/lib/wordAddin.ts` bleibt damit an
    //     jedem nicht abgeschnittenen Ergebnis gleich, word-addin-ask.test.ts Teil 3).
    //     `renderAskFragment` fuellt bzw. leert das Element — gerufen aus renderAskOutcome,
    //     setLang und resetAskResult, also an denselben drei Stellen wie renderAskUngeprueft.
    //
    // KEIN neues `fetch(`, KEIN neues Abrufziel, KEIN geaenderter Anfragekoerper (der Weg bleibt
    // `POST /api/ask` mit `mode: "retrieval-only"`), KEIN Manifest, KEINE geaenderte CSP, kein
    // neues Recht, keine neue Word-API, keine geaenderte Frequenz. Die Nutzlast waechst um NICHTS;
    // gelesen wird ein Feld, das der Server ohnehin sendet. Ein installiertes Add-in braucht KEIN
    // erneutes Sideload — der Stempel-Mechanismus traegt die neue Fassung wie bisher.
    // GEMESSEN: tests/ki-fragment-sichtbar (35 Faelle in drei Dateien, davon 11 am geladenen
    // Fenster), Waechterlauf (Inventar, Inhalts-Pin, Aufrufer, Theme, Frische, Tor).
    //
    // JOB 3438 · BILDVERKLEINERUNG-SICHTBAR (09.09.2026) — AUSLIEFERUNGSFOLGEN GEPRUEFT, BEVOR DER
    // PIN WANDERTE. VORHERHASH taskpane.html: `01a4c863dbf90a84008a61242dbf18fbbd9232589941064ea378a2a348d4c820`.
    //
    // ANLASS: Der Server verkleinert die Bilder eines .docx-Imports seit JOB 3400 und nennt in
    // DERSELBEN Antwort `imagesShrunk`, `imagesKeptOriginal` und `imageSkipReasons`
    // (capture-routes.ts:1066-1068). Das Fenster las davon nichts — es fuetterte den zweiten Platz
    // von `bilderSatz` buchstaeblich mit `0`. Pedi konnte im Panel nicht sehen, WARUM ein Bild
    // unscharf oder im Original blieb.
    //
    // GEAENDERT WURDE IM FENSTER GENAU DREIERLEI:
    //   · 13 neue Woerterbuch-Schluessel in ALLEN DREI Sprachen (de/en/nl): `sendImagesShrunk*`
    //     (verkleinert), `sendImagesKept*` (uebersprungen, weil nichts zu tun war),
    //     `sendImagesNotShrunk*` (uebersprungen, Zusammensetzung unbekannt), `sendImagesFailed*`
    //     (Ausfaelle MIT ihrer Zahl), `sendImagesUnknown*` (ein Grund, den diese Fassung nicht
    //     kennt) und die drei Ausfallwoerter — je Einzahl und Mehrzahl (JOB-2551-Regel).
    //     KEIN vorhandener Schluessel wurde umformuliert; `sendImages*` (Verlusthinweis) bleibt
    //     woertlich und im Verhalten unveraendert.
    //   · Fuenf neue reine Rechenfunktionen im Skript (`bildZahl`, `bildgruendeZerlegen`,
    //     `bildbilanzTeile`, `docxBilderBefund`, `bilderText`, dazu die Listenhilfe
    //     `kopieMitListe`) plus zwei Datentabellen (`BILD_AUSFALL_WORTE`, `BILD_ERFOLG_GRUENDE`).
    //     Sie LESEN nur, was der Server ohnehin sendet.
    //   · Zwei Anzeigestellen rufen statt `t(bilder.key, bilder.vars)` jetzt `bilderText(bilder)`
    //     (`renderCapture`, `zeigeEntwurfsErgebnis`) — derselbe Satz fuer einen Befund ohne
    //     `teile`, also byte-gleich fuer den Auswahl-/Word.run-Weg.
    // KEIN neues DOM-Element, KEINE neue Flaeche, KEINE neue Stilregel: die Auskunft erscheint in
    // der VORHANDENEN Zeile `#capture-bilder-satz`.
    //
    // RUNDE 2 (BEN) HAT ZUSAETZLICH `t()` BERUEHRT — die EINE Textstelle des ganzen Fensters:
    // der Wert wird jetzt ueber eine Ersatzfunktion statt ueber eine Ersatz-ZEICHENKETTE eingesetzt.
    // AUSLIEFERUNGSFOLGE GEPRUEFT: fuer jeden Wert ohne `$` ist das Ergebnis BYTEGLEICH (nur die
    // Muster `$&`, `$$`, `` $` `` und `$'` verhielten sich vorher anders — und die kamen erst mit
    // den durchgereichten Server-Kennungen dieses Jobs ueberhaupt vor). Der ganze Bestand an
    // Panel-Tests (tests/app, tests/m3-dokumentweg-panel, tests/klara-zerlegung, tests/i18n) laeuft
    // unveraendert gruen, also aendert die Stelle fuer bestehende Texte nichts.
    //
    // KEIN neues `fetch(`, KEIN neues Abrufziel, KEIN geaenderter Anfragekoerper (der Weg bleibt
    // `POST /api/drafts/from-docx` mit `{name, data, title?}`), KEIN Manifest, KEINE geaenderte CSP,
    // kein neues Recht, keine neue Word-API (`getFileAsync` war schon da), keine geaenderte
    // Frequenz. Die Nutzlast waechst um NICHTS; gelesen werden drei Felder, die der Server seit
    // JOB 3400 ohnehin sendet. Ein installiertes Add-in braucht KEIN erneutes Sideload — der
    // Stempel-Mechanismus traegt die neue Fassung wie bisher.
    // GEMESSEN: tests/addin-bildbilanz (33 Faelle in zwei Dateien, davon 27 am geladenen Fenster),
    // tests/app/job2923 B4/B5 am ECHTEN Antwortkoerper der Route, Waechterlauf (Inventar,
    // Inhalts-Pin, Aufrufer, Theme, Frische, Tor).
    //
    // JOB 3506 · K2b-OBERFLAECHENRESTE (10.09.2026) — AUSLIEFERUNGSFOLGEN GEPRUEFT, BEVOR DER PIN
    // WANDERTE. VORHERHASH taskpane.html: `be4c3b38cf03104bd08a3ab61cd561202ce7cd284e90adbb20984dcc297a7fcc`.
    //
    // ANLASS: die benannte Restschuld von JOB 3057 (K2). Dessen RUECKGABE (archiv/3057/runde-4)
    // nennt sie woertlich — „das ‚?‘-Menue der Erfassen-Flaeche sitzt weiterhin in der Flaeche
    // (nicht hinter dem Zahnrad)" und „‚?‘-Menue in den Zahnrad-Ort ziehen (jetzt moeglich, eigener
    // Auftrag, weil K1-Flaeche)". Dazu der OFFENE Wert `Z.52 margin-top: auto`, damals mit dem
    // Grund „setzt eine Flex-Spalte von Fensterhoehe voraus (K1, JOB 3056 — nicht auf main)".
    // K1 ist gelandet; beide Bedingungen sind erfuellt.
    //
    // GEAENDERT WURDE IM FENSTER GENAU VIERERLEI — Markup, Stil, EIN Woerterbuchschluessel je
    // Sprache und zwei Skriptstellen, die nur DOM anfassen:
    //   · MARKUP, UMZUG STATT NEUBAU: `#capture-mehr-btn` und `#capture-mehr` sind aus
    //     `#section-capture` ENTFERNT (nicht verborgen). Die vier Erklaersaetze stehen jetzt in
    //     einer neuen Gruppe `#einst-erfassen` in `#kw-einstellungen`, in der VORHANDENEN Bauform
    //     (.einst-kicker + .einst-gruppe + .einst-zeile). Die vier Elemente ziehen mit IHREN
    //     Kennungen und IHREN `data-t`-Schluesseln um (`#capture-hinweis-umfang` sendHint,
    //     `#capture-bilder-hinweis` sendImagesNote samt Link und Inline-Farben BYTEGLEICH,
    //     `#capture-hinweis-pruefung` sendReviewNote, `#capture-hinweis-seiten` scopePagesHint).
    //     Kein Satz wurde umformuliert, keiner entfernt, keiner kopiert: jeder steht genau einmal.
    //     Die Gruppe steht NACH „Konto" und VOR dem Stand-Fuss — die ersten Kinder von
    //     `#kw-einstellungen` (Gruppe 1, der Admin-Kicker) bleiben, was sie waren.
    //   · STIL: `#section-capture` wird zur Flex-Spalte von Fensterhoehe (`display: flex;
    //     flex-direction: column; flex: 1 1 auto; min-height: 0` — dieselben Angaben, die
    //     `#section-ask` und `#kw-einstellungen` seit JOB 3056 tragen), und
    //     `#capture-dokument-link` bekommt `margin: auto 0 0` (die Bauform von `#kw-stand-zeile`).
    //     Die vier `#capture-mehr*`-Regeln sind entfallen, `#einst-erfassen p { margin: 0 }` kommt
    //     dazu. Die Regel `#capture-bilder-hinweis` ist UNVERAENDERT (tools/design-vergleich liest
    //     sie), ebenso Polsterung, Achse, Groesse und Tinte des Dokumentlinks (Z.52).
    //   · WOERTERBUCH: `captureMehr` (das aria-label des entfallenen Knopfs) ist in allen drei
    //     Sprachen GELOESCHT — kein toter Rest; `einstErfassenKicker` kommt in allen drei Sprachen
    //     dazu (der EINZIGE neue Wortlaut dieses Jobs). Netto: unveraendert viele Schluessel.
    //   · SKRIPT: die Klapp-Behandlung des „?"-Knopfs und seine `aria-label`-Zeile in
    //     `renderStatics` sind entfallen; `ka7EinreichHinweisElement` haengt den langen KA7-Satz
    //     (`#ka7-mehr-hinweis`) statt an `#capture-mehr` an `#einst-erfassen` — derselbe Satz,
    //     derselbe Schluessel `ka7EntwurfMenuText`, dieselbe Sprachfuehrung ueber `data-t`.
    // KEIN neues `fetch(`, KEIN neues Abrufziel, KEIN geaenderter Anfragekoerper, KEIN Manifest,
    // KEINE geaenderte CSP, kein neues Recht, keine neue Word-API, keine geaenderte Frequenz, kein
    // neuer Fremd-Ursprung: dieser Job fasst ausschliesslich die Oberflaeche an. Der Sendeweg und
    // die Zustaende des Dokumentlinks (ohne Word gesperrt, ohne Markierung frei, sendOffline)
    // sind unveraendert und laufen unveraendert gruen. Ein installiertes Add-in braucht deshalb
    // KEIN erneutes Sideload — der Stempel-Mechanismus traegt die neue Fassung wie bisher.
    // NICHT GEMESSEN und hier ausdruecklich gesagt: echtes Word. Gemessen wurde in Chromium am
    // ausgelieferten Fenster und im jsdom.
    // GEMESSEN: tests/k2b-erfassen-reste (6 Faelle, am geladenen Fenster, mit Kalibrierung),
    // tests/design/zielbild-k2-erfassen (Fall G neu, Z.52 vom OFFENEN Posten zum scharfen Fall),
    // tests/design/zielbild-k2-kein-erklaertext (T1/T2/T4), tests/design/k2-funktionsinventar
    // (I3–I6 am neuen Ort), tests/design/zielbild-k1-einstellungen, Waechterlauf (Inventar,
    // Inhalts-Pin, Aufrufer, Theme, Frische, Tor).
    //
    // JOB 3512 · DEMO-FIRMEN-CI VERBRAUCHER (10.09.2026) — AUSLIEFERUNGSFOLGEN GEPRUEFT, BEVOR DER
    // PIN WANDERTE. VORHERHASH taskpane.html:
    // `c1ffc7958e403df1e7c413b4757e653fff5cfc835a9017d79bdf6b3840052f78`.
    //
    // ANLASS: Pedis Freigabe vom 10.09. („Setz es um", gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md).
    // Eine zentrale, vom Administrator umschaltbare Markenwahl wirkt in KLARWERK (JOB 3511), in
    // Klara/Word (hier) und in der Chrome-Erweiterung. Fuer Freitag ausdruecklich NUR Logo und
    // Markenfarben — kein Layout- und kein Funktionsumbau.
    //
    // GEAENDERT WURDE IM FENSTER GENAU VIERERLEI:
    //   · MARKUP: EIN Element kommt dazu — `<img id="kw-marke-logo" class="hidden" alt="">` in der
    //     bestehenden Gruppe `#kw-kopf-links`, NEBEN der Wortmarke „Klara" und nicht an ihrer
    //     Stelle. Es startet verborgen und OHNE `src`; ein leeres `src` waere ein Abruf auf die
    //     eigene Adresse. Keine Zeile des uebrigen Kopfes ist beruehrt.
    //   · STIL: eine neue Regel `#kw-marke-logo` (display/height/width, KEINE Farbe) und eine neue
    //     `:root`-Variable `--shadow-primary`. Der Wert dieser Variablen ist ZEICHENGLEICH der, der
    //     bis hierher direkt in `button.primary` stand (`0 2px 10px -2px rgba(232, 99, 10, 0.45)`);
    //     die Regel dort liest ihn jetzt ueber `var(--shadow-primary)`. Ohne aktive Firmen-CI ist
    //     der berechnete Wert also derselbe wie zuvor — mit ihr wandert der Knopfschein in die
    //     Markenfarbe mit, statt als zurueckgebliebenes Orange unter einem blauen Knopf zu stehen.
    //     Dieselbe Bauform und derselbe Name wie in `extensions/klara-browser/panel.css:67`.
    //   · WOERTERBUCH: KEIN neuer Schluessel, in keiner Sprache. Der Alternativtext des Logos
    //     („Advisor ICT solutions logo") ist eine Eigenschaft der Originaldatei, keine Uebersetzung;
    //     er steht als Zuordnung JE PROFIL im Skript (`KW_MARKE_ALT`), wie im Web
    //     (`apps/web/src/lib/brandTheme.ts`, BRAND_LOGO_ALT).
    //   · SKRIPT: ein Schnittmarkenpaar `KW-MARKE-START/END` mit sieben Funktionen
    //     (`kwMarkeKanaele`, `kwMarkeAbgetoent`, `kwMarkeGueltig`, `kwMarkeAnwenden`,
    //     `kwMarkeKennung`, `kwMarkeUebernehmen`, `kwMarkeHolen`) und ihrer Verdrahtung am
    //     Skriptende. Die Farben
    //     werden NICHT als zweiter Farbsatz hinterlegt, sondern zur Laufzeit auf die WURZEL
    //     geschrieben (`--brand`, `--brand-deep`, `--brand-text`, `--ink`, `--shadow-primary`).
    //     Ausschalten nimmt genau diese fuenf wieder weg — danach steht wieder exakt der Wert aus
    //     `:root`, und es bleibt keine Markenregel stehen, die noch matchen koennte.
    //     `--pos-*` und `--warn-*` werden nie angefasst: Bedeutung ist keine Marke.
    //
    // UND — die eigentliche Auslieferungsfolge — EIN NEUES ABRUFZIEL:
    //   `GET /api/branding` (JOB 3510, services/app/src/routes/branding-routes.ts:49).
    // Es ist SAME-ORIGIN auf derselben App-Domain, auf der dieses Aufgabenfenster liegt. KEIN
    // Manifest, KEIN neuer Fremd-Ursprung, KEINE geaenderte CSP (`connect-src 'self'` deckt es),
    // KEIN neues Recht — der Leseweg verlangt bewusst gar keines, weil sich die Flaeche faerben
    // muss, bevor jemand angemeldet ist. KEINE Nutzlast (GET ohne Koerper, ohne Query). Die
    // ausfuehrliche Antwort auf „CSP? Recht? Manifest?" steht bei `BEKANNTE_ABRUFZIELE` in
    // `tests/app/mega69-klara-merkmale.test.ts` (14 → 15).
    //
    // NEU IST AUSSERDEM EINE WIEDERKEHRENDE FRIST (60 s). Das ist bewusst und benannt: bis hierher
    // hing jeder wiederkehrende Abruf dieses Fensters an einem Ereignis. Genau der Bildschirm, um
    // den es am Freitag geht, erzeugt aber keines — das Aufgabenfenster steht waehrend der
    // Vorfuehrung offen daneben, niemand klickt hinein. Die Frist ruft DIESELBE gedrosselte
    // Funktion wie Sichtbarkeit und Fokus; die Zusage „hoechstens ein Abruf je Minute" gilt ueber
    // alle drei Wege ZUSAMMEN, nicht je Weg. Gemessen in
    // `tests/demo-firmen-ci-verbraucher/word-marke.test.ts` W7.
    //
    // ES IST AUSDRUECKLICH KEIN `setInterval`, sondern eine nach jedem Blick NEU gestellte
    // `setTimeout`-Frist — dieselbe Bauform wie der Anmeldepoll. Runde 1 dieses Jobs hatte ein
    // Intervall und wurde dafuer an ZWEI Stellen rot: `tests/app/word-addin.test.ts` haelt fest,
    // dass das Wort in dieser Datei nicht vorkommt, und `tests/app/ka3-fokusverhalten.test.tsx`
    // misst zur Laufzeit, dass es nie gerufen wird. Die Hauszusage lautet: dieses Fenster haelt
    // Fristen, keinen Takt — es gibt immer genau einen offenen Abruf, nie zwei ueberlappende.
    //
    // DER ASK-WEG UND JEDER ANDERE BESTANDSWEG BLEIBEN UNBERUEHRT: dieselbe Nutzlast, dieselben
    // Endpunkte, dieselben Rechte. Die Marke kennt keinen Vorgang und keinen Zustand der Flaeche;
    // ein Abruffehler leert nichts und meldet nichts (LEHREN §7), das Fenster bleibt voll
    // bedienbar. Ein aelterer Server ohne die Route antwortet 404 → es bleibt beim normalen Look.
    // Ein installiertes Add-in braucht deshalb KEIN erneutes Sideload; es holt die Datei beim
    // naechsten Oeffnen frisch vom Server.
    // RUNDE 2 — WAS SICH GEGENUEBER RUNDE 1 AM SKRIPT GEAENDERT HAT (BENs Befund):
    // `kwMarkeUebernehmen` verglich Staende am ZAEHLER und verwarf `version <= meine`. Das war
    // falsch: `version` gilt laut Vertrag (JOB 3510) nur INNERHALB eines Prozesslaufs — nach jedem
    // Neustart und jedem Deploy faengt sie wieder bei 0 an. Ein offenes Aufgabenfenster, das vorher
    // `version 9` gesehen hatte, verwarf danach JEDE weitere Schaltung und blieb blau, waehrend der
    // Server laengst „aus" sagte. Verglichen wird jetzt am AUSSEHEN (`kwMarkeKennung`: Profil, beide
    // Markenfarben, Logoadresse) — das kann auch den Fall nicht verwechseln, in dem derselbe
    // Zaehlerstand nach einem Neustart etwas ANDERES bezeichnet. `version` wird weiterhin gelesen,
    // aber nur noch als Vertragsmerkmal: eine Antwort ohne numerische `version` ist keine Auskunft
    // ueber die Marke und wird verworfen. Gegen ueberholende Antworten steht unveraendert
    // `kwMarkeLaeuft` (immer nur EIN offener Abruf) — gemessen in `word-marke.test.ts` W8, der
    // Neustartfall in W11/W12, die Ruhe des Minutenblicks in W13.
    //
    // NICHT GEMESSEN und hier ausdruecklich gesagt: echtes Word. Gemessen wurde in jsdom am
    // vollstaendig geladenen Aufgabenfenster.
    // GEMESSEN: tests/demo-firmen-ci-verbraucher (drei Dateien), Waechterlauf (Inventar,
    // Inhalts-Pin, Aufrufer, Theme, Frische, Tor), mega43-Palettensammler, mega69-Merkmalsvertrag.
    //
    // JOB 3555 · K2b-BEREICH-ZEILE (10.09.2026) — AUSLIEFERUNGSFOLGEN GEPRUEFT, BEVOR DER PIN
    // WANDERTE. VORHERHASH taskpane.html:
    // `c1ffc7958e403df1e7c413b4757e653fff5cfc835a9017d79bdf6b3840052f78`.
    //
    // ANLASS: der Kommentar in `taskpane.html` beschrieb einen Zustand, den es nicht mehr gibt —
    // „Die Bereich-Zeile der Vorlage (Z.39-45) ist bewusst nicht gebaut: kein Serverweg liefert
    // eine Kategorienliste". `GET /api/categories` (JOB 3507, services/app/src/routes/
    // category-routes.ts) ist seit dem 10.09.2026 LIVE. Der Grund ist entfallen, die Zeile ist
    // gebaut; der Kommentar ist ERSETZT, nicht daneben belassen.
    //
    // GEAENDERT WURDE IM FENSTER GENAU VIERERLEI:
    //   · MARKUP: EINE neue Zeile in `#capture-felder`, unter der Titelzeile, in DERSELBEN Bauform
    //     (`label.capture-zeile` + `span[data-t]` + Wertfeld): `<select id="capture-bereich"
    //     disabled>` — im Markup OHNE Option, die Eintraege entstehen erst aus der Serverantwort.
    //     Kein bestehendes Element wurde verschoben, umbenannt oder entfernt; der Dokumentlink
    //     bleibt letztes Kind der Flex-Spalte.
    //   · STIL: zwei neue Regeln (`#capture-bereich`, `#capture-bereich:disabled`). Die erste
    //     traegt die Farben, ausschliesslich aus vorhandenen Werkbank-Tokens (`--surface`,
    //     `--muted`) — KEIN neues Farbliteral (mega43). Die zweite traegt NUR `opacity: 1` und
    //     KEINE Farbe (RUNDE 4, siehe unten). Keine bestehende Regel wurde geaendert.
    //   · WOERTERBUCH: FUENF neue Schluessel je Sprache (captureBereichLabel, captureBereichWahl,
    //     captureBereichLaedt, captureBereichLeer, captureBereichFehler). Keiner ersetzt einen
    //     bestehenden, keiner faellt weg. „Bereich"/„Area"/„Gebied" folgt dem Begriff, den das
    //     Panel fuer `category` schon fuehrt (`bestandBereich`).
    //   · SKRIPT: der Zustand der Zeile (`captureBereichLage/-e/-Wahl/-Lauf`), sein Zeichnen
    //     (`renderCaptureBereich`, `captureBereichSatz`, `captureBereicheAusAntwort`), der Abruf
    //     (`captureBereicheLesen`), ein `change`-Zuhoerer, je eine Zeile in `setTab` und `setLang`
    //     sowie ein OPTIONALER vierter Parameter an `draftPostPayload`/`prepareWordDraftRequest`.
    //
    // DIE AUSLIEFERUNGSFRAGEN, EINZELN BEANTWORTET:
    //   · KEINE neue Abrufstelle und KEIN neues Abrufziel: der Abruf laeuft ueber die VORHANDENE
    //     Stelle `m5Abruf` (same-origin GET, `credentials: "include"`, eigene Frist) — M7 in
    //     tests/app/mega69-klara-merkmale.test.ts bleibt bei 14, gemessen.
    //     RUNDE 2, gemessen statt vermutet: Runde 1 stand hier auf 16. Nicht wegen eines neuen
    //     Abrufs — wegen zweier KOMMENTARE. Der Zaehler in mega69-klara-merkmale streicht vor dem
    //     Zaehlen nur Zeilen, die mit zwei Schraegstrichen beginnen; in einem Blockkommentar
    //     (` * …`) zaehlte der Aufrufname mit offener Klammer als echter Abruf mit. Beide
    //     Erwaehnungen sind jetzt ausgeschrieben („Abrufstelle"), der Code ist unveraendert.
    //   · KEIN neuer Endpunkt und kein neues Recht: `GET /api/categories` steht seit JOB 3507 und
    //     wird nur benutzt; sie verlangt `ko.read` wie die Bibliothek und liefert bei fehlendem
    //     Recht eine leere Sicht statt eines Fehlers.
    //   · DIE NUTZLAST AENDERT SICH NUR MIT EINER WAHL: ohne gewaehlten Bereich bleibt
    //     `category` undefiniert, `JSON.stringify` laesst das Feld weg — der abgesetzte Rumpf ist
    //     dann BYTEGLEICH dem von vorher (kein `""`, kein `null`). Der Bibliotheksspiegel
    //     `apps/web/src/lib/wordAddin.ts#draftPostPayload` (drei Parameter) ist deshalb UNBERUEHRT
    //     und bleibt der gemessene Zwilling (tests/app/word-addin.test.ts). Das Feld selbst kennt
    //     der Sendeweg laengst (`DraftPayload.category`, services/capture/src/types.ts:8) — es ist
    //     KEINE Serveraenderung noetig und es wurde keine gemacht.
    //     RUNDE 2: die Sendestelle ruft `prepareWordDraftRequest` deshalb in ZWEI Schreibweisen —
    //     ohne Wahl BUCHSTAeBLICH im Bestandsaufruf mit drei Argumenten, den
    //     `tests/app/word-addin.test.ts:792` pinnt (Runde 1 hatte ihn unbeabsichtigt gebrochen),
    //     mit Wahl im erweiterten. Beide Zweige bauen denselben Payload wie zuvor.
    //   · KEIN Manifest, KEINE geaenderte CSP, keine neue Word-API, kein neuer Fremd-Ursprung,
    //     keine geaenderte Frequenz (geholt wird beim Betreten der Flaeche, wie die Markierung).
    //   · Ein installiertes Add-in braucht KEIN erneutes Sideload; der Stempel-Mechanismus traegt
    //     die neue Fassung wie bisher.
    // NICHT GEMESSEN und hier ausdruecklich gesagt: echtes Word. Gemessen wurde in Chromium am
    // ausgelieferten Fenster und im jsdom.
    // GEMESSEN: tests/k2b-bereich-zeile (F1-F5 an echten Antworten: Liste, leer, 500, offline,
    // Wahl/keine Wahl — plus zwei Kalibrierungen), tests/design/zielbild-k2-erfassen (Z.39/Z.40/
    // Z.42 neu; der OFFENE Posten „Bereich-Zeile ohne Serverweg" ist ersetzt),
    // tests/design/zielbild-k2-kein-erklaertext (T1/T3: eine Beschriftung mehr, kein Satz mehr),
    // tests/design/k2-funktionsinventar (I16/I16b), tests/k2b-erfassen-reste,
    // Waechterlauf (Inventar, Inhalts-Pin, Aufrufer, Theme, Frische, Tor).
    //
    // KONFLIKTRUNDE (JOB 3555) — BEIDE AENDERUNGEN SIND IM AUSGELIEFERTEN taskpane.html VEREINT
    // (JOB 3512s Markenwahl UND JOB 3555s Bereich-Zeile); der Pin ist aus der zusammengefuehrten
    // Datei neu berechnet.
    //
    // RUNDE 3 (11.09.2026) — DERSELBE PIN, ZUM ZWEITEN MAL NEU GERECHNET: DIE BASIS IST GEWANDERT,
    // DER INHALT NICHT. Runde 2 rechnete `c8f7ff89…` auf der damaligen Basis `468fd75` (JOB 3510 D3).
    // Danach hat der Taktgeber diese Arbeit auf `9ea4bb9` (ship 1.0.0-beta.1.276) rebased; darin
    // steckt `3674538` (JOB 3512 D2), die letzte fremde Aenderung an `taskpane.html`. Der Pin zeigte
    // damit auf einen Stand, den es nach dem Rebase nicht mehr gab — der Waechter hat GENAU DAS
    // getan, wofuer er da ist, und die Runde 2 rot gemacht (Waechterlauf und Tor: `expected
    // '19ddb483…' to be 'c8f7ff89…'`).
    //
    // KEINE NEUE AUSLIEFERUNGSFRAGE, und das ist gemessen statt behauptet: `git diff 9ea4bb9 --
    // apps/web/public/word-addin/taskpane.html` ergibt `230 12` (+230/−12) und enthaelt
    // AUSSCHLIESSLICH die oben aufgezaehlten vier Aenderungen dieses Jobs (Markup, zwei Stilregeln,
    // fuenf Woerterbuch-Schluessel je Sprache, Skriptblock samt optionalem vierten Parameter). JOB
    // 3512s Markenteil ist unberuehrt in der Datei (KW-MARKE-Block, `kwMarkeKennung`) — er kommt
    // jetzt aus der Basis, nicht mehr aus einer Zusammenfuehrung. Es bleibt deshalb bei den
    // Antworten oben: kein neues Abrufziel, keine neue Abrufstelle, kein Manifest, keine geaenderte
    // CSP, kein neues Recht, kein Sideload; die Nutzlast aendert sich nur mit einer echten Wahl.
    // VORHERHASH taskpane.html auf DIESER Basis (`git show 9ea4bb9:…`):
    // `8e3950aa27c94aa013a3556db263f08d8baf72644ba2495c115f24c4aeaeee78`.
    //
    // RUNDE 4 (11.09.2026) — EINE EINZIGE AENDERUNG AN taskpane.html, UND SIE NIMMT ETWAS WEG.
    // VORHERHASH (Stand Runde 3): `19ddb4834c263e10a68a64eb4ae2930cac4e1bfb1cdd0469c663d1859955bdc6`.
    // ANLASS: das Tor der Runde 3 war rot, und der Befund gehoerte diesem Job — der Palettensammler
    // meldete `#capture-bereich:disabled` als „Regel mit `color`, die der Sammler nicht gemessen
    // hat" (mega43 B1, zwei Faelle). Ein Zustandsselektor laesst sich nicht auf das Markup anwenden;
    // ohne benannte Ausnahme ist das dort ROT statt still.
    // ENTSCHEIDUNG: nicht eine Ausnahme eintragen, sondern die zweite Wahrheit entfernen. Die
    // Deklaration `color: var(--muted)` stand im gesperrten Zustand NOCH EINMAL, obwohl die Regel
    // `#capture-bereich` daruber dieselbe Tinte bereits fuer beide Zustaende setzt. Sie ist
    // ersatzlos weg; `opacity: 1` bleibt (es haelt den Satz der Lage lesbar statt halbdurchsichtig)
    // und traegt keine Farbe. Der Sammler misst damit GENAU EINE Regel — die lesbare.
    // KEINE AUSLIEFERUNGSFOLGE, und das ist gemessen statt behauptet: dass die eine Angabe auch am
    // gesperrten Feld traegt, misst tests/design/zielbild-k2-erfassen.test.ts Z.42 in Chromium — die
    // dortige Buehne beantwortet `/api/categories` nicht, das Feld steht also gesperrt, und der
    // gemessene `color` bleibt der Zielwert. Die Punkte oben (Abrufstelle, Endpunkt, Nutzlast,
    // Manifest, CSP, Sideload) sind unberuehrt: an Markup, Woerterbuch und Skript hat diese Runde
    // NICHTS geaendert.
    // RUNDE 5 (11.09.2026) — ZWEI FEHLER AM ZUSTAND DER ZEILE, VON BEN GEMESSEN, HIER BEHOBEN.
    // VORHERHASH (Stand Runde 4): `db56d6b1148fa49fd336cb148ccb1673823bd4d3d2601d7e0e423fbfab33fabb`.
    // ANLASS 1: der GEHALTENE Bereich wurde nicht mitbereinigt, wenn die Anzeige leer wurde. Wer
    // „Technik" waehlte, die Flaeche verliess und mit einer LEEREN Antwort zurueckkam, sah „Noch
    // kein Bereich in deinem Bestand" — und sendete trotzdem `"category":"Technik"`. Behoben an
    // zwei Stellen, weil der Fehler zwei Haelften hat: die erfolgreiche leere Antwort verwirft die
    // gehaltene Wahl jetzt (wie `scheitern()` es laengst tat), und der Sendeweg liest nicht mehr den
    // gehaltenen Zustand, sondern GENAU DAS, was die Zeile sichtbar traegt (neue Ablesung
    // `captureBereichGewaehlt`, an die Lage gebunden). Damit koennen sichtbarer Zustand und Nutzlast
    // nicht mehr auseinanderlaufen — auch nicht waehrend einer noch laufenden Auffrischung.
    // ANLASS 2: `captureBereicheAusAntwort` beschnitt die gelieferten Namen beidseitig; aus
    // " Technik " wurde "Technik", und dieser veraenderte Wert reiste in die Nutzlast. Der Bestand
    // vergleicht Bereichsnamen exakt (category-routes.ts:33). Beschnitten wird nur noch fuer die
    // Frage, OB ein Name dasteht; hinaus geht der gelieferte Name.
    // KEINE NEUE AUSLIEFERUNGSFRAGE: Markup, Stil und Woerterbuch sind unberuehrt (kein neuer
    // Schluessel, kein neues Element, keine neue Regel), es gibt kein neues Abrufziel und keine neue
    // Abrufstelle, kein Manifest, keine CSP-Aenderung, kein neues Recht, kein Sideload. Geaendert
    // wurde AUSSCHLIESSLICH Skript: drei Stellen und ihre Kommentare. Die Nutzlast wird durch diese
    // Runde nur ENGER — sie traegt `category` jetzt in genau den Faellen, in denen die Zeile den
    // Bereich auch zeigt; der Bibliotheksspiegel `wordAddin.ts#draftPostPayload` bleibt unberuehrt.
    // GEMESSEN: tests/k2b-bereich-zeile (F6/F7/F8 neu, dazu die Kalibrierungen K-d/K-e, die den
    // Stand von Runde 4 im Speicher wiederherstellen und F6 bzw. F8 fallen lassen), die sechs
    // Abnahmepfade des Auftrags und der Waechterlauf.
    const PIN = "13d5056a13299b0f1ae379caf9d250b3ae03f291be967bd1cd219c41cfd7e8f5";
    const ist = createHash("sha256").update(readFileSync(TASKPANE)).digest("hex");
    expect(
      ist,
      "taskpane.html wurde geändert — Auslieferungsfolgen bewusst prüfen (Kommentar oben), dann den Pin aktualisieren.",
    ).toBe(PIN);
  });
});
