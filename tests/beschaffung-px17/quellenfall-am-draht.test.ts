// ================================================================================================
// BES-01 · BESCHAFFUNGSFALL PX-17 — SOLLBESTAND, IMPORT, FACHPRÜFUNG UND RECHTETRENNUNG AM DRAHT.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-beispielfall-beschaffung` (Revision 2), Szenarien BES-S01 und
// BES-S02. AGENTENPROBE, KEINE ECHTE NUTZUNG: ein automatisierter Durchlauf über die ECHTEN Dienste
// und Routen (`buildApp(buildServices())`, In-Memory, ohne Modell, ohne Netz). Ersetzt ist GENAU
// EINE Stelle: die Antwort der fiktiven Confluence-Instanz — als `fetchFn` des echten Adapters
// (`adapterFromConfig`). Neu ist nur der fiktive Sollbestand (`sollbestand.ts`); Import,
// Quellrechte, Prüfwarteschlange, Bereiche und Fachprüfung sind die vorhandenen Wege:
//
//   fiktive Confluence-Seite (Seitenrestriktion = Bereichsleser) → `runConfluenceImport`
//     (der Weg hinter „Bereich importieren“: Adapter, Leserauflösung über die Mailadressen,
//     `createImportCandidates`) → Prüfkandidat mit serverseitigen Quellrechten, noch kein Wissen
//     → `PUT …/candidates/:id` annehmen / Rückfrage / ablehnen (Quellenpflege, `ko.validate`)
//     → `POST /api/spaces/verschiebung` in den berechtigten Bereich
//     → `PUT /api/kos/:id` `rate` durch die Fachprüfung → erst dann `validiert`.
//
// Bens Befund (nacharbeit-2): v1 reichte die Quellen über den generischen Dateiweg ein; Kandidaten
// trugen keine Quellrechte und standen in der Warteschlange jedem `ko.read`-Konto offen. Jetzt
// tragen sie die Quellrechte des Adapters, und K06 wird an Warteschlange UND Wissen gemessen — vor
// und nach den Importentscheidungen.
//
// ERGEBNISPROTOKOLL: der letzte Fall von BES-S02 legt das Protokoll dieses Laufs (tatsächliche
// Kandidaten- und Wissensobjektkennungen, Quellenfassungen, Rollen und Konten, Instanzart,
// Freigabeschritte, Negativergebnisse) unter `meta.besErgebnisprotokoll` in den nativen
// Vitest-Bericht; der Prüfadapter sichert diesen Bericht kandidatgebunden.
//
// Rollen (alle fiktiv): Ada (Verwaltung, admin, ohne Inhaltszugang), Carla (Quellenpflege,
// controller, führt beide Bereiche), Theo/Uwe/Vera (Fachprüfung, controller, lesen beide Bereiche),
// Elena (Einkauf, experte, liest nur Lieferanten), Dora (Design, experte, liest nur Design).
//
// WAS DIESE DATEI NICHT DECKT (ehrlich): keine echte Confluence-Instanz und keinen echten
// Dateispeicher, kein Postgres, keinen Browser, keine menschliche Bedienung, keinen Versand und
// keinen Lieferantenkontakt.
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { adapterFromConfig } from "../support/confluence-adapter";
import {
  BEDARF,
  BEREICHSLESER,
  CONFLUENCE_BASIS,
  CONFLUENCE_SPACE,
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

// Wie in `tests/uebernahme-standard-intern/confluence-leserechte-quellgetreu.test.ts`: die
// Freigabe steht beim Bau der Dienste — die Annahme schreibt dann den Herkunftsanker, und die
// Quellleser werden auf Konten aufgelöst.
process.env.KLARWERK_CONFLUENCE_IMPORT = "1";

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
  confidentiality?: string;
  neededValidations: number;
  sources?: {
    provider?: string | null;
    externalId?: string;
    sourceVersion?: number;
    url?: string | null;
  }[];
}

const KENNWORT = "fiktiv-px17-12345";

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

