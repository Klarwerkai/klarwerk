// ================================================================================================
// BES-01 · BESCHAFFUNGSFALL PX-17 — SOLLBESTAND, IMPORT, FACHPRÜFUNG UND RECHTETRENNUNG AM DRAHT.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-beispielfall-beschaffung` (Revision 2), Szenarien BES-S01 und
// BES-S02. AGENTENPROBE, KEINE ECHTE NUTZUNG: ein automatisierter Durchlauf über die ECHTEN Routen
// (`buildApp(buildServices())`, In-Memory, ohne Modell, ohne Netz). Neu ist nur der fiktive
// Sollbestand (`sollbestand.ts`); Import, Prüfwarteschlange, Bereiche und Fachprüfung sind die
// vorhandenen Wege:
//
//   fiktive Quelle → `POST /api/library/import/candidates` (Prüfkandidat, noch kein Wissen)
//     → `PUT …/candidates/:id` annehmen / Rückfrage / ablehnen (Quellenpflege, `ko.validate`)
//     → `POST /api/spaces/verschiebung` in den berechtigten Bereich
//     → `PUT /api/kos/:id` `rate` durch die Fachprüfung → erst dann `validiert`.
//
// Rollen (alle fiktiv): Ada (Verwaltung, admin, ohne Inhaltszugang), Carla (Quellenpflege,
// controller, führt beide Bereiche), Theo/Uwe/Vera (Fachprüfung, controller, lesen beide Bereiche),
// Elena (Einkauf, experte, liest nur Lieferanten), Dora (Design, experte, liest nur Design).
//
// WAS DIESE DATEI NICHT DECKT (ehrlich): keinen echten Confluence- oder Dateiablage-Adapter (die
// Quellen kommen über den vorhandenen generischen Dateiweg mit Herkunftsangaben), kein Postgres,
// keinen Browser, keine menschliche Bedienung, keinen Versand und keinen Lieferantenkontakt.
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  BEDARF,
  FAELLE,
  HINWEIS_FIKTION,
  LIEFERANTEN_SUCHWORT,
  ORIGINALKRITERIEN,
  QUELLEN,
  ROLLEN,
  SOLLBESTAND_FASSUNG,
  STICHTAG,
  SYNTHETISCH_TAG,
  type SollQuelle,
  ZUORDNUNG,
  quelle,
} from "./sollbestand";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

interface KandidatDto {
  id: string;
  status: string;
  koId: string | null;
  note?: string;
  item?: { title?: string; statement?: string; externalId?: string };
}

interface KoDto {
  id: string;
  title: string;
  statement: string;
  status: string;
  trust: number;
  origin?: string;
  tags?: string[];
  spaceId?: string;
  neededValidations: number;
  sources?: {
    provider?: string | null;
    externalId?: string;
    sourceVersion?: number;
    url?: string | null;
  }[];
}

const KENNWORT = "fiktiv-px17-12345";

const EMAIL = {
  ada: "ada@px17.test",
  carla: "carla@px17.test",
  theo: "theo@px17.test",
  uwe: "uwe@px17.test",
  vera: "vera@px17.test",
  elena: "elena@px17.test",
  dora: "dora@px17.test",
} as const;

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

const lies = (app: App, k: Kopf, url: string) => app.inject({ method: "GET", url, headers: k });
const post = (app: App, k: Kopf, url: string, payload: unknown) =>
  app.inject({ method: "POST", url, headers: k, payload: payload as Record<string, unknown> });
const put = (app: App, k: Kopf, url: string, payload: Record<string, unknown>) =>
  app.inject({ method: "PUT", url, headers: k, payload });

function alsImport(q: SollQuelle) {
  return {
    title: q.titel,
    statement: q.aussage,
    type: "best_practice",
    category: "Beschaffung (fiktiv)",
    author: `Fiktive Quelle ${q.quellId}`,
    confidentiality: "intern",
    tags: [SYNTHETISCH_TAG, q.quellId],
    provider: q.herkunft.provider,
    externalId: q.herkunft.externalId,
    sourceVersion: q.herkunft.sourceVersion,
    url: q.herkunft.url,
  };
}

