// @vitest-environment jsdom
// ================================================================================================
// JOB 955 / D4 — DIE KETTEN BLEIBEN GETRENNT, UND DER WAHRHEITSORT IST EINER.
// ================================================================================================
//
// Diese Datei traegt zwei verschiedene Zusagen, und sie sind bewusst hier zusammen:
//
//   V5a-V5c  RENDERER: Tagkante und Konfliktkante sind am Bildschirm unterscheidbar, die Legende
//            benennt beide, und die Konfliktkante stammt NICHT aus `/api/graph`.
//   V6a-V6c  WAHRHEITSORT: `ProvenanceEdgeKind` ist genau EINMAL definiert, eine sechste legitime
//            Art bleibt zulaessig, und Kette B erreicht heute keinen Client.
//
// WARUM ZWEI DATEIEN UND NICHT EINE: Der D3-Durchgang hatte beides samt der Fastify-Drahtpruefung
// in EINER jsdom-Datei. Der erste Lauf war gruen, die folgenden fielen mit `EPERM` beim Nachladen
// fremder Pakete aus — wandernd. Die Gegenprobe an einer unberuehrten Bestandsdatei lief gruen
// durch; es war also ein Konstruktionsfehler und kein Umgebungspech. Eine Drahtpruefung braucht
// kein DOM. Der Draht liegt deshalb in `d955-graphketten-draht.test.ts`.
//
// WAS DIESE DATEI NICHT BEWEIST: jsdom rechnet kein Layout. Ob die beiden Kantenarten im echten
// Browser unterscheidbar AUSSEHEN, ist hier nicht messbar. Messbar — und deshalb gebunden — sind
// die gesetzten Attribute, aus denen die Unterscheidbarkeit folgt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

const KNOTEN = ["ko-1", "ko-2", "ko-3", "ko-4"];

// Der Graph liefert AUSSCHLIESSLICH Tagkanten. Die Konfliktkante kommt aus einer anderen Quelle —
// genau das ist die Zusage von V5c.
const GRAPH_KANTEN = [{ a: "ko-1", b: "ko-2", via: "ventil-955" }];
const KONFLIKTE = [{ id: "c-1", koA: "ko-3", koB: "ko-4", status: "offen" }];

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: {
      graph: vi.fn(async () => ({
        nodes: KNOTEN.map((id, i) => ({ id, title: `Wissensobjekt ${i + 1}` })),
        edges: GRAPH_KANTEN,
      })),
    },
    conflicts: {
      list: vi.fn(async () => KONFLIKTE),
    },
    ko: {
      list: vi.fn(async () =>
        KNOTEN.map((id, i) => ({
          id,
          title: `Wissensobjekt ${i + 1}`,
          status: "validiert",
          tags: ["ventil-955"],
          trust: 80,
          confidence: 80,
          type: "regel",
          category: "Betrieb",
          conditions: [],
          measures: [],
          version: 1,
          author: "a",
          originalAuthor: "a",
        })),
      ),
    },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "../..");

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mounten(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/graph"] }, createElement(GraphView)),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

/** Alle Quelldateien unter einem Verzeichnis, ohne `node_modules`. */
function quelldateien(wurzel: string): string[] {
  const raus: string[] = [];
  const lauf = (ordner: string): void => {
    for (const name of readdirSync(ordner)) {
      if (name === "node_modules" || name === "dist" || name.startsWith(".")) {
        continue;
      }
      const voll = join(ordner, name);
      if (statSync(voll).isDirectory()) {
        lauf(voll);
      } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        raus.push(voll);
      }
    }
  };
  lauf(wurzel);
  return raus;
}

describe("JOB 955 D4 · die Ketten bleiben am Bildschirm getrennt", () => {
  it("V5a · Tag- und Konfliktkante tragen verschiedene Farbe UND Strichform", async () => {
    const container = await mounten();
    const linien = Array.from(container.querySelectorAll("line"));
    expect(linien.length, "es muessen Kanten gezeichnet sein").toBeGreaterThan(0);

    const tag = linien.filter((l) => l.getAttribute("class")?.includes("text-hairline"));
    const konflikt = linien.filter((l) =>
      l.getAttribute("class")?.includes("text-trust-crit-fill"),
    );
    expect(tag.length, "eine Tagkante muss gezeichnet sein").toBeGreaterThan(0);
    expect(konflikt.length, "eine Konfliktkante muss gezeichnet sein").toBeGreaterThan(0);

    // FARBE: verschiedene Klassen. STRICHFORM: nur die Konfliktkante ist gestrichelt.
    expect(tag[0]?.getAttribute("class")).not.toBe(konflikt[0]?.getAttribute("class"));
    expect(tag[0]?.getAttribute("stroke-dasharray"), "die Tagkante ist durchgezogen").toBeNull();
    expect(konflikt[0]?.getAttribute("stroke-dasharray"), "die Konfliktkante ist gestrichelt").toBe(
      "5 4",
    );
  });

  it("V5b · die Legende benennt BEIDE Kantenarten", async () => {
    const container = await mounten();
    const text = container.textContent ?? "";
    expect(text, "Legende Tagkante").toContain(i18n.t("graph.legendTag"));
    expect(text, "Legende Konfliktkante").toContain(i18n.t("graph.legendConflict"));
  });

  it("V5c · die Konfliktkante stammt NICHT aus /api/graph", async () => {
    // Der Graphmock liefert genau EINE Kante (ko-1 ↔ ko-2). Erscheint trotzdem eine
    // Konfliktkante, kann sie nur aus der anderen Quelle stammen. Waeren beide Ketten in einen
    // gemeinsamen Wirevertrag verschmolzen, gaebe es sie hier nicht.
    expect(GRAPH_KANTEN.some((k) => k.a === "ko-3" || k.b === "ko-3")).toBe(false);

    const container = await mounten();
    const konflikt = Array.from(container.querySelectorAll("line")).filter((l) =>
      l.getAttribute("class")?.includes("text-trust-crit-fill"),
    );
    expect(
      konflikt.length,
      "die Konfliktkante ist da, obwohl der Graph sie nicht liefert",
    ).toBeGreaterThan(0);
  });
});

