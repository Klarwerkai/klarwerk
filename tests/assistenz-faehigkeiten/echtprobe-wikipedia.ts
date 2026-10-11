// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · AC10 — DIE REALE PROBE EINES SKILLAUFRUFS.
// ================================================================================================
//
// Ein tatsächlicher zulässiger Fähigkeitsaufruf über den INTEGRIERTEN Produktweg — keine
// Testattrappe, kein Ersatztransport:
//
//   echte Anwendung (`buildApp(assembleServices(inMemoryRepos()))`), echte Anmeldung, HTTP-Wege
//   `/api/me/faehigkeiten` → Vorschau → bestätigte Ausführung → `wikipedia-suche` über den
//   vorhandenen Adapter `external-search` (Transport `echt`) → de.wikipedia.org.
//
// Die Fähigkeit ist die einzige, die in dieser Instanz ohne neue Freigabe zulässig ist: der
// Wikipedia-Weg ist durch den Admin-Regler der externen Wissensabfrage (Vorgabe „Suche auf Klick")
// freigegeben, kostenfrei und braucht keinen Zugang. Der Suchbegriff ist synthetisch und öffentlich.
// Perplexity ist NICHT Gegenstand (O09 offen).
//
// WARUM KEIN gewöhnlicher Testfall: Vitest (`tests/setup-env.ts`) und das Smoke-Tor
// (`playwright.smoke.config.ts`, mega25) schalten die externe Suche bewusst ab — „hermetisch heisst
// kein Netz". Diese Probe ändert daran nichts. Sie läuft nur, wenn sie AUSDRÜCKLICH freigegeben ist
// (`KLARWERK_FAEHIGKEIT_ECHTPROBE=freigegeben`) und die externe Suche nicht abgeschaltet ist. Fehlt
// eins davon, sendet sie nichts und meldet die konkrete Voraussetzung.
//
// Aufruf (Betrieb, auf dem freigegebenen Prüfhost):
//   KLARWERK_FAEHIGKEIT_ECHTPROBE=freigegeben KLARWERK_KANDIDAT=<commit> KLARWERK_SKIP_KEYCHAIN=1 \
//     npx tsx tests/assistenz-faehigkeiten/echtprobe-wikipedia.ts
// Ausgabe: ein JSON-Beleg auf stdout (Kandidat, Plattform, Adapter-/Providerstand, Rolle, Kennungen,
// Ergebnis, Rücklink, überprüfte Wirkung, Negativfall). Keine Zugangswerte, keine Personendaten.
import { randomUUID } from "node:crypto";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

export const FREIGABE_ENV = "KLARWERK_FAEHIGKEIT_ECHTPROBE";
export const SUCHBEGRIFF = "Kreiselpumpe";

type Antwort = { status: number; body: unknown };

export interface EchtprobeBeleg {
  readonly stand: "durchgefuehrt" | "voraussetzung_fehlt" | "fehlgeschlagen";
  readonly voraussetzungen: readonly string[];
  readonly kandidat: string;
  readonly zeitpunkt: string;
  readonly plattform: { node: string; system: string };
  readonly adapter: {
    faehigkeit: string;
    fassung: string | null;
    provider: string | null;
    transport: string | null;
  };
  readonly rolle: string;
  readonly auftragId: string | null;
  readonly ergebnis: unknown;
  readonly gespeichert: unknown;
  readonly wiederholung: { wiederholt: boolean | null; stand: string | null };
  readonly wirkung: {
    url: string | null;
    httpStatus: number | null;
    titelGefunden: boolean | null;
  };
  readonly negativfall: { stand: string | null; voraussetzungen: readonly string[] };
  readonly meldung: string;
}

export interface EchtprobeOptionen {
  readonly env?: Record<string, string | undefined>;
  /** Für die Wirkungsprüfung (Abruf der zurückgegebenen Originalquelle). */
  readonly abruf?: (url: string) => Promise<{ status: number; text: () => Promise<string> }>;
}

