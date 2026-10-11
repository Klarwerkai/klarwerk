// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DER SEITENWEG UND DIE RECHTE AM DRAHT.
// ================================================================================================
//
// Gemessen an der ECHTEN Route (`services/app/src/routes/audit-routes.ts`) über dem ECHTEN Dienst
// (`AuditService` mit `InMemoryAuditRepo`, also Hashkette und Schreibregeln wie produktiv). Ersetzt
// sind nur die zwei Ränder, die hier nichts zu entscheiden haben: die Anmeldung (eine Testtür, die
// Rolle und lesbare Spaces aus Kopfzeilen nimmt und das Recht über dieselbe `can`-Matrix prüft) und
// der Objektbestand (drei erfundene Beiträge). Die Sichtbarkeitsregel selbst ist die produktive
// (`darfSehen` über `audit-sicht.ts`).
//
// DER FIKTIVE VORGANG (Lieferbelege des Auftrags): ein bekannter Akteur (Anna), ein später
// entferntes Konto (Gerd, gelöscht mit gespeichertem Namen), ein unbekannter Akteur (eine Kennung
// ohne Konto), ein Systemereignis, dazu ein Beitrag in einem geschlossenen Space, dessen Titel als
// Kopie in einem Protokolleintrag steht. Alle Namen und Titel sind erfunden.
//
//   K4 · Person, Aktion, Ziel und Zeitraum kombiniert; Seiten über den Zeiger, nie eine Gesamtliste.
//   K5 · Unberechtigte bekommen keine geschützten Titel — weder über die Seite noch über die Liste
//        noch über den Export; Objekttitel (Rücklinks) nur für Objekte, die sie öffnen dürfen.
//   K3 · Die gespeicherten Ereignisse bleiben unverändert — Schwärzung ist eine Sicht, kein Umschreiben.
//   K6 · Die Integritätsprüfung bleibt wirksam und nennt ihren Zeitpunkt.
//
// aufnahme:20260922:gesamt-leserechte (Nacharbeit 20, Integration main): die Route trägt seither
// ZWEI Schichten. Wer nicht alles lesen darf (Freigaberang < 2 oder ein bekannter Space nicht
// lesbar — Variante B), bekommt eine LESERANSICHT: Einträge zu Objekten, die er nicht sehen darf,
// fehlen ganz (keine Existenzauskunft), die Nummern sind laufende Nummern der Ansicht, der Export ist
// `klarwerk-audit-ansicht`. Darauf wirkt die Schwärzung dieses Auftrags. Die Fälle, die Kettennummern
// und die vollständige Kette messen, laufen deshalb mit einem uneingeschränkten Controller (`VOLL`);
// die Rechtefälle messen den eingeschränkten (`CONTROLLER`) — dort fehlt der geschützte Eintrag
// jetzt ganz, statt geschwärzt zu erscheinen.
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditObjektFakten } from "../../services/app/src/audit-sicht";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { type AuditLeseQuelle, auditRoutes } from "../../services/app/src/routes/audit-routes";
import {
  type AuditEntry,
  type AuditInput,
  AuditService,
  InMemoryAuditRepo,
} from "../../services/audit";
import { type Role, istFreigabestufe } from "../../services/auth";
import { can } from "../../services/rbac";

const GEHEIM = "GEHEIMTITEL Schichtplan Halle Z (fiktiv)";
const OFFEN = "Wartungsanleitung Presse P9 (fiktiv)";

/** Drei erfundene Beiträge: offen, in einem geschlossenen Space, im Papierkorb. */
const OBJEKTE: Record<string, AuditObjektFakten> = {
  "ko-offen": { title: OFFEN, author: "u-anna", confidentiality: "intern" },
  "ko-geschlossen": {
    title: GEHEIM,
    author: "u-ben",
    confidentiality: "intern",
    spaceId: "space-z",
  },
  "ko-papierkorb": {
    title: "Papierkorbtitel (fiktiv)",
    author: "u-anna",
    deletedAt: "2026-10-01T00:00:00.000Z",
  },
};

