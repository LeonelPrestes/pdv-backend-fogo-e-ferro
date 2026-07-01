import { Prisma } from "@prisma/client";

type TotalsOrderItem = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  canceledAt: Date | null;
};

type TotalsOrder = {
  status: string;
  items: TotalsOrderItem[];
};

type TotalsPayment = {
  amount: Prisma.Decimal;
  status: string;
};

export function calculateTabTotals(tab: {
  serviceFeeEnabled: boolean;
  serviceFeePercent: Prisma.Decimal;
  orders: TotalsOrder[];
  payments: TotalsPayment[];
}) {
  const subtotal = tab.orders
    .filter((order) => order.status !== "CANCELED")
    .flatMap((order) => order.items)
    .filter((item) => !item.canceledAt)
    .reduce((sum, item) => {
      const lineTotal = item.unitPrice.mul(item.quantity).minus(item.discountAmount);
      return sum.plus(lineTotal);
    }, new Prisma.Decimal(0));

  const serviceFee = tab.serviceFeeEnabled
    ? subtotal.mul(tab.serviceFeePercent).div(100)
    : new Prisma.Decimal(0);
  const total = subtotal.plus(serviceFee);
  const paid = tab.payments
    .filter((payment) => payment.status === "PAID" || payment.status === "ON_CREDIT")
    .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const balance = total.minus(paid);

  return {
    subtotal: subtotal.toNumber(),
    serviceFee: serviceFee.toNumber(),
    total: total.toNumber(),
    paid: paid.toNumber(),
    balance: balance.toNumber()
  };
}
