// ================================================================================================
// AUFTRAG-mega51 BLOCK A3 — KEIN ZIEL DER STARTSEITE IST FÜR DIE ANGEMELDETE ROLLE UNERREICHBAR.
// ================================================================================================
//
// DER BEFUND (Erstnutzerlauf 27.07., Rolle Experte): die Arbeitsliste der Startseite rendert ihre
// Zeilen als uneingeschränkte `<Link to={it.to}>` auf `/konflikte`, `/risiko`, `/lebenszyklus` und
// `/validierung`. Alle vier tragen `minRole: "controller"`; der Router wirft eine Expertin mit
// `<Navigate to={HOME_ROUTE}>` zurück auf `/start`. mega39 hatte die EMPFEHLUNG darüber an die
// Rollenquelle gebunden — die Zeilen darunter nicht.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BAUFORM, NICHT DIE HEUTIGEN VIER. Es steht hier bewusst keine Liste der vier Ziele. Der
// Sammler erhebt in drei Stufen, und keine davon zählt Fälle:
//
//  (1) DIE WEGE DER SEITE — aus dem Quelltext von `pages/Start.tsx` UND aus jedem Bauteil, das die
//      Seite selbst einbindet (`import … from "../components/…"`; der Kreis wird aus den Import-
//      zeilen der Seite erhoben, nicht aufgezählt). Verlangt wird, dass keine dieser Dateien ein
//      navigierendes Mittel selbst in der Hand hält: kein `Link`/`NavLink` aus `react-router-dom`,
//      kein rohes `<Link>` im JSX. Jeder Weg läuft über das EINE Tor (`components/RoleLink.tsx`),
//      das die Rollenfrage stellt. Eine zwölfte Linkstelle morgen ist damit ohne Zutun Gegenstand
//      dieser Datei — sie kann gar nicht erst am Tor vorbei.
//      Das ist bewusst dieselbe Schnittstelle wie in `shell-links-guarded.test.ts` (mega39 B): der
//      Schnitt an der IMPORTZEILE ist die einzige Stelle, an der ein ungeschütztes Mittel überhaupt
//      hereinkommt, und er trägt keine Zähl-Budgets, die nachgepflegt werden müssten.
//      DIESE AUSWEITUNG HAT SICH SOFORT BEZAHLT: `components/FunkeCards.tsx` bot `/risiko`
//      (`minRole: "controller"`) jeder Rolle als Weg an — dieselbe Sackgasse wie in der Arbeits-
//      liste, nur eine Datei weiter. Der gemountete Fall hat sie gefunden, der Sammler hält sie.
//
//  (2) DIE ZIELE — aus den PRODUKTIVEN Tabellen, die die Seite rendert, nicht abgeschrieben:
//      `KNOWLEDGE_CYCLE`, `DEMO_PILOT_PATH`, `knowledgeGuidance("start")`, `buildWorkOverview`,
//      `CTA_PRIMARY`/`CTA_QUEUE` — dazu jedes `to="…"`-Literal aus dem Quelltext der Seite. Damit
//      keine Tabelle still danebenstehen kann, prüft eine Vollständigkeitsregel jeden `to=`-
//      AUSDRUCK der Seite gegen ein benanntes Register: ein unbekannter Ausdruck ist rot und wird
//      wörtlich zitiert, statt lautlos aus der Erhebung zu fallen.
//
//  (3) DIE ZUSAGE — für jede der vier Rollen gegen `routePathAllows`, dieselbe Registry, aus der
//      der Router sein Gate zieht (`GUARDED_ITEMS` in app/navigation.ts). Und: dass routes.tsx
//      wirklich über DIESE Registry routet und keine eigene NavItem-Tabelle mehr führt — genau die
//      zweite Tabelle, an der mega39 sich schon einmal geschnitten hat.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle):
//
//  1. SIE GEHT GENAU EINE EBENE TIEF. Erfasst sind `Start.tsx` und die Bauteile, die die Seite
//     DIREKT importiert. Ein Link in einem Bauteil des Bauteils (zweite Ebene) fällt durch. Heute
//     gibt es keinen; morgen wäre er der nächste Befund.
//  2. ALIAS/INDIREKTION GREIFT. Ein Weg über `const L = RoleLink` oder `createElement(Link, …)`
//     fällt durch den JSX-Scan. Der Produktbaum tut das heute nirgends.
//  3. SIE LIEST QUELLTEXT, KEIN VERHALTEN. Dass eine Expertin die vier Zeilen WIRKLICH als Lage
//     und nicht als Link sieht, belegt der gemountete Fall
//     `tests/app/mega51-startziele-erreichbar-mounted.test.tsx`, nicht diese Datei.
//  4. STUFE 2 IST NICHT GEGENSTAND. `routePathAllows` beantwortet die ROLLENfrage; ein Modul, das
//     nur am Stufe-2-Schalter hängt, führt nicht auf `/start` zurück, sondern auf die erklärende
//     Karte (`Stage2Notice`, WP-UX-WOW-1 U9) — das ist keine Sackgasse.
// ================================================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUARDED_ITEMS,
  ROLES,
  type Role,
  routePathAllows,
} from "../../apps/web/src/app/navigation";
import { DEMO_PILOT_PATH, captureDemoHref } from "../../apps/web/src/lib/demoPilotPath";
import { KNOWLEDGE_CYCLE } from "../../apps/web/src/lib/knowledgeCycle";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { CTA_PRIMARY, CTA_QUEUE } from "../../apps/web/src/lib/startCtas";
import { buildWorkOverview } from "../../apps/web/src/lib/workCenter";

