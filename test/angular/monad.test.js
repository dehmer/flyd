import assert from 'assert'
import * as R from 'ramda'
import { computed, signal, untracked, effect } from '../../lib/angular'

describe.only('angular signal monad', function () {
  const Signal = v => {
    v.map = fn => computed(() => fn(v()))
    v.filter = fn => {
      effect(() => console.log('v', v()))
      return computed(() => v())
    }
    v.ap = s => computed(() => s()(v()))

    v['fantasy-land/map'] = v.map
    v['fantasy-land/filter'] = v.filter
    v['fantasy-land/ap'] = v.ap

    return v
  }

  Signal.of = v => Signal(signal(v))

  it('of :: a -> Signal a', function () {
    assert.strictEqual(Signal.of()(), undefined)
    assert.strictEqual(Signal.of(4)(), 4)
    const fn = x => x * 2
    assert.strictEqual(Signal.of(fn)(), fn)
  })

  it('map :: Signal s => s a ~> (a -> b) -> s b', function () {
    const a = Signal.of(1)
    const b = R.map(x => x * 2, a)
    assert.strictEqual(b(), 2)
    a.set(2); assert.strictEqual(b(), 4)
  })

  it('filter :: Signal s => s a ~> (a -> Boolean) -> s a', function () {
    const a = Signal.of(2)
    const b = R.filter(x => x % 2 === 0, a)
    assert.strictEqual(b(), 2)
    a.set(3); assert.strictEqual(b(), 2)
    // a(4); assert.strictEqual(b(), 4)
  })


  it('ap :: Signal s => s a ~> s (a -> b) -> s b', function () {
    const a = Signal.of(1)
    const fn = Signal.of(x => x + 1)
    const b = R.ap(fn, a)
    assert.strictEqual(b(), 2)
    fn.set(x => x * 3); assert.strictEqual(b(), 3)
    a.set(2); assert.strictEqual(b(), 6)
  })
})
