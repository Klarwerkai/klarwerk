// ================================================================================================
// ARTIKEL-GEMEINSAM · DER GEMEINSAME ENTWURF AM SERVER (produkt:20261007:artikel-gemeinsam).
// ================================================================================================
//
// Gemessen an der ECHTEN Anwendung (`buildApp(buildServices())`, `app.inject`, Speicherablagen).
// Die Konten und Texte sind erfundene Testdaten:
//   Pedi  (admin)   — legt den Artikel an, darf freigeben
//   Anna  (experte) — bearbeitet
//   Bernd (experte) — bearbeitet
//   Vera  (viewer)  — liest nur
//
//   S1 (K1) Anna und Bernd kommen aus DEMSELBEN Artikelgespräch zum selben Artikel und öffnen
//           denselben Entwurf (Kennung, Arbeitsstand, Text). Vera bekommt keinen Entwurf (403).
//   S2 (K2) Gleichzeitiges Speichern an verschiedenen Abschnitten → beide Änderungen im Ergebnis,
//           auch wenn beide Anfragen parallel laufen. Derselbe Abschnitt → 409 mit Basis, eigener
//           und gespeicherter Fassung samt Urheber; gespeichert bleibt der vorherige Stand; die
//           gewählte Lösung lässt sich danach speichern.
//   S3 (K3) Bearbeitende (vorhandener Bearbeitungshinweis) und Speicherzustand (Arbeitsstand,
//           Zeitpunkt, Person) stehen in der Antwort.
//   S4 (K4) Während des Entwurfs liest jeder Leser die gültige Fassung unverändert. Erst die
//           Übernahme (bestehender Weg, `expectedVersion`) macht eine neue Fassung. Bei einem
//           freigegebenen Artikel wird ein Experte auf den Vorschlag verwiesen; die freigegebene
//           Fassung bleibt, bis jemand anders entscheidet.
//   S5 (K5) Verbindungsabbruch: ein späteres Speichern auf altem Arbeitsstand wird
//           zusammengeführt. Rechteentzug: 403, nichts geschrieben; nach Rückgabe des Rechts geht
//           die gehaltene Eingabe nicht verloren. Ändert sich die Lesefassung daneben, scheitert
//           die Übernahme mit `KO_STALE`, und das Angleichen führt zusammen.
//   S6 (K6) Historie und Zuständigkeit: neue Fassung trägt die übernehmende Person, frühere
//           Einträge bleiben, Autor und Verantwortung bleiben; der Entwurf nennt alle Beteiligten.
//           Eine neue Anmeldung liest das tatsächliche Ergebnis.
//   S7      Gegenprobe: ein Speichern ohne Zusammenführung (Basis = aktuell) würde Annas Änderung
//           still verlieren — die Prüfung aus S2 erkennt das.
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const KENNWORT = "secret123";
const TITEL = "Ventil X schließt bei Überdruck";
const A1 = "Bei Überdruck schließt Ventil X selbsttätig.";
const A2 = "Vorher den Druck über Ventil Y ablassen.";
const A3 = "Danach die Dichtheit prüfen.";
const TEXT = [A1, A2, A3].join("\n\n");

let app: App;
let pedi = "";
let anna = { id: "", token: "" };
let bernd = { id: "", token: "" };
let vera = { id: "", token: "" };