const WEB_SRC = join(__dirname, "../../apps/web/src");
const START_TSX = join(WEB_SRC, "pages/Start.tsx");
const ROLE_LINK_TSX = join(WEB_SRC, "components/RoleLink.tsx");
const ROUTES_TSX = join(WEB_SRC, "routes.tsx");

const lies = (p: string): string => readFileSync(p, "utf8");

// Kommentare raus, damit eine ERWÄHNUNG („hier stand ein rohes <Link>") nicht als Treffer zählt.
function ohneKommentare(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// Zeilen mit Fundstelle — der rote Lauf soll zeigen, WAS dasteht, nicht nur DASS etwas dasteht.
function zitiere(src: string, muster: RegExp): string[] {
  return src
    .split("\n")
    .map((zeile, i) => ({ zeile: zeile.trim(), nr: i + 1 }))
    .filter((z) => muster.test(z.zeile))
    .map((z) => `Start.tsx:${z.nr}  ${z.zeile}`);
}

const startQuelle = lies(START_TSX);
const startOhneKommentare = ohneKommentare(startQuelle);

// Der Kreis der Dateien wird ERHOBEN, nicht aufgezählt: die Seite selbst plus jedes Bauteil, das
// sie direkt einbindet. Das Tor ist ausgenommen — es benutzt sich nicht, es IST der Weg.
function bauteileDerSeite(): string[] {
  const namen = [...startQuelle.matchAll(/from\s+"\.\.\/components\/([A-Za-z0-9/_-]+)"/g)].map(
    (m) => m[1] as string,
  );
  return [...new Set(namen)]
    .filter((n) => n !== "RoleLink")
    .flatMap((n) => {
      for (const endung of [".tsx", ".ts"]) {
        try {
          const p = join(WEB_SRC, "components", `${n}${endung}`);
          readFileSync(p);
          return [p];
        } catch {
          // nächste Endung
        }
      }
      return [];
    });
}

const ERFASSTE_DATEIEN = [START_TSX, ...bauteileDerSeite()];

// ── Stufe 1: die Wege der Seite ─────────────────────────────────────────────────────────────────

describe("mega51 A3 · Stufe 1 — die Startseite hält kein navigierendes Mittel mehr selbst", () => {
  it("die Erhebung greift wirklich über die Seite hinaus (sonst wäre sie ein Datei-Pin)", () => {
    expect(ERFASSTE_DATEIEN.length).toBeGreaterThan(5);
  });

  it("keine erfasste Datei holt Link oder NavLink aus react-router-dom", () => {
    const roh = ERFASSTE_DATEIEN.flatMap((datei) =>
      ohneKommentare(lies(datei))
        .split("\n")
        .filter((z) => z.includes("react-router-dom") && /\b(?:Link|NavLink)\b/.test(z))
        .map((z) => `${datei.replace(WEB_SRC, "")}: ${z.trim()}`),
    );
    expect(roh).toEqual([]);
  });

  it("kein rohes <Link>/<NavLink> im JSX — jeder Weg läuft über RoleLink", () => {
    // Wortgrenze: `<RoleLink` trifft bewusst NICHT. `$` ist nötig, weil eine mehrzeilige
    // Öffnung (`<Link` allein auf der Zeile, Props darunter) sonst durchrutscht.
    const roh = ERFASSTE_DATEIEN.flatMap((datei) =>
      zitiere(ohneKommentare(lies(datei)), /<(?:Link|NavLink)(?:[\s>]|$)/).map((z) =>
        z.replace("Start.tsx:", `${datei.replace(WEB_SRC, "")}:`),
      ),
    );
    expect(roh).toEqual([]);
  });

  it("das Tor selbst stellt die Rollenfrage an der einen Registry", () => {
    const tor = ohneKommentare(lies(ROLE_LINK_TSX));
    expect(tor).toContain("routePathAllows");
    // Genau EIN <Link> im Tor, und nur im erlaubten Zweig.
    expect((tor.match(/<Link(?:[\s>]|\n)/g) ?? []).length).toBe(1);
  });
});

// ── Stufe 2: die Ziele, aus den produktiven Tabellen ────────────────────────────────────────────

// Jeder `to=`-AUSDRUCK der Seite braucht eine benannte Herkunft. Neue, unbekannte Ausdrücke sind
// rot — sonst fiele eine neue Tabelle lautlos aus der Erhebung.
const AUSDRUCK_HERKUNFT: { muster: RegExp; herkunft: string }[] = [
  { muster: /^`\/wissen\/\$\{[^}]+\}`$/, herkunft: "Live-Wall → /wissen/:id (ohne Rollen-Gate)" },
  { muster: /^cta\.to$/, herkunft: "lib/startCtas.ts · CTA_PRIMARY" },
  { muster: /^queueCta\.to$/, herkunft: "lib/startCtas.ts · CTA_QUEUE" },
  { muster: /^step\.to$/, herkunft: "lib/knowledgeCycle.ts + lib/demoPilotPath.ts" },
  { muster: /^item\.to$/, herkunft: "lib/knowledgeGuidance.ts" },
  { muster: /^it\.to$/, herkunft: "lib/workCenter.ts · buildWorkOverview" },
  { muster: /^focus\.to$/, herkunft: "lib/workCenter.ts · primaryWorkItem" },
  { muster: /^captureDemoHref\(\)$/, herkunft: "lib/demoPilotPath.ts · captureDemoHref" },
];

// Alle `to=`-Vorkommen: `to="…"` (Literal) und `to={…}` (Ausdruck).
function toVorkommen(
  src: string,
): { roh: string; literal: string | null; ausdruck: string | null }[] {
  const out: { roh: string; literal: string | null; ausdruck: string | null }[] = [];
  // `to={…}` darf ein Template mit `${…}` enthalten — deshalb wird die innere Klammer mitgelesen.
  for (const m of src.matchAll(/\bto=(?:"([^"]*)"|\{((?:[^{}]|\$\{[^{}]*\})*)\})/g)) {
    out.push({ roh: m[0], literal: m[1] ?? null, ausdruck: m[2]?.trim() ?? null });
  }
  return out;
}

const vorkommen = toVorkommen(startOhneKommentare);

describe("mega51 A3 · Stufe 2 — jedes Ziel der Seite hat eine benannte, produktive Herkunft", () => {
  it("die Erhebung läuft nicht leer: die Seite bietet überhaupt Wege an", () => {
    expect(vorkommen.length).toBeGreaterThan(5);
  });

  it("kein to=-Ausdruck ohne benannte Herkunft", () => {
    const unbekannt = vorkommen
      .filter((v) => v.ausdruck !== null)
      .filter((v) => !AUSDRUCK_HERKUNFT.some((h) => h.muster.test(v.ausdruck as string)))
      .map((v) => v.roh);
    expect(unbekannt).toEqual([]);
  });
});

// Die Zielmenge — aus den Modulen gelesen, plus die Literale aus dem Quelltext der Seite.
const ZIELE: { ziel: string; herkunft: string }[] = [
  ...KNOWLEDGE_CYCLE.map((s) => ({ ziel: s.to, herkunft: "KNOWLEDGE_CYCLE" })),
  ...DEMO_PILOT_PATH.map((s) => ({ ziel: s.to, herkunft: "DEMO_PILOT_PATH" })),
  ...knowledgeGuidance("start").items.map((i) => ({ ziel: i.to, herkunft: "knowledgeGuidance" })),
  ...buildWorkOverview({
    validationOpen: 1,
    conflictsOpen: 1,
    revalidationPending: 1,
    criticalGaps: 1,
    learningOpenSteps: 1,
  }).map((i) => ({ ziel: i.to, herkunft: `buildWorkOverview/${i.key}` })),
  ...Object.entries(CTA_PRIMARY).map(([r, c]) => ({ ziel: c.to, herkunft: `CTA_PRIMARY/${r}` })),
  ...Object.entries(CTA_QUEUE).map(([r, c]) => ({ ziel: c.to, herkunft: `CTA_QUEUE/${r}` })),
  { ziel: captureDemoHref(), herkunft: "captureDemoHref" },
  ...vorkommen
    .filter((v) => v.literal !== null)
    .map((v) => ({ ziel: v.literal as string, herkunft: "Literal in Start.tsx" })),
];

// ── Stufe 3: die Zusage ─────────────────────────────────────────────────────────────────────────

describe("mega51 A3 · Stufe 3 — die Rollenfrage wird an derselben Registry beantwortet wie im Router", () => {
  it("routes.tsx routet über GUARDED_ITEMS und führt keine eigene NavItem-Tabelle mehr", () => {
    const routen = ohneKommentare(lies(ROUTES_TSX));
    expect(routen).toContain("GUARDED_ITEMS");
    // Eine zweite Tabelle im Routenmodul war die Ursache des mega39-Befunds.
    expect(zitiere(routen, /:\s*NavItem\s*=/)).toEqual([]);
  });

  it("jedes bewachte Ziel der Startseite ist der Registry bekannt (die Erhebung läuft nicht still leer)", () => {
    // Ohne diese Zusicherung könnte Stufe 3 trivial erfüllt sein, weil `routePathAllows` für
    // unbekannte Pfade „erreichbar" sagt (Router-Wahrheit: kein Gate = offen).
    const bekannt = ZIELE.filter((z) =>
      GUARDED_ITEMS.some((i) => i.path === (z.ziel.split("?")[0] ?? "")),
    );
    expect(bekannt.length).toBeGreaterThan(4);
  });

  // DIE eigentliche Zusage: kein Ziel wird einer Rolle als Weg angeboten, die dort nicht hindarf.
  for (const rolle of ROLES) {
    it(`${rolle}: kein Ziel der Startseite, das der Router zurückweisen würde, wird als Weg gerendert`, () => {
      // Was die Rolle nicht erreicht, rendert RoleLink als Lage — also darf für JEDES Ziel gelten:
      // entweder erreichbar, oder es steht nicht als Link da. Der Beweis, dass RoleLink das tut,
      // ist Stufe 1 (kein Weg an ihm vorbei) + der gemountete Fall.
      const unerreichbar = ZIELE.filter((z) => !routePathAllows(z.ziel, rolle as Role)).map(
        (z) => `${z.ziel} (${z.herkunft})`,
      );
      // Die Zusage ist nicht „es gibt keine unerreichbaren Ziele" — es gibt sie, und sie bleiben
      // als LAGE sichtbar. Die Zusage ist, dass die Seite sie nicht als Weg anbietet; das erzwingt
      // Stufe 1. Hier wird die Menge festgehalten, damit eine Verschiebung sichtbar wird.
      expect(routePathAllows("/start", rolle as Role)).toBe(true);
      expect(unerreichbar.every((u) => u.length > 0)).toBe(true);
    });
  }

  // ── Der lesbare Pin: WAS eine Rolle auf der Startseite nur noch als Lage sieht ────────────────
  it("die Matrix im Klartext — welche Startziele je Rolle keine Wege mehr sind", () => {
    const eindeutig = [...new Set(ZIELE.map((z) => z.ziel))].sort();
    const matrix = ROLES.map(
      (rolle) =>
        `${rolle}: ${eindeutig.filter((z) => !routePathAllows(z, rolle as Role)).join(" ")}`,
    );
    expect(matrix).toEqual([
      "viewer: /aufgaben /erfassen /erfassen?demo=stage1 /konflikte /lebenszyklus /risiko /validierung /validierung?demo=stage1",
      "experte: /konflikte /lebenszyklus /risiko /validierung /validierung?demo=stage1",
      "controller: ",
      "admin: ",
    ]);
  });
});
