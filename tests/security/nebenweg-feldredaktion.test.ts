// ================================================================================================
// JOB 1125 · D1 — SICHTBARES PAAR HEISST NICHT SICHTBARER INHALT.
// ================================================================================================
//
// HERKUNFT. JOB 968 (PRO3) hat die drei G5-Nebenwege vermessen und dabei der Erwartung des Eintrags
// widersprochen: alle drei hängen an derselben zentralen Regel, und die ist an sechs Stellen
// fail-closed. Was fehlte, war feiner — wörtlich (§4, L1, Gewicht „hoch"):
//
//     „Die Paarregel ist binär. Sie fragt: Darf dieser Betrachter beide Objekte sehen? — und wenn
//      ja, fließt ALLES: Eigenanteile, Zitate, Titel."
//
// BEN hat daraus vier Prüflücken gemacht; die vierte benennt den Punkt, den JOB 968 selbst als L2
// führt und ausdrücklich NICHT gemessen hat:
//
//     „Vertraulichkeitsgleichlauf: … vertrauliche Seite darf nicht über Paarregel-Zitate oder
//      Eigenanteile leaken."
//
// DIESER TEST MISST GENAU DAS — am echten Routenpfad, nicht an einer Kopie der Regel. Die Fälle
// registrieren die ausgelieferten Fastify-Plugins (`conflictRoutes`, `overlapRoutes`) und lesen
// über `inject()`, was am Draht steht. `inject()` statt `listen()` ist kein Behelf, sondern das
// Hausmuster des direkten Nachbarn (tests/security/mega76-schutz-erzwungen.test.ts:100).
//
// DAS ERGEBNIS DER MESSUNG, das den Bau überhaupt erst rechtfertigt: Paarregel und
// `dropConfidential` sagen NICHT dasselbe. `darfSehen` lässt die Kuratorin ein vertrauliches
// Objekt öffnen (richtig — sie kuratiert es); `dropConfidential` hält vertraulichen INHALT aus
// jedem weitergehenden Kontext heraus. Eigenanteile und Zitate sind Kopien dieses Inhalts, tragen
// aber selbst kein `confidentiality`-Feld — sie sind für jenen Filter unsichtbar und wandern an
// ihm vorbei. Fall `V-1` unten hält den Unterschied fest.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { buildNotifications } from "../../services/app/src/notification-feed";
import { conflictRoutes } from "../../services/app/src/routes/conflicts-routes";
import { overlapRoutes } from "../../services/app/src/routes/overlap-routes";
import {
  type KoSichtbarkeitsZugang,
  feldFreigabe,
  paarSichtbar,
} from "../../services/app/src/sichtbarkeit";

// ------------------------------------------------------------------------------------------------
// Die Lage: zwei Objekte, eines davon vertraulich. Beide gehören NICHT der Betrachterin.
// ------------------------------------------------------------------------------------------------

const KURATORIN: SessionUser = { id: "kuratorin-1", role: "controller" };
const LESERIN: SessionUser = { id: "leserin-1", role: "viewer" };
// „experte", nicht „expert" — die Rollennamen stehen in rbac/src/policy.ts:14-18 auf Deutsch.
// `can()` schlägt dort direkt nach und wirft bei einem unbekannten Namen, statt still `false` zu
// liefern; ein Tippfehler fällt also auf, statt einen Fall scheinbar grün zu machen.
const AUTORIN: SessionUser = { id: "autorin-1", role: "experte" };

const KO_INTERN = { confidentiality: "intern" as const, author: "autorin-1" };
const KO_VERTRAULICH = { confidentiality: "vertraulich" as const, author: "autorin-1" };

const zugang = (map: Record<string, { confidentiality: string; author: string }>) =>
  ({
    get: async (id: string) => map[id],
  }) as KoSichtbarkeitsZugang;

const BEIDE_SICHTBAR = zugang({ "ko-a": KO_INTERN, "ko-b": KO_VERTRAULICH });
const BEIDE_INTERN = zugang({ "ko-a": KO_INTERN, "ko-b": { ...KO_INTERN, author: "wer-anders" } });

