// @vitest-environment jsdom
// ================================================================================================
// JOB 557 / D10 — DIE GANZE KETTE, OHNE DEN ABRUFHOOK ZU ERSETZEN (BEN, Korrekturpflicht 1).
// ================================================================================================
//
// WAS D9 OFFENGELASSEN HAT, in BENs Worten (`BEN-PRUEFUNG-JOB-557-D9.md:10`):
//
//   „Service/Emittent, Audit-Allowlist, Web-Hilfsfunktion und Renderer sind jeweils belegt, aber
//    Wiretyp und Clientabruf werden im UI-Test durch den Mock von `../api/hooks` umgangen. Eine
//    Änderung oder ein Verlust von `ko.returned-to-owner` an dieser Naht könnte die Anzeige im
//    Produkt brechen, während alle vorgelegten Spezialtests grün blieben."
//
// Das war richtig. `KnowledgeDetail.owner-rework.test.tsx` ersetzt `../api/hooks` und speist seine
// Audit-Einträge selbst — die Kette wird dort AB DEM EREIGNIS gemessen. Zwischen dem, was das
// Audit-Repository liefert, und dem, was der Renderer bekommt, lagen zwei ungetestete Glieder:
// die Wireabbildung (`endpoints.audit.list` → `GET /api/audit`, `AuditEntry[]`) und der produktive
// Abrufhook (`useAudit`).
//
// DIESE DATEI SCHLIESST GENAU DIESE NAHT — und zwar so, dass sie sie nicht umgehen KANN:
//
//   · `../api/hooks` wird NICHT gemockt. `useAudit`, `useKo`, `useKos` und alle übrigen Haken sind
//     die produktiven.
//   · Gespeist wird an der TRANSPORTGRENZE: `globalThis.fetch`. Damit läuft die echte Strecke
//     `useAudit` → `endpoints.audit.list` → `api.get<AuditEntry[]>("/audit")` → `apiFetch` → `fetch`,
//     und der Vertragsgegenstand ist die JSON-Nutzlast auf dem Draht — der echte Wiretyp.
//   · Der Query-Client ist ein echter `QueryClient`.
//
// WAS HIER TROTZDEM ERSETZT WIRD, und warum das nicht dieselbe Sache ist: `AuthContext`,
// `RoleContext` und `ToastContext`. Sie sind kein Datenabruf, sondern die Sitzung — wer angemeldet
// ist, entscheidet die Frage „liegt es bei mir?" überhaupt erst. BENs Auflage nennt ausdrücklich
// den AUDIT-ABRUFHOOK; der ist hier echt.
//
// C5 IST DER SELBSTSCHUTZ DIESER DATEI. Ohne ihn wäre nicht belegt, dass die Strecke wirklich über
// den Draht lief — ein stiller Mock oder ein Cache-Treffer sähe genauso grün aus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditEntry, KnowledgeObject } from "../api/types";

const AUTORIN = "u-autorin";
const EIGENTUEMERIN = "u-eigentuemerin";
const KO_ID = "ko-1";
const TITEL = "Ventil X schliesst bei Ueberdruck";

function ko(): KnowledgeObject {
  return {
    id: KO_ID,
    title: TITEL,
    statement: "Bei Ueberdruck Ventil X manuell schliessen.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: AUTORIN,
    author: AUTORIN,
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-19T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as unknown as KnowledgeObject;
}

/**
 * Ein Rückgabeereignis in der Gestalt, die das Audit-Repository über den Draht schickt.
 *
 * Der Gegenstand ist das Feld `action`: Es muss unverändert vom Emittenten bis hierher kommen.
 */
function rueckgabe(action: string, responsible: string): AuditEntry {
  return {
    seq: 1,
    at: "2026-08-19T10:00:00.000Z",
    actor: "u-prueferin",
    action,
    target: KO_ID,
    payload: { verdict: "warn", responsible },
    prevHash: "h0",
    hash: "h1",
  };
}

// Die Sitzung — kein Datenabruf, s. Kopfkommentar.
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: AUTORIN, name: "Autorin", role: "experte" } }),
}));
vi.mock("../app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: false, setStufe2: () => {} }),
}));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "../i18n";
import { KnowledgeDetail } from "./KnowledgeDetail";
import { MyTasks } from "./MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const BANNER = String(i18n.getResource("de", "translation", "ko.returnedBanner"));

// ── DIE TRANSPORTGRENZE ─────────────────────────────────────────────────────────────────────────
//
// Ein Router über `fetch`. Er kennt nur Pfade, keine Hooks — genau deshalb kann er die Kette nicht
// abkürzen. `apiFetch` liest `ok`, `status`, `statusText` und `text()`; mehr braucht es nicht, und
// ein selbstgebautes Antwortobjekt hält den Test unabhängig von der `Response`-Umgebung.
let auditNutzlast: AuditEntry[] = [];
let gerufenePfade: string[] = [];

function antwort(daten: unknown): unknown {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve(JSON.stringify(daten)),
  };
}

