/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import assert from "assert"
import { computed, setPostSignalSetFn, signal } from "../../lib/angular"

describe("signals", () => {
  it("should be a getter which reflects the set value", () => {
    const state = signal(false)
    assert.strictEqual(state(), false)
    state.set(true)
    assert.strictEqual(state(), true)
  })

  it("should be a getter which reflects the set value (for functions)", () => {
    const state = signal(x => x * 2)
    assert.strictEqual(state()(1), 2)
    state.set(x => x + 3)
    assert.strictEqual(state()(1), 4)
  })

  it("should accept update function to set new value based on the previous one", () => {
    const counter = signal(0)
    assert.strictEqual(counter(), 0)
    counter.update(c => c + 1)
    assert.strictEqual(counter(), 1)
  })

  it("should have mutate function for mutable, out of bound updates", () => {
    const state = signal(["a"])
    const derived = computed(() => state().join(":"))

    assert.strictEqual(derived(), "a")
    state.mutate(s => {
      s.push("b")
    })
    assert.strictEqual(derived(), "a:b")
  })

  it("should not update signal when new value is equal to the previous one", () => {
    const state = signal("aaa", { equal: (a, b) => a.length === b.length })
    assert.strictEqual(state(), "aaa")

    // set to a "different" value that is "equal" to the previous one
    // there should be no change in the signal's value as the new value is determined to be equal
    // to the previous one
    state.set("bbb")
    assert.strictEqual(state(), "aaa")

    state.update(_ => "ccc")
    assert.strictEqual(state(), "aaa")

    // setting a "non-equal" value
    state.set("d")
    assert.strictEqual(state(), "d")
  })

  it("should not propagate change when the new signal value is equal to the previous one", () => {
    const state = signal("aaa", { equal: (a, b) => a.length === b.length })
    const upper = computed(() => state().toUpperCase())

    // set to a "different" value that is "equal" to the previous one
    // there should be no change in the signal's value as the new value is determined to be equal
    // to the previous one
    state.set("bbb")
    assert.strictEqual(upper(), "AAA")

    state.update(_ => "ccc")
    assert.strictEqual(upper(), "AAA")

    // setting a "non-equal" value
    state.set("d")
    assert.strictEqual(upper(), "D")
  })

  it("should consider objects as non-equal with the default equality function", () => {
    let stateValue = {}
    const state = signal(stateValue)
    let computeCount = 0
    const derived = computed(() => `${typeof state()}:${++computeCount}`)
    assert.strictEqual(derived(), "object:1")

    // reset signal value to the same object instance, expect change notification
    state.set(stateValue)
    assert.strictEqual(derived(), "object:2")

    // reset signal value to a different object instance, expect change notification
    stateValue = {}
    state.set(stateValue)
    assert.strictEqual(derived(), "object:3")

    // reset signal value to a different object type, expect change notification
    stateValue = []
    state.set(stateValue)
    assert.strictEqual(derived(), "object:4")

    // reset signal value to the same array instance, expect change notification
    state.set(stateValue)
    assert.strictEqual(derived(), "object:5")
  })

  it("should allow converting writable signals to their readonly counterpart", () => {
    const counter = signal(0)
    const readOnlyCounter = counter.asReadonly()

    // @ts-expect-error
    assert.strictEqual(readOnlyCounter.set, undefined)
    // @ts-expect-error
    assert.strictEqual(readOnlyCounter.update, undefined)
    // @ts-expect-error
    assert.strictEqual(readOnlyCounter.mutate, undefined)

    const double = computed(() => readOnlyCounter() * 2)
    assert.strictEqual(double(), 0)

    counter.set(2)
    assert.strictEqual(double(), 4)
  })

  describe("post-signal-set functions", () => {
    let prevPostSignalSetFn = null
    let log
    beforeEach(() => {
      log = 0
      prevPostSignalSetFn = setPostSignalSetFn(() => log++)
    })

    afterEach(() => {
      setPostSignalSetFn(prevPostSignalSetFn)
    })

    it("should call the post-signal-set fn when invoking .set()", () => {
      const counter = signal(0)
      counter.set(1)
      assert.strictEqual(log, 1)
    })

    it("should call the post-signal-set fn when invoking .update()", () => {
      const counter = signal(0)
      counter.update(c => c + 2)
      assert.strictEqual(log, 1)
    })

    it("should call the post-signal-set fn when invoking .mutate()", () => {
      const counter = signal(0)
      counter.mutate(() => {})
      assert.strictEqual(log, 1)
    })

    it("should not call the post-signal-set fn when the value doesn't change", () => {
      const counter = signal(0)
      counter.set(0)
      assert.strictEqual(log, 0)
    })
  })
})
