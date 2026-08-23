// ================================================================================================
// JOB 2016 · D4 (G6) — DER BEWEIS STATT DER SUCHE: Exportmenge ⊆ Lesemenge.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. D2 endete mit dem Satz „ich habe keinen ungeschuetzten Exportweg
// gefunden". BEN hat zu Recht widersprochen: „ich habe keinen gefunden" und „es gibt keinen" sind
// zwei verschiedene Saetze, und nur der zweite schliesst eine Kennung. Eine Suche ist so gut wie
// die Suchmuster dessen, der sucht. Diese Datei ersetzt sie durch eine EIGENSCHAFT, die man messen
// kann.
//
// DIE EIGENSCHAFT: Fuer JEDEN Nutzer ist die Menge, die der Export ausgibt, eine TEILMENGE der
// Menge, die derselbe Nutzer ueber den Leseweg ohnehin sehen darf. Gilt sie, kann der Export
// definitionsgemaess nichts hinausgeben, was der Nutzer nicht schon lesen durfte — unabhaengig
// davon, ob jemand einen Weg uebersehen hat.
//
// WARUM SIE HEUTE GILT (am Code, nicht am Vertrauen):
//   Leseweg  `sichtbarkeit.ts:67-77`  darfSehen = !vertraulich ODER can(ko.validate) ODER Autor
//   Export   `library-routes.ts:205`  includeConfidential = can(ko.validate)
//   Fall A · can(ko.validate) = true  -> Export gibt alles, Lesen gibt alles       => gleich
//   Fall B · can(ko.validate) = false -> Export gibt nur Nicht-Vertrauliches,
//                                        Lesen gibt zusaetzlich EIGENE vertrauliche => echt kleiner
//
// UND HIER LIEGT DER EIGENTLICHE BEFUND VON D4. `sichtbarkeit.ts:101-104` verbietet woertlich, was
// der Export tut:
//
//   „Ausdruecklich ein Filter und KEIN `includeConfidential`-Schalter: seit Variante A haengt die
//    Sichtbarkeit auch am Autor, und ein Boolescher Wert kann ‚vertrauliches, aber eigenes Objekt'
//    nicht ausdruecken. Ein Dienst, der stattdessen ein Flag bekaeme, muesste die Regel ein zweites
//    Mal auslegen — genau das soll es hier nicht mehr geben."
//
// Der Export bekommt genau so ein Flag. Die zweite Auslegung faellt heute STRENGER aus als die
// erste: der Autor verliert im Export sein eigenes Objekt (Fall G6-T2). Das ist ein
// Funktionsverlust, KEIN Leck — und deshalb wird es hier festgehalten und NICHT repariert. Es
// stillschweigend zu beheben hiesse, eine Zusicherung wegzunehmen; das ist Pedis Entscheidung
// (OF-2016-1 in der Rueckgabe zu D4).
//
// WOGEGEN DIESE DATEI ALSO WACHT: nicht gegen den heutigen Stand, sondern gegen den Tag, an dem
// jemand `includeConfidential` anders bindet — an `ko.read` etwa, oder an einen Query-Parameter.
// Dann kippt Fall B, die Teilmengen-Eigenschaft bricht, und aus dem Funktionsverlust wird ein Leck.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const OFFEN = "Ventil entlasten";
const FREMD_GEHEIM = "Fremde Verschlusssache";
const EIGEN_GEHEIM = "Eigene Verschlusssache";
const ROH = "Roher Entwurf";

const FORMATE = ["json", "markdown", "mediawiki", "html"] as const;

// Der Aufbau folgt `library-export-egress.test.ts:10-69` — dieselbe Rollenbildung, damit hier
// keine zweite Wahrheit ueber Rollen entsteht.
async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "t-admin@x.de", password: "secret123" },
  });
  const adminHeaders = {
    authorization: `Bearer ${
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "t-admin@x.de", password: "secret123" },
        })
      ).json().token
    }`,
  };

  async function anlegen(name: string, email: string, role: string) {
    const erzeugt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name, email, password: "secret123", role },
    });
    expect(erzeugt.statusCode, `${role} anlegen`).toBe(201);
    const token = (
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "secret123" },
      })
    ).json().token;
    return { id: erzeugt.json().id as string, headers: { authorization: `Bearer ${token}` } };
  }

  const viewer = await anlegen("Vera Viewer", "t-viewer@x.de", "viewer");
  const experte = await anlegen("Erik Experte", "t-experte@x.de", "experte");

  const ko = services.ko;
  async function ablegen(title: string, author: string, vertraulich: boolean, validiert = true) {
    const angelegt = await ko.create({
      title,
      statement: `Aussage zu ${title}.`,
      type: "best_practice",
      category: "Anlage 1",
      author,
      tags: [],
    });
    if (validiert) {
      await ko.setValidationState(angelegt.id, { trust: 80, status: "validiert" });
    }
    if (vertraulich) {
      await ko.setConfidentiality(angelegt.id, "vertraulich", "admin");
    }
    return angelegt.id;
  }

  const offenId = await ablegen(OFFEN, "admin", false);
  const fremdId = await ablegen(FREMD_GEHEIM, "admin", true);
  // Das Objekt, an dem sich die zwei Auslegungen scheiden: vertraulich UND vom Experten verfasst.
  const eigenId = await ablegen(EIGEN_GEHEIM, experte.id, true);
  await ablegen(ROH, "admin", false, false);

  return { app, adminHeaders, viewer, experte, ids: { offenId, fremdId, eigenId } };
}

