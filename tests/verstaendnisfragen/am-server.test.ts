// ================================================================================================
// VERSTÄNDNISFRAGEN ZU EINER GÜLTIGEN FASSUNG · DER VORGANG AM SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`,
// `app.inject`) mit gestellter Uhr. Nur die Vorbereitung der Wissensfassungen (Überarbeiten,
// Gültigsetzen, Einstufen) läuft über die vorhandenen Dienste; jeder Schritt der Verständnisfragen
// selbst geht über HTTP. Getrennte, fiktive Beispieldaten — keine produktiven Konten oder Inhalte.
//
//   S1  (K15) Fragensatz zu V2: anlegen (Verantwortliche), vorlegen, nach Kontoregel annehmen,
//       Rollen zuordnen, bearbeiten (neue Version) — bestehende Lernpfade bleiben nutzbar.
//   S2  (K16) Ohne wörtliche Belegstelle keine Annahme; jede angenommene Frage hat richtige
//       Antwort, Erläuterung und Beleg der gebundenen Fassung.
//   S3  (K17) falscher, richtiger, unvollständiger Versuch nach der sichtbaren Regel; fehlt die
//       Quelle, entsteht keine Bewertung.
//   S4  (K18) Ergebnis und Rückmeldung nach „Neuladen" (neuer Abruf) erhalten; dieselbe Abgabe
//       zweimal (auch gleichzeitig) bleibt EIN Versuch; die Wiederholungsgrenze gilt.
//   S5  (K19) Änderungen von Fragen oder Quelle ändern keine historischen Ergebnisse; ein
//       Fragensatz mit fachlich geänderter Quelle ist erkennbar und erst nach Prüfung verwendbar.
//   S6  (K20) Lernende sehen nur eigene Ergebnisse; andere nur Zuständige; keine Rangliste;
//       unsichtbarer Eintrag → 404; die Selbstauskunft nennt die eigenen Ergebnisse.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";

const START = Date.parse("2026-10-11T08:00:00.000Z");

let jetzt = START;
let services: AppServices;
let app: App;
let admin = { id: "", token: "" };
let clara = { id: "", token: "" };
let erik = { id: "", token: "" };
let fiona = { id: "", token: "" };
let vera = { id: "", token: "" };
let wim = { id: "", token: "" };

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${admin.token}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: Methode, url: string, body?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });

const SATZ = "/api/verstaendnisfragen";

const V1_TEXT = "Vor dem Einschalten wird das Sicherheitsventil von Hand angelüftet.";
const V2_TEXT = `${V1_TEXT} Der Prüfdruck beträgt 11 bar; das Ergebnis steht im Prüfbuch.`;
const V3_TEXT = `${V1_TEXT} Der Prüfdruck beträgt 12 bar; das Ergebnis steht im Prüfbuch.`;

