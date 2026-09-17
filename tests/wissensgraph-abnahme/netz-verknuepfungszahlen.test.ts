// ================================================================================================
// JOB 4155 · WG-LUECKEN — L1, L2, L3: DIE KANTENAUSKUNFT KOMMT AM DRAHT AN.
// ================================================================================================
//
// DER AUSGANGSFEHLER, gemessen am Basisstand `e451f49` und der Grund für diese Datei: Die Route
// `GET /api/wissensnetz/luecken` fragt seit JOB 2600 `mitVerknuepfung: true` an
// (`services/wissensnetz/src/luecken-einstieg.ts`) — und übergab dem Lesemodell nie einen
// Kantenport. Die Antwort trug deshalb bei JEDER Anfrage nichts über Verknüpfungen: keine Zahlen
// UND keinen Hinweis darauf, dass gar nicht gezählt wurde. `sichtmetrik()` warf `verknuepft`,
// `unverknuepft`, `verknuepfungAusgelassen` und den Grund ersatzlos weg.
//
// WARUM DAS SCHLIMMER IST ALS EINE FEHLENDE ZAHL: Der Leser konnte „nachgesehen und nichts
// gefunden" nicht von „nie gefragt" unterscheiden. Genau gegen diese stille Differenz ist die
// Ebene darunter gebaut (`lesemodell-ports.ts:297-303`) — und genau sie ging beim Hochreichen
// verloren.
//
// GEMESSEN WIRD AM ECHTEN DRAHT, über `app.inject` gegen die vollständig gebaute App. Die drei
// Fälle sind bewusst an DERSELBEN Route: eine Funktion direkt zu rufen hätte die Verdrahtung —
// den eigentlichen Gegenstand dieses Auftrags — gar nicht berührt.
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { type KoRoutesDeps, koRoutes } from "../../services/app/src/routes/ko-routes";
import { type Buehne, type Rolle, baueBuehne, kopfFuer } from "../wissensgraph-integration/buehne";

let buehne: Buehne;

beforeEach(async () => {
  buehne = await baueBuehne();
});

afterEach(async () => {
  await buehne?.schliesse();
});

/** Die Antwortform der Netzroute, so weit diese Datei sie liest. */
interface ThemenZeile {
  thema: string;
  objekte: number;
  verknuepft?: number;
  unverknuepft?: number;
}
interface Netzantwort {
  themen: ThemenZeile[];
  verknuepfungAusgelassen?: boolean;
  verknuepfungAusgelassenGrund?: string;
}

/**
 * Ein Wissensobjekt MIT Schlagwort — das Thema ist die Achse, an der die Zähler hängen.
 * `neuesKo` aus der Bühne legt ohne Schlagwort an; ein themenloses Objekt steht in `ohneThema` und
 * in keiner Themenzeile, und diese Datei misst genau die Themenzeilen.
 */
async function koMitThema(
  titel: string,
  thema: string,
  over: { confidentiality?: "intern" | "vertraulich"; author?: string } = {},
): Promise<string> {
  const ko = await buehne.services.ko.create({
    title: titel,
    statement: `Aussage zu ${titel}`,
    type: "best_practice",
    category: "Betrieb",
    author: over.author ?? buehne.konto.controller.id,
    tags: [thema],
    ...(over.confidentiality ? { confidentiality: over.confidentiality } : {}),
  });
  return ko.id;
}

