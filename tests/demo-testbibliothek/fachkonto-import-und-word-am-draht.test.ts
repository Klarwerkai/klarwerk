// ================================================================================================
// gesamt-nutzerverwaltung · FRAGE 6 — DAS DEMO-ARBEITSKONTO UND SEINE EIGENE TESTBIBLIOTHEK.
// ================================================================================================
//
// Peters Entscheidung (11.10.2026, Frage 6): „Normale Fachrolle mit begrenzten Importrechten auf
// eigene Testbibliothek." Diese Datei fährt den Weg dieses Kontos IN EINEM STÜCK, so wie ein
// Betreiber ihn einrichtet und ein Mensch ihn geht:
//
//   1  Admin legt das Konto als `experte` an — freigegeben, je mit Protokolleintrag.
//   2  Eigene Anmeldung des Kontos in einem eigenen Keksbeutel (echter Socket, `strecke.ts`).
//   3  OHNE Zuordnung: der SharePoint-Import bleibt zu (403) — die Gegenprobe zur Kontokonfiguration.
//   4  MIT Zuordnung (`KLARWERK_SHAREPOINT_TESTBIBLIOTHEKEN`): Liste und Übernahme gehen, und zwar
//      AUSSCHLIESSLICH gegen die eigene Testbibliothek. Eine Kennung aus der Instanzbibliothek wird
//      dort nicht gefunden; kein Graph-Abruf des Kontos geht an ein anderes Laufwerk.
//   5  Annahme nach bestehender Regel: das Konto selbst kann seinen Kandidaten NICHT annehmen
//      (`ko.validate`), ein Admin schon. Das zurückgelesene Objekt trägt die Testbibliothek als
//      Herkunft.
//   6  Word-Bearbeitung eines freigegebenen Eintrags: direkt ersetzen geht nicht (PROPOSAL_REQUIRED),
//      der Vorschlag mit Herkunft `word_addin` schon; ein Admin übernimmt ihn, und der WIEDER
//      GELESENE Stand ist die neue, freigegebene Fassung — mit dem Admin als Entscheider.
//   7  Unzulässiges bleibt zu: Kontenliste, Zugangsauskunft, Direktfreigabe; ein `viewer` mit
//      Zuordnung kommt nicht an den Import.
//
// WAS HIER ECHT IST: die App (`buildApp`), ihr Port, die Kekse, alle Rechte- und Speicherwege.
// WAS EIN DOUBLE IST: Microsoft Graph. `globalThis.fetch` bedient die gepinnte Graph-Origin mit ZWEI
// getrennten Laufwerken und reicht nur `http://127.0.0.1:<port>` an das echte `fetch` durch; jede
// andere Adresse wirft und wird notiert. Pedis Grenze gilt: „Codeprüfung und simulierte
// Office-Tests ersetzen keine echte Microsoft-365-Abnahme." Ebenso ist das Word-Seitenfenster hier
// nicht im Spiel — gemessen wird sein Serverweg (`action: "propose"`, Herkunft `word_addin`).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PublicUser, Role } from "../../services/auth/src/types";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ausDerListe,
  ersteinrichtung,
  gastAnlegen,
  mussGelingen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";

const GRAPH = "https://graph.microsoft.test/v1.0";
const INSTANZ = "b!instanzbibliothek";
const TESTBIBLIOTHEK = "b!demo-testbibliothek";
const ZUORDNUNG = "KLARWERK_SHAREPOINT_TESTBIBLIOTHEKEN";
const DATEIEN = "/api/admin/import/sharepoint/files";
const UEBERNAHME = "/api/admin/import/sharepoint/apply";
const KANDIDATEN = "/api/library/import/candidates";

