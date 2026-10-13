// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DIE TÜREN AM SERVER (HTTP über `buildApp`).
// ================================================================================================
//
// Fiktive Konten, In-Memory-Komposition, kein Modell, kein Netz. Belegt wird, was der Server selbst
// prüft (PBE-05): Schreib- und Leserecht `users.manage`, Mandant und ändernde Person nur aus Instanz
// und Sitzung, Grenzen der Eingabe — und dass eine Budgetänderung KEINE Anbieterfreigabe, keinen
// Zugang und keinen Kostenweg einer Fähigkeit eröffnet.
//
//   S1  Admin liest und ändert; Antwort trägt Stand und Provenienz ohne Geheimnis
//   S2  Viewer, Experte, Controller: 403 lesend und schreibend; anonym: 401; nichts geschrieben
//   S3  Mandant/Konto im Rumpf: 403; ungültige Werte: 400 mit Grund; alter Stand bleibt
//   S4  Neustart (neue App an derselben Ablage): der Stand gilt weiter
//   S5  Budget geändert → Perplexity bleibt als Fähigkeit gesperrt (Freigabe, Zugang, Tarif fehlen)
//   S6  Prüfprotokoll: Änderung mit Bereich und Kennung, Wiederholung ohne zweiten Eintrag
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryProduktbudgetRepo,
  type ProduktbudgetRepo,
} from "../../services/app/src/produktbudget";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const ADMIN = { name: "Ada Fiktiv", email: "ada.budget@beispiel.test", password: "geheim-1234" };

async function instanz(repo: ProduktbudgetRepo = new InMemoryProduktbudgetRepo()) {
  const services = buildServices();
  services.produktbudget = repo;
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der fiktive Admin muss sich anmelden können").not.toBe("");
  return { app, services, admin: { authorization: `Bearer ${token}` } as Kopf };
}

