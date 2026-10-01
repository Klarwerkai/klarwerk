// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll · Bens Befunde R1 B3 und B5 — KOSTEN, ZEITRAUM, LOGZEILE.
// ================================================================================================
//
// B3 · KOSTEN: je Lauf aus gemeldetem Verbrauch × Preisliste des Betreibers, mit Preisstand
//      gespeichert; eine Summe je Währung für einen gewählten Zeitraum. Der Code liefert KEINE
//      Preise mit (keine Preisentscheidung) — ohne Liste gibt es keine Kosten, und das wird gesagt.
// B5 · BEOBACHTBARKEIT: je Lauf eine strukturierte Logzeile `ki_lauf` (nur Metadaten) über die
//      Logsenke der App, und die Zeitraum-Auswertung als Grundlage der KI-Übersicht.
//
// Gemessen bis über die echte App (`buildApp`): Anfrage → Lauf mit Kosten → Liste, Auswertung,
// Logzeile. Kein Netz: die Anbieterantwort samt `usage` ist gestellt, kein Schlüsselbund.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices, senkeUeberWert } from "../../services/app/src/build-app";
import { leseZeitraum } from "../../services/app/src/routes/model-runs-routes";
import {
  InMemoryModelRunRepo,
  type KiLaufLogzeile,
  type ModelRunRecord,
  ModelRunService,
  type ModelRunVersuch,
  ProtokollModelRunRepo,
  kostenEinesLaufs,
  lesePreisliste,
} from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const LISTE = JSON.stringify({
  waehrung: "EUR",
  preisstand: "2026-10-01",
  modelle: { "claude-sonnet-4-6": { eingabeJeMillion: 3, ausgabeJeMillion: 15 } },
});

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "assist",
    provider: "anthropic:claude-sonnet-4-6",
    model: "claude-sonnet-4-6",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: "2026-09-20T10:00:00.000Z",
    finishedAt: "2026-09-20T10:00:00.250Z",
    status: "success",
    verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
    // Ben R2 B3: die Kosten entstehen je Versuch — der Standardlauf hat genau einen.
    versuche: [versuch()],
    ...over,
  };
}

function versuch(over: Partial<ModelRunVersuch> = {}): ModelRunVersuch {
  return {
    provider: "anthropic:claude-sonnet-4-6",
    model: "claude-sonnet-4-6",
    startedAt: "2026-09-20T10:00:00.000Z",
    dauerMs: 250,
    ausgang: "erfolg",
    verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
    spanId: "00f067aa0ba902b7",
    ...over,
  };
}

/** Der Lauf OHNE die genannten Felder — ein fehlendes Feld ist etwas anderes als `undefined`. */
function ohne(r: ModelRunRecord, ...felder: (keyof ModelRunRecord)[]): ModelRunRecord {
  const kopie: Partial<ModelRunRecord> = { ...r };
  for (const feld of felder) {
    delete kopie[feld];
  }
  return kopie as ModelRunRecord;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── DIE ECHTE APP: Anfrage → Lauf mit Kosten → Liste, Auswertung, Logzeile ──────────────────────
const CLOUD_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};
const EINGABE = "Roher Satz EINGABE_GEHEIM_9c1, der geglättet werden soll.";

async function app(preisliste: string | undefined, kopf: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: "text", text: "Ein ganz anderer, geglätteter Satz." }],
          usage: { input_tokens: 1000, output_tokens: 500 },
        }),
      }) as unknown as Response) as unknown as typeof fetch,
  );
  const clients = createCappedCloudClientFromEnv(
    CLOUD_ENV,
    () => undefined,
    () => false,
  );
  const client = clients.openai ?? clients.anthropic;
  const services = buildServices();
  const lesung = lesePreisliste(preisliste);
  const protokoll = new ProtokollModelRunRepo(new InMemoryModelRunRepo(), lesung.preisliste);
  const mutable = services as unknown as { reasoner: Reasoner; modelRuns: ModelRunService };
  mutable.reasoner = new Reasoner(
    new ModelProvider(client),
    new DeterministicProvider(),
    protokoll,
  );
  await erteileKiFreigabe(mutable.reasoner);
  mutable.modelRuns = new ModelRunService({
    repo: protokoll,
    preisliste: lesung.preisliste,
    protokoll,
  });
  const logzeilen: string[] = [];
  // Die Testumgebung stellt das Log stumm (`tests/setup-env.ts`); hier wird es gelesen.
  const fastify = buildApp(services, {
    log: { senke: { write: (z) => logzeilen.push(z) }, stufe: "info" },
  });
  await fastify.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const anmeldung = await fastify.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@x.de", password: "secret123" },
  });
  const admin = { authorization: `Bearer ${anmeldung.json().token}` };
  const ko = await fastify.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: "Wartung Hauptschalter",
      statement: "Vor der Wartung verriegeln.",
      type: "best_practice",
      category: "Anlage 2",
      neededValidations: 1,
    },
  });
  const antwort = await fastify.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...admin, ...kopf },
    payload: {
      task: "assist",
      text: EINGABE,
      source: "draft",
      confidentiality: "intern",
      koId: ko.json().id,
    },
  });
  expect(antwort.statusCode).toBe(200);
  return { fastify, admin, logzeilen };
}

