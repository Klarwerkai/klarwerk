// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · DIE FÄHIGKEITEN AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`),
// jeder Schritt über HTTP mit fiktiven Testkonten. Die zusätzlichen Testfähigkeiten werden über
// die Registry der laufenden Ausführung registriert (administrativer Schritt) und haben einen
// Ersatztransport — das belegt Verdrahtung, Rechte und Zustände, NICHT eine reale Anbieterwirkung.
//
//   F1  Übersicht: Produktverträge mit Datenweg, Grenzen und konkreten Voraussetzungen; Perplexity
//       ohne Adapter, Zugang, Budget und Anbieterfreigabe; kein Zugangswert.
//   F2  Vorschau → Ausführung (Bestätigung Pflicht) → eigene Auftragsliste; fremde Konten sehen
//       den Auftrag nicht.
//   F3  Die Lage kommt aus dem laufenden Server: KI-Abschaltung über den Reasoner, gesperrte
//       externe Wissensabfrage über ihren Admin-Regler.
//   F4  Favorit und bestätigte Routine über HTTP speichern, finden, deaktivieren; fremde
//       Kontoangabe 403; Routine ohne Bestätigung 400.
//   F5  Aufträge sperren das Assistenzprofil nicht: Einrichtung bleibt offen und ohne 409.
//   F6  Unbekannter oder verborgener Arbeitsbereichskontext: 404 ohne Hinweis auf das Objekt.
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AdapterAntwort,
  Faehigkeitsvertrag,
} from "../../services/app/src/assistenz-faehigkeiten";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };
let aufrufe = 0;

const EXTERN: Faehigkeitsvertrag = {
  id: "server-testsuche",
  fassung: "1.0.0",
  name: "Server-Testsuche",
  beschreibung: "Synthetische Suche über den freigegebenen Wikimedia-Weg.",
  zwecke: ["server_recherche"],
  datenempfaenger: {
    art: "extern",
    anbieter: "wikimedia",
    anbieterName: "Wikipedia (Wikimedia)",
    host: "wikipedia.org",
  },
  wirkung: "lesen",
  modell: false,
  aktionen: ["netz_anfrage_anbieter"],
  eingaben: [{ name: "suchbegriff", maxLaenge: 200, pflicht: true }],
  ergebnis: { art: "trefferliste", felder: ["titel", "url", "auszug"], quellenPflicht: true },
  hoechsteSchutzstufe: "oeffentlich",
  grenzen: { maxTreffer: 5, zeitlimitMs: 2_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

const MODELL: Faehigkeitsvertrag = {
  ...EXTERN,
  id: "server-modellschritt",
  name: "Server-Modellschritt",
  zwecke: ["server_modell"],
  datenempfaenger: { art: "intern" },
  modell: true,
  aktionen: ["wissen_lesen"],
  ergebnis: { art: "trefferliste", felder: ["titel"], quellenPflicht: false },
};

const TREFFER: AdapterAntwort = {
  status: "ok",
  eintraege: [
    { titel: "Kreiselpumpe", url: "https://de.wikipedia.org/wiki/Kreiselpumpe", auszug: "x" },
  ],
};

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

interface Uebersicht {
  faehigkeiten: {
    id: string;
    verfuegbar: boolean;
    zugang: string | null;
    datenempfaenger: { art: string };
    voraussetzungen: { art: string; text: string }[];
  }[];
  vormerkungen: {
    vormerkung: { faehigkeitId: string; art: string; aktiv: boolean };
    gueltig: boolean;
  }[];
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@faehigkeit.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@faehigkeit.test");
  erik = await konto(adminToken, "experte", "erik@faehigkeit.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@faehigkeit.test", "Vera Viewer");
  aufrufe = 0;
  // Administrativer Schritt: Testverträge registrieren und Ersatzadapter installieren.
  const registry = services.faehigkeiten?.registry;
  expect(registry).toBeDefined();
  for (const v of [EXTERN, MODELL]) {
    registry?.registriere(v);
    registry?.installiereAdapter({
      faehigkeitId: v.id,
      fassung: v.fassung,
      transport: "ersatz",
      fuehreAus: async () => {
        aufrufe += 1;
        return TREFFER;
      },
    });
  }
});

describe("F1 · die Übersicht nennt Datenweg und konkrete Voraussetzungen", () => {
  it("Produktverträge sind registriert; Perplexity ist ehrlich nicht verfügbar", async () => {
    const r = await auf(erik.token, "GET", "/api/me/faehigkeiten");
    expect(r.statusCode, r.body).toBe(200);
    const u = r.json() as Uebersicht;
    const ids = u.faehigkeiten.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["wikipedia-suche", "perplexity-suche"]));
    const perplexity = u.faehigkeiten.find((f) => f.id === "perplexity-suche");
    expect(perplexity?.verfuegbar).toBe(false);
    expect(perplexity?.zugang).toBe("PERPLEXITY_API_KEY");
    expect(perplexity?.voraussetzungen.map((v) => v.art)).toEqual(
      expect.arrayContaining(["adapter", "credential", "budget", "anbieter"]),
    );
    // Im Testaufbau ist die externe Suche abgeschaltet (`EXTERNAL_SEARCH=off`): dann fehlt auch
    // der Wikipedia-Adapter — und genau das steht da, kein simulierter Erfolg.
    const wiki = u.faehigkeiten.find((f) => f.id === "wikipedia-suche");
    if (services.externalSearch === undefined) {
      expect(wiki?.voraussetzungen.map((v) => v.art)).toContain("adapter");
    }
    expect(u.faehigkeiten.find((f) => f.id === "server-testsuche")?.verfuegbar).toBe(true);
    expect(r.body).not.toMatch(/Bearer|secret123/);
  });

  it("ohne Anmeldung 401", async () => {
    expect((await auf("", "GET", "/api/me/faehigkeiten")).statusCode).toBe(401);
  });
});

