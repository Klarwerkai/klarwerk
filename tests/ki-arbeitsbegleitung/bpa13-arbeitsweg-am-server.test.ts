// ================================================================================================
// BPA-13 · DER DURCHGÄNGIGE ARBEITSWEG AM ECHTEN SERVER (Szenario BPA-S14)
// ================================================================================================
//
// Nacharbeit 2 (Ben): „Der neue Kern wird ausschließlich von Unit-Tests aufgerufen." Diese Datei
// fährt den Weg über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`,
// `app.inject`): eigenes Klara-Gespräch → Auftrag mit frischen Rechten und ausdrücklicher
// Dokumentfreigabe → Übergabe → Ergebnis → Verlauf. Dazu die Negativfälle: fremdes Konto,
// Rechteentzug und geschlossene Freigabe zwischen Vorbereitung und Übergabe, „Keine KI",
// API-Weg ohne eingerichteten Anbieter und die begrenzte Codex-Wirkung.
//
// Nur synthetische Daten. Kein Modellaufruf: im Prüfaufbau ist kein Cloud-Anbieter eingerichtet.
// Der zweite Block misst den API-Weg am Dienst mit einer ausdrücklich so benannten ATTRAPPE —
// er belegt Bindung, Sendestand und Wiederaufnahme, KEINEN realen Anbieterlauf (AC10 bleibt offen).
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { SessionUser } from "../../services/app/src/http";
import {
  type KiApiWeg,
  KiArbeitsbegleitungDienst,
  type KiAuftragSicht,
} from "../../services/app/src/ki-arbeitsbegleitung-dienst";
import {
  InMemoryKlaraGespraechRepo,
  KlaraGespraechDienst,
} from "../../services/app/src/klara-gespraech";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let codexBasis = "";
let vera = { id: "", token: "" };
let erik = { id: "", token: "" };
let preis: KnowledgeObject;
let beta: KnowledgeObject;

const BASIS = "/api/me/klara";

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

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function gespraech(wer: string): Promise<string> {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche`, {
    objektbezug: { pfad: "/wissen", seitenName: "Wissen", objekt: "Preise", koId: preis.id },
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

function auftrag(extra: Record<string, unknown> = {}) {
  return {
    ziel: "Fasse die Preisbedingungen für das Angebot zusammen",
    ergebnisformat: "stichpunkte",
    anbieter: "anthropic",
    faehigkeit: "prompt_manuell",
    quellen: [preis.id, beta.id],
    freigegebeneQuellen: [preis.id],
    offenePunkte: ["Gilt der Preis auch für Bestandskunden?"],
    ...extra,
  };
}

async function bereite(wer: string, gid: string, extra: Record<string, unknown> = {}) {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche/${gid}/ki-auftraege`, auftrag(extra));
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { auftrag: KiAuftragSicht }).auftrag;
}

async function liste(wer: string, gid: string): Promise<KiAuftragSicht[]> {
  const r = await auf(wer, "GET", `${BASIS}/gespraeche/${gid}/ki-auftraege`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { auftraege: KiAuftragSicht[] }).auftraege;
}

const jobUrl = (gid: string, jobId: string, schritt: string) =>
  `${BASIS}/gespraeche/${gid}/ki-auftraege/${jobId}/${schritt}`;

beforeEach(async () => {
  codexBasis = mkdtempSync(join(tmpdir(), "bpa13-server-codex-"));
  services = assembleServices(inMemoryRepos());
  app = buildApp(services, { kiCodexBasis: codexBasis });
  await erteileKiFreigabe(services.reasoner);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@bpa13.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@bpa13.test");
  vera = await konto(adminToken, "viewer", "vera@bpa13.test", "Vera Viewer");
  erik = await konto(adminToken, "experte", "erik@bpa13.test", "Erik Experte");
  preis = await services.ko.create({
    title: "Preisblatt Angebot",
    statement: "Listenpreis 120 EUR je Lizenz.",
    measures: ["Rabatt erst ab 10 Lizenzen."],
    type: "best_practice",
    category: "Preise",
    author: "ada",
  });
  beta = await services.ko.create({
    title: "Kalkulation Projekt Beta",
    statement: "Interne Kalkulation Projekt Beta mit Marge.",
    type: "best_practice",
    category: "Preise",
    author: "ada",
  });
});

