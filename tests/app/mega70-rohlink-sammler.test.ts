// ================================================================================================
// AUFTRAG-mega70 BLOCK D — KEIN BEWACHTES ZIEL WIRD ÜBER EINEN ROHEN LINK ZUM WEG.
// ================================================================================================
// bens Befund (sammel66-vortest, ROT): vier sichtbare Stellen boten der Testerin einen Weg an,
// den ihre Rolle nicht gehen darf — der Router warf sie kommentarlos auf /start zurück. Dieser
// Sammler hält die Bauform fest, damit die fünfte Stelle nicht morgen entsteht: ein Ziel aus der
// bewachten Menge (GUARDED_ITEMS) darf auf diesen Flächen nur über das EINE Tor (RoleLink)
// angeboten werden, das die Rollenfrage an derselben Registry stellt wie der Router.
//
// ER IST EIN SAMMLER, KEINE LISTE. Erhoben wird in vier Stufen, und keine zählt Fälle:
//  (0) DIE FLÄCHEN samt ihrer Rollenschwelle — aus routes.tsx (PAGES) + GUARDED_ITEMS, nicht
//      abgeschrieben: welche Nav-Ids eine Datei rendert und ab welcher Rolle die Fläche selbst
//      erreichbar ist.
//  (1) DIE VORKOMMEN — jedes `to=` im Quelltext (Kommentare entfernt, Zeilennummern erhalten)
//      samt dem Tag, das es trägt (<Link>/<GuardedLink>/<RoleLink>/…). Ein `to=` an einem
//      unbekannten Tag ist rot und wird wörtlich zitiert, statt still aus der Erhebung zu fallen.
//  (2) DIE ZIELE — Literale und Templates direkt; jeder andere Ausdruck braucht eine BENANNTE
//      Herkunft, deren Zielmenge aus den produktiven Tabellen/Funktionen GELESEN wird
//      (knowledgeGuidance, libraryUseCta, ownKnowledgeEmptyHint, captureNextSteps, askAnswerHref).
//      Ein unbekannter Ausdruck ist rot und wird wörtlich zitiert.
//  (3) DIE ZUSAGE — für jede Rolle, die die Fläche selbst sehen darf: jedes Ziel eines ROHEN
//      Links (alles außer RoleLink) muss `routePathAllows` bestehen — dieselbe Registry, aus der
//      der Router sein Gate zieht. RoleLink-Vorkommen sind der erlaubte Weg: das Tor rendert
//      Unerreichbares als Lage (bewiesen in components/RoleLink.tsx + mega51-mounted).
//
// GELTUNGSBEREICH: die beiden Flächen aus mega70 — pages/Library.tsx und pages/Capture.tsx —
// PLUS seit AUFTRAG-mega71 Block E pages/Ask.tsx: die Fläche war in mega70 nur durch die
// mega69-Dateisperre ausgenommen (eine Auftragsgrenze, keine fachliche), und ihre fünf Fund-
// stellen (reviewGuard→/validierung, kg("ask")→/validierung, /konflikte, /risiko,
// captureGapHref→/erfassen) liegen auf dem Weg der Vortest-Aufgabe 3. Bewusst weiterhin ENGER
// als „alle Seiten“, damit die Prüfung nicht falsch anschlägt und in zwei Wochen abgeschaltet
// wird. Benannte Blindheit (es gibt sie immer; verschwiegen wird sie zur Falle):
//  1. ANDERE SEITEN. /start hält mega51-startziele-erreichbar-sammler, die Shell
//     shell-links-guarded. Die 26 weiteren Kandidaten der app-weiten Erhebung (mega70-Bericht)
//     sind als Folgearbeit im Register vermerkt und werden NACH dem Vortest angefasst.
//  2. EINE EBENE. Bauteile, die die Seiten einbinden, sind nicht erfasst (Capture bindet ~30 ein;
//     deren Ausdrücke bräuchten je eine Herkunft — Rauschen). Ein Link in einem Bauteil wäre der
//     nächste Befund, nicht dieser.
//  3. `<a href>`-Anker sind nicht erfasst — sie tragen in beiden Dateien Download-/API-URLs,
//     keine Router-Ziele.
//  4. QUELLTEXT, KEIN VERHALTEN. Dass die gesperrte Fassung wirklich keine <a href> rendert,
//     beweisen RoleLink.tsx (ein <Link> nur im erlaubten Zweig, gepinnt in mega51 A3) und der
//     gemountete mega51-Fall.
// ================================================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  GUARDED_ITEMS,
  ROLES,
  type Role,
  roleAllows,
  routePathAllows,
} from "../../apps/web/src/app/navigation";
import { askAnswerHref } from "../../apps/web/src/lib/askQuestion";
// AUFTRAG-mega71 Block E: die benannten Herkünfte der Ask-Fläche — die Zielmengen werden aus den
// PRODUKTIVEN Funktionen gelesen, nicht abgeschrieben (Stufe-2-Regel dieses Sammlers).
import { answerReviewGuard } from "../../apps/web/src/lib/askView";
import { captureGapHref } from "../../apps/web/src/lib/captureFromGap";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { captureNextSteps } from "../../apps/web/src/lib/captureSuccess";
import { OWN_KNOWLEDGE_FILTER, ownKnowledgeEmptyHint } from "../../apps/web/src/lib/demoKnowledge";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { libraryUseCta } from "../../apps/web/src/lib/libraryMaturity";