async function konto(app: App, admin: Kopf, rolle: string, email: string): Promise<Kopf> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Fiktiv ${rolle}`, email, password: "geheim-1234", role: rolle },
  });
  expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim-1234" },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, `${rolle} muss sich anmelden können`).not.toBe("");
  return { authorization: `Bearer ${token}` };
}

interface Bereich {
  bereich: string;
  betragCent: number;
  waehrung: string;
  zeitraum: string;
  fassung: number;
  geaendertVon: string | null;
  verbrauchtCent: number;
  verbleibendCent: number;
  sperre: string | null;
  letzteAenderungen: { aenderungId: string; von: string }[];
}

async function lies(app: App, kopf: Kopf): Promise<Bereich[]> {
  const res = await app.inject({ method: "GET", url: "/api/admin/produktbudget", headers: kopf });
  expect(res.statusCode, res.body).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  return (res.json() as { bereiche: Bereich[] }).bereiche;
}

function put(app: App, kopf: Kopf | null, bereich: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "PUT",
    url: `/api/admin/produktbudget/${bereich}`,
    ...(kopf ? { headers: kopf } : {}),
    payload,
  });
}

const GUELTIG = {
  betrag: "24,00",
  waehrung: "EUR",
  zeitraum: "einmalig",
  fassung: 0,
  aenderungId: "aenderung-server-0001",
};

describe("S1 · der Admin liest und ändert", () => {
  it("drei Bereiche nach Originalvorgabe; die Änderung kommt mit Stand und Kontokennung zurück", async () => {
    const { app, admin } = await instanz();
    const vorher = await lies(app, admin);
    expect(vorher.map((b) => [b.bereich, b.betragCent, b.waehrung, b.zeitraum])).toEqual([
      ["perplexity-poc", 2000, "EUR", "einmalig"],
      ["nr32-claude", 2000, "EUR", "einmalig"],
      ["nr32-chatgpt", 2000, "EUR", "einmalig"],
    ]);
    const res = await put(app, admin, "perplexity-poc", GUELTIG);
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as { bereiche: Bereich[]; geaendert: boolean; wiederholt: boolean };
    expect(body).toMatchObject({ geaendert: true, wiederholt: false, bestaetigteFassung: 1 });
    const p = body.bereiche.find((b) => b.bereich === "perplexity-poc");
    expect(p).toMatchObject({ betragCent: 2400, fassung: 1 });
    expect(p?.geaendertVon).toMatch(/\S/);
    expect(res.body).not.toMatch(/Bearer|password|geheim-1234|PERPLEXITY_API_KEY/);
    expect((await lies(app, admin)).find((b) => b.bereich === "perplexity-poc")?.betragCent).toBe(
      2400,
    );
  });
});

describe("S2 · ohne users.manage keine Tür", () => {
  it("Viewer, Experte und Controller bekommen 403, anonym 401 — und der Stand bleibt", async () => {
    const { app, admin } = await instanz();
    const koepfe: [string, Kopf][] = [
      ["viewer", await konto(app, admin, "viewer", "viewer.budget@beispiel.test")],
      ["experte", await konto(app, admin, "experte", "experte.budget@beispiel.test")],
      ["controller", await konto(app, admin, "controller", "controller.budget@beispiel.test")],
    ];
    for (const [rolle, kopf] of koepfe) {
      const g = await app.inject({ method: "GET", url: "/api/admin/produktbudget", headers: kopf });
      expect(g.statusCode, `${rolle} GET`).toBe(403);
      const eingabe = { ...GUELTIG, aenderungId: `rolle-${rolle}-1` };
      const p = await put(app, kopf, "perplexity-poc", eingabe);
      expect(p.statusCode, `${rolle} PUT`).toBe(403);
    }
    const anonymLesen = await app.inject({ method: "GET", url: "/api/admin/produktbudget" });
    expect(anonymLesen.statusCode).toBe(401);
    const anonymSchreiben = await put(app, null, "perplexity-poc", GUELTIG);
    expect(anonymSchreiben.statusCode).toBe(401);
    const p = (await lies(app, admin)).find((b) => b.bereich === "perplexity-poc");
    expect(p).toMatchObject({ betragCent: 2000, fassung: 0 });
  });
});

describe("S3 · der Server prüft Bindung und Grenzen", () => {
  it("Mandant oder Konto im Rumpf: 403, nichts geschrieben", async () => {
    const { app, admin } = await instanz();
    for (const feld of ["mandant", "kontoId", "nutzer", "von"]) {
      const res = await put(app, admin, "perplexity-poc", {
        ...GUELTIG,
        aenderungId: `fremd-${feld}-01`,
        [feld]: "anderer-mandant",
      });
      expect(res.statusCode, feld).toBe(403);
    }
    expect((await lies(app, admin))[0]).toMatchObject({ betragCent: 2000, fassung: 0 });
  });

  it("ungültige Werte: 400 mit Grund; unbekannter Bereich: 404; veraltete Fassung: 409 mit Stand", async () => {
    const { app, admin } = await instanz();
    const faelle: [Record<string, unknown>, string][] = [
      [{ ...GUELTIG, betrag: "-5" }, "betrag"],
      [{ ...GUELTIG, betrag: 20.5 }, "betrag"],
      [{ ...GUELTIG, betrag: "999999" }, "betrag"],
      [{ ...GUELTIG, waehrung: "CHF" }, "waehrung"],
      [{ ...GUELTIG, zeitraum: "monatlich" }, "zeitraum"],
      [{ ...GUELTIG, aenderungId: "x" }, "aenderung"],
      [{ ...GUELTIG, fassung: "0" }, "konflikt"],
    ];
    for (const [payload, grund] of faelle) {
      const res = await put(app, admin, "perplexity-poc", payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect((res.json() as { grund: string }).grund).toBe(grund);
    }
    expect((await put(app, admin, "gibt-es-nicht", GUELTIG)).statusCode).toBe(404);
    expect((await put(app, admin, "perplexity-poc", GUELTIG)).statusCode).toBe(200);
    const veraltet = await put(app, admin, "perplexity-poc", {
      ...GUELTIG,
      betrag: "30",
      aenderungId: "aenderung-server-0002",
    });
    expect(veraltet.statusCode).toBe(409);
    const v = veraltet.json() as { grund: string; stand: { bereiche: Bereich[] } };
    expect(v.grund).toBe("konflikt");
    expect(v.stand.bereiche.find((b) => b.bereich === "perplexity-poc")?.betragCent).toBe(2400);
  });

  it("ein bewusst offener Zeitraum: Festlegen nur mit Beleg; ohne Beleg bleibt er offen", async () => {
    const { app, admin } = await instanz();
    const offen = await put(app, admin, "nr32-claude", {
      ...GUELTIG,
      betrag: "20",
      zeitraum: "offen",
      aenderungId: "nr32-oeffnen-01",
    });
    expect(offen.statusCode, offen.body).toBe(200);
    const ohne = await put(app, admin, "nr32-claude", {
      ...GUELTIG,
      betrag: "20",
      fassung: 1,
      aenderungId: "nr32-ohne-beleg",
    });
    expect(ohne.statusCode).toBe(400);
    expect((ohne.json() as { grund: string }).grund).toBe("grund");
    const claude = (await lies(app, admin)).find((b) => b.bereich === "nr32-claude");
    expect(claude).toMatchObject({ zeitraum: "offen", sperre: "zeitraum_offen" });
  });
});

describe("S7 · PBE-12: Zuweisung durch die Verwaltung, Unterlimit durch das eigene Konto", () => {
  it("Admin weist zu; der Anwender setzt sein Unterlimit innerhalb; fremde Wege sind zu", async () => {
    const { app, services, admin } = await instanz();
    const viewer = await konto(app, admin, "viewer", "viewer.pbe12@beispiel.test");
    const konten = await services.auth.listUsers();
    const viewerId = konten.find((u) => u.email === "viewer.pbe12@beispiel.test")?.id ?? "";
    expect(viewerId).not.toBe("");
    const zuweisen = (kopf: Kopf, konto: string, zuweisung: unknown, fassung = 0) =>
      app.inject({
        method: "PUT",
        url: `/api/admin/produktbudget/nr32-chatgpt/konten/${konto}`,
        headers: kopf,
        payload: { zuweisung, fassung },
      });
    const unterlimit = (kopf: Kopf, payload: Record<string, unknown>) =>
      app.inject({
        method: "PUT",
        url: "/api/me/produktbudget/nr32-chatgpt",
        headers: kopf,
        payload,
      });

    // Nur die Verwaltung weist zu — der Anwender nicht, auch nicht sich selbst.
    expect((await zuweisen(viewer, viewerId, "20")).statusCode).toBe(403);
    expect((await zuweisen(admin, "gibt-es-nicht", "5")).statusCode).toBe(404);
    expect((await zuweisen(admin, viewerId, "20,01")).statusCode).toBe(400);
    const ok = await zuweisen(admin, viewerId, "6");
    expect(ok.statusCode, ok.body).toBe(200);

    // Der Anwender sieht seine Zuweisung und setzt sein Unterlimit — innerhalb.
    const eigen = await app.inject({
      method: "GET",
      url: "/api/me/produktbudget",
      headers: viewer,
    });
    expect(eigen.statusCode).toBe(200);
    type Eigen = {
      bereich: string;
      zuweisungCent: number;
      unterlimitCent: number | null;
      fassung: number;
    };
    const chatgpt = (eigen.json() as { bereiche: Eigen[] }).bereiche.find(
      (b) => b.bereich === "nr32-chatgpt",
    );
    expect(chatgpt).toMatchObject({ zuweisungCent: 600, unterlimitCent: null, fassung: 1 });
    const zuHoch = await unterlimit(viewer, { unterlimit: "6,01", fassung: 1 });
    expect(zuHoch.statusCode).toBe(400);
    expect((zuHoch.json() as { grund: string }).grund).toBe("unterlimit");
    // Gesamtbetrag, Zuweisung oder ein fremdes Konto über den eigenen Weg: 403.
    for (const fremd of [{ zuweisung: "20" }, { betrag: "99" }, { konto: "x" }, { mandant: "m" }]) {
      const res = await unterlimit(viewer, { unterlimit: "1", fassung: 1, ...fremd });
      expect(res.statusCode, JSON.stringify(fremd)).toBe(403);
    }
    const gesetzt = await unterlimit(viewer, { unterlimit: "4", fassung: 1 });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    // Der Viewer hat das globale Limit nicht geändert; die Verwaltung sieht Zuweisung und Unterlimit.
    expect((await put(app, viewer, "nr32-chatgpt", { ...GUELTIG })).statusCode).toBe(403);
    const b = (await lies(app, admin)).find((x) => x.bereich === "nr32-chatgpt") as Bereich & {
      konten: {
        konto: string;
        zuweisungCent: number;
        unterlimitCent: number;
        grenzeCent: number;
      }[];
    };
    expect(b.betragCent).toBe(2000);
    expect(b.konten.find((k) => k.konto === viewerId)).toMatchObject({
      zuweisungCent: 600,
      unterlimitCent: 400,
      grenzeCent: 400,
    });
    const anonym = await app.inject({ method: "GET", url: "/api/me/produktbudget" });
    expect(anonym.statusCode).toBe(401);
  });
});

describe("S4 · Neustart", () => {
  it("eine neue App an derselben Ablage liest den gespeicherten Stand", async () => {
    const repo = new InMemoryProduktbudgetRepo();
    const erste = await instanz(repo);
    expect((await put(erste.app, erste.admin, "perplexity-poc", GUELTIG)).statusCode).toBe(200);
    await erste.app.close();
    const zweite = await instanz(repo);
    const p = (await lies(zweite.app, zweite.admin)).find((b) => b.bereich === "perplexity-poc");
    expect(p).toMatchObject({ betragCent: 2400, fassung: 1 });
    expect(p?.letzteAenderungen.map((a) => a.aenderungId)).toEqual(["aenderung-server-0001"]);
  });
});

describe("S5 · eine Budgetänderung eröffnet keine Verarbeitung", () => {
  it("Perplexity bleibt als Fähigkeit nicht verfügbar — mit den konkreten offenen Voraussetzungen", async () => {
    const { app, admin } = await instanz();
    expect((await put(app, admin, "perplexity-poc", GUELTIG)).statusCode).toBe(200);
    const res = await app.inject({ method: "GET", url: "/api/me/faehigkeiten", headers: admin });
    expect(res.statusCode).toBe(200);
    type Sicht = { id: string; verfuegbar: boolean; voraussetzungen: { art: string }[] };
    const liste = (res.json() as { faehigkeiten: Sicht[] }).faehigkeiten;
    const f = liste.find((x) => x.id === "perplexity-suche");
    expect(f?.verfuegbar).toBe(false);
    const arten = f?.voraussetzungen.map((v) => v.art) ?? [];
    // Kein Adapter, kein Zugang, kein belegter Tarif, keine Anbieterfreigabe — ein Budget ersetzt
    // keine dieser Voraussetzungen.
    expect(arten).toEqual(expect.arrayContaining(["adapter", "credential", "budget", "anbieter"]));
  });
});

describe("S6 · Prüfprotokoll", () => {
  it("die Änderung steht mit Bereich und Kennung im Protokoll; die Wiederholung nicht noch einmal", async () => {
    const { app, services, admin } = await instanz();
    expect((await put(app, admin, "perplexity-poc", GUELTIG)).statusCode).toBe(200);
    const nochmal = await put(app, admin, "perplexity-poc", GUELTIG);
    expect(nochmal.statusCode).toBe(200);
    expect((nochmal.json() as { wiederholt: boolean }).wiederholt).toBe(true);
    const eintraege = (await services.audit.list()).filter(
      (e) => e.action === "produktbudget.geaendert",
    );
    expect(eintraege.map((e) => e.target)).toEqual([
      "produktbudget:perplexity-poc:aenderung-server-0001",
    ]);
  });
});
