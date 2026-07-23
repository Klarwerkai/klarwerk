import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Draft, DraftPayload } from "../../apps/web/src/api/types";
import {
  ASSIST_ACTIONS,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../../apps/web/src/lib/captureAiAssist";
import {
  CAPTURE_FRONT_DOOR_ROUTE,
  FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
  FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY,
  buildFrontDoorPayload,
  buildFrontDoorStructureInput,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  frontDoorStructuredBodyHtml,
  submitFrontDoorDraft,
  withFrontDoorSaveTimeout,
} from "../../apps/web/src/lib/captureFrontDoor";

describe("KW-PROD-02: CaptureFrontDoor", () => {
  it("stellt den neuen Einstieg als stabile Deep-Link-Route bereit", () => {
    expect(CAPTURE_FRONT_DOOR_ROUTE).toBe("/capture/frontdoor");
    const routesSource = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(routesSource).toContain("CAPTURE_FRONT_DOOR_ITEM");
    expect(routesSource).toContain("CaptureFrontDoor");
  });

  it("leitet einen Titel aus Ueberschrift oder erster Zeile ab", () => {
    expect(deriveFrontDoorTitle("", "<h1>Mein Titel</h1><p>Text</p>")).toBe("Mein Titel");
    expect(deriveFrontDoorTitle("", "<p>Erste Zeile</p><p>Zweite Zeile</p>")).toBe("Erste Zeile");
    expect(deriveFrontDoorTitle("Manuell", "<h2>Ignoriert</h2>")).toBe("Manuell");
    expect(deriveFrontDoorTitle("", "")).toBe("Unbenanntes Wissensobjekt");
    // SCRUM-487 (i18n): der Fallback-Titel folgt der Sprache, wenn die Ansicht ihn durchreicht.
    expect(deriveFrontDoorTitle("", "", "Naamloos kennisobject")).toBe("Naamloos kennisobject");
    expect(
      buildFrontDoorPayload({ title: "", bodyHtml: "", fallbackTitle: "Untitled" }).title,
    ).toBe("Untitled");
  });

  it("nutzt die FMT-1-Normalisierung fuer den gespeicherten Body", () => {
    const payload = buildFrontDoorPayload({
      title: "",
      bodyHtml: '<h1>Titel</h1><p><span style="font-weight:700">fett</span></p>',
    });
    expect(payload.title).toBe("Titel");
    expect(payload.statement).toContain("Titel");
    expect(String(payload.bodyHtml)).toContain("<h2>Titel</h2>");
    expect(String(payload.bodyHtml)).toContain("<strong>fett</strong>");
  });

  it("uebernimmt Pedi-Titel und Pedi-Inhalt in den Speicher-Payload", () => {
    const payload = buildFrontDoorPayload({
      title: "wasser",
      bodyHtml: "<p>tesx fall</p>",
    });

    expect(payload.title).toBe("wasser");
    expect(payload.statement).toBe("tesx fall");
    expect(String(payload.bodyHtml)).toContain("tesx fall");
    expect(payload.origin).toBe("frontdoor");
  });

  it("setzt Vordertuer-Drafts mit Formatierung wieder als Body ein", () => {
    expect(frontDoorBodyFromDraft({ bodyHtml: "<p><strong>fett</strong></p>" })).toBe(
      "<p><strong>fett</strong></p>",
    );
    expect(
      frontDoorBodyFromDraft({
        bodyHtml: '<p><img src="/api/objects/img-1/raw" data-kw-scale="50"></p>',
      }),
    ).toBe('<p><img src="/api/objects/img-1/raw" data-kw-scale="50"></p>');
    expect(frontDoorBodyFromDraft({ statement: "nur text" })).toBe("<p>nur text</p>");
    expect(frontDoorBodyFromDraft({ statement: "<script>alert(1)</script>" })).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("speichert Vordertuer-Bilder mit sicherer Skalierung im Draft-Payload", () => {
    const payload = buildFrontDoorPayload({
      title: "Bildgroesse",
      bodyHtml:
        '<p><img src="/api/objects/img-1/raw" data-kw-scale="75" style="width:1px" onload="x"></p>',
    });

    expect(String(payload.bodyHtml)).toContain('data-kw-scale="75"');
    expect(String(payload.bodyHtml)).not.toMatch(/style=|onload/);
  });

  it("nutzt den bestehenden Draft-Create-Pfad fuer die Vordertuer-Persistenz", async () => {
    const captured: DraftPayload[] = [];
    const draft = await createFrontDoorDraft(
      { title: "wasser", bodyHtml: "<p>tesx fall</p>" },
      async (payload) => {
        captured.push(payload);
        return {
          id: "draft-frontdoor",
          payload,
          originalAuthor: "pedi",
          lastEditor: "pedi",
          createdAt: "2026-07-07T00:00:00.000Z",
          updatedAt: "2026-07-07T00:00:00.000Z",
        } satisfies Draft;
      },
      100,
    );

    expect(draft.id).toBe("draft-frontdoor");
    expect(captured[0]?.title).toBe("wasser");
    expect(captured[0]?.statement).toBe("tesx fall");
    expect(String(captured[0]?.bodyHtml)).toContain("tesx fall");
    expect(captured[0]?.origin).toBe("frontdoor");
  });

  it("reicht neue Vordertuer-Inhalte ueber Draft-Create und Promote zur Pruefung ein", async () => {
    const calls: string[] = [];
    const payloads: DraftPayload[] = [];
    const ko = await submitFrontDoorDraft(
      { title: "wasser", bodyHtml: "<p>tesx fall</p>" },
      {
        createDraft: async (payload) => {
          calls.push("create");
          payloads.push(payload);
          return { id: "draft-new" };
        },
        updateDraft: async () => {
          throw new Error("unexpected update");
        },
        promoteDraft: async (id) => {
          calls.push(`promote:${id}`);
          return { id: "ko-1", title: "wasser" };
        },
      },
      100,
    );

    expect(ko.id).toBe("ko-1");
    expect(calls).toEqual(["create", "promote:draft-new"]);
    expect(payloads[0]?.title).toBe("wasser");
    expect(payloads[0]?.statement).toBe("tesx fall");
    expect(payloads[0]?.origin).toBe("frontdoor");
  });

  it("aktualisiert fortgesetzte Vordertuer-Drafts vor dem Promote", async () => {
    const calls: string[] = [];
    await submitFrontDoorDraft(
      { title: "aktualisiert", bodyHtml: "<p>inhalt</p>", activeDraftId: "draft-42" },
      {
        createDraft: async () => {
          throw new Error("unexpected create");
        },
        updateDraft: async (id, payload) => {
          calls.push(`update:${id}:${payload.title}`);
          return { id };
        },
        promoteDraft: async (id) => {
          calls.push(`promote:${id}`);
          return { id: "ko-42", title: "aktualisiert" };
        },
      },
      100,
    );

    expect(calls).toEqual(["update:draft-42:aktualisiert", "promote:draft-42"]);
  });

  it("beendet einen haengenden Save mit klarer Fehlermeldung", async () => {
    await expect(withFrontDoorSaveTimeout(new Promise(() => undefined), 1)).rejects.toThrow(
      FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
    );
  });

  it("verwendet den bestehenden Draft-Create-Pfad ohne KnowledgeInputStudio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("RichTextEditor");
    expect(pageSource).toContain("fd.saveDraft");
    expect(pageSource).toContain("endpoints.drafts.create");
    expect(pageSource).toContain("endpoints.drafts.update");
    expect(pageSource).toContain("get(resumeDraftId)");
    expect(pageSource).toContain("frontDoorBodyFromDraft");
    // SCRUM: CAPTURE_FRONT_DOOR_ROUTE-Selbstbezug bei Refactor entfernt (Route lebt in
    // routes.tsx/Capture.tsx). Die Seite navigiert bewusst ueber "/erfassen". Assertion veraltet.
    expect(pageSource).toContain("createFrontDoorDraft");
    expect(pageSource).toContain("onMutate");
    expect(pageSource).not.toContain("KnowledgeInputStudio");
  });

  it("bietet die kompakte KI-Hilfsauswahl mit den fuenf Standardaktionen an", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    const i18nSource = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");

    expect(ASSIST_ACTIONS).toEqual(["clarify", "structure", "expand", "spelling", "format"]);
    expect(assistActionLabelKey("clarify")).toBe("capture.ai.action.clarify");
    expect(assistActionInstructionKey("format")).toBe("capture.ai.instr.format");
    expect(pageSource).toContain("ASSIST_ACTIONS.map");
    expect(pageSource).toContain("assistActionInstructionKey");
    expect(pageSource).toContain("assistActionLabelKey");
    expect(pageSource).toContain("bodyTextForAssist");
    expect(pageSource).toContain("applyBodyAssist");
    expect(pageSource).toContain("applySpellingAssistPreservingHtml");
    expect(pageSource).toContain("endpoints.reasoner.assist");
    expect(pageSource).toContain("fd.aiHelpApply");
    expect(pageSource).toContain("fd.aiHelpProposal");
    expect(pageSource).toContain("fd.saveDraft");
    expect(pageSource).not.toContain("Als Wissensobjekt sichern");
    expect(i18nSource).toContain('"capture.ai.action.clarify": "Klarer"');
    expect(i18nSource).toContain('"capture.ai.action.structure": "Strukturieren"');
    expect(i18nSource).toContain('"capture.ai.action.expand": "Erweitern"');
    expect(i18nSource).toContain('"capture.ai.action.spelling": "Rechtschreibung"');
    expect(i18nSource).toContain('"capture.ai.action.format": "Formatieren"');
  });

  it("wendet Rechtschreibung nicht ueber den destruktiven Plaintext-Replace-Pfad an", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('assistProposal.action === "spelling"');
    expect(pageSource).toContain(
      "applySpellingAssistPreservingHtml(bodyHtml, assistProposal.text)",
    );
    expect(pageSource).toContain("fd.errSpelling");
    expect(pageSource).toContain('applyBodyAssist("replace", bodyHtml, assistProposal.text)');
    expect(pageSource).toContain("fd.aiHelp");
    expect(pageSource).toContain("fd.aiHelpModes");
    expect(pageSource).toContain("fd.accept");
    expect(pageSource).toContain("fd.discardProposal");
    expect(pageSource).toContain("fd.aiProposalCheck");
    expect(pageSource).toContain("fd.assistAccepted");
    expect(pageSource).not.toContain("endpoints.validation");
  });

  it("bereitet den Frontdoor-Inhalt fuer den bestehenden Reasoner-Structure-Pfad vor", () => {
    expect(
      buildFrontDoorStructureInput({
        title: "Wasser",
        bodyHtml: "<h2>Pruefung</h2><p><strong>Ventil</strong> kontrollieren.</p>",
      }),
    ).toBe("Wasser\n\nPruefung Ventil kontrollieren.");
    expect(buildFrontDoorStructureInput({ title: "", bodyHtml: "<p> </p>" })).toBe("");
  });

  it("rendert den KI-Vorschlag als sichere strukturierte HTML-Uebernahme", () => {
    const html = frontDoorStructuredBodyHtml({
      title: "Wasser <script>",
      statement: "Pumpe pruefen & freigeben",
      conditions: ["Druck > 4 bar"],
      measures: ["Ventil schliessen"],
      tags: ["wasser", "betrieb"],
      confidence: 0.7,
      demo: false,
    });

    expect(html).toContain("<h2>Wasser &lt;script&gt;</h2>");
    expect(html).toContain("<strong>Kernaussage:</strong>");
    expect(html).toContain("<h3>Bedingungen</h3>");
    expect(html).toContain("<li>Druck &gt; 4 bar</li>");
    expect(html).toContain("<h3>Massnahmen</h3>");
    expect(html).toContain("wasser, betrieb");
    expect(html).not.toContain("<script>");
  });

  it("bietet optionale KI-Strukturierung ohne Auto-Save oder Auto-Validate an", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("fd.structureSuggest");
    expect(pageSource).toContain("endpoints.reasoner.structure");
    expect(pageSource).toContain("buildFrontDoorStructureInput");
    expect(pageSource).toContain("fd.aiProposal");
    expect(pageSource).toContain("fd.aiProposalCheck");
    expect(pageSource).toContain("fd.accept");
    expect(pageSource).toContain("fd.discardProposal");
    // SCRUM-487 (i18n): die Ansicht zeigt die Meldung über den stabilen i18n-Key (t(...));
    // die ehrliche DE-Formulierung bleibt in i18n.ts gepinnt.
    expect(pageSource).toContain("FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY");
    expect(FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY).toBe("cfd.structuringUnavailable");
    const i18nSource = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    expect(i18nSource).toContain(
      '"cfd.structuringUnavailable": "Ich kann das gerade nicht verlässlich ordnen."',
    );
    expect(pageSource).toContain("fd.originalUnchanged");
    expect(pageSource).toContain("fd.optionalAiHint");
    // WP-D6b: die Übernahme des Struktur-Vorschlags läuft jetzt über die pure applyStructureProposal
    // (nicht mehr direkt über frontDoorStructuredBodyHtml in der Ansicht) — sie schützt reiche Bodies.
    expect(pageSource).toContain("applyStructureProposal({");
    expect(pageSource).not.toContain("frontDoorStructuredBodyHtml");
    expect(pageSource).not.toContain("endpoints.ko.create");
    expect(pageSource).not.toContain("endpoints.validation");
    expect(pageSource).not.toContain("KnowledgeInputStudio");
  });

  it("macht KI-Vorschlaege sichtbar und bietet Verwerfen ohne Textverlust an", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("proposalRef");
    expect(pageSource).toContain("scrollIntoView");
    expect(pageSource).toContain("discardStructureProposal");
    expect(pageSource).toContain("discardAssistProposal");
    expect(pageSource).toContain("fd.originalUnchanged");
  });

  it("kehrt nach Draft-Save nach /erfassen zurueck und verhindert Wiederhol-Save", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('navigate("/erfassen"');
    expect(pageSource).toContain("frontDoorDraftSaved");
    expect(pageSource).toContain("saveRequestedRef");
    expect(pageSource).toContain("requestSave");
    expect(pageSource).not.toContain("Entwurf gespeichert: <strong>{savedDraft.title}</strong>");
    expect(captureSource).toContain("frontDoorDraftSavedFromState");
    expect(captureSource).toContain("Entwurf gespeichert");
    expect(captureSource).toContain("Entwurf fortsetzen");
    expect(captureSource).toContain("Neuer leerer Eintrag");
    expect(captureSource).toContain("useLocation");
  });

  it("bietet einen duplikatsicheren Submit-Pfad ohne Auto-Save oder Auto-Validate", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("submitFrontDoorDraft");
    expect(pageSource).toContain("endpoints.drafts.promote");
    expect(pageSource).toContain("submitRequestedRef");
    expect(pageSource).toContain("requestSubmit");
    expect(pageSource).toContain("!submittedKo");
    expect(pageSource).toContain("fd.submitReview");
    expect(pageSource).toContain("fd.newEntry");
    expect(pageSource).toContain("fd.submitted");
    expect(pageSource).toContain("fd.openValidation");
    expect(pageSource).toContain('setTitle("");');
    expect(pageSource).toContain('setBodyHtml("");');
    expect(pageSource).toContain("fd.submittedBody");
    expect(pageSource).toContain("fd.submittedBody");
    expect(pageSource).not.toContain("Auto-Validate");
  });

  it("trennt Eingabe-Verwerfen von KI-Vorschlag-Verwerfen", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("discardInputAndReturn");
    expect(pageSource).toContain("hasDiscardRisk");
    expect(pageSource).toContain("window.confirm");
    expect(pageSource).toContain("fd.confirmDiscard");
    expect(pageSource).toContain("fd.discardInput");
    expect(pageSource).toContain("fd.back");
    expect(pageSource.match(/"fd\.discardProposal"/g) ?? []).toHaveLength(2);
    expect(pageSource).toContain("discardStructureProposal");
    expect(pageSource).toContain("discardAssistProposal");
  });

  it("Primaer-Pfad (Form-Submit/Enter) reicht ein statt nur Entwurf zu speichern (SCRUM-474 P0)", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    // Der Form-Submit (Enter + prominenter Button) geht auf den Einreichen-Pfad, nicht auf Draft-Save.
    const onSubmitStart = page.indexOf("onSubmit=");
    const onSubmitBlock = page.slice(onSubmitStart, onSubmitStart + 600);
    expect(onSubmitBlock).toContain("requestSubmit()");
    expect(onSubmitBlock).not.toContain("requestSave()");
    // Der prominente Haupt-CTA ist der Einreichen-Button (type=submit, an canSubmit gebunden).
    expect(page).toMatch(/type="submit"[\s\S]{0,80}disabled=\{!canSubmit\}/);
    // „Als Entwurf speichern" ist jetzt ein sekundaerer, expliziter Button-Klick (nicht der Form-Submit).
    expect(page).toContain("onClick={requestSave}");
  });

  it("bietet Placeholder + HelpTips + klarere Buttontexte auf der FrontDoor (SCRUM-474 P1)", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    const editor = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    // HelpTips aus der zentralen Erfassen-Hilfekarte (chelp/captureHelp) an den Kern-Elementen.
    expect(page).toContain("import { HelpTip }");
    expect(page).toContain("captureHelp");
    for (const id of [
      "captureTitle",
      "tellRaw",
      "structureNow",
      "submitReview",
      "saveDraftHelp",
      "savedNext",
    ]) {
      expect(page).toContain(`chelp("${id}")`);
    }
    // Klarerer Buttontext.
    expect(page).toContain("fd.structureSuggest");
    expect(page).not.toContain("Soll ich das ordnen?");
    // Aktive Einladung im leeren Editor.
    expect(page).toContain("placeholder=");
    expect(page).toContain("fd.editorPlaceholder");
    // Der Editor unterstützt einen Placeholder, der nur bei leerem Inhalt erscheint.
    expect(editor).toContain("placeholder");
    expect(editor).toContain("!bodyReadMode(value).hasBody");
  });

  it("/erfassen stellt die Vordertuer als Default heraus und behaelt alte Wege", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(captureSource).toContain("KW-PROD-15");
    expect(captureSource).toContain("Neues Wissensobjekt erfassen");
    expect(captureSource).toContain("Dokument-Canvas öffnen");
    expect(captureSource).toContain("Weitere Wege");
    // SCRUM-458: die redundante zweite Aufklapp-Ebene („weitere Optionen") ist entfernt — sobald
    // „Weitere Wege" offen ist, rendert die Leiste ALLE Erzähl-Modi direkt (NARRATE_MODES.map) plus den
    // Expertenformular-Umschalter. Die Erzähl-Modi bleiben vollständig erhalten.
    expect(captureSource).toContain("NARRATE_MODES.map");
    expect(captureSource).toContain("EXPERT_MODE");
    expect(captureSource).toContain("CAPTURE_FRONT_DOOR_ROUTE");
  });

  it("Default-Vordertuer nutzt genau einen RichTextEditor und kein Studio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    const editorSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );

    expect(pageSource.match(/<RichTextEditor/g) ?? []).toHaveLength(1);
    expect(pageSource).not.toContain("KnowledgeInputStudio");
    expect(editorSource).toContain("IMAGE_SCALE_OPTIONS");
    expect(editorSource).toContain("applyImageScale");
    expect(editorSource).toContain("data-kw-scale");
  });

  // WP-SHIP9-S2 (bens Folgeschnitt B4): der Struktur-Vorschlag erklärt einen vertraulichkeitsbedingten
  // Cloud-Ausschluss mit EIGENEM, wahrem Grund — vorher landete er (unbekannter Grund) im no-model-Text.
  it("zeigt bei fallbackReason confidential den spezifischen Grund (nicht no-model)", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    expect(pageSource).toContain('structureProposal.fallbackReason === "confidential"');
    expect(pageSource).toContain('t("fd.fallbackConfidential")');
    // Die alten Zweige bleiben unverändert erhalten.
    expect(pageSource).toContain('t("fd.fallbackModelTimeout")');
    expect(pageSource).toContain('t("fd.fallbackModelError")');
    expect(pageSource).toContain('t("fd.fallbackNoModel")');

    // Der neue Grund-Text existiert in DE/EN/NL (3×) und benennt die Vertraulichkeit im DE.
    const i18nSource = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    expect(i18nSource.split('"fd.fallbackConfidential":').length - 1).toBe(3);
    const deLine = i18nSource
      .split("\n")
      .find((l) => l.includes("Der Text ist als vertraulich eingestuft"));
    expect(deLine, "DE fd.fallbackConfidential").toBeTruthy();
  });
});