// Die Belegtexte tragen ein eindeutiges Wort, damit ein Leck im ROHEN Antwortkörper auffällt —
// auch dann, wenn es an einer Stelle steht, an die kein Feldzugriff dieses Tests reicht.
const UEBERSCHNEIDUNG = {
  id: "d-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "gleich",
  aspects: [{ beschreibung: "GEHEIM-ASPEKT", zitatA: "GEHEIM-ZITAT-A", zitatB: "GEHEIM-ZITAT-B" }],
  eigenanteilA: "GEHEIM-EIGENANTEIL-A",
  eigenanteilB: "GEHEIM-EIGENANTEIL-B",
  recommendation: "merge",
  status: "offen",
  pairKey: "dup|ko-a|ko-b",
  origin: "auto",
  detector: {
    trigger: "background",
    method: "model",
    lexicalScore: 0.9,
    rationale: "GEHEIM-GRUND",
  },
  createdAt: "2026-08-01T06:00:00.000Z",
};

const KONFLIKT = {
  id: "c-1",
  koA: "ko-a",
  koB: "ko-b",
  description: "GEHEIM-BESCHREIBUNG",
  status: "offen",
  createdAt: "2026-08-01T06:00:00.000Z",
  detector: { rationale: "GEHEIM-GRUND", quotes: { a: "GEHEIM-ZITAT-A", b: "GEHEIM-ZITAT-B" } },
};

const guardsFuer = (user: SessionUser): Guards => ({
  requireUser: async () => user,
  requirePermission: async () => user,
});

let offen: FastifyInstance[] = [];

async function app(register: (instance: FastifyInstance) => void): Promise<FastifyInstance> {
  const instance = Fastify();
  register(instance);
  await instance.ready();
  offen.push(instance);
  return instance;
}

const duplikatApp = (user: SessionUser, kos: KoSichtbarkeitsZugang, eintraege: unknown[]) =>
  app((i) =>
    i.register(
      overlapRoutes(
        {
          overlaps: {
            unresolved: async () => eintraege,
            get: async () => eintraege[0],
          } as never,
          settings: { get: async () => null } as never,
          kos,
        },
        guardsFuer(user),
      ),
    ),
  );

const konfliktApp = (user: SessionUser, kos: KoSichtbarkeitsZugang, eintraege: unknown[]) =>
  app((i) =>
    i.register(
      conflictRoutes(
        { unresolved: async () => eintraege, get: async () => eintraege[0] } as never,
        guardsFuer(user),
        kos,
      ),
    ),
  );

afterEach(async () => {
  for (const instance of offen) {
    await instance.close();
  }
  offen = [];
});

// ------------------------------------------------------------------------------------------------

