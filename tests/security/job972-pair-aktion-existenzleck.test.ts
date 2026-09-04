// ================================================================================================
// JOB 972 · D3 — PRÜFLÜCKE 6: VERRÄT EINE PAIR-AKTION, OB ES DAS PAAR GIBT?
// ================================================================================================
//
// Das Vollurteil zu D2 (`cf0d81e8…`) führt als Prüflücke 6: „Pair-Aktionen eines Autors ohne
// existenzbestätigende Fehlerdifferenz abweisen." Diese Zusage hängt NICHT an B4 — sie betrifft die
// heute vorhandenen Konflikt- und Dublettenrouten, nicht den erst zu entscheidenden Signalweg.
// Deshalb ist sie hier messbar, während alles andere gesperrt bleibt.
//
// DER BEFUND, DER DIESE DATEI TRÄGT: Die LESEWEGE beider Routen prüfen `paarSichtbar` und liefern
// einheitlich `404` — `overlap-routes.ts:97-100` sagt es im Kommentar selbst: „nicht sichtbar sieht
// aus wie nicht vorhanden". Die PAIR-AKTIONEN darunter (`dismiss`, `keep-separate`, `link-related`
// und seit JOB 3061 `status`)
// prüfen ausschliesslich die Rolle und rufen den Dienst direkt. Ob dabei ein Unterschied zwischen
// „gibt es nicht" und „darfst du nicht sehen" nach aussen dringt, ist genau die Frage.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

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

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job972d3.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job972d3.test", "geheim12345");
  for (const [email, role] of [
    ["leser@job972d3.test", "viewer"],
    ["autor@job972d3.test", "experte"],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
  }
  return { app, admin };
}

// JOB 3061 · H2: `status` („Status setzen" im „···"-Menü) ist seit dieser Runde die VIERTE
// Pair-Aktion und gehört damit unter dieselbe Zusage wie die drei anderen.
const AKTIONEN = ["dismiss", "keep-separate", "link-related", "status"] as const;

// Der Rumpf je Aktion. Die drei Abschlüsse tragen ihren Grund im PFAD und kommen mit `{}` aus;
// `status` trägt den Zielzustand im RUMPF und würde mit `{}` schon an der Eingabeprüfung enden
// (400 INVALID_STATUS) — dann hätte die Probe die Existenzfrage gar nicht erst gestellt. Sie
// bekommt deshalb eine WOHLGEFORMTE Anfrage; nur so erreicht sie denselben Nachschlagepunkt wie
// die anderen drei, und nur so misst diese Datei bei ihr wirklich, was sie zu messen vorgibt.
const RUMPF: Record<(typeof AKTIONEN)[number], Record<string, unknown>> = {
  dismiss: {},
  "keep-separate": {},
  "link-related": {},
  status: { status: "in_bearbeitung" },
};

