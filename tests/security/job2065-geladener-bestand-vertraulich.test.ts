// ================================================================================================
// JOB 2065 · G3b — DIE VERTRAULICHKEITSPRUEFUNG AM GELADENEN BESTAND.
// ================================================================================================
//
// WAS OFFEN.md:236 ueber G3b sagt: „Gebaut und ausgeliefert (mega59 A, Ship 8) — wirkt erst nach
// dem Live-Laden", und als Zweck: „Ohne Objekte mit Stufen und Anhaengen laesst sich weder der
// ZUGRIFFSSCHUTZ noch die Anlagenkopplung vorfuehren."
//
// DIE LUECKE, die dieser Fall schliesst, und sie ist gemessen, nicht vermutet (JOB 2065 D2):
//
//   1. Der Leseschutz ist gesichert — aber jeder dieser Faelle baut sich sein vertrauliches Objekt
//      SELBST (mega74-lesepfad-vertraulich.test.ts:79-102: POST /api/kos + PUT confidentiality).
//      Keine der sieben Sicherheitsdateien zu diesem Thema nennt `seedDemo`.
//   2. Der geladene Bestand ist gesichert — aber die sechs Tests, die ihn laden, tragen NULL
//      Zusicherungen ueber Sichtbarkeit (mega59-vortest-bestand.test.ts prueft die DATEN, nicht die
//      PRUEFUNG auf ihnen).
//
// Zwei Haelften, je fuer sich gruen, die sich nicht beruehren — derselbe Befund wie beim
// KA2-Praezedenzfall. Dieser Fall ist ihr Schnittpunkt: die Objekte, die mega59 A geliefert hat,
// gehen durch den echten Leseweg.
//
// WARUM UEBER DIE ROUTE UND NICHT UEBER `darfSehen`: ein Direktaufruf des Praedikats belegt die
// Regel, nicht ihre Anwendung. Genau daran ist D1 gescheitert. Geprueft wird deshalb
// `POST /api/admin/demo-seed` (admin-routes.ts:45,57 → seedDemoForAdmin → buildDemoContent, also
// DERSELBE Inhalt wie der CLI-Seed, seed-demo.ts:179 und :219) und danach `GET /api/kos/:id` durch
// die Torwache `sichtbaresKoOder404` (ko-routes.ts:442-449).
//
// DIE GEGENPROBE, ohne die der Fall wertlos waere, ist gefahren — und sie hat ZWEI Schutzstellen
// sichtbar gemacht, nicht eine. Beide Male hashgleicher Rueckbau, danach wieder 6/6:
//
//   Mutation A  ko-routes.ts:444  `if (!item || !darfSehen(user, item))` → `if (!item)`
//               → 2 failed | 4 passed. Es fallen V1 und V2. V5 NICHT.
//   Mutation B  ko-routes.ts:533  `sichtbareFuer(user, await ko.list(…, sqlSichtbarkeitFuer(user)))`
//                                 → `await ko.list(request.query)`
//               → 1 failed | 5 passed. Es faellt V5.
//
// DAS IST DER GRUND, WARUM V5 EIGENS DASTEHT: Detailweg und Listenweg haengen an VERSCHIEDENEN
// Stellen (`sichtbaresKoOder404` gegen `sichtbareFuer` + `sqlSichtbarkeitFuer`). Wer nur das Detail
// prueft, laesst die Liste ungedeckt — und umgekehrt. Ein Direktaufruf von `darfSehen` haette
// keine der beiden Mutationen gemerkt.
//
// DIE GRENZE DIESES FALLS, ausdruecklich: die Autor-Ausnahme (sichtbarkeit.ts:76) laesst sich am
// geladenen Bestand NICHT isolieren. Die Autorin des vertraulichen Objekts ist Carla, und die
// traegt ohnehin `ko.validate`; Erik ist an keinem vertraulichen Seed-Objekt Autor. Deshalb prueft
// V3 die Rolle an `koGeheim`, dessen Autor der Admin ist — dort ist Carla NICHT Autorin, und die
// Zusicherung haengt sauber an `ko.validate` allein. Die Autor-Ausnahme selbst deckt
// mega74-lesepfad-vertraulich.test.ts:189 an eigenem Bestand ab.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