describe("JOB 1125 · V — der Vertraulichkeitsgleichlauf, den JOB 968 als L2 nicht gemessen hat", () => {
  it("V-1: Paarregel und Feldfreigabe urteilen über DIESELBE Lage VERSCHIEDEN", () => {
    // Der Messbefund in einem Fall. Ohne ihn wäre die zweite Stufe nur eine zweite Kopie der
    // ersten — und dann wertlos. `paarSichtbar` sagt ja (die Kuratorin darf beide öffnen),
    // `feldFreigabe` sagt für die vertrauliche Seite nein (ihr INHALT geht nicht weiter).
    return Promise.all([
      paarSichtbar(KURATORIN, "ko-a", "ko-b", BEIDE_SICHTBAR),
      feldFreigabe(KURATORIN, "ko-a", "ko-b", BEIDE_SICHTBAR),
    ]).then(([paar, felder]) => {
      expect(paar, "die Kuratorin darf beide Objekte öffnen").toBe(true);
      expect(felder, "aber der Inhalt der vertraulichen Seite geht nicht mit").toEqual({
        a: true,
        b: false,
      });
    });
  });

  it("V-2: die Autorin der vertraulichen Seite behält ihren eigenen Text", async () => {
    // Die Ausnahme aus `darfSehen:63-65`, hier fortgeschrieben. Ohne sie wäre die Regel keine
    // Datensparsamkeit, sondern eine Schikane gegen den, der den Satz geschrieben hat.
    expect(await feldFreigabe(AUTORIN, "ko-a", "ko-b", BEIDE_SICHTBAR)).toEqual({
      a: true,
      b: true,
    });
  });

  it("V-3: ohne Vertraulichkeit ändert die zweite Stufe nichts — sie verengt nur dort, wo nötig", async () => {
    // Pflicht 3, zweiter Halbsatz: „positive freigegebene Felder bleiben sichtbar."
    expect(await feldFreigabe(LESERIN, "ko-a", "ko-b", BEIDE_INTERN)).toEqual({ a: true, b: true });
  });

  it("V-4: fail-closed in jeder Richtung — unauflösbar und zugangslos ergeben beide NEIN", async () => {
    const halbLeer = zugang({ "ko-a": KO_INTERN });
    expect(await feldFreigabe(KURATORIN, "ko-a", "ko-b", halbLeer), "koB unauflösbar").toEqual({
      a: true,
      b: false,
    });
    expect(
      await feldFreigabe(KURATORIN, "ko-a", "ko-b", undefined as never),
      "kein Zugang (der Fall aus mega76 Block A)",
    ).toEqual({ a: false, b: false });
  });
});