describe("JOB972 D3 · Prüflücke 6 — die Pair-Aktion verrät keine Existenz", () => {
  it("P6: eine unbekannte Kennung wird abgewiesen, ohne dass die Antwort etwas über sie aussagt", async () => {
    const { app, admin } = await setup();
    const antworten = [];
    for (const aktion of AKTIONEN) {
      const res = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: admin,
        payload: RUMPF[aktion],
      });
      antworten.push({ aktion, status: res.statusCode, body: res.body });
    }
    // Der Befund wird SICHTBAR gemacht, nicht geraten: die Antwort steht in der Meldung.
    for (const a of antworten) {
      expect(
        a.status,
        `Aktion ${a.aktion} auf unbekannte Kennung: ${a.status} ${a.body.slice(0, 200)}`,
      ).toBeGreaterThanOrEqual(400);
    }
  });

  it("P6c: wer handeln darf, darf auch sehen — die Leckfrage hat keinen Traeger", async () => {
    // DER EIGENTLICHE FALL, und sein Ergebnis erklaert, warum die Aktionsrouten OHNE
    // `paarSichtbar` auskommen: Ein Existenzleck braeuchte jemanden, der HANDELN darf, ohne SEHEN
    // zu duerfen. Genau diesen Akteur gibt es nicht.
    //
    //   · Die Aktionen verlangen `ko.validate` (overlap-routes.ts) — das haben nur `controller`
    //     und `admin` (rbac/src/policy.ts:16-17).
    //   · Und `ko.validate` ist zugleich einer der beiden Sichtwege der Paaransicht.
    //
    // Beide Haelften werden hier gemessen, nicht behauptet.
    const dienste = buildServices();
    const app = buildApp(dienste);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@job972c.test", password: "geheim12345" },
    });
    const admin = await login(app, "a@job972c.test", "geheim12345");
    for (const [email, role] of [
      ["c@job972c.test", "controller"],
      ["v@job972c.test", "viewer"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name: email, email, password: "geheim12345", role },
      });
      if (res.statusCode !== 201) {
        throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
      }
    }
    const controller = await login(app, "c@job972c.test", "geheim12345");
    const leser = await login(app, "v@job972c.test", "geheim12345");

    // Zwei KOs des Admins auf hoechster Vertraulichkeitsstufe.
    const ids: string[] = [];
    for (const titel of ["Alpha", "Beta"]) {
      const ko = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: admin,
        payload: {
          title: titel,
          statement: `${titel} Aussage zum Vorgang.`,
          type: "best_practice",
          category: "Instandhaltung",
          author: "a@job972c.test",
        },
      });
      const id = ko.json().id as string;
      await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: admin,
        payload: { action: "confidentiality", level: "streng_vertraulich" },
      });
      ids.push(id);
    }
    const eintrag = await dienste.overlaps.createAuto(
      {
        koA: ids[0] as string,
        koB: ids[1] as string,
        relation: "moeglich",
        aspects: [],
        eigenanteilA: "Alpha",
        eigenanteilB: "Beta",
        recommendation: "pruefen",
      } as never,
      "heuristik" as never,
    );

    // HAELFTE 1 — wer handeln darf, sieht das Paar auch. Damit kann er nichts erfahren, was er
    // nicht ohnehin sehen duerfte.
    const sicht = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: controller,
    });
    expect(sicht.statusCode, `Controller-Sicht: ${sicht.statusCode}`).toBe(200);
    // Und die Gegenrichtung, ohne die der Satz nur halb gemessen waere: Wer NICHT handeln darf,
    // sieht das Paar auch nicht — und zwar als `404`, nicht als `403`. Ohne diese Zeile bliebe die
    // Zusicherung auch dann gruen, wenn die Sichtpruefung im Leseweg ganz entfiele.
    const keineSicht = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: leser,
    });
    expect(keineSicht.statusCode, `Lesersicht: ${keineSicht.statusCode}`).toBe(404);

    // HAELFTE 2 — wer NICHT handeln darf, bekommt fuer ein vorhandenes und fuer ein erfundenes
    // Paar exakt dieselbe Antwort. Ein Unterschied waere die Auskunft „es gibt da etwas".
    for (const aktion of AKTIONEN) {
      const vorhanden = await app.inject({
        method: "POST",
        url: `/api/duplicates/${eintrag.id}/${aktion}`,
        headers: leser,
        payload: RUMPF[aktion],
      });
      const erfunden = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: leser,
        payload: RUMPF[aktion],
      });
      expect(
        `${vorhanden.statusCode}|${vorhanden.body}`,
        `Aktion ${aktion}: vorhanden=${vorhanden.statusCode} | erfunden=${erfunden.statusCode}`,
      ).toBe(`${erfunden.statusCode}|${erfunden.body}`);
    }
    await app.close();
  });

  it("P6b: alle Pair-Aktionen antworten auf dieselbe unbekannte Kennung GLEICH", async () => {
    const { app, admin } = await setup();
    const koerper: string[] = [];
    for (const aktion of AKTIONEN) {
      const res = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: admin,
        payload: RUMPF[aktion],
      });
      koerper.push(`${res.statusCode}|${res.body}`);
    }
    // Unterschiedliche Antworten je Aktion wären für sich schon eine Auskunft über den Zustand.
    expect(new Set(koerper).size, `Antworten: ${koerper.join("  ||  ")}`).toBe(1);
  });
});
