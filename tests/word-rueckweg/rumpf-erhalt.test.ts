// ================================================================================================
// JOB 3667 · RUNDE 5 — AUSGELASSEN IST NICHT GELÖSCHT. DER RÜCKWEG AUS WORD DARF NICHTS AUSRADIEREN.
// ================================================================================================
//
// DER FEHLER, GEGEN DEN DIESE DATEI STEHT (Steuerung/Codex, 14.09.): das Word-Fenster reicht eine
// reine Textänderung ein — `rwEinreichen` schickt `statement`, `baseVersion`, `origin`, KEINEN
// Rumpf (`apps/web/public/word-addin/taskpane.html`). `decideProposal` machte daraus
// `bodyHtml: vorschlag.bodyHtml ?? null`, und `naechsteFassung` las `null` als „leeren". Die
// Übernahme eines Wortlaut-Vorschlags aus Word hätte damit den GANZEN ausführlichen Inhalt des
// Wissensobjekts entfernt. Runde 4 hat die Folge nur angezeigt; Pedis Rückweg erfüllt das nicht.
//
// WAS HIER GEMESSEN WIRD, ist die WIRKUNG an der echten Route: echtes Login, echte Rollen, echter
// PUT, echte Entscheidung — und danach der Fließtext, Zeichen für Zeichen gegen den Stand davor.
// Der Statuscode ist dabei ausdrücklich KEIN Urteil (Nachführung 12.09. 10:5x): ein Vorschlag DARF
// mit 200 angenommen werden. Falsch wäre, was danach im Eintrag steht.
//
// DIE FÄLLE STEHEN NICHT HIER, sondern in `rumpf-faelle.ts` — dieselbe Liste, die die Web-Fläche
// in `web-einreichweg-mounted.test.tsx` als VORSCHAU zeichnet. Eine zweite Liste könnte auseinander
// laufen, und genau dann wäre die Vorschau wieder ein Versprechen statt einer Auskunft.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { BESTAND_RUMPF, RUMPF_FAELLE, VORSCHLAG_RUMPF } from "./rumpf-faelle";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Vorschlag {
  id: string;
  status: string;
  bodyHtml?: string | null;
  clearBody?: boolean;
}

interface Stand {
  version: number;
  status: string;
  statement: string;
  bodyHtml?: string | null;
  proposals?: Vorschlag[];
}

async function flaeche(): Promise<{ app: App; admin: Kopf }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  return { app, admin: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

/** Ein zweites Konto über den Weg des Produkts — eine gesetzte Rolle im Speicher wäre kein Zustand. */
async function konto(app: App, admin: Kopf, rolle: string, email: string): Promise<Kopf> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

/** Ein FREIGEGEBENES Objekt, wahlweise mit ausführlichem Inhalt — der Zustand, den Pedis Regel schützt. */
async function freigegebenesObjekt(
  app: App,
  admin: Kopf,
  bodyHtml: string | null,
): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      ...(bodyHtml === null ? {} : { bodyHtml }),
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    payload: { action: "admin-validate" },
  });
  expect(frei.statusCode).toBe(200);
  return id;
}

async function stand(app: App, headers: Kopf, id: string): Promise<Stand> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

/** Der Rumpf, wie er JETZT gespeichert ist — getrimmt auf „da/nicht da", sonst wörtlich. */
function rumpfVon(s: Stand): string | null {
  const r = s.bodyHtml ?? null;
  return r !== null && r.trim().length > 0 ? r : null;
}