describe("JOB 1125 · D — Duplikat-Eigenanteile am echten Routenpfad", () => {
  it("D-1: die Liste liefert den Fund, aber keinen einzigen Belegtext der vertraulichen Seite", async () => {
    const instance = await duplikatApp(KURATORIN, BEIDE_SICHTBAR, [UEBERSCHNEIDUNG]);
    const res = await instance.inject({ method: "GET", url: "/api/duplicates" });

    expect(res.statusCode).toBe(200);
    const [eintrag] = res.json();
    expect(eintrag.id, "der Fund selbst bleibt sichtbar — nur sein Inhalt geht").toBe("d-1");
    expect(eintrag.redacted, "und er sagt ausdrücklich, dass etwas fehlt").toBe(true);
    expect(eintrag.eigenanteilB, "die vertrauliche Seite").toBe("");
    expect(eintrag.aspects, "gemeinsame Aussagen zitieren BEIDE Seiten — also ganz weg").toEqual(
      [],
    );
    expect(eintrag.detector.rationale, "die Modell-Begründung fasst beide zusammen").toBe("");
    // Der Rohkörper ist die eigentliche Probe: kein Feldzugriff kann ein Leck übersehen, das
    // irgendwo sonst in der Antwort steht.
    expect(res.body).not.toContain("GEHEIM-ZITAT-B");
    expect(res.body).not.toContain("GEHEIM-EIGENANTEIL-B");
    expect(res.body).not.toContain("GEHEIM-ASPEKT");
    expect(res.body).not.toContain("GEHEIM-GRUND");
  });

  it("D-2: der freigegebene Eigenanteil der INTERNEN Seite bleibt stehen", async () => {
    // Die Kalibrierung zu D-1. Ohne sie belegte D-1 nur, dass irgendetwas leer ist — auch eine
    // Route, die alles verwirft, wäre grün.
    const instance = await duplikatApp(KURATORIN, BEIDE_SICHTBAR, [UEBERSCHNEIDUNG]);
    const res = await instance.inject({ method: "GET", url: "/api/duplicates" });
    expect(res.json()[0].eigenanteilA).toBe("GEHEIM-EIGENANTEIL-A");
  });

  it("D-3: sind beide Seiten intern, geht NICHTS verloren", async () => {
    // Der Schärfenachweis: die Redaktion greift nur, wo sie greifen soll. Sonst wäre das Board
    // für den Normalfall kaputt — und ein kaputtes Board wird abgeschaltet, nicht repariert.
    const instance = await duplikatApp(LESERIN, BEIDE_INTERN, [UEBERSCHNEIDUNG]);
    const res = await instance.inject({ method: "GET", url: "/api/duplicates" });
    const [eintrag] = res.json();
    expect(eintrag.redacted, "kein Marker, wo nichts redigiert wurde").toBe(undefined);
    expect(eintrag.eigenanteilA).toBe("GEHEIM-EIGENANTEIL-A");
    expect(eintrag.eigenanteilB).toBe("GEHEIM-EIGENANTEIL-B");
    expect(eintrag.aspects).toHaveLength(1);
    expect(eintrag.detector.rationale).toBe("GEHEIM-GRUND");
  });

  it("D-4: das Detail redigiert genauso — der zweite Leseweg ist keine Hintertür", async () => {
    const instance = await duplikatApp(KURATORIN, BEIDE_SICHTBAR, [UEBERSCHNEIDUNG]);
    const res = await instance.inject({ method: "GET", url: "/api/duplicates/d-1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().redacted).toBe(true);
    expect(res.body).not.toContain("GEHEIM-EIGENANTEIL-B");
  });
});

describe("JOB 1125 · K — Konfliktzitate am echten Routenpfad", () => {
  it("K-1: die Liste liefert den Konflikt ohne Beschreibung und ohne beide Zitate", async () => {
    const instance = await konfliktApp(KURATORIN, BEIDE_SICHTBAR, [KONFLIKT]);
    const res = await instance.inject({ method: "GET", url: "/api/conflicts" });

    expect(res.statusCode).toBe(200);
    const [eintrag] = res.json();
    expect(eintrag.id).toBe("c-1");
    expect(eintrag.redacted).toBe(true);
    expect(eintrag.description).toBe("");
    expect(eintrag.detector.quotes).toEqual({ a: "", b: "" });
    expect(res.body).not.toContain("GEHEIM-BESCHREIBUNG");
    expect(res.body).not.toContain("GEHEIM-ZITAT-A");
    expect(res.body).not.toContain("GEHEIM-ZITAT-B");
  });

  it("K-2: auch das Zitat der INTERNEN Seite geht — ein halbes Zitatpaar wäre eine Auskunft", async () => {
    // Bewusst anders als bei den Eigenanteilen: `quotes.a/b` belegen EINEN Widerspruch. Ein Zitat
    // allein sagt „diese Aussage widerspricht einer anderen" — und das ist schon eine Auskunft
    // über die andere (sichtbarkeit.ts:221-222). Deshalb gehen beide oder keines.
    const instance = await konfliktApp(KURATORIN, BEIDE_SICHTBAR, [KONFLIKT]);
    const res = await instance.inject({ method: "GET", url: "/api/conflicts" });
    expect(res.json()[0].detector.quotes.a).toBe("");
  });

  it("K-3: sind beide Seiten intern, bleibt der Konflikt vollständig", async () => {
    const instance = await konfliktApp(LESERIN, BEIDE_INTERN, [KONFLIKT]);
    const res = await instance.inject({ method: "GET", url: "/api/conflicts" });
    const [eintrag] = res.json();
    expect(eintrag.redacted).toBe(undefined);
    expect(eintrag.description).toBe("GEHEIM-BESCHREIBUNG");
    expect(eintrag.detector.quotes).toEqual({ a: "GEHEIM-ZITAT-A", b: "GEHEIM-ZITAT-B" });
  });

  it("K-4: das Detail redigiert genauso", async () => {
    const instance = await konfliktApp(KURATORIN, BEIDE_SICHTBAR, [KONFLIKT]);
    const res = await instance.inject({ method: "GET", url: "/api/conflicts/c-1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().redacted).toBe(true);
    expect(res.body).not.toContain("GEHEIM-BESCHREIBUNG");
  });
});

describe("JOB 1125 · F — fail-closed bleibt fail-closed (Pflicht 3)", () => {
  it("F-1: ein unsichtbares Paar liefert 404 — NICHT einen redigierten Eintrag", async () => {
    // Die schärfste Anforderung des Auftrags: die beiden Zustände dürfen nicht zusammenfallen.
    // Ein 200 mit `redacted: true` wäre hier eine Existenzauskunft über ein Objekt, über das der
    // Betrachter gar nichts erfahren darf.
    const unsichtbar = zugang({
      "ko-a": { confidentiality: "vertraulich", author: "wer-anders" },
      "ko-b": { confidentiality: "vertraulich", author: "wer-anders" },
    });
    const instance = await konfliktApp(LESERIN, unsichtbar, [KONFLIKT]);
    const res = await instance.inject({ method: "GET", url: "/api/conflicts/c-1" });
    expect(res.statusCode, `Antwort: ${res.statusCode} ${res.body}`).toBe(404);
    expect(res.body).not.toContain("redacted");
    expect(res.body).not.toContain("GEHEIM");
  });

  it("F-2: ein unauflösbares Objekt liefert kein Paar und kein Signal", async () => {
    // „Ein Zitat darf sein Objekt nicht überleben" (sichtbarkeit.ts:224) — auch nicht als
    // redigierter Rest, der seine frühere Existenz bezeugt.
    const instance = await duplikatApp(KURATORIN, zugang({ "ko-a": KO_INTERN }), [UEBERSCHNEIDUNG]);
    const liste = await instance.inject({ method: "GET", url: "/api/duplicates" });
    expect(liste.json(), "die Liste zeigt ihn gar nicht").toEqual([]);
    const detail = await instance.inject({ method: "GET", url: "/api/duplicates/d-1" });
    expect(detail.statusCode).toBe(404);
  });

  it("F-3: eine Route ohne Sichtbarkeitszugang bleibt leer (mega76 Block A gilt weiter)", async () => {
    // Gegenprobe, dass die neue Stufe die alte nicht verdrängt hat: die zweite Linie ersetzt die
    // erste nicht, sie steht darunter.
    const instance = await konfliktApp(KURATORIN, undefined as never, [KONFLIKT]);
    const res = await instance.inject({ method: "GET", url: "/api/conflicts" });
    expect(res.json()).toEqual([]);
    expect(res.body).not.toContain("GEHEIM");
  });
});

describe("JOB 1125 · G — die Glocke trägt denselben Text am weitesten", () => {
  it("G-1: ein redigierter Fund erscheint ohne Titel und mit Marker", () => {
    // `detector.rationale` und `description` stehen in der Glocke auf JEDER Seite der Anwendung
    // (notification-feed.ts:66). Wäre der Feed die einzige Stelle ohne Redaktion, ginge der Text
    // genau dort hinaus, wo er am sichtbarsten ist.
    const items = buildNotifications({
      conflicts: [{ ...KONFLIKT, description: "", redacted: true } as never],
      gaps: [],
      overlaps: [{ ...UEBERSCHNEIDUNG, redacted: true } as never],
    });
    const konflikt = items.find((i) => i.kind === "conflict");
    const duplikat = items.find((i) => i.kind === "duplicate");
    expect(konflikt?.title).toBe("");
    expect(konflikt?.redacted).toBe(true);
    expect(duplikat?.title, "auch der Fallbacktext entfällt — er wäre selbst eine Aussage").toBe(
      "",
    );
    expect(duplikat?.redacted).toBe(true);
  });

  it("G-2: ohne Redaktion bleibt der Feed unverändert", () => {
    const items = buildNotifications({
      conflicts: [KONFLIKT as never],
      gaps: [],
      overlaps: [UEBERSCHNEIDUNG as never],
    });
    expect(items.find((i) => i.kind === "conflict")?.title).toBe("GEHEIM-BESCHREIBUNG");
    expect(items.find((i) => i.kind === "duplicate")?.title).toBe("GEHEIM-GRUND");
    expect(items.every((i) => i.redacted === undefined)).toBe(true);
  });
});
