import { describe, expect, it } from "vitest";
import {
  DATA_URL_ENVELOPE_RESERVE,
  maxRawAttachmentBytes,
  maxRawAttachmentMb,
  transferLimitMb,
} from "../../apps/web/src/lib/uploadLimits";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// AUFTRAG-mega15 Block E (bens Benennungs- und Bedienungsschuld) — DER BELEG: die ANGEZEIGTE
// Rohdateigrenze passt zum EINGESTELLTEN Wert.
//
// Der Befund: „Größe je Anhang (MB)" klingt nach Rohdatei, gemessen wird aber die Länge der
// übertragenen Daten-URL (`stored.size` = `input.data.length`, services/object-store/src/
// service.ts:77; und `att.dataUrl.length` im Alt-Pfad). 20 MB Einstellung lassen deshalb nur rund
// 15 MB Rohdatei zu.
//
// Pedis Entscheidung: das Modell NICHT umbenennen (stille Umdeutung eines gespeicherten Wertes =
// migrationsriskant), sondern die Rohdateigrenze zusätzlich anzeigen. Damit diese Anzeige ein
// Versprechen und keine zweite Behauptung ist, fährt dieser Test sie gegen die ECHTEN Routen:
// eine Datei GENAU der angezeigten Größe geht durch — und knapp darüber ist Schluss.

describe("Block E: die angezeigte Rohdateigrenze ist real, nicht behauptet", () => {
  type App = ReturnType<typeof buildApp>;

  async function setup(maxAttachmentBytes: number) {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const token = (
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "a@x.de", password: "secret123" },
      })
    ).json().token;
    const headers = { authorization: `Bearer ${token}` };
    const put = await app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers,
      payload: { maxAttachments: 8, maxAttachmentBytes },
    });
    expect(put.statusCode).toBe(200);
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Dichtungswechsel L4",
        statement: "Dichtung vor jedem Anlauf prüfen.",
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    return { app, headers, koId: ko.json().id as string };
  }

  const MIME = "application/pdf";

  // Eine ECHTE Daten-URL aus `rawBytes` Rohbytes — genau so, wie der Client sie baut.
  function dataUrlForRawBytes(rawBytes: number): string {
    return `data:${MIME};base64,${Buffer.alloc(rawBytes, 7).toString("base64")}`;
  }

  // Der reale Weg des Produkts: Datei in den Object-Store, dann die Referenz ans Objekt hängen.
  // Maßgeblich ist seit mega14 die GESPEICHERTE Größe, nicht die Angabe des Clients.
  async function uploadAndAttach(
    app: App,
    headers: Record<string, string>,
    koId: string,
    rawBytes: number,
  ): Promise<{ upload: number; attach: number | null }> {
    const up = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "Pruefbericht.pdf", mime: MIME, data: dataUrlForRawBytes(rawBytes) },
    });
    // Der Object-Upload antwortet 201 (Created); nur ein echter Fehler bricht hier ab.
    if (up.statusCode >= 300) {
      return { upload: up.statusCode, attach: null };
    }
    const att = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "attach",
        attachment: { name: "Pruefbericht.pdf", mime: MIME, objectId: up.json().id },
      },
    });
    return { upload: up.statusCode, attach: att.statusCode };
  }

  // Bewusst kleine Grenzen: derselbe Rechenweg wie bei 20 MB, aber ohne 20-MB-Strings im Test.
  const EINSTELLUNGEN = [500_000, 1_000_000, 2_000_000, 3_500_000];

  it("eine Datei GENAU in der angezeigten Größe geht durch", async () => {
    for (const limit of EINSTELLUNGEN) {
      const angezeigtMb = maxRawAttachmentMb(limit);
      // Genau die Zahl, die auf dem Bildschirm steht — zurück in Bytes.
      const rawBytes = Math.round(angezeigtMb * 1_000_000);
      const { app, headers, koId } = await setup(limit);
      const res = await uploadAndAttach(app, headers, koId, rawBytes);
      expect(
        res.attach,
        `Einstellung ${limit} zeigt ${angezeigtMb} MB an, lehnte ${rawBytes} Rohbytes aber ab (upload=${res.upload})`,
      ).toBe(200);
    }
  });

  it("knapp über der abgeleiteten Grenze ist wirklich Schluss", async () => {
    for (const limit of EINSTELLUNGEN) {
      const { app, headers, koId } = await setup(limit);
      // Die Reserve für den Kopf der Daten-URL ist großzügig; ein volles Kilobyte darüber liegt
      // sicher jenseits der echten Grenze — egal wie kurz der MIME-Typ ausfällt.
      const res = await uploadAndAttach(app, headers, koId, maxRawAttachmentBytes(limit) + 1024);
      expect(res.attach, `Einstellung ${limit} nahm eine zu große Datei an`).not.toBe(200);
    }
  });

  it("die angezeigte Zahl ist ABGERUNDET — sie verspricht nie mehr als sie hält", () => {
    for (const limit of EINSTELLUNGEN) {
      expect(maxRawAttachmentMb(limit) * 1_000_000).toBeLessThanOrEqual(
        maxRawAttachmentBytes(limit),
      );
    }
  });

  it("die Werkseinstellung 20 MB ergibt rund 14,9 MB Rohdatei", () => {
    // bens Zahl war 14,6 MB — sie folgte aus dem Faktor 1,37, der selbst falsch war (Base64 ist
    // 4 Zeichen je 3 Bytes = 1,333; die 1,37 gelten für die MIME-Variante mit Zeilenumbrüchen).
    // Der korrigierte Wert steht jetzt in der Oberfläche und ist hier festgeschrieben.
    expect(transferLimitMb(20_000_000)).toBe(20);
    expect(maxRawAttachmentMb(20_000_000)).toBe(14.9);
    expect(maxRawAttachmentBytes(20_000_000)).toBe(14_999_928);
  });

  it("kleine oder unsinnige Werte ergeben keine negative Grenze", () => {
    for (const limit of [0, 1, DATA_URL_ENVELOPE_RESERVE, Number.NaN, -5]) {
      expect(maxRawAttachmentBytes(limit), String(limit)).toBe(0);
      expect(maxRawAttachmentMb(limit), String(limit)).toBe(0);
    }
  });
});
