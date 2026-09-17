// ================================================================================================
// JOB 4251 (WIKI-ZUSAMMENARBEIT) · K2/K3/K4 — DIE ROUTE NIMMT DEN STEMPEL AN, ODER SAGT WARUM NICHT.
// ================================================================================================
//
// GEMESSEN WIRD AN DER AUSSENFLÄCHE, nicht am Dienst: echte Anmeldung, echtes Rechtegate, echter
// `PUT`. Was der Dienst zusagt, sagt über das Durchreichen nichts — an derselben Route wird ein
// Feld der Eingabe ausdrücklich weggeworfen (`sources` am `revise`), und genau diese Grenze ist der
// Grund, aus dem `tests/word-rueckweg/route-bedingter-schreibzugriff.test.ts` seit JOB 3667 hier
// misst und nicht eine Ebene tiefer.
//
// BENANNTE PRÜFLÜCKEN: In-Memory-Ablagen (`buildServices()`), `app.inject` statt eines echten
// Sockets, kein PostgreSQL. Die Verschränkung in K4 ist echt im Sinne der REIHENFOLGE (A liest,
// B schreibt vollständig dazwischen, A schreibt weiter) — nicht im Sinne zweier Betriebssysteme.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

async function anmelden(): Promise<{ app: App; a: Kopf; b: Kopf }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@klarwerk.test", password: "secret123" },
  });
  const a = await token(app, "anna@klarwerk.test");
  // Ein ECHTES zweites Konto: „jemand anderes" ist sonst nur eine Behauptung des Tests.
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: a,
    payload: {
      name: "Bernd",
      email: "bernd@klarwerk.test",
      password: "secret123",
      role: "admin",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return { app, a, b: await token(app, "bernd@klarwerk.test") };
}

async function token(app: App, email: string): Promise<Kopf> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function anlegen(app: App, kopf: Kopf): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      tags: ["ventil"],
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

type Stand = {
  version: number;
  tags: string[];
  category: string;
  statement: string;
  metadataRevision?: number;
};

/** Der Eintrag, wie ihn die Lesefläche bekommt — DAS Beweismittel dieser Datei. */
async function lesen(app: App, kopf: Kopf, id: string): Promise<Stand> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: kopf });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

function schreiben(
  app: App,
  kopf: Kopf,
  id: string,
  payload: Record<string, unknown>,
): Promise<Awaited<ReturnType<App["inject"]>>> {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: kopf, payload });
}

describe("JOB 4251 · K2 · die Route weist den überholten Stand ab, statt zu überschreiben", () => {
  it("K2a · B ändert die Schlagwörter, A schreibt mit dem gesehenen Stempel → 409 KO_STALE, Bs Liste steht noch da", async () => {
    const { app, a, b } = await anmelden();
    const id = await anlegen(app, a);

    // A liest — und bekommt den Stempel additiv am gewohnten Leseweg (Lieferung 2).
    const gesehenVonA = await lesen(app, a, id);
    expect(
      gesehenVonA.metadataRevision,
      "der Leseweg liefert den Stempel der Einordnung nicht",
    ).toBe(1);

    const bSchreibt = await schreiben(app, b, id, {
      action: "tags",
      tags: ["ventil", "ueberdruck"],
    });
    expect(bSchreibt.statusCode).toBe(200);
    // Die Antwort des eigenen Schreibvorgangs trägt den NEUEN Stand — sonst liefe der zweite
    // Schritt derselben Kette gegen sich selbst.
    expect((bSchreibt.json() as Stand).metadataRevision).toBe(2);
    // UND DIE FALLE, ausdrücklich gemessen: die Inhaltsfassung hat sich nicht bewegt.
    expect((await lesen(app, a, id)).version).toBe(gesehenVonA.version);

    const aSchreibt = await schreiben(app, a, id, {
      action: "tags",
      tags: ["ventil", "wartung"],
      expectedMetadataRevision: gesehenVonA.metadataRevision,
    });
    expect(aSchreibt.statusCode).toBe(409);
    expect((aSchreibt.json() as { error: string }).error).toBe("KO_STALE");

    const jetzt = await lesen(app, a, id);
    expect(jetzt.tags, "As alte Liste hat Bs Schlagwörter ersetzt").toEqual([
      "ventil",
      "ueberdruck",
    ]);
    expect(jetzt.metadataRevision, "der abgewiesene Aufruf hat den Stempel bewegt").toBe(2);
  });

  it("K2b · dasselbe an der Kategorie", async () => {
    const { app, a, b } = await anmelden();
    const id = await anlegen(app, a);
    const gesehenVonA = await lesen(app, a, id);

    expect(
      (await schreiben(app, b, id, { action: "category", category: "Anlage 7" })).statusCode,
    ).toBe(200);

    const aSchreibt = await schreiben(app, a, id, {
      action: "category",
      category: "Anlage 2",
      expectedMetadataRevision: gesehenVonA.metadataRevision,
    });
    expect(aSchreibt.statusCode).toBe(409);
    expect((await lesen(app, a, id)).category).toBe("Anlage 7");
  });

  it("K2c · stimmt der Stempel, schreibt die Route — und gibt den neuen Stand heraus", async () => {
    const { app, a } = await anmelden();
    const id = await anlegen(app, a);
    const gesehen = await lesen(app, a, id);

    const antwort = await schreiben(app, a, id, {
      action: "tags",
      tags: ["ventil", "wartung"],
      expectedMetadataRevision: gesehen.metadataRevision,
    });
    expect(antwort.statusCode).toBe(200);
    const koerper = antwort.json() as Stand;
    expect(koerper.tags).toEqual(["ventil", "wartung"]);
    expect(koerper.metadataRevision).toBe(2);
    expect((await lesen(app, a, id)).metadataRevision).toBe(2);
  });

  it("K2d · OHNE das Feld bleibt alles, wie es war — Word-Add-in und Importwege sind unberührt", async () => {
    const { app, a, b } = await anmelden();
    const id = await anlegen(app, a);
    expect((await schreiben(app, b, id, { action: "tags", tags: ["fremd"] })).statusCode).toBe(200);

    const ohne = await schreiben(app, a, id, { action: "tags", tags: ["alt"] });
    expect(ohne.statusCode).toBe(200);
    expect((await lesen(app, a, id)).tags).toEqual(["alt"]);
  });
});

