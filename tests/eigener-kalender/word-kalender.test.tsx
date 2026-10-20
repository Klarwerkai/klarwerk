// @vitest-environment jsdom
// ================================================================================================
// AW-16 · MEIN KALENDER IN WORD (`kalender.js`) — dieselbe berechtigte Sicht in der Office-Begleitung.
// ================================================================================================
//
// WAS HIER LÄUFT: die ausgelieferte Datei `apps/web/public/word-addin/kalender.js`, unverändert, über
// dem ECHTEN Markup des Blocks aus `apps/web/public/word-addin/taskpane.html`. Jeder Abruf des Blocks
// geht an die ECHTE App (`buildApp`, Speicherablage) — mit der Sitzung genau der Person, die das
// Fenster gerade trägt. Damit ist gemessen: derselbe Eintrag erscheint im Fenster mit derselben
// Kennung (`event_id`) wie auf der Seite `/kalender`, und das Fenster zeigt nur, was die heutigen
// Rechte dieser Person am Server hergeben.
//
// WAS HIER NICHT LÄUFT, und das gehört zur Aussage: kein echtes Word. Die Globalen des Fensters
// (`signedIn`, `officeUsable`, `bestandRuheSichtbar`, …) sind gesetzt, wie das Fensterskript sie
// setzt. Den Beleg im echten Word-Host ersetzt dieser Test nicht. Alle Daten sind erfunden.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { TeamFassung } from "../../services/app/src/teams";
import { repoPfad } from "../support/repoPfad";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const g = globalThis as unknown as Record<string, unknown>;
const echtesFetch = g.fetch;
const KENNWORT = "geheim12345";
const TEAM_ID = "team-word-kalender";

/** Das Markup des Blocks, wie es in der ausgelieferten Seite steht — nicht nachgebaut. */
function blockMarkup(): string {
  const seite = readFileSync(repoPfad("apps/web/public/word-addin/taskpane.html"), "utf8");
  const treffer = seite.match(/<details id="kalender-block"[\s\S]*?<\/details>/);
  if (!treffer) {
    throw new Error("taskpane.html trägt den Block #kalender-block nicht");
  }
  return treffer[0];
}

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@word-kalender.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@word-kalender.test");
  for (const [name, email] of [
    ["Erik Experte", "erik@word-kalender.test"],
    ["Lea Leitung", "lea@word-kalender.test"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role: "experte" },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  const erik = await anmelden(app, "erik@word-kalender.test");
  const lea = await anmelden(app, "lea@word-kalender.test");
  const idVon = async (kopf: Kopf): Promise<string> =>
    (await app.inject({ method: "GET", url: "/api/auth/me", headers: kopf })).json().id as string;
  const ids = { erik: await idVon(erik), lea: await idVon(lea) };
  const team: TeamFassung = {
    id: TEAM_ID,
    version: 1,
    name: "Word-Prüfteam",
    zweck: "Fiktives Team für den Kalender in Word.",
    verantwortlich: ids.erik,
    mitglieder: [ids.erik, ids.lea],
    archiviert: false,
    vorgang: "angelegt",
    angelegtVon: "fiktiv",
    angelegtAm: "2026-10-01T08:00:00.000Z",
    geaendertVon: "fiktiv",
    geaendertAm: "2026-10-01T08:00:00.000Z",
  };
  await services.teams.lege(team);
  return { services, app, erik, lea, ids, team };
}

async function lege(app: App, kopf: Kopf, daten: Record<string, unknown>): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/me/kalender/eintraege",
    headers: kopf,
    payload: { zeitzone: "Europe/Berlin", ...daten },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().eintrag.id as string;
}

async function ruhe(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Das Fenster mit dem Block, angemeldet als die Person hinter `kopf`. */
function fensterStarten(app: App, sitzung: { kopf: Kopf; kennung: string }): string[] {
  const abrufe: string[] = [];
  document.body.innerHTML = blockMarkup();
  g.lang = "de";
  g.signedIn = true;
  g.bestandSitzung = sitzung.kennung;
  g.officeUsable = () => true;
  g.bestandRuheSichtbar = () => true;
  g.bestandZeichnen = () => {};
  g.setLang = (next: string) => {
    g.lang = next;
  };
  g.fetch = async (url: string) => {
    abrufe.push(url);
    const res = await app.inject({ method: "GET", url, headers: sitzung.kopf });
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      json: async () => res.json(),
    };
  };
  const quelle = readFileSync(repoPfad("apps/web/public/word-addin/kalender.js"), "utf8");
  new Function(quelle)();
  if (document.readyState === "loading") {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }
  return abrufe;
}

async function aufklappen(): Promise<void> {
  const block = document.getElementById("kalender-block") as HTMLDetailsElement;
  block.open = true;
  block.dispatchEvent(new Event("toggle"));
  await ruhe();
}

