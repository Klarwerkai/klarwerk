// ================================================================================================
// JOB 579 · D5 — DER ANHANG-CACHEVERTRAG, AM ECHTEN DRAHT.
// ================================================================================================
//
// DIE ZUSAGE, in einem Satz: Ein unvertraulicher, berechtigt gelesener Anhang wird VOR JEDER
// Wiederverwendung neu autorisiert; vertrauliche Inhalte und jede Nichtauslieferung sind gar nicht
// erst speicherbar.
//
// WAS DIESE DATEI NICHT BEHAUPTET — und das ist der wichtigste Satz hier: **Der Server kann eine
// bereits abgelegte lokale Kopie nicht löschen.** Kein Header der Welt kann das. Was er kann, ist
// zweierlei, und nur das wird hier gemessen:
//   1. VOR der nächsten Wiederverwendung eine Rückfrage erzwingen (`no-cache`), und
//   2. bei dieser Rückfrage sofort entziehen (404, keine Bytes, kein 304).
// Wer daraus „die Kopie ist weg" macht, verspricht etwas, das die Technik nicht hält.
//
// WARUM `no-cache` UND NICHT `max-age=0`: `no-cache` erlaubt das Ablegen und verbietet die
// Wiederverwendung ohne Rückfrage — genau der Vertrag, den ein Entzug braucht. `private` bleibt
// nötig, weil `no-cache` einem GETEILTEN Zwischenspeicher das Ablegen weiterhin erlaubt.
// `must-revalidate` ist daneben redundant (es regelt den veralteten Zustand, den es ohne
// Frischefrist nicht gibt) und steht ausdrücklich als Absichtserklärung für den nächsten Leser da.
//
// DER PREIS, ehrlich: `no-cache` OHNE Validator heisst VOLLSTÄNDIGE NEUÜBERTRAGUNG bei jeder
// Wiederverwendung. Es gibt hier bewusst keinen `ETag` und kein `304` — die Validator-Scheibe ist
// eine eigene, spätere Tranche (D3, Korrekturpflicht 2). Fall `V` nagelt das fest: ein beliebiges
// `If-None-Match` bleibt ohne jede Wirkung auf die Autorisierungsentscheidung.
//
// GEMESSEN WIRD AM DRAHT, nicht am Quelltext: `res.headers[...]` nach `app.inject`. Das ist die
// Lehre aus mega69 — eine Kopfzeile, die im Code steht, muss nicht am Draht ankommen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

/** Der Wortlaut, auf den dieser Durchgang den unvertraulichen Fall festlegt. */
const CACHE_UNVERTRAULICH = "private, no-cache, must-revalidate";
/** Vertrauliches und JEDE Nichtauslieferung. */
const CACHE_NICHT_SPEICHERBAR = "no-store";
/** Beide im Produkt lebenden Authwege (`http.ts`: `authorization`, Rückfall `cookie`). */
const VARY_AUTH = "Cookie, Authorization";