describe("B3 · die Preisliste des Betreibers", () => {
  it("P1 · ohne Wert keine Liste und kein Fehler; kaputte Listen ergeben keine Liste MIT Grund", () => {
    expect(lesePreisliste(undefined)).toEqual({ preisliste: null });
    expect(lesePreisliste("   ")).toEqual({ preisliste: null });
    for (const roh of [
      "{kein json",
      JSON.stringify({ preisstand: "x", modelle: {} }),
      JSON.stringify({ waehrung: "EUR", preisstand: "x", modelle: [] }),
      JSON.stringify({
        waehrung: "EUR",
        preisstand: "x",
        modelle: { m: { eingabeJeMillion: -1, ausgabeJeMillion: 1 } },
      }),
      JSON.stringify({ waehrung: "EUR", preisstand: "x", modelle: { m: { eingabeJeMillion: 1 } } }),
    ]) {
      const lesung = lesePreisliste(roh);
      expect(lesung.preisliste).toBeNull();
      expect(lesung.fehler, roh).toBeTruthy();
    }
  });

  it("P2 · Kosten = Eingabe × Eingabepreis + Ausgabe × Ausgabepreis, je Million, mit Preisstand", () => {
    const { preisliste } = lesePreisliste(LISTE);
    // 1000 × 3/1e6 + 500 × 15/1e6 = 0,003 + 0,0075 = 0,0105
    expect(kostenEinesLaufs(lauf(), preisliste)).toEqual({
      betrag: 0.0105,
      waehrung: "EUR",
      preisstand: "2026-10-01",
    });
  });

  it("P3 · keine Kosten ohne Liste, ohne Versuche, ohne Modell/Preis eines Versuchs — und kein geerbter Preis", () => {
    const { preisliste } = lesePreisliste(LISTE);
    expect(kostenEinesLaufs(lauf(), null)).toBeUndefined();
    // Altdatensatz ohne Versuche: wem welcher Verbrauch gehört, ist unbekannt → keine Kosten.
    expect(kostenEinesLaufs(ohne(lauf(), "versuche"), preisliste)).toBeUndefined();
    expect(kostenEinesLaufs(ohne(lauf(), "verbrauch"), preisliste)).toBeUndefined();
    const versuchOhneModell = ohne(versuch() as unknown as ModelRunRecord, "model");
    expect(
      kostenEinesLaufs(
        lauf({ versuche: [versuchOhneModell as unknown as ModelRunVersuch] }),
        preisliste,
      ),
    ).toBeUndefined();
    expect(
      kostenEinesLaufs(lauf({ versuche: [versuch({ model: "anderes-modell" })] }), preisliste),
    ).toBeUndefined();
    expect(
      kostenEinesLaufs(lauf({ versuche: [versuch({ model: "constructor" })] }), preisliste),
    ).toBeUndefined();
    const mitProto = lesePreisliste(
      '{"waehrung":"EUR","preisstand":"x","modelle":{"__proto__":{"eingabeJeMillion":1,"ausgabeJeMillion":1}}}',
    );
    expect(
      kostenEinesLaufs(lauf({ versuche: [versuch({ model: "__proto__" })] }), mitProto.preisliste)
        ?.betrag,
    ).toBe(0.0015);
    expect(
      kostenEinesLaufs(lauf({ versuche: [versuch({ model: "toString" })] }), mitProto.preisliste),
    ).toBeUndefined();
  });

  it("P5 · Ben R3 B3: ein gerufenes Modell ohne Verbrauchsmeldung → keine Kosten statt Teilsumme", () => {
    const { preisliste } = lesePreisliste(
      JSON.stringify({
        waehrung: "EUR",
        preisstand: "s",
        modelle: {
          teuer: { eingabeJeMillion: 10, ausgabeJeMillion: 0 },
          billig: { eingabeJeMillion: 1, ausgabeJeMillion: 0 },
        },
      }),
    );
    const verbrauch = { eingabeToken: 1000, ausgabeToken: 0, gemeldeteAufrufe: 1 };
    const ohneMeldung = ohne(
      versuch({ model: "teuer", ausgang: "fehler" }) as unknown as ModelRunRecord,
      "verbrauch",
    ) as unknown as ModelRunVersuch;
    const n3 = lauf({
      model: "billig",
      verbrauch,
      versuche: [ohneMeldung, versuch({ model: "billig", verbrauch })],
    });
    // Bens Gegenbeleg N3: bis Runde 3 ergab das 0,001 EUR — als wäre der teure Versuch kostenfrei.
    expect(kostenEinesLaufs(n3, preisliste)).toBeUndefined();
    // Gegenprobe: ein Versuch OHNE gerufenes Modell (kein `model`) verbraucht nichts → Kosten bleiben.
    const nichtGerufen = ohne(
      ohneMeldung as unknown as ModelRunRecord,
      "model",
    ) as unknown as ModelRunVersuch;
    expect(
      kostenEinesLaufs(
        lauf({ ...n3, versuche: [nichtGerufen, versuch({ model: "billig", verbrauch })] }),
        preisliste,
      )?.betrag,
    ).toBe(0.001);
  });

  it("P4 · Ben R2 B3: zwei Modelle, zwei Preise — jeder Versuch zum Preis SEINES Modells", () => {
    const { preisliste } = lesePreisliste(
      JSON.stringify({
        waehrung: "EUR",
        preisstand: "s",
        modelle: {
          teuer: { eingabeJeMillion: 10, ausgabeJeMillion: 0 },
          billig: { eingabeJeMillion: 1, ausgabeJeMillion: 0 },
        },
      }),
    );
    const zweiModelle = lauf({
      model: "billig",
      verbrauch: { eingabeToken: 2000, ausgabeToken: 0, gemeldeteAufrufe: 2 },
      versuche: [
        versuch({
          model: "teuer",
          ausgang: "fehler",
          verbrauch: { eingabeToken: 1000, ausgabeToken: 0, gemeldeteAufrufe: 1 },
        }),
        versuch({
          model: "billig",
          verbrauch: { eingabeToken: 1000, ausgabeToken: 0, gemeldeteAufrufe: 1 },
        }),
      ],
    });
    // 1000 × 10/1e6 + 1000 × 1/1e6 = 0,011 — nicht 2000 × 1/1e6 = 0,002 (Bens Gegenbeleg).
    expect(kostenEinesLaufs(zweiModelle, preisliste)?.betrag).toBe(0.011);
    // Fehlt der Preis für EIN Modell, gibt es keine Teilsumme.
    const ohnePreis = lauf({
      ...zweiModelle,
      versuche: [versuch({ model: "unbekannt" }), versuch({ model: "billig" })],
    });
    expect(kostenEinesLaufs(ohnePreis, preisliste)).toBeUndefined();
    // Versuche und Laufsumme passen nicht zusammen → keine Kosten statt einer falschen Zahl.
    expect(
      kostenEinesLaufs(
        lauf({
          ...zweiModelle,
          verbrauch: { eingabeToken: 999, ausgabeToken: 0, gemeldeteAufrufe: 2 },
        }),
        preisliste,
      ),
    ).toBeUndefined();
  });
});

