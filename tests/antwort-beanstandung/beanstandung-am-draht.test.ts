// ================================================================================================
// produkt:20261010:antwort-beanstandung-korrektur — DER ARBEITSWEG AM DRAHT, MIT GETRENNTEN ROLLEN.
// ================================================================================================
//
// Über die ECHTEN Routen (`buildApp(buildServices())`) mit fiktiven Konten: admin (Verwaltung),
// fachmann (Autor = verantwortlich, Fachzuständigkeit), melda und melvin (melden), dritte
// (unbeteiligt), betrachter (Rolle viewer). Die Fachprüfung läuft über die vorhandene Bewertung
// (`ValidationService.rate`) mit fiktiven Prüfenden — derselbe Weg wie das Prüfboard.
//
// Fiktive falsche Aussage in einer echten, zugeordneten Quelle → melden (gebunden an Antwort, Aussage,
// Fundstelle, Fassung) → zugeordnet → Wiederholung zusammengeführt → in der Aufgabenansicht EINMAL →
// Rückfrage/Antwort → Korrektur ohne Freigabe abgewiesen → Freigabe → Abschluss → Rückmeldung →
// erneut fragen → Rechteentzug. Daneben: begründete Zurückweisung und die Rechte des neuen Schritts.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const TITEL = "Spindel SP-7 schmieren";
const FALSCH = "Die Spindel SP-7 wird alle 40 Betriebsstunden im laufenden Betrieb geschmiert.";
const RICHTIG = "Die Spindel SP-7 wird alle 400 Betriebsstunden im Stillstand geschmiert.";
const GRUND = "Laut Wartungsblatt nur im Stillstand und alle 400 Stunden.";

type App = ReturnType<typeof buildApp>;
interface Konto {
  headers: Record<string, string>;
  id: string;
}
interface Meldung {
  id: string;
  kind: string;
  lueckenArt?: string;
  gapId?: string;
  koId?: string;
  meldungId?: string;
}
interface AussageDraht {
  aussageId: string;
  text: string;
  teile: { fundstellen: { fundstelleId: string; koId: string; koVersion: number }[] }[];
}

async function anmelden(app: App, email: string): Promise<Konto> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return { headers: { authorization: `Bearer ${login.json().token}` }, id: login.json().user.id };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@fiktiv.de", password: "secret123" },
  });
  const admin = await anmelden(app, "admin@fiktiv.de");
  for (const [name, email, role] of [
    ["Fachmann Fiktiv", "fachmann@fiktiv.de", "experte"],
    ["Melda Fiktiv", "melda@fiktiv.de", "experte"],
    ["Melvin Fiktiv", "melvin@fiktiv.de", "experte"],
    ["Dritte Fiktiv", "dritte@fiktiv.de", "experte"],
    ["Betrachter Fiktiv", "betrachter@fiktiv.de", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name, email, password: "secret123", role },
    });
    expect(res.statusCode, res.body).toBeLessThan(300);
  }
  const fachmann = await anmelden(app, "fachmann@fiktiv.de");
  const ko = await services.ko.create({
    title: TITEL,
    statement: FALSCH,
    type: "best_practice",
    category: "Instandhaltung",
    author: fachmann.id,
    confidentiality: "intern",
  });
  const freigeben = async (runde: number): Promise<void> => {
    const aktuell = await services.ko.get(ko.id);
    for (let i = 0; i < (aktuell?.neededValidations ?? 0); i++) {
      await services.validation.rate(ko.id, `pruefer-${runde}-${i}`, "up");
    }
  };
  await freigeben(1);
  return {
    app,
    services,
    admin,
    fachmann,
    melda: await anmelden(app, "melda@fiktiv.de"),
    melvin: await anmelden(app, "melvin@fiktiv.de"),
    dritte: await anmelden(app, "dritte@fiktiv.de"),
    betrachter: await anmelden(app, "betrachter@fiktiv.de"),
    ko,
    freigeben,
  };
}

const post = (app: App, k: Konto, url: string, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url, headers: k.headers, payload });
const vorgang = (app: App, k: Konto, id: string) =>
  app.inject({ method: "GET", url: `/api/gaps/${id}/vorgang`, headers: k.headers });
