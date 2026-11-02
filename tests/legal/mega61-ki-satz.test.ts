// ================================================================================================
// AUFTRAG-mega61 BLOCK E — DER SATZ, DEN MAN NICHT AUFKLAPPEN MUSS.
// ================================================================================================
//
// Artikel 50 Absatz 5 der KI-Verordnung verlangt die Information „klar und deutlich
// unterscheidbar", Absatz 1 spätestens bei der ersten Interaktion. Bis mega60 stand an einer
// KI-Fläche, WELCHE Art Modell arbeitet — hinter einem „(!)"-Knopf. Das setzt voraus, dass man die
// Frage schon gestellt hat, und ist damit weder deutlich unterscheidbar noch rechtzeitig.
//
// DER SAMMLER RECHNET DIE FLÄCHEN AUS, statt sie aufzuzählen. Die Regel, die er anwendet:
//
//     Jede Datei unter apps/web/src, die `useAiAvailable(...)` aufruft, ist eine Fläche, die ein
//     Modell benutzt — und muss den Satz tragen (direkt oder über die Modellangabe, die ihn seit
//     mega61 enthält).
//
// `useAiAvailable` ist der etablierte Anker: Es ist die Vorrichtung, mit der seit AI-STATE JEDE
// echte Modell-Aktion hart ausgegraut wird, wenn kein Modell nutzbar ist. Wer eine neue Modellfläche
// baut, kommt an ihr nicht vorbei — und wird hier rot, wenn er den Satz vergisst.
//
// DIE ZWEI AUSNAHMEN sind benannt und begründet, wie beim Schalter-Sammler aus mega46. Eine
// pauschale Ausnahme gibt es nicht, und eine Ausnahme, die niemand mehr braucht, wird rot.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { panelQuelleAus } from "../support/panelquelle";
import { woerterbuchQuelleAus } from "../support/woerterbuchquelle";

const WURZEL = join(__dirname, "..", "..");
const WEB = join("apps", "web", "src");
const ADDIN = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");
const SCHLUESSEL = "ai.generatedNotice";

// Wer den Satz trägt: entweder direkt, oder über die Modellangabe (die ihn seit mega61 enthält).
// R-0603/R-0604: „den Satz" gibt es seither in zwei Formen — den dauerhaften Flächensatz am
// Auslöser (`AiSurfaceNotice`) und die Erzeugungsbehauptung am Ergebnis (`AiGeneratedNotice`, nur
// mit Signal). Jede Modellfläche trägt mindestens einen der beiden; behauptet wird nur am Ergebnis.
const TRAEGER = ["AiGeneratedNotice", "AiSurfaceNotice", "AiModelInfo"];
const FLAECHEN_SCHLUESSEL = "ai.surfaceNotice";

const AUSNAHMEN: Record<string, string> = {
  [join(WEB, "app", "ImageDescribeContext.tsx")]:
    "KEINE Fläche, sondern der WEG zur Bildbeschreibung für die ganze App (mega50 Block A). Er " +
    "rendert nichts Sichtbares; den Satz tragen die beiden Stellen, die den Vorschlag anbieten " +
    "(components/RichTextEditor.tsx, Fußnoten-Leiste und Bildbeschreibungs-Formular).",
  [join(WEB, "components", "ImportSelect.tsx")]:
    "Reicht die Verfügbarkeit nur DURCH an ImportGroups (`aiAvailable={groupAi.available}`), das " +
    "den Gruppierungsschritt rendert und den Satz trägt. Hier gibt es keinen Auslöser und kein " +
    "Ergebnis — der Satz stünde an einer Stelle, an der nichts erzeugt wird.",
  [join(WEB, "lib", "useAiAvailable.tsx")]:
    "Die Vorrichtung SELBST — sie definiert den Haken, an dem dieser Sammler hängt, und ist keine " +
    "Fläche. Sie rendert nichts und hat weder Auslöser noch Ergebnis; ein Satz stünde hier an " +
    "einer Stelle, die niemand sieht.",
};

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (
      (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) &&
      !relativ.endsWith(".test.ts") &&
      !relativ.endsWith(".test.tsx")
    ) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/** Die Flächen, die ein Modell benutzen — BERECHNET, nicht aufgezählt. */
