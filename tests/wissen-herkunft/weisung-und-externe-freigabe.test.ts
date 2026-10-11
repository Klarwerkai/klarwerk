// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidungen 18/19 und 27 (Peter, 11.10.2026) — AM DRAHT.
// ================================================================================================
//
// Bens Befunde (Nacharbeit 6): die Entscheidungen liegen vor, die Umsetzung fehlte.
//
//   Entscheidung 18 · „Weisungsbefugnis ausdrücklich im Benutzerkonto und Zuständigkeitsbereich;
//                     technische Administration genügt nicht."            → B1–B6, W1, W3
//   Entscheidung 19 · „Unmittelbar gültige befugte Weisung mit nachfolgender zuständiger
//                     Sichtung."                                          → W2, W4, S1–S3
//   R-0573          · jeden betroffenen bestehenden Punkt einzeln entscheiden; überstimmte Punkte
//                     werden geschlossen, nicht gelöscht                  → P1–P3
//   K1/K4           · die befugte Herkunft bleibt, der Originalautor wird nicht umgeschrieben → W2
//   Entscheidung 27 · „Externe Freigabe und Provenienz übernehmen; interne Anwendbarkeit klären ohne
//                     pauschale zweite Inhaltsprüfung"; Wissensübernahme (R-0164) und ganzes
//                     Dokument als externe Referenz (R-0178) getrennt   → E1–E5
//
// Gefahren wird der echte Weg: `buildServices`/`buildApp`, Anmeldung über die Route, Vergabe der
// Befugnis über `PUT /api/users/:id`, Weisung/Sichtung/Übernahme über `PUT /api/kos/:id`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const KENNWORT = "secret123";
const ZUKUNFT = "2099-12-31";

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  const konto = async (name: string, email: string) =>
    services.auth.register({ name, email, password: KENNWORT });
  // Das erste Konto einer leeren Instanz ist Verwalter.
  const admin = await konto("Pia Admin", "pia@weisung.de");
  const anna = await konto("Anna Fach", "anna@weisung.de");
  await services.auth.approveUser(anna.id, admin.id);
  const bob = await konto("Bob Sichtet", "bob@weisung.de");
  await services.auth.approveUser(bob.id, admin.id);
  const carla = await konto("Carla Controller", "carla@weisung.de");
  await services.auth.approveUser(carla.id, admin.id);
  await services.auth.changeRole(carla.id, "controller", admin.id);

  const kopf = async (email: string) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    expect(login.statusCode, login.body).toBe(200);
    return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  };
  const koepfe = {
    admin: await kopf("pia@weisung.de"),
    anna: await kopf("anna@weisung.de"),
    bob: await kopf("bob@weisung.de"),
    carla: await kopf("carla@weisung.de"),
  };
  const objekt = (titel: string, category = "Technik", author = anna.id) =>
    services.ko.create({
      title: titel,
      statement: `${titel}: Anzugsmoment 10 Newtonmeter.`,
      type: "best_practice",
      category,
      author,
      confidentiality: "intern",
    });
  const put = (kopfzeile: Record<string, string>, koId: string, payload: object) =>
    app.inject({ method: "PUT", url: `/api/kos/${koId}`, headers: kopfzeile, payload });
  const befugnis = (userId: string, weisungsbefugnis: unknown) =>
    app.inject({
      method: "PUT",
      url: `/api/users/${userId}`,
      headers: koepfe.admin,
      payload: { weisungsbefugnis },
    });
  const holen = (kopfzeile: Record<string, string>, url: string) =>
    app.inject({ method: "GET", url, headers: kopfzeile });
  const lesen = async (kopfzeile: Record<string, string>, koId: string) => {
    const antwort = await holen(kopfzeile, `/api/kos/${koId}`);
    expect(antwort.statusCode).toBe(200);
    return antwort.json() as Record<string, unknown> & {
      status: string;
      author: string;
      originalAuthor: string;
      version: number;
      weisung?: Record<string, unknown> & { sichtung: Record<string, unknown> };
      externeFreigabe?: Record<string, unknown>;
      verifizierung?: { mensch: Record<string, unknown> };
    };
  };
  return { services, app, admin, anna, bob, carla, koepfe, objekt, put, befugnis, holen, lesen };
}

