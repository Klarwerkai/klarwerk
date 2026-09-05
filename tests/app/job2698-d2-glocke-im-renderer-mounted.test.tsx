// @vitest-environment jsdom
// ================================================================================================
// JOB 2698 D2 — DIE GLOCKE IM RENDERER: zeigt sie nach dem Umbau noch genau dasselbe wie vorher?
// ================================================================================================
//
// BEN zu D1 (PRODUKT ROT): „die ausdrücklich verlangte Gleichheit an der sichtbaren Glocke ist nur
// bis zur API-Antwort und nicht im Client/Renderer belegt." — „Ergänze zwingend einen Test über
// tatsächlichen Clientabruf und Glocken-Renderer, der dieselben sichtbaren Einträge und dieselbe
// Reihenfolge vor und nach der Umstellung prüft."
//
// WAS HIER ECHT IST: die Fastify-Anwendung (`buildApp`), die Anmeldung, die Route
// `GET /api/notifications`, der `PgAuditRepo` (über ein zählendes Pool-Doppel), der Client
// (`endpoints.notifications.list` → `api.get` → `fetch`), `useNotifications` und der Renderer
// `Topbar`/`NotificationBell`. Die Assertions stehen auf GERENDERTEN Elementen: den `li`-Einträgen
// des geöffneten Glocken-Panels (Text, Reihenfolge, Farbpunkt je Art, Gelesen-Zustand) und dem
// Zähler auf dem Glockenknopf.
//
// WAS ERSETZT IST, einzeln benannt:
//   1. PostgreSQL — ein Pool-Doppel, das die Anweisungen des Repos versteht, 40 000 Zeilen hält
//      und ZÄHLT, wie viele Zeilen je Abfrageart ausgeliefert werden (die „Servermessung“).
//   2. Die Browserschale um `fetch` — Basisadresse und Sitzung: `fetch → app.inject` mit dem
//      Bearer-Token der echten Anmeldung. Transport, keine Antwort.
//
// VORHER/NACHHER IN EINEM LAUF (wie in D1 an der API): „vorher“ ist derselbe Repo-Stand, aber
// ohne die gefilterten Lesewege (`findBy`/`existsBy`) — so sieht der Dienst eine Ablage, die nur
// `all()` kann, der Weg bis 2698. „nachher“ ist der volle `PgAuditRepo`. Beide werden bis in die
// Glocke gerendert, und das Gerenderte muss GLEICH sein — während die Servermessung für „nachher“
// 0 Vollscans meldet.
//
// ROT VORHER: Auf einem Stand ohne den D1-Serverteil (der Dienst ruft immer `all()`) ist die
// Gleichheit erfüllt, die Null-Vollscan-Zusicherung nicht — der Test ist rot. Mit D1 ist er grün.
// Die zwei GEGENPROBEN unten zeigen, dass die Vergleiche nicht leer sind: kippt die Reihenfolge
// der Ablage, unterscheidet sich das Gerenderte; fehlt der gefilterte Leseweg, sieht die Messung
// den Vollscan.
import { afterEach, describe, expect, it } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
// JOB 3060 · H1: die Glocke ist die Zeile „Meldungen“ im Konto-Menü des Kopfbands.
import { Kopfband } from "../../apps/web/src/shell/Kopfband";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { AuditRepo } from "../../services/audit/src/repo";
import { PgAuditRepo } from "../../services/audit/src/repo-pg";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// (1) Das Pool-Doppel — versteht INSERT, `last`, `findBySeq`, `all` und die gefilterten Lesewege
// des D1-Baus (erkannt an ihrer Form, nicht per Import: die Datei muss auch auf einem Stand OHNE
// D1 übersetzen, damit „rot vorher“ ein Testergebnis ist und kein Übersetzungsfehler).
// ------------------------------------------------------------------------------------------------
interface Zeile {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  event_id: string | null;
  hash_version: number;
}

