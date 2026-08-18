// @vitest-environment jsdom
// AUFTRAG-mega84 Block D — DER WÄCHTER FÜR DEN *WEG* ZUR BILDBESCHREIBUNG.
//
// DIE VORGESCHICHTE. Diese Funktion ist zweimal still verschwunden. Beim ersten Mal (mega50) fehlte
// ein optionaler Prop auf zwei von vier Flächen — Formular und Vorschlag waren dort gar nicht da.
// Der Sammler `tests/app/mega50-bildbeschreibung-sammler.test.ts` hütet seither, dass der describe-
// WEG jede Fläche erreicht. Beim zweiten Mal (Pedi, 31.07., 13:20, mit Bildschirmfoto) war alles
// verdrahtet und trotzdem unerreichbar: das Formular öffnete AUSSCHLIESSLICH über den Knopf in der
// Bild-Werkzeugleiste, und den sah man erst, nachdem man das BILD angeklickt hatte. Klickte man
// stattdessen auf die Beschreibung — die Fläche, die der Nutzer ansieht —, tippte man inline.
//
// Das ist eine andere Klasse als mega50, und mega50 kann sie nicht sehen: dort wird geprüft, ob der
// Weg VERDRAHTET ist, nicht ob er BEDIENBAR ist. Beide Male war die Antwort auf Pedis Klick „nichts
// passiert", die Ursachen lagen eine Etage auseinander.
//
// DIE BAUFORM IST DIE VON mega50, ERWEITERT UM EINE STUFE (der Auftrag: „erweitere diese Bauform,
// statt eine zweite anzulegen"):
//   (1) BAUTEILE — jede Quelldatei, die die Bildbeschreibung ANBIETET (sie rendert `CAPTION_AI_TEXT.…`).
//   (2) AUFRUFER — jede Quelldatei, die eines dieser Bauteile im JSX einbindet.
//       Bis hierher wörtlich mega50: die Grundmenge wird ERHOBEN, sie steht nicht als Liste da.
//   (3) NEU: das ANTWORTVERHALTEN. Für das erhobene Bauteil wird gemountet und gefahren, was der
//       Nutzer tut — auf die Beschreibung klicken, mit der Tastatur dorthin, und was dann im
//       Formular steht. Gepinnt wird also nicht, dass ein Name vorkommt, sondern dass die Fläche
//       antwortet.
//
// WARUM EINMAL MOUNTEN FÜR ALLE FLÄCHEN GENÜGT — und wo die Grenze davon liegt: Stufe (1)+(2)
// belegen, dass ALLE erhobenen Flächen ihre Bildbeschreibung durch DASSELBE Bauteil bekommen
// (heute: `RichTextEditor`). Das Verhalten dieses einen Bauteils ist damit das Verhalten jeder
// Fläche. Käme morgen ein ZWEITES Bauteil dazu, wächst die Grundmenge — und dieser Wächter mountet
// es nicht, sondern wird an Stufe (1) rot, weil er dann mehr Bauteile erhebt als er fährt. Das ist
// Absicht: lieber laut unvollständig als still unvollständig.
//
// AUFTRAG-mega85 Block E — DIE ERHEBUNG WAR DATEI-GENAU UND IST JETZT FUND-GENAU.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 4): Stufe (2) zählte AUFRUFER-DATEIEN und verlangte
// `>= 4` — bei acht tatsächlichen Einbindungen. Verschwand eine von zwei Editor-Instanzen in
// `Capture.tsx`, blieb die Datei ein Aufrufer und der Wächter blieb grün. Die Titelprüfung suchte
// `documentTitle` IRGENDWO IN DER DATEI: ein Vorkommen deckte alle Instanzen darin, und das Wort in
// einer ganz anderen Funktion hätte ebenso genügt. Ein Wächter, der auf Dateiebene zählt, sieht das
// Schrumpfen innerhalb einer Datei nicht — und genau dort ist die Bildbeschwerde zweimal
// verschwunden.
//
// WAS SICH GEÄNDERT HAT:
//   · Ein FUND ist eine einzelne JSX-Einbindung, nicht eine Datei. Heute sind es ACHT in vier
//     Dateien — nachgezählt, nicht gerundet, und die Untergrenze ist an dieser Zahl kalibriert.
//   · Die TRÄGER werden transitiv erhoben: `KnowledgeInputStudio` bietet die Bildbeschreibung nicht
//     selbst an, rendert aber einen `RichTextEditor` und reicht den Titel durch — seine drei
//     Einbindungen tragen den Vertrag also genauso. Datei-genau war das unsichtbar.
//   · Die Titelpaarung wird JE FUND geprüft, und zwar auf der Attributliste GENAU DIESER
//     Einbindung (Klammertiefe wird mitgezählt, damit ein `onChange={(x) => ...}` mit seinem `>`
//     die Grenze des Elements nicht verschiebt).
//
// AUFTRAG-mega86 Block C — DIE ERHEBUNG WAR HEURISTISCH UND IST JETZT AUTORITATIV.
//
// DER BEFUND (ben, sammel84-mega85, GELB): die Grundmenge kam aus Textmustern — exportierte
// Grossbuchstaben-Funktionen, JSX-Namensvorkommen, ein dateiweites `documentTitle:` als transitive
// Abbruchregel. Vier Folgen, alle benannt: Alias, Spread und `createElement` waren blind; ein
// Wrapper mit anders benanntem Prop konnte falsch zugeordnet werden; eine unbeteiligte
// Prop-Deklaration liess eine ganze Datei durch; und `FUNDE.length >= 8` erkannte zwar den heutigen
// Verlust, aber nach Wachstum KOMPENSIERTE ein neuer Fund einen verschwundenen — neun auf acht blieb
// gruen.
//
// WAS SICH GEAENDERT HAT:
//   · Die Erhebung liest den TYPESCRIPT-BAUM, nicht mehr Zeichenfolgen. JSX-Elemente, ihre
//     Attributlisten, ein `{...spread}` und `createElement`-Aufrufe sind dort dasselbe Ding.
//   · Jede Einbindung wird ihrer UMSCHLIESSENDEN Komponente zugeordnet (nicht mehr allen
//     exportierten Funktionen der Datei), und „fuehrt den Titel als eigenen Prop" wird am PARAMETER
//     der Komponente abgelesen (nicht mehr dateiweit).
//   · Jeder Fund hat eine stabile IDENTITAET und genau eine DISPOSITION. Ein verschwundener
//     bekannter Fund wird rot, UNABHAENGIG von der Gesamtzahl; ein neuer Fund ohne Disposition auch.
//     Die Mindestzahlen sind damit weg — sie waren genau die Luecke.
//
// DIE VERBLEIBENDE GRENZE, benannt statt verschwiegen: Alias und Indirektion
// (`const E = RichTextEditor; <E/>`) entgehen der Erhebung weiterhin — dafuer braeuchte es den
// Typpruefer, nicht nur den Syntaxbaum. Der letzte Fall der Stufe 1+2 BELEGT diese Grenze, statt sie
// nur zu behaupten. Zwei Dinge entschaerfen sie: der Titel ist seit mega85 ein PFLICHT-Parameter, ein
// Alias ohne ihn compiliert also gar nicht erst (`tests/capture/mega85-titelvertrag-mounted.test.tsx`),
// und ein Editor ohne Provider wirft zur Laufzeit
// (`tests/capture/bildbeschreibung-pflichtvertrag-mounted.test.tsx`).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Stufe 1 + 2: die Grundmenge AUTORITATIV erheben (TypeScript-Baum) ───────────────────────────

