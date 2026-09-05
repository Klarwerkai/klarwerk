import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-smoketor BLOCK A — DER ANKER, DEN ES NIE GAB.
// ================================================================================================
//
// DER BEFUND. `apps/web/src/pages/Ask.tsx:712` schreibt `data-testid="ask-answer"` an `<Card>`,
// Zeile 1080 dasselbe mit `ask-gap`. `Card` (apps/web/src/components/ui.tsx) nahm in seiner
// Signatur aber nur `children`, `className`, `id`, `onClick` und `interactive` entgegen und reichte
// KEINE Restattribute an das DOM durch. Beide Anker entstanden also nie — obwohl die Antwort
// nachweislich rendert. Drei Fälle des Browser-Smoke hingen daran, in allen drei Engines.
//
// WARUM DAS STILL BLIEB, und das ist der eigentliche Lehrsatz: TypeScript prüft JSX-Attribute,
// deren Name kein gültiger Bezeichner ist (alles mit Bindestrich — `data-*`, `aria-*`), NICHT gegen
// den Props-Typ der Komponente. `<Card data-testid="…">` kompiliert deshalb fehlerfrei und tut
// nichts. Weder Compiler noch Lint noch Typprüfung können diese Klasse sehen; nur eine Bühne, die
// ins DOM schaut, sieht sie. Genau das ist dieser Sammler.
//
// DIE BAUFORM ist die von mega86/mega88, weil sie sich getragen hat:
//   · Die Grundmenge wird AUTORITATIV aus dem TypeScript-Baum ERHOBEN, nicht als Namensliste
//     gepflegt. Eine neue Aufrufstelle an einer neuen Komponente taucht von selbst auf.
//   · Gepinnt wird ANTWORTVERHALTEN, nicht Namensanwesenheit: Stufe 2 RENDERT jede erhobene
//     Komponente wirklich und MISST im DOM, ob das Attribut ankommt.
//   · Kein Fund ohne Urteil: eine erhobene Komponente ohne DOM-Probe macht den Sammler rot. Es gibt
//     keine Mindestzahl und keine stille Ausnahme.
import { afterEach, describe, expect, it } from "vitest";
// JOB 3065 H6: die Zeilenkarte der Einstellungen markiert ihr Chevron und ihr Schloss mit
// `data-einst`, damit die Chromium-Messung sie findet. Beides sind Symbole aus `lucide-react` —
// also Komponenten, und damit genau die Bauform, die dieser Sammler nicht glauben, sondern messen
// will. Die Proben unten rendern sie und schauen nach, ob das Attribut im SVG ankommt.
import { ChevronRight, Lock } from "../../apps/web/node_modules/lucide-react";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Link, MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { GuardedLink, NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { Button, Card } from "../../apps/web/src/components/ui";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const QUELLBAUM = "apps/web/src";

// ------------------------------------------------------------------------------------------------
// STUFE 1 — DIE ERHEBUNG. Wo im Produktbaum steht ein `data-*` DIREKT an einem Komponenten-Tag?
// ------------------------------------------------------------------------------------------------
// Bewusst über den echten TypeScript-Parser und nicht über einen Textabgleich: ein `data-help`, das
// in einem verschachtelten `<span>` innerhalb eines `label={…}`-Props sitzt, ist KEINE Aufrufstelle
// an der Komponente und darf hier nicht auftauchen. Eine Regex über den Öffnungstag verwechselt
// beides (in der Vorarbeit zu diesem Auftrag genau so passiert: vier Falschtreffer).
interface Aufrufstelle {
  datei: string;
  zeile: number;
  komponente: string;
  attribute: string[];
}

function tsxDateien(verzeichnis: string, gesammelt: string[] = []): string[] {
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      tsxDateien(pfad, gesammelt);
    } else if (pfad.endsWith(".tsx")) {
      gesammelt.push(pfad);
    }
  }
  return gesammelt;
}