const WEB_SRC = join(__dirname, "../../apps/web/src");
const lies = (p: string): string => readFileSync(p, "utf8");

// Kommentare raus, Zeilennummern ERHALTEN (Zeichen durch Leerzeichen ersetzen, Zeilen stehen lassen)
// — eine Erwähnung („hier stand ein rohes <Link>") zählt nicht als Treffer, aber Fundstellen bleiben
// zitierfähig.
function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

function zeileVon(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

// ── Stufe 0: die Flächen samt Rollenschwelle — aus routes.tsx erhoben, nicht abgeschrieben ──────
const FLAECHEN = ["Library", "Capture", "Ask"] as const;

const routesQuelle = ohneKommentare(lies(join(WEB_SRC, "routes.tsx")));

// Welche Nav-Ids rendert eine Seiten-Datei? Komponente aus der Seitenbindung in routes.tsx +
// `id: Komponente` in PAGES.
//
// JOB 3030: Bis zur Umstellung stand die Bindung als statische Importzeile
// (`import { Library } from "./pages/Library"`); seit die Seiten nachgeladen werden, steht sie als
// `const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));`.
// Die ERHEBUNG bleibt dieselbe und bleibt an routes.tsx gebunden — nur die Form der Bindung ist eine
// andere. `[^;]*?` begrenzt den Treffer auf GENAU eine Deklaration: ohne diese Grenze könnte der
// Ausdruck über das nächste Semikolon hinauslaufen und einer Seite eine fremde Komponente zuordnen.
function navIdsVonSeite(datei: string): string[] {
  const komponenten = [
    ...routesQuelle.matchAll(
      new RegExp(
        `const\\s+([A-Za-z0-9]+)\\s*=\\s*lazy\\([^;]*?import\\("\\./pages/${datei}"\\)`,
        "g",
      ),
    ),
  ].map((m) => m[1] as string);
  if (komponenten.length === 0) {
    return [];
  }
  return [...routesQuelle.matchAll(/^\s*([A-Za-z0-9]+):\s*([A-Za-z0-9]+),\s*$/gm)]
    .filter((m) => komponenten.includes(m[2] as string))
    .map((m) => m[1] as string);
}

// Ab welcher Rolle ist die Fläche selbst erreichbar? (Die Registry des Routers, keine zweite Tabelle.)
function rollenDerFlaeche(datei: string): Role[] {
  const ids = navIdsVonSeite(datei);
  const items = GUARDED_ITEMS.filter((i) => ids.includes(i.id));
  if (items.length === 0) {
    throw new Error(`Fläche ${datei} hat kein Nav-Item — die Erhebung liefe still leer`);
  }
  return ROLES.filter((rolle) => items.some((item) => roleAllows(item, rolle as Role))) as Role[];
}

// ── Stufe 2 (Vorbereitung): benannte Herkunft je to=-Ausdruck, Ziele aus den Produkttabellen ────
// Minimal-KOs nur so weit, wie libraryUseCta sie wirklich liest (Status → Reife-Abzweig).
const OFFENES_KO = { status: "offen" } as unknown as KnowledgeObject;
const VALIDIERTES_KO = { status: "validiert" } as unknown as KnowledgeObject;

interface Herkunft {
  muster: RegExp;
  herkunft: string;
  ziele: () => string[];
}

const HERKUNFT: Record<(typeof FLAECHEN)[number], Herkunft[]> = {
  Library: [
    {
      muster: /^askAnswerHref\(trimmedQ\)$/,
      herkunft: "lib/askQuestion.ts · askAnswerHref",
      ziele: () => [askAnswerHref("frage")],
    },
    {
      muster: /^item\.to$/,
      herkunft: "lib/knowledgeGuidance.ts · knowledgeGuidance(library)",
      ziele: () => knowledgeGuidance("library").items.map((i) => i.to),
    },
    {
      muster: /^ownEmpty\.to$/,
      herkunft: "lib/demoKnowledge.ts · ownKnowledgeEmptyHint",
      ziele: () => {
        const hint = ownKnowledgeEmptyHint({ filter: OWN_KNOWLEDGE_FILTER, count: 0 });
        return hint ? [hint.to] : [];
      },
    },
    {
      muster: /^demoHref\(useCta\.href, params\)$/,
      herkunft: "lib/libraryMaturity.ts · libraryUseCta + Konflikt-Abzweig (/konflikte)",
      ziele: () => [
        libraryUseCta(OFFENES_KO).href,
        libraryUseCta(VALIDIERTES_KO, "Was gilt?").href,
        "/konflikte",
      ],
    },
  ],
  Capture: [
    {
      muster: /^demoHref\(s\.to, params\)$/,
      herkunft: "lib/captureSuccess.ts · captureNextSteps",
      ziele: () =>
        (["experte", "controller"] as Role[]).flatMap((rolle) =>
          captureNextSteps("ko-x", rolle).map((s) => s.to),
        ),
    },
    {
      muster: /^CAPTURE_FRONT_DOOR_ROUTE$/,
      herkunft: "lib/captureFrontDoor.ts · CAPTURE_FRONT_DOOR_ROUTE",
      ziele: () => [CAPTURE_FRONT_DOOR_ROUTE],
    },
  ],
  // AUFTRAG-mega71 Block E: die Ask-Fläche. `/fragen` ist ab viewer sichtbar — jedes bewachte
  // Ziel (alle fünf Fundstellen, auch /erfassen mit minRole experte) braucht deshalb das Tor.
  Ask: [
    {
      muster: /^item\.to$/,
      herkunft: "lib/knowledgeGuidance.ts · knowledgeGuidance(ask)",
      ziele: () => knowledgeGuidance("ask").items.map((i) => i.to),
    },
    {
      muster: /^demoHref\(reviewGuard\.ctaTo, params\)$/,
      herkunft: "lib/askView.ts · answerReviewGuard (Prüfvorbehalt-CTA)",
      ziele: () => {
        const guard = answerReviewGuard("unverified", []);
        return guard ? [guard.ctaTo] : [];
      },
    },
    {
      muster: /^captureGapHref\(gapId\)$/,
      herkunft: "lib/captureFromGap.ts · captureGapHref",
      ziele: () => [captureGapHref("gap-x")],
    },
  ],
};

// Templates direkt auflösen: bekannte Konstante einsetzen, jeden anderen Platzhalter als ein
// Segment-/Query-Stück („x") lesen — genau wie der Router ein `:id` liest.
function loeseTemplate(roh: string): string {
  return roh
    .replace(/\$\{CAPTURE_FRONT_DOOR_ROUTE\}/g, CAPTURE_FRONT_DOOR_ROUTE)
    .replace(/\$\{[^}]*\}/g, "x");
}