describe("F2 · Vorschau, bestätigte Ausführung und eigene Aufträge", () => {
  it("läuft über den Server und bleibt dem eigenen Konto zugeordnet", async () => {
    const auftrag = {
      zweck: "server_recherche",
      gewaehlt: "server-testsuche",
      eingabe: { suchbegriff: "Kreiselpumpe" },
      arbeitsbereich: "projekt-pumpe",
    };
    const vorschau = await auf(erik.token, "POST", "/api/me/faehigkeiten/vorschau", auftrag);
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    expect((vorschau.json() as { vorbereitung: { art: string } }).vorbereitung.art).toBe(
      "gebunden",
    );
    expect(aufrufe).toBe(0);

    const ohneBestaetigung = await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      ...auftrag,
      auftragId: "f2-auftrag",
    });
    expect(ohneBestaetigung.statusCode).toBe(400);
    expect(aufrufe).toBe(0);

    const lauf = await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      ...auftrag,
      auftragId: "f2-auftrag",
      bestaetigt: true,
    });
    expect(lauf.statusCode, lauf.body).toBe(200);
    const ergebnis = (
      lauf.json() as { ergebnis: { stand: string; transport: string; ruecklink: unknown } }
    ).ergebnis;
    expect(ergebnis.stand).toBe("erfolgreich");
    expect(ergebnis.transport).toBe("ersatz");
    expect(ergebnis.ruecklink).toEqual({
      arbeitsbereich: "projekt-pumpe",
      auftragId: "f2-auftrag",
    });
    expect(aufrufe).toBe(1);

    // Dieselbe Kennung erneut: gespeichertes Ergebnis, keine zweite Wirkung.
    const wieder = await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      ...auftrag,
      auftragId: "f2-auftrag",
      bestaetigt: true,
    });
    expect((wieder.json() as { ergebnis: { wiederholt: boolean } }).ergebnis.wiederholt).toBe(true);
    expect(aufrufe).toBe(1);

    const liste = await auf(erik.token, "GET", "/api/me/faehigkeiten/auftraege");
    expect(liste.statusCode).toBe(200);
    expect(
      (liste.json() as { auftraege: { auftragId: string; zustand: string }[] }).auftraege,
    ).toEqual([expect.objectContaining({ auftragId: "f2-auftrag", zustand: "fertig" })]);
    expect(
      (await auf(erik.token, "GET", "/api/me/faehigkeiten/auftraege/f2-auftrag")).statusCode,
    ).toBe(200);
    expect(
      (await auf(vera.token, "GET", "/api/me/faehigkeiten/auftraege/f2-auftrag")).statusCode,
    ).toBe(404);
    expect(
      (await auf(vera.token, "GET", "/api/me/faehigkeiten/auftraege")).json() as {
        auftraege: unknown[];
      },
    ).toEqual({ auftraege: [] });
  });

  it("eine fremde Kontoangabe im Auftrag wird abgewiesen", async () => {
    const r = await auf(erik.token, "POST", "/api/me/faehigkeiten/vorschau", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
      nutzer: vera.id,
    });
    expect(r.statusCode).toBe(403);
  });
});

