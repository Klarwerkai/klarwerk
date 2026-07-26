import { describe, expect, it } from "vitest";
import {
  type AttachmentUploadApi,
  type AttachmentUploadItem,
  finalizeCaptureSubmit,
} from "../../apps/web/src/lib/captureAttachments";
import {
  type PendingSource,
  attachPendingSources,
  resolvePendingAnchor,
} from "../../apps/web/src/lib/captureSources";

// AUFTRAG-mega17 Block A-2 — DER ANKER ENTSTEHT ERST BEIM EINREICHEN, UND ER KOMMT AN.
//
// Beim Erfassen existiert das Wissensobjekt noch nicht, wenn der Dokumentinhalt übernommen wird.
// Bis mega16 hieß das: `objectId` bleibt `undefined`, der Vermerk geht adresslos UND ankerlos
// hinaus, die Route weist ihn auf der Vorgabestufe ab — und `attachPendingSources` fing das 403
// als beliebigen Label-Fehler ab. Zurück blieb ein Wissensobjekt mit übernommenem Dokumentinhalt
// ohne Quellenvermerk, und der Nutzer las „Anhang fehlgeschlagen".
//
// Jetzt reist das Dokument als Anhang mit. Phase B hängt es an das FRISCH entstandene Objekt und
// gibt dessen echte objectId über den lokalen `anchorKey` an genau die Belegstellen zurück, die
// aus diesem Dokument stammen. Diese Datei belegt beide Hälften: dass der Anker ankommt — und
// dass sein Fehlen als HERKUNFTS-, nicht als Anhangsfehler gemeldet wird.

const DOKUMENT = "Pruefbericht-2026.pdf";

function api(): AttachmentUploadApi & { attached: string[] } {
  const attached: string[] = [];
  return {
    attached,
    upload: async (input) => ({ id: `obj-${input.name}`, size: 128 }),
    attach: async (_koId, attachment) => {
      attached.push(attachment.objectId);
      return {};
    },
  };
}

describe("resolvePendingAnchor: aus dem lokalen Merker wird die echte objectId", () => {
  it("löst den anchorKey gegen die in Phase B entstandene Karte auf und schickt den Merker NICHT mit", async () => {
    const quelle: PendingSource = { label: DOKUMENT, excerpt: "Abschnitt 4.2", anchorKey: "d-1" };
    const aufgeloest = resolvePendingAnchor(quelle, new Map([["d-1", "obj-echt"]]));

    expect(aufgeloest.objectId).toBe("obj-echt");
    // Der Schlüssel ist rein lokal — er hat auf der Leitung nichts verloren.
    expect("anchorKey" in aufgeloest).toBe(false);
  });

  it("ohne passenden Eintrag entsteht KEINE erfundene objectId", () => {
    const quelle: PendingSource = { label: DOKUMENT, excerpt: "Abschnitt 4.2", anchorKey: "d-1" };
    const aufgeloest = resolvePendingAnchor(quelle, new Map());

    expect(aufgeloest.objectId).toBeUndefined();
    expect("objectId" in aufgeloest).toBe(false);
  });
});

