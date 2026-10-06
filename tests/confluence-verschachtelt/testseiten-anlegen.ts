// ================================================================================================
// R-1126 / R-1800 (E6) — DIE VERSCHACHTELTEN TESTSEITEN IN EINER ECHTEN CONFLUENCE-TESTINSTANZ.
// ================================================================================================
//
// Die Fixture `bereich.ts` misst den Import an einer realistischen Struktur, aber nur als
// aufgezeichnete Antwort. Dieses Werkzeug legt DENSELBEN Baum in einer Confluence-Testinstanz an,
// damit der echte Import an echten Seiten gemessen werden kann.
//
// ES SCHREIBT IN EIN FREMDES SYSTEM — deshalb:
//   · Ohne `--ausfuehren` ist es ein PROBELAUF: es zeigt den Plan und sendet nichts.
//   · Es braucht eigene Zugangsdaten mit Schreibrecht (`CONFLUENCE_TESTSEITEN_USER`,
//     `CONFLUENCE_TESTSEITEN_TOKEN`). Der Lese-Token des Imports wird bewusst NICHT benutzt.
//   · Nur https, nur die eine Adresse aus `KLARWERK_CONFLUENCE_BASE_URL`, keine Weiterleitung.
//   · Kein Token in einer Ausgabe.
//
// EINE ABWEICHUNG VON DER FIXTURE, UND WARUM: Confluence verlangt je Space eindeutige Seitentitel.
// Gleichnamige Seiten (zweimal „Wartung", zweimal „Checkliste") bekommen deshalb so viele
// Ahnentitel angehängt, bis sie verschieden sind („Wartung (Linie B)", „Checkliste (Linie B /
// Wartung)"). Jede Seite trägt ausserdem das Präfix `E6 · `,
// damit die Testseiten im Bereich erkennbar und wieder auffindbar sind.
//
// Aufruf: npx tsx tests/confluence-verschachtelt/testseiten-anlegen.ts [--ausfuehren]
import { BAUM, type BaumSeite } from "./bereich";

export const PRAEFIX = "E6 · ";

export interface GeplanteSeite {
  fixtureId: string;
  titel: string;
  elternFixtureId: string | null;
  labels: string[];
  gruppe?: string;
  html: string;
}

/** Eltern vor Kindern, Titel je Space eindeutig — rein aus dem Baum, ohne Netz. */
export function planeTestseiten(baum: readonly BaumSeite[] = BAUM): GeplanteSeite[] {
  const nachId = new Map(baum.map((s) => [s.id, s]));
  /** Ahnentitel, nächster Elternteil zuerst. */
  const ahnen = (s: BaumSeite): string[] => {
    const out: string[] = [];
    for (let e = s.eltern; e !== null; e = nachId.get(e)?.eltern ?? null) {
      out.push(nachId.get(e)?.titel ?? "?");
    }
    return out;
  };
  // Gleichnamige Seiten bekommen so viele Ahnen angehängt (nächster zuerst, äusserer vorn), bis
  // ihre Titel verschieden sind.
  const titelVon = new Map<string, string>();
  const nachTitel = new Map<string, BaumSeite[]>();
  for (const s of baum) {
    nachTitel.set(s.titel, [...(nachTitel.get(s.titel) ?? []), s]);
  }
  for (const [titel, gruppe] of nachTitel) {
    if (gruppe.length === 1) {
      titelVon.set(gruppe[0]?.id ?? "", titel);
      continue;
    }
    for (let n = 1; ; n++) {
      const kandidaten = gruppe.map((s) => {
        const kette = ahnen(s).slice(0, n).reverse();
        return kette.length > 0 ? `${titel} (${kette.join(" / ")})` : titel;
      });
      const erschoepft = gruppe.every((s) => ahnen(s).length <= n);
      if (new Set(kandidaten).size === kandidaten.length || erschoepft) {
        gruppe.forEach((s, i) => titelVon.set(s.id, kandidaten[i] ?? titel));
        break;
      }
    }
  }
  return [...baum]
    .sort((a, b) => ahnen(a).length - ahnen(b).length)
    .map((s) => {
      return {
        fixtureId: s.id,
        titel: `${PRAEFIX}${titelVon.get(s.id) ?? s.titel}`,
        elternFixtureId: s.eltern,
        labels: s.labels ?? [],
        ...(s.gruppe ? { gruppe: s.gruppe } : {}),
        html: s.html ?? `<p>Inhalt von ${s.titel}.</p>`,
      };
    });
}

export interface AnlageKonfig {
  baseUrl: string;
  spaceKey: string;
  authorization: string;
  fetchFn?: typeof fetch;
}

export interface AnlageErgebnis {
  angelegt: { fixtureId: string; titel: string; confluenceId: string }[];
}