/** Zuklappen, wie ein Klick auf die Überschrift es tut. */
async function zuklappen(): Promise<void> {
  const block = document.getElementById("kalender-block") as HTMLDetailsElement;
  block.open = false;
  block.dispatchEvent(new Event("toggle"));
  await ruhe();
}

/** Aufklappen OHNE auf die Antwort zu warten — für den Blick auf den Zwischenstand. */
function aufklappenOhneWarten(): void {
  const block = document.getElementById("kalender-block") as HTMLDetailsElement;
  block.open = true;
  block.dispatchEvent(new Event("toggle"));
}

function inhaltText(): string {
  return document.getElementById("kalender-inhalt")?.textContent ?? "";
}

function kennungen(): string[] {
  return [...document.querySelectorAll<HTMLElement>("#kalender-inhalt [data-event-id]")]
    .filter((el) => el.classList.contains("kalender-eintrag"))
    .map((el) => el.dataset.eventId ?? "");
}

afterEach(() => {
  g.fetch = echtesFetch;
  for (const name of [
    "lang",
    "signedIn",
    "bestandSitzung",
    "officeUsable",
    "bestandRuheSichtbar",
    "bestandZeichnen",
    "setLang",
  ]) {
    Reflect.deleteProperty(g, name);
  }
  document.body.innerHTML = "";
});

