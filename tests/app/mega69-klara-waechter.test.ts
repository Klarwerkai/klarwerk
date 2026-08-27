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
    const PIN = "991c3633e1b90de5af2f8b1d00d05e033f23ea8837afa3dd73aa9bfc850ba966";
    const ist = createHash("sha256").update(readFileSync(TASKPANE)).digest("hex");
    expect(
      ist,
      "taskpane.html wurde geändert — Auslieferungsfolgen bewusst prüfen (Kommentar oben), dann den Pin aktualisieren.",
    ).toBe(PIN);
  });
});
