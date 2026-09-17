// ================================================================================================
// JOB 4249 · LIEFERUNG 1 — DER VORGANG TRÄGT SEINEN EIGENTÜMER, UND `enqueue` PRÜFT IHN MIT.
// ================================================================================================
//
// Die reine, DOM-freie Schicht (`apps/web/src/lib/offlineQueue.ts`). Sie ist die STILLSTE Lücke
// dieses Auftrags und deshalb ein eigener Fall: ein Eigentümerfeld, das überall mitreist, aber
// beim ZUSAMMENFASSEN in `enqueue` nicht mitgeprüft wird, sieht in jedem Ende-zu-Ende-Fall
// richtig aus — und lässt trotzdem zwei Konten zu EINEM Eintrag verschmelzen: B speichert denselben
// Entwurf, und As wartende Nutzlast ist stillschweigend überschrieben. Genau das misst E2.
import { describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  type NewOp,
  type QueuedOp,
  enqueue,
  gehoertKonto,
  ohneEigentuemer,
} from "../../apps/web/src/lib/offlineQueue";

const A = "konto-anna";
const B = "konto-bert";

function neu(over: Partial<NewOp> & { id: string }): NewOp {
  return {
    kind: "draft.update",
    draftId: "entwurf-1",
    payload: { title: "Fassung" },
    title: "Fassung",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("JOB 4249 · Lieferung 1 · der Eigentümer reist mit", () => {
  it("E1 · ein neuer Vorgang trägt den mitgegebenen Eigentümer", () => {
    const q = enqueue([], neu({ id: "op-1", eigentuemer: A }));
    expect(q).toHaveLength(1);
    expect(q[0]?.eigentuemer).toBe(A);
    expect(gehoertKonto(q[0] as QueuedOp, A)).toBe(true);
    expect(gehoertKonto(q[0] as QueuedOp, B), "der Vorgang gehört plötzlich auch B").toBe(false);
  });

  it("E2 · ZWEI KONTEN, EIN ENTWURF: nichts wird zusammengefasst", () => {
    // Der Fall, für den es die Bedingung gibt. Ohne den Eigentümervergleich in `enqueue` fände B
    // den wartenden Eintrag von A (gleiche `draftId`, Status `queued`) und ERSETZTE dessen
    // Nutzlast in place — As offline gespeicherte Fassung wäre weg, ohne dass irgendetwas
    // gemeldet würde.
    const vonA = enqueue([], neu({ id: "op-a", eigentuemer: A, payload: { title: "Fassung A" } }));
    const beide = enqueue(
      vonA,
      neu({ id: "op-b", eigentuemer: B, payload: { title: "Fassung B" } }),
    );

    expect(beide, "die Vorgänge zweier Konten wurden zu einem verschmolzen").toHaveLength(2);
    expect(beide[0]?.eigentuemer).toBe(A);
    expect(beide[0]?.payload.title, "As Nutzlast wurde überschrieben").toBe("Fassung A");
    expect(beide[1]?.eigentuemer).toBe(B);
    expect(beide[1]?.payload.title).toBe("Fassung B");
  });

  it("E3 · DASSELBE Konto, derselbe Entwurf: weiterhin EIN Eintrag (kein Doppel)", () => {
    // Die Gegenprobe zu E2. Ohne sie wäre auch eine Fassung grün, die gar nicht mehr zusammenfasst
    // — dann stünden für einen Entwurf zwei Vorgänge in der Warteschlange, und der ältere
    // überschriebe beim Nachsenden den jüngeren.
    const erst = enqueue([], neu({ id: "op-a", eigentuemer: A, payload: { title: "Erst" } }));
    const dann = enqueue(erst, neu({ id: "op-a2", eigentuemer: A, payload: { title: "Dann" } }));

    expect(
      dann,
      "derselbe Mensch erzeugte einen zweiten Eintrag für denselben Entwurf",
    ).toHaveLength(1);
    expect(dann[0]?.id, "der wartende Eintrag wurde ersetzt statt fortgeschrieben").toBe("op-a");
    expect(dann[0]?.payload.title).toBe("Dann");
    expect(dann[0]?.eigentuemer).toBe(A);
  });

  it("E4 · ein ALTBESTAND ohne Eigentümer wird von einem gebundenen Vorgang nicht vereinnahmt", () => {
    const alt: QueuedOp = {
      id: "op-alt",
      kind: "draft.update",
      draftId: "entwurf-1",
      payload: { title: "Aus einer früheren Sitzung" },
      status: "queued",
      error: null,
      createdAt: "2025-12-01T00:00:00.000Z",
      title: "Aus einer früheren Sitzung",
    };
    expect(ohneEigentuemer(alt)).toBe(true);
    expect(gehoertKonto(alt, A), "ein Vorgang ohne Eigentümer gehört plötzlich jemandem").toBe(
      false,
    );

    const danach = enqueue([alt], neu({ id: "op-a", eigentuemer: A, payload: { title: "Neu" } }));
    expect(danach, "der Altbestand wurde vereinnahmt").toHaveLength(2);
    expect(danach[0]?.payload.title, "der Altbestand wurde überschrieben").toBe(
      "Aus einer früheren Sitzung",
    );
    expect(danach[0]?.eigentuemer, "der Altbestand wurde still zugeordnet").toBeUndefined();
  });

  it("E5 · ein ANLEGEN wird nie zusammengefasst — auch nicht beim selben Konto", () => {
    // `draft.create` hat keine `draftId`; zwei Anlagen sind zwei Entwürfe. Ohne diesen Fall wäre
    // auch eine Fassung grün, die beim Anlegen nach Eigentümer zusammenfasst — dann verlöre der
    // zweite offline erfasste Entwurf desselben Menschen still seinen Inhalt.
    const erst = enqueue(
      [],
      neu({ id: "op-1", kind: "draft.create", draftId: null, eigentuemer: A }),
    );
    const zwei = enqueue(
      erst,
      neu({ id: "op-2", kind: "draft.create", draftId: null, eigentuemer: A }),
    );
    expect(zwei).toHaveLength(2);
  });
});