afterEach(() => {
  rmSync(codexBasis, { recursive: true, force: true });
});

describe("S14-1 · natürlicher Auftrag → Prompt → manuelle Übergabe → Ergebnis im Verlauf", () => {
  it("bindet Projekt, Quellstand und Freigabe; ein zweites Vorbereiten ist derselbe Job", async () => {
    const gid = await gespraech(vera.token);
    const f = await auf(vera.token, "GET", `${BASIS}/ki-faehigkeiten`);
    expect(f.statusCode).toBe(200);
    const fj = f.json() as {
      faehigkeiten: { faehigkeit: string; status: string }[];
      fremdeChatsteuerung: string;
      lage: { oeffentlicheKiFreigegeben: boolean; erlaubteAnbieter: string[] };
    };
    expect(fj.fremdeChatsteuerung).toBe("nicht_vorhanden");
    expect(fj.lage.oeffentlicheKiFreigegeben).toBe(true);
    expect(fj.lage.erlaubteAnbieter).toEqual(["anthropic", "openai"]);
    expect(fj.faehigkeiten.find((x) => x.faehigkeit === "prompt_manuell")?.status).toBe(
      "verfuegbar",
    );
    // Im Prüfaufbau ist kein Cloud-Anbieter eingerichtet — das wird nicht als verbunden gezeigt.
    expect(fj.faehigkeiten.find((x) => x.faehigkeit === "api")?.status).not.toBe("verbunden");

    const a = await bereite(vera.token, gid);
    expect(a.job).toMatchObject({ status: "vorbereitet", sendungen: 0, anbieter: "anthropic" });
    expect(a.prompt).toContain("Listenpreis 120 EUR je Lizenz.");
    expect(a.prompt).toContain(`[Quelle ${preis.id} · Fassung ${preis.version}]`);
    expect(a.prompt).toContain(`Dokument ${preis.id} (Fassung ${preis.version})`);
    expect(a.prompt).not.toContain("Interne Kalkulation");
    expect(a.ausgelassen).toContainEqual({
      quelleId: beta.id,
      titel: "Kalkulation Projekt Beta",
      grund: "dokumentfreigabe_fehlt",
    });

    const nochmal = await bereite(vera.token, gid);
    expect(nochmal.job.jobId).toBe(a.job.jobId);
    expect(await liste(vera.token, gid)).toHaveLength(1);
  });

  it("übergibt genau einmal, nimmt nur das Ergebnis des gewählten Anbieters an und hält es fest", async () => {
    const gid = await gespraech(vera.token);
    const a = await bereite(vera.token, gid);

    const u1 = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {});
    expect(u1.statusCode, u1.body).toBe(200);
    const u1j = u1.json() as { gesendet: boolean; prompt: string; sicht: KiAuftragSicht };
    expect(u1j.gesendet).toBe(true);
    expect(u1j.prompt).toBe(a.prompt);
    expect(u1j.sicht.job.sendungen).toBe(1);

    const u2 = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {});
    expect(u2.statusCode).toBe(200);
    expect((u2.json() as { gesendet: boolean }).gesendet).toBe(false);

    const fremd = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "ergebnis"), {
      inhalt: "- 120 EUR je Lizenz",
      anbieter: "openai",
    });
    expect(fremd.statusCode).toBe(409);

    const ok = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "ergebnis"), {
      inhalt: "- 120 EUR je Lizenz",
      anbieter: "anthropic",
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const s = (ok.json() as { auftrag: KiAuftragSicht }).auftrag;
    expect(s.job).toMatchObject({ status: "antwort_erhalten", sendungen: 1 });
    expect(s.antworten).toHaveLength(1);
    expect(s.antworten[0]).toMatchObject({
      anbieter: "anthropic",
      weg: "manuell",
      anwendbar: true,
    });
    expect(s.belege.map((b) => b.klasse)).toEqual(["manuelle_uebergabe"]);

    // Im BESTEHENDEN Verlauf gespeichert — und nach erneutem Lesen gleich.
    const gespeichert = await services.klaraGespraeche.hole(vera.id, gid);
    expect(gespeichert?.kiAuftraege?.[0]?.antworten[0]?.inhalt).toBe("- 120 EUR je Lizenz");
    expect((await liste(vera.token, gid))[0]?.antworten).toHaveLength(1);
    // Die Gesprächssicht reicht die Aufträge nicht nebenbei mit hinaus.
    const g = await auf(vera.token, "GET", `${BASIS}/gespraeche/${gid}`);
    expect(Object.keys((g.json() as { gespraech: object }).gespraech)).not.toContain("kiAuftraege");
  });

  it("ein fremdes Konto sieht und bewegt nichts — fremd und unbekannt antworten gleich", async () => {
    const gid = await gespraech(vera.token);
    const a = await bereite(vera.token, gid);
    expect(
      (await auf(erik.token, "GET", `${BASIS}/gespraeche/${gid}/ki-auftraege`)).statusCode,
    ).toBe(404);
    const u = await auf(erik.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {});
    expect(u.statusCode).toBe(404);
    expect((await liste(vera.token, gid))[0]?.job.sendungen).toBe(0);
    expect((await auf("", "GET", `${BASIS}/gespraeche/${gid}/ki-auftraege`)).statusCode).toBe(401);
  });
});

