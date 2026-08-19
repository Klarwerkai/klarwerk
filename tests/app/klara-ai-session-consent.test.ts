import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { InMemoryKlaraSessionRepo } from "../../services/reasoner";

// ================================================================================================
// W1 S4 — SITZUNG UND ZUSTIMMUNG AM ECHTEN HTTP-WEG (Auftrag §182-197)
// ================================================================================================
//
// Die Pflichtgegenproben des Auftrags, soweit sie über den Draht messbar sind. Die feineren
// Zeit-/Versionsfälle liegen im Dienst-Test (`klara-session-service.test.ts`) — dort lässt sich die
// Uhr stellen, hier nicht.

const INSTANZ = "instanz-1";
const DESCRIPTOR = { kind: "saved" as const, hostDocumentId: "word-doc-1" };

async function anmelden(app: ReturnType<typeof buildApp>, email: string) {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  if (login.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${login.statusCode} ${login.body}`);
  }
  return { authorization: `Bearer ${login.json().token}`, "x-klara-instance": INSTANZ };
}

/**
 * NACH BEN ROT-5: eine Sitzung ist kein blosser Bezeichner mehr, sondern eine registrierte
 * Zuordnung. Der Server vergibt die `documentContextId`; erst mit ihr im Kopf trägt die Bindung.
 */
async function starte(app: ReturnType<typeof buildApp>, auth: Record<string, string>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: auth,
    payload: { addinInstanceId: INSTANZ, documentDescriptor: DESCRIPTOR },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Sitzung nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  const body = res.json();
  return {
    body,
    sessionId: body.sessionId as string,
    headers: {
      ...auth,
      "x-klara-session": body.sessionId as string,
      "x-klara-document": body.documentContextId as string,
    },
  };
}

/** Das ERSTE Konto wird Admin (FR-AUTH-01) — die Selbstregistrierung steht nur ihm offen. */
async function angemeldet(app: ReturnType<typeof buildApp>, email: string, name: string) {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: "secret123" },
  });
  return anmelden(app, email);
}

/**
 * Ein ZWEITER Nutzer entsteht über den Produktweg `/api/users` — der Admin legt ihn an. Das ist
 * derselbe Weg, den `tests/security/mega80-*` benutzt, und der einzige, den es gibt: eine zweite
 * Selbstregistrierung ist bewusst nicht möglich.
 */
async function zweiterNutzer(
  app: ReturnType<typeof buildApp>,
  admin: Record<string, string>,
  email: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: email, email, password: "secret123", role: "experte" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  return anmelden(app, email);
}

describe("W1 S4 · Gegenprobe 2 — fremder Actor kann die Sitzung nicht sehen", () => {
  it("ein zweiter angemeldeter Nutzer bekommt NOT_FOUND, nicht die Sitzung", async () => {
    const app = buildApp(buildServices());
    const anna = await angemeldet(app, "anna@x.de", "Anna");
    const bernd = await zweiterNutzer(app, anna, "bernd@x.de");

    const { sessionId, headers } = await starte(app, anna);
    // Bernd kennt sogar die vollständige Bindung — Kennungen sind Lookup, keine Attestierung
    // (S4-20 §102). Trotzdem trägt sie für ihn nicht, weil der Actor nicht passt.
    const bernds = { ...headers, ...bernd };

    for (const { method, url } of [
      { method: "GET" as const, url: `/api/klara/sessions/${sessionId}` },
      { method: "POST" as const, url: `/api/klara/sessions/${sessionId}/consent` },
      { method: "DELETE" as const, url: `/api/klara/sessions/${sessionId}/consent` },
      { method: "POST" as const, url: `/api/klara/sessions/${sessionId}/close` },
    ]) {
      const res = await app.inject({ method, url, headers: bernds });
      // Eine Kennung ist kein Leserecht — und sie ist auch keine Existenzauskunft.
      expect(res.statusCode, `${method} ${url}`).toBe(404);
      expect(res.json().error).toBe("NOT_FOUND");
    }
    await app.close();
  });
});

describe("W1 S4 · Gegenproben 3-5 — keine Zustimmung ohne externe Auflösung", () => {
  it("ohne verdrahteten Cloud-Anbieter wird die Zustimmung abgelehnt", async () => {
    const app = buildApp(buildServices());
    const auth = await angemeldet(app, "a@x.de", "Anna");
    const { sessionId, headers } = await starte(app, auth);

    const res = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${sessionId}/consent`,
      headers,
    });
    expect(res.statusCode).toBe(409);
    // Der Grund ist lesbar, nennt aber keine interne Policyregel.
    expect(res.json().message).toMatch(/extern/i);
    expect(res.payload).not.toMatch(/allowedModes|policyProfile|providerBinding|secret/i);
    await app.close();
  });

  it("und der Zustand bleibt danach unverändert ohne Zustimmung", async () => {
    const app = buildApp(buildServices());
    const auth = await angemeldet(app, "a@x.de", "Anna");
    const { sessionId, headers } = await starte(app, auth);
    await app.inject({ method: "POST", url: `/api/klara/sessions/${sessionId}/consent`, headers });

    const nach = await app.inject({
      method: "GET",
      url: `/api/klara/sessions/${sessionId}`,
      headers,
    });
    expect(nach.json().consentState).toBe("none");
    expect(nach.json().resolution.externalConsentGranted).toBe(false);
    await app.close();
  });
});

