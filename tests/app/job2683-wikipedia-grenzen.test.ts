// JOB 2683 D1 (Review EXT1-20260828, Befund R2-36) — DER SUCHKNOPF, DER NIE AUFHÖRT ZU DREHEN.
//
// Deterministisch gegen injizierte fetch-Fixtures, KEIN Netz. Kurze Fristen als Betriebsparameter;
// die Standardwerte werden getrennt gepinnt.
import { describe, expect, it } from "vitest";
import type { FetchLike } from "../../services/external-search/src/types";
import {
  EXTERNAL_SEARCH_MELDUNG,
  ExternalSearchFailure,
  WIKIPEDIA_MAX_QUERY_CHARS,
  WIKIPEDIA_MAX_RESPONSE_BYTES,
  WIKIPEDIA_TIMEOUT_MS,
  createWikipediaProvider,
  normalizeWikipediaLang,
} from "../../services/external-search/src/wikipedia";

const nieAufloesend: FetchLike = () => new Promise(() => undefined);
const okFetch =
  (body: unknown): FetchLike =>
  async () => ({ ok: true, status: 200, json: async () => body });
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Was ein Mensch NIE in der Antwort lesen soll: Host, DNS-Fehler, Stack. */
function generisch(text: string): void {
  expect(text).not.toMatch(/wikipedia\.org/);
  expect(text).not.toMatch(/ENOTFOUND|getaddrinfo|ECONNREFUSED|TypeError|at /);
}

