import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { KlaraAusfuehrung, type KlaraRufe } from "../../services/app/src/klara-ausfuehrung";
import { KlaraGespraechDienst } from "../../services/app/src/klara-gespraech";
import { type App, draht, registrieren, vorgang } from "./vorrichtung";

let app: App;
let services: ReturnType<typeof assembleServices>;
let token = "";
beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.ready();
  token = await registrieren(app);
});
afterEach(async () => {
  await app.close();
});

describe("G · BES-02 / AW11 · vorhandener Auftragskern", () => {
  it("G1 · Text und Sprache binden denselben begrenzten Plan, Rolleninhaber und Originalergebnisse", async () => {
    const text = await vorgang(app, token);
    const sprache = await vorgang(app, token, "gesprochen");
    expect(sprache.a.plan).toEqual(text.a.plan);
    expect(sprache.a.verantwortlich).toBe(text.a.verantwortlich);
    expect(text.a.erlaubteAktionen).toEqual(["entwurf_erstellen"]);
    expect(text.a.stand).toBe("vorgeschlagen");
    const r = await text.aus(1);
    expect(r.statusCode, r.body).toBe(200);
    const s = r.json().schritt;
    expect(s.stand).toBe("gespeichert");
    expect(s.aktionskennung).toBe(`klara-auftrag-${text.a.id}-1`);
    const ergebnis = await draht(app, token)("GET", `/api/drafts/${s.ergebnis.id}`);
    expect(ergebnis.statusCode).toBe(200);
    expect(ergebnis.json().createOperation.id).toBe(s.aktionskennung);
  });

  it("G2 · Pause, Neuanmeldung, Korrektur, aktuelle Fassung, nächster Schritt ohne Doppelung", async () => {
    const v = await vorgang(app, token);
    const auf = draht(app, token);
    const s1 = await v.aus(1);
    const id = s1.json().schritt.ergebnis.id;
    const pause = await auf("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 });
    expect(pause.statusCode).toBe(200);
    expect((await v.lese()).unterbrochenAm).toBeTruthy();
    expect((await v.aus(2)).json()).toMatchObject({ grund: "unterbrochen" });
    const kor = await auf("POST", `${v.pfad}/fassungen`, {
      auftragFassung: 1,
      erlaubteAktionen: v.a.erlaubteAktionen,
      erlaubteZiele: v.ziele.slice(0, 2),
      geplanteSchritte: 2,
      grund: "Nur Anforderung und Anfrage behalten",
    });
    expect(kor.statusCode, kor.body).toBe(200);
    expect((await auf("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 1 })).json()).toMatchObject(
      { grund: "fassung_veraltet" },
    );
    expect((await auf("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 2 })).statusCode).toBe(200);
    const nochmals = await v.aus(1, 2);
    expect(nochmals.json()).toMatchObject({ wiederholt: true, schritt: { ergebnis: { id } } });
    const s2 = await v.aus(2, 2);
    expect(s2.json().auftrag.stand).toBe("abgeschlossen");
    expect((await auf("GET", "/api/drafts")).json()).toHaveLength(2);
    expect((await auf("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 2 })).statusCode).toBe(409);
    expect((await v.lese()).verlauf.map((x) => x.ereignis)).toContain("fortgesetzt");
  });

  it("G3 · falsche Schrittnummer unter vorhandenem Schlüssel wird abgewiesen", async () => {
    const v = await vorgang(app, token);
    await v.aus(1);
    expect((await v.aus(2, 1, "g-1")).json()).toMatchObject({ grund: "schluessel_belegt" });
    expect((await v.lese()).schritte).toHaveLength(1);
  });

  it("G4 · verlorene Speicherantwort wird am tatsächlichen Originalobjekt gelesen, ohne zweiten POST", async () => {
    const v = await vorgang(app, token);
    const auf = draht(app, token);
    let posts = 0;
    const rufe: KlaraRufe = async (m, url, body) => {
      const r = await auf(m, url, body);
      if (m === "POST" && url === "/api/drafts") {
        posts++;
        expect(r.statusCode).toBe(201);
        return { status: 503, daten: null };
      }
      return { status: r.statusCode, daten: r.json() };
    };
    const d = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    const r = await d.fuehreAus(
      v.a.verantwortlich,
      v.gid,
      v.a.id,
      "g-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(r.schritt.stand).toBe("gespeichert");
    expect((await auf("GET", `/api/drafts/${r.schritt.ergebnis?.id}`)).statusCode).toBe(200);
    expect(posts).toBe(1);
    expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
  });

  it("G5 · Pause nach Beginn, vor der Schreibwirkung verhindert Schreiben; Stopp erlaubt nur Readback", async () => {
    const v = await vorgang(app, token);
    const auf = draht(app, token);
    // Bekannte ausgelöste Wirkung: nur Nachlesen ist ausgefallen.
    let block = true;
    let posts = 0;
    const rufe: KlaraRufe = async (m, url, body) => {
      if (m === "GET" && url.startsWith("/api/drafts/") && block)
        return { status: 503, daten: null };
      if (m === "POST") posts++;
      const r = await auf(m, url, body);
      return { status: r.statusCode, daten: r.json() };
    };
    const d = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    const e = await d.fuehreAus(
      v.a.verantwortlich,
      v.gid,
      v.a.id,
      "g-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(e.schritt).toMatchObject({ stand: "begonnen", schreibwirkung: { art: "entwurf" } });
    expect((await auf("PUT", `${v.pfad}/abbruch`, {})).statusCode).toBe(200);
    block = false;
    const gelesen = await d.fuehreAus(
      v.a.verantwortlich,
      v.gid,
      v.a.id,
      "g-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(gelesen.schritt.stand).toBe("gespeichert");
    expect(gelesen.auftrag.stand).toBe("abgebrochen");
    expect(posts).toBe(1);
    expect((await v.aus(2)).statusCode).toBe(409);
  });

  it("G6 · fremdes Konto sieht weder Auftrag noch Ergebnis und kann nicht fortsetzen", async () => {
    const v = await vorgang(app, token);
    const user = await draht(app, token)("POST", "/api/users", {
      name: "Fremde Person G",
      email: "g-fremd@example.test",
      password: "fiktiver-g-test-2026",
      role: "experte",
    });
    expect(user.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "g-fremd@example.test", password: "fiktiver-g-test-2026" },
    });
    const fremd = draht(app, login.json().token);
    expect((await fremd("GET", v.basis)).statusCode).toBe(404);
    expect((await fremd("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 1 })).statusCode).toBe(
      404,
    );
  });
});

it("G7 · Unterbrechen während eines laufenden Leseschritts verhindert dessen noch nicht ausgelöste Schreibwirkung", async () => {
  const v = await vorgang(app, token);
  const auf = draht(app, token);
  const d = (await auf("POST", "/api/drafts", { title: "G Pause", statement: "Original" })).json();
  const ziel = { art: "entwurf", id: d.id, titel: "G Pause", stand: d.updatedAt, pfad: null };
  const neu = await auf("POST", v.basis, {
    quelle: "getippt",
    wortlaut: "Ergänze im Entwurf G Pause: Zusatz",
    ziel: "G Pause ergänzen",
    erlaubteAktionen: ["entwurf_bearbeiten"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: ["Eigener Auftrag"],
    ergebnis: "Zusatz gespeichert",
    geplanteSchritte: 1,
    plan: [
      {
        aktion: "entwurf_bearbeiten",
        ziel,
        ausSchritt: null,
        aenderung: { art: "ergaenzen", text: "Zusatz" },
      },
    ],
  });
  expect(neu.statusCode, neu.body).toBe(201);
  const a = neu.json().auftrag;
  let pause = true;
  let puts = 0;
  const rufe: KlaraRufe = async (m, url, body) => {
    const r = await auf(m, url, body);
    if (m === "GET" && url === `/api/drafts/${d.id}` && pause) {
      pause = false;
      expect(
        (await auf("POST", `${v.basis}/${a.id}/unterbrechen`, { auftragFassung: 1 })).statusCode,
      ).toBe(200);
    }
    if (m === "PUT") puts++;
    return { status: r.statusCode, daten: r.json() };
  };
  const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
  await expect(
    aus.fuehreAus(a.verantwortlich, v.gid, a.id, "g-edit", { nr: 1, auftragFassung: 1 }, rufe),
  ).rejects.toMatchObject({ grund: "unterbrochen" });
  expect(puts).toBe(0);
  expect((await auf("GET", `/api/drafts/${d.id}`)).json().payload.statement).toBe("Original");
  expect(
    (await auf("POST", `${v.basis}/${a.id}/fortsetzen`, { auftragFassung: 1 })).statusCode,
  ).toBe(200);
  const weiter = await aus.fuehreAus(
    a.verantwortlich,
    v.gid,
    a.id,
    "g-edit",
    { nr: 1, auftragFassung: 1 },
    rufe,
  );
  expect(weiter.schritt.stand).toBe("gespeichert");
  expect(puts).toBe(1);
});

it("G8 · unklarer Schreibausgang ohne auflösbares Ergebnis bleibt offen und wird nicht als Fehlschlag oder Fertigstand behauptet", async () => {
  const v = await vorgang(app, token);
  const auf = draht(app, token);
  const rufe: KlaraRufe = async (m, url, body) => {
    if (m === "POST" && url === "/api/drafts") return { status: 503, daten: null };
    const r = await auf(m, url, body);
    return { status: r.statusCode, daten: r.json() };
  };
  const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
  const r = await aus.fuehreAus(
    v.a.verantwortlich,
    v.gid,
    v.a.id,
    "g-1",
    { nr: 1, auftragFassung: 1 },
    rufe,
  );
  expect(r.schritt).toMatchObject({ stand: "begonnen", ausgangUnklar: true, ergebnis: null });
  expect(r.auftrag.stand).toBe("laeuft");
  expect((await auf("GET", v.basis)).json().auftraege[0].ergebnisstand).toBe("unklar");
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(0);
});

it("G9 · Antwort und erster Readback verloren → Stopp → tatsächlichen Vorgang nur lesen, keine zweite Wirkung", async () => {
  const v = await vorgang(app, token);
  const auf = draht(app, token);
  let gestoert = true;
  let posts = 0;
  const rufe: KlaraRufe = async (m, url, body) => {
    if (m === "GET" && url === "/api/drafts" && gestoert) return { status: 503, daten: null };
    const r = await auf(m, url, body);
    if (m === "POST" && url === "/api/drafts") {
      posts++;
      return { status: 503, daten: null };
    }
    return { status: r.statusCode, daten: r.json() };
  };
  const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
  const unklar = await aus.fuehreAus(
    v.a.verantwortlich,
    v.gid,
    v.a.id,
    "g-1",
    { nr: 1, auftragFassung: 1 },
    rufe,
  );
  expect(unklar.schritt).toMatchObject({
    stand: "begonnen",
    ausgangUnklar: true,
  });
  expect(unklar.schritt.schreibwirkung).toBeUndefined();
  expect((await auf("PUT", `${v.pfad}/abbruch`, {})).statusCode).toBe(200);
  gestoert = false;
  const ergebnis = await aus.fuehreAus(
    v.a.verantwortlich,
    v.gid,
    v.a.id,
    "g-1",
    { nr: 1, auftragFassung: 1 },
    rufe,
  );
  expect(ergebnis.schritt.stand).toBe("gespeichert");
  expect(ergebnis.auftrag.stand).toBe("abgebrochen");
  expect(posts).toBe(1);
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
});

it("R-G1 · tatsächliche Fachanlage vor jedem Ergebnismarker, danach endgültiger Stopp: nur Originalreadback, keine neue Anlage", async () => {
  const v = await vorgang(app, token);
  const auf = draht(app, token);
  let posts = 0;
  const rufe: KlaraRufe = async (m, url, body) => {
    const r = await auf(m, url, body);
    if (m === "POST" && url === "/api/drafts") {
      posts++;
      expect(r.statusCode).toBe(201);
      throw new Error(
        "Gezielter Laufabbruch unmittelbar nach tatsächlichem Fachcommit, vor Ergebnismarker",
      );
    }
    return { status: r.statusCode, daten: r.json() };
  };
  const vor = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
  await expect(
    vor.fuehreAus(v.a.verantwortlich, v.gid, v.a.id, "g-1", { nr: 1, auftragFassung: 1 }, rufe),
  ).rejects.toThrow("vor Ergebnismarker");
  const luecke = (await v.lese()).schritte[0];
  expect(luecke).toMatchObject({ stand: "begonnen", ergebnis: null });
  expect(luecke?.schreibwirkung).toBeUndefined();
  expect(luecke?.ausgangUnklar).toBeUndefined();
  const original = (await auf("GET", "/api/drafts")).json()[0];
  expect(original.createOperation.id).toBe(`klara-auftrag-${v.a.id}-1`);
  expect((await auf("PUT", `${v.pfad}/abbruch`, {})).statusCode).toBe(200);
  const neu = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
  const nach = await neu.fuehreAus(
    v.a.verantwortlich,
    v.gid,
    v.a.id,
    "g-1",
    { nr: 1, auftragFassung: 1 },
    rufe,
  );
  expect(nach.schritt.ergebnis?.id).toBe(original.id);
  expect(nach.schritt.stand).toBe("gespeichert");
  expect(nach.auftrag.stand).toBe("abgebrochen");
  expect(posts).toBe(1);
  // Dieselbe markerlose Lücke OHNE tatsächliches Original darf nach Stopp keine Anlage auslösen.
  const leer = await vorgang(app, token);
  const begin = await auf("PUT", `${leer.pfad}/schritte/g-1`, {
    nr: 1,
    aktion: "entwurf_erstellen",
    ziel: leer.ziele[0],
    auftragFassung: 1,
    stand: "begonnen",
  });
  expect(begin.statusCode).toBe(200);
  expect((await auf("PUT", `${leer.pfad}/abbruch`, {})).statusCode).toBe(200);
  await expect(
    neu.fuehreAus(
      leer.a.verantwortlich,
      leer.gid,
      leer.a.id,
      "g-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    ),
  ).rejects.toMatchObject({ grund: "abgebrochen" });
  expect(posts).toBe(1);
});
