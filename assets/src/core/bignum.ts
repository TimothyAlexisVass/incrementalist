export type BigNum = {
  m: number // 15-digit mantissa, normalized: 1 <= abs(m) < 10
  e: number // base-10 exponent
}

export const PRECISION_DIGITS = 15
export const ADD_CUTOFF = PRECISION_DIGITS + 1

export const ZERO: BigNum = { m: 0, e: 0 }
export const ONE: BigNum = { m: 1, e: 0 }

/**
 * Normalizes a BigNum so that 1 <= abs(m) < 10.
 */
export function normalize(n: BigNum): BigNum {
  if (n.m === 0 || !Number.isFinite(n.m)) {
    return { m: 0, e: 0 }
  }

  const shift = Math.floor(Math.log10(Math.abs(n.m)))

  let m = n.m / 10 ** shift
  let e = n.e + shift

  // Guard against floating edge cases like 9.999999999999999 becoming 10
  if (Math.abs(m) >= 10) {
    m /= 10
    e += 1
  }

  if (Math.abs(m) < 1) {
    m *= 10
    e -= 1
  }

  // Keep roughly 15 significant digits
  m = Number(m.toPrecision(PRECISION_DIGITS))

  if (Math.abs(m) >= 10) {
    m /= 10
    e += 1
  }

  return { m, e }
}

export function fromNumber(value: number): BigNum {
  if (value === 0) return ZERO
  return normalize({ m: value, e: 0 })
}

export function big(m: number, e: number): BigNum {
  return normalize({ m, e })
}

/**
 * Converts a BigNum to a native number. 
 * Warning: May return Infinity or 0 if outside double-precision range.
 */
export function toNumber(n: BigNum): number {
  return n.m * 10 ** n.e
}

export function mul(a: BigNum, b: BigNum): BigNum {
  if (a.m === 0 || b.m === 0) return ZERO

  return normalize({
    m: a.m * b.m,
    e: a.e + b.e,
  })
}

export function div(a: BigNum, b: BigNum): BigNum {
  if (b.m === 0) throw new Error("Division by zero")
  if (a.m === 0) return ZERO

  return normalize({
    m: a.m / b.m,
    e: a.e - b.e,
  })
}

export function add(a: BigNum, b: BigNum): BigNum {
  if (a.m === 0) return b
  if (b.m === 0) return a

  const diff = a.e - b.e
  if (diff > ADD_CUTOFF) return a
  if (diff < -ADD_CUTOFF) return b

  // Make a the larger exponent
  let upper = a
  let lower = b
  let absDiff = diff
  if (diff < 0) {
    upper = b
    lower = a
    absDiff = -diff
  }

  return normalize({
    m: upper.m + lower.m * 10 ** -absDiff,
    e: upper.e,
  })
}

export function sub(a: BigNum, b: BigNum): BigNum {
  if (a.m === 0) return { m: -b.m, e: b.e }
  if (b.m === 0) return a

  const diff = a.e - b.e
  if (diff > ADD_CUTOFF) return a
  if (diff < -ADD_CUTOFF) return { m: -b.m, e: b.e }

  return add(a, { m: -b.m, e: b.e })
}

/**
 * Power by normal number. Good for game formulas like x^1.15, x^2, etc.
 */
export function pow(a: BigNum, p: number): BigNum {
  if (a.m === 0) return ZERO
  if (a.m < 0 && !Number.isInteger(p)) {
    throw new Error("Cannot raise negative number to non-integer power")
  }

  const log10Value = Math.log10(Math.abs(a.m)) + a.e
  const resultLog = log10Value * p

  const e = Math.floor(resultLog)
  let m = 10 ** (resultLog - e)

  if (a.m < 0 && Number.isInteger(p) && p % 2 !== 0) {
    m = -m
  }

  return normalize({ m, e })
}

export function compare(a: BigNum, b: BigNum): number {
  if (a.m === 0 && b.m === 0) return 0
  if (a.m >= 0 && b.m < 0) return 1
  if (a.m < 0 && b.m >= 0) return -1

  const sign = a.m < 0 ? -1 : 1

  if (a.e > b.e) return sign
  if (a.e < b.e) return -sign
  if (Math.abs(a.m) > Math.abs(b.m)) return sign
  if (Math.abs(a.m) < Math.abs(b.m)) return -sign
  return 0
}

export function formatScientific(n: BigNum, digits = 15): string {
  if (n.m === 0) return "0"
  return `${n.m.toPrecision(digits)}e${n.e}`
}
