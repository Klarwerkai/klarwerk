// JOB 2683 D1 (Review EXT1-20260828, Befund R2-1) — DER CONFLUENCE-KNOPF, DER NIE AUFHÖRT ZU DREHEN.
//
// Deterministisch gegen injizierte fetch-Fixtures, KEIN Netz, KEIN Live-Token. Jede Frist ist hier kurz
// gesetzt (Betriebsparameter), damit der Lauf Sekundenbruchteile dauert; die Standardwerte werden
// getrennt gepinnt.
import { describe, expect, it } from "vitest";
import {
  CONFLUENCE_MAX_RESPONSE_BYTES,
  CONFLUENCE_REQUEST_TIMEOUT_MS,
  CONFLUENCE_TOTAL_BUDGET_MS,
  ConfluenceRequestError,
  ConfluenceRestClient,
} from "../../services/confluence/src/rest-client";

const SECRET = "read-only-tok-2683-GEHEIM";
const HOST = "acme.atlassian.net";

const cfg = (fetchFn: typeof fetch, over: Record<string, unknown> = {}) => ({
  baseUrl: `https://${HOST}/wiki`,
  email: "svc@acme.example",
  apiToken: SECRET,
  spaceKey: "K",
  fetchFn,
  ...over,
});

const okJson = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

/** Ein fetch, das nie antwortet UND das Abort-Signal ignoriert — der Befund in Reinform. */
const nieAufloesend = (() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;

/** Ein fetch, das wie undici auf das Signal reagiert — und im Abbruchtext Host und Token trägt. */
const haengtBisAbbruch = ((_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new Error(`aborted https://${HOST}/rest/api/content?auth=${SECRET}`)),
    );
  })) as unknown as typeof fetch;

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ohneHostUndToken(text: string): void {
  expect(text).not.toContain(HOST);
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain("https://");
}

