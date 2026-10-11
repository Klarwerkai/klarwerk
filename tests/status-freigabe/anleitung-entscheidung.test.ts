// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · WER HAT WANN WELCHE FASSUNG DER ANLEITUNG ENTSCHIEDEN?
// ================================================================================================
//
// Originalkriterien dieses Prüfstands:
//   K3 · Neue Anleitungsfreigabe zeigt tatsächlich handelnde Person, Zeitpunkt und Fassung auch nach
//        Reload.
//   K4 · Unbekannte historische Freigabeperson wird nicht erfunden.
//
// Der ECHTE Dienst über der Testablage aus `tests/wiki-gesamtanweisung/pruefstand.ts` und das ECHTE
// Plugin auf einer frischen Fastify-Instanz mit der echten Rechtematrix (`can`). „Reload" heisst
// hier: ein NEUER Dienst über derselben Ablage liest den Bestand erneut — die Angaben kommen aus
// dem gespeicherten Datensatz, nicht aus dem Speicher des ersten Dienstes. Die haltbare
// Postgres-Ablage prüft `anleitung-entscheidung-postgres.integration.test.ts`.
//
// GEGENPROBEN (benannt, nicht gefahren):
//   · In `alsEntschieden` das `entscheidung`-Feld nicht setzen → K3-Fälle werden rot.
//   · In der Route statt `user.id` den Körperwert `von` durchreichen → der Fall „aus der Anmeldung,
//     nie aus dem Körper" wird rot.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { gesamtanweisungRoutes } from "../../services/app/src/routes/gesamtanweisung-routes";
import {
  GesamtanweisungDienst,
  alsEntschieden,
} from "../../services/knowledge-object/src/gesamtanweisung-service";
import type {
  Anweisung,
  AnweisungLesestand,
} from "../../services/knowledge-object/src/gesamtanweisung-types";
import { can } from "../../services/rbac";
import {
  InMemoryAnweisungRepo,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const CARLA = sichtbarAls({ id: "carla", darfPruefen: true });
const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Druck einstellen", version: 1 }, [{ version: 1 }]),
];

/**
 * Das geteilte Double kennt `liste` nicht — der Dienst meldet dann ehrlich „nicht aufzählbar"
 * statt eines leeren Bestands (`auflisten`). Für die Listenaussage dieses Prüfstands wird die
 * Aufzählung hier ergänzt: sie gibt nur zurück, was `get` liefert — keine eigene Regel.
 */
class AufzaehlbareAblage extends InMemoryAnweisungRepo {
  private readonly ids = new Set<string>();

  override async anlegen(...args: Parameters<InMemoryAnweisungRepo["anlegen"]>): Promise<void> {
    await super.anlegen(...args);
    this.ids.add(args[0].id);
  }

  async liste(): Promise<readonly Anweisung[]> {
    const alle: Anweisung[] = [];
    for (const id of this.ids) {
      const a = await this.get(id);
      if (a) {
        alle.push(a);
      }
    }
    return alle;
  }
}

function dienstUeber(repo: InMemoryAnweisungRepo): GesamtanweisungDienst {
  return new GesamtanweisungDienst({
    repo,
    ko: koLeser(EINTRAEGE),
    jetzt: uhr(),
    kennung: kennungen("b"),
  });
}

/** Eine vorgelegte Anleitung mit einem Abschnitt. */
async function vorgelegt(dienst: GesamtanweisungDienst): Promise<Anweisung> {
  let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
  a = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-a", koVersion: 1, nachweisHash: null },
    CARLA,
  );
  return dienst.vorlegen(a.id, a.version, CARLA);
}

describe("K3 · eine neue Freigabe hält Person, Zeitpunkt und Fassung fest", () => {
  it("Annahme: Person, Zeitpunkt und freigegebene Fassung — im Lesestand UND in der Liste", async () => {
    const repo = new AufzaehlbareAblage();
    const dienst = dienstUeber(repo);
    const a = await vorgelegt(dienst);

    const entschieden = await dienst.entscheiden(a.id, a.version, "angenommen", CARLA, "carla");
    expect(entschieden.stand).toBe("entschieden");
    expect(entschieden.entscheidung).toEqual({
      ergebnis: "angenommen",
      von: "carla",
      am: entschieden.geaendertAm,
      version: entschieden.version,
    });
    // Die Urheberin ist NICHT die freigebende Person — sie wird hier nicht eingesetzt.
    expect(entschieden.urheber).toBe("anna");

    const stand = await dienst.lesen(a.id, CARLA);
    expect(stand.entscheidung).toEqual(entschieden.entscheidung);
    const liste = await dienst.auflisten(CARLA);
    expect(liste.eintraege[0]?.entscheidung).toEqual(entschieden.entscheidung);
  });

  it("nach „Reload“ (neuer Dienst, derselbe Bestand) stehen dieselben Angaben da", async () => {
    const repo = new AufzaehlbareAblage();
    const a = await vorgelegt(dienstUeber(repo));
    const entschieden = await dienstUeber(repo).entscheiden(
      a.id,
      a.version,
      "angenommen",
      CARLA,
      "carla",
    );
    const neu = dienstUeber(repo);
    const stand = await neu.lesen(a.id, CARLA);
    expect(stand.stand).toBe("entschieden");
    expect(stand.version).toBe(entschieden.version);
    expect(stand.entscheidung).toEqual({
      ergebnis: "angenommen",
      von: "carla",
      am: entschieden.geaendertAm,
      version: entschieden.version,
    });
  });

  it("Ablehnung wird ebenso festgehalten; eine spätere Annahme ersetzt sie vollständig", async () => {
    const repo = new AufzaehlbareAblage();
    const dienst = dienstUeber(repo);
    const a = await vorgelegt(dienst);
    const abgelehnt = await dienst.entscheiden(a.id, a.version, "abgelehnt", CARLA, "carla");
    expect(abgelehnt.entscheidung).toMatchObject({ ergebnis: "abgelehnt", von: "carla" });

    const erneut = await dienst.vorlegen(a.id, abgelehnt.version, CARLA);
    const angenommen = await dienst.entscheiden(a.id, erneut.version, "angenommen", CARLA, "dora");
    expect(angenommen.entscheidung).toEqual({
      ergebnis: "angenommen",
      von: "dora",
      am: angenommen.geaendertAm,
      version: angenommen.version,
    });
  });
});