describe("F3 · die Lage kommt aus dem laufenden Server", () => {
  it("KI-Abschaltung im Reasoner sperrt den Modellschritt; die Suche bleibt", async () => {
    await services.reasoner.setTaskConfig({ global: "deterministic", perTask: {} });
    expect(services.reasoner.kiAbschaltung().abgeschaltet).toBe(true);
    const ki = await auf(erik.token, "POST", "/api/me/faehigkeiten/vorschau", {
      zweck: "server_modell",
      eingabe: { suchbegriff: "x" },
    });
    const v = (
      ki.json() as {
        vorbereitung: { art: string; stand: string; voraussetzungen: { art: string }[] };
      }
    ).vorbereitung;
    expect(v.stand).toBe("gesperrt");
    expect(v.voraussetzungen.map((x) => x.art)).toContain("keine_ki");
    const suche = await auf(erik.token, "POST", "/api/me/faehigkeiten/vorschau", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
    });
    expect((suche.json() as { vorbereitung: { art: string } }).vorbereitung.art).toBe("gebunden");
  });

  it("gesperrte externe Wissensabfrage sperrt die externe Fähigkeit vor jedem Aufruf", async () => {
    await services.externalKnowledge.setStage("blocked");
    const r = await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
      auftragId: "f3-gesperrt",
      bestaetigt: true,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      vorbereitung: { voraussetzungen: { art: string }[] };
      ergebnis: null;
    };
    expect(body.ergebnis).toBeNull();
    expect(body.vorbereitung.voraussetzungen.map((x) => x.art)).toContain("freigabe_extern");
    expect(aufrufe).toBe(0);
  });
});

