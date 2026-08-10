import { describe, expect, it } from "vitest";
import { GENESIS, hashEntry } from "./chain";
import {
  InMemoryAuditRepo,
  VALIDATION_DECISION_ACTIONS,
  pruefeValidationDecisionRef,
} from "./repo";
import type { AuditEntry } from "./types";

// ================================================================================================
// W3-B (KW-W3-19) — DER LESEVERTRAG DER VALIDIERUNGSREFERENZ
// ================================================================================================
//
// KW-W3-19 verlangt genau einen Leseweg: Eintrag ueber `auditSeq` laden, den geladenen `hash` exakt
// gegen `auditHash` pruefen, und die vorhandene Kettenpruefung zusaetzlich anwenden. Ausdrueckliche
// No-Gos: Hash-only-Zugriff, spaeteres Erraten eines passenden Eintrags, Ableitung ueber
// Zeitstempel oder Anzeigenamen.

function eintrag(over: Partial<AuditEntry> = {}): AuditEntry {
  const roh: AuditEntry = {
    seq: 1,
    at: "2026-08-02T09:00:00.000Z",
    actor: "anna",
    action: "ko.rated",
    target: "ko-1",
    payload: { verdict: "up", koVersion: 3 },
    prevHash: "GENESIS",
    hash: "",
    ...over,
  };
  return { ...roh, hash: over.hash ?? hashEntry(roh) };
}

describe("W3-B/67 · findBySeq ist ein Punktzugriff, kein Suchweg", () => {
  it("liefert genau den Eintrag zu dieser Sequenz", async () => {
    const repo = new InMemoryAuditRepo();
    await repo.append(eintrag({ seq: 1, target: "ko-1" }));
    await repo.append(eintrag({ seq: 2, target: "ko-2" }));
    expect((await repo.findBySeq(1))?.target).toBe("ko-1");
    // Gegenkontrolle: eine andere Sequenz liefert einen ANDEREN Eintrag — sonst waere der
    // Positivbefund blind gegen eine fest verdrahtete Antwort.
    expect((await repo.findBySeq(2))?.target).toBe("ko-2");
  });

  it("ein fehlender Eintrag ist undefined — kein Wurf, keine Ersatzsuche", async () => {
    const repo = new InMemoryAuditRepo();
    await repo.append(eintrag({ seq: 1 }));
    expect(await repo.findBySeq(99)).toBeUndefined();
    expect(await repo.findBySeq(0)).toBeUndefined();
  });

  it("findBySeq benutzt NICHT all() — und der Zaehler kann zaehlen", async () => {
    const repo = new InMemoryAuditRepo();
    await repo.append(eintrag({ seq: 1 }));
    let allAufrufe = 0;
    const beobachtet = new Proxy(repo, {
      get(ziel, feld, empfaenger) {
        if (feld === "all") {
          allAufrufe += 1;
        }
        return Reflect.get(ziel, feld, empfaenger);
      },
    }) as InMemoryAuditRepo;

    await beobachtet.findBySeq(1);
    expect(allAufrufe, "ein Punktzugriff darf die Kette nicht laden").toBe(0);
    // POSITIVKONTROLLE: derselbe Zaehler MUSS zaehlen koennen.
    await beobachtet.all();
    expect(allAufrufe).toBe(1);
  });
});

