import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { KoSource } from "../../services/knowledge-object";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  FRISTEN_PRUEFSTAND,
  type FristenRegel,
  verarbeiteFristenQuelle,
} from "../../services/app/src/klara-fristen";
import { erkenneFristen, type FristenQuelle } from "../../services/app/src/klara-fristen-erkennung";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";

let s: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let ich: Konto;
let kid: string;
const TEXT = "Lizenz L-17: Ablaufdatum 2027-04-30.";
const AM = "2026-10-20T08:00:00Z";
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(AM));
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  s = assembleServices(inMemoryRepos());
  app = buildApp(s);
  const admin = await neuesKonto(app, "aw19-import-admin");
  ich = await neuesKonto(app, "aw19-import-expert", admin);
  kid = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
});
afterEach(async () => {
  await app.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function anker(over: Partial<KoSource> = {}): KoSource {
  return {
    id: crypto.randomUUID(),
    label: "Fiktive importierte Lizenz",
    url: "https://fiktiv.invalid/doc",
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    externalId: "doc-17",
    sourceVersion: 7,
    sourceRecordId: "fiktive-revision-7",
    author: kid,
    at: AM,
    ...over,
  };
}
// Kontrollierte bereits gespeicherte serverseitige Importanker. Kein Providerabruf/Importmodell.
function ko(sources = [anker()], statement = TEXT) {
  return s.ko.create({
    title: "Identischer fiktiver Titel",
    statement,
    type: "technik",
    category: "Importidentitätsprobe",
    author: kid,
    confidentiality: "intern",
    importedVia: "import_candidate",
    sources,
  });
}
function regel(ids: string[]): FristenRegel {
  return {
    aktiv: true,
    quellen: ids.map((id) => ({ art: "wissensobjekt", id })),
    arten: ["ablauf"],
    bereich: "persoenlich",
    zeitzone: "Europe/Berlin",
    aenderung: "aktualisieren",
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: FRISTEN_PRUEFSTAND,
  };
}
const api = (method: "GET" | "POST" | "PUT", path = "", payload?: Record<string, unknown>) =>
  app.inject({
    method,
    url: `/api/me/klara/fristen${path}`,
    headers: ich.kopf,
    ...(payload ? { payload } : {}),
  });
async function setzen(ids: string[]) {
  const alt = (await api("GET")).json();
  const r = await api("PUT", "/regel", { fassung: alt.fassung, regel: regel(ids) });
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}
const kalender = async () =>
  (await app.inject({ url: "/api/me/kalender", headers: ich.kopf })).json().eintraege;

it("AW19-K05 Import · dieselbe Provider-/Objektidentität erhält Original-ID und Ablehnung trotz anderer KO-/Anker-/Revisionskennung", async () => {
  const a = await ko();
  const f = (await setzen([a.id])).fristen[0];
  expect(
    (await api("POST", `/${f.id}/aktion`, { fassung: f.fassung, aktion: "verwerfen" })).statusCode,
  ).toBe(200);
  const kopie = await ko([
    anker({ provider: " confluence ", sourceRecordId: "andere-interne-revisionskennung" }),
  ]);
  const neu = await setzen([kopie.id, a.id]);
  expect(neu.fristen).toHaveLength(1);
  expect(neu.fristen[0]).toMatchObject({ id: f.id, stand: "verworfen" });
  expect(neu.fristen[0].ablehnungen).toHaveLength(1);
  expect(neu.fristen[0].herkunft.filter((h: { aktuell: boolean }) => h.aktuell)).toHaveLength(2);
  expect(
    new Set(
      neu.fristen[0].herkunft.map(
        (h: { beleg: { fingerabdruck: string } }) => h.beleg.fingerabdruck,
      ),
    ).size,
  ).toBe(1);
  expect(await kalender()).toEqual([]);
  expect((await api("POST", "/aktualisieren")).json()).toEqual(neu);
});

it.each([
  [
    { provider: "Confluence", externalId: "doc-17" },
    { provider: "Confluence", externalId: "doc-18" },
  ],
  [
    { provider: "Confluence", externalId: "doc-17" },
    { provider: "Jira", externalId: "doc-17" },
  ],
  [
    { provider: "test::tenant", externalId: "17" },
    { provider: "test", externalId: "tenant::17" },
  ],
])(
  "AW19-K05 Import · verschiedene tatsächliche Importobjekte trotz identischem Titel/Text/Datum und Trennzeichen getrennt %j",
  async (aa, bb) => {
    const a = await ko([anker(aa)]);
    const b = await ko([anker(bb)]);
    const stand = await setzen([a.id, b.id]);
    expect(stand.fristen).toHaveLength(2);
    expect(new Set(stand.fristen.map((f: { id: string }) => f.id)).size).toBe(2);
    expect(await kalender()).toHaveLength(2);
    const f = stand.fristen[0];
    await api("POST", `/${f.id}/aktion`, { fassung: f.fassung, aktion: "verwerfen" });
    const neu = (await api("POST", "/aktualisieren")).json();
    expect(neu.fristen.filter((f: { stand: string }) => f.stand === "verworfen")).toHaveLength(1);
    expect(await kalender()).toHaveLength(1);
  },
);

it.each(["provider", "objekt", "fassung", "mehrere"] as const)(
  "AW19-K05 Import · fehlende/mehrdeutige %s bleibt offen ohne Gleichtext-Zusammenlegung",
  async (art) => {
    const unvollstaendig = anker();
    if (art === "provider") unvollstaendig.provider = null;
    if (art === "objekt") delete unvollstaendig.externalId;
    if (art === "fassung") delete unvollstaendig.sourceVersion;
    const sources =
      art === "mehrere" ? [anker(), anker({ externalId: "doc-18" })] : [unvollstaendig];
    const a = await ko(sources);
    const b = await ko(sources);
    const stand = await setzen([a.id, b.id]);
    expect(stand.fristen).toHaveLength(2);
    for (const f of stand.fristen) {
      expect(f.stand).toBe("klaerung");
      expect(f.klaerung).toContain("importidentitaet_unklar");
      expect(f.datum).toBeNull();
    }
    expect(await kalender()).toEqual([]);
  },
);

it.each(["verworfen", "manuell"] as const)(
  "AW19-K05 Import · neuere relevante Revision wahrt %s und alte Kopie setzt sie nicht zurück",
  async (art) => {
    const a = await ko();
    const f = (await setzen([a.id])).fristen[0];
    const eventId = (await kalender())[0].id;
    const aktion = await api("POST", `/${f.id}/aktion`, {
      fassung: f.fassung,
      aktion: art === "verworfen" ? "verwerfen" : "korrigieren",
      datum: { art: "datum", datum: "2027-06-30" },
    });
    expect(aktion.statusCode, aktion.body).toBe(200);
    const alt = await ko([anker({ sourceVersion: 6, sourceRecordId: "alte-quellrevision" })]);
    const neu = await ko(
      [anker({ sourceVersion: 8, sourceRecordId: "neue-quellrevision" })],
      "Lizenz L-17: Ablaufdatum 2027-05-30.",
    );
    const stand = await setzen([neu.id, alt.id, a.id]);
    expect(stand.fristen).toHaveLength(1);
    expect(stand.fristen[0]).toMatchObject({ id: f.id, stand: "klaerung" });
    expect(stand.fristen[0].klaerung).toContain("relevante_quellaenderung");
    expect(
      stand.fristen[0].herkunft
        .filter((h: { aktuell: boolean }) => h.aktuell)
        .map((h: { beleg: { quelle: { id: string } } }) => h.beleg.quelle.id),
    ).toEqual([neu.id]);
    if (art === "verworfen") expect(await kalender()).toEqual([]);
    else {
      expect(stand.fristen[0]).toMatchObject({ datum: { datum: "2027-06-30" }, manuell: true });
      expect((await kalender())[0]).toMatchObject({ id: eventId, beginn: "2027-06-30" });
    }
    expect((await api("POST", "/aktualisieren")).json()).toEqual(stand);
  },
);

it("AW19-K05 Import · vorhandene alte KO-Frist behält Original-ID/Ablehnung beim ersten kanonischen Kopienabgleich", async () => {
  const a = await ko();
  const kopie = await ko();
  const q: FristenQuelle = {
    art: "wissensobjekt",
    id: a.id,
    fassung: String(a.version),
    belegId: `ko:${a.id}`,
    text: TEXT,
    verantwortlich: null,
  };
  const alterStand = verarbeiteFristenQuelle(
    { kontoId: kid, fassung: 0, fristen: [], regel: regel([a.id]) },
    q,
    erkenneFristen(q),
    AM,
  );
  expect(await s.klaraFristen.speichere(alterStand, 0)).toBe(true);
  const f = alterStand.fristen[0];
  if (!f) throw new Error("Altes Original fehlt");
  expect(
    (await api("POST", `/${f.id}/aktion`, { fassung: f.fassung, aktion: "verwerfen" })).statusCode,
  ).toBe(200);
  const stand = await setzen([kopie.id, a.id]);
  expect(stand.fristen).toHaveLength(1);
  expect(stand.fristen[0]).toMatchObject({
    id: f.id,
    stand: "verworfen",
    angelegtAm: f.angelegtAm,
  });
  expect(stand.fristen[0].herkunft.length).toBeGreaterThan(1);
  expect(await kalender()).toEqual([]);
});
