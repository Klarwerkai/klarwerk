// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KONFLIKTKLASSIFIKATION — Konfliktart, Arbeitsart, Eskalation, Vorrang.
// ================================================================================================
//
// Die Originalpunkte (QUELLEN.json, original_points) und was dieser Test davon am Verhalten misst:
//
//   R-0209 / R-1713 / R-2103 / FR-CON-01 — ein Widerspruch wird ein SICHTBARER Konflikt mit Art
//       UND Beschreibung, für jede der fünf Arten; der Bestand wird dabei nicht verändert.
//   R-0215 / R-1714 / R-2104 / FR-CON-02 — nur „truth" kann eskaliert werden, und für „truth" ist
//       der Pfad VERBINDLICH: weder Zweitmeinung noch Entscheidung vor der Eskalation (Dienst und
//       echte Route). Die anderen vier Arten werden ohne Eskalation entschieden.
//   R-2065 (NFR-TAI-02) — kein automatischer „Wahrheits"-Entscheid.
//   R-0252 — die Arbeitsart (Regel/Sache/Version) UNABHÄNGIG von der Konfliktart: gewählt bei der
//       Anlage, eingeordnet von der automatischen Erkennung (auch „truth" als Regelkonflikt), sonst
//       nicht bestimmt — nie aus `type` geraten. Je Arbeitsart ein anderes Band.
//   R-0263 — Vorrang und Geltungsbereich zwischen GENAU den zwei Punkten einer Entscheidung;
//       Präzisierung nur mit Geltungsbereich; kein Objekt wird verändert; sichtbar am Punkt.
import { describe, expect, it } from "vitest";
import {
  conflictNextStep,
  conflictWorkActions,
  conflictWorkKind,
  einordnungAusstehend,
  eskalationAusstehend,
  klaraVorschlag,
  naechsterSchrittSchluessel,
  vorrangAmPunkt,
} from "../../apps/web/src/lib/conflictView";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { redigiereKonflikt } from "../../services/app/src/sichtbarkeit";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  ConflictService,
  type ConflictType,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
  isConflictWorkKind,
  isVorrangWahl,
} from "../../services/conflicts";
import { vorschlagAusUrteil } from "../../services/conflicts/src/detect";
import { parseConflictResponse } from "../../services/reasoner";

const ARTEN: readonly ConflictType[] = ["truth", "experience", "context", "temporal", "role"];

function dienst(): { service: ConflictService; repo: InMemoryConflictRepo } {
  const repo = new InMemoryConflictRepo();
  let n = 0;
  const service = new ConflictService({ repo, genId: () => `c${++n}` });
  return { service, repo };
}

async function adminApp() {
  const app = buildApp(buildServices());
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
  const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
  const ids = kos.json().map((k: { id: string }) => k.id) as string[];
  return { app, headers, ids, koA: ids[0] as string, koB: ids[1] as string };
}

type App = Awaited<ReturnType<typeof adminApp>>["app"];
type Kopf = Record<string, string>;

async function konfliktAnlegen(
  app: App,
  headers: Kopf,
  koA: string,
  koB: string,
  type: ConflictType,
): Promise<{ id: string }> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koA}`,
    headers,
    payload: { action: "conflict", conflict: { koA, koB, type, description: `D ${type}` } },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string };
}

async function entscheiden(
  app: App,
  headers: Kopf,
  koA: string,
  conflictId: string,
  vorrang?: unknown,
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koA}`,
    headers,
    payload: {
      action: "resolve-conflict",
      conflictId,
      decision: "Entschieden.",
      ...(vorrang === undefined ? {} : { vorrang }),
    },
  });
}

/** Ein Urteil der Konfliktprüfung über zwei Kerntexte mit wörtlich belegten Zitaten. */
function erkennung(urteil: Partial<ConflictVerdict>) {
  const a: DetectSubject = {
    refId: "A",
    title: "Firmenwagen",
    statement: "Alle Firmenwagen müssen blau sein.",
    conditions: [],
    measures: [],
    category: "Fuhrpark",
    tags: [],
  };
  const b: DetectSubject = { ...a, refId: "B", statement: "Firmenwagen ausschließlich in Rot." };
  const verdict: ConflictVerdict = {
    relation: "widerspruch",
    older: null,
    confidence: 0.95,
    begruendung: "Zwei verschiedene Pflichtfarben.",
    zitat_a: "blau",
    zitat_b: "Rot",
    ...urteil,
  };
  return { a, b, verdict };
}