/** Ein Eintrag, den Erik (Experte) verantwortet, mit GÜLTIGER Fassung V2. */
async function eintragV2(): Promise<string> {
  const angelegt = await auf(erik.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: "Druckluftbehälter vor Inbetriebnahme prüfen (Beispiel)",
    statement: V1_TEXT,
    type: "best_practice",
    category: "Instandhaltung Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  const v2 = await services.ko.revise(id, { statement: V2_TEXT }, erik.id);
  expect(v2.version).toBe(2);
  const gueltig = await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  expect(gueltig.status).toBe("validiert");
  return id;
}

/** Überarbeitet den Eintrag fachlich und setzt die neue Fassung gültig. */
async function neueGueltigeFassung(id: string, satz: string): Promise<number> {
  const ko = await services.ko.revise(id, { statement: satz }, erik.id);
  await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  return ko.version;
}

const F1 = {
  text: "Was wird vor dem Einschalten von Hand angelüftet?",
  optionen: ["Das Sicherheitsventil", "Der Kompressor", "Die Leitung"],
  richtig: [0],
  erlaeuterung: "Die Anweisung nennt ausdrücklich das Sicherheitsventil.",
  beleg: "das Sicherheitsventil von Hand angelüftet",
};
const F2 = {
  text: "Wie hoch ist der Prüfdruck?",
  optionen: ["6 bar", "11 bar"],
  richtig: [1],
  erlaeuterung: "Fassung 2 nennt 11 bar.",
  beleg: "Der Prüfdruck beträgt 11 bar",
};
const F3 = {
  text: "Wo steht das Ergebnis?",
  optionen: ["Im Prüfbuch", "Auf dem Behälter", "Nirgends"],
  richtig: [0],
  erlaeuterung: "Das Ergebnis steht im Prüfbuch.",
  beleg: "das Ergebnis steht im Prüfbuch",
};

function inhalt(teil: Record<string, unknown> = {}) {
  return {
    koVersion: 2,
    titel: "Druckluft vor Inbetriebnahme · Verständnis",
    rollen: ["viewer"],
    regel: { mindestRichtig: 2, hoechstVersuche: 3 },
    fragen: [F1, F2, F3],
    ...teil,
  };
}

interface Fassung {
  id: string;
  version: number;
  koVersion: number;
  status: string;
  fragen: Array<{ id: string; richtig: string[]; erlaeuterung: string; beleg: string }>;
}
interface Bewertung {
  richtig: number;
  fragen: number;
  unbeantwortet: number;
  mindestRichtig: number;
  bestanden: boolean;
  unvollstaendig: boolean;
}
interface Rueck {
  versuchId: string;
  fragensatzVersion: number;
  koVersion: number;
  nummer: number;
  abgegebenAm: string;
  bewertung: Bewertung;
  fragen: Array<{ frageId: string; urteil: string; richtig: string[]; beleg: string | null }>;
  bereits?: boolean;
}
interface Satzsicht {
  id: string;
  gueltig: { version: number; koVersion: number; regel: unknown; fragen: unknown[] } | null;
  quellenlage: string | null;
  verbleibend: number | null;
  eigeneErgebnisse: Array<{ versuchId: string; bestanden: boolean }>;
  bearbeitung: { version: number; status: string; befunde: { satz: string[] } } | null;
}
interface Sicht {
  darfBearbeiten: boolean;
  darfEntscheiden: boolean;
  fragensaetze: Satzsicht[];
}

async function anlegen(wer: string, koId: string, body = inhalt()): Promise<Fassung> {
  const r = await auf(wer, "POST", `/api/kos/${koId}/verstaendnisfragen`, body);
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as Fassung;
}

const vorlegen = (wer: string, id: string, version: number) =>
  auf(wer, "POST", `${SATZ}/${id}/vorlegen`, { version });

const annehmen = (wer: string, id: string, version: number) =>
  auf(wer, "POST", `${SATZ}/${id}/entscheiden`, { version, entscheidung: "annehmen" });

const aendern = (wer: string, id: string, version: number, neu: unknown) =>
  auf(wer, "PUT", `${SATZ}/${id}`, { version, inhalt: neu });

const versuchLesen = (wer: string, versuchId: string) =>
  auf(wer, "GET", `${SATZ}/versuche/${versuchId}`);

/** Ein angenommener Fragensatz zu V2: Erik legt an und vor, Clara nimmt an. */
async function angenommenerSatz(koId: string, body = inhalt()): Promise<Fassung> {
  const f = await anlegen(erik.token, koId, body);
  expect((await vorlegen(erik.token, f.id, 1)).statusCode).toBe(200);
  const r = await annehmen(clara.token, f.id, 1);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Fassung;
}

async function sicht(wer: string, koId: string): Promise<Sicht> {
  const r = await auf(wer, "GET", `/api/kos/${koId}/verstaendnisfragen`);
  expect(r.statusCode).toBe(200);
  return r.json() as Sicht;
}

async function ersterSatz(wer: string, koId: string): Promise<Satzsicht | undefined> {
  return (await sicht(wer, koId)).fragensaetze[0];
}

let laufend = 0;
const neueId = (): string => `versuch-${++laufend}-beispiel`;

type Antworten = Array<{ frageId: string; gewaehlt: string[] }>;

const abgeben = (
  wer: string,
  id: string,
  version: number,
  antworten: Antworten,
  versuchId = neueId(),
) => auf(wer, "POST", `${SATZ}/${id}/versuche`, { versuchId, version, antworten });

const RICHTIG: Antworten = [
  { frageId: "f1", gewaehlt: ["o1"] },
  { frageId: "f2", gewaehlt: ["o2"] },
  { frageId: "f3", gewaehlt: ["o1"] },
];
const FALSCH: Antworten = [
  { frageId: "f1", gewaehlt: ["o2"] },
  { frageId: "f2", gewaehlt: ["o1"] },
  { frageId: "f3", gewaehlt: ["o1"] },
];
const UNVOLLSTAENDIG: Antworten = [
  { frageId: "f1", gewaehlt: ["o1"] },
  { frageId: "f2", gewaehlt: ["o2"] },
];

const grundVon = (r: { json(): unknown }): string => (r.json() as { grund: string }).grund;

beforeEach(async () => {
  jetzt = START;
  laufend = 0;
  services = assembleServices(inMemoryRepos(), { kenntnisnahmeUhr: () => jetzt });
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@verstaendnis.test", password: "secret123" },
  });
  admin = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@verstaendnis.test"),
  };
  clara = await konto("controller", "clara@verstaendnis.test", "Clara Controller");
  erik = await konto("experte", "erik@verstaendnis.test", "Erik Experte");
  fiona = await konto("experte", "fiona@verstaendnis.test", "Fiona Fachkraft");
  vera = await konto("viewer", "vera@verstaendnis.test", "Vera Viewer");
  wim = await konto("viewer", "wim@verstaendnis.test", "Wim Werker");
});

