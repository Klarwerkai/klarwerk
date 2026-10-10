// ================================================================================================
// KLARA 05 (produkt:20261008:klara-aktionen) · Nacharbeit 4 — BENS BEFUNDE AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`) —
// dieselbe Vorrichtung wie `auftragsgrenze-am-server.test.ts`.
//
//   B1 · K1/K2  Eine Aufgabenaktion (Priorität, Zuweisung an einer Lücke; Eskalation an einem
//               Konflikt) wird über den vorhandenen Fachweg AUSGEFÜHRT und nachgelesen; „nur öffnen“
//               bleibt getrennt. Wiederholung schreibt nicht doppelt; Rückgängig gibt es dafür nicht.
//   B2 · K5/K10 Fehlt die Aktion oder passt sie nicht zur Aufgabe, legt der Server den Auftrag nicht an.
//   B3 · K5     Nachlesen fällt nach erfolgreichem Schreiben aus: Kennung und Wirkung bleiben, der
//               Schritt ist ungeklärt (nicht gescheitert); die Wiederholung liest nur nach — beim
//               Anlegen, Bearbeiten und an der Aufgabe. Der Browser macht daraus kein „gescheitert“.
//   B4 · K4     Löschen mit erwartetem Stand ist UNTEILBAR: ändert sich der Entwurf zwischen der
//               Vorprüfung und dem Löschen, antwortet der Weg 409 und der Entwurf bleibt.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { KlaraAusfuehrung, type KlaraRufe } from "../../services/app/src/klara-ausfuehrung";
import { KlaraGespraechDienst } from "../../services/app/src/klara-gespraech";

type App = ReturnType<typeof buildApp>;

let repos: ReturnType<typeof inMemoryRepos>;
let services: AppServices;
let app: App;
let ada = { id: "", token: "" };
let erik = { id: "", token: "" };

const BASIS = "/api/me/klara";
const BEZUG = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };
const kurz = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SchrittAntwort = {
  auftrag: KlaraAuftrag;
  schritt: KlaraAuftrag["schritte"][number];
  wiederholt: boolean;
};

interface Entwurf {
  id: string;
  updatedAt: string;
  payload: { title?: string; statement?: string };
}

