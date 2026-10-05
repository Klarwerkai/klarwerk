// ================================================================================================
// QUELLENÄNDERUNGEN (aufnahme:20260928) · DIENST UND TÜR — ERKENNEN, ANSEHEN, BEWUSST ÜBERNEHMEN.
// ================================================================================================
//
// Der ECHTE Dienst über der Testablage aus `tests/wiki-gesamtanweisung/pruefstand.ts` und das ECHTE
// Plugin auf einer frischen Fastify-Instanz mit der echten Rechtematrix (`can`). Die Quelle ist ein
// veränderlicher Eintragsbestand: eine neuere Fassung wird hier wirklich „veröffentlicht".
//
// Belegt werden die Originalkriterien K2, K4, K5, K6, K7 und K8 auf Dienst- und Drahtebene. Die
// Bedienung am DOM steht in `oberflaeche.test.tsx`, Postgres in `postgres.integration.test.ts`.
//
// GEGENPROBEN (benannt, nicht gefahren):
//   · `mitUebernommenerFassung` ohne `stand: "entwurf"` → K6 „frühere Entscheidung wird nicht
//     übertragen" wird rot.
//   · In `aenderungspruefungAus` den Zweig `fehlgeschlagen` entfernen → K7 „Ausfall ist nie aktuell"
//     wird rot.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { gesamtanweisungRoutes } from "../../services/app/src/routes/gesamtanweisung-routes";
import {
  type AnweisungKoLeser,
  GesamtanweisungDienst,
} from "../../services/knowledge-object/src/gesamtanweisung-service";
import type { AnweisungLesestand } from "../../services/knowledge-object/src/gesamtanweisung-types";
import { can } from "../../services/rbac";
import {
  InMemoryAnweisungRepo,
  type PruefEintrag,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });
const BERT = sichtbarAls({ id: "bert", darfPruefen: false });

const V1 = { version: 1, bodyHtml: "<p>Druck auf 4 bar.</p>", category: "Werk 1" };
const V2 = { version: 2, bodyHtml: "<p>Druck auf 5 bar.</p>", category: "Werk 1" };

/** Der Eintragsbestand, an dem eine neuere Fassung veröffentlicht werden kann. */
function quelle(start: readonly PruefEintrag[]) {
  const bestand = new Map(start.map((e) => [e.id, e]));
  const ausfall = new Set<string>();
  const leser: AnweisungKoLeser = {
    async get(id) {
      if (ausfall.has(id)) {
        throw new Error("Quelle nicht erreichbar");
      }
      return koLeser([...bestand.values()]).get(id);
    },
    async versionsOf(id) {
      return koLeser([...bestand.values()]).versionsOf(id);
    },
  };
  return {
    leser,
    ausfall,
    veroeffentliche(neu: PruefEintrag): void {
      bestand.set(neu.id, neu);
    },
  };
}

function bau(start: readonly PruefEintrag[]) {
  const q = quelle(start);
  const repo = new InMemoryAnweisungRepo();
  const dienst = new GesamtanweisungDienst({
    repo,
    ko: q.leser,
    jetzt: uhr(),
    kennung: kennungen("b"),
  });
  return { ...q, repo, dienst };
}

/** Eine Anleitung mit Abschnitt ko-a@1 und ko-b@1, danach erscheint ko-a@2. */
async function mitNeuererFassung(entschieden = false) {
  const umgebung = bau([
    eintrag({ id: "ko-a", title: "Druck einstellen", version: 1 }, [V1]),
    eintrag({ id: "ko-b", title: "Ventil prüfen", version: 1 }, [{ version: 1 }]),
  ]);
  const { dienst } = umgebung;
  let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
  a = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-a", koVersion: 1, nachweisHash: "h-a1" },
    ANNA,
  );
  a = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-b", koVersion: 1, nachweisHash: "h-b1" },
    ANNA,
  );
  if (entschieden) {
    a = await dienst.vorlegen(a.id, a.version, ANNA);
    a = await dienst.entscheiden(a.id, a.version, "angenommen", ANNA);
  }
  const neuere = eintrag({ id: "ko-a", title: "Druck einstellen", version: 2 }, [V1, V2]);
  umgebung.veroeffentliche(neuere);
  return { ...umgebung, anweisung: a };
}