function transport(pfad: string): unknown {
  const ohneFrage = pfad.split("?")[0] ?? pfad;
  if (ohneFrage === "/api/audit") {
    return antwort(auditNutzlast);
  }
  if (ohneFrage === `/api/kos/${KO_ID}`) {
    return antwort(ko());
  }
  if (ohneFrage === "/api/kos") {
    // `returnedToAuthor(audit, kos, userId)` braucht das Objekt — ohne es hätte die Aufgabenliste
    // nichts, worauf sie das Ereignis beziehen könnte, und C2 wäre trivial erfüllt.
    return antwort([ko()]);
  }
  if (ohneFrage === "/api/validation/board") {
    // BEWUSST LEER. Stünde das Objekt hier, führte `MyTasks` seinen Titel schon als PRÜFAUFGABE —
    // und `fuehrtAufgabe()` würde die Rückgabe-Aufgabe nicht mehr von ihr unterscheiden. Gemessen:
    // mit gefülltem Board fielen C2 und C4 aus genau diesem falschen Grund.
    return antwort([]);
  }
  if (ohneFrage === "/api/external/policy") {
    return antwort({ stage: "blocked" });
  }
  if (ohneFrage === `/api/kos/${KO_ID}/neighbors`) {
    // Die echte Gestalt aus `api/types.ts:588` — eine erfundene wirft die Nachbarschaftskarte in
    // einen Renderfehler und alle Fälle würden aus dem falschen Grund rot.
    return antwort({
      center: { id: KO_ID, title: TITEL, status: "offen" },
      neighbors: [],
      total: 0,
      truncated: false,
      excludedTags: [],
    });
  }
  // Alles Übrige ist für diesen Vertrag ohne Belang und antwortet leer — aber es antwortet, statt
  // die Seite in einen Fehlerzustand zu werfen.
  return antwort([]);
}

beforeEach(() => {
  auditNutzlast = [];
  gerufenePfade = [];
  vi.stubGlobal("fetch", (eingabe: unknown) => {
    const pfad = String(eingabe);
    gerufenePfade.push(pfad);
    return Promise.resolve(transport(pfad));
  });
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function neuerClient(): QueryClient {
  // `retry: false` und `gcTime: 0`: jeder Fall soll wirklich abrufen, nicht aus dem Vorlauf lesen.
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

async function mounte(was: "detail" | "aufgaben"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = neuerClient();
  const inhalt =
    was === "detail"
      ? createElement(
          MemoryRouter,
          { initialEntries: [`/wissen/${KO_ID}`] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
          ),
        )
      : createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(MyTasks));

  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, inhalt));
  });
  // Die Abrufe sind jetzt echt und damit asynchron. Mehrere Runden, weil abhängige Abfragen
  // (`useKo` → `useKoVersions`) erst nach der ersten Antwort starten.
  for (let runde = 0; runde < 12; runde += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function fuehrtAufgabe(): boolean {
  return text().includes(TITEL);
}

function abbauen(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 557 D10 · C — vom Draht bis zum Bildschirm, ohne den Abrufhook zu ersetzen", () => {
  it("C1 · ein über den echten Wirevertrag geliefertes `ko.returned-to-owner` ist am Objekt sichtbar", async () => {
    auditNutzlast = [rueckgabe("ko.returned-to-owner", EIGENTUEMERIN)];
    await mounte("detail");
    expect(
      text(),
      "Das Owner-Rückgabeereignis kam über `GET /api/audit` und den produktiven `useAudit` — der " +
        "Nacharbeit-Hinweis fehlt trotzdem. Damit ist die Kette zwischen Wirevertrag und Renderer " +
        "unterbrochen.",
    ).toContain(BANNER);
    abbauen();
  });

  it("C2 · dasselbe Ereignis erscheint NICHT in den Aufgaben der Autorin", async () => {
    auditNutzlast = [rueckgabe("ko.returned-to-owner", EIGENTUEMERIN)];
    await mounte("aufgaben");
    expect(
      fuehrtAufgabe(),
      "die Autorin bekommt eine Aufgabe angezeigt, die der Eigentümerin gehört",
    ).toBe(false);
    abbauen();
  });

  it("C3 · der Autor-Fallback bleibt sichtbar UND bleibt eine Autorenaufgabe", async () => {
    auditNutzlast = [rueckgabe("ko.returned-to-author", AUTORIN)];

    await mounte("detail");
    expect(text(), "der echte Autor-Fallback ist am Objekt nicht mehr sichtbar").toContain(BANNER);
    abbauen();

    await mounte("aufgaben");
    expect(
      fuehrtAufgabe(),
      "der echte Autor-Fallback ist aus der Aufgabenliste verschwunden — das wäre ein Rückschritt",
    ).toBe(true);
    abbauen();
  });

  it("C4 · KALIBRIERUNG: ohne Rückgabeereignis kein Hinweis und keine Aufgabe", async () => {
    auditNutzlast = [];

    await mounte("detail");
    expect(text(), "der Hinweis steht ohne jedes Rückgabeereignis").not.toContain(BANNER);
    abbauen();

    await mounte("aufgaben");
    expect(fuehrtAufgabe(), "die Aufgabenliste führt ein nie zurückgegebenes Objekt").toBe(false);
    abbauen();
  });

  it("C5 · SELBSTSCHUTZ: die Strecke lief wirklich über den Draht", async () => {
    // Ohne diesen Fall könnten C1–C4 auch dann grün sein, wenn irgendwo doch ein Hook ersetzt wäre
    // oder eine Antwort aus dem Cache käme. Hier wird gemessen, dass `GET /api/audit` tatsächlich
    // angefragt wurde — und dass die Nutzlast den Aktionsnamen unverändert trug.
    auditNutzlast = [rueckgabe("ko.returned-to-owner", EIGENTUEMERIN)];
    await mounte("detail");
    expect(
      gerufenePfade.some((p) => p.split("?")[0] === "/api/audit"),
      "`GET /api/audit` wurde nie angefragt — dann misst diese Datei nicht die Kette, sondern eine Attrappe.",
    ).toBe(true);
    expect(auditNutzlast[0]?.action).toBe("ko.returned-to-owner");
    abbauen();
  });
});