describe("JOB 955 D4 · der Wahrheitsort ist einer — und er ist nicht eingefroren", () => {
  it("V6a · `ProvenanceEdgeKind` ist GENAU EINMAL im Baum definiert", () => {
    // Ersetzt die D2-Zusage „genau fuenf Arten": gebunden ist die EINZIGKEIT der Quelle, nicht
    // eine momentane Anzahl. BEN4: „Ein Test, den eine beliebige sechste Art rot macht,
    // verwechselt Architekturwahrheit mit einer eingefrorenen Aufzaehlung."
    const treffer: string[] = [];
    for (const datei of [
      ...quelldateien(join(WURZEL, "services")),
      ...quelldateien(join(WURZEL, "apps/web/src")),
    ]) {
      const text = readFileSync(datei, "utf8");
      if (/export\s+type\s+ProvenanceEdgeKind\s*=/.test(text)) {
        treffer.push(datei.replace(`${WURZEL}/`, ""));
      }
    }
    expect(treffer, `Definitionsorte: ${treffer.join(", ")}`).toHaveLength(1);
    expect(treffer[0]).toBe("services/provenance/src/types.ts");
  });

  it("V6b · eine SECHSTE legitime Art bleibt zulässig — keine Zahl ist eingefroren", () => {
    const quelle = readFileSync(join(WURZEL, "services/provenance/src/types.ts"), "utf8");
    const block = quelle.split("export type ProvenanceEdgeKind =")[1]?.split(";")[0] ?? "";
    const arten = (block.match(/"[a-z_]+"/g) ?? []).length;

    // KALIBRIERUNG: heute sind es fuenf. Der Test bindet aber NICHT diese Zahl.
    expect(arten, "heutiger Stand der Aufzaehlung").toBeGreaterThanOrEqual(5);

    // DIE EIGENTLICHE ZUSAGE: nirgends im Baum wird die ANZAHL der Arten festgenagelt.
    // Genau so ein Waechter war der D2-Fehler.
    const zahlwaechter: string[] = [];
    for (const datei of quelldateien(join(WURZEL, "tests"))) {
      const text = readFileSync(datei, "utf8");
      if (
        /ProvenanceEdgeKind[\s\S]{0,400}?(toHaveLength\(\s*5\s*\)|length\s*\)\s*\.toBe\(\s*5\s*\))/.test(
          text,
        )
      ) {
        zahlwaechter.push(datei.replace(`${WURZEL}/`, ""));
      }
    }
    expect(zahlwaechter, `Zahlwaechter gefunden in: ${zahlwaechter.join(", ")}`).toHaveLength(0);
  });

  it("V6c · Kette B erreicht heute KEINEN Client — mit Positivkontrolle auf den Graphabruf", () => {
    const client = quelldateien(join(WURZEL, "apps/web/src"));

    // POSITIVKONTROLLE: der Graphabruf existiert. Ohne sie koennte die Suche selbst kaputt sein
    // und der Fall aus dem falschen Grund gruen werden.
    const graphAbruf = client.filter((d) =>
      /api\.get<[^>]*>\(\s*["'`]\/graph/.test(readFileSync(d, "utf8")),
    );
    expect(graphAbruf.length, "der Graphabruf muss gefunden werden").toBeGreaterThan(0);

    // DIE ZUSAGE: kein Clientmodul ruft die Herkunftsroute eines Objekts ab.
    const provenienzAbruf = client.filter((d) =>
      /["'`][^"'`]*\/kos\/[^"'`]*\/provenance/.test(readFileSync(d, "utf8")),
    );
    expect(
      provenienzAbruf,
      `Wird die Kette angebunden, wird DIESER Fall rot und verlangt den Renderer-Nachweis. Gefunden: ${provenienzAbruf.join(", ")}`,
    ).toHaveLength(0);
  });
});