function abschnitt(stand: AnweisungLesestand, koId: string) {
  const b = stand.bausteine.find((x) => x.koId === koId);
  expect(b, `Abschnitt zu ${koId} fehlt`).toBeTruthy();
  return b as NonNullable<typeof b>;
}

describe("K2/K5 · eine neuere Quellenfassung wird gezeigt — die verwendete bleibt erkennbar", () => {
  it("der betroffene Abschnitt nennt verwendete UND neuere Fassung, Text bleibt der alte", async () => {
    const { dienst, anweisung, repo } = await mitNeuererFassung();
    const vorher = repo.schreibvorgaenge;

    const stand = await dienst.lesen(anweisung.id, ANNA);
    const a = abschnitt(stand, "ko-a");
    expect(a.koVersion).toBe(1);
    expect(a.aktuelleKoVersion).toBe(2);
    expect(a.aktualisierungsvorschlag).toEqual({ aufVersion: 2 });
    expect(a.rumpfHtml).toContain("4 bar");
    expect(a.rumpfHtml).not.toContain("5 bar");
    // Der nicht betroffene Abschnitt trägt keinen Vorschlag.
    expect(abschnitt(stand, "ko-b").aktualisierungsvorschlag).toBeNull();

    // Lesen ändert nichts — auch nicht dreimal hintereinander (keine automatische Übernahme).
    await dienst.lesen(anweisung.id, ANNA);
    await dienst.lesen(anweisung.id, ANNA);
    expect(repo.schreibvorgaenge).toBe(vorher);
    expect(abschnitt(await dienst.lesen(anweisung.id, ANNA), "ko-a").koVersion).toBe(1);
  });
});