describe("S1 · Fragensatz zu V2: anlegen, nach Kontoregel annehmen, zuordnen, bearbeiten", () => {
  it("die verantwortliche Person legt an und vor; wer freigeben darf, nimmt an", async () => {
    const koId = await eintragV2();
    const f = await anlegen(erik.token, koId);
    expect(f).toMatchObject({ version: 1, koVersion: 2, status: "entwurf" });

    // Ohne Anlagerecht: das Tor. Mit Anlagerecht, aber ohne Verantwortung: der Dienst.
    const url = `/api/kos/${koId}/verstaendnisfragen`;
    expect((await auf(vera.token, "POST", url, inhalt())).statusCode).toBe(403);
    const fremd = await auf(fiona.token, "POST", url, inhalt());
    expect(fremd.statusCode).toBe(403);
    expect(grundVon(fremd)).toBe("nicht_verantwortlich");

    // Solange nichts angenommen ist, sehen Lernende den Fragensatz nicht.
    expect((await sicht(vera.token, koId)).fragensaetze).toEqual([]);

    // Erik hat kein Freigaberecht: er legt vor (freiwillige Zweitprüfung), entscheidet aber nicht.
    const vorgelegt = await vorlegen(erik.token, f.id, 1);
    expect(vorgelegt.statusCode).toBe(200);
    expect((vorgelegt.json() as Fassung).status).toBe("vorgelegt");
    expect((await annehmen(erik.token, f.id, 1)).statusCode).toBe(403);

    const angenommen = await annehmen(clara.token, f.id, 1);
    expect(angenommen.statusCode).toBe(200);
    expect((angenommen.json() as Fassung).status).toBe("angenommen");
    const protokoll = await services.audit.list();
    const beleg = protokoll.find((e) => e.action === "verstaendnisfragen.angenommen");
    expect(beleg?.actor).toBe(clara.id);
    expect(beleg?.target).toBe(koId);

    const satz = await ersterSatz(vera.token, koId);
    expect(satz?.gueltig).toMatchObject({ version: 1, koVersion: 2 });
    // Vor der Abgabe gehen weder richtige Antworten noch Erläuterung oder Beleg hinaus.
    const roh = JSON.stringify(satz?.gueltig);
    expect(roh).not.toContain('"richtig"');
    expect(roh).not.toContain("erlaeuterung");
    expect(roh).not.toContain("beleg");
    expect(satz?.bearbeitung).toBeNull();
  });

  it("direkte Annahme durch die berechtigte Person — ohne Vorlage", async () => {
    const koId = await eintragV2();
    const f = await anlegen(clara.token, koId);
    const r = await annehmen(clara.token, f.id, 1);
    expect(r.statusCode).toBe(200);
    expect((r.json() as Fassung).status).toBe("angenommen");
  });

  it("Zuordnung erscheint im Lernpfad der Rolle; Bearbeiten ergibt eine neue Version", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const meine = await auf(vera.token, "GET", `${SATZ}/meine`);
    expect(meine.statusCode).toBe(200);
    const saetze = (meine.json() as { fragensaetze: Array<Record<string, unknown>> }).fragensaetze;
    expect(saetze).toHaveLength(1);
    expect(saetze[0]).toMatchObject({ fragensatzId: f.id, koId, zugeordnet: true });
    expect(saetze[0]?.gueltigeVersion).toBe(1);
    // Fiona (Experte) ist nicht zugeordnet und hat nichts bearbeitet.
    const fionas = await auf(fiona.token, "GET", `${SATZ}/meine`);
    expect((fionas.json() as { fragensaetze: unknown[] }).fragensaetze).toEqual([]);

    const neu = inhalt({ rollen: ["viewer", "experte"], titel: "Druckluft · überarbeitet" });
    const geaendert = await aendern(erik.token, f.id, 1, neu);
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    expect(geaendert.json()).toMatchObject({ version: 2, status: "entwurf" });
    // Ein veralteter Stand überschreibt nichts.
    expect((await aendern(erik.token, f.id, 1, inhalt())).statusCode).toBe(409);
    // Lernende arbeiten weiter an der angenommenen Version 1.
    expect((await ersterSatz(vera.token, koId))?.gueltig?.version).toBe(1);
    const verantwortlich = await sicht(erik.token, koId);
    expect(verantwortlich.darfBearbeiten).toBe(true);
    expect(verantwortlich.fragensaetze[0]?.bearbeitung).toMatchObject({
      version: 2,
      status: "entwurf",
    });
  });

  it("bestehende Lernpfade bleiben nutzbar (anlegen, abrufen, abhaken)", async () => {
    const koId = await eintragV2();
    await angenommenerSatz(koId);
    const pfad = await auf(admin.token, "POST", "/api/learning-paths", {
      role: "viewer",
      steps: [{ title: "Druckluft-Anweisung lesen" }, { title: "Prüfbuch ansehen" }],
    });
    expect(pfad.statusCode).toBe(201);
    const p = pfad.json() as { id: string; steps: Array<{ id: string }> };
    expect((await auf(vera.token, "GET", "/api/learning-paths/viewer")).statusCode).toBe(200);
    const schritt = p.steps[0]?.id;
    const abgehakt = await auf(vera.token, "POST", `/api/learning-paths/${p.id}/complete`, {
      stepId: schritt,
    });
    expect(abgehakt.statusCode).toBe(200);
    expect(abgehakt.json()).toEqual([schritt]);
  });
});