describe("R-0209 / FR-CON-01 · Widerspruch → klassifizierter, sichtbarer Konflikt", () => {
  it("jede der fünf Arten entsteht als offener Konflikt mit Art und Beschreibung", async () => {
    const { service } = dienst();
    for (const type of ARTEN) {
      const description = `Beschreibung ${type}`;
      const c = await service.create({ koA: "A", koB: "B", type, description });
      expect(c.type).toBe(type);
      expect(c.description).toBe(description);
      expect(c.status).toBe("offen");
    }
    expect((await service.unresolved()).map((c) => c.type).sort()).toEqual([...ARTEN].sort());
  });

  it("über die echte Route: die Art kommt so zurück, wie sie gewählt wurde; die Liste zeigt sie", async () => {
    const { app, headers, koA, koB } = await adminApp();
    for (const type of ARTEN) {
      expect((await konfliktAnlegen(app, headers, koA, koB, type)).id).toBeTruthy();
    }
    const liste = (await app.inject({ method: "GET", url: "/api/conflicts", headers })).json() as {
      type: string;
      description: string;
    }[];
    for (const type of ARTEN) {
      expect(liste.some((c) => c.type === type && c.description === `D ${type}`)).toBe(true);
    }
  });
});

describe("R-0215 / FR-CON-02 · nur der Wahrheitskonflikt eskaliert — und für ihn verbindlich", () => {
  it("am Dienst: truth → eskaliert; die vier anderen → NOT_ESCALATABLE und bleiben offen", async () => {
    const { service } = dienst();
    for (const type of ARTEN) {
      const c = await service.create({ koA: "A", koB: "B", type, description: type });
      if (type === "truth") {
        expect((await service.escalate(c.id)).status).toBe("eskaliert");
      } else {
        await expect(service.escalate(c.id)).rejects.toMatchObject({ code: "NOT_ESCALATABLE" });
        expect((await service.get(c.id))?.status).toBe("offen");
      }
    }
  });

  it("am Dienst: ein OFFENER Wahrheitskonflikt wird weder entschieden noch mit Zweitmeinung versehen", async () => {
    const { service } = dienst();
    const c = await service.create({ koA: "A", koB: "B", type: "truth", description: "x" });
    await expect(service.resolve(c.id, "mensch", "A gilt")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(service.secondOpinion(c.id, "Meinung", "mensch")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // Nichts wurde geschrieben: der Befund steht unverändert offen.
    const unveraendert = await service.get(c.id);
    expect(unveraendert?.status).toBe("offen");
    expect(unveraendert?.decision).toBeNull();
    expect(unveraendert?.secondOpinion).toBeNull();

    // Nach der Eskalation geht der Pfad weiter: Zweitmeinung, dann Entscheidung.
    await service.escalate(c.id, "mensch");
    expect((await service.secondOpinion(c.id, "Meinung", "mensch")).status).toBe("zweitmeinung");
    expect((await service.resolve(c.id, "mensch", "A gilt")).status).toBe("geloest");
  });

  it("am Dienst: die anderen vier Arten werden ohne Eskalation entschieden", async () => {
    const { service } = dienst();
    for (const type of ARTEN.filter((a) => a !== "truth")) {
      const c = await service.create({ koA: "A", koB: "B", type, description: type });
      expect((await service.resolve(c.id, "mensch", "entschieden")).status).toBe("geloest");
    }
  });

  it("über die echte Route: resolve-conflict auf einem offenen Wahrheitskonflikt ist 409, nach escalate 200", async () => {
    const { app, headers, koA, koB } = await adminApp();
    const truth = await konfliktAnlegen(app, headers, koA, koB, "truth");
    const vorher = await entscheiden(app, headers, koA, truth.id);
    expect(vorher.statusCode).toBe(409);
    const zweitmeinung = await app.inject({
      method: "POST",
      url: `/api/conflicts/${truth.id}/second-opinion`,
      headers,
      payload: { opinion: "Meinung" },
    });
    expect(zweitmeinung.statusCode).toBe(409);

    const esc = await app.inject({
      method: "POST",
      url: `/api/conflicts/${truth.id}/escalate`,
      headers,
    });
    expect(esc.statusCode).toBe(200);
    const nachher = await entscheiden(app, headers, koA, truth.id);
    expect(nachher.statusCode).toBe(200);
    expect(nachher.json().status).toBe("geloest");

    // Gegenprobe: ein Kontextkonflikt wird über dieselbe Route direkt entschieden.
    const kontext = await konfliktAnlegen(app, headers, koA, koB, "context");
    expect((await entscheiden(app, headers, koA, kontext.id)).statusCode).toBe(200);
  });

  it("über die echte Route: escalate nur für truth", async () => {
    const { app, headers, koA, koB } = await adminApp();
    for (const type of ARTEN) {
      const angelegt = await konfliktAnlegen(app, headers, koA, koB, type);
      const res = await app.inject({
        method: "POST",
        url: `/api/conflicts/${angelegt.id}/escalate`,
        headers,
      });
      expect(res.statusCode === 200).toBe(type === "truth");
    }
  });

  it("die Oberfläche sperrt nur beim offenen Wahrheitskonflikt; der nächste Schritt ist dann Eskalieren", () => {
    for (const type of ARTEN) {
      expect(eskalationAusstehend({ type, status: "offen" })).toBe(type === "truth");
      expect(conflictNextStep({ type, status: "offen" }) === "escalate").toBe(type === "truth");
    }
    expect(eskalationAusstehend({ type: "truth", status: "eskaliert" })).toBe(false);
  });
});

describe("R-2065 (NFR-TAI-02) · kein automatischer Wahrheitsentscheid", () => {
  it("ein vom Modell erkannter Widerspruch bleibt offen — ohne Entscheider und ohne Entscheidung", async () => {
    const { service } = dienst();
    const { a, b, verdict } = erkennung({});
    const angelegt = await service.detectForSubject(a, [a, b], async () => verdict);
    expect(angelegt).toHaveLength(1);
    const c = angelegt[0];
    expect(c?.type).toBe("truth");
    expect(c?.status).toBe("offen");
    expect(c?.decidedBy).toBeNull();
    expect(c?.decision).toBeNull();
    expect(c?.resolutionReason).toBeUndefined();
    expect((await service.get(c?.id ?? ""))?.status).toBe("offen");
  });
});

describe("R-0252 · Arbeitsart unabhängig von der Konfliktart", () => {
  it("automatisch erkannt: zwei interne Festlegungen sind ein REGELkonflikt, obwohl die Art „truth“ ist", async () => {
    const { service } = dienst();
    const { a, b, verdict } = erkennung({ arbeit: "regel" });
    const [c] = await service.detectForSubject(a, [a, b], async () => verdict);
    expect(c?.type).toBe("truth");
    expect(c?.arbeitsart).toBe("regel");
    // Die Oberfläche liest daraus einen Regelkonflikt — Einordnung der Prüfung, kein Raten.
    expect(conflictWorkKind(c ?? {})).toEqual({
      kind: "regel",
      herkunft: "erkannt",
    });
    // Band des Regelkonflikts: keine Zweitmeinung.
    expect(conflictWorkActions("regel").zweitmeinung).toBe(false);
  });

  it("automatisch erkannt: ein Sachkonflikt bleibt Sache; „überholt“ ist ein Versionskonflikt", async () => {
    const sache = dienst();
    const s = erkennung({ arbeit: "sache" });
    const [c1] = await sache.service.detectForSubject(s.a, [s.a, s.b], async () => s.verdict);
    expect(c1?.arbeitsart).toBe("sache");

    const version = dienst();
    const v = erkennung({ relation: "ueberholt", older: "a" });
    const [c2] = await version.service.detectForSubject(v.a, [v.a, v.b], async () => v.verdict);
    expect(c2?.type).toBe("temporal");
    expect(c2?.arbeitsart).toBe("version");
  });

  it("ohne Einordnung der Prüfung bleibt die Arbeitsart offen — sie wird nicht aus „truth“ geraten", async () => {
    const { service } = dienst();
    const { a, b, verdict } = erkennung({});
    const [c] = await service.detectForSubject(a, [a, b], async () => verdict);
    expect(c && "arbeitsart" in c).toBe(false);
    for (const type of ARTEN) {
      expect(conflictWorkKind({ origin: "auto" }).kind, type).toBeNull();
    }
  });

  it("die Konfliktprüfung liefert `arbeit` nur bei „widerspruch“ und nur regel/sache", () => {
    const basis = '"older":null,"confidence":0.9,"begruendung":"x","zitat_a":"a","zitat_b":"b"';
    const urteil = (relation: string, zusatz: string) =>
      parseConflictResponse(`{"relation":"${relation}",${basis}${zusatz}}`);
    expect(urteil("widerspruch", ',"arbeit":"regel"')?.arbeit).toBe("regel");
    expect(urteil("widerspruch", ',"arbeit":"sache"')?.arbeit).toBe("sache");
    expect(urteil("widerspruch", ',"arbeit":"wahrheit"')?.arbeit).toBeUndefined();
    expect(urteil("kein_konflikt", ',"arbeit":"regel"')?.arbeit).toBeUndefined();
    // Eine Antwort ohne das Feld parst wie bisher.
    expect(urteil("widerspruch", "")?.relation).toBe("widerspruch");
  });

  it("manuelle Anlage: die gewählte Arbeitsart wird übernommen; ein fremder Wert ist ein 400", async () => {
    const { service } = dienst();
    const gewaehlt = await service.create({
      koA: "A",
      koB: "B",
      type: "truth",
      arbeitsart: "regel",
      description: "Firmenwagen blau gegen rot",
    });
    expect(gewaehlt.arbeitsart).toBe("regel");
    expect(conflictWorkKind(gewaehlt)).toEqual({ kind: "regel", herkunft: "gewaehlt" });
    const ohne = await service.create({ koA: "A", koB: "B", type: "truth", description: "x" });
    expect("arbeitsart" in ohne).toBe(false);

    const { app, headers, koA, koB } = await adminApp();
    const gut = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: { koA, koB, type: "context", arbeitsart: "version", description: "d" },
      },
    });
    expect(gut.statusCode).toBe(201);
    expect(gut.json().arbeitsart).toBe("version");
    const schlecht = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: { koA, koB, type: "context", arbeitsart: "wahrheit", description: "d" },
      },
    });
    expect(schlecht.statusCode).toBe(400);
    expect(isConflictWorkKind("wahrheit")).toBe(false);
  });

  it("die angebotenen Knöpfe unterscheiden sich je Arbeitsart", () => {
    const sache = conflictWorkActions("sache");
    const regel = conflictWorkActions("regel");
    const version = conflictWorkActions("version");
    expect(sache).toEqual({
      linksKey: "con.side.left",
      rechtsKey: "con.side.right",
      beideGelten: true,
      praezisierung: true,
      zweitmeinung: true,
    });
    expect(regel).toEqual({ ...sache, zweitmeinung: false });
    expect(version).toEqual({
      linksKey: "konfliktarbeit.knopf.standLinks",
      rechtsKey: "konfliktarbeit.knopf.standRechts",
      beideGelten: false,
      praezisierung: false,
      zweitmeinung: false,
    });
    // Nicht bestimmt: das volle Band — kein Weg wird nach einer geratenen Art verschwiegen.
    expect(conflictWorkActions(null)).toEqual(sache);
    expect(new Set([sache, regel, version].map((b) => JSON.stringify(b))).size).toBe(3);
  });

  it("die nächste Handlung folgt dem Band", () => {
    expect(conflictNextStep({ type: "context", status: "offen", arbeitsart: "regel" })).toBe(
      "resolve",
    );
    expect(conflictNextStep({ type: "temporal", status: "offen", arbeitsart: "version" })).toBe(
      "resolve",
    );
    expect(conflictNextStep({ type: "experience", status: "offen", arbeitsart: "sache" })).toBe(
      "secondOpinion",
    );
    // Nacharbeit 5: ohne Arbeitsart ist der nächste Schritt das Einordnen.
    expect(conflictNextStep({ type: "context", status: "offen" })).toBe("classify");
    expect(naechsterSchrittSchluessel("classify")).toBe("konfliktarbeit.next.einordnen");
    expect(naechsterSchrittSchluessel("resolve")).toBe("con.next.resolve");
    // Ein Regelkonflikt der Art „truth“ eskaliert zuerst (R-0215) und wird dann entschieden.
    expect(conflictNextStep({ type: "truth", status: "offen", arbeitsart: "regel" })).toBe(
      "escalate",
    );
    expect(conflictNextStep({ type: "truth", status: "eskaliert", arbeitsart: "regel" })).toBe(
      "resolve",
    );
  });

  it("Einordnungsweg am Dienst: ein nicht eingeordneter Konflikt wird gespeichert eingeordnet und protokolliert", async () => {
    const repo = new InMemoryConflictRepo();
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const service = new ConflictService({ repo, audit });
    const c = await service.create({ koA: "A", koB: "B", type: "truth", description: "x" }, "m");
    expect(einordnungAusstehend(c)).toBe(true);

    const eingeordnet = await service.einordnen(c.id, "regel", "controller");
    expect(eingeordnet.arbeitsart).toBe("regel");
    // Gespeichert — zurückgelesen, nicht am Rückgabewert.
    const gelesen = await service.get(c.id);
    expect(gelesen?.arbeitsart).toBe("regel");
    expect(einordnungAusstehend(gelesen ?? c)).toBe(false);
    // Danach das passende Band: Regelkonflikt ohne Zweitmeinung.
    expect(conflictWorkActions(conflictWorkKind(gelesen ?? {}).kind).zweitmeinung).toBe(false);

    const beleg = (await audit.list()).find((e) => e.action === "conflict.classified");
    expect(beleg?.actor).toBe("controller");
    expect(beleg?.payload).toEqual({ koIds: ["A", "B"], arbeitsart: "regel" });

    // Ein gelöster Konflikt wird nicht mehr eingeordnet.
    const k = await service.create({ koA: "A", koB: "B", type: "context", description: "y" });
    await service.resolve(k.id, "m", "entschieden");
    await expect(service.einordnen(k.id, "sache", "m")).rejects.toMatchObject({
      code: "ALREADY_RESOLVED",
    });
  });

  it("Einordnungsweg über die echte Route: 200 und gespeichert; fremder Wert 400", async () => {
    const { app, headers, koA, koB } = await adminApp();
    const angelegt = await konfliktAnlegen(app, headers, koA, koB, "context");
    const url = `/api/conflicts/${angelegt.id}/arbeitsart`;
    const schlecht = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { arbeitsart: "x" },
    });
    expect(schlecht.statusCode).toBe(400);
    const gut = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { arbeitsart: "version" },
    });
    expect(gut.statusCode, gut.body).toBe(200);
    const lesen = `/api/conflicts/${angelegt.id}`;
    const detail = await app.inject({ method: "GET", url: lesen, headers });
    expect(detail.json().arbeitsart).toBe("version");
  });
});

