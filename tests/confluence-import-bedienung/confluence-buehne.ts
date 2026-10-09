// ================================================================================================
// CONFLUENCE-IMPORT-BEDIENUNG · DIE BÜHNE: ECHTE APP, ECHTER ADAPTER, NUR CONFLUENCE IST ERSETZT.
// ================================================================================================
//
// Für die Gegenproben aus Bens Befund (K3 Folgeabruf, K5 Bereich bis Wissensobjekt, K6 Rahmen bis
// Übernahme, K1/K2 Betreiberschalter). Ersetzt ist GENAU EINE Stelle: die Antwort der externen
// Confluence-Instanz — als `fetchFn` des echten `ConfluenceRestClient` (`adapterFromConfig`). Alles
// darüber ist das Produkt: Client mit Frist, Zeitbudget und Redaction, Adapter mit Mapper, die
// Importrouten mit Laufablage und Betreiberschalter, Kandidatenannahme, Wissensobjekte.
//
// DIE BRÜCKE: der echte Client-Code der Oberfläche (`fetch("/api/…")`) spricht über `app.inject`
// mit DIESER App — dieselbe Bauform wie `tests/library/job2703-bruecke.ts`, nur mit eigener App,
// weil jene die Confluence-Routen aus der Umgebung baut und keinen eingesetzten Adapter kennt.
//
// DIE FREIGABE (`KLARWERK_CONFLUENCE_IMPORT`) — WANN SIE STEHT, und warum so:
//   · beim Bau der DIENSTE steht sie (`externalUpsert`: die Annahme schreibt den Herkunftsanker),
//   · beim Bau der APP steht sie NICHT — sonst registrierte `buildApp` die Confluence-Routen mit dem
//     Umgebungsadapter, und unsere Registrierung mit dem eingesetzten Adapter wäre doppelt,
//   · während der ANFRAGEN steht sie nur, wenn `freigabe: true` (Zugangsauskunft und Schalter lesen
//     sie je Anfrage). Ohne sie bleibt die Annahme ohne Erkennungslauf — wie in job2691.
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { adapterFromConfig } from "../support/confluence-adapter";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

/** Ein Token, das nirgends auftauchen darf — weder im Lauf, noch in einer Antwort, noch im DOM. */
export const TOKEN = "kw-bedienung-GEHEIM-0123456789abcdef";
/** Die Confluence-Adresse der Bühne. Auch sie gehört in keine Meldung. */
export const BASIS = "https://kw-bedienung.example.net/wiki";
export const SPACE = "KW";
/** Das Dienstkonto der Bühne — derselbe Wert im Adapter und in der Umgebung. */
const DIENSTKONTO = "dienstkonto@kw-bedienung.example";

/** Die vier Zugangsvariablen einer freigegebenen Bühne (nur mit `freigabe: true` gesetzt). */
const ZUGANGSDATEN: Record<string, string> = {
  KLARWERK_CONFLUENCE_BASE_URL: BASIS,
  KLARWERK_CONFLUENCE_USER: DIENSTKONTO,
  KLARWERK_CONFLUENCE_TOKEN: TOKEN,
  KLARWERK_CONFLUENCE_SPACE: SPACE,
};

export type App = ReturnType<typeof buildApp>;
export type Dienste = ReturnType<typeof buildServices>;

/** Eine Confluence-Seite, wie sie die REST-API mit dem Expand des Clients liefert. */
export function seite(id: string, titel: string, version: number, text: string): ConfluencePage {
  return {
    id,
    title: titel,
    type: "page",
    status: "current",
    body: { storage: { value: `<p>${text}</p>` } },
    version: { number: version, when: "2026-09-30T10:00:00.000Z", by: { displayName: "Pedi" } },
    _links: { webui: `/spaces/${SPACE}/pages/${id}` },
    metadata: { labels: { results: [] } },
  };
}

/** Die Antwortform, die `leseBegrenzt` im Client liest (kein Stream → `json()`). */
export function confluenceAntwort(status: number, daten: unknown): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    body: null,
    json: async () => daten,
  };
}

/** Bleibt offen, bis der Client seine Frist zieht — dann erst scheitert der Abruf. */
export function haengtBisZurFrist(init?: RequestInit): Promise<never> {
  return new Promise<never>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("abgebrochen")), {
      once: true,
    });
  });
}

/**
 * Die externe Confluence-Instanz als Tabelle: Seiten je Ergebnisseite (Cursor `start`), dazu der
 * Einzelabruf je Id für das Nachladen beim Übernehmen. `folgeseite` ersetzt die Antwort auf einen
 * Folgeabruf (Zeitüberschreitung u. ä.).
 */
