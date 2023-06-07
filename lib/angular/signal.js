/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { createSignalFromFunction, defaultEquals } from './api'
import { throwInvalidWriteToSignalError } from './errors'
import { ReactiveNode } from './graph'

/**
 * If set, called after `WritableSignal`s are updated.
 *
 * This hook can be used to achieve various effects, such as running effects synchronously as part
 * of setting a signal.
 */
let postSignalSetFn = null

class WritableSignalImpl extends ReactiveNode {
  consumerAllowSignalWrites = false

  constructor (value, equal) {
    super()
    this.value = value
    this.equal = equal
  }

  onConsumerDependencyMayHaveChanged () {
    // This never happens for writable signals as they're not consumers.
  }

  onProducerUpdateValueVersion () {
    // Writable signal value versions are always up to date.
  }

  /**
   * Directly update the value of the signal to a new value, which may or may not be
   * equal to the previous.
   *
   * In the event that `newValue` is semantically equal to the current value, `set` is
   * a no-op.
   */
  set (newValue) {
    if (!this.producerUpdatesAllowed) {
      throwInvalidWriteToSignalError()
    }
    if (!this.equal(this.value, newValue)) {
      this.value = newValue
      this.valueVersion++
      this.producerMayHaveChanged()

      postSignalSetFn?.()
    }
  }

  /**
   * Derive a new value for the signal from its current value using the `updater` function.
   *
   * This is equivalent to calling `set` on the result of running `updater` on the current
   * value.
   */
  update (updater) {
    if (!this.producerUpdatesAllowed) {
      throwInvalidWriteToSignalError()
    }
    this.set(updater(this.value))
  }

  /**
   * Calls `mutator` on the current value and assumes that it has been mutated.
   */
  mutate (mutator) {
    if (!this.producerUpdatesAllowed) {
      throwInvalidWriteToSignalError()
    }
    // Mutate bypasses equality checks as it's by definition changing the value.
    mutator(this.value)
    this.valueVersion++
    this.producerMayHaveChanged()

    postSignalSetFn?.()
  }

  asReadonly () {
    if (this.readonlySignal === undefined) {
      this.readonlySignal = createSignalFromFunction(this, () => this.signal())
    }
    return this.readonlySignal
  }

  signal () {
    this.producerAccessed()
    return this.value
  }
}

/**
 * Create a `Signal` that can be set or updated directly.
 *
 * @developerPreview
 */
export function signal (initialValue, options) {
  const signalNode = new WritableSignalImpl(
    initialValue,
    options?.equal ?? defaultEquals
  )

  // Casting here is required for g3, as TS inference behavior is slightly different between our
  // version/options and g3's.
  const signalFn = createSignalFromFunction(
    signalNode,
    signalNode.signal.bind(signalNode),
    {
      set: signalNode.set.bind(signalNode),
      update: signalNode.update.bind(signalNode),
      mutate: signalNode.mutate.bind(signalNode),
      asReadonly: signalNode.asReadonly.bind(signalNode)
    }
  )
  return signalFn
}

export function setPostSignalSetFn (fn) {
  const prev = postSignalSetFn
  postSignalSetFn = fn
  return prev
}
