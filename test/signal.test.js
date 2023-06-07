import assert from 'assert'
import * as R from 'ramda'
import { Signal, link, effect } from '../lib/signal'
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

  // Check preconditions on linked signals.

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

  it('link :: (* -> b) -> [Signal] -> Signal b [sequential]', function () {
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

  it('set :: Signal a -> a -> Unit [diamond, unbounded]', function () {
    const a = Signal.of()
    const d = add(addN(2, a), addN(3, a))

    let calls = 0
    effect(() => (calls += 1), d)
    a(1); assert.strictEqual(d(), 7)

    assert.strictEqual(calls, 1)
  })

  it.skip('set :: Signal a -> a -> Unit [diamond, bounded]', function () {
    const a = Signal.of(0)
    const d = add(addN(2, a), addN(3, a))

    let calls = 0
    effect(() => (calls += 1), d)
    a(1); assert.strictEqual(d(), 7)

    // FIXME: `d` should be called twice.
    assert.strictEqual(calls, 3)
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

  // TODO: needs support for 'deferred update'
  it.skip('chain :: Signal s => s a ~> (a -> s b) -> s b [synchronous]', async function () {
    const expected = [40, 41, 42]
    const main = Signal.of()
    const output = main.chain(() => R.tap(s => expected.forEach(s), Signal.of()))

    const actual = []
    effect(x => actual.push(x), output)
    main('go!'); assert.deepStrictEqual(actual, expected)
  })
})

describe('Signal (flyd legacy test cases)', function () {
  it('[a707e821]', function () {
    const s = Signal.of(12)
    assert.strictEqual(s(), 12)
  })

  it('[ef08ddd4]', function () {
    const s = Signal.of()
    s(23); assert.strictEqual(s(), 23)
    s(3); assert.strictEqual(s(), 3)
  })

  it.skip('[b6544c81] - unsupported')
  it.skip('[a3b05330] - unsupported')
  it.skip('[069dc867] - unsupported')
  it.skip('[d7ab0d5e] - noop')
  it.skip('[d6b98643] - unsupported')
  it.skip('[c43f5584] - unsupported')

  it('[dcaeb6c1]', function () {
    const x = Signal.of(3)
    const x2 = link(x => x() * 2, [x])
    assert.strictEqual(x2(), x() * 2)
  })

  it('[1da393a7]', function () {
    const x = Signal.of(3)
    const y = Signal.of(4)
    const sum = link((x, y) => x() + y(), [x, y])
    assert.strictEqual(sum(), x() + y())
  })

  it('[24116cd6]', function () {
    const x = Signal.of(3)
    const y = Signal.of(4)
    const sum = link((x, y) => x() + y(), [x, y])
    assert.equal(sum(), 7)
    x(12); assert.equal(sum(), 16)
    y(8); assert.equal(sum(), 20)
  })

  it('[92c9580c]', function () {
    const x = Signal.of(3)
    const y = Signal.of(4)
    let times = 0

    const sum = link((x, y) => x() + y(), [x, y])
    link(() => times++, [sum])

    assert.equal(sum(), 7)
    x(12); assert.strictEqual(sum(), 16)
    y(8); assert.strictEqual(sum(), 20)
    assert.strictEqual(times, 3)
  })

  it('[4aa4227b]', function () {
    const x = Signal.of()
    const y = Signal.of()
    let called = 0

    link((x, y) => { called++; return x() + y() }, [x, y])
    x(2); x(1); y(2); y(4); x(2)
    assert.strictEqual(called, 3)
  })

  it('[ee93ce4a]', function () {
    const x = Signal.of(3)
    const y = Signal.of(4)
    const a = link((x, y) => x() + y(), [x, y])
    const b = link(a => a() * 2, [a])
    const c = link((a, b) => a() + b(), [a, b])
    x(12); assert.strictEqual(c(), 48) // (12 + 4) * 2 + (12 + 4)
    y(3); assert.strictEqual(c(), 45) // (12 + 3) * 2 + (12 + 3)
    x(2); assert.strictEqual(c(), 15) // (2 + 3) * 2 + (2 + 3)
  })

  it.skip('[12484e5d] - unsupported')
  it.skip('[0031cdd6] - unsupported')

  it('[ee41cbdc]', function () {
    const x = Signal.of(4)
    const y = Signal.of(3)
    const z = Signal.of(1)
    const a = link(x => x() * 2, [x])
    const b = link((y, z) => { x(3); return z() + y() }, [y, z])
    z(4)

    assert.strictEqual(b(), 7)
    assert.strictEqual(a(), 6)
  })

  it.skip('[81b8e664] - stack overflow', function () {
    const order = []
    const x = Signal.of(4)
    const y = Signal.of(3)

    link(x => {
      if (x() === 3) order.push(2)
      return x() * 2
    }, [x])

    link(y => {
      y(3)
      order.push(1)
      return y()
    }, [y])

    assert.deepStrictEqual(order, [1, 2])
  })

  it.skip('[492bb659] - unexpected order', function () {
    const order = []
    const x = Signal.of(4)
    const y = Signal.of(3)

    link(x => {
      if (x() === 3) order.push(2)
      return x() * 2
    }, [x])

    link(y => {
      x(3)
      order.push(1)
      return y()
    }, [y])

    assert.deepStrictEqual(order, [1, 2])
  })

  it('[31ca0059]', function () {
    const result = []
    const a = Signal.of(0)

    const filter = link(a => {
      if (a() > 5) return a()
    }, [a])

    link(x => result.push(x()), [filter])
    ;[4, 6, 2, 8, 3, 4].forEach(a)
    assert.deepStrictEqual(result, [6, 8])
  })

  it('[60e2d35c]', function () {
    const result = []
    const a = Signal.of()
    const b = Signal.of()

    link(b => {
      a(b())
      a()
      a(b() + 1)
      assert.equal(a(), 2)
    }, [b])

    link(a => {
      result.push(a())
    }, [a])

    b(1)
    assert.deepStrictEqual(result, [1, 2])
  })

  it.skip('[aa44928e] - unsupported')

  it('[c8a33f00]', function () {
    let result
    link(() => link(v => (result = v() + 100), [Signal.of(1)]), [Signal.of(null)])
    assert.strictEqual(result, 101)
  })

  it('[f3588f8c]', function () {
    let result
    link(() => {
      const n = Signal.of()
      link(v => (result = v() + 100), [n])
      n(1)
    }, [Signal.of(null)])
    assert.strictEqual(result, 101)
  })

  it.skip('[0bb660b5] - unsupported')

  it('[0685637d]', function () {
    let result = 0
    const external = Signal.of(0)
    const mapper = val => { ++result; return val + 1 }

    link(() => {
      external
        .map(mapper)
        .map(mapper)
    }, [Signal.of(1)])

    assert.strictEqual(result, 2)
  })

  it('[0680810f]', function () {
    let result = ''
    const external = Signal.of(0)
    const stream = Signal.of(1)
    const mapper = val => { result += '' + val; return val + 1 }

    link(() => {
      external
        .map(mapper)
        .map(mapper)
    }, [stream])

    stream(1); assert.equal(result, '0101')
  })

  it.skip('[99058bf1] - unsupported')
  it.skip('[1c76483b] - unsupported')
  it.skip('[a8cb6202] - unsupported')
  it.skip('[cef45e5d] - unsupported')
  it.skip('[b2fb629a] - unsupported')
  it.skip('[aae44909] - unsupported')
  it.skip('[182d7163] - unsupported')
  it.skip('[9a15c9c0] - unsupported')
  it.skip('[f69b5df7] - unsupported')
  it.skip('[0906cc89] - unsupported')

  it('[9dd557e5]', function () {
    const s = Signal.of()
    const result = []
    effect(x => result.push(x), s)
    ;[1, 2].forEach(s)
    assert.deepStrictEqual(result, [1, 2])
  })

  it('[aadc1de4]', function () {
    const x = Signal.of(3)
    const y = x.map(x => 2 * x)
    assert.strictEqual(y(), 6)
    x(1); assert.strictEqual(y(), 2)
  })

  it.skip('[1a633b22] - duplicate')
  it.skip('[94152183] - unsupported')

  it('[981b4177]', function () {
    const x = Signal.of(3)
    const double = R.map(x => 2 * x)
    const quadruple = double(double(x))
    assert.equal(quadruple(), 12)
    x(2); assert.equal(quadruple(), 8)
  })

  it('[4053cb2c]', function () {
    const x = Signal.of(3)
    const y = x.map(R.identity)
    assert.strictEqual(y(), x())
    x('foo'); assert.equal(y(), x())
  })

  it('[12557094]', function () {
    const f = x => x * 2
    const g = x => x + 4
    const a = Signal.of(3)
    const b = a.map(g).map(f)
    const c = a.map(x => f(g(x)))
    assert.strictEqual(b(), c())
    a(12); assert.strictEqual(b(), c())
  })

  it('[9e6f086c]', function () {
    const result = []
    const f = v => { result.push(v); return Signal.of() }
    const s = Signal.of()
    s.chain(f)
    ;[1, 2, 3, 4, 5].forEach(s)
    assert.deepStrictEqual(result, [1, 2, 3, 4, 5])
  })

  // TODO: needs some serious work
  it.skip('[06e71bfc]', function () {
    const actual = []

    // (1) evaluating body of chain operation (2)
    const f = v => {
      const s = Signal.of()
      ;[1, 2, 3].map(i => v + i).forEach(s)
      return s
    }

    const s = Signal.of()
    effect(v => actual.push(v), s.chain(f))
    ;[1, 3, 5].forEach(s)
    const expected = [2, 3, 4, 4, 5, 6, 6, 7, 8]
    assert.deepStrictEqual(actual, expected)
  })
})
