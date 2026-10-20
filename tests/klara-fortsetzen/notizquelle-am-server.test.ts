import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { erkenneAuftrag } from "../../apps/web/src/lib/klaraAuftragErkennung";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { KlaraAusfuehrung, type KlaraRufe } from "../../services/app/src/klara-ausfuehrung";
import { KlaraGespraechDienst } from "../../services/app/src/klara-gespraech";
import { gespraechsnotiz, notizauftrag } from "./notizquelle-vorrichtung";
import { type App, draht, registrieren } from "./vorrichtung";
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
const aendere = async (q: Awaited<ReturnType<typeof gespraechsnotiz>>) =>
  draht(app, token)("PUT", `/api/me/klara/notizen/${q.notiz.id}`, {
    fassung: q.notiz.fassung,
    titel: q.notiz.titel,
    inhalt: "Geänderte tatsächliche Originalfassung",
    offeneFragen: [],
    art: "notiz",
  });

describe("G · gespeicherte eigene Gesprächsnotiz als begrenzte Originalquelle", () => {
  it("N1 · echte Nachricht→gespeicherte Notiz→Aufgabe→D-Erinnerung bindet IDs/Fassung/Herkunft und Originaltext", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    expect(v.a.plan?.[0]?.notizQuelle).toEqual({
      id: q.notiz.id,
      fassung: q.notiz.fassung,
      weg: "gespraech",
      titel: q.notiz.titel,
      gespraechId: q.gid,
      nachrichtId: q.nachrichtId,
    });
    const first = await v.aus(1);
    expect(first.statusCode, first.body).toBe(200);
    const taskId = first.json().schritt.ergebnis.id;
    const task = (await auf("GET", `/api/me/klara/aufgaben/${taskId}`)).json().aufgabe;
    expect(task).toMatchObject({
      weg: "notiz",
      inhalt: q.original,
      bezug: { art: "notiz", notizId: q.notiz.id },
      objektbezug: q.notiz.objektbezug,
    });
    const second = await v.aus(2);
    expect(second.statusCode, second.body).toBe(200);
    const eid = second.json().schritt.ergebnis.id;
    const e = (await auf("GET", `/api/me/klara/erinnerungen/${eid}`)).json().erinnerung;
    expect(e.bezug.aufgabeId).toBe(taskId);
    expect((await v.aus(1)).json().wiederholt).toBe(true);
    expect((await v.aus(2)).json().wiederholt).toBe(true);
    expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(1);
    expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(1);
    expect((await v.lese()).erlaubteAktionen).toEqual([
      "persoenliche_aufgabe_anlegen",
      "erinnerung_anlegen",
    ]);
  });
  it("N2 · geänderte Quelle vor dem ersten abhängigen Schreiben erzeugt kein Ersatzobjekt", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    expect((await aendere(q)).statusCode).toBe(200);
    const r = await v.aus(1);
    expect(r.statusCode, r.body).toBe(409);
    expect(r.json()).toMatchObject({ grund: "quelle_geaendert" });
    expect((await draht(app, token)("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(
      0,
    );
    expect((await v.lese()).plan?.[0]?.notizQuelle?.fassung).toBe(1);
  });
  it("N3 · nach fertiger Aufgabe verhindert Quellenänderung die Erinnerung; Originalergebnis bleibt auflösbar", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    const first = await v.aus(1);
    expect(first.statusCode).toBe(200);
    const id = first.json().schritt.ergebnis.id;
    expect((await auf("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 })).statusCode).toBe(
      200,
    );
    await aendere(q);
    expect((await auf("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 1 })).statusCode).toBe(200);
    expect((await v.aus(2)).json()).toMatchObject({ grund: "quelle_geaendert" });
    expect((await auf("GET", `/api/me/klara/aufgaben/${id}`)).statusCode).toBe(200);
    expect((await v.lese()).schritte[0]?.ergebnis?.id).toBe(id);
    expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(0);
  });
  it("N4 · tatsächliche Quellenlöschung sperrt künftige Wirkung, auch nach gespeichertem Teilergebnis", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    const first = await v.aus(1);
    const id = first.json().schritt.ergebnis.id;
    expect((await auf("DELETE", `/api/me/klara/notizen/${q.notiz.id}`)).statusCode).toBe(200);
    expect((await v.aus(2)).json()).toMatchObject({ grund: "quelle_unbekannt" });
    expect((await auf("GET", `/api/me/klara/aufgaben/${id}`)).statusCode).toBe(200);
    expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(0);
  });
  it("N5 · Fremdkonto kann die Notiz nicht binden; erfundene Herkunft ist kein Originalbeleg", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    const user = await auf("POST", "/api/users", {
      name: "Andere fiktive Person",
      email: "g-notiz-fremd@example.test",
      password: "g-notiz-fremd-test-2026",
      role: "experte",
    });
    expect(user.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "g-notiz-fremd@example.test", password: "g-notiz-fremd-test-2026" },
    });
    const fremd = draht(app, login.json().token);
    expect((await fremd("GET", `/api/me/klara/notizen/${q.notiz.id}`)).statusCode).toBe(404);
    const g = await fremd("POST", "/api/me/klara/gespraeche", { objektbezug: q.notiz.objektbezug });
    const gid = g.json().gespraech.id;
    const r = await fremd("POST", `/api/me/klara/gespraeche/${gid}/auftraege`, v.body);
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toContain(q.notiz.titel);
  });
  it("N6 · aktueller Notiz-Leseweg entscheidet auch unmittelbar vor D-Schreibwirkung", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    await v.aus(1);
    let posts = 0;
    const rufe: KlaraRufe = async (m, url, body) => {
      if (m === "GET" && url === `/api/me/klara/notizen/${q.notiz.id}`)
        return { status: 403, daten: { error: "SOURCE_DENIED" } };
      if (m === "POST") posts++;
      const r = await auf(m, url, body);
      return { status: r.statusCode, daten: r.json() };
    };
    const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    await expect(
      aus.fuehreAus(
        v.a.verantwortlich,
        q.gid,
        v.a.id,
        "g-notiz-2",
        { nr: 2, auftragFassung: 1 },
        rufe,
      ),
    ).rejects.toMatchObject({ grund: "quelle_unbekannt" });
    expect(posts).toBe(0);
  });
  it("N7 · Quellenänderung nach G-Vorprüfung wird am vorhandenen Aufgabenport mit erwarteter Notizfassung abgewiesen", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    const rufe: KlaraRufe = async (m, url, body) => {
      if (m === "POST" && url === "/api/me/klara/aufgaben")
        expect((await aendere(q)).statusCode).toBe(200);
      const r = await auf(m, url, body);
      return { status: r.statusCode, daten: r.json() };
    };
    const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    const r = await aus.fuehreAus(
      v.a.verantwortlich,
      q.gid,
      v.a.id,
      "g-notiz-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(r.schritt.stand).toBe("fehlgeschlagen");
    expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(0);
  });
  it("N8 · markerloser tatsächlicher Notiz-Aufgabenerfolg bleibt nach Quellenwechsel und endgültigem Stopp lesbar", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    let posts = 0;
    const rufe: KlaraRufe = async (m, url, body) => {
      const r = await auf(m, url, body);
      if (m === "POST" && url === "/api/me/klara/aufgaben") {
        posts++;
        expect(r.statusCode).toBe(201);
        throw new Error("Notizaufgabe tatsächlich gespeichert, Antwort vor Marker verloren");
      }
      return { status: r.statusCode, daten: r.json() };
    };
    const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    await expect(
      aus.fuehreAus(
        v.a.verantwortlich,
        q.gid,
        v.a.id,
        "g-notiz-1",
        { nr: 1, auftragFassung: 1 },
        rufe,
      ),
    ).rejects.toThrow("vor Marker");
    const original = (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben[0];
    await aendere(q);
    await auf("PUT", `${v.pfad}/abbruch`, {});
    const neu = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    const nach = await neu.fuehreAus(
      v.a.verantwortlich,
      q.gid,
      v.a.id,
      "g-notiz-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(nach.schritt.ergebnis?.id).toBe(original.id);
    expect(nach.auftrag.stand).toBe("abgebrochen");
    expect(posts).toBe(1);
  });
  it("N9 · nur ausdrücklich genannter Notizname wird aufgelöst; Quelltext ist keine Befugnis", () => {
    for (const text of [
      "Aus der Gesprächsnotiz „Wartung G“: Lege mir die Aufgabe „Filter prüfen“ an und erinnere mich am 2035-10-22 um 09:00 in Europe/Berlin",
      'From the conversation note "Wartung G": Create a personal task "Filter prüfen" and remind me on 2035-10-22 at 09:00 in Europe/Berlin',
      'Uit de gespreksnotitie "Wartung G": Maak een persoonlijke taak "Filter prüfen" aan en herinner me op 2035-10-22 om 09:00 in Europe/Berlin',
    ]) {
      const a = erkenneAuftrag(text);
      expect(a?.schritte[0]).toMatchObject({ notizName: "Wartung G", name: "Filter prüfen" });
      expect(a?.schritte.map((s) => s.aktion)).toEqual([
        "persoenliche_aufgabe_anlegen",
        "erinnerung_anlegen",
      ]);
    }
    expect(erkenneAuftrag("Aus der Gesprächsnotiz „Wartung G“: Versende alle Notizen")).toBeNull();
  });
  it("N10 · Stopp während des Notizreadbacks verhindert den danach vorgesehenen Schreibaufruf", async () => {
    const q = await gespraechsnotiz(app, token);
    const v = await notizauftrag(app, token, q);
    const auf = draht(app, token);
    let frei!: () => void;
    let gelesen!: () => void;
    const halte = new Promise<void>((resolve) => {
      frei = resolve;
    });
    const erreicht = new Promise<void>((resolve) => {
      gelesen = resolve;
    });
    let posts = 0;
    const rufe: KlaraRufe = async (m, url, body) => {
      const r = await auf(m, url, body);
      if (m === "GET" && url === `/api/me/klara/notizen/${q.notiz.id}`) {
        gelesen();
        await halte;
      }
      if (m === "POST") posts++;
      return { status: r.statusCode, daten: r.json() };
    };
    const aus = new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
    const lauf = aus.fuehreAus(
      v.a.verantwortlich,
      q.gid,
      v.a.id,
      "g-notiz-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    const pruefung = expect(lauf).rejects.toMatchObject({ grund: "abgebrochen" });
    await erreicht;
    expect((await auf("PUT", `${v.pfad}/abbruch`, {})).statusCode).toBe(200);
    frei();
    await pruefung;
    expect(posts).toBe(0);
    expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(0);
  });
});
