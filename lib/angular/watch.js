/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { ReactiveNode, setActiveConsumer } from "./graph"

const NOOP_CLEANUP_FN = () => {}

/**
 * Watches a reactive expression and allows it to be scheduled to re-run
 * when any dependencies notify of a change.
 *
 * `Watch` doesn't run reactive expressions itself, but relies on a consumer-
 * provided scheduling operation to coordinate calling `Watch.run()`.
 */
export class Watch extends ReactiveNode {
  dirty = false
  cleanupFn = NOOP_CLEANUP_FN
  registerOnCleanup = cleanupFn => {
    this.cleanupFn = cleanupFn
  }

  constructor(watch, schedule, allowSignalWrites) {
    super()
    this.watch = watch
    this.schedule = schedule
    this.consumerAllowSignalWrites = allowSignalWrites
  }

  notify() {
    if (!this.dirty) {
      this.schedule(this)
    }
    this.dirty = true
  }

  onConsumerDependencyMayHaveChanged() {
    this.notify()
  }

  onProducerUpdateValueVersion() {
    // Watches are not producers.
  }

  /**
   * Execute the reactive expression in the context of this `Watch` consumer.
   *
   * Should be called by the user scheduling algorithm when the provided
   * `schedule` hook is called by `Watch`.
   */
  run() {
    this.dirty = false
    if (this.trackingVersion !== 0 && !this.consumerPollProducersForChange()) {
      return
    }

    const prevConsumer = setActiveConsumer(this)
    this.trackingVersion++
    try {
      this.cleanupFn()
      this.cleanupFn = NOOP_CLEANUP_FN
      this.watch(this.registerOnCleanup)
    } finally {
      setActiveConsumer(prevConsumer)
    }
  }

  cleanup() {
    this.cleanupFn()
  }
}