/** Die Sollquelle als Seite des fiktiven Bereichs; die Bereichsleser stehen als Restriktion daran. */
function confluenceSeite(q: SollQuelle): ConfluencePage {
  const leser = BEREICHSLESER[q.bereich];
  return {
    id: q.herkunft.externalId,
    title: q.titel,
    type: "page",
    status: "current",
    body: { storage: { value: `<p>${q.aussage}</p>` } },
    version: {
      number: q.herkunft.sourceVersion,
      when: q.stand,
      by: { displayName: `Fiktive Quelle ${q.quellId}` },
    },
    _links: { webui: `/spaces/${CONFLUENCE_SPACE}/pages/${q.herkunft.externalId}` },
    ancestors: [],
    metadata: {
      labels: { results: [{ name: SYNTHETISCH_TAG }, { name: q.quellId.toLowerCase() }] },
    },
    ...(leser
      ? {
          restrictions: {
            read: {
              restrictions: {
                user: { results: leser.map((email) => ({ accountId: `acc-${email}`, email })) },
                group: { results: [] },
              },
            },
          },
        }
      : {}),
  };
}

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/**
 * Die fiktive Confluence-Instanz: ein ANONYM lesbarer Bereich (die Rechte stehen an den Seiten),
 * Einzelabruf je Seite, keine Anhänge, keine Gruppen. Dieselbe Antwortform wie die Fixture der
 * Leserechte-Tests.
 */
function fiktiverBereich(seiten: readonly ConfluencePage[]) {
  const fetchFn = (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    if (/\/rest\/api\/content\/[^/]+\/permission\/check$/.test(u.pathname)) {
      return antwort(200, { hasPermission: false });
    }
    if (/\/api\/v2\/spaces\/[^/]+\/permissions$/.test(u.pathname)) {
      return antwort(200, { results: [], _links: {} });
    }
    if (u.pathname.endsWith("/child/attachment")) {
      return antwort(200, { results: [] });
    }
    const einzeln = /\/rest\/api\/content\/([^/]+)$/.exec(u.pathname);
    if (einzeln) {
      const s = seiten.find((p) => p.id === decodeURIComponent(einzeln[1] ?? ""));
      return s ? antwort(200, s) : antwort(404, {});
    }
    if (u.pathname.endsWith(`/rest/api/space/${CONFLUENCE_SPACE}`)) {
      return antwort(200, {
        id: 655363,
        key: CONFLUENCE_SPACE,
        permissions: [
          {
            operation: { operation: "read", targetType: "space" },
            anonymousAccess: true,
            subjects: { user: { results: [] }, group: { results: [] } },
          },
        ],
      });
    }
    if (u.pathname.endsWith("/rest/api/group")) {
      return antwort(200, { results: [], _links: {} });
    }
    if (u.pathname.endsWith("/rest/api/user/email")) {
      return antwort(404, {});
    }
    return antwort(200, { results: seiten });
  }) as unknown as typeof fetch;
  return adapterFromConfig({
    baseUrl: CONFLUENCE_BASIS,
    email: "dienstkonto@px17.test",
    apiToken: "fiktiv-px17-kein-echtes-token",
    spaceKey: CONFLUENCE_SPACE,
    fetchFn,
  });
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

/** Was ein Konto in der Prüfwarteschlange und ihren Befunden sieht — am Rohkörper gemessen. */
interface Warteschlangensicht {
  externalIds: string[];
  body: string;
  befundIds: string[];
  kandidatIds: string[];
}

async function warteschlangensicht(app: App, kopf: Kopf): Promise<Warteschlangensicht> {
  const liste = await lies(app, kopf, "/api/library/import/candidates");
  expect(liste.statusCode, liste.body).toBe(200);
  const kandidaten = (liste.json() as KandidatDto[]).filter((x) =>
    QUELLEN.some((q) => q.herkunft.externalId === x.item?.externalId),
  );
  const befunde = await lies(app, kopf, "/api/library/import/candidates/befunde");
  expect(befunde.statusCode, befunde.body).toBe(200);
  return {
    externalIds: kandidaten.map((x) => x.item?.externalId ?? "").sort(),
    body: liste.body,
    befundIds: (befunde.json() as { id: string }[]).map((b) => b.id).sort(),
    kandidatIds: kandidaten.map((x) => x.id).sort(),
  };
}

