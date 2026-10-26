// Reines bestehendes SQL-Leerprädikat, auch ohne Laden des PG-Adapters nutzbar.
export function sqlDeletedAtLeer(traeger: string): string {
  return `${traeger}.data->'deletedAt' IN ('null'::jsonb, '""'::jsonb, 'false'::jsonb, '0'::jsonb)`;
}