describe("W3-B/67 · die sechs Zustaende der Referenzpruefung (KW-W3-19)", () => {
  const erwartung = { koId: "ko-1", koVersion: 3 } as const;

  // BEN-70 ROT-1 / Auftrag 73: die Kette ist Pflichtparameter geworden. Diese Faelle pruefen
  // weiterhin GENAU dasselbe wie in Freeze 67 — sie legen dafuer jetzt die (intakte) Kette vor,
  // in der ihr Zieleintrag liegt. Keine Zusage wurde abgeschwaecht; die Faelle sind strenger,
  // weil sie nun zusaetzlich in einer verifizierten Kette stehen muessen.
  const alsKette = (e: AuditEntry): AuditEntry[] => [{ ...e, prevHash: GENESIS }];

  it("Treffer: Sequenz, Hash, Action und Subject stimmen", () => {
    const e = eintrag();
    expect(
      pruefeValidationDecisionRef(e, { auditSeq: 1, auditHash: e.hash }, erwartung, alsKette(e)),
    ).toBe("OK");
  });

  it("MISSING: der Eintrag fehlt", () => {
    expect(
      pruefeValidationDecisionRef(undefined, { auditSeq: 7, auditHash: "egal" }, erwartung, []),
    ).toBe("MISSING");
  });

  it("HASH_MISMATCH: der geladene Hash weicht ab — und es wird NICHT weitergesucht", () => {
    const e = eintrag();
    expect(
      pruefeValidationDecisionRef(
        e,
        { auditSeq: 1, auditHash: "fremder-hash" },
        erwartung,
        alsKette(e),
      ),
    ).toBe("HASH_MISMATCH");
  });

  it("HASH_MISMATCH schlaegt auch, wenn der Eintrag selbst manipuliert wurde", () => {
    const e = eintrag();
    const manipuliert = { ...e, payload: { verdict: "down" } };
    expect(
      pruefeValidationDecisionRef(
        manipuliert,
        { auditSeq: 1, auditHash: e.hash },
        erwartung,
        alsKette(manipuliert),
      ),
    ).toBe("HASH_MISMATCH");
  });

  it("WRONG_EVENT_TYPE: der Eintrag ist keine Validierungsentscheidung", () => {
    const e = eintrag({ action: "ko.assigned" });
    expect(
      pruefeValidationDecisionRef(e, { auditSeq: 1, auditHash: e.hash }, erwartung, alsKette(e)),
    ).toBe("WRONG_EVENT_TYPE");
  });

  it("die erlaubte Action-Menge ist BENANNT und traegt genau die drei Entscheidungen", () => {
    expect([...VALIDATION_DECISION_ACTIONS].sort()).toEqual([
      "ko.admin-validated",
      "ko.rated",
      "ko.returned-to-author",
    ]);
    for (const action of VALIDATION_DECISION_ACTIONS) {
      const e = eintrag({ action });
      expect(
        pruefeValidationDecisionRef(e, { auditSeq: 1, auditHash: e.hash }, erwartung, alsKette(e)),
      ).toBe("OK");
    }
  });

  it("WRONG_SUBJECT: falsche KO-Id", () => {
    const e = eintrag({ target: "ko-fremd" });
    expect(
      pruefeValidationDecisionRef(e, { auditSeq: 1, auditHash: e.hash }, erwartung, alsKette(e)),
    ).toBe("WRONG_SUBJECT");
  });

  it("WRONG_SUBJECT: richtige KO-Id, aber falsche KO-Version", () => {
    const e = eintrag({ payload: { verdict: "up", koVersion: 2 } });
    expect(
      pruefeValidationDecisionRef(e, { auditSeq: 1, auditHash: e.hash }, erwartung, alsKette(e)),
    ).toBe("WRONG_SUBJECT");
  });

  it("REDACTED wird NICHT hier erfunden — die Pruefung kennt nur Belegtatsachen", () => {
    // Die Redaktion ist eine Sichtbarkeitsentscheidung des LESERS, keine Eigenschaft des Eintrags.
    // Deshalb liefert diese Funktion sie nie von sich aus; sie kommt am Leseweg dazu (ask-Seite).
    const e = eintrag();
    expect(
      pruefeValidationDecisionRef(e, { auditSeq: 1, auditHash: e.hash }, erwartung, alsKette(e)),
    ).not.toBe("REDACTED");
  });

  it("die Sequenz muss zum geladenen Eintrag gehoeren — kein stiller Versatz", () => {
    const e = eintrag({ seq: 1 });
    expect(
      pruefeValidationDecisionRef(e, { auditSeq: 2, auditHash: e.hash }, erwartung, alsKette(e)),
    ).toBe("MISSING");
  });
});