async function anmelden(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${pedi}` },
    payload: { name, email, password: KENNWORT, role: rolle },
  });
  expect(res.statusCode, res.body).toBe(201);
  return { id: (res.json() as { id: string }).id, token: await anmelden(email) };
}

function api(token: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}

async function artikel(): Promise<string> {
  const res = await api(pedi, "POST", "/api/kos", {
    confidentiality: "intern",
    title: TITEL,
    statement: TEXT,
    bodyHtml: `<p>${A1}</p><p>${A2}</p><p>${A3}</p>`,
    type: "best_practice",
    category: "Anlage 1",
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

interface Schritt {
  revision: number;
  name: string;
  eigen: boolean;
  art: string;
  fassung?: number;
}

interface Lage {
  entwurf: {
    id: string;
    revision: number;
    basisVersion: number;
    titel: string;
    text: string;
    geaendertAm: string;
    geaendertVon: string;
    beteiligte: string[];
    verlauf: Schritt[];
  } | null;
  abgeschlossen: { zustand: string; verlauf: Array<{ art: string; fassung?: number }> } | null;
  lesefassung: { version: number; status: string; titel: string; text: string; rumpf: string };
  weg: "direkt" | "vorschlag";
  uebernahme: {
    revision: number;
    basisVersion: number;
    aktuell: boolean;
    titelGeht: boolean;
    aenderung: { title: string; statement: string; bodyHtml?: string };
  } | null;
  zusammengefuehrt?: boolean;
}

const lage = async (token: string, koId: string): Promise<Lage> => {
  const res = await api(token, "GET", `/api/kos/${koId}/gemeinsam`);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Lage;
};

const speichern = (token: string, koId: string, basis: number, text: string, titel = TITEL) =>
  api(token, "PUT", `/api/kos/${koId}/gemeinsam`, { basisRevision: basis, titel, text });

const oeffnen = (token: string, koId: string) => api(token, "POST", `/api/kos/${koId}/gemeinsam`);

const ersetze = (alt: string, neu: string): string => TEXT.replace(alt, neu);
const letztes = <T>(liste: readonly T[]): T | undefined => liste[liste.length - 1];

/** Annas Änderung (erster Abschnitt) und Bernds Änderung (dritter Abschnitt). */
const A1_NEU = "Bei Überdruck schließt Ventil X selbsttätig und hörbar.";
const A3_NEU = "Danach die Dichtheit mit Lecksuchspray prüfen.";
const ANNAS = ersetze(A1, A1_NEU);
const BERNDS = ersetze(A3, A3_NEU);

/** Die Zusage von S2 als Funktion — damit S7 sie an einem blinden Speichern scheitern sieht. */
function pruefeBeideAenderungen(text: string): void {
  expect(text).toContain(A1_NEU);
  expect(text).toContain(A3_NEU);
  expect(text).toContain(A2);
}

beforeEach(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: KENNWORT },
  });
  pedi = await anmelden("pedi@klarwerk.test");
  anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
  bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");
  vera = await konto("viewer", "vera@klarwerk.test", "Vera Leser");
});

describe("S1 · aus dem Artikelgespräch zum selben Artikel und demselben Entwurf (K1)", () => {
  it("beide erreichen über das Gespräch denselben Artikel und dieselbe bearbeitete Fassung", async () => {
    const koId = await artikel();
    const artikelGespraech = { art: "artikel", koId };
    const beiAnna = await api(anna.token, "POST", "/api/chat/gespraeche", artikelGespraech);
    expect(beiAnna.statusCode, beiAnna.body).toBe(201);
    const gespraech = beiAnna.json() as { id: string; artikel: { koId: string; fassung: number } };
    const beiBernd = await api(bernd.token, "POST", "/api/chat/gespraeche", artikelGespraech);
    expect(beiBernd.statusCode).toBe(200);
    expect((beiBernd.json() as { id: string }).id).toBe(gespraech.id);
    // Der Artikelbezug des Gesprächs ist der Weg zum Entwurf — für beide derselbe.
    const gelesen = await api(bernd.token, "GET", `/api/chat/gespraeche/${gespraech.id}`);
    const artikelBezug = (gelesen.json() as { gespraech: { artikel: { koId: string } } }).gespraech
      .artikel;
    expect(artikelBezug.koId).toBe(koId);
    expect(gespraech.artikel.koId).toBe(koId);

    const geoeffnet = await oeffnen(anna.token, koId);
    expect(geoeffnet.statusCode, geoeffnet.body).toBe(201);
    const vonAnna = (geoeffnet.json() as Lage).entwurf;
    const zweitesOeffnen = await oeffnen(bernd.token, artikelBezug.koId);
    expect(zweitesOeffnen.statusCode).toBe(200);
    const vonBernd = (zweitesOeffnen.json() as Lage).entwurf;
    expect(vonBernd?.id).toBe(vonAnna?.id);
    expect(vonBernd?.revision).toBe(vonAnna?.revision);
    expect(vonBernd?.text).toBe(TEXT);

    // Anna speichert; Bernd liest beim nächsten Abruf genau diesen Stand.
    const gespeichert = await speichern(anna.token, koId, 1, ersetze(A3, "Danach dicht prüfen."));
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    const beiBerndJetzt = await lage(bernd.token, koId);
    expect(beiBerndJetzt.entwurf?.revision).toBe(2);
    expect(beiBerndJetzt.entwurf?.text).toBe(ersetze(A3, "Danach dicht prüfen."));

    // Vera liest nur: kein Entwurf, kein Anlegen. Ein unbekannter Artikel ist 404.
    expect((await api(vera.token, "GET", `/api/kos/${koId}/gemeinsam`)).statusCode).toBe(403);
    expect((await oeffnen(vera.token, koId)).statusCode).toBe(403);
    expect((await oeffnen(anna.token, "gibt-es-nicht")).statusCode).toBe(404);
  });

  it("ein vertraulicher Artikel verrät nicht einmal, dass es einen Entwurf gibt", async () => {
    const res = await api(pedi, "POST", "/api/kos", {
      confidentiality: "vertraulich",
      title: "Geheim",
      statement: "Nur für Pedi.",
      type: "best_practice",
      category: "",
    });
    const koId = (res.json() as { id: string }).id;
    expect((await oeffnen(pedi, koId)).statusCode).toBe(201);
    const fremd = await api(anna.token, "GET", `/api/kos/${koId}/gemeinsam`);
    expect(fremd.statusCode).toBe(404);
    expect(fremd.body).not.toContain("Nur für Pedi");
  });
});

describe("S2 · gleichzeitige Änderungen (K2)", () => {
  it("verschiedene Abschnitte: beide Änderungen stehen im Ergebnis — auch parallel", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    const [a, b] = await Promise.all([
      speichern(anna.token, koId, 1, ANNAS),
      speichern(bernd.token, koId, 1, BERNDS),
    ]);
    expect(a.statusCode, a.body).toBe(200);
    expect(b.statusCode, b.body).toBe(200);
    // Genau einer der beiden wurde zusammengeführt — der zweite.
    const zusammen = [a, b].map((r) => (r.json() as Lage).zusammengefuehrt);
    expect(zusammen.sort()).toEqual([false, true]);
    const amServer = await lage(pedi, koId);
    expect(amServer.entwurf?.revision).toBe(3);
    pruefeBeideAenderungen(amServer.entwurf?.text ?? "");
    expect(amServer.entwurf?.verlauf.map((s) => s.art)).toEqual([
      "angelegt",
      "gespeichert",
      "zusammengefuehrt",
    ]);
  });

  it("derselbe Abschnitt: 409 mit allen Fassungen, nichts überschrieben, die Lösung lässt sich speichern", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    const annasA2 = "Vorher den Druck VOLLSTÄNDIG ablassen.";
    const berndsA2 = "Vorher den Druck über Ventil Z ablassen.";
    const annas = await speichern(anna.token, koId, 1, ersetze(A2, annasA2));
    expect(annas.statusCode).toBe(200);

    const bernds = await speichern(bernd.token, koId, 1, ersetze(A2, berndsA2));
    expect(bernds.statusCode).toBe(409);
    const konflikt = bernds.json() as {
      error: string;
      teile: Array<{ art: string; basis?: string[]; meine?: string[]; deren?: string[] }>;
      aktuell: { revision: number };
      seitherVon: string[];
      titel: unknown;
    };
    expect(konflikt.error).toBe("ENTWURF_KONFLIKT");
    expect(konflikt.titel).toBeNull();
    expect(konflikt.seitherVon).toEqual(["Anna Beispiel"]);
    expect(konflikt.aktuell.revision).toBe(2);
    expect(konflikt.teile.filter((t) => t.art === "konflikt")).toEqual([
      {
        art: "konflikt",
        basis: [A2],
        meine: [berndsA2],
        deren: [annasA2],
      },
    ]);
    // Nichts geschrieben: am Server steht Annas Stand.
    const danach = await lage(pedi, koId);
    expect(danach.entwurf?.revision).toBe(2);
    expect(danach.entwurf?.text).toContain("VOLLSTÄNDIG");
    expect(danach.entwurf?.text).not.toContain("Ventil Z");

    // Bernd wählt „beide behalten" und speichert auf dem jetzt gültigen Arbeitsstand.
    const loesung = [A1, annasA2, berndsA2, A3].join("\n\n");
    const geloest = await speichern(bernd.token, koId, konflikt.aktuell.revision, loesung);
    expect(geloest.statusCode, geloest.body).toBe(200);
    expect((await lage(anna.token, koId)).entwurf?.text).toBe(loesung);
  });

  it("verschiedene Titel sind ein Konflikt am Titel", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    const erster = await speichern(anna.token, koId, 1, TEXT, "Ventil X (Anlage 1)");
    expect(erster.statusCode).toBe(200);
    const res = await speichern(bernd.token, koId, 1, TEXT, "Ventil X — Notfall");
    expect(res.statusCode).toBe(409);
    expect((res.json() as { titel: unknown }).titel).toEqual({
      basis: TITEL,
      meine: "Ventil X — Notfall",
      deren: "Ventil X (Anlage 1)",
    });
  });
});

describe("S3 · Bearbeitende und Speicherzustand (K3)", () => {
  it("die Antwort nennt Arbeitsstand, Zeitpunkt und Person; der Hinweis nennt die Anwesenden", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    await api(anna.token, "PUT", `/api/kos/${koId}/bearbeitungen/annas-sitzung-1`);
    await api(bernd.token, "PUT", `/api/kos/${koId}/bearbeitungen/bernds-sitzung-1`);
    const vorher = Date.now();
    await speichern(bernd.token, koId, 1, ersetze(A3, "Danach dicht prüfen."));
    const beiAnna = await lage(anna.token, koId);
    expect(beiAnna.entwurf?.revision).toBe(2);
    expect(beiAnna.entwurf?.geaendertVon).toBe("Bernd Beispiel");
    expect(Date.parse(beiAnna.entwurf?.geaendertAm ?? "")).toBeGreaterThanOrEqual(vorher - 1000);
    expect(letztes(beiAnna.entwurf?.verlauf ?? [])).toMatchObject({
      revision: 2,
      name: "Bernd Beispiel",
      eigen: false,
      art: "gespeichert",
    });
    // Keine Kontokennung, keine E-Mail im Entwurf.
    const roh = (await api(anna.token, "GET", `/api/kos/${koId}/gemeinsam`)).body;
    expect(roh).not.toContain(bernd.id);
    expect(roh).not.toContain("bernd@klarwerk.test");

    const anwesend = (await api(anna.token, "GET", `/api/kos/${koId}/bearbeitungen`)).json() as {
      bearbeitungen: Array<{ name: string; eigen: boolean }>;
    };
    expect(anwesend.bearbeitungen.map((b) => `${b.name}:${b.eigen}`).sort()).toEqual([
      "Anna Beispiel:true",
      "Bernd Beispiel:false",
    ]);
  });
});

describe("S4 · der freigegebene Leserstand bleibt eindeutig (K4)", () => {
  it("während des Entwurfs liest Vera die gültige Fassung; erst die Übernahme macht eine neue", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    const neu = BERNDS;
    await speichern(anna.token, koId, 1, neu);
    const leser = (await api(vera.token, "GET", `/api/kos/${koId}`)).json() as {
      statement: string;
      version: number;
      bodyHtml: string;
    };
    expect(leser.version).toBe(1);
    expect(leser.statement).toBe(TEXT);
    expect(leser.bodyHtml).not.toContain("Lecksuchspray");

    const l = await lage(anna.token, koId);
    expect(l.weg).toBe("direkt");
    expect(l.lesefassung).toMatchObject({ version: 1, text: TEXT, rumpf: "einfach" });
    const u = l.uebernahme;
    expect(u).toMatchObject({ revision: 2, basisVersion: 1, aktuell: true, titelGeht: true });
    const revise = await api(anna.token, "PUT", `/api/kos/${koId}`, {
      action: "revise",
      changes: u?.aenderung,
      expectedVersion: u?.basisVersion,
    });
    expect(revise.statusCode, revise.body).toBe(200);
    const fassung = (revise.json() as { version: number }).version;
    const abschluss = await api(anna.token, "POST", `/api/kos/${koId}/gemeinsam/abschluss`, {
      revision: u?.revision,
      fassung,
    });
    expect(abschluss.statusCode, abschluss.body).toBe(200);
    expect((abschluss.json() as Lage).entwurf).toBeNull();

    const jetzt = (await api(vera.token, "GET", `/api/kos/${koId}`)).json() as {
      statement: string;
      version: number;
      bodyHtml: string;
      status: string;
    };
    expect(jetzt.version).toBe(2);
    expect(jetzt.statement).toBe(neu);
    expect(jetzt.bodyHtml).toContain("Lecksuchspray");
    // Die neue Fassung ist ungeprüft — die Freigabe bleibt ein eigener Schritt.
    expect(jetzt.status).toBe("offen");
  });

  it("freigegebener Artikel: der Experte reicht einen Vorschlag ein, die Freigabe bleibt bis zur Entscheidung", async () => {
    const koId = await artikel();
    const frei = await api(pedi, "PUT", `/api/kos/${koId}`, { action: "admin-validate" });
    expect(frei.statusCode, frei.body).toBe(200);
    await oeffnen(anna.token, koId);
    const neu = ANNAS;
    await speichern(anna.token, koId, 1, neu);
    const l = await lage(anna.token, koId);
    expect(l.weg).toBe("vorschlag");
    expect(l.lesefassung.status).toBe("validiert");
    // Der direkte Weg ist für den Experten zu — der bestehende Schutz greift.
    const direkt = await api(anna.token, "PUT", `/api/kos/${koId}`, {
      action: "revise",
      changes: l.uebernahme?.aenderung,
      expectedVersion: l.uebernahme?.basisVersion,
    });
    expect(direkt.statusCode).toBe(403);
    expect((direkt.json() as { error: string }).error).toBe("PROPOSAL_REQUIRED");

    const vorschlag = await api(anna.token, "PUT", `/api/kos/${koId}`, {
      action: "propose",
      proposal: {
        statement: l.uebernahme?.aenderung.statement,
        bodyHtml: l.uebernahme?.aenderung.bodyHtml,
        baseVersion: l.uebernahme?.basisVersion,
        origin: "klarwerk_web",
      },
    });
    expect(vorschlag.statusCode, vorschlag.body).toBe(200);
    const { proposals } = vorschlag.json() as { proposals: Array<{ id: string }> };
    const vorschlagId = letztes(proposals)?.id ?? "";
    const abschluss = await api(anna.token, "POST", `/api/kos/${koId}/gemeinsam/abschluss`, {
      revision: l.uebernahme?.revision,
      vorschlagId,
    });
    expect(abschluss.statusCode, abschluss.body).toBe(200);
    expect((abschluss.json() as Lage).abgeschlossen?.zustand).toBe("eingereicht");

    // Bis zur Entscheidung liest Vera die freigegebene Fassung.
    const vorDerEntscheidung = (await api(vera.token, "GET", `/api/kos/${koId}`)).json() as {
      statement: string;
      status: string;
      version: number;
    };
    expect(vorDerEntscheidung).toMatchObject({
      statement: TEXT,
      status: "validiert",
      version: l.lesefassung.version,
    });

    // Pedi entscheidet — erst jetzt gilt der Text, freigegeben.
    const entscheidung = await api(pedi, "PUT", `/api/kos/${koId}`, {
      action: "decide-proposal",
      proposalId: vorschlagId,
      decision: "uebernehmen",
    });
    expect(entscheidung.statusCode, entscheidung.body).toBe(200);
    const danach = (await api(vera.token, "GET", `/api/kos/${koId}`)).json() as {
      statement: string;
      status: string;
    };
    expect(danach).toMatchObject({ statement: neu, status: "validiert" });
  });

  it("ein Abschluss ohne wirkliche Übernahme wird abgewiesen — der Entwurf bleibt offen", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    await speichern(anna.token, koId, 1, ersetze(A3, "Danach dicht prüfen."));
    const falsch = await api(anna.token, "POST", `/api/kos/${koId}/gemeinsam/abschluss`, {
      revision: 2,
      fassung: 1,
    });
    expect(falsch.statusCode).toBe(409);
    expect((falsch.json() as { error: string }).error).toBe("ENTWURF_ABSCHLUSS_UNBELEGT");
    expect((await lage(anna.token, koId)).entwurf?.revision).toBe(2);
  });
});

describe("S5 · Verbindungsabbruch, Wiederaufnahme und Rechteänderung (K5)", () => {
  it("Bernd war offline; sein später Speichervorgang auf altem Stand wird zusammengeführt", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    // Bernd hat Stand 1 geladen und tippt offline. Anna speichert zweimal.
    await speichern(anna.token, koId, 1, ANNAS);
    await speichern(anna.token, koId, 2, ANNAS.replace(A2, `${A2} Sofort.`));
    const zurueck = await speichern(bernd.token, koId, 1, BERNDS);
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    const text = (zurueck.json() as Lage).entwurf?.text ?? "";
    expect(text).toContain("hörbar");
    expect(text).toContain("Sofort.");
    expect(text).toContain("Lecksuchspray");
  });

  it("Rechteentzug: 403, nichts geschrieben; nach der Rückgabe geht die gehaltene Eingabe durch", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    const rolle = (r: string) => api(pedi, "PUT", `/api/users/${bernd.id}`, { role: r });
    expect((await rolle("viewer")).statusCode).toBe(200);
    // Bernds Eingabe hält seine Fläche fest (s. die Flächenprüfung); hier zählt der Server.
    const bernds = BERNDS;
    expect((await speichern(bernd.token, koId, 1, bernds)).statusCode).toBe(403);
    expect((await lage(anna.token, koId)).entwurf?.revision).toBe(1);
    // Inzwischen speichert Anna weiter.
    await speichern(anna.token, koId, 1, ANNAS);
    expect((await rolle("experte")).statusCode).toBe(200);
    const nachher = await speichern(bernd.token, koId, 1, bernds);
    expect(nachher.statusCode, nachher.body).toBe(200);
    pruefeBeideAenderungen((nachher.json() as Lage).entwurf?.text ?? "");
  });

  it("wird der Artikel unsichtbar, antwortet jede Tür 404 — ohne Inhalt", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    await api(pedi, "PUT", `/api/kos/${koId}`, { action: "confidentiality", level: "vertraulich" });
    const res = await speichern(anna.token, koId, 1, TEXT);
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain(A1);
  });

  it("ändert sich die Lesefassung daneben, scheitert die Übernahme (KO_STALE); Angleichen führt zusammen", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    await speichern(anna.token, koId, 1, BERNDS);
    // Pedi ändert den Artikel direkt (vorhandener Weg) an einer anderen Stelle.
    const direkt = await api(pedi, "PUT", `/api/kos/${koId}`, {
      action: "revise",
      changes: {
        statement: ANNAS,
        bodyHtml: `<p>${A1_NEU}</p><p>${A2}</p><p>${A3}</p>`,
      },
      expectedVersion: 1,
    });
    expect(direkt.statusCode, direkt.body).toBe(200);

    const l = await lage(anna.token, koId);
    expect(l.uebernahme?.aktuell).toBe(false);
    const stale = await api(anna.token, "PUT", `/api/kos/${koId}`, {
      action: "revise",
      changes: l.uebernahme?.aenderung,
      expectedVersion: l.uebernahme?.basisVersion,
    });
    expect(stale.statusCode).toBe(409);
    expect((stale.json() as { error: string }).error).toBe("KO_STALE");

    const angeglichen = await api(anna.token, "POST", `/api/kos/${koId}/gemeinsam/angleichen`, {
      revision: l.entwurf?.revision,
    });
    expect(angeglichen.statusCode, angeglichen.body).toBe(200);
    const neu = angeglichen.json() as Lage;
    expect(neu.entwurf?.basisVersion).toBe(2);
    pruefeBeideAenderungen(neu.entwurf?.text ?? "");
    expect(neu.uebernahme?.aktuell).toBe(true);
  });
});

describe("S6 · Historie und Zuständigkeit (K6)", () => {
  it("neue Fassung von der übernehmenden Person; Autor bleibt; neue Anmeldung liest das Ergebnis", async () => {
    const koId = await artikel();
    const vorher = (await api(pedi, "GET", `/api/kos/${koId}`)).json() as {
      author: string;
      owner?: string;
      history: Array<{ version: number; author: string; note: string }>;
    };
    await oeffnen(anna.token, koId);
    await speichern(anna.token, koId, 1, ANNAS);
    await speichern(bernd.token, koId, 1, BERNDS);
    const l = await lage(bernd.token, koId);
    expect(l.entwurf?.beteiligte).toEqual(["Anna Beispiel", "Bernd Beispiel"]);
    const revise = await api(bernd.token, "PUT", `/api/kos/${koId}`, {
      action: "revise",
      changes: l.uebernahme?.aenderung,
      expectedVersion: l.uebernahme?.basisVersion,
    });
    expect(revise.statusCode, revise.body).toBe(200);
    const fassung = (revise.json() as { version: number }).version;
    await api(bernd.token, "POST", `/api/kos/${koId}/gemeinsam/abschluss`, {
      revision: l.uebernahme?.revision,
      fassung,
    });

    // Eine NEUE Anmeldung (unabhängig von der Sitzung, die übernommen hat).
    const frisch = await anmelden("anna@klarwerk.test");
    const nachher = (await api(frisch, "GET", `/api/kos/${koId}`)).json() as {
      author: string;
      owner?: string;
      statement: string;
      history: Array<{ version: number; author: string; note: string }>;
    };
    pruefeBeideAenderungen(nachher.statement);
    expect(nachher.author).toBe(vorher.author);
    expect(nachher.owner ?? null).toBe(vorher.owner ?? null);
    expect(nachher.history.slice(0, vorher.history.length)).toEqual(vorher.history);
    expect(letztes(nachher.history)).toMatchObject({ version: fassung, author: bernd.id });
    const versionen = await api(frisch, "GET", `/api/kos/${koId}/versions`);
    expect(versionen.statusCode).toBe(200);
    expect(versionen.body).toContain("Lecksuchspray");

    const abgeschlossen = (await lage(frisch, koId)).abgeschlossen;
    expect(abgeschlossen?.zustand).toBe("uebernommen");
    expect(letztes(abgeschlossen?.verlauf ?? [])).toMatchObject({ art: "uebernommen", fassung });
  });
});

describe("S7 · Gegenprobe", () => {
  it("ohne Zusammenführung (Bernd speichert blind auf dem aktuellen Stand) fehlt Annas Änderung", async () => {
    const koId = await artikel();
    await oeffnen(anna.token, koId);
    await speichern(anna.token, koId, 1, ANNAS);
    // Bernd behauptet, auf Stand 2 zu beruhen, schickt aber seinen alten Text: ein Überschreiben.
    const blind = await speichern(bernd.token, koId, 2, BERNDS);
    const text = (blind.json() as Lage).entwurf?.text ?? "";
    expect(() => pruefeBeideAenderungen(text)).toThrow();
  });
});