describe("W1 S4 · Gegenproben 6-7 — Widerruf und Schliessen wirken sofort", () => {
  it("Widerruf setzt den Zustand unmittelbar zurück", async () => {
    const app = buildApp(buildServices());
    const auth = await angemeldet(app, "a@x.de", "Anna");
    const { sessionId, headers } = await starte(app, auth);

    const weg = await app.inject({
      method: "DELETE",
      url: `/api/klara/sessions/${sessionId}/consent`,
      headers,
    });
    expect(weg.statusCode).toBe(200);
    expect(weg.json().consentState).toBe("revoked");
    expect(weg.json().resolution.externalConsentGranted).toBe(false);
    await app.close();
  });

  it("nach Close ist die Sitzung für JEDEN Folgeaufruf zu", async () => {
    const app = buildApp(buildServices());
    const auth = await angemeldet(app, "a@x.de", "Anna");
    const { sessionId, headers } = await starte(app, auth);
    expect(
      (await app.inject({ method: "POST", url: `/api/klara/sessions/${sessionId}/close`, headers }))
        .statusCode,
    ).toBe(200);

    for (const { method, url } of [
      { method: "GET" as const, url: `/api/klara/sessions/${sessionId}` },
      { method: "POST" as const, url: `/api/klara/sessions/${sessionId}/consent` },
      { method: "POST" as const, url: `/api/klara/sessions/${sessionId}/close` },
    ]) {
      const res = await app.inject({ method, url, headers });
      expect(res.statusCode, `${method} ${url}`).toBe(409);
      expect(res.json().message).toMatch(/geschlossen/i);
    }
    await app.close();
  });
});

describe("W1 S4 · Gegenprobe 9 — Status, Sitzung und Consent stimmen überein", () => {
  it("Sitzung und Statusabruf tragen dieselben Versionen", async () => {
    const app = buildApp(buildServices());
    const auth = await angemeldet(app, "a@x.de", "Anna");
    const { body: sitzung, headers } = await starte(app, auth);

    expect(sitzung.policyVersion).toBe(sitzung.resolution.policyVersion);
    expect(sitzung.configurationVersion).toBe(sitzung.resolution.configurationVersion);

    const status = (
      await app.inject({ method: "GET", url: "/api/klara/ai-status", headers })
    ).json();
    expect(status.policyVersion).toBe(sitzung.policyVersion);
    expect(status.configurationVersion).toBe(sitzung.configurationVersion);
    // ROT-2: dieselbe Auflösung, nicht nur dieselben Versionen.
    expect(status.resolutionId).toBe(sitzung.resolution.resolutionId);
    await app.close();
  });
});

