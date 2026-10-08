// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · K3 — „GELÖSCHT" IST EINE EIGENE AUSKUNFT DER AUTORENZEILE.
// ================================================================================================
//
// Das Kriterium: „Autorenanzeige unterscheidet Laden, unbekannt, gelöscht und Fehler; Namen nur mit
// geltenden Leserechten auflösen." Laden, unbekannt und Fehler stehen seit mega62 H / mega63 B
// (tests/ko/mega62-autor-verzeichnis.test.ts). Gelöscht fiel bis hierher auf „Unbekannte Person" —
// ein Konto, das es nachweislich gab, sah aus wie eine Kennung, die nie eine Person war.
//
// Geprüft wird die ganze Kette, nicht nur die Anzeigeentscheidung:
//   G1 · Dienst: die gelöschten Kennungen kommen aus dem Prüfprotokoll (`user.delete`), nie ein Name.
//   G2 · Route: `/api/directory` liefert sie jedem Angemeldeten als Marke OHNE Namen.
//   G3 · Client: der Abrufweg trennt die Marken ab — Zuweisungslisten sehen nur Konten.
//   G4 · Auflösung: gelöscht ≠ unbekannt; Name, Laden und Fehler bleiben, wie sie waren.
//   G5 · Wörterbuch: der neue Zustand hat einen Text in allen drei Sprachen.
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { geloeschteKonten, trenneVerzeichnis } from "../../apps/web/src/lib/geloeschteKonten";
import {
  AUTHOR_DELETED_KEY,
  AUTHOR_UNKNOWN_KEY,
  authorShortRef,
  makeAuthorNameResolver,
} from "../../apps/web/src/lib/koAuthor";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";

const KENNWORT = "secret123";

async function aufbau(mitProtokoll = true) {
  const users = new InMemoryUserRepo();
  const sessions = new InMemorySessionRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const deps = mitProtokoll ? { users, sessions, audit } : { users, sessions };
  const service = new AuthService(deps);
  const konto = (name: string, email: string) =>
    service.register({ name, email, password: KENNWORT });
  const admin = await konto("Pia Admin", "pia@x.de");
  const carl = await konto("Carl Leser", "carl@x.de");
  await service.approveUser(carl.id, admin.id);
  const bob = await konto("Bob Weg", "bob@x.de");
  await service.approveUser(bob.id, admin.id);
  return { service, admin, carl, bob };
}

const TEXTE = {
  unknown: (ref: string) => `Unbekannte Person (${ref})`,
  deleted: (ref: string) => `Gelöschtes Konto (${ref})`,
  loading: () => "Autorenname wird geladen",
  unavailable: () => "Autorenname nicht abrufbar",
};

afterEach(() => {
  // Die Ablage ist modulweit; jeder Fall beginnt ohne gelöschte Kennungen.
  trenneVerzeichnis([]);
});

describe("K3 · G1 — der Dienst kennt gelöschte Kennungen nur aus dem Prüfprotokoll", () => {
  it("nach deleteUser steht die Kennung in der Liste, das bestehende Konto nicht", async () => {
    const { service, admin, carl, bob } = await aufbau();
    expect(await service.listDeletedUserIds()).toEqual([]);

    await service.deleteUser(bob.id, admin.id);

    const geloescht = await service.listDeletedUserIds();
    expect(geloescht).toEqual([bob.id]);
    expect(geloescht).not.toContain(carl.id);
    expect(geloescht).not.toContain(admin.id);
  });

  it("ohne verdrahtetes Prüfprotokoll gibt es keinen Beleg und damit keine gelöschte Kennung", async () => {
    const { service, admin, bob } = await aufbau(false);
    await service.deleteUser(bob.id, admin.id);
    expect(await service.listDeletedUserIds()).toEqual([]);
  });
});

