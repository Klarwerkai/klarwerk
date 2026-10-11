// ================================================================================================
// produkt:20261010:assistenz-name-avatar · DIE MIMIK DER MOTIVE MIT GESICHT (ANIMATIONSZUSTAENDE.json).
// ================================================================================================
//
//   M1  Genau die acht „expressiven“ Motive (sie haben ein Gesicht) bekommen Mimik; die fünf
//       sachlichen Objekte, die Ersatzgrafik und Unbekanntes keine — keine erfundenen Gesichter.
//   M2  Augen und Mund/Schnabel liegen im Bild (1254 × 1254) und innerhalb des sichtbaren Motivs.
//   M3  Die Ebene: zwei Lider und eine Mund-/Schnabelöffnung, dekorativ, mit Zustand und Bewegung.
//   M4  Über der Ersatzgrafik liegt nie eine Mimik-Ebene; das Bild selbst bleibt dasselbe.
//   M5  index.css: statischer Ausdruck je Zustand; Lidschlag und Mundbewegung nur ohne reduzierte
//       Bewegung; die Ebene bewegt sich mit jeder Geste der Figur.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { AvatarBild } from "../../apps/web/src/components/assistenz/AvatarBild";
import { AvatarMimik } from "../../apps/web/src/components/assistenz/AvatarMimik";
import { ASSISTENZ_ZUSTAENDE } from "../../apps/web/src/components/assistenz/ausdruck";
import {
  ASSISTENZ_AVATAR_KATALOG,
  animationsStil,
  avatarMotiv,
} from "../../apps/web/src/lib/assistenzAvatare";
import { MIMIK_RASTER, mimikGesicht } from "../../apps/web/src/lib/assistenzMimik";
import { repoPfad } from "../support/repoPfad";

/** Sichtbarer Bereich je Motiv (`alpha_bbox` aus MANIFEST.json), [x0, y0, x1, y1]. */
const ALPHA_BBOX: Record<string, readonly [number, number, number, number]> = {
  original: [37, 21, 1222, 1228],
  lichtwesen: [33, 30, 1232, 1182],
  roboter: [31, 19, 1220, 1228],
  eule: [0, 5, 1242, 1250],
  fuchs: [0, 13, 1218, 1214],
  pinguin: [0, 27, 1236, 1220],
  wolke: [57, 21, 1232, 1238],
  kompass: [0, 33, 1190, 1236],
};

describe("M1 · Mimik nur für Motive mit Gesicht", () => {
  it("die acht expressiven Motive haben ein Gesicht, die sachlichen keins", () => {
    const mitGesicht = ASSISTENZ_AVATAR_KATALOG.filter((m) => mimikGesicht(m.id) !== null);
    expect(mitGesicht.map((m) => m.id)).toEqual([
      "original",
      "lichtwesen",
      "roboter",
      "eule",
      "fuchs",
      "pinguin",
      "wolke",
      "kompass",
    ]);
    for (const m of ASSISTENZ_AVATAR_KATALOG) {
      expect(mimikGesicht(m.id) !== null, m.id).toBe(animationsStil(m) === "expressiv");
    }
    expect(mimikGesicht(null)).toBeNull();
    expect(mimikGesicht("gibt-es-nicht")).toBeNull();
    expect(mimikGesicht("toString")).toBeNull();
  });
});

describe("M2 · Gesichtsteile liegen im sichtbaren Motiv", () => {
  it.each(Object.keys(ALPHA_BBOX))("%s", (id) => {
    const g = mimikGesicht(id);
    expect(g).not.toBeNull();
    const [x0, y0, x1, y1] = ALPHA_BBOX[id] ?? [0, 0, 0, 0];
    const punkte = [...(g?.augen ?? []), g?.mund];
    for (const p of punkte) {
      expect(p).toBeDefined();
      if (!p) {
        continue;
      }
      expect(p.x - p.rx).toBeGreaterThanOrEqual(x0);
      expect(p.x + p.rx).toBeLessThanOrEqual(Math.min(x1, MIMIK_RASTER));
      expect(p.y - p.ry).toBeGreaterThanOrEqual(y0);
      expect(p.y + p.ry).toBeLessThanOrEqual(Math.min(y1, MIMIK_RASTER));
    }
    // Zwei getrennte Augen, der Mund bzw. Schnabelspalt darunter.
    const [l, r] = g?.augen ?? [];
    expect(l && r && l.x + l.rx < r.x - r.rx).toBe(true);
    expect(g && g.mund.y > Math.min(l?.y ?? 0, r?.y ?? 0)).toBe(true);
  });
});