/** Die fiktive Kette — Zeitpunkt und Eintrag, in Schreibreihenfolge (seq 1 … 10). */
const KETTE: readonly (readonly [string, AuditInput])[] = [
  ["2026-10-01T08:00:00.000Z", { actor: "system", action: "gap.created", target: "gap-1" }],
  ["2026-10-02T08:00:00.000Z", { actor: "u-anna", action: "auth.login", target: "u-anna" }],
  [
    "2026-10-03T08:00:00.000Z",
    { actor: "u-anna", action: "ko.revised", target: "ko-offen", payload: { version: 2 } },
  ],
  [
    "2026-10-04T08:00:00.000Z",
    {
      actor: "u-admin",
      action: "user.role-change",
      target: "u-gerd",
      payload: {
        role: "controller",
        previousRole: "experte",
        actorName: "Ada Admin (fiktiv)",
        targetName: "Gerd Gelöscht (fiktiv)",
      },
    },
  ],
  [
    "2026-10-05T08:00:00.000Z",
    {
      actor: "u-anna",
      action: "answer.not_helpful",
      target: "ko-geschlossen",
      payload: { koTitle: GEHEIM, koAuthor: "u-ben", koOriginalAuthor: "u-ben" },
    },
  ],
  ["2026-10-06T08:00:00.000Z", { actor: "u-gerd", action: "auth.login", target: "u-gerd" }],
  [
    "2026-10-07T08:00:00.000Z",
    {
      actor: "u-admin",
      action: "user.delete",
      target: "u-gerd",
      payload: { targetName: "Gerd Gelöscht (fiktiv)", actorName: "Ada Admin (fiktiv)" },
    },
  ],
  [
    "2026-10-08T08:00:00.000Z",
    { actor: "u-unbekannt", action: "ko.revised", target: "ko-offen", payload: { version: 3 } },
  ],
  [
    "2026-10-08T12:00:00.000Z",
    {
      actor: "u-anna",
      action: "answer.helpful",
      target: "ko-offen",
      payload: { koTitle: OFFEN, koAuthor: "u-anna", koOriginalAuthor: "u-anna" },
    },
  ],
  [
    "2026-10-09T08:00:00.000Z",
    { actor: "u-anna", action: "ko.revised", target: "ko-papierkorb", payload: { version: 4 } },
  ],
];

/**
 * Die Testtür: Rolle, Konto und lesbare Spaces aus Kopfzeilen; das RECHT entscheidet dieselbe
 * `can`-Matrix wie produktiv. Ohne Kopfzeilen: 401.
 */
function testTuer(): Guards {
  const nutzer = (request: FastifyRequest): SessionUser | undefined => {
    const rolle = request.headers["x-test-rolle"];
    const konto = request.headers["x-test-konto"];
    if (typeof rolle !== "string" || typeof konto !== "string") {
      return undefined;
    }
    const spaces = request.headers["x-test-spaces"];
    const freigabe = request.headers["x-test-freigabe"];
    return {
      id: konto,
      role: rolle as Role,
      spaceLesbar: new Set(typeof spaces === "string" ? spaces.split(",").filter(Boolean) : []),
      ...(istFreigabestufe(freigabe) ? { freigabe } : {}),
    };
  };
  return {
    async requireUser(request, reply) {
      const user = nutzer(request);
      if (!user) {
        reply.code(401).send({ error: "UNAUTHENTICATED" });
      }
      return user;
    },
    async requirePermission(permission, request, reply) {
      const user = nutzer(request);
      if (!user) {
        reply.code(401).send({ error: "UNAUTHENTICATED" });
        return undefined;
      }
      if (!can(user.role, permission)) {
        reply.code(403).send({ error: "FORBIDDEN" });
        return undefined;
      }
      return user;
    },
  };
}

const CONTROLLER = { "x-test-rolle": "controller", "x-test-konto": "u-ctrl" };
const CONTROLLER_MIT_SPACE = { ...CONTROLLER, "x-test-spaces": "space-z" };
/** Uneingeschränkt: jeder bekannte Space lesbar und persönliches Niveau „streng vertraulich". */
const VOLL = { ...CONTROLLER_MIT_SPACE, "x-test-freigabe": "streng_vertraulich" };

