import assert from 'assert'
import { Signal, link, isDefined, isSignal } from '../lib/signal'
// import { Signal, link, effect, isDefined, isSignal } from '../lib/compat'
import { describe, it } from 'mocha'

const hasValue = (x, v) =>
  isSignal(x) && isDefined(x) && x() === v

const diamond = (fn, input) => link(fn, [
  link(a => a + 1, [input]),
  link(a => a + 2, [input])
])

const expectError = (fn, message) => {
  try {
    fn()
    assert.fai()
  } catch (err) {
    assert.strictEqual(err.message, message)
  }
}

describe('Interface Specification', function () {
  ;[
    ['null', null],
    ['number', 0, 42],
    ['string', '', 'x'],
    ['boolean', false, true],
    ['function', () => {}, x => x],
    ['object', {}, { key: 'value ' }]
  ].forEach(([type, ...values]) => {
    // Create signal from value other than undefined.
    it(`of :: Signal s, v ${type} => v -> s v`, function () {
      values.forEach(value => {
        assert(hasValue(Signal.of(value), value))
      })
    })
  })

  it('of :: Signal s, v undefined => v -> s v', function () {
    // Value of undefined signal is `undefined`.
    const s = Signal.of(undefined)
    assert(!isDefined(s))
    assert.strictEqual(s(), undefined)
  })

  ;[
    ['null', null],
    ['number', 0],
    ['string', 'x'],
    ['boolean', true],
    ['function', x => x],
    ['object', { key: 'value ' }]
  ].forEach(([label, v]) => {
    // Updating signal with undefined is a no-op.
    it(`set :: Signal s => ${label} -> undefined -> s ${label}`, function () {
      const s = Signal.of(v)
      s(undefined)
      assert.strictEqual(s(), v)
    })
  })

  ;[
    [undefined, null],
    [undefined, 1],
    [null, 1],
    [1, null],
    [1, 2]
  ].forEach(([a, b]) => {
    it(`set :: Signal s => ${a} -> ${b} -> s ${b}`, function () {
      const s = Signal.of(a)
      s(b)
      assert.strictEqual(s(), b)
    })
  })

  describe('[TypeError] link :: Signal s => (...[s any] -> b) -> [s any]', function () {
    [
      [undefined, undefined, '"fn" is undefined'],
      [x => x, undefined, '"inputs" is undefined'],
      [x => x, 'x', '"inputs" is not an array'],
      [x => x, [], '"inputs" is empty array'],
      [x => x, ['x'], '"inputs" contains non-signal value'],
      [x => x, [null], '"inputs" contains null or undefined value'],
      [x => x, [undefined], '"inputs" contains null or undefined value']
    ].forEach(([fn, inputs, message]) => {
      it(`TypeError: ${message}`, function () {
        expectError(() => link(fn, inputs), message)
      })
    })
  })

  describe('link :: Signal s => (...[any] -> b) -> [s any]', function () {
    [
      ['1-ary', [undefined], 0],
      ['1-ary', [1], 1],
      ['2-ary', [undefined, undefined], 0],
      ['2-ary', [1, undefined], 0],
      ['2-ary', [1, 2], 1]
    ].forEach(([label, values, expected]) => {
      // Check production is only evaluated when all inputs are defined.
      it(`Evaluation count/of (${label}) (${values.map(x => x === undefined ? 'undefined' : x)})`, function () {
        const inputs = values.map(Signal.of)
        let actual = 0 // evaluation count
        link(() => (actual += 1), inputs)
        assert.strictEqual(actual, expected)
      })
    })

    ;[
      ['1-ary', [undefined], [0], 1],
      ['1-ary', [1], [1], 1],
      ['1-ary', [1], [2], 2],
      ['2-ary', [undefined, undefined], [1, undefined], 0],
      ['2-ary', [undefined, undefined], [1, 2], 1],
      ['2-ary', [1, 2], [1, 2], 1],
      ['2-ary', [1, 2], [1, 3], 2],
      ['2-ary', [1, 2], [2, 3], 3] // TODO: do we need batching for updates?
    ].forEach(([label, initial, next, expected]) => {
      // Check production is only evaluated when at least on input changed.
      const format = x => x === undefined ? 'undefined' : x
      it(`Evaluation count/set (${label}) (${initial.map(format)}) <- (${next.map(format)})`, function () {
        const inputs = initial.map(Signal.of) // 1
        let actual = 0 // evaluation count (including initial)
        link(() => (actual += 1), inputs) // 2
        next.forEach((value, i) => inputs[i](value))
        assert.strictEqual(actual, expected)
      })
    })

    ;[
      [undefined, 1],
      [1, 2]
    ].forEach(([initial, expected]) => {
      it(`Evaluation count/set [diamond] (${initial})`, function () {
        let actual = 0 // evaluation count (including initial)
        const inc = () => (actual += 1)
        const input = Signal.of(initial)
        diamond(inc, input)
        input(2); assert.strictEqual(actual, expected)
      })
    })

    ;[
      ['1-ary', [1], a => a + 1, 2],
      ['1-ary', ['lower'], a => a.toUpperCase(), 'LOWER'],
      ['2-ary', [1, 2], (a, b) => a + b, 3]
    ].forEach(([label, initial, fn, expected]) => {
      it(`Evaluation value/of (${label}) (${initial})`, function () {
        const inputs = initial.map(Signal.of)
        const output = link(fn, inputs)
        assert.strictEqual(output(), expected)
      })
    })

    it('Evaluation value/of [diamond]', function () {
      const input = Signal.of(2)
      const output = diamond((a, b) => a + b, input)
      assert.strictEqual(output(), 7)
    })

    ;[
      ['1-ary', [1], [2], a => a + 1, 3],
      ['1-ary', ['lower'], ['upper'], a => a.toUpperCase(), 'UPPER'],
      ['2-ary', [1, 2], [3, 4], (a, b) => a + b, 7]
    ].forEach(([label, initial, next, fn, expected]) => {
      it(`Evaluation value/set (${label}) (${initial})`, function () {
        const inputs = initial.map(Signal.of)
        const output = link(fn, inputs)
        next.forEach((value, i) => inputs[i](value))
        assert.strictEqual(output(), expected)
      })
    })

    it('Evaluation value/set [diamond]', function () {
      const input = Signal.of(1)
      const output = diamond((a, b) => a + b, input)
      input(2); assert.strictEqual(output(), 7)
    })

    it('evaluation order = definition order', function () {
      const actual = []
      const push = label => x => actual.push(`${label}:${x}`)
      const input = Signal.of(1)
      link(push('A'), [input])
      link(push('B'), [input])
      link(push('C'), [input])

      input(2)
      const expected = [
        'A:1', 'B:1', 'C:1',
        'A:2', 'B:2', 'C:2'
      ]

      assert.deepStrictEqual(actual, expected)
    })
  })

  describe('nested signal', function () {
    // TODO: relevant?
    it('evaluation order', function () {
      const actual = []
      const push = label => x => actual.push(`${label}:${x}`)
      const input = Signal.of(1)
      link(push('A'), [input])
      const output = link(a => {
        push('B')(a)
        const inner = Signal.of(a + 1)
        link(push('D'), [inner])
        inner(a + 2)
        push('C')(a)
        return inner()
      }, [input])

      link(push('E'), [input])
      const expected = ['A:1', 'B:1', 'D:2', 'D:3', 'C:1', 'E:1']
      assert.deepStrictEqual(actual, expected)
      assert.strictEqual(output(), 3)
    })

    it('atomic update: plain signal', function () {
      const input = Signal.of(1)
      const output = link(x => Signal.of(x)(), [input])

      assert.strictEqual(input(), 1, 'input: unexpected value')
      assert.strictEqual(output(), 1, 'output: unexpected value')
    })

    it('atomic update: linked signal', function () {
      const input = Signal.of(1)
      const output = link(x => link(a => a + 1, [Signal.of(x)])(), [input])
      assert.strictEqual(output(), 2)
    })
  })
})