const VORHER: Record<string, string | undefined> = {};
const SETZEN: Record<string, string> = {
  KLARWERK_SHAREPOINT_IMPORT: "1",
  KLARWERK_SHAREPOINT_BASE_URL: GRAPH,
  KLARWERK_SHAREPOINT_TOKEN: "vertragsdouble-nur-fuer-den-test",
  KLARWERK_SHAREPOINT_DRIVE: INSTANZ,
};
// Vor dem ersten `buildApp`: der Importschalter wird beim Bauen gelesen.
for (const [name, wert] of Object.entries(SETZEN)) {
  VORHER[name] = process.env[name];
  process.env[name] = wert;
}
VORHER[ZUORDNUNG] = process.env[ZUORDNUNG];
delete process.env[ZUORDNUNG];

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Liegt NUR in der Testbibliothek des Demokontos. */
const DEMO_DATEI = {
  id: "01DEMOPUMPE",
  name: "Pumpenwartung-Demo.docx",
  webUrl: "https://contoso.sharepoint.test/sites/demo/Testbibliothek/Pumpenwartung-Demo.docx",
  lastModifiedDateTime: "2026-10-10T09:00:00Z",
  size: 18_432,
  file: { mimeType: DOCX },
};

/** Liegt NUR in der Instanzbibliothek — das Demokonto darf sie nie erreichen. */
const INSTANZ_DATEI = {
  id: "01INSTANZVERTRAG",
  name: "Kundenvertrag-intern.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Kundenvertrag-intern.docx",
  lastModifiedDateTime: "2026-10-01T12:00:00Z",
  size: 40_960,
  file: { mimeType: DOCX },
};

const LAUFWERKE: Record<string, (typeof DEMO_DATEI)[]> = {
  [INSTANZ]: [INSTANZ_DATEI],
  [TESTBIBLIOTHEK]: [DEMO_DATEI],
};

const NICHT_DA = { error: { code: "itemNotFound" } };

const echtesFetch = globalThis.fetch;
const fremdeAufrufe: string[] = [];
const graphAufrufe: string[] = [];

function graphAntwort(body: unknown, status = 200): Response {
  const ok = status >= 200 && status < 300;
  const headers = { get: () => null };
  return { ok, status, headers, json: async () => body } as unknown as Response;
}

/** Das Graph-Vertragsdouble: zwei getrennte Laufwerke, jedes kennt nur seine eigenen Dateien. */
async function graphDouble(eingabe: unknown, init?: RequestInit): Promise<Response> {
  const url = String(eingabe);
  if (url.startsWith("http://127.0.0.1:")) {
    return echtesFetch(url, init);
  }
  if (!url.startsWith(`${GRAPH}/drives/`)) {
    fremdeAufrufe.push(url);
    throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
  }
  graphAufrufe.push(url);
  const laufwerk = decodeURIComponent(url.slice(`${GRAPH}/drives/`.length).split("/")[0] ?? "");
  const dateien = LAUFWERKE[laufwerk];
  if (!dateien) {
    return graphAntwort(NICHT_DA, 404);
  }
  if (url.includes("/root/children")) {
    return graphAntwort({ value: dateien });
  }
  const treffer = dateien.find((d) => url.includes(`/items/${d.id}`));
  return treffer ? graphAntwort(treffer) : graphAntwort(NICHT_DA, 404);
}

beforeAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = graphDouble;
});

afterAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = echtesFetch;
  for (const [name, wert] of Object.entries(VORHER)) {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
});

let offen: Strecke | undefined;
afterEach(async () => {
  delete process.env[ZUORDNUNG];
  await offen?.schliessen();
  offen = undefined;
});

interface Bilanz {
  imported: number;
  failed: unknown[];
  notFound: string[];
}
interface Liste {
  dateien: { id: string; name: string }[];
}
interface Kandidat {
  id: string;
  item: { externalId?: string };
}
interface Eintrag {
  title: string;
  version: number;
  status: string;
  statement: string;
  sources: { externalId?: string; spaceKey?: string }[];
  proposals?: { id: string; status: string; origin?: string; decidedBy?: string }[];
}

