import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("KW-PROD-27: Capture Submit Flow", () => {
  it("schickt den fortgesetzten Studio-Draft MIT dem Promote — ohne vorgeschalteten PUT", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    // ==========================================================================================
    // AUFTRAG-mega22 Block H — UMGEDREHTE ZUSICHERUNG.
    // ==========================================================================================
    //
    // Bis mega21 pinnte dieser Fall „erst update, dann promote":
    //     const updateIndex = source.indexOf("await endpoints.drafts.update(draftId, draftPayload)");
    //     expect(updateIndex).toBeGreaterThan(0);
    //     expect(promoteIndex).toBeGreaterThan(updateIndex);
    //
    // Genau diese Reihenfolge WAR der Mangel, und zwar derselbe, den mega21 Block B auf dem
    // Dokumentweg beseitigt hat: nach einem serverseitig gelungenen ersten Promote ist der Entwurf
    // gelöscht. Ging nur die ANTWORT verloren, scheiterte der zweite Klick am vorgeschalteten PUT
    // mit 404 — und der Idempotenz-Nachschlag des Promote wurde NIE erreicht.
    //
    // Der Pin steht jetzt auf der Gegenrichtung: der Entwurfsstand reist IM Promote-Request, und
    // ein vorgeschalteter Entwurfs-PUT existiert auf diesem Weg nicht mehr.
    expect(source).not.toContain("await endpoints.drafts.update(draftId, draftPayload)");
    const promoteIndex = source.indexOf("endpoints.drafts.promote(draftId, {");
    expect(promoteIndex).toBeGreaterThan(0);
    // Der Vorgangsschlüssel und der Stand reisen gemeinsam mit — beides ist der Vertrag aus
    // mega21 Block B, eine Tür weiter (services/app/src/routes/capture-routes.ts).
    const promoteAufruf = source.slice(promoteIndex, promoteIndex + 220);
    expect(promoteAufruf).toContain("operationId");
    expect(promoteAufruf).toContain("draftPayload");
    expect(source).toContain("setSavedKoId(ko.id)");
    expect(source).toContain('qc.invalidateQueries({ queryKey: ["validation"] })');
  });

  it("zeigt nach erfolgreichem Einreichen echte naechste Schritte statt Berichtverlust", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );
    const successSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/captureSuccess.ts"),
      "utf8",
    );

    // AUFTRAG-mega70 BLOCK C: die Seite reicht die echte Rolle herein (betonte Handlung je Rolle).
    expect(captureSource).toContain("captureNextSteps(savedKoId, role)");
    expect(successSource).toContain("capture.savedValidate");
    expect(successSource).toContain("validationOriginHref");
    expect(successSource).toContain("`/wissen/${koId}`");
  });
});

describe("KW-PROD-29: Frontdoor Save/Submit State", () => {
  it("zeigt den aus der Vordertuer gespeicherten Draft auf /erfassen als klare Statuskarte", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");

    expect(source).toContain("frontDoorDraftSavedFromState");
    expect(source).toContain("frontDoorDraftSaved");
    expect(source).toContain("Entwurf gespeichert");
    expect(source).toContain("Entwurf fortsetzen");
    expect(source).toContain("Neuer leerer Eintrag");
    expect(source).toContain("useLocation");
    expect(source).toContain('navigate("/erfassen", { replace: true, state: null })');
    // Formatiererfester Pin (der Satz bricht je nach Zeilenlänge um).
    expect(source).toContain("gespeicherte Entwurf ist in der Liste hervorgehoben");
    // AUFTRAG-sortfilter: die Entwurfsliste (inkl. Hervorhebung) ist nach CaptureDraftList
    // herausgelöst; Capture reicht die gerade gespeicherte Id als highlightId durch, die Komponente
    // hebt genau diesen Entwurf hervor (Verhalten unverändert, nur gekapselt).
    expect(source).toContain("highlightId={frontDoorDraftSaved?.id ?? null}");
    const listSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/CaptureDraftList.tsx"),
      "utf8",
    );
    expect(listSource).toContain("highlightId === d.id");
  });

  it("sperrt wiederholte Frontdoor-Save- und Submit-Ausloesungen lokal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(source).toContain("saveRequestedRef");
    expect(source).toContain("submitRequestedRef");
    expect(source).toContain("if (!canSave || saveRequestedRef.current)");
    // AUFTRAG-mega9 Block A (KW-E2E-001): Die Doppelklick-Sperre ist unverändert — nur die
    // VORBEDINGUNG des Einreichens ist keine stille Knopfsperre mehr: `busy` deckt die laufenden
    // Vorgänge ab, die Inhaltsbedingung wird zur sichtbaren Feldvalidierung (submitBlockReasons).
    expect(source).toContain("if (busy || submitRequestedRef.current)");
    expect(source).toContain("saveRequestedRef.current = true");
    expect(source).toContain("submitRequestedRef.current = true");
    // Nach dem Einreichen sperren Speichern UND Einreichen weiterhin — jetzt über das gemeinsame `busy`.
    expect(source).toMatch(/const busy =[\s\S]{0,160}submittedKo !== null/);
  });

  it("zeigt Entwurfsmetadaten und macht die Draft-Sichtbarkeit explizit", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    // AUFTRAG-sortfilter: die je-Entwurf-Metadaten sind nach CaptureDraftList herausgelöst und dabei
    // lokalisiert worden. Das Scope-Label bleibt in Capture und wird durchgereicht.
    const listSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/CaptureDraftList.tsx"),
      "utf8",
    );
    const i18nSource = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");

    expect(source).toContain("draftScopeLabel");
    expect(source).toContain("Admin-Ansicht: alle Entwürfe");
    expect(source).toContain("Meine Entwürfe");
    expect(listSource).toContain("formatDraftTimestamp");
    expect(listSource).toContain("draftAuthorName");
    // Ersteller/Gespeichert/Status je Entwurf — jetzt über i18n-Keys (echte Umlaute in i18n.ts).
    expect(listSource).toContain("capture.draftCreatorMeta");
    expect(listSource).toContain("capture.draftSavedMeta");
    expect(listSource).toContain("capture.draftStatusMeta");
    expect(i18nSource).toContain('"capture.draftCreatorMeta": "Ersteller: {{name}}"');
    expect(i18nSource).toContain('"capture.draftSavedMeta": "Gespeichert: {{date}}"');
    expect(i18nSource).toContain('"capture.draftStatusMeta": "Status: Entwurf"');
  });
});
