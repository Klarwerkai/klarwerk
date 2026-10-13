// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — REALE LAGEBILD-WERTE AM ECHTEN DRAHT.
// ================================================================================================
//
// Gemessen an der echten App (`buildApp(buildServices())`, Speicherablage, echte Anmeldung, echte
// Spaces). Alle Namen, Werte und Belege sind erfundene Testdaten.
//
//   Ada    (admin)      — Verwaltung, pflegt `gesamt`; ist in „Werkstatt“ KEIN Mitglied
//   Lea    (experte)    — Zuständige von „Werkstatt“ (Schreibrecht)
//   Erik   (experte)    — Mitglied „Werkstatt“ nur mit Leserecht
//   Fritz  (experte)    — kein Mitglied
//   Vera   (viewer)     — Mitglied „Werkstatt“ mit Schreibrecht, aber ohne `ko.create`
//   Carla  (controller) — legt die Spaces an
//
//   A1 · LWE-02/03  Speichern und Wiederöffnen (gesamt durch die Verwaltung, Space durch die
//                   Zuständige); Feld, Zeitraum, Herkunft und Beleg kommen zurück.
//   A2 · LWE-03     Rechte serverseitig: gesamt nur Verwaltung; Space nur mit Schreibrecht UND
//                   `ko.create`; ein fremder Space ist weder lesbar noch von einem unbekannten zu
//                   unterscheiden, und seine Werte/Belege stehen in keiner fremden Antwort.
//   A3 · LWE-04     Ungültiges wird je Feld erklärt und nicht gespeichert.
//   A4 · LWE-04/05  Fakten je Bereich aus dem sichtbaren Bestand; negative Entlastung bleibt.
//   A5 · LWE-06     Paralleler Stand → 409 ohne Schreiben; Wiederholung derselben Anfrage legt
//                   nichts doppelt an; gleichzeitige Erstanlage gewinnt genau einmal.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const URL = "/api/management/lagebild-werte";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@lagebild.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@lagebild.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@lagebild.test", "experte"],
    ["Erik Leser", "erik@lagebild.test", "experte"],
    ["Fritz Fremd", "fritz@lagebild.test", "experte"],
    ["Vera Viewer", "vera@lagebild.test", "viewer"],
    ["Carla Controller", "carla@lagebild.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: ada,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    ada,
    lea: await anmelden(app, "lea@lagebild.test"),
    erik: await anmelden(app, "erik@lagebild.test"),
    fritz: await anmelden(app, "fritz@lagebild.test"),
    vera: await anmelden(app, "vera@lagebild.test"),
    carla: await anmelden(app, "carla@lagebild.test"),
  };
  const konten = (
    await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.lea })
  ).json().konten as { id: string; name: string }[];
  const id = (name: string): string => konten.find((x) => x.name === name)?.id ?? "";
  const ids = {
    lea: id("Lea Leitung"),
    erik: id("Erik Leser"),
    vera: id("Vera Viewer"),
    ada: id("Ada Admin"),
  };
  const werkstatt = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: k.carla,
    payload: {
      name: "Werkstatt",
      zweck: "Prüfstände der Werkstatt.",
      verantwortlich: ids.lea,
      zugang: "mitglieder",
      mitglieder: [
        { nutzer: ids.erik, recht: "lesen" },
        { nutzer: ids.vera, recht: "schreiben" },
      ],
      ansichten: [],
    },
  });
  expect(werkstatt.statusCode, werkstatt.body).toBe(201);
  return { app, services, k, ids, werkstatt: werkstatt.json().id as string };
}

function eingabe(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    zeitraumVon: "2025-07-01",
    zeitraumBis: "2025-09-30",
    werte: {
      hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
      hoursSavedPerValidatedKo: {
        wert: 1.5,
        herkunft: "gemessen",
        beleg: "Zeiterfassung Q3, Auswertung Einarbeitung",
      },
      reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
    },
    basisVersion: 0,
    anfrageId: "anfrage-0001",
    ...over,
  };
}

type Bereich = {
  bereich: string;
  name: string | null;
  darfSchreiben: boolean;
  vonMir: boolean;
  werte: null | {
    version: number;
    zeitraumVon: string;
    zeitraumBis: string;
    anfrageId: string;
    werte: Record<string, null | { wert: number; herkunft: string; beleg: string | null }>;
  };
  fakten: { validatedKos: number; totalKos: number; avgTrust: number; demoKos: number };
};

