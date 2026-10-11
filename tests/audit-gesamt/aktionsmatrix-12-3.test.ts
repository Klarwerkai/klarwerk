// Aufnahme gesamt-auditprotokoll · FR-AUD-01 / NFR-TAI-01 / R-0607 / R-2206.
//
// DIE VOLLSTÄNDIGE §12.3-MATRIX, AM DRAHT GEFAHREN. Die Funktionsbeschreibung (§12.3) zählt die
// Aktionen auf, die das Protokoll lückenlos tragen muss: Erfassen, Validieren, Ablehnen,
// Kommentieren, Konflikt, Eskalation, Auflösung, Zuweisung, Kategorie, Re-Validierung, „Hat
// geholfen", Export/Import, Login/Logout, Nutzerverwaltung, Autor-Übergabe — jeweils mit wer, was,
// wann. Die Restmatrix aus R-2206 deckte Eskalation, Kategorie, Re-Validierung, Konfliktauflösung
// und Export nicht ab; Re-Validierung und Export schrieben bis zu diesem Auftrag gar keinen eigenen
// Eintrag (Re-Validierung nur `ko.revised`, Export nichts).
//
// Jede Zeile fährt den ECHTEN Nutzerweg über HTTP mit der Rolle, die ihn im Betrieb fährt, und liest
// danach den geschriebenen Eintrag — Aktion, handelnde Kennung, Ziel, Zeitstempel. Am Ende muss die
// Kette über alle Einträge nachrechenbar bleiben.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "../../services/audit";
import {
  type FrischeBuehne,
  type Rolle,
  baueFrischeBuehne,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

const KO_INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
  confidentiality: "intern",
} as const;

const PASSENDE_FRAGE = "Dichtung vor dem Anlauf prüfen";

function kopf(b: FrischeBuehne, rolle: Rolle): Record<string, string> {
  return { authorization: `Bearer ${b.sitzung[rolle]}` };
}

async function fahre(
  app: FastifyInstance,
  headers: Record<string, string>,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
) {
  const res = await app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  expect(
    res.statusCode,
    `${method} ${url} → ${res.statusCode} ${res.body.slice(0, 300)}`,
  ).toBeLessThan(300);
  return res;
}

/** Der jüngste Eintrag mit dieser Aktion und diesem Handelnden — gelesen, nicht angenommen. */
async function beleg(
  b: FrischeBuehne,
  action: string,
  actor: string,
  target?: string,
): Promise<AuditEntry> {
  const treffer = (await b.services.audit.list({ action, actor })).filter(
    (e) => target === undefined || e.target === target,
  );
  const letzter = treffer.at(-1);
  expect(
    letzter,
    `kein Eintrag action=${action} actor=${actor} target=${target ?? "*"}`,
  ).toBeDefined();
  const e = letzter as AuditEntry;
  // wann: ein echter ISO-Zeitstempel
  expect(Number.isNaN(Date.parse(e.at))).toBe(false);
  return e;
}