describe("S2 · jede veröffentlichte Frage ist aus der gebundenen Fassung belegt", () => {
  it("ohne oder mit abweichender Belegstelle: Befund statt Annahme", async () => {
    const koId = await eintragV2();
    const fragen = [{ ...F1, beleg: "" }, { ...F2, beleg: "Der Prüfdruck beträgt 16 bar" }, F3];
    const f = await anlegen(clara.token, koId, inhalt({ fragen }));
    const r = await annehmen(clara.token, f.id, 1);
    expect(r.statusCode).toBe(409);
    const fehler = r.json() as {
      grund: string;
      befunde: { fragen: Array<{ frageId: string; befunde: string[] }> };
    };
    expect(fehler.grund).toBe("befunde");
    expect(fehler.befunde.fragen[0]?.befunde).toContain("beleg_fehlt");
    expect(fehler.befunde.fragen[1]?.befunde).toContain("beleg_nicht_in_quelle");
    expect(fehler.befunde.fragen[2]?.befunde).toEqual([]);
    // Vorlegen ist aus demselben Grund gesperrt — und Lernende sehen nichts.
    expect((await vorlegen(clara.token, f.id, 1)).statusCode).toBe(409);
    expect((await sicht(vera.token, koId)).fragensaetze).toEqual([]);
  });

  it("ohne richtige Antwort und ohne festgelegte Regel keine Annahme", async () => {
    const koId = await eintragV2();
    const regel = { mindestRichtig: 1, hoechstVersuche: 1 };
    const fragen = [{ ...F1, richtig: [] }];
    const ohneAntwort = await anlegen(clara.token, koId, inhalt({ fragen, regel }));
    expect((await annehmen(clara.token, ohneAntwort.id, 1)).statusCode).toBe(409);
    const ohneRegel = await anlegen(clara.token, koId, inhalt({ regel: {} }));
    const r = await annehmen(clara.token, ohneRegel.id, 1);
    expect(r.statusCode).toBe(409);
    expect(r.body).toContain("regel_fehlt");
  });

  it("die angenommene Fassung trägt je Frage Antwort, Erläuterung und Beleg zu V2", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    expect(f.koVersion).toBe(2);
    for (const frage of f.fragen) {
      expect(frage.richtig.length).toBeGreaterThan(0);
      expect(frage.erlaeuterung.length).toBeGreaterThan(0);
      expect(V2_TEXT).toContain(frage.beleg);
    }
    expect((await ersterSatz(erik.token, koId))?.bearbeitung?.befunde.satz).toEqual([]);
  });

  it("ein Fragensatz gehört zu einer GÜLTIGEN Fassung mit heutigem Inhalt", async () => {
    const koId = await eintragV2();
    // V1 trägt einen anderen Inhalt als die gültige V2.
    const url = `/api/kos/${koId}/verstaendnisfragen`;
    const alt = await auf(erik.token, "POST", url, inhalt({ koVersion: 1 }));
    expect(alt.statusCode).toBe(409);
    expect(grundVon(alt)).toBe("quelle_geaendert");
  });
});

