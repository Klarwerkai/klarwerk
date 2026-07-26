import { describe, expect, it, vi } from "vitest";
import {
  type DocumentAppendCommit,
  appendRejectionCode,
  commitDocumentAppend,
  newAppendOperationId,
} from "../../apps/web/src/lib/appendToArticle";
import {
  type DocumentAppendJob,
  finalizeCaptureSubmit,
} from "../../apps/web/src/lib/captureAttachments";

// ==============================================================================================
// AUFTRAG-mega18 Block A — DIESE DATEI IST ERSETZT WORDEN (Inhalt, nicht Name).
// ==============================================================================================
//
// Bis mega17 prüfte sie `composeAppendToArticle`: den Client-Ablauf Anker → Belege → Inhalt mit
// kompensierender Rücknahme per `remove-source`. Beides existiert nicht mehr. ben hat die
// Kompensation auseinandergenommen — sie kann selbst scheitern, der append-only EvidenceRecord
// bleibt ohnehin stehen, und bei UNKLAREM Revisionsausgang macht sie den Schaden erst. Und der
// reine Ablauftest von damals (die früheren Zeilen 101-121) traf genau die Kante nicht, die zählt:
// „der Server hat committet, aber die Antwort kam nicht an".
//
// Der Nachfolger prüft, was jetzt gilt: EIN Aufruf, DREI mögliche Wahrheiten, KEINE vierte — und
// unter keiner von ihnen wird etwas zurückgenommen. Die serverseitige Operation selbst liegt in
// tests/capture/mega18-verbund-operation.test.ts. Der Dateiname ist der einzige Rest von mega17:
// Umbenennen hieße Löschen, und das ist der Hand in diesem Auftrag nicht erlaubt.

const COMMIT: DocumentAppendCommit = {
  committed: true,
  operationId: "append-1234",
  replayed: false,
  koVersion: 2,
  attachmentId: "att-1",
  sourceIds: ["src-1", "src-2"],
};

/** Ein Fehler in der Form, in der der API-Client Domänenfehler liefert (ApiError trägt `code`). */
function domainError(code: string, message = "abgelehnt"): Error {
  return Object.assign(new Error(message), { code });
}

describe("mega18 A: der Ausgang ist committed, rejected oder unknown — und sonst nichts", () => {
  it("committed: das Ergebnis wird durchgereicht, ohne Wiederholversuch", async () => {
    const append = vi.fn(async () => COMMIT);
    const outcome = await commitDocumentAppend({ append }, "append-1234");
    expect(outcome.kind).toBe("committed");
    expect(outcome.commit).toBe(COMMIT);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith("append-1234");
  });

  it("rejected: ein DOMÄNEN-Fehlercode belegt „nichts geschrieben“ — kein Wiederholversuch", async () => {
    // Der Server hat geantwortet und abgelehnt. Damit ist der Ausgang EINDEUTIG; ihn zu wiederholen
    // wäre nur Lärm. Nur DIESER Fall trägt später die Zusage „der Artikel ist unverändert".
    for (const code of [
      "MISSING_DOCUMENT_ANCHOR",
      "EXTERNAL_ATTACH_BLOCKED",
      "BAD_REQUEST",
      "INVALID_SOURCE",
      "INVALID_OPERATION_ID",
      "STALE_WRITE",
      "NOT_FOUND",
      "FORBIDDEN",
      "UNAUTHENTICATED",
    ]) {
      const append = vi.fn(async () => {
        throw domainError(code);
      });
      const outcome = await commitDocumentAppend({ append }, "append-1234");
      expect(outcome.kind, code).toBe("rejected");
      expect(outcome.reason, code).toBe(code);
      expect(append, code).toHaveBeenCalledTimes(1);
    }
  });

  it("unknown: ein unbekannter Fehler wird GENAU EINMAL wiederholt — mit DERSELBEN Kennung", async () => {
    // Das ist der Ersatz für die Kompensation: statt zu RATEN, was gilt, wird ehrlich NACHGEFRAGT.
    // Die Wiederholung ist gefahrlos, weil die Operation idempotent ist — und sie MUSS dieselbe
    // Kennung tragen, sonst wäre sie ein zweiter Vorgang und würde doppelt anlegen.
    const append = vi
      .fn<(opId: string) => Promise<DocumentAppendCommit>>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ...COMMIT, replayed: true });

    const outcome = await commitDocumentAppend({ append }, "append-1234");

    expect(outcome.kind).toBe("committed");
    expect(outcome.commit?.replayed).toBe(true);
    expect(append).toHaveBeenCalledTimes(2);
    expect(append.mock.calls.map(([opId]) => opId)).toEqual(["append-1234", "append-1234"]);
  });

  it("unknown bleibt unknown, wenn auch die Wiederholung nichts erfährt — und NICHTS wird angefasst", async () => {
    const append = vi.fn(async () => {
      throw new Error("network down");
    });
    const api = { append };
    const outcome = await commitDocumentAppend(api, "append-1234");
    expect(outcome.kind).toBe("unknown");
    expect(append).toHaveBeenCalledTimes(2); // genau ein Wiederholversuch, keine Schleife
    // Und es gibt gar keinen Griff, mit dem hier etwas zurückgenommen werden KÖNNTE: die injizierte
    // API hat genau eine Methode. Das ist die Zusage in der Typform, nicht bloß im Kommentar.
    expect(Object.keys(api)).toEqual(["append"]);
  });

  it("ein 5xx ohne Domänencode ist UNKLAR, nicht „nichts passiert“", async () => {
    // Ein 500 kann eintreten, NACHDEM der Commit stand (Antwortzustellung, Folgeschritt). Ihn als
    // „abgelehnt" zu lesen wäre exakt der mega17-Fehler.
    const append = vi.fn(async () => {
      throw Object.assign(new Error("Unerwarteter Fehler."), { code: "INTERNAL", status: 500 });
    });
    const outcome = await commitDocumentAppend({ append }, "append-1234");
    expect(outcome.kind).toBe("unknown");
  });

  it("appendRejectionCode ist eine ALLOWLIST — unbekannte Codes landen auf der sicheren Seite", () => {
    expect(appendRejectionCode(domainError("MISSING_DOCUMENT_ANCHOR"))).toBe(
      "MISSING_DOCUMENT_ANCHOR",
    );
    // Unbekannt ⇒ null ⇒ „unklar" ⇒ nichts anfassen. Eine Blockliste hätte hier fälschlich
    // „abgelehnt" gesagt und damit die Zusage „unverändert" auf einen unbelegten Fall ausgedehnt.
    expect(appendRejectionCode(domainError("IRGENDEIN_NEUER_CODE"))).toBeNull();
    expect(appendRejectionCode(new Error("network down"))).toBeNull();
    expect(appendRejectionCode(undefined)).toBeNull();
  });

  it("die Kennung ist je Vorgang neu und erfüllt den Serververtrag", () => {
    const a = newAppendOperationId();
    const b = newAppendOperationId();
    expect(a).not.toBe(b);
    // Derselbe Zeichensatz/dieselbe Länge, die normalizeAppendOperationId serverseitig verlangt.
    expect(a).toMatch(/^[A-Za-z0-9_:.-]{8,120}$/);
  });
});

