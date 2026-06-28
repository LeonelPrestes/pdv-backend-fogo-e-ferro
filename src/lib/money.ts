import { Decimal } from "@prisma/client/runtime/library";

export function toDecimal(value: number | string): Decimal {
  return new Decimal(value);
}

export function decimalToNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}