const WURZEL = process.cwd();
const WEB_SRC = join("apps", "web", "src");

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

// Eine einzelne Einbindung — JSX oder `createElement`. Der Textansatz sah `createElement` gar nicht;
// hier ist es dieselbe Erhebung, weil es im Baum dieselbe Sache ist.
interface Einbindung {
  datei: string;
  komponente: string;
  // Die exportierte Komponente, IN DEREN Rumpf die Einbindung steht. Der Textansatz kannte das
  // nicht und ordnete jede Einbindung allen exportierten Funktionen der Datei zu.
  huelle: string | null;
  attribute: string[];
  spread: boolean;
  ahnen: string;
  zeile: number;
}

interface Bauteilkandidat {
  name: string;
  eigenerTitel: boolean;
  bietetAn: boolean;
}

interface Quelle {
  datei: string;
  roh: string;
  einbindungen: Einbindung[];
  komponenten: Bauteilkandidat[];
}

function tagName(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return n.tagName.getText(n.getSourceFile());
}

const ANGEBOT_MUSTER = /CAPTION_AI_TEXT\s*\./;
const AUSNAHME_MUSTER = /KEINE-BILDBESCHREIBUNG:/;

function lies(datei: string): Quelle {
  return liesQuelle(datei, readFileSync(join(WURZEL, datei), "utf8"));
}