/** Der ganze Fall, einmal aufgebaut; die Prüfungen unten lesen nur. */
async function fallAufbauen() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: ROLLEN.verwaltung.name,
      email: ROLLEN.verwaltung.email,
      password: KENNWORT,
    },
  });
  const ada = await anmelden(app, ROLLEN.verwaltung.email);
  const personen = [
    ROLLEN.quellenpflege,
    ...ROLLEN.fachpruefung,
    ROLLEN.einkauf,
    ROLLEN.design,
  ] as const;
  for (const p of personen) {
    const res = await post(app, ada, "/api/users", {
      name: p.name,
      email: p.email,
      password: KENNWORT,
      role: p.rolle,
    });
    expect(res.statusCode, `Konto ${p.email}: ${res.body}`).toBe(201);
    // Wie in den Leserechte-Tests: die Leserliste der Quelle ersetzt das persönliche
    // Freigabeniveau nicht. Die lesenden Fachkonten bekommen das Niveau der beschränkten Stufe —
    // dann schließt allein die Quellenliste aus.
    if (p.rolle === "experte") {
      const niveau = await put(app, ada, `/api/users/${res.json().id}`, {
        freigabe: "vertraulich",
      });
      expect(niveau.statusCode, niveau.body).toBe(200);
    }
  }
  const k = {
    ada,
    carla: await anmelden(app, ROLLEN.quellenpflege.email),
    theo: await anmelden(app, ROLLEN.fachpruefung[0].email),
    uwe: await anmelden(app, ROLLEN.fachpruefung[1].email),
    vera: await anmelden(app, ROLLEN.fachpruefung[2].email),
    elena: await anmelden(app, ROLLEN.einkauf.email),
    dora: await anmelden(app, ROLLEN.design.email),
  };
  const kontenRes = await lies(app, k.carla, "/api/spaces/konten");
  expect(kontenRes.statusCode, kontenRes.body).toBe(200);
  const konten = kontenRes.json().konten as { id: string; name: string }[];
  const kontoId = (name: string): string => konten.find((x) => x.name === name)?.id ?? "";
  const pruefer = ROLLEN.fachpruefung.map((r) => kontoId(r.name));
  // Für das Protokoll: die tatsächlichen Kontokennungen aus der Nutzerverwaltung.
  const nutzer = (await lies(app, ada, "/api/users")).json() as { id: string; email: string }[];
  const fallrollen: [string, { name: string; email: string; rolle: string }][] = [
    ["verwaltung", ROLLEN.verwaltung],
    ["quellenpflege", ROLLEN.quellenpflege],
    ...ROLLEN.fachpruefung.map((r): [string, typeof r] => ["fachpruefung", r]),
    ["einkauf", ROLLEN.einkauf],
    ["design", ROLLEN.design],
  ];
  const rollenProtokoll = fallrollen.map(([fallrolle, r]) => ({
    fallrolle,
    name: r.name,
    produktrolle: r.rolle,
    konto: nutzer.find((u) => u.email === r.email)?.id ?? "",
  }));

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

  // Schritt 1 · Einlesen über den vorhandenen Bereichsimport: Quellrechte setzt allein der Server.
  const lauf = await runConfluenceImport({
    adapter: fiktiverBereich(QUELLEN.map(confluenceSeite)),
    library: services.library,
    koService: services.ko,
    dryRun: false,
    actor: kontoId(ROLLEN.quellenpflege.name),
  });
  const alleKandidaten = (
    await lies(app, k.carla, "/api/library/import/candidates")
  ).json() as KandidatDto[];
  const kandidatVon = (q: SollQuelle): KandidatDto | undefined =>
    alleKandidaten.find((x) => x.item?.externalId === q.herkunft.externalId);
  const nachEinlesen = {
    eingereiht: lauf.imported,
    kandidaten: QUELLEN.map((q) => ({
      status: kandidatVon(q)?.status,
      koId: kandidatVon(q)?.koId,
    })),
    wissen: ((await lies(app, k.carla, "/api/kos")).json() as KoDto[]).length,
  };

  // K06 · die Warteschlange VOR jeder Entscheidung, für alle drei eingeschränkten Konten.
  const vorEntscheidung = {
    dora: await warteschlangensicht(app, k.dora),
    elena: await warteschlangensicht(app, k.elena),
    ada: await warteschlangensicht(app, k.ada),
  };

  // Gegenprobe: die Verwaltung (admin, `ko.validate`) steht in keiner Seitenrestriktion — sie kann
  // einen Designkandidaten weder annehmen noch von ihm erfahren.
  const d3Kandidat = kandidatVon(quelle("BES-PX17-D3"));
  const d3Adresse = `/api/library/import/candidates/${d3Kandidat?.id}`;
  const adminAnnahme = await put(app, k.ada, d3Adresse, { action: "accept" });
  const d3NachAdminVersuch = (
    await lies(app, k.carla, "/api/library/import/candidates")
  ).json() as KandidatDto[];

  // Schritt 2 · Entscheidung je Kandidat nach dem VORAB benannten Sollurteil.
  const entscheidung = new Map<string, KandidatDto>();
  for (const q of QUELLEN) {
    const kandidat = kandidatVon(q);
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
  const prueferKoepfe = [
    { kopf: k.theo, konto: pruefer[0] ?? "" },
    { kopf: k.uwe, konto: pruefer[1] ?? "" },
    { kopf: k.vera, konto: pruefer[2] ?? "" },
  ];
  const freigaben = new Map<string, { konto: string; status: number }[]>();
  for (const q of angenommen) {
    const benoetigt = nachAnnahme.get(q.quellId)?.neededValidations ?? 0;
    expect(benoetigt, q.quellId).toBeGreaterThanOrEqual(1);
    expect(benoetigt, q.quellId).toBeLessThanOrEqual(prueferKoepfe.length);
    const schritte: { konto: string; status: number }[] = [];
    for (const { kopf, konto } of prueferKoepfe.slice(0, benoetigt)) {
      const res = await put(app, kopf, `/api/kos/${koIdVon(q.quellId)}`, {
        action: "rate",
        verdict: "up",
      });
      expect(res.statusCode, `${q.quellId}: ${res.body}`).toBe(200);
      schritte.push({ konto, status: res.statusCode });
    }
    freigaben.set(q.quellId, schritte);
  }
  const nachPruefung = new Map<string, KoDto>();
  for (const q of angenommen) {
    nachPruefung.set(q.quellId, await stand(q.quellId));
  }

  // K06 · die Warteschlange NACH den Entscheidungen — dieselbe Grenze.
  const nachEntscheidung = {
    dora: await warteschlangensicht(app, k.dora),
    elena: await warteschlangensicht(app, k.elena),
    ada: await warteschlangensicht(app, k.ada),
  };

  const protokoll = {
    sollbestand: SOLLBESTAND_FASSUNG,
    art: "Agentenprobe (automatisiert), keine menschliche Bedienung",
    instanz:
      "In-Memory: buildServices()/buildApp(), ohne Modell, ohne Netz; Confluence-Antworten aus der Testinstanz dieses Falls",
    quellweg:
      "runConfluenceImport (fiktiver Confluence-Bereich PX17, serverseitige Quellrechte) → PUT /api/library/import/candidates/:id → POST /api/spaces/verschiebung → PUT /api/kos/:id action=rate",
    eingereiht: lauf.imported,
    rollen: rollenProtokoll,
    bereiche,
    quellen: QUELLEN.map((q) => ({
      quellId: q.quellId,
      fassung: q.fassung,
      quelle: {
        provider: q.herkunft.provider,
        externalId: q.herkunft.externalId,
        sourceVersion: q.herkunft.sourceVersion,
        url: q.herkunft.url,
      },
      bereich: q.bereich,
      sollurteil: q.sollurteil,
      kandidatId: kandidatVon(q)?.id ?? null,
      entscheidung: { aktion: q.annahme, status: entscheidung.get(q.quellId)?.status ?? null },
      koId: entscheidung.get(q.quellId)?.koId ?? null,
      nachAnnahme: nachAnnahme.has(q.quellId)
        ? {
            status: nachAnnahme.get(q.quellId)?.status,
            trust: nachAnnahme.get(q.quellId)?.trust,
            origin: nachAnnahme.get(q.quellId)?.origin,
          }
        : null,
      freigaben: freigaben.get(q.quellId) ?? [],
      endstand: nachPruefung.get(q.quellId)?.status ?? null,
    })),
    negativ: {
      verwaltungNimmtDesignkandidatAn: {
        kandidatId: d3Kandidat?.id ?? null,
        status: adminAnnahme.statusCode,
        kandidatDanach: d3NachAdminVersuch.find((x) => x.id === d3Kandidat?.id)?.status ?? null,
      },
      verwaltungBewertetDesignwissen: {
        koId: koIdVon("BES-PX17-D3"),
        status: adminFreigabe.statusCode,
      },
    },
    warteschlange: {
      vorEntscheidung: {
        dora: vorEntscheidung.dora.externalIds,
        elena: vorEntscheidung.elena.externalIds,
        verwaltung: vorEntscheidung.ada.externalIds,
      },
      nachEntscheidung: {
        dora: nachEntscheidung.dora.externalIds,
        elena: nachEntscheidung.elena.externalIds,
        verwaltung: nachEntscheidung.ada.externalIds,
      },
    },
  };

  return {
    app,
    k,
    bereiche,
    nachEinlesen,
    vorEntscheidung,
    nachEntscheidung,
    adminAnnahme,
    d3Kandidat,
    d3NachAdminVersuch,
    entscheidung,
    koIdVon,
    nachAnnahme,
    nachPruefung,
    adminFreigabe,
    protokoll,
  };
}

