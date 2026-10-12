// R-0679 / FR-VAL-07 — die Browserseite des Geräte-Push (`apps/web/src/lib/geraetePush.ts`) mit
// einer aufzeichnenden Umgebung statt eines echten Browsers. Belegt wird der Ablauf: Einrichtung
// fragen, Erlaubnis einholen, mit dem öffentlichen Schlüssel abonnieren, beim Server melden — und
// die ehrlichen Lagen, in denen das nicht geht. Ob ein echtes Gerät den Hinweis zeigt, belegt das
// nicht.
import { describe, expect, it } from "vitest";
import {
  type BrowserAbo,
  type Erlaubnis,
  type PushAboJson,
  type PushUmgebung,
  b64urlZuBytes,
  pushAusschalten,
  pushEinschalten,
  pushLage,
} from "../../apps/web/src/lib/geraetePush";

const SCHLUESSEL = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");

function umgebung(opts: {
  verfuegbar?: boolean;
  pushManager?: boolean;
  erlaubnis?: Erlaubnis | null;
  antwort?: Erlaubnis;
}) {
  const gemeldet: PushAboJson[] = [];
  const abgemeldet: string[] = [];
  const schluessel: Uint8Array[] = [];
  let abo: BrowserAbo | null = null;
  const verfuegbar = opts.verfuegbar !== false;
  const u: PushUmgebung = {
    config: async () => ({ verfuegbar, publicKey: verfuegbar ? SCHLUESSEL : null }),
    anmelden: async (j) => {
      gemeldet.push(j);
    },
    abmelden: async (e) => {
      abgemeldet.push(e);
    },
    pushManager: async () =>
      opts.pushManager === false
        ? null
        : {
            getSubscription: async () => abo,
            subscribe: async ({ applicationServerKey }) => {
              schluessel.push(applicationServerKey);
              abo = {
                endpoint: "https://fcm.googleapis.com/fcm/send/neu",
                toJSON: () => ({
                  endpoint: "https://fcm.googleapis.com/fcm/send/neu",
                  keys: { p256dh: "p", auth: "a" },
                }),
                unsubscribe: async () => {
                  abo = null;
                  return true;
                },
              };
              return abo;
            },
          },
    erlaubnis: () => (opts.erlaubnis === undefined ? "default" : opts.erlaubnis),
    erlaubnisAnfragen: async () => opts.antwort ?? "granted",
  };
  return { u, gemeldet, abgemeldet, schluessel };
}

describe("R-0679 · Geräte-Push im Browser", () => {
  it("B1 · Einschalten: Erlaubnis, Abo mit dem VAPID-Schlüssel, Meldung an den Server", async () => {
    const { u, gemeldet, schluessel } = umgebung({});
    expect(await pushLage(u)).toBe("aus");
    expect(await pushEinschalten(u)).toBe("an");
    expect(Buffer.from(schluessel[0] ?? []).toString("base64url")).toBe(SCHLUESSEL);
    expect(gemeldet).toEqual([
      { endpoint: "https://fcm.googleapis.com/fcm/send/neu", keys: { p256dh: "p", auth: "a" } },
    ]);
    expect(await pushLage(u)).toBe("an");
  });

  it("B2 · Ausschalten meldet ab und kündigt das Abo im Browser", async () => {
    const { u, abgemeldet } = umgebung({});
    await pushEinschalten(u);
    expect(await pushAusschalten(u)).toBe("aus");
    expect(abgemeldet).toEqual(["https://fcm.googleapis.com/fcm/send/neu"]);
    expect(await pushLage(u)).toBe("aus");
  });

  it("B3 · die ehrlichen Lagen: nicht eingerichtet, nicht unterstützt, verweigert", async () => {
    expect(await pushLage(umgebung({ verfuegbar: false }).u)).toBe("nicht-eingerichtet");
    expect(await pushLage(umgebung({ pushManager: false }).u)).toBe("nicht-unterstuetzt");
    expect(await pushLage(umgebung({ erlaubnis: null }).u)).toBe("nicht-unterstuetzt");
    expect(await pushLage(umgebung({ erlaubnis: "denied" }).u)).toBe("verweigert");
    const abgelehnt = umgebung({ antwort: "denied" });
    expect(await pushEinschalten(abgelehnt.u)).toBe("verweigert");
    expect(abgelehnt.gemeldet).toEqual([]);
  });

  it("B4 · base64url wird zu genau den Schlüsselbytes", () => {
    const bytes = b64urlZuBytes(SCHLUESSEL);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});
