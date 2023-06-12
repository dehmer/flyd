/* eslint-disable */
'use strict';

/**
 *
 */
function curryN(n, func) {
  const slice = Array.prototype.slice;
  const concat = Array.prototype.concat;
  return function() {
    var curargs = slice.call(arguments);

    if (curargs.length >= n) {
      return func.apply(null, curargs);
    }

    return curryN(n - curargs.length, function() {
      return func.apply(null, concat.call(curargs, slice.call(arguments)));
    });
  }
}

// Globals
const pendingUpdates = []
var inStream;
var order = [];
var orderNextIdx = -1;
var flushingUpdateQueue = false;
var flushingStreamValue = false;

function flushing() {
  return flushingUpdateQueue || flushingStreamValue;
}


/** @namespace */
var flyd = {}

// /////////////////////////// API ///////////////////////////////// //

/**
 *
 */
flyd.stream = (...args) => {
  const self = createStream()
  if (args.length) updateValue(args[0], self)
  return self
}

/**
 *
 */
flyd.combine = curryN(2, combine);
function combine(fn, inputs) {
  const s = createDependentStream(inputs, fn);
  update(s);
  return s;
}

/**
 *
 */
flyd.immediate = s => {
  if (s.forceUpdate === false) {
    s.forceUpdate = true;
    update(s)
  }

  return s
}

/**
 *
 */
const map = (f, s) => combine(s => f(s.value), [s])

flyd.map = curryN(2, map);
flyd.on = curryN(2, (f, s) => combine(s => f(s.value), [s]))


// /////////////////////////// PRIVATE ///////////////////////////////// //

/**
 *
 */
function createStream() {
  function s(n) {
    if (arguments.length === 0) return s.value
    updateValue(n, s)
    return s
  }

  s.dependent = [];
  s.queued = false;

  s.map = f => map(f, s)
  s.pipe = f => f(s)

  return s;
}

/**
 *
 */
const createDependentStream = (inputs, fn) => {
  const self = createStream()
  self.fn = fn
  self.inputs = inputs
  self.shouldUpdate = false

  // Add this stream as dependency to all input signals:
  inputs.forEach(s => s.dependent.push(self))

  return self
}

/**
 *
 */
function update(s) {
  if (!isDefined(s.inputs) && !s.forceUpdate) return
  if (inStream !== undefined) return updateLater(update, s)
  delete s.forceUpdate

  inStream = s
  const value = s.fn(...s.inputs)
  if (value !== undefined) updateValue(value, s)
  inStream = undefined;

  s.shouldUpdate = false;
  if (flushing() === false) flushUpdate();
  if (s.dependent.some(s => s.shouldUpdate)) {
    if (!flushingStreamValue) updateValue(s.value, s)
    else {
      s.dependent
        .filter(d => d.shouldUpdate)
        .forEach(d => updateLater(update, d))
    }
  }
}

/**
 *
 */
function updateListeners(s) {
  s.dependent.forEach(d => {
    d.shouldUpdate = true;
    findDeps(d);
  })

  for (; orderNextIdx >= 0; --orderNextIdx) {
    const o = order[orderNextIdx];
    if (o.shouldUpdate === true) update(o);
    o.queued = false;
  }
}

/**
 * !!!
 */
const findDeps = s => {
  if (s.queued) return
  s.queued = true
  s.dependent.forEach(findDeps)
  order[++orderNextIdx] = s
}

function updateLater(fn, s) {
  s.shouldUpdate = true
  pendingUpdates.push(() => {
    if (s.shouldUpdate) fn(s)
  })
}

/**
 * @private
 */
function flushUpdate() {
  flushingUpdateQueue = true;
  while (pendingUpdates.length > 0) pendingUpdates.shift()()
  flushingUpdateQueue = false;
}

/**
 *
 */
function updateValue(value, s) {
  s.value = value

  if (inStream === undefined) {
    flushingStreamValue = true;
    updateListeners(s);
    if (pendingUpdates.length > 0) flushUpdate();
    flushingStreamValue = false;
  } else if (inStream === s) {
    s.dependent.forEach(d => (d.shouldUpdate = true))
  } else {
    updateLater(s => updateValue(value, s), s)
  }
}

/**
 * isDefined :: Signal -> Boolean
 * isDefined :: [Signal] -> Boolean
 */
const isDefined = x => Array.isArray(x)
  ? x.every(isDefined)
  : x.value !== undefined

module.exports = flyd;
