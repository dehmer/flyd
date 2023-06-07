/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import assert from "assert"
import { computed, signal, untracked } from "../../lib/angular"
import { flushEffects, resetEffects, testingEffect } from "./effect_util"

describe("non-reactive reads", () => {
  afterEach(() => {
    resetEffects()
  })

  it("should read the latest value from signal", () => {
    const counter = signal(0)

    assert.strictEqual(untracked(counter), 0)

    counter.set(1)
    assert.strictEqual(untracked(counter), 1)
  })

  it("should not add dependencies to computed when reading a value from a signal", () => {
    const counter = signal(0)
    const double = computed(() => untracked(counter) * 2)

    assert.strictEqual(double(), 0)

    counter.set(2)
    assert.strictEqual(double(), 0)
  })

  it("should refresh computed value if stale and read non-reactively ", () => {
    const counter = signal(0)
    const double = computed(() => counter() * 2)

    assert.strictEqual(untracked(double), 0)

    counter.set(2)
    assert.strictEqual(untracked(double), 4)
  })

  it("should not make surrounding effect depend on the signal", () => {
    const s = signal(1)

    const runLog = []
    testingEffect(() => {
      runLog.push(untracked(s))
    })

    // an effect will run at least once
    flushEffects()
    assert.deepStrictEqual(runLog, [1])

    // subsequent signal changes should not trigger effects as signal is untracked
    s.set(2)
    flushEffects()
    assert.deepStrictEqual(runLog, [1])
  })

  it("should schedule on dependencies (computed) change", () => {
    const count = signal(0)
    const double = computed(() => count() * 2)

    let runLog = []
    testingEffect(() => {
      runLog.push(double())
    })

    flushEffects()
    assert.deepStrictEqual(runLog, [0])

    count.set(1)
    flushEffects()
    assert.deepStrictEqual(runLog, [0, 2])
  })

  it("should non-reactively read all signals accessed inside untrack", () => {
    const first = signal("John")
    const last = signal("Doe")

    let runLog = []
    const effectRef = testingEffect(() => {
      untracked(() => runLog.push(`${first()} ${last()}`))
    })

    // effects run at least once
    flushEffects()
    assert.deepStrictEqual(runLog, ["John Doe"])

    // change one of the signals - should not update as not read reactively
    first.set("Patricia")
    flushEffects()
    assert.deepStrictEqual(runLog, ["John Doe"])

    // change one of the signals - should not update as not read reactively
    last.set("Garcia")
    flushEffects()
    assert.deepStrictEqual(runLog, ["John Doe"])
  })
})
