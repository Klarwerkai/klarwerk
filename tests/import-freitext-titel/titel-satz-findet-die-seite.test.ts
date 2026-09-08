// JOB 3356 (IMPORT-FREITEXT-TITEL) — DER LIVE BEOBACHTETE FALL, AM ECHTEN ROUTENWEG.
//
// Codex-Livebefund 311b601a auf 1.201, wörtlich: „Erste Eingrenzung mit exaktem Titel
// `[DEMO T06] Restoring a customer file` … System interpretiert Thema ‚Customer file restoration'
// und zeigt 0 Treffer." Der Reasoner-Doppelgänger unten liefert GENAU diese Deutung: ein echter
// `Reasoner` mit einem `ModelProvider`, dessen `complete` das beobachtete Kriterien-JSON
// zurückgibt — derselbe Weg, den das Produkt geht (deriveImportCriteria → completeRaw → complete),
// kein gemockter Zwischenschritt. Der Snapshot ist komplett `intern`, damit die Cloud-Kante des
// Vertraulichkeitsvertrags überhaupt offen ist und die Deutung wirklich stattfindet.
//
// WAS DIESER TEST FESTHÄLT:
//   1. Die KI-Deutung wird NICHT beschönigt: `preview` bleibt leer, `matched` bleibt 0.
//   2. Daneben steht der deterministische Titelbefund `titleFallback` (query, matched, criteria).
//   3. Ein zweiter Aufruf mit genau diesen `criteria` liefert genau die gesuchte Seite.
//   4. Ohne Satz gibt es das Feld nicht (kein Platzhalter, keine erfundene Zahl).
//   5. Auch `matched: 0` wird gesendet — „auch im Titel steht das nirgends" ist die Auskunft, die
//      Bedienhürde von fehlender Quelle trennt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem, SelectCriteria } from "../../services/library-analytics";
import { ModelProvider, Reasoner } from "../../services/reasoner";

interface TitelAntwort {
  matched: number;
  criteria: SelectCriteria;
  preview: { title: string }[];
  inferenceStatus?: string;
  titleFallback?: { query: string; matched: number; criteria: SelectCriteria };
}

function item(overrides: Partial<ImportItem> & { title: string }): ImportItem {
  return {
    statement: "kurz",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    confidentiality: "intern",
    updatedAt: "2026-06-01T00:00:00.000Z",
    textCodec: "decoded",
    ...overrides,
  };
}

const GESUCHT = "[DEMO T06] Restoring a customer file";

// Der Snapshot der Vorführung: die gesuchte Seite (Label „Demo") und drei andere.
const SNAPSHOT: ImportItem[] = [
  item({ title: GESUCHT, tags: ["Demo"], externalId: "t06" }),
  item({ title: "[DEMO T07] Archiving a customer file", tags: ["Demo"], externalId: "t07" }),
  item({ title: "Wartung Pumpe", tags: ["Wartung"], externalId: "p1" }),
  item({ title: "Fehlercode E5", tags: ["Wartung"], externalId: "p2" }),
];

function fixtureAdapter(items: ImportItem[]): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
}

// Der Doppelgänger liefert die im Livelauf beobachtete Deutung — ein Thema, das weder Label noch
// abgeleitetes Titel-Thema irgendeiner Seite ist.
function deutenderReasoner(criteriaJson: string): Reasoner {
  return new Reasoner(
    new ModelProvider({ name: "anthropic:test", complete: async () => criteriaJson }),
  );
}

