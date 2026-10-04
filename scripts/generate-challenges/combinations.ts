/** All k-element combinations of items, in lexicographic order. */
export function combinations<T>(items: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];

  function backtrack(start: number) {
    if (current.length === k) {
      result.push(current.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      backtrack(i + 1);
      current.pop();
    }
  }

  backtrack(0);
  return result;
}