async function verschieben(app: App, k: Kopf, koId: string, zielSpaceId: string): Promise<void> {
  const v = await post(app, k, "/api/spaces/verschiebung/vorschau", { koId, zielSpaceId });
  expect(v.statusCode, v.body).toBe(200);
  const vj = v.json();
  expect(vj.darfAusfuehren, vj.grund).toBe(true);
  const res = await post(app, k, "/api/spaces/verschiebung", {
    koId,
    zielSpaceId,
    basis: {
      quelleId: vj.quelle?.id ?? null,
      quelleVersion: vj.quelle?.version ?? null,
      zielId: vj.ziel?.id ?? null,
      zielVersion: vj.ziel?.version ?? null,
      grundlage: vj.grundlage,
    },
  });
  expect(res.statusCode, res.body).toBe(200);
}

/** Der ganze Fall, einmal aufgebaut; die Prüfungen unten lesen nur. */
async function fallAufbauen() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: ROLLEN.verwaltung.name, email: EMAIL.ada, password: KENNWORT },
  });
  const ada = await anmelden(app, EMAIL.ada);
  const anlegen: [string, string, string][] = [
    [ROLLEN.quellenpflege.name, EMAIL.carla, ROLLEN.quellenpflege.rolle],
    [ROLLEN.fachpruefung[0].name, EMAIL.theo, ROLLEN.fachpruefung[0].rolle],
    [ROLLEN.fachpruefung[1].name, EMAIL.uwe, ROLLEN.fachpruefung[1].rolle],
    [ROLLEN.fachpruefung[2].name, EMAIL.vera, ROLLEN.fachpruefung[2].rolle],
    [ROLLEN.einkauf.name, EMAIL.elena, ROLLEN.einkauf.rolle],
    [ROLLEN.design.name, EMAIL.dora, ROLLEN.design.rolle],
  ];
  for (const [name, email, role] of anlegen) {
    const res = await post(app, ada, "/api/users", { name, email, password: KENNWORT, role });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    ada,
    carla: await anmelden(app, EMAIL.carla),
    theo: await anmelden(app, EMAIL.theo),
    uwe: await anmelden(app, EMAIL.uwe),
    vera: await anmelden(app, EMAIL.vera),
    elena: await anmelden(app, EMAIL.elena),
    dora: await anmelden(app, EMAIL.dora),
  };
  const kontenRes = await lies(app, k.carla, "/api/spaces/konten");
  expect(kontenRes.statusCode, kontenRes.body).toBe(200);
  const konten = kontenRes.json().konten as { id: string; name: string }[];
  const kontoId = (name: string): string => konten.find((x) => x.name === name)?.id ?? "";
  const pruefer = ROLLEN.fachpruefung.map((r) => kontoId(r.name));

  // Zwei vorhandene Bereiche mit verschiedenem Recht — die Quellenpflege führt beide.
  const bereichAnlegen = async (name: string, leser: string): Promise<string> => {
    const res = await post(app, k.carla, "/api/spaces", {
      name,
      zweck: "Fiktiver Beschaffungsfall PX-17 (BES-01).",
      verantwortlich: kontoId(ROLLEN.quellenpflege.name),
      zugang: "mitglieder",
      mitglieder: [leser, ...pruefer].map((nutzer) => ({ nutzer, recht: "lesen" })),
      ansichten: [],
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  const bereiche = {
    design: await bereichAnlegen("PX-17 Design (fiktiv)", kontoId(ROLLEN.design.name)),
    lieferanten: await bereichAnlegen("PX-17 Lieferanten (fiktiv)", kontoId(ROLLEN.einkauf.name)),
  };

  // Schritt 1 · Einlesen: jede Sollquelle wird ein Prüfkandidat — noch kein Wissen.
  const eingereiht = await post(app, k.carla, "/api/library/import/candidates", {
    items: QUELLEN.map(alsImport),
  });
  expect(eingereiht.statusCode, eingereiht.body).toBe(201);
  const kandidaten = eingereiht.json() as KandidatDto[];
  const nachEinlesen = {
    kandidaten: kandidaten.map((x) => ({ status: x.status, koId: x.koId })),
    wissen: ((await lies(app, k.carla, "/api/kos")).json() as KoDto[]).length,
  };

  // Schritt 2 · Entscheidung je Kandidat nach dem VORAB benannten Sollurteil.
  const entscheidung = new Map<string, KandidatDto>();
  for (const q of QUELLEN) {
    const kandidat = kandidaten.find((x) => x.item?.externalId === q.herkunft.externalId);
    expect(kandidat, `kein Kandidat für ${q.quellId}`).toBeDefined();
    const res = await put(app, k.carla, `/api/library/import/candidates/${kandidat?.id}`, {
      action: q.annahme,
      note: q.klaerfrage ?? q.begruendung,
    });
    expect(res.statusCode, `${q.quellId}: ${res.body}`).toBe(200);
    entscheidung.set(q.quellId, res.json() as KandidatDto);
  }
  const angenommen = QUELLEN.filter((q) => q.annahme === "accept");
  const koIdVon = (quellId: string): string => entscheidung.get(quellId)?.koId ?? "";
  const stand = async (quellId: string): Promise<KoDto> => {
    const res = await lies(app, k.carla, `/api/kos/${koIdVon(quellId)}`);
    expect(res.statusCode, `${quellId}: ${res.body}`).toBe(200);
    return res.json() as KoDto;
  };
  const nachAnnahme = new Map<string, KoDto>();
  for (const q of angenommen) {
    nachAnnahme.set(q.quellId, await stand(q.quellId));
  }

  // Schritt 3 · in den berechtigten Bereich.
  for (const q of angenommen) {
    if (q.bereich !== "offen") {
      await verschieben(app, k.carla, koIdVon(q.quellId), bereiche[q.bereich]);
    }
  }

  // Gegenprobe: die Verwaltung (admin) sieht den Designbereich nicht und kann dort nicht freigeben.
  const adminFreigabe = await put(app, k.ada, `/api/kos/${koIdVon("BES-PX17-D3")}`, {
    action: "rate",
    verdict: "up",
  });

  // Schritt 4 · Fachprüfung über die vorhandene Bewertung — so viele Stimmen, wie das Objekt verlangt.
  const prueferKoepfe = [k.theo, k.uwe, k.vera];
  for (const q of angenommen) {
    const benoetigt = nachAnnahme.get(q.quellId)?.neededValidations ?? 0;
    expect(benoetigt, q.quellId).toBeGreaterThanOrEqual(1);
    expect(benoetigt, q.quellId).toBeLessThanOrEqual(prueferKoepfe.length);
    for (const kopf of prueferKoepfe.slice(0, benoetigt)) {
      const res = await put(app, kopf, `/api/kos/${koIdVon(q.quellId)}`, {
        action: "rate",
        verdict: "up",
      });
      expect(res.statusCode, `${q.quellId}: ${res.body}`).toBe(200);
    }
  }
  const nachPruefung = new Map<string, KoDto>();
  for (const q of angenommen) {
    nachPruefung.set(q.quellId, await stand(q.quellId));
  }

  return {
    app,
    k,
    bereiche,
    kandidaten,
    nachEinlesen,
    entscheidung,
    koIdVon,
    nachAnnahme,
    nachPruefung,
    adminFreigabe,
  };
}

type Fall = Awaited<ReturnType<typeof fallAufbauen>>;

const ANGENOMMEN = QUELLEN.filter((q) => q.annahme === "accept").map((q) => q.quellId);
const NICHT_ANGENOMMEN = QUELLEN.filter((q) => q.annahme !== "accept").map((q) => q.quellId);

describe("BES-01 · der Sollbestand selbst (vorab festgelegt, versioniert, fiktiv)", () => {
  it("K01: der Fall ist dem offenen historischen Vertrag zugeordnet, seine Originalkriterien wörtlich", () => {
    expect(SOLLBESTAND_FASSUNG).toBe("BES-01-SOLL-v1");
    expect(ZUORDNUNG).toMatchObject({
      auftrag: "aufnahme:20260922:gesamt-beispielfall-beschaffung",
      historischerPunkt: "R-0123",
      altbestand: "F-0123",
      bauauftrag: "BES-01",
    });
    expect(ORIGINALKRITERIEN).toHaveLength(3);
    expect(ORIGINALKRITERIEN[1]).toContain("Klärung des aufgenommenen Vorschlags (R-0123)");
  });

  it("K02: Produktblatt, freigegebenes und Entwurfsdesign, Vorgabe und Lieferantenliste mit stabiler Herkunft", () => {
    const istConfluence = (q: SollQuelle) => q.herkunft.provider === "fiktiv-confluence";
    const pflicht: [string, (q: SollQuelle) => boolean][] = [
      ["Produktblatt", (q) => q.art === "produktblatt"],
      ["freigegebenes Design", (q) => q.art === "design" && q.freigabestand === "freigegeben"],
      ["Entwurfsdesign", (q) => q.art === "design" && q.freigabestand === "entwurf"],
      ["Confluence-Vorgabe", (q) => q.art === "vorgabe" && istConfluence(q)],
      ["Lieferantenliste", (q) => q.art === "lieferantenliste"],
    ];
    for (const [name, passt] of pflicht) {
      expect(QUELLEN.filter(passt).length, name).toBeGreaterThanOrEqual(1);
    }
    // Stabil: eindeutige Kennung je Quelle und je Herkunft; jede Quelle ausdrücklich synthetisch.
    expect(new Set(QUELLEN.map((q) => q.quellId)).size).toBe(QUELLEN.length);
    expect(new Set(QUELLEN.map((q) => q.herkunft.externalId)).size).toBe(QUELLEN.length);
    for (const q of QUELLEN) {
      expect(q.synthetisch, q.quellId).toBe(true);
      expect(q.titel, q.quellId).toContain("(fiktiv)");
      expect(q.herkunft.url, q.quellId).toMatch(/^https:\/\/[a-z]+\.example\.test\//);
      expect(q.herkunft.sourceVersion, q.quellId).toBeGreaterThanOrEqual(1);
    }
    expect(quelle("BES-PX17-D3").fassung).toBe("D3");
    expect(quelle("BES-PX17-D4").fassung).toBe("D4");
    expect(quelle("BES-PX17-V2").fassung).toBe("V2");
    // Mindestens drei berechtigte Lieferanten.
    const berechtigt = QUELLEN.filter(
      (q) => q.art === "lieferant" && q.sollurteil === "verwendbar_nach_fachpruefung",
    );
    expect(berechtigt.map((q) => q.quellId)).toEqual([
      "BES-PX17-L-ALPHA",
      "BES-PX17-L-BETA",
      "BES-PX17-L-GAMMA",
    ]);
  });

  it("K04: Menge und Liefertermin sind offen; die Altdaten sind nur historischer Hinweis", () => {
    expect(BEDARF.menge).toBeNull();
    expect(BEDARF.liefertermin).toBeNull();
    expect(BEDARF.status).toBe("offen_fachlich_zu_klaeren");
    for (const hinweis of BEDARF.historischeHinweise) {
      expect(hinweis.art).toBe("historischer_hinweis");
      expect(quelle(hinweis.quellId).sollurteil).toBe("historisch");
    }
  });

  it("K05: Sollurteile stehen vorab fest — der jüngste Zeitstempel entscheidet nicht", () => {
    for (const q of QUELLEN) {
      expect(q.begruendung.length, q.quellId).toBeGreaterThan(0);
      const heuteGueltig =
        q.freigabestand === "freigegeben" && q.giltAb !== null && q.giltAb <= STICHTAG;
      expect(q.sollurteil === "verwendbar_nach_fachpruefung", q.quellId).toBe(heuteGueltig);
      if (q.annahme === "info") {
        expect(q.klaerfrage, q.quellId).toBeTruthy();
      }
    }
    const juengste = (art: SollQuelle["art"]): SollQuelle | undefined => {
      const gleicheArt = QUELLEN.filter((q) => q.art === art);
      return [...gleicheArt].sort((a, b) => b.stand.localeCompare(a.stand))[0];
    };
    expect(juengste("design")?.quellId).toBe("BES-PX17-D4");
    expect(juengste("design")?.sollurteil).toBe("nicht_heute_gueltig");
    expect(juengste("vorgabe")?.quellId).toBe("BES-PX17-V3");
    expect(juengste("vorgabe")?.sollurteil).toBe("nicht_heute_gueltig");
    expect(quelle("BES-PX17-D2").sollurteil).toBe("historisch");
  });

  it("K07: vollständiger, fehlender, widersprüchlicher, unberechtigter Fall und Dokumentanweisung", () => {
    expect(FAELLE.map((f) => f.art).sort()).toEqual(
      ["anweisung", "fehlend", "unberechtigt", "vollstaendig", "widerspruechlich"].sort(),
    );
    for (const f of FAELLE) {
      for (const id of f.quellen) {
        expect(() => quelle(id), `${f.id} → ${id}`).not.toThrow();
      }
    }
  });

  it("K08: Beispielregel und Testpreise sind ausdrücklich fiktiv", () => {
    expect(HINWEIS_FIKTION).toContain("keine Unternehmens- oder Rechtsaussage");
    for (const q of QUELLEN.filter((x) => /Testpreis|Beispielregel/.test(x.aussage))) {
      expect(q.aussage, q.quellId).toMatch(/fiktiv/i);
    }
    expect(quelle("BES-PX17-V2").aussage).toContain("ohne Rechtswirkung");
  });
});

describe("BES-S01 · Quellenfall und Sollbestand am Draht", () => {
  let fall: Fall;
  beforeAll(async () => {
    fall = await fallAufbauen();
  });

  it("K03: Einlesen erzeugt nur Prüfkandidaten — noch kein Wissen", () => {
    expect(fall.nachEinlesen.kandidaten).toEqual(
      QUELLEN.map(() => ({ status: "neu", koId: null })),
    );
    expect(fall.nachEinlesen.wissen, "schon das Einlesen hat Wissen angelegt").toBe(0);
  });

  it("K03: die Annahme legt ungeprüftes Importwissen an; verwendbar erst nach der Fachprüfung", () => {
    for (const id of ANGENOMMEN) {
      const vorher = fall.nachAnnahme.get(id);
      expect(
        { status: vorher?.status, trust: vorher?.trust, origin: vorher?.origin },
        `${id} war schon mit der Annahme verwendbar`,
      ).toEqual({ status: "offen", trust: 0, origin: "import" });
      expect(fall.nachPruefung.get(id)?.status, `${id} nach der Fachprüfung`).toBe("validiert");
    }
  });

  it("K03 · Gegenprobe: die Verwaltungsrolle ersetzt keine fachliche Freigabe", () => {
    expect(fall.adminFreigabe.statusCode, fall.adminFreigabe.body).toBe(404);
    expect(fall.adminFreigabe.body).not.toContain(quelle("BES-PX17-D3").titel);
  });

  it("K02: das verwendbare Wissen trägt die Herkunft und Fassung seiner Sollquelle", () => {
    for (const id of ANGENOMMEN) {
      const q = quelle(id);
      const ko = fall.nachPruefung.get(id);
      expect(ko?.title).toBe(q.titel);
      expect(ko?.tags ?? []).toContain(SYNTHETISCH_TAG);
      expect(ko?.sources, id).toEqual([
        expect.objectContaining({
          provider: q.herkunft.provider,
          externalId: q.herkunft.externalId,
          sourceVersion: q.herkunft.sourceVersion,
          url: q.herkunft.url,
        }),
      ]);
    }
  });

  it("K04: Altmenge und Alttermin werden kein verwendbares Wissen", async () => {
    expect(fall.entscheidung.get("BES-PX17-ALT-2025")).toMatchObject({
      status: "abgelehnt",
      koId: null,
    });
    const bestand = (await lies(fall.app, fall.k.carla, "/api/kos")).json() as KoDto[];
    for (const ko of bestand) {
      expect(ko.statement, ko.title).not.toContain("5.000 Stück");
      expect(ko.statement, ko.title).not.toContain("04.04.2025");
    }
  });
});

describe("BES-S02 · Geltung und eingeschränkte Rolle am Draht", () => {
  let fall: Fall;
  beforeAll(async () => {
    fall = await fallAufbauen();
  });

  it("K05: Entwurf, Zukunftsfassung und Widerspruch bleiben Rückfrage; Altstand wird abgelehnt", () => {
    for (const id of ["BES-PX17-D4", "BES-PX17-V3", "BES-PX17-MB-BETA"]) {
      expect(fall.entscheidung.get(id), id).toMatchObject({
        status: "info-angefragt",
        koId: null,
        note: quelle(id).klaerfrage,
      });
    }
    const altstand = fall.entscheidung.get("BES-PX17-D2");
    expect({ status: altstand?.status, koId: altstand?.koId }).toEqual({
      status: "abgelehnt",
      koId: null,
    });
    // Heute gelten genau D3 und V2 — obwohl D4 und V3 jüngere Zeitstempel tragen.
    expect(fall.nachPruefung.get("BES-PX17-D3")?.status).toBe("validiert");
    expect(fall.nachPruefung.get("BES-PX17-V2")?.status).toBe("validiert");
  });

  it("K06: Design- und Einkaufsrolle sehen keine fremden Inhalte, Titel oder Treffer", async () => {
    const { app, k, koIdVon } = fall;
    const sichtbar = (ids: string[]) => ids.map(koIdVon).sort();
    const offen = ["BES-PX17-PB", "BES-PX17-V2"];
    const design = ["BES-PX17-D3"];
    const lieferanten = ANGENOMMEN.filter((id) => quelle(id).bereich === "lieferanten");
    expect(lieferanten).toHaveLength(4);

    const fallIds = new Set(ANGENOMMEN.map(koIdVon));
    const liste = async (kopf: Kopf) =>
      ((await lies(app, kopf, "/api/kos")).json() as KoDto[])
        .map((ko) => ko.id)
        .filter((id) => fallIds.has(id))
        .sort();
    expect(await liste(k.dora)).toEqual(sichtbar([...offen, ...design]));
    expect(await liste(k.elena)).toEqual(sichtbar([...offen, ...lieferanten]));

    // Detailabruf fremder Inhalte: 404 ohne Titel — für beide Richtungen.
    for (const [kopf, fremd] of [
      [k.dora, lieferanten],
      [k.elena, design],
    ] as const) {
      for (const id of fremd) {
        const res = await lies(app, kopf, `/api/kos/${koIdVon(id)}`);
        expect(res.statusCode, id).toBe(404);
        expect(res.body, id).not.toContain(quelle(id).titel);
      }
    }

    // Suche: kein fremder Treffer und keine verdeckte Zahl; die Einkaufsrolle findet dasselbe Wort.
    const suche = async (kopf: Kopf) => {
      const res = await lies(app, kopf, `/api/library/search?q=${LIEFERANTEN_SUCHWORT}`);
      expect(res.statusCode, res.body).toBe(200);
      return res;
    };
    const doraSuche = await suche(k.dora);
    expect(doraSuche.json()).toEqual([]);
    for (const id of lieferanten) {
      expect(doraSuche.body).not.toContain(quelle(id).titel);
    }
    const elenaTreffer = ((await suche(k.elena)).json() as { id: string }[]).map((x) => x.id);
    expect(elenaTreffer).toContain(koIdVon("BES-PX17-L-ALPHA"));

    // Bereichsliste der eigenen Firma: genau das Sichtbare — die Zahl ist die der sichtbaren Zeilen.
    const artikel = async (kopf: Kopf) => {
      const res = await lies(app, kopf, "/api/spaces/artikel?kontext=firma");
      expect(res.statusCode, res.body).toBe(200);
      return (res.json().artikel as { id: string }[])
        .map((a) => a.id)
        .filter((id) => fallIds.has(id))
        .sort();
    };
    expect(await artikel(k.dora)).toEqual(sichtbar([...offen, ...design]));
    expect(await artikel(k.elena)).toEqual(sichtbar([...offen, ...lieferanten]));
  });

  it("K07: unberechtigter Lieferant und eingebettete Anweisung bleiben ohne Wirkung", async () => {
    const { app, k } = fall;
    expect(fall.entscheidung.get("BES-PX17-L-DELTA")).toMatchObject({
      status: "abgelehnt",
      koId: null,
    });
    expect(fall.entscheidung.get("BES-PX17-ANW")).toMatchObject({
      status: "abgelehnt",
      koId: null,
    });
    // Die Anweisung ist als Datum gespeichert, wörtlich — sie hat nichts ausgelöst.
    const warteschlange = (
      await lies(app, k.carla, "/api/library/import/candidates")
    ).json() as KandidatDto[];
    const anw = warteschlange.find(
      (x) => x.item?.externalId === quelle("BES-PX17-ANW").herkunft.externalId,
    );
    expect(anw?.item?.statement).toBe(quelle("BES-PX17-ANW").aussage);
    // Kein zusätzliches Wissen und kein erweitertes Recht: der Bestand ist genau das Angenommene,
    // und die Designrolle sieht weiterhin keinen Lieferanteninhalt.
    const bestand = (await lies(app, k.carla, "/api/kos")).json() as KoDto[];
    expect(bestand.map((ko) => ko.id).sort()).toEqual(ANGENOMMEN.map(fall.koIdVon).sort());
    for (const id of NICHT_ANGENOMMEN) {
      expect(
        bestand.some((ko) => ko.title === quelle(id).titel),
        id,
      ).toBe(false);
    }
  });

  it("K08: im Beleg nachlesbar — jede Quelle mit Import- und Prüfstand, alles als fiktiv markiert", () => {
    const beleg = QUELLEN.map((q) => ({
      quellId: q.quellId,
      fassung: q.fassung,
      kandidat: fall.entscheidung.get(q.quellId)?.status,
      pruefstand: fall.nachPruefung.get(q.quellId)?.status ?? null,
    }));
    const KANDIDATENSTATUS = {
      accept: "angenommen",
      info: "info-angefragt",
      reject: "abgelehnt",
    } as const;
    expect(beleg).toEqual(
      QUELLEN.map((q) => ({
        quellId: q.quellId,
        fassung: q.fassung,
        kandidat: KANDIDATENSTATUS[q.annahme],
        pruefstand: q.annahme === "accept" ? "validiert" : null,
      })),
    );
    for (const id of ANGENOMMEN) {
      expect(fall.nachPruefung.get(id)?.title, id).toContain("(fiktiv)");
    }
  });
});