describe("S3 · falsch, richtig, unvollständig — nach der sichtbaren Regel", () => {
  it("die Regel steht sichtbar da und wird genau so angewendet", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const satz = await ersterSatz(vera.token, koId);
    expect(satz?.gueltig?.regel).toEqual({ mindestRichtig: 2, hoechstVersuche: 3 });
    expect(satz?.verbleibend).toBe(3);

    const falsch = await abgeben(vera.token, f.id, 1, FALSCH);
    expect(falsch.statusCode).toBe(201);
    const rf = falsch.json() as Rueck;
    expect(rf.bewertung).toMatchObject({ richtig: 1, fragen: 3, bestanden: false });
    expect(rf.bewertung.unvollstaendig).toBe(false);
    expect(rf.fragen.map((x) => x.urteil)).toEqual(["falsch", "falsch", "richtig"]);
    // Nach der Abgabe nennt die Rückmeldung die richtige Antwort und die Belegstelle.
    expect(rf.fragen[0]).toMatchObject({ richtig: ["o1"], beleg: F1.beleg });

    const richtig = await abgeben(vera.token, f.id, 1, RICHTIG);
    expect((richtig.json() as Rueck).bewertung).toMatchObject({ richtig: 3, bestanden: true });

    const unvollstaendig = await abgeben(vera.token, f.id, 1, UNVOLLSTAENDIG);
    const ru = unvollstaendig.json() as Rueck;
    expect(ru.bewertung).toMatchObject({ richtig: 2, unbeantwortet: 1, bestanden: true });
    expect(ru.bewertung.unvollstaendig).toBe(true);
    expect(ru.fragen[2]?.urteil).toBe("unbeantwortet");
    expect(ru.nummer).toBe(3);
  });

  it("fehlt die Quelle, entsteht keine Bewertung", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const geloescht = await auf(admin.token, "DELETE", `/api/kos/${koId}`);
    expect(geloescht.statusCode).toBeLessThan(300);
    expect((await abgeben(vera.token, f.id, 1, RICHTIG)).statusCode).toBe(404);
    const meine = await auf(vera.token, "GET", `${SATZ}/meine`);
    expect((meine.json() as { fragensaetze: unknown[] }).fragensaetze).toEqual([]);
    expect(await services.verstaendnisfragen.versucheVon(vera.id)).toEqual([]);
  });

  it("eine unbekannte Antwortmöglichkeit wird abgewiesen, nicht als falsch gewertet", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const r = await abgeben(vera.token, f.id, 1, [{ frageId: "f1", gewaehlt: ["o9"] }]);
    expect(r.statusCode).toBe(400);
    expect(await services.verstaendnisfragen.versucheVon(vera.id)).toEqual([]);
  });
});

