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
    // AUFTRAG-mega51 BLOCK A: der bewachte Eintrag dieser Route stand als eigene Tabelle IN
    // routes.tsx und war damit für die Rollenquelle unsichtbar. Er steht jetzt neben ALL_ITEMS
    // (`EXTRA_GUARDED_ITEMS`, app/navigation.ts); routes.tsx routet über `GUARDED_ITEMS`.
    const navigationSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/navigation.ts"),
      "utf8",
    );
    const routesSource = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(navigationSource).toContain("CAPTURE_FRONT_DOOR_ROUTE");
    expect(navigationSource).toContain("captureFrontDoor");
    expect(routesSource).toContain("GUARDED_ITEMS");
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
    // AUFTRAG-mega23 Block A: der Vorgang reist mit — Schlüssel und gemerkter Entwurf.
    const vorgang = { id: "create-1", draftRef: { current: null as string | null } };
    const ko = await submitFrontDoorDraft(
      { title: "wasser", bodyHtml: "<p>tesx fall</p>" },
      {
        createDraft: async (payload) => {
          calls.push("create");
          payloads.push(payload);
          return { id: "draft-new" };
        },
        promoteDraft: async (id, mitgereicht) => {
          calls.push(`promote:${id}:${mitgereicht.operationId}`);
          return { id: "ko-1", title: "wasser" };
        },
      },
      vorgang,
      100,
    );

    expect(ko.id).toBe("ko-1");
    expect(calls).toEqual(["create", "promote:draft-new:create-1"]);
    expect(payloads[0]?.title).toBe("wasser");
    expect(payloads[0]?.statement).toBe("tesx fall");
    expect(payloads[0]?.origin).toBe("frontdoor");
    // Der frisch angelegte Entwurf ist GEMERKT — daran hängt die Wiederholbarkeit.
    expect(vorgang.draftRef.current).toBe("draft-new");
  });

  it("promotet fortgesetzte Vordertuer-Drafts OHNE vorgeschalteten Update-Aufruf", async () => {
    // AUFTRAG-mega23 Block A: bis mega22 lief hier zuerst ein `PUT /api/drafts/:id`. Nach einem
    // serverseitig gelungenen Promote ist der Entwurf gelöscht — der Wiederholversuch scheiterte
    // an genau diesem PUT mit 404, bevor der Nachschlag erreicht war. Der Stand reist jetzt IM
    // Promote, also hinter dem Nachschlag.
    const calls: string[] = [];
    const mitgereicht: DraftPayload[] = [];
    await submitFrontDoorDraft(
      { title: "aktualisiert", bodyHtml: "<p>inhalt</p>", activeDraftId: "draft-42" },
      {
        createDraft: async () => {
          throw new Error("unexpected create");
        },
        promoteDraft: async (id, vorgang) => {
          calls.push(`promote:${id}`);
          mitgereicht.push(vorgang.draftPayload);
          return { id: "ko-42", title: "aktualisiert" };
        },
      },
      { id: "create-42", draftRef: { current: null } },
      100,
    );

    expect(calls).toEqual(["promote:draft-42"]);
    expect(mitgereicht[0]?.title).toBe("aktualisiert");
  });

  it("beendet einen haengenden Save mit klarer Fehlermeldung", async () => {
    await expect(withFrontDoorSaveTimeout(new Promise(() => undefined), 1)).rejects.toThrow(
      FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
    );
  });

  it("verwendet den bestehenden Draft-Create-Pfad ohne KnowledgeInputStudio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("RichTextEditor");
    expect(pageSource).toContain("erfassen.entwurfSichern");
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
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
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
    // JOB 3062 · H3: Die KI-Hilfe ist ein MENÜ geworden („KI ▾", Auftrag §5.2). Der
    // Auslöser heißt nicht mehr „KI-Hilfe anwenden" mit Auswahlliste daneben, sondern jede der
    // fünf Aktionen ist ein eigener Eintrag — ein Klick statt zwei. Die Aktionen selbst und
    // ihre Beschriftungen sind unverändert (`ASSIST_ACTIONS`, `assistActionLabelKey`, oben).
    expect(pageSource).toContain("assist.mutate(action)");
    // JOB 3062 · H3: Die Überschrift „KI-Hilfe-Vorschlag" ist die Pille „KI" plus der Satz
    // `fd.assistProposalCheck` geworden — er nennt die Aktion und fordert zum Prüfen auf.
    expect(pageSource).toContain("fd.assistProposalCheck");
    expect(pageSource).toContain("erfassen.entwurfSichern");
    expect(pageSource).not.toContain("Als Wissensobjekt sichern");
    expect(i18nSource).toContain('"capture.ai.action.clarify": "Klarer"');
    expect(i18nSource).toContain('"capture.ai.action.structure": "Strukturieren"');
    expect(i18nSource).toContain('"capture.ai.action.expand": "Erweitern"');
    expect(i18nSource).toContain('"capture.ai.action.spelling": "Rechtschreibung"');
    expect(i18nSource).toContain('"capture.ai.action.format": "Formatieren"');
  });

  it("wendet Rechtschreibung nicht ueber den destruktiven Plaintext-Replace-Pfad an", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('assistProposal.action === "spelling"');
    expect(pageSource).toContain(
      "applySpellingAssistPreservingHtml(bodyHtml, assistProposal.text)",
    );
    expect(pageSource).toContain("fd.errSpelling");
    expect(pageSource).toContain('applyBodyAssist("replace", bodyHtml, assistProposal.text)');
    // JOB 3062 · H3: siehe oben — „KI-Hilfe" und die Aufzählung „Klarer, strukturieren, …"
    // waren die Beschriftung und der Erklärsatz des alten Kastens. Die fünf Aktionen stehen
    // jetzt einzeln im Menü; ein Satz, der sie aufzählt, wäre daneben doppelt.
    expect(pageSource).toContain("assistActionLabelKey(action)");
    expect(pageSource).toContain("fd.accept");
    expect(pageSource).toContain("fd.discardProposal");
    expect(pageSource).toContain("fd.aiProposalCheck");
    // JOB 3062 · H3: Die Übernahme-Quittung steht in der EINEN Lagezeile des Blattes
    // (Zustandsmodell §9) und nutzt für beide KI-Wege denselben Schlüsselsatz.
    expect(pageSource).toContain("fd.structureAccepted");
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
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );

    // JOB 3062 · H3: „Struktur vorschlagen" ist ein Menüeintrag (`erfassen.ki.struktur`).
    expect(pageSource).toContain("erfassen.ki.struktur");
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
    // JOB 3062 · H3: „Optionaler KI-Vorschlag. Nichts wird automatisch gespeichert." stand als
    // Dauerhinweis neben dem Knopf. Die AUSSAGE ist unverändert wahr und steht dort, wo sie
    // zählt: auf der Vorschlagskarte selbst (`fd.aiProposalCheck`) — und die Übernahme
    // geschieht ausschliesslich über den Knopf `fd.accept` (oben geprüft).
    expect(pageSource).toContain("fd.aiProposalCheck");
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
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );

    // JOB 3062 · H3: DER SCROLL ZUM VORSCHLAG IST ERSATZLOS WEG, und das ist die Pointe.
    // Er war nötig, weil die Vorschlagskarte in einer langen Formularspalte weit unten
    // erschien — der Mensch hätte sie sonst nicht gesehen. Auf dem Blatt steht sie direkt
    // unter dem Text, im Sichtfeld; ein Sprung wäre eine Bewegung ohne Not. Damit fällt auch
    // die Fehlerklasse weg, wegen der WP-UX-WOW-1 U8 das `?.()` einführen musste.
    expect(pageSource).not.toContain("scrollIntoView");
    expect(pageSource).toContain("discardStructureProposal");
    expect(pageSource).toContain("discardAssistProposal");
    expect(pageSource).toContain("fd.originalUnchanged");
  });

  it("kehrt nach Draft-Save nach /erfassen zurueck und verhindert Wiederhol-Save", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    // JOB 3062 · H3: DAS BLATT SPRINGT NACH DEM SPEICHERN NICHT MEHR.
    // `/erfassen` und `/erfassen/vordertuer` zeigen dieselbe Fläche; ein Sprung von einer
    // Seite auf sich selbst würde dem Menschen seinen Text unter den Händen neu aufbauen.
    // Die ZWEITE Zusicherung dieses Falls — kein Wiederhol-Save — bleibt und steht darunter.
    expect(pageSource).not.toContain('navigate("/erfassen"');
    expect(pageSource).toContain("saveRequestedRef");
    expect(pageSource).toContain("requestSave");
    expect(pageSource).not.toContain("Entwurf gespeichert: <strong>{savedDraft.title}</strong>");
    // JOB 3062 · H3: Der Hinweis „Entwurf gespeichert" auf `/erfassen` ist gelöscht — sein
    // Erzeuger (der Sprung mit `location.state`) existiert nicht mehr.
    expect(captureSource).not.toContain("frontDoorDraftSavedFromState");
    expect(captureSource).not.toContain(">Neuer leerer Eintrag<");
  });

  it("bietet einen duplikatsicheren Submit-Pfad ohne Auto-Save oder Auto-Validate", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("submitFrontDoorDraft");
    expect(pageSource).toContain("endpoints.drafts.promote");
    expect(pageSource).toContain("submitRequestedRef");
    expect(pageSource).toContain("requestSubmit");
    // AUFTRAG-mega9 Block A: Die Doppel-Absicherung „nach dem Einreichen nicht erneut" ist unverändert,
    // sitzt aber jetzt im gemeinsamen `busy` statt als einzelnes `!submittedKo` an jedem Knopf-Prädikat.
    // Geprüft wird weiter die SACHE (Erfolg sperrt Speichern und Einreichen), nicht die alte Schreibweise.
    expect(pageSource).toMatch(/const busy =[\s\S]{0,160}submittedKo !== null/);
    expect(pageSource).toMatch(/const canSave = hasSavableContent && !busy/);
    expect(pageSource).toContain("erfassen.einreichen");
    expect(pageSource).toContain("fd.newEntry");
    // JOB 3062 · H3: Aus der Erfolgs-KARTE ist eine Erfolgs-ZEILE geworden (Auftrag §9). Ihre drei
    // WEGE sind alle da — Objekt ansehen, Validierung öffnen, neuer Eintrag —, ihre zwei
    // Erklärabsätze (`fd.submittedBody`, `capture.savedBody`) nicht mehr: was beim Einreichen
    // passiert, steht im „…"-Menü unter „Status", wo man es nachlesen kann, statt es nach jedem
    // Einreichen erneut zu lesen.
    expect(pageSource).toContain("erfassen.eingereicht");
    expect(pageSource).toContain("fd.openValidation");
    expect(pageSource).toContain('setTitle("");');
    expect(pageSource).toContain('setBodyHtml("");');
    expect(pageSource).not.toContain("fd.submittedBody");
    expect(pageSource).not.toContain("Auto-Validate");
  });

  it("trennt Eingabe-Verwerfen von KI-Vorschlag-Verwerfen", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );

    // JOB 3062 · H3: „Eingabe verwerfen" ist ein Eintrag des „…"-Menüs (Auftrag §5a) und heißt
    // dort weiter so. Die RÜCKFRAGE davor ist unverändert — nur der Rückweg auf eine zweite Fläche
    // („Zurück") entfällt, weil es keine zweite Fläche mehr gibt.
    expect(pageSource).toContain("window.confirm");
    expect(pageSource).toContain("fd.confirmDiscard");
    expect(pageSource).toContain("fd.discardInput");
    expect(pageSource.match(/"fd\.discardProposal"/g) ?? []).toHaveLength(2);
    expect(pageSource).toContain("discardStructureProposal");
    expect(pageSource).toContain("discardAssistProposal");
  });

  it("Primaer-Pfad (Form-Submit/Enter) reicht ein statt nur Entwurf zu speichern (SCRUM-474 P0)", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    // ==============================================================================================
    // JOB 3062 · H3 — DAS BLATT IST KEIN FORMULAR MEHR, UND DAS IST EINE ENTSCHEIDUNG.
    // ==============================================================================================
    // SCRUM-474 P0 verlangte, dass der PRIMÄRE Pfad einreicht statt nur zu speichern. Der Weg dahin
    // war ein `<form onSubmit>`: Enter im Titelfeld reichte ein. Auf einem Blatt nach Pages-Art ist
    // das falsch — dort ist Enter im Titel ein Zeilenwechsel, kein Absenden, und ein versehentliches
    // Einreichen ist der teuerste Fehler dieser Fläche (es entsteht ein Wissensobjekt).
    //
    // DIE ZUSICHERUNG BLEIBT, IHR TRÄGER WECHSELT: der prominente Knopf unten rechts heißt
    // „Einreichen" (nicht „Entwurf sichern"), ruft `requestSubmit` und ist bei fehlendem Inhalt
    // ERREICHBAR — ein grauer Knopf ohne Begründung war der Befund aus KW-E2E-001. Gesperrt ist er
    // nur, solange ein Vorgang läuft.
    expect(page).not.toContain("onSubmit=");
    expect(page).toContain("onClick={requestSubmit}");
    expect(page).toMatch(/data-testid="blatt-einreichen"[\s\S]{0,120}disabled=\{busy\}/);
    // „Als Entwurf speichern" ist jetzt ein sekundaerer, expliziter Button-Klick (nicht der Form-Submit).
    expect(page).toContain("onClick={requestSave}");
  });

  it("bietet Placeholder + HelpTips + klarere Buttontexte auf der FrontDoor (SCRUM-474 P1)", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    const editor = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    // ==============================================================================================
    // JOB 3062 · H3 — DIE HILFE STEHT AN EINEM ORT STATT AN NEUN.
    // ==============================================================================================
    // Die neun `HelpTip`s dieser Fläche sind gelöscht (Auftrag §5). Ihre TEXTE sind es nicht: das
    // Blatt baut das Hilferegister `components/erfassen/hilfe.ts` in sein „?"-Menü ein, und das
    // leitet die Hilfekarte `lib/captureHelp.ts` ab — ein neues Thema dort erscheint hier ohne
    // Nacharbeit. JOB 3062 R7: dazu kommen die acht Hilfen, die ihre Schlüssel unmittelbar am
    // `HelpTip` trugen (darunter `conf.field`/`conf.help` DIESER Fläche). Damit ist die Auskunft
    // vollständiger als vorher (32 Themen statt 6 an Feldern).
    //
    // JOB 3062 · NACHZUG 1 — DIE ZUSICHERUNG MISST WIEDER, WAS SIE MEINT.
    // Bis hierher stand hier `expect(page).not.toContain("import { HelpTip }")`. Das war der Beleg
    // für „keine Sprechblase am Feld", solange `HelpTip` eine Sprechblase WAR. Seit JOB 3060 (H1)
    // rendert der Baustein `null` und meldet Titel und Text nur noch bei der Seitenhilfe der Hülle
    // an (`shell/SeitenhilfeContext.tsx`). Der alte Satz verbot damit nicht mehr eine Fläche,
    // sondern die TEILNAHME an der Seitenhilfe — und ohne sie stand /erfassen im Zahnrad-Menü leer
    // da (`tests/design/h1-funktionsinventar.test.ts`, Zeile Z-helptips, rot auf main).
    //
    // Gemessen wird jetzt die Sache selbst: die Hilfe hat GENAU EINE Quelle (`BLATT_HILFE_THEMEN`)
    // und hängt an KEINEM Feld. Neun Sprechblasen an neun Feldern brauchten neun Aufrufe; es gibt
    // genau einen, und der steht in der Abbildung über dem Register. Dass im Sichtfeld nichts
    // erscheint, misst der Textmesser an der gebauten Seite
    // (`tests/design/zielbild-h3-kein-erklaertext.test.ts`), nicht mehr eine Importzeile.
    expect(page).toContain("BLATT_HILFE_THEMEN");
    expect(page).toContain("thema.titleKey");
    expect(page).toContain("thema.bodyKey");
    expect(page.match(/<HelpTip/g) ?? []).toHaveLength(1);
    expect(page).toMatch(/BLATT_HILFE_THEMEN\.map\(\(thema\) => \([\s\S]{0,80}<HelpTip/);
    expect(
      readFileSync(resolve(process.cwd(), "apps/web/src/components/erfassen/hilfe.ts"), "utf8"),
    ).toContain("conf.field");
    // Klarerer Buttontext.
    expect(page).toContain("erfassen.ki.struktur");
    expect(page).not.toContain("Soll ich das ordnen?");
    // Aktive Einladung im leeren Blatt: Platzhalter „Titel" und „Text" (Mockup Z.48-51).
    expect(page).toContain("placeholder=");
    expect(page).toContain("erfassen.platzhalter.titel");
    expect(page).toContain("erfassen.platzhalter.text");
    // Der Editor unterstützt einen Placeholder, der nur bei leerem Inhalt erscheint.
    expect(editor).toContain("placeholder");
    expect(editor).toContain("!bodyReadMode(value).hasBody");
  });

  it("/erfassen stellt die Vordertuer als Default heraus und behaelt alte Wege", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    // ==============================================================================================
    // JOB 3062 · H3 — KW-PROD-15 IST ERFÜLLT, INDEM SEIN GEGENSTAND VERSCHWUNDEN IST.
    // ==============================================================================================
    // KW-PROD-15 wollte „die Vordertür als klaren Default, die bisherigen Wege bleiben darunter
    // erhalten". Der Weg dahin war ein Kasten mit Überschrift, Absatz, Knopf und einer Fußzeile
    // „Weitere Wege: …" — Pedis „Text über Text über Text" (04.09.).
    //
    // JETZT IST DER DEFAULT DIE FLÄCHE SELBST: `/erfassen` IST das Blatt, es gibt keine zweite
    // Fläche mehr, auf die ein Kasten zeigen könnte. Und die „bisherigen Wege" sind vollständig
    // erhalten — im Menü „Datei ▾" der Werkzeugzeile, abgeleitet aus `BLATT_WEGE`.
    expect(captureSource).not.toContain("KW-PROD-15");
    expect(captureSource).not.toContain("Neues Wissensobjekt erfassen");
    expect(captureSource).not.toContain("Dokument-Editor öffnen");
    const blattSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    expect(blattSource).toContain("BLATT_WEGE");
    expect(captureSource).toContain("isExpertMode");
  });

  it("Default-Vordertuer nutzt genau einen RichTextEditor und kein Studio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
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
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
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
