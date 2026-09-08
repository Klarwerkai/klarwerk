import { describe, expect, it } from "vitest";
import {
  type AuditEreignis,
  type VerzeichnisLage,
  type VerzeichnisStand,
  auditEventDetail,
  verzeichnisNamen,
} from "./auditEventDetail";

// JOB 3140 · UX-11 — DIE ZUORDNUNG, OHNE DOM.
//
// Hier entscheidet sich, ob das Prüfprotokoll die Wahrheit sagt. Drei Fehler wären möglich und
// werden einzeln ausgeschlossen:
//   (b) einer gelöschten Kennung den heutigen Namen einer FREMDEN Person ankleben,
//   (c) eine fehlende Vorrolle mit einem Strich oder „viewer" auffüllen,
//   (d) einen unbekannten Rollenwert auf eine bekannte Rolle runden.
// Dazu kommt der Zustandsvertrag aus §9: „Konto nicht mehr vorhanden" ist eine TATSACHENAUSSAGE und
// setzt eine erfolgreich geladene Verzeichnisantwort voraus, in der die Kennung fehlt.

const GELADEN = (
  eintraege: Record<string, string>,
  stand: VerzeichnisStand = "frisch",
): VerzeichnisLage => ({
  art: "geladen",
  namen: new Map(Object.entries(eintraege)),
  stand,
});

const ROLLENWECHSEL: AuditEreignis = {
  action: "user.role-change",
  actor: "a-1",
  target: "t-1",
  payload: {
    role: "controller",
    previousRole: "experte",
    actorName: "Ada Admin",
    targetName: "Tom Test",
  },
};

const zeile = <T extends { labelKey: string }>(zeilen: readonly T[], labelKey: string): T => {
  const treffer = zeilen.find((z) => z.labelKey === labelKey);
  if (!treffer) {
    throw new Error(`keine Zeile „${labelKey}" (vorhanden: ${zeilen.map((z) => z.labelKey)})`);
  }
  return treffer;
};

