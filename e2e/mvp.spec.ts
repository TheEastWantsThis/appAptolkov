import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Номер телефона").fill(phone);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/dashboard");
}

test("администратор входит и открывает аналитику", async ({ page }) => {
  await login(
    page,
    "+7 999 000-00-01",
    process.env.SEED_ADMIN_PASSWORD ?? "Adm001",
  );
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Управленческая аналитика" }),
  ).toBeVisible();
  await expect(page.getByText("Выручка", { exact: true })).toBeVisible();
});

test("промоутер видит только личную безопасную аналитику", async ({ page }) => {
  await login(
    page,
    "+7 999 000-00-02",
    process.env.SEED_DEMO_PASSWORD ?? "Dem001",
  );
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
  await login(
    page,
    "+7 999 000-00-02",
    process.env.SEED_DEMO_PASSWORD ?? "Dem001",
  );
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
  await login(
    page,
    "+7 999 000-00-02",
    process.env.SEED_DEMO_PASSWORD ?? "Dem001",
  );
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

test("обычный пользователь не может менять собственный пароль", async ({
  page,
}) => {
  await login(
    page,
    "+7 999 000-00-02",
    process.env.SEED_DEMO_PASSWORD ?? "Dem001",
  );
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Управление паролем" }),
  ).toBeVisible();
  await expect(
    page.getByText("Самостоятельная смена пароля отключена.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Сменить пароль" }),
  ).toHaveCount(0);
});

test("администратор может назначать пароли", async ({ page }) => {
  await login(
    page,
    "+7 999 000-00-01",
    process.env.SEED_ADMIN_PASSWORD ?? "Adm001",
  );
  await page.goto("/users");
  expect(
    await page.getByRole("button", { name: "Назначить пароль" }).count(),
  ).toBeGreaterThan(0);
  await page.goto("/users/new");
  await expect(
    page.getByRole("heading", { name: "Новый пользователь" }),
  ).toBeVisible();
  await expect(page.getByLabel("ФИО")).toBeVisible();
  await expect(page.getByLabel("Номер телефона")).toBeVisible();
  await expect(page.getByLabel("Email (необязательно)")).toBeVisible();
  await expect(page.getByLabel("Пароль из 6 символов")).toHaveAttribute(
    "maxlength",
    "6",
  );
});

test("руководитель управляет пользователями, но не их паролями", async ({
  page,
}) => {
  await login(
    page,
    "+7 999 000-00-08",
    process.env.SEED_DEMO_PASSWORD ?? "Dem001",
  );
  await page.goto("/users");
  await expect(
    page.getByRole("button", { name: "Назначить пароль" }),
  ).toHaveCount(0);
  await page.goto("/users/new");
  await expect(page).toHaveURL(/\/403$/);
});
