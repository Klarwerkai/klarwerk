import { afterEach, describe, expect, it, vi } from "vitest";
import { befund, belege, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 R3 · bens KORREKTURPFLICHT 1 — EIN SYNCHRONES `throw` IST AUCH EIN PORTFEHLER.
// ================================================================================================
//
// Runde 2 hängte den Fehlerhandler an das ZURÜCKGEGEBENE Versprechen des Ports
// (`lookup(koId).then(_, _)`). Wirft der Port aber schon beim AUFRUF — ein Adapter, der an der
// Anweisung scheitert; ein Port, der gar keine Zusage liefert —, dann gibt es noch gar kein
// Versprechen, an dem der Handler hängen könnte. Der Fehler flog aus `onKoRemoved` heraus, durch
// den Nachlauf der Löschroute, und die Route antwortete mit 500. Bens Messung, wörtlich:
//   `BEN_SYNC http=500 koSichtbar=false befund=offen meldungen=0`
// Also: der Beitrag WAR schon weich gelöscht, der Dublettenbefund stand OFFEN über ihm, der Mensch
// bekam einen Serverfehler, und im Protokoll stand über den Ausfall NICHTS.
//
// Es ist derselbe Zustand wie „wirft" und „schweigt" und muss denselben Ausgang haben: 204, Befund
// systemisch geschlossen, genau eine Meldung. Der Fall läuft deshalb über die ECHTE HTTP-Route.
describe("JOB 3071 R3: ein synchron werfender Port hält die Löschroute nicht an", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Port wirft beim Aufruf → 204, participant_deleted, genau eine Meldung", async () => {
    const { services, app, autorin } = await welt();
    const a = await koAnlegen(
      app,
      autorin,
      "Ventil V3 zuerst",
      "Bei Überdruck Ventil V3 schließen.",
    );
    const b = await koAnlegen(
      app,
      autorin,
      "Pumpe entlüften",
      "Die Pumpe alle 200 Stunden entlüften.",
    );
    const eintrag = await befund(services, a, b);
    expect(eintrag.status).toBe("offen");

    // KEIN `Promise.reject` — der Aufruf selbst wirft, bevor irgendeine Zusage entsteht.
    services.ko.eigeneRuecknahmeVon = () => {
      throw new Error("Bestand nicht ansprechbar");
    };
    const konsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    const stored = await services.overlaps.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();
    expect(await belege(services, "overlap.participant-removed", eintrag.id)).toHaveLength(1);
    expect(await belege(services, "overlap.withdrawn-own", eintrag.id)).toHaveLength(0);

    const meldungen = konsole.mock.calls.filter((args) => String(args[0]).includes("Rücknahme"));
    expect(meldungen).toHaveLength(1);
    expect(String(meldungen[0]?.[0])).toContain(a);
    expect((meldungen[0]?.[1] as Error).message).toBe("Bestand nicht ansprechbar");
  });

  it("und der Beitrag liegt danach wirklich im Papierkorb", async () => {
    const { services, app, autorin } = await welt();
    const a = await koAnlegen(
      app,
      autorin,
      "Ventil V3 zuerst",
      "Bei Überdruck Ventil V3 schließen.",
    );
    const b = await koAnlegen(
      app,
      autorin,
      "Pumpe entlüften",
      "Die Pumpe alle 200 Stunden entlüften.",
    );
    await befund(services, a, b);

    services.ko.eigeneRuecknahmeVon = () => {
      throw new Error("Bestand nicht ansprechbar");
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    expect(await services.ko.get(a)).toBeUndefined();
    expect((await services.ko.trashed()).map((k) => k.id)).toContain(a);
    // Und die Gegenseite ist unangetastet: kein fremdes Wissen wurde entschieden.
    expect((await services.ko.get(b))?.id).toBe(b);
  });
});
