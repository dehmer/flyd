/**
 *
 */
function curryN (n, func) {
  const slice = Array.prototype.slice
  const concat = Array.prototype.concat
  return function () {
    const curargs = slice.call(arguments)
    if (curargs.length >= n) {
      return func.apply(null, curargs)
    }

    return curryN(n - curargs.length, function () {
      return func.apply(null, concat.call(curargs, slice.call(arguments)))
    })
  }
}

const noop = () => {}
const prop = key => object => object[key]
const compose = (g, f) => v => g(f(v))

// Globals
const queue = []
let inStream
let flushingQueue = false
let flushingStack = false

const flushing = () => flushingQueue || flushingStack

/** @namespace */
const flyd = {}

// /////////////////////////// API ///////////////////////////////// //

/**
 *
 */
flyd.stream = (...args) => {
  const self = createStream()
  if (args.length) updateValue(self, ...args)
  return self
}

/**
 *
 */
const combine = (fn, inputs) => {
  if (!fn) throw new TypeError('"fn" is undefined')
  if (!inputs) throw new TypeError('"inputs" is undefined')
  if (!Array.isArray(inputs)) throw new TypeError('"inputs" is not an array')
  if (inputs.length === 0) throw new TypeError('"inputs" is empty array')
  if (inputs.some(x => x === null || x === undefined)) throw new TypeError('"inputs" contains null or undefined value')
  if (inputs.some(x => !isStream(x))) throw new TypeError('"inputs" contains non-signal value')

  const readOnly = true
  const self = createStream(readOnly)
  self.fn = fn
  self.inputs = inputs

  // Add this stream as dependency to all input signals:
  inputs.forEach(s => s.dependent.push(self))

  update(self)
  return self
}

/**
 *
 */
flyd.immediate = s => {
  if (!s.forceUpdate) {
    s.forceUpdate = true
    update(s)
  }

  return s
}

/**
 *
 */
const map = (f, s) => combine(s => f(s.value), [s])

flyd.combine = combine
flyd.map = curryN(2, map)
flyd.on = curryN(2, (f, s) => combine(s => f(s.value), [s]))

// /////////////////////////// PRIVATE ///////////////////////////////// //

/**
 *
 */
const createStream = (readOnly = false) => {
  const self = (...args) => {
    if (args.length === 0) return self.value
    else {
      if (readOnly) throw new TypeError('read-only signal')
      updateValue(self, ...args)
      return self
    }
  }

  self.dependent = []

  self.constructor = flyd.stream
  self.map = f => map(f, self)
  self.pipe = f => f(self)

  self.chain = f => {
    const flattened = flyd.stream()
    let current, effect
    combine(s => {
      if (current && effect) {
        current.dependent = current.dependent.filter(x => x !== effect)
      }
      current = f(s())
      effect = current && isStream(current)
        ? combine(c => flattened(c()), [current])
        : null
    }, [self])

    return flattened
  }

  return self
}

/**
 *
 */
const update = s => {
  if (!isDefined(s.inputs) && !s.forceUpdate) return s
  if (inStream !== undefined) return queueUpdate(s, update)
  delete s.forceUpdate

  inStream = s
  const value = s.fn(...s.inputs.map(prop('value')))
  // if (value !== undefined) updateValue(s, value)
  updateValue(s, value)
  inStream = undefined

  s.shouldUpdate = false
  if (flushing() === false) flushQueue()
  if (s.dependent.some(s => s.shouldUpdate)) {
    if (!flushingStack) updateValue(s, s.value)
    else {
      s.dependent
        .filter(d => d.shouldUpdate)
        .forEach(d => queueUpdate(d, update))
    }
  }

  return s
}

/**
 *
 */
const updateValue = (s, value) => {
  if (value === undefined) return
  if (value === s.value) return

  if (inStream === undefined) {
    flushingStack = true
    s.value = value
    updateDependent(s)
    flushingStack = false
  } else if (inStream === s) {
    // Mark dependent signals as dirty:
    s.value = value
    s.dependent.forEach(d => (d.shouldUpdate = true))
  } else {
    // Currently updating another signal => queue value update.
    // FIXME: original code sets value unconditionally, chances are linmked signals are defined in this case
    queueUpdate(s, s => updateValue(s, value))
  }
}

/**
 *
 */
const updateDependent = s => {
  const stack = []

  const pushUpdate = s => {
    if (s.queued) return
    s.queued = true
    s.dependent.forEach(pushUpdate)

    const fn = compose(
      s => (s.queued = false),
      s => (s.shouldUpdate ? update : s => s)(s)
    )

    stack.push(() => fn(s))
  }

  s.dependent.forEach(d => {
    d.shouldUpdate = true
    pushUpdate(d)
  })

  // [ec2b]
  stack.reverse().forEach(fn => fn())
}

const queueUpdate = (s, fn) => {
  const update = () => (s.shouldUpdate ? fn : noop)(s)
  queue.push(update)
  s.shouldUpdate = true
  return s
}

/**
 *
 */
const flushQueue = () => {
  flushingQueue = true
  while (queue.length > 0) queue.shift()()
  flushingQueue = false
}

/**
 * isDefined :: Signal -> Boolean
 * isDefined :: [Signal] -> Boolean
 */
export const isDefined = x => Array.isArray(x)
  ? x.every(isDefined)
  : x.value !== undefined

export const isStream = x =>
  x !== null &&
  x !== undefined &&
  x.constructor === flyd.stream

flyd.isStream = isStream
flyd.isDefined = isDefined
module.exports = flyd
