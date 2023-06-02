import assert from 'assert'
import * as R from 'ramda'
import { Signal, link } from '../lib/signal'
import { describe, it } from 'mocha'

const add = (...input) => link((a, b) => a() + b(), input)
const addN = (n, input) => link(a => a() + n, [input])
const double = input => link(x => x() * 2, [input])

const assertError = (fn, message) => {
  try {
    fn()
  } catch (err) {
    assert.strictEqual(err.message, message)
  }
}

describe('Signal', function () {
  it('of :: a -> Signal a [unbounded]', function () {
    const s = Signal.of()
    assert.strictEqual(s(), undefined)
  })

  it('of :: a -> Signal a [bound]', function () {
    const expected = 42
    const s = Signal.of(expected)
    assert.strictEqual(s(), expected)
  })

  it('of :: undefined -> Signal a', function () {
    const expected = undefined
    const s = Signal.of(expected)
    assert.strictEqual(s(), expected)
  })

  it.skip('of :: a -> Signal a [recursive, bound]', function () {
    const result = []
    const inner = () => link(x => result.push(x() + 1), [Signal.of(1)])
    link(inner, [Signal.of(null)])
    assert.deepStrictEqual(result, [2])
  })

  it.skip('of :: a -> Signal a [recursive, unbounded]', function () {
    const result = []
    const inner = () => {
      const s = Signal.of()
      link(x => result.push(x() + 1), [s])
      s(1)
      return s
    }
    link(inner, [Signal.of(null)])
    assert.deepStrictEqual(result, [2])
  })

  // Check preconditions on linked streams.

  ;[
    [undefined, undefined, '"fn" is undefined'],
    [x => x, undefined, '"inputs" is undefined'],
    [x => x, 'x', '"inputs" is not an array'],
    [x => x, [], '"inputs" is empty'],
    [x => x, ['x'], '"inputs" contains non-signal value']
  ].forEach(([fn, inputs, message]) => {
    it(`link :: (* -> b) -> [Signal] -> Signal b [${message}]`, function () {
      assertError(() => link(fn, inputs), message)
    })
  })

  // Check initial behavior of linked signal.

  it('link :: (* -> b) -> [Signal] -> Signal b [unbounded 1/1]', function () {
    const s = Signal.of()
    const double = link(x => x() * 2, [s])
    assert.strictEqual(double(), undefined)
  })

  it('link :: (* -> b) -> [Signal] -> Signal b [unbounded 2/2]', function () {
    const a = Signal.of()
    const b = Signal.of()
    const c = add(a, b)
    assert.strictEqual(c(), undefined)
  })

  it('link :: (* -> b) -> [Signal] -> Signal b [unbounded 1/2]', function () {
    const a = Signal.of(1)
    const b = Signal.of()
    const c = add(a, b)
    assert.strictEqual(c(), undefined)
  })

  it('link :: (* -> b) -> [Signal] -> Signal b [bound 1/1]', function () {
    const a = Signal.of(21)
    const b = double(a)
    assert.strictEqual(b(), a() * 2)
  })

  it('link :: (* -> b) -> [Signal] -> Signal b [bound 2/2]', function () {
    const a = Signal.of(1)
    const b = Signal.of(2)
    const c = add(a, b)
    assert.strictEqual(c(), a() + b())
  })

  it('link :: (* -> b) -> [Signal] -> Signal b [single path]', function () {
    const a = Signal.of(1)
    const b = double(a)
    const c = double(b)
    const d = double(c)
    assert.strictEqual(d(), a() * 8)
  })

  // Check update behavior of (simple) streams.

  it('set :: Signal a -> a -> Unit [unbounded 1/1]', function () {
    const s = Signal.of()
    const expected = 42
    s(expected)
    assert.strictEqual(s(), expected)
  })

  it('set :: Signal a -> a -> Unit [bound 1/1]', function () {
    const s = Signal.of(12)
    const expected = 42
    s(expected)
    assert.strictEqual(s(), expected)
  })

  it('set :: Signal a -> undefined -> Unit [unbounded 1/1]', function () {
    const s = Signal.of()
    const expected = undefined
    s(expected)
    assert.strictEqual(s(), expected)
  })

  it('set :: Signal a -> undefined -> Unit [bound 1/1]', function () {
    const expected = 42
    const s = Signal.of(expected)
    s(undefined) // should NOT change signal value
    assert.strictEqual(s(), expected)
  })

  it('set :: Signal a -> a -> Unit [unbounded 2/2]', function () {
    const a = Signal.of()
    const b = Signal.of()
    const c = add(a, b)
    a(1); b(2); assert.strictEqual(c(), 3)
  })

  it('set :: Signal a -> a -> Unit [bound 1/2]', function () {
    const a = Signal.of(1)
    const b = Signal.of()
    const c = add(a, b)
    b(2); assert.strictEqual(c(), 3)
  })

  it('set :: Signal a -> a -> Unit [bound 2/2]', function () {
    const a = Signal.of(1)
    const b = Signal.of(2)
    const c = add(a, b)
    a(3); assert.strictEqual(c(), 5)
    b(4); assert.strictEqual(c(), 7)
  })

  it('set :: Signal a -> a -> Unit [single path]', function () {
    const a = Signal.of()
    const b = double(a)
    const c = double(b)
    const d = double(c)
    a(1); assert.strictEqual(d(), a() * 8)
  })

  it('set :: Signal a -> a -> Unit [diamond]', function () {
    const a = Signal.of()
    const d = add(addN(2, a), addN(3, a))
    a(1); assert.strictEqual(d(), 7)
  })
})

describe('Signal (higher-level API)', function () {
  it('map :: Signal s => s a ~> (a -> b) -> s b', function () {
    const a = Signal.of()
    const b = R.map(x => x * 2, a)
    assert.strictEqual(b(), undefined)
    a(1); assert.strictEqual(b(), 2)
    a(2); assert.strictEqual(b(), 4)
  })

  it('filter :: Signal s => s a ~> (a -> Boolean) -> s a', function () {
    const a = Signal.of()
    const b = R.filter(x => x % 2 === 0, a)
    assert.strictEqual(b(), undefined)
    a(2); assert.strictEqual(b(), 2)
    a(3); assert.strictEqual(b(), 2)
    a(4); assert.strictEqual(b(), 4)
  })

  it('ap :: Signal s => s a ~> s (a -> b) -> s b', function () {
    const a = Signal.of()
    const fn = Signal.of(x => x + 1)
    const b = R.ap(fn, a)
    assert.strictEqual(b(), undefined)
    a(1); assert.strictEqual(b(), 2)
    fn(x => x * 3); assert.strictEqual(b(), 3)
    a(2); assert.strictEqual(b(), 6)
  })
})