describe("K3 · G2 — /api/directory nennt gelöschte Konten jedem Angemeldeten, aber ohne Namen", () => {
  it("ein Nicht-Admin sieht die Marke, den Namen von damals nicht", async () => {
    const { service, admin, carl, bob } = await aufbau();
    await service.deleteUser(bob.id, admin.id);
    const app = Fastify();
    await app.register(authRoutes(service));
    const { token } = await service.login({ email: "carl@x.de", password: KENNWORT });

    const antwort = await app.inject({
      method: "GET",
      url: "/api/directory",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(antwort.statusCode).toBe(200);
    const eintraege = antwort.json() as Record<string, unknown>[];

    // Die Konten unverändert: Kennung und Anzeigename.
    expect(eintraege).toContainEqual({ id: admin.id, name: "Pia Admin" });
    expect(eintraege).toContainEqual({ id: carl.id, name: "Carl Leser" });
    // Das gelöschte Konto als Marke — genau diese zwei Felder, kein Name.
    expect(eintraege).toContainEqual({ id: bob.id, geloescht: true });
    expect(antwort.body).not.toContain("Bob Weg");

    const ohneAnmeldung = await app.inject({ method: "GET", url: "/api/directory" });
    expect(ohneAnmeldung.statusCode).toBe(401);
    await app.close();
  });

  it("ohne Löschung bleibt die Antwort eine reine Kontenliste wie bisher", async () => {
    const { service, admin, carl, bob } = await aufbau();
    const app = Fastify();
    await app.register(authRoutes(service));
    const { token } = await service.login({ email: "carl@x.de", password: KENNWORT });
    const antwort = await app.inject({
      method: "GET",
      url: "/api/directory",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(antwort.json()).toEqual([
      { id: admin.id, name: "Pia Admin" },
      { id: carl.id, name: "Carl Leser" },
      { id: bob.id, name: "Bob Weg" },
    ]);
    await app.close();
  });
});

describe("K3 · G3 — der Client trennt die Marken ab, bevor eine Zuweisungsliste sie sieht", () => {
  it("Konten gehen weiter, gelöschte Kennungen in die Ablage", () => {
    const konten = trenneVerzeichnis([
      { id: "u1", name: "Pia" },
      { id: "weg-1", geloescht: true },
      { id: "u2", name: "Carl" },
    ] as unknown as { id: string; name: string }[]);
    expect(konten).toEqual([
      { id: "u1", name: "Pia" },
      { id: "u2", name: "Carl" },
    ]);
    expect([...geloeschteKonten()]).toEqual(["weg-1"]);
  });

  it("jede Antwort ersetzt die Ablage — ein wiederhergestelltes Konto ist nicht mehr gelöscht", () => {
    trenneVerzeichnis([{ id: "weg-1", geloescht: true }] as unknown as never[]);
    expect(geloeschteKonten().has("weg-1")).toBe(true);
    trenneVerzeichnis([{ id: "weg-1", name: "Wieder da" }]);
    expect(geloeschteKonten().has("weg-1")).toBe(false);
  });

  it("eine Antwort, die keine Liste ist, geht unverändert durch (darüber entscheidet useAuthorName)", () => {
    const keineListe = { fehler: "umgeleitet" };
    expect(trenneVerzeichnis(keineListe)).toBe(keineListe);
  });
});

describe("K3 · G4 — gelöscht ist nicht unbekannt, und die anderen Zustände bleiben", () => {
  const geloescht = new Set(["weg-1234567"]);
  const geladen = {
    data: [{ id: "u1", name: "Pia" }],
    isPending: false,
    isError: false,
    deleted: geloescht,
  };

  it("eine als gelöscht belegte Kennung heisst „Gelöschtes Konto (ref)“", () => {
    expect(makeAuthorNameResolver(geladen, TEXTE)("weg-1234567")).toBe(
      `Gelöschtes Konto (${authorShortRef("weg-1234567")})`,
    );
  });

  it("eine nirgends belegte Kennung bleibt „Unbekannte Person (ref)“", () => {
    expect(makeAuthorNameResolver(geladen, TEXTE)("83e361aa")).toBe("Unbekannte Person (83e361)");
  });

  it("ein gepflegter Name gewinnt immer — auch wenn die Kennung zugleich als gelöscht gemeldet ist", () => {
    const beides = { ...geladen, deleted: new Set(["u1"]) };
    expect(makeAuthorNameResolver(beides, TEXTE)("u1")).toBe("Pia");
  });

  it("Laden und Fehler sagen weiter nichts über die Person — auch nicht „gelöscht“", () => {
    const laedt = { data: undefined, isPending: true, isError: false, deleted: geloescht };
    const fehler = { data: undefined, isPending: false, isError: true, deleted: geloescht };
    expect(makeAuthorNameResolver(laedt, TEXTE)("weg-1234567")).toBe("Autorenname wird geladen");
    expect(makeAuthorNameResolver(fehler, TEXTE)("weg-1234567")).toBe("Autorenname nicht abrufbar");
  });

  it("ohne Text für „gelöscht“ fällt der Aufrufer auf die bisherige Auskunft zurück", () => {
    const { deleted: _ohne, ...bisherigeTexte } = TEXTE;
    expect(makeAuthorNameResolver(geladen, bisherigeTexte)("weg-1234567")).toBe(
      `Unbekannte Person (${authorShortRef("weg-1234567")})`,
    );
  });
});

describe("K3 · G5 — der Zustand hat einen Text in allen drei Sprachen", () => {
  it("de/en/nl tragen „ko.authorDeleted“ mit Merkmal und verschieden von „unbekannt“", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      const t = i18n.getFixedT(sprache);
      const text = t(AUTHOR_DELETED_KEY, { ref: "abc123" });
      expect(text, `${sprache}: Schlüssel fehlt`).not.toBe(AUTHOR_DELETED_KEY);
      expect(text, `${sprache}: Merkmal fehlt`).toContain("abc123");
      expect(text).not.toBe(t(AUTHOR_UNKNOWN_KEY, { ref: "abc123" }));
    }
  });
});