describe("B3/B5 · der Schreibweg rechnet Kosten und schreibt die Logzeile", () => {
  it("S1 · append speichert die Kosten und loggt nur Metadaten", async () => {
    const inner = new InMemoryModelRunRepo();
    const repo = new ProtokollModelRunRepo(inner, lesePreisliste(LISTE).preisliste);
    const zeilen: KiLaufLogzeile[] = [];
    repo.logAn((z) => zeilen.push(z));

    await repo.append(
      lauf({
        error: "Modell-API antwortete mit 500",
        actor: "u-1",
        subject: { kind: "ko", id: "ko-1" },
      }),
    );

    const [gespeichert] = await inner.recent(1);
    expect(gespeichert?.kosten).toEqual({
      betrag: 0.0105,
      waehrung: "EUR",
      preisstand: "2026-10-01",
    });
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({
      event: "ki_lauf",
      task: "assist",
      status: "success",
      model: "claude-sonnet-4-6",
      dauerMs: 250,
      eingabeToken: 1000,
      ausgabeToken: 500,
      kosten: 0.0105,
      waehrung: "EUR",
    });
    // Fehlertext, Anfragender und Gegenstand gehören in das zugriffsgeregelte Protokoll, nicht ins Log.
    const roh = JSON.stringify(zeilen[0]);
    expect(roh).not.toContain("antwortete");
    expect(roh).not.toContain("u-1");
    expect(roh).not.toContain("ko-1");
  });

  it("S2 · eine werfende Logsenke lässt das Schreiben nicht scheitern", async () => {
    const inner = new InMemoryModelRunRepo();
    const repo = new ProtokollModelRunRepo(inner, null);
    repo.logAn(() => {
      throw new Error("Logsenke kaputt");
    });

    await repo.append(lauf());

    const [gespeichert] = await inner.recent(1);
    expect(gespeichert?.id).toBe("r1");
    expect(Object.hasOwn(gespeichert as object, "kosten")).toBe(false);
  });
});