export function confluenceInstanz(opts: {
  ergebnisseiten: ConfluencePage[][];
  folgeseite?: (init?: RequestInit) => Promise<unknown>;
  ersteVerzoegerungMs?: number;
}): { fetchFn: typeof fetch; abrufe: string[] } {
  const abrufe: string[] = [];
  const alle = opts.ergebnisseiten.flat();
  const fetchFn = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    abrufe.push(url);
    // R-0163: der Importeur liest je Seite auch die Anhangsliste. Diese Instanz führt keine
    // Anhänge — sie antwortet darauf wie Confluence mit einer leeren Liste ohne Folgecursor und
    // nicht mit einer Ergebnisseite des Space-Listings.
    if (new URL(url).pathname.endsWith("/child/attachment")) {
      return confluenceAntwort(200, { results: [] });
    }
    const einzel = /\/rest\/api\/content\/([^/?]+)\?/.exec(url);
    if (einzel) {
      const treffer = alle.find((p) => p.id === decodeURIComponent(einzel[1] ?? ""));
      return treffer ? confluenceAntwort(200, treffer) : confluenceAntwort(404, {});
    }
    const start = Number(new URL(url).searchParams.get("start") ?? "0");
    if (start > 0 && opts.folgeseite) {
      return opts.folgeseite(init);
    }
    if (start === 0 && opts.ersteVerzoegerungMs) {
      await new Promise((r) => setTimeout(r, opts.ersteVerzoegerungMs));
    }
    const seiten = opts.ergebnisseiten[start] ?? [];
    // Ein Folgecursor steht da, solange es weitere Ergebnisseiten gibt — oder, wenn eine ersetzte
    // Folgeseite geplant ist, auf der ersten.
    const naechste =
      start + 1 < opts.ergebnisseiten.length || (opts.folgeseite !== undefined && start === 0);
    return confluenceAntwort(200, {
      results: seiten,
      _links: naechste
        ? { next: `/rest/api/content?spaceKey=${SPACE}&type=page&start=${start + 1}` }
        : {},
    });
  }) as unknown as typeof fetch;
  return { fetchFn, abrufe };
}

export interface Buehne {
  app: App;
  dienste: Dienste;
  /** Kopfzeilen für direkte `inject`-Aufrufe (Bearer des Admins). */
  kopf: Record<string, string>;
  /** Jeder Aufruf, der über `fetch` aus der Oberfläche kam. */
  aufrufe: Array<{ method: string; url: string }>;
  /** `fetch` und die Freigabe zurückstellen. */
  abbauen(): void;
}

export async function baueBuehne(opts: {
  fetchFn: typeof fetch;
  timeoutMs?: number;
  totalBudgetMs?: number;
  freigabe?: boolean;
}): Promise<Buehne> {
  // Alles, was diese Bühne an der Umgebung ändert — und beim Abbau wörtlich zurückstellt.
  const umgebungVorher: Record<string, string | undefined> = {};
  for (const name of ["KLARWERK_CONFLUENCE_IMPORT", ...Object.keys(ZUGANGSDATEN)]) {
    umgebungVorher[name] = process.env[name];
  }
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const dienste = buildServices();
  // Entfernen statt `= undefined`: Node schriebe sonst die Zeichenkette "undefined" in die Umgebung.
  Reflect.deleteProperty(process.env, "KLARWERK_CONFLUENCE_IMPORT");
  const app = buildApp(dienste);
  const guards = makeGuards(dienste.auth);
  const adapter = adapterFromConfig({
    baseUrl: BASIS,
    email: DIENSTKONTO,
    apiToken: TOKEN,
    spaceKey: SPACE,
    fetchFn: opts.fetchFn,
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    ...(opts.totalBudgetMs !== undefined ? { totalBudgetMs: opts.totalBudgetMs } : {}),
  });
  app.register(
    confluenceImportRoutes({
      library: dienste.library,
      koService: dienste.ko,
      guards,
      reasoner: dienste.reasoner,
      makeAdapter: () => adapter,
      importRuns: dienste.importRuns,
      betreiberSchalter: dienste.confluenceImportSchalter,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: dienste.importRuns,
      externalSources: dienste.externalSources,
      guards,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@kw-bedienung.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@kw-bedienung.test", password: "geheim12345" },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  const kopf: Record<string, string> = { authorization: `Bearer ${token}` };
  if (opts.freigabe) {
    // Eine FREIGEGEBENE Installation heißt hier: Schalter UND die vier Zugangsvariablen stehen —
    // sonst meldet die Zugangsauskunft (liest die Umgebung, `confluenceCredentialState`) ehrlich
    // „ohne Zugangsdaten" (Befund nacharbeit-3, B1). Die Werte sind dieselben, mit denen der
    // eingesetzte Adapter oben gebaut ist; Confluence erreicht weiterhin nur `fetchFn`.
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    for (const [name, wert] of Object.entries(ZUGANGSDATEN)) {
      process.env[name] = wert;
    }
  }

  const aufrufe: Array<{ method: string; url: string }> = [];
  const fetchVorher = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const method = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({ method, url });
    const headers: Record<string, string> = { ...kopf };
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const res = await app.inject({
      method: method as "GET" | "POST" | "PUT" | "DELETE",
      url,
      headers,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      statusText: String(res.statusCode),
      headers: { get: (n: string) => (res.headers[n.toLowerCase()] as string | undefined) ?? null },
      text: async () => res.body,
      json: async () => res.json(),
    };
  }) as unknown as typeof globalThis.fetch;

  return {
    app,
    dienste,
    kopf,
    aufrufe,
    abbauen() {
      globalThis.fetch = fetchVorher;
      for (const [name, wert] of Object.entries(umgebungVorher)) {
        if (wert === undefined) {
          Reflect.deleteProperty(process.env, name);
        } else {
          process.env[name] = wert;
        }
      }
    },
  };
}
