/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import assert from "assert"
import { computed, signal, Watch } from "../../lib/angular"

describe("computed", () => {
  it("should create computed", () => {
    const counter = signal(0)

    let computedRunCount = 0
    const double = computed(() => `${counter() * 2}:${++computedRunCount}`)

    assert.strictEqual(double(), "0:1")

    counter.set(1)
    assert.strictEqual(double(), "2:2")
    assert.strictEqual(double(), "2:2")

    counter.set(2)
    assert.strictEqual(double(), "4:3")
    assert.strictEqual(double(), "4:3")
  })

  it("should not re-compute if there are no dependencies", () => {
    let tick = 0
    const c = computed(() => ++tick)

    assert.strictEqual(c(), 1)
    assert.strictEqual(c(), 1)
  })

  it("should not re-compute if the dependency is a primitive value and the value did not change", () => {
    const counter = signal(0)

    let computedRunCount = 0
    const double = computed(() => `${counter() * 2}:${++computedRunCount}`)

    assert.strictEqual(double(), "0:1")

    counter.set(0)
    assert.strictEqual(double(), "0:1")
  })

  it("should chain computed", () => {
    const name = signal("abc")
    const reverse = computed(() =>
      name()
        .split("")
        .reverse()
        .join("")
    )
    const upper = computed(() => reverse().toUpperCase())

    assert.strictEqual(upper(), "CBA")

    name.set("foo")
    assert.strictEqual(upper(), "OOF")
  })

  it("should evaluate computed only when subscribing", () => {
    const name = signal("John")
    const show = signal(true)

    let computeCount = 0
    const displayName = computed(
      () => `${show() ? name() : "anonymous"}:${++computeCount}`
    )

    assert.strictEqual(displayName(), "John:1")

    show.set(false)
    assert.strictEqual(displayName(), "anonymous:2")

    name.set("Bob")
    assert.strictEqual(displayName(), "anonymous:2")
  })

  it("should detect simple dependency cycles", () => {
    const a = computed(() => a())

    try {
      a()
    } catch (err) {
      assert.strictEqual(err.message, "Detected cycle in computations.")
    }
  })

  it("should detect deep dependency cycles", () => {
    const a = computed(() => b())
    const b = computed(() => c())
    const c = computed(() => d())
    const d = computed(() => a())

    try {
      a()
    } catch (err) {
      assert.strictEqual(err.message, "Detected cycle in computations.")
    }
  })

  it("should cache exceptions thrown until computed gets dirty again", () => {
    const toggle = signal("KO")
    const c = computed(() => {
      const val = toggle()
      if (val === "KO") {
        throw new Error("KO")
      } else {
        return val
      }
    })

    try {
      c()
    } catch (err) {
      assert.strictEqual(err.message, "KO")
    }

    try {
      c()
    } catch (err) {
      assert.strictEqual(err.message, "KO")
    }

    toggle.set("OK")
    assert.strictEqual(c(), "OK")
  })

  it("should not update dependencies of computations when dependencies don't change", () => {
    const source = signal(0)
    const isEven = computed(() => source() % 2 === 0)
    let updateCounter = 0
    const updateTracker = computed(() => {
      isEven()
      return updateCounter++
    })

    updateTracker()
    assert.strictEqual(updateCounter, 1)

    source.set(1)
    updateTracker()
    assert.strictEqual(updateCounter, 2)

    // Setting the counter to another odd value should not trigger `updateTracker` to update.
    source.set(3)
    updateTracker()
    assert.strictEqual(updateCounter, 2)

    source.set(4)
    updateTracker()
    assert.strictEqual(updateCounter, 3)
  })

  it("should not mark dirty computed signals that are dirty already", () => {
    const source = signal("a")
    const derived = computed(() => source().toUpperCase())

    let watchCount = 0
    const watch = new Watch(
      () => {
        derived()
      },
      () => {
        watchCount++
      },
      false
    )

    watch.run()
    assert.strictEqual(watchCount, 0)

    // change signal, mark downstream dependencies dirty
    source.set("b")
    assert.strictEqual(watchCount, 1)

    // change signal again, downstream dependencies should be dirty already and not marked again
    source.set("c")
    assert.strictEqual(watchCount, 1)

    // resetting dependencies back to clean
    watch.run()
    assert.strictEqual(watchCount, 1)

    // expecting another notification at this point
    source.set("d")
    assert.strictEqual(watchCount, 2)
  })

  it("should disallow writing to signals within computeds", () => {
    const source = signal(0)
    const illegal = computed(() => {
      source.set(1)
      return 0
    })

    try {
      illegal()
      assert.fail()
    } catch (expected) {}
  })
})
