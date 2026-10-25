// Schmale öffentliche CDP-AX-Datenform; kein Browserimport und keine Eingabewirkung.
export interface DatumsAXKnoten {
  nodeId: string;
  ignored: boolean;
  backendDOMNodeId?: number;
  parentId?: string;
  childIds?: readonly string[];
  role?: { type: string; value?: unknown };
  properties?: readonly { name: string; value: { type: string; value?: unknown } }[];
}

type DatumsTeil = "tag" | "monat" | "jahr";

function unklar(grund: string): never {
  throw new Error(`Native Datumsabschnitte unklar: ${grund}`);
}

function eigenschaft(knoten: DatumsAXKnoten, name: string) {
  const werte = knoten.properties?.filter((wert) => wert.name === name) ?? [];
  if (werte.length > 1) unklar(`doppelte Eigenschaft ${name}`);
  return werte[0]?.value;
}

function fokussiert(knoten: DatumsAXKnoten, zielBackendId: number, station: string): boolean {
  const wert = eigenschaft(knoten, "focused");
  if (!wert) return false;
  // Chromium FillGlobalStates (697d70a5) liefert focused=true als booleanOrUndefined.
  if (!["boolean", "booleanOrUndefined"].includes(wert.type) || typeof wert.value !== "boolean") {
    const fokuswert = wert.value;
    unklar(
      `Fokuswert ${JSON.stringify({
        station,
        zielBackendId,
        nodeId: knoten.nodeId,
        role: typeof knoten.role?.value === "string" ? knoten.role.value : null,
        ignored: knoten.ignored,
        focusedType: typeof wert.type === "string" ? wert.type : typeof wert.type,
        valueVorhanden: Object.prototype.hasOwnProperty.call(wert, "value"),
        valueType: typeof fokuswert,
        ...(fokuswert === null ||
        typeof fokuswert === "boolean" ||
        typeof fokuswert === "string" ||
        (typeof fokuswert === "number" && Number.isFinite(fokuswert))
          ? { value: fokuswert }
          : {}),
      })}`,
    );
  }
  return wert.value;
}

function grenze(knoten: DatumsAXKnoten, name: string): number {
  const wert = eigenschaft(knoten, name);
  if (
    !wert ||
    !["number", "integer"].includes(wert.type) ||
    typeof wert.value !== "number" ||
    !Number.isSafeInteger(wert.value)
  ) {
    unklar(`fehlende oder nichtnumerische ${name}`);
  }
  return wert.value;
}

/** Nur dieser DOM-Identität folgen, innerhalb jedes Snapshots strikt entlang AX-childIds. */
export function datumsabschnitte(
  nodes: readonly DatumsAXKnoten[],
  zielBackendId: number,
  iso: string,
  erlaubterFokus: readonly number[] = [0],
  station = "ohne Stationsangabe",
) {
  const datum = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!datum) unklar("Solltag ist nicht JJJJ-MM-TT");
  const ziffern = { jahr: datum[1] ?? "", monat: datum[2] ?? "", tag: datum[3] ?? "" };
  if (!Number.isSafeInteger(zielBackendId) || zielBackendId <= 0) unklar("DOM-Zielidentität");
  const index = new Map<string, DatumsAXKnoten>();
  for (const node of nodes) {
    if (index.has(node.nodeId)) unklar("doppelte AX-Knotenidentität");
    index.set(node.nodeId, node);
  }
  const ziele = nodes.filter((node) => node.backendDOMNodeId === zielBackendId);
  const ziel = ziele[0];
  if (ziele.length !== 1 || !ziel || ziel.ignored || ziel.role?.value !== "Date") {
    unklar("kein eindeutiger sichtbarer Date-Teilbaum am DOM-Ziel");
  }
  const besucht = new Set<string>();
  const fokusKnoten: string[] = [];
  const abschnitte: { art: DatumsTeil; nodeId: string; ziffern: string }[] = [];
  function lesen(node: DatumsAXKnoten) {
    if (besucht.has(node.nodeId)) unklar("doppelte oder zyklische childIds");
    besucht.add(node.nodeId);
    if (fokussiert(node, zielBackendId, station)) fokusKnoten.push(node.nodeId);
    if (node.role?.value === "spinbutton") {
      if (node.ignored) unklar("ausgeblendeter Datumsabschnitt");
      const min = grenze(node, "valuemin");
      const max = grenze(node, "valuemax");
      let art: DatumsTeil;
      if (min === 1 && max === 31) art = "tag";
      else if (min === 1 && max === 12) art = "monat";
      else if (min >= 1 && max >= 9999 && max - min >= 1000) art = "jahr";
      else unklar(`unbekannte Abschnittsgrenzen ${min}..${max}`);
      const wert = ziffern[art];
      if (Number(wert) < min || Number(wert) > max) unklar("Sollkomponente außerhalb der Grenzen");
      abschnitte.push({ art, nodeId: node.nodeId, ziffern: wert });
    }
    for (const childId of node.childIds ?? []) {
      const child = index.get(childId);
      if (!child || child.parentId !== node.nodeId) unklar("unvollständige childIds-Elternbindung");
      lesen(child);
    }
  }
  lesen(ziel);
  if (abschnitte.length !== 3 || new Set(abschnitte.map((teil) => teil.art)).size !== 3) {
    unklar("nicht genau drei eindeutige Tag-, Monat- und Jahrabschnitte");
  }
  const fokus = abschnitte.findIndex((teil) => teil.nodeId === fokusKnoten[0]);
  if (fokusKnoten.length !== 1 || fokus < 0 || !erlaubterFokus.includes(fokus)) {
    unklar("nicht genau der erwartete Datumsabschnitt fokussiert");
  }
  return { abschnitte, fokus, ziffern: abschnitte.map((teil) => teil.ziffern).join("") };
}