/** Die Lesequelle der Route — dieselben drei erfundenen Beiträge, ein Space, keine Befunde. */
const QUELLE: AuditLeseQuelle = {
  sichtbarkeitsfaktenAller: async () => Object.entries(OBJEKTE).map(([id, f]) => ({ id, ...f })),
  spaceKennungen: async () => ["space-z"],
  befundZuordnungen: async () => [],
};

interface Buehne {
  app: FastifyInstance;
  audit: AuditService;
  repo: InMemoryAuditRepo;
}

const offen: FastifyInstance[] = [];

async function buehne(): Promise<Buehne> {
  const repo = new InMemoryAuditRepo();
  let uhr = 0;
  const audit = new AuditService({ repo, now: () => uhr });
  for (const [zeit, eintrag] of KETTE) {
    uhr = Date.parse(zeit);
    await audit.record(eintrag);
  }
  uhr = Date.parse("2026-10-09T09:00:00.000Z");
  const app = Fastify();
  const objekte = { get: async (id: string) => OBJEKTE[id] };
  app.register(auditRoutes(audit, testTuer(), [], objekte, QUELLE));
  await app.ready();
  offen.push(app);
  return { app, audit, repo };
}

afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

type Namensbeleg = Pick<AuditEntry, "seq" | "actor" | "action" | "target" | "payload">;

interface Seite {
  entries: (AuditEntry & { geschwaerzt?: string[] })[];
  nextBefore: number | null;
  limit: number;
  objekte: Record<string, { titel: string }>;
  namensbelege: Namensbeleg[];
}

async function seite(b: Buehne, query: string, headers = CONTROLLER): Promise<Seite> {
  const res = await b.app.inject({ method: "GET", url: `/api/audit/seite${query}`, headers });
  expect(res.statusCode, res.body.slice(0, 300)).toBe(200);
  return res.json() as Seite;
}

const seqs = (s: Seite): number[] => s.entries.map((e) => e.seq);