function modellflaechen(): string[] {
  return quelldateien(WEB).filter((datei) => {
    const inhalt = readFileSync(join(WURZEL, datei), "utf8");
    // Ein echter AUFRUF, nicht die bloße Erwähnung im Import oder in einem Kommentar.
    return /\buseAiAvailable\s*\(/.test(inhalt.replace(/^\s*\/\/.*$/gm, ""));
  });
}

function traegtKiSatz(datei: string, inhalt: string): boolean {
  if (TRAEGER.some((traeger) => inhalt.includes(`<${traeger}`))) {
    return true;
  }
  if (datei !== join(WEB, "components", "klara-vorschau", "KlaraEchtGespraech.tsx")) {
    return false;
  }
  const code = inhalt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const nachricht = /^function NachrichtEcht\([\s\S]*?^\}$/m.exec(code)?.[0] ?? "";
  const beginn = nachricht.lastIndexOf("\n  return (\n");
  if (beginn < 0 || !/<NachrichtEcht\b[^>]*\bn=\{n\}/.test(code)) {
    return false;
  }
  const sichtbar = nachricht.slice(beginn);
  return (
    /^\n {2}return \(\s*<li\s+data-testid="klara-nachricht"/.test(sichtbar) &&
    /\{n\.modus\s*===\s*"ki"\s*\?\s*\(\s*<>\s*<span\b[^<>]*>\s*\{t\("klaragespraech\.label\.ki"\)\}\s*<\/span>\s*<span\s+className=\{`\$\{SCHILD\} bg-trust-warn-bg text-trust-warn-text`\}>\s*\{t\("klaragespraech\.label\.kiHinweis"\)\}\s*<\/span>\s*<\/>\s*\)\s*:\s*n\.modus\s*===\s*"ohne_ki"/.test(
      sichtbar,
    )
  );
}

describe("mega61 E · der dauerhaft sichtbare Satz an jeder Modellfläche", () => {
  it("die Erhebung greift überhaupt", () => {
    // Ein leerer Sammler wäre ein grüner Sammler, der nichts bewacht.
    expect(quelldateien(WEB).length).toBeGreaterThan(100);
    expect(modellflaechen().length).toBeGreaterThan(4);
  });

  it("der Satz existiert als EIN Schlüssel in allen drei Sprachen", () => {
    const i18n = woerterbuchQuelleAus(join(WURZEL, WEB, "i18n.ts"));
    const treffer = i18n.split("\n").filter((z) => z.includes(`"${SCHLUESSEL}"`));
    expect(treffer.length, "der Satz fehlt in einer der drei Sprachen").toBe(3);
    // R-0603: der Flächensatz ebenso — ein Schlüssel, drei Sprachen.
    const flaeche = i18n.split("\n").filter((z) => z.includes(`"${FLAECHEN_SCHLUESSEL}"`));
    expect(flaeche.length, "der Flächensatz fehlt in einer der drei Sprachen").toBe(3);
  });

  it("JEDE berechnete Modellfläche trägt den Satz — direkt oder über die Modellangabe", () => {
    const verstoesse: string[] = [];
    for (const datei of modellflaechen()) {
      if (datei in AUSNAHMEN) {
        continue;
      }
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      if (!traegtKiSatz(datei, inhalt)) {
        verstoesse.push(`${datei} benutzt ein Modell, zeigt aber den KI-Satz nicht`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  // Eigener Gesprächshinweis: kausale Gegenproben am erhaltenen Produktquelltext.
  it("der eigene Gesprächshinweis bleibt sichtbar und an den KI-Modus gebunden", () => {
    const datei = join(WEB, "components", "klara-vorschau", "KlaraEchtGespraech.tsx");
    const inhalt = readFileSync(join(WURZEL, datei), "utf8");
    expect(traegtKiSatz(datei, inhalt)).toBe(true);
    const mutationen: [string, string][] = [
      ['{t("klaragespraech.label.kiHinweis")}', ""],
      ['t("klaragespraech.label.kiHinweis")', 't("klaragespraech.label.defekt")'],
      ['{n.modus === "ki" ? (', '{n.modus === "ohne_ki" ? ('],
      ['{n.modus === "ki" ? (', "{true ? ("],
      [
        "<span className={`${SCHILD} bg-trust-warn-bg text-trust-warn-text`}>",
        "<span className={`${SCHILD} bg-trust-warn-bg text-trust-warn-text hidden`}>",
      ],
    ];
    for (const [von, nach] of mutationen) {
      expect(inhalt.split(von)).toHaveLength(2);
      const veraendert = inhalt.replace(von, nach);
      expect(veraendert).not.toBe(inhalt);
      expect(veraendert).not.toContain(von);
      expect(traegtKiSatz(datei, veraendert)).toBe(false);
    }

    // Beide echten Verwendungen bleiben unabhängig gültig; erst ohne beide fehlt der Träger.
    const aufrufe = [...inhalt.matchAll(/<NachrichtEcht\b[^>]*\bn=\{n\}[^>]*\/>/g)].map(
      (treffer) => treffer[0] ?? "",
    );
    expect(aufrufe).toHaveLength(2);
    expect(new Set(aufrufe).size).toBe(2);
    let ohneBeide = inhalt;
    for (const aufruf of aufrufe) {
      expect(aufruf).not.toBe("");
      expect(inhalt.split(aufruf)).toHaveLength(2);
      const ohneEinen = inhalt.replace(aufruf, "");
      expect(ohneEinen).not.toBe(inhalt);
      expect(ohneEinen).not.toContain(aufruf);
      expect(ohneEinen.match(/<NachrichtEcht\b/g) ?? []).toHaveLength(1);
      expect(traegtKiSatz(datei, ohneEinen)).toBe(true);
      const vorher = ohneBeide;
      ohneBeide = ohneBeide.replace(aufruf, "");
      expect(ohneBeide).not.toBe(vorher);
    }
    expect(ohneBeide).not.toMatch(/<NachrichtEcht\b/);
    expect(traegtKiSatz(datei, ohneBeide)).toBe(false);
  });

  it("eigener Hinweis braucht echte Darstellung und Sprachbindung statt fremder Textköder", () => {
    const datei = join(WEB, "components", "klara-vorschau", "KlaraEchtGespraech.tsx");
    const inhalt = readFileSync(join(WURZEL, datei), "utf8");
    const fremd = join(WEB, "components", "Unbeteiligt.tsx");
    expect(traegtKiSatz(datei, inhalt)).toBe(true);
    expect(fremd).not.toBe(datei);
    expect(traegtKiSatz(fremd, inhalt)).toBe(false);
    for (const traeger of TRAEGER) {
      expect(traegtKiSatz(fremd, `<${traeger} />`)).toBe(true);
    }
    const texte = readFileSync(join(WURZEL, WEB, "texte", "klaragespraech.ts"), "utf8");
    const hinweise = [...texte.matchAll(/"klaragespraech\.label\.kiHinweis"\s*:\s*"([^"]*)"/g)].map(
      (treffer) => treffer[1] ?? "",
    );
    expect(hinweise).toHaveLength(3);
    expect(hinweise.every((text) => text.trim().length > 0)).toBe(true);
    const hinweis = '{t("klaragespraech.label.kiHinweis")}';
    expect(inhalt.split(hinweis)).toHaveLength(2);
    const defekt = inhalt.replace(hinweis, "");
    expect(defekt).not.toBe(inhalt);
    expect(defekt).not.toContain(hinweis);
    expect(traegtKiSatz(datei, defekt)).toBe(false);
    for (const koeder of [
      '\n// {t("klaragespraech.label.kiHinweis")}',
      '\nconst unbenutzt = "klaragespraech.label.kiHinweis";',
      '\n/* <span>{t("klaragespraech.label.kiHinweis")}</span> */',
    ]) {
      const veraendert = `${defekt}${koeder}`;
      expect(veraendert).not.toBe(defekt);
      expect(veraendert).toContain(koeder);
      expect(traegtKiSatz(datei, veraendert)).toBe(false);
    }
    const kommentiert = inhalt.replace(hinweis, `{/* ${hinweis} */}`);
    expect(kommentiert).not.toBe(inhalt);
    expect(kommentiert).toContain(hinweis);
    expect(traegtKiSatz(datei, kommentiert)).toBe(false);
    const nurText = inhalt.replace(hinweis, '{"klaragespraech.label.kiHinweis"}');
    expect(nurText).not.toBe(inhalt);
    expect(nurText).toContain('"klaragespraech.label.kiHinweis"');
    expect(traegtKiSatz(datei, nurText)).toBe(false);
  });

  it("die Modellangabe trägt den Satz WIRKLICH — sonst wäre die Regel oben hohl", () => {
    // Ohne diesen Fall wäre jede Fläche mit `<AiModelInfo` grün, auch wenn dort gar nichts steht.
    // R-0604: die Modellangabe sitzt am Auslöser — sie trägt den Flächensatz, nicht die
    // Erzeugungsbehauptung (vor dem Klick ist nichts erzeugt).
    const info = readFileSync(join(WURZEL, WEB, "components", "AiModelInfo.tsx"), "utf8");
    expect(info).toContain("<AiSurfaceNotice");
    expect(info, "die Modellangabe behauptet am Auslöser eine Erzeugung").not.toContain(
      "<AiGeneratedNotice",
    );
    const satz = readFileSync(join(WURZEL, WEB, "components", "AiGeneratedNotice.tsx"), "utf8");
    expect(satz).toContain(SCHLUESSEL);
    expect(satz).toContain(FLAECHEN_SCHLUESSEL);
  });

  it("jede benannte Ausnahme ist begründet — und wird noch gebraucht", () => {
    const flaechen = new Set(modellflaechen());
    for (const [datei, grund] of Object.entries(AUSNAHMEN)) {
      expect(grund.length, `Ausnahme ${datei} ohne echten Grund`).toBeGreaterThan(60);
      expect(datei).not.toContain("*");
      expect(flaechen.has(datei), `Ausnahme ${datei} wird nicht mehr gebraucht`).toBe(true);
    }
  });

  it("die vier Flächen OHNE Modellangabe tragen ihn ausdrücklich selbst", () => {
    // Namentlich, weil sie der Grund für diesen Block waren: sie hatten bis mega60 gar keinen
    // Hinweis — weder aufklappbar noch dauerhaft.
    // JOB 3062 · H3: Die Modellfläche der Vordertür ist umgezogen. `pages/CaptureFrontDoor.tsx` ist
    // nur noch die Adresse; die KI-Vorschlagskarten (Struktur und KI-Hilfe) stehen im gemeinsamen
    // Blatt. Der Satz wird deshalb DORT gemessen — an der Fläche, die das Modell zeigt.
    const nachgeruestet = [
      join(WEB, "pages", "Ask.tsx"),
      join(WEB, "components", "erfassen", "Blatt.tsx"),
      join(WEB, "components", "ImportGroups.tsx"),
      join(WEB, "components", "RichTextEditor.tsx"),
    ];
    // R-0603/R-0604: „selbst tragen" heißt seither den Flächensatz am Auslöser ODER die gebundene
    // Erzeugungsbehauptung am Ergebnis — ImportGroups zeigt am Knopf nur noch den Flächensatz.
    for (const datei of nachgeruestet) {
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      expect(
        inhalt.includes("<AiGeneratedNotice") || inhalt.includes("<AiSurfaceNotice"),
        `${datei} trägt den Satz nicht selbst`,
      ).toBe(true);
    }
  });

  it("das Word-Add-in trägt ihn ebenfalls — mit eigenem Wörterbuch, gleichem Inhalt", () => {
    // Es ist kein React-Projekt und kann `apps/web/src/i18n.ts` baulich nicht lesen. Der Satz
    // steht deshalb sinngleich in seinem eigenen Wörterbuch — in allen drei Sprachen.
    const addin = panelQuelleAus(ADDIN);
    expect(addin).toContain('data-t="aiGeneratedNotice"');
    expect(addin.split("aiGeneratedNotice:").length - 1).toBe(3);
  });

  // ==============================================================================================
  // AUFTRAG-mega81 BLOCK B — DIE REGEL WIRD AN DAS VERHALTEN GEBUNDEN, NICHT ABGESCHALTET.
  // ==============================================================================================
  //
  // Der Fall darüber beweist ANWESENHEIT: der Schlüssel steht dreimal im Wörterbuch, ein Element
  // trägt ihn. Genau das hielt bis mega80 eine FALSCHE Zuschreibung grün — der Satz stand dauerhaft
  // und zustandsunabhängig im Fragen-Bereich, dessen einziger Antwortweg `retrieval-only` sendet
  // und den der Server bewusst NICHT kennzeichnet (`answerRetrievalOnly`). Anwesenheit ist eine
  // notwendige, aber keine hinreichende Bedingung; dasselbe Muster wie der Namenswächter aus
  // mega77, eine Ebene weiter.
  //
  // Die Regel dieses Sammlers lautet deshalb ab hier nicht mehr „die Kennzeichnung ist da",
  // sondern: SIE STEHT GENAU DORT, WO TATSÄCHLICH KI ERZEUGT. Die Compliance-Absicht bleibt
  // vollständig — Artikel 50 verlangt die Information an der KI-Fläche, nicht an jeder Fläche.
  //
  // Der VERHALTENSNACHWEIS (Ausführung der echten Kette: Antwortkörper aus POST /api/ask →
  // ausgeliefertes `performAsk` → Anzeige-Entscheidung) liegt in
  // tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts. Hier steht die strukturelle Hälfte:
  // keine Fläche behauptet die Erzeugung dauerhaft, und die Bindung ans Signal existiert.
  it("im Add-in behauptet KEINE Fläche die KI-Erzeugung dauerhaft — sie hängt am Signal", () => {
    const addin = panelQuelleAus(ADDIN);
    // Jedes Element, das den Satz trägt, ist zustandsgebunden (Startzustand: verborgen).
    const traeger = [...addin.matchAll(/<([a-z]+)\b([^>]*\bdata-t="aiGeneratedNotice"[^>]*)>/g)];
    expect(traeger.length, "der Satz hängt an keinem Element mehr").toBeGreaterThan(0);
    for (const el of traeger) {
      const klassen = /\bclass="([^"]*)"/.exec(el[2] ?? "")?.[1] ?? "";
      expect(
        klassen,
        `<${el[1]} data-t="aiGeneratedNotice"> steht dauerhaft sichtbar — die Erzeugungsbehauptung muss am serverseitigen aiGenerated-Signal hängen, nicht an der Fläche`,
      ).toMatch(/\bhidden\b/);
    }
    // … und die Bindung ist wirklich verdrahtet: das Signal wird gelesen und entscheidet.
    // G24 (JOB 1601/1610): hier stand `aiGenerated: Boolean(result.aiGenerated)`. Der Pin ist
    // nachgezogen, weil `Boolean(...)` die Kennzeichnung auch bei einem beliebigen Objekt oder
    // einem wahren Skalar EINgeschaltet haette — die Bindung ist damit strenger geworden, nicht
    // schwaecher, und dieser Fall prueft weiterhin dasselbe: dass das Signal GELESEN wird.
    expect(addin, "das serverseitige Kennzeichnungssignal wird gar nicht gelesen").toContain(
      "aiGenerated: istKiKennzeichnung(result.aiGenerated)",
    );
    expect(addin, "die Anzeige-Entscheidung fehlt").toContain("outcome.aiGenerated === true");
    expect(addin, "die Entscheidung ist nicht ans Element gehängt").toContain(
      'document.getElementById("ask-ai-notice")',
    );
  });

  it("der fachliche Prüfhinweis bleibt dauerhaft — die Kennzeichnung wird nicht ersatzlos entfernt", () => {
    // Block A ausdrücklich: richtiggestellt, nicht abgeschaltet. Was auf dem retrieval-only-Weg
    // WAHR bleibt — die Antwort ist vor Verwendung fachlich zu prüfen —, steht weiter da.
    const addin = panelQuelleAus(ADDIN);
    expect(addin).toContain('data-t="askReviewNotice"');
    expect(addin.split("askReviewNotice:").length - 1).toBe(3);
  });
});