describe("AW-16 · Office-Begleitung: dieselbe berechtigte Kalendersicht im Word-Fenster", () => {
  it("derselbe Eintrag mit derselben Kennung; abgerufen erst beim Aufklappen", async () => {
    const { app, erik } = await buehne();
    const jetzt = new Date().toISOString();
    const termin = await lege(app, erik, {
      art: "termin",
      titel: "Abstimmung im Word-Fenster (fiktiv)",
      ganztaegig: false,
      beginn: jetzt,
    });
    const abrufe = fensterStarten(app, { kopf: erik, kennung: "id:erik" });
    const block = document.getElementById("kalender-block") as HTMLElement;
    expect(block.className).toBe("");
    expect(document.getElementById("kalender-kopf")?.textContent).toBe("Mein Kalender");
    // Zugeklappt fragt das Fenster nichts ab.
    expect(abrufe).toEqual([]);

    await aufklappen();
    expect(abrufe).toEqual(["/api/me/kalender?bereich=persoenlich"]);
    // Dieselbe Kennung wie auf der Seite in Klarwerk (`GET /api/me/kalender/eintraege/:id`).
    expect(kennungen()).toEqual([termin]);
    const seite = await app.inject({
      method: "GET",
      url: `/api/me/kalender/eintraege/${termin}`,
      headers: erik,
    });
    expect(seite.json().eintrag.id).toBe(termin);

    // Einzelansicht: Eintrag, Auftrag und Ergebnis getrennt; ohne Auftrag löst nichts aus.
    (document.querySelector(`[data-event-id="${termin}"]`) as HTMLButtonElement).click();
    const detail = document.querySelector(".kalender-detail") as HTMLElement;
    expect(detail.dataset.eventId).toBe(termin);
    expect(detail.querySelector(".kalender-detail-id")?.textContent).toContain(termin);
    expect(detail.querySelector(".kalender-detail-auftrag")?.textContent).toContain("Kein Auftrag");
    expect(detail.querySelector(".kalender-detail-lauf")?.textContent).toContain("Kein Lauf");
    expect(detail.querySelector("a")?.getAttribute("href")).toBe("/kalender");
  });

  it("heutige Rechte: persönlich bleibt privat, Team nur für heutige Mitglieder", async () => {
    const { services, app, erik, lea, ids, team } = await buehne();
    const jetzt = new Date().toISOString();
    const privat = await lege(app, erik, {
      art: "termin",
      titel: "Eriks privater Termin (fiktiv)",
      ganztaegig: false,
      beginn: jetzt,
    });
    const teamTermin = await lege(app, erik, {
      art: "termin",
      titel: "Teamrunde (fiktiv)",
      ganztaegig: false,
      beginn: jetzt,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: ids.erik,
    });

    // Lea im Fenster: Eriks persönlicher Eintrag erscheint nicht — weder persönlich noch im Team.
    fensterStarten(app, { kopf: lea, kennung: "id:lea" });
    await aufklappen();
    expect(kennungen()).toEqual([]);
    (document.querySelector('[data-bereich="team"]') as HTMLButtonElement).click();
    await ruhe();
    expect(kennungen()).toEqual([teamTermin]);
    expect(kennungen()).not.toContain(privat);

    // Lea verlässt das Team: beim nächsten Abruf ist der Teameintrag fort.
    await services.teams.lege({
      ...team,
      version: 2,
      vorgang: "geaendert",
      mitglieder: [ids.erik],
    });
    (document.querySelector('[data-bereich="persoenlich"]') as HTMLButtonElement).click();
    await ruhe();
    (document.querySelector('[data-bereich="team"]') as HTMLButtonElement).click();
    await ruhe();
    expect(kennungen()).toEqual([]);
  });

  it("K7 · erneutes Aufklappen fragt mit heutigen Rechten neu — nach Quellrechteentzug und Teamaustritt erscheint nichts Altes", async () => {
    const { services, app, erik, lea, ids, team } = await buehne();
    const jetzt = new Date().toISOString();
    const ko = await services.ko.create({
      title: "Prüfanweisung Word-Kalender (fiktiv)",
      statement: "Fiktive Prüfanweisung für den Kalender in Word.",
      type: "best_practice",
      category: "Instandhaltung",
      author: "fiktiver-autor",
      // Ausdrücklich „intern": seit Entscheidung 16 (main) zählt eine fehlende Stufe wie
      // vertraulich — der Fall braucht eine Quelle, die Lea ZUERST sehen darf.
      confidentiality: "intern",
    });
    const abgeleitet = await lege(app, lea, {
      art: "termin",
      titel: "Prüffrist aus der Anweisung (fiktiv)",
      ganztaegig: false,
      beginn: jetzt,
      herkunft: { art: "wissensobjekt", koId: ko.id },
    });
    const teamTermin = await lege(app, erik, {
      art: "termin",
      titel: "Teamrunde vertraulich (fiktiv)",
      ganztaegig: false,
      beginn: jetzt,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: ids.erik,
    });
    const abrufe = fensterStarten(app, { kopf: lea, kennung: "id:lea" });

    // QUELLRECHTEENTZUG zwischen Zuklappen und Wiederöffnen.
    await aufklappen();
    expect(kennungen()).toEqual([abgeleitet]);
    expect(inhaltText()).toContain("Prüffrist aus der Anweisung");
    await zuklappen();
    expect(inhaltText()).toBe("");
    await services.ko.setConfidentiality(ko.id, "vertraulich", "fiktiver-autor");
    aufklappenOhneWarten();
    // Bis zur neuen Antwort wird der alte Stand NICHT wieder ausgegeben.
    expect(inhaltText()).not.toContain("Prüffrist aus der Anweisung");
    expect(kennungen()).toEqual([]);
    expect(document.querySelector(".kalender-stand")?.textContent).toBe("Wird geladen …");
    await ruhe();
    // Die neue Antwort kennt den Eintrag noch, sein Text ist geschützt.
    expect(kennungen()).toEqual([abgeleitet]);
    expect(inhaltText()).toContain("Geschützter Eintrag");
    expect(inhaltText()).not.toContain("Prüffrist aus der Anweisung");

    // TEAMAUSTRITT zwischen Zuklappen und Wiederöffnen — ohne Bereichswechsel als Hilfsgriff.
    (document.querySelector('[data-bereich="team"]') as HTMLButtonElement).click();
    await ruhe();
    expect(kennungen()).toEqual([teamTermin]);
    await zuklappen();
    await services.teams.lege({
      ...team,
      version: 2,
      vorgang: "geaendert",
      mitglieder: [ids.erik],
    });
    const vorher = abrufe.length;
    aufklappenOhneWarten();
    expect(kennungen()).toEqual([]);
    expect(inhaltText()).not.toContain("Teamrunde vertraulich");
    await ruhe();
    expect(abrufe.length).toBe(vorher + 1);
    expect(abrufe[abrufe.length - 1]).toBe("/api/me/kalender?bereich=team");
    expect(kennungen()).toEqual([]);
    expect(inhaltText()).not.toContain("Teamrunde vertraulich");
  });

  it("abgelaufene Anmeldung: kein alter Stand, ein klarer Satz und die Sitzungsprüfung", async () => {
    const { app } = await buehne();
    let geprueft = 0;
    fensterStarten(app, { kopf: { authorization: "Bearer abgelaufen" }, kennung: "id:x" });
    g.checkSession = () => {
      geprueft += 1;
    };
    await aufklappen();
    expect(document.querySelector(".kalender-stand")?.textContent).toBe("Bitte erneut anmelden.");
    expect(kennungen()).toEqual([]);
    expect(geprueft).toBe(1);
    Reflect.deleteProperty(g, "checkSession");
  });

  it("ausserhalb der Ruhe oder abgemeldet bleibt der Block verborgen", async () => {
    const { app, erik } = await buehne();
    fensterStarten(app, { kopf: erik, kennung: "id:erik" });
    const block = document.getElementById("kalender-block") as HTMLElement;
    expect(block.className).toBe("");
    g.signedIn = false;
    // Der Block zeichnet sich neu, wenn das Fenster seinen Bestandsblock neu zeichnet.
    (g.bestandZeichnen as () => void)();
    expect(block.className).toBe("hidden");
  });
});
