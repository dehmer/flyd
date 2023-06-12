/* eslint-disable */
'use strict';

// Utility
var slice = Array.prototype.slice;
var concat = Array.prototype.concat;

/**
 *
 */
function curryN(n, func) {
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

function curry(func) {
  return curryN(func.length, func);
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

// fantasy-land Applicative
flyd.stream['fantasy-land/of'] = flyd.stream.of = flyd.stream;


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
// Library functions use self callback to accept (null, undefined) update triggers.
function map(f, s) {
  return combine(function(s) { return f(s.val) }, [s]);
}
flyd.map = curryN(2, map);

/**
 *
 */
flyd.on = curryN(2, function(f, s) {
  return combine(function(s) { f(s.val); }, [s]);
})


/**
 *
 */
flyd.curryN = curryN;
flyd.curry = curry;

/**
 *
 */
function boundMap(f) { return map(f, this); }

/**
 *
 */
function operator_pipe(f) { return f(this) }


// /////////////////////////// PRIVATE ///////////////////////////////// //

/**
 *
 */
function createStream() {
  function s(n) {
    if (arguments.length === 0) return s.val
    updateStreamValue(n, s)
    return s
  }
  s.hasVal = false;
  s.val = undefined;
  s.updaters = []; // !!!
  s.dependent = [];
  s.queued = false;

  // fantasy-land compatibility
  s['fantasy-land/map'] = s.map = boundMap;
  s['fantasy-land/of'] = s.of = flyd.stream;

  s.pipe = operator_pipe;

  // According to the fantasy-land Applicative specification
  // Given a value f, one can access its type representative via the constructor property:
  // `f.constructor.of`
  s.constructor = flyd.stream;

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
 * @private
 * Check if all the dependencies have values
 * @param {stream} stream - the stream to check depencencies from
 * @return {Boolean} `true` if all dependencies have vales, `false` otherwise
 */
function initialDependenciesMet(stream) {
  stream.depsMet = stream.inputs.every(function(s) {
    return s.hasVal;
  });
  return stream.depsMet;
}

function dependenciesAreMet(stream) {
  return stream.depsMet === true || initialDependenciesMet(stream);
}

function listenersNeedUpdating(s) {
  return s.dependent.some(function(s) { return s.shouldUpdate; });
}

/**
 *
 */
function updateStream(s) {
  if (!dependenciesAreMet(s)) return;
  if (inStream !== undefined) {
    updateLaterUsing(updateStream, s);
    return;
  }
  inStream = s;
  const returnVal = s.fn(...s.inputs)
  if (returnVal !== undefined) {
    s(returnVal);
  }
  inStream = undefined;
  s.shouldUpdate = false;
  if (flushing() === false) flushUpdate();
  if (listenersNeedUpdating(s)) {
    if (!flushingStreamValue) s(s.val)
    else {
      s.dependent.forEach(function(listener) {
        if (listener.shouldUpdate) updateLaterUsing(updateStream, listener);
      });
    }
  }
}

/**
 *
 */
function updateListeners(s) {
  var i, o, list
  var listeners = s.dependent;
  for (i = 0; i < listeners.length; ++i) {
    list = listeners[i];
    list.shouldUpdate = true;
    findDeps(list);
  }

  for (; orderNextIdx >= 0; --orderNextIdx) {
    o = order[orderNextIdx];
    if (o.shouldUpdate === true) updateStream(o);
    o.queued = false;
  }
}

/**
 * @private
 * Add stream dependencies to the global `order` queue.
 * @param {stream} stream
 * @see updateDeps
 */
function findDeps(s) {
  var i
  var listeners = s.dependent;
  if (s.queued === false) {
    s.queued = true;
    for (i = 0; i < listeners.length; ++i) {
      findDeps(listeners[i]);
    }
    order[++orderNextIdx] = s;
  }
}

function updateLaterUsing(updater, stream) {
  toUpdate.push(stream);
  stream.updaters.push(updater);
  stream.shouldUpdate = true;
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
function updateStreamValue(n, s) {
  s.val = n;
  s.hasVal = true;
  if (inStream === undefined) {
    flushingStreamValue = true;
    updateListeners(s);
    if (toUpdate.length > 0) flushUpdate();
    flushingStreamValue = false;
  } else if (inStream === s) {
    markListeners(s, s.dependent);
  } else {
    updateLaterUsing(function(s) { updateStreamValue(n, s); }, s);
  }
}

/**
 *
 */
function markListeners(s, lists) {
  var i, list;
  for (i = 0; i < lists.length; ++i) {
    list = lists[i];
    list.shouldUpdate = true;
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