interface KoZeile {
  id: string;
  title: string;
  statement: string;
  tags?: string[];
  confidentiality?: string | null;
}

async function login(app: App, email: string, kennwort: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: kennwort },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

// Die Objekte werden ueber ihre SCHLAGWOERTER gesucht, nicht ueber den Titel: Titel kommen aus
// i18n (`t.koLieferantSchutz.title`) und wechseln mit der Sprache, die drei Marken unten stehen je
// genau EINMAL im Seed (seed-demo.ts:580, 593, 606).
const MARKE = {
  vertraulich: "konditionen", // koLieferantSchutz, seed-demo.ts:586-598, Autorin Carla
  strengVertraulich: "vorfall", // koGeheim,          seed-demo.ts:599-611, Autor Admin
  intern: "hydraulik", // koLieferantFrei,   seed-demo.ts:574-585, Autor Erik
} as const;

async function geladenerBestand() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job2065.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job2065.test", "geheim12345");

  // ---- DER LADEWEG. Alles danach prueft, was DIESER Aufruf in die laufende App gebracht hat. ----
  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin,
  });
  expect(seed.statusCode, `Der Ladeweg selbst muss tragen: ${seed.body}`).toBe(200);
  expect(
    seed.json().skipped,
    "der Seed ist uebersprungen — dann prueft dieser Fall einen leeren Bestand",
  ).toBe(false);

  const erik = await login(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
  const carla = await login(app, "carla@demo.klarwerk", demoKennwort(seed, "carla@demo.klarwerk"));

  // Der Admin traegt `ko.validate` und sieht deshalb den vollstaendigen Bestand — von hier holt der
  // Fall die Kennungen, gegen die er danach als Erik und Carla anfragt.
  const alle = await app.inject({ method: "GET", url: "/api/kos", headers: admin });
  expect(alle.statusCode, alle.body).toBe(200);
  const bestand = alle.json() as KoZeile[];

  const finde = (marke: string): KoZeile => {
    const treffer = bestand.filter((k) => (k.tags ?? []).includes(marke));
    expect(
      treffer.length,
      `Der geladene Bestand fuehrt nicht genau EIN Objekt mit dem Schlagwort "${marke}" — ` +
        `gefunden: ${treffer.length}. Ohne eindeutiges Objekt prueft dieser Fall nichts.`,
    ).toBe(1);
    return treffer[0] as KoZeile;
  };

  return {
    app,
    erik,
    carla,
    vertraulich: finde(MARKE.vertraulich),
    strengVertraulich: finde(MARKE.strengVertraulich),
    intern: finde(MARKE.intern),
  };
}

