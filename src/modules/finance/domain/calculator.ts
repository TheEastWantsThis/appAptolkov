export interface FinanceCalculationInput {
  contractAmount: number;
  discountAmount: number;
  prepayment: number;
  additionalPayments: number;
  materialCost: number;
  installerWages: number;
  transportCost: number;
  additionalExpenses: number;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateProjectFinance(input: FinanceCalculationInput) {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0)
      throw new Error("Некорректное значение: " + name);
  }
  if (input.discountAmount > input.contractAmount)
    throw new Error("Скидка не может превышать стоимость договора");

  const revenue = money(input.contractAmount - input.discountAmount);
  const paid = money(input.prepayment + input.additionalPayments);
  const totalCost = money(
    input.materialCost +
      input.installerWages +
      input.transportCost +
      input.additionalExpenses,
  );
  const grossProfit = money(revenue - totalCost);
  return {
    revenue,
    paid,
    balanceDue: money(Math.max(revenue - paid, 0)),
    overpayment: money(Math.max(paid - revenue, 0)),
    totalCost,
    grossProfit,
    marginPercent: revenue > 0 ? money((grossProfit / revenue) * 100) : 0,
  };
}