interface Zaehler {
  vollscans: number;
  vollscanZeilen: number;
  /** Größe des Bestands zum Zeitpunkt des Abrufs — was EIN Vollscan ausliefert. */
  vollscanZeilenJeAbruf: number;
  gefiltertAufrufe: number;
  gefiltertZeilen: number;
  exists: number;
}

function poolDoppel() {
  const rows: Zeile[] = [];
  const zaehler: Zaehler = {
    vollscans: 0,
    vollscanZeilen: 0,
    vollscanZeilenJeAbruf: 0,
    gefiltertAufrufe: 0,
    gefiltertZeilen: 0,
    exists: 0,
  };
  const trifft = (r: Zeile, p: unknown[]): boolean => {
    const [actor, action, target] = p as [string | null, string | null, string | null];
    return (
      (actor === null || r.actor === actor) &&
      (action === null || r.action === action) &&
      (target === null || r.target === target)
    );
  };
  const istGefiltert = (sql: string): boolean =>
    sql.includes("FROM audit") && sql.includes("$1::text IS NULL OR actor = $1");
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO audit(")) {
        const mitEventId = sql.includes("event_id");
        const eventId = mitEventId ? ((params[8] as string | null) ?? null) : null;
        if (eventId && rows.some((r) => r.event_id === eventId)) {
          return { rows: [], rowCount: 0 };
        }
        rows.push({
          seq: params[0] as number,
          at: params[1] as string,
          actor: params[2] as string,
          action: params[3] as string,
          target: params[4] as string,
          payload: JSON.parse(params[5] as string) as Record<string, unknown>,
          prev_hash: params[6] as string,
          hash: params[7] as string,
          event_id: eventId,
          hash_version: Number(mitEventId ? params[9] : params[8]) || 1,
        });
        return { rows: [{ seq: params[0] }], rowCount: 1 };
      }
      if (sql === "SELECT * FROM audit ORDER BY seq DESC LIMIT 1") {
        const last = rows[rows.length - 1];
        return { rows: last ? [last] : [], rowCount: last ? 1 : 0 };
      }
      if (sql === "SELECT * FROM audit WHERE seq = $1") {
        const r = rows.find((x) => x.seq === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      if (sql === "SELECT * FROM audit ORDER BY seq") {
        zaehler.vollscans += 1;
        zaehler.vollscanZeilen += rows.length;
        return { rows: [...rows], rowCount: rows.length };
      }
      if (istGefiltert(sql) && sql.trimStart().startsWith("SELECT EXISTS")) {
        zaehler.exists += 1;
        return { rows: [{ vorhanden: rows.some((r) => trifft(r, params)) }], rowCount: 1 };
      }
      if (istGefiltert(sql)) {
        const res = rows.filter((r) => trifft(r, params));
        zaehler.gefiltertAufrufe += 1;
        zaehler.gefiltertZeilen += res.length;
        return { rows: res, rowCount: res.length };
      }
      throw new Error(`Doppel kennt diese Anweisung nicht: ${sql.slice(0, 80)}`);
    },
  };
  return { pool, rows, zaehler };
}

/** Der Weg bis 2698: dieselbe Ablage, nur ohne gefilterte Lesewege — der Dienst fällt auf all() zurück. */
function ohneFindBy(repo: PgAuditRepo): AuditRepo {
  return {
    append: (e, tx) => repo.append(e, tx),
    appendOnce: (e, tx) => repo.appendOnce(e, tx),
    all: () => repo.all(),
    last: (tx) => repo.last(tx),
    findBySeq: (seq, tx) => repo.findBySeq(seq, tx),
  };
}

/**
 * GEGENPROBE-Ablage: liefert jeden Lesepfad (all UND — wenn vorhanden — findBy) in umgekehrter
 * Reihenfolge. Die Glocke nimmt die LETZTEN zwölf Wirkungen nach `seq`; kippt die Reihenfolge,
 * landen andere Einträge in der Glocke. Sieht der Vergleich das nicht, misst er die Glocke nicht.
 */
