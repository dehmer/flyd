let id = 0
const stack = []
let flushing = false

const prop = key => object => object[key]

export const curryN = n => f => {
  const aux = (n, xs) =>
    n === 0 ? f(...xs) : x => aux(n - 1, [...xs, x])
  return aux(n, [])
}

export const Signal = atom => {
  // map :: Signal s => s a ~> (a -> b) -> s b
  atom.map = fn => link(a => fn(a()), [atom])

  // filter :: Signal s => s a ~> (a -> Boolean) -> s a
  atom.filter = fn => link(a => fn(a()) ? a() : undefined, [atom])

  // ap :: Signal s => s a ~> s (a -> b) -> s b
  atom.ap = s => link((s, a) => s()(a()), [s, atom])

  // chain :: Signal s => s a ~> (a -> s b) -> s b
  atom.chain = fn => {
    const self = Signal.of()
    link(s => link(x => self(x()), [fn(s())]), [atom])
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
  const self = (...args) => {
    if (args.length === 0) return self.value
    else {
      set(self, ...args)
      return self
    }
  }

  self.id = ++id
  self.value = value
  self.dependent = []
  return Signal(self)
}

/**
 * link :: ([Signal a(i)] -> b) -> [Signal a(i)] -> Signal b
 * Link one or more input signals to a output signal.
 */
export const link = (fn, inputs) => {
  if (!fn) throw new TypeError('"fn" is undefined')
  else if (!inputs) throw new TypeError('"inputs" is undefined')
  else if (!Array.isArray(inputs)) throw new TypeError('"inputs" is not an array')
  else if (inputs.length === 0) throw new TypeError('"inputs" is empty array')
  else if (inputs.some(x => x === null || x === undefined)) throw new TypeError('"inputs" contains null or undefined value')
  else if (inputs.some(x => !isSignal(x))) throw new TypeError('"inputs" contains non-signal value')

  const self = (...args) => {
    if (args.length === 0) return self.value
    else throw new TypeError('read-only signal')
  }

  self.id = ++id
  self.fn = fn // link production/body
  self.inputs = inputs
  self.dependent = []

  // Add self to dependent list of all input streams:
  inputs.forEach(input => (input.dependent = [...input.dependent, self]))
  stack.push(self)
  flush()
  return Signal(self)
}

export const effect =
  (fn, s) =>
    link(s => fn(s()), [s])

/**
 * Set signal value.
 */
const set = (s, value) => {
  if (value === undefined) return // `undefined` does not propagate
  if (value === s.value) return // same value is ignored
  s.value = value

  Array
    .from(dependent(s))
    .reverse()
    .forEach(x => stack.push(x))
  if (!flushing) flush()
}

/**
 * Evaluate linked signal.
 */
const evaluate = s => {
  if (!isDefined(s.inputs)) return
  const inputs = s.inputs.map(prop('value'))
  const value = s.fn(...inputs)
  set(s, value)
}

const flush = () => {
  flushing = true
  while (stack.length) evaluate(stack.pop())
  flushing = false
}

/**
 * Get dependent in breadh-first ordern.
 */
const dependent = (s, acc = new Set()) => {
  s.dependent
    .filter(x => !acc.has(x))
    .forEach(x => {
      acc.add(x)
      dependent(x, acc)
    })
  return acc
}

export const isSignal = x => x.constructor === Signal.of

/**
 * isBound :: Signal -> Boolean
 * isBound :: [Signal] -> Boolean
 * Whether argument is bound to a value or to values.
 */
export const isDefined = x => Array.isArray(x)
  ? x.every(isDefined)
  : x.value !== undefined