async function lesen(app: App, wer: Kopf): Promise<Bereich[]> {
  const res = await app.inject({ method: "GET", url: URL, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().bereiche as Bereich[];
}

const setzen = (app: App, wer: Kopf, bereich: string, payload: unknown) =>
  app.inject({ method: "PUT", url: `${URL}/${bereich}`, headers: wer, payload: payload as object });

describe("Lagebild-Werte · Speichern und Wiederöffnen (A1)", () => {
  it("die Verwaltung speichert `gesamt`; nach erneutem Lesen kommt derselbe Stand zurück", async () => {
    const { app, k } = await buehne();
    const vorher = (await lesen(app, k.ada)).find((b) => b.bereich === "gesamt");
    expect(vorher?.werte, "vor dem ersten Speichern ist nichts erfasst").toBeNull();

    const res = await setzen(app, k.ada, "gesamt", eingabe());
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ wiederholt: false, eintrag: { version: 1 } });

    // Wiederöffnen: ein neuer Abruf, auch durch eine andere lesende Person.
    for (const wer of [k.ada, k.fritz]) {
      const gesamt = (await lesen(app, wer)).find((b) => b.bereich === "gesamt");
      expect(gesamt?.werte).toMatchObject({
        version: 1,
        zeitraumVon: "2025-07-01",
        zeitraumBis: "2025-09-30",
        werte: {
          hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
          hoursSavedPerValidatedKo: {
            wert: 1.5,
            herkunft: "gemessen",
            beleg: "Zeiterfassung Q3, Auswertung Einarbeitung",
          },
          reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
        },
      });
    }
    // Wer den Stand gesetzt hat, sagt die Antwort nur als „von mir" — fremde Namen nennt sie nicht.
    expect((await lesen(app, k.ada)).find((b) => b.bereich === "gesamt")?.vonMir).toBe(true);
    expect((await lesen(app, k.fritz)).find((b) => b.bereich === "gesamt")?.vonMir).toBe(false);
  });

  it("die Zuständige korrigiert die Werte ihres Space; die Korrektur ist Stand 2", async () => {
    const { app, k, werkstatt } = await buehne();
    const erst = await setzen(app, k.lea, werkstatt, eingabe());
    expect(erst.statusCode, erst.body).toBe(200);
    const korrigiert = eingabe({
      basisVersion: 1,
      anfrageId: "anfrage-0002",
      werte: {
        hourlyRate: { wert: 80, herkunft: "eigene_eingabe", beleg: null },
        hoursSavedPerValidatedKo: null,
        reuseFactor: { wert: 3, herkunft: "eigene_eingabe" },
      },
    });
    const zweit = await setzen(app, k.lea, werkstatt, korrigiert);
    expect(zweit.statusCode, zweit.body).toBe(200);
    const raum = (await lesen(app, k.lea)).find((b) => b.bereich === werkstatt);
    expect(raum).toMatchObject({ name: "Werkstatt", darfSchreiben: true });
    expect(raum?.werte?.version).toBe(2);
    expect(raum?.werte?.werte.hourlyRate?.wert).toBe(80);
    // Leer gelassen heisst „nicht erfasst" — nichts wird ergänzt.
    expect(raum?.werte?.werte.hoursSavedPerValidatedKo).toBeNull();
  });
});

describe("Lagebild-Werte · Rechte am Server (A2)", () => {
  it("`gesamt` pflegt nur die Verwaltung; ohne `ko.create` gibt es kein Schreiben", async () => {
    const { app, k } = await buehne();
    expect((await setzen(app, k.lea, "gesamt", eingabe())).statusCode).toBe(403);
    expect((await setzen(app, k.carla, "gesamt", eingabe())).statusCode).toBe(403);
    expect((await setzen(app, k.vera, "gesamt", eingabe())).statusCode).toBe(403);
    expect((await lesen(app, k.lea)).find((b) => b.bereich === "gesamt")?.darfSchreiben).toBe(
      false,
    );
    expect((await lesen(app, k.ada)).find((b) => b.bereich === "gesamt")?.darfSchreiben).toBe(true);
    // Nichts wurde durch die abgewiesenen Versuche gespeichert.
    expect((await lesen(app, k.ada)).find((b) => b.bereich === "gesamt")?.werte).toBeNull();
  });

  it("Space: Leserecht liest, Schreibrecht ohne `ko.create` und reines Leserecht schreiben nicht", async () => {
    const { app, k, werkstatt } = await buehne();
    expect((await setzen(app, k.lea, werkstatt, eingabe())).statusCode).toBe(200);
    const fuerErik = (await lesen(app, k.erik)).find((b) => b.bereich === werkstatt);
    expect(fuerErik?.darfSchreiben).toBe(false);
    expect(fuerErik?.werte?.version).toBe(1);
    expect((await setzen(app, k.erik, werkstatt, eingabe({ basisVersion: 1 }))).statusCode).toBe(
      403,
    );
    expect((await setzen(app, k.vera, werkstatt, eingabe({ basisVersion: 1 }))).statusCode).toBe(
      403,
    );
  });

  it("ein fremder Space bleibt unsichtbar — gleiche Antwort wie ein unbekannter, kein Beleg im Draht", async () => {
    const { app, k, werkstatt } = await buehne();
    expect((await setzen(app, k.lea, werkstatt, eingabe())).statusCode).toBe(200);

    for (const wer of [k.fritz, k.ada]) {
      const roh = await app.inject({ method: "GET", url: URL, headers: wer });
      expect(roh.statusCode).toBe(200);
      expect(roh.body).not.toContain(werkstatt);
      expect(roh.body).not.toContain("Zeiterfassung Q3");
      expect(roh.body).not.toContain("Werkstatt");
    }
    const fremd = await setzen(app, k.fritz, werkstatt, eingabe({ basisVersion: 1 }));
    const unbekannt = await setzen(app, k.fritz, "gibt-es-nicht", eingabe({ basisVersion: 1 }));
    expect(fremd.statusCode).toBe(404);
    expect(unbekannt.statusCode).toBe(404);
    expect(fremd.body).toBe(unbekannt.body);
    // Kein Admin-Durchgriff: auch die Verwaltung schreibt nicht in einen Space, den sie nicht liest.
    expect((await setzen(app, k.ada, werkstatt, eingabe({ basisVersion: 1 }))).statusCode).toBe(
      404,
    );
    expect((await lesen(app, k.lea)).find((b) => b.bereich === werkstatt)?.werte?.version).toBe(1);
  });

  it("anonym wird abgewiesen", async () => {
    const { app } = await buehne();
    expect((await app.inject({ method: "GET", url: URL })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "PUT", url: `${URL}/gesamt`, payload: eingabe() })).statusCode,
    ).toBe(401);
  });
});