describe("JOB 4251 · K3 · ein Unsinnswert schaltet den Schutz NICHT still ab", () => {
  it("K3a · jeder unlesbare Stand an `tags` ist ein 400, und nichts ist geschrieben", async () => {
    const { app, a } = await anmelden();
    const id = await anlegen(app, a);

    // `0` steht ausdrücklich dabei: es ist `METADATA_REVISION_NONE` — „für dieses Objekt gibt es
    // noch gar keine Zeile" —, nie ein gültiger Stand, den man erwarten könnte. Und `null` ist
    // KEINE Abwesenheit, sonst wäre ein JSON-`null` der stille Weg am Schutz vorbei.
    for (const unsinn of ["1", 0, -3, 1.5, null, Number.NaN, {}]) {
      const antwort = await schreiben(app, a, id, {
        action: "tags",
        tags: ["neu"],
        expectedMetadataRevision: unsinn,
      });
      expect(antwort.statusCode, JSON.stringify(unsinn)).toBe(400);
      expect((antwort.json() as { error: string }).error).toBe("BAD_REQUEST");
    }
    const jetzt = await lesen(app, a, id);
    expect(jetzt.tags).toEqual(["ventil"]);
    expect(jetzt.metadataRevision).toBe(1);
  });

  it("K3b · dasselbe an `category`", async () => {
    const { app, a } = await anmelden();
    const id = await anlegen(app, a);
    const antwort = await schreiben(app, a, id, {
      action: "category",
      category: "Anlage 2",
      expectedMetadataRevision: "1",
    });
    expect(antwort.statusCode).toBe(400);
    expect((await lesen(app, a, id)).category).toBe("Anlage 1");
  });
});