function verdreht(repo: PgAuditRepo): AuditRepo {
  const r = repo as unknown as Record<string, unknown>;
  const basis: Record<string, unknown> = {
    append: (e: never, tx: never) => repo.append(e, tx),
    appendOnce: (e: never, tx: never) => repo.appendOnce(e, tx),
    all: async () => (await repo.all()).reverse(),
    last: (tx: never) => repo.last(tx),
    findBySeq: (seq: never, tx: never) => repo.findBySeq(seq, tx),
  };
  if (typeof r.findBy === "function") {
    basis.findBy = async (...args: unknown[]) =>
      (
        (await (r.findBy as (...a: unknown[]) => Promise<unknown[]>).call(
          repo,
          ...args,
        )) as unknown[]
      )
        .slice()
        .reverse();
  }
  if (typeof r.existsBy === "function") {
    basis.existsBy = (...args: unknown[]) =>
      (r.existsBy as (...a: unknown[]) => Promise<boolean>).call(repo, ...args);
  }
  return basis as unknown as AuditRepo;
}

// ------------------------------------------------------------------------------------------------
// (2) Der gemischte Bestand: 40 000 Protokollzeilen, treffende und nicht treffende Aktionen,
// Zeitpunkte NICHT in seq-Reihenfolge — damit Auswahl (letzte zwölf nach seq) und Darstellung
// (Sortierung nach Zeit) zwei verschiedene Dinge sind, die beide stimmen müssen.
// ------------------------------------------------------------------------------------------------
const N = 40_000;
const TREFFER = 30;

function bestandFuellen(rows: Zeile[], autor: string): Zeile[] {
  const start = rows.length + 1;
  const treffer: Zeile[] = [];
  for (let i = 0; i < N; i++) {
    const seq = start + i;
    // Zeitpunkte durchmischt: (seq * 7919) mod N — bijektiv, aber nicht monoton.
    const at = new Date(1_700_000_000_000 + ((seq * 7919) % N) * 60_000).toISOString();
    const istTreffer = i % 1_333 === 0 && treffer.length < TREFFER;
    let zeile: Zeile;
    if (istTreffer) {
      zeile = {
        seq,
        at,
        actor: `leser-${i}`,
        action: "answer.helpful",
        target: `ko-${i}`,
        payload: { koAuthor: autor, koTitle: `Wissen ${i}` },
        prev_hash: `h${seq - 1}`,
        hash: `h${seq}`,
        event_id: null,
        hash_version: 2,
      };
      treffer.push(zeile);
    } else {
      const art = i % 5;
      zeile = {
        seq,
        at,
        actor: art === 3 ? autor : `frager-${i % 97}`,
        action:
          art === 0
            ? "ask.query"
            : art === 1
              ? "ko.created"
              : art === 2
                ? "answer.helpful" // für einen ANDEREN Autor — trifft die Aktion, nicht den Menschen
                : art === 3
                  ? "answer.helpful" // Selbstapplaus des Autors — ausgeschlossen
                  : "ko.validated",
        target: art === 2 || art === 3 ? `ko-fremd-${i}` : "frage",
        payload:
          art === 2
            ? { koAuthor: "jemand-anders", koTitle: `Fremdes Wissen ${i}` }
            : art === 3
              ? { koAuthor: autor, koTitle: `Eigenes Wissen ${i}` }
              : { answered: i % 3 === 0 },
        prev_hash: `h${seq - 1}`,
        hash: `h${seq}`,
        event_id: null,
        hash_version: 2,
      };
    }
    rows.push(zeile);
  }
  return treffer;
}

/** Was die Glocke zeigen MUSS, aus dem Bestand gerechnet: letzte 12 Treffer nach seq, nach Zeit absteigend, davon 8 sichtbar. */
function erwarteteTitel(treffer: Zeile[]): string[] {
  return treffer
    .slice(-12)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)
    .map((z) => String(z.payload.koTitle));
}