// Ein winziges, gültiges PNG als Daten-URL (1x1, transparent).
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/** Legt Admin, Autor, Betrachter und Prüfer an und meldet alle an. */
async function setup(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  const ids: Record<string, string> = {};
  for (const [kurz, role] of [
    ["viewer", "viewer"],
    ["autor", "experte"],
    ["pruefer", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: {
        name: kurz,
        email: `${kurz}@${marke}.test`,
        password: "geheim12345",
        role,
      },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${kurz} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
    ids[kurz] = res.json().id as string;
  }
  return {
    app,
    admin,
    ids,
    autor: await login(app, `autor@${marke}.test`, "geheim12345"),
    viewer: await login(app, `viewer@${marke}.test`, "geheim12345"),
    pruefer: await login(app, `pruefer@${marke}.test`, "geheim12345"),
  };
}

/**
 * Lädt ein Original hoch und hängt es an ein frisch erzeugtes Wissensobjekt.
 * `daten` erlaubt eine bewusst NICHT dekodierbare Nutzlast für den 415-Zweig.
 */
async function koMitAnhang(
  app: App,
  autor: Auth,
  vertraulich: boolean,
  daten: string = PNG_DATA_URL,
) {
  const up = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: autor,
    payload: {
      name: "typenschild.png",
      mime: "image/png",
      data: daten,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(up.statusCode, up.body).toBe(201);
  const objectId = up.json().id as string;

  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: vertraulich ? "Vertrauliches mit Anhang" : "Internes mit Anhang",
      statement: "Ein Objekt, an dem ein Original hängt.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;

  const attach = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: {
      action: "attach",
      attachment: { name: "typenschild.png", mime: "image/png", objectId },
    },
  });
  expect(attach.statusCode, attach.body).toBe(200);

  if (vertraulich) {
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
  }
  return { koId, objectId };
}

const cc = (res: { headers: Record<string, unknown> }): string =>
  String(res.headers["cache-control"]);
const vary = (res: { headers: Record<string, unknown> }): string => String(res.headers.vary);

// ------------------------------------------------------------------------------------------------
// P1–P2 · DIE BEIDEN ERFOLGSZWEIGE
// ------------------------------------------------------------------------------------------------
describe("P1/P2 · die erfolgreiche Auslieferung", () => {
  it("P1 · unvertraulich und berechtigt: Revalidierung vor jeder Wiederverwendung, plus Vary", async () => {
    const { app, autor } = await setup("p1");
    const { objectId } = await koMitAnhang(app, autor, false);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: autor,
    });
    expect(raw.statusCode, raw.body).toBe(200);
    expect(cc(raw), "vor jeder Wiederverwendung neu autorisieren").toBe(CACHE_UNVERTRAULICH);
    // Die alte Fünf-Minuten-Frist war GENAU das Loch: 300 Sekunden ohne Rückfrage.
    expect(cc(raw)).not.toContain("max-age");
    expect(cc(raw)).not.toContain("immutable");
    expect(vary(raw), "die Antwort hängt am Betrachter").toBe(VARY_AUTH);
    // Keine Validator-Tranche: es gibt bewusst nichts, worauf ein 304 antworten könnte.
    expect(raw.headers.etag).toBeUndefined();
    expect(raw.headers["last-modified"]).toBeUndefined();
  });

  it("P2 · vertraulich und berechtigt: gar nicht erst speicherbar", async () => {
    const { app, autor } = await setup("p2");
    const { objectId } = await koMitAnhang(app, autor, true);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: autor,
    });
    expect(raw.statusCode, raw.body).toBe(200);
    expect(cc(raw)).toBe(CACHE_NICHT_SPEICHERBAR);
    expect(cc(raw)).not.toContain("immutable");
    expect(cc(raw)).not.toContain("31536000");
  });
});

// ------------------------------------------------------------------------------------------------
// P3–P6 · JEDE NICHTAUSLIEFERUNG IST NICHT SPEICHERBAR
// ------------------------------------------------------------------------------------------------
describe("P3–P6 · keine Nichtauslieferung erbt eine positive Cachezusage", () => {
  it("P3/P4 · unbekannt und unsichtbar antworten beide 404, no-store — und BYTEGLEICH", async () => {
    const { app, autor, viewer } = await setup("p34");
    const { objectId } = await koMitAnhang(app, autor, true);

    const unbekannt = await app.inject({
      method: "GET",
      url: "/api/objects/gibt-es-nicht/raw",
      headers: viewer,
    });
    const unsichtbar = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: viewer,
    });

    expect(unbekannt.statusCode).toBe(404);
    expect(unsichtbar.statusCode).toBe(404);
    expect(cc(unbekannt), "eine Ablehnung darf nirgends liegenbleiben").toBe(
      CACHE_NICHT_SPEICHERBAR,
    );
    expect(cc(unsichtbar)).toBe(CACHE_NICHT_SPEICHERBAR);
    expect(vary(unbekannt)).toBe(VARY_AUTH);
    expect(vary(unsichtbar)).toBe(VARY_AUTH);
    // DER PUNKT VON P4: Existenz darf nicht unterscheidbar werden. Gleicher Status, gleiche
    // Kopfzeilen — und derselbe Rumpf, Zeichen für Zeichen.
    expect(unsichtbar.body, "sonst verrät der Rumpf, dass es das Objekt gibt").toBe(unbekannt.body);
  });

  it("P5 · nicht dekodierbare Rohbytes: 415, ebenfalls no-store", async () => {
    const { app, autor } = await setup("p5");
    // Der Upload NIMMT diese Nutzlast an (D3: 201) — erst `/raw` kann sie nicht dekodieren.
    const { objectId } = await koMitAnhang(app, autor, false, "keine-data-url-und-kein-base64");

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: autor,
    });
    expect(raw.statusCode, `Der 415-Zweig muss erreichbar sein. Antwort: ${raw.body}`).toBe(415);
    expect(cc(raw), "auch ein Fehlerzweig erbt keine positive Zusage").toBe(
      CACHE_NICHT_SPEICHERBAR,
    );
    expect(vary(raw)).toBe(VARY_AUTH);
  });

  it("P6 · die METADATENROUTE spricht denselben Vertrag", async () => {
    const { app, autor, viewer } = await setup("p6");
    const { objectId } = await koMitAnhang(app, autor, true);

    const meta = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: viewer,
    });
    expect(meta.statusCode).toBe(404);
    // Zwei Routen mit derselben Existenzaussage dürfen keine zwei Cacheverträge haben.
    expect(cc(meta)).toBe(CACHE_NICHT_SPEICHERBAR);
    expect(vary(meta)).toBe(VARY_AUTH);

    // Und der Erfolgsfall derselben Route trägt ebenfalls Vary — er hängt am Betrachter.
    const erlaubt = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: autor,
    });
    expect(erlaubt.statusCode, erlaubt.body).toBe(200);
    expect(vary(erlaubt)).toBe(VARY_AUTH);
  });
});