describe("B3/B5 · die Auswertung eines Zeitraums", () => {
  it("A1 · nur Läufe im Zeitraum; Kosten je Währung mit Grundmenge; Läufe ohne Preis gezählt", async () => {
    const repo = new InMemoryModelRunRepo();
    await repo.append(
      lauf({ id: "a", kosten: { betrag: 0.5, waehrung: "EUR", preisstand: "s1" } }),
    );
    await repo.append(
      lauf({
        id: "b",
        task: "extract",
        kosten: { betrag: 0.25, waehrung: "EUR", preisstand: "s2" },
      }),
    );
    await repo.append(lauf({ id: "c", kosten: { betrag: 1, waehrung: "USD", preisstand: "s3" } }));
    await repo.append(lauf({ id: "d", status: "error", fallback: true })); // Verbrauch, kein Preis
    // Deterministisch: kein Modell gerufen, also auch kein Versuch mit Modell (Ben R3 B3).
    await repo.append(ohne(lauf({ id: "e", demo: true, versuche: [] }), "verbrauch", "model"));
    await repo.append(lauf({ id: "alt", startedAt: "2026-08-01T00:00:00.000Z" }));
    const service = new ModelRunService({ repo });

    const a = await service.auswertung("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");

    expect(a.laeufe).toBe(5);
    expect(a.erfolg).toBe(4);
    expect(a.fehler).toBe(1);
    expect(a.rueckfall).toBe(1);
    expect(a.demo).toBe(1);
    expect(a.kosten).toEqual([
      { waehrung: "EUR", betrag: 0.75, laeufe: 2 },
      { waehrung: "USD", betrag: 1, laeufe: 1 },
    ]);
    expect(a.verbrauchOhneKosten).toBe(1);
    expect(a.verbrauchGezaehlt).toBe(4);
    expect(a.eingabeToken).toBe(4000);
    expect(a.jeAufgabe.extract).toEqual({
      laeufe: 1,
      fehler: 0,
      eingabeToken: 1000,
      ausgabeToken: 500,
    });
    expect(a.jeAufgabe.assist?.laeufe).toBe(4);
    expect(a.dauerGezaehlt).toBe(5);
    expect(a.gekappt).toBe(false);
  });

  it("A3 · Ben R3 B3: Läufe mit gerufenem Modell ohne Kostennachweis werden gezählt, nicht als kostenfrei summiert", async () => {
    const repo = new InMemoryModelRunRepo();
    // Teilverbrauch gemeldet, aber ohne Kosten (Kostennachweis unvollständig).
    await repo.append(lauf({ id: "teil" }));
    // Modell gerufen, gar kein Verbrauch gemeldet.
    await repo.append(
      ohne(
        lauf({
          id: "unbekannt",
          versuche: [
            ohne(versuch() as unknown as ModelRunRecord, "verbrauch") as unknown as ModelRunVersuch,
          ],
        }),
        "verbrauch",
      ),
    );
    // Kein Modell gerufen (deterministisch): kein Kostennachweis nötig.
    await repo.append(ohne(lauf({ id: "det", demo: true, versuche: [] }), "verbrauch", "model"));
    const a = await new ModelRunService({ repo }).auswertung(
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    );
    expect(a.kosten).toEqual([]);
    expect(a.verbrauchOhneKosten).toBe(2);
  });

  it("A2 · der Zeitraum der Route: Vorgabe 30 Tage, Grenzen geprüft, Form wie im Datensatz", () => {
    const jetzt = new Date("2026-10-01T12:00:00.000Z");
    expect(leseZeitraum(undefined, undefined, jetzt)).toEqual({
      von: "2026-09-01T12:00:00.000Z",
      bis: "2026-10-01T12:00:00.000Z",
    });
    expect(leseZeitraum("2026-09-01", "2026-09-02", jetzt)).toEqual({
      von: "2026-09-01T00:00:00.000Z",
      bis: "2026-09-02T00:00:00.000Z",
    });
    expect("fehler" in leseZeitraum("gestern", undefined, jetzt)).toBe(true);
    expect("fehler" in leseZeitraum("2026-09-02", "2026-09-01", jetzt)).toBe(true);
    expect("fehler" in leseZeitraum("2024-01-01", "2026-01-01", jetzt)).toBe(true);
  });
});

