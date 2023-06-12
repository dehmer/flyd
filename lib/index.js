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
var toUpdate = [];
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
flyd.stream = function(initialValue) {
  var s = createStream();
  if (arguments.length > 0) s(initialValue);
  return s;
}

/**
 *
 */
flyd.combine = curryN(2, combine);
function combine(fn, inputs) {
  const s = createDependentStream(inputs, fn);
  updateStream(s);
  return s;
}

/**
 *
 */
flyd.immediate = function(s) {
  if (s.depsMet === false) {
    s.depsMet = true;
    updateStream(s);
  }
  return s;
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
    updateStreamValue(n, s)
    return s
  }
  s.hasVal = false;
  s.value = undefined;
  s.updaters = []; // !!!
  s.dependent = [];
  s.queued = false;

  s.map = f => map(f, s)
  s.pipe = f => f(s)

  return s;
}

/**
 *
 */
function createDependentStream(inputs, fn) {
  var s = createStream();
  s.fn = fn;
  s.inputs = inputs;
  s.depsMet = false;
  s.shouldUpdate = false;
  addListeners(inputs, s);
  return s;
}

/**
 *
 */
function initialDependenciesMet(stream) {
  stream.depsMet = stream.inputs.every(s => s.hasVal)
  return stream.depsMet
}

function dependenciesAreMet(stream) {
  return stream.depsMet === true || initialDependenciesMet(stream);
}

/**
 *
 */
function updateStream(s) {
  if (!dependenciesAreMet(s)) return;
  if (inStream !== undefined) return updateLater(updateStream, s);

  inStream = s;
  const value = s.fn(...s.inputs)
  if (value !== undefined) updateStreamValue(value, s)
  inStream = undefined;

  s.shouldUpdate = false;
  if (flushing() === false) flushUpdate();
  if (s.dependent.some(s => s.shouldUpdate)) {
    if (!flushingStreamValue) updateStreamValue(s.value, s)
    else {
      s.dependent
        .filter(d => d.shouldUpdate)
        .forEach(d => updateLater(updateStream, d))
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
    if (o.shouldUpdate === true) updateStream(o);
    o.queued = false;
  }
}

/**
 * !!!
 */
function findDeps(s) {
  if (s.queued) return
  s.queued = true;
  s.dependent.forEach(findDeps)
  order[++orderNextIdx] = s;
}

function updateLater(updater, stream) {
  toUpdate.push(stream)
  stream.updaters.push(updater)
  stream.shouldUpdate = true
}

/**
 * @private
 */
function flushUpdate() {
  flushingUpdateQueue = true;
  while (toUpdate.length > 0) {
    var stream = toUpdate.shift();
    var nextUpdateFn = stream.updaters.shift();
    if (nextUpdateFn && stream.shouldUpdate) nextUpdateFn(stream);
  }
  flushingUpdateQueue = false;
}

/**
 *
 */
function updateStreamValue(value, s) {
  s.value = value;
  s.hasVal = true;
  if (inStream === undefined) {
    flushingStreamValue = true;
    updateListeners(s);
    if (toUpdate.length > 0) flushUpdate();
    flushingStreamValue = false;
  } else if (inStream === s) {
    s.dependent.forEach(d => (d.shouldUpdate = true))
  } else {
    updateLater(s => updateStreamValue(value, s), s)
  }
}

/**
 *
 */
function addListeners(deps, s) {
  for (var i = 0; i < deps.length; ++i) {
    deps[i].dependent.push(s);
  }
}

module.exports = flyd;
