// ================================================================================================
// JOB 4213 · WIKI-NACHVOLLZIEHEN — ZWISCHEN ANSEHEN UND ÜBERNEHMEN SCHREIBT JEMAND ANDERES.
// ================================================================================================
//
// DIE LAGE, UM DIE ES GEHT: ein Mensch klappt eine alte Fassung auf, liest, entscheidet sich — und
// in dieser Spanne speichert jemand anders. Eine Übernahme, die den gelesenen Stand einfach
// überschreibt, löscht fremde Arbeit, ohne dass jemand davon erfährt.
//
// DER WETTLAUF WIRD ERZWUNGEN NACHEINANDER GEFAHREN und nicht dem Zufall überlassen
// (Promptverbesserung aus JOB 4151 R3): erst LIEST die Übernahme den Stand (`expectedVersion`),
// dann schreibt der Fremde VOLLSTÄNDIG (`await`, Antwort geprüft), dann erst sendet die Übernahme.
// Ein `Promise.all`, das zufällig grün wird, wäre kein Nachweis.
//
// GEMESSEN WIRD AM ECHTEN WEG: zwei angemeldete Menschen, eine echte App, die echte Route.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/**
 * Zwei Menschen an EINEM Wissensobjekt: Eva holt zurück, Ben schreibt dazwischen. Beide sind
 * Admins — an der FREMDHEIT ändert das nichts, und es hält die Rechtefrage aus diesem Fall heraus:
 * hier geht es um die Zeit, nicht um die Erlaubnis.
 */
async function zweiMenschen(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Eva", email: `eva@${marke}.test`, password: "geheim12345" },
  });
  const eva = await login(app, `eva@${marke}.test`, "geheim12345");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: eva,
    payload: {
      name: "Ben",
      email: `ben@${marke}.test`,
      password: "geheim12345",
      role: "admin",
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const ben = await login(app, `ben@${marke}.test`, "geheim12345");

  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: eva,
    payload: {
      // Ohne ausdrückliche Einstufung entsteht gar kein Wissensobjekt (`MISSING_CONFIDENTIALITY`).
      confidentiality: "intern",
      title: "Reinigung Spritzzone",
      statement: "Nur trocken abkehren.",
      type: "technik",
      category: "Produktion",
      bodyHtml: "<p>Frühere Anweisung: trocken abkehren.</p>",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;

  // v2 — der Stand, den Eva vor sich hat, als sie die Fassungsliste öffnet.
  const zweite = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: eva,
    payload: {
      action: "revise",
      changes: {
        statement: "Nach jeder Schicht nass reinigen.",
        bodyHtml: "<p>Aktuelle Anweisung: nass reinigen.</p>",
      },
    },
  });
  expect(zweite.statusCode, zweite.body).toBe(200);
  return { app, eva, ben, id };
}

const holen = async (app: App, wer: Auth, id: string) => {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
};

/** Evas Übernahme von v1 — gebunden an den Stand, den sie gesehen hat. */
const uebernehmen = (app: App, wer: Auth, id: string, gesehen: number) =>
  app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: wer,
    payload: {
      action: "revise",
      // RUNDE 3: nur die Fassungsnummer — den Inhalt holt der Dienst aus seiner eigenen Ablage.
      changes: { restoredFromVersion: 1 },
      expectedVersion: gesehen,
    },
  });

