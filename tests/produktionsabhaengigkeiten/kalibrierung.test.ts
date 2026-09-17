// ================================================================================================
// JOB 4272 · DIE KALIBRIERUNG DER PRÜFFUNKTIONEN — UND WAS SIE AUSDRÜCKLICH NICHT BELEGT.
// ================================================================================================
//
// RUNDE 4, ZUERST DIE EINSCHRÄNKUNG, weil BEN sie in Runde 3 zu Recht verlangt hat: Diese Datei
// belegt, dass die PRÜFFUNKTIONEN aus `waechter.ts` unterscheiden können — nicht mehr. Sie belegt
// NICHT, dass ein Regressionstest rot wird, wenn sich das Produkt ändert; drei ihrer Fälle stellen
// den Produktweg nach (`/api/pruef` unten statt `POST /api/ask`, eine eigene `sharp`-Kette statt
// `bildverkleinerung.ts`, ein unmittelbarer Zeichenvergleich statt `smtp.ts`). BENs Wortlaut:
// „Das belegt Hilfsfunktionen, aber keinen roten Lauf der vorgeschriebenen Regressionstests gegen
// mutierten Produktcode."
//
// DER NACHWEIS DER LIEFERUNG 7 STEHT DESHALB IN `produktmutationen.test.ts`: dort wird je Fall
// eine vollständige PRODUKTKOPIE angelegt, genau eine Stelle im Produktcode verstellt und der
// UNVERÄNDERTE Regressionstest darin gefahren — mit Exit-Code und wörtlicher Fehlermeldung. Diese
// Datei bleibt daneben stehen, weil sie eine andere, engere Frage beantwortet: kann die einzelne
// Prüffunktion überhaupt unterscheiden, und an welcher Form fällt sie auf.
//
// WOZU DIESE DATEI DA IST. Eine Zusicherung, die nur am gesunden Fall gefahren wurde, ist unbelegt:
// sie könnte bedeutungslos sein, ohne dass es jemand merkte. Runde 2 hat das teuer gelernt — der
// Static-Wächter zählte Importe statt Registrierungen und blieb grün, während BEN genau die
// Bedingung herstellte, unter der die Einordnung nicht mehr gilt.
//
// DESHALB WIRD HIER JEDE DER SECHS ZUSAGEN AUS LIEFERUNG 6 GEZIELT VERSTELLT, und zwar gegen
// dieselbe prüfende Funktion aus `waechter.ts`, die der echte Fall benutzt — keine Kopie. Eine
// kopierte Prüfung kalibriert sich selbst und beweist nichts.
//
// ISOLATION, WÖRTLICH AUS DEM AUFTRAG („Nur in der isolierten Kopie verstellen, nie im
// Arbeitsbaum"): Keine Verstellung dieser Datei berührt eine Produktdatei.
//   · Quelltext-Verstellungen laufen auf einer KOPIE des Textes im Speicher bzw. in einem
//     Wegwerfordner unter `os.tmpdir()`;
//   · Verhaltens-Verstellungen laufen auf EIGENS AUFGEBAUTEN Instanzen (Fastify, sharp,
//     Transport-Doppel), nie an der laufenden Produktkonfiguration;
//   · die Lockdatei wird gelesen und im Speicher verändert, nie geschrieben.
// `git status --porcelain` ist nach diesem Lauf unverändert; das ist Teil der Abnahme.
//
// LESART DER FÄLLE: Jeder Fall zeigt ZWEI Zeilen — was die Funktion am echten Stand sagt (nichts)
// und was sie an der Verstellung sagt (der wörtliche Befund). Die zweite Zeile ist die Ausgabe, die
// der Auftrag verlangt; sie steht so auch im `README.md` und in der `RUECKGABE.md`.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type HookHandlerDoneFunction,
} from "fastify";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BILD_MAX_KANTE } from "../../services/app/src/import/bildverkleinerung";
import { registerWebStatic } from "../../services/app/src/web-static";
import { grossesPng } from "../m5c-b-bildbudget/bilder";
import {
  type Lockdatei,
  abweisungsBefund,
  adressBefund,
  assetBefund,
  beobachteAuslieferung,
  berichtstabelle,
  http2Befund,
  http2Treffer,
  kantenBefund,
  quellen,
  schutzBefunde,
  statischeRegistrierungen,
  versionsAbweichungen,
} from "./waechter";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, "..", "..");
const ERLAUBTE_HOOKS = ["onSend"] as const;