async function selectApp(items: ImportItem[], reasoner?: Reasoner) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: reasoner ?? services.reasoner,
      makeAdapter: () => fixtureAdapter(items),
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return {
    app,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

const selectBody = (body: unknown) => ({
  method: "POST" as const,
  url: "/api/admin/import/confluence/select",
  payload: body as Record<string, unknown>,
});

describe("JOB 3356: Freitext-Satz mit exaktem Titel — 0 Treffer, aber nicht mehr stumm", () => {
  it("KI deutet 'Customer file restoration' → 0 Treffer BLEIBEN 0, daneben steht der Titelbefund", async () => {
    const { app, headers } = await selectApp(
      SNAPSHOT,
      deutenderReasoner('{"themes":["Customer file restoration"]}'),
    );
    const res = await app.inject({
      ...selectBody({ prompt: GESUCHT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as TitelAntwort;
    // Die KI hat gedeutet (kein Ausfall) — und ihre Deutung ergibt ehrlich nichts.
    expect(body.inferenceStatus).toBe("ok");
    expect(body.criteria).toEqual({ themes: ["Customer file restoration"] });
    expect(body.matched).toBe(0);
    expect(body.preview).toHaveLength(0);
    // Daneben: der deterministische Titelbefund zum eingegebenen Wortlaut.
    expect(body.titleFallback).toEqual({
      query: GESUCHT,
      matched: 1,
      criteria: { titleContains: [GESUCHT] },
    });
  });

  it("der zweite Aufruf mit titleFallback.criteria liefert GENAU diese eine Seite", async () => {
    const { app, headers } = await selectApp(
      SNAPSHOT,
      deutenderReasoner('{"themes":["Customer file restoration"]}'),
    );
    const erst = await app.inject({
      ...selectBody({ prompt: GESUCHT, promptConfidential: false }),
      headers,
    });
    const fallback = (erst.json() as TitelAntwort).titleFallback;
    expect(fallback).toBeDefined();
    const zweit = await app.inject({
      // Der Titelweg greift OHNE Satz — sonst käme die KI-Deutung über UND wieder dazu.
      ...selectBody({ criteria: fallback?.criteria }),
      headers,
    });
    expect(zweit.statusCode).toBe(200);
    const body = zweit.json() as TitelAntwort;
    expect(body.matched).toBe(1);
    expect(body.preview.map((p) => p.title)).toEqual([GESUCHT]);
    expect(body.criteria).toEqual({ titleContains: [GESUCHT] });
    // Ohne Satz gibt es keinen Titelbefund — es wurde ja nichts gedeutet.
    expect("titleFallback" in (zweit.json() as Record<string, unknown>)).toBe(false);
  });

  it("der Deckel des ursprünglichen Aufrufs reist unverändert mit (keine neue Menge)", async () => {
    const { app, headers } = await selectApp(
      SNAPSHOT,
      deutenderReasoner('{"themes":["Customer file restoration"]}'),
    );
    const res = await app.inject({
      ...selectBody({ prompt: "customer file", promptConfidential: false, criteria: { limit: 1 } }),
      headers,
    });
    const body = res.json() as TitelAntwort;
    expect(body.titleFallback?.criteria).toEqual({ titleContains: ["customer file"], limit: 1 });
    // Zwei Seiten tragen den Text im Titel; der Deckel zeigt eine — und sagt es (limited).
    expect(body.titleFallback?.matched).toBe(2);
    const zweit = await app.inject({
      ...selectBody({ criteria: body.titleFallback?.criteria }),
      headers,
    });
    const zweitBody = zweit.json() as TitelAntwort & { limited: boolean };
    expect(zweitBody.matched).toBe(2);
    expect(zweitBody.preview).toHaveLength(1);
    expect(zweitBody.limited).toBe(true);
  });

  it("auch die 0 wird gesagt: ein Satz ohne jeden Titeltreffer bekommt matched 0", async () => {
    const { app, headers } = await selectApp(
      SNAPSHOT,
      deutenderReasoner('{"themes":["Customer file restoration"]}'),
    );
    const res = await app.inject({
      ...selectBody({ prompt: "Hydraulik am Kran", promptConfidential: false }),
      headers,
    });
    const body = res.json() as TitelAntwort;
    expect(body.preview).toHaveLength(0);
    expect(body.titleFallback).toEqual({
      query: "Hydraulik am Kran",
      matched: 0,
      criteria: { titleContains: ["Hydraulik am Kran"] },
    });
  });

  it("zweite Chance: findet der Wortlaut nichts, zählt die längste geklammerte Teilkette", async () => {
    const { app, headers } = await selectApp(
      SNAPSHOT,
      deutenderReasoner('{"themes":["Customer file restoration"]}'),
    );
    const res = await app.inject({
      ...selectBody({
        prompt: `Zeig mir bitte die Seite „${GESUCHT}“ aus der Demo`,
        promptConfidential: false,
      }),
      headers,
    });
    const body = res.json() as TitelAntwort;
    // Der ganze Satz steht in keinem Titel — der zitierte Teil schon. Gezählt wird, was gefunden
    // wurde, und `query` sagt ehrlich, welcher Text das war.
    expect(body.titleFallback).toEqual({
      query: GESUCHT,
      matched: 1,
      criteria: { titleContains: [GESUCHT] },
    });
  });

  it("der Wortlaut des Menschen hat Vorrang vor der Verkürzung", async () => {
    const { app, headers } = await selectApp(
      SNAPSHOT,
      deutenderReasoner('{"themes":["Customer file restoration"]}'),
    );
    const res = await app.inject({
      ...selectBody({ prompt: GESUCHT, promptConfidential: false }),
      headers,
    });
    // Im Satz steckt „DEMO T06" in eckigen Klammern; gezählt wird trotzdem der EINGEGEBENE Satz,
    // weil er selbst trifft. Sonst antwortete die Zahl auf etwas anderes als die Eingabe.
    expect((res.json() as TitelAntwort).titleFallback?.query).toBe(GESUCHT);
  });

  it("ohne Satz gibt es KEIN titleFallback (nur Klick-Filter, nichts zu deuten)", async () => {
    const { app, headers } = await selectApp(SNAPSHOT);
    const res = await app.inject({ ...selectBody({ criteria: { themes: ["Demo"] } }), headers });
    expect(res.statusCode).toBe(200);
    expect("titleFallback" in (res.json() as Record<string, unknown>)).toBe(false);
    expect((res.json() as TitelAntwort).matched).toBe(2);
  });

  it("KI-Ausfall: der Titelbefund steht trotzdem daneben — er braucht kein Modell", async () => {
    const werfend = new Reasoner(
      new ModelProvider({
        name: "anthropic:test",
        complete: async () => {
          throw new Error("Modell down");
        },
      }),
    );
    const { app, headers } = await selectApp(SNAPSHOT, werfend);
    const res = await app.inject({
      ...selectBody({
        prompt: GESUCHT,
        promptConfidential: false,
        // Ein Klick-Filter, der die gesuchte Seite ausschließt → Vorschau bleibt leer.
        criteria: { themes: ["Wartung"], titleContains: [GESUCHT] },
      }),
      headers,
    });
    const body = res.json() as TitelAntwort;
    expect(body.inferenceStatus).toBe("unavailable");
    expect(body.preview).toHaveLength(0);
    expect(body.titleFallback?.matched).toBe(1);
  });
});