describe("K4 · Person, Aktion, Ziel und Zeitraum — kombinierbar, seitenweise", () => {
  it("die vier Filter wirken zusammen (UND), jeder einzeln und kombiniert", async () => {
    const b = await buehne();
    const zeitraum = "&from=2026-10-01T00:00:00.000Z&to=2026-10-04T00:00:00.000Z";
    // Alle vier zugleich: genau Annas Überarbeitung von ko-offen am 3. Oktober.
    const alleVier = await seite(
      b,
      `?actor=u-anna&action=ko.revised&target=ko-offen${zeitraum}`,
      VOLL,
    );
    expect(seqs(alleVier)).toEqual([3]);
    // Derselbe Vorgang am selben Ziel, aber eine andere Person: nur der unbekannte Akteur.
    const anderePerson = await seite(
      b,
      "?actor=u-unbekannt&action=ko.revised&target=ko-offen",
      VOLL,
    );
    expect(seqs(anderePerson)).toEqual([8]);
    // Der Zeitraum endet VOR dem Eintrag (`to` ist ausschließlich): leer, kein Fehler.
    const zuFrueh = await seite(
      b,
      "?actor=u-anna&action=ko.revised&to=2026-10-03T08:00:00.000Z",
      VOLL,
    );
    expect(seqs(zuFrueh)).toEqual([]);
    // Nur Ziel: alles an ko-offen, jüngstes zuerst.
    expect(seqs(await seite(b, "?target=ko-offen", VOLL))).toEqual([9, 8, 3]);
    // Mehrere Aktionen zugleich (die Auth-Ansicht): Anmeldungen und die Löschung.
    expect(seqs(await seite(b, "?actions=auth.login,user.delete", VOLL))).toEqual([7, 6, 2]);
  });

  it("Seiten über den Zeiger des Servers — keine Lücke, keine Doppelung, keine Gesamtliste", async () => {
    const b = await buehne();
    const eins = await seite(b, "?limit=3", VOLL);
    expect(seqs(eins)).toEqual([10, 9, 8]);
    expect(eins.nextBefore).toBe(8);
    const zwei = await seite(b, `?limit=3&before=${eins.nextBefore}`, VOLL);
    expect(seqs(zwei)).toEqual([7, 6, 5]);
    const drei = await seite(b, `?limit=3&before=${zwei.nextBefore}`, VOLL);
    expect(seqs(drei)).toEqual([4, 3, 2]);
    const vier = await seite(b, `?limit=3&before=${drei.nextBefore}`, VOLL);
    expect(seqs(vier)).toEqual([1]);
    expect(vier.nextBefore).toBeNull();
    // Ohne Angabe 25, und auch eine riesige Wunschgröße bleibt bei höchstens 100.
    expect((await seite(b, "", VOLL)).limit).toBe(25);
    expect((await seite(b, "?limit=100000", VOLL)).limit).toBe(100);
    // Ein Filter blättert mit: Seiten innerhalb der gefilterten Menge.
    const gefiltert = await seite(b, "?actor=u-anna&limit=2", VOLL);
    expect(seqs(gefiltert)).toEqual([10, 9]);
    const weiter = await seite(b, `?actor=u-anna&limit=2&before=${gefiltert.nextBefore}`, VOLL);
    expect(seqs(weiter)).toEqual([5, 3]);
  });

  // aufnahme:20260922:gesamt-leserechte (Nacharbeit 20): derselbe Seitenweg für den
  // eingeschränkten Controller. Der Eintrag zum geschlossenen Beitrag (Kette Nr. 5) fehlt; die
  // Nummern sind lückenlos die der Ansicht, Zeiger und Seitengröße gelten über ihr.
  it("eingeschränkt: Seiten über die Leseransicht — lückenlose Nummern, nichts Verborgenes", async () => {
    const b = await buehne();
    const eins = await seite(b, "?limit=4");
    expect(seqs(eins)).toEqual([9, 8, 7, 6]);
    expect(eins.nextBefore).toBe(6);
    const zwei = await seite(b, `?limit=4&before=${eins.nextBefore}`);
    expect(seqs(zwei)).toEqual([5, 4, 3, 2]);
    const drei = await seite(b, `?limit=4&before=${zwei.nextBefore}`);
    expect(seqs(drei)).toEqual([1]);
    expect(drei.nextBefore).toBeNull();
    const alle = [...eins.entries, ...zwei.entries, ...drei.entries];
    expect(alle.some((e) => e.target === "ko-geschlossen")).toBe(false);
    for (const e of alle) {
      expect(e).not.toHaveProperty("hash");
      expect(e).not.toHaveProperty("prevHash");
    }
    // Derselbe Filter wie oben, über der Ansicht: der unbekannte Akteur ist hier Nr. 7.
    const anderePerson = await seite(b, "?actor=u-unbekannt&action=ko.revised&target=ko-offen");
    expect(seqs(anderePerson)).toEqual([7]);
  });

  it("ein unlesbarer Zeitraum oder Zeiger ist ein 400, kein still ungefiltertes Ergebnis", async () => {
    const b = await buehne();
    for (const query of [
      "?from=gestern",
      "?to=2026-13-45",
      "?from=2026-10-05T00:00:00.000Z&to=2026-10-04T00:00:00.000Z",
      "?before=-1",
      "?limit=viele",
    ]) {
      const res = await b.app.inject({
        method: "GET",
        url: `/api/audit/seite${query}`,
        headers: CONTROLLER,
      });
      expect(res.statusCode, query).toBe(400);
      expect(res.json().error, query).toBe("BAD_REQUEST");
    }
  });
});

