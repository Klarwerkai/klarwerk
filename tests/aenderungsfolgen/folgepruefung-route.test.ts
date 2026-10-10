// ================================================================================================
// produkt:20261010:aenderungsfolgen-sichtbar — DIE FOLGEPRÜFUNG AM ECHTEN SERVER (In-Memory-Aufbau).
// ================================================================================================
//
// Gemessen über `app.inject` gegen die echte Kompositionswurzel: echtes Login, echte Rollen, echte
// Lese- und Mutationsrouten. Ausschließlich fiktive Testdaten.
//
// DIE ABNAHMEKULISSE (K8): eine geänderte fiktive Quelle „Dosierstation DP-4" mit ZWEI tatsächlich
// gekoppelten internen Einträgen (A, B), einem dritten gekoppelten, aber VERTRAULICHEN Eintrag eines
// anderen Autors (D) und einem UNBETEILIGTEN Eintrag an einer anderen Anlage (C).
//
//   K1/K2  Die Übersicht nennt je Fall Ausgangsanlage, Änderungsbeleg, Fassung und Grund; der
//          unbeteiligte Eintrag erscheint nicht; keine Vermutung, keine Vollständigkeitsaussage.
//   K3     Titel, Änderungsgrund, zuständige Person, Prüfstatus — dieselben Daten wie am Detailweg.
//   K4     Nur sichtbare Einträge und Bezüge: der vertrauliche fehlt beim Betrachter — ohne
//          Platzhalter, ohne Zahl, auch nicht als auslösender Eintrag; die Antwort der Meldung
//          nennt ihn nicht. Lesen schreibt kein Ereignis.
//   K5     Zweite Änderung während der Prüfung → 409, Fall bleibt offen; Abschluss genau des
//          gesehenen Stands; Wiederholung des Abschlusses → 409 ohne zweite Fassung.
//   K6     Bis zur Klärung trägt der Leseweg „fällig", nicht „aktuell".
//   K7     Wiederholte Meldung legt nichts doppelt an; fehlende Zuständigkeit ist benannt.
//   K8     Rechteentzug: wird ein Eintrag vertraulich, verschwindet er aus der Liste des Betrachters.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Anlass {
  grund: string;
  am: string;
  assetRef: string | null;
  kopplungBesteht: boolean | null;
  aenderung: string | null;
  ausloeser: { koId: string; title: string; version: number | null } | null;
  koVersion: number | null;
}

interface Fall {
  koId: string;
  title: string;
  status: string;
  version: number;
  stand: number;
  seit: string | null;
  zustaendig: { id: string; name: string | null; vorhanden: boolean; art: string };
  anlaesse: Anlass[];
}

const ANLAGE = "Dosierstation DP-4";

async function login(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

const AUSSAGEN = [
  "Vor dem Entlüften die Dosierpumpe drucklos schalten.",
  "Die Dosiermenge nach jedem Chargenwechsel neu einstellen.",
  "Das Förderband im Versand wöchentlich nachspannen.",
  "Die Rezepturgrenzen der Dosierstation sind vertraulich hinterlegt.",
  "Nach dem Filterwechsel die Leitung spülen.",
];
let naechste = 0;

async function anlegen(app: App, kopf: Kopf, titel: string): Promise<string> {
  const statement = AUSSAGEN[naechste % AUSSAGEN.length] ?? AUSSAGEN[0];
  naechste += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement,
      type: "best_practice",
      category: "Dosierung",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

function put(app: App, kopf: Kopf, id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: kopf, payload });
}

async function koppeln(app: App, kopf: Kopf, assetRef: string, koId: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/lifecycle/couple",
    headers: kopf,
    payload: { assetRef, koId },
  });
  expect(res.statusCode, res.body).toBe(204);
}