describe("S14-2 · Entzug zwischen Vorbereitung und Übergabe (Ben, AC03/G04/G17)", () => {
  it("Leserecht entzogen: Prompt gesperrt, keine Übergabe; Neubinden lässt die Quelle draußen", async () => {
    const gid = await gespraech(vera.token);
    const a = await bereite(vera.token, gid);
    // Die Quelle wird vertraulich — eine Betrachterin sieht sie ab jetzt nicht mehr.
    await services.ko.setConfidentiality(preis.id, "vertraulich", "ada");

    const [s] = await liste(vera.token, gid);
    expect(s).toMatchObject({ paketAktuell: false, prompt: null });
    expect(s?.paketGruende).toEqual([{ quelleId: preis.id, grund: "entzogen" }]);

    const u = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {
      erneutSendenBestaetigt: true,
    });
    expect(u.statusCode).toBe(409);
    expect((u.json() as { grund: string }).grund).toBe("paket_veraltet");
    expect((await liste(vera.token, gid))[0]?.job.sendungen).toBe(0);

    const neu = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "neu-binden"), {});
    expect(neu.statusCode, neu.body).toBe(201);
    const n = (neu.json() as { auftrag: KiAuftragSicht }).auftrag;
    expect(n.job.jobId).not.toBe(a.job.jobId);
    expect(n.prompt).not.toContain("Listenpreis");
    expect(JSON.stringify(n)).not.toContain("Preisblatt Angebot");
    const alle = await liste(vera.token, gid);
    expect(alle.find((x) => x.job.jobId === a.job.jobId)?.job).toMatchObject({
      status: "ersetzt",
      ersetztDurch: n.job.jobId,
    });
  });

  it("Dokumentfreigabe zurückgenommen: dieses Paket wird nicht mehr übergeben", async () => {
    const gid = await gespraech(vera.token);
    const a = await bereite(vera.token, gid);
    const z = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "freigabe-schliessen"), {
      quelleId: preis.id,
    });
    expect(z.statusCode, z.body).toBe(200);
    const s = (z.json() as { auftrag: KiAuftragSicht }).auftrag;
    expect(s.paketGruende).toEqual([{ quelleId: preis.id, grund: "dokumentfreigabe_geschlossen" }]);
    const u = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {});
    expect(u.statusCode).toBe(409);
    expect((u.json() as { grund: string }).grund).toBe("paket_veraltet");
  });
});

