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

But once a Signal is defined it stays defined:

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
```

A linked Signal's production is only evaluated when at least one value of its input signals has changed:

```javascript
const seen = []
const a = Signal.of(1)
link(a => seen.push(a()), [a])
;[1, 2, 2, 2, 1].forEach(a)
console.log(seen) // [1, 2, 1]
```

A linked signal may produce an undefined value in which case the signal's current value is not updated:

```javascript
const a = Signal.of(2)
const b = link(a => a() < 3 ? a() + 1 : undefined, [a])
console.log(b()) // 3
a(3); console.log(b()) // 3
```

#### Efficient updates

Consider the following dependencies:

```javascript
const a = Signal.of(1)                        //        a
const b = link(a => a() + 2, [a])             //       / \
const c = link(a => a() * 2, [a])             //      b   c
const d = link((b, c) => b() + c(), [b, c])   //       \ /
a(3)                                          //        d
console.log(d()) // 11
```

With a naive update strategy, `d`'s production would be evaluated twice. Once after `b` was updated and again after the update of `c`. An expensive production degrades performance if evaluated more than necessary and additional (phantom) value tuples are created, which may become a problem. Even though eventually the value of `d`  is correct, this is inefficient at best. 

Simply put, evaluation of `d` production must be deferred until all its inputs were updated.
