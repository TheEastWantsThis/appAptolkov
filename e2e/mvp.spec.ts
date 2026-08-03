import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email или логин").fill(login);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/dashboard");
}

test("администратор входит и открывает аналитику", async ({ page }) => {
  await login(page, "admin", process.env.SEED_ADMIN_PASSWORD ?? "Admin123!");
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Управленческая аналитика" }),
  ).toBeVisible();
  await expect(page.getByText("Выручка", { exact: true })).toBeVisible();
});

test("промоутер видит только личную безопасную аналитику", async ({ page }) => {
  await login(page, "promoter", process.env.SEED_DEMO_PASSWORD ?? "Demo123!");
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Мои показатели" }),
  ).toBeVisible();
  await expect(page.getByText("Выручка", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Себестоимость", { exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("+7 999");
});

test("промоутер не может открыть финансовую карточку по UUID", async ({
  page,
}) => {
  await login(page, "promoter", process.env.SEED_DEMO_PASSWORD ?? "Demo123!");
  await page.goto("/finance/projects/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/403$/);
  await expect(
    page.getByRole("heading", { name: "Недостаточно прав" }),
  ).toBeVisible();
});
test("мобильная навигация не создаёт горизонтальную прокрутку", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await login(page, "promoter", process.env.SEED_DEMO_PASSWORD ?? "Demo123!");
  await expect(page.getByRole("link", { name: "Ещё" })).toBeVisible();
  await page.getByRole("link", { name: "Ещё" }).click();
  await expect(
    page.getByRole("heading", { name: "Все разделы" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
