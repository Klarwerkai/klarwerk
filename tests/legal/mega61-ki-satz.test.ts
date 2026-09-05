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

const WURZEL = join(__dirname, "..", "..");
const WEB = join("apps", "web", "src");
const ADDIN = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");
const SCHLUESSEL = "ai.generatedNotice";

// Wer den Satz trägt: entweder direkt, oder über die Modellangabe (die ihn seit mega61 enthält).
const TRAEGER = ["AiGeneratedNotice", "AiModelInfo"];

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

describe("mega61 E · der dauerhaft sichtbare Satz an jeder Modellfläche", () => {
  it("die Erhebung greift überhaupt", () => {
    // Ein leerer Sammler wäre ein grüner Sammler, der nichts bewacht.
    expect(quelldateien(WEB).length).toBeGreaterThan(100);
    expect(modellflaechen().length).toBeGreaterThan(4);
  });

  it("der Satz existiert als EIN Schlüssel in allen drei Sprachen", () => {
    const i18n = readFileSync(join(WURZEL, WEB, "i18n.ts"), "utf8");
    const treffer = i18n.split("\n").filter((z) => z.includes(`"${SCHLUESSEL}"`));
    expect(treffer.length, "der Satz fehlt in einer der drei Sprachen").toBe(3);
  });

  it("JEDE berechnete Modellfläche trägt den Satz — direkt oder über die Modellangabe", () => {
    const verstoesse: string[] = [];
    for (const datei of modellflaechen()) {
      if (datei in AUSNAHMEN) {
        continue;
      }
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      if (!TRAEGER.some((traeger) => inhalt.includes(`<${traeger}`))) {
        verstoesse.push(`${datei} benutzt ein Modell, zeigt aber den KI-Satz nicht`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("die Modellangabe trägt den Satz WIRKLICH — sonst wäre die Regel oben hohl", () => {
    // Ohne diesen Fall wäre jede Fläche mit `<AiModelInfo` grün, auch wenn dort gar nichts steht.
    const info = readFileSync(join(WURZEL, WEB, "components", "AiModelInfo.tsx"), "utf8");
    expect(info).toContain("<AiGeneratedNotice");
    const satz = readFileSync(join(WURZEL, WEB, "components", "AiGeneratedNotice.tsx"), "utf8");
    expect(satz).toContain(SCHLUESSEL);
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
    for (const datei of nachgeruestet) {
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      expect(inhalt, `${datei} trägt den Satz nicht selbst`).toContain("<AiGeneratedNotice");
    }
  });

  it("das Word-Add-in trägt ihn ebenfalls — mit eigenem Wörterbuch, gleichem Inhalt", () => {
    // Es ist kein React-Projekt und kann `apps/web/src/i18n.ts` baulich nicht lesen. Der Satz
    // steht deshalb sinngleich in seinem eigenen Wörterbuch — in allen drei Sprachen.
    const addin = readFileSync(ADDIN, "utf8");
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
    const addin = readFileSync(ADDIN, "utf8");
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
    const addin = readFileSync(ADDIN, "utf8");
    expect(addin).toContain('data-t="askReviewNotice"');
    expect(addin.split("askReviewNotice:").length - 1).toBe(3);
  });
});