describe("W1 S4 · Gegenprobe 12 — der Sitzungszustand hängt an der Ablage", () => {
  it("zwei App-Instanzen über dieselbe Ablage sehen dieselbe Sitzung", async () => {
    const repos = inMemoryRepos();
    const klaraSessions = new InMemoryKlaraSessionRepo();
    const app = buildApp(assembleServices(repos, { klaraSessions }));
    const auth = await angemeldet(app, "a@x.de", "Anna");
    const { sessionId, headers } = await starte(app, auth);
    await app.close();

    const app2 = buildApp(assembleServices(repos, { klaraSessions }));
    const login2 = await app2.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    expect(
      (
        await app2.inject({
          method: "GET",
          url: `/api/klara/sessions/${sessionId}`,
          headers: { ...headers, authorization: `Bearer ${login2.json().token}` },
        })
      ).statusCode,
    ).toBe(200);
    await app2.close();
  });
});

// ================================================================================================
// KW-KA4 — DER TASKPANE-VERTRAG: EINWILLIGUNG JE DOKUMENT, AKTIVES FRAGEN, NEIN WIRD GEMERKT
// ================================================================================================
//
// Diese Fälle lesen die AUSGELIEFERTE Datei, nicht einen Nachbau. Das Panel ist buildlos; sein
// Wortlaut und seine Schnittmarken SIND das Produkt. Geprüft wird, was Pedis Weiche wörtlich
// verlangt — und was sie ausdrücklich verbietet.
describe("KW-KA4 · Taskpane: Einwilligung je Dokument", () => {
  const TASKPANE = "apps/web/public/word-addin/taskpane.html";
  const quelle = (): string => readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
  /**
   * ALLE Abschnitte zwischen den Marken, verkettet — nicht nur der erste.
   *
   * Gemessen und nachgebessert: Der Marker steht viermal (Fläche, Logik, Anzeige, Ereignisse), und
   * eine Fassung, die nur `split(...)[1]` liest, prüft den HTML-Block und meldet die Logik als
   * fehlend. Der erste Lauf war genau deshalb rot (`lauf-04-ui-vertrag.log`, KA4-U3/U4) — der Test
   * hatte recht, meine Leseweise war falsch.
   */
  const ka4Block = (): string => {
    const stuecke = quelle().split("KW-KA4-DOKUMENT-CONSENT-START").slice(1);
    return stuecke.map((s) => s.split("KW-KA4-DOKUMENT-CONSENT-END")[0] ?? "").join("\n");
  };

  it("KA4-U1: der Consent-Wortlaut nennt in allen drei Sprachen DAS DOKUMENT, nicht nur die Sitzung", () => {
    // Die Zustimmung ist serverseitig an `documentContextId` gebunden
    // (`klara-session-service.ts:251`) und ein Rebind verwirft sie. Wer „für diese Sitzung" liest,
    // erwartet Geltung über den Dokumentwechsel hinaus — genau das trifft nicht zu.
    const text = quelle();
    expect(text).toContain("Externe KI für dieses Dokument erlauben");
    expect(text).toContain("Allow external AI for this document");
    expect(text).toContain("Externe AI voor dit document toestaan");
  });

  it("KA4-U2: der aktive Fragesatz steht wörtlich so da, wie das Register ihn bindet", () => {
    // `OFFEN.md:64` gibt ihn vor; er ist Pedis Zusage an den Anwender, kein Vorschlag.
    expect(quelle()).toContain(
      "Dafür brauche ich die externe KI — darf ich dieses Dokument senden? Vertraulich Markiertes bleibt hier.",
    );
  });

  it("KA4-U3: das Nein lebt NUR im Arbeitsspeicher — kein local/sessionStorage", () => {
    // Die schärfste Zusage dieses Blocks. Eine dauerhafte Ablehnung wäre eine Entscheidung ohne
    // Server; eine dauerhafte Zustimmung wäre eine Sicherheitslücke. Beide gehören dem
    // Serverzustand, der sie jederzeit entwerten kann (Rebind, Widerruf, Ablauf, Policywechsel).
    const block = ka4Block();
    expect(block.length, "der KA4-Block muss existieren").toBeGreaterThan(200);
    // Geprüft wird die VERWENDUNG, nicht die Erwähnung: die Zusage selbst steht als Kommentar im
    // Block („kein localStorage, kein sessionStorage") und wäre einem reinen Zeichenverbot zum
    // Opfer gefallen. Gemessen im ersten Lauf (`lauf-05-ui-korrigiert.log`) — der Test hätte die
    // eigene Begründung verboten.
    // `\.[A-Za-z]` statt `\s*[.[]`: der zweite Anlauf scheiterte am SATZPUNKT hinter
    // „kein sessionStorage." im Begründungskommentar (`lauf-06`). Ein echter Zugriff trägt hinter
    // dem Punkt unmittelbar einen Bezeichner (`setItem`, `getItem`) oder eine Klammer.
    const zugriff = /\b(localStorage|sessionStorage)(\.[A-Za-z]|\[)/;
    expect(zugriff.test(block), "kein echter Storage-Zugriff im KA4-Block").toBe(false);
    expect(block).toContain("ka4Abgelehnt");
  });

  it("KA4-U4: der Ablehnungsvermerk hängt an der SERVERSEITIGEN Dokumentkennung", () => {
    // Damit entwertet ein Rebind ihn von selbst: der Server vergibt eine neue `documentContextId`,
    // der alte Schlüssel wird nie wieder getroffen. Kein Aufräumcode, kein Restzustand.
    const block = ka4Block();
    expect(block).toContain("function ka4DokumentSchluessel()");
    expect(block).toContain("klaraS4DocumentId");
  });

  it("KA4-U5: der Ask trägt die drei Bindungs-Kopfzeilen — und `mode` bleibt gesetzt", () => {
    // Die Kopfzeilen sind der Anschluss an das serverseitige Tor. `mode: "retrieval-only"` bleibt
    // unverändert: der Client bittet weiter um die Enge; aufheben darf sie allein der Server.
    const askBlock =
      quelle().split("KW-KLARA-ASK-FETCH-START")[1]?.split("KW-KLARA-ASK-FETCH-END")[0] ?? "";
    expect(askBlock).toContain("klaraS4Header()");
    expect(askBlock).toContain('mode: "retrieval-only"');
  });

  it("KA4-U6: das Panel merkt sich ein NEIN, aber niemals ein JA", () => {
    // Kein clientseitiges Bool, das eine Erlaubnis behauptet — der ausdrückliche No-Go des
    // Auftrags („kein clientseitiges Bool-Bypass").
    const block = ka4Block();
    expect(block).not.toContain("ka4Erlaubt");
    expect(block).not.toContain("ka4Zugestimmt");
  });

  it("KA4-U7: „Ja“ ruft denselben Zustimmungsweg wie der bestehende Knopf", () => {
    // Ein zweiter Erteilungspfad wäre eine zweite Wahrheit über denselben Serverzustand.
    expect(quelle()).toContain(
      'document.getElementById("ka4-frage-ja").addEventListener("click", klaraS4Zustimmen)',
    );
  });

  it("KA4-U8: der manuelle Erlauben-Knopf bleibt bestehen — ein Nein sperrt die Frage, nicht den Weg", () => {
    // Auftrag Lieferung 6, zweiter Halbsatz: „Eine manuell erreichbare Schaltfläche darf sichtbar
    // bleiben." Der Ablehnungszweig fasst `klara-consent-grant` deshalb nicht an.
    expect(ka4Block()).not.toContain("klara-consent-grant");
    expect(quelle()).toContain('document.getElementById("klara-consent-grant")');
  });
});