async function anmelden(strecke: Strecke, name: string, email: string): Promise<Sitzung> {
  const sitzung = strecke.profil(name);
  const antwort = await sitzung.sende("POST", "/api/auth/login", { email, password: PASSWORT });
  mussGelingen(`Anmeldung ${email}`, antwort);
  return sitzung;
}

async function kontoAnlegen(admin: Sitzung, email: string, role: Role): Promise<PublicUser> {
  const antwort = await gastAnlegen(admin, { name: `Demo ${role}`, email, role });
  return mussGelingen("POST /api/users", antwort, 201).json as PublicUser;
}

/** Ein JSON-Rumpf, der gelingen MUSS — sonst wirft der Fall mit Status und Rumpf. */
async function lies<T>(was: string, wer: Sitzung, art: string, pfad: string, rumpf?: unknown) {
  return mussGelingen(was, await wer.sende(art, pfad, rumpf)).json as T;
}

/** Ein FREIGEGEBENER Eintrag — das vorhandene Wissen, das in Word bearbeitet wird. */
async function freigegebenesWissen(admin: Sitzung): Promise<string> {
  const antwort = await admin.sende("POST", "/api/kos", {
    confidentiality: "intern",
    title: "Pumpe P3 entlüften",
    statement: "Vor dem Anfahren Pumpe P3 am oberen Ventil entlüften.",
    type: "best_practice",
    category: "Wartung",
  });
  const id = (mussGelingen("POST /api/kos", antwort, 201).json as { id: string }).id;
  await lies("admin-validate", admin, "PUT", `/api/kos/${id}`, { action: "admin-validate" });
  return id;
}

