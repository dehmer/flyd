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
  const s = create()
  s.value = value
  return Signal(s)
}

const create = () => {
  const s = (...args) => args.length === 0 ? s.value : set(s, ...args)
  s.dependent = []
  return s
}

/**
 * Queue signal and dependent in breath-first order.
 */
const queue = (s, q = new Set()) => {
  // Move signal if already queued to prevent diamond problem.
  if (q.has(s)) q.delete(s)
  q.add(s)

  const dependent = s.dependent || []
  dependent.forEach(x => queue(x, q))

  return q
}

/**
 * evaluate :: Signal -> Signal
 * Check inputs and update value when bound.
 */
const evaluate = (s, force = false) => {
  for (const x of queue(s).values()) {
    if (needsEvaluation(x, force)) {
      const value = x.fn(...x.inputs)
      if (value !== x.value) x.changed = true
      x.value = value
    }

    // if (!hasInputs(x)) continue // plain signals don't have inputs
    // console.log(x.id, 'hasInputs', !!x.inputs, x.inputs?.length, 'isBound', isBound(x.inputs), 'isDirty', isDirty(x, force))
    // x.inputs.forEach(s => console.log('changed', s.id, s.changed))
    // if (!isBound(x.inputs)) continue
    // if (!isDirty(x, force)) continue
  }

  for (const x of queue(s).values()) {
    delete x.changed
  }

  return s
}

/**
 * set :: Signal a -> a -> Unit
 */
const set = (s, value) => {
  if (value === undefined) return // no-op
  if (s.value === value) return // no-op
  s.value = value
  s.changed = true
  evaluate(s)
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

const needsEvaluation = (x, force) =>
  hasInputs(x) && isBound(x.inputs) && isDirty(x, force)

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

  const self = create()
  self.fn = fn
  self.inputs = inputs

  // Add self to dependent list of all input streams:
  inputs.forEach(input => (input.dependent = [...input.dependent, self]))
  return Signal(evaluate(self, true))
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
