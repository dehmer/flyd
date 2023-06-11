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
  const self = (...args) => args.length === 0 ? self.value : update(self, ...args)
  self.value = value
  self.dependent = []
  return Signal(self)
}

const isStream = x => x.constructor === Signal.of

/**
 * link :: ([Signal a(i)] -> b) -> [Signal a(i)] -> Signal b
 * Link one or more input signals to a output signal.
 */
export const link = (fn, inputs) => {
  if (!fn) throw new TypeError('"fn" is undefined')
  if (!inputs) throw new TypeError('"inputs" is undefined')
  if (!Array.isArray(inputs)) throw new TypeError('"inputs" is not an array')
  if (inputs.length === 0) throw new TypeError('"inputs" is empty')
  if (inputs.some(x => !isStream(x))) throw new TypeError('"inputs" contains non-signal value')

  const self = (...args) => args.length === 0 ? self.value : update(self, ...args)
  self.fn = fn
  self.inputs = inputs
  self.dependent = []

  // Add self to dependent list of all input streams:
  inputs.forEach(input => (input.dependent = [...input.dependent, self]))
  check(self, true)
  return Signal(self)
}

/**
 * Unlink input signal from all output signals.
 */
export const unlink = input => {
  input.dependent = []
}

export const effect = (fn, s) => {
  return link(s => fn(s()), [s])
}

let entry = null
const queue = new Set()

const update = (s, value) => {
  enqueue(s, () => {
    if (value === undefined) return // `undefined` does not propagate
    if (value === s.value) return // same values are ignored
    s.value = value
    s.changed = true

    const dependent = s.dependent || []
    dependent.forEach(s => enqueue(s, () => check(s)))
  })
}

const check = (s, force = false) => {
  if (!hasInputs(s)) return
  if (!isBound(s.inputs)) return // TODO: set value to undefined
  if (!isDirty(s, force)) return

  const value = s.fn(...s.inputs)
  update(s, value)
}

const reset = s => {
  delete s.changed
  delete s.queued
  s.dependent.forEach(reset)
}

const enqueue = (s, process) => {
  if (s.queued) return

  s.queued = true
  s.process = process
  queue.add(s)

  if (!entry) {
    entry = s
    reduce()
  }
}

const reduce = () => {
  do {
    const s = queue.values().next().value
    queue.delete(s)
    s.process()
  } while (queue.size)

  reset(entry)
  entry = null
}

/**
 * isBound :: Signal -> Boolean
 * isBound :: [Signal] -> Boolean
 * Whether argument is bound to a value or to values.
 */
const isBound = x => Array.isArray(x)
  ? x.every(isBound)
  : x.value !== undefined

const hasInputs = s => !!s.inputs
const isDirty = (s, force) => s.inputs.some(x => x.changed) || force