describe("JOB 4213 · A — fremde Arbeit wird nicht überschrieben", () => {
  it("die Übernahme wird abgewiesen, und der fremde Text steht unverändert da", async () => {
    const { app, eva, ben, id } = await zweiMenschen("wn-f1");

    // 1. Eva liest — das ist der Stand, an den sie ihre Übernahme bindet.
    const gesehen = (await holen(app, eva, id)).version as number;
    expect(gesehen).toBe(2);

    // 2. Ben schreibt VOLLSTÄNDIG. Erst wenn seine Antwort da ist, geht es weiter.
    const bensSchreiben = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: ben,
      payload: {
        action: "revise",
        changes: {
          statement: "Bens Ergänzung: zusätzlich die Dichtungen prüfen.",
          bodyHtml: "<p>Bens Ergänzung: zusätzlich die Dichtungen prüfen.</p>",
        },
      },
    });
    expect(bensSchreiben.statusCode, bensSchreiben.body).toBe(200);
    expect((await holen(app, eva, id)).version, "Bens Schreibvorgang ist nicht angekommen").toBe(3);

    // 3. Und JETZT erst sendet Eva.
    const evasUebernahme = await uebernehmen(app, eva, id, gesehen);
    expect(
      evasUebernahme.statusCode,
      `die Übernahme wurde angenommen, obwohl sich der Stand geändert hat: ${evasUebernahme.body}`,
    ).toBe(409);
    expect(evasUebernahme.json().error).toBe("KO_STALE");

    const danach = await holen(app, eva, id);
    expect(danach.version, "es ist doch eine Fassung entstanden").toBe(3);
    expect(danach.statement, "Bens Text wurde überschrieben").toBe(
      "Bens Ergänzung: zusätzlich die Dichtungen prüfen.",
    );
    expect(String(danach.bodyHtml)).toContain("Dichtungen");
  });

  it("Evas Vorhaben ist danach noch erreichbar — die alte Fassung liegt unverändert da", async () => {
    // „Die Absicht bleibt erhalten" heisst am Server: das, WORAUF sie zielt, ist noch da. Ein
    // abgewiesener Schreibvorgang, der nebenbei den Schnappschuss anfasste, nähme ihr den zweiten
    // Versuch. Die Ablage ist append-only, und dieser Fall hält das fest.
    const { app, eva, ben, id } = await zweiMenschen("wn-f2");
    const gesehen = (await holen(app, eva, id)).version as number;
    const bensSchreiben = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: ben,
      payload: { action: "revise", changes: { statement: "Bens Ergänzung." } },
    });
    expect(bensSchreiben.statusCode, bensSchreiben.body).toBe(200);
    expect((await uebernehmen(app, eva, id, gesehen)).statusCode).toBe(409);

    const liste = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/versions`,
      headers: eva,
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const v1 = (liste.json() as { version: number; snapshot: { statement: string } }[]).find(
      (f) => f.version === 1,
    );
    expect(v1?.snapshot.statement, "die Fassung, die Eva zurückholen wollte, ist verändert").toBe(
      "Nur trocken abkehren.",
    );

    // Und der zweite, ausdrückliche Griff — auf dem Stand, der JETZT wirklich gespeichert ist —
    // geht durch. Dass er ein eigener Griff ist, ist der Punkt: eine frisch gelesene Versionszahl
    // allein rechtfertigt kein Überschreiben (Lehre JOB 4163 R1).
    const jetzt = (await holen(app, eva, id)).version as number;
    const zweiterGriff = await uebernehmen(app, eva, id, jetzt);
    expect(zweiterGriff.statusCode, zweiterGriff.body).toBe(200);
    const danach = await holen(app, eva, id);
    expect(danach.statement).toBe("Nur trocken abkehren.");
    expect(danach.status, "der zweite Griff hat nebenbei freigegeben").toBe("offen");
  });
});

describe("JOB 4213 · B — GEGENPROBE: ohne fremden Schreibvorgang geht derselbe Ablauf durch", () => {
  it("die Übernahme von v1 erzeugt eine neue Fassung mit dem alten Inhalt", async () => {
    const { app, eva, id } = await zweiMenschen("wn-f3");
    const gesehen = (await holen(app, eva, id)).version as number;
    const res = await uebernehmen(app, eva, id, gesehen);
    expect(res.statusCode, res.body).toBe(200);

    const danach = await holen(app, eva, id);
    expect(danach.version).toBe(3);
    expect(danach.statement).toBe("Nur trocken abkehren.");
    expect(String(danach.bodyHtml)).toContain("trocken abkehren");
  });
});