describe("JOB 3667 R5 · die Übernahme schreibt, was der Vorschlag WIRKLICH verlangt", () => {
  for (const fall of RUMPF_FAELLE) {
    it(`F-${fall.lage}: ${fall.name}`, async () => {
      const { app, admin } = await flaeche();
      const id = await freigegebenesObjekt(app, admin, fall.bestand);
      const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

      // DER STAND VOR DER ENTSCHEIDUNG — Vergleichsmaß, nicht Annahme: der Server hat den Rumpf
      // beim Anlegen gesäubert, und „bytegleich erhalten" heisst gleich DIESEM Wert.
      const vorher = await stand(app, admin, id);
      const rumpfVorher = rumpfVon(vorher);
      expect(rumpfVorher === null).toBe(fall.bestand === null);

      const eingereicht = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: experte,
        payload: {
          action: "propose",
          proposal: {
            statement: "So müsste die Aussage heißen.",
            baseVersion: vorher.version,
            origin: "word_addin",
            ...fall.vorschlag,
          },
        },
      });
      expect(eingereicht.statusCode).toBe(200);

      // SOLANGE NIEMAND ENTSCHIEDEN HAT, ÄNDERT SICH NICHTS — auch nicht am Fließtext.
      const waehrend = await stand(app, admin, id);
      expect(rumpfVon(waehrend)).toBe(rumpfVorher);
      expect(waehrend.version).toBe(vorher.version);
      const offen = (waehrend.proposals ?? [])[0];
      expect(offen?.status).toBe("offen");

      const uebernommen = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: admin,
        payload: {
          action: "decide-proposal",
          proposalId: offen?.id,
          decision: "uebernehmen",
          expectedVersion: vorher.version,
        },
      });
      expect(uebernommen.statusCode).toBe(200);

      const nachher = await stand(app, admin, id);
      expect(nachher.statement).toBe("So müsste die Aussage heißen.");
      expect(nachher.version).toBe(vorher.version + 1);
      const rumpfNachher = rumpfVon(nachher);
      if (fall.ergebnis === "bestand") {
        // DAS IST DER KERN DIESER RUNDE: bytegleich, nicht „ähnlich" und nicht „auch vorhanden".
        expect(
          rumpfNachher,
          "der bestehende ausführliche Inhalt hat die Übernahme nicht unverändert überlebt",
        ).toBe(rumpfVorher);
        expect(rumpfNachher).not.toBeNull();
      } else if (fall.ergebnis === "keiner") {
        expect(rumpfNachher).toBeNull();
      } else {
        const erwartet = fall.vorschlag.bodyHtml ?? "";
        expect(rumpfNachher ?? "").toContain(erwartet.replace(/<\/?p>/g, "").trim());
      }
    });
  }
});

describe("JOB 3667 R5 · die Löschung ist ein eigener, ausdrücklicher Griff", () => {
  it("G1: der Vorschlag trägt das Löschsignal — es wird gespeichert und nicht erraten", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin, BESTAND_RUMPF);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: experte,
      payload: {
        action: "propose",
        proposal: {
          statement: "Nur noch die Aussage.",
          baseVersion: 1,
          clearBody: true,
          origin: "klarwerk_web",
        },
      },
    });
    const vorschlag = ((await stand(app, admin, id)).proposals ?? [])[0];
    expect(vorschlag?.clearBody).toBe(true);
    // Und der Vorschlag OHNE Signal trägt es auch nicht — sonst wäre „ausdrücklich" ein Wort ohne Halt.
    expect(vorschlag?.bodyHtml ?? null).toBeNull();
  });

  it("G2: Ersetzen UND Löschen im selben Vorschlag wird abgewiesen — zwei Absichten, keine Wahl", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin, BESTAND_RUMPF);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

    const versuch = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: experte,
      payload: {
        action: "propose",
        proposal: {
          statement: "Beides zugleich.",
          baseVersion: 1,
          bodyHtml: VORSCHLAG_RUMPF,
          clearBody: true,
        },
      },
    });
    expect(versuch.statusCode).toBe(400);
    expect((versuch.json() as { error: string }).error).toBe("INVALID_SOURCE");
    // Nichts ist entstanden: kein halber Vorschlag am Objekt.
    expect((await stand(app, admin, id)).proposals ?? []).toHaveLength(0);
  });

  it("G3: ein leerer Rumpf ohne Löschsignal löscht NICHT — das war die Nebenwirkung, die weg ist", async () => {
    // Die Gegenprobe zur alten Wirkung: `bodyHtml: ""` ist kein Löschauftrag, sondern kein Inhalt.
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin, BESTAND_RUMPF);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");
    const vorher = rumpfVon(await stand(app, admin, id));

    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: experte,
      payload: {
        action: "propose",
        proposal: { statement: "Leerer Rumpf mitgeschickt.", baseVersion: 1, bodyHtml: "   " },
      },
    });
    const vorschlag = ((await stand(app, admin, id)).proposals ?? [])[0];
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "decide-proposal",
        proposalId: vorschlag?.id,
        decision: "uebernehmen",
        expectedVersion: 1,
      },
    });

    expect(rumpfVon(await stand(app, admin, id))).toBe(vorher);
  });

  it("G4: auch der direkte Weg bleibt bei der Regel — `revise` ohne `bodyHtml` erhält den Inhalt", async () => {
    // Dieselbe Regel, andere Tür: `naechsteFassung` ist die EINE Stelle, an der sie steht. Ohne
    // diesen Fall wäre nicht gemessen, dass die Übernahme und das Überarbeiten dasselbe sprechen.
    const { app, admin } = await flaeche();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        confidentiality: "intern",
        title: "Ventil X",
        statement: "Erst so.",
        type: "best_practice",
        category: "Anlage 1",
        bodyHtml: BESTAND_RUMPF,
      },
    });
    const id = (angelegt.json() as { id: string }).id;
    const vorher = rumpfVon(await stand(app, admin, id));

    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "revise", changes: { statement: "Jetzt so." } },
    });
    expect(revidiert.statusCode).toBe(200);
    expect(rumpfVon(await stand(app, admin, id))).toBe(vorher);
  });
});