describe("R-0263 · Klaras Vorschlag Widerspruch / Präzisierung", () => {
  it("die Konfliktprüfung liefert den Vorschlag nur vollständig und nur bei „widerspruch“", () => {
    const basis = '"older":null,"confidence":0.9,"begruendung":"x","zitat_a":"a","zitat_b":"b"';
    const urteil = (relation: string, vorschlag: string) =>
      parseConflictResponse(`{"relation":"${relation}",${basis},"vorschlag":${vorschlag}}`);
    const praez = '{"art":"praezisierung","spezieller":"b","geltungsbereich":" Bolzen X "}';
    expect(urteil("widerspruch", praez)?.vorschlag).toEqual({
      art: "praezisierung",
      spezieller: "b",
      geltungsbereich: "Bolzen X",
    });
    expect(urteil("widerspruch", '{"art":"widerspruch","spezieller":null}')?.vorschlag).toEqual({
      art: "widerspruch",
    });
    // Unvollständige Präzisierung, fremde Art, falsche Relation → kein Vorschlag.
    expect(urteil("widerspruch", '{"art":"praezisierung","spezieller":"b"}')?.vorschlag).toBe(
      undefined,
    );
    expect(urteil("widerspruch", '{"art":"vielleicht"}')?.vorschlag).toBeUndefined();
    expect(urteil("ueberholt", praez)?.vorschlag).toBeUndefined();
  });

  it("die Erkennung legt den Vorschlag am Befund ab — die speziellere Seite als Kennung, offen und ohne Vorrang", async () => {
    const { service } = dienst();
    const { a, b, verdict } = erkennung({
      vorschlag: { art: "praezisierung", spezieller: "b", geltungsbereich: "Bolzen X" },
    });
    const [c] = await service.detectForSubject(a, [a, b], async () => verdict);
    expect(c?.detector?.vorschlag).toEqual({
      art: "praezisierung",
      spezieller: "B",
      geltungsbereich: "Bolzen X",
    });
    // Ein Vorschlag entscheidet nichts.
    expect(c?.status).toBe("offen");
    expect(c?.vorrang).toBeUndefined();
    expect(vorschlagAusUrteil({ ...verdict, relation: "ueberholt" }, "A", "B")).toBeUndefined();
  });

  it("die Oberfläche liest den Vorschlag mit Seite und Bereich; ohne Vorschlag behauptet sie nichts", () => {
    const vorschlag = {
      art: "praezisierung" as const,
      spezieller: "B",
      geltungsbereich: "Bolzen X",
    };
    const mitVorschlag = {
      koA: "A",
      koB: "B",
      detector: { trigger: "validation" as const, method: "model" as const, vorschlag },
    };
    expect(klaraVorschlag(mitVorschlag)).toEqual({
      schluessel: "konfliktarbeit.vorschlag.praezisierung",
      seite: "b",
      geltungsbereich: "Bolzen X",
    });
    expect(klaraVorschlag({ koA: "A", koB: "B" })).toBeNull();
  });

  it("Redaktion leert den vorgeschlagenen Geltungsbereich wie die Begründung", () => {
    const konflikt = {
      koA: "A",
      koB: "B",
      description: "geheim",
      detector: {
        rationale: "geheim",
        quotes: { a: "x", b: "y" },
        vorschlag: { art: "praezisierung", spezieller: "B", geltungsbereich: "Bolzen X" },
      },
    };
    const sicht = redigiereKonflikt(konflikt, { a: true, b: false });
    expect(sicht.detector?.vorschlag).toEqual({
      art: "praezisierung",
      spezieller: "B",
      geltungsbereich: "",
    });
    expect(redigiereKonflikt(konflikt, { a: true, b: true })).toBe(konflikt);
  });
});

