// ==== start of testlib ====
// factorial takes in a integer
// and returns the factorial of that integer
export function factorial(n: number): number {
  return n === 0 ? 1 : n * factorial(n - 1)
}

// sum_between takes in two integers
// and returns the sum of all integers between them (inclusive)
// using a closed form formula
export function sum_between(start: number, end: number): number {
  return ((start + end) * (start - end + 1)) / 2
}
// ==== end of testlib ====