describe("JOB 2683 D1 · R2-36 · die Frist", () => {
  it("die Standardwerte sind die aus dem Befund abgeleiteten Betriebsparameter", () => {
    expect(WIKIPEDIA_TIMEOUT_MS).toBe(5_000);
    expect(WIKIPEDIA_MAX_QUERY_CHARS).toBe(200);
    expect(WIKIPEDIA_MAX_RESPONSE_BYTES).toBe(1024 * 1024);
  });

  it("GEGENPROBE: die Suche hängt, solange die Frist nicht greift — und endet GENAU durch sie", async () => {
    const provider = createWikipediaProvider({ fetchImpl: nieAufloesend, timeoutMs: 1_000 });
    let ausgang: "offen" | "erledigt" = "offen";
    const lauf = provider.search("Ventil").then(
      () => {
        ausgang = "erledigt";
      },
      () => {
        ausgang = "erledigt";
      },
    );
    await warte(300);
    expect(ausgang).toBe("offen"); // der Befund: nichts passiert
    await lauf;
    expect(ausgang).toBe("erledigt"); // der Fix: die Frist beendet es
  });

  it("nie auflösendes fetch → ExternalSearchFailure mit generischer Zeitüberschreitungs-Meldung, Ursache nur im detail", async () => {
    const provider = createWikipediaProvider({ fetchImpl: nieAufloesend, timeoutMs: 50 });
    const start = Date.now();
    await expect(provider.search("Ventil")).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(ExternalSearchFailure);
      const err = e as ExternalSearchFailure;
      expect(err.code).toBe("EXTERNAL_SEARCH_FAILED"); // derselbe Code wie bisher — sendError bildet ihn wie gehabt ab
      expect(err.message).toBe(EXTERNAL_SEARCH_MELDUNG.timeout);
      generisch(err.message);
      expect(err.detail).toContain("timeout after 50 ms");
      return true;
    });
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it("das Abort-Signal geht mit an fetch", async () => {
    let gesehen: { signal?: AbortSignal } | undefined;
    const fetchImpl = (async (_u: string, init?: { signal?: AbortSignal }) => {
      gesehen = init;
      return { ok: true, status: 200, json: async () => ({ query: { search: [] } }) };
    }) as unknown as FetchLike;
    await createWikipediaProvider({ fetchImpl }).search("x");
    expect(gesehen?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("JOB 2683 D1 · R2-36 · keine rohe Netzmeldung nach außen", () => {
  it("DNS-Fehler: der Nutzer liest den generischen Satz, das Log bekommt die Ursache", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError("fetch failed: getaddrinfo ENOTFOUND de.wikipedia.org");
    };
    await expect(createWikipediaProvider({ fetchImpl }).search("Ventil")).rejects.toSatisfy(
      (e: unknown) => {
        const err = e as ExternalSearchFailure;
        expect(err.message).toBe(EXTERNAL_SEARCH_MELDUNG.unreachable);
        generisch(err.message);
        expect(err.detail).toContain("ENOTFOUND de.wikipedia.org"); // die Ursache geht nicht verloren
        return true;
      },
    );
  });

  it("Fehlerstatus → Satz mit Statuscode, sonst nichts", async () => {
    const provider = createWikipediaProvider({
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    });
    await expect(provider.search("x")).rejects.toMatchObject({
      code: "EXTERNAL_SEARCH_FAILED",
      message: EXTERNAL_SEARCH_MELDUNG.status(503),
    });
  });

  it("unlesbare Antwort → generischer Satz", async () => {
    const provider = createWikipediaProvider({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
      }),
    });
    await expect(provider.search("x")).rejects.toMatchObject({
      message: EXTERNAL_SEARCH_MELDUNG.unreadable,
    });
  });
});

describe("JOB 2683 D1 · R2-36 · Kappung, Sprachkürzel, Größenkante", () => {
  it("die Suchanfrage wird auf 200 Zeichen gekappt — gekürzt, nicht abgelehnt", async () => {
    let url = "";
    const fetchImpl: FetchLike = async (u) => {
      url = u;
      return { ok: true, status: 200, json: async () => ({ query: { search: [] } }) };
    };
    await createWikipediaProvider({ fetchImpl }).search("a".repeat(500));
    const srsearch = new URL(url).searchParams.get("srsearch") ?? "";
    expect(srsearch).toHaveLength(WIKIPEDIA_MAX_QUERY_CHARS);
  });

  it("lang ist nur als Sprachkürzel wirksam — alles andere fällt auf de zurück (kein Hostwechsel über die Umgebung)", async () => {
    expect(normalizeWikipediaLang("en")).toBe("en");
    expect(normalizeWikipediaLang("nds")).toBe("nds");
    expect(normalizeWikipediaLang(undefined)).toBe("de");
    for (const boese of ["de.wikipedia.org", "evil.example/", "../x", "DE", "d", "", "en-gb"]) {
      expect(normalizeWikipediaLang(boese)).toBe("de");
    }
    let url = "";
    const fetchImpl: FetchLike = async (u) => {
      url = u;
      return { ok: true, status: 200, json: async () => ({ query: { search: [] } }) };
    };
    await createWikipediaProvider({ fetchImpl, lang: "evil.example/#" }).search("x");
    expect(new URL(url).host).toBe("de.wikipedia.org");
  });

  it("content-length über der Grenze → verworfen, ohne den Body zu lesen", async () => {
    let gelesen = false;
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(2 * 1024 * 1024) }),
      text: async () => {
        gelesen = true;
        return "{}";
      },
      json: async () => ({}),
    })) as unknown as FetchLike;
    await expect(createWikipediaProvider({ fetchImpl }).search("x")).rejects.toMatchObject({
      message: EXTERNAL_SEARCH_MELDUNG.tooLarge,
    });
    expect(gelesen).toBe(false);
  });

  it("gelesener Text über der Grenze → verworfen; darunter wird er normal ausgewertet", async () => {
    const body = JSON.stringify({
      query: { search: [{ title: "Druck", snippet: "x".repeat(3_000) }] },
    });
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      text: async () => body,
      json: async () => JSON.parse(body),
    })) as unknown as FetchLike;
    await expect(
      createWikipediaProvider({ fetchImpl, maxResponseBytes: 1_000 }).search("x"),
    ).rejects.toMatchObject({ message: EXTERNAL_SEARCH_MELDUNG.tooLarge });
    const treffer = await createWikipediaProvider({ fetchImpl, maxResponseBytes: 100_000 }).search(
      "x",
    );
    expect(treffer.map((t) => t.title)).toEqual(["Druck"]);
  });

  it("der Normalfall bleibt unverändert: Treffer werden gemappt", async () => {
    const provider = createWikipediaProvider({
      fetchImpl: okFetch({
        query: { search: [{ title: "Sicherheitsventil", snippet: "Schützt." }] },
      }),
    });
    expect(await provider.search("Ventil")).toEqual([
      {
        title: "Sicherheitsventil",
        url: "https://de.wikipedia.org/wiki/Sicherheitsventil",
        snippet: "Schützt.",
        provider: "Wikipedia",
      },
    ]);
  });
});
