// ================================================================================================
// ADMIN-10 · QUALITÄTSAUFGABEN UND RÜCKMELDUNGEN — AM ECHTEN DRAHT, MIT FIKTIVEM BESTAND.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben. Gefahren wird die vollständige App (`buildApp`) über
// HTTP mit echten Anmeldungen. Alle Personen, Titel und Texte sind erfunden. Der Bestand trägt jeden
// gelieferten Vorgangstyp: Prüfung (mit zwei Prüferzuweisungen), Revalidierung (zweimal angefordert,
// mit Frist), Konflikt, Duplikat, Wissenslücke und belegte Rückmeldungen über den vorhandenen Weg
// `POST /api/ask` → `POST /api/ask/report` (R-1089).
//
//   Z1  Einmal gezählt: jeder Eintrag verweist auf den bestehenden Vorgang; mehrere Einstiege
//       (Board + Zuweisungen, zwei Anforderungen, ein Paar mit zwei Inhalten) ergeben EINEN Eintrag.
//   Z2  Typ, Zustand, Zuständigkeit und Frist: fehlende Zuständigkeit/Frist sind ausdrücklich leer.
//   Z3  Rückmeldung → Aufgabe: Übernehmen fordert die vorhandene Revalidierung an; wiederholt =
//       „bereits", eine zweite Meldung hängt sich an denselben Vorgang — kein Duplikat.
//   Z4  Abschluss am Ursprung (`PUT /api/kos/:id` „revalidate") schliesst genau diesen Vorgang;
//       die Rückmeldungen zeigen Ergebnis und Rückbezug, ein anderer Vorgang bleibt offen, und eine
//       spätere Meldung ist wieder offen.
//   Z5  Mehrbenutzer: zwei gleichzeitige Übernahmen ergeben genau einen Beleg und eine Anforderung.
//   Z6  Rechte: ohne `users.manage` 401/403; ein Objekt in einem nicht lesbaren Space fehlt in Liste
//       und Zahl, und Übernehmen antwortet 404 ohne zu schreiben.
//   Z7  Fehlende Signale: Übernahme ohne Anforderung und Bestätigung ist „unklar", nie „erledigt";
//       eine gescheiterte Quelle steht als „fehler", die übrigen Einträge bleiben.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type QualitaetsDeps,
  type QualitaetsUebersicht,
  type QualitaetsVorgang,
  RUECKMELDUNG_UEBERNOMMEN,
  ladeQualitaetsaufgaben,
  uebernahmeEventId,
  uebernimmRueckmeldung,
} from "../../services/app/src/qualitaetsaufgaben";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { ANTWORT_MELDUNG_ACTION } from "../../services/ask";
import {
  InMemoryLifecycleRepo,
  LifecycleService,
  REVALIDIERUNG_ANGEFORDERT,
} from "../../services/lifecycle";

type App = ReturnType<typeof buildApp>;
type Services = ReturnType<typeof buildServices>;
type Konto = { headers: { authorization: string }; id: string };

// Fiktives Testkennwort eines isolierten Speicheraufbaus — kein echtes Geheimnis.
const KENNWORT = "fiktiv-12345";
const TITEL_PRUEFUNG = "Fiktiv: Zahnriemen Z-3 nach 400 Stunden tauschen";
const TITEL_REVALIDIERUNG = "Fiktiv: Kühlmittel K-9 monatlich auf Keime prüfen";
const TITEL_PARTNER = "Fiktiv: Lagerschale L-2 mit Fett F-1 einsetzen";
const TITEL_RUECKMELDUNG = "Fiktiv: Spindel SP-8 nur im Stillstand reinigen";
const TITEL_ANDERE = "Fiktiv: Werkbank W-4 wöchentlich entstauben";
const TITEL_GESPERRT = "Fiktiv: Presse P-6 vor Schichtbeginn entlüften";