describe("B3/B5 · über die echte App", () => {
  it("R1 · mit Preisliste: der Lauf trägt Kosten, die Auswertung summiert sie, die Logzeile steht da", async () => {
    const { fastify, admin, logzeilen } = await app(LISTE);

    const liste = await fastify.inject({ method: "GET", url: "/api/model-runs", headers: admin });
    const [gelaufen] = liste.json() as ModelRunRecord[];
    expect(gelaufen?.task).toBe("assist");
    expect(gelaufen?.kosten).toEqual({ betrag: 0.0105, waehrung: "EUR", preisstand: "2026-10-01" });
    expect(gelaufen?.erzeugt).toEqual({ art: "text", anzahl: 1 });

    const auswertung = await fastify.inject({
      method: "GET",
      url: "/api/model-runs/auswertung",
      headers: admin,
    });
    expect(auswertung.statusCode).toBe(200);
    const koerper = auswertung.json();
    expect(koerper.auswertung.kosten).toEqual([{ waehrung: "EUR", betrag: 0.0105, laeufe: 1 }]);
    expect(koerper.auswertung.jeAufgabe.assist.eingabeToken).toBe(1000);
    expect(koerper.preisgrundlage).toEqual({
      hinterlegt: true,
      waehrung: "EUR",
      preisstand: "2026-10-01",
      modelle: 1,
    });

    const kiZeilen = logzeilen.filter((z) => z.includes('"ki_lauf"'));
    expect(kiZeilen).toHaveLength(1);
    const zeile = JSON.parse(kiZeilen[0] as string) as Record<string, unknown>;
    expect(zeile).toMatchObject({
      event: "ki_lauf",
      task: "assist",
      kosten: 0.0105,
      waehrung: "EUR",
    });
    expect(kiZeilen[0]).not.toContain("EINGABE_GEHEIM_9c1");
    expect(kiZeilen[0]).not.toContain("geglätteter Satz");
  });

  it("R2 · ohne Preisliste: kein Kostenfeld, und die Auswertung sagt, warum", async () => {
    const { fastify, admin } = await app(undefined);

    const liste = await fastify.inject({ method: "GET", url: "/api/model-runs", headers: admin });
    const [gelaufen] = liste.json() as ModelRunRecord[];
    expect(gelaufen?.verbrauch?.eingabeToken).toBe(1000);
    expect(Object.hasOwn(gelaufen as object, "kosten")).toBe(false);

    const koerper = (
      await fastify.inject({ method: "GET", url: "/api/model-runs/auswertung", headers: admin })
    ).json();
    expect(koerper.auswertung.kosten).toEqual([]);
    expect(koerper.auswertung.verbrauchOhneKosten).toBe(1);
    expect(koerper.preisgrundlage).toEqual({ hinterlegt: false });
  });

  it("R3 · ungültiger Zeitraum → 400, ohne Anmeldung → kein Zugriff", async () => {
    const { fastify, admin } = await app(undefined);

    const falsch = await fastify.inject({
      method: "GET",
      url: "/api/model-runs/auswertung?von=gestern",
      headers: admin,
    });
    expect(falsch.statusCode).toBe(400);
    const anonym = await fastify.inject({ method: "GET", url: "/api/model-runs/auswertung" });
    expect(anonym.statusCode).toBe(401);
  });

  it("R4 · Ben R2 B5: ein eingehender traceparent wird fortgesetzt — Lauf, Versuche und Logzeile tragen ihn", async () => {
    const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
    const { fastify, admin, logzeilen } = await app(LISTE, {
      traceparent: `00-${TRACE}-00f067aa0ba902b7-01`,
    });

    const [gelaufen] = (
      await fastify.inject({ method: "GET", url: "/api/model-runs", headers: admin })
    ).json() as ModelRunRecord[];
    expect(gelaufen?.trace?.traceId).toBe(TRACE);
    expect(gelaufen?.trace?.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(gelaufen?.trace?.parentSpanId).toMatch(/^[0-9a-f]{16}$/);
    expect(gelaufen?.trace?.requestId).toBeTruthy();
    expect(gelaufen?.versuche).toHaveLength(1);
    expect(gelaufen?.versuche?.[0]?.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(gelaufen?.versuche?.[0]?.spanId).not.toBe(gelaufen?.trace?.spanId);

    const zeile = JSON.parse(logzeilen.find((z) => z.includes('"ki_lauf"')) as string) as Record<
      string,
      unknown
    >;
    expect(zeile.traceId).toBe(TRACE);
    expect(zeile.requestId).toBe(gelaufen?.trace?.requestId);
    expect(zeile.versuche).toBe(1);
  });

  it("R5 · ohne (oder mit ungültigem) traceparent entsteht je Anfrage ein eigener Trace", async () => {
    const a = await app(undefined, {
      traceparent: "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
    });
    const b = await app(undefined);
    const lies = async (x: typeof a): Promise<ModelRunRecord | undefined> =>
      (
        (
          await x.fastify.inject({ method: "GET", url: "/api/model-runs", headers: x.admin })
        ).json() as ModelRunRecord[]
      )[0];
    const ta = (await lies(a))?.trace?.traceId;
    const tb = (await lies(b))?.trace?.traceId;
    expect(ta).toMatch(/^[0-9a-f]{32}$/);
    expect(tb).toMatch(/^[0-9a-f]{32}$/);
    expect(ta).not.toBe("00000000000000000000000000000000");
    expect(ta).not.toBe(tb);
  });

  it("L1 · die Logbereinigung lässt NUR Trace-Kennungen unter ihren Feldnamen durch", () => {
    const hex32 = "4bf92f3577b34da6a3ce929d0e0e4736";
    const bereinigt = senkeUeberWert(
      {
        traceId: hex32,
        spanId: "00f067aa0ba902b7",
        parentSpanId: "b7ad6b7169203331",
        anderesFeld: hex32,
        // Kein Hex in W3C-Form: unter dem Tracenamen trotzdem bereinigt.
        token: "abcdefghijklmnopqrstuvwxyz0123456789",
      },
      {},
    ) as Record<string, unknown>;
    expect(bereinigt.traceId).toBe(hex32);
    expect(bereinigt.spanId).toBe("00f067aa0ba902b7");
    expect(bereinigt.parentSpanId).toBe("b7ad6b7169203331");
    expect(bereinigt.anderesFeld).toBe("[redacted]");
    expect(
      (
        senkeUeberWert({ traceId: "geheimes-token-ABCDEFGHIJKLMNOPQRSTUVWXYZ" }, {}) as Record<
          string,
          unknown
        >
      ).traceId,
    ).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it("L2 · Ben R3 B8: der Wert einer secret-benannten Env-Variablen fällt auch unter Trace-Feldnamen", () => {
    // Synthetischer Wert in W3C-Form — kein echtes Geheimnis.
    const hex32 = "0123456789abcdef0123456789abcdef";
    const env = { BEN_API_KEY: hex32 };
    const bereinigt = senkeUeberWert(
      { traceId: hex32, spanId: hex32, parentSpanId: hex32, anderesFeld: hex32 },
      env,
    ) as Record<string, unknown>;
    for (const feld of ["traceId", "spanId", "parentSpanId", "anderesFeld"]) {
      expect(bereinigt[feld], feld).toBe("[redacted]");
    }
    // Gegenprobe: eine Trace-Kennung, die KEIN Geheimniswert ist, bleibt lesbar.
    const fremd = "4bf92f3577b34da6a3ce929d0e0e4736";
    expect((senkeUeberWert({ traceId: fremd }, env) as Record<string, unknown>).traceId).toBe(
      fremd,
    );
  });
});