describe("K5 · Rechte — Audit, Seite, Export und Rücklinks", () => {
  it("Betrachter und Experte kommen an keinen Protokollweg; ohne Anmeldung 401", async () => {
    const b = await buehne();
    for (const url of [
      "/api/audit",
      "/api/audit/seite",
      "/api/audit/export",
      "/api/audit/verify",
    ]) {
      for (const rolle of ["viewer", "experte"]) {
        const res = await b.app.inject({
          method: "GET",
          url,
          headers: { "x-test-rolle": rolle, "x-test-konto": `u-${rolle}` },
        });
        expect(res.statusCode, `${rolle} ${url}`).toBe(403);
        expect(res.body, `${rolle} ${url}`).not.toContain(GEHEIM);
      }
      expect((await b.app.inject({ method: "GET", url })).statusCode, url).toBe(401);
    }
  });

  it("ohne Recht am Space: kein Titel, kein Rücklink, der Eintrag zum geschützten Beitrag fehlt", async () => {
    const b = await buehne();
    const s = await seite(b, "");
    // Rücklink nur für den offenen Beitrag; der geschlossene und der im Papierkorb bleiben Kennung.
    expect(s.objekte).toEqual({ "ko-offen": { titel: OFFEN } });
    // aufnahme:20260922:gesamt-leserechte (Nacharbeit 20): der Eintrag mit der Titelkopie des
    // geschlossenen Beitrags erscheint gar nicht — strenger als die Schwärzung und ohne Auskunft,
    // dass es den Beitrag gibt.
    expect(s.entries.some((e) => e.target === "ko-geschlossen")).toBe(false);
    // Der sichtbare Beitrag behält seine Titelkopie — verborgen wird nur, was geschützt ist.
    expect(s.entries.find((e) => e.action === "answer.helpful")?.payload.koTitle).toBe(OFFEN);
    expect(JSON.stringify(s)).not.toContain(GEHEIM);

    // Dieselbe Regel auf der Gesamtliste …
    const liste = await b.app.inject({ method: "GET", url: "/api/audit", headers: CONTROLLER });
    expect(liste.statusCode).toBe(200);
    expect(liste.body).not.toContain(GEHEIM);
    expect(liste.body).not.toContain("ko-geschlossen");
    expect(liste.body).toContain(OFFEN);

    // … und auf dem Export: die Leseransicht, ausdrücklich keine Kette.
    const exp = await b.app.inject({
      method: "GET",
      url: "/api/audit/export",
      headers: CONTROLLER,
    });
    expect(exp.statusCode).toBe(200);
    expect(exp.body).not.toContain(GEHEIM);
    expect(exp.body).not.toContain("ko-geschlossen");
    const ansicht = exp.json() as {
      format: string;
      kette: boolean;
      count: number;
      entries: AuditEntry[];
    };
    expect(ansicht.format).toBe("klarwerk-audit-ansicht");
    expect(ansicht.kette).toBe(false);
    expect(ansicht.count).toBe(KETTE.length - 1);
  });

  it("uneingeschränkt: der Export ist die vollständige Kette — Kopf und Prüfbericht wie gespeichert", async () => {
    const b = await buehne();
    const exp = await b.app.inject({ method: "GET", url: "/api/audit/export", headers: VOLL });
    expect(exp.statusCode).toBe(200);
    const datei = exp.json() as {
      count: number;
      geschwaerzt: number;
      head: { seq: number; hash: string };
      inspection: { ok: boolean };
      entries: (AuditEntry & { geschwaerzt?: string[] })[];
    };
    // Wer den Space lesen darf, sieht die Titelkopie; nichts ist geschwärzt.
    expect(datei.geschwaerzt).toBe(0);
    expect(datei.count).toBe(KETTE.length);
    expect(datei.inspection.ok).toBe(true);
    expect(datei.entries.find((e) => e.seq === 5)?.payload.koTitle).toBe(GEHEIM);
    const original = (await b.repo.all()).find((e) => e.seq === KETTE.length);
    expect(datei.head).toEqual({ seq: original?.seq, hash: original?.hash });
  });

  // Bens Befund Nacharbeit 35: der Anlagenkontext eines Beitrags (Bauteil, Material, Version,
  // Standort, Schicht) steht als vorher/nachher im Protokoll und ist Inhalt des Beitrags.
  it("Anlagenkontext ohne Leserecht: auf Liste, Seite und Export verborgen; mit Recht sichtbar", async () => {
    const b = await buehne();
    const KONTEXT = "Pumpe P7 · Edelstahl · Rev. C · Halle Z · Nachtschicht (fiktiv)";
    await b.audit.record({
      actor: "u-ben",
      action: "ko.anlagenkontext-changed",
      target: "ko-geschlossen",
      payload: { vorher: null, nachher: { bauteil: KONTEXT } },
    });
    const vorher = structuredClone(await b.repo.all());

    // aufnahme:20260922:gesamt-leserechte (Nacharbeit 20): ohne Leserecht am Beitrag fehlt der
    // Eintrag in der Leseransicht ganz — strenger als die Schwärzung.
    const s = await seite(b, "?action=ko.anlagenkontext-changed");
    expect(s.entries).toHaveLength(0);
    expect(JSON.stringify(s)).not.toContain(KONTEXT);
    const liste = await b.app.inject({ method: "GET", url: "/api/audit", headers: CONTROLLER });
    expect(liste.statusCode).toBe(200);
    expect(liste.body).not.toContain(KONTEXT);
    const exp = await b.app.inject({
      method: "GET",
      url: "/api/audit/export",
      headers: CONTROLLER,
    });
    expect(exp.statusCode).toBe(200);
    expect(exp.body).not.toContain(KONTEXT);

    // Kontrollfall: mit Recht am Space bleibt der Kontext lesbar.
    const mitRecht = await seite(b, "?action=ko.anlagenkontext-changed", CONTROLLER_MIT_SPACE);
    expect(JSON.stringify(mitRecht.entries[0]?.payload)).toContain(KONTEXT);
    expect(mitRecht.entries[0]?.geschwaerzt).toBeUndefined();

    // Gespeichert bleibt alles; nur die Ausgabe ist geschwärzt.
    const nachher = await b.repo.all();
    expect(nachher.slice(0, vorher.length)).toEqual(vorher);
    const gespeichert = nachher.find((e) => e.action === "ko.anlagenkontext-changed");
    expect(JSON.stringify(gespeichert?.payload)).toContain(KONTEXT);
    expect((await b.audit.verifyReport()).ok).toBe(true);
  });

  it("mit Recht am Space: derselbe Controller sieht Titel und Titelkopie", async () => {
    const b = await buehne();
    const s = await seite(b, "", CONTROLLER_MIT_SPACE);
    expect(s.objekte["ko-geschlossen"]).toEqual({ titel: GEHEIM });
    expect(s.entries.find((e) => e.seq === 5)?.payload.koTitle).toBe(GEHEIM);
    expect(s.entries.find((e) => e.seq === 5)?.geschwaerzt).toBeUndefined();
    // Der Papierkorb bleibt ohne Titel: ein Rücklink dorthin führte ins Leere.
    expect(s.objekte["ko-papierkorb"]).toBeUndefined();
  });
});