describe("M3 · die Mimik-Ebene", () => {
  it.each([...ASSISTENZ_ZUSTAENDE])("expressiv · Zustand %s", (zustand) => {
    const html = renderToStaticMarkup(
      createElement(AvatarMimik, { motivId: "eule", zustand, bewegungReduziert: false }),
    );
    expect(html).toContain('data-testid="klara-mimik"');
    expect(html).toContain('data-mimik="eule"');
    expect(html).toContain(`data-zustand="${zustand}"`);
    expect(html).toContain('data-bewegung="standard"');
    expect(html).toContain('data-mund="schnabel"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`viewBox="0 0 ${MIMIK_RASTER} ${MIMIK_RASTER}"`);
    expect(html.match(/klara-mimik-lid /g)?.length).toBe(2);
    expect(html.match(/klara-mimik-mund/g)?.length).toBe(1);
  });

  it("reduzierte Bewegung steht an der Ebene", () => {
    const html = renderToStaticMarkup(
      createElement(AvatarMimik, {
        motivId: "original",
        zustand: "sprechen",
        bewegungReduziert: true,
      }),
    );
    expect(html).toContain('data-bewegung="reduziert"');
    expect(html).toContain('data-mund="mund"');
  });

  it.each(["prisma", "wissensbuch", "verbindungsknoten", "monolith", "leuchtkreis"])(
    "sachlich · %s bekommt keine Ebene",
    (id) => {
      const html = renderToStaticMarkup(
        createElement(AvatarMimik, { motivId: id, zustand: "sprechen", bewegungReduziert: false }),
      );
      expect(html).toBe("");
    },
  );
});

describe("M4 · keine Mimik über der Ersatzgrafik", () => {
  const ebene = createElement("span", { "data-testid": "ebene" });
  it("unbekanntes Motiv: Ersatzgrafik ohne Ebene", () => {
    const html = renderToStaticMarkup(
      createElement(AvatarBild, {
        motiv: null,
        alt: "",
        ersatzBeschriftung: "",
        ueberlagerung: ebene,
      }),
    );
    expect(html).toContain("data-avatar-ersatz");
    expect(html).not.toContain('data-testid="ebene"');
  });

  it("geliefertes Motiv: unverändertes Bild, darüber die Ebene", () => {
    const html = renderToStaticMarkup(
      createElement(AvatarBild, {
        motiv: avatarMotiv("eule"),
        alt: "",
        ersatzBeschriftung: "",
        ueberlagerung: ebene,
      }),
    );
    expect(html).toContain('src="/assistenz/erstauswahl-v1/eule.png"');
    expect(html).toContain('data-testid="ebene"');
  });
});

describe("M5 · die Darstellung in index.css", () => {
  const css = readFileSync(repoPfad("apps/web/src/index.css"), "utf8");
  const anker = css.indexOf("DIE NEUN ZUSTÄNDE DER FIGUR");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {", anker);
  const ende = css.indexOf("@keyframes kw-assistenz-atmen");
  const statisch = css.slice(anker, start);
  const block = css.slice(start, ende);
  const OHNE_REDUZIERT = ':not([data-bewegung="reduziert"])';

  it("ruhend unsichtbar; statischer Ausdruck je Zustand (gilt auch bei reduzierter Bewegung)", () => {
    expect(anker).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(anker);
    expect(ende).toBeGreaterThan(start);
    expect(statisch).toMatch(/\.klara-mimik-lid,\s*\.klara-mimik-mund \{[^}]*scaleY\(0\)/);
    for (const z of ["nachdenken", "freude", "fehler", "pause"]) {
      expect(statisch, z).toContain(`.klara-mimik[data-zustand="${z}"] .klara-mimik-lid {`);
    }
    // Ratlos: ungleich gesenkte Lider.
    expect(statisch).toContain('.klara-mimik[data-zustand="ratlos"] .klara-mimik-lid-l {');
    expect(statisch).toContain('.klara-mimik[data-zustand="ratlos"] .klara-mimik-lid-r {');
    // Freude: das untere Lid hebt sich.
    expect(statisch).toMatch(
      /\.klara-mimik\[data-zustand="freude"\] \.klara-mimik-lid \{[^}]*transform-origin: 50% 100%/,
    );
    // Statisch keine Animation.
    expect(statisch).not.toMatch(/animation: kw-mimik-/);
  });

  it("Lidschlag und Mundbewegung nur ohne reduzierte Bewegung", () => {
    const regeln: Array<[string, string, RegExp]> = [
      ["bereit", "lid", /animation: kw-mimik-blinzeln /],
      ["warten", "lid", /animation: kw-mimik-blinzeln /],
      ["nachdenken", "lid", /animation: kw-mimik-sinnen /],
      ["sprechen", "mund", /animation: kw-mimik-sprechen /],
    ];
    for (const [z, teil, muster] of regeln) {
      const kopf = `.klara-mimik[data-zustand="${z}"]${OHNE_REDUZIERT} .klara-mimik-${teil} {`;
      const i = block.indexOf(kopf);
      expect(i, kopf).toBeGreaterThanOrEqual(0);
      expect(block.slice(i, block.indexOf("}", i)), kopf).toMatch(muster);
    }
    // Zuhören: offene Augen, kein Lidschlag.
    expect(block).not.toContain('.klara-mimik[data-zustand="zuhoeren"]');
    // Ausserhalb des Bewegungsblocks läuft keine Mimik-Animation.
    expect(css.slice(0, start) + css.slice(ende)).not.toMatch(/animation: kw-mimik-/);
    for (const k of ["kw-mimik-blinzeln", "kw-mimik-sinnen", "kw-mimik-sprechen"]) {
      expect(css, k).toContain(`@keyframes ${k} {`);
    }
  });

  it.each([...ASSISTENZ_ZUSTAENDE].filter((z) => z !== "pause"))(
    "expressiv · %s: die Ebene bewegt sich deckungsgleich mit dem Bild",
    (z) => {
      const kopf = `.klara-figur[data-stil="expressiv"][data-zustand="${z}"]`;
      const i = block.indexOf(kopf);
      expect(i, z).toBeGreaterThanOrEqual(0);
      const regel = block.slice(i, block.indexOf("}", i));
      expect(regel).toContain(".klara-motiv,");
      expect(regel).toMatch(/\.klara-mimik \{/);
    },
  );

  it("sachliche Objekte: keine Mimik-Regel", () => {
    expect(css).not.toMatch(/data-stil="zurueckhaltend"\][^{]*\.klara-mimik/);
  });
});
