// AUFTRAG-mega15 Block B (bens SB-4) — DIE HERKUNFT KOMMT VOM SERVER, NICHT VOM CLIENT.
//
// Der Befund aus mega14: die Stufen-Sperre in `add-source` griff nur, wenn `body.source.provider`
// gesetzt war. `provider` ist ein vom Client frei gewähltes Feld. Derselbe Nutzer konnte denselben
// externen Treffer OHNE dieses Feld senden und bekam auch bei `blocked`/`search_on_click` eine 200.
// bens Urteil: „Das Weglassen der Provenienz ist kein ausreichender Schutz, sondern genau die
// Umgehung einer serverseitig behaupteten Policy."
//
// GEWÄHLTER ENTWURF: die Herkunft wird aus der URL abgeleitet, gegen die serverseitig bekannten
// Origins der externen Such-Provider. Der Client liefert weiterhin nur Label/URL/Auszug; das am
// Wissensobjekt vermerkte `provider`-Feld setzt AUSSCHLIESSLICH der Server aus dieser Ableitung.
//
// Warum diese Form und nicht bens beide Vorschläge:
//
//  - Ein Treffer-Token (signiert oder serverseitig gespeichert) bindet die Herkunft ebenfalls,
//    schließt aber die von ben ausdrücklich verlangte Lücke „derselbe Treffer OHNE provider" nur
//    innerhalb seiner Lebensdauer: ohne Token und ohne provider bliebe die Quelle unauffällig.
//    Und er kollidiert mit dem Erfassen-Weg: dort wandern Treffer in eine WARTELISTE, die als
//    Entwurf tage- oder wochenlang liegen bleibt und erst beim Einreichen angehängt wird
//    (lib/captureSources.ts). Ein kurzlebiger Token wäre dann abgelaufen, ein prozesslokal
//    signierter nach jedem Neustart ungültig — der Bearbeiter verlöre die Quellen seines eigenen
//    Entwurfs. Das wäre genau das „durch Reifen springen", das der Auftrag verbietet.
//  - Getrennte Endpunkte verschieben die Entscheidung wieder auf den Client: er wählt, welchen
//    Pfad er aufruft. Ohne zusätzliche Bindung ist der „manuelle" Pfad dann der neue Bypass.
//
// Diese Ableitung hängt an KEINEM Feld, das der Client setzen kann. Sie ist zustandslos, übersteht
// Neustarts, hat keine Ablaufzeit und braucht kein Schlüsselmaterial. Ein gefälschtes `provider`
// bleibt wirkungslos, weil der Server es gar nicht liest; und derselbe Treffer OHNE `provider`
// wird trotzdem als extern erkannt, weil seine ADRESSE ihn ausweist.
//
// EHRLICHE GRENZE, die im Bericht steht und auch hier stehen bleiben soll:
//  (1) Die Ableitung ist genau so vollständig wie die Liste unten. Solange die externe Suche über
//      Provider mit bekannten Origins läuft (heute: Wikipedia, s. src/wikipedia.ts), ist sie exakt.
//      Käme je ein Provider hinzu, der Treffer auf BELIEBIGEN Fremd-Hosts liefert (eine allgemeine
//      Web-Suche), ließe sich seine Herkunft so nicht mehr ableiten — dann ist der Treffer-Token
//      die richtige Form, und dieser Kommentar ist die Stelle, an der das auffallen muss.
//  (2) Wer die Adresse eines Treffers von Hand in das manuelle Quellenformular tippt, wird hier
//      GENAUSO erkannt — die Stufe greift also auch dort. Wer dagegen die Adresse weglässt, hängt
//      eine Quelle ohne Adresse an; er verwirft damit genau den Beleg, um dessentwillen man eine
//      Quelle anhängt. Gegen diesen Fall schützt keine Stufe, und das ist auch nicht ihr Zweck.

// Die Origins der externen Such-Provider. Eine reine Server-Tatsache: der Client kann sie weder
// lesen noch setzen. `host` matcht den Hostnamen exakt ODER als Subdomain (`*.host`) — Wikipedia
// liefert Treffer je Sprache unter `de.wikipedia.org`, `en.wikipedia.org` usw.
// (src/wikipedia.ts:articleUrl).
export interface ExternalProviderOrigin {
  /** Der am Wissensobjekt vermerkte Herkunftsname — identisch mit SearchProvider.name. */
  readonly provider: string;
  /** Registrierbare Basis-Hosts; Treffer liegen auf dem Host selbst oder einer Subdomain davon. */
  readonly hosts: readonly string[];
}

export const EXTERNAL_PROVIDER_ORIGINS: readonly ExternalProviderOrigin[] = [
  // createWikipediaProvider (src/wikipedia.ts) — name: "Wikipedia", URLs: https://<lang>.wikipedia.org/wiki/…
  // `wikimedia.org` steht bewusst NICHT hier: die Suche liefert es nicht.
  { provider: "Wikipedia", hosts: ["wikipedia.org"] },
];

// Hostnamen-Vergleich mit den Fallen, die sonst zum Bypass werden:
//  - Groß-/Kleinschreibung: `new URL` normalisiert den Hostnamen bereits auf Kleinbuchstaben.
//  - Abschließender Punkt (FQDN-Form `de.wikipedia.org.`) wird entfernt — sonst wäre `…org.` ein
//    gültiger, aber nicht erkannter Treffer.
//  - `de.wikipedia.org.evil.example` endet NICHT auf `.wikipedia.org` → kein Treffer (richtig).
//  - `https://de.wikipedia.org@evil.example/` hat den Hostnamen `evil.example` → kein Treffer
//    (richtig: die Seite kommt real von evil.example).
function hostMatches(hostname: string, base: string): boolean {
  const host = hostname.replace(/\.$/, "");
  return host === base || host.endsWith(`.${base}`);
}

/**
 * Leitet die Herkunft einer Quelle aus ihrer Adresse ab — die EINZIGE Stelle, an der das Produkt
 * entscheidet, ob eine Quelle ein externer Suchtreffer ist.
 *
 * @returns den serverseitig belegten Herkunftsnamen, oder `null` für „keine externe Herkunft
 *          ableitbar" (manuelle Quelle, Datei-Belegstelle, internes Intranet, keine Adresse).
 */
export function attributeExternalSource(url: unknown): string | null {
  if (typeof url !== "string") {
    return null;
  }
  const raw = url.trim();
  if (raw.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  // Dieselbe Allowlist wie die Quellen-Normalisierung (services/capture, lib/koSource.ts):
  // alles außer http/https ist ohnehin keine speicherbare Quelladresse.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  for (const origin of EXTERNAL_PROVIDER_ORIGINS) {
    if (origin.hosts.some((base) => hostMatches(parsed.hostname, base))) {
      return origin.provider;
    }
  }
  return null;
}
