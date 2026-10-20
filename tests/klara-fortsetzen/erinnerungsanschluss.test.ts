import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { erkenneAuftrag } from "../../apps/web/src/lib/klaraAuftragErkennung";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { KlaraAusfuehrung, type KlaraRufe } from "../../services/app/src/klara-ausfuehrung";
import { KlaraGespraechDienst } from "../../services/app/src/klara-gespraech";
import { type App, draht, registrieren, vorgang } from "./vorrichtung";

let app: App;
let token = "";
let services: ReturnType<typeof assembleServices>;
beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.ready();
  token = await registrieren(app);
});
afterEach(async () => {
  await app.close();
});
const zeit = { datum: "2035-10-22", uhrzeit: "09:00", zeitzone: "Europe/Berlin" };
async function plane(quelle = "getippt", erinnerung: unknown = zeit) {
  const v = await vorgang(app, token);
  const ziel = {
    art: "neue_persoenliche_aufgabe",
    id: null,
    titel: "Fiktive Wartung aus Gesprächsnotiz",
    stand: null,
    pfad: null,
  };
  const body = {
    quelle,
    wortlaut: "Lege mir die Aufgabe Fiktive Wartung aus Gesprächsnotiz an und erinnere mich",
    ziel: "Persönliche Wartungsaufgabe mit Erinnerung",
    erlaubteAktionen: ["persoenliche_aufgabe_anlegen", "erinnerung_anlegen"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: ["Ausdrücklicher Auftrag und eigener Notiztext"],
    ergebnis: "Persönliche Aufgabe und an sie gebundene Erinnerung gespeichert",
    geplanteSchritte: 2,
    plan: [
      {
        aktion: "persoenliche_aufgabe_anlegen",
        ziel,
        ausSchritt: null,
        inhalt: "Fiktiver Gesprächsnotiztext.",
      },
      { aktion: "erinnerung_anlegen", ziel: null, ausSchritt: 1, erinnerung },
    ],
  };
  const r = await draht(app, token)("POST", v.basis, body);
  return { v, r, body };
}
describe("G · freigegebener D-Anschluss im selben Auftrag", () => {
  it("D1 · ausdrückliche Schrift und Sprache erzeugen denselben Plan; fehlende Zeit bleibt gezielte Klärung", () => {
    expect(
      erkenneAuftrag("Lege mir die Aufgabe „Prüfen und erinnere mich“ an")?.schritte.map(
        (s) => s.aktion,
      ),
    ).toEqual(["persoenliche_aufgabe_anlegen"]);
    const voll = erkenneAuftrag(
      "Lege mir die Aufgabe „Filter G prüfen“ an und erinnere mich am 2035-10-22 um 09:00 in Europe/Berlin",
    );
    expect(voll?.schritte.map((s) => s.aktion)).toEqual([
      "persoenliche_aufgabe_anlegen",
      "erinnerung_anlegen",
    ]);
    expect(voll?.schritte[1]).toMatchObject({ ausSchritt: 0, erinnerung: zeit });
    for (const text of [
      'Create a personal task "Filter G prüfen" and remind me on 2035-10-22 at 09:00 in Europe/Berlin',
      'Maak een persoonlijke taak "Filter G prüfen" aan en herinner me op 2035-10-22 om 09:00 in Europe/Berlin',
    ]) {
      expect(erkenneAuftrag(text)?.schritte[1]).toMatchObject({
        aktion: "erinnerung_anlegen",
        erinnerung: zeit,
      });
    }
    const offen = erkenneAuftrag("Lege mir die Aufgabe „Filter G prüfen“ an und erinnere mich");
    expect(offen?.schritte[0]?.name).toBe("Filter G prüfen");
    expect(offen?.schritte[1]?.erinnerung).toEqual({ datum: "", uhrzeit: "", zeitzone: "" });
  });
  it("D2 · echte persönliche Aufgabe→D-Erinnerung mit Originalkennungen, Rücklinks und ohne zweite Anlage", async () => {
    const { v, r } = await plane();
    expect(r.statusCode, r.body).toBe(201);
    const a = r.json().auftrag;
    const pfad = `${v.basis}/${a.id}`;
    const auf = draht(app, token);
    const aus = (nr: number) =>
      auf("POST", `${pfad}/schritte/d-${nr}/ausfuehrung`, { nr, auftragFassung: 1 });
    const aufgabe = await aus(1);
    expect(aufgabe.statusCode, aufgabe.body).toBe(200);
    const aufgabeId = aufgabe.json().schritt.ergebnis.id;
    const erinnerung = await aus(2);
    expect(erinnerung.statusCode, erinnerung.body).toBe(200);
    const e = erinnerung.json().schritt.ergebnis;
    expect(e.art).toBe("erinnerung");
    expect(e.pfad).toBe(`/aufgaben?erinnerung=${e.id}`);
    const real = (await auf("GET", `/api/me/klara/erinnerungen/${e.id}`)).json().erinnerung;
    expect(real.bezug).toMatchObject({ art: "aufgabe", aufgabeId });
    expect(real.vorgang).toBe(`klara-auftrag-${a.id}-2`);
    expect(
      (await auf("GET", `/api/me/klara/aufgaben/${aufgabeId}`)).json().aufgabe.bezug,
    ).toMatchObject({ art: "auftrag", auftragId: a.id });
    expect((await aus(2)).json().wiederholt).toBe(true);
    expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(1);
    expect((await auf("POST", `${pfad}/schritte/d-2/ruecknahme`, {})).statusCode).toBe(409);
    expect((await auf("GET", `/api/me/klara/erinnerungen/${e.id}`)).statusCode).toBe(200);
  });
  it("D3 · Zeitkorrektur wirkt nur auf den offenen Schritt; alte Fassung und fertige Aufgabe bleiben erhalten", async () => {
    const { v, r, body } = await plane();
    expect(r.statusCode).toBe(201);
    const a = r.json().auftrag;
    const auf = draht(app, token);
    const pfad = `${v.basis}/${a.id}`;
    const first = await auf("POST", `${pfad}/schritte/d-1/ausfuehrung`, {
      nr: 1,
      auftragFassung: 1,
    });
    expect(first.statusCode).toBe(200);
    const id = first.json().schritt.ergebnis.id;
    await auf("POST", `${pfad}/unterbrechen`, { auftragFassung: 1 });
    const plan = [body.plan[0], { ...body.plan[1], erinnerung: { ...zeit, uhrzeit: "10:30" } }];
    const kor = await auf("POST", `${pfad}/fassungen`, {
      auftragFassung: 1,
      erlaubteAktionen: body.erlaubteAktionen,
      erlaubteZiele: body.erlaubteZiele,
      plan,
      grund: "Offene Erinnerung auf10:30 korrigiert",
    });
    expect(kor.statusCode, kor.body).toBe(200);
    expect(kor.json().auftrag.fassungen[0].plan[1].erinnerung.uhrzeit).toBe("09:00");
    const miss = await auf("POST", `${pfad}/fassungen`, {
      auftragFassung: 2,
      erlaubteAktionen: body.erlaubteAktionen,
      erlaubteZiele: body.erlaubteZiele,
      plan: [{ ...body.plan[0], inhalt: "Fertiges umschreiben" }, plan[1]],
      grund: "Unzulässige Änderung an fertigem Ergebnis",
    });
    expect(miss.statusCode).toBe(409);
    expect((await auf("POST", `${pfad}/fortsetzen`, { auftragFassung: 2 })).statusCode).toBe(200);
    const next = await auf("POST", `${pfad}/schritte/d-2/ausfuehrung`, {
      nr: 2,
      auftragFassung: 2,
    });
    expect(next.statusCode, next.body).toBe(200);
    expect(next.json().auftrag.schritte[0].ergebnis.id).toBe(id);
    const e = (
      await auf("GET", `/api/me/klara/erinnerungen/${next.json().schritt.ergebnis.id}`)
    ).json().erinnerung;
    expect(e.zeitplan.uhrzeit).toBe("10:30");
  });
  it("D4 · fehlende oder falsche Zeit erzeugt weder Aufgabe noch Erinnerung; fremde Quellen geben keine neue Befugnis", async () => {
    for (const e of [
      { datum: "2035-10-22", uhrzeit: "09:00" },
      { ...zeit, datum: "2035-02-31" },
      { ...zeit, zeitzone: "Fantasie/Zone" },
    ]) {
      const { r } = await plane("getippt", e);
      expect(r.statusCode, r.body).toBe(400);
    }
    expect((await draht(app, token)("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(
      0,
    );
    expect(
      (await draht(app, token)("GET", "/api/me/klara/erinnerungen")).json().erinnerungen,
    ).toHaveLength(0);
  });
  it("D5 · verlorene D-Antwort wird am tatsächlichen Vorgang gelesen; kein zweiter Schreibaufruf", async () => {
    const { v, r } = await plane();
    const a = r.json().auftrag;
    const auf = draht(app, token);
    const pfad = `${v.basis}/${a.id}`;
    expect(
      (await auf("POST", `${pfad}/schritte/d-1/ausfuehrung`, { nr: 1, auftragFassung: 1 }))
        .statusCode,
    ).toBe(200);
    let posts = 0;
    const rufe: KlaraRufe = async (m, url, body) => {
      const res = await auf(m, url, body);
      if (m === "POST" && url === "/api/me/klara/erinnerungen") {
        posts++;
        expect(res.statusCode).toBe(201);
        return { status: 503, daten: null };
      }
      return { status: res.statusCode, daten: res.json() };
    };
    const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    const real = await aus.fuehreAus(
      a.verantwortlich,
      v.gid,
      a.id,
      "d-2",
      { nr: 2, auftragFassung: 1 },
      rufe,
    );
    expect(real.schritt.stand).toBe("gespeichert");
    expect(posts).toBe(1);
    expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(1);
  });
});
