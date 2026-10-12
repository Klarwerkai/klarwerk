// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) · DER UNTERSTÜTZUNGSMODUS AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`),
// jeder Schritt über HTTP mit fiktiven Testkonten. Die Haltbarkeit in PostgreSQL misst diese Datei
// nicht (siehe Grenzen im Prüfplan); die Ablage nutzt dieselbe Zeile wie das Assistenzprofil.
//
//   E1 · K1  Ohne Wahl gilt „Nur auf Nachfrage“; jeder der drei Modi ist wählbar und gespeichert.
//   E2 · K1/K4  Neue Anmeldung (zweites Gerät, Neuladen) liest denselben Modus; ein zweites Konto
//            hat seinen eigenen.
//   E3 · K4  Rechte: fremde Kennung → 403 und nichts geändert; ohne Anmeldung 401; ungültig → 400.
//   E4 · K3  Ein geschlossener bzw. zurückgestellter Hinweis ruht — mit Frist, je Konto; dieselbe
//            Ablage ersetzt die frühere statt sich zu stapeln; abgelaufene ruhen nicht mehr.
//   E5 · K1  Das Assistenzprofil bleibt unberührt: Name/Avatar ändern lässt den Modus stehen, ein
//            Moduswechsel lässt die Profilfassung stehen (kein 409 im Profilformular).
//   E6 · K1  Prüfprotokoll: der Moduswechsel als Ereignis, ohne Hinweisschlüssel.
import { beforeEach, describe, expect, it } from "vitest";
import {
  GESCHLOSSEN_MS,
  ZURUECKGESTELLT_MS,
} from "../../services/app/src/assistenz-eigeninitiative";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { ASSISTENZ_EIGENINITIATIVE_GEAENDERT } from "../../services/app/src/routes/assistenz-profil-routes";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

const BASIS = "/api/me/assistenz/eigeninitiative";

interface Stand {
  modus: "nachfrage" | "hinweise" | "auftraege";
  gewaehlt: boolean;
  geaendertAm: string | null;
  hinweise: { schluessel: string; stand: string; bis: string }[];
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "PUT" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function lies(wer: string): Promise<Stand> {
  const r = await auf(wer, "GET", BASIS);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Stand;
}

async function waehle(wer: string, modus: string): Promise<Stand> {
  const r = await auf(wer, "PUT", BASIS, { modus });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Stand;
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@initiative.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@initiative.test");
  erik = await konto(adminToken, "experte", "erik@initiative.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@initiative.test", "Vera Viewer");
});

describe("E1 · K1 — drei Modi, persönlich gespeichert; ohne Wahl still", () => {
  it("Vorgabe ist „Nur auf Nachfrage“, jeder Modus wird gespeichert und zurückgemeldet", async () => {
    expect(await lies(erik.token)).toEqual({
      modus: "nachfrage",
      gewaehlt: false,
      geaendertAm: null,
      hinweise: [],
    });
    for (const modus of ["hinweise", "auftraege", "nachfrage"] as const) {
      const s = await waehle(erik.token, modus);
      expect(s.modus).toBe(modus);
      expect(s.gewaehlt).toBe(true);
      expect((await lies(erik.token)).modus).toBe(modus);
    }
  });
});

describe("E2 · K1/K4 — über Anmeldung hinweg, je Konto", () => {
  it("eine neue Anmeldung liest denselben Modus; ein zweites Konto bleibt unberührt", async () => {
    await waehle(erik.token, "auftraege");
    const zweiteAnmeldung = await anmelden("erik@initiative.test");
    expect(zweiteAnmeldung).not.toBe(erik.token);
    expect((await lies(zweiteAnmeldung)).modus).toBe("auftraege");
    expect(await lies(vera.token)).toMatchObject({ modus: "nachfrage", gewaehlt: false });
    await waehle(vera.token, "hinweise");
    expect((await lies(zweiteAnmeldung)).modus).toBe("auftraege");
  });
});