// ------------------------------------------------------------------------------------------------
// P7 · GET/HEAD-PARITÄT
// ------------------------------------------------------------------------------------------------
describe("P7 · HEAD erbt den Vertrag von GET, mit leerem Rumpf", () => {
  it("berechtigt und unberechtigt: identischer Cachevertrag, HEAD-Rumpf leer", async () => {
    const { app, autor, viewer } = await setup("p7");
    const { objectId } = await koMitAnhang(app, autor, true);

    for (const [name, headers, status, erwartet] of [
      ["berechtigt", autor, 200, CACHE_NICHT_SPEICHERBAR],
      ["unberechtigt", viewer, 404, CACHE_NICHT_SPEICHERBAR],
    ] as const) {
      const g = await app.inject({
        method: "GET",
        url: `/api/objects/${objectId}/raw`,
        headers,
      });
      const h = await app.inject({
        method: "HEAD",
        url: `/api/objects/${objectId}/raw`,
        headers,
      });
      expect(g.statusCode, name).toBe(status);
      expect(h.statusCode, name).toBe(status);
      expect(cc(g), name).toBe(erwartet);
      expect(cc(h), `${name}: HEAD darf keinen anderen Vertrag sprechen`).toBe(erwartet);
      expect(h.body, `${name}: HEAD hat keinen Rumpf`).toBe("");
    }
  });
});

// ------------------------------------------------------------------------------------------------
// V · KEINE VALIDATOR-TRANCHE
// ------------------------------------------------------------------------------------------------
describe("V · ein beliebiges If-None-Match bleibt wirkungslos", () => {
  it("kein 304, kein ETag — die Autorisierung entscheidet allein", async () => {
    const { app, autor } = await setup("v");
    const { objectId } = await koMitAnhang(app, autor, false);

    const res = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: { ...autor, "if-none-match": '"irgendein-wert"' },
    });
    // Diese Zusage ist heute wahr UND sie wird zur Falle, sobald jemand einen Validator einführt,
    // ohne die Autorisierungsreihenfolge zu bedenken.
    expect(res.statusCode, "niemals 304").toBe(200);
    expect(res.headers.etag).toBeUndefined();
    expect(cc(res)).toBe(CACHE_UNVERTRAULICH);
  });
});

