// ==================================================================================================
// BILDSCHIRMABLÄUFE · DER GANZE WEG ÜBER DIE ECHTEN ROUTEN (In-Memory-Bestand, getrennte Beispieldaten).
// ==================================================================================================
//
// Derselbe Weg, den `pages/AblaufUebernahme.tsx` geht — mit denselben Bausteinen aus
// `apps/web/src/lib/ablaufImport.ts` — gegen `buildApp`:
//   Import → POST /api/drafts (Vorgangsschlüssel) → GET (Neuladen) → PUT (bearbeiten, schwärzen) →
//   POST /api/drafts/:id/promote → Prüfung durch eine andere Person (PUT /api/kos/:id rate+comment) →
//   Wiederholung derselben Übernahme → bewusste neue Fassung (revise) am selben Objekt.
//
// Originalkriterien: K1, K2, K3, K4, K5 (Serverrand), K6, K8. Die KI-Prüfung nach dem Einreichen
// läuft mit dem ECHTEN Hintergrund-Worker des Bestands; `fetch` wird über den ganzen Weg beobachtet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ablauf } from "../../apps/web/src/api/types";
import {
  type AblaufFormulierung,
  ablaufZuRumpf,
  einreichSchluessel,
  leseAblaufDatei,
  schrittBildSetzen,
  schrittEntfernen,
  schrittTextAendern,
  schrittVerschieben,
  schwaerzeInSchritten,
  uebernahmeSchluessel,
} from "../../apps/web/src/lib/ablaufImport";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

afterEach(() => {
  vi.restoreAllMocks();
});

type App = ReturnType<typeof buildApp>;

const FORMULIERUNG: AblaufFormulierung = {
  oeffnen: (a) => `Öffne ${a}`,
  klicken: (z) => `Klicke auf ${z}`,
  eingeben: (w, z) => `Gib ${w} in ${z} ein`,
  taste: (k) => `Drücke ${k}`,
};

// Getrennte Beispieldaten: eindeutige, erkennbare Bildinhalte je Schritt. Das „sensible" Bild trägt
// die Base64-Folge von „SENSIBEL" — nach dem Schwärzen darf sie nirgends mehr stehen.
const BILD_SENSIBEL = "data:image/png;base64,U0VOU0lCRUxfQklMRA==";
const BILD_GESCHWAERZT = "data:image/png;base64,R0VTQ0hXQUVSWlQ=";
const BILD = (n: number) => `data:image/png;base64,QklMRF8${n}AAAA`;
const TITEL = "Angebot anlegen, prüfen und speichern (Prüfweg-Test)";

const DATEI = JSON.stringify({
  format: "klarwerk-ablauf/1",
  titel: TITEL,
  werkzeug: "Testrekorder",
  aufgezeichnetAm: "2026-10-05T09:12:00Z",
  anwendung: "Testanwendung Angebote",
  schritte: [
    { text: "Neues Angebot öffnen", bild: BILD_SENSIBEL },
    { text: "Kunde Musterfirma Beispiel GmbH wählen", bild: BILD(2) },
    { text: "Position eintragen", bild: BILD(3) },
    { text: "Vorschau prüfen", bild: BILD(4) },
    { text: "Speichern", bild: BILD(5) },
  ],
});

const RUMPF = {
  schritt: (n: number) => `Schritt ${n}`,
  herkunft: "Herkunft: außerhalb Klarwerks aufgezeichnet mit Testrekorder (klarwerk-ablauf/1)",
  hinweis: "Beobachteter Ablauf: Die fachliche Richtigkeit bestätigt die Prüfung.",
};

async function anmelden(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json() as { token: string; user: { id: string } };
  return { id: body.user.id, headers: { authorization: `Bearer ${body.token}` } };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@x.de", password: "secret123" },
  });
  const anna = await anmelden(app, "anna@x.de", "secret123");
  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: anna.headers,
  });
  const carla = await anmelden(
    app,
    "carla@demo.klarwerk",
    demoKennwort(seed, "carla@demo.klarwerk"),
  );
  return { app, services, anna, carla };
}

