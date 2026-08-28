// Wikipedia-Provider über die öffentliche MediaWiki-Such-API (kein API-Key).
// HTML-Snippets werden zu reinem Text bereinigt; URL wird sauber gebaut.
import {
  type ExternalResult,
  ExternalSearchError,
  type FetchLike,
  type SearchProvider,
} from "./types";

export interface WikipediaConfig {
  lang?: string; // Default "de"
  fetchImpl?: FetchLike;
  // JOB 2683 D1 (Review R2-36): Frist je Suche und Obergrenze je Antwort — Betriebsparameter.
  timeoutMs?: number;
  maxResponseBytes?: number;
}

// ================================================================================================
// JOB 2683 D1 (Review EXT1-20260828, Befund R2-36) — DER ZWEITE KNOPF, DER NIE AUFHÖRT ZU DREHEN.
// ================================================================================================
//
// DER BEFUND: `doFetch(url)` ohne Frist, `res.json()` ohne Größenkante, `q` ohne Längenkappung, `lang`
// ungeprüft aus der Umgebung — und der ROHE Netzfehler (`getaddrinfo ENOTFOUND de.wikipedia.org`) ging
// über `sendError` als 400-`message` an den Nutzer.
//
// WAS JETZT GILT:
//   · FRIST (`WIKIPEDIA_TIMEOUT_MS`): gegen den Aufruf geracet, damit auch ein fetch ohne Signalkenntnis
//     den Knopf nicht festhält. Danach eine klare Meldung, nicht ein Spinner.
//   · GRÖSSE (`WIKIPEDIA_MAX_RESPONSE_BYTES`): `content-length` vorab, sonst der gelesene Text.
//   · KAPPUNG (`WIKIPEDIA_MAX_QUERY_CHARS`): die Suchanfrage wird gekürzt, nicht abgelehnt.
//   · `lang` muss ein reines Sprachkürzel sein (`normalizeWikipediaLang`); alles andere fällt auf „de"
//     zurück — ein Env-Wert kann den Host damit nicht mehr verbiegen.
//   · MELDUNGEN NACH AUSSEN SIND GENERISCH (kein Host, kein DNS, kein Stack). Die rohe Ursache reist als
//     `detail` am Fehler mit und gehört ins Log (external-routes.ts), nie in die Antwort.
export const WIKIPEDIA_TIMEOUT_MS = 5_000;
export const WIKIPEDIA_MAX_RESPONSE_BYTES = 1024 * 1024;
export const WIKIPEDIA_MAX_QUERY_CHARS = 200;
export const WIKIPEDIA_DEFAULT_LANG = "de";

// Zwei bis drei Kleinbuchstaben — genau die Form, die MediaWiki-Sprachhosts tragen. Bewusst eng:
// ein Wert wie "de.wikipedia.org" oder "../x" wäre kein Sprachkürzel, sondern ein Hostwechsel.
const LANG_MUSTER = /^[a-z]{2,3}$/;

export function normalizeWikipediaLang(lang: string | undefined): string {
  return lang !== undefined && LANG_MUSTER.test(lang) ? lang : WIKIPEDIA_DEFAULT_LANG;
}

/** Die Sätze, die ein Mensch liest — ohne Host, ohne DNS, ohne Statuscode-Rätsel. */
export const EXTERNAL_SEARCH_MELDUNG = {
  timeout: "Die externe Suche antwortet nicht (Zeitüberschreitung). Bitte später erneut versuchen.",
  unreachable: "Die externe Suche ist zurzeit nicht erreichbar. Bitte später erneut versuchen.",
  status: (status: number) => `Die externe Suche antwortete mit Status ${status}.`,
  tooLarge: "Die Antwort der externen Suche war zu groß und wurde verworfen.",
  unreadable: "Die Antwort der externen Suche war nicht lesbar.",
} as const;

/**
 * Derselbe Fehlercode wie bisher (`EXTERNAL_SEARCH_FAILED`, damit `sendError` ihn wie gehabt abbildet),
 * aber mit getrennter Rolle der beiden Texte: `message` ist der generische Satz für die Antwort,
 * `detail` die rohe Ursache für das Log.
 */
export class ExternalSearchFailure extends ExternalSearchError {
  readonly detail: string | undefined;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = "ExternalSearchFailure";
    this.detail = detail;
  }
}