const weisung = (verantwortlich: string, extra: object = {}) => ({
  action: "weisung",
  sichtung: { verantwortlich, frist: ZUKUNFT },
  ...extra,
});

describe("Entscheidung 18 · die Weisungsbefugnis steht am Konto — nicht in der Rolle", () => {
  it("B1 · ohne Vermerk ist niemand weisungsbefugt, auch der Verwalter nicht", async () => {
    const b = await buehne();
    const ko = await b.objekt("Presse A");
    const antwort = await b.put(b.koepfe.admin, ko.id, weisung(b.bob.id));
    expect(antwort.statusCode, antwort.body).toBe(403);
    expect(antwort.json().error).toBe("WEISUNGSBEFUGNIS_FEHLT");
    expect((await b.lesen(b.koepfe.admin, ko.id)).status).toBe("offen");
  });

  it("B2 · erteilt über den Verwaltungsweg, sichtbar am eigenen Konto und in der Kontenliste", async () => {
    const b = await buehne();
    const vorher = await b.holen(b.koepfe.anna, "/api/auth/me");
    expect("weisungsbefugnis" in vorher.json()).toBe(false);

    const erteilt = await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    expect(erteilt.statusCode, erteilt.body).toBe(200);
    expect(erteilt.json().weisungsbefugnis).toMatchObject({
      bereiche: ["Technik"],
      gesamt: false,
      erteiltVon: b.admin.id,
    });

    const me = await b.holen(b.koepfe.anna, "/api/auth/me");
    expect(me.json().weisungsbefugnis).toMatchObject({ bereiche: ["Technik"], gesamt: false });
    const liste = await b.holen(b.koepfe.admin, "/api/users");
    const zeilen = liste.json() as { id: string; weisungsbefugnis?: unknown }[];
    expect(zeilen.find((u) => u.id === b.anna.id)?.weisungsbefugnis).toBeDefined();
    expect(zeilen.find((u) => u.id === b.bob.id)).not.toHaveProperty("weisungsbefugnis");
    // Im Prüfprotokoll steht, wer sie wem erteilt hat.
    const vermerk = await b.services.audit.list({
      action: "user.weisungsbefugnis",
      target: b.anna.id,
    });
    expect(vermerk.map((e) => e.actor)).toEqual([b.admin.id]);
  });

  it("B3 · eine ungültige Befugnis wird abgelehnt — und nichts im selben Aufruf geschrieben", async () => {
    const b = await buehne();
    const antwort = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.anna.id}`,
      headers: b.koepfe.admin,
      payload: { role: "controller", weisungsbefugnis: { bereiche: [] } },
    });
    expect(antwort.statusCode).toBe(403);
    expect(await b.services.auth.weisungsbefugnisVon(b.anna.id)).toBeUndefined();
    const anna = (await b.services.auth.listUsers()).find((u) => u.id === b.anna.id);
    expect(anna?.role).toBe("experte");
  });

  it("B4 · entzogen heißt: nicht mehr weisungsbefugt", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    expect((await b.befugnis(b.anna.id, null)).statusCode).toBe(200);
    const me = await b.holen(b.koepfe.anna, "/api/auth/me");
    expect("weisungsbefugnis" in me.json()).toBe(false);
    const ko = await b.objekt("Presse B");
    expect((await b.put(b.koepfe.anna, ko.id, weisung(b.bob.id))).statusCode).toBe(403);
  });

  it("B5 · Geschäftsführung: ausdrücklich „alle Bereiche“ — auch das nie aus der Rolle", async () => {
    const b = await buehne();
    await b.befugnis(b.admin.id, { gesamt: true });
    const ko = await b.objekt("Vertragsprüfung", "Recht", b.admin.id);
    const antwort = await b.put(b.koepfe.admin, ko.id, weisung(b.bob.id));
    expect(antwort.statusCode, antwort.body).toBe(200);
  });

  it("B6 · mit dem Konto endet die Befugnis", async () => {
    const b = await buehne();
    await b.befugnis(b.bob.id, { bereiche: ["Technik"] });
    await b.services.auth.deleteUser(b.bob.id, b.admin.id);
    expect(await b.services.auth.weisungsbefugnisVon(b.bob.id)).toBeUndefined();
  });
});

describe("Entscheidungen 18/19 · die Weisung gilt sofort, trägt ihre befugte Herkunft und wird gesichtet", () => {
  it("W1 · nur im eigenen fachlichen Bereich (Groß-/Kleinschreibung zählt nicht)", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["technik"] });
    const fremd = await b.objekt("Vertrag", "Recht");
    const abgelehnt = await b.put(b.koepfe.anna, fremd.id, weisung(b.bob.id));
    expect(abgelehnt.statusCode).toBe(403);
    expect(abgelehnt.json().error).toBe("WEISUNGSBEFUGNIS_FEHLT");
  });

  it("W2 · gültig ohne Vier-Augen-Prüfung, mit Herkunft „Weisung von wem, wann, Bereich“ — Originalautor unverändert", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    const ko = await b.objekt("Drehmoment Bolzen X", "Technik", b.carla.id);
    const antwort = await b.put(b.koepfe.anna, ko.id, weisung(b.bob.id));
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json()).toMatchObject({ status: "validiert" });
    expect(antwort.json().validationDecisionRef).not.toBeNull();

    const gelesen = await b.lesen(b.koepfe.anna, ko.id);
    expect(gelesen.status).toBe("validiert");
    expect(gelesen.weisung).toMatchObject({
      von: b.anna.id,
      bereich: "Technik",
      fassung: 1,
      bestehenGelassen: [],
      sichtung: { verantwortlich: b.bob.id, frist: ZUKUNFT },
    });
    expect(gelesen.weisung?.sichtung).not.toHaveProperty("gesichtetAm");
    // Die Weisung schreibt die Herkunft des Objekts nicht um.
    expect(gelesen.originalAuthor).toBe(b.carla.id);
    expect(gelesen.author).toBe(b.carla.id);
    // Die Marke nennt sie als eigene Entscheidungsart, aus dem verwiesenen Protokolleintrag.
    expect(gelesen.verifizierung?.mensch).toMatchObject({
      stand: "belegt",
      art: "weisung",
      pruefer: b.anna.id,
      aktuell: true,
    });
    const belege = await b.services.audit.list({ action: "ko.weisung", target: ko.id });
    expect(belege.map((e) => e.actor)).toEqual([b.anna.id]);
    // Keine Bewertung entstanden — es war keine Peer-Prüfung.
    expect(await b.services.audit.list({ action: "ko.rated", target: ko.id })).toEqual([]);
  });

  it("W3 · die Sichtung ist Pflicht: ohne Person, durch sich selbst oder mit vergangener Frist wird nicht gewiesen", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    const ko = await b.objekt("Presse C");
    const vergangen = {
      action: "weisung",
      sichtung: { verantwortlich: b.bob.id, frist: "2020-01-01" },
    };
    for (const [fall, payload] of [
      ["ohne Sichtung", { action: "weisung" }],
      ["sich selbst", weisung(b.anna.id)],
      ["vergangene Frist", vergangen],
      ["kein Konto", weisung("niemand-hier")],
    ] as const) {
      const antwort = await b.put(b.koepfe.anna, ko.id, payload);
      expect(antwort.statusCode, `${fall}: ${antwort.body}`).toBe(400);
    }
    expect((await b.lesen(b.koepfe.anna, ko.id)).status).toBe("offen");
  });

  it("S1–S3 · gesichtet wird nur von der benannten Person, einmal — die Weisung bleibt gültig", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    const ko = await b.objekt("Presse D");
    expect((await b.put(b.koepfe.anna, ko.id, weisung(b.bob.id))).statusCode).toBe(200);

    const fremd = await b.put(b.koepfe.carla, ko.id, { action: "weisung-sichten" });
    expect(fremd.statusCode).toBe(403);
    expect(fremd.json().error).toBe("SICHTUNG_NICHT_ZUSTAENDIG");

    const gesichtet = await b.put(b.koepfe.bob, ko.id, {
      action: "weisung-sichten",
      vermerk: "Passt zum Herstellerblatt.",
    });
    expect(gesichtet.statusCode, gesichtet.body).toBe(200);
    const gelesen = await b.lesen(b.koepfe.bob, ko.id);
    expect(gelesen.weisung?.sichtung).toMatchObject({
      verantwortlich: b.bob.id,
      gesichtetVon: b.bob.id,
      vermerk: "Passt zum Herstellerblatt.",
    });
    expect(typeof gelesen.weisung?.sichtung.gesichtetAm).toBe("string");
    expect(gelesen.status).toBe("validiert");
    expect(
      (await b.services.audit.list({ action: "ko.weisung-gesichtet", target: ko.id })).map(
        (e) => e.actor,
      ),
    ).toEqual([b.bob.id]);

    const nochmal = await b.put(b.koepfe.bob, ko.id, { action: "weisung-sichten" });
    expect(nochmal.statusCode).toBe(409);
  });
});

describe("R-0573 · jeder betroffene bestehende Punkt einzeln — geschlossen wird über den Konflikt, nicht gelöscht", () => {
  it("P1 · offene Punkte werden einzeln vorgelegt, und es wird nicht gewiesen", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    const ko = await b.objekt("Bolzen X: 10 Nm");
    const alt = await b.objekt("Alle Bolzen handfest");
    const konflikt = await b.services.conflicts.create(
      { koA: ko.id, koB: alt.id, type: "truth", description: "10 Nm gegen handfest" },
      b.admin.id,
    );
    const antwort = await b.put(b.koepfe.anna, ko.id, weisung(b.bob.id));
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({
      error: "WEISUNG_PUNKTE_OFFEN",
      punkte: [{ conflictId: konflikt.id, koId: alt.id, titel: "Alle Bolzen handfest" }],
    });
    expect((await b.lesen(b.koepfe.anna, ko.id)).status).toBe("offen");
  });

  it("P2 · ausdrücklich bestehen gelassen: gewiesen, der Punkt bleibt offen und unverändert", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    const ko = await b.objekt("Bolzen Y: 12 Nm");
    const alt = await b.objekt("Bolzen allgemein");
    const konflikt = await b.services.conflicts.create(
      { koA: ko.id, koB: alt.id, type: "truth", description: "12 Nm gegen allgemein" },
      b.admin.id,
    );
    const antwort = await b.put(
      b.koepfe.anna,
      ko.id,
      weisung(b.bob.id, { bestehenLassen: [konflikt.id] }),
    );
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect((await b.lesen(b.koepfe.anna, ko.id)).weisung?.bestehenGelassen).toEqual([konflikt.id]);
    // Nichts gelöscht, nichts still überstimmt: der Punkt und sein Gegenstück stehen da.
    expect((await b.services.conflicts.unresolved()).map((c) => c.id)).toContain(konflikt.id);
    expect((await b.lesen(b.koepfe.anna, alt.id)).status).toBe("offen");
  });

  it("P3 · ein für die weisende Person unsichtbarer Punkt sperrt — ohne ihn zu nennen", async () => {
    const b = await buehne();
    await b.befugnis(b.anna.id, { bereiche: ["Technik"] });
    const ko = await b.objekt("Bolzen Z");
    const geheim = await b.services.ko.create({
      title: "Vertrauliche Gegenanweisung",
      statement: "Nur für die Leitung.",
      type: "best_practice",
      category: "Technik",
      author: b.admin.id,
      confidentiality: "vertraulich",
    });
    await b.services.conflicts.create(
      { koA: ko.id, koB: geheim.id, type: "truth", description: "verdeckt" },
      b.admin.id,
    );
    const antwort = await b.put(b.koepfe.anna, ko.id, weisung(b.bob.id));
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json().error).toBe("WEISUNG_PUNKT_VERBORGEN");
    expect(antwort.body).not.toContain("Vertrauliche Gegenanweisung");
    expect(antwort.body).not.toContain(geheim.id);
  });
});

describe("Entscheidung 27 · externe Freigabe übernehmen, interne Anwendbarkeit bestätigen — keine zweite Inhaltsprüfung", () => {
  const extern = (
    zustaendig: string,
    art: "wissen" | "referenz" = "wissen",
    extra: object = {},
  ) => ({
    action: "externe-freigabe",
    externeFreigabe: {
      art,
      herausgeber: "Hersteller GmbH",
      freigegebenAm: "2026-05-01",
      freigabeKennung: "HB-4711 Rev. 3",
      nachweis: "https://example.org/freigabe/hb-4711",
      zustaendig,
      anwendbarBestaetigt: true,
      ...extra,
    },
  });

  it("E1 · R-0164: übernommen mit Herkunft, Geltung = Bereich, zuständige Person — ohne Bewertungsrunde", async () => {
    const b = await buehne();
    const ko = await b.objekt("Wartung nach Herstellerhandbuch");
    const antwort = await b.put(b.koepfe.carla, ko.id, extern(b.bob.id));
    expect(antwort.statusCode, antwort.body).toBe(200);
    const gelesen = await b.lesen(b.koepfe.carla, ko.id);
    expect(gelesen.status).toBe("validiert");
    expect(gelesen.externeFreigabe).toMatchObject({
      art: "wissen",
      herausgeber: "Hersteller GmbH",
      freigegebenAm: "2026-05-01",
      freigabeKennung: "HB-4711 Rev. 3",
      nachweis: "https://example.org/freigabe/hb-4711",
      geltung: "Technik",
      zustaendig: b.bob.id,
      bestaetigtVon: b.carla.id,
      fassung: 1,
    });
    expect(gelesen.verifizierung?.mensch).toMatchObject({
      art: "externe_freigabe",
      pruefer: b.carla.id,
    });
    expect(gelesen.originalAuthor).toBe(b.anna.id);
    expect(await b.services.audit.list({ action: "ko.rated", target: ko.id })).toEqual([]);
    expect(
      (await b.services.audit.list({ action: "ko.externe-freigabe-uebernommen", target: ko.id }))
        .length,
    ).toBe(1);
  });

  it("E2 · ohne ausdrückliche Bestätigung der Anwendbarkeit wird nichts übernommen", async () => {
    const b = await buehne();
    const ko = await b.objekt("Ohne Bestätigung");
    const antwort = await b.put(
      b.koepfe.carla,
      ko.id,
      extern(b.bob.id, "wissen", { anwendbarBestaetigt: false }),
    );
    expect(antwort.statusCode).toBe(400);
    const gelesen = await b.lesen(b.koepfe.carla, ko.id);
    expect(gelesen.status).toBe("offen");
    expect(gelesen).not.toHaveProperty("externeFreigabe");
  });

  it("E3 · zuständig muss ein Konto sein; wer nicht prüfen darf, übernimmt nicht", async () => {
    const b = await buehne();
    const ko = await b.objekt("Zuständigkeit");
    expect((await b.put(b.koepfe.carla, ko.id, extern("niemand-hier"))).statusCode).toBe(400);
    expect((await b.put(b.koepfe.anna, ko.id, extern(b.bob.id))).statusCode).toBe(403);
  });

  it("E4 · R-0178: ganzes Dokument als externe Referenz — nur mit dem Dokument am Objekt", async () => {
    const b = await buehne();
    const ko = await b.objekt("Design-Leitfaden");
    const ohne = await b.put(b.koepfe.carla, ko.id, extern(b.bob.id, "referenz"));
    expect(ohne.statusCode).toBe(400);

    const angehaengt = await b.put(b.koepfe.carla, ko.id, {
      action: "attach",
      attachment: {
        name: "leitfaden.png",
        mime: "image/png",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
    });
    expect(angehaengt.statusCode, angehaengt.body).toBe(200);
    const mit = await b.put(b.koepfe.carla, ko.id, extern(b.bob.id, "referenz"));
    expect(mit.statusCode, mit.body).toBe(200);
    expect((await b.lesen(b.koepfe.carla, ko.id)).externeFreigabe).toMatchObject({
      art: "referenz",
      herausgeber: "Hersteller GmbH",
    });
  });

  it("E5 · ein Nachweis muss eine http(s)-Adresse sein", async () => {
    const b = await buehne();
    const ko = await b.objekt("Nachweisform");
    const antwort = await b.put(
      b.koepfe.carla,
      ko.id,
      extern(b.bob.id, "wissen", { nachweis: "javascript:alert(1)" }),
    );
    expect(antwort.statusCode).toBe(400);
  });
});