describe("JOB 2065 G3b · der GELADENE Bestand steht unter derselben Vertraulichkeitspruefung", () => {
  it("VORBEDINGUNG — der Ladeweg liefert die drei Stufen wirklich, sonst prueft alles Weitere Luft", async () => {
    const { vertraulich, strengVertraulich, intern } = await geladenerBestand();

    expect(vertraulich.confidentiality, "das Objekt aus seed-demo.ts:597").toBe("vertraulich");
    expect(strengVertraulich.confidentiality, "das Objekt aus seed-demo.ts:610").toBe(
      "streng_vertraulich",
    );
    // Das interne Objekt fuehrt das Feld gar nicht — der dokumentierte Standard ist „intern"
    // (knowledge-object/src/confidentiality.ts). Genau deshalb taugt es als Kontrollobjekt.
    expect(
      strengVertraulich.statement.length,
      "ohne Kerntext kann V1 nicht pruefen, dass nichts durchsickert",
    ).toBeGreaterThan(0);
    expect(intern.id).not.toBe(vertraulich.id);
  });

  it("V1 — Erik (experte, NICHT Autor) bekommt das geladene VERTRAULICHE Objekt nicht: 404, nicht 403", async () => {
    const { app, erik, vertraulich } = await geladenerBestand();

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${vertraulich.id}`,
      headers: erik,
    });

    expect(
      res.statusCode,
      `Ein Experte ohne ko.validate und ohne Autorschaft darf ein geladenes vertrauliches Objekt nicht sehen. Antwort war: ${res.statusCode} ${res.body}`,
    ).toBe(404);
    // Ein 403 waere schon zu viel: es bestaetigt die Existenz (ko-routes.ts:438-441).
    expect(res.statusCode).not.toBe(403);
    expect(
      res.body,
      "der Kerntext des vertraulichen Objekts steht in der Antwort — der Schutz greift nicht",
    ).not.toContain(vertraulich.statement);
  });

  it("V2 — dasselbe fuer die HOECHSTE Stufe: streng_vertraulich aus dem Ladeweg bleibt Erik verschlossen", async () => {
    const { app, erik, strengVertraulich } = await geladenerBestand();

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${strengVertraulich.id}`,
      headers: erik,
    });

    expect(res.statusCode, `Antwort war: ${res.statusCode} ${res.body}`).toBe(404);
    expect(res.body).not.toContain(strengVertraulich.statement);
  });

  it("V3 — GEGENPROBE: Carla (ko.validate, NICHT die Autorin) bekommt dasselbe Objekt sehr wohl", async () => {
    // Diese Zeile traegt den Fall: ohne sie waere V2 auch dann gruen, wenn die Route gar nichts mehr
    // herausgibt. Und weil Carla an `koGeheim` NICHT Autorin ist (Autor ist der Admin,
    // seed-demo.ts:605), haengt das Gruen hier allein an `ko.validate` — nicht an der Autorschaft.
    const { app, carla, strengVertraulich } = await geladenerBestand();

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${strengVertraulich.id}`,
      headers: carla,
    });

    expect(
      res.statusCode,
      `Wer ko.validate traegt, MUSS das vertrauliche Objekt sehen: ${res.body}`,
    ).toBe(200);
    expect((res.json() as KoZeile).id).toBe(strengVertraulich.id);
  });

  it("V4 — KALIBRIERUNG: das INTERNE Objekt aus demselben Ladeweg bleibt fuer Erik voll sichtbar", async () => {
    // Ohne diesen Fall koennte V1 und V2 auch daher kommen, dass Erik ueberhaupt nichts sieht — dann
    // maesse der Test eine Totalsperre statt der Stufenregel (sichtbarkeit.ts:68-70).
    const { app, erik, intern } = await geladenerBestand();

    const res = await app.inject({ method: "GET", url: `/api/kos/${intern.id}`, headers: erik });

    expect(res.statusCode, `Das interne Objekt MUSS sichtbar bleiben: ${res.body}`).toBe(200);
    expect((res.json() as KoZeile).id).toBe(intern.id);
  });

  it("V5 — auch die LISTE des geladenen Bestands trennt: intern drin, beide vertraulichen Stufen nicht", async () => {
    const { app, erik, vertraulich, strengVertraulich, intern } = await geladenerBestand();

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers: erik });
    expect(liste.statusCode, liste.body).toBe(200);
    const ids = (liste.json() as KoZeile[]).map((k) => k.id);

    expect(ids, "das geladene vertrauliche Objekt darf nicht in Eriks Liste stehen").not.toContain(
      vertraulich.id,
    );
    expect(ids, "das geladene streng vertrauliche Objekt ebenso wenig").not.toContain(
      strengVertraulich.id,
    );
    // KALIBRIERUNG: die Liste ist nicht einfach leer.
    expect(ids, "das interne Objekt MUSS in Eriks Liste stehen").toContain(intern.id);
  });
});
