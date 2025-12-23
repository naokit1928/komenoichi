// 将来ここを差し替えるだけで制限変更できる

type QtyByKg = { 5: number; 10: number; 25: number };

export const DEFAULT_MAX_TOTAL_KG = 50;

/**
 * 合計kgを計算
 */
export function calcTotalKg(qtyByKg: QtyByKg): number {
  return qtyByKg[5] * 5 + qtyByKg[10] * 10 + qtyByKg[25] * 25;
}

/**
 * 上限kgチェック（50kgはOK）
 */
export function isOverMaxKg(
  qtyByKg: QtyByKg,
  maxKg: number = DEFAULT_MAX_TOTAL_KG
): boolean {
  return calcTotalKg(qtyByKg) > maxKg;
}