describe("JOB 2683 D1 · R2-1 · die Frist je Request", () => {
  it("die Standardwerte sind die aus dem Befund abgeleiteten Betriebsparameter", () => {
    expect(CONFLUENCE_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(CONFLUENCE_TOTAL_BUDGET_MS).toBe(180_000);
    expect(CONFLUENCE_MAX_RESPONSE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("GEGENPROBE: der Aufruf hängt, solange die Frist nicht greift — und endet GENAU durch sie", async () => {
    // Vorher-Bild (der Befund): kein Ende in Sicht. Hier mit 1 s Frist statt 15 s, damit der Fall
    // nicht 15 s dauert: nach 300 ms ist noch nichts passiert …
    const client = new ConfluenceRestClient(cfg(nieAufloesend, { timeoutMs: 1_000 }));
    let ausgang: "offen" | "erledigt" = "offen";
    const lauf = client.listPages().then(
      () => {
        ausgang = "erledigt";
      },
      () => {
        ausgang = "erledigt";
      },
    );
    await warte(300);
    expect(ausgang).toBe("offen");
    // … und nachher (der Fix): die Frist beendet ihn.
    await lauf;
    expect(ausgang).toBe("erledigt");
  });

  it("nie auflösendes fetch, das das Signal ignoriert → CONFLUENCE_TIMEOUT in Sekundenbruchteilen", async () => {
    const client = new ConfluenceRestClient(cfg(nieAufloesend, { timeoutMs: 50 }));
    const start = Date.now();
    await expect(client.listPages()).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(ConfluenceRequestError);
      const err = e as ConfluenceRequestError;
      expect(err.code).toBe("CONFLUENCE_TIMEOUT");
      expect(err.grund).toBe("timeout");
      expect(err.message).toContain("Zeitüberschreitung");
      ohneHostUndToken(err.message);
      return true;
    });
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it("fetch, das auf das Signal reagiert → derselbe Fehler; sein Abbruchtext (Host, Token) erreicht den Aufrufer nie", async () => {
    const client = new ConfluenceRestClient(cfg(haengtBisAbbruch, { timeoutMs: 50 }));
    await expect(client.listPages()).rejects.toSatisfy((e: unknown) => {
      const err = e as ConfluenceRequestError;
      expect(err.code).toBe("CONFLUENCE_TIMEOUT");
      ohneHostUndToken(err.message);
      ohneHostUndToken(String(err.stack ?? ""));
      return true;
    });
  });

  it("das Abort-Signal geht mit an fetch (undici bricht damit sauber ab)", async () => {
    let gesehen: RequestInit | undefined;
    const fetchFn = (async (_u: string, init: RequestInit) => {
      gesehen = init;
      return okJson({ results: [] });
    }) as unknown as typeof fetch;
    await new ConfluenceRestClient(cfg(fetchFn)).listPages();
    expect(gesehen?.signal).toBeInstanceOf(AbortSignal);
    expect(gesehen?.redirect).toBe("error"); // die R2a-Härtung bleibt
  });

  it("eine Antwort, deren Body tröpfelt, steht unter derselben Frist", async () => {
    const fetchFn = (async () =>
      ({
        ok: true,
        status: 200,
        json: () => new Promise<unknown>(() => undefined), // Body kommt nie zu Ende
      }) as unknown as Response) as unknown as typeof fetch;
    const client = new ConfluenceRestClient(cfg(fetchFn, { timeoutMs: 50 }));
    await expect(client.listPages()).rejects.toMatchObject({ code: "CONFLUENCE_TIMEOUT" });
  });
});

describe("JOB 2683 D1 · R2-1 · die Größenkante", () => {
  it("content-length über der Grenze → CONFLUENCE_RESPONSE_TOO_LARGE, ohne ein Byte des Bodys zu lesen", async () => {
    let bodyGelesen = false;
    const fetchFn = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": String(6 * 1024 * 1024) }),
        json: async () => {
          bodyGelesen = true;
          return { results: [] };
        },
      }) as unknown as Response) as unknown as typeof fetch;
    await expect(new ConfluenceRestClient(cfg(fetchFn)).listPages()).rejects.toMatchObject({
      code: "CONFLUENCE_RESPONSE_TOO_LARGE",
    });
    expect(bodyGelesen).toBe(false);
  });

  it("ein echter Body-Stream über der Grenze wird abgebrochen; darunter wird er normal gelesen", async () => {
    const gross = JSON.stringify({ results: [{ id: "1", title: "x".repeat(5_000) }] });
    const zuGross = (async () => new Response(gross)) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(cfg(zuGross, { maxResponseBytes: 1_000 })).listPages(),
    ).rejects.toMatchObject({ code: "CONFLUENCE_RESPONSE_TOO_LARGE" });

    const passt = (async () => new Response(gross)) as unknown as typeof fetch;
    const pages = await new ConfluenceRestClient(
      cfg(passt, { maxResponseBytes: 100_000 }),
    ).listPages();
    expect(pages.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("JOB 2683 D1 · R2-1 · eine langsame Ergebnisseite tötet den Lauf nicht", () => {
  it("Folge-Request hängt → die gelesenen Seiten bleiben, truncated trägt den Grund", async () => {
    let n = 0;
    const fetchFn = ((_u: string) => {
      n += 1;
      if (n === 1) {
        return Promise.resolve(
          okJson({
            results: [
              { id: "1", title: "A" },
              { id: "2", title: "B" },
            ],
            _links: { next: "/rest/api/content?start=2" },
          }),
        );
      }
      return new Promise<Response>(() => undefined); // die zweite Ergebnisseite kommt nie
    }) as unknown as typeof fetch;
    const client = new ConfluenceRestClient(cfg(fetchFn, { timeoutMs: 50 }));
    const start = Date.now();
    const ergebnis = await client.listAllPages();
    expect(Date.now() - start).toBeLessThan(1_000);
    expect(ergebnis.pages.map((p) => p.id)).toEqual(["1", "2"]); // nichts verworfen
    expect(ergebnis.truncated).toBe(true); // aber ehrlich unvollständig
    expect(ergebnis.abbruch).toMatchObject({ grund: "timeout", nachSeiten: 2 });
    ohneHostUndToken(ergebnis.abbruch?.meldung ?? "");
  });

  it("ERSTER Request hängt → wirft (es gibt nichts zu behalten, und ein leeres unvollständig wäre eine Lüge)", async () => {
    const client = new ConfluenceRestClient(cfg(nieAufloesend, { timeoutMs: 50 }));
    await expect(client.listAllPages()).rejects.toMatchObject({ code: "CONFLUENCE_TIMEOUT" });
  });

  it("Folge-Antwort zu groß → dieselbe Regel: behalten, truncated, Grund zu_gross", async () => {
    let n = 0;
    const fetchFn = (async () => {
      n += 1;
      if (n === 1) {
        return okJson({
          results: [{ id: "1", title: "A" }],
          _links: { next: "/rest/api/content?start=1" },
        });
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "99999999" }),
        json: async () => ({ results: [] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const ergebnis = await new ConfluenceRestClient(cfg(fetchFn)).listAllPages();
    expect(ergebnis.pages).toHaveLength(1);
    expect(ergebnis.truncated).toBe(true);
    expect(ergebnis.abbruch?.grund).toBe("zu_gross");
  });

  it("Zeitbudget verbraucht → kein weiterer Cursor, truncated mit Grund zeitbudget", async () => {
    let n = 0;
    const fetchFn = (async () => {
      n += 1;
      await warte(20);
      return okJson({
        results: [{ id: String(n), title: "x" }],
        _links: { next: "/rest/api/content?start=1" },
      });
    }) as unknown as typeof fetch;
    const ergebnis = await new ConfluenceRestClient(
      cfg(fetchFn, { totalBudgetMs: 10 }),
    ).listAllPages();
    expect(n).toBe(1); // nach der ersten Antwort ist das Budget weg — kein zweiter Hop
    expect(ergebnis.pages).toHaveLength(1);
    expect(ergebnis.truncated).toBe(true);
    expect(ergebnis.abbruch?.grund).toBe("zeitbudget");
  });

  it("ohne Störung bleibt alles wie bisher: alle Seiten, nicht truncated, kein abbruch", async () => {
    let n = 0;
    const fetchFn = (async () => {
      n += 1;
      return okJson(
        n === 1
          ? { results: [{ id: "1", title: "A" }], _links: { next: "/rest/api/content?start=1" } }
          : { results: [{ id: "2", title: "B" }] },
      );
    }) as unknown as typeof fetch;
    const ergebnis = await new ConfluenceRestClient(cfg(fetchFn)).listAllPages();
    expect(ergebnis.pages.map((p) => p.id)).toEqual(["1", "2"]);
    expect(ergebnis.truncated).toBe(false);
    expect(ergebnis.abbruch).toBeUndefined();
  });
});
