import test from 'node:test';
import assert from 'node:assert';
import {
  toFiniteNumber,
  formatNumber,
  formatInteger,
  formatPercent,
  formatTimestamp
} from './format.js';

test('toFiniteNumber', async (t) => {
  await t.test('returns the number if finite', () => {
    assert.strictEqual(toFiniteNumber(123), 123);
    assert.strictEqual(toFiniteNumber(0), 0);
    assert.strictEqual(toFiniteNumber(-1.5), -1.5);
  });

  await t.test('parses string numbers', () => {
    assert.strictEqual(toFiniteNumber('123'), 123);
    assert.strictEqual(toFiniteNumber('3.14'), 3.14);
  });

  await t.test('returns fallback for Infinity', () => {
    assert.strictEqual(toFiniteNumber(Infinity), 0);
    assert.strictEqual(toFiniteNumber(-Infinity, -1), -1);
  });

  await t.test('returns fallback for NaN', () => {
    assert.strictEqual(toFiniteNumber(NaN), 0);
    assert.strictEqual(toFiniteNumber('abc', 5), 5);
  });

  await t.test('handles null and undefined', () => {
    assert.strictEqual(toFiniteNumber(null), 0); // Number(null) is 0
    assert.strictEqual(toFiniteNumber(undefined, 7), 7);
  });
});

test('formatNumber', () => {
  assert.strictEqual(formatNumber(123), '123');
  assert.strictEqual(formatNumber(1234), '1.234K');
  assert.strictEqual(formatNumber(1000000), '1M');
  assert.strictEqual(formatNumber(-1234), '-1.234K');
  assert.strictEqual(formatNumber(NaN, 10), '10');
});

test('formatInteger', () => {
  assert.strictEqual(formatInteger(123.45), '123');
  assert.strictEqual(formatInteger('456.9'), '456');
  assert.strictEqual(formatInteger(NaN, 99), '99');
});

test('formatPercent', () => {
  assert.strictEqual(formatPercent(12.3456), '12.35%');
  assert.strictEqual(formatPercent(12.3456, 1), '12.3%');
  assert.strictEqual(formatPercent(NaN, 2, 5), '5.00%');
});

test('formatTimestamp', () => {
  assert.strictEqual(formatTimestamp(0), 'Never');
  assert.strictEqual(formatTimestamp(-1), 'Never');
  // We can't easily test the exact string of toLocaleString() as it depends on environment,
  // but we can check if it returns something other than the emptyText for positive values.
  const ts = 1600000000000;
  const result = formatTimestamp(ts);
  assert.notStrictEqual(result, 'Never');
  assert.notStrictEqual(result, 'Unknown');
});