describe("Lagebild-Werte · fehlende und ungültige Werte (A3)", () => {
  it("jeder Fehler wird mit Feld und Satz erklärt; gespeichert wird nichts", async () => {
    const { app, k } = await buehne();
    const res = await setzen(app, k.ada, "gesamt", {
      zeitraumVon: "2025-09-30",
      zeitraumBis: "2025-07-01",
      werte: {
        hourlyRate: { wert: "siebzig", herkunft: "eigene_eingabe" },
        hoursSavedPerValidatedKo: { wert: 2, herkunft: "gemessen", beleg: "  " },
        reuseFactor: { wert: -1, herkunft: "geraten" },
      },
      basisVersion: 0,
      anfrageId: "anfrage-0003",
    });
    expect(res.statusCode, res.body).toBe(400);
    const body = res.json() as { error: string; fehler: { feld: string; meldung: string }[] };
    expect(body.error).toBe("INVALID_LAGEBILD_WERTE");
    const felder = body.fehler.map((f) => f.feld);
    expect(felder).toEqual(
      expect.arrayContaining([
        "zeitraumBis",
        "hourlyRate",
        "hoursSavedPerValidatedKo",
        "reuseFactor",
      ]),
    );
    const text = body.fehler.map((f) => f.meldung).join(" ");
    expect(text).toContain("Ende des Zeitraums liegt vor seinem Beginn");
    expect(text).toContain("bitte eine Zahl eingeben");
    expect(text).toContain("Beleg nennen");
    expect(text).toContain("Herkunft");
    expect((await lesen(app, k.ada)).find((b) => b.bereich === "gesamt")?.werte).toBeNull();
  });

  it("0 € Stundensatz, Werte ausserhalb der Spanne und ein Messzeitraum in der Zukunft sind Fehler", async () => {
    const { app, k } = await buehne();
    const nullSatz = await setzen(
      app,
      k.ada,
      "gesamt",
      eingabe({
        werte: {
          hourlyRate: { wert: 0, herkunft: "eigene_eingabe" },
          hoursSavedPerValidatedKo: { wert: 500, herkunft: "eigene_eingabe" },
          reuseFactor: null,
        },
      }),
    );
    expect(nullSatz.statusCode).toBe(400);
    expect(nullSatz.json().fehler.map((f: { feld: string }) => f.feld)).toEqual([
      "hourlyRate",
      "hoursSavedPerValidatedKo",
    ]);
    const zukunft = await setzen(app, k.ada, "gesamt", eingabe({ zeitraumBis: "2999-12-31" }));
    expect(zukunft.statusCode).toBe(400);
    expect(zukunft.body).toContain("Zukunft");
    const ohneZeitraum = await setzen(app, k.ada, "gesamt", eingabe({ zeitraumVon: "" }));
    expect(ohneZeitraum.statusCode).toBe(400);
    expect(ohneZeitraum.json().fehler[0].feld).toBe("zeitraumVon");
  });
});