describe("S4 · Ergebnis bleibt; dieselbe Abgabe bleibt ein Versuch", () => {
  it("nach Neuladen derselbe Stand; Wiederholung derselben Abgabe legt nichts an", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const erste = await abgeben(vera.token, f.id, 1, FALSCH, "versuch-doppelklick-1");
    expect(erste.statusCode).toBe(201);
    const r1 = erste.json() as Rueck;

    const nochmal = await abgeben(vera.token, f.id, 1, RICHTIG, "versuch-doppelklick-1");
    expect(nochmal.statusCode).toBe(200);
    const r2 = nochmal.json() as Rueck;
    expect(r2.bereits).toBe(true);
    // Unverändert die ERSTE Bewertung — eine zweite Abgabe derselben Kennung ändert nichts.
    expect(r2.bewertung).toEqual(r1.bewertung);

    // „Neuladen": ein neuer Abruf liest denselben Versuch samt Rückmeldung.
    const gelesen = await versuchLesen(vera.token, "versuch-doppelklick-1");
    expect(gelesen.statusCode).toBe(200);
    const r3 = gelesen.json() as Rueck;
    expect(r3).toMatchObject({ versuchId: "versuch-doppelklick-1", nummer: 1 });
    expect(r3.abgegebenAm).toBe(r1.abgegebenAm);
    expect(r3.bewertung).toEqual(r1.bewertung);
    expect(r3.fragen).toEqual(r1.fragen);
    const satz = await ersterSatz(vera.token, koId);
    expect(satz?.eigeneErgebnisse).toHaveLength(1);
    expect(satz?.verbleibend).toBe(2);
  });

  it("gleichzeitiges Absenden derselben Abgabe ergibt genau einen Versuch", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const [a, b] = await Promise.all([
      abgeben(vera.token, f.id, 1, RICHTIG, "versuch-gleichzeitig-1"),
      abgeben(vera.token, f.id, 1, RICHTIG, "versuch-gleichzeitig-1"),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(await services.verstaendnisfragen.versucheVon(vera.id)).toHaveLength(1);
  });

  it("die festgelegte Wiederholungsgrenze gilt", async () => {
    const koId = await eintragV2();
    const regel = { mindestRichtig: 3, hoechstVersuche: 1 };
    const f = await angenommenerSatz(koId, inhalt({ regel }));
    expect((await abgeben(vera.token, f.id, 1, FALSCH)).statusCode).toBe(201);
    const zweiter = await abgeben(vera.token, f.id, 1, RICHTIG);
    expect(zweiter.statusCode).toBe(409);
    expect(grundVon(zweiter)).toBe("versuche_erschoepft");
  });

  it("eine fremde Versuchskennung wird nicht übernommen", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    await abgeben(vera.token, f.id, 1, FALSCH, "versuch-vera-1");
    const fremd = await abgeben(wim.token, f.id, 1, RICHTIG, "versuch-vera-1");
    expect(fremd.statusCode).toBe(409);
    expect(await services.verstaendnisfragen.versucheVon(wim.id)).toEqual([]);
  });
});