// ================================================================================================
// K4 · DIE VERSCHRÄNKUNG — A WIRD ZWISCHEN DEM LESEN UND DEM SCHREIBEN ANGEHALTEN.
// ================================================================================================
//
// WARUM NICHT EINFACH „NACHEINANDER": ein Test, der B vor A laufen lässt und danach A schreiben
// lässt, misst eine REIHENFOLGE. Der Fehler dieses Auftrags lebt aber im FENSTER zwischen dem
// Lesen des Stands und dem Schreiben — genau dort, wo ein Mensch tippt. Deshalb wird As Kette hier
// angehalten, NACHDEM A gelesen hat, und in diesem Fenster ändert B die Einordnung VOLLSTÄNDIG.
describe("JOB 4251 · K4 · im Fenster zwischen Lesen und Schreiben ändert B alles", () => {
  it("K4a · A läuft mit Erfolgsausgang weiter: der Text geht durch, die Einordnung wird abgewiesen, beide Felder von B stehen", async () => {
    const { app, a, b } = await anmelden();
    const id = await anlegen(app, a);

    // A liest — und hält an. Genau hier steht der Mensch vor seinem Formular.
    const gesehenVonA = await lesen(app, a, id);

    // IM FENSTER: B ändert Kategorie UND Schlagwörter vollständig.
    expect(
      (await schreiben(app, b, id, { action: "category", category: "Anlage 7" })).statusCode,
    ).toBe(200);
    expect(
      (await schreiben(app, b, id, { action: "tags", tags: ["ueberdruck", "bernd"] })).statusCode,
    ).toBe(200);

    // A LÄUFT WEITER — die ganze Kette der Lesefläche, in ihrer Reihenfolge.
    const revidiert = await schreiben(app, a, id, {
      action: "revise",
      changes: { statement: "Bei Überdruck Ventil X ZUERST entlasten." },
      expectedVersion: gesehenVonA.version,
    });
    expect(revidiert.statusCode, "B hat den INHALT nicht angefasst — der `revise` muss durch").toBe(
      200,
    );
    const tags = await schreiben(app, a, id, {
      action: "tags",
      tags: ["ventil", "wartung"],
      expectedMetadataRevision: gesehenVonA.metadataRevision,
    });
    expect(tags.statusCode).toBe(409);

    // DAS ERGEBNIS, UM DAS ES GEHT: beide Felder von B unverändert, kein Feld verloren, kein
    // Mischzustand — und As Text ist trotzdem gespeichert.
    const jetzt = await lesen(app, a, id);
    expect(jetzt.category, "Bs Kategorie ist verloren").toBe("Anlage 7");
    expect(jetzt.tags, "Bs Schlagwörter sind verloren").toEqual(["ueberdruck", "bernd"]);
    expect(jetzt.statement).toContain("ZUERST entlasten");
  });

  it("K4b · A läuft mit gescheitertem Folgeaufruf weiter: auch der zweite Griff überfährt B nicht", async () => {
    const { app, a, b } = await anmelden();
    const id = await anlegen(app, a);
    const gesehenVonA = await lesen(app, a, id);

    // As erster Griff: der Text geht durch, die Einordnung ist noch offen (der `tags`-Aufruf
    // scheitert hier an einem Wert, den die Route nicht annimmt — ein Abbruch wie jeder andere).
    expect(
      (
        await schreiben(app, a, id, {
          action: "revise",
          changes: { statement: "Erster Griff." },
          expectedVersion: gesehenVonA.version,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await schreiben(app, a, id, {
          action: "tags",
          tags: ["ventil", "wartung"],
          expectedMetadataRevision: 0,
        })
      ).statusCode,
    ).toBe(400);

    // IM FENSTER vor dem zweiten Griff ändert B die Einordnung vollständig.
    expect(
      (await schreiben(app, b, id, { action: "category", category: "Anlage 7" })).statusCode,
    ).toBe(200);
    expect(
      (await schreiben(app, b, id, { action: "tags", tags: ["ueberdruck", "bernd"] })).statusCode,
    ).toBe(200);

    // As ZWEITER Griff holt den offenen Schritt nach — mit dem Stand, den A kennt.
    const zweiter = await schreiben(app, a, id, {
      action: "tags",
      tags: ["ventil", "wartung"],
      expectedMetadataRevision: gesehenVonA.metadataRevision,
    });
    expect(zweiter.statusCode).toBe(409);

    const jetzt = await lesen(app, a, id);
    expect(jetzt.category).toBe("Anlage 7");
    expect(jetzt.tags).toEqual(["ueberdruck", "bernd"]);
  });
});

// ================================================================================================
// K6-ROUTE · DER GEWACHSENE VERTRAG, VON DER ANDEREN SEITE.
// ================================================================================================
//
// Lieferung 6 sagt: bedingt sind `revise`, `tags`, `category`. Was der Stempel der EINORDNUNG an
// `revise` soll, ist damit ebenfalls beantwortet — nichts: der Inhaltsweg fasst die
// Metadatenprojektion gar nicht an. Ein dort stillschweigend geschluckter Schutz wäre schlimmer als
// gar keiner. Die Gegenrichtung (`expectedVersion` an fremden Aktionen) pinnt F5 nebenan.
describe("JOB 4251 · der Stempel wirkt nur dort, wo eine Einordnung geschrieben wird", () => {
  it("an `revise` ist `expectedMetadataRevision` ein 400 — kein stilles Schlucken", async () => {
    const { app, a } = await anmelden();
    const id = await anlegen(app, a);
    const antwort = await schreiben(app, a, id, {
      action: "revise",
      changes: { statement: "Neu." },
      expectedMetadataRevision: 1,
    });
    expect(antwort.statusCode).toBe(400);
    expect((antwort.json() as { message: string }).message).toContain("expectedMetadataRevision");
    expect((await lesen(app, a, id)).version).toBe(1);
  });

  it("an einer wirklich fremden Aktion ebenfalls 400", async () => {
    const { app, a } = await anmelden();
    const id = await anlegen(app, a);
    const antwort = await schreiben(app, a, id, {
      action: "comment",
      text: "Bitte um Zweitprüfung.",
      expectedMetadataRevision: 1,
    });
    expect(antwort.statusCode).toBe(400);
    expect((antwort.json() as { message: string }).message).toContain("expectedMetadataRevision");
  });

  it("und `expectedVersion` gilt an `tags`/`category` jetzt WIRKLICH — nicht bloss angenommen", async () => {
    const { app, a, b } = await anmelden();
    const id = await anlegen(app, a);
    const gesehen = await lesen(app, a, id);

    // Jemand Fremdes revidiert den INHALT. Die Einordnung bleibt unberührt — ihr Stempel stimmt
    // also noch; abgewiesen wird dieser Aufruf ausschliesslich wegen der Inhaltsfassung.
    expect(
      (await schreiben(app, b, id, { action: "revise", changes: { statement: "Fremd." } }))
        .statusCode,
    ).toBe(200);

    const antwort = await schreiben(app, a, id, {
      action: "tags",
      tags: ["ventil", "wartung"],
      expectedMetadataRevision: gesehen.metadataRevision,
      expectedVersion: gesehen.version,
    });
    expect(antwort.statusCode).toBe(409);
    expect((await lesen(app, a, id)).tags).toEqual(["ventil"]);
  });
});