describe("Frage 6 · das Demo-Arbeitskonto mit eigener Testbibliothek, am echten Socket", () => {
  it("Anlage, Anmeldung, begrenzter Import, Annahme, Word-Vorschlag, wieder gelesener Stand", async () => {
    offen = await starteStrecke();
    const strecke = offen;
    const start = await ersteinrichtung(strecke, "admin@demo-testbibliothek.test");
    const admin = start.sitzung;
    const adminId = start.admin.id;
    const wissenId = await freigegebenesWissen(admin);

    // --- 1 · Anlage und Freigabe durch den Admin, je mit Protokolleintrag ----------------------
    const demo = await kontoAnlegen(admin, "demo@demo-testbibliothek.test", "experte");
    const inDerListe = await ausDerListe(admin, demo.id);
    expect(inDerListe?.role, "normale Fachrolle, keine Adminrolle").toBe("experte");
    expect(inDerListe?.approved, "das Konto ist freigegeben").toBe(true);
    for (const aktion of ["user.created", "user.approve"]) {
      const pfad = `/api/audit?action=${aktion}&target=${demo.id}`;
      const belege = await lies<{ actor: string }[]>(aktion, admin, "GET", pfad);
      expect(belege, `${aktion} steht im Protokoll`).toHaveLength(1);
      expect(belege[0]?.actor).toBe(adminId);
    }

    // --- 2 · eigene Anmeldung in einem eigenen Keksbeutel ---------------------------------------
    const konto = await anmelden(strecke, "demo", "demo@demo-testbibliothek.test");
    expect(konto.hatSitzungskeks()).toBe(true);
    const ich = await lies<PublicUser>("GET /api/auth/me", konto, "GET", "/api/auth/me");
    expect(ich.id).toBe(demo.id);

    // --- 3 · OHNE Zuordnung bleibt der Import zu --------------------------------------------------
    const ohne = await konto.sende("POST", DATEIEN, {});
    expect(ohne.status, ohne.text).toBe(403);
    expect((ohne.json as { error: string }).error).toBe("FORBIDDEN");

    // --- 4 · MIT Zuordnung: nur die eigene Testbibliothek ----------------------------------------
    process.env[ZUORDNUNG] = `${demo.id}=${TESTBIBLIOTHEK}`;
    const abrufeVorher = graphAufrufe.length;

    const liste = await lies<Liste>("Dateiliste der Testbibliothek", konto, "POST", DATEIEN, {});
    expect(liste.dateien.map((d) => d.name)).toEqual(["Pumpenwartung-Demo.docx"]);

    // Eine Kennung aus der INSTANZbibliothek: in der Testbibliothek gibt es sie nicht.
    const fremdeWahl = { ids: [INSTANZ_DATEI.id] };
    const fremd = await lies<Bilanz>("fremde Kennung", konto, "POST", UEBERNAHME, fremdeWahl);
    expect(fremd.imported, "nichts aus der Instanzbibliothek übernommen").toBe(0);
    expect(fremd.notFound).toEqual([INSTANZ_DATEI.id]);

    const eigeneWahl = { ids: [DEMO_DATEI.id] };
    const eigen = await lies<Bilanz>("eigene Datei", konto, "POST", UEBERNAHME, eigeneWahl);
    expect(eigen.imported).toBe(1);
    expect(eigen.failed).toEqual([]);
    expect(eigen.notFound).toEqual([]);

    const abrufeDesKontos = graphAufrufe.slice(abrufeVorher);
    const eigenesLaufwerk = `${GRAPH}/drives/${TESTBIBLIOTHEK}/`;
    expect(abrufeDesKontos.length).toBeGreaterThan(0);
    const daneben = abrufeDesKontos.filter((u) => !u.startsWith(eigenesLaufwerk));
    expect(daneben, "jeder Graph-Abruf des Demokontos geht an seine Testbibliothek").toEqual([]);

    // Der Admin arbeitet unverändert gegen die Instanzbibliothek.
    const adminListe = await lies<Liste>("Dateiliste des Admins", admin, "POST", DATEIEN, {});
    expect(adminListe.dateien.map((d) => d.name)).toEqual(["Kundenvertrag-intern.docx"]);

    // --- 5 · Annahme nach bestehender Regel und wieder gelesener Stand ---------------------------
    const kandidaten = await lies<Kandidat[]>("Warteschlange", admin, "GET", KANDIDATEN);
    const kandidat = kandidaten.find((k) => k.item.externalId === DEMO_DATEI.id);
    expect(kandidat, "der Kandidat des Demokontos steht in der Warteschlange").toBeDefined();
    expect(kandidaten.some((k) => k.item.externalId === INSTANZ_DATEI.id)).toBe(false);

    const annahme = `${KANDIDATEN}/${kandidat?.id}`;
    const annehmenDurchKonto = { action: "accept" };
    const selbst = await konto.sende("PUT", annahme, annehmenDurchKonto);
    expect(selbst.status, "das Demokonto nimmt seinen Import nicht selbst an").toBe(403);

    const annehmen = { action: "accept" };
    const angenommen = await lies<{ koId?: string }>("Annahme", admin, "PUT", annahme, annehmen);
    expect(angenommen.koId).toBeTruthy();
    const koPfad = `/api/kos/${angenommen.koId}`;
    const importiert = await lies<Eintrag>("importiertes Objekt", konto, "GET", koPfad);
    expect(importiert.title).toBe("Pumpenwartung-Demo.docx");
    const anker = importiert.sources.find((s) => s.externalId === DEMO_DATEI.id);
    expect(anker?.spaceKey, "Herkunft ist die Testbibliothek").toBe(TESTBIBLIOTHEK);

    // --- 6 · Word-Bearbeitung und Rückgabe nach bestehender Accountregel -------------------------
    const wissenPfad = `/api/kos/${wissenId}`;
    const ersetzen = { action: "revise", changes: { statement: "Direkt ersetzt." } };
    const direkt = await konto.sende("PUT", wissenPfad, ersetzen);
    expect(direkt.status).toBe(403);
    expect((direkt.json as { error: string }).error).toBe("PROPOSAL_REQUIRED");

    const neuerText = "Vor dem Anfahren Pumpe P3 an beiden Ventilen entlüften.";
    const vorschlagen = {
      action: "propose",
      proposal: { statement: neuerText, baseVersion: 1, origin: "word_addin" },
    };
    await lies("Vorschlag aus Word", konto, "PUT", wissenPfad, vorschlagen);
    const wartend = await lies<Eintrag>("Stand nach dem Vorschlag", konto, "GET", wissenPfad);
    expect(wartend.version, "der Vorschlag ändert den freigegebenen Stand nicht").toBe(1);
    expect(wartend.statement).toBe("Vor dem Anfahren Pumpe P3 am oberen Ventil entlüften.");
    const vorschlag = wartend.proposals?.[0];
    expect(vorschlag?.status).toBe("offen");
    expect(vorschlag?.origin).toBe("word_addin");

    const entscheiden = {
      action: "decide-proposal",
      proposalId: vorschlag?.id,
      decision: "uebernehmen",
      expectedVersion: 1,
    };
    await lies("Übernahme durch den Admin", admin, "PUT", wissenPfad, entscheiden);
    const zurueck = await lies<Eintrag>("wieder gelesener Stand", konto, "GET", wissenPfad);
    expect(zurueck.statement).toBe(neuerText);
    expect(zurueck.version).toBe(2);
    expect(zurueck.status).toBe("validiert");
    expect(zurueck.proposals?.[0]?.status).toBe("uebernommen");
    expect(zurueck.proposals?.[0]?.decidedBy).toBe(adminId);

    // --- 7 · Unzulässiges bleibt zu --------------------------------------------------------------
    expect((await konto.sende("GET", "/api/users")).status, "Kontenliste").toBe(403);
    const zugang = await konto.sende("GET", "/api/import/sharepoint/zugang");
    expect(zugang.status, "Zugangsauskunft bleibt Adminsache").toBe(403);
    const selbstFrei = { action: "revise-release", changes: { statement: "Selbst frei." } };
    const freigabe = await konto.sende("PUT", wissenPfad, selbstFrei);
    expect(freigabe.status, "keine Direktfreigabe").toBe(403);
  });

  it("ein `viewer` mit eingetragener Testbibliothek kommt nicht an den Import", async () => {
    offen = await starteStrecke();
    const strecke = offen;
    const { sitzung: admin } = await ersteinrichtung(strecke, "admin2@demo-testbibliothek.test");
    const leser = await kontoAnlegen(admin, "leser@demo-testbibliothek.test", "viewer");
    process.env[ZUORDNUNG] = `${leser.id}=${TESTBIBLIOTHEK}`;
    const sitzung = await anmelden(strecke, "leser", "leser@demo-testbibliothek.test");
    const abrufeVorher = graphAufrufe.length;

    expect((await sitzung.sende("POST", DATEIEN, {})).status).toBe(403);
    const wahl = { ids: [DEMO_DATEI.id] };
    expect((await sitzung.sende("POST", UEBERNAHME, wahl)).status).toBe(403);
    const ohneAbruf = "kein Graph-Abruf für ein Konto ohne ko.create";
    expect(graphAufrufe.length, ohneAbruf).toBe(abrufeVorher);
  });

  it("eine Kontokennung mit zwei verschiedenen Bibliotheken gilt als nicht zugeordnet", async () => {
    offen = await starteStrecke();
    const strecke = offen;
    const { sitzung: admin } = await ersteinrichtung(strecke, "admin3@demo-testbibliothek.test");
    const demo = await kontoAnlegen(admin, "demo3@demo-testbibliothek.test", "experte");
    const doppelt = [`${demo.id}=${TESTBIBLIOTHEK}`, `${demo.id}=${INSTANZ}`];
    process.env[ZUORDNUNG] = doppelt.join(",");
    const sitzung = await anmelden(strecke, "demo3", "demo3@demo-testbibliothek.test");

    expect((await sitzung.sende("POST", DATEIEN, {})).status, "im Zweifel nein").toBe(403);
  });

  it("NETZPROBE: kein Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    expect(graphAufrufe.length).toBeGreaterThan(0);
  });
});
