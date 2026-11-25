import type { Page } from "playwright";
import { expect } from "vitest";

export async function pruefeKlaraTeamfassung(
  page: Page,
  id: string,
  frage: string,
  erwartet: string,
) {
  const vorher = page.url();
  await page.goto(new URL("/begleiter", vorher).href);
  await page.getByTestId("begleiter-figur").click();
  await page.getByTestId("begleiter-menue-knopf").click();
  await page.getByTestId("klara-menue-funktionen").click();
  const auf = page.waitForEvent("popup");
  await page.getByTestId("begleiter-teamworkflows").press("Enter");
  const workflows = await auf;
  await workflows.waitForURL(new URL("/teamworkflows", vorher).href);
  await workflows.getByRole("heading", { level: 1 }).waitFor();
  expect((await workflows.request.get("/api/teamworkflows")).status()).toBe(200);
  await workflows.close();
  const bereich = page.getByTestId("begleiter-teamassistenten");
  await bereich.locator("summary").press("Enter");
  await bereich.getByTestId("teamassistent-auswahl").selectOption(id);
  await bereich.getByTestId("teamassistent-frage").fill(frage);
  await bereich.getByTestId("teamassistent-senden").press("Enter");
  const antwort = bereich.getByTestId("teamassistent-antwort");
  await antwort.waitFor();
  expect(await antwort.innerText()).toContain(erwartet);
  expect(await antwort.getByRole("link").first().getAttribute("href")).toMatch(/^\/wissen\//);
  await page.goto(vorher);
}
