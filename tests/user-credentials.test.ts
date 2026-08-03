import { describe, expect, it } from "vitest";

import { createUserSchema } from "@/modules/auth/application/schemas";
import { passwordSchema } from "@/modules/auth/application/password";

describe("учётные данные пользователя", () => {
  const roleId = "00000000-0000-4000-8000-000000000001";

  it("разрешает создать пользователя без email", () => {
    const result = createUserSchema.safeParse({
      email: "",
      phone: "+7 999 123-45-67",
      login: "Иванов Иван Иванович",
      password: "a1B2c3",
      roleIds: [roleId],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeUndefined();
  });

  it("принимает ФИО из двух или трёх частей", () => {
    expect(
      createUserSchema.safeParse({
        phone: "+7 999 123-45-67",
        login: "Петров Пётр",
        password: "123456",
        roleIds: [roleId],
      }).success,
    ).toBe(true);
    expect(
      createUserSchema.safeParse({
        phone: "+7 999 123-45-67",
        login: "Петров",
        password: "123456",
        roleIds: [roleId],
      }).success,
    ).toBe(false);
  });

  it("требует пароль ровно из шести символов", () => {
    expect(passwordSchema.safeParse("123456").success).toBe(true);
    expect(passwordSchema.safeParse("12345").success).toBe(false);
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
  });

  it("проверяет заполненный email", () => {
    expect(
      createUserSchema.safeParse({
        email: "не-email",
        phone: "+7 999 123-45-67",
        login: "Сидоров Сидор",
        password: "123456",
        roleIds: [roleId],
      }).success,
    ).toBe(false);
  });
});
