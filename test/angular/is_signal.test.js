/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import assert from 'assert'
import {computed, isSignal, signal} from '../../lib/angular';

describe('isSignal', () => {
  it('should return true for writable signal', () => {
    const writableSignal = signal('Angular');
    assert(isSignal(writableSignal))
  });

  it('should return true for readonly signal', () => {
    const readonlySignal = computed(() => 10);
    assert(isSignal(readonlySignal))
  });

  it('should return false for primitive', () => {
    const primitive = 0;
    assert(!isSignal(primitive))
  });

  it('should return false for object', () => {
    const object = {name: 'Angular'};
    assert(!isSignal(object))
  });

  it('should return false for function', () => {
    const fn = () => {};
    assert(!isSignal(fn))
  });
});