describe("Lagebild-Werte · Fakten je Bereich (A4)", () => {
  it("Fakten nur über den sichtbaren Bestand des Bereichs; negative Entlastung wird gespeichert", async () => {
    const { app, services, k, ids, werkstatt } = await buehne();
    const anlegen = async (wer: Kopf, titel: string): Promise<string> => {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: wer,
        payload: {
          confidentiality: "intern",
          title: titel,
          statement: `${titel} — erfundene Testaussage.`,
          type: "best_practice",
          category: "Prüfstand",
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json().id as string;
    };
    const imRaum = await anlegen(k.lea, "Prüfstand anfahren");
    // Erst validieren (die Verwaltung sieht das Objekt noch), dann in den geschlossenen Raum legen.
    const validiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${imRaum}`,
      headers: k.ada,
      payload: { action: "admin-validate" },
    });
    expect(validiert.statusCode, validiert.body).toBe(200);
    await services.ko.setLeadingSpace(imRaum, werkstatt, ids.lea, null);
    await anlegen(k.fritz, "Allgemeine Notiz");

    const fuerLea = await lesen(app, k.lea);
    expect(fuerLea.find((b) => b.bereich === werkstatt)?.fakten).toMatchObject({
      validatedKos: 1,
      totalKos: 1,
    });
    // Fritz sieht den Raum nicht — und `gesamt` zählt für ihn auch dessen Objekt nicht.
    const fuerFritz = await lesen(app, k.fritz);
    expect(fuerFritz.find((b) => b.bereich === werkstatt)).toBeUndefined();
    expect(fuerFritz.find((b) => b.bereich === "gesamt")?.fakten.validatedKos).toBe(0);

    const negativ = await setzen(
      app,
      k.lea,
      werkstatt,
      eingabe({
        werte: {
          hourlyRate: { wert: 60, herkunft: "eigene_eingabe" },
          hoursSavedPerValidatedKo: { wert: -0.5, herkunft: "eigene_eingabe" },
          reuseFactor: { wert: 2, herkunft: "eigene_eingabe" },
        },
      }),
    );
    expect(negativ.statusCode, negativ.body).toBe(200);
    expect(
      (await lesen(app, k.lea)).find((b) => b.bereich === werkstatt)?.werte?.werte
        .hoursSavedPerValidatedKo?.wert,
    ).toBe(-0.5);
  });
});

describe("Lagebild-Werte · paralleler Stand und Wiederholung (A5)", () => {
  it("ein veralteter Stand schreibt nicht und bekommt den aktuellen Stand zurück (409)", async () => {
    const { app, k, werkstatt } = await buehne();
    // Zwei Bearbeitungen desselben Ausgangsstands (z. B. zwei offene Tabs): die zweite kommt zu spät.
    expect((await setzen(app, k.lea, werkstatt, eingabe())).statusCode).toBe(200);
    const veraltet = await setzen(
      app,
      k.lea,
      werkstatt,
      eingabe({
        anfrageId: "anfrage-0009",
        werte: {
          hourlyRate: { wert: 99, herkunft: "eigene_eingabe" },
          hoursSavedPerValidatedKo: null,
          reuseFactor: null,
        },
      }),
    );
    expect(veraltet.statusCode, veraltet.body).toBe(409);
    expect(veraltet.json()).toMatchObject({
      error: "LAGEBILD_KONFLIKT",
      aktuell: { version: 1, werte: { hourlyRate: { wert: 72.5 } } },
      aktuellVonMir: true,
    });
    const raum = (await lesen(app, k.lea)).find((b) => b.bereich === werkstatt);
    expect(raum?.werte?.version).toBe(1);
    expect(raum?.werte?.werte.hourlyRate?.wert).toBe(72.5);
  });

  it("dieselbe Anfrage zweimal (unbekannter Schreibausgang) legt nichts doppelt an", async () => {
    const { app, k } = await buehne();
    const erst = await setzen(app, k.ada, "gesamt", eingabe());
    const nochmal = await setzen(app, k.ada, "gesamt", eingabe());
    expect(erst.statusCode).toBe(200);
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect(nochmal.json()).toMatchObject({ wiederholt: true, eintrag: { version: 1 } });
    expect((await lesen(app, k.ada)).find((b) => b.bereich === "gesamt")?.werte?.version).toBe(1);
  });

  it("zwei gleichzeitige Erstanlagen: genau eine gewinnt, die andere bekommt 409", async () => {
    const { app, k } = await buehne();
    const [a, b] = await Promise.all([
      setzen(app, k.ada, "gesamt", eingabe({ anfrageId: "anfrage-000a" })),
      setzen(app, k.ada, "gesamt", eingabe({ anfrageId: "anfrage-000b" })),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const gespeichert = (await lesen(app, k.ada)).find((x) => x.bereich === "gesamt")?.werte;
    expect(gespeichert?.version).toBe(1);
    const gewinner = a.statusCode === 200 ? "anfrage-000a" : "anfrage-000b";
    expect(gespeichert?.anfrageId).toBe(gewinner);
  });
});