/** Ein Wegwerfordner ausserhalb des Arbeitsbaums, der am Ende jedes Falls wieder verschwindet. */
async function inWegwerfordner<T>(zweck: string, tun: (ordner: string) => Promise<T> | T) {
  const ordner = mkdtempSync(join(tmpdir(), `kw-4272-kal-${zweck}-`));
  try {
    return await tun(ordner);
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

// ================================================================================================
// (e) HTTP/2 EINSCHALTEN → der find-my-way-Stolperdraht wird rot
// ================================================================================================
describe("JOB 4272 · Kalibrierung (e) — http2 einschalten", () => {
  it("am laufenden Aufbau: eine Instanz mit http2:true wird gemeldet", async () => {
    // Eine EIGENE Instanz, nicht die des Produkts — genau das, was jemand täte, der HTTP/2
    // einschaltet. `buildApp` bleibt unberührt.
    const verstellt = Fastify({ http2: true });
    await verstellt.ready();
    try {
      const befund = http2Befund(verstellt.server);
      expect(befund).not.toBeNull();
      expect(befund).toContain("HTTP/2 ist eingeschaltet");
      expect(befund).toContain("GHSA-c96f-x56v-gq3h");
    } finally {
      await verstellt.close();
    }
  });

  it("an der Quelle: eine Datei mit `http2: true` im Text wird gemeldet", () => {
    // Die Kopie des ECHTEN Textes, im Speicher um eine Zeile ergänzt. Die Datei auf der Platte
    // bleibt, wie sie ist.
    const echt = readFileSync(join(WURZEL, "services/app/src/build-app.ts"), "utf8");
    expect(http2Treffer([{ pfad: "app/src/build-app.ts", text: echt }])).toEqual([]);
    expect(
      http2Treffer([{ pfad: "app/src/build-app.ts", text: `${echt}\n// http2: true\n` }]),
    ).toEqual(["app/src/build-app.ts"]);
  });
});

// ================================================================================================
// (f) EINE VERSION IN DER LOCKDATEI VERSTELLEN → der tragende Wächter wird rot
// ================================================================================================
describe("JOB 4272 · Kalibrierung (f) — eine Version in der Lockdatei verstellen", () => {
  it("eine einzige veränderte Zahl wird benannt, mit beiden Seiten", () => {
    const lock = JSON.parse(readFileSync(join(WURZEL, "package-lock.json"), "utf8")) as Lockdatei;
    const tabelle = berichtstabelle(readFileSync(join(HIER, "README.md"), "utf8"));
    expect(tabelle.length, "Die Expositionstabelle wurde nicht gefunden").toBeGreaterThan(0);
    expect(versionsAbweichungen(lock, tabelle)).toEqual([]);

    // Die isolierte Kopie: dieselbe Lockdatei, EINE Zahl anders. Nichts wird geschrieben.
    const kopie = JSON.parse(JSON.stringify(lock)) as Lockdatei;
    const eintrag = kopie.packages["node_modules/fastify"] as { version?: string };
    const echteVersion = eintrag.version;
    eintrag.version = "0.0.0-verstellt";

    const befunde = versionsAbweichungen(kopie, tabelle);
    expect(befunde).toHaveLength(1);
    expect(befunde[0]).toBe(
      `fastify: der Bericht sagt ${String(echteVersion)}, die Lockdatei sagt 0.0.0-verstellt (node_modules/fastify)`,
    );
  });

  it("ein aus der Lockdatei verschwundener Ort wird ebenfalls benannt", () => {
    const lock = JSON.parse(readFileSync(join(WURZEL, "package-lock.json"), "utf8")) as Lockdatei;
    const tabelle = berichtstabelle(readFileSync(join(HIER, "README.md"), "utf8"));
    const kopie = JSON.parse(JSON.stringify(lock)) as Lockdatei;
    delete (kopie.packages as Record<string, unknown>)["node_modules/sharp"];
    expect(versionsAbweichungen(kopie, tabelle)).toEqual([
      "Der Bericht nennt einen Ort, den die Lockdatei nicht kennt: node_modules/sharp",
    ]);
  });
});

// ================================================================================================
// BENs MUTATION — EINE ZWEITE, GESCHÜTZTE REGISTRIERUNG IN DERSELBEN DATEI
// ================================================================================================
//
// Das ist der Fall, an dem Runde 2 gescheitert ist, in beiden Riegeln nachgestellt.
describe("JOB 4272 · Kalibrierung (Lieferung 4) — zweite geschützte Static-Registrierung", () => {
  it("am Quelltext: zwei Aufrufstellen in EINER Datei sind zwei Funde — der Import verdeckt nichts", async () => {
    const echt = readFileSync(join(WURZEL, "services/app/src/web-static.ts"), "utf8");

    // Der echte Stand: genau eine Aufrufstelle.
    expect(statischeRegistrierungen([{ pfad: "app/src/web-static.ts", text: echt }])).toHaveLength(
      1,
    );

    // Die isolierte Kopie IN EINEM WEGWERFORDNER — wörtlich BENs Mutation: eine zweite
    // Registrierung mit Präfix und Rechteprüfung, IN DERSELBEN DATEI, mit UNVERÄNDERTEM Import.
    const mutation = [
      "",
      "export async function registerGeschuetzt(app: FastifyInstance, dist: string) {",
      "  await app.register(fastifyStatic, {",
      '    root: dist, prefix: "/geschuetzt/", decorateReply: false,',
      "    preHandler: (req, reply, done) => {",
      "      if (!req.headers.authorization) { reply.code(401).send(); return; }",
      "      done();",
      "    },",
      "  });",
      "}",
      "",
    ].join("\n");

    await inWegwerfordner("static", (ordner) => {
      mkdirSync(join(ordner, "app", "src"), { recursive: true });
      writeFileSync(join(ordner, "app", "src", "web-static.ts"), echt + mutation);
      const gefunden = statischeRegistrierungen(quellen(ordner));
      expect(
        gefunden.map((r) => `${r.pfad}:${r.zeile}`),
        "Der Wächter hat die zweite Registrierung in derselben Datei nicht gesehen — genau BENs Befund aus Runde 2",
      ).toHaveLength(2);
      expect(gefunden[0]?.pfad).toBe("app/src/web-static.ts");
      expect(gefunden[1]?.zeile).toBeGreaterThan(gefunden[0]?.zeile ?? 0);
    });
  });

  it("am laufenden Aufbau: zweiter Baum, Präfix und Wache werden einzeln benannt", async () => {
    await inWegwerfordner("aufbau", async (ordner) => {
      writeFileSync(join(ordner, "index.html"), "<!doctype html><title>KAL</title>");

      // Der echte Stand schweigt.
      const heil = Fastify();
      try {
        const b = await beobachteAuslieferung(heil, registerWebStatic, ordner);
        expect(schutzBefunde(b, ERLAUBTE_HOOKS)).toEqual([]);
      } finally {
        await heil.close();
      }

      // Die verstellte Fassung: dieselbe Auslieferung PLUS BENs zweite, geschützte Registrierung.
      // Sie lebt nur hier, als Funktion in dieser Testdatei — `web-static.ts` bleibt unberührt.
      const verstellt = async (app: FastifyInstance, dist: string) => {
        await registerWebStatic(app, dist);
        // `preHandler` steht NICHT in `FastifyStaticOptions` — der Typprüfer sagt dasselbe wie der
        // Lauf (TS2769, Cloud-Lauf ef384d8161f4769aa8acf7b2: „'preHandler' does not exist
        // in type 'FastifyRegisterOptions<…FastifyStaticOptions>'"). Genau deshalb steht hier eine
        // ausgeschriebene Umgehung des Typs: nachgestellt wird, was jemand SCHREIBEN würde, nicht,
        // was der Typ erlaubt. Der Wächter muss auch das sehen.
        const optionenMitWache: Record<string, unknown> = {
          root: dist,
          prefix: "/geschuetzt/",
          decorateReply: false,
          preHandler: (
            request: FastifyRequest,
            reply: FastifyReply,
            done: HookHandlerDoneFunction,
          ) => {
            if (!request.headers.authorization) {
              reply.code(401).send();
              return;
            }
            done();
          },
        };
        await (app.register as unknown as (plugin: unknown, optionen: unknown) => Promise<unknown>)(
          fastifyStatic,
          optionenMitWache,
        );
      };

      const app = Fastify();
      try {
        const b = await beobachteAuslieferung(app, verstellt, ordner);
        const befunde = schutzBefunde(b, ERLAUBTE_HOOKS);
        expect(
          befunde,
          "Der Wächter hat die zweite geschützte Registrierung am laufenden Aufbau nicht gesehen",
        ).toHaveLength(3);
        expect(befunde.some((s) => s.startsWith("2 statt einer"))).toBe(true);
        expect(befunde.some((s) => s.includes('Präfix "/geschuetzt/"'))).toBe(true);
        expect(befunde).toContain("eine Registrierung bringt eine Wache mit: preHandler");

        // ------------------------------------------------------------------------------------
        // MESSPUNKT, und er widerspricht der naheliegenden Annahme: DIESE Wache wacht gar nicht.
        // ------------------------------------------------------------------------------------
        // `@fastify/static` 9.1.3 kennt die Option `preHandler` nicht — im ganzen Paket
        // (`index.js`, `lib/`) kommt weder `preHandler` noch `onRequest` vor. Die Option wird
        // stillschweigend geschluckt: die Anfrage OHNE Berechtigung bekommt 200, nicht 401
        // (gemessen, Cloud-Lauf 86e9f8c5dd7429522024919e).
        //
        // Das ist kein Nebenbefund, sondern der Grund, warum der Riegel an der REGISTRIERUNG liest
        // und nicht am Verhalten: eine Absicht, die wie eine Rechteprüfung aussieht und keine ist,
        // muss trotzdem auffallen — sie wird beim nächsten Umbau zu einer echten. Die Form, die
        // WIRKLICH schützt, steht im nächsten Fall.
        const ohne = await app.inject({ method: "GET", url: "/geschuetzt/index.html" });
        expect(
          ohne.statusCode,
          "Die preHandler-Option von @fastify/static wacht plötzlich doch — dann gehört dieser Kommentar korrigiert",
        ).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  // ==============================================================================================
  // DIE ZWEITE FORM, IN DER JEMAND EINEN GESCHÜTZTEN PFAD BAUEN WÜRDE — und der Grund, warum der
  // Riegel die Wache an ZWEI Stellen sucht.
  // ==============================================================================================
  // Gemessen (Cloud-Lauf fd7b06f9283bbfa327d27290): eine Wache, die als OPTION an `@fastify/static`
  // mitkommt, taucht in der Routentabelle NICHT als `preHandler` auf — der Riegel über `onRoute`
  // allein hätte BENs Mutation wieder durchgelassen. Umgekehrt zeigt `onRoute` eine Wache, die
  // direkt an einer Route hängt. Beide Formen werden deshalb geprüft, und beide sind hier belegt.
  it("eine Wache DIREKT an einer Route wird über die Routentabelle gesehen", async () => {
    await inWegwerfordner("route", async (ordner) => {
      writeFileSync(join(ordner, "index.html"), "<!doctype html><title>KAL</title>");
      const verstellt = async (app: FastifyInstance, dist: string) => {
        await registerWebStatic(app, dist);
        app.get(
          "/geschuetzte-akte",
          {
            preHandler: (req, reply, done) => {
              if (!req.headers.authorization) {
                reply.code(401).send();
                return;
              }
              done();
            },
          },
          async () => ({ geheim: true }),
        );
      };
      const app = Fastify();
      try {
        const b = await beobachteAuslieferung(app, verstellt, ordner);
        expect(schutzBefunde(b, ERLAUBTE_HOOKS)).toContain(
          "die Route /geschuetzte-akte trägt eine Wache: preHandler",
        );
      } finally {
        await app.close();
      }
    });
  });

  it("ein GEKAPSELTER geschützter Bereich fällt über die Zahl der register-Aufrufe auf", async () => {
    await inWegwerfordner("kapsel", async (ordner) => {
      writeFileSync(join(ordner, "index.html"), "<!doctype html><title>KAL</title>");
      // Die dritte Form: der geschützte Baum liegt in einem eigenen Bereich mit `onRequest`-Wache.
      // Die innere Registrierung geschieht an `scope`, nicht an `app` — der Riegel greift trotzdem,
      // weil auch die Kapsel selbst ein `register`-Aufruf an dieser Instanz ist.
      const verstellt = async (app: FastifyInstance, dist: string) => {
        await registerWebStatic(app, dist);
        await app.register(async (scope) => {
          scope.addHook("onRequest", async (req, reply) => {
            if (!req.headers.authorization) {
              await reply.code(401).send();
            }
          });
          await scope.register(fastifyStatic, {
            root: dist,
            prefix: "/kapsel/",
            decorateReply: false,
          });
        });
      };
      const app = Fastify();
      try {
        const b = await beobachteAuslieferung(app, verstellt, ordner);
        const befunde = schutzBefunde(b, ERLAUBTE_HOOKS);
        // Drei `register`-Aufrufe: die echte Auslieferung, die Kapsel, und die Registrierung IN
        // der Kapsel — die Ersetzung erbt in die Kapsel hinein und sieht auch sie.
        expect(befunde.some((s) => /^\d+ statt einer/.test(s))).toBe(true);
        // Die Wache der Kapsel fällt zusätzlich als app-fremder Hook auf.
        expect(befunde).toContain(
          "ein app-weiter Hook ausserhalb der Auslieferungszusage: onRequest",
        );
        // Und die Kapsel ist wirklich geschützt: ohne Kopf 401, mit Kopf 200.
        expect((await app.inject({ method: "GET", url: "/kapsel/index.html" })).statusCode).toBe(
          401,
        );
        expect(
          (
            await app.inject({
              method: "GET",
              url: "/kapsel/index.html",
              headers: { authorization: "Bearer x" },
            })
          ).statusCode,
        ).toBe(200);
      } finally {
        await app.close();
      }
    });
  });
});

// ================================================================================================
// (c) SPA-FALLBACK AUCH FÜR ASSETS LIEFERN → die laute 404 wird rot
// ================================================================================================
describe("JOB 4272 · Kalibrierung (c) — SPA-Fallback auch für Assets", () => {
  it("ein fehlendes Bündel, das still als SPA-HTML zurückkommt, wird gemeldet", async () => {
    await inWegwerfordner("spa", async (ordner) => {
      writeFileSync(join(ordner, "index.html"), "<!doctype html><title>KW-SPA-MARKER</title>");

      // Der echte Stand: 404, kein HTML.
      const heil = Fastify();
      try {
        await registerWebStatic(heil, ordner);
        await heil.ready();
        const res = await heil.inject({ method: "GET", url: "/assets/fehlt.js" });
        expect(
          assetBefund(
            { statusCode: res.statusCode, headers: res.headers, body: res.body },
            "KW-SPA-MARKER",
          ),
        ).toBeNull();
      } finally {
        await heil.close();
      }

      // Die Verstellung: derselbe Aufbau OHNE die Asset-Ausnahme im notFoundHandler — also genau
      // das Verhalten, das der Stale-Static-Fix in `web-static.ts:157` beseitigt hat.
      const app = Fastify();
      try {
        await app.register(fastifyStatic, { root: ordner });
        app.setNotFoundHandler((_request, reply) => {
          reply.type("text/html");
          return reply.sendFile("index.html");
        });
        await app.ready();
        const res = await app.inject({ method: "GET", url: "/assets/fehlt.js" });
        const befund = assetBefund(
          { statusCode: res.statusCode, headers: res.headers, body: res.body },
          "KW-SPA-MARKER",
        );
        expect(befund).toBe(
          `Ein fehlendes Bündel kam still als SPA-HTML zurück (Status ${res.statusCode})`,
        );
      } finally {
        await app.close();
      }
    });
  });
});

// ================================================================================================
// (b) SCHEMAPRÜFUNG AUSHÄNGEN → die Abweisung wird rot
// ================================================================================================
describe("JOB 4272 · Kalibrierung (b) — Schemaprüfung aushängen", () => {
  it("dieselbe fehlerhafte Anfrage kommt ohne Schema mit 200 durch — und wird gemeldet", async () => {
    const koerper = JSON.stringify({ question: { verschachtelt: true } });

    // MIT Schema — dieselbe Wurzelform wie `askBodySchema` (`ask-routes.ts:23`): Objektwurzel,
    // `question` als String. Die Advisory GHSA-w2qp-rph6-63g4 greift hier bewusst nicht; gemessen
    // wird die ABWEISUNG, und die ist die Zusage aus Lieferung 6b.
    const mitSchema = Fastify();
    try {
      mitSchema.post(
        "/api/pruef",
        {
          schema: {
            body: {
              type: "object",
              required: ["question"],
              properties: { question: { type: "string", maxLength: 8000 } },
            },
          },
        },
        async () => ({ ok: true }),
      );
      const res = await mitSchema.inject({
        method: "POST",
        url: "/api/pruef",
        headers: { "content-type": "application/json" },
        payload: koerper,
      });
      expect(abweisungsBefundVon(res)).toBeNull();
    } finally {
      await mitSchema.close();
    }

    // OHNE Schema — die Verstellung. Die Route ist dieselbe, nur die Prüfung ist ausgehängt.
    const ohneSchema = Fastify();
    try {
      ohneSchema.post("/api/pruef", async () => ({ ok: true }));
      const res = await ohneSchema.inject({
        method: "POST",
        url: "/api/pruef",
        headers: { "content-type": "application/json" },
        payload: koerper,
      });
      const befund = abweisungsBefundVon(res);
      expect(befund).not.toBeNull();
      expect(befund).toContain("Eine fehlerhafte Anfrage kam mit 200 durch statt mit 400");
    } finally {
      await ohneSchema.close();
    }
  });
});

// ================================================================================================
// (a) BILDGRENZE AUFHEBEN → der Bildimport-Fall wird rot
// ================================================================================================
describe("JOB 4272 · Kalibrierung (a) — Bildgrenze aufheben", () => {
  it("dieselbe Quelle, dieselbe sharp-Kette, nur mit aufgehobener Grenze — die Kante wird gemeldet", async () => {
    const quelle = grossesPng(1600, 1200);

    // Die Kette aus `bildverkleinerung.ts:483-491`, mit der ECHTEN Grenze: die Kante hält.
    const heil = await sharp(quelle)
      .rotate()
      .resize({
        width: BILD_MAX_KANTE,
        height: BILD_MAX_KANTE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 72 })
      .toBuffer();
    const kopfHeil = await sharp(heil).metadata();
    expect(kantenBefund(kopfHeil.width ?? 0, kopfHeil.height ?? 0, BILD_MAX_KANTE)).toBeNull();

    // DIESELBE Kette mit AUFGEHOBENER Grenze (4096 statt 1280) — die Ableitung behält 1600 px.
    const verstellt = await sharp(quelle)
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    const kopf = await sharp(verstellt).metadata();
    const befund = kantenBefund(kopf.width ?? 0, kopf.height ?? 0, BILD_MAX_KANTE);
    expect(befund).toBe(
      `Die Ableitung ist 1600×1200 — die Zielkante ${BILD_MAX_KANTE} greift nicht mehr`,
    );
  });
});

// ================================================================================================
// (d) ADRESSWEITERGABE VERFÄLSCHEN → die Mailzusage wird rot
// ================================================================================================
describe("JOB 4272 · Kalibrierung (d) — Adressweitergabe verfälschen", () => {
  it("eine kleingeschriebene Weitergabe ist eine ANDERE Adresse — und wird gemeldet", () => {
    // Synthetisch, `.invalid` per RFC 2606. Kein Server, keine Verbindung, kein Versand.
    const uebergeben = "Klara.Pruefung@Beispiel.Invalid";

    // Die heile Weitergabe (`smtp.ts:26`: `to: message.to`) schweigt.
    expect(adressBefund(uebergeben, uebergeben)).toBeNull();

    // Die Verstellung: `to: message.to.toLowerCase()` — ein Eingriff, der harmlos AUSSIEHT und die
    // Zusage „unverändert durchgereicht" trotzdem bricht.
    const befund = adressBefund(uebergeben, uebergeben.toLowerCase());
    expect(befund).not.toBeNull();
    expect(befund).toContain("Die Empfängeradresse kam verändert bei nodemailer an");
    expect(befund).toContain("eine Einladung ginge an jemand anderen");

    // Und der stille Totalverlust (`to: undefined`) fällt ebenfalls auf.
    expect(adressBefund(uebergeben, undefined)).toContain("angekommen undefined");
  });
});

/** Die Antwortform von `app.inject` auf die Form bringen, die `abweisungsBefund` liest. */
function abweisungsBefundVon(res: { statusCode: number; body: string }): string | null {
  return abweisungsBefund(res.statusCode, res.body);
}