describe("S14-3 · Keine KI und API-Weg ohne Anbieter: konkrete Sperre, kein Ausweichen", () => {
  it("„Keine KI“ sperrt Vorbereitung und Übergabe eines bereits vorbereiteten Auftrags", async () => {
    const gid = await gespraech(vera.token);
    const a = await bereite(vera.token, gid);
    await services.reasoner.setTaskConfig({
      global: "deterministic",
      perTask: { answer: "deterministic" },
    });
    expect(services.reasoner.kiAbschaltung().abgeschaltet).toBe(true);

    const b = await auf(vera.token, "POST", `${BASIS}/gespraeche/${gid}/ki-auftraege`, auftrag());
    expect(b.statusCode).toBe(409);
    expect(b.json()).toMatchObject({ grund: "gesperrt", details: { sperre: "keine_ki" } });
    const u = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {});
    expect(u.statusCode).toBe(409);
    expect((u.json() as { grund: string }).grund).toBe("gesperrt");
  });

  it("API ohne eingerichteten Anbieter: Sperre statt eines anderen Anbieters", async () => {
    const gid = await gespraech(vera.token);
    const b = await auf(
      vera.token,
      "POST",
      `${BASIS}/gespraeche/${gid}/ki-auftraege`,
      auftrag({ faehigkeit: "api" }),
    );
    expect(b.statusCode).toBe(409);
    expect(b.json()).toMatchObject({ details: { sperre: "faehigkeit_nicht_verbunden" } });
    expect(await liste(vera.token, gid)).toEqual([]);
  });
});

describe("S14-4 · Codex-Auftrag: echte, begrenzte Dateiwirkung im synthetischen Arbeitsbereich", () => {
  it("schreibt nur die erlaubte Datei; Ausbruch, Löschen und Deployment bleiben ohne Wirkung", async () => {
    const gid = await gespraech(vera.token);
    const a = await bereite(vera.token, gid, {
      faehigkeit: "codex_auftrag",
      anbieter: "openai",
      ergebnisformat: "code_aenderung",
    });
    const vorher = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "codex"), {
      dateien: [{ pfad: "src/preis.ts", art: "anlegen", inhalt: "x" }],
    });
    expect(vorher.statusCode).toBe(409); // erst nach der Übergabe
    const u = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "uebergabe"), {});
    expect(u.statusCode, u.body).toBe(200);
    expect((u.json() as { prompt: string }).prompt).toContain("eine Liste geänderter Dateien");

    const r = await auf(vera.token, "POST", jobUrl(gid, a.job.jobId, "codex"), {
      dateien: [
        { pfad: "src/preis.ts", art: "anlegen", inhalt: "export const PREIS = 120;\n" },
        { pfad: "../../ausbruch.ts", art: "anlegen", inhalt: "x" },
        { pfad: "src/preis.ts", art: "loeschen" },
      ],
      aktionen: ["deploy", "shell"],
    });
    expect(r.statusCode, r.body).toBe(200);
    const w = (r.json() as { auftrag: KiAuftragSicht }).auftrag.codexWirkungen[0];
    expect(w?.geschrieben.map((g) => g.pfad)).toEqual(["src/preis.ts"]);
    expect(w?.abgelehnt.map((x) => x.grund)).toEqual([
      "ausserhalb_arbeitsbereich",
      "loeschen_nicht_erlaubt",
    ]);
    expect(w?.abgelehnteAktionen).toEqual(["deploy", "shell"]);
    const datei = join(codexBasis, a.job.jobId, "src", "preis.ts");
    expect(readFileSync(datei, "utf8")).toBe("export const PREIS = 120;\n");
    expect(existsSync(join(codexBasis, "..", "ausbruch.ts"))).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// Der API-Weg am Dienst — mit einer ATTRAPPE statt eines Anbieters (kein realer Lauf).
// ------------------------------------------------------------------------------------------------

