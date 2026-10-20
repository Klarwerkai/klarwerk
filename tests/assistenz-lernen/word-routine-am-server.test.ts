// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 Nacharbeit 41 — DIE WORD-ROUTINE ÜBER
// DEN INTEGRIERTEN PROGRAMMADAPTER (BPA-04), P06, AKTIONSKERN UND ZEITSTEUERUNG.
// ================================================================================================
//
// Bens Befund zu 32e10b9d: „Der Routine-Ausführungsweg unterstützt ausschließlich Klarwerk-Web und
// weist Word-Routinen ab. Der vorhandene BPA-04-Programmadapter ist nicht integriert.“ Am echten
// Server (`buildApp(buildServices())`), mit den vorhandenen Türen und fiktiven Konten:
//   W1 Ganzer Weg: in Word vormachen (P06), ausdrücklich an Word binden (gesiegelte Bindung aus
//      `/api/klara/programme/verbinden`), mit der Markierung laufen lassen → Entwurf über den
//      Aktionskern, am Server nachgelesen; dieselbe Anfrage noch einmal → kein zweiter Bericht.
//   W2 AC07: andere Hostfassung hält vor dem ersten Schritt; anderes Programm, anderes Dokument,
//      andere Markierung, falscher Text, gefälschtes Siegel, Kontowechsel → nichts entsteht.
//   W3 AC08: reine Beobachtungsrolle (ohne Anlagerecht) → 403, kein Bericht.
//   W4 AC06/Pause: Zugangsdaten in der Markierung werden nicht übernommen; pausiert läuft nichts.
//   W5 AC05: ein Word-Termin der vorhandenen Zeitsteuerung läuft nicht blind im Hintergrund,
//      sondern steht an, bis die Person ihn in Word mit ihrer Markierung startet — dann genau einmal.
//   W6 Die Prüfsumme des Servers ist die des Word-Fensters (`bpaPruefsumme`, taskpane.js).
//   W7 Nacharbeit 43 (AC02/AC03/AC08): Dokument- und Auswahlübernahme bleiben getrennt — die
//      Dokumentroutine übernimmt beide Abschnitte, die Auswahlroutine nur den markierten;
//      geändertes Dokument, falscher Text, fehlendes Dokument und Überlänge halten vor der Wirkung.
//   W8 Nacharbeit 43 (AC04/AC05): der Takt übergibt einen fälligen Termin an das ausdrücklich
//      freigegebene Word; dort läuft er ohne Klick, nur im gebundenen Dokument, genau einmal;
//      Pause, Handlauf als „automatisch“ und Rechteentzug wirken.
// Ein realer Word-Host ist hier NICHT beteiligt: das Fenster wird durch seine Serveranfragen
// vertreten. Die reale Hostprobe bleibt offen.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { wordPruefsumme } from "../../services/app/src/assistenz-lernen-word";
import type { ZeitplanLaufErgebnis } from "../../services/app/src/assistenz-lernen-zeitsteuerung";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { htmlToPlainText } from "../../services/structure";
import { baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { repoPfad } from "../support/repoPfad";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";
type Takt = (jetzt?: number) => Promise<ZeitplanLaufErgebnis[]>;
type Konto = { id: string; token: string };
type Laufantwort = { ergebnis: ZeitplanLaufErgebnis; pfad: string | null };
type Routinenkopf = { id: string; fassung: number };

let app: App;
let services: ReturnType<typeof buildServices>;
let takt: Takt;
let adminToken = "";
let erik: Konto;

const VORMACHEN = "/api/me/vormachen";
const MARKIERUNG = "Umsatz Region Nord stabil, zwei Neukunden, keine offenen Reklamationen.";
const TITEL = "Wochenbericht KW43 Musterfirma";
const FASSUNG_WORD = "Mac 16.0.17126";

function stillerPruefjob(): AiCheckWorker {
  const eingereiht = new Set<string>();
  return {
    enqueue: vi.fn((koId: string) => {
      eingereiht.add(koId);
    }),
    has: (koId) => eingereiht.has(koId),
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
}

const auf = (wer: string, methode: Methode, url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(name: string, email: string, role: string): Promise<Konto> {
  const angelegt = await auf(adminToken, "POST", "/api/users", {
    name,
    email,
    password: "secret123",
    role,
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

/** P06 in Word: markierten Text als Entwurf übernehmen (Herkunft `word_addin`), dann bestätigen. */
async function wordRoutineVormachen(wer: Konto): Promise<{ id: string; fassung: number }> {
  const start = await auf(wer.token, "POST", VORMACHEN, {
    host: "word",
    vorgaenge: ["word_auswahl_uebernehmen"],
    zweck: "Wochenbericht aus meiner Markierung in Word",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  // Das Word-Fenster zeigt den Lernzustand sichtbar an (P06-AC02).
  await auf(wer.token, "GET", `${VORMACHEN}?anzeige=word`);
  const demo = { title: "Wochenbericht KW41", statement: "Umsatz stabil", origin: "word_addin" };
  const angelegt = await auf(wer.token, "POST", "/api/drafts", demo);
  expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
  const v = await auf(wer.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  expect(v.statusCode, v.body).toBe(200);
  const vorschau = (v.json() as { vorschau: { stand: string; schritte: unknown[] } }).vorschau;
  expect(vorschau.schritte).toHaveLength(1);
  const b = await auf(wer.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
    stand: vorschau.stand,
  });
  expect(b.statusCode, b.body).toBe(201);
  return (b.json() as { routine: { id: string; fassung: number } }).routine;
}

/** Nacharbeit 43: synthetisches Dokument mit zwei unterscheidbaren Abschnitten. */
const ABSCHNITT_A = "Abschnitt A: Umsatz Region Nord stabil.";
const ABSCHNITT_B = "Abschnitt B: Lieferzeiten Region Süd verbessert.";
/** Wie das Word-Fenster `body.text` normalisiert: Absätze durch Zeilenumbruch getrennt. */
const DOKUMENT_TEXT = `${ABSCHNITT_A}\n${ABSCHNITT_B}`;

/**
 * P06 in Word: das GANZE Dokument als Entwurf übernehmen (`POST /api/drafts/from-docx` aus dem
 * Word-Fenster — Herkunftsseite `/word-addin/`), dann bestätigen.
 */
async function wordDokumentRoutineVormachen(wer: Konto): Promise<Routinenkopf> {
  const start = await auf(wer.token, "POST", VORMACHEN, {
    host: "word",
    vorgaenge: ["word_dokument_uebernehmen"],
    zweck: "Wochenbericht aus dem ganzen Word-Dokument",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  await auf(wer.token, "GET", `${VORMACHEN}?anzeige=word`);
  const { bytes } = await baueDocx([
    { art: "text", text: "Wochenbericht KW41" },
    { art: "text", text: "Umsatz stabil." },
  ]);
  const post = await app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    headers: {
      authorization: `Bearer ${wer.token}`,
      "content-type": "application/json",
      referer: "http://localhost/word-addin/taskpane.html",
    },
    payload: JSON.stringify({ name: "wochenbericht.docx", data: bytes.toString("base64") }),
  });
  expect(post.statusCode, post.body.slice(0, 200)).toBe(201);
  const v = await auf(wer.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  type Vorschau = { stand: string; schritte: { vorgang: string }[] };
  const vorschau = (v.json() as { vorschau: Vorschau }).vorschau;
  expect(vorschau.schritte.map((s) => s.vorgang)).toEqual(["word_dokument_uebernehmen"]);
  const b = await auf(wer.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
    stand: vorschau.stand,
  });
  expect(b.statusCode, b.body).toBe(201);
  return (b.json() as { routine: Routinenkopf }).routine;
}

/** Ziel mit getrennt gebundenem Umfang: `auswahl` = Markierung, `fassung` = ganzes Dokument. */
function zielUmfang(markierung: string, dokument: string, mehr: Record<string, string> = {}) {
  return { ...ziel(markierung), fassung: wordPruefsumme(dokument), ...mehr };
}

/** Was das Word-Fenster über sein aktuelles Ziel meldet (ohne Mandant und Nutzer). */
function ziel(text: string, mehr: Record<string, string> = {}) {
  return {
    programm: "word-mac",
    sitzung: "klara-sitzung-1",
    hostKonto: "",
    objekt: "dokument-1",
    auswahl: wordPruefsumme(text),
    fassung: "",
    ...mehr,
  };
}

/** BPA-04: die vom Server gesiegelte Bindung für dieses Ziel. */
async function verbinden(wer: Konto, z: Record<string, string>): Promise<string> {
  const r = await auf(wer.token, "POST", "/api/klara/programme/verbinden", { ziel: z });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { bindung: string }).bindung;
}

async function binden(wer: Konto, routine: string, hostVersion = FASSUNG_WORD) {
  const z = ziel(MARKIERUNG);
  const bindung = await verbinden(wer, z);
  return auf(wer.token, "PUT", `${VORMACHEN}/routinen/${routine}/host`, {
    bindung,
    aktuell: z,
    hostVersion,
  });
}

async function wordLauf(
  wer: Konto,
  routine: { id: string; fassung: number },
  lauf: string,
  host: Record<string, unknown>,
  eingaben: Record<string, string> = { titel: TITEL },
) {
  return auf(wer.token, "POST", `${VORMACHEN}/routinen/${routine.id}/word-lauf`, {
    lauf,
    fassung: routine.fassung,
    eingaben,
    host,
  });
}

/** Der gewöhnliche Host: gebunden an die Markierung, unverändert, dieselbe Hostfassung. */
async function hostBlock(wer: Konto, mehr: Record<string, unknown> = {}) {
  const z = ziel(MARKIERUNG);
  return {
    bindung: await verbinden(wer, z),
    aktuell: z,
    hostVersion: FASSUNG_WORD,
    markierung: MARKIERUNG,
    ...mehr,
  };
}

async function berichte(wer: Konto, titel: string): Promise<number> {
  const r = await auf(wer.token, "GET", "/api/drafts");
  expect(r.statusCode, r.body).toBe(200);
  const entwuerfe = r.json() as { payload?: { title?: string } }[];
  return entwuerfe.filter((d) => d.payload?.title === titel).length;
}

beforeEach(async () => {
  services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services, {
    routinenZeitsteuerung: (lauf) => {
      takt = lauf;
    },
  });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@bpa06-word.test", password: "secret123" },
  });
  adminToken = await anmelden("admin@bpa06-word.test");
  erik = await konto("Fiktiv Erik", "erik@bpa06-word.test", "experte");
});

describe("BPA-06 Nacharbeit 41 · Word-Routine über den Programmadapter", () => {
  it("W1 · in Word vormachen, binden, mit der Markierung laufen: ein nachgelesener Bericht", async () => {
    const routine = await wordRoutineVormachen(erik);

    // Ohne Word-Kontext läuft eine Word-Routine nicht — auch nicht über den Klarwerk-Laufweg.
    const ohneHost = await auf(erik.token, "POST", `${VORMACHEN}/routinen/${routine.id}/lauf`, {
      gespraech: "g",
      lauf: "web-1",
      fassung: routine.fassung,
      eingaben: { titel: TITEL },
    });
    expect(ohneHost.statusCode, ohneHost.body).toBe(409);
    expect(ohneHost.json()).toMatchObject({ grund: "host_fehlt" });
    // Ungebunden (keine Hostfassung bestätigt): nichts entsteht.
    const ungebunden = await wordLauf(erik, routine, "word-0", await hostBlock(erik));
    expect(ungebunden.statusCode, ungebunden.body).toBe(409);
    expect((ungebunden.json() as Laufantwort).ergebnis).toMatchObject({
      stand: "abgelehnt",
      grund: "host_nicht_gebunden",
    });

    const gebunden = await binden(erik, routine.id);
    expect(gebunden.statusCode, gebunden.body).toBe(200);
    expect((gebunden.json() as { routine: { hostbindung: unknown } }).routine.hostbindung).toEqual({
      programm: "word-mac",
      hostVersion: FASSUNG_WORD,
      objekt: "dokument-1",
      // Ohne ausdrückliche Wahl laufen fällige Termine NICHT ohne Klick (Nacharbeit 43).
      zeitplanImHost: false,
      am: expect.any(String),
    });

    const r = await wordLauf(erik, routine, "word-1", await hostBlock(erik));
    expect(r.statusCode, r.body).toBe(201);
    const { ergebnis, pfad } = r.json() as Laufantwort;
    expect(ergebnis).toMatchObject({ stand: "ausgefuehrt", termin: "word-1" });
    expect(ergebnis.abweichungen).toBeUndefined();
    expect(pfad).toBe(`/erfassen?draft=${ergebnis.ergebnisId ?? ""}`);

    // Tatsächliche Wirkung mit der eigenen Anmeldung nachgelesen: Titel aus der Eingabe, Inhalt
    // genau die gebundene Markierung.
    const gelesen = await auf(erik.token, "GET", `/api/drafts/${ergebnis.ergebnisId ?? ""}`);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const entwurf = gelesen.json() as { payload: { title?: string; statement?: string } };
    expect(entwurf.payload.title).toBe(TITEL);
    expect(entwurf.payload.statement).toBe(MARKIERUNG);

    // Derselbe Lauf noch einmal (z. B. Antwort verloren): kein zweiter Bericht.
    const nochmal = await wordLauf(erik, routine, "word-1", await hostBlock(erik));
    expect(nochmal.statusCode, nochmal.body).toBe(201);
    expect((nochmal.json() as Laufantwort).ergebnis.ergebnisId).toBe(ergebnis.ergebnisId);
    expect(await berichte(erik, TITEL)).toBe(1);
    // Dieselbe Kennung mit anderer Markierung ist ein Widerspruch, keine Wiederaufnahme.
    const anders = "Ganz anderer Absatz.";
    const zAnders = ziel(anders);
    const widerspruch = await wordLauf(erik, routine, "word-1", {
      bindung: await verbinden(erik, zAnders),
      aktuell: zAnders,
      hostVersion: FASSUNG_WORD,
      markierung: anders,
    });
    expect(widerspruch.statusCode, widerspruch.body).toBe(409);
    expect((widerspruch.json() as Laufantwort).ergebnis.grund).toBe("lauf_widerspricht");
    expect(await berichte(erik, TITEL)).toBe(1);

    // Prüfprotokoll: Ereignis und Kennungen, nie Titel oder Markierung.
    const ereignisse = await services.audit.list({ action: "bpa06.hostlauf" });
    expect(ereignisse.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(ereignisse)).not.toContain(MARKIERUNG);
    expect(JSON.stringify(ereignisse)).not.toContain(TITEL);
  });

  it("W2 · AC07: Hostfassung, Programm, Dokument, Markierung, Siegel, Konto — nichts entsteht", async () => {
    const routine = await wordRoutineVormachen(erik);
    expect((await binden(erik, routine.id)).statusCode).toBe(200);

    // Andere Hostfassung (Word-Update): hält VOR dem ersten Schritt, nachvollziehbarer Grund.
    const update = await wordLauf(
      erik,
      routine,
      "word-a",
      await hostBlock(erik, { hostVersion: "Mac 16.0.18000" }),
    );
    expect(update.statusCode, update.body).toBe(409);
    const halt = (update.json() as Laufantwort).ergebnis;
    expect(halt).toMatchObject({ stand: "abgelehnt", grund: "haelt_an" });
    expect(halt.text).toContain("Mac 16.0.17126 → Mac 16.0.18000");

    // Anderes Programm (Word im Browser statt Word für Mac).
    const zWeb = ziel(MARKIERUNG, { programm: "word-web" });
    const web = await wordLauf(erik, routine, "word-b", {
      bindung: await verbinden(erik, zWeb),
      aktuell: zWeb,
      hostVersion: FASSUNG_WORD,
      markierung: MARKIERUNG,
    });
    expect(web.statusCode, web.body).toBe(409);
    expect((web.json() as Laufantwort).ergebnis.grund).toBe("anderer_host");

    // Zwischen Bindung und Lauf ein anderes Dokument im Vordergrund.
    const fremdesDokument = await wordLauf(
      erik,
      routine,
      "word-c",
      await hostBlock(erik, { aktuell: ziel(MARKIERUNG, { objekt: "dokument-2" }) }),
    );
    expect(fremdesDokument.statusCode, fremdesDokument.body).toBe(409);
    expect(fremdesDokument.json()).toMatchObject({ grund: "anderes-dokument" });

    // Die Markierung hat sich geändert (aktuelle Prüfsumme ≠ gebundene).
    const andereMarkierung = await wordLauf(
      erik,
      routine,
      "word-d",
      await hostBlock(erik, { aktuell: ziel("Neu markiert") }),
    );
    expect(andereMarkierung.statusCode, andereMarkierung.body).toBe(409);
    expect(andereMarkierung.json()).toMatchObject({ grund: "auswahl-geaendert" });

    // Bindung stimmt, aber der mitgeschickte Text ist nicht die gebundene Markierung.
    const falscherText = await wordLauf(
      erik,
      routine,
      "word-e",
      await hostBlock(erik, { markierung: `${MARKIERUNG} Und noch ein Satz.` }),
    );
    expect(falscherText.statusCode, falscherText.body).toBe(409);
    expect(falscherText.json()).toMatchObject({ grund: "auswahl-geaendert" });

    // Gefälschtes oder fehlendes Siegel: keine Bindung.
    const gefaelscht = await wordLauf(
      erik,
      routine,
      "word-f",
      await hostBlock(erik, { bindung: "eyJmYWxzY2gi.fremd" }),
    );
    expect(gefaelscht.statusCode, gefaelscht.body).toBe(409);
    expect(gefaelscht.json()).toMatchObject({ grund: "host-getrennt" });

    // Kontowechsel: Eriks Bindung unter Annas Anmeldung.
    const anna = await konto("Fiktiv Anna", "anna@bpa06-word.test", "experte");
    const z = ziel(MARKIERUNG);
    const fremd = await auf(anna.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/host`, {
      bindung: await verbinden(erik, z),
      aktuell: z,
      hostVersion: FASSUNG_WORD,
    });
    expect(fremd.statusCode, fremd.body).toBe(409);
    expect(fremd.json()).toMatchObject({ grund: "konto-gewechselt" });

    expect(await berichte(erik, TITEL)).toBe(0);
  });

  it("W3 · AC08: Beobachtungsrolle ohne Anlagerecht — 403, kein Bericht", async () => {
    const routine = await wordRoutineVormachen(erik);
    expect((await binden(erik, routine.id)).statusCode).toBe(200);
    const rolle = await auf(adminToken, "PUT", `/api/users/${erik.id}`, { role: "viewer" });
    expect(rolle.statusCode, rolle.body).toBe(200);
    // Mit der Anmeldung nach dem Rollenwechsel (die Rolle gilt JETZT).
    erik = { ...erik, token: await anmelden("erik@bpa06-word.test") };
    const r = await wordLauf(erik, routine, "word-v", await hostBlock(erik));
    expect(r.statusCode, r.body).toBe(403);
    expect((r.json() as Laufantwort).ergebnis).toMatchObject({
      stand: "abgelehnt",
      grund: "nur_beobachtung",
    });
    // Die Beobachtungsrolle darf die Entwurfsliste selbst nicht lesen (403); gezählt wird deshalb
    // nach Rückgabe des Anlagerechts — mit frischer Anmeldung. Es darf kein Bericht entstanden sein.
    const zurueck = await auf(adminToken, "PUT", `/api/users/${erik.id}`, { role: "experte" });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    erik = { ...erik, token: await anmelden("erik@bpa06-word.test") };
    expect(await berichte(erik, TITEL)).toBe(0);
  });

  it("W4 · AC06/Pause: Zugangsdaten in der Markierung nicht übernommen; pausiert läuft nichts", async () => {
    const routine = await wordRoutineVormachen(erik);
    expect((await binden(erik, routine.id)).statusCode).toBe(200);

    const token = ["eyJ", "a".repeat(8), ".", "b".repeat(8), ".", "c".repeat(8)].join("");
    const zGeheim = ziel(token);
    const geheim = await wordLauf(erik, routine, "word-g", {
      bindung: await verbinden(erik, zGeheim),
      aktuell: zGeheim,
      hostVersion: FASSUNG_WORD,
      markierung: token,
    });
    expect(geheim.statusCode, geheim.body).toBe(409);
    expect((geheim.json() as Laufantwort).ergebnis.grund).toBe("zugangsdaten_als_eingabe");
    expect(geheim.body).not.toContain(token);

    const pause = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zustand`, {
      zustand: "pausiert",
    });
    expect(pause.statusCode, pause.body).toBe(200);
    const pausiert = await wordLauf(erik, routine, "word-p", await hostBlock(erik));
    expect(pausiert.statusCode, pausiert.body).toBe(409);
    expect(pausiert.json()).toMatchObject({ grund: "pausiert" });
    expect(await berichte(erik, TITEL)).toBe(0);
  });

  it("W5 · AC05: Word-Termin steht an, bis er in Word gestartet wird — dann genau einmal", async () => {
    const routine = await wordRoutineVormachen(erik);
    expect((await binden(erik, routine.id)).statusCode).toBe(200);
    const plan = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zeitplan`, {
      zeitplan: { art: "sofort" },
      eingaben: { titel: TITEL },
    });
    expect(plan.statusCode, plan.body).toBe(200);

    // Der Takt der vorhandenen Zeitsteuerung führt ihn nicht blind aus: hinter ihm steht kein Word.
    // Ohne Freigabe beim Binden wartet der Termin auf den Start — nachvollziehbar, EINMAL gemeldet.
    const [warten, ...mehr] = await takt(Date.now());
    expect(mehr).toEqual([]);
    expect(warten).toMatchObject({
      routineId: routine.id,
      stand: "wartet_auf_host",
      grund: "wartet_auf_start",
    });
    expect(await takt(Date.now() + 60_000)).toEqual([]);
    expect(await services.audit.list({ action: "bpa06.zeitplan.wartet" })).toHaveLength(1);
    const liste = await auf(erik.token, "GET", `${VORMACHEN}/word-routinen`);
    expect(liste.statusCode, liste.body).toBe(200);
    type Eintrag = { id: string; anstehend: string | null; uebergabe: string };
    const [eintrag] = (liste.json() as { routinen: Eintrag[] }).routinen;
    expect(eintrag?.id).toBe(routine.id);
    expect(eintrag?.uebergabe).toBe("von_hand");
    const termin = eintrag?.anstehend ?? "";
    expect(termin).toMatch(/^zeitplan-sofort-/);
    expect(warten?.termin).toBe(termin);

    // Eine erfundene Terminkennung läuft nicht.
    const erfunden = await wordLauf(erik, routine, "zeitplan-w-2026-01-05", await hostBlock(erik));
    expect(erfunden.statusCode, erfunden.body).toBe(409);
    expect(erfunden.json()).toMatchObject({ grund: "termin_nicht_anstehend" });

    // In Word gestartet: Titel aus dem Zeitplan (die Eingabe des Fensters zählt hier nicht).
    const r = await wordLauf(erik, routine, termin, await hostBlock(erik), { titel: "Anders" });
    expect(r.statusCode, r.body).toBe(201);
    const { ergebnis } = r.json() as Laufantwort;
    expect(ergebnis).toMatchObject({ stand: "ausgefuehrt", termin });
    expect(await berichte(erik, TITEL)).toBe(1);
    expect(await berichte(erik, "Anders")).toBe(0);

    // Erledigt: steht nicht mehr an, der Takt bleibt leer.
    const danach = await auf(erik.token, "GET", `${VORMACHEN}/word-routinen`);
    const [weiter] = (danach.json() as { routinen: { anstehend: string | null }[] }).routinen;
    expect(weiter?.anstehend).toBeNull();
    expect(await takt(Date.now() + 60_000)).toEqual([]);
    expect((await services.audit.list({ action: "bpa06.zeitplan.lauf" })).length).toBe(1);
  });

  it("W7 · Nacharbeit 43: Dokumentroutine übernimmt das GANZE Dokument, Auswahlroutine nur die Markierung", async () => {
    const auswahl = await wordRoutineVormachen(erik);
    const dokumentRoutine = await wordDokumentRoutineVormachen(erik);
    expect((await binden(erik, auswahl.id)).statusCode).toBe(200);
    expect((await binden(erik, dokumentRoutine.id)).statusCode).toBe(200);
    const liste = await auf(erik.token, "GET", `${VORMACHEN}/word-routinen`);
    type Eintrag = { id: string; umfaenge: string[] };
    const eintraege = (liste.json() as { routinen: Eintrag[] }).routinen;
    const umfangVon = (id: string) => eintraege.find((e) => e.id === id)?.umfaenge;
    expect(umfangVon(auswahl.id)).toEqual(["markierung"]);
    expect(umfangVon(dokumentRoutine.id)).toEqual(["dokument"]);

    // Synthetisches Dokument mit zwei Abschnitten; markiert ist nur Abschnitt A.
    const z = zielUmfang(ABSCHNITT_A, DOKUMENT_TEXT);
    const host = async (mehr: Record<string, unknown> = {}) => ({
      bindung: await verbinden(erik, z),
      aktuell: z,
      hostVersion: FASSUNG_WORD,
      markierung: ABSCHNITT_A,
      dokument: DOKUMENT_TEXT,
      ...mehr,
    });
    const titelDok = "Wochenbericht ganzes Dokument";
    const titelAuswahl = "Wochenbericht Markierung";
    const hostDok = await host();
    const dok = await wordLauf(erik, dokumentRoutine, "word-dok-1", hostDok, { titel: titelDok });
    expect(dok.statusCode, dok.body).toBe(201);
    const hostSel = await host();
    const sel = await wordLauf(erik, auswahl, "word-sel-1", hostSel, { titel: titelAuswahl });
    expect(sel.statusCode, sel.body).toBe(201);
    // Nacharbeit 45: der Volltext steht im Körper (wie beim Word-Ganzdokumentweg); die Kernaussage
    // ist sein kanonischer erster Satzteil (Leerraum gefaltet, höchstens 500 Zeichen).
    type Gelesen = { payload: { statement?: string; bodyHtml?: string } };
    const lies = async (antwort: { json: () => unknown }) => {
      const id = (antwort.json() as Laufantwort).ergebnis.ergebnisId ?? "";
      const r = await auf(erik.token, "GET", `/api/drafts/${id}`);
      const { payload } = r.json() as Gelesen;
      const koerper = htmlToPlainText(payload.bodyHtml ?? "");
      return { aussage: payload.statement ?? "", koerper };
    };
    // Dokument: beide Abschnitte. Auswahl: nur der markierte.
    const dokInhalt = await lies(dok);
    expect(dokInhalt.koerper).toContain(ABSCHNITT_A);
    expect(dokInhalt.koerper).toContain(ABSCHNITT_B);
    const selInhalt = await lies(sel);
    expect(selInhalt.koerper).toBe(ABSCHNITT_A);
    expect(selInhalt.aussage).toBe(ABSCHNITT_A);
    expect(selInhalt.koerper).not.toContain(ABSCHNITT_B);

    // Ein Dokument über der Grenze einer Kernaussage (500) kommt VOLLSTÄNDIG an — nichts gekürzt.
    const absatzC = "Abschnitt C: Logistik und Einkauf ausführlich beschrieben.";
    const absaetzeC = Array.from({ length: 60 }, (_, i) => `${absatzC} ${i}`);
    const mittel = [DOKUMENT_TEXT, ...absaetzeC].join("\n");
    expect(mittel.length).toBeGreaterThan(2_000);
    const zMittel = zielUmfang(ABSCHNITT_A, mittel);
    const hostMittel = {
      bindung: await verbinden(erik, zMittel),
      aktuell: zMittel,
      hostVersion: FASSUNG_WORD,
      dokument: mittel,
    };
    const langerBericht = { titel: "Langer Wochenbericht" };
    const ganz = await wordLauf(erik, dokumentRoutine, "word-dok-6", hostMittel, langerBericht);
    expect(ganz.statusCode, ganz.body).toBe(201);
    const ganzGelesen = await lies(ganz);
    expect(ganzGelesen.koerper).toBe(mittel.replace(/\s+/g, " "));
    expect(ganzGelesen.koerper).toContain(`${absatzC} 59`);
    expect(ganzGelesen.aussage.length).toBeLessThanOrEqual(500);

    // Ohne Dokumenttext läuft die Dokumentroutine nicht — die Markierung ersetzt ihn nicht.
    const titel = { titel: titelDok };
    const ohneDokHost = await host({ dokument: undefined });
    const ohneDok = await wordLauf(erik, dokumentRoutine, "word-dok-2", ohneDokHost, titel);
    expect(ohneDok.statusCode, ohneDok.body).toBe(400);
    // Dokument zwischen Bindung und Wirkung geändert: Fassung der Bindung weicht ab.
    const geaendert = `${DOKUMENT_TEXT}\nAbschnitt C: nachträglich eingefügt.`;
    const zNeu = zielUmfang(ABSCHNITT_A, geaendert);
    const hostVeraendert = {
      bindung: await verbinden(erik, z),
      aktuell: zNeu,
      hostVersion: FASSUNG_WORD,
      dokument: geaendert,
    };
    const veraendert = await wordLauf(erik, dokumentRoutine, "word-dok-3", hostVeraendert, titel);
    expect(veraendert.statusCode, veraendert.body).toBe(409);
    expect(veraendert.json()).toMatchObject({ grund: "fassung-geaendert" });
    // Bindung stimmt, aber der mitgeschickte Text ist nicht das gebundene Dokument.
    const hostFalsch = await host({ dokument: geaendert });
    const falsch = await wordLauf(erik, dokumentRoutine, "word-dok-4", hostFalsch, titel);
    expect(falsch.statusCode, falsch.body).toBe(409);
    expect(falsch.json()).toMatchObject({ grund: "fassung-geaendert" });
    // Ein Dokument, das ein Entwurf nicht ganz aufnimmt, hält VOR der Wirkung verständlich an.
    // Nacharbeit 45: die Grenze ist die des Volltexts (20 000 Zeichen), nicht die der Kernaussage.
    const lang = `${DOKUMENT_TEXT}\n${"Abschnitt D: sehr ausführlich. ".repeat(700)}`.trim();
    expect(lang.length).toBeGreaterThan(20_000);
    const zLang = zielUmfang(ABSCHNITT_A, lang);
    const hostLang = {
      bindung: await verbinden(erik, zLang),
      aktuell: zLang,
      hostVersion: FASSUNG_WORD,
      dokument: lang,
    };
    const zuLang = await wordLauf(erik, dokumentRoutine, "word-dok-5", hostLang, {
      titel: "Zu lang",
    });
    expect(zuLang.statusCode, zuLang.body).toBe(409);
    expect(zuLang.json()).toMatchObject({ grund: "dokument_nicht_unterstuetzt" });
    expect((zuLang.json() as { message: string }).message).toContain("Gekürzt wird nicht");
    expect(await berichte(erik, "Zu lang")).toBe(0);
    expect(await berichte(erik, titelDok)).toBe(1);
  });

  it("W8 · Nacharbeit 43: fälliger Termin geht an das freigegebene Word und läuft ohne Klick", async () => {
    const routine = await wordRoutineVormachen(erik);
    const z = ziel(MARKIERUNG);
    const gebunden = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/host`, {
      bindung: await verbinden(erik, z),
      aktuell: z,
      hostVersion: FASSUNG_WORD,
      zeitplanImHost: true,
    });
    expect(gebunden.statusCode, gebunden.body).toBe(200);
    const plan = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zeitplan`, {
      zeitplan: { art: "sofort" },
      eingaben: { titel: TITEL },
    });
    expect(plan.statusCode, plan.body).toBe(200);

    // Der Takt übergibt den fälligen Termin an den Host — nachvollziehbar und einmal gemeldet.
    const [uebergeben] = await takt(Date.now());
    expect(uebergeben).toMatchObject({ stand: "wartet_auf_host", grund: "an_host_uebergeben" });
    expect(await takt(Date.now() + 60_000)).toEqual([]);
    type Sicht = { anstehend: string | null; uebergabe: string | null };
    const sicht = async (): Promise<Sicht | undefined> => {
      const r = await auf(erik.token, "GET", `${VORMACHEN}/word-routinen`);
      return (r.json() as { routinen: Sicht[] }).routinen[0];
    };
    const laufen = (rumpf: Record<string, unknown>) =>
      auf(erik.token, "POST", `${VORMACHEN}/routinen/${routine.id}/word-lauf`, rumpf);
    expect(await sicht()).toMatchObject({ uebergabe: "automatisch" });

    // Anderes Dokument im Vordergrund: ohne Klick läuft dort nichts.
    const zFremd = ziel(MARKIERUNG, { objekt: "dokument-2" });
    const kennung1 = (await sicht())?.anstehend ?? "";
    const fremd = await laufen({
      lauf: kennung1,
      fassung: routine.fassung,
      automatisch: true,
      host: {
        bindung: await verbinden(erik, zFremd),
        aktuell: zFremd,
        hostVersion: FASSUNG_WORD,
        markierung: MARKIERUNG,
      },
    });
    expect(fremd.statusCode, fremd.body).toBe(409);
    expect(fremd.json()).toMatchObject({ grund: "anderes-dokument" });
    // Ein Handlauf darf sich nicht als „ohne Klick“ ausgeben.
    const keinTermin = await laufen({
      lauf: "word-hand",
      fassung: routine.fassung,
      automatisch: true,
      host: await hostBlock(erik),
    });
    expect(keinTermin.statusCode, keinTermin.body).toBe(409);
    expect(keinTermin.json()).toMatchObject({ grund: "nicht_freigegeben" });

    // Pause: nichts steht an, der Takt übergibt nichts.
    const zustand = (wert: string) =>
      auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zustand`, { zustand: wert });
    expect((await zustand("pausiert")).statusCode).toBe(200);
    expect(await sicht()).toMatchObject({ anstehend: null, uebergabe: null });
    expect(await takt(Date.now() + 120_000)).toEqual([]);
    expect((await zustand("aktiv")).statusCode).toBe(200);

    // Im gebundenen Dokument holt das Fenster den Termin ohne Klick ab: genau ein Bericht.
    const kennung2 = (await sicht())?.anstehend ?? "";
    expect(kennung2).toMatch(/^zeitplan-sofort-/);
    const hostJetzt = await hostBlock(erik);
    const lauf = await laufen({
      lauf: kennung2,
      fassung: routine.fassung,
      automatisch: true,
      eingaben: { titel: "nicht aus dem Fenster" },
      host: hostJetzt,
    });
    expect(lauf.statusCode, lauf.body).toBe(201);
    expect((lauf.json() as Laufantwort).ergebnis).toMatchObject({ termin: kennung2 });
    // Identische Wiederaufnahme: derselbe Bericht, kein zweiter.
    const nochmal = await laufen({
      lauf: kennung2,
      fassung: routine.fassung,
      automatisch: true,
      host: await hostBlock(erik),
    });
    expect(nochmal.statusCode, nochmal.body).toBe(201);
    expect((nochmal.json() as Laufantwort).ergebnis.ergebnisId).toBe(
      (lauf.json() as Laufantwort).ergebnis.ergebnisId,
    );
    expect(await berichte(erik, TITEL)).toBe(1);
    expect(await berichte(erik, "nicht aus dem Fenster")).toBe(0);
    expect(await sicht()).toMatchObject({ anstehend: null });

    // Rechteentzug: der nächste Termin wird abgelehnt (403), kein Bericht entsteht.
    expect((await zustand("pausiert")).statusCode).toBe(200);
    expect((await zustand("aktiv")).statusCode).toBe(200);
    const kennung3 = (await sicht())?.anstehend ?? "";
    const rolle = await auf(adminToken, "PUT", `/api/users/${erik.id}`, { role: "viewer" });
    expect(rolle.statusCode, rolle.body).toBe(200);
    erik = { ...erik, token: await anmelden("erik@bpa06-word.test") };
    const ohneRecht = await laufen({
      lauf: kennung3,
      fassung: routine.fassung,
      automatisch: true,
      host: await hostBlock(erik),
    });
    expect(ohneRecht.statusCode, ohneRecht.body).toBe(403);
    expect((ohneRecht.json() as Laufantwort).ergebnis.grund).toBe("nur_beobachtung");
  });

  it("W6 · dieselbe Prüfsumme wie das Word-Fenster (bpaPruefsumme)", () => {
    const js = readFileSync(repoPfad("apps/web/public/word-addin/lernziel.js"), "utf8");
    const start = js.indexOf("function bpaPruefsumme(text) {");
    expect(start).toBeGreaterThan(0);
    const ende = js.indexOf("\n    }\n", start) + "\n    }\n".length;
    const fenster = runInNewContext(`${js.slice(start, ende)}; bpaPruefsumme`) as (
      t: string,
    ) => string;
    for (const text of ["", "a", "foobar", MARKIERUNG, "  Zeile 1\r\nZeile 2\r  ", "Ä ö ü ß"]) {
      expect(wordPruefsumme(text), text).toBe(fenster(text));
    }
    // Feste Werte (FNV-1a 32 Bit) — die Regel selbst, nicht nur Gleichlauf.
    expect(wordPruefsumme("")).toBe("0:811c9dc5");
    expect(wordPruefsumme("a")).toBe("1:e40c292c");
    expect(wordPruefsumme("foobar")).toBe("6:bf9cf968");
  });
});