const auf = (
  wer: string,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await auf("", "POST", "/api/auth/login", { email, password: "secret123" });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function ich(token: string): Promise<string> {
  return ((await auf(token, "GET", "/api/auth/me")).json() as { id: string }).id;
}

async function gespraech(wer: string): Promise<string> {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche`, { objektbezug: BEZUG });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

function auftragsEingabe(ziel: Record<string, unknown>, plan: Record<string, unknown>[]) {
  return {
    quelle: "getippt",
    wortlaut: "Fiktiver Auftrag",
    ziel: "Fiktives Ziel",
    erlaubteAktionen: [...new Set(plan.map((p) => p.aktion as string))],
    erlaubteZiele: [ziel],
    erlaubteQuellen: ["Deine Eingabe (getippt)"],
    ergebnis: "Am Server nachgelesen",
    geplanteSchritte: plan.length,
    plan,
  };
}

async function auftrag(
  wer: string,
  gid: string,
  ziel: Record<string, unknown>,
  plan: Record<string, unknown>[],
): Promise<KlaraAuftrag> {
  const r = await auf(
    wer,
    "POST",
    `${BASIS}/gespraeche/${gid}/auftraege`,
    auftragsEingabe(ziel, plan),
  );
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { auftrag: KlaraAuftrag }).auftrag;
}

function schrittPfad(gid: string, aid: string, schluessel: string): string {
  return `${BASIS}/gespraeche/${gid}/auftraege/${aid}/schritte/${schluessel}`;
}

async function fuehreAus(wer: string, gid: string, aid: string, schluessel: string, nr: number) {
  const r = await auf(wer, "POST", `${schrittPfad(gid, aid, schluessel)}/ausfuehrung`, {
    nr,
    auftragFassung: 1,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as SchrittAntwort;
}

/** Eine offene, fiktive Wissenslücke in der Ablage — so, wie eine unbeantwortete Frage sie anlegt. */
async function luecke(id: string, frage: string): Promise<Record<string, unknown>> {
  await repos.gaps.insert({
    id,
    question: frage,
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: new Date().toISOString(),
  });
  return { art: "aufgabe", id, titel: frage, stand: null, pfad: `/risiko?fall=${id}` };
}

async function wissensobjekt(title: string): Promise<{ id: string; version: number }> {
  const r = await auf(ada.token, "POST", "/api/kos", {
    title,
    statement: `${title} – fiktive Prüfangabe.`,
    type: "best_practice",
    category: "Betrieb",
    confidentiality: "intern",
    neededValidations: 1,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; version: number };
}

/**
 * Die Türen der Anwendung mit der Anmeldung der Person — wie `rufeFuer` in der Route, mit einem
 * Schalter, der das NACHLESEN nach einem erfolgreichen Schreiben ausfallen lässt, und einer Liste
 * aller schreibenden Aufrufe.
 */
function rufeMit(token: string, nachSchreibenAusfallen: (url: string) => boolean) {
  const schreibend: string[] = [];
  let geschrieben = false;
  const rufe: KlaraRufe = async (methode, url, rumpf) => {
    if (methode === "GET" && geschrieben && nachSchreibenAusfallen(url)) {
      return { status: 503, daten: null };
    }
    const r = await auf(token, methode, url, rumpf);
    if (methode !== "GET") {
      schreibend.push(`${methode} ${url.split("?")[0]}`);
      geschrieben = r.statusCode < 300;
    }
    let daten: unknown = null;
    try {
      daten = r.body ? r.json() : null;
    } catch {
      daten = null;
    }
    return { status: r.statusCode, daten };
  };
  return { rufe, schreibend };
}

beforeEach(async () => {
  repos = inMemoryRepos();
  services = assembleServices(repos);
  app = buildApp(services);
  await auf("", "POST", "/api/auth/register", {
    name: "Ada Admin",
    email: "ada@klara-aufgaben.test",
    password: "secret123",
  });
  const adaToken = await anmelden("ada@klara-aufgaben.test");
  ada = { id: await ich(adaToken), token: adaToken };
  const angelegt = await auf(adaToken, "POST", "/api/users", {
    name: "Erik Experte",
    email: "erik@klara-aufgaben.test",
    password: "secret123",
    role: "experte",
  });
  expect(angelegt.statusCode).toBe(201);
  const erikToken = await anmelden("erik@klara-aufgaben.test");
  erik = { id: (angelegt.json() as { id: string }).id, token: erikToken };
});

describe("B1 · K1/K2 — eine Aufgabenaktion wird ausgeführt und nachgelesen, nicht nur geöffnet", () => {
  it("Lücke: Priorität setzen und zuweisen über PUT /api/gaps/:id — nachgelesen, ohne Doppelung", async () => {
    const ziel = await luecke("gap-klara-1", "Wie oft wird Filter F3 gewechselt?");
    const gid = await gespraech(ada.token);
    const a = await auftrag(ada.token, gid, ziel, [
      {
        aktion: "aufgabe_bearbeiten",
        ziel,
        ausSchritt: null,
        aufgabenaktion: { art: "prioritaet", wert: "hoch" },
      },
      {
        aktion: "aufgabe_bearbeiten",
        ziel,
        ausSchritt: null,
        aufgabenaktion: { art: "zuweisen", personId: erik.id, personName: "Erik Experte" },
      },
    ]);
    expect(a.plan?.[0]?.aufgabenaktion).toEqual({ art: "prioritaet", wert: "hoch" });

    const p = await fuehreAus(ada.token, gid, a.id, "s-1", 1);
    expect(p.schritt).toMatchObject({
      stand: "gespeichert",
      ruecknehmbar: false,
      ergebnis: { art: "aufgabe", id: "gap-klara-1", stand: "prioritaet:hoch" },
    });
    const z = await fuehreAus(ada.token, gid, a.id, "s-2", 2);
    expect(z.schritt).toMatchObject({
      stand: "gespeichert",
      ergebnis: { stand: "zugewiesen:Erik Experte" },
    });
    expect(z.auftrag.stand).toBe("abgeschlossen");

    // Die Wirkung steht wirklich am Fachweg.
    const luecken = (await auf(ada.token, "GET", "/api/gaps")).json() as {
      id: string;
      priority: string;
      assignee: string | null;
    }[];
    expect(luecken.find((g) => g.id === "gap-klara-1")).toMatchObject({
      priority: "hoch",
      assignee: erik.id,
    });

    // Wiederholung mit demselben Schlüssel: derselbe Schritt, keine zweite Schreibwirkung.
    const wieder = await fuehreAus(ada.token, gid, a.id, "s-1", 1);
    expect(wieder.wiederholt).toBe(true);
    expect(await services.audit.list({ action: "gap.priority-changed" })).toHaveLength(1);

    // Rückgängig gibt es dafür nicht — die Wirkung bleibt und steht als solche da.
    const zurueck = await auf(ada.token, "POST", `${schrittPfad(gid, a.id, "s-1")}/ruecknahme`, {});
    expect(zurueck.statusCode).toBe(409);
    expect((zurueck.json() as { grund: string }).grund).toBe("nicht_ruecknehmbar");
  });

  it("Konflikt: eskalieren über POST /api/conflicts/:id/escalate — nachgelesen; „nur öffnen“ ändert nichts", async () => {
    const x = await wissensobjekt("Drehmoment Flansch 40 Nm");
    const y = await wissensobjekt("Drehmoment Flansch 55 Nm");
    const konflikt = await services.conflicts.create({
      koA: x.id,
      koB: y.id,
      type: "truth",
      description: "Widersprüchliches Drehmoment am Flansch",
      koAVersion: x.version,
      koBVersion: y.version,
    });
    const ziel = {
      art: "aufgabe",
      id: konflikt.id,
      titel: "Widersprüchliches Drehmoment am Flansch",
      stand: null,
      pfad: `/konflikte?fall=${konflikt.id}`,
    };
    const gid = await gespraech(ada.token);
    const nurOeffnen = await auftrag(ada.token, gid, ziel, [
      {
        aktion: "aufgabe_bearbeiten",
        ziel,
        ausSchritt: null,
        aufgabenaktion: { art: "nur_oeffnen" },
      },
    ]);
    const o = await fuehreAus(ada.token, gid, nurOeffnen.id, "o-1", 1);
    // Öffnen bleibt getrennt: bestätigt, nichts geschrieben.
    expect(o.schritt).toMatchObject({ stand: "begonnen", geprueft: { id: konflikt.id } });
    expect(
      ((await auf(ada.token, "GET", `/api/conflicts/${konflikt.id}`)).json() as { status: string })
        .status,
    ).toBe("offen");

    const a = await auftrag(ada.token, gid, ziel, [
      {
        aktion: "aufgabe_bearbeiten",
        ziel,
        ausSchritt: null,
        aufgabenaktion: { art: "eskalieren" },
      },
    ]);
    const e = await fuehreAus(ada.token, gid, a.id, "e-1", 1);
    expect(e.schritt).toMatchObject({
      stand: "gespeichert",
      ergebnis: { art: "aufgabe", id: konflikt.id, stand: "eskaliert" },
    });
    expect(
      ((await auf(ada.token, "GET", `/api/conflicts/${konflikt.id}`)).json() as { status: string })
        .status,
    ).toBe("eskaliert");
  });

  it("fehlendes Recht am Fachweg: kein Erfolg, nichts geändert", async () => {
    const ziel = await luecke("gap-klara-2", "Wer prüft Ventil V2?");
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid, ziel, [
      {
        aktion: "aufgabe_bearbeiten",
        ziel,
        ausSchritt: null,
        aufgabenaktion: { art: "prioritaet", wert: "niedrig" },
      },
    ]);
    const s = (await fuehreAus(erik.token, gid, a.id, "s-1", 1)).schritt;
    // Experte hat `ko.assign` nicht: der Fachweg lehnt ab (oder zeigt die Lücke gar nicht an).
    expect(s.stand).toBe("fehlgeschlagen");
    expect(["recht", "nichtVerfuegbar"]).toContain(s.fehlerCode);
    const g = (await repos.gaps.findById("gap-klara-2")) as { priority: string };
    expect(g.priority).toBe("mittel");
  });
});

describe("B2 · K5/K10 — ohne geklärte, passende Aktion entsteht kein Auftrag", () => {
  it("fehlende Aktion, eine Aktion, die die Aufgabe nicht anbietet, und Prüfungsentscheid: 400", async () => {
    const lueckenZiel = await luecke("gap-klara-3", "Fiktive Frage");
    const konfliktZiel = {
      art: "aufgabe",
      id: "k-fiktiv",
      titel: "Fiktiver Konflikt",
      stand: null,
      pfad: "/konflikte?fall=k-fiktiv",
    };
    const pruefZiel = {
      art: "aufgabe",
      id: "ko-fiktiv",
      titel: "Fiktive Prüfung",
      stand: null,
      pfad: "/wissen/ko-fiktiv",
    };
    const gid = await gespraech(ada.token);
    for (const [ziel, aufgabenaktion] of [
      [lueckenZiel, undefined],
      [lueckenZiel, { art: "eskalieren" }],
      [konfliktZiel, { art: "prioritaet", wert: "hoch" }],
      [pruefZiel, { art: "zuweisen", personId: erik.id, personName: "Erik Experte" }],
      [lueckenZiel, { art: "versenden" }],
    ] as const) {
      const r = await auf(
        ada.token,
        "POST",
        `${BASIS}/gespraeche/${gid}/auftraege`,
        auftragsEingabe(ziel, [
          {
            aktion: "aufgabe_bearbeiten",
            ziel,
            ausSchritt: null,
            ...(aufgabenaktion ? { aufgabenaktion } : {}),
          },
        ]),
      );
      expect(r.statusCode, JSON.stringify(aufgabenaktion)).toBe(400);
    }
    const liste = await auf(ada.token, "GET", `${BASIS}/gespraeche/${gid}/auftraege`);
    expect((liste.json() as { auftraege: unknown[] }).auftraege).toEqual([]);
  });
});

describe("B3 · K5 — Nachlesen fällt nach erfolgreichem Schreiben aus: ungeklärt, nicht verloren", () => {
  function ausfuehrung(): KlaraAusfuehrung {
    // Dieselbe Ablage der Gespräche wie die Anwendung — nur das Nachlesen ist gestört.
    return new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
  }

  it("Anlegen: Kennung bleibt, Schritt ungeklärt; die Wiederholung liest nur nach", async () => {
    const ziel = {
      art: "neuer_entwurf",
      id: null,
      titel: "Prüfplan Pumpe P8",
      stand: null,
      pfad: null,
    };
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid, ziel, [
      { aktion: "entwurf_erstellen", ziel, ausSchritt: null, inhalt: "Fiktiver Inhalt." },
    ]);
    const { rufe, schreibend } = rufeMit(erik.token, (url) => url.startsWith("/api/drafts/"));
    const r = await ausfuehrung().fuehreAus(
      erik.id,
      gid,
      a.id,
      "s-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(r.schritt.stand).toBe("begonnen");
    expect(r.schritt.geprueft ?? null).toBeNull();
    const id = r.schritt.schreibwirkung?.id as string;
    expect(r.schritt.schreibwirkung).toMatchObject({
      art: "entwurf",
      pfad: `/erfassen?draft=${id}`,
    });
    expect(r.auftrag.stand).not.toBe("fehlgeschlagen");
    expect(r.auftrag.stand).not.toBe("abgeschlossen");
    // Die Wirkung ist echt: der Entwurf existiert.
    expect((await auf(erik.token, "GET", `/api/drafts/${id}`)).statusCode).toBe(200);

    // Der Browser macht aus dem ungeklärten Schritt kein „gescheitert“.
    const behauptet = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel,
      auftragFassung: 1,
      stand: "fehlgeschlagen",
      grund: "Netz weg",
    });
    expect(behauptet.statusCode).toBe(409);
    expect((behauptet.json() as { grund: string }).grund).toBe("nur_server");

    // Wiederholung über die echte Tür: nur Nachlesen, dieselbe Kennung, kein zweiter Entwurf.
    const wieder = await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    expect(wieder.schritt).toMatchObject({
      stand: "gespeichert",
      ergebnis: { id },
      ruecknehmbar: true,
    });
    expect(schreibend).toEqual(["POST /api/drafts"]);
    expect((await auf(erik.token, "GET", "/api/drafts")).json()).toHaveLength(1);
  });

  it("Bearbeiten: die Ergänzung steht genau einmal da, auch nach der Wiederholung", async () => {
    const d = (
      await auf(erik.token, "POST", "/api/drafts", { title: "Ölstand", statement: "Basis." })
    ).json() as Entwurf;
    const ziel = { art: "entwurf", id: d.id, titel: "Ölstand", stand: d.updatedAt, pfad: null };
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid, ziel, [
      {
        aktion: "entwurf_bearbeiten",
        ziel,
        ausSchritt: null,
        aenderung: { art: "ergaenzen", text: "Messstab prüfen" },
      },
    ]);
    const { rufe, schreibend } = rufeMit(erik.token, (url) => url.startsWith("/api/drafts/"));
    const r = await ausfuehrung().fuehreAus(
      erik.id,
      gid,
      a.id,
      "s-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(r.schritt).toMatchObject({
      stand: "begonnen",
      schreibwirkung: { art: "entwurf", id: d.id },
    });
    const wieder = await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    expect(wieder.schritt.stand).toBe("gespeichert");
    expect(schreibend).toEqual([`PUT /api/drafts/${d.id}`]);
    const jetzt = (await auf(erik.token, "GET", `/api/drafts/${d.id}`)).json() as Entwurf;
    expect(jetzt.payload.statement?.split("Messstab prüfen")).toHaveLength(2);
    // Rückgängig bleibt möglich: der vorherige Stand war vor dem Schreiben festgehalten.
    const zurueck = await auf(
      erik.token,
      "POST",
      `${schrittPfad(gid, a.id, "s-1")}/ruecknahme`,
      {},
    );
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(
      ((await auf(erik.token, "GET", `/api/drafts/${d.id}`)).json() as Entwurf).payload.statement,
    ).toBe("Basis.");
  });

  it("Aufgabe: Priorität gesetzt, Nachlesen fällt aus — die Wiederholung setzt sie nicht erneut", async () => {
    const ziel = await luecke("gap-klara-4", "Fiktive Frage zu Lager L1");
    const gid = await gespraech(ada.token);
    const a = await auftrag(ada.token, gid, ziel, [
      {
        aktion: "aufgabe_bearbeiten",
        ziel,
        ausSchritt: null,
        aufgabenaktion: { art: "prioritaet", wert: "hoch" },
      },
    ]);
    const { rufe, schreibend } = rufeMit(ada.token, (url) => url === "/api/gaps");
    const r = await ausfuehrung().fuehreAus(
      ada.id,
      gid,
      a.id,
      "s-1",
      { nr: 1, auftragFassung: 1 },
      rufe,
    );
    expect(r.schritt).toMatchObject({
      stand: "begonnen",
      schreibwirkung: { art: "aufgabe", id: "gap-klara-4" },
    });
    const wieder = await fuehreAus(ada.token, gid, a.id, "s-1", 1);
    expect(wieder.schritt).toMatchObject({
      stand: "gespeichert",
      ergebnis: { stand: "prioritaet:hoch" },
    });
    expect(schreibend).toEqual(["PUT /api/gaps/gap-klara-4"]);
    expect(await services.audit.list({ action: "gap.priority-changed" })).toHaveLength(1);
  });
});

describe("B4 · K4 — Löschen mit erwartetem Stand ist unteilbar", () => {
  it("eine Änderung zwischen Vorprüfung und Löschen: 409, der Entwurf bleibt mit der Änderung", async () => {
    const d = (
      await auf(erik.token, "POST", "/api/drafts", { title: "Riemen R4", statement: "Basis." })
    ).json() as Entwurf;
    const ablage = repos.drafts as typeof repos.drafts & {
      deleteWennStand: NonNullable<typeof repos.drafts.deleteWennStand>;
    };
    const original = ablage.deleteWennStand.bind(ablage);
    // Die konkurrierende Änderung landet genau zwischen der Vorprüfung des Dienstes und dem Löschen.
    ablage.deleteWennStand = async (...args) => {
      await kurz(5);
      const dazwischen = await auf(erik.token, "PUT", `/api/drafts/${d.id}`, {
        statement: "Dazwischen geändert.",
      });
      expect(dazwischen.statusCode, dazwischen.body).toBe(200);
      return original(...args);
    };
    const geloescht = await auf(
      erik.token,
      "DELETE",
      `/api/drafts/${d.id}?expectedUpdatedAt=${encodeURIComponent(d.updatedAt)}`,
    );
    expect(geloescht.statusCode).toBe(409);
    const jetzt = await auf(erik.token, "GET", `/api/drafts/${d.id}`);
    expect(jetzt.statusCode).toBe(200);
    expect((jetzt.json() as Entwurf).payload.statement).toBe("Dazwischen geändert.");
    const korb = (await auf(erik.token, "GET", "/api/drafts/trash")).json() as { id: string }[];
    expect(korb.map((x) => x.id)).not.toContain(d.id);

    // Ohne Änderung dazwischen löscht derselbe Weg (in den Papierkorb).
    ablage.deleteWennStand = original;
    const stand = (jetzt.json() as Entwurf).updatedAt;
    const ok = await auf(
      erik.token,
      "DELETE",
      `/api/drafts/${d.id}?expectedUpdatedAt=${encodeURIComponent(stand)}`,
    );
    expect(ok.statusCode).toBe(204);
    expect((await auf(erik.token, "GET", `/api/drafts/${d.id}`)).statusCode).toBe(404);
  });
});