async function netz(rolle: Rolle = "controller"): Promise<Netzantwort> {
  const antwort = await buehne.app.inject({
    method: "GET",
    url: "/api/wissensnetz/luecken",
    headers: kopfFuer(buehne, rolle),
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as Netzantwort;
}

/** Eine Beziehung über den ECHTEN Schreibweg setzen — nicht am Bestand vorbei. */
async function verknuepfe(quelleId: string, zielId: string, marke: string): Promise<void> {
  const antwort = await buehne.app.inject({
    method: "POST",
    url: `/api/kos/${quelleId}/beziehungen`,
    headers: kopfFuer(buehne, "controller"),
    payload: {
      zielId,
      art: "ergaenzt",
      richtung: "ungerichtet",
      beitragSchluessel: marke,
      gesehen: { quelleVersion: 1, zielVersion: 1 },
    },
  });
  expect([200, 201], antwort.body).toContain(antwort.statusCode);
}

function zeile(antwort: Netzantwort, thema: string): ThemenZeile {
  const treffer = antwort.themen.find((z) => z.thema === thema);
  expect(
    treffer,
    `Thema ${thema} fehlt in der Antwort: ${JSON.stringify(antwort.themen)}`,
  ).toBeDefined();
  return treffer as ThemenZeile;
}

// ================================================================================================
// L1 · MIT VERDRAHTETEM KANTENPORT STEHEN DIE ZAHLEN DA.
// ================================================================================================
//
// GEGENPROBE ZUM AUSGANGSFEHLER: Vor diesem Auftrag fehlten `verknuepft`/`unverknuepft` in der
// Antwort vollständig — der Fall war rot an `toBe(1)` mit `undefined`.
describe("JOB 4155 · L1 — die Netzroute liefert je Thema `verknuepft` und `unverknuepft`", () => {
  it("zwei sichtbare Einträge EINES Themas, eine gesetzte Beziehung: 2 verknüpft, 1 unverknüpft", async () => {
    const a = await koMitThema("Wartungsplan Halle 2", "wartung");
    const b = await koMitThema("Filterwechsel dokumentiert", "wartung");
    const allein = await koMitThema("Schmierplan Pumpen", "wartung");

    const vorher = netzZahlen(await netz(), "wartung");
    expect(vorher, "ohne Beziehung ist noch nichts verknüpft").toEqual({
      verknuepft: 0,
      unverknuepft: 3,
    });

    await verknuepfe(a, b, "l1-erste-beziehung");

    const nachher = netzZahlen(await netz(), "wartung");
    // BEIDE Endpunkte zählen als verknüpft — die Kante gehört beiden. Der dritte Eintrag nicht.
    expect(nachher).toEqual({ verknuepft: 2, unverknuepft: 1 });
    // Und die Summe bleibt die Objektzahl des Themas: es wird nichts doppelt gezählt.
    expect(nachher.verknuepft + nachher.unverknuepft).toBe(zeile(await netz(), "wartung").objekte);
    expect([a, b, allein]).toHaveLength(3);
  });

  it("mit verdrahtetem Port meldet die Antwort KEINE Auslassung und nennt keinen Grund", async () => {
    await koMitThema("Dichtungen prüfen", "dichtung");
    const antwort = await netz();
    expect(antwort.verknuepfungAusgelassen).toBe(false);
    // Der Grund FEHLT — er steht nicht als `null` und nicht als leerer Text da.
    expect(Object.hasOwn(antwort, "verknuepfungAusgelassenGrund")).toBe(false);
  });
});

/** Die beiden Zähler eines Themas — als Paar, weil sie nur gemeinsam etwas aussagen. */
function netzZahlen(
  antwort: Netzantwort,
  thema: string,
): {
  verknuepft: number;
  unverknuepft: number;
} {
  const z = zeile(antwort, thema);
  expect(z.verknuepft, "verknuepft fehlt — die Kantenauskunft kommt nicht an").toBeTypeOf("number");
  expect(z.unverknuepft, "unverknuepft fehlt — die Kantenauskunft kommt nicht an").toBeTypeOf(
    "number",
  );
  return { verknuepft: z.verknuepft as number, unverknuepft: z.unverknuepft as number };
}

// ================================================================================================
// L2 · OHNE PORT STEHT DER GRUND DA — UND NICHT EINE 0.
// ================================================================================================
//
// DIE WICHTIGSTE GEGENPROBE DIESES AUFTRAGS. Die naheliegende Halbheit wäre, die Zähler immer zu
// senden und ohne Port `0` einzutragen. Das sähe aus wie ein Messergebnis („nachgesehen, keine
// Beziehungen") und wäre falsch. Deshalb wird hier die Route OHNE Kantenport gebaut — direkt, wie
// ein Routentest sie baut, der den Port nicht kennt.
describe("JOB 4155 · L2 — ohne Kantenport: ehrliche Auslassung mit Grund, keine Null", () => {
  it("`verknuepfungAusgelassen: true` mit Grund `kein-kantenport`, und die Zähler FEHLEN", async () => {
    await koMitThema("Ohne Port gemessen", "portlos");

    const app = Fastify();
    // DIESELBEN Abhängigkeiten wie im Produkt — bis auf `kanten`, das hier fehlt. Genau das ist der
    // Gegenstand des Falls: ein Aufrufer, der den Port nicht verdrahtet, bekommt die ehrliche
    // Auslassung. Der Typ ist der echte (`KoRoutesDeps`), nicht ein weggecasteter: würde `kanten`
    // eines Tages zur Pflicht, wäre GENAU DIESE ZEILE der Compilerfehler und nicht ein stilles Grün.
    const ohnePort: KoRoutesDeps = {
      ko: buehne.services.ko,
      validation: buehne.services.validation,
      conflicts: buehne.services.conflicts,
      overlaps: buehne.services.overlaps,
      overlapSettings: buehne.services.overlapSettings,
      lifecycle: buehne.services.lifecycle,
      reasoner: buehne.services.reasoner,
      uploadLimits: buehne.services.uploadLimits,
      objects: buehne.services.objects,
      externalPolicy: buehne.services.externalKnowledge,
      internalSourceOrigins: [],
    };
    await app.register(koRoutes(ohnePort, freierTorwaerter(buehne)));
    await app.ready();
    try {
      const antwort = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken" });
      expect(antwort.statusCode, antwort.body).toBe(200);
      const daten = antwort.json() as Netzantwort;

      expect(daten.verknuepfungAusgelassen).toBe(true);
      expect(daten.verknuepfungAusgelassenGrund).toBe("kein-kantenport");

      const z = zeile(daten, "portlos");
      // DER KERN: der Schlüssel fehlt. Eine 0 wäre eine Aussage, und zwar eine falsche.
      expect(Object.hasOwn(z, "verknuepft"), "eine 0 statt einer Auslassung").toBe(false);
      expect(Object.hasOwn(z, "unverknuepft"), "eine 0 statt einer Auslassung").toBe(false);
    } finally {
      await app.close();
    }
  });
});

/**
 * Ein Torwärter, der jeden durchlässt — DIESER Fall misst die Verdrahtung, nicht das Recht.
 *
 * Das Recht steht an derselben Route in `tests/wissensgraph-integration/rechte-am-draht.test.ts`
 * und oben in L3 am echten Draht; es hier ein zweites Mal zu prüfen hiesse, zwei Fälle dieselbe
 * Zusage tragen zu lassen und den einen beim Ändern zu vergessen.
 */
function freierTorwaerter(b: Buehne): Guards {
  const nutzer = { id: b.konto.admin.id, role: "admin" } as SessionUser;
  return {
    requireUser: async () => nutzer,
    requirePermission: async () => nutzer,
  };
}

// ================================================================================================
// L3 · DIE SICHTBARKEITSNAHT LIEGT VOR DER AUSWERTUNG.
// ================================================================================================
//
// Eine Kante zu einem Gegenstück, das dieser Mensch nicht sehen darf, existiert für ihn nicht
// (`kanten-service.ts`, `alsAnsicht`). Sie darf ihn deshalb auch nicht als „verknüpft" zählen —
// sonst wäre die Zahl selbst die Existenzauskunft, die der Trimm gerade verhindert.
describe("JOB 4155 · L3 — eine Kante zu einem unsichtbaren Gegenstück zählt NICHT", () => {
  it("derselbe Bestand, zwei Betrachter: der eine sieht 2 verknüpft, der andere 0", async () => {
    const offen = await koMitThema("Anlagenübersicht", "anlage");
    const geheim = await koMitThema("Interne Kalkulation", "anlage", {
      confidentiality: "vertraulich",
      author: buehne.konto.admin.id,
    });
    await verknuepfe(offen, geheim, "l3-quer-zur-sicht");

    // Der Admin sieht beide Endpunkte — für ihn ist die Kante da und beide Seiten verknüpft.
    const fuerAdmin = netzZahlen(await netz("admin"), "anlage");
    expect(fuerAdmin).toEqual({ verknuepft: 2, unverknuepft: 0 });

    // Der Experte sieht das vertrauliche Gegenstück nicht. Für ihn gibt es das OBJEKT nicht (es
    // fehlt in `objekte`) und die KANTE nicht — der offene Eintrag steht als unverknüpft da.
    const zeileExperte = zeile(await netz("experte"), "anlage");
    expect(zeileExperte.objekte, "das vertrauliche Objekt ist vor der Auswertung entfernt").toBe(1);
    expect(netzZahlen(await netz("experte"), "anlage")).toEqual({
      verknuepft: 0,
      unverknuepft: 1,
    });
  });
});