describe("K4 · eine unbekannte Freigabeperson wird nicht erfunden", () => {
  it("ohne angemeldete Person entsteht keine Angabe — weder Urheber noch Platzhalter", async () => {
    const repo = new AufzaehlbareAblage();
    const dienst = dienstUeber(repo);
    const a = await vorgelegt(dienst);
    const entschieden = await dienst.entscheiden(a.id, a.version, "angenommen", CARLA);
    expect(entschieden.stand).toBe("entschieden");
    expect("entscheidung" in entschieden).toBe(false);
    const stand = await dienst.lesen(a.id, CARLA);
    expect("entscheidung" in stand).toBe(false);
    const zeile = (await dienst.auflisten(CARLA)).eintraege[0];
    expect(zeile).toBeDefined();
    expect(zeile?.entscheidung).toBeUndefined();
  });

  it("eine frühere Angabe wandert nicht auf eine neue Entscheidung ohne Person", () => {
    const basis: Anweisung = {
      id: "a-alt",
      titel: "Alt",
      zweck: "",
      geltungsbereich: "",
      voraussetzungen: "",
      bausteine: [],
      stand: "vorgelegt",
      version: 4,
      urheber: "anna",
      erstelltAm: "2026-09-01T08:00:00.000Z",
      geaendertAm: "2026-09-02T08:00:00.000Z",
      entscheidung: {
        ergebnis: "abgelehnt",
        von: "carla",
        am: "2026-09-02T07:00:00.000Z",
        version: 3,
      },
    };
    const neu = alsEntschieden(basis, 4, "angenommen", "2026-09-03T08:00:00.000Z");
    expect(neu.stand).toBe("entschieden");
    expect("entscheidung" in neu).toBe(false);
  });

  it("Altbestand (entschieden, ohne Angabe) wird ohne Angabe ausgeliefert", async () => {
    const repo = new AufzaehlbareAblage();
    const dienst = dienstUeber(repo);
    const a = await vorgelegt(dienst);
    // Der Zustand VOR diesem Auftrag: entschieden, aber niemand festgehalten.
    await dienst.entscheiden(a.id, a.version, "angenommen", CARLA);
    const stand = await dienstUeber(repo).lesen(a.id, CARLA);
    expect(stand.stand).toBe("entschieden");
    expect(stand.entscheidung).toBeUndefined();
    expect(JSON.stringify(stand)).not.toContain('"von"');
  });
});

// ================================================================================================
// DIE TÜR — `POST /api/gesamtanweisungen/:id/entscheiden`
// ================================================================================================

function testGuards(aktuell: () => SessionUser | null): Guards {
  return {
    async requireUser(_request, reply) {
      const user = aktuell();
      if (!user) {
        reply.code(401).send({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
        return undefined;
      }
      return user;
    },
    async requirePermission(permission, _request, reply) {
      const user = aktuell();
      if (!user) {
        reply.code(401).send({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
        return undefined;
      }
      if (!can(user.role, permission)) {
        reply.code(403).send({ error: "FORBIDDEN", message: "Keine Berechtigung." });
        return undefined;
      }
      return user;
    },
  };
}

describe("K3 · am Draht: die Person kommt aus der Anmeldung, nie aus dem Körper", () => {
  let app: FastifyInstance;
  let nutzer: SessionUser | null;
  let repo: InMemoryAnweisungRepo;
  let anweisung: Anweisung;

  beforeEach(async () => {
    repo = new AufzaehlbareAblage();
    anweisung = await vorgelegt(dienstUeber(repo));
    nutzer = { id: "carla", role: "controller" };
    app = Fastify();
    await app.register(gesamtanweisungRoutes, {
      dienst: dienstUeber(repo),
      guards: testGuards(() => nutzer),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("Controller entscheidet: gespeichert ist die angemeldete Person, ein Körperwert zählt nicht", async () => {
    const antwort = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${anweisung.id}/entscheiden`,
      payload: { version: anweisung.version, entscheidung: "angenommen", von: "mallory" },
    });
    expect(antwort.statusCode).toBe(200);
    const neu = antwort.json() as Anweisung;
    expect(neu.entscheidung).toEqual({
      ergebnis: "angenommen",
      von: "carla",
      am: neu.geaendertAm,
      version: neu.version,
    });

    // Reload über die Tür: derselbe Bestand, eine neue Anfrage.
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/gesamtanweisungen/${anweisung.id}`,
    });
    const stand = gelesen.json() as AnweisungLesestand;
    expect(stand.entscheidung).toEqual(neu.entscheidung);
    expect(JSON.stringify(stand)).not.toContain("mallory");
  });

  it("ohne Prüfrecht wird nichts entschieden und nichts festgehalten", async () => {
    nutzer = { id: "erika", role: "experte" };
    const abdruck = repo.abdruck();
    const antwort = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${anweisung.id}/entscheiden`,
      payload: { version: anweisung.version, entscheidung: "angenommen" },
    });
    expect(antwort.statusCode).toBe(403);
    expect(repo.abdruck()).toBe(abdruck);
    expect((await repo.get(anweisung.id))?.entscheidung).toBeUndefined();
  });
});
