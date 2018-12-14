// ==== start of testlib ====
function factorial(n: number): number {
  return n === 0 ? 1 : n * factorial(n - 1)
}
// ==== end of testlib ====
export const factorial1 = factorial