function erhebeAufrufstellen(): Aufrufstelle[] {
  const stellen: Aufrufstelle[] = [];
  for (const datei of tsxDateien(QUELLBAUM)) {
    const quelle = readFileSync(datei, "utf8");
    const baum = ts.createSourceFile(
      datei,
      quelle,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const besuche = (knoten: ts.Node): void => {
      if (ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) {
        const tag = knoten.tagName.getText(baum);
        // Grossbuchstabe = Komponente. Kleingeschriebene Tags sind intrinsische DOM-Elemente; dort
        // trägt React `data-*` immer, und der Compiler prüft sie sogar.
        if (/^[A-Z]/.test(tag)) {
          const attribute = knoten.attributes.properties
            .filter(
              (attribut): attribut is ts.JsxAttribute =>
                ts.isJsxAttribute(attribut) && attribut.name.getText(baum).startsWith("data-"),
            )
            .map((attribut) => attribut.name.getText(baum));
          if (attribute.length > 0) {
            const { line } = baum.getLineAndCharacterOfPosition(knoten.getStart(baum));
            stellen.push({ datei, zeile: line + 1, komponente: tag, attribute });
          }
        }
      }
      ts.forEachChild(knoten, besuche);
    };
    besuche(baum);
  }
  return stellen;
}

// ------------------------------------------------------------------------------------------------
// STUFE 2 — DAS URTEIL. Jede erhobene Komponente wird GERENDERT und im DOM gemessen.
// ------------------------------------------------------------------------------------------------
// Eine Probe ist kein Eintrag in einer Erlaubnisliste: sie baut das Bauteil wirklich und schaut
// nach, ob das Attribut im Dokument ankommt. Verliert eine Komponente ihre Durchreichung, wird
// GENAU DIESE Probe rot — unabhängig davon, ob ihr Name irgendwo weitersteht.
const ANKER = "smoketor-sonde";

// ZWEI Eigenheiten der Schreibweise, beide notwendig und beide harmlos für die Aussage:
//
//   · `children` steht IN den Props statt als drittes `createElement`-Argument — für einen Props-Typ
//     mit erforderlichem `children` erkennt TypeScript die Kindform dort nicht an (TS2769).
//   · Die Props werden als benannte VARIABLE gereicht. Bei einem direkten Objektliteral greift der
//     Excess-Property-Check und lehnt `data-testid` an `LinkProps` ab; über eine Variable entfällt
//     er. Das ist idiomatisches TypeScript, kein Cast, und ändert am gerenderten Ergebnis nichts.
//     Nebenbei zeigt genau dieser Unterschied den Mechanismus hinter dem Befund: in JSX — der Form,
//     in der die Aufrufstellen im Produktbaum stehen — prüft TypeScript Attribute mit Bindestrich
//     ÜBERHAUPT NICHT gegen den Props-Typ. Deshalb kann `<Card data-testid>` kompilieren und
//     trotzdem folgenlos bleiben.
const kartenProbe = { "data-testid": ANKER, children: "Inhalt" };
const knopfProbe = { "data-testid": ANKER, children: "Inhalt" };
const linkProbe = { to: "/start", "data-testid": ANKER, children: "Inhalt" };
const askAnswerProbe = { "data-testid": "ask-answer", children: "Antwort" };
const hilfeProbe = { "data-help": "cap:x", children: "Inhalt" };
// Symbole tragen keine Kinder — die Probe ist das Attribut plus die Größe. Die Größe steht nicht
// zur Zierde da: ohne mindestens EINE bekannte Eigenschaft lehnt TypeScript das Objekt an
// `LucideProps` ab („has no properties in common"), und genau daran zeigt sich noch einmal der
// Befund dieses Sammlers — in JSX prüft TypeScript Attribute mit Bindestrich gar nicht.
const symbolProbe = { size: 13, "data-testid": ANKER };

const PROBEN: Record<string, () => ReactNode> = {
  Card: () => createElement(Card, kartenProbe),
  Button: () => createElement(Button, knopfProbe),
  Link: () => createElement(MemoryRouter, { children: createElement(Link, linkProbe) }),
  // GuardedLink stellt die Dirty-Frage und braucht dafür seinen Provider — die Probe baut ihn mit
  // auf, statt die Komponente in einer Umgebung zu messen, in der sie nie läuft.
  GuardedLink: () =>
    createElement(MemoryRouter, {
      children: createElement(NavGuardProvider, {
        children: createElement(GuardedLink, linkProbe),
      }),
    }),
  // JOB 3065 H6: die beiden Symbole der Zeilenkarte (Chevron = führt weiter, Schloss = nur lesbar).
  ChevronRight: () => createElement(ChevronRight, symbolProbe),
  Lock: () => createElement(Lock, symbolProbe),
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function rendere(element: ReactNode): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
});

