// ================================================================================================
// KLARA 07 (produkt:20261008:klara-aufgaben) · PERSÖNLICHE AUFGABEN AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`,
// `app.inject`). Jeder Schritt geht über HTTP — auch der Aktionsweg (Auftrag mit Grenze und Plan im
// eigenen Gespräch, Ausführung am Server). „Erneute Anmeldung" ist eine neue Sitzung über
// `POST /api/auth/login`; dass eine Aufgabe einen Neustart der Datenbankablage übersteht, misst
// `aufgabe-pg.integration.test.ts`.
//
//   A1 (K1) Aus einer eigenen Notiz und aus einem gesprochenen Auftrag entsteht je ein echter
//           Datensatz mit Bezug (Notiz bzw. Auftrag mit Wortlaut) und Ort.
//   A2 (K2) Bearbeiten, Priorisieren, Erledigen und Wiederöffnen bleiben nach erneuter Anmeldung;
//           eine veraltete Fassung überschreibt nicht still.
//   A3 (K3) Andere Personen (auch Administratoren) lesen und ändern nichts; gemeinsame Aufgaben
//           (Lücke) bleiben unverändert und werden nicht persönlich; das Protokoll trägt keinen Inhalt.
//   A4 (K4) Scheiternde Ablage, verlorene Antwort und doppelte Wiederholung: keine Doppelaufgabe,
//           keine zweite Fassung, und Klaras Schritt meldet den tatsächlichen Status.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  InMemoryKlaraAufgabeRepo,
  KLARA_AUFGABE_LISTE_MAX,
  KLARA_AUFGABE_MAX_JE_KONTO,
  type KlaraAufgabe,
  KlaraAufgabeDienst,
} from "../../services/app/src/klara-aufgabe";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { InMemoryKlaraNotizRepo } from "../../services/app/src/klara-notiz";
import {
  KLARA_AUFGABE_ANGELEGT,
  KLARA_AUFGABE_GEAENDERT,
} from "../../services/app/src/routes/klara-aufgabe-routes";

type App = ReturnType<typeof buildApp>;
type Sicht = Omit<KlaraAufgabe, "kontoId"> & { zustaendig: string };

const BASIS = "/api/me/klara/aufgaben";
const KLARA = "/api/me/klara";
const KENNWORT = "secret123";
/** Unverwechselbare Messmarken — ein Treffer kann aus nichts anderem stammen. */
const NOTIZWORT = "Zirbelkiefer";
const AUFTRAGSWORT = "Lindenblüte";

const BEZUG_ARTIKEL = {
  pfad: "/wissen/ko-presse-4",
  seitenName: "Lesen",
  objekt: "Ölwechsel Presse 4",
  koId: "ko-presse-4",
  fassung: 3,
  absatz: 2,
};
const BEZUG_GESPRAECH = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };

/**
 * Die echte In-Memory-Ablage, die auf Kommando scheitert: `vorher` wirft einmal, BEVOR geschrieben
 * wird; `nachher` wirft einmal, NACHDEM geschrieben wurde (die Antwort geht verloren — der Fall für
 * Doppelaufgaben); `immer` wirft bei jedem Schreiben (Datenbank weg).
 */
class StoerbaresRepo extends InMemoryKlaraAufgabeRepo {
  stoerung: "keine" | "vorher" | "nachher" | "immer" = "keine";
  aenderungsStoerung: "keine" | "nachher" = "keine";

  override async lege(a: KlaraAufgabe): Promise<boolean> {
    const s = this.stoerung;
    if (s !== "immer") {
      this.stoerung = "keine";
    }
    if (s === "vorher" || s === "immer") {
      throw new Error("Datenbank nicht erreichbar");
    }
    const ok = await super.lege(a);
    if (s === "nachher") {
      throw new Error("Verbindung nach dem Schreiben abgerissen");
    }
    return ok;
  }

  override async ersetze(a: KlaraAufgabe): Promise<boolean> {
    const s = this.aenderungsStoerung;
    this.aenderungsStoerung = "keine";
    const ok = await super.ersetze(a);
    if (s === "nachher") {
      throw new Error("Verbindung nach dem Schreiben abgerissen");
    }
    return ok;
  }
}