interface Vorkommen {
  zeile: number;
  tag: string;
  roh: string;
  ziele: string[];
  unbekannt: string | null;
}

// ── Stufe 1: jedes to= samt tragendem Tag ───────────────────────────────────────────────────────
function erhebe(datei: (typeof FLAECHEN)[number]): Vorkommen[] {
  const src = ohneKommentare(lies(join(WEB_SRC, "pages", `${datei}.tsx`)));
  const out: Vorkommen[] = [];
  for (const m of src.matchAll(/\bto=(?:"([^"]*)"|\{((?:[^{}]|\$\{[^{}]*\})*)\})/g)) {
    const index = m.index ?? 0;
    // Das tragende Tag: die letzte öffnende spitze Klammer vor dem Attribut.
    const davor = src.slice(0, index);
    const tagStart = davor.lastIndexOf("<");
    const tag = davor.slice(tagStart).match(/^<([A-Za-z][A-Za-z0-9]*)\b/)?.[1] ?? "?";
    const literal = m[1] ?? null;
    const ausdruck = m[2]?.trim() ?? null;
    let ziele: string[] = [];
    let unbekannt: string | null = null;
    // Ein Template im Ausdruck (auch eingebettet, z. B. `demoHref(`/wissen/${k.id}`, params)`) IST
    // der Pfad — demoHref hängt nur Demo-Query an, loeseTemplate liest Platzhalter wie der Router
    // ein `:id`. (Die Kalibrierung hat diese Regel erzwungen: ohne sie fiel Library:929 als
    // „unbekannte Herkunft" auf.)
    const template = ausdruck?.match(/`(\/[^`]*)`/) ?? null;
    if (literal !== null) {
      ziele = [literal];
    } else if (template?.[1]) {
      ziele = [loeseTemplate(template[1])];
    } else if (ausdruck?.startsWith("`") && ausdruck.endsWith("`")) {
      ziele = [loeseTemplate(ausdruck.slice(1, -1))];
    } else if (ausdruck !== null) {
      const eintrag = HERKUNFT[datei].find((h) => h.muster.test(ausdruck));
      if (eintrag) {
        ziele = eintrag.ziele();
      } else {
        unbekannt = ausdruck;
      }
    }
    out.push({ zeile: zeileVon(src, index), tag, roh: m[0], ziele, unbekannt });
  }
  return out;
}

describe("mega70 D · kein bewachtes Ziel wird auf Library/Capture über einen rohen Link zum Weg", () => {
  for (const datei of FLAECHEN) {
    const vorkommen = erhebe(datei);

    it(`${datei}: die Erhebung läuft nicht leer und jedes to= sitzt an einem bekannten Tag`, () => {
      expect(vorkommen.length).toBeGreaterThan(3);
      const fremd = vorkommen
        .filter(
          (v) => !["Link", "NavLink", "GuardedLink", "GuardedNavLink", "RoleLink"].includes(v.tag),
        )
        .map((v) => `${datei}.tsx:${v.zeile}  <${v.tag} … ${v.roh}`);
      expect(fremd).toEqual([]);
    });

    it(`${datei}: kein to=-Ausdruck ohne benannte Herkunft`, () => {
      const offen = vorkommen
        .filter((v) => v.unbekannt !== null)
        .map((v) => `${datei}.tsx:${v.zeile}  ${v.roh}`);
      expect(offen).toEqual([]);
    });

    it(`${datei}: die Zusage — rohe Links nur auf Ziele, die JEDE sehende Rolle begehen darf`, () => {
      const rollen = rollenDerFlaeche(datei);
      const verstoesse = vorkommen
        .filter((v) => v.tag !== "RoleLink")
        .flatMap((v) =>
          v.ziele.flatMap((ziel) =>
            rollen
              .filter((rolle) => !routePathAllows(ziel, rolle))
              .map((rolle) => `${datei}.tsx:${v.zeile}  <${v.tag} to=…> → ${ziel} (${rolle})`),
          ),
        );
      expect(verstoesse).toEqual([]);
    });
  }

  it("die Kalibrier-Zusicherung: die Erhebung kennt die Registry des Routers (nicht still leer)", () => {
    // Ohne bewachte Ziele in der Erhebung wäre Stufe 3 trivial grün.
    const alleZiele = FLAECHEN.flatMap((d) => erhebe(d).flatMap((v) => v.ziele));
    const bewacht = alleZiele.filter((z) =>
      GUARDED_ITEMS.some((i) => i.path === (z.split("?")[0] ?? "")),
    );
    expect(bewacht.length).toBeGreaterThan(3);
  });
});