describe("API-Weg am Dienst (Attrappe): Sendestand vor dem Aufruf, Fehler, Wiederaufnahme", () => {
  const user: SessionUser = { id: "u-api", role: "viewer" } as SessionUser;
  const wer = { user, sichtbar: () => true };
  const ko: KnowledgeObject = {
    id: "ko-api",
    title: "Preisblatt",
    statement: "Listenpreis 120 EUR je Lizenz.",
    measures: [],
    version: 3,
    author: "ada",
  } as unknown as KnowledgeObject;

  function aufbau(antworten: Array<"ok" | "fehler">) {
    const aufrufe: string[] = [];
    const gespraeche = new KlaraGespraechDienst({ repo: new InMemoryKlaraGespraechRepo() });
    const api: KiApiWeg = {
      bindung: () => ({
        ausfuehrbar: true,
        anbieter: "anthropic",
        modell: "attrappe",
        sperrgrund: null,
      }),
      adapter: () => [
        // ATTRAPPE: als geprüft eingetragen, damit der Weg offen ist. Ihr Ergebnis trägt KEINE
        // Laufkennung und KEINEN Verbrauch — der Beleg bleibt deshalb „simulation".
        { faehigkeit: "api", anbieter: "anthropic", version: "attrappe", geprueftAm: "2026-10-11" },
      ],
      pruefe: async () => ({ ok: false, detail: "Attrappe" }),
      fuehreAus: async (prompt, anbieter) => {
        aufrufe.push(`${anbieter}:${prompt.length}`);
        const naechste = antworten.shift() ?? "ok";
        await new Promise((fertig) => setTimeout(fertig, 5));
        if (naechste === "fehler") throw new Error("HTTP 529 überlastet");
        return { inhalt: "- 120 EUR", laufId: null, modell: "attrappe", verbrauch: null };
      },
    };
    const dienst = new KiArbeitsbegleitungDienst({
      gespraeche,
      ko: { get: async (id) => (id === ko.id ? ko : undefined) },
      lage: () => ({
        keineKi: false,
        oeffentlicheKiFreigegeben: true,
        vertraulichFreigegeben: false,
        erlaubteAnbieter: ["anthropic", "openai"],
      }),
      api,
      mcpAktiv: () => false,
    });
    return { dienst, gespraeche, aufrufe };
  }

  async function vorbereitet(d: ReturnType<typeof aufbau>) {
    const g = await d.gespraeche.beginne(user.id, {
      pfad: "/wissen",
      seitenName: "Wissen",
      objekt: "Preise",
      koId: ko.id,
    });
    const a = await d.dienst.bereite(wer, g.id, {
      ziel: "Zusammenfassen",
      ergebnisformat: "stichpunkte",
      anbieter: "anthropic",
      faehigkeit: "api",
      quellen: [ko.id],
      freigegebeneQuellen: [ko.id],
    });
    return { gid: g.id, jobId: a.job.jobId };
  }

  it("zwei gleichzeitige Übergaben lösen genau EINEN Anbieteraufruf aus", async () => {
    const d = aufbau(["ok"]);
    const { gid, jobId } = await vorbereitet(d);
    const ergebnisse = await Promise.allSettled([
      d.dienst.uebergib(wer, gid, jobId),
      d.dienst.uebergib(wer, gid, jobId),
    ]);
    expect(d.aufrufe).toHaveLength(1);
    expect(ergebnisse.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    const [s] = await d.dienst.liste(wer, gid);
    expect(s?.job).toMatchObject({ status: "antwort_erhalten", sendungen: 1 });
    expect(s?.belege.map((b) => b.klasse)).toEqual(["simulation"]);
  });

  it("Providerfehler: Wiederaufnahme ohne Bestätigung ruft nicht erneut, mit Bestätigung genau einmal", async () => {
    const d = aufbau(["fehler", "ok"]);
    const { gid, jobId } = await vorbereitet(d);
    const erst = await d.dienst.uebergib(wer, gid, jobId);
    expect(erst.sicht.job).toMatchObject({ status: "fehler", sendungen: 1 });
    const ohne = await d.dienst.uebergib(wer, gid, jobId);
    expect(ohne.gesendet).toBe(false);
    expect(d.aufrufe).toHaveLength(1);
    const mit = await d.dienst.uebergib(wer, gid, jobId, { erneutSendenBestaetigt: true });
    expect(mit.sicht.job).toMatchObject({ status: "antwort_erhalten", sendungen: 2 });
    expect(d.aufrufe).toHaveLength(2);
  });

  it("ein Rechteentzug vor der Übergabe ruft den Anbieter gar nicht", async () => {
    const d = aufbau(["ok"]);
    const { gid, jobId } = await vorbereitet(d);
    const ohneRecht = { user, sichtbar: () => false };
    await expect(d.dienst.uebergib(ohneRecht, gid, jobId)).rejects.toMatchObject({
      grund: "paket_veraltet",
    });
    expect(d.aufrufe).toEqual([]);
  });
});