// Dieselbe Erhebung über eine Quelle IM SPEICHER — damit die Sonden unten die Erhebung wirklich
// fahren können, statt ihr Verhalten zu behaupten.
function liesQuelle(datei: string, roh: string): Quelle {
  const baum = ts.createSourceFile(datei, roh, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const einbindungen: Einbindung[] = [];
  const komponenten: Bauteilkandidat[] = [];

  const huelleVon = (knoten: ts.Node): string | null => {
    let p: ts.Node | undefined = knoten.parent;
    while (p) {
      if (ts.isFunctionDeclaration(p) && p.name && /^[A-Z]/.test(p.name.text)) {
        return p.name.text;
      }
      if (
        (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
        p.parent &&
        ts.isVariableDeclaration(p.parent) &&
        ts.isIdentifier(p.parent.name) &&
        /^[A-Z]/.test(p.parent.name.text)
      ) {
        return p.parent.name.text;
      }
      p = p.parent;
    }
    return null;
  };

  // Die JSX-Nachbarschaft, in der die Einbindung steht. Sie gehört zur IDENTITÄT (siehe unten):
  // zwei Einbindungen derselben Komponente mit derselben Prop-Liste in derselben Datei wären sonst
  // ununterscheidbar — und genau darüber könnte ein Austausch unbemerkt bleiben.
  const ahnenVon = (knoten: ts.Node): string => {
    const kette: string[] = [];
    let p: ts.Node | undefined = knoten.parent;
    while (p) {
      if (ts.isJsxElement(p)) {
        kette.push(tagName(p.openingElement));
      }
      p = p.parent;
    }
    return kette.slice(0, 4).join("<");
  };

  const zeileVon = (knoten: ts.Node): number =>
    baum.getLineAndCharacterOfPosition(knoten.getStart(baum)).line + 1;

  // „Führt den Titel als EIGENEN Prop" — am Parameter der Komponente abgelesen, nicht an einer
  // Zeichenfolge irgendwo in der Datei. Das war bens Blindstelle „DURCHREICH_MUSTER prüft dateiweit".
  const eigenerTitel = (fn: ts.SignatureDeclarationBase): boolean => {
    const erster = fn.parameters[0];
    if (!erster) {
      return false;
    }
    if (ts.isObjectBindingPattern(erster.name)) {
      return erster.name.elements.some(
        (e) => ts.isIdentifier(e.name) && e.name.text === "documentTitle",
      );
    }
    return false;
  };

  const besuche = (knoten: ts.Node): void => {
    if (ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) {
      const name = tagName(knoten);
      if (/^[A-Z]/.test(name)) {
        einbindungen.push({
          datei,
          komponente: name,
          huelle: huelleVon(knoten),
          attribute: knoten.attributes.properties
            .filter(ts.isJsxAttribute)
            .map((a) => a.name.getText(baum)),
          spread: knoten.attributes.properties.some(ts.isJsxSpreadAttribute),
          ahnen: ahnenVon(knoten),
          zeile: zeileVon(knoten),
        });
      }
    } else if (
      ts.isCallExpression(knoten) &&
      ts.isIdentifier(knoten.expression) &&
      knoten.expression.text === "createElement" &&
      knoten.arguments[0] &&
      ts.isIdentifier(knoten.arguments[0] as ts.Node) &&
      /^[A-Z]/.test((knoten.arguments[0] as ts.Identifier).text)
    ) {
      const props = knoten.arguments[1];
      const felder =
        props && ts.isObjectLiteralExpression(props)
          ? props.properties
              .filter((p) => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
              .map((p) => p.name?.getText(baum) ?? "")
          : [];
      einbindungen.push({
        datei,
        komponente: (knoten.arguments[0] as ts.Identifier).text,
        huelle: huelleVon(knoten),
        attribute: felder,
        spread:
          !!props &&
          ts.isObjectLiteralExpression(props) &&
          props.properties.some(ts.isSpreadAssignment),
        ahnen: "createElement",
        zeile: zeileVon(knoten),
      });
    }
    if (ts.isFunctionDeclaration(knoten) && knoten.name && /^[A-Z]/.test(knoten.name.text)) {
      komponenten.push({
        name: knoten.name.text,
        eigenerTitel: eigenerTitel(knoten),
        bietetAn: ANGEBOT_MUSTER.test(knoten.getText(baum)),
      });
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return { datei, roh, einbindungen, komponenten };
}

const ALLE_QUELLEN: Quelle[] = quelldateien(WEB_SRC).map((d) => lies(posix(d)));

const TEXT_MODUL = "apps/web/src/lib/captionAiSuggest.ts";
const WEG_MODUL = "apps/web/src/app/ImageDescribeContext.tsx";

// Stufe (1): die ANBIETER — Komponenten, die die Bildbeschreibung selbst rendern. Ihr VERHALTEN
// wird unten gefahren (Stufe 3). Geprüft wird jetzt der Rumpf DER KOMPONENTE, nicht die Datei.
const BAUTEILE: { datei: string; komponente: string }[] = ALLE_QUELLEN.filter(
  (f) => f.datei !== TEXT_MODUL && f.datei !== WEG_MODUL,
).flatMap((f) =>
  f.komponenten.filter((k) => k.bietetAn).map((k) => ({ datei: f.datei, komponente: k.name })),
);

// Stufe (2): die TRÄGER — transitive Hülle mit derselben Abbruchregel wie bisher („durchreichen
// oder besitzen"), aber am PARAMETER der Komponente abgelesen statt an einem Textmuster über die
// ganze Datei. Eine unbeteiligte Prop-Deklaration lässt jetzt keine Datei mehr durch, und ein
// Wrapper mit anders benanntem Prop wird nicht mehr falsch zugeordnet.
const TRAEGER: string[] = (() => {
  const menge = new Set(BAUTEILE.map((b) => b.komponente));
  for (let runde = 0; runde < 5; runde += 1) {
    let neu = 0;
    for (const f of ALLE_QUELLEN) {
      for (const e of f.einbindungen) {
        if (!menge.has(e.komponente) || !e.huelle || menge.has(e.huelle)) {
          continue;
        }
        if (f.komponenten.find((k) => k.name === e.huelle)?.eigenerTitel) {
          menge.add(e.huelle);
          neu += 1;
        }
      }
    }
    if (neu === 0) {
      break;
    }
  }
  return [...menge];
})();

interface Fund extends Einbindung {
  signatur: string;
  ordnung: number;
}

const FUNDE: Fund[] = (() => {
  const zaehler = new Map<string, number>();
  const out: Fund[] = [];
  for (const f of ALLE_QUELLEN) {
    for (const e of f.einbindungen) {
      // Die Komponente in ihrer eigenen Definition zu erwähnen ist keine Einbindung von außen.
      if (!TRAEGER.includes(e.komponente) || e.huelle === e.komponente) {
        continue;
      }
      const signatur = [...e.attribute].sort().join("+") + (e.spread ? "+{…spread}" : "");
      const basis = `${e.datei} › ${e.huelle ?? "(modulweit)"} › <${e.komponente}> [${signatur}] in [${e.ahnen}]`;
      const ordnung = (zaehler.get(basis) ?? 0) + 1;
      zaehler.set(basis, ordnung);
      out.push({ ...e, signatur, ordnung });
    }
  }
  return out;
})();

// ── AUFTRAG-mega86 Block C: STABILE FUNDIDENTITÄT UND GENAU EINE DISPOSITION ────────────────────
//
// DER BEFUND (ben, sammel84-mega85, GELB): `FUNDE.length >= 8` erkennt den heutigen Verlust, aber
// nach Wachstum KOMPENSIERT ein neuer Fund einen verschwundenen — neun auf acht bleibt grün. Eine
// Mindestzahl ist kein fail-closed je Instanz.
//
// Deshalb hat jetzt jeder Fund eine IDENTITÄT und genau eine DISPOSITION. Verschwindet ein bekannter
// Fund, wird das rot — UNABHÄNGIG von der Gesamtzahl. Taucht ein Fund ohne Disposition auf, ebenso.
//
// Die Identität ist absichtlich beschreibend statt kurz: Datei, umschließende Komponente, eingebundene
// Komponente, Prop-Liste und JSX-Nachbarschaft. Sie enthält KEINE Zeilennummer und keine
// Zeichenposition — die wandern bei jeder Bearbeitung und wären damit keine Identität, sondern
// Rauschen.
//
// DER PREIS, benannt: wer eine Einbindung umhängt (andere Nachbarschaft) oder ihr einen Prop gibt,
// ändert ihre Identität und wird hier rot. Das ist gewollt — es ist eine Nachfrage, keine Anklage,
// und die Antwort ist eine Zeile in dieser Tabelle. Lieber laut fragen als still danebenliegen.
const DISPOSITIONEN: Record<string, string> = {
  "apps/web/src/components/KnowledgeInputStudio.tsx › KnowledgeInputStudio › <RichTextEditor> [aiPanel+documentTitle+files+images+onAttachFiles+onChange+value] in [div<section<div<div] #1":
    "Das Studio rendert den Editor selbst und reicht den Titel des Beitrags durch — die Quelle, aus der die drei Studio-Einbindungen ihren Vertrag beziehen.",
  "apps/web/src/pages/Capture.tsx › Capture › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+enrichLocale+externalStage+images+onApply+onAttachFiles+onClose+open+runAssist] in [Field<div<ReasonerDraft<div] #1":
    "Erfassung, Studio-Weg im Reasoner-Entwurf: traegt die Bildbeschreibung ueber das Studio.",
  // AUFTRAG-PRO-337: Signatur um `captionFormRequest` erweitert. Diese Fläche band ihre
  // Bildergalerie ohne `onEditCaption` ein — der Galerieeinstieg fiel dort lautlos aus (der Prop ist
  // optional). Die Identität hat sich damit geändert, und genau das hat dieser Sammler gemeldet:
  // die Zeile ist ANGEPASST, nachdem hingesehen wurde — das Muster bleibt unverbogen.
  "apps/web/src/pages/Capture.tsx › Capture › <RichTextEditor> [captionFormRequest+documentTitle+images+onAttachFiles+onChange+value] in [Field<div<ReasonerDraft<div] #1":
    "Erfassung, direkter Editor im Reasoner-Entwurf. Seit PRO 337 nimmt er die Bitte der Bildergalerie derselben Flaeche entgegen.",
  // AUFTRAG-PRO-337: dieselbe Erweiterung an der zweiten Instanz derselben Datei.
  "apps/web/src/pages/Capture.tsx › Capture › <RichTextEditor> [aiPanel+captionFormRequest+documentTitle+images+onAttachFiles+onChange+value] in [div<div<Card<div] #1":
    "Erfassung, direkter Editor im Hauptformular (mit KI-Palette). Die zweite Instanz derselben Datei — genau die, die mega85 datei-genau nicht sehen konnte. Seit PRO 337 ebenfalls mit dem Galerieeinstieg verbunden.",
  "apps/web/src/pages/Capture.tsx › Capture › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+enrichLocale+externalStage+images+onApply+onAttachFiles+onClose+open+runAssist] in [div<Card<div<div] #1":
    "Erfassung, Studio-Weg aus dem Hauptformular. Prop-gleich zur Reasoner-Instanz und nur ueber die JSX-Nachbarschaft von ihr unterscheidbar — deshalb gehoert sie zur Identitaet.",
  // 10.08.2026, Zusammenfuehrung der GitHub-Linie: der Ahnenpfad hat sich von
  // [div<form<Card<div] auf [ImageDescribeProvider<div<form<Card] geaendert. Die Flaeche ist
  // dieselbe geblieben; ueber ihr steht jetzt der <ImageDescribeProvider> aus PR #1
  // („inherit document confidentiality"), der die Vertraulichkeit des Entwurfs an den Weg zur
  // Bildbeschreibung weiterreicht. Der Sammler hat das gemeldet, WEIL er es melden soll: eine
  // umgehaengte Einbindung ist ein Befund, bis jemand hingesehen hat. Hier ist hingesehen worden.
  "apps/web/src/pages/CaptureFrontDoor.tsx › CaptureFrontDoor › <RichTextEditor> [captionFormRequest+documentTitle+onChange+placeholder+value] in [ImageDescribeProvider<div<form<Card] #1":
    "Eingangstuer der Erfassung — die Flaeche, auf der Pedis Befund vom 31.07. entstand. Seit PR #1 unter dem ImageDescribeProvider, der die Vertraulichkeit des Entwurfs mitfuehrt.",
  "apps/web/src/pages/KnowledgeDetail.tsx › KnowledgeDetail › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+files+images+onApply+onClose+open+runAssist] in [Field<div<Card<div] #1":
    "Wissensobjekt bearbeiten, Studio-Weg.",
  "apps/web/src/pages/KnowledgeDetail.tsx › KnowledgeDetail › <RichTextEditor> [captionFormRequest+documentTitle+files+images+onChange+value] in [Field<div<Card<div] #1":
    "Wissensobjekt bearbeiten, direkter Editor.",
};

const identitaet = (f: Fund): string =>
  `${f.datei} › ${f.huelle ?? "(modulweit)"} › <${f.komponente}> [${f.signatur}] in [${f.ahnen}] #${f.ordnung}`;

const IDENTITAETEN = FUNDE.map(identitaet);

describe("mega86 Block C · Stufe 1+2: jeder Fund hat eine Identität und genau eine Disposition", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    expect(ALLE_QUELLEN.length).toBeGreaterThan(100);
    expect(BAUTEILE.map((b) => b.komponente)).toContain("RichTextEditor");
    // Negativ-Sonde: eine unbeteiligte Datei rutscht nicht herein.
    expect(BAUTEILE.map((b) => b.datei)).not.toContain("apps/web/src/lib/editorBlocks.ts");
    // Und die Erhebung sieht wirklich Bäume, nicht Zeilen: irgendeine Datei trägt JSX.
    expect(ALLE_QUELLEN.some((f) => f.einbindungen.length > 0)).toBe(true);
  });

  it("FAIL-CLOSED: ein BEKANNTER Fund, der verschwindet, wird rot — egal wie viele es insgesamt sind", () => {
    const verschwunden = Object.keys(DISPOSITIONEN).filter((id) => !IDENTITAETEN.includes(id));
    expect(
      verschwunden,
      "Diese Einbindungen der Bildbeschreibung standen in der Dispositionstabelle und sind nicht " +
        "mehr da. Das ist ein Befund, AUCH wenn die Gesamtzahl gleich geblieben ist — genau die " +
        "Kompensation, die eine Mindestzahl nicht sieht. Wurde die Fläche entfernt? Dann gehört die " +
        "Zeile aus der Tabelle. Wurde sie nur umgehängt oder umbenannt? Dann gehört die Zeile " +
        "angepasst — nachdem jemand hingesehen hat.",
    ).toEqual([]);
  });

  it("FAIL-CLOSED: ein NEUER Fund ohne Disposition wird rot", () => {
    const ohneUrteil = IDENTITAETEN.filter((id) => !DISPOSITIONEN[id]);
    expect(
      ohneUrteil,
      "Diese Einbindungen tragen die Bildbeschreibung, ohne dass jemand entschieden hätte, was mit " +
        "ihnen ist. Disposition in DISPOSITIONEN eintragen.",
    ).toEqual([]);
  });

  it("die Identität TRENNT wirklich — keine zwei Funde teilen sich eine", () => {
    // Ohne diese Sonde wäre nicht belegt, dass die Identität überhaupt unterscheidet: fielen zwei
    // Funde zusammen, deckte eine Disposition beide ab und der Austausch wäre wieder unsichtbar.
    expect(new Set(IDENTITAETEN).size).toBe(IDENTITAETEN.length);
    // Und heute reicht die Beschreibung ohne Ordnungszahl schon aus — jede Ordnungszahl ist 1.
    expect(FUNDE.map((f) => f.ordnung).filter((o) => o !== 1)).toEqual([]);
  });

  it("die transitive Ebene ist erhoben und klettert NICHT bis zum Anwendungsrahmen", () => {
    // Das Studio bietet die Beschreibung nicht an, TRÄGT sie aber. Fiele es aus der Hülle, verlöre
    // der Wächter drei Funde unbemerkt.
    expect(TRAEGER).toContain("KnowledgeInputStudio");
    // …und die Grenze hält: eine Route reicht keinen Dokument-Titel durch, sie führt zu der Seite,
    // die ihn erzeugt. Ohne diese Grenze wären `routes.tsx` und der Rahmen Fundstellen geworden.
    //
    // AUFTRAG-mega86 Block D: hier wurden die beiden Pfade bis mega85 aus Teilstücken ZUSAMMEN-
    // GESETZT, weil `tests/legal/mega61-rechtsseiten.test.tsx` den Rahmenpfad als reinen Text im
    // Dateiinhalt suchte und Erwähnung nicht von Import unterschied. Das Ausweichen war im engen
    // Auftrag vertretbar, drohte aber zur zweiten Wahrheit zu werden. Der Wächter erkennt jetzt
    // echte Importdeklarationen (TypeScript-Baum), also stehen die Pfade wieder da, wo man sie
    // lesen kann: im Klartext.
    const fundDateien = [...new Set(FUNDE.map((f) => f.datei))];
    expect(fundDateien).not.toContain("apps/web/src/routes.tsx");
    expect(fundDateien).not.toContain("apps/web/src/App.tsx");
    expect(TRAEGER).not.toContain("AppRoutes");
  });

  it("das VERHALTEN wird für JEDES erhobene Bauteil gefahren — sonst ist dieser Wächter unvollständig", () => {
    // Die Verhaltensstufe unten mountet `RichTextEditor`. Käme ein zweites Bauteil dazu, das die
    // Bildbeschreibung anbietet, wäre sein Verhalten ungeprüft — und das soll auffallen.
    const gefahren = ["RichTextEditor"];
    const ungefahren = BAUTEILE.map((b) => b.komponente).filter((k) => !gefahren.includes(k));
    expect(
      ungefahren,
      "Dieses Bauteil bietet die Bildbeschreibung an, aber sein Antwortverhalten wird von diesem " +
        "Wächter nicht gefahren. Entweder es kommt in die Verhaltensstufe unten, oder es ist gar " +
        "kein zweites Bauteil (dann gehört der Weg dorthin geführt statt nachgebaut).",
    ).toEqual([]);
  });

  it("AUFTRAG-mega84 Block C: JEDE EINZELNE Einbindung reicht den Titel durch", () => {
    // Der Titel ist Teil des Kontexts, den `collectImageContext` sammelt. Er kam über einen
    // OPTIONALEN Prop — Capture (2×) und KnowledgeDetail gaben ihn, CaptureFrontDoor und
    // KnowledgeInputStudio nicht. Geprüft wird die ATTRIBUTLISTE DIESER Einbindung, jetzt aus dem
    // Baum statt aus einem Zeichen-Zerteiler.
    const rohVon = new Map(ALLE_QUELLEN.map((f) => [f.datei, f.roh]));
    const ohneTitel = FUNDE.filter(
      (f) =>
        !f.attribute.includes("documentTitle") && !AUSNAHME_MUSTER.test(rohVon.get(f.datei) ?? ""),
    ).map(identitaet);
    expect(
      ohneTitel,
      "Diese EINBINDUNGEN tragen einen Editor mit Bildbeschreibung, reichen aber keinen " +
        "`documentTitle` durch — der KI-Vorschlag entsteht dort ohne den Titel des Beitrags. " +
        "Soll eine Fläche keinen haben, gehört das als `KEINE-BILDBESCHREIBUNG: <Grund>` in den Code.",
    ).toEqual([]);
  });

  it("ein SPREAD ist keine Blindstelle mehr, sondern ein Befund", () => {
    // mega85 nannte Spread als blind: `<RichTextEditor {...props} />` entging der Erhebung ganz.
    // Jetzt wird die Einbindung ERFASST; ob der Titel darin steckt, kann diese Erhebung nicht
    // wissen — also gilt sie als titellos und wird oben rot, bis jemand hinsieht.
    const mitSpread = FUNDE.filter((f) => f.spread).map(identitaet);
    expect(
      mitSpread,
      "Eine Einbindung reicht ihre Props gesammelt durch. Das ist erlaubt, aber dieser Wächter " +
        "kann den Titel darin nicht sehen — er gehört dann ausgeschrieben oder als " +
        "`KEINE-BILDBESCHREIBUNG: <Grund>` begründet.",
    ).toEqual([]);
    // Die Erhebung KANN Spread sehen — sonst wäre die Zusage oben ein leeres Versprechen.
    expect(
      ALLE_QUELLEN.some((f) => f.einbindungen.some((e) => e.spread)),
      "Nirgends im Web-Quellbaum steht ein JSX-Spread — dann prüft der Fall oben nichts.",
    ).toBe(true);
  });

  it("die Erhebung sieht auch `createElement` (der Textansatz sah es nicht)", () => {
    // Heute bindet kein Produktcode einen Träger so ein. Belegt wird deshalb die FÄHIGKEIT, an
    // einer Sonde — sonst stünde hier eine Zusage, die niemand geprüft hat.
    const sonde = liesQuelle(
      "sonde.tsx",
      "const a = createElement(RichTextEditor, { value: v, documentTitle: t });\n" +
        "const b = createElement(RichTextEditor, { value: v });\n",
    );
    expect(sonde.einbindungen.map((e) => e.komponente)).toEqual([
      "RichTextEditor",
      "RichTextEditor",
    ]);
    expect(sonde.einbindungen[0]?.attribute).toContain("documentTitle");
    expect(sonde.einbindungen[1]?.attribute).not.toContain("documentTitle");
  });

  it("die Attributliste gehört zum EINZELNEN Element (Negativ-Sonde an der Erhebung)", () => {
    // Der Nachfolger der mega85-Zerteiler-Sonde: ein Pfeil im ersten Element darf nicht auf das
    // zweite abfärben, und der Titel des zweiten nicht auf das erste.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export function Probe() {\n" +
        "  return (\n" +
        "    <div>\n" +
        "      <RichTextEditor value={v} onChange={(html: string) => setV(html)} />\n" +
        "      <RichTextEditor value={w} onChange={setW} documentTitle={titel} />\n" +
        "    </div>\n" +
        "  );\n" +
        "}\n",
    );
    const editoren = sonde.einbindungen.filter((e) => e.komponente === "RichTextEditor");
    expect(editoren).toHaveLength(2);
    expect(editoren[0]?.attribute).toEqual(["value", "onChange"]);
    expect(editoren[1]?.attribute).toContain("documentTitle");
    // Und die Hülle wird richtig zugeordnet — das konnte der Textansatz nicht.
    expect(editoren[0]?.huelle).toBe("Probe");
  });

  it("DIE VERBLEIBENDE GRENZE, benannt statt verschwiegen: Alias und Indirektion", () => {
    // `const E = RichTextEditor; <E />` und eine über eine Variable gereichte Komponente entgehen
    // dieser Erhebung weiterhin — dafür bräuchte es den Typprüfer, nicht nur den Syntaxbaum. Die
    // Grenze steht hier als FALL, damit sie nicht bloß Kommentar ist: die Sonde belegt, dass die
    // Erhebung den Alias wirklich nicht sieht. Zwei Dinge entschärfen sie: der Titel ist seit
    // mega85 PFLICHT-Parameter (ein Alias ohne ihn compiliert nicht), und ein Editor ohne Provider
    // wirft zur Laufzeit.
    const sonde = liesQuelle(
      "sonde.tsx",
      "const E = RichTextEditor;\nexport function Probe() {\n  return <E value={v} />;\n}\n",
    );
    expect(
      sonde.einbindungen.map((e) => e.komponente),
      "Die Erhebung sieht den Alias jetzt doch — dann ist diese Grenze weg und der Kommentar falsch.",
    ).toEqual(["E"]);
  });
});
// ── Stufe 3: das ANTWORTVERHALTEN ───────────────────────────────────────────────────────────────

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a">Vorhandene Beschreibung</figcaption></figure>';

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let lastHtml = "";

function Host() {
  const [value, setValue] = useState(FIGURE);
  lastHtml = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        lastHtml = html;
        setValue(html);
      },
    }),
  );
}

