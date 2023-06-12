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
  const self = (...args) =>
    args.length === 0
      ? self.value
      : updateValue(self, ...args)

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

  const self = (...args) => {
    if (args.length === 0) return self.value
    else throw new TypeError('read-only signal')
  }

  self.type = 'link'
  self.fn = fn // link production/body
  self.inputs = inputs
  self.dependent = []

  // Add self to dependent list of all input streams:
  inputs.forEach(input => (input.dependent = [...input.dependent, self]))
  check(self)
  return Signal(self)
}

export const effect =
  (fn, s) =>
    link(s => fn(s()), [s])

/**
 * Update linked signal.
 */
const updateValue = (s, value) => {
  if (value === undefined) return // `undefined` does not propagate
  if (value === s.value) return // same values are ignored
  s.value = value

  s.dependent.forEach(s => check(s))
}

const check = s =>
  updateValue(s, evaluate(s))

const evaluate = s =>
  isBound(s.inputs)
    ? s.fn(...s.inputs)
    : undefined

/**
 * isBound :: Signal -> Boolean
 * isBound :: [Signal] -> Boolean
 * Whether argument is bound to a value or to values.
 */
const isBound = x => Array.isArray(x)
  ? x.every(isBound)
  : x.value !== undefined