function leer(
  stand: EchtprobeBeleg["stand"],
  voraussetzungen: readonly string[],
  meldung: string,
  kandidat: string,
): EchtprobeBeleg {
  return {
    stand,
    voraussetzungen,
    kandidat,
    zeitpunkt: new Date().toISOString(),
    plattform: { node: process.version, system: process.platform },
    adapter: { faehigkeit: "wikipedia-suche", fassung: null, provider: null, transport: null },
    rolle: "admin",
    auftragId: null,
    ergebnis: null,
    gespeichert: null,
    wiederholung: { wiederholt: null, stand: null },
    wirkung: { url: null, httpStatus: null, titelGefunden: null },
    negativfall: { stand: null, voraussetzungen: [] },
    meldung,
  };
}

/**
 * Führt die reale Probe aus — oder meldet ohne jede Netzanfrage, welche Voraussetzung fehlt.
 */
export async function fuehreEchtprobeAus(opt: EchtprobeOptionen = {}): Promise<EchtprobeBeleg> {
  const env = opt.env ?? process.env;
  const kandidat = env.KLARWERK_KANDIDAT ?? "unbekannt";
  const fehlt: string[] = [];
  if (env[FREIGABE_ENV] !== "freigegeben") {
    fehlt.push(
      `${FREIGABE_ENV}=freigegeben fehlt: die reale Probe ist nicht ausdrücklich freigegeben.`,
    );
  }
  if (env.EXTERNAL_SEARCH === "off") {
    fehlt.push(
      "EXTERNAL_SEARCH=off: die externe Suche ist in dieser Umgebung abgeschaltet (hermetischer Lauf).",
    );
  }
  if (fehlt.length > 0) {
    return leer("voraussetzung_fehlt", fehlt, "Keine Netzanfrage gesendet.", kandidat);
  }

  const services = assembleServices(inMemoryRepos());
  const app = buildApp(services);
  try {
    await app.ready();
    const inject = async (
      methode: "GET" | "POST",
      url: string,
      token: string | null,
      payload?: Record<string, unknown>,
    ): Promise<Antwort> => {
      const r = await app.inject({
        method: methode,
        url,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        ...(payload ? { payload } : {}),
      });
      return { status: r.statusCode, body: r.body === "" ? null : r.json() };
    };
    const zugang = {
      name: "Echtprobe Admin",
      email: "echtprobe@klarwerk.test",
      password: randomUUID(),
    };
    await inject("POST", "/api/auth/register", null, zugang);
    const login = await inject("POST", "/api/auth/login", null, {
      email: zugang.email,
      password: zugang.password,
    });
    const token = (login.body as { token?: string }).token ?? null;
    if (!token) {
      return leer("fehlgeschlagen", [], "Anmeldung an der Probeinstanz gescheitert.", kandidat);
    }

    // 1. Der Produktweg nennt die Fähigkeit verfügbar — sonst die konkrete Voraussetzung.
    const uebersicht = await inject("GET", "/api/me/faehigkeiten", token);
    const wiki = (
      uebersicht.body as {
        faehigkeiten: {
          id: string;
          fassung: string;
          verfuegbar: boolean;
          voraussetzungen: { text: string }[];
        }[];
      }
    ).faehigkeiten.find((f) => f.id === "wikipedia-suche");
    const adapterStand = {
      faehigkeit: "wikipedia-suche",
      fassung: wiki?.fassung ?? null,
      provider: services.externalSearch?.providerName ?? null,
      transport:
        services.faehigkeiten?.registry.eintrag("wikipedia-suche")?.adapter?.transport ?? null,
    };
    if (!wiki?.verfuegbar) {
      return {
        ...leer(
          "voraussetzung_fehlt",
          (wiki?.voraussetzungen ?? []).map((v) => v.text),
          "Die Fähigkeit ist im Produktweg nicht verfügbar; keine Ausführung.",
          kandidat,
        ),
        adapter: adapterStand,
      };
    }

    // 2. Vorschau mit eigener Kennung, dann genau diese Bindung bestätigt ausführen.
    const auftragId = `echtprobe-${randomUUID()}`.slice(0, 64);
    const auftrag = {
      zweck: "oeffentliche_recherche",
      gewaehlt: "wikipedia-suche",
      eingabe: { suchbegriff: SUCHBEGRIFF },
      arbeitsbereich: "echtprobe-ac10",
      auftragId,
    };
    const vorschau = await inject("POST", "/api/me/faehigkeiten/vorschau", token, auftrag);
    const fingerabdruck =
      (vorschau.body as { fingerabdruck?: string | null }).fingerabdruck ?? null;
    const lauf = await inject("POST", "/api/me/faehigkeiten/auftraege", token, {
      ...auftrag,
      bestaetigt: true,
      vorschauFingerabdruck: fingerabdruck,
    });
    const ergebnis = (lauf.body as { ergebnis?: Record<string, unknown> | null }).ergebnis ?? null;
    const gespeichert = (await inject("GET", `/api/me/faehigkeiten/auftraege/${auftragId}`, token))
      .body;
    const wieder = await inject("POST", "/api/me/faehigkeiten/auftraege", token, {
      ...auftrag,
      bestaetigt: true,
      vorschauFingerabdruck: fingerabdruck,
    });
    const wiederErgebnis = (wieder.body as { ergebnis?: { wiederholt?: boolean; stand?: string } })
      .ergebnis;

    // 3. Überprüfte Wirkung: die zurückgegebene Originalquelle ist abrufbar und trägt den Titel.
    const eintraege = (ergebnis?.eintraege as { titel?: string; url?: string }[] | undefined) ?? [];
    const erster = eintraege[0];
    let wirkung: EchtprobeBeleg["wirkung"] = { url: null, httpStatus: null, titelGefunden: null };
    if (erster?.url) {
      const abruf =
        opt.abruf ??
        (async (url: string) => {
          const r = await fetch(url, { redirect: "follow" });
          return { status: r.status, text: () => r.text() };
        });
      const r = await abruf(erster.url);
      const text = await r.text();
      wirkung = {
        url: erster.url,
        httpStatus: r.status,
        titelGefunden: erster.titel ? text.includes(erster.titel) : false,
      };
    }

    // 4. Negativfall: externe Wissensabfrage gesperrt → kein Aufruf, konkrete Voraussetzung.
    await services.externalKnowledge.setStage("blocked");
    const gesperrt = await inject("POST", "/api/me/faehigkeiten/vorschau", token, {
      ...auftrag,
      auftragId: `echtprobe-negativ-${randomUUID()}`.slice(0, 64),
    });
    const negativ = (
      gesperrt.body as { vorbereitung?: { stand?: string; voraussetzungen?: { art: string }[] } }
    ).vorbereitung;

    const ok =
      ergebnis?.stand === "erfolgreich" &&
      ergebnis?.transport === "echt" &&
      eintraege.length > 0 &&
      wirkung.httpStatus === 200 &&
      wirkung.titelGefunden === true &&
      wiederErgebnis?.wiederholt === true &&
      (negativ?.voraussetzungen ?? []).some((v) => v.art === "freigabe_extern");
    return {
      stand: ok ? "durchgefuehrt" : "fehlgeschlagen",
      voraussetzungen: [],
      kandidat,
      zeitpunkt: new Date().toISOString(),
      plattform: { node: process.version, system: process.platform },
      adapter: adapterStand,
      rolle: "admin",
      auftragId,
      ergebnis,
      gespeichert,
      wiederholung: {
        wiederholt: wiederErgebnis?.wiederholt ?? null,
        stand: wiederErgebnis?.stand ?? null,
      },
      wirkung,
      negativfall: {
        stand: negativ?.stand ?? null,
        voraussetzungen: (negativ?.voraussetzungen ?? []).map((v) => v.art),
      },
      meldung: ok
        ? "Realer Aufruf über den Produktweg mit überprüfter Wirkung."
        : "Der reale Aufruf hat nicht alle Prüfungen erfüllt — Einzelheiten im Beleg.",
    };
  } finally {
    await app.close();
  }
}

// Direkter Aufruf (Betrieb): Beleg als JSON, Exitcode 0 nur bei durchgeführter Probe.
if (process.argv[1]?.endsWith("echtprobe-wikipedia.ts")) {
  fuehreEchtprobeAus()
    .then((beleg) => {
      process.stdout.write(`${JSON.stringify(beleg, null, 2)}\n`);
      process.exitCode =
        beleg.stand === "durchgefuehrt" ? 0 : beleg.stand === "voraussetzung_fehlt" ? 2 : 1;
    })
    .catch((fehler: unknown) => {
      process.stderr.write(
        `Echtprobe abgebrochen: ${fehler instanceof Error ? fehler.message : String(fehler)}\n`,
      );
      process.exitCode = 1;
    });
}