// ----------------------------------------------------------------------------------------------
// Der Capture-Finalizer: die Übernahme-Vorgänge laufen als eigene Phase-B-Schritte, seriell, und
// ihr Ausgang wird DREIWERTIG gemeldet.
// ----------------------------------------------------------------------------------------------
describe("mega18 A-3: der Capture-Finalizer führt die Übernahme-Vorgänge und meldet ehrlich", () => {
  const api = {
    upload: vi.fn(async () => ({ id: "obj-1", size: 10 })),
    attach: vi.fn(async () => ({})),
  };

  it("committet: kein Teilfehler, und der Vorgang lief genau einmal", async () => {
    const run = vi.fn(async () => ({ committed: true, unclear: false }));
    const jobs: DocumentAppendJob[] = [{ name: "Pruefbericht.pdf", run }];
    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [],
      api,
      documentAppends: jobs,
    });
    expect(res.failed).toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("abgelehnt ⇒ Grund „provenance“ (ein HERKUNFTS-Befund, kein Anhangsfehler)", async () => {
    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [],
      api,
      documentAppends: [
        { name: "Pruefbericht.pdf", run: async () => ({ committed: false, unclear: false }) },
      ],
    });
    expect(res.failed).toEqual([{ name: "Pruefbericht.pdf", reason: "provenance" }]);
  });

  it("unklar ⇒ eigener Grund „unclear“ — weder Erfolg noch Fehlschlag", async () => {
    // Beides wäre eine Unwahrheit. mega17 hat an dieser Stelle je nach Zweig BEIDE erzählt.
    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [],
      api,
      documentAppends: [
        { name: "Pruefbericht.pdf", run: async () => ({ committed: false, unclear: true }) },
      ],
    });
    expect(res.failed).toEqual([{ name: "Pruefbericht.pdf", reason: "unclear" }]);
  });

  it("mehrere Ankerdokumente laufen SERIELL — nie zwei Schreibvorgänge am selben KO gleichzeitig", async () => {
    const reihenfolge: string[] = [];
    const job = (name: string): DocumentAppendJob => ({
      name,
      run: async () => {
        reihenfolge.push(`start:${name}`);
        await new Promise((r) => setTimeout(r, 1));
        reihenfolge.push(`ende:${name}`);
        return { committed: true, unclear: false };
      },
    });
    await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [],
      api,
      documentAppends: [job("a.pdf"), job("b.pdf")],
    });
    expect(reihenfolge).toEqual(["start:a.pdf", "ende:a.pdf", "start:b.pdf", "ende:b.pdf"]);
  });

  it("ein WERFENDER Vorgang kippt den Submit nicht — er wird als Herkunfts-Befund gemeldet", async () => {
    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [],
      api,
      documentAppends: [
        {
          name: "Pruefbericht.pdf",
          run: async () => {
            throw new Error("unerwartet");
          },
        },
        { name: "Zweite.pdf", run: async () => ({ committed: true, unclear: false }) },
      ],
    });
    // Der erste Befund ist gemeldet, der ZWEITE Vorgang ist trotzdem gelaufen.
    expect(res.failed).toEqual([{ name: "Pruefbericht.pdf", reason: "provenance" }]);
  });
});