describe("§12.3 · jede genannte Aktion erzeugt einen Eintrag mit wer, was, wann (HTTP)", () => {
  it("Erfassen … Autor-Übergabe: alle Aktionen belegt, Kette danach nachrechenbar", async () => {
    const b = await baueFrischeBuehne();
    const { app, konto } = b;

    // Login: beim Bühnenbau über POST /api/auth/login für jede Rolle.
    for (const rolle of ["viewer", "experte", "controller", "admin"] as const) {
      await beleg(b, "auth.login", konto[rolle].id);
    }

    // Nutzerverwaltung · Kontoanlage (Bens Befund, Nacharbeit 2). Die Ersteinrichtung der Bühne
    // legte den Admin an — eigener Eintrag mit dem Konto als Handelndem und Ziel.
    expect((await beleg(b, "user.created", konto.admin.id, konto.admin.id)).payload).toEqual({
      via: "bootstrap",
      role: "admin",
      approved: true,
    });
    // Selbstregistrierung über HTTP: der Eintrag steht VOR jeder Freigabe da.
    const selbst = (
      await fahre(app, {}, "POST", "/api/auth/register", {
        name: "Matrix Selbst",
        email: "selbst@abnahme.de",
        password: "Matrix-Selbst-2026!",
      })
    ).json() as { id: string };
    expect((await beleg(b, "user.created", selbst.id, selbst.id)).payload).toEqual({
      via: "self",
      role: "experte",
      approved: false,
    });
    expect(await b.services.audit.list({ action: "user.approve", target: selbst.id })).toEqual([]);
    // Anlage durch den Admin über HTTP: der Admin ist der Handelnde, das neue Konto das Ziel.
    const angelegt = (
      await fahre(app, kopf(b, "admin"), "POST", "/api/users", {
        name: "Matrix Angelegt",
        email: "angelegt@abnahme.de",
        password: "Matrix-Angelegt-2026!",
      })
    ).json() as { id: string };
    const anlage = await beleg(b, "user.created", konto.admin.id, angelegt.id);
    expect(anlage.payload).toEqual({ via: "admin", role: "experte", approved: false });
    const freigabe = await beleg(b, "user.approve", konto.admin.id, angelegt.id);
    expect(anlage.seq).toBeLessThan(freigabe.seq);

    // Erfassen
    const ko = (await fahre(app, kopf(b, "experte"), "POST", "/api/kos", { ...KO_INHALT })).json()
      .id as string;
    await beleg(b, "ko.created", konto.experte.id, ko);
    const koB = (
      await fahre(app, kopf(b, "experte"), "POST", "/api/kos", {
        ...KO_INHALT,
        title: "Dichtungswechsel L5",
        statement: "Dichtung nur nach Befund prüfen.",
      })
    ).json().id as string;

    // Kommentieren
    await fahre(app, kopf(b, "viewer"), "PUT", `/api/kos/${ko}`, {
      action: "comment",
      text: "Gilt das auch für L5?",
    });
    await beleg(b, "ko.commented", konto.viewer.id, ko);

    // Zuweisung
    await fahre(app, kopf(b, "controller"), "PUT", `/api/kos/${ko}`, {
      action: "assign",
      userIds: [konto.controller.id],
    });
    expect((await beleg(b, "ko.assigned", konto.controller.id, ko)).payload.userIds).toEqual([
      konto.controller.id,
    ]);

    // Ablehnen (Rot) und Validieren (Grün)
    await fahre(app, kopf(b, "admin"), "PUT", `/api/kos/${ko}`, {
      action: "rate",
      verdict: "down",
    });
    expect((await beleg(b, "ko.rated", konto.admin.id, ko)).payload.verdict).toBe("down");
    await fahre(app, kopf(b, "controller"), "PUT", `/api/kos/${ko}`, {
      action: "rate",
      verdict: "up",
    });
    expect((await beleg(b, "ko.rated", konto.controller.id, ko)).payload.verdict).toBe("up");

    // Kategorie
    await fahre(app, kopf(b, "experte"), "PUT", `/api/kos/${ko}`, {
      action: "category",
      category: "Sicherheit",
    });
    await beleg(b, "ko.category-changed", konto.experte.id, ko);

    // Re-Validierung — ein EIGENER Eintrag, nicht nur `ko.revised`.
    await fahre(app, kopf(b, "experte"), "PUT", `/api/kos/${ko}`, { action: "revalidate" });
    const reval = await beleg(b, "ko.revalidated", konto.experte.id, ko);
    expect(typeof reval.payload.version).toBe("number");

    // Konflikt · Eskalation · Auflösung
    const konflikt = (
      await fahre(app, kopf(b, "controller"), "PUT", `/api/kos/${ko}`, {
        action: "conflict",
        conflict: { koA: ko, koB, type: "truth", description: "Anlauf vs. Befund" },
      })
    ).json() as { id: string };
    await beleg(b, "conflict.created", konto.controller.id, konflikt.id);
    await fahre(app, kopf(b, "controller"), "POST", `/api/conflicts/${konflikt.id}/escalate`);
    await beleg(b, "conflict.escalated", konto.controller.id, konflikt.id);
    await fahre(app, kopf(b, "admin"), "PUT", `/api/kos/${ko}`, {
      action: "resolve-conflict",
      conflictId: konflikt.id,
      decision: "Anlauf gilt.",
    });
    await beleg(b, "conflict.resolved", konto.admin.id, konflikt.id);

    // „Hat geholfen" — mit echtem Beleg aus einer echten Antwort.
    const quelle = (
      await fahre(app, kopf(b, "admin"), "POST", "/api/kos", {
        ...KO_INHALT,
        title: "Dichtungswechsel L6",
      })
    ).json().id as string;
    // R-0278 (Nacharbeit 3): Antwortquelle kann nur Freigegebenes sein. Inhaltsgleich mit `ko` —
    // eine gemeldete Dublette ist für diesen Belegfall unerheblich und wird bestätigt.
    const freigegeben = await fahre(app, kopf(b, "admin"), "PUT", `/api/kos/${quelle}`, {
      action: "admin-validate",
      duplicateAcknowledged: true,
    });
    expect(freigegeben.statusCode, freigegeben.body).toBe(200);
    const gefragt = (
      await fahre(app, kopf(b, "experte"), "POST", "/api/ask", { question: PASSENDE_FRAGE })
    ).json() as { receipt?: string; result?: { sources?: string[] } };
    const quelleDerAntwort = gefragt.result?.sources?.[0];
    expect(typeof gefragt.receipt, "POST /api/ask lieferte keinen Beleg").toBe("string");
    expect(typeof quelleDerAntwort, `keine Quelle (angelegt: ${quelle})`).toBe("string");
    const hilfreich = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: kopf(b, "experte"),
      payload: { koId: quelleDerAntwort, receipt: gefragt.receipt },
    });
    expect(hilfreich.statusCode, hilfreich.body).toBe(204);
    await beleg(b, "answer.helpful", konto.experte.id);

    // Export (jede Ausgabeform) und Import
    for (const format of ["json", "markdown", "mediawiki", "html"] as const) {
      await fahre(app, kopf(b, "viewer"), "GET", `/api/library/export?format=${format}`);
      const exp = (
        await b.services.audit.list({ action: "library.export", actor: konto.viewer.id })
      )
        .filter((e) => e.payload.format === format)
        .at(-1);
      expect(exp, `kein library.export für ${format}`).toBeDefined();
      expect(exp?.payload.includeConfidential).toBe(false);
      expect(Array.isArray(exp?.payload.koIds)).toBe(true);
      expect(exp?.payload.count).toBe((exp?.payload.koIds as unknown[]).length);
    }
    // Import — seit R-0143 legt `POST /api/library/import` kein Objekt mehr direkt an
    // (`library.import` entsteht dort nicht mehr), sondern reiht Kandidaten ein; das Objekt
    // entsteht erst durch die berechtigte Annahme. Beide Schritte werden belegt.
    const eingereiht = (
      await fahre(app, kopf(b, "experte"), "POST", "/api/library/import", {
        items: [
          {
            title: "Spaltmass Anlage 17",
            statement: "Spaltmass vor der Freigabe messen.",
            type: "best_practice",
            category: "Instandhaltung",
            confidentiality: "intern",
          },
        ],
      })
    ).json() as { kandidaten: { id: string }[] };
    const kandidat = eingereiht.kandidaten[0]?.id;
    expect(typeof kandidat, "POST /api/library/import reihte keinen Kandidaten ein").toBe("string");
    // Der Einreihbeleg nennt genau die zurückgegebenen Kandidaten.
    expect((await beleg(b, "import.candidates-created", konto.experte.id)).payload).toEqual({
      count: 1,
      candidateIds: eingereiht.kandidaten.map((k) => k.id),
    });
    await fahre(app, kopf(b, "controller"), "PUT", `/api/library/import/candidates/${kandidat}`, {
      action: "accept",
    });
    const angenommen = await beleg(
      b,
      "import.candidate-accept",
      konto.controller.id,
      kandidat as string,
    );
    expect(typeof angenommen.payload.koId).toBe("string");
    expect(angenommen.payload.duplicate).toBe(false);

    // Autor-Übergabe
    await fahre(app, kopf(b, "admin"), "PUT", `/api/kos/${ko}`, {
      action: "transfer-author",
      newAuthor: konto.controller.id,
    });
    await beleg(b, "ko.author-transferred", konto.admin.id, ko);

    // Nutzerverwaltung (Rollenwechsel) — mit alter und neuer Rolle.
    await fahre(app, kopf(b, "admin"), "PUT", `/api/users/${konto.viewer.id}`, {
      role: "experte",
    });
    const rolle = await beleg(b, "user.role-change", konto.admin.id, konto.viewer.id);
    expect(rolle.payload.previousRole).toBe("viewer");
    expect(rolle.payload.role).toBe("experte");

    // Logout
    await fahre(app, kopf(b, "controller"), "POST", "/api/auth/logout");
    await beleg(b, "auth.logout", konto.controller.id);

    // Die Kette über alles, was diese Matrix geschrieben hat.
    const bericht = await b.services.audit.verifyReport();
    expect(bericht.ok).toBe(true);
    expect(bericht.linkageBreaks).toBe(0);
    const alle = await b.services.audit.list();
    for (const e of alle) {
      expect(e.actor.length, `seq ${e.seq} ohne Handelnden`).toBeGreaterThan(0);
      expect(e.action.length).toBeGreaterThan(0);
    }
    await b.schliesse();
  });
});