async function melden(app: App, kopf: Kopf, aenderung?: string): Promise<string[]> {
  const res = await app.inject({
    method: "POST",
    url: "/api/lifecycle/asset-changed",
    headers: kopf,
    payload: aenderung ? { assetRef: ANLAGE, aenderung } : { assetRef: ANLAGE },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as string[];
}

async function uebersicht(app: App, kopf: Kopf): Promise<Fall[]> {
  const res = await app.inject({
    method: "GET",
    url: "/api/lifecycle/folgepruefung",
    headers: kopf,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Fall[];
}

async function aufbau(marke: string) {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`);
  for (const [name, email, role] of [
    ["Vera Leserin", `vera@${marke}.test`, "viewer"],
    ["Erik Experte", `erik@${marke}.test`, "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: "geheim12345", role },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  const vera = await login(app, `vera@${marke}.test`);
  const erik = await login(app, `erik@${marke}.test`);

  const a = await anlegen(app, admin, "Dosierpumpe DP-4 entlüften");
  const b = await anlegen(app, admin, "Dosiermenge DP-4 einstellen");
  const c = await anlegen(app, admin, "Förderband im Versand spannen");
  const d = await anlegen(app, erik, "Rezepturgrenzen DP-4");
  const stufe = await put(app, erik, d, { action: "confidentiality", level: "vertraulich" });
  expect(stufe.statusCode, stufe.body).toBe(200);
  for (const id of [a, b, c]) {
    // Die Kulissentexte ähneln sich (dieselbe Anlage) — eine Dublettenfrage ist nicht Gegenstand.
    const frei = await put(app, admin, id, {
      action: "admin-validate",
      duplicateAcknowledged: true,
    });
    expect(frei.statusCode, frei.body).toBe(200);
  }
  await koppeln(app, admin, ANLAGE, a);
  await koppeln(app, admin, ANLAGE, b);
  await koppeln(app, erik, ANLAGE, d);
  await koppeln(app, admin, "Förderband F-1", c);
  return { services, app, admin, vera, erik, a, b, c, d };
}

describe("K1/K2/K3 · die Übersicht begründet die Betroffenheit", () => {
  it("die gekoppelten Einträge mit Anlage, Änderungsbeleg und Fassung — der unbeteiligte fehlt", async () => {
    const { app, admin, a, b, c, d } = await aufbau("af1");
    expect((await melden(app, admin, "Rev. B")).sort()).toEqual([a, b, d].sort());

    const faelle = await uebersicht(app, admin);
    expect(faelle.map((f) => f.koId).sort()).toEqual([a, b, d].sort());
    expect(faelle.map((f) => f.koId)).not.toContain(c);
    const fallA = faelle.find((f) => f.koId === a);
    expect(fallA).toMatchObject({
      title: "Dosierpumpe DP-4 entlüften",
      status: "validiert",
      stand: 1,
      anlaesse: [
        {
          grund: "anlage",
          assetRef: ANLAGE,
          kopplungBesteht: true,
          aenderung: "Rev. B",
          ausloeser: null,
          koVersion: fallA?.version,
        },
      ],
    });
    expect(fallA?.seit).toBeTruthy();
    // K2: nur Belegtes — keine Vermutungsfelder, keine Gesamtzahl.
    expect(Object.keys(fallA ?? {}).sort()).toEqual(
      ["anlaesse", "koId", "seit", "stand", "status", "title", "version", "zustaendig"].sort(),
    );
    // Die meldende Person verlässt den Server nicht.
    expect(JSON.stringify(faelle)).not.toContain('"von"');
  });

  it("K3: zuständige Person mit Namen — dieselbe Verantwortung wie am Detailweg", async () => {
    const { app, admin, a } = await aufbau("af2");
    await melden(app, admin, "Rev. B");
    const fallA = (await uebersicht(app, admin)).find((f) => f.koId === a);
    const detail = await app.inject({ method: "GET", url: `/api/kos/${a}`, headers: admin });
    const frische = (detail.json() as { frische?: { verantwortlich: string } }).frische;
    expect(fallA?.zustaendig.id).toBe(frische?.verantwortlich);
    expect(fallA?.zustaendig.name).toBe("Ada Admin");
    expect(fallA?.zustaendig.vorhanden).toBe(true);
  });

  it("Nachbarauslöser: der auslösende Eintrag mit Titel und Fassung, wenn er sichtbar ist", async () => {
    const { app, admin, a, b } = await aufbau("af3");
    const meldung = await put(app, admin, a, { action: "neighbors-changed", aenderung: "Rev. B" });
    expect(meldung.statusCode, meldung.body).toBe(200);
    const fallB = (await uebersicht(app, admin)).find((f) => f.koId === b);
    expect(fallB?.anlaesse[0]).toMatchObject({
      grund: "nachbar",
      assetRef: ANLAGE,
      aenderung: "Rev. B",
      ausloeser: { koId: a, title: "Dosierpumpe DP-4 entlüften" },
    });
  });
});

describe("K4 · nur sichtbare Einträge und Bezüge — und Lesen schreibt nichts", () => {
  it("der vertrauliche Eintrag fehlt beim Betrachter ganz; sein Autor sieht ihn", async () => {
    const { app, admin, vera, erik, a, b, d } = await aufbau("af4");
    await melden(app, admin, "Rev. B");
    const alsVera = await uebersicht(app, vera);
    expect(alsVera.map((f) => f.koId).sort()).toEqual([a, b].sort());
    expect(JSON.stringify(alsVera)).not.toContain(d);
    expect(JSON.stringify(alsVera)).not.toContain("Rezepturgrenzen");
    expect((await uebersicht(app, erik)).map((f) => f.koId)).toContain(d);
  });

  it("ein verborgener auslösender Eintrag wird weder genannt noch über den Grund verraten", async () => {
    const { app, admin, vera, a, d } = await aufbau("af5");
    const meldung = await put(app, admin, d, { action: "neighbors-changed" });
    expect(meldung.statusCode, meldung.body).toBe(200);
    const fallA = (await uebersicht(app, vera)).find((f) => f.koId === a);
    expect(fallA?.anlaesse).toEqual([
      expect.objectContaining({ grund: "anlage", assetRef: ANLAGE, ausloeser: null }),
    ]);
    expect(JSON.stringify(fallA)).not.toContain(d);
    // GEGENPROBE: wer den Auslöser sehen darf, sieht ihn.
    const alsAdmin = (await uebersicht(app, admin)).find((f) => f.koId === a);
    expect(alsAdmin?.anlaesse[0]?.ausloeser?.koId).toBe(d);
  });

  it("der Leseweg schreibt kein Änderungs- oder Pflegeereignis und räumt nichts", async () => {
    const { services, app, admin, vera } = await aufbau("af6");
    await melden(app, admin, "Rev. B");
    // Gezählt werden die Ereignisse an Wissenseinträgen und im Lebenszyklus — genau die, die ein
    // Lesen nie erzeugen darf.
    const pflege = async () =>
      (await services.audit.list({})).filter((e) => /^(ko|lifecycle)\./.test(e.action)).length;
    const vorher = await pflege();
    const faelleVorher = await services.lifecycle.offeneFaelle();
    await uebersicht(app, admin);
    await uebersicht(app, vera);
    expect(await pflege()).toBe(vorher);
    expect(await services.lifecycle.offeneFaelle()).toEqual(faelleVorher);
  });

  it("ohne Anmeldung keine Auskunft", async () => {
    const { app } = await aufbau("af7");
    const res = await app.inject({ method: "GET", url: "/api/lifecycle/folgepruefung" });
    expect(res.statusCode).toBe(401);
  });
});

describe("K5/K6/K7 · neue Änderung während der Prüfung, Wiederholung, Abschluss", () => {
  it("die durchgehende Probe an EINEM Eintrag", async () => {
    const { services, app, admin, a, b } = await aufbau("af8");
    await melden(app, admin, "Rev. B");
    const angezeigt = (await uebersicht(app, admin)).find((f) => f.koId === a);
    expect(angezeigt?.stand).toBe(1);

    // K7: dieselbe Meldung noch einmal — nichts doppelt.
    const belegeVorher = await services.audit.list({ action: "lifecycle.revalidation-requested" });
    await melden(app, admin, "Rev. B");
    const nachWiederholung = (await uebersicht(app, admin)).find((f) => f.koId === a);
    expect(nachWiederholung?.stand).toBe(1);
    expect(nachWiederholung?.anlaesse).toHaveLength(1);
    expect(await services.audit.list({ action: "lifecycle.revalidation-requested" })).toHaveLength(
      belegeVorher.length,
    );

    // K5: zwischen Anzeige und Bestätigung geht Rev. C ein.
    await melden(app, admin, "Rev. C");
    const veraltet = await put(app, admin, a, { action: "revalidate", stand: angezeigt?.stand });
    expect(veraltet.statusCode, veraltet.body).toBe(409);
    expect((veraltet.json() as { error: string }).error).toBe("STAND_VERALTET");
    const offen = (await uebersicht(app, admin)).find((f) => f.koId === a);
    expect(offen?.stand).toBe(2);
    expect(offen?.version).toBe(angezeigt?.version);
    expect(offen?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. B", "Rev. C"]);

    // K6: bis zur Klärung ist der Eintrag am Leseweg nicht „aktuell".
    const detail = await app.inject({ method: "GET", url: `/api/kos/${a}`, headers: admin });
    const frische = (detail.json() as { frische?: { stufe: string; aktuellerStand: boolean } })
      .frische;
    expect(frische?.aktuellerStand).toBe(false);
    expect(frische?.stufe).toBe("faellig");

    // Abschluss genau des neuen Stands.
    const abschluss = await put(app, admin, a, { action: "revalidate", stand: 2 });
    expect(abschluss.statusCode, abschluss.body).toBe(200);
    expect((abschluss.json() as { version: number }).version).toBe((angezeigt?.version ?? 0) + 1);
    const nachher = await uebersicht(app, admin);
    expect(nachher.map((f) => f.koId)).not.toContain(a);
    expect(
      nachher.map((f) => f.koId),
      "der Nachbar bleibt offen",
    ).toContain(b);
    const beleg = await services.audit.list({ action: "ko.revalidated", target: a });
    expect(beleg.map((e) => e.payload)).toEqual([
      { pendingCleared: true, geprueftStand: 2, version: (angezeigt?.version ?? 0) + 1 },
    ]);

    // Wiederholung des Abschlusses: keine zweite Fassung.
    const nochmal = await put(app, admin, a, { action: "revalidate", stand: 2 });
    expect(nochmal.statusCode, nochmal.body).toBe(409);
    const stand = await app.inject({ method: "GET", url: `/api/kos/${a}`, headers: admin });
    expect((stand.json() as { version: number }).version).toBe((angezeigt?.version ?? 0) + 1);
  });

  it("ungültiger Stand ist ein Eingabefehler, kein stiller Abschluss", async () => {
    const { app, admin, a } = await aufbau("af9");
    await melden(app, admin, "Rev. B");
    const res = await put(app, admin, a, { action: "revalidate", stand: "eins" });
    expect(res.statusCode, res.body).toBe(400);
    expect((await uebersicht(app, admin)).map((f) => f.koId)).toContain(a);
  });

  it("K7: fehlende Zuständigkeit ist benannt, nicht verschwiegen", async () => {
    const { services, app, admin, b } = await aufbau("af10");
    // Fiktive Altlast: die benannte Eigentümerin hat kein Konto mehr.
    await services.ko.setOwnership(b, { owner: "konto-ausgeschieden-0001" }, "admin");
    await melden(app, admin, "Rev. B");
    const fallB = (await uebersicht(app, admin)).find((f) => f.koId === b);
    expect(fallB?.zustaendig).toEqual({
      id: "konto-ausgeschieden-0001",
      name: null,
      vorhanden: false,
      art: "owner",
    });
  });

  it("K7: eine Anlage ohne gespeicherte Kopplung markiert nichts; leere Anlage ist 400", async () => {
    const { app, admin } = await aufbau("af11");
    const ohne = await app.inject({
      method: "POST",
      url: "/api/lifecycle/asset-changed",
      headers: admin,
      payload: { assetRef: "Anlage ohne Kopplung" },
    });
    expect(ohne.statusCode, ohne.body).toBe(200);
    expect(ohne.json()).toEqual([]);
    expect(await uebersicht(app, admin)).toEqual([]);
    const leer = await app.inject({
      method: "POST",
      url: "/api/lifecycle/asset-changed",
      headers: admin,
      payload: { assetRef: "   " },
    });
    expect(leer.statusCode, leer.body).toBe(400);
  });
});

describe("K8 · Rechteentzug", () => {
  it("wird ein betroffener Eintrag vertraulich, verschwindet er aus der Liste des Betrachters", async () => {
    const { app, admin, vera, a, b } = await aufbau("af12");
    await melden(app, admin, "Rev. B");
    expect((await uebersicht(app, vera)).map((f) => f.koId).sort()).toEqual([a, b].sort());
    const stufe = await put(app, admin, a, { action: "confidentiality", level: "vertraulich" });
    expect(stufe.statusCode, stufe.body).toBe(200);
    const danach = await uebersicht(app, vera);
    expect(danach.map((f) => f.koId)).toEqual([b]);
    expect(JSON.stringify(danach)).not.toContain(a);
    // Der Fall selbst bleibt offen — der Entzug ist kein Abschluss.
    expect((await uebersicht(app, admin)).map((f) => f.koId)).toContain(a);
  });
});