describe("AUFTRAG-smoketor A — ein Testanker an einer Komponente muss im DOM ankommen", () => {
  // ----------------------------------------------------------------------------------------------
  // DIE BÜHNE, die den Anker SIEHT statt seine Absicht im Quelltext zu lesen. Das ist der Fall, der
  // vor der Reparatur fehlschlägt: `Card` verschluckte das Attribut lautlos.
  // ----------------------------------------------------------------------------------------------
  it("Card trägt data-testid ins DOM (die beiden Ask-Anker ask-answer/ask-gap hängen daran)", () => {
    const gerendert = rendere(createElement(Card, askAnswerProbe));
    // Gegenprobe zuerst: die Karte ist wirklich da. Sonst wäre ein fehlender Anker unten nicht von
    // „gar nichts gerendert" zu unterscheiden.
    expect(gerendert.textContent, "die Karte selbst rendert nicht").toContain("Antwort");
    expect(
      gerendert.querySelector('[data-testid="ask-answer"]'),
      "Card verschluckt data-testid: der Anker `ask-answer` (Ask.tsx:712) entsteht im DOM nie, obwohl er im Quelltext steht",
    ).not.toBeNull();
  });

  it("Card trägt beliebige data-* durch, nicht nur data-testid", () => {
    const gerendert = rendere(createElement(Card, hilfeProbe));
    expect(
      gerendert.querySelector('[data-help="cap:x"]'),
      "Card reicht nur einen Sonderfall durch statt der ganzen data-*-Familie",
    ).not.toBeNull();
  });

  // ----------------------------------------------------------------------------------------------
  // DER SAMMLER. Kein erhobener Aufruf ohne Urteil, und jedes Urteil ist eine DOM-Messung.
  // ----------------------------------------------------------------------------------------------
  it("jede Komponente, an der der Produktbaum ein data-* setzt, hat eine DOM-Probe", () => {
    const stellen = erhebeAufrufstellen();
    // Die Erhebung selbst muss etwas finden — sonst wäre das Urteil unten trivial erfüllt.
    expect(stellen.length, "die AST-Erhebung findet gar keine Aufrufstelle mehr").toBeGreaterThan(
      0,
    );
    const ohneProbe = [...new Set(stellen.map((stelle) => stelle.komponente))]
      .filter((komponente) => PROBEN[komponente] === undefined)
      .sort();
    expect(
      ohneProbe,
      `neue Aufrufstelle an einer Komponente ohne DOM-Probe: ${ohneProbe.join(", ")} — belege mit einer Probe, dass sie data-* ins DOM trägt, statt es anzunehmen`,
    ).toEqual([]);
  });

  for (const [komponente, probe] of Object.entries(PROBEN)) {
    it(`${komponente} reicht data-testid ins DOM durch`, () => {
      expect(
        rendere(probe()).querySelector(`[data-testid="${ANKER}"]`),
        `<${komponente} data-testid> kommt im DOM nicht an — TypeScript prüft Attribute mit Bindestrich nicht gegen den Props-Typ, der Aufruf kompiliert also und verpufft`,
      ).not.toBeNull();
    });
  }
});