type Fall = Awaited<ReturnType<typeof fallAufbauen>>;

const ANGENOMMEN = QUELLEN.filter((q) => q.annahme === "accept").map((q) => q.quellId);
const NICHT_ANGENOMMEN = QUELLEN.filter((q) => q.annahme !== "accept").map((q) => q.quellId);
/** Seitenkennungen je Bereich — über ALLE Sollquellen, nicht nur die angenommenen. */
const SEITEN = (bereich: SollQuelle["bereich"]): string[] =>
  QUELLEN.filter((q) => q.bereich === bereich).map((q) => q.herkunft.externalId);

describe("BES-01 · der Sollbestand selbst (vorab festgelegt, versioniert, fiktiv)", () => {
  it("K01: der Fall ist dem offenen historischen Vertrag zugeordnet, seine Originalkriterien wörtlich", () => {
    expect(SOLLBESTAND_FASSUNG).toBe("BES-01-SOLL-v2");
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
    const istVorgabeseite = (q: SollQuelle) => q.herkunft.ablage === "vorgabeseite";
    const pflicht: [string, (q: SollQuelle) => boolean][] = [
      ["Produktblatt", (q) => q.art === "produktblatt"],
      ["freigegebenes Design", (q) => q.art === "design" && q.freigabestand === "freigegeben"],
      ["Entwurfsdesign", (q) => q.art === "design" && q.freigabestand === "entwurf"],
      ["Confluence-Vorgabe", (q) => q.art === "vorgabe" && istVorgabeseite(q)],
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

  it("K06: die Bereichsleser stehen an der Quelle — Design und Einkauf schließen sich aus", () => {
    expect(BEREICHSLESER.offen).toBeNull();
    expect(BEREICHSLESER.design).toContain(ROLLEN.design.email);
    expect(BEREICHSLESER.design).not.toContain(ROLLEN.einkauf.email);
    expect(BEREICHSLESER.lieferanten).toContain(ROLLEN.einkauf.email);
    expect(BEREICHSLESER.lieferanten).not.toContain(ROLLEN.design.email);
    for (const leser of [BEREICHSLESER.design, BEREICHSLESER.lieferanten]) {
      expect(leser).not.toContain(ROLLEN.verwaltung.email);
    }
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
    expect(fall.nachEinlesen.eingereiht).toBe(QUELLEN.length);
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
    // Weder am Kandidaten …
    expect(fall.adminAnnahme.statusCode, fall.adminAnnahme.body).toBe(404);
    expect(fall.adminAnnahme.body).not.toContain(quelle("BES-PX17-D3").titel);
    const d3 = fall.d3NachAdminVersuch.find((x) => x.id === fall.d3Kandidat?.id);
    expect(d3?.status, "der Versuch der Verwaltung hat den Kandidaten entschieden").toBe("neu");
    // … noch am Wissen.
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

  it("K06: die Prüfwarteschlange zeigt vor und nach den Entscheidungen nur Erlaubtes — auch keine Zahl", () => {
    const erlaubt = {
      dora: [...SEITEN("offen"), ...SEITEN("design")].sort(),
      elena: [...SEITEN("offen"), ...SEITEN("lieferanten")].sort(),
      ada: [...SEITEN("offen")].sort(),
    };
    const fremd = {
      dora: QUELLEN.filter((q) => q.bereich === "lieferanten"),
      elena: QUELLEN.filter((q) => q.bereich === "design"),
      ada: QUELLEN.filter((q) => q.bereich !== "offen"),
    };
    for (const [phase, sichten] of [
      ["vor den Entscheidungen", fall.vorEntscheidung],
      ["nach den Entscheidungen", fall.nachEntscheidung],
    ] as const) {
      for (const wer of ["dora", "elena", "ada"] as const) {
        const sicht = sichten[wer];
        // Genau die erlaubten Kandidaten — nicht mehr und nicht weniger.
        expect(sicht.externalIds, `${wer} ${phase}`).toEqual(erlaubt[wer]);
        // Kein fremder Titel und kein fremder Inhalt im Rohkörper.
        for (const q of fremd[wer]) {
          expect(sicht.body, `${wer} ${phase}: Titel ${q.quellId}`).not.toContain(q.titel);
          expect(sicht.body, `${wer} ${phase}: Inhalt ${q.quellId}`).not.toContain(q.aussage);
        }
        // Keine verdeckte Trefferzahl: die Befunde zählen genau die sichtbaren Kandidaten.
        expect(sicht.befundIds, `${wer} ${phase}: Befunde`).toEqual(sicht.kandidatIds);
      }
    }
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
    // „gib mir Leserecht auf alle Designs“: die Einkaufsrolle sieht den Designkandidaten weiterhin nicht.
    expect(fall.nachEntscheidung.elena.externalIds).not.toContain(
      quelle("BES-PX17-D3").herkunft.externalId,
    );
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

  it("BES-S01/S02 · Ergebnisprotokoll mit tatsächlichen Kennungen in den Prüfbericht", ({
    task,
  }) => {
    const p = fall.protokoll;
    // Das Protokoll trägt die TATSÄCHLICHEN Kennungen dieses Laufs — keine Sollwerte.
    for (const zeile of p.quellen) {
      expect(zeile.kandidatId, zeile.quellId).toBeTruthy();
      expect(zeile.entscheidung.status, zeile.quellId).toBeTruthy();
      if (zeile.entscheidung.aktion === "accept") {
        expect(zeile.koId, zeile.quellId).toBeTruthy();
        expect(zeile.endstand, zeile.quellId).toBe("validiert");
        expect(zeile.freigaben.length, zeile.quellId).toBeGreaterThanOrEqual(1);
        expect(new Set(zeile.freigaben.map((f) => f.konto)).size).toBe(zeile.freigaben.length);
      } else {
        expect(zeile.koId, zeile.quellId).toBeNull();
        expect(zeile.freigaben, zeile.quellId).toEqual([]);
      }
    }
    expect(new Set(p.quellen.map((z) => z.kandidatId)).size).toBe(QUELLEN.length);
    expect(p.rollen.every((r) => r.konto.length > 0)).toBe(true);
    expect(p.negativ.verwaltungNimmtDesignkandidatAn).toMatchObject({
      status: 404,
      kandidatDanach: "neu",
    });
    expect(p.negativ.verwaltungBewertetDesignwissen.status).toBe(404);
    // Gesichert wird über den nativen Bericht, den der Prüfadapter kandidatgebunden archiviert.
    (task.meta as unknown as Record<string, unknown>).besErgebnisprotokoll = p;
  });
});
