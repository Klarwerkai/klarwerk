// ================================================================================================
// OFFICE IM ARTIKEL · DIE REINEN BAUSTEINE (Auftrag produkt:20261007:office-artikel-editor).
// ================================================================================================
//
//   B1  Einrichtung aus der Umgebung: unvollständig → „nicht eingerichtet" mit Namen der Lücken;
//       der Schlüssel erscheint nie in der Auskunft.                                         (K7)
//   B2  Discovery: Aktion je Endung, Platzhalter entfernt, Herkunft des Browsers, WOPISrc.    (K1, K2)
//   B3  Verlauf aus Belegkette UND Snapshots: auch ein nach dem Anlegen angehängtes Dokument
//       hat seinen Ausgangsstand.                                                             (K3)
//   B4  Belegstellen: aktueller vs. früherer Dokumentstand.                                   (K5)
//   B5  Editor-Nachrichten: nur von der Editor-Herkunft; Laden, Fehler, Speichern, Schließen.  (K7)
//   B6  Klara bekommt aus dem Editor KEINE Auswahl angeboten.                                (K7)

import { describe, expect, it } from "vitest";
import {
  auswahlVomEditor,
  deuteNachricht,
  istVomEditor,
  leseEditorNachricht,
} from "../../apps/web/src/lib/officeEditor";
import {
  anhangVerlauf,
  belegstellenZumAnhang,
  editorAktion,
  leseDiscovery,
  leseOfficeEditorUmgebung,
} from "../../services/app/src/office-artikel";
import type {
  EvidenceRecord,
  KnowledgeObject,
  KoSource,
  KoVersionSnapshot,
} from "../../services/knowledge-object/src/types";

describe("B1 · Einrichtung", () => {
  it("nennt fehlende Angaben und gibt den Schlüssel nie aus", () => {
    const leer = leseOfficeEditorUmgebung({});
    expect(leer).toEqual({
      eingerichtet: false,
      fehlt: ["KLARWERK_OFFICE_EDITOR_URL", "KLARWERK_WOPI_HOST_URL", "KLARWERK_WOPI_SCHLUESSEL"],
    });
    const kurz = leseOfficeEditorUmgebung({
      KLARWERK_OFFICE_EDITOR_URL: "https://editor.beispiel.invalid",
      APP_BASE_URL: "https://klarwerk.beispiel.invalid",
      KLARWERK_WOPI_SCHLUESSEL: "abcd",
    });
    expect(kurz).toEqual({ eingerichtet: false, fehlt: ["KLARWERK_WOPI_SCHLUESSEL"] });
    expect(JSON.stringify(kurz)).not.toContain("abcd");
  });

  it("vollständig: Editor-Herkunft, interne Discovery, WOPI-Basis", () => {
    const e = leseOfficeEditorUmgebung({
      KLARWERK_OFFICE_EDITOR_URL: "https://editor.beispiel.invalid/pfad",
      KLARWERK_OFFICE_EDITOR_INTERN_URL: "http://code:9980",
      KLARWERK_WOPI_HOST_URL: "http://app:3000",
      APP_BASE_URL: "https://klarwerk.beispiel.invalid",
      KLARWERK_WOPI_SCHLUESSEL: "0f".repeat(32),
    });
    expect(e.eingerichtet).toBe(true);
    if (e.eingerichtet) {
      expect(e.umgebung).toMatchObject({
        editorHerkunft: "https://editor.beispiel.invalid",
        discoveryUrl: "http://code:9980/hosting/discovery",
        wopiBasis: "http://app:3000",
        seitenHerkunft: "https://klarwerk.beispiel.invalid",
      });
      expect(e.umgebung.schluessel.length).toBe(32);
    }
  });
});

describe("B2 · Discovery", () => {
  const xml = `<wopi-discovery><net-zone>
<app name="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><action name="edit" ext="" urlsrc="http://intern:9980/browser/x/cool.html?"/></app>
<app name="writer"><action name="view" ext="docx" urlsrc="http://intern:9980/browser/x/cool.html?&lt;ui=UI_LLCC&amp;&gt;lang=de"/></app>
</net-zone></wopi-discovery>`;

  it("findet die Aktion über Endung oder Medientyp und baut die Browser-Adresse", () => {
    const aktionen = leseDiscovery(xml);
    const excel = editorAktion({
      aktionen,
      aktion: "edit",
      endung: "xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      editorHerkunft: "https://editor.beispiel.invalid",
      wopiSrc: "https://klarwerk.beispiel.invalid/wopi/files/anh-1",
    });
    expect(excel).toBe(
      "https://editor.beispiel.invalid/browser/x/cool.html?WOPISrc=https%3A%2F%2Fklarwerk.beispiel.invalid%2Fwopi%2Ffiles%2Fanh-1",
    );
    const word = editorAktion({
      aktionen,
      aktion: "view",
      endung: "docx",
      mime: "x",
      editorHerkunft: "https://editor.beispiel.invalid",
      wopiSrc: "w",
    });
    expect(word).toContain("lang=de");
    expect(word).not.toContain("UI_LLCC");
    expect(
      editorAktion({
        aktionen,
        aktion: "edit",
        endung: "pptx",
        mime: "y",
        editorHerkunft: "https://editor.beispiel.invalid",
        wopiSrc: "w",
      }),
    ).toBeUndefined();
  });
});