function rohText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// Body begrenzt lesen: `content-length` vorab, sonst der Text (beides nur, wenn die Antwort es hergibt —
// der schmale `FetchLike`-Vertrag garantiert nur `json()`).
async function leseBegrenzt(
  res: Awaited<ReturnType<FetchLike>>,
  maxBytes: number,
): Promise<unknown> {
  const reich = res as {
    headers?: { get?: (name: string) => string | null };
    text?: () => Promise<string>;
    json: () => Promise<unknown>;
  };
  const angekuendigt = Number(reich.headers?.get?.("content-length"));
  if (Number.isFinite(angekuendigt) && angekuendigt > maxBytes) {
    throw new ExternalSearchFailure(
      EXTERNAL_SEARCH_MELDUNG.tooLarge,
      `content-length ${angekuendigt} > ${maxBytes}`,
    );
  }
  if (typeof reich.text === "function") {
    const text = await reich.text();
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes > maxBytes) {
      throw new ExternalSearchFailure(
        EXTERNAL_SEARCH_MELDUNG.tooLarge,
        `body ${bytes} > ${maxBytes}`,
      );
    }
    return JSON.parse(text);
  }
  return reich.json();
}

// MediaWiki liefert Snippets mit <span class="searchmatch">…</span> & HTML-Entities.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function articleUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

interface MediaWikiSearchResponse {
  query?: { search?: { title?: unknown; snippet?: unknown }[] };
}

export function createWikipediaProvider(config: WikipediaConfig = {}): SearchProvider {
  const lang = normalizeWikipediaLang(config.lang);
  const doFetch = (config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)) as FetchLike;
  // Der `FetchLike`-Vertrag kennt kein zweites Argument; native fetch (und jede echte Implementierung)
  // nimmt `init.signal` entgegen, eine Fixture ignoriert es — beides ist erlaubt, die Frist unten gilt so
  // oder so.
  const fetchMitSignal = doFetch as unknown as (
    url: string,
    init?: { signal: AbortSignal },
  ) => ReturnType<FetchLike>;
  const timeoutMs = config.timeoutMs ?? WIKIPEDIA_TIMEOUT_MS;
  const maxBytes = config.maxResponseBytes ?? WIKIPEDIA_MAX_RESPONSE_BYTES;
  return {
    name: "Wikipedia",
    async search(query: string): Promise<ExternalResult[]> {
      const q = query.slice(0, WIKIPEDIA_MAX_QUERY_CHARS);
      const url =
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json` +
        `&srlimit=10&srprop=snippet&srsearch=${encodeURIComponent(q)}`;
      const controller = new AbortController();
      let abgelaufen = false;
      const timer = setTimeout(() => {
        abgelaufen = true;
        controller.abort();
      }, timeoutMs);
      const frist = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () =>
            reject(
              new ExternalSearchFailure(
                EXTERNAL_SEARCH_MELDUNG.timeout,
                `timeout after ${timeoutMs} ms`,
              ),
            ),
          { once: true },
        );
      });
      let data: MediaWikiSearchResponse;
      try {
        let res: Awaited<ReturnType<FetchLike>>;
        try {
          res = await Promise.race([fetchMitSignal(url, { signal: controller.signal }), frist]);
        } catch (error) {
          if (error instanceof ExternalSearchFailure) {
            throw error;
          }
          if (abgelaufen) {
            throw new ExternalSearchFailure(EXTERNAL_SEARCH_MELDUNG.timeout, rohText(error));
          }
          throw new ExternalSearchFailure(EXTERNAL_SEARCH_MELDUNG.unreachable, rohText(error));
        }
        if (!res.ok) {
          throw new ExternalSearchFailure(
            EXTERNAL_SEARCH_MELDUNG.status(res.status),
            `HTTP ${res.status}`,
          );
        }
        try {
          data = (await Promise.race([
            leseBegrenzt(res, maxBytes),
            frist,
          ])) as MediaWikiSearchResponse;
        } catch (error) {
          if (error instanceof ExternalSearchFailure) {
            throw error;
          }
          if (abgelaufen) {
            throw new ExternalSearchFailure(EXTERNAL_SEARCH_MELDUNG.timeout, rohText(error));
          }
          throw new ExternalSearchFailure(EXTERNAL_SEARCH_MELDUNG.unreadable, rohText(error));
        }
      } finally {
        clearTimeout(timer);
      }
      const hits = data.query?.search ?? [];
      const results: ExternalResult[] = [];
      for (const hit of hits) {
        const title = typeof hit.title === "string" ? hit.title : "";
        if (!title) {
          continue;
        }
        const snippet = typeof hit.snippet === "string" ? stripHtml(hit.snippet) : "";
        results.push({ title, url: articleUrl(lang, title), snippet, provider: "Wikipedia" });
      }
      return results;
    },
  };
}
