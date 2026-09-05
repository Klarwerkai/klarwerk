// ================================================================================================
// JOB 3062 · H3 — DIE SECHS SYMBOLE DER WERKZEUGZEILE, wörtlich aus dem Mockup.
// ================================================================================================
//
// `design/klarwerk/Erfassen.dc.html` Z.36-38 zeichnet die Werkzeuge als 16-px-Strich-SVG mit
// `stroke-width: 1.8`, runden Enden und der Farbe der Zeile. Genau diese Pfade stehen hier —
// nicht die Näherung aus einer Icon-Bibliothek, die morgen anders aussieht.
//
// `stroke="currentColor"` statt des Mockup-Hexwerts: die Farbe kommt vom Werkzeug (Tinte-2 im
// Ruhezustand, Tinte beim Überfahren, blass bei Sperre) — ein zweiter, fester Farbwert im Symbol
// würde bei jedem dieser Zustände lügen.

interface SymbolProps {
  groesse?: number;
}

function Rahmen({
  groesse = 16,
  children,
}: SymbolProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Mikrofon — „Diktieren" (Mockup Z.36). */
export function SymbolMikrofon(props: SymbolProps): JSX.Element {
  return (
    <Rahmen {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </Rahmen>
  );
}

/** Bildrahmen mit Sonne — „Bild" (Mockup Z.37). */
export function SymbolBild(props: SymbolProps): JSX.Element {
  return (
    <Rahmen {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </Rahmen>
  );
}

/** Blatt mit Eselsohr — „Datei" (Mockup Z.38). */
export function SymbolDatei(props: SymbolProps): JSX.Element {
  return (
    <Rahmen {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </Rahmen>
  );
}

/** Funke — „KI". Das Mockup zeichnet dieses Werkzeug nicht; die Form folgt der KI-Kennzeichnung
 *  des Produkts (Sparkles) in derselben Strichstärke wie die Nachbarn. */
export function SymbolKi(props: SymbolProps): JSX.Element {
  return (
    <Rahmen {...props}>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </Rahmen>
  );
}

/** Drei Punkte — das „…"-Menü (Mockup `Menues.dc.html`, Listenkopf). */
export function SymbolMehr(props: SymbolProps): JSX.Element {
  return (
    <svg
      width={props.groesse ?? 16}
      height={props.groesse ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/** Fragezeichen im Kreis — das „?"-Menü mit den Hilfetexten. */
export function SymbolHilfe(props: SymbolProps): JSX.Element {
  return (
    <Rahmen {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.6" />
      <path d="M12 17.2h.01" />
    </Rahmen>
  );
}