describe("K1/K3 · Namen aus der Kette — als Belege, nicht als Umschreibung", () => {
  it("eine Seite mit dem gelöschten Konto bringt NUR dessen gespeicherte Namen mit", async () => {
    const b = await buehne();
    // Kettennummern: der uneingeschränkte Leser (eingeschränkt zählt die Ansicht, s. Dateikopf).
    const s = await seite(b, "?actor=u-gerd", VOLL);
    expect(seqs(s)).toEqual([6]);
    // Begrenzt (Bens Befund Nacharbeit 3): je Kennung nur die JÜNGSTE Namens- bzw. Kontozuordnung.
    // Die Löschung (7) ist jüngster Zielname UND jüngster Kontovorgang; der ältere Rollenwechsel (4)
    // trägt nichts mehr bei und kommt nicht mit.
    const belege = s.namensbelege.map((n) => n.seq).sort((x, y) => x - y);
    expect(belege).toEqual([7]);
    for (const n of s.namensbelege) {
      // Nur Namen — keine Rolle, kein sonstiger Inhalt des fremden Eintrags.
      expect(Object.keys(n.payload).every((k) => k === "actorName" || k === "targetName")).toBe(
        true,
      );
    }
    expect(s.namensbelege.find((n) => n.seq === 7)?.payload.targetName).toBe(
      "Gerd Gelöscht (fiktiv)",
    );
  });

  it("K4 · die Namensbelege einer Seite wachsen NICHT mit der Historie eines Akteurs", async () => {
    const b = await buehne();
    // 300 weitere Rollenwechsel desselben fiktiven Kontos, jeder mit gespeicherten Namen.
    for (let i = 0; i < 300; i += 1) {
      await b.audit.record({
        actor: "u-admin",
        action: "user.role-change",
        target: "u-anna",
        payload: { role: "experte", actorName: `Ada ${i}`, targetName: `Anna ${i}` },
      });
    }
    const s = await seite(b, "?limit=25");
    expect(s.entries).toHaveLength(25);
    const kennungen = new Set(s.entries.flatMap((e) => [e.actor, e.target]));
    // Höchstens drei Belege je Kennung (Akteursname, Zielname, Kontovorgang) — nicht 300.
    expect(s.namensbelege.length).toBeLessThanOrEqual(3 * kennungen.size);
    expect(s.namensbelege.length).toBeLessThanOrEqual(6);
    // Und es sind die JÜNGSTEN: der zuletzt gespeicherte Name gilt.
    const zielnamen = s.namensbelege
      .filter((n) => n.target === "u-anna" && n.payload.targetName !== undefined)
      .map((n) => n.payload.targetName);
    expect(zielnamen).toEqual(["Anna 299"]);
    const akteursnamen = s.namensbelege
      .filter((n) => n.actor === "u-admin" && n.payload.actorName !== undefined)
      .map((n) => n.payload.actorName);
    expect(akteursnamen).toEqual(["Ada 299"]);
  });

  it("nach Seiten, Liste, Export und Prüfung sind die gespeicherten Ereignisse bitgleich", async () => {
    const b = await buehne();
    const vorher = structuredClone(await b.repo.all());
    await seite(b, "");
    await seite(b, "?target=ko-geschlossen");
    await b.app.inject({ method: "GET", url: "/api/audit", headers: CONTROLLER });
    await b.app.inject({ method: "GET", url: "/api/audit/export", headers: CONTROLLER });
    await b.app.inject({ method: "GET", url: "/api/audit/verify", headers: CONTROLLER });
    const nachher = await b.repo.all();
    // Der Export hängt seinen eigenen Beleg an (R-0613) — alles davor ist unverändert. Für den
    // eingeschränkten Controller ist es der Beleg der Leseransicht (gesamt-leserechte).
    expect(nachher.slice(0, vorher.length)).toEqual(vorher);
    expect(nachher.at(-1)?.action).toBe("audit.view-exported");
    // Die Titelkopie steht gespeichert weiter da; geschwärzt wurde nur die Ausgabe.
    expect(nachher.find((e) => e.seq === 5)?.payload.koTitle).toBe(GEHEIM);
    expect((await b.audit.verifyReport()).ok).toBe(true);
  });
});