/** Legt die geplanten Seiten an. Bricht beim ersten Fehler ab und nennt nur den Status. */
export async function legeTestseitenAn(
  plan: readonly GeplanteSeite[],
  konfig: AnlageKonfig,
): Promise<AnlageErgebnis> {
  const basis = konfig.baseUrl.replace(/\/+$/, "");
  const origin = new URL(basis);
  if (origin.protocol !== "https:") {
    throw new Error("Nur https — Abbruch ohne Aufruf.");
  }
  const fetchFn = konfig.fetchFn ?? fetch;
  const senden = async (pfad: string, body: unknown): Promise<unknown> => {
    const res = await fetchFn(`${basis}${pfad}`, {
      method: "POST",
      headers: {
        authorization: konfig.authorization,
        accept: "application/json",
        "content-type": "application/json",
      },
      redirect: "error",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Confluence antwortete mit ${res.status} auf ${pfad.split("?")[0]}`);
    }
    return res.json();
  };
  const neueIds = new Map<string, string>();
  const angelegt: AnlageErgebnis["angelegt"] = [];
  for (const seite of plan) {
    const elternId = seite.elternFixtureId ? neueIds.get(seite.elternFixtureId) : undefined;
    if (seite.elternFixtureId && !elternId) {
      throw new Error(`Elternteil von ${seite.fixtureId} wurde nicht angelegt — Abbruch.`);
    }
    const antwort = (await senden("/rest/api/content", {
      type: "page",
      title: seite.titel,
      space: { key: konfig.spaceKey },
      ...(elternId ? { ancestors: [{ id: elternId }] } : {}),
      body: { storage: { value: seite.html, representation: "storage" } },
    })) as { id?: unknown };
    const id = typeof antwort?.id === "string" ? antwort.id : undefined;
    if (!id) {
      throw new Error(`Keine Seiten-Id für ${seite.fixtureId} — Abbruch.`);
    }
    neueIds.set(seite.fixtureId, id);
    if (seite.labels.length > 0) {
      await senden(
        `/rest/api/content/${encodeURIComponent(id)}/label`,
        seite.labels.map((name) => ({ prefix: "global", name })),
      );
    }
    if (seite.gruppe) {
      await senden(`/rest/api/content/${encodeURIComponent(id)}/restriction`, [
        { operation: "read", restrictions: { group: [{ type: "group", name: seite.gruppe }] } },
      ]);
    }
    angelegt.push({ fixtureId: seite.fixtureId, titel: seite.titel, confluenceId: id });
  }
  return { angelegt };
}

async function hauptprogramm(argv: readonly string[]): Promise<number> {
  const plan = planeTestseiten();
  const ausfuehren = argv.includes("--ausfuehren");
  process.stdout.write(`Plan: ${plan.length} Seiten\n`);
  for (const s of plan) {
    process.stdout.write(
      `  ${s.titel}  ←  ${s.elternFixtureId ?? "(Wurzel)"}${s.gruppe ? `  [lesbar: ${s.gruppe}]` : ""}\n`,
    );
  }
  if (!ausfuehren) {
    process.stdout.write("Probelauf — nichts gesendet. Anlegen mit --ausfuehren.\n");
    return 0;
  }
  const baseUrl = process.env.KLARWERK_CONFLUENCE_BASE_URL ?? "";
  const spaceKey = process.env.KLARWERK_CONFLUENCE_SPACE ?? "";
  const user = process.env.CONFLUENCE_TESTSEITEN_USER ?? "";
  const token = process.env.CONFLUENCE_TESTSEITEN_TOKEN ?? "";
  if (!baseUrl || !spaceKey || !token) {
    process.stderr.write(
      "Es fehlen KLARWERK_CONFLUENCE_BASE_URL, KLARWERK_CONFLUENCE_SPACE oder CONFLUENCE_TESTSEITEN_TOKEN.\n",
    );
    return 2;
  }
  // Mit Kennung: Cloud (Basic). Ohne Kennung: persönliches Zugriffstoken (Bearer), wie R-0166.
  const authorization = user
    ? `Basic ${Buffer.from(`${user}:${token}`, "utf8").toString("base64")}`
    : `Bearer ${token}`;
  try {
    const { angelegt } = await legeTestseitenAn(plan, { baseUrl, spaceKey, authorization });
    for (const a of angelegt) {
      process.stdout.write(`angelegt: ${a.titel} → ${a.confluenceId}\n`);
    }
    return 0;
  } catch (err) {
    const meldung = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${meldung.split(token).join("[redacted]")}\n`);
    return 1;
  }
}

if (process.argv[1]?.endsWith("testseiten-anlegen.ts")) {
  hauptprogramm(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
