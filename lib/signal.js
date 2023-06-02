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

  // Fantasy Land compatibility:
  atom.constructor = Signal.of
  atom['fantasy-land/map'] = atom.map
  atom['fantasy-land/filter'] = atom.filter
  atom['fantasy-land/ap'] = atom.ap
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
 * apply :: Signal -> Unit
 * Check inputs and update value when bound.
 */
const apply = s => {
  if (!isBound(s.inputs)) return s // no-op
  set(s, s.fn(...s.inputs))
  return s
}

/**
 * set :: Signal a -> a -> Unit
 */
const set = (s, value) => {
  if (value === undefined) return // no-op

  // Recursively update dependent streams:
  s.value = value
  s.dependent.forEach(apply)
}

/**
 * isBound :: Signal -> Boolean
 * isBound :: [Signal] -> Boolean
 * Whether argument is bound to a value or to values.
 */
const isBound = x =>
  Array.isArray(x)
    ? x.every(isBound)
    : x.value !== undefined

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

  return Signal(apply(self))
}