function importiere(): Ablauf {
  const e = leseAblaufDatei(DATEI, "angebot.json", FORMULIERUNG);
  if (!e.ok) {
    throw new Error(JSON.stringify(e.fehler));
  }
  return e.ablauf;
}

/** Was die Seite bei der Übernahme anlegt: der unveränderte Import, ohne Dateinamen und Rumpf. */
async function anlage(kontoId: string) {
  const schluessel = await uebernahmeSchluessel(DATEI, kontoId);
  const { datei: _d, ...quelle } = importiere().quelle;
  const ablauf: Ablauf = { quelle: { ...quelle, schluessel }, schritte: importiere().schritte };
  return { schluessel, ablauf };
}

function holeEntwurf(app: App, headers: Record<string, string>, id: string) {
  return app.inject({ method: "GET", url: `/api/drafts/${id}`, headers });
}

async function kosMitTitel(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { id: string; title: string }[]).filter((k) => k.title === TITEL);
}

describe("Bildschirmablauf: Übernahme → Bearbeitung → Prüfweg → Wiederholung → neue Fassung", () => {
  it("geht den ganzen Weg ohne zweites Objekt, ohne Restkopie und ohne Außenaufruf", async () => {
    const { app, services, anna, carla } = await buehne();
    // K8: ab hier wird jeder ausgehende HTTP-Aufruf des Prozesses gesehen.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // ---- K1: Übernahme als Entwurf --------------------------------------------------------------
    const { schluessel, ablauf: angelegt } = await anlage(anna.id);
    const erst = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: anna.headers,
      payload: { title: TITEL, ablauf: angelegt, operationId: schluessel, expectedOwner: anna.id },
    });
    expect(erst.statusCode).toBe(201);
    const draftId = erst.json().id as string;

    const geladen = await holeEntwurf(app, anna.headers, draftId);
    expect(geladen.statusCode).toBe(200);
    const p1 = geladen.json().payload as { ablauf: Ablauf };
    expect(p1.ablauf.quelle).toEqual({
      art: "import",
      format: "klarwerk-ablauf/1",
      werkzeug: "Testrekorder",
      aufgezeichnetAm: "2026-10-05T09:12:00Z",
      anwendung: "Testanwendung Angebote",
      schluessel,
    });
    expect(p1.ablauf.schritte.map((s) => s.text)).toEqual([
      "Neues Angebot öffnen",
      "Kunde Musterfirma Beispiel GmbH wählen",
      "Position eintragen",
      "Vorschau prüfen",
      "Speichern",
    ]);
    expect(p1.ablauf.schritte.map((s) => s.bild)).toEqual([
      BILD_SENSIBEL,
      BILD(2),
      BILD(3),
      BILD(4),
      BILD(5),
    ]);

    // ---- K6a: dieselbe Übernahme noch einmal → derselbe Entwurf, kein zweiter -------------------
    const nochmal = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: anna.headers,
      payload: { title: TITEL, ablauf: angelegt, operationId: schluessel, expectedOwner: anna.id },
    });
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json().id).toBe(draftId);
    const entwuerfe = await app.inject({
      method: "GET",
      url: "/api/drafts",
      headers: anna.headers,
    });
    const gleiche = (entwuerfe.json() as { payload: { title?: string } }[]).filter(
      (d) => d.payload.title === TITEL,
    );
    expect(gleiche).toHaveLength(1);

    // ---- K2 + K4: ändern, verschieben, löschen, schwärzen — speichern — neu laden ---------------
    let bearbeitet: Ablauf = {
      ...p1.ablauf,
      quelle: { ...p1.ablauf.quelle, datei: "angebot.json" },
    };
    bearbeitet = schrittTextAendern(bearbeitet, "s3", "Position „Beratung, 4 Stunden“ eintragen");
    bearbeitet = schrittVerschieben(bearbeitet, "s4", -1); // Vorschau vor Position
    bearbeitet = schrittEntfernen(bearbeitet, "s5"); // falsch vorgeführter Schritt
    bearbeitet = schwaerzeInSchritten(bearbeitet, "Musterfirma Beispiel GmbH").ablauf;
    // Das Bild mit der sensiblen Angabe wird durch die geschwärzte, neu kodierte Fassung ERSETZT.
    bearbeitet = schrittBildSetzen(bearbeitet, "s1", BILD_GESCHWAERZT);

    const stand1 = geladen.json().updatedAt as string;
    const gespeichert = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draftId}`,
      headers: anna.headers,
      payload: {
        title: TITEL,
        statement: "So wird ein Angebot in der Testanwendung angelegt, geprüft und gespeichert.",
        type: "best_practice",
        category: "Vertrieb",
        confidentiality: "intern",
        ablauf: bearbeitet,
        bodyHtml: ablaufZuRumpf(bearbeitet, RUMPF),
        expectedUpdatedAt: stand1,
      },
    });
    expect(gespeichert.statusCode).toBe(200);

    const neuGeladen = await holeEntwurf(app, anna.headers, draftId);
    const p2 = neuGeladen.json().payload as { ablauf: Ablauf; bodyHtml: string };
    expect(p2.ablauf.schritte.map((s) => s.id)).toEqual(["s1", "s2", "s4", "s3"]);
    expect(p2.ablauf.schritte.map((s) => s.text)).toEqual([
      "Neues Angebot öffnen",
      "Kunde █████ wählen",
      "Vorschau prüfen",
      "Position „Beratung, 4 Stunden“ eintragen",
    ]);
    expect(p2.ablauf).toEqual(bearbeitet);
    // Der Rumpf folgt derselben Reihenfolge.
    const pos = ["Neues Angebot öffnen", "Vorschau prüfen", "Beratung, 4 Stunden"].map((t) =>
      p2.bodyHtml.indexOf(t),
    );
    expect(pos.every((x) => x >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    // K4: weder als Text noch als Bild bleibt eine auslesbare Kopie im gespeicherten Entwurf.
    const entwurfRoh = JSON.stringify(neuGeladen.json());
    expect(entwurfRoh).not.toContain("Musterfirma");
    expect(entwurfRoh).not.toContain("U0VOU0lCRUxfQklMRA");

    // ---- K5 (Serverrand): ein unvollständiger Ablauf wird abgewiesen, der Stand bleibt ----------
    const kaputt = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draftId}`,
      headers: anna.headers,
      payload: { ablauf: { ...bearbeitet, schritte: [{ id: "s1", text: "  " }] } },
    });
    expect(kaputt.statusCode).toBe(400);
    expect(kaputt.json().message).toMatch(/Schritt 1 braucht einen Handlungstext/);
    const nachFehler = await holeEntwurf(app, anna.headers, draftId);
    expect(nachFehler.json().payload.ablauf).toEqual(bearbeitet);
    const ohneSchritte = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: anna.headers,
      payload: { title: "Leer", ablauf: { quelle: angelegt.quelle, schritte: [] } },
    });
    expect(ohneSchritte.statusCode).toBe(400);
    const svg = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: anna.headers,
      payload: {
        title: "SVG",
        ablauf: {
          quelle: angelegt.quelle,
          schritte: [{ id: "s1", text: "x", bild: "data:image/svg+xml;base64,PHN2Zz4=" }],
        },
      },
    });
    expect(svg.statusCode).toBe(400);

    // ---- K3: Einreichen über den vorhandenen Weg — offen, nicht gültig ----------------------------
    const stand2 = neuGeladen.json().updatedAt as string;
    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers: anna.headers,
      payload: { operationId: einreichSchluessel(schluessel), expectedUpdatedAt: stand2 },
    });
    expect(eingereicht.statusCode).toBe(201);
    const ko = eingereicht.json() as {
      id: string;
      status: string;
      version: number;
      bodyHtml: string;
    };
    expect(ko.status).toBe("offen");
    expect(ko.version).toBe(1);
    expect(ko.bodyHtml).toContain("außerhalb Klarwerks aufgezeichnet mit Testrekorder");
    expect(ko.bodyHtml).toContain("Beobachteter Ablauf");
    expect(ko.bodyHtml).not.toContain("Musterfirma");
    expect(JSON.stringify(ko)).not.toContain("U0VOU0lCRUxfQklMRA");
    // Die Struktur des Entwurfs reist nicht ins Objekt — nur der geprüfte Rumpf.
    expect("ablauf" in (ko as Record<string, unknown>)).toBe(false);

    // Hintergrundprüfung des Bestands abwarten (echter Worker, kein Stub).
    await services.aiCheckWorker?.idle();

    // Eine andere Person entscheidet nachvollziehbar: Ablehnung mit Begründung.
    const begruendung = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: carla.headers,
      payload: { action: "comment", text: "Schritt 3 fehlt die Freigabe durch die Teamleitung." },
    });
    expect(begruendung.statusCode).toBe(200);
    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: carla.headers,
      payload: { action: "rate", verdict: "down" },
    });
    expect(bewertet.statusCode).toBe(200);
    const nachPruefung = (
      await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: anna.headers })
    ).json() as { status: string; comments?: { text: string }[] };
    expect(nachPruefung.status).toBe("offen");
    const kommentare = nachPruefung.comments ?? [];
    expect(kommentare.some((c) => c.text.includes("Freigabe durch die Teamleitung"))).toBe(true);

    // ---- K6b: dieselbe Übernahme nach dem Einreichen → kein zweites Wissensobjekt ---------------
    const wiederholt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: anna.headers,
      payload: { title: TITEL, ablauf: angelegt, operationId: schluessel, expectedOwner: anna.id },
    });
    expect(wiederholt.statusCode).toBeLessThan(300);
    const zweiterEntwurf = wiederholt.json() as { id: string; updatedAt: string };
    await app.inject({
      method: "PUT",
      url: `/api/drafts/${zweiterEntwurf.id}`,
      headers: anna.headers,
      payload: {
        statement: "Zweiter Versuch",
        type: "best_practice",
        category: "Vertrieb",
        confidentiality: "intern",
      },
    });
    const zweitesEinreichen = await app.inject({
      method: "POST",
      url: `/api/drafts/${zweiterEntwurf.id}/promote`,
      headers: anna.headers,
      payload: { operationId: einreichSchluessel(schluessel) },
    });
    expect(zweitesEinreichen.statusCode).toBe(409);
    expect(zweitesEinreichen.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    expect(await kosMitTitel(app, anna.headers)).toHaveLength(1);

    // ---- K6c: die bewusste neue Fassung bleibt beim richtigen Objekt ----------------------------
    const neueFassung = schrittTextAendern(
      bearbeitet,
      "s4",
      "Vorschau mit Summe und Zahlungsziel prüfen",
    );
    const revision = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: anna.headers,
      payload: {
        action: "revise",
        changes: { bodyHtml: ablaufZuRumpf(neueFassung, RUMPF) },
        expectedVersion: 1,
      },
    });
    expect(revision.statusCode).toBe(200);
    const nachRevision = (
      await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: anna.headers })
    ).json() as { id: string; version: number; status: string; bodyHtml: string };
    expect(nachRevision.id).toBe(ko.id);
    expect(nachRevision.version).toBe(2);
    expect(nachRevision.status).toBe("offen");
    expect(nachRevision.bodyHtml).toContain("Summe und Zahlungsziel");
    expect(await kosMitTitel(app, anna.headers)).toHaveLength(1);

    // ---- K8: der ganze Weg samt nachgelagerter Bestandsprüfung erreicht kein fremdes System -----
    // Die Testumgebung ist der interne Betrieb ohne konfigurierten externen Anbieter. Läuft dort
    // überhaupt ein Aufruf, dann nur an die eigene Maschine — nie an eine fremde Adresse.
    await services.aiCheckWorker?.idle();
    const ziele = fetchSpy.mock.calls.map(([ziel]) => {
      const roh =
        typeof ziel === "string"
          ? ziel
          : ziel instanceof URL
            ? ziel.href
            : (ziel as { url: string }).url;
      return new URL(roh).hostname;
    });
    expect(ziele.filter((h) => h !== "127.0.0.1" && h !== "localhost" && h !== "[::1]")).toEqual(
      [],
    );
  });
});