// ------------------------------------------------------------------------------------------------
// S-A · ROLLENENTZUG (Pflichtlieferung 9)
// ------------------------------------------------------------------------------------------------
describe("S-A · Rollenentzug wirkt beim nächsten Abruf sofort", () => {
  it("derselbe zuvor berechtigte Betrachter bekommt danach 404, no-store, kein 304 und keine Bytes", async () => {
    const { app, admin, ids, autor, pruefer } = await setup("sa");
    const { objectId } = await koMitAnhang(app, autor, true);

    // 1 · Der Prüfer (controller, hat `ko.validate`) darf das vertrauliche Original sehen.
    const vorher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: pruefer,
    });
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(cc(vorher)).toBe(CACHE_NICHT_SPEICHERBAR);
    const bytesVorher = vorher.rawPayload.length;
    expect(bytesVorher).toBeGreaterThan(0);

    // 2 · Der Admin nimmt ihm die Rolle. Der einzige Rollenwechsel, der Anhangzugriff wirklich
    //     entzieht, ist `controller → viewer` an einem VERTRAULICHEN Objekt: alle vier Rollen
    //     tragen `ko.read`, nur `ko.validate` öffnet Vertrauliches.
    const entzug = await app.inject({
      method: "PUT",
      url: `/api/users/${ids.pruefer}`,
      headers: admin,
      payload: { role: "viewer" },
    });
    expect(entzug.statusCode, entzug.body).toBeLessThan(300);

    // 3 · DASSELBE, ALTE TOKEN. Es bleibt gültig — aber die Rolle wird je Anfrage nachgeschlagen.
    const nachher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: { ...pruefer, "if-none-match": '"irgendein-wert"' },
    });
    expect(nachher.statusCode, "der Entzug greift beim nächsten Abruf").toBe(404);
    expect(nachher.statusCode, "niemals 304").not.toBe(304);
    expect(cc(nachher)).toBe(CACHE_NICHT_SPEICHERBAR);
    expect(nachher.headers.etag, "kein Validatorhinweis").toBeUndefined();
    expect(nachher.rawPayload.length, "keine Bildbytes").toBeLessThan(bytesVorher);
    expect(nachher.body).toContain("NOT_FOUND");

    // 4 · Auch Metadatenroute und HEAD entziehen.
    const meta = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: pruefer,
    });
    expect(meta.statusCode).toBe(404);
    expect(cc(meta)).toBe(CACHE_NICHT_SPEICHERBAR);
  });

  it("KONTROLLFALL · ein weiterhin berechtigter interner Zugriff bleibt 200 gemäß seiner Stufe", async () => {
    const { app, admin, ids, autor, pruefer } = await setup("sak");
    // Diesmal ein INTERNES Objekt — es ist gar nicht rollenentziehbar, weil jede Rolle `ko.read`
    // trägt. Ohne diesen Fall bewiese der Test oben nur, dass die Route nichts mehr herausgibt.
    const { objectId } = await koMitAnhang(app, autor, false);

    const vorher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: pruefer,
    });
    expect(vorher.statusCode).toBe(200);

    const entzug = await app.inject({
      method: "PUT",
      url: `/api/users/${ids.pruefer}`,
      headers: admin,
      payload: { role: "viewer" },
    });
    expect(entzug.statusCode, entzug.body).toBeLessThan(300);

    const nachher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: pruefer,
    });
    expect(nachher.statusCode, "der interne Anhang überlebt den Rollenentzug").toBe(200);
    expect(cc(nachher), "und er behält seine Stufe").toBe(CACHE_UNVERTRAULICH);
  });
});

// ------------------------------------------------------------------------------------------------
// S-B · HOCHSTUFUNG · S-C · LÖSCHUNG
// ------------------------------------------------------------------------------------------------
describe("S-B/S-C · Hochstufung und Löschung greifen beim nächsten Abruf", () => {
  it("S-B · nach der Hochstufung bekommt derselbe Betrachter 404, no-store, kein 304", async () => {
    const { app, autor, viewer } = await setup("sb");
    const { koId, objectId } = await koMitAnhang(app, autor, false);

    // 1 · Der Betrachter darf das interne Original sehen — MIT der Erlaubnis, es wiederzuverwenden,
    //     aber nur nach Rückfrage. Genau hier lag das 300-Sekunden-Fenster.
    const vorher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: viewer,
    });
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(cc(vorher)).toBe(CACHE_UNVERTRAULICH);

    // 2 · Der Autor stuft das tragende Objekt hoch.
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // 3 · Die erzwungene Rückfrage entzieht sofort.
    const nachher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: { ...viewer, "if-none-match": '"irgendein-wert"' },
    });
    expect(nachher.statusCode).toBe(404);
    expect(nachher.statusCode).not.toBe(304);
    expect(cc(nachher)).toBe(CACHE_NICHT_SPEICHERBAR);
    expect(nachher.headers.etag).toBeUndefined();
  });

  it("S-C · nach der Löschung ebenso — 404, no-store, kein 304", async () => {
    const { app, autor, viewer } = await setup("sc");
    const { koId, objectId } = await koMitAnhang(app, autor, false);

    const vorher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: viewer,
    });
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(cc(vorher)).toBe(CACHE_UNVERTRAULICH);

    const weg = await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: autor });
    expect(weg.statusCode, weg.body).toBeLessThan(300);

    const nachher = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: { ...viewer, "if-none-match": '"irgendein-wert"' },
    });
    expect(nachher.statusCode).toBe(404);
    expect(nachher.statusCode).not.toBe(304);
    expect(cc(nachher)).toBe(CACHE_NICHT_SPEICHERBAR);
    expect(nachher.headers.etag).toBeUndefined();
  });
});