describe("finalizeCaptureSubmit: der Anhang macht den Anker, die Quelle bekommt ihn", () => {
  it("die objectId des mitgeführten Dokuments erreicht den add-source-Aufruf — nicht mehr undefined", async () => {
    const a = api();
    const gesendet: { label: string; objectId: string | undefined }[] = [];
    const anhaenge: AttachmentUploadItem[] = [
      {
        name: DOKUMENT,
        mime: "application/pdf",
        data: "data:application/pdf;base64,QQ==",
        kind: "document",
        anchorKey: "d-1",
      },
    ];
    const warteliste: PendingSource[] = [
      { label: DOKUMENT, excerpt: "Abschnitt 4.2", anchorKey: "d-1" },
    ];

    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: anhaenge,
      api: a,
      pendingSources: (anchors) =>
        attachPendingSources(
          "ko-1",
          warteliste,
          async (_koId, source) => {
            gesendet.push({ label: source.label, objectId: source.objectId });
          },
          anchors,
        ),
    });

    expect(res.failed).toHaveLength(0);
    // Der Anhang wurde wirklich gehängt (nur DANN darf er als Anker zählen) …
    expect(a.attached).toEqual([`obj-${DOKUMENT}`]);
    // … und genau dieser Wert steht am Quellenvermerk.
    expect(gesendet).toEqual([{ label: DOKUMENT, objectId: `obj-${DOKUMENT}` }]);
  });

  it("scheitert der Anhang, entsteht KEIN Anker — und der fehlende Beleg wird als HERKUNFTS-Fehler gemeldet, nicht als Anhangsfehler", async () => {
    const a = api();
    a.attach = async () => {
      throw new Error("attach kaputt");
    };
    const warteliste: PendingSource[] = [
      { label: DOKUMENT, excerpt: "Abschnitt 4.2", anchorKey: "d-1" },
    ];

    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [
        {
          name: DOKUMENT,
          mime: "application/pdf",
          data: "data:application/pdf;base64,QQ==",
          kind: "document",
          anchorKey: "d-1",
        },
      ],
      api: a,
      pendingSources: (anchors) =>
        attachPendingSources(
          "ko-1",
          warteliste,
          async (_koId, source) => {
            // Ohne Anker verhält sich die Route wie auf der Vorgabestufe: 403.
            if (!source.objectId) {
              throw new Error("EXTERNAL_ATTACH_BLOCKED");
            }
          },
          anchors,
        ),
    });

    const gruende = res.failed.map((f) => `${f.name}:${f.reason}`).sort();
    // Zwei GETRENNTE Aussagen: die Datei ist nicht gesichert, UND die Herkunft fehlt. Bis mega16
    // stand hier zweimal „attach" — der Nutzer erfuhr nie, dass ihm ein Beleg fehlt.
    expect(gruende).toEqual([`${DOKUMENT}:attach`, `${DOKUMENT}:provenance`]);
  });

  it("eine Quelle OHNE Anker (manuell erfasst, externer Treffer) bleibt ein gewöhnlicher Teilfehler — die Unterscheidung wird nicht verwischt", async () => {
    const a = api();
    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      attachments: [],
      api: a,
      pendingSources: (anchors) =>
        attachPendingSources(
          "ko-1",
          [{ label: "Handbuch S. 12", url: "https://example.org/h" }],
          async () => {
            throw new Error("Netz weg");
          },
          anchors,
        ),
    });

    expect(res.failed).toEqual([{ name: "Handbuch S. 12", reason: "attach" }]);
  });

  it("GEGENPROBE — ohne den mitgeführten Anhang bleibt Inhalt ohne Herkunft: kein Anker, kein Vermerk", async () => {
    const a = api();
    const gesendet: { objectId: string | undefined }[] = [];
    const res = await finalizeCaptureSubmit({
      koId: "ko-1",
      // Das ist der Zustand bis mega16: der Dokumenttext ist im Beitrag, das Dokument selbst
      // wurde nie mitgeführt — es gibt also nichts, woraus ein Anker entstehen könnte.
      attachments: [],
      api: a,
      pendingSources: (anchors) =>
        attachPendingSources(
          "ko-1",
          [{ label: DOKUMENT, excerpt: "Abschnitt 4.2", anchorKey: "d-1" }],
          async (_koId, source) => {
            gesendet.push({ objectId: source.objectId });
            if (!source.objectId) {
              throw new Error("EXTERNAL_ATTACH_BLOCKED");
            }
          },
          anchors,
        ),
    });

    expect(gesendet).toEqual([{ objectId: undefined }]);
    expect(res.failed).toEqual([{ name: DOKUMENT, reason: "provenance" }]);
  });
});