type App = Awaited<ReturnType<typeof setup>>["app"];

// Was traegt der Export in DIESEM Format? Antwort als Menge von Titeln — die vier Formate sind
// verschiedene Zeichenketten, aber dieselbe Frage.
async function exportTitel(
  app: App,
  format: string,
  headers: Record<string, string>,
): Promise<Set<string>> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/export?format=${format}`,
    headers,
  });
  expect(res.statusCode, `Export ${format}`).toBe(200);
  return new Set(
    [OFFEN, FREMD_GEHEIM, EIGEN_GEHEIM, ROH].filter((titel) => res.body.includes(titel)),
  );
}

// Was darf dieser Mensch LESEND sehen? Gefragt wird der Hauptleseweg, Objekt fuer Objekt — nicht
// eine nachgebaute Regel. Waere die Regel hier nachgebaut, pruefte der Test sich selbst.
async function lesbareTitel(
  app: App,
  headers: Record<string, string>,
  ids: Record<string, string>,
  titelZuId: Record<string, string>,
): Promise<Set<string>> {
  const sichtbar = new Set<string>();
  for (const [titel, id] of Object.entries(titelZuId)) {
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    if (res.statusCode === 200) {
      sichtbar.add(titel);
    }
  }
  void ids;
  return sichtbar;
}

describe("G6 · der Export gibt nie mehr her als der Leseweg", () => {
  it("G6-T1 · Nicht-Berechtigter: was der Export traegt, darf er auch lesen — in JEDEM Format", async () => {
    const { app, viewer, ids } = await setup();
    const titelZuId = {
      [OFFEN]: ids.offenId,
      [FREMD_GEHEIM]: ids.fremdId,
      [EIGEN_GEHEIM]: ids.eigenId,
    };
    const lesbar = await lesbareTitel(app, viewer.headers, ids, titelZuId);

    // KALIBRIERUNG: der Leseweg gibt dem Viewer ueberhaupt etwas — sonst waere jede Teilmengen-
    // Aussage unten trivial wahr.
    expect(lesbar.has(OFFEN)).toBe(true);
    expect(lesbar.has(FREMD_GEHEIM)).toBe(false);

    for (const format of FORMATE) {
      const exportiert = await exportTitel(app, format, viewer.headers);
      expect(exportiert.size, `${format}: Export darf nicht leer sein`).toBeGreaterThan(0);
      for (const titel of exportiert) {
        expect(
          lesbar.has(titel),
          `${format}: "${titel}" ging in den Export, ohne lesbar zu sein`,
        ).toBe(true);
      }
    }
  });

  it("G6-T2 · Autor eines vertraulichen Objekts: er darf es LESEN, bekommt es aber NICHT exportiert", async () => {
    // Der gemessene Unterschied zwischen den zwei Auslegungen. Kein Leck — der Export ist hier
    // STRENGER als der Leseweg. Festgehalten, damit die Abweichung nicht unbemerkt kippt; die
    // Entscheidung darueber liegt bei Pedi (OF-2016-1), nicht bei diesem Test.
    const { app, experte, ids } = await setup();

    const gelesen = await app.inject({
      method: "GET",
      url: `/api/kos/${ids.eigenId}`,
      headers: experte.headers,
    });
    expect(gelesen.statusCode, "Autor darf sein vertrauliches Objekt lesen").toBe(200);

    for (const format of FORMATE) {
      const exportiert = await exportTitel(app, format, experte.headers);
      expect(exportiert.has(OFFEN), `${format}: der Export traegt ueberhaupt etwas`).toBe(true);
      expect(
        exportiert.has(EIGEN_GEHEIM),
        `${format}: heute traegt der Export das EIGENE vertrauliche Objekt NICHT`,
      ).toBe(false);
      expect(exportiert.has(FREMD_GEHEIM), `${format}: fremdes Vertrauliches bleibt draussen`).toBe(
        false,
      );
    }
  });

  it("G6-T3 · Berechtigter (ko.validate): beide Mengen fallen zusammen — die Sperre haengt an der Rolle", async () => {
    // Die Gegenrichtung. Ohne sie bewiese T1 nur, dass der Export irgendetwas weglaesst.
    const { app, adminHeaders } = await setup();
    for (const format of FORMATE) {
      const exportiert = await exportTitel(app, format, adminHeaders);
      expect(exportiert.has(OFFEN)).toBe(true);
      expect(exportiert.has(FREMD_GEHEIM)).toBe(true);
      expect(exportiert.has(EIGEN_GEHEIM)).toBe(true);
      // Validiert-only gilt fuer jede Rolle und jedes Format.
      expect(exportiert.has(ROH), `${format}: Unvalidiertes bleibt draussen`).toBe(false);
    }
  });

  it("G6-T4 · kein Format schert aus: alle vier tragen genau dieselbe Menge", async () => {
    // Der Wachposten ueber die vier Zweige in `library-routes.ts:206-228`. Haengt sich eines der
    // Formate kuenftig an eine andere Quelle, faellt hier die Gleichheit — auch dann, wenn dieses
    // Format von keinem inhaltlichen Fall geprueft wird.
    const { app, viewer } = await setup();
    const referenz = await exportTitel(app, "json", viewer.headers);
    for (const format of FORMATE) {
      const exportiert = await exportTitel(app, format, viewer.headers);
      expect([...exportiert].sort(), `${format} weicht von json ab`).toEqual([...referenz].sort());
    }
  });
});