describe("K6 · die Integritätsprüfung nennt ihren Zeitpunkt", () => {
  it("GET /api/audit/verify: ok mit Prüfzeitpunkt; nach einer Manipulation nicht ok", async () => {
    const b = await buehne();
    const vorher = Date.now();
    const res = await b.app.inject({
      method: "GET",
      url: "/api/audit/verify",
      headers: VOLL,
    });
    expect(res.statusCode).toBe(200);
    const bericht = res.json() as { ok: boolean; count: number; checkedAt: string };
    expect(bericht.ok).toBe(true);
    expect(bericht.count).toBe(KETTE.length);
    expect(Date.parse(bericht.checkedAt)).toBeGreaterThanOrEqual(vorher - 1000);

    // aufnahme:20260922:gesamt-leserechte (Nacharbeit 20): der eingeschränkte Controller bekommt
    // den Bericht SEINER Ansicht — ebenfalls mit Prüfzeitpunkt, ohne die Gesamtzahl der Kette.
    const ansicht = await b.app.inject({
      method: "GET",
      url: "/api/audit/verify",
      headers: CONTROLLER,
    });
    const ansichtsbericht = ansicht.json() as {
      ok: boolean;
      count: number;
      kette: boolean;
      checkedAt: string;
    };
    expect(ansichtsbericht).toMatchObject({ ok: true, count: KETTE.length - 1, kette: false });
    expect(Date.parse(ansichtsbericht.checkedAt)).toBeGreaterThanOrEqual(vorher - 1000);

    // Gegenprobe: eine Kette mit gebrochener Verkettung meldet die Route nicht als ok.
    const kaputt = new InMemoryAuditRepo();
    const original = await b.repo.all();
    for (const e of original) {
      await kaputt.append(e.seq === 3 ? { ...e, prevHash: "x".repeat(64) } : e);
    }
    const app = Fastify();
    app.register(auditRoutes(new AuditService({ repo: kaputt }), testTuer(), [], undefined, QUELLE));
    await app.ready();
    offen.push(app);
    const rot = await app.inject({ method: "GET", url: "/api/audit/verify", headers: VOLL });
    expect((rot.json() as { ok: boolean }).ok).toBe(false);
  });
});