let repos: ReturnType<typeof inMemoryRepos>;
let services: AppServices;
let aufgabenRepo: StoerbaresRepo;
let app: App;
let ada = { id: "", token: "", email: "" };
let erik = { id: "", token: "", email: "" };
let vera = { id: "", token: "", email: "" };

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
  const login = await auf("", "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await auf(adminToken, "POST", "/api/users", {
    name,
    email,
    password: KENNWORT,
    role: rolle,
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email), email };
}

let vorgaenge = 0;
function vorgang(): string {
  vorgaenge += 1;
  return `test-vorgang-${String(vorgaenge).padStart(4, "0")}`;
}

async function notiz(wer: string, inhalt: string, titel?: string): Promise<{ id: string }> {
  const r = await auf(wer, "POST", `${KLARA}/notizen`, {
    vorgang: vorgang(),
    weg: "geschrieben",
    inhalt,
    ...(titel ? { titel } : {}),
    objektbezug: BEZUG_ARTIKEL,
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { notiz: { id: string } }).notiz;
}

async function ausNotiz(wer: string, notizId: string, v = vorgang()) {
  return auf(wer, "POST", BASIS, { vorgang: v, weg: "notiz", quelle: { notizId } });
}

async function oeffne(wer: string, id: string): Promise<Sicht> {
  const r = await auf(wer, "GET", `${BASIS}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { aufgabe: Sicht }).aufgabe;
}

async function liste(wer: string): Promise<Sicht[]> {
  const r = await auf(wer, "GET", BASIS);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { aufgaben: Sicht[] }).aufgaben;
}

async function aendere(wer: string, id: string, rumpf: Record<string, unknown>) {
  return auf(wer, "PUT", `${BASIS}/${id}`, rumpf);
}

async function gespraech(wer: string): Promise<string> {
  const r = await auf(wer, "POST", `${KLARA}/gespraeche`, { objektbezug: BEZUG_GESPRAECH });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

/** Ein Auftrag „persönliche Aufgabe anlegen“ — genau so, wie Klaras Oberfläche ihn anlegt. */
async function aufgabenAuftrag(
  wer: string,
  gid: string,
  titel: string,
  quelle: "gesprochen" | "getippt" = "gesprochen",
  inhalt?: string,
): Promise<KlaraAuftrag> {
  const ziel = { art: "neue_persoenliche_aufgabe", id: null, titel, stand: null, pfad: null };
  const r = await auf(wer, "POST", `${KLARA}/gespraeche/${gid}/auftraege`, {
    quelle,
    wortlaut: `Lege mir die Aufgabe „${titel}“ an`,
    ziel: `Persönliche Aufgabe „${titel}“ anlegen`,
    erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: [`Deine Eingabe (${quelle})`],
    ergebnis: "Aufgabe gespeichert und am Server nachgelesen",
    geplanteSchritte: 1,
    plan: [
      {
        aktion: "persoenliche_aufgabe_anlegen",
        ziel,
        ausSchritt: null,
        ...(inhalt ? { inhalt } : {}),
      },
    ],
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { auftrag: KlaraAuftrag }).auftrag;
}

type SchrittAntwort = {
  auftrag: KlaraAuftrag & { ergebnisstand?: string };
  schritt: KlaraAuftrag["schritte"][number] & { vertrag?: string };
  wiederholt: boolean;
};

async function fuehreAus(wer: string, gid: string, aid: string, schluessel: string) {
  const r = await auf(
    wer,
    "POST",
    `${KLARA}/gespraeche/${gid}/auftraege/${aid}/schritte/${schluessel}/ausfuehrung`,
    { nr: 1, auftragFassung: 1 },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as SchrittAntwort;
}

beforeEach(async () => {
  repos = inMemoryRepos();
  aufgabenRepo = new StoerbaresRepo();
  services = assembleServices(repos, { klaraAufgaben: aufgabenRepo });
  app = buildApp(services);
  await auf("", "POST", "/api/auth/register", {
    name: "Ada Admin",
    email: "ada@klara-aufgaben-k7.test",
    password: KENNWORT,
  });
  const adminToken = await anmelden("ada@klara-aufgaben-k7.test");
  const ich = await auf(adminToken, "GET", "/api/auth/me");
  ada = { id: (ich.json() as { id: string }).id, token: adminToken, email: "" };
  erik = await konto(adminToken, "experte", "erik@klara-aufgaben-k7.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@klara-aufgaben-k7.test", "Vera Viewer");
});

// ================================================================================================
describe("A1 · K1 — aus Notiz und aus gesprochenem Auftrag je ein echter Datensatz mit Bezug", () => {
  it("aus einer eigenen Notiz: Titel, Text und Ort aus der Notiz, Bezug nennt die Notiz", async () => {
    const n = await notiz(erik.token, `Filter für Presse 4 bestellen. ${NOTIZWORT}`, "Filter P4");
    const r = await ausNotiz(erik.token, n.id);
    expect(r.statusCode, r.body).toBe(201);
    const a = (r.json() as { aufgabe: Sicht; wiederholt: boolean }).aufgabe;
    expect(a).toMatchObject({
      bereich: "persoenlich",
      zustaendig: "selbst",
      weg: "notiz",
      titel: "Filter P4",
      inhalt: `Filter für Presse 4 bestellen. ${NOTIZWORT}`,
      prioritaet: "mittel",
      status: "offen",
      erledigtAm: null,
      fassung: 1,
      bezug: { art: "notiz", notizId: n.id, notizTitel: "Filter P4" },
    });
    // Der Ort ist der Rücklink der Notiz — nicht vom Browser behauptet.
    expect(a.objektbezug).toMatchObject(BEZUG_ARTIKEL);
    expect(JSON.stringify(a)).not.toContain(erik.id);
    // Ein echter Datensatz: in der Ablage, in der Liste, einzeln zu öffnen.
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
    expect((await liste(erik.token)).map((x) => x.id)).toEqual([a.id]);
    expect(await oeffne(erik.token, a.id)).toEqual(a);
  });

  it("eine fremde oder unbekannte Notiz ist kein Bezug: 404, nichts angelegt", async () => {
    const fremd = await notiz(vera.token, "Veras Gedanke");
    for (const notizId of [fremd.id, "gibt-es-nicht"]) {
      const r = await ausNotiz(erik.token, notizId);
      expect(r.statusCode, r.body).toBe(404);
      expect((r.json() as { grund: string }).grund).toBe("quelle_unbekannt");
    }
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(0);
  });

  it("aus einem gesprochenen Auftrag über den gemeinsamen Aktionsweg: gespeichert, nachgelesen, mit Bezug", async () => {
    const gid = await gespraech(erik.token);
    const titel = `Hydraulikschlauch ${AUFTRAGSWORT} prüfen`;
    const auftrag = await aufgabenAuftrag(erik.token, gid, titel, "gesprochen", "Bis Freitag");
    const r = await fuehreAus(erik.token, gid, auftrag.id, "schritt-aufgabe-1");
    expect(r.wiederholt).toBe(false);
    expect(r.schritt).toMatchObject({
      aktion: "persoenliche_aufgabe_anlegen",
      stand: "gespeichert",
      ruecknehmbar: false,
    });
    expect(r.auftrag.stand).toBe("abgeschlossen");
    const e = r.schritt.ergebnis;
    expect(e?.art).toBe("persoenliche_aufgabe");
    // Der Status, den Klara zeigt, ist der am Server nachgelesene.
    expect(e?.stand).toBe("status:offen prioritaet:mittel");
    expect(e?.pfad).toBe(`/aufgaben?persoenlich=${e?.id}`);

    const a = await oeffne(erik.token, e?.id ?? "");
    expect(a).toMatchObject({
      weg: "auftrag",
      titel,
      inhalt: "Bis Freitag",
      status: "offen",
      bezug: {
        art: "auftrag",
        gespraechId: gid,
        auftragId: auftrag.id,
        wortlaut: `Lege mir die Aufgabe „${titel}“ an`,
        quelle: "gesprochen",
      },
    });
    expect(a.objektbezug).toMatchObject(BEZUG_GESPRAECH);
    // Die Aktionskennung ist der Vorgangsschlüssel: der Datensatz führt zurück auf genau den Schritt.
    expect(a.vorgang).toBe(`klara-auftrag-${auftrag.id}-1`);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
  });

  it("ohne passenden Auftrag im EIGENEN Gespräch entsteht über den Auftragsweg nichts", async () => {
    const gid = await gespraech(erik.token);
    const auftrag = await aufgabenAuftrag(erik.token, gid, "Geplanter Titel");
    const versuche = [
      // ein anderer Titel als im Plan
      { gespraechId: gid, auftragId: auftrag.id, titel: "Anderer Titel" },
      // ein erfundener Auftrag
      { gespraechId: gid, auftragId: "erfunden", titel: "Geplanter Titel" },
    ];
    for (const v of versuche) {
      const r = await auf(erik.token, "POST", BASIS, {
        vorgang: vorgang(),
        weg: "auftrag",
        quelle: { gespraechId: v.gespraechId, auftragId: v.auftragId },
        titel: v.titel,
      });
      expect(r.statusCode, r.body).toBe(404);
    }
    // Veras Versuch an Eriks Gespräch und Auftrag.
    const fremd = await auf(vera.token, "POST", BASIS, {
      vorgang: vorgang(),
      weg: "auftrag",
      quelle: { gespraechId: gid, auftragId: auftrag.id },
      titel: "Geplanter Titel",
    });
    expect(fremd.statusCode, fremd.body).toBe(404);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(0);
    expect(await aufgabenRepo.anzahl(vera.id)).toBe(0);
  });
});

// ================================================================================================
describe("A2 · K2 — Bearbeiten, Priorisieren, Erledigen bleiben nach erneuter Anmeldung", () => {
  it("jede Änderung trägt die Fassung; nach neuer Sitzung steht genau der gespeicherte Stand da", async () => {
    const n = await notiz(erik.token, "Dichtung tauschen");
    const a = (
      (await ausNotiz(erik.token, n.id)).json() as {
        aufgabe: Sicht;
      }
    ).aufgabe;

    const bearbeitet = await aendere(erik.token, a.id, {
      fassung: 1,
      titel: "Dichtung Presse 4 tauschen",
      inhalt: "Erst nach dem Abkühlen.",
    });
    expect(bearbeitet.statusCode, bearbeitet.body).toBe(200);
    const priorisiert = await aendere(erik.token, a.id, { fassung: 2, prioritaet: "hoch" });
    expect((priorisiert.json() as { aufgabe: Sicht }).aufgabe).toMatchObject({
      prioritaet: "hoch",
      fassung: 3,
    });
    const erledigt = await aendere(erik.token, a.id, { fassung: 3, status: "erledigt" });
    const nachErledigt = (erledigt.json() as { aufgabe: Sicht }).aufgabe;
    expect(nachErledigt.status).toBe("erledigt");
    expect(nachErledigt.erledigtAm).not.toBeNull();

    // Erneute Anmeldung: eine NEUE Sitzung, derselbe Stand — Feld für Feld.
    const neu = await anmelden(erik.email);
    expect(neu).not.toBe(erik.token);
    const wieder = await oeffne(neu, a.id);
    expect(wieder).toEqual(nachErledigt);
    expect(wieder).toMatchObject({
      titel: "Dichtung Presse 4 tauschen",
      inhalt: "Erst nach dem Abkühlen.",
      prioritaet: "hoch",
      status: "erledigt",
      fassung: 4,
      // Bezug und Ort ändern sich beim Bearbeiten nie.
      bezug: { art: "notiz", notizId: n.id },
    });

    // Wieder öffnen: der Erledigt-Zeitpunkt fällt weg, der Status steht wieder auf offen.
    const offen = await aendere(neu, a.id, { fassung: 4, status: "offen" });
    expect((offen.json() as { aufgabe: Sicht }).aufgabe).toMatchObject({
      status: "offen",
      erledigtAm: null,
      fassung: 5,
    });
    // Eine veraltete Fassung (zweiter Tab) überschreibt nicht still.
    const veraltet = await aendere(erik.token, a.id, { fassung: 3, titel: "Aus Tab B" });
    expect(veraltet.statusCode, veraltet.body).toBe(409);
    expect((veraltet.json() as { grund: string }).grund).toBe("konflikt");
    expect((await oeffne(neu, a.id)).titel).toBe("Dichtung Presse 4 tauschen");
  });

  it("die Liste ordnet offen vor erledigt, dann nach Priorität", async () => {
    const titel = ["Niedrig offen", "Hoch offen", "Hoch erledigt"];
    const ids: string[] = [];
    for (const t of titel) {
      const n = await notiz(erik.token, t, t);
      ids.push(((await ausNotiz(erik.token, n.id)).json() as { aufgabe: Sicht }).aufgabe.id);
    }
    await aendere(erik.token, ids[0] as string, { fassung: 1, prioritaet: "niedrig" });
    await aendere(erik.token, ids[1] as string, { fassung: 1, prioritaet: "hoch" });
    await aendere(erik.token, ids[2] as string, { fassung: 1, prioritaet: "hoch" });
    await aendere(erik.token, ids[2] as string, { fassung: 2, status: "erledigt" });
    expect((await liste(erik.token)).map((a) => a.titel)).toEqual([
      "Hoch offen",
      "Niedrig offen",
      "Hoch erledigt",
    ]);
    const nurErledigt = await auf(erik.token, "GET", `${BASIS}?status=erledigt`);
    expect((nurErledigt.json() as { aufgaben: Sicht[] }).aufgaben.map((a) => a.titel)).toEqual([
      "Hoch erledigt",
    ]);
  });
});

// ================================================================================================
describe("A3 · K3 — persönlich bleibt persönlich, gemeinsam bleibt gemeinsam", () => {
  it("andere Personen und Administratoren lesen, ändern und löschen keine fremde Aufgabe", async () => {
    const n = await notiz(erik.token, `Nur für Erik ${NOTIZWORT}`);
    const a = ((await ausNotiz(erik.token, n.id)).json() as { aufgabe: Sicht }).aufgabe;
    for (const fremd of [vera.token, ada.token]) {
      expect((await auf(fremd, "GET", `${BASIS}/${a.id}`)).statusCode).toBe(404);
      expect((await aendere(fremd, a.id, { fassung: 1, status: "erledigt" })).statusCode).toBe(404);
      expect((await auf(fremd, "DELETE", `${BASIS}/${a.id}`)).statusCode).toBe(404);
      const r = await auf(fremd, "GET", BASIS);
      expect(r.body).not.toContain(NOTIZWORT);
      expect((r.json() as { aufgaben: unknown[] }).aufgaben).toEqual([]);
    }
    // Unverändert bei Erik.
    expect(await oeffne(erik.token, a.id)).toMatchObject({ status: "offen", fassung: 1 });
    // Ohne Anmeldung gar nichts.
    expect((await auf("", "GET", BASIS)).statusCode).toBe(401);
  });

  it("eine gemeinsame Aufgabe (Lücke) bleibt, wo und wie sie ist — nichts wird umetikettiert", async () => {
    await repos.gaps.insert({
      id: "gap-k7",
      question: `Wie oft wird ${AUFTRAGSWORT} geprüft?`,
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: new Date().toISOString(),
    });
    const luecke = async () => {
      const r = await auf(ada.token, "GET", "/api/gaps");
      expect(r.statusCode, r.body).toBe(200);
      const g = (r.json() as Record<string, unknown>[]).find((x) => x.id === "gap-k7");
      return {
        anzahl: (r.json() as unknown[]).length,
        status: g?.status,
        priority: g?.priority,
        assignee: g?.assignee,
        question: g?.question,
      };
    };
    const vorher = await luecke();
    expect(vorher).toMatchObject({ status: "offen", priority: "mittel", assignee: null });

    // Eine persönliche Aufgabe mit DEMSELBEN Wortlaut wie die Lücke, über den Aktionsweg.
    const gid = await gespraech(erik.token);
    const auftrag = await aufgabenAuftrag(
      erik.token,
      gid,
      `Wie oft wird ${AUFTRAGSWORT} geprüft?`,
      "getippt",
    );
    const r = await fuehreAus(erik.token, gid, auftrag.id, "schritt-gemeinsam-1");
    expect(r.schritt.stand).toBe("gespeichert");
    expect(r.schritt.ergebnis?.art).toBe("persoenliche_aufgabe");
    expect(r.schritt.ergebnis?.id).not.toBe("gap-k7");

    // Die Lücke ist unverändert — derselbe Stand für alle, die sie sehen dürfen.
    expect(await luecke()).toEqual(vorher);
    // Die persönliche Aufgabe steht in keiner gemeinsamen Quelle.
    for (const url of ["/api/gaps", "/api/conflicts", "/api/validation/board"]) {
      const quelle = await auf(ada.token, "GET", url);
      expect(quelle.body, url).not.toContain(r.schritt.ergebnis?.id ?? "?");
    }
    // Ein anderer Geltungsbereich wird nicht angenommen.
    const n = await notiz(erik.token, "Für alle?");
    const gemeinsam = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      weg: "notiz",
      bereich: "gemeinsam",
      quelle: { notizId: n.id },
    });
    expect(gemeinsam.statusCode, gemeinsam.body).toBe(400);
    // Eine Unternehmensaufgabe kann kein Ziel einer persönlichen Anlage sein.
    const umetikettiert = await auf(erik.token, "POST", `${KLARA}/gespraeche/${gid}/auftraege`, {
      quelle: "getippt",
      wortlaut: "Mach die Lücke zu meiner Aufgabe",
      ziel: "Umetikettieren",
      erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
      erlaubteZiele: [
        { art: "aufgabe", id: "gap-k7", titel: "Lücke", stand: null, pfad: "/risiko?fall=gap-k7" },
      ],
      erlaubteQuellen: ["Deine Eingabe (getippt)"],
      ergebnis: "—",
      geplanteSchritte: 1,
      plan: [
        {
          aktion: "persoenliche_aufgabe_anlegen",
          ziel: {
            art: "aufgabe",
            id: "gap-k7",
            titel: "Lücke",
            stand: null,
            pfad: "/risiko?fall=gap-k7",
          },
          ausSchritt: null,
        },
      ],
    });
    expect(umetikettiert.statusCode, umetikettiert.body).toBe(400);
  });

  it("das Prüfprotokoll trägt Ereignisse ohne Titel, Text oder Wortlaut", async () => {
    const n = await notiz(erik.token, `Geheimer Inhalt ${NOTIZWORT}`, `Titel ${NOTIZWORT}`);
    const a = ((await ausNotiz(erik.token, n.id)).json() as { aufgabe: Sicht }).aufgabe;
    await aendere(erik.token, a.id, { fassung: 1, status: "erledigt" });
    const angelegt = await services.audit.list({ action: KLARA_AUFGABE_ANGELEGT });
    const geaendert = await services.audit.list({ action: KLARA_AUFGABE_GEAENDERT });
    expect(angelegt).toHaveLength(1);
    expect(geaendert).toHaveLength(1);
    expect(geaendert[0]?.payload).toMatchObject({ status: "erledigt", fassung: 2 });
    expect(JSON.stringify([...angelegt, ...geaendert])).not.toContain(NOTIZWORT);
  });
});

// ================================================================================================
describe("A2b · K2 — Nacharbeit 2 (Ben): jede gespeicherte Aufgabe bleibt erreichbar", () => {
  it("die Liste begrenzt nicht unter der Höchstzahl je Konto", () => {
    expect(KLARA_AUFGABE_LISTE_MAX).toBeGreaterThanOrEqual(KLARA_AUFGABE_MAX_JE_KONTO);
  });

  it("mehr Aufgaben als die frühere Grenze (500): alle kommen an, die älteste offene hohe zuerst", async () => {
    const notizen = new InMemoryKlaraNotizRepo();
    const KONTO = "u-viele";
    await notizen.lege({
      id: "n-viele",
      kontoId: KONTO,
      vorgang: "notiz-viele-1",
      art: "notiz",
      weg: "geschrieben",
      titel: "Sammelnotiz",
      inhalt: "Viele Aufgaben",
      offeneFragen: [],
      objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "—" },
      quelle: null,
      angelegtAm: "2026-10-12T08:00:00.000Z",
      geaendertAm: "2026-10-12T08:00:00.000Z",
      fassung: 1,
    });
    let uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const dienst = new KlaraAufgabeDienst({
      repo: new InMemoryKlaraAufgabeRepo(),
      notizen,
      jetzt: () => {
        uhr += 1_000;
        return uhr;
      },
    });
    const lege = (i: number, prioritaet: "hoch" | "mittel", titel: string) =>
      dienst.lege(KONTO, {
        vorgang: `viele-${String(i).padStart(4, "0")}`,
        weg: "notiz",
        quelle: { notizId: "n-viele" },
        titel,
        prioritaet,
      });
    // Die ÄLTESTE Aufgabe ist offen und hoch priorisiert — genau die, die vorher wegfiel.
    const { aufgabe: alt } = await lege(0, "hoch", "Älteste, aber wichtig");
    for (let i = 1; i <= 520; i++) {
      await lege(i, "mittel", `Aufgabe ${i}`);
    }
    const liste = await dienst.liste(KONTO, undefined);
    expect(liste).toHaveLength(521);
    expect(liste[0]?.id).toBe(alt.id);
    expect(new Set(liste.map((a) => a.id)).size).toBe(521);
  });
});

describe("A4 · K4 — Fehler und doppelte Wiederholung, tatsächlicher Status in Klara", () => {
  it("zweimal „Als Aufgabe“ an derselben Notiz (derselbe Vorgang) ergibt eine Aufgabe", async () => {
    const n = await notiz(erik.token, "Einmal genügt");
    const v = `aufgabe-aus-notiz-${n.id}`;
    const erst = await ausNotiz(erik.token, n.id, v);
    const zweit = await ausNotiz(erik.token, n.id, v);
    expect(erst.statusCode).toBe(201);
    expect(zweit.statusCode).toBe(200);
    expect((zweit.json() as { wiederholt: boolean }).wiederholt).toBe(true);
    expect((zweit.json() as { aufgabe: Sicht }).aufgabe.id).toBe(
      (erst.json() as { aufgabe: Sicht }).aufgabe.id,
    );
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
  });

  it("scheitert die Ablage vor dem Schreiben, steht der Fehler da und nichts ist angelegt", async () => {
    const n = await notiz(erik.token, "Scheitert zuerst");
    const v = vorgang();
    aufgabenRepo.stoerung = "vorher";
    const r = await ausNotiz(erik.token, n.id, v);
    expect(r.statusCode).toBeGreaterThanOrEqual(500);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(0);
    const wieder = await ausNotiz(erik.token, n.id, v);
    expect(wieder.statusCode, wieder.body).toBe(201);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
  });

  it("die Antwort ging NACH dem Schreiben verloren: die Wiederholung ergibt dieselbe, einzige Aufgabe", async () => {
    const n = await notiz(erik.token, "Gespeichert ohne Antwort");
    const v = vorgang();
    aufgabenRepo.stoerung = "nachher";
    const r = await ausNotiz(erik.token, n.id, v);
    expect(r.statusCode).toBeGreaterThanOrEqual(500);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
    const wieder = await ausNotiz(erik.token, n.id, v);
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect((wieder.json() as { wiederholt: boolean }).wiederholt).toBe(true);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
  });

  it("eine wiederholte Änderung (Antwort verloren) ergibt keine zweite Fassung", async () => {
    const n = await notiz(erik.token, "Erledigen mit Störung");
    const a = ((await ausNotiz(erik.token, n.id)).json() as { aufgabe: Sicht }).aufgabe;
    aufgabenRepo.aenderungsStoerung = "nachher";
    const erst = await aendere(erik.token, a.id, { fassung: 1, status: "erledigt" });
    expect(erst.statusCode).toBeGreaterThanOrEqual(500);
    // Der tatsächliche Stand am Server: erledigt, Fassung 2.
    expect(await oeffne(erik.token, a.id)).toMatchObject({ status: "erledigt", fassung: 2 });
    const wieder = await aendere(erik.token, a.id, { fassung: 1, status: "erledigt" });
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect((wieder.json() as { wiederholt: boolean }).wiederholt).toBe(true);
    expect((await oeffne(erik.token, a.id)).fassung).toBe(2);
    // Eine ANDERE Änderung mit der alten Fassung ist kein Wiederholen: 409, nichts überschrieben.
    const anders = await aendere(erik.token, a.id, { fassung: 1, prioritaet: "hoch" });
    expect(anders.statusCode).toBe(409);
    expect((await oeffne(erik.token, a.id)).prioritaet).toBe("mittel");
  });

  it("Aktionsweg: die Wiederholung desselben Schritts legt nichts doppelt an", async () => {
    const gid = await gespraech(erik.token);
    const auftrag = await aufgabenAuftrag(erik.token, gid, "Einmal über den Auftrag");
    const erst = await fuehreAus(erik.token, gid, auftrag.id, "schritt-doppelt-1");
    const zweit = await fuehreAus(erik.token, gid, auftrag.id, "schritt-doppelt-1");
    expect(zweit.wiederholt).toBe(true);
    expect(zweit.schritt.ergebnis?.id).toBe(erst.schritt.ergebnis?.id);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
    // Und ein zweiter Schlüssel für denselben Planschritt beginnt keinen zweiten Schritt.
    const anderer = await auf(
      erik.token,
      "POST",
      `${KLARA}/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/schritt-doppelt-2/ausfuehrung`,
      { nr: 1, auftragFassung: 1 },
    );
    expect(anderer.statusCode).toBe(409);
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
  });

  it("Aktionsweg: Antwort nach dem Schreiben verloren — gespeichert, genau eine Aufgabe", async () => {
    const gid = await gespraech(erik.token);
    const auftrag = await aufgabenAuftrag(erik.token, gid, "Antwort verloren");
    aufgabenRepo.stoerung = "nachher";
    const r = await fuehreAus(erik.token, gid, auftrag.id, "schritt-verloren-1");
    // Kein falsches „fehlgeschlagen“: die Aufgabe steht da, und genau das meldet der Schritt.
    expect(r.schritt.stand).toBe("gespeichert");
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
    expect(r.schritt.ergebnis?.id).toBe((await liste(erik.token))[0]?.id);
  });

  it("Aktionsweg: die Ablage ist weg — der Schritt meldet „fehlgeschlagen“, keine Aufgabe", async () => {
    const gid = await gespraech(erik.token);
    const auftrag = await aufgabenAuftrag(erik.token, gid, "Ablage weg");
    aufgabenRepo.stoerung = "immer";
    const r = await fuehreAus(erik.token, gid, auftrag.id, "schritt-weg-1");
    expect(r.schritt.stand).toBe("fehlgeschlagen");
    expect(r.schritt.fehlerCode).toBe("server");
    expect(r.schritt.ergebnis).toBeNull();
    expect(r.auftrag.stand).toBe("fehlgeschlagen");
    aufgabenRepo.stoerung = "keine";
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(0);
    // Der Vertrag sagt, warum Klara diese Anlage nicht zurücknimmt — und wo korrigiert wird.
    const gut = await aufgabenAuftrag(erik.token, gid, "Nach der Störung");
    const ok = await fuehreAus(erik.token, gid, gut.id, "schritt-gut-1");
    expect(ok.schritt.vertrag).toBe("persoenliche_aufgabe_anlegen");
    const zurueck = await auf(
      erik.token,
      "POST",
      `${KLARA}/gespraeche/${gid}/auftraege/${gut.id}/schritte/schritt-gut-1/ruecknahme`,
    );
    expect(zurueck.statusCode, zurueck.body).toBe(409);
    expect(zurueck.body).toContain("persoenliche_aufgabe");
    expect(await aufgabenRepo.anzahl(erik.id)).toBe(1);
  });

  it("Klara zeigt nach dem Erledigen am Ort den Status, den der Server führt", async () => {
    const gid = await gespraech(erik.token);
    const auftrag = await aufgabenAuftrag(erik.token, gid, "Status prüfen");
    const r = await fuehreAus(erik.token, gid, auftrag.id, "schritt-status-1");
    const id = r.schritt.ergebnis?.id ?? "";
    await aendere(erik.token, id, { fassung: 1, status: "erledigt", prioritaet: "hoch" });
    // Die Liste, aus der Klara liest, führt den neuen Stand — nicht den des Auftrags von damals.
    expect((await liste(erik.token)).find((a) => a.id === id)).toMatchObject({
      status: "erledigt",
      prioritaet: "hoch",
    });
  });
});