// ------------------------------------------------------------------------------------------------
// (3) Server + Brücke + Renderer
// ------------------------------------------------------------------------------------------------
type App = ReturnType<typeof buildApp>;

const bruecke = {
  app: null as unknown as App,
  token: "",
  /** Jede Anfrage, die der Client gestellt hat — Beleg des Clientabrufs, Hilfe bei Fehlern. */
  anfragen: [] as { method: string; url: string; status: number }[],
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: (init.method ?? "GET") as "GET",
      url: String(input),
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.anfragen.push({
      method: init.method ?? "GET",
      url: String(input),
      status: res.statusCode,
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(auditRepo: AuditRepo): Promise<{ id: string }> {
  const repos = inMemoryRepos();
  const services = assembleServices({ ...repos, auditRepo }, {});
  bruecke.app = buildApp(services);
  bruecke.token = "";
  bruecke.anfragen = [];
  brueckeAufbauen();
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2698.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2698.test", password: "geheim12345" },
  });
  bruecke.token = (login.json() as { token: string }).token;
  const me = await bruecke.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return { id: (me.json() as { id: string }).id };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function warteAufZustand(zustand: () => boolean, obergrenzeMs = 10_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    await act(flush);
    if (zustand()) {
      return;
    }
    if (Date.now() - start > obergrenzeMs) {
      const anfragen = bruecke.anfragen
        .map((a) => `${a.method} ${a.url} → ${a.status}`)
        .join(" | ");
      throw new Error(
        `Zustand nicht innerhalb von ${obergrenzeMs} ms erreicht. Anfragen: ${anfragen || "keine"}. HTML: ${container.innerHTML.slice(0, 400)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function topbarMounten(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/start"] },
                  createElement(Kopfband),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
}

/** H1: das Konto-Menü öffnen — die Zeile „Meldungen“ steht darin. */
async function kontoOeffnen(): Promise<void> {
  if (container.querySelector('[data-testid="konto-menue"]')) {
    return;
  }
  const konto = container.querySelector<HTMLButtonElement>('[data-testid="kopfband-konto"]');
  if (!konto) {
    throw new Error("Konto-Kreis nicht gefunden");
  }
  await act(async () => {
    konto.click();
    await flush();
  });
}

function glockenKnopf(): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('[data-testid="konto-meldungen"]');
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Zeile Meldungen nicht gefunden");
  }
  return btn;
}

/** Ein gerenderter Glockeneintrag — genau die Felder, die ein Mensch sieht. */
interface Eintrag {
  text: string;
  punkt: string;
  gelesen: boolean;
}

interface Glocke {
  /** Der Zähler auf dem Glockenknopf, BEVOR das Panel geöffnet wird (ungelesene Einträge). */
  zaehlerVorOeffnen: string | null;
  /** Derselbe Zähler NACH dem Öffnen — Öffnen ist Kenntnisnahme (Audit-P3), also null. */
  zaehlerNachOeffnen: string | null;
  eintraege: Eintrag[];
}

function zaehlerAmKnopf(): string | null {
  return glockenKnopf().querySelector(".kw-menue-wert")?.textContent ?? null;
}

function eintraegeAblesen(): Eintrag[] {
  return [...container.querySelectorAll("ul li")].map((li) => {
    const punkt = li.querySelector("span");
    const klassen = (punkt?.className ?? "").split(/\s+/);
    return {
      text: (li.querySelector("button")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      punkt: klassen.find((k) => k.startsWith("bg-")) ?? "",
      gelesen: li.className.includes("opacity-50"),
    };
  });
}

/** Der ganze Weg: Server mit dieser Ablage, Anmeldung, Topbar gemountet, Glocke geöffnet, abgelesen. */
async function glockeDurchlaufen(
  repoBauen: (pool: unknown) => AuditRepo,
): Promise<{ glocke: Glocke; zaehler: Zaehler; treffer: Zeile[]; helpfulZeilen: number }> {
  const doppel = poolDoppel();
  const pedi = await serverStarten(repoBauen(doppel.pool));
  const treffer = bestandFuellen(doppel.rows, pedi.id);
  expect(doppel.rows.length).toBeGreaterThanOrEqual(N);
  // Alle `answer.helpful`-Zeilen im Bestand — auch die für ANDERE Autoren und der Selbstapplaus.
  // Der D1-Filter arbeitet nach `action` in der Datenbank; wer der Autor ist, entscheidet der
  // Server danach (deriveImpacts). „Nur Treffer“ heißt also: genau diese Zeilen, nicht alle 40 000.
  const helpfulZeilen = doppel.rows.filter((r) => r.action === "answer.helpful").length;
  const vorher = { ...doppel.zaehler };
  await topbarMounten();
  await kontoOeffnen();
  // Der Client hat abgerufen, wenn der Zähler an der Zeile steht (12 ungelesene Wirkungen).
  await warteAufZustand(() => glockenKnopf().querySelector(".kw-menue-wert") !== null);
  const zaehlerVorOeffnen = zaehlerAmKnopf();
  // Öffnen ist die bewusste Kenntnisnahme (Audit-P3): der Renderer markiert alles Sichtbare als
  // gesehen (POST /api/notifications/seen, echt über die Brücke) — deshalb wird der Zähler VOR dem
  // Klick abgelesen, und die Einträge erscheinen im Panel als gelesen (grauer Punkt, blass).
  await act(async () => {
    glockenKnopf().click();
    await flush();
  });
  await warteAufZustand(() => container.querySelectorAll("ul li").length > 0);
  const glocke: Glocke = {
    zaehlerVorOeffnen,
    zaehlerNachOeffnen: zaehlerAmKnopf(),
    eintraege: eintraegeAblesen(),
  };
  const zaehler: Zaehler = {
    vollscans: doppel.zaehler.vollscans - vorher.vollscans,
    vollscanZeilen: doppel.zaehler.vollscanZeilen - vorher.vollscanZeilen,
    vollscanZeilenJeAbruf: doppel.rows.length,
    gefiltertAufrufe: doppel.zaehler.gefiltertAufrufe - vorher.gefiltertAufrufe,
    gefiltertZeilen: doppel.zaehler.gefiltertZeilen - vorher.gefiltertZeilen,
    exists: doppel.zaehler.exists - vorher.exists,
  };
  return { glocke, zaehler, treffer, helpfulZeilen };
}

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
});

describe("JOB 2698 D2 · die Glocke im echten Renderer, vor und nach dem Umbau", () => {
  it("40 000 Zeilen, gemischt: die Glocke zeigt NACHHER dieselben Einträge, dieselbe Reihenfolge, dieselben Felder wie VORHER — und der Server liest dafür keinen Vollscan", async () => {
    // NACHHER: der volle PgAuditRepo.
    const neu = await glockeDurchlaufen((pool) => new PgAuditRepo(pool as never));
    // VORHER: dieselbe Ablage ohne gefilterte Lesewege — der Weg bis 2698.
    const alt = await glockeDurchlaufen((pool) => ohneFindBy(new PgAuditRepo(pool as never)));

    // DAS GERENDERTE, nicht die API-Antwort: acht Einträge, Reihenfolge, Text, Farbpunkt, Zustand.
    expect(neu.glocke.eintraege).toHaveLength(8);
    expect(neu.glocke.eintraege).toEqual(alt.glocke.eintraege);
    expect(neu.glocke.zaehlerVorOeffnen).toBe(alt.glocke.zaehlerVorOeffnen);
    expect(neu.glocke.zaehlerNachOeffnen).toBe(alt.glocke.zaehlerNachOeffnen);

    // Nicht vakuös: die acht Einträge sind genau die aus dem Bestand gerechneten — Auswahl (letzte
    // zwölf Wirkungen nach seq), Reihenfolge (Zeit absteigend), Kennzeichnung der Art im Text
    // („Wirkung: Titel“); der Knopf zählte vor dem Öffnen zwölf ungelesene, danach keinen mehr, und
    // die Einträge stehen als gelesen im Panel (Kenntnisnahme durch Öffnen, Audit-P3).
    const praefix = i18n.t("topbar.notifImpact");
    expect(neu.glocke.eintraege.map((e) => e.text)).toEqual(
      erwarteteTitel(neu.treffer).map((t) => `${praefix}: ${t}`),
    );
    expect(neu.glocke.zaehlerVorOeffnen).toBe("12");
    expect(neu.glocke.zaehlerNachOeffnen).toBeNull();
    expect(new Set(neu.glocke.eintraege.map((e) => e.punkt))).toEqual(new Set(["bg-hairline"]));
    expect(neu.glocke.eintraege.every((e) => e.gelesen)).toBe(true);

    // DIE SERVERMESSUNG, im selben Lauf: vorher ein Vollscan über den ganzen Bestand je Abruf,
    // nachher keiner — je Abruf verlassen nur die `answer.helpful`-Zeilen die Ablage (rund zwei
    // Fünftel des Bestands, weil der gemischte Bestand absichtlich viele fremde Wirkungen trägt),
    // nie die 40 000. (Abrufe je Glocke: der Feed, das Als-gesehen-Markieren, der Nachlade-Fetch.)
    expect(alt.zaehler.vollscans, "vorher: die Glocke las das ganze Protokoll").toBeGreaterThan(0);
    expect(alt.zaehler.vollscanZeilen).toBe(
      alt.zaehler.vollscans * alt.zaehler.vollscanZeilenJeAbruf,
    );
    expect(alt.zaehler.vollscanZeilenJeAbruf).toBeGreaterThanOrEqual(N);
    expect(neu.zaehler.vollscans, "nachher: Vollscan während der Glocke").toBe(0);
    expect(neu.zaehler.gefiltertAufrufe).toBeGreaterThan(0);
    expect(neu.zaehler.gefiltertZeilen).toBe(neu.zaehler.gefiltertAufrufe * neu.helpfulZeilen);
    expect(neu.helpfulZeilen).toBeLessThan(N / 2);
    expect(neu.helpfulZeilen).toBeGreaterThanOrEqual(TREFFER);
  });

  it("GEGENPROBE Reihenfolge: liefert die Ablage ihre Zeilen verkehrt herum, zeigt die Glocke andere Einträge — der Vergleich oben sieht das", async () => {
    const richtig = await glockeDurchlaufen((pool) => new PgAuditRepo(pool as never));
    const gekippt = await glockeDurchlaufen((pool) => verdreht(new PgAuditRepo(pool as never)));
    expect(gekippt.glocke.eintraege).toHaveLength(8);
    expect(gekippt.glocke.eintraege).not.toEqual(richtig.glocke.eintraege);
    // Und zwar in der Sache: andere Titel, nicht nur andere Anordnung derselben.
    const titel = (g: Glocke) => new Set(g.eintraege.map((e) => e.text));
    expect(titel(gekippt.glocke)).not.toEqual(titel(richtig.glocke));
  });

  it("GEGENPROBE Messung: eine Ablage ohne gefilterten Leseweg macht die Null-Vollscan-Zusicherung rot — der Zähler ist kein toter Wert", async () => {
    const alt = await glockeDurchlaufen((pool) => ohneFindBy(new PgAuditRepo(pool as never)));
    expect(alt.glocke.eintraege).toHaveLength(8);
    expect(alt.zaehler.vollscans).toBeGreaterThan(0);
    expect(alt.zaehler.gefiltertAufrufe).toBe(0);
    expect(() => expect(alt.zaehler.vollscans).toBe(0)).toThrow();
  });
});