describe("S5 · Änderungen verändern keine historischen Ergebnisse", () => {
  it("geänderte Fragen: das frühere Ergebnis bleibt an Version 1 und unverändert", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const vorher = (await abgeben(vera.token, f.id, 1, RICHTIG, "versuch-historie-1")).json();

    // Neue Version mit anderem Fragensatz — angenommen.
    const fragen = [{ ...F1, text: "Welches Ventil wird angelüftet?" }, F2];
    expect((await aendern(erik.token, f.id, 1, inhalt({ fragen }))).statusCode).toBe(200);
    expect((await annehmen(clara.token, f.id, 2)).statusCode).toBe(200);

    const nachher = (await versuchLesen(vera.token, "versuch-historie-1")).json() as Rueck;
    expect(nachher.fragensatzVersion).toBe(1);
    expect(nachher.koVersion).toBe(2);
    expect(nachher.bewertung).toEqual((vorher as Rueck).bewertung);
    expect(nachher.fragen).toHaveLength(3);
    expect((await ersterSatz(vera.token, koId))?.gueltig?.version).toBe(2);
  });

  it("geänderte Quelle: erkennbar, erst nach Prüfung wieder bewertbar; Altes bleibt", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    const alt = (await abgeben(vera.token, f.id, 1, RICHTIG, "versuch-quelle-1")).json() as Rueck;

    // Eine reine Bestätigung (neue Versionsnummer, gleicher Inhalt) ist KEINE fachliche Änderung.
    await services.ko.revise(koId, {}, erik.id);
    await services.ko.setValidationState(koId, { trust: 80, status: "validiert" });
    expect((await ersterSatz(vera.token, koId))?.quellenlage).toBe("aktuell");

    // Fachliche Änderung: der Prüfdruck ändert sich.
    const neu = await neueGueltigeFassung(koId, V3_TEXT);
    expect((await ersterSatz(vera.token, koId))?.quellenlage).toBe("geaendert");
    const gesperrt = await abgeben(vera.token, f.id, 1, RICHTIG);
    expect(gesperrt.statusCode).toBe(409);
    expect(grundVon(gesperrt)).toBe("quelle_geaendert");
    expect(await services.verstaendnisfragen.versucheVon(vera.id)).toHaveLength(1);

    // Für die Zuständigen zur erneuten Prüfung gekennzeichnet; die alte Bindung ist nicht annehmbar.
    expect((await annehmen(clara.token, f.id, 1)).statusCode).toBe(409);
    const verantwortlich = await ersterSatz(erik.token, koId);
    expect(verantwortlich?.bearbeitung?.befunde.satz).toContain("quelle_geaendert");

    // Das frühere Ergebnis bleibt der historische Nachweis zu Fassung 2.
    const historie = (await versuchLesen(vera.token, "versuch-quelle-1")).json() as Rueck;
    expect(historie.koVersion).toBe(2);
    expect(historie.bewertung).toEqual(alt.bewertung);

    // Fachlich geprüft und an die aktuelle Fassung gebunden — dann wieder verwendbar.
    const f2neu = { ...F2, optionen: ["11 bar", "12 bar"], beleg: "Der Prüfdruck beträgt 12 bar" };
    const neuGefasst = inhalt({ koVersion: neu, fragen: [F1, f2neu, F3] });
    const geprueft = await aendern(erik.token, f.id, 1, neuGefasst);
    expect(geprueft.statusCode, geprueft.body).toBe(200);
    expect((await annehmen(clara.token, f.id, 2)).statusCode).toBe(200);
    expect((await ersterSatz(vera.token, koId))?.quellenlage).toBe("aktuell");
    const neuerVersuch = (await abgeben(vera.token, f.id, 2, RICHTIG)).json() as Rueck;
    expect(neuerVersuch).toMatchObject({ fragensatzVersion: 2, koVersion: neu, nummer: 1 });
    // Das alte Ergebnis wurde NICHT auf den neuen Stand übertragen.
    const eigene = await services.verstaendnisfragen.versucheVon(vera.id);
    expect(eigene.map((v) => [v.fragensatzVersion, v.koVersion])).toEqual([
      [1, 2],
      [2, neu],
    ]);
  });
});

