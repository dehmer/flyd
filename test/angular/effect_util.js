/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Watch } from '../../lib/angular'

const queue = new Set()

/**
 * A wrapper around `Watch` that emulates the `effect` API and allows for more streamlined testing.
 */
export function testingEffect (effectFn) {
  const watch = new Watch(effectFn, queue.add.bind(queue), true)

  // Effects start dirty.
  watch.notify()
}

export function flushEffects () {
  for (const watch of queue) {
    queue.delete(watch)
    watch.run()
  }
}

export function resetEffects () {
  queue.clear()
}
