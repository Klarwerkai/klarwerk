/** Ein Aufruf einer vorhandenen Tür der Anwendung — mit der Anmeldung der Person. */
export type KlaraRufe = (
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  rumpf?: unknown,
) => Promise<{ status: number; daten: unknown }>;
