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

// Globals
const queue = []
const stack = []
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
  const self = createStream()
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
const createStream = () => {
  const self = (...args) => {
    if (args.length === 0) return self.value
    else {
      updateValue(self, ...args)
      return self
    }
  }

  self.dependent = []

  self.map = f => map(f, self)
  self.pipe = f => f(self)

  return self
}

/**
 *
 */
const update = s => {
  if (!isDefined(s.inputs) && !s.forceUpdate) return
  if (inStream !== undefined) return queueUpdate(s, update)
  delete s.forceUpdate

  inStream = s
  const value = s.fn(...s.inputs)
  if (value !== undefined) updateValue(s, value)
  inStream = undefined

  s.shouldUpdate = false
  if (flushing() === false) flushQueue()
  if (s.dependent.some(s => s.shouldUpdate)) {
    if (!flushingStack) updateValue(s, s.value) // ???
    else {
      s.dependent
        .filter(d => d.shouldUpdate)
        .forEach(d => queueUpdate(d, update))
    }
  }
}

/**
 *
 */
const updateDependent = s => {
  s.dependent.forEach(d => {
    d.shouldUpdate = true
    stackUpdate(d)
  })

  while (stack.length) stack.pop()()
}

/**
 * !!!
 * // TODO: inline? (updateDependent)
 */
const stackUpdate = s => {
  if (s.queued) return
  s.queued = true
  s.dependent.forEach(stackUpdate)
  stack.push(() => {
    if (s.shouldUpdate === true) update(s)
    s.queued = false
  })
}

const queueUpdate = (s, fn) => {
  s.shouldUpdate = true
  queue.push(() => {
    if (s.shouldUpdate) fn(s)
  })
}

/**
 *
 */
const updateValue = (s, value) => {
  // TODO: ignore "same" values
  s.value = value

  if (inStream === undefined) {
    flushingStack = true
    updateDependent(s)
    flushQueue()
    flushingStack = false
  } else if (inStream === s) {
    s.dependent.forEach(d => (d.shouldUpdate = true))
  } else {
    queueUpdate(s, s => updateValue(s, value))
  }
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
const isDefined = x => Array.isArray(x)
  ? x.every(isDefined)
  : x.value !== undefined

module.exports = flyd