describe("E3 · K4 — Rechte und Prüfung", () => {
  it("fremde Kennung in Rumpf oder Adresse → 403, nichts geändert", async () => {
    await waehle(vera.token, "hinweise");
    const rumpf = await auf(erik.token, "PUT", BASIS, { modus: "auftraege", kontoId: vera.id });
    expect(rumpf.statusCode).toBe(403);
    const adresse = await auf(erik.token, "GET", `${BASIS}?kontoId=${vera.id}`);
    expect(adresse.statusCode).toBe(403);
    const hinweis = await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "seite:fragen",
      stand: "geschlossen",
      userId: vera.id,
    });
    expect(hinweis.statusCode).toBe(403);
    expect(await lies(vera.token)).toMatchObject({ modus: "hinweise", hinweise: [] });
    expect(await lies(erik.token)).toMatchObject({ modus: "nachfrage", gewaehlt: false });
  });

  it("ohne Anmeldung 401", async () => {
    expect((await auf("", "GET", BASIS)).statusCode).toBe(401);
    expect((await auf("", "PUT", BASIS, { modus: "hinweise" })).statusCode).toBe(401);
    const ablage = { schluessel: "seite:x", stand: "geschlossen" };
    expect((await auf("", "POST", `${BASIS}/hinweise`, ablage)).statusCode).toBe(401);
  });

  it("ungültiger Modus → 400, nichts gespeichert", async () => {
    for (const rumpf of [{ modus: "immer" }, { modus: "" }, {}]) {
      const r = await auf(erik.token, "PUT", BASIS, rumpf);
      expect([JSON.stringify(rumpf), r.statusCode]).toEqual([JSON.stringify(rumpf), 400]);
    }
    expect(await lies(erik.token)).toMatchObject({ modus: "nachfrage", gewaehlt: false });
  });

  it("ungültige Hinweisablage → 400, nichts abgelegt", async () => {
    const faelle = [
      { schluessel: "", stand: "geschlossen" },
      { schluessel: "ohne-doppelpunkt", stand: "geschlossen" },
      { schluessel: "seite:<b>", stand: "geschlossen" },
      { schluessel: "seite:fragen", stand: "fuer-immer" },
    ];
    for (const rumpf of faelle) {
      const r = await auf(erik.token, "POST", `${BASIS}/hinweise`, rumpf);
      expect([JSON.stringify(rumpf), r.statusCode]).toEqual([JSON.stringify(rumpf), 400]);
    }
    expect((await lies(erik.token)).hinweise).toEqual([]);
  });
});