async function login(app: App, email: string): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const headers = { authorization: `Bearer ${res.json().token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: me.json().id as string };
}

async function anlegen(app: App, wer: Konto, title: string, extra: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer.headers,
    payload: {
      confidentiality: "intern",
      title,
      statement: `${title}. Ein erfundener Satz nur für diese Prüfung.`,
      type: "best_practice",
      ...extra,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function aktion(app: App, wer: Konto, id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: wer.headers, payload });
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Verwaltung", email: "ada@admin10.test", password: KENNWORT },
  });
  const admin = await login(app, "ada@admin10.test");
  for (const [name, email, role] of [
    ["Alex Autorin", "autorin@admin10.test", "experte"],
    ["Pia Prüferin", "pruefer1@admin10.test", "controller"],
    ["Paul Prüfer", "pruefer2@admin10.test", "controller"],
    ["Fritz Fragend", "frager@admin10.test", "experte"],
    ["Cora Controller", "controller@admin10.test", "controller"],
    ["Bea Verwaltung", "bea@admin10.test", "admin"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  return {
    services,
    app,
    admin,
    autorin: await login(app, "autorin@admin10.test"),
    pruefer1: await login(app, "pruefer1@admin10.test"),
    pruefer2: await login(app, "pruefer2@admin10.test"),
    frager: await login(app, "frager@admin10.test"),
    controller: await login(app, "controller@admin10.test"),
    bea: await login(app, "bea@admin10.test"),
  };
}

type Aufbau = Awaited<ReturnType<typeof setup>>;

/** Ein freigegebenes Objekt — nur daraus antwortet der Frageweg und nur das ist meldbar. */
async function freigegeben(a: Aufbau, title: string): Promise<string> {
  const id = await anlegen(a.app, a.autorin, title);
  expect((await aktion(a.app, a.admin, id, { action: "admin-validate" })).statusCode).toBe(200);
  return id;
}

/** Eine belegte Rückmeldung über den vorhandenen Weg (Frage → Beleg → Meldung). */
async function melden(
  a: Aufbau,
  koId: string,
  title: string,
  grund: "antwort-falsch" | "quelle-passt-nicht",
): Promise<string> {
  const frage = await a.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: a.frager.headers,
    payload: { question: title },
  });
  const body = frage.json() as { receipt?: string; result?: { citedSources?: string[] } };
  // Kalibrierung: ohne diese Quelle im Beleg mässe jeder folgende Schritt nur die 403.
  expect(body.result?.citedSources ?? []).toContain(koId);
  const res = await a.app.inject({
    method: "POST",
    url: "/api/ask/report",
    headers: a.frager.headers,
    payload: { koId, receipt: body.receipt, grund },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().meldungId as string;
}

async function uebersicht(a: Aufbau, wer: Konto = a.admin): Promise<QualitaetsUebersicht> {
  const res = await a.app.inject({
    method: "GET",
    url: "/api/qualitaetsaufgaben",
    headers: wer.headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as QualitaetsUebersicht;
}

function eintrag(u: QualitaetsUebersicht, schluessel: string): QualitaetsVorgang | undefined {
  return u.vorgaenge.find((v) => v.schluessel === schluessel);
}

function anzahl(u: QualitaetsUebersicht, schluessel: string): number {
  return u.vorgaenge.filter((v) => v.schluessel === schluessel).length;
}

const uebernehmen = (a: Aufbau, wer: Konto, meldungId: string) =>
  a.app.inject({
    method: "POST",
    url: `/api/qualitaetsaufgaben/rueckmeldungen/${meldungId}/uebernehmen`,
    headers: wer.headers,
  });

async function belege(services: Services, action: string, target?: string) {
  return services.audit.list(target === undefined ? { action } : { action, target });
}

/** Die Abhängigkeiten der Übersicht, wie die Kompositionswurzel sie verdrahtet. */
function depsVon(services: Services): QualitaetsDeps {
  return {
    ko: services.ko,
    validation: services.validation,
    lifecycle: services.lifecycle,
    conflicts: services.conflicts,
    overlaps: services.overlaps,
    ask: services.ask,
    audit: services.audit,
    konten: () => services.auth.listUsers(),
    spaces: services.spaces,
  };
}

/** Fehlerinjektion: die Merkerablage des Lebenszyklus scheitert die ersten `ausfaelle` Male. */
class AusfallRepo extends InMemoryLifecycleRepo {
  constructor(private ausfaelle: number) {
    super();
  }

  override async markPending(koId: string): Promise<void> {
    if (this.ausfaelle > 0) {
      this.ausfaelle -= 1;
      throw new Error("Fiktiv: Merkerablage nicht erreichbar");
    }
    return super.markPending(koId);
  }
}

describe("ADMIN-10 · Z1/Z2 · eine Ansicht auf bestehende Vorgänge, jeder einmal gezählt", () => {
  it("alle Vorgangstypen, mehrfach erreichbare Vorgänge einmal, fehlende Zuständigkeit/Frist ausdrücklich", async () => {
    const a = await setup();
    // Prüfung mit zwei Prüferzuweisungen: Board + zwei Zuweisungen = drei Einstiege, EIN Vorgang.
    const pruefung = await anlegen(a.app, a.autorin, TITEL_PRUEFUNG);
    const zuweisen = await aktion(a.app, a.admin, pruefung, {
      action: "assign",
      userIds: [a.pruefer1.id, a.pruefer2.id],
    });
    expect(zuweisen.statusCode).toBe(204);
    // Revalidierung mit Frist in der Vergangenheit, zweimal angefordert — EIN Merker.
    const reval = await anlegen(a.app, a.autorin, TITEL_REVALIDIERUNG, {
      revalidierungAm: "2020-01-15",
    });
    const freigabe = await aktion(a.app, a.admin, reval, { action: "admin-validate" });
    expect(freigabe.statusCode).toBe(200);
    for (let i = 0; i < 2; i += 1) {
      const r = await aktion(a.app, a.admin, reval, { action: "request-revalidation" });
      expect(r.statusCode).toBe(204);
    }
    const partner = await freigegeben(a, TITEL_PARTNER);
    // Konflikt und Duplikat am vorhandenen Dienst (kein Modell im Prüfaufbau).
    const konflikt = await a.services.conflicts.create(
      {
        koA: pruefung,
        koB: reval,
        type: "experience",
        description: "Fiktiv: Intervall widerspricht der Herstellerangabe.",
      },
      a.admin.id,
    );
    const duplikat = await a.services.overlaps.createAuto(
      {
        koA: reval,
        koB: partner,
        relation: "teilweise",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "verwandt_verlinken",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.4 },
      a.admin.id,
    );
    // Wissenslücke: eine Frage ohne tragende Quelle (Fragetext gehört dem Fragenden).
    await a.app.inject({
      method: "POST",
      url: "/api/ask",
      headers: a.frager.headers,
      payload: { question: "Wie hoch ist der Solldruck der Anlage Q-77?" },
    });
    const luecke = (await a.services.ask.listGaps()).find((g) => g.status === "offen");
    expect(luecke, "Kalibrierung: die unbeantwortete Frage hat eine Lücke angelegt").toBeDefined();

    const u = await uebersicht(a);

    // Z1 · jeder Schlüssel genau einmal; Gesamtzahl = Zahl der verschiedenen Vorgänge.
    const schluessel = u.vorgaenge.map((v) => v.schluessel);
    expect(new Set(schluessel).size).toBe(schluessel.length);
    expect(Object.values(u.quellen).every((q) => q === "ok")).toBe(true);

    const p = eintrag(u, `pruefung:${pruefung}`);
    expect(anzahl(u, `pruefung:${pruefung}`)).toBe(1);
    expect(p?.ursprung).toEqual({ art: "ko", id: pruefung });
    expect(p?.arbeitsweg).toBe(`/wissen/${pruefung}`);
    expect(p?.einstiege).toEqual(
      expect.arrayContaining([
        "pruefboard",
        `zuweisung:${a.pruefer1.id}`,
        `zuweisung:${a.pruefer2.id}`,
      ]),
    );
    expect(p?.zustand).toBe("in_arbeit");
    expect(p?.zustaendig.map((z) => [z.name, z.art]).sort()).toEqual([
      ["Paul Prüfer", "pruefer"],
      ["Pia Prüferin", "pruefer"],
    ]);
    expect(p?.frist).toBeNull();
    expect(p?.seit).not.toBeNull();

    const r = eintrag(u, `revalidierung:${reval}`);
    expect(anzahl(u, `revalidierung:${reval}`)).toBe(1);
    expect(r?.arbeitsweg).toBe(`/lebenszyklus?fall=${reval}`);
    expect(r?.frist).toBe("2020-01-15");
    expect(r?.ueberfaellig).toBe(true);
    const autorinErsatz = { id: a.autorin.id, name: "Alex Autorin", art: "autor-ersatz" };
    expect(r?.zustaendig).toEqual([autorinErsatz]);
    expect(r?.einstiege).toEqual(
      expect.arrayContaining(["lebenszyklus", "anforderung:bibliothek"]),
    );
    // Keine Kopie: der Lebenszyklus kennt genau denselben einen Merker.
    const pending = await a.app.inject({
      method: "GET",
      url: "/api/lifecycle/pending",
      headers: a.admin.headers,
    });
    expect((pending.json() as string[]).filter((id) => id === reval)).toHaveLength(1);
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, reval)).toHaveLength(2);

    const k = eintrag(u, `konflikt:${konflikt.id}`);
    expect(anzahl(u, `konflikt:${konflikt.id}`)).toBe(1);
    expect(k?.ursprung).toEqual({ art: "konflikt", id: konflikt.id });
    expect(k?.arbeitsweg).toBe(`/konflikte?fall=${konflikt.id}`);
    expect(k?.inhalt.map((i) => i.koId).sort()).toEqual([pruefung, reval].sort());
    expect(k?.zustaendig).toEqual([]);
    expect(k?.frist).toBeNull();

    const d = eintrag(u, `duplikat:${duplikat.id}`);
    expect(anzahl(u, `duplikat:${duplikat.id}`)).toBe(1);
    expect(d?.arbeitsweg).toBe(`/duplikate/${duplikat.id}/vergleich`);
    expect(d?.inhalt).toHaveLength(2);

    const g = eintrag(u, `luecke:${luecke?.id}`);
    expect(g?.arbeitsweg).toBe(`/risiko?fall=${luecke?.id}`);
    // R-0585: die Verwaltung ist nicht zuständig — der Fragetext bleibt zurückgehalten.
    expect(g?.titel).toBeNull();
    expect(JSON.stringify(u)).not.toContain("Solldruck");
    expect(g?.zustaendig).toEqual([]);
  });
});

describe("ADMIN-10 · Z3/Z4 · Rückmeldung als Aufgabe, Abschluss am Ursprung", () => {
  it("übernehmen, wiederholen, anhängen, abschliessen — Ergebnis und Rückbezug, nichts mitgeschlossen", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const andere = await freigegeben(a, TITEL_ANDERE);
    const m1 = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    const m2 = await melden(a, ko, TITEL_RUECKMELDUNG, "quelle-passt-nicht");
    expect(m1).not.toBe(m2);
    // Ein anderer, unabhängiger Vorgang, der vom Abschluss NICHT berührt werden darf.
    const anfordern = await aktion(a.app, a.admin, andere, { action: "request-revalidation" });
    expect(anfordern.statusCode).toBe(204);

    const vorher = await uebersicht(a);
    const r1 = eintrag(vorher, `rueckmeldung:${m1}`);
    expect(r1?.typ).toBe("rueckmeldung");
    expect(r1?.zustand).toBe("offen");
    expect(r1?.grund).toBe("antwort-falsch");
    expect(r1?.zustaendig).toEqual([
      { id: a.autorin.id, name: "Alex Autorin", art: "autor-ersatz" },
    ]);
    expect(r1?.arbeitsweg).toBe(`/wissen/${ko}`);
    expect(eintrag(vorher, `revalidierung:${ko}`)).toBeUndefined();

    // Übernehmen → die vorhandene Prüfanforderung, nicht ein neuer Aufgabentyp.
    const erst = await uebernehmen(a, a.admin, m1);
    expect(erst.statusCode, erst.body).toBe(200);
    expect(erst.json()).toMatchObject({ art: "angelegt", vorgang: `revalidierung:${ko}` });
    const nochmal = await uebernehmen(a, a.admin, m1);
    expect(nochmal.json()).toMatchObject({
      art: "bereits",
      durch: { id: a.admin.id, name: "Ada Verwaltung" },
    });
    // Die zweite Meldung zum selben Objekt hängt sich an DENSELBEN Vorgang.
    expect((await uebernehmen(a, a.admin, m2)).json()).toMatchObject({ art: "angehaengt" });

    expect(await belege(a.services, RUECKMELDUNG_UEBERNOMMEN, ko)).toHaveLength(2);
    const anforderungen = await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko);
    expect(anforderungen).toHaveLength(1);
    expect(anforderungen[0]?.payload).toMatchObject({ grund: "rueckmeldung", meldungId: m1 });

    const mitte = await uebersicht(a);
    const reval = eintrag(mitte, `revalidierung:${ko}`);
    expect(anzahl(mitte, `revalidierung:${ko}`)).toBe(1);
    expect(reval?.rueckmeldungen?.map((x) => x.meldungId).sort()).toEqual([m1, m2].sort());
    const erwartet = [`rueckmeldung:${m1}`, `rueckmeldung:${m2}`, "anforderung:rueckmeldung"];
    expect(reval?.einstiege).toEqual(expect.arrayContaining(erwartet));
    // Einmal gezählt: die übernommenen Meldungen stehen NICHT zusätzlich als eigene Einträge da.
    expect(eintrag(mitte, `rueckmeldung:${m1}`)).toBeUndefined();
    expect(eintrag(mitte, `rueckmeldung:${m2}`)).toBeUndefined();
    expect(eintrag(mitte, `revalidierung:${andere}`)?.zustand).toBe("offen");

    // Abschluss im bestehenden Arbeitsweg: „stimmt noch" am Objekt, durch die Autorin.
    const abschluss = await aktion(a.app, a.autorin, ko, { action: "revalidate" });
    expect(abschluss.statusCode, abschluss.body).toBe(200);

    const nachher = await uebersicht(a);
    expect(eintrag(nachher, `revalidierung:${ko}`)).toBeUndefined();
    for (const m of [m1, m2]) {
      const e = eintrag(nachher, `rueckmeldung:${m}`);
      expect(e?.zustand, `Meldung ${m}`).toBe("erledigt");
      expect(e?.ergebnis).toMatchObject({
        art: "bestaetigt",
        durch: { id: a.autorin.id, name: "Alex Autorin" },
      });
      expect(e?.uebernahme).toMatchObject({
        vorgang: `revalidierung:${ko}`,
        durch: { id: a.admin.id },
      });
      expect(e?.arbeitsweg).toBe(`/wissen/${ko}`);
    }
    // Nicht pauschal mitgeschlossen: der andere Vorgang bleibt offen.
    expect(eintrag(nachher, `revalidierung:${andere}`)?.zustand).toBe("offen");

    // Eine spätere Meldung ist ein neuer, offener Vorgang — der alte Abschluss gilt nicht für sie.
    // (Die Bestätigung legt eine neue Fassung an, die erst wieder freigegeben sein muss, bevor der
    // Frageweg aus ihr antwortet — `KoService.revise`.)
    expect((await aktion(a.app, a.admin, ko, { action: "admin-validate" })).statusCode).toBe(200);
    const m3 = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    expect(m3).not.toBe(m1);
    const spaeter = await uebersicht(a);
    expect(eintrag(spaeter, `rueckmeldung:${m3}`)?.zustand).toBe("offen");
  });
});

describe("ADMIN-10 · Z5/Z6 · Mehrbenutzer und Rechte", () => {
  it("zwei gleichzeitige Übernahmen: ein Beleg, eine Anforderung, die zweite Person sieht „bereits“", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    const [x, y] = await Promise.all([uebernehmen(a, a.admin, m), uebernehmen(a, a.bea, m)]);
    const arten = [x.json().art, y.json().art].sort();
    expect(arten).toEqual(["angelegt", "bereits"]);
    expect(await belege(a.services, RUECKMELDUNG_UEBERNOMMEN, ko)).toHaveLength(1);
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko)).toHaveLength(1);
    // Beide Verwaltungskonten sehen danach denselben frischen Stand.
    for (const wer of [a.admin, a.bea]) {
      const u = await uebersicht(a, wer);
      expect(anzahl(u, `revalidierung:${ko}`)).toBe(1);
      expect(eintrag(u, `rueckmeldung:${m}`)).toBeUndefined();
    }
  });

  it("ohne Verwaltungsrecht keine Tür; ein Objekt in fremdem Space fehlt in Liste und Zahl", async () => {
    const a = await setup();
    for (const [wer, status] of [
      [a.controller, 403],
      [a.autorin, 403],
      [a.frager, 403],
    ] as const) {
      const liste = await a.app.inject({
        method: "GET",
        url: "/api/qualitaetsaufgaben",
        headers: wer.headers,
      });
      expect(liste.statusCode).toBe(status);
    }
    const anonym = await a.app.inject({ method: "GET", url: "/api/qualitaetsaufgaben" });
    expect(anonym.statusCode).toBe(401);

    const offen = await freigegeben(a, TITEL_RUECKMELDUNG);
    const gesperrt = await freigegeben(a, TITEL_GESPERRT);
    const mOffen = await melden(a, offen, TITEL_RUECKMELDUNG, "antwort-falsch");
    const mGesperrt = await melden(a, gesperrt, TITEL_GESPERRT, "antwort-falsch");
    // Die Controllerin darf auch die Meldung nicht übernehmen (Tor vor jeder Auskunft).
    expect((await uebernehmen(a, a.controller, mOffen)).statusCode).toBe(403);

    const vorher = await uebersicht(a);
    expect(eintrag(vorher, `rueckmeldung:${mGesperrt}`)).toBeDefined();
    const vorherZahl = vorher.vorgaenge.length;

    // Das Objekt wandert in einen Space, den die Verwaltung nicht lesen darf (kein Durchgriff).
    await a.services.ko.setLeadingSpace(gesperrt, "space-fiktiv-geschlossen", a.admin.id, null);
    const nachher = await uebersicht(a);
    expect(eintrag(nachher, `rueckmeldung:${mGesperrt}`)).toBeUndefined();
    expect(eintrag(nachher, `rueckmeldung:${mOffen}`)).toBeDefined();
    expect(nachher.vorgaenge.length).toBe(vorherZahl - 1);
    expect(JSON.stringify(nachher)).not.toContain(TITEL_GESPERRT);

    const versuch = await uebernehmen(a, a.admin, mGesperrt);
    expect(versuch.statusCode).toBe(404);
    expect(versuch.body).not.toContain(TITEL_GESPERRT);
    expect(await belege(a.services, RUECKMELDUNG_UEBERNOMMEN, gesperrt)).toHaveLength(0);
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, gesperrt)).toHaveLength(0);
    // Unbekannte Kennung: dieselbe Antwort, keine Existenzauskunft.
    expect((await uebernehmen(a, a.admin, "M-UNBEKANNT0")).statusCode).toBe(404);
  });
});

describe("ADMIN-10 · Z7 · fehlende Datensignale erscheinen nicht als erledigt", () => {
  it("Übernahme ohne Anforderung und ohne Bestätigung ist „unklar“", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    // Fehlerinjektion: der Übernahmebeleg steht, die Prüfanforderung danach ist ausgefallen.
    await a.services.audit.recordOnce(uebernahmeEventId(m), {
      actor: a.admin.id,
      action: RUECKMELDUNG_UEBERNOMMEN,
      target: ko,
      payload: { meldungId: m, vorgang: `revalidierung:${ko}` },
    });
    const u = await uebersicht(a);
    const e = eintrag(u, `rueckmeldung:${m}`);
    expect(e?.zustand).toBe("unklar");
    expect(e?.ergebnis).toBeUndefined();
    expect(u.vorgaenge.some((v) => v.zustand === "erledigt")).toBe(false);
    // Ben (Nacharbeit 2): ein erneutes Übernehmen holt die fehlende Anforderung nach — genau einmal.
    const fortsetzen = await uebernehmen(a, a.admin, m);
    expect(fortsetzen.json()).toMatchObject({ art: "nachgeholt", durch: { id: a.admin.id } });
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko)).toHaveLength(1);
    expect(eintrag(await uebersicht(a), `revalidierung:${ko}`)?.rueckmeldungen).toEqual([
      expect.objectContaining({ meldungId: m }),
    ]);
    expect((await uebernehmen(a, a.admin, m)).json()).toMatchObject({ art: "bereits" });
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko)).toHaveLength(1);
  });

  it("Ausfall der Anforderung NACH dem Beleg: die Wiederholung legt die Aufgabe doch noch an", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    // Echter Ausfall am Lebenszyklus: die Merkerablage scheitert genau einmal.
    const repo = new AusfallRepo(1);
    const lifecycle = new LifecycleService({
      koService: a.services.ko,
      repo,
      audit: a.services.audit,
    });
    const deps: QualitaetsDeps = { ...depsVon(a.services), lifecycle };
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const filter = sichtbarkeitsfilterFuer(betrachter);

    await expect(uebernimmRueckmeldung(deps, betrachter, filter, m)).rejects.toThrow(
      "Merkerablage",
    );
    expect(await belege(a.services, RUECKMELDUNG_UEBERNOMMEN, ko)).toHaveLength(1);
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko)).toHaveLength(0);
    const halb = await ladeQualitaetsaufgaben(deps, betrachter, filter);
    expect(eintrag(halb, `rueckmeldung:${m}`)?.zustand).toBe("unklar");

    const wieder = await uebernimmRueckmeldung(deps, betrachter, filter, m);
    expect(wieder).toMatchObject({ art: "nachgeholt", vorgang: `revalidierung:${ko}` });
    expect((await lifecycle.revalidierungAnstehtFuer([ko])).has(ko)).toBe(true);
    const anforderungen = await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko);
    expect(anforderungen).toHaveLength(1);
    expect(anforderungen[0]?.payload).toMatchObject({ grund: "rueckmeldung", meldungId: m });
    const ganz = await ladeQualitaetsaufgaben(deps, betrachter, filter);
    expect(eintrag(ganz, `rueckmeldung:${m}`)).toBeUndefined();
    expect(eintrag(ganz, `revalidierung:${ko}`)?.rueckmeldungen?.map((r) => r.meldungId)).toEqual([
      m,
    ]);

    expect(await uebernimmRueckmeldung(deps, betrachter, filter, m)).toMatchObject({
      art: "bereits",
    });
    expect(await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko)).toHaveLength(1);
  });

  it("Abschluss überlappt die Übernahme: kein „angehängt“ an einen schon geschlossenen Vorgang", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    const anfordern = await aktion(a.app, a.admin, ko, { action: "request-revalidation" });
    expect(anfordern.statusCode).toBe(204);
    const deps = depsVon(a.services);
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const filter = sichtbarkeitsfilterFuer(betrachter);

    // Die Bestätigung beginnt ZUERST (sie nimmt die Objektsperre sofort); die Übernahme startet,
    // solange die Revalidierung noch als laufend gelesen würde — genau Bens Überlappung.
    const abschluss = a.services.lifecycle.confirmStillValid(ko, a.autorin.id);
    const uebernahme = uebernimmRueckmeldung(deps, betrachter, filter, m);
    await abschluss;
    const ergebnis = await uebernahme;

    // Die laufende Revalidierung war geschlossen — die Meldung bekommt eine NEUE Aufgabe.
    expect(ergebnis).toMatchObject({ art: "angelegt", vorgang: `revalidierung:${ko}` });
    expect((await a.services.lifecycle.revalidierungAnstehtFuer([ko])).has(ko)).toBe(true);
    const anforderungen = await belege(a.services, REVALIDIERUNG_ANGEFORDERT, ko);
    expect(anforderungen.map((x) => x.payload.grund)).toEqual(["bibliothek", "rueckmeldung"]);
    const u = await ladeQualitaetsaufgaben(deps, betrachter, filter);
    expect(eintrag(u, `rueckmeldung:${m}`)).toBeUndefined();
    const r = eintrag(u, `revalidierung:${ko}`);
    expect(r?.rueckmeldungen?.map((x) => x.meldungId)).toEqual([m]);
    expect(r?.einstiege).toEqual(expect.arrayContaining(["anforderung:rueckmeldung"]));
    expect(r?.einstiege).not.toContain("anforderung:bibliothek");
  });

  it("Gegenrichtung: kommt der Abschluss NACH der Übernahme, schliesst er genau diesen Vorgang", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    const anfordern = await aktion(a.app, a.admin, ko, { action: "request-revalidation" });
    expect(anfordern.statusCode).toBe(204);
    const deps = depsVon(a.services);
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const filter = sichtbarkeitsfilterFuer(betrachter);

    expect(await uebernimmRueckmeldung(deps, betrachter, filter, m)).toMatchObject({
      art: "angehaengt",
    });
    await a.services.lifecycle.confirmStillValid(ko, a.autorin.id);
    const u = await ladeQualitaetsaufgaben(deps, betrachter, filter);
    expect(eintrag(u, `revalidierung:${ko}`)).toBeUndefined();
    expect(eintrag(u, `rueckmeldung:${m}`)?.zustand).toBe("erledigt");
  });

  it("eine gescheiterte Quelle steht als „fehler“ — die übrigen Einträge bleiben", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "antwort-falsch");
    const deps: QualitaetsDeps = {
      ko: a.services.ko,
      validation: a.services.validation,
      lifecycle: a.services.lifecycle,
      conflicts: a.services.conflicts,
      overlaps: {
        unresolved: async () => {
          throw new Error("Fiktiv: Ablage der Duplikate nicht erreichbar");
        },
      },
      ask: a.services.ask,
      audit: a.services.audit,
      konten: () => a.services.auth.listUsers(),
      spaces: a.services.spaces,
    };
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const u = await ladeQualitaetsaufgaben(deps, betrachter, sichtbarkeitsfilterFuer(betrachter));
    expect(u.quellen.duplikat).toBe("fehler");
    expect(u.quellen.rueckmeldung).toBe("ok");
    expect(eintrag(u, `rueckmeldung:${m}`)?.zustand).toBe("offen");
  });

  it("Kalibrierung: die Meldungsquelle ist das vorhandene Protokoll `answer.reported`", async () => {
    const a = await setup();
    const ko = await freigegeben(a, TITEL_RUECKMELDUNG);
    const m = await melden(a, ko, TITEL_RUECKMELDUNG, "quelle-passt-nicht");
    const zeilen = await belege(a.services, ANTWORT_MELDUNG_ACTION, ko);
    expect(zeilen.map((z) => z.payload.meldungId)).toEqual([m]);
  });
});