describe("S6 · Ergebnisse: eigene für Lernende, andere nur für Zuständige", () => {
  it("Lernende sehen nur Eigenes; Zuständige eine Übersicht nach Namen", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    await abgeben(wim.token, f.id, 1, RICHTIG, "versuch-wim-1");
    await abgeben(vera.token, f.id, 1, FALSCH, "versuch-vera-2");

    const satz = await ersterSatz(vera.token, koId);
    expect(satz?.eigeneErgebnisse.map((e) => e.versuchId)).toEqual(["versuch-vera-2"]);
    expect((await versuchLesen(vera.token, "versuch-wim-1")).statusCode).toBe(404);
    const ergebnisse = `${SATZ}/${f.id}/ergebnisse`;
    expect((await auf(vera.token, "GET", ergebnisse)).statusCode).toBe(403);
    // Auch eine Expertin ohne Verantwortung am Eintrag ist nicht zuständig.
    expect((await auf(fiona.token, "GET", ergebnisse)).statusCode).toBe(403);

    for (const zustaendig of [erik.token, clara.token]) {
      const r = await auf(zustaendig, "GET", ergebnisse);
      expect(r.statusCode).toBe(200);
      const { versuche } = r.json() as {
        versuche: Array<{ person: { name: string }; bestanden: boolean }>;
      };
      // Vera (nicht bestanden) steht vor Wim (bestanden): nach Namen, nicht nach Ergebnis.
      expect(versuche.map((v) => v.person.name)).toEqual(["Vera Viewer", "Wim Werker"]);
      expect(versuche.map((v) => v.bestanden)).toEqual([false, true]);
    }
    expect((await versuchLesen(erik.token, "versuch-wim-1")).statusCode).toBe(200);
  });

  it("ein unsichtbarer Eintrag bleibt unsichtbar — auch seine Fragensätze", async () => {
    const koId = await eintragV2();
    await services.ko.setConfidentiality(koId, "vertraulich", erik.id);
    const url = `/api/kos/${koId}/verstaendnisfragen`;
    expect((await auf(vera.token, "GET", url)).statusCode).toBe(404);
    expect((await auf(erik.token, "GET", url)).statusCode).toBe(200);
  });

  it("die Selbstauskunft enthält die eigenen Ergebnisse", async () => {
    const koId = await eintragV2();
    const f = await angenommenerSatz(koId);
    await abgeben(vera.token, f.id, 1, RICHTIG, "versuch-auskunft-1");
    const auskunft = await auf(vera.token, "GET", "/api/me/daten");
    expect(auskunft.statusCode).toBe(200);
    const daten = auskunft.json() as {
      verstaendnisfragen: Array<{ versuchId: string; koFassung: number; bestanden: boolean }>;
      zaehlung: Record<string, number>;
    };
    expect(daten.verstaendnisfragen).toEqual([
      expect.objectContaining({ versuchId: "versuch-auskunft-1", koFassung: 2, bestanden: true }),
    ]);
    expect(daten.zaehlung.verstaendnisfragen).toBe(1);
  });
});