function mount(): void {
  lastHtml = FIGURE;
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  act(() => {
    r.render(createElement(Host));
  });
}

// Die Erhebungsstufen oben mounten nichts — der Abbau darf dort nicht in einen Fehler laufen und
// die eigentliche Aussage der Fälle überdecken.
afterEach(() => {
  const r = root;
  if (r) {
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Fläche wurde nicht gemountet");
  }
  return container;
}

function fussnote(): HTMLElement {
  const cap = flaeche().querySelector("figcaption");
  if (!(cap instanceof HTMLElement)) {
    throw new Error("Die Fläche rendert keine Bild-Fußnote");
  }
  return cap;
}

function formularfeld(): HTMLElement | null {
  const el = flaeche().querySelector("#caption-form-text");
  return el instanceof HTMLElement ? el : null;
}

describe("mega84 Block D · Stufe 3: von der Beschreibung führt ein bedienbarer Weg in das Formular", () => {
  it("MAUS: der Klick auf die Beschreibung öffnet das Formular für genau dieses Bild", () => {
    mount();
    expect(formularfeld()).toBeNull();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(
      formularfeld(),
      "Von der Bildbeschreibung führt kein Weg in das Formular — genau Pedis Befund vom 31.07.: " +
        "„da steht das graue Feld, und das ist alles, was passiert.“",
    ).not.toBeNull();
    // Für GENAU DIESES Bild: der vorhandene Text ist der Ausgangswert.
    expect(formularfeld()?.textContent).toBe("Vorhandene Beschreibung");
  });

  it("TASTATUR: gleichwertig — erreichbar, angekündigt, und Eingabetaste öffnet", () => {
    mount();
    const cap = fussnote();
    expect(
      cap.getAttribute("tabindex"),
      "die Beschreibung ist nicht mit der Tastatur erreichbar",
    ).toBe("0");
    expect(
      cap.getAttribute("role"),
      "die Beschreibung ist nicht als Bedienelement angekündigt",
    ).toBe("button");
    expect(cap.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.captionOpenLabel));
    act(() => {
      cap.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(formularfeld(), "der Tastaturweg ist dem Mausweg nicht gleichwertig").not.toBeNull();
  });

  it("das Formular trägt Textfeld, Formatierung, Vorschlagsknopf und Speichern", () => {
    mount();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Ein beschriftetes Textfeld …
    expect(formularfeld()).not.toBeNull();
    expect(flaeche().querySelector('label[for="caption-form-text"]')?.textContent).toBe(
      i18n.t(CAPTION_AI_TEXT.formLabel),
    );
    // … Formatierung (Pedis Umfang: fett, kursiv, Zeilenumbruch) in einer benannten Gruppe …
    expect(flaeche().querySelector("fieldset")?.getAttribute("aria-label")).toBe(
      i18n.t(CAPTION_AI_TEXT.formFormatLabel),
    );
    for (const testid of ["caption-form-bold", "caption-form-italic", "caption-form-linebreak"]) {
      expect(flaeche().querySelector(`[data-testid="${testid}"]`), testid).not.toBeNull();
    }
    // … der Vorschlagsknopf …
    expect(flaeche().querySelector('[data-testid="caption-form-suggest"]')).not.toBeNull();
    // … und Speichern.
    expect(flaeche().querySelector('[data-testid="caption-form-save"]')).not.toBeNull();
  });

  it("der Speicherpfad trägt die Formatierung wirklich bis in den Dokumentinhalt", () => {
    mount();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const feld = formularfeld();
    if (!feld) {
      throw new Error("Formularfeld fehlt");
    }
    act(() => {
      feld.innerHTML = "Der <strong>Dichtring</strong> am <em>Ventil</em>";
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      (flaeche().querySelector('[data-testid="caption-form-save"]') as HTMLElement).click();
    });
    expect(
      lastHtml,
      "Die Formatierung überlebt den Speicherpfad nicht — das Feld verspricht dann etwas, was das " +
        "Dokument nicht hält.",
    ).toContain("<strong>Dichtring</strong>");
    expect(lastHtml).toContain("<em>Ventil</em>");
  });

  it("es bleibt bei EINEM Formular und EINEM KI-Weg", () => {
    mount();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(flaeche().querySelectorAll("#caption-form-text")).toHaveLength(1);
    expect(flaeche().querySelectorAll('[data-testid="caption-form-suggest"]')).toHaveLength(1);
  });
});

// ================================================================================================
// JOB 1122 · DER VON-AUSSEN-TRÄGER UND DIE GRENZEN DER SYMBOLAUFLÖSUNG
// ================================================================================================
//
// WORAUS DAS FOLGT: BEN5 hat zu JOB 996/D2 GRÜN geurteilt und dabei fünf Prüflücken benannt, die
// ausdrücklich KEINE Korrekturpflicht sind. Vier davon schliesst dieser Block:
//
//   (1) „Den Aufruferpfad von `Stage2Notice.tsx:38` bis zum tatsächlich übergebenen `Icon`
//       erheben und die Ausnahme fachlich bestätigen oder auflösen."        → A
//   (3) „`export { default as X }`, `export { X as Y }` und zyklische `export *`-Ketten jeweils
//       auf kanonische Herkunft ODER FAIL-CLOSED BEFUND prüfen."            → B und C
//   (4) „Zwei disjunkte lokale Scopes mit gleichem Namen vorlegen und belegen, dass kein falsches
//       Endsymbol als erfolgreich gilt."                                    → D
//   sowie BEN5s Promptverbesserung: „Eine bekannte unauflösbare Stelle bleibt nur mit konkretem
//   Fundort, fachlicher Disposition und Test auf veralteten Eintrag zulässig." → E
//
// DAS ERGEBNIS VON A VORWEG, weil es die Lage ändert: Der einzige reale von-aussen-Träger ist
// NICHT unauflösbar. `GateFrame` nimmt sein Symbol als Parameter, aber beide Aufrufer stehen in
// derselben Datei und übergeben benannte Importe. Die Stelle braucht keine Ausnahme, sondern eine
// Auflösung — und genau die steht unten als Fall.

const STAGE2 = "apps/web/src/components/Stage2Notice.tsx";

/** Ein aufgelöstes Symbol: woher es kommt und wie es dort heisst. */
interface Symbolherkunft {
  /** `modul#name` bei aufgelösten Symbolen, sonst `null`. */
  kanonisch: string | null;
  /** Der im Aufruf geschriebene Name — nur Anzeige, nie Auswahlkriterium. */
  geschrieben: string;
}

/** Importtabelle einer Datei: geschriebener Name → `modul#exportname`. */
function importtabelle(baum: ts.SourceFile): Map<string, string> {
  const tabelle = new Map<string, string>();
  for (const anweisung of baum.statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) {
      continue;
    }
    const modul = anweisung.moduleSpecifier.text;
    const bindung = anweisung.importClause?.namedBindings;
    if (bindung && ts.isNamedImports(bindung)) {
      for (const el of bindung.elements) {
        // `import { X as Y }` → geschrieben Y, exportiert X.
        tabelle.set(el.name.text, `${modul}#${(el.propertyName ?? el.name).text}`);
      }
    }
    if (anweisung.importClause?.name) {
      tabelle.set(anweisung.importClause.name.text, `${modul}#default`);
    }
  }
  return tabelle;
}

/**
 * Erhebt, welche Symbole ein JSX-Attribut eines bestimmten Elements trägt.
 * Beispiel: `<GateFrame icon={Layers} …>` → Herkunft von `Layers`.
 */
function attributsymbole(datei: string, element: string, attribut: string): Symbolherkunft[] {
  const roh = readFileSync(join(WURZEL, datei), "utf8");
  const baum = ts.createSourceFile(datei, roh, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tabelle = importtabelle(baum);
  const gefunden: Symbolherkunft[] = [];

  const besuche = (knoten: ts.Node): void => {
    const offen =
      ts.isJsxSelfClosingElement(knoten) || ts.isJsxOpeningElement(knoten) ? knoten : null;
    if (offen && tagName(offen) === element) {
      for (const eigenschaft of offen.attributes.properties) {
        if (!ts.isJsxAttribute(eigenschaft) || eigenschaft.name.getText(baum) !== attribut) {
          continue;
        }
        const wert = eigenschaft.initializer;
        // Nur ein blosser Bezeichner ist auflösbar. Ein Ausdruck (Ternär, Aufruf, Feldzugriff)
        // bleibt fail-closed unaufgelöst — er kann zur Laufzeit alles sein.
        if (
          wert &&
          ts.isJsxExpression(wert) &&
          wert.expression &&
          ts.isIdentifier(wert.expression)
        ) {
          const name = wert.expression.text;
          gefunden.push({ kanonisch: tabelle.get(name) ?? null, geschrieben: name });
        } else {
          gefunden.push({ kanonisch: null, geschrieben: wert ? wert.getText(baum) : "(leer)" });
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return gefunden;
}

// ── E · Register bekannter unauflösbarer Stellen ────────────────────────────────────────────────
// BEN5 verlangt für JEDEN Eintrag: konkreter Fundort, fachliche Disposition und ein Test, der den
// Eintrag rot macht, sobald er veraltet ist. Das Register ist LEER — nicht weil niemand hingesehen
// hat, sondern weil der einzige Kandidat in A aufgelöst wurde.
const UNAUFLOESBAR_BEKANNT: Record<string, string> = {};

describe("JOB 1122 · A: der reale von-aussen-Träger ist bis zum übergebenen Symbol aufgelöst", () => {
  it("GateFrame nimmt sein Symbol als Parameter und rendert es an genau einer Stelle", () => {
    // Die Ausgangslage, die BEN5 als unauflösbar geführt hat: `<Icon size={28} …>` bezieht sein
    // Symbol nicht aus einem Import, sondern aus dem Parameter `icon`. Syntaktisch endet die
    // Erhebung hier — deshalb galt die Stelle als von-aussen.
    const roh = readFileSync(join(WURZEL, STAGE2), "utf8");
    expect(roh, "GateFrame benennt seinen Symbolparameter nicht mehr `icon: Icon`.").toContain(
      "icon: Icon,",
    );
    expect(roh, "Das durchgereichte Symbol wird nicht mehr als <Icon> gerendert.").toContain(
      "<Icon size={28}",
    );
  });

  it("beide Aufrufer übergeben ein benanntes, importiertes Symbol — nichts bleibt offen", () => {
    const symbole = attributsymbole(STAGE2, "GateFrame", "icon");

    expect(
      symbole.length,
      "Die Zahl der GateFrame-Aufrufer hat sich geändert. Jeder neue Aufrufer braucht eine eigene Auflösung.",
    ).toBe(2);

    const offen = symbole.filter((s) => s.kanonisch === null);
    expect(
      offen.map((s) => s.geschrieben),
      "Ein GateFrame-Aufrufer übergibt ein Symbol, das nicht auf einen Import zurückführbar ist. Fail-closed: solange das so ist, ist der Träger nicht aufgelöst.",
    ).toEqual([]);
  });

  it("die aufgelösten Symbole sind genau die beiden Torsymbole aus lucide-react", () => {
    const kanonisch = attributsymbole(STAGE2, "GateFrame", "icon")
      .map((s) => s.kanonisch)
      .sort();

    // Das ist die fachliche Auflösung der Prüflücke 1: Stufe-2-Tor trägt `Layers`, Rollentor `Lock`.
    expect(kanonisch).toEqual(["lucide-react#Layers", "lucide-react#Lock"]);
  });

  it("die Auflösung hängt am Import, nicht am geschriebenen Namen", () => {
    // Gegenprobe an einer Sonde: derselbe geschriebene Name, andere Herkunft — die Auflösung
    // muss der Herkunft folgen. Sonst wäre der Name wieder die Wahrheit, und genau das hat
    // JOB 996 abgelöst.
    const baum = ts.createSourceFile(
      "sonde.tsx",
      'import { Lock as Layers } from "andere-quelle";\nexport function P() {\n  return <GateFrame icon={Layers} />;\n}\n',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const tabelle = importtabelle(baum);
    expect(
      tabelle.get("Layers"),
      "Der Alias wird nicht auf sein Exportsymbol zurückgeführt — dann trägt wieder der geschriebene Name die Auswahl.",
    ).toBe("andere-quelle#Lock");
  });
});

describe("JOB 1122 · B: Weiterexport-Formen sind kalibriert, nicht stillschweigend übergangen", () => {
  // BEN5-Prüflücke 3, erste Hälfte. Der heutige Sammler löst Weiterexporte NICHT auf — das ist
  // eine bekannte Grenze (siehe „DIE VERBLEIBENDE GRENZE" oben). Diese Fälle halten sie fest,
  // damit sie ein BEFUND bleibt und nicht zur stillen Annahme wird.
  const FORMEN: { name: string; quelle: string }[] = [
    {
      name: "export { default as X }",
      quelle: 'export { default as RichTextEditor } from "./RichTextEditor";\n',
    },
    {
      name: "export { X as Y }",
      quelle: 'export { RichTextEditor as Editor } from "./RichTextEditor";\n',
    },
  ];

  for (const form of FORMEN) {
    it(`${form.name}: die Erhebung meldet keine Einbindung — die Form ist kein stiller Träger`, () => {
      const sonde = liesQuelle("barrel.ts", form.quelle);

      // Fail-closed heisst hier: ein Weiterexport ist KEINE Einbindung und darf auch keine
      // vortäuschen. Würde die Erhebung hier etwas melden, wäre die Fundmenge unecht.
      expect(
        sonde.einbindungen,
        `Die Erhebung erzeugt aus "${form.name}" eine Einbindung. Ein Weiterexport bindet nichts ein.`,
      ).toEqual([]);
      expect(
        sonde.komponenten.map((k) => k.name),
        `Die Erhebung hält "${form.name}" für eine Komponentendefinition.`,
      ).toEqual([]);
    });
  }

  it("ein Weiterexport verdeckt eine echte Einbindung derselben Datei nicht", () => {
    // Kalibrierung in die Gegenrichtung: neben dem Weiterexport steht eine echte Einbindung.
    // Sie muss weiterhin gefunden werden — sonst prüfte der Fall oben nur Blindheit.
    const sonde = liesQuelle(
      "gemischt.tsx",
      'export { RichTextEditor as Editor } from "./RichTextEditor";\n' +
        "export function Probe() {\n  return <RichTextEditor value={v} documentTitle={t} />;\n}\n",
    );
    expect(sonde.einbindungen.map((e) => e.komponente)).toEqual(["RichTextEditor"]);
    expect(sonde.einbindungen[0]?.huelle).toBe("Probe");
  });
});

describe("JOB 1122 · C: zyklische Barrel-Ketten enden in einem Befund, nicht in einer Schleife", () => {
  // BEN5-Prüflücke 3, zweite Hälfte. Ein Zyklus `a → b → a` darf die Erhebung weder aufhängen
  // noch ein Endsymbol erfinden.
  it("eine zyklische export-*-Kette wird ohne Endlosgang und ohne erfundenes Ziel gelesen", () => {
    const a = liesQuelle("a.ts", 'export * from "./b";\n');
    const b = liesQuelle("b.ts", 'export * from "./a";\n');

    for (const [name, quelle] of [
      ["a.ts", a],
      ["b.ts", b],
    ] as const) {
      expect(quelle.einbindungen, `${name} erzeugt aus einem Zyklus eine Einbindung.`).toEqual([]);
      expect(quelle.komponenten, `${name} erzeugt aus einem Zyklus eine Komponente.`).toEqual([]);
    }
  });

  it("ein Zyklus mit echter Einbindung dazwischen verliert die Einbindung nicht", () => {
    const gemischt = liesQuelle(
      "zyklisch.tsx",
      'export * from "./a";\n' +
        "export function Probe() {\n  return <RichTextEditor value={v} documentTitle={t} />;\n}\n" +
        'export * from "./b";\n',
    );
    expect(gemischt.einbindungen.map((e) => e.komponente)).toEqual(["RichTextEditor"]);
  });
});

describe("JOB 1122 · D: disjunkte lokale Scopes erzeugen kein falsches Endsymbol", () => {
  // BEN5-Prüflücke 4. Zwei Funktionen, in beiden eine lokale Komponente gleichen Namens. Die
  // Erhebung ist absichtlich nicht scopegenau — sie darf deshalb keine der beiden Einbindungen
  // der falschen Hülle zuordnen und keine als „aufgelöst" ausgeben.
  const ZWEI_SCOPES =
    "export function Eins() {\n" +
    "  const Panel = () => <div />;\n" +
    "  return <Panel value={a} />;\n" +
    "}\n" +
    "export function Zwei() {\n" +
    "  const Panel = () => <span />;\n" +
    "  return <Panel value={b} />;\n" +
    "}\n";

  it("jede Einbindung bleibt bei ihrer eigenen Hülle", () => {
    const sonde = liesQuelle("scopes.tsx", ZWEI_SCOPES);
    const panels = sonde.einbindungen.filter((e) => e.komponente === "Panel");

    expect(panels.length, "Nicht beide Panel-Einbindungen erhoben.").toBe(2);
    expect(
      panels.map((e) => e.huelle).sort(),
      "Eine Einbindung wurde der falschen Hülle zugeordnet — dann wäre die Fundidentität falsch.",
    ).toEqual(["Eins", "Zwei"]);
  });

  it("gleichnamige lokale Symbole werden nicht zu EINEM Symbol verschmolzen", () => {
    const sonde = liesQuelle("scopes.tsx", ZWEI_SCOPES);
    const panels = sonde.einbindungen.filter((e) => e.komponente === "Panel");

    // Ein lokales `Panel` steht in keiner Importtabelle. Genau deshalb darf es nie als kanonisch
    // aufgelöst gelten — sonst würde ein Name aus Scope A als Symbol aus Scope B verkauft.
    const baum = ts.createSourceFile(
      "scopes.tsx",
      ZWEI_SCOPES,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(
      importtabelle(baum).get("Panel"),
      "Ein lokal deklariertes Symbol taucht in der Importtabelle auf — dann ist die Herkunft erfunden.",
    ).toBeUndefined();

    // Und die beiden bleiben durch ihre Hülle unterscheidbar, obwohl sie gleich heissen.
    expect(new Set(panels.map((e) => e.huelle)).size).toBe(2);
  });
});

describe("JOB 1122 · E: bekannte Ausnahmen tragen Fundort, Disposition und Veraltungstest", () => {
  it("jeder Eintrag im Ausnahmeregister nennt einen realen Fundort und eine Disposition", () => {
    for (const [fundort, disposition] of Object.entries(UNAUFLOESBAR_BEKANNT)) {
      expect(fundort, "Ein Registereintrag ohne Dateipfad ist kein Fundort.").toContain(
        "apps/web/src/",
      );
      expect(
        disposition.length,
        `Der Eintrag "${fundort}" trägt keine fachliche Disposition.`,
      ).toBeGreaterThan(30);
      // Der Veraltungstest: die genannte Datei muss es geben. Ein Eintrag auf eine verschwundene
      // Datei ist ein veralteter Eintrag und wird rot.
      const datei = fundort.split(" ")[0] ?? "";
      expect(
        existsSync(join(WURZEL, datei)),
        `Der Registereintrag zeigt auf "${datei}", das es nicht mehr gibt — veralteter Eintrag.`,
      ).toBe(true);
    }
  });

  it("das Register ist leer, weil der einzige Kandidat aufgelöst wurde", () => {
    // Diese Zusicherung ist der sichtbare Unterschied zu JOB 996: dort war der Stage2Notice-Fall
    // über eine Ausnahme dispositioniert. Käme er zurück ins Register, ohne dass Block A rot wird,
    // wäre eine Auflösung stillschweigend gegen eine Ausnahme getauscht worden.
    expect(
      Object.keys(UNAUFLOESBAR_BEKANNT),
      "Es gibt wieder bekannte unauflösbare Stellen. Jede braucht Fundort, Disposition und den Nachweis, dass sie nicht auflösbar ist.",
    ).toEqual([]);
  });
});
