/** Reine, redigierte Ursachenmessung; dieselben Grenzen stehen im tatsächlichen PG-Startbanner. */
export const LADE_DIAGNOSE_GRENZEN = {
  schema: "ux26-ladefehler-v1",
  fehler: { import: 4, pageerror: 4, asset: 4, rauschen: 4 },
  assetAntworten: 24,
} as const;
const KAPAZITAET = LADE_DIAGNOSE_GRENZEN.fehler;
type Gruppe = keyof typeof KAPAZITAET;
interface Technik {
  meldungen: string[];
  adressen: string[];
}
type Ladefehler =
  | ({ art: "console"; typ: "error" | "warning"; ort: string | null } & Technik)
  | ({ art: "pageerror"; name: string } & Technik)
  | { art: "asset-response"; adresse: string; status: number }
  | ({ art: "requestfailed"; adresse: string } & Technik);

function adresse(roh: string): string | null {
  try {
    const url = new URL(roh.replace(/[),.;]+$/u, ""));
    if (
      !/^https?:$/u.test(url.protocol) ||
      !/^\/(?:assets\/.*|[^/]+\.(?:m?js|css))$/u.test(url.pathname)
    ) {
      return null;
    }
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}

const spezifisch = (token: string): boolean =>
  !/^(?:failed to load resource|net::ERR_|NS_ERROR_)/iu.test(token);

function technik(roh: string): Technik {
  const wichtig: string[] = [];
  const allgemein: string[] = [];
  for (const m of roh.matchAll(
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload(?: CSS)?|failed to load module script|failed to load resource|refused to (?:load|execute|apply)|content security policy|MIME type|ChunkLoadError|preloadError|net::ERR_[A-Z0-9_]+|NS_ERROR_[A-Z_]+/giu,
  )) {
    const token = m[0];
    const ziel = spezifisch(token) ? wichtig : allgemein;
    if (token.length <= 120 && ziel.length < 8 && !ziel.includes(token)) ziel.push(token);
  }
  const adressen = new Set<string>();
  for (const m of roh.matchAll(/https?:\/\/[^\s"'<>]+/gu)) {
    const url = adresse(m[0]);
    if (url) adressen.add(url);
    if (adressen.size === 4) break;
  }
  return { meldungen: [...wichtig, ...allgemein].slice(0, 8), adressen: [...adressen] };
}

/** Unabhängige Kapazitäten: Abbruchrauschen verdrängt keine Import-/Seiten-/HTTP-Fehler. */
export class LadeDiagnose {
  private readonly puffer: Record<Gruppe, Map<string, Ladefehler>> = {
    import: new Map(),
    pageerror: new Map(),
    asset: new Map(),
    rauschen: new Map(),
  };
  private readonly ausgelassen = { import: 0, pageerror: 0, asset: 0, rauschen: 0 };
  private readonly duplikate = { import: 0, pageerror: 0, asset: 0, rauschen: 0 };
  private readonly antworten = new Map<string, number>();
  private antwortenAusgelassen = 0;
  private verworfen = 0;

  private merke(gruppe: Gruppe, ereignis: Ladefehler): void {
    const puffer = this.puffer[gruppe];
    const schluessel = JSON.stringify(ereignis);
    // Dedupe nur nach der redigierten Form noch gehaltener Einträge, nie nach Rohtext.
    if (puffer.has(schluessel)) {
      this.duplikate[gruppe] += 1;
      puffer.delete(schluessel);
    }
    puffer.set(schluessel, ereignis);
    if (puffer.size > KAPAZITAET[gruppe]) {
      const erste = puffer.keys().next().value;
      if (erste !== undefined) puffer.delete(erste);
      this.ausgelassen[gruppe] += 1;
    }
  }

  konsole(typ: string, roh: string, roherOrt: string): void {
    if (typ !== "error" && typ !== "warning") return;
    const beobachtet = technik(roh);
    const ort = adresse(roherOrt);
    if (
      beobachtet.meldungen.length === 0 ||
      (beobachtet.meldungen.every((m) => /failed to load resource/iu.test(m)) &&
        !ort &&
        beobachtet.adressen.length === 0)
    ) {
      this.verworfen += 1;
      return;
    }
    this.merke(beobachtet.meldungen.some(spezifisch) ? "import" : "rauschen", {
      art: "console",
      typ,
      ort,
      ...beobachtet,
    });
  }

  seitenfehler(roherName: string, roh: string): void {
    const bekannteNamen =
      /^(?:Error|TypeError|SyntaxError|ReferenceError|RangeError|ChunkLoadError|preloadError)$/u;
    const name = bekannteNamen.test(roherName) ? roherName : "anderer Fehlertyp";
    const beobachtet = technik(roh);
    const importfehler =
      name === "ChunkLoadError" || name === "preloadError" || beobachtet.meldungen.some(spezifisch);
    this.merke(importfehler ? "import" : "pageerror", { art: "pageerror", name, ...beobachtet });
  }

  antwort(roh: string, status: number): void {
    const url = adresse(roh);
    if (!url || !Number.isInteger(status) || status < 100 || status > 599) {
      this.verworfen += 1;
      return;
    }
    this.antworten.delete(url);
    this.antworten.set(url, status);
    if (this.antworten.size > LADE_DIAGNOSE_GRENZEN.assetAntworten) {
      const erste = this.antworten.keys().next().value;
      if (erste !== undefined) this.antworten.delete(erste);
      this.antwortenAusgelassen += 1;
    }
    if (status >= 400) this.merke("asset", { art: "asset-response", adresse: url, status });
  }

  abbruch(roh: string, fehlermeldung: string): void {
    const url = adresse(roh);
    if (!url) {
      this.verworfen += 1;
      return;
    }
    const beobachtet = technik(fehlermeldung);
    this.merke(beobachtet.meldungen.some(spezifisch) ? "import" : "rauschen", {
      art: "requestfailed",
      adresse: url,
      ...beobachtet,
    });
  }

  private zaehler(gruppe: Gruppe) {
    return {
      kapazitaet: KAPAZITAET[gruppe],
      behalten: this.puffer[gruppe].size,
      ausgelassen: this.ausgelassen[gruppe],
      duplikate: this.duplikate[gruppe],
    };
  }

  befund() {
    return {
      grenzen: LADE_DIAGNOSE_GRENZEN,
      fehler: Object.values(this.puffer).flatMap((p) => [...p.values()]),
      ausgelassen: Object.values(this.ausgelassen).reduce((a, b) => a + b, 0),
      duplikate: Object.values(this.duplikate).reduce((a, b) => a + b, 0),
      verworfen: this.verworfen,
      gruppen: {
        import: this.zaehler("import"),
        pageerror: this.zaehler("pageerror"),
        asset: this.zaehler("asset"),
        rauschen: this.zaehler("rauschen"),
      },
      assetAntworten: [...this.antworten].map(([adresse, status]) => ({ adresse, status })),
      assetAntwortenAusgelassen: this.antwortenAusgelassen,
    };
  }
}
