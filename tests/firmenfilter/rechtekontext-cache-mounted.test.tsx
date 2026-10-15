// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:peter-p14 · K6/K7 — DIE ANZEIGE VERWIRFT ALTE TREFFER BEIM WECHSEL DER RECHTE.
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): die Abfrageschlüssel der Liste und der Suche kannten Filter, aber
// keine Rechte; geleert wurde nur beim Abmelden. Gemessen wird hier die ECHTE Kette der
// Weboberfläche: `useLibrarySearch`/`useKos` (api/hooks.ts) → `api` (api/client.ts) →
// `RechtekontextWache` (app/RechtekontextWache.tsx), montiert in einem echten QueryClient. Nur der
// Server ist ersetzt — eine `fetch`-Attrappe, die je Anfrage den Stempel des Rechtekontexts
// (`x-klarwerk-rechtekontext`) mitgibt und Antworten auf Wunsch zurückhält (verzögerte Neuantwort).
// Dass der echte Server den Stempel bei Rollen-, Mitgliedschafts- und Kontowechsel ändert, misst
// `firmenfilter-api.test.ts` (K6/K7).
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K6 · Cache berücksichtigt tatsächlichen Rechtekontext und Widerruf
//   K7 · Kontextwechsel lässt keine unberechtigten alten Ergebnisse stehen
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { useKos, useLibrarySearch } from "../../apps/web/src/api/hooks";
import { RechtekontextWache } from "../../apps/web/src/app/RechtekontextWache";
import { rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";

const KONTEXT_LEA_MITGLIED = "kontext-lea-mitglied";
const KONTEXT_LEA_ENTZOGEN = "kontext-lea-entzogen";
const KONTEXT_VERA = "kontext-vera";

interface Antwort {
  daten: unknown;
  kontext: string;
}

/** Der ersetzte Server: je Pfadanfang eine Antwort; zurückgehaltene Antworten warten auf `gib`. */
function server() {
  const lage = {
    suche: { daten: [] as unknown, kontext: KONTEXT_LEA_MITGLIED } as Antwort,
    liste: { daten: [] as unknown, kontext: KONTEXT_LEA_MITGLIED } as Antwort,
    sucheHalten: false,
    gehalten: [] as (() => void)[],
    anfragen: [] as string[],
  };
  const antworte = (a: Antwort) => ({
    status: 200,
    ok: true,
    statusText: "OK",
    headers: new Headers({ "x-klarwerk-rechtekontext": a.kontext }),
    text: async () => JSON.stringify(a.daten),
  });
  const fetchAttrappe = vi.fn(async (url: string) => {
    lage.anfragen.push(url);
    if (url.startsWith("/api/library/search")) {
      // Der Stand der Antwort wird beim EINGANG festgehalten — wie ein Server, der unter den
      // damaligen Rechten rechnet und erst später ausliefert.
      const jetzt = { ...lage.suche };
      if (lage.sucheHalten) {
        return new Promise((fertig) => {
          lage.gehalten.push(() => fertig(antworte(jetzt)));
        });
      }
      return antworte(jetzt);
    }
    if (url.startsWith("/api/kos")) {
      return antworte({ ...lage.liste });
    }
    return antworte({ daten: {}, kontext: lage.liste.kontext });
  });
  return { lage, fetchAttrappe };
}

const ko = (id: string) => ({ id, title: id, statement: "", tags: [], history: [] });

function Anzeige(): ReturnType<typeof createElement> {
  const suche = useLibrarySearch({ q: "Messkettenabgleich" });
  const liste = useKos();
  const ids = (d: unknown) =>
    ((d as { id: string }[] | undefined) ?? []).map((k) => k.id).join(",");
  return createElement(
    "div",
    null,
    createElement("p", { id: "suche" }, ids(suche.data)),
    createElement("p", { id: "liste" }, ids(liste.data)),
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let s: ReturnType<typeof server>;
let qc: QueryClient;

async function ruhe(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const text = (id: string): string => container.querySelector(`#${id}`)?.textContent ?? "";

beforeEach(async () => {
  rechtekontextZuruecksetzen();
  s = server();
  vi.stubGlobal("fetch", s.fetchAttrappe);
  container = document.createElement("div");
  document.body.appendChild(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const neu = createRoot(container);
  root = neu;
  s.lage.suche = { daten: [ko("E1"), ko("P1")], kontext: KONTEXT_LEA_MITGLIED };
  s.lage.liste = { daten: [ko("E1"), ko("P1")], kontext: KONTEXT_LEA_MITGLIED };
  act(() => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(RechtekontextWache),
        createElement(Anzeige),
      ),
    );
  });
  await ruhe();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.unstubAllGlobals();
  rechtekontextZuruecksetzen();
});

describe("K6 · Widerruf: gefüllter Cache, verzögerte Neuantwort", () => {
  it("nach dem Mitgliedschaftsentzug verschwinden die alten Treffer sofort — auch solange die Neuantwort aussteht", async () => {
    // KALIBRIERUNG: der Cache ist mit dem Partnertreffer gefüllt.
    expect(text("suche")).toBe("E1,P1");
    expect(text("liste")).toBe("E1,P1");

    // Der Server entzieht Lea die Mitgliedschaft. Die Suche antwortet ab jetzt verzögert.
    s.lage.suche = { daten: [ko("E1")], kontext: KONTEXT_LEA_ENTZOGEN };
    s.lage.liste = { daten: [ko("E1")], kontext: KONTEXT_LEA_ENTZOGEN };
    s.lage.sucheHalten = true;

    // Irgendeine nächste Antwort (hier: die Liste im Takt) bringt den neuen Kontext.
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["kos"] });
    });
    await ruhe();

    // Die Suche wartet noch — und zeigt NICHT mehr den alten Partnertreffer.
    expect(s.lage.gehalten.length).toBeGreaterThan(0);
    expect(text("suche")).toBe("");
    expect(text("liste")).toBe("E1");

    // Die verzögerte Neuantwort kommt an: nur noch das Erlaubte.
    await act(async () => {
      for (const gib of s.lage.gehalten.splice(0)) {
        gib();
      }
    });
    await ruhe();
    expect(text("suche")).toBe("E1");
  });

  it("eine Antwort aus dem ALTEN Kontext, die erst nach dem Wechsel eintrifft, wird verworfen", async () => {
    expect(text("suche")).toBe("E1,P1");
    // Eine Suche läuft noch unter dem alten Kontext los und hängt.
    s.lage.sucheHalten = true;
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["library"] });
    });
    await ruhe();
    expect(s.lage.gehalten).toHaveLength(1);

    // Jetzt der Entzug; die Liste bringt den neuen Kontext.
    s.lage.suche = { daten: [ko("E1")], kontext: KONTEXT_LEA_ENTZOGEN };
    s.lage.liste = { daten: [ko("E1")], kontext: KONTEXT_LEA_ENTZOGEN };
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["kos"] });
    });
    await ruhe();
    expect(text("suche")).toBe("");

    // Die alte Antwort (mit P1, alter Kontext) kommt verspätet an — sie darf nichts anzeigen.
    await act(async () => {
      const alte = s.lage.gehalten.shift();
      alte?.();
    });
    await ruhe();
    expect(text("suche")).not.toContain("P1");

    // Die frische Antwort aus dem neuen Kontext gilt.
    await act(async () => {
      for (const gib of s.lage.gehalten.splice(0)) {
        gib();
      }
    });
    await ruhe();
    expect(text("suche")).toBe("E1");
  });
});

describe("K7 · Kontextwechsel und Gegenprobe", () => {
  it("Wechsel der Person mit gefülltem Cache: Veras Anzeige erbt keine Treffer von Lea", async () => {
    expect(text("suche")).toBe("E1,P1");
    s.lage.suche = { daten: [ko("E1")], kontext: KONTEXT_VERA };
    s.lage.liste = { daten: [ko("E1")], kontext: KONTEXT_VERA };
    s.lage.sucheHalten = true;
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["kos"] });
    });
    await ruhe();
    expect(text("suche")).toBe("");
    expect(text("liste")).toBe("E1");
  });

  it("Gegenprobe: gleicher Kontext — der Cache bleibt stehen, nichts wird verworfen", async () => {
    expect(text("suche")).toBe("E1,P1");
    const vorher = s.lage.anfragen.length;
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["kos"] });
    });
    await ruhe();
    expect(text("suche")).toBe("E1,P1");
    // Nur die eine angeforderte Liste wurde geholt — keine Rücksetzung der Suche.
    expect(s.lage.anfragen.slice(vorher).every((u) => u.startsWith("/api/kos"))).toBe(true);
  });
});