describe("R-0263 · Geltungsbereich und Vorrang zwischen genau zwei Punkten", () => {
  it("am Dienst: überstimmt und präzisiert werden als Beziehung der zwei Punkte abgelegt", async () => {
    const { service } = dienst();
    const ueber = await service.create({ koA: "A", koB: "B", type: "context", description: "x" });
    const r1 = await service.resolve(ueber.id, "mensch", "B gilt", {
      art: "ueberstimmt",
      gilt: "B",
    });
    expect(r1.vorrang).toEqual({
      art: "ueberstimmt",
      vorrangKo: "B",
      nachrangKo: "A",
      geltungsbereich: null,
    });

    const praez = await service.create({ koA: "N", koB: "H", type: "context", description: "y" });
    const r2 = await service.resolve(praez.id, "mensch", "10 Nm für Bolzen X", {
      art: "schraenkt_ein",
      gilt: "N",
      geltungsbereich: "  Bolzen X  ",
    });
    expect(r2.vorrang).toEqual({
      art: "schraenkt_ein",
      vorrangKo: "N",
      nachrangKo: "H",
      geltungsbereich: "Bolzen X",
    });
    // Am Punkt lesbar — für beide Seiten, und nur für sie.
    expect((await service.vorrangFuerKo("H")).map((c) => c.id)).toEqual([praez.id]);
    expect((await service.vorrangFuerKo("N")).map((c) => c.id)).toEqual([praez.id]);
    expect(await service.vorrangFuerKo("Z")).toEqual([]);
  });

  it("am Dienst: Präzisierung ohne Geltungsbereich und Vorrang für einen dritten Punkt werden abgewiesen", async () => {
    const { service } = dienst();
    const c = await service.create({ koA: "A", koB: "B", type: "context", description: "x" });
    const ohneBereich = { art: "schraenkt_ein", gilt: "A", geltungsbereich: " " } as const;
    const dritter = { art: "ueberstimmt", gilt: "DRITTER" } as const;
    await expect(service.resolve(c.id, "mensch", "x", ohneBereich)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(service.resolve(c.id, "mensch", "x", dritter)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    // Nichts geschrieben.
    expect((await service.get(c.id))?.status).toBe("offen");
  });

  it("am Dienst: „Beide gelten“ legt keinen Vorrang fest — auch nicht nach erneuter Eskalation", async () => {
    const { service } = dienst();
    const c = await service.create({ koA: "A", koB: "B", type: "truth", description: "x" });
    await service.escalate(c.id);
    await service.resolve(c.id, "mensch", "A gilt", { art: "ueberstimmt", gilt: "A" });
    expect((await service.get(c.id))?.vorrang?.vorrangKo).toBe("A");
    await service.escalate(c.id);
    await service.resolve(c.id, "mensch", "Beide gelten, je nach Kontext.");
    expect((await service.get(c.id))?.vorrang).toBeUndefined();
  });

  it("über die echte Route: nur die zwei Punkte tragen den Vorrang, kein Objekt wird verändert", async () => {
    const { app, headers, ids } = await adminApp();
    const [allgemein, speziell, unbeteiligt] = ids as [string, string, string];
    const konflikt = await konfliktAnlegen(app, headers, allgemein, speziell, "context");
    type Stand = { version: number; status: string; statement: string; sources?: unknown[] };
    const lies = async (koId: string): Promise<Stand> => {
      const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
      return res.json() as Stand;
    };
    const vorher = await Promise.all([allgemein, speziell, unbeteiligt].map(lies));

    const falsch = await entscheiden(app, headers, allgemein, konflikt.id, { art: "irgendwas" });
    expect(falsch.statusCode).toBe(400);
    const ohneBereich = await entscheiden(app, headers, allgemein, konflikt.id, {
      art: "schraenkt_ein",
      gilt: speziell,
    });
    expect(ohneBereich.statusCode).toBe(400);

    const ok = await entscheiden(app, headers, allgemein, konflikt.id, {
      art: "schraenkt_ein",
      gilt: speziell,
      geltungsbereich: "Bolzen X an Anlage 3",
    });
    expect(ok.statusCode, ok.body).toBe(200);

    // Kein Objekt wurde angefasst: Fassung, Status, Aussage und Quellen aller drei Punkte unverändert.
    const nachher = await Promise.all([allgemein, speziell, unbeteiligt].map(lies));
    for (const [i, ko] of nachher.entries()) {
      const alt = vorher[i];
      expect(ko.version).toBe(alt?.version);
      expect(ko.status).toBe(alt?.status);
      expect(ko.statement).toBe(alt?.statement);
      expect(ko.sources ?? []).toEqual(alt?.sources ?? []);
    }

    // Am Punkt sichtbar — an beiden beteiligten, nicht am unbeteiligten.
    const amPunkt = async (koId: string): Promise<Record<string, unknown>[]> => {
      const url = `/api/conflicts/vorrang/${koId}`;
      const res = await app.inject({ method: "GET", url, headers });
      expect(res.statusCode).toBe(200);
      return res.json() as Record<string, unknown>[];
    };
    const amAllgemeinen = await amPunkt(allgemein);
    expect(amAllgemeinen).toHaveLength(1);
    expect(amAllgemeinen[0]).toMatchObject({
      art: "schraenkt_ein",
      vorrangKo: speziell,
      nachrangKo: allgemein,
      geltungsbereich: "Bolzen X an Anlage 3",
    });
    expect(await amPunkt(speziell)).toHaveLength(1);
    expect(await amPunkt(unbeteiligt)).toEqual([]);
    expect(isVorrangWahl({ art: "ueberstimmt", gilt: "x" })).toBe(true);
  });

  it("der Satz am Punkt hängt an Art und Seite", () => {
    const praez = { art: "schraenkt_ein" as const, vorrangKo: "N", nachrangKo: "H" };
    expect(vorrangAmPunkt(praez, "N")).toEqual({
      schluessel: "konfliktarbeit.amPunkt.praezisiert",
      gegenueber: "H",
    });
    expect(vorrangAmPunkt(praez, "H")).toEqual({
      schluessel: "konfliktarbeit.amPunkt.eingeschraenktVon",
      gegenueber: "N",
    });
    const ueber = { art: "ueberstimmt" as const, vorrangKo: "A", nachrangKo: "B" };
    expect(vorrangAmPunkt(ueber, "A").schluessel).toBe("konfliktarbeit.amPunkt.hatVorrang");
    expect(vorrangAmPunkt(ueber, "B").schluessel).toBe("konfliktarbeit.amPunkt.ueberstimmtVon");
  });
});