describe("F4 · Favorit und bestätigte Routine über HTTP", () => {
  it("speichern, sofort finden, deaktivieren — nur für das eigene Konto", async () => {
    const fav = await auf(erik.token, "POST", "/api/me/faehigkeiten/vormerkungen", {
      faehigkeitId: "server-testsuche",
      art: "favorit",
    });
    expect(fav.statusCode, fav.body).toBe(200);
    const ohne = await auf(erik.token, "POST", "/api/me/faehigkeiten/vormerkungen", {
      faehigkeitId: "server-testsuche",
      art: "routine",
    });
    expect(ohne.statusCode).toBe(400);
    const routine = await auf(erik.token, "POST", "/api/me/faehigkeiten/vormerkungen", {
      faehigkeitId: "server-testsuche",
      art: "routine",
      zweck: "server_recherche",
      bestaetigt: true,
    });
    expect(routine.statusCode).toBe(200);
    const fremd = await auf(erik.token, "POST", "/api/me/faehigkeiten/vormerkungen", {
      faehigkeitId: "server-testsuche",
      art: "favorit",
      kontoId: vera.id,
    });
    expect(fremd.statusCode).toBe(403);
    const unbekannt = await auf(erik.token, "POST", "/api/me/faehigkeiten/vormerkungen", {
      faehigkeitId: "gibt-es-nicht",
      art: "favorit",
    });
    expect(unbekannt.statusCode).toBe(404);

    let u = (await auf(erik.token, "GET", "/api/me/faehigkeiten")).json() as Uebersicht;
    expect(u.vormerkungen.map((x) => [x.vormerkung.art, x.gueltig])).toEqual([
      ["favorit", true],
      ["routine", true],
    ]);
    expect(
      ((await auf(vera.token, "GET", "/api/me/faehigkeiten")).json() as Uebersicht).vormerkungen,
    ).toEqual([]);

    // Die bestätigte Routine läuft ohne Einzelrückfrage im erlaubten Kontext …
    const lauf = await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
      ausloeser: "routine",
      auftragId: "f4-routine-1",
      bestaetigt: true,
    });
    expect((lauf.json() as { ergebnis: { stand: string } }).ergebnis.stand).toBe("erfolgreich");

    // … und nach dem Deaktivieren nicht mehr.
    const aus = await auf(
      erik.token,
      "POST",
      "/api/me/faehigkeiten/vormerkungen/server-testsuche/deaktivieren",
      {},
    );
    expect(aus.statusCode).toBe(200);
    u = (await auf(erik.token, "GET", "/api/me/faehigkeiten")).json() as Uebersicht;
    expect(u.vormerkungen.every((x) => !x.vormerkung.aktiv && !x.gueltig)).toBe(true);
    const gesperrt = await auf(erik.token, "POST", "/api/me/faehigkeiten/vorschau", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
      ausloeser: "routine",
    });
    expect((gesperrt.json() as { vorbereitung: { stand: string } }).vorbereitung.stand).toBe(
      "gesperrt",
    );
    expect(aufrufe).toBe(1);
  });
});

describe("F5 · Aufträge sperren das Assistenzprofil nicht", () => {
  it("nach einem Auftrag ist die Einrichtung offen und ohne Konflikt speicherbar", async () => {
    await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
      auftragId: "f5-auftrag",
      bestaetigt: true,
    });
    const vorher = await auf(erik.token, "GET", "/api/me/assistenz");
    expect(vorher.json()).toEqual({ profil: null, einrichtungOffen: true });
    const speichern = await auf(erik.token, "PUT", "/api/me/assistenz", {
      name: "Mia",
      avatar: "eule",
      bewegung: "standard",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(speichern.statusCode, speichern.body).toBe(200);
    // Ein weiterer Auftrag ändert die bestätigte Profilfassung nicht.
    await auf(erik.token, "POST", "/api/me/faehigkeiten/auftraege", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "y" },
      auftragId: "f5-auftrag-2",
      bestaetigt: true,
    });
    const aendern = await auf(erik.token, "PUT", "/api/me/assistenz", {
      name: "Mia 2",
      fassung: 1,
    });
    expect(aendern.statusCode, aendern.body).toBe(200);
    const auftraege = (await auf(erik.token, "GET", "/api/me/faehigkeiten/auftraege")).json() as {
      auftraege: unknown[];
    };
    expect(auftraege.auftraege).toHaveLength(2);
  });
});

describe("F6 · Arbeitsbereichskontext nur mit Leserecht", () => {
  it("ein unbekanntes Kontextobjekt ergibt 404 ohne Hinweis", async () => {
    const r = await auf(erik.token, "POST", "/api/me/faehigkeiten/vorschau", {
      zweck: "server_recherche",
      eingabe: { suchbegriff: "x" },
      kontext: ["ko-gibt-es-nicht"],
    });
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toContain("ko-gibt-es-nicht");
    expect(aufrufe).toBe(0);
  });
});