async function glocke(app: App, k: Konto): Promise<Meldung[]> {
  const res = await app.inject({ method: "GET", url: "/api/notifications", headers: k.headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Meldung[];
}

/** Fragen und die erste Aussage mit ihrer Fundstelle in der Quelle nehmen (kalibriert). */
async function fragenUndAussage(app: App, k: Konto, koId: string) {
  const res = await post(app, k, "/api/ask", { question: TITEL });
  expect(res.statusCode, res.body).toBe(200);
  const body = res.json() as {
    receipt: string;
    answerId: string | null;
    quellenStand?: Record<string, number>;
    result: { answer: string | null; citedSources: string[] };
    aussagen?: { aussagen: AussageDraht[] };
  };
  expect(body.result.citedSources, "die Quelle muss tragen").toContain(koId);
  const aussage = body.aussagen?.aussagen[0];
  expect(aussage, "die Antwort muss Aussagen tragen").toBeDefined();
  const fundstelle = aussage?.teile.flatMap((t) => t.fundstellen).find((f) => f.koId === koId);
  expect(fundstelle, "die Aussage muss eine Fundstelle in der Quelle haben").toBeDefined();
  return { body, aussage: aussage as AussageDraht, fundstelleId: fundstelle?.fundstelleId ?? "" };
}

describe("Beanstandung · von der falschen Aussage zur geprüften Korrektur, am Draht", () => {
  it("melden → zuordnen → zusammenführen → rückfragen → korrigieren → freigeben → rückmelden → erneut fragen → Rechteentzug", async () => {
    const b = await buehne();
    const { app } = b;

    // --- Melden: konkrete Aussage, Fundstelle, kurze Begründung --------------------------------
    const erst = await fragenUndAussage(app, b.melda, b.ko.id);
    const meldung = {
      koId: b.ko.id,
      receipt: erst.body.receipt,
      grund: "antwort-falsch",
      aussage: {
        aussageId: erst.aussage.aussageId,
        text: erst.aussage.text,
        fundstelleId: erst.fundstelleId,
      },
      begruendung: GRUND,
    };
    // Gegenproben: ohne Begründung, veränderter Wortlaut, ohne Sitzung, fremde Person.
    const ohneGrund = await post(app, b.melda, "/api/ask/report", { ...meldung, begruendung: "" });
    expect(ohneGrund.statusCode, ohneGrund.body).toBe(400);
    expect(
      (
        await post(app, b.melda, "/api/ask/report", {
          ...meldung,
          aussage: { ...meldung.aussage, text: `${erst.aussage.text} (geändert)` },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: "POST", url: "/api/ask/report", payload: meldung })).statusCode,
    ).toBe(401);
    expect((await post(app, b.dritte, "/api/ask/report", meldung)).statusCode).toBe(403);
    expect(await b.services.ask.listGaps()).toEqual([]);

    const res = await post(app, b.melda, "/api/ask/report", meldung);
    expect(res.statusCode, res.body).toBe(200);
    const quittung = res.json();
    expect(quittung).toMatchObject({
      koId: b.ko.id,
      zugestelltAn: "author-fallback",
      bereitsGemeldet: false,
      beanstandung: {
        answerId: erst.body.answerId,
        aussageId: erst.aussage.aussageId,
        fundstelleId: erst.fundstelleId,
        koVersion: 1,
        zusammengefuehrt: false,
        zustaendigkeit: "zugeordnet",
      },
    });
    expect(res.body, "die Quittung nennt die zuständige Person nicht").not.toContain(b.fachmann.id);
    const gapId = quittung.beanstandung.vorgangId as string;

    // Die bestehende Meldung erreicht die verantwortliche Person (Glocke), mit derselben Kennung.
    const beimFachmann = (await glocke(app, b.fachmann)).filter((m) => m.kind === "reklamation");
    expect(beimFachmann.map((m) => m.meldungId)).toEqual([quittung.meldungId]);

    // --- Wiederholung: eine zweite Person beanstandet dieselbe Aussage → derselbe Vorgang ---------
    const zweit = await fragenUndAussage(app, b.melvin, b.ko.id);
    const res2 = await post(app, b.melvin, "/api/ask/report", {
      koId: b.ko.id,
      receipt: zweit.body.receipt,
      grund: "quelle-passt-nicht",
      aussage: { aussageId: zweit.aussage.aussageId, text: zweit.aussage.text },
      begruendung: "Im Betrieb ist das Schmieren an der SP-7 nicht zulässig.",
    });
    expect(res2.statusCode, res2.body).toBe(200);
    expect(res2.json().beanstandung).toMatchObject({ vorgangId: gapId, zusammengefuehrt: true });

    // --- Aufgabenansicht: EIN Vorgang mit beiden Meldungen, keine zweite „Rückmeldung" ----------
    const qa = await app.inject({
      method: "GET",
      url: "/api/qualitaetsaufgaben",
      headers: b.admin.headers,
    });
    expect(qa.statusCode, qa.body).toBe(200);
    const vorgaenge = qa.json().vorgaenge as {
      schluessel: string;
      typ: string;
      einstiege: string[];
      zustaendig: { id: string }[];
      inhalt: { koId: string }[];
    }[];
    const eintrag = vorgaenge.find((v) => v.schluessel === `luecke:${gapId}`);
    expect(eintrag).toMatchObject({
      typ: "luecke",
      zustaendig: [{ id: b.fachmann.id }],
      inhalt: [{ koId: b.ko.id }],
    });
    expect(eintrag?.einstiege).toEqual(
      expect.arrayContaining([
        `rueckmeldung:${quittung.meldungId}`,
        `rueckmeldung:${res2.json().meldungId}`,
      ]),
    );
    expect(vorgaenge.filter((v) => v.typ === "rueckmeldung")).toEqual([]);

    // --- Eigener Vorgang des Melders; die zuständige Person sieht nur zulässigen Kontext --------
    const fuerMelda = await vorgang(app, b.melda, gapId);
    expect(fuerMelda.statusCode, fuerMelda.body).toBe(200);
    expect(fuerMelda.json()).toMatchObject({
      rollen: ["fragend"],
      beanstandung: { aussage: erst.aussage.text, meldungen: 2, fassungenDamals: [1] },
    });
    expect(fuerMelda.body).not.toContain(b.melvin.id);
    expect(fuerMelda.body).not.toContain("nicht zulässig");
    const fuerFachmann = await vorgang(app, b.fachmann, gapId);
    expect(fuerFachmann.json().beanstandung.begruendungen).toHaveLength(2);
    expect(fuerFachmann.body).not.toContain(b.melda.id);
    expect(fuerFachmann.body).not.toContain(b.melvin.id);
    // Die Frage der Meldenden reist nicht mit — der Vorgang trägt nur die Neutralbezeichnung.
    expect(fuerFachmann.json().question).toBe("Beanstandete Aussage einer Antwort");
    expect((await vorgang(app, b.dritte, gapId)).statusCode).toBe(404);
    const liste = await app.inject({ method: "GET", url: "/api/gaps", headers: b.dritte.headers });
    const inListe = (liste.json() as { id: string; question: string; beanstandung?: true }[]).find(
      (g) => g.id === gapId,
    );
    expect(inListe).toMatchObject({ beanstandung: true, question: "" });

    // --- Rückfrage und Antwort -------------------------------------------------------------
    const rf = await post(app, b.fachmann, `/api/gaps/${gapId}/rueckfrage`, {
      frage: "Welche Ausgabe des Wartungsblatts liegt dir vor?",
    });
    expect(rf.statusCode, rf.body).toBe(200);
    expect(
      (await glocke(app, b.melda)).filter((m) => m.kind === "luecke").map((m) => m.lueckenArt),
    ).toEqual(["rueckfrage"]);
    const antwort = await post(
      app,
      b.melda,
      `/api/gaps/${gapId}/rueckfrage/${rf.json().rueckfragen[0].id}/antwort`,
      { antwort: "Ausgabe 3 vom Hersteller." },
    );
    expect(antwort.statusCode, antwort.body).toBe(200);

    // --- Korrektur: unveränderte Fassung und ungeprüfte neue Fassung schliessen nicht ------------
    const ohneKorrektur = await post(app, b.fachmann, `/api/gaps/${gapId}/abschliessen`, {
      koId: b.ko.id,
    });
    expect(ohneKorrektur.statusCode, ohneKorrektur.body).toBe(400);
    await b.services.ko.revise(b.ko.id, { statement: RICHTIG }, b.fachmann.id);
    const ungeprueft = await post(app, b.fachmann, `/api/gaps/${gapId}/abschliessen`, {
      koId: b.ko.id,
    });
    expect(ungeprueft.statusCode, ungeprueft.body).toBe(400);
    expect(ungeprueft.json().gruende).toEqual(expect.arrayContaining(["bewertungen_fehlen"]));
    // Der Betrachter (ohne Erfassungsrecht) und Unbeteiligte schliessen nicht ab.
    expect(
      (await post(app, b.betrachter, `/api/gaps/${gapId}/abschliessen`, { koId: b.ko.id }))
        .statusCode,
    ).toBe(403);
    expect(
      (await post(app, b.dritte, `/api/gaps/${gapId}/zurueckweisen`, { begruendung: "Nein." }))
        .statusCode,
    ).toBe(403);

    // --- Freigabe der neuen Fassung → fachlicher Abschluss → Rückmeldung an beide Melder -------
    await b.freigeben(2);
    const zu = await post(app, b.fachmann, `/api/gaps/${gapId}/abschliessen`, { koId: b.ko.id });
    expect(zu.statusCode, zu.body).toBe(200);
    expect(zu.json()).toMatchObject({
      phase: "geloest",
      abschluss: { art: "fachlich", koVersion: 2 },
      ergebnis: { koId: b.ko.id, koVersion: 2, nutzbarkeit: { nutzbar: true } },
    });
    for (const k of [b.melda, b.melvin]) {
      const geloest = (await glocke(app, k)).filter(
        (m) => m.kind === "luecke" && m.lueckenArt === "geloest",
      );
      expect(geloest).toHaveLength(1);
      expect(geloest[0]).toMatchObject({ gapId, koId: b.ko.id });
    }

    // --- Erneut fragen: die Antwort steht auf Fassung 2; die alte Bindung bleibt Fassung 1 ------
    const neu = await post(app, b.melda, "/api/ask", { question: TITEL });
    expect(neu.json().quellenStand?.[b.ko.id]).toBe(2);
    expect(neu.json().result.answer).toContain("400");
    expect((await vorgang(app, b.melda, gapId)).json().beanstandung.fassungenDamals).toEqual([1]);

    // --- Rechteentzug: vertraulich → keine Erfolgsmeldung, kein Ergebnis ------------------------
    await b.services.ko.setConfidentiality(b.ko.id, "vertraulich", b.admin.id);
    const nachEntzug = await glocke(app, b.melvin);
    expect(nachEntzug.filter((m) => m.kind === "luecke" && m.lueckenArt === "geloest")).toEqual([]);
    const gesperrt = await vorgang(app, b.melvin, gapId);
    expect(gesperrt.json().ergebnis).toEqual({ zugaenglich: false });
    expect(gesperrt.body).not.toContain(RICHTIG);
  });

  it("begründete Zurückweisung: Begründung an den Melder, kein „gelöst“, Wissen unverändert", async () => {
    const b = await buehne();
    const { app } = b;
    const erst = await fragenUndAussage(app, b.melda, b.ko.id);
    const res = await post(app, b.melda, "/api/ask/report", {
      koId: b.ko.id,
      receipt: erst.body.receipt,
      grund: "antwort-falsch",
      aussage: { aussageId: erst.aussage.aussageId, text: erst.aussage.text },
      begruendung: GRUND,
    });
    expect(res.statusCode, res.body).toBe(200);
    const gapId = res.json().beanstandung.vorgangId as string;
    const BEGRUENDUNG =
      "Für SP-7 ab Baujahr 2024 gilt laut Ausgabe 4 das 40-Stunden-Intervall im Betrieb.";

    expect((await post(app, b.fachmann, `/api/gaps/${gapId}/zurueckweisen`, {})).statusCode).toBe(
      400,
    );
    const zurueck = await post(app, b.fachmann, `/api/gaps/${gapId}/zurueckweisen`, {
      begruendung: BEGRUENDUNG,
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(zurueck.json()).toMatchObject({
      phase: "zurueckgewiesen",
      abschluss: { art: "zurueckgewiesen", begruendung: BEGRUENDUNG, koVersion: 1 },
    });
    const fuerMelda = (await vorgang(app, b.melda, gapId)).json();
    expect(fuerMelda).toMatchObject({
      phase: "zurueckgewiesen",
      naechsterSchritt: "begruendung_lesen",
      abschluss: { art: "zurueckgewiesen", begruendung: BEGRUENDUNG, koId: b.ko.id },
      ergebnis: null,
    });
    const luecken = (await glocke(app, b.melda)).filter((m) => m.kind === "luecke");
    expect(luecken.map((m) => m.lueckenArt)).toEqual(["zurueckgewiesen"]);
    const liste = await app.inject({ method: "GET", url: "/api/gaps", headers: b.melda.headers });
    expect(
      (liste.json() as { id: string; abschlussArt?: string }[]).find((g) => g.id === gapId)
        ?.abschlussArt,
    ).toBe("zurueckgewiesen");
    expect(await b.services.ko.get(b.ko.id)).toMatchObject({ version: 1, statement: FALSCH });
  });
});