describe("auditEventDetail", () => {
  it("a die im Eintrag gespeicherten Namen schlagen das Verzeichnis", () => {
    // Das Verzeichnis führt HEUTE andere Namen (umbenannt). Das Protokoll erzählt, was DAMALS war.
    const zeilen = auditEventDetail(
      ROLLENWECHSEL,
      GELADEN({ "a-1": "Heute Anders", "t-1": "Auch Anders" }),
    );
    expect(zeile(zeilen, "audit.detail.actor")).toMatchObject({
      kind: "text",
      value: "Ada Admin",
      id: "a-1",
    });
    expect(zeile(zeilen, "audit.detail.target")).toMatchObject({
      kind: "text",
      value: "Tom Test",
      id: "t-1",
    });
  });

  it("a2 fehlt der gespeicherte Name, springt das geladene Verzeichnis ein", () => {
    const alt: AuditEreignis = {
      action: "user.role-change",
      actor: "a-1",
      target: "t-1",
      payload: { role: "controller" },
    };
    const zeilen = auditEventDetail(alt, GELADEN({ "a-1": "Ada Admin", "t-1": "Tom Test" }));
    expect(zeile(zeilen, "audit.detail.actor")).toMatchObject({ kind: "text", value: "Ada Admin" });
    expect(zeile(zeilen, "audit.detail.target")).toMatchObject({ kind: "text", value: "Tom Test" });
  });

  it("b unbekannte Kennung → Kennung + „nicht mehr vorhanden“, NIE ein fremder Name", () => {
    const alt: AuditEreignis = {
      action: "user.role-change",
      actor: "geloescht-1",
      target: "geloescht-2",
      payload: { role: "controller" },
    };
    // Das Verzeichnis ist erfolgreich geladen und kennt GENAU EINE, andere Person.
    const zeilen = auditEventDetail(alt, GELADEN({ "lebt-1": "Lea Lebt" }));
    for (const key of ["audit.detail.actor", "audit.detail.target"]) {
      const z = zeile(zeilen, key);
      expect(z.kind).toBe("id");
      expect(z).toMatchObject({ hinweisKey: "audit.detail.accountGone" });
      expect(z.value).toBeUndefined();
    }
    expect(zeile(zeilen, "audit.detail.actor").id).toBe("geloescht-1");
    expect(zeile(zeilen, "audit.detail.target").id).toBe("geloescht-2");
    // Der harte Teil: der eine vorhandene Name darf NIRGENDS auftauchen.
    expect(JSON.stringify(zeilen)).not.toContain("Lea Lebt");
  });

  it("b2 „nicht mehr vorhanden“ setzt eine erfolgreiche Verzeichnisantwort voraus (§9)", () => {
    const alt: AuditEreignis = {
      action: "user.role-change",
      actor: "a-1",
      target: "t-1",
      payload: { role: "controller" },
    };
    for (const [lage, hinweis] of [
      [{ art: "laedt" } as const, "audit.detail.nameLoading"],
      [{ art: "nichtAbrufbar" } as const, "audit.detail.nameUnavailable"],
    ] as const) {
      const zeilen = auditEventDetail(alt, lage);
      const z = zeile(zeilen, "audit.detail.actor");
      expect(z).toMatchObject({ kind: "id", id: "a-1", hinweisKey: hinweis });
      expect(JSON.stringify(zeilen)).not.toContain("accountGone");
    }
  });

  it("b4 Bestand mit gescheiterter Auffrischung: Namen bleiben, die negative Aussage nicht (§9)", () => {
    const alt: AuditEreignis = {
      action: "user.role-change",
      actor: "a-1",
      target: "weg-1",
      payload: { role: "controller" },
    };
    const zeilen = auditEventDetail(alt, GELADEN({ "a-1": "Ada Admin" }, "veraltet"));
    // Der bekannte Name bleibt SICHTBAR — ein alter Bestand wird nicht geleert (REGELN §7).
    expect(zeile(zeilen, "audit.detail.actor")).toMatchObject({ kind: "text", value: "Ada Admin" });
    // Die unbekannte Kennung bekommt die SCHWÄCHERE Aussage: sie kann seither angelegt worden sein.
    expect(zeile(zeilen, "audit.detail.target")).toMatchObject({
      kind: "id",
      id: "weg-1",
      hinweisKey: "audit.detail.nameUnavailable",
    });
  });

  it("b5 Bestand mit LAUFENDER Auffrischung: die Antwort kann die Kennung noch bringen (§9)", () => {
    // JOB 3140 R2, BENs Korrekturpflicht 2. Der Unterschied zu b4 ist keine Feinheit: dort ist die
    // Auffrischung gescheitert (der Name bleibt unbekannt), hier ist sie UNTERWEGS.
    const alt: AuditEreignis = {
      action: "user.role-change",
      actor: "a-1",
      target: "neu-1",
      payload: { role: "controller" },
    };
    const zeilen = auditEventDetail(alt, GELADEN({ "a-1": "Ada Admin" }, "laeuftNach"));
    expect(zeile(zeilen, "audit.detail.actor")).toMatchObject({ kind: "text", value: "Ada Admin" });
    expect(zeile(zeilen, "audit.detail.target")).toMatchObject({
      kind: "id",
      id: "neu-1",
      hinweisKey: "audit.detail.nameLoading",
    });
    expect(JSON.stringify(zeilen)).not.toContain("accountGone");
  });

  it("b3 gespeicherte Namen gelten unabhängig vom Zustand des Verzeichnisses (§9)", () => {
    for (const lage of [
      { art: "laedt" } as const,
      { art: "nichtAbrufbar" } as const,
      GELADEN({}),
    ]) {
      const zeilen = auditEventDetail(ROLLENWECHSEL, lage);
      expect(zeile(zeilen, "audit.detail.actor")).toMatchObject({
        kind: "text",
        value: "Ada Admin",
      });
      expect(JSON.stringify(zeilen)).not.toContain("audit.detail.name");
      expect(JSON.stringify(zeilen)).not.toContain("accountGone");
    }
  });

  it("c fehlendes previousRole → kind „missing“, nie ein Strich und nie „viewer“", () => {
    const alt: AuditEreignis = {
      action: "user.role-change",
      actor: "a-1",
      target: "t-1",
      payload: { role: "controller" },
    };
    const vorher = zeile(auditEventDetail(alt, GELADEN({})), "audit.detail.roleBefore");
    expect(vorher.kind).toBe("missing");
    expect(vorher).not.toHaveProperty("value");
    expect(vorher).not.toHaveProperty("valueKey");
    // Die NEUE Rolle steht daneben — die Halbheit „beides fehlt" wäre kein Fortschritt.
    expect(zeile(auditEventDetail(alt, GELADEN({})), "audit.detail.roleAfter")).toMatchObject({
      kind: "text",
      valueKey: "role.name.controller",
    });
  });

  it("c2 bekannte Rollenwerte laufen über role.name.<wert>", () => {
    const zeilen = auditEventDetail(ROLLENWECHSEL, GELADEN({}));
    expect(zeile(zeilen, "audit.detail.roleBefore")).toMatchObject({
      kind: "text",
      valueKey: "role.name.experte",
    });
    expect(zeile(zeilen, "audit.detail.roleAfter")).toMatchObject({
      kind: "text",
      valueKey: "role.name.controller",
    });
  });

  it("d unbekannter Rollenwert wird roh durchgereicht, nicht gerundet", () => {
    const seltsam: AuditEreignis = {
      action: "user.role-change",
      actor: "a-1",
      target: "t-1",
      payload: { role: "superadmin", previousRole: "administrator" },
    };
    const zeilen = auditEventDetail(seltsam, GELADEN({}));
    expect(zeile(zeilen, "audit.detail.roleAfter")).toMatchObject({
      kind: "text",
      value: "superadmin",
    });
    // „administrator" darf NICHT auf „admin" gerundet werden.
    expect(zeile(zeilen, "audit.detail.roleBefore")).toMatchObject({
      kind: "text",
      value: "administrator",
    });
    expect(zeile(zeilen, "audit.detail.roleBefore").valueKey).toBeUndefined();
  });

  it("e andere Aktionen bekommen nur die beiden Konto-Zeilen, keine Rollenzeilen", () => {
    const login: AuditEreignis = {
      action: "auth.login",
      actor: "a-1",
      target: "a-1",
      payload: {},
    };
    const zeilen = auditEventDetail(login, GELADEN({ "a-1": "Ada Admin" }));
    expect(zeilen.map((z) => z.labelKey)).toEqual(["audit.detail.actor", "audit.detail.target"]);
  });

  it("f eine leere Kennung behauptet keinen Namen", () => {
    const ohne: AuditEreignis = { action: "auth.login", actor: "", target: "t-1", payload: {} };
    const zeilen = auditEventDetail(ohne, GELADEN({ "t-1": "Tom Test" }));
    expect(zeile(zeilen, "audit.detail.actor")).toEqual({
      labelKey: "audit.detail.actor",
      kind: "missing",
    });
  });

  // JOB 3140 R2 · BENs Korrekturpflicht 1 — NICHT JEDES ZIEL IST EIN KONTO.
  //
  // `services/knowledge-object/src/service.ts:2598` schreibt `ko.created` mit `target: ko.id`,
  // `services/conflicts` schreibt Konflikt-Kennungen, `routes/external-routes.ts:52` sogar das
  // Wort „settings". Wer jedes Ziel im Verzeichnis nachschlägt, findet es dort nie — und behauptet
  // damit bei JEDEM Wissensobjekt eine Kontolöschung, die nie stattgefunden hat.

  it("h1 ein Objektziel bekommt eine eigene Zeile und keine Kontoaussage", () => {
    const ko: AuditEreignis = {
      action: "ko.created",
      actor: "a-1",
      target: "ko-77",
      payload: { title: "Reinigung" },
    };
    const zeilen = auditEventDetail(ko, GELADEN({ "a-1": "Ada Admin" }));
    expect(zeilen.map((z) => z.labelKey)).toEqual([
      "audit.detail.actor",
      "audit.detail.targetObject",
    ]);
    const ziel = zeile(zeilen, "audit.detail.targetObject");
    expect(ziel).toMatchObject({ kind: "id", id: "ko-77" });
    expect(ziel.hinweisKey).toBeUndefined();
    // Der Handelnde IST ein Konto und wird weiter aufgelöst — die Korrektur darf nicht überschießen.
    expect(zeile(zeilen, "audit.detail.actor")).toMatchObject({ kind: "text", value: "Ada Admin" });
  });

  it("h2 kein Objektziel behauptet je „Konto nicht mehr vorhanden“", () => {
    // Alle Familien, die das Prüfprotokoll tatsächlich führt (Quelltext-Beleg im Kommentar oben).
    for (const action of [
      "ko.created",
      "ko.purged",
      "conflict.created",
      "overlap.superseded",
      "gap.created",
      "import.candidates-created",
      "library.import",
      "examples.load",
      "external.policy.set",
      "upload.limits.set",
      "answer.helpful",
      "ask.query",
    ]) {
      const zeilen = auditEventDetail(
        { action, actor: "a-1", target: "objekt-1", payload: {} },
        GELADEN({ "a-1": "Ada Admin" }),
      );
      expect(JSON.stringify(zeilen)).not.toContain("accountGone");
      expect(zeile(zeilen, "audit.detail.targetObject").id).toBe("objekt-1");
    }
  });

  it("h3 die Kontofamilie behält ihre Kontozeile", () => {
    // Die Kehrseite: würde die Kontoauflösung zu weit zurückgenommen, verschwände genau der Nutzen
    // dieses Auftrags. Jede Aktion, die `services/auth/src/service.ts` schreibt, bleibt Konto.
    for (const action of [
      "auth.login",
      "auth.logout",
      "notice.acknowledged",
      "user.approve",
      "user.delete",
      "user.oidc-linked",
      "user.oidc-linked-unverified",
      "user.oidc-provisioned",
      "user.password-changed",
      "user.password-reset",
      "user.password-reset-email",
      "user.role-change",
      "user.role-claim-missing",
      "user.role-synced",
    ]) {
      const zeilen = auditEventDetail(
        { action, actor: "a-1", target: "t-1", payload: {} },
        GELADEN({ "a-1": "Ada Admin", "t-1": "Tom Test" }),
      );
      expect(zeile(zeilen, "audit.detail.target")).toMatchObject({
        kind: "text",
        value: "Tom Test",
      });
    }
  });

  it("i der Akteur „system“ ist kein gelöschtes Konto", () => {
    // `services/ask/src/service.ts:1171` und `services/conflicts/src/service.ts:613` schreiben
    // `actor: "system"`. Im Verzeichnis steht das nie — als Konto gelesen wäre es „gelöscht".
    const zeilen = auditEventDetail(
      { action: "gap.created", actor: "system", target: "luecke-1", payload: {} },
      GELADEN({ "a-1": "Ada Admin" }),
    );
    expect(zeile(zeilen, "audit.detail.actor")).toEqual({
      labelKey: "audit.detail.actor",
      kind: "text",
      valueKey: "audit.detail.systemActor",
    });
    expect(JSON.stringify(zeilen)).not.toContain("accountGone");
  });

  it("g verzeichnisNamen macht aus der Antwort eine Zuordnung über die Kennung", () => {
    const namen = verzeichnisNamen([
      { id: "a-1", name: "Ada Admin" },
      { id: "t-1", name: "Tom Test" },
    ]);
    expect(namen.get("a-1")).toBe("Ada Admin");
    expect(namen.get("t-1")).toBe("Tom Test");
    expect(namen.get("gibt-es-nicht")).toBeUndefined();
  });
});