function ko(teile: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    version: 3,
    history: [],
    attachments: [],
    sources: [],
    ...teile,
  } as unknown as KnowledgeObject;
}

function beleg(koVersion: number, objectId: string, at: string): EvidenceRecord {
  return {
    id: `b-${koVersion}-${objectId}`,
    koId: "ko-1",
    koVersion,
    kind: "attachment",
    attachmentId: "anh-1",
    objectId,
    label: "Plan.docx",
    createdBy: "anna",
    createdAt: at,
  };
}

function quelle(id: string, label: string, objectId?: string): KoSource {
  return {
    id,
    label,
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    author: "anna",
    at: "2026-10-01T08:00:00Z",
    ...(objectId === undefined ? {} : { objectId }),
  };
}

describe("B3/B4 · Verlauf und Belegstellen", () => {
  const artikel = ko({
    attachments: [
      { id: "anh-1", name: "Plan.docx", mime: "x", objectId: "obj-c", author: "anna", at: "" },
    ],
    history: [
      { version: 1, at: "", author: "anna", note: "erstellt" },
      { version: 2, at: "", author: "anna", note: "überarbeitet", anhangGeaendert: "anh-1" },
      {
        version: 3,
        at: "",
        author: "anna",
        note: "überarbeitet",
        anhangGeaendert: "anh-1",
        anhangZurueckAus: 1,
      },
    ],
    sources: [
      quelle("q-alt", "Alt", "obj-b"),
      quelle("q-neu", "Neu", "obj-c"),
      quelle("q-x", "Fremd"),
    ],
  });
  // Fassung 1 hat KEINEN Snapshot mit dem Anhang (angehängt nach dem Anlegen) — nur einen Beleg.
  const belege = [
    beleg(1, "obj-a", "2026-10-01T08:00:00Z"),
    beleg(2, "obj-b", "2026-10-02T08:00:00Z"),
  ];
  const snapshots = [
    {
      koId: "ko-1",
      version: 3,
      at: "2026-10-03T08:00:00Z",
      author: "anna",
      note: "",
      snapshot: { attachments: [{ id: "anh-1", objectId: "obj-c" }] },
    },
  ] as unknown as KoVersionSnapshot[];

  it("B3: jeder Dokumentstand einmal, ältester zuerst, nur der jüngste aktuell", () => {
    const verlauf = anhangVerlauf(artikel, snapshots, belege, "anh-1");
    expect(verlauf.map((z) => [z.version, z.objectId, z.aktuell])).toEqual([
      [1, "obj-a", false],
      [2, "obj-b", false],
      [3, "obj-c", true],
    ]);
    expect(verlauf[2]?.restoredFrom).toBe(1);
  });

  it("B4: Belegstellen nach Dokumentstand; fremde bleiben draussen", () => {
    const verlauf = anhangVerlauf(artikel, snapshots, belege, "anh-1");
    expect(belegstellenZumAnhang(artikel, verlauf, "anh-1")).toEqual([
      { quelleId: "q-alt", label: "Alt", excerpt: null, stand: "frueher", ausFassung: 2 },
      { quelleId: "q-neu", label: "Neu", excerpt: null, stand: "aktuell" },
    ]);
  });
});

describe("B5/B6 · Editor-Nachrichten und Klara", () => {
  it("B5: nur die Editor-Herkunft zählt", () => {
    expect(istVomEditor("https://editor.beispiel.invalid", "https://editor.beispiel.invalid")).toBe(
      true,
    );
    expect(istVomEditor("https://boese.invalid", "https://editor.beispiel.invalid")).toBe(false);
  });

  it("B5: Laden, Ladefehler, Speichern und Schließen werden erkannt", () => {
    const n = (m: unknown) => {
      const gelesen = leseEditorNachricht(JSON.stringify(m));
      if (!gelesen) {
        throw new Error("unlesbar");
      }
      return deuteNachricht(gelesen);
    };
    expect(n({ MessageId: "App_LoadingStatus", Values: { Status: "Frame_Ready" } })).toEqual({
      art: "rahmen-bereit",
    });
    expect(n({ MessageId: "App_LoadingStatus", Values: { Status: "Document_Loaded" } })).toEqual({
      art: "geladen",
    });
    expect(n({ MessageId: "App_LoadingStatus", Values: { Status: "Failed" } })).toEqual({
      art: "ladefehler",
    });
    expect(n({ MessageId: "Action_Save_Resp", Values: { success: true } })).toEqual({
      art: "gespeichert",
      erfolg: true,
    });
    expect(n({ MessageId: "Action_Save_Resp", Values: { success: false } })).toEqual({
      art: "gespeichert",
      erfolg: false,
    });
    expect(n({ MessageId: "UI_Close" })).toEqual({ art: "geschlossen" });
    expect(leseEditorNachricht("kein json")).toBeNull();
    expect(leseEditorNachricht({ ohne: "MessageId" })).toBeNull();
  });

  it("B6: keine Nachricht des Editors wird Klara als Auswahl angeboten", () => {
    for (const m of [
      { id: "App_LoadingStatus", werte: { Status: "Document_Loaded" } },
      { id: "Doc_ModifiedStatus", werte: { Modified: true } },
      { id: "Action_Save_Resp", werte: { success: true } },
    ]) {
      expect(auswahlVomEditor(m)).toBeNull();
    }
  });
});