describe("E4 · K3 — geschlossene und zurückgestellte Hinweise ruhen", () => {
  it("mit Frist, je Konto, ohne Stapel; der Modus bleibt dabei unverändert", async () => {
    await waehle(erik.token, "hinweise");
    const vorher = Date.now();
    let r = await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "tutorial:fragen",
      stand: "zurueckgestellt",
    });
    expect(r.statusCode, r.body).toBe(200);
    r = await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "seite:bibliothek",
      stand: "geschlossen",
    });
    expect(r.statusCode, r.body).toBe(200);
    const s = await lies(erik.token);
    expect(s.modus).toBe("hinweise");
    const nach = Object.fromEntries(s.hinweise.map((h) => [h.schluessel, h]));
    expect(nach["tutorial:fragen"]?.stand).toBe("zurueckgestellt");
    expect(nach["seite:bibliothek"]?.stand).toBe("geschlossen");
    const bisSpaeter = Date.parse(nach["tutorial:fragen"]?.bis ?? "");
    const bisZu = Date.parse(nach["seite:bibliothek"]?.bis ?? "");
    expect(bisSpaeter - vorher).toBeGreaterThanOrEqual(ZURUECKGESTELLT_MS - 5000);
    expect(bisSpaeter - vorher).toBeLessThanOrEqual(ZURUECKGESTELLT_MS + 5000);
    expect(bisZu - vorher).toBeGreaterThanOrEqual(GESCHLOSSEN_MS - 5000);

    // Später doch geschlossen: dieselbe Ablage wird ersetzt, nicht gestapelt.
    await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "tutorial:fragen",
      stand: "geschlossen",
    });
    const danach = await lies(erik.token);
    expect(danach.hinweise.filter((h) => h.schluessel === "tutorial:fragen")).toHaveLength(1);
    expect(danach.hinweise.find((h) => h.schluessel === "tutorial:fragen")?.stand).toBe(
      "geschlossen",
    );

    // Neue Anmeldung: die Hinweise ruhen weiter. Ein anderes Konto hat keine.
    expect((await lies(await anmelden("erik@initiative.test"))).hinweise).toHaveLength(2);
    expect((await lies(vera.token)).hinweise).toEqual([]);
  });

  it("nach Ablauf der Frist ruht ein zurückgestellter Hinweis nicht mehr", async () => {
    const repo = services.assistenzProfile;
    await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "seite:fragen",
      stand: "zurueckgestellt",
    });
    // Die Frist liegt in der Vergangenheit — so, als wären vier Stunden vergangen.
    const p = await repo.hole(erik.id);
    const alt = p?.eigeninitiative ?? null;
    expect(alt?.hinweise).toHaveLength(1);
    const abgelaufen = {
      ...(alt as NonNullable<typeof alt>),
      hinweise: (alt?.hinweise ?? []).map((h) => ({
        ...h,
        bis: new Date(Date.now() - 1000).toISOString(),
      })),
    };
    expect(await repo.schreibeEigeninitiative(erik.id, alt, abgelaufen)).toBe(true);
    expect((await lies(erik.token)).hinweise).toEqual([]);
  });
});

describe("E5 · K1 — das Assistenzprofil bleibt unberührt", () => {
  it("Profiländerung lässt den Modus stehen; Moduswechsel lässt die Profilfassung stehen", async () => {
    const eingerichtet = await auf(erik.token, "PUT", "/api/me/assistenz", {
      name: "Mia",
      avatar: "eule",
      bewegung: "standard",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(eingerichtet.statusCode, eingerichtet.body).toBe(200);
    await waehle(erik.token, "auftraege");
    await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "seite:fragen",
      stand: "geschlossen",
    });
    // Die Profilfassung ist noch 1 — das Formular speichert ohne Konflikt.
    const geaendert = await auf(erik.token, "PUT", "/api/me/assistenz", {
      name: "Mia 2",
      fassung: 1,
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    expect((geaendert.json() as { profil: { fassung: number } }).profil.fassung).toBe(2);
    const s = await lies(erik.token);
    expect(s.modus).toBe("auftraege");
    expect(s.hinweise.map((h) => h.schluessel)).toEqual(["seite:fragen"]);
    // Ohne eingerichtetes Profil entsteht durch den Modus kein Profil.
    await waehle(vera.token, "hinweise");
    const veraProfil = await auf(vera.token, "GET", "/api/me/assistenz");
    expect(veraProfil.json()).toEqual({ profil: null, einrichtungOffen: true });
  });
});

describe("E6 · K1 — Prüfprotokoll", () => {
  it("der Moduswechsel steht als Ereignis da; Hinweisschlüssel nicht", async () => {
    await waehle(erik.token, "hinweise");
    await auf(erik.token, "POST", `${BASIS}/hinweise`, {
      schluessel: "ungeprueft:ko-geheim-123",
      stand: "geschlossen",
    });
    const ereignisse = await services.audit.list({ action: ASSISTENZ_EIGENINITIATIVE_GEAENDERT });
    expect(ereignisse.map((e) => e.actor)).toEqual([erik.id]);
    const alle = JSON.stringify(await services.audit.list({}));
    expect(alle).not.toContain("ko-geheim-123");
  });
});
