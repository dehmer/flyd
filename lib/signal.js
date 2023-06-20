const tap = fn => v => { fn(v); return v }
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x)
const when = (p, fn, a) => p(a) && fn(a)
const filter = (xs, x) => xs.splice(xs.indexOf(x))
const isFunction = a => typeof a === 'function'

const curry = fn => function rec (...args) {
  return args.length >= fn.length
    ? fn(...args)
    : (...xs) => rec(...args, ...xs)
}

const stack = (() => {
  const mark = tap(x => (x.queued = true))
  const unmark = tap(x => delete x.queued)
  const xs = []
  const push = x => !x.queued && xs.push(mark(x))
  const pop = () => unmark(xs.pop())
  const length = () => xs.length
  return { push, pop, length }
})()

export const Signal = atom => {
  // map :: Signal s => s a ~> (a -> b) -> s b
  atom.map = fn => link(a => fn(a), [atom])

  // filter :: Signal s => s a ~> (a -> Boolean) -> s a
  atom.filter = fn => {
    const self = Signal.of()
    link(a => fn(a) && self(a), [atom])
    return self
  }

  // ap :: Signal s => s a ~> s (a -> b) -> s b
  atom.ap = s => link((s, a) => s(a), [s, atom])

  // chain :: Signal s => s a ~> (a -> s b) -> s b
  atom.chain = fn => {
    const isLinked = ([last, effect]) => last && effect
    const unlink = ([s, dependent]) => filter(s.dependent, dependent)
    const self = Signal.of()

    let last, effect
    link(s => {
      when(isLinked, unlink, [last, effect])
      last = fn(s) // last :: Signal
      effect = isSignal(last) && link(self, last)
    }, [atom])

    return self
  }

  // Fantasy Land compatibility:
  atom.constructor = Signal.of
  atom['fantasy-land/map'] = atom.map
  atom['fantasy-land/filter'] = atom.filter
  atom['fantasy-land/ap'] = atom.ap
  atom['fantasy-land/chain'] = atom.chain
  return atom
}

/**
 * of :: a -> Signal a
 */
Signal.of = value => {
  const self = (...args) =>
    args.length === 0
      ? self.value
      : set(self, ...args)

  self.value = value
  self.dependent = []
  return Signal(self)
}

/**
 * link :: Signal s => (...[any] -> b) -> [s any] -> s b
 * Link one or more input signals to a output signal.
 */
export const link = (fn, inputs) => {
  if (!fn) throw new TypeError('"fn" is undefined')
  if (!inputs) throw new TypeError('"inputs" is undefined')
  if (!Array.isArray(inputs) && isSignal(inputs)) return link(fn, [inputs])
  if (!Array.isArray(inputs)) throw new TypeError('"inputs" is not an array')
  if (inputs.length === 0) throw new TypeError('"inputs" is empty array')
  if (inputs.some(x => !isSignal(x))) throw new TypeError('"inputs" contains non-signal or falsy value')

  const self = (...args) => {
    if (args.length === 0) return self.value
    else throw new TypeError('read-only signal')
  }

  self.fn = fn // link production/body
  self.inputs = inputs
  self.dependent = []

  // Add self to dependent list of all input streams:
  inputs.forEach(input => (input.dependent = [...input.dependent, self]))
  stack.push(self); flush()
  return Signal(self)
}

/**
 * startWith :: a -> Signal a -> Signal a
 * startWith :: (() -> a) -> Signal a -> Signal a
 */
export const startWith = curry((initial, signal) => {
  const value = isFunction(initial) ? initial() : initial
  const self = Signal.of(value)
  link(self, signal)
  return self
})

/**
 * Set signal value.
 */
const set = curry((signal, value) => {
  if (value === undefined) return signal // `undefined` does not propagate
  else if (value === signal.value) return signal // same value is ignored
  else {
    signal.value = value
    dependent(signal).reverse().forEach(stack.push)
    if (!stack.flushing) flush()
    return signal
  }
})

/**
 * Evaluate linked signal.
 */
const values = inputs => inputs.map(s => s.value)
const apply = fn => xs => fn(...xs)
const evaluate = s =>
  isDefined(s.inputs)
    ? compose(set(s), apply(s.fn), values)(s.inputs)
    : s

const flush = () => {
  stack.flushing = true
  while (stack.length()) evaluate(stack.pop())
  stack.flushing = false
}

/**
 * Get all dependent in breadth-first order.
 */
const dependent = (signal, acc = []) =>
  signal.dependent.reduce((acc, x) => {
    acc.push(x)
    return dependent(x, acc)
  }, acc)

export const isSignal =
  x => x &&
  x.constructor === Signal.of

/**
 * isDefined :: Signal -> Boolean
 * isDefined :: [Signal] -> Boolean
 * Whether argument's value or values are defined.
 */
export const isDefined = x => Array.isArray(x)
  ? x.every(isDefined)
  : x.value !== undefined
