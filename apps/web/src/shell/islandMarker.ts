export const ISLAND_MARKER_SELECTOR = 'meta[name="klarwerk-island"]';

export type IslandMarkerDocument = {
  head?: {
    querySelector: (selector: string) => { content?: string | null } | null;
  };
};

export function readIslandMarker(
  doc: IslandMarkerDocument | undefined = (globalThis as { document?: IslandMarkerDocument })
    .document,
): string | undefined {
  const marker = doc?.head?.querySelector(ISLAND_MARKER_SELECTOR)?.content?.trim();
  return marker ? marker : undefined;
}