describe("K4 · bewusste Übernahme erzeugt einen neuen Stand, frühere bleiben", () => {
  it("Übernahme: neue Version, neue Bindung, alte Stände unverändert lesbar", async () => {
    const { dienst, anweisung, repo } = await mitNeuererFassung();
    const bausteinA = anweisung.bausteine.find((b) => b.koId === "ko-a");
    const vorherStaende = await repo.staende(anweisung.id);
    const vorherAufnahme = await repo.standLesen(anweisung.id, anweisung.version);

    const neu = await dienst.fassungUebernehmen(
      anweisung.id,
      anweisung.version,
      bausteinA?.id ?? "",
      2,
      null,
      ANNA,
    );
    expect(neu.version).toBe(anweisung.version + 1);
    expect(neu.bausteine.find((b) => b.koId === "ko-a")?.koVersion).toBe(2);
    // Der alte Nachweis belegt eine andere Fassung und wird nicht weitergetragen.
    expect(neu.bausteine.find((b) => b.koId === "ko-a")?.nachweisHash).toBeNull();
    // Nur dieser Abschnitt wechselt.
    expect(neu.bausteine.find((b) => b.koId === "ko-b")?.koVersion).toBe(1);

    expect(await repo.staende(anweisung.id)).toEqual([...vorherStaende, neu.version]);
    expect(await repo.standLesen(anweisung.id, anweisung.version)).toEqual(vorherAufnahme);

    const vergleich = await dienst.vergleichen(anweisung.id, anweisung.version, neu.version, ANNA);
    expect(vergleich.gesamt).toBe("geaendert");
    const befund = vergleich.befunde.find(
      (b) => b.feld === "fassung" && b.bausteinId === bausteinA?.id,
    );
    expect(befund?.auswirkung).toBe("geaendert");

    const stand = await dienst.lesen(anweisung.id, ANNA);
    expect(abschnitt(stand, "ko-a").rumpfHtml).toContain("5 bar");
    expect(abschnitt(stand, "ko-a").aktualisierungsvorschlag).toBeNull();
    expect(stand.uebernommeneAenderungen).toEqual([
      {
        bausteinId: bausteinA?.id,
        vonFassung: 1,
        aufFassung: 2,
        anweisungVersion: neu.version,
        uebernommenAm: expect.any(String),
      },
    ]);
  });

  it("ohne Übernahme gibt es keine übernommene Änderung — gefunden ist nicht übernommen", async () => {
    const { dienst, anweisung } = await mitNeuererFassung();
    const stand = await dienst.lesen(anweisung.id, ANNA);
    expect(stand.aenderungspruefung.gefundeneAenderungen).toBe(1);
    expect(stand.uebernommeneAenderungen).toEqual([]);
  });

  it("rückwärts, gleich, unbelegt oder auf veraltetem Stand: abgelehnt, nichts geschrieben", async () => {
    const { dienst, anweisung, repo } = await mitNeuererFassung();
    const id = anweisung.bausteine.find((b) => b.koId === "ko-a")?.id ?? "";
    const abdruck = repo.abdruck();

    await expect(
      dienst.fassungUebernehmen(anweisung.id, anweisung.version, id, 1, null, ANNA),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(
      dienst.fassungUebernehmen(anweisung.id, anweisung.version, id, 7, null, ANNA),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(
      dienst.fassungUebernehmen(anweisung.id, anweisung.version - 1, id, 2, null, ANNA),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      dienst.fassungUebernehmen(anweisung.id, anweisung.version, "gibt-es-nicht", 2, null, ANNA),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(repo.abdruck()).toBe(abdruck);
  });
});

describe("K6 · Kontoregel — eine frühere Entscheidung wird nicht auf geänderte Inhalte übertragen", () => {
  it("eine entschiedene Anleitung wird durch die Übernahme wieder Entwurf", async () => {
    const { dienst, anweisung } = await mitNeuererFassung(true);
    expect(anweisung.stand).toBe("entschieden");
    const id = anweisung.bausteine.find((b) => b.koId === "ko-a")?.id ?? "";

    const neu = await dienst.fassungUebernehmen(anweisung.id, anweisung.version, id, 2, null, ANNA);
    expect(neu.stand).toBe("entwurf");
    // Entscheiden geht erst wieder nach dem Vorlegen — der Weg der bestehenden Kontoregel.
    await expect(
      dienst.entscheiden(anweisung.id, neu.version, "angenommen", ANNA),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const vorgelegt = await dienst.vorlegen(anweisung.id, neu.version, ANNA);
    const entschieden = await dienst.entscheiden(
      anweisung.id,
      vorgelegt.version,
      "angenommen",
      ANNA,
    );
    expect(entschieden.stand).toBe("entschieden");
  });

  it("andere Änderungen an einer entschiedenen Anleitung bleiben gesperrt", async () => {
    const { dienst, anweisung } = await mitNeuererFassung(true);
    await expect(
      dienst.kopfAendern(anweisung.id, anweisung.version, { zweck: "neu" }, ANNA),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("wer die Quelle nicht sehen darf, kann sie nicht übernehmen — und erfährt nichts", async () => {
    const umgebung = bau([
      eintrag({ id: "ko-v", title: "Vertraulich", version: 1, author: "anna" }, [{ version: 1 }]),
    ]);
    const { dienst, repo } = umgebung;
    let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
    a = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-v", koVersion: 1, nachweisHash: null },
      ANNA,
    );
    umgebung.veroeffentliche(
      eintrag(
        {
          id: "ko-v",
          title: "Vertraulich",
          version: 2,
          author: "anna",
          confidentiality: "vertraulich",
        },
        [{ version: 1 }, { version: 2, confidentiality: "vertraulich" }],
      ),
    );
    const abdruck = repo.abdruck();
    const id = a.bausteine[0]?.id ?? "";
    await expect(
      dienst.fassungUebernehmen(a.id, a.version, id, 2, null, BERT),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.abdruck()).toBe(abdruck);

    // Und im Lesestand des Fremden steht weder der Abschnitt noch ein „aktuell".
    const fremd = await dienst.lesen(a.id, BERT);
    expect(fremd.bausteine).toHaveLength(0);
    expect(fremd.aenderungspruefung.ergebnis).toBe("unvollstaendig");
    expect(fremd.aenderungspruefung.gefundeneAenderungen).toBe(0);
  });
});

describe("K7 · letzte Prüfung: Zeitpunkt, Ergebnis — ein Ausfall ist nie „aktuell“", () => {
  it("alles aktuell: Zeitpunkt gesetzt, Ergebnis aktuell, keine automatische Überwachung", async () => {
    const { dienst } = bau([eintrag({ id: "ko-a", version: 1 }, [V1])]);
    let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
    a = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: null },
      ANNA,
    );
    const stand = await dienst.lesen(a.id, ANNA);
    expect(stand.aenderungspruefung).toEqual({
      pruefzeitpunkt: expect.stringMatching(/^2026-09-15T12:00:\d\d\.000Z$/),
      ergebnis: "aktuell",
      gefundeneAenderungen: 0,
      fehlgeschlageneQuellen: 0,
      ueberwachung: "nicht_eingerichtet",
    });
  });

  it("gefundene Änderung: Ergebnis und Zahl stehen getrennt von den übernommenen", async () => {
    const { dienst, anweisung } = await mitNeuererFassung();
    const stand = await dienst.lesen(anweisung.id, ANNA);
    expect(stand.aenderungspruefung.ergebnis).toBe("aenderungen_gefunden");
    expect(stand.aenderungspruefung.gefundeneAenderungen).toBe(1);
    expect(stand.uebernommeneAenderungen).toEqual([]);
  });

  it("eine nicht erreichbare Quelle: fehlgeschlagen, nie aktuell", async () => {
    const { dienst, anweisung, ausfall } = await mitNeuererFassung();
    // Die Quelle mit der NEUEREN Fassung bleibt lesbar — trotzdem darf das Ergebnis nicht
    // „Änderungen gefunden" oder gar „aktuell" lauten, weil eine andere Quelle ausfiel.
    ausfall.add("ko-b");
    const stand = await dienst.lesen(anweisung.id, ANNA);
    expect(stand.aenderungspruefung.ergebnis).toBe("fehlgeschlagen");
    expect(stand.aenderungspruefung.fehlgeschlageneQuellen).toBe(1);
    expect(JSON.stringify(stand.aenderungspruefung)).not.toContain('"aktuell"');
  });

  it("eine unlesbare Historie macht die übernommenen Änderungen unbekannt, nicht leer", async () => {
    const { dienst, anweisung, repo } = await mitNeuererFassung();
    repo.standLesen = async () => undefined;
    const stand = await dienst.lesen(anweisung.id, ANNA);
    expect(stand.uebernommeneAenderungen).toBeNull();
  });
});

describe("K8 · eine hochgeladene Datei ist als Momentaufnahme gekennzeichnet", () => {
  it("nur Belegstellen mit bestätigtem Anhang, aus der GEBUNDENEN Fassung", async () => {
    const { dienst } = bau([
      eintrag({ id: "ko-a", version: 1 }, [
        {
          version: 1,
          sources: [
            { label: "Wartungsplan.pdf", objectId: "obj-1", at: "2026-09-01T08:00:00.000Z" },
            { label: "Herstellerseite", objectId: null, at: "2026-09-01T08:00:00.000Z" },
          ],
        },
      ]),
      eintrag({ id: "ko-b", version: 1 }, [{ version: 1 }]),
    ]);
    let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
    for (const koId of ["ko-a", "ko-b"]) {
      a = await dienst.bausteinAufnehmen(
        a.id,
        a.version,
        { koId, koVersion: 1, nachweisHash: null },
        ANNA,
      );
    }
    const stand = await dienst.lesen(a.id, ANNA);
    expect(abschnitt(stand, "ko-a").momentaufnahmen).toEqual([
      { bezeichnung: "Wartungsplan.pdf", erfasstAm: "2026-09-01T08:00:00.000Z" },
    ]);
    // Ohne Belegliste ist es unbekannt — nicht „keine".
    expect(abschnitt(stand, "ko-b").momentaufnahmen).toBeNull();
    // Und eine Überwachung wird nicht behauptet.
    expect(stand.aenderungspruefung.ueberwachung).toBe("nicht_eingerichtet");
  });
});

describe("K8 · Anhang und Belegstelle derselben Datei (Nacharbeit 3, BEN F2)", () => {
  it("ein Anhang ohne Belegstelle zählt; Anhang plus Belegstelle derselben Kennung erscheint EINMAL", async () => {
    const anhang = {
      id: "att-1",
      objectId: "obj-1",
      name: "Wartungsplan.pdf",
      mime: "application/pdf",
      author: "anna",
      at: "2026-09-01T08:00:00.000Z",
    };
    const foto = {
      ...anhang,
      id: "att-2",
      objectId: "obj-2",
      name: "Foto.jpg",
      mime: "image/jpeg",
    };
    const { dienst } = bau([
      eintrag({ id: "ko-a", version: 1 }, [
        {
          version: 1,
          attachments: [anhang, foto],
          sources: [
            { label: "Beleg zum Plan", objectId: "obj-1", at: "2026-09-01T08:00:00.000Z" },
            { label: "Beleg ohne Anhang", objectId: "obj-9", at: "2026-09-01T09:00:00.000Z" },
          ],
        },
      ]),
    ]);
    let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
    a = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: null },
      ANNA,
    );
    const stand = await dienst.lesen(a.id, ANNA);
    expect(abschnitt(stand, "ko-a").momentaufnahmen).toEqual([
      { bezeichnung: "Wartungsplan.pdf", erfasstAm: "2026-09-01T08:00:00.000Z" },
      { bezeichnung: "Foto.jpg", erfasstAm: "2026-09-01T08:00:00.000Z" },
      { bezeichnung: "Beleg ohne Anhang", erfasstAm: "2026-09-01T09:00:00.000Z" },
    ]);
  });
});

// ================================================================================================
// DIE TÜR —`POST /api/gesamtanweisungen/:id/bausteine/:bausteinId/uebernehmen`
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

describe("K4/K6 · die Tür am Draht", () => {
  let app: FastifyInstance;
  let nutzer: SessionUser | null;
  let umgebung: Awaited<ReturnType<typeof mitNeuererFassung>>;

  beforeEach(async () => {
    umgebung = await mitNeuererFassung(true);
    nutzer = { id: "erika", role: "experte" };
    app = Fastify();
    await app.register(gesamtanweisungRoutes, {
      dienst: umgebung.dienst,
      guards: testGuards(() => nutzer),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("experte übernimmt (ko.create), darf danach aber nicht entscheiden (ko.validate)", async () => {
    const { anweisung } = umgebung;
    const id = anweisung.bausteine.find((b) => b.koId === "ko-a")?.id ?? "";
    const antwort = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${anweisung.id}/bausteine/${id}/uebernehmen`,
      payload: { version: anweisung.version, aufVersion: 2 },
    });
    expect(antwort.statusCode).toBe(200);
    const neu = antwort.json() as { version: number; stand: string };
    expect(neu.stand).toBe("entwurf");

    const vorgelegt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${anweisung.id}/vorlegen`,
      payload: { version: neu.version },
    });
    expect(vorgelegt.statusCode).toBe(200);
    const vorgelegtAuf = (vorgelegt.json() as { version: number }).version;
    const entscheiden = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${anweisung.id}/entscheiden`,
      payload: { version: vorgelegtAuf, entscheidung: "angenommen" },
    });
    expect(entscheiden.statusCode).toBe(403);

    const url = `/api/gesamtanweisungen/${anweisung.id}`;
    const stand = (await app.inject({ method: "GET", url })).json() as AnweisungLesestand;
    expect(stand.stand).toBe("vorgelegt");
    const paare = stand.uebernommeneAenderungen?.map((u) => [u.vonFassung, u.aufFassung]);
    expect(paare).toEqual([[1, 2]]);
  });

  it("viewer darf nicht übernehmen; fehlende Angaben sind 400, nichts wird geschrieben", async () => {
    const { anweisung, repo } = umgebung;
    const id = anweisung.bausteine.find((b) => b.koId === "ko-a")?.id ?? "";
    const abdruck = repo.abdruck();
    const url = `/api/gesamtanweisungen/${anweisung.id}/bausteine/${id}/uebernehmen`;

    nutzer = { id: "vera", role: "viewer" };
    const verboten = await app.inject({
      method: "POST",
      url,
      payload: { version: anweisung.version, aufVersion: 2 },
    });
    expect(verboten.statusCode).toBe(403);

    nutzer = { id: "erika", role: "experte" };
    const ohneFassung = await app.inject({
      method: "POST",
      url,
      payload: { version: anweisung.version },
    });
    expect(ohneFassung.statusCode).toBe(400);
    expect(repo.abdruck()).toBe(abdruck);
  });
});
