### Signal

Time-varying values with acyclic static dependencies and synchronous glitch-free updates. *Plain* read/write Signal is a container for a value `a`: `const s = Signal.of(a)`. Value can be of any type including functions. 0-ary function `Signal :: () -> a` returns the current value, 1-ary function `Signal :: a -> Signal a` updates the current value:

```javascript
const s = Signal.of(3)
console.log(s()) // 3
s(4); console.log(s()) // 4
```

*Linked* read-only (output) Signal is statically tied to one or more input Signals: `link :: ([Signal] -> a) -> [Signal] -> Signal a`. Its value is produced by the Signal body (or production) and updated whenever an input Signal changes:

```javascript
const a = Signal.of(3)
const b = Signal.of(2)
const c = link((a, b) => a() + b()), [a, b])
console.log(c()) // 5
a(4); console.log(c()) // 6
c(0) // TypeError: read-only signal
```

A Signal is undefined when its value is undefined:

```javascript
console.log(Signal.of()()) // undefined
console.log(Signal.of(undefined)()) // undefined
```

But once a plain Signal is defined it stays defined:

```javascript
const s = Signal.of(1)
s(undefined); console.log(s()) // 1 (no-op)
```

A linked Signal's production is only evaluated when all input Signals are defined:

```javascript
const a = Signal.of()
const b = Signal.of()
const production = (a, b) => a() + b()
const c = link(production, [a, b])
console.log(c()) // undefined
a(1); console.log(c()) // undefined; b is undefined
b(2); console.log(c()) // 3

// production produces undefined value:
const d = link(a => void 0, [Signal.of(1)])
console.log(d) => // undefined
```

(Anonymous) linked Signal may produce side-effects:

```javascript
const a = Signal.of(1)
link(a => console.log('a is', a()), [a]) // a is 1
a(2); // a is 2
```

