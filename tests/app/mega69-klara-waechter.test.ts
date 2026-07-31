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
    const PIN = "0cf394b1946bbb495d832470ca97389d49d4c6951ecbd2d2f6fc69e451787cd6";
    const ist = createHash("sha256").update(readFileSync(TASKPANE)).digest("hex");
    expect(
      ist,
      "taskpane.html wurde geändert — Auslieferungsfolgen bewusst prüfen (Kommentar oben), dann den Pin aktualisieren.",
    ).toBe(PIN);
  });
});
