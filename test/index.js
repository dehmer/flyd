/* eslint-disable */
var assert = require('assert');

var flyd = require('../lib');
var stream = flyd.stream;
var combine = flyd.combine;
var map = flyd.map;

// Some combinators
function doubleFn(x) { return x() * 2; }
function sumFn(x, y) { return x() + y(); }

describe('stream', function() {
  it('can be set with initial value', function() {
    var s = stream(12);
    assert.equal(s(), 12);
  });
  it('can be set', function() {
    var s = stream();
    s(23);
    assert.equal(s(), 23);
    s(3);
    assert.equal(s(), 3);
  });
  it('setting a stream returns the stream', function() {
    var s = stream();
    assert.equal(s, s(23));
  });

  describe('dependent streams', function() {
    it('updates dependencies', function() {
      var x = stream(3);
      var x2 = combine(doubleFn, [x]);
      assert.equal(x2(), x() * 2);
    });
    it('can set result by returning value', function() {
      var x = stream(3);
      var y = stream(4);
      var sum = combine(sumFn, [x, y]);
      assert.equal(sum(), x() + y());
    });
    it('is updated when dependencies change', function() {
      var x = stream(3);
      var y = stream(4);
      var sum = combine(sumFn, [x, y]);
      assert.equal(sum(), x() + y()); // 7
      x(12);
      assert.equal(sum(), x() + y()); // 16
      y(8);
      assert.equal(sum(), x() + y()); // 20
    });
    it('can set result by calling callback', function() {
      var x = stream(3);
      var y = stream(4);
      var times = 0;
      var sum = combine(sumFn, [x, y]);
      combine(function() {
        times++;
      }, [sum]);
      assert.equal(sum(), x() + y()); // 7
      x(12);
      assert.equal(sum(), x() + y()); // 16
      y(8);
      assert.equal(sum(), x() + y()); // 20
      assert.equal(times, 3);
    });
    it('is not called until dependencies have value', function() {
      var x = stream();
      var y = stream();
      var called = 0;
      combine(function(x, y) {
        called++;
        return x() + y();
      }, [x, y]);
      x(2); x(1); y(2); y(4); x(2);
      assert.equal(called, 3);
    });
    it('streams can lead into other streams', function() {
      var x = stream(3);
      var y = stream(4);
      var sum = combine(sumFn, [x, y]);
      var twiceSum = combine(doubleFn, [sum]);
      var sumPlusDoubleSum = combine(sumFn, [twiceSum, sum]);
      x(12);
      assert.equal(sumPlusDoubleSum(), sum() * 3);
      y(3);
      assert.equal(sumPlusDoubleSum(), sum() * 3);
      x(2);
      assert.equal(sumPlusDoubleSum(), sum() * 3);
      assert.equal(sumPlusDoubleSum(), (2 + 3) * 3);
    });
    it('handles dependencies when streams are triggered in streams', function() {
      var x = stream(4);
      var y = stream(3);
      var z = stream(1);
      var doubleX = combine(doubleFn, [x]);
      var setAndSum = combine(function(y, z) {
        x(3);
        return z() + y();
      }, [y, z]);
      z(4);
      assert.equal(setAndSum(), 7);
      assert.equal(doubleX(), 6);
    });
    it('executes to the end before handlers are triggered', function() {
      var order = [];
      var x = stream(4);
      var y = stream(3);
      combine(function dx(x) {
        if (x() === 3) order.push(2);
        return x() * 2;
      }, [x]);
      combine(function sy(y) {
        x(3);
        order.push(1);
        return y();
      }, [y]);
      assert.deepEqual(order, [1, 2]);
    });
    it('with static deps executes to the end', function() {
      var order = [];
      var x = stream(4);
      var y = stream(3);
      combine(function(x) {
        if (x() === 3) order.push(2);
        return x() * 2;
      }, [x]);
      combine(function(y) {
        x(3);
        order.push(1);
        return y();
      }, [y]);
      assert.equal(order[0], 1);
      assert.equal(order[1], 2);
    });
    it('can filter values', function() {
      var result = [];
      var n = stream(0);
      var lrg5 = combine(function(n) {
        if (n() > 5) return n();
      }, [n]);
      flyd.map(function(v) { result.push(v); }, lrg5);
      ;[4, 6, 2, 8, 3, 4].forEach(n)
      assert.deepEqual(result, [6, 8]);
    });
    it('can set another stream\'s value multiple times from inside a stream', function() {
      var result = [];
      var a = stream();
      var b = stream();
      combine(function(b) {
        a(b());
        a();
        a(b() + 1);
        assert.equal(a(), 2);
      }, [b]);
      combine(function(a) {
        result.push(a());
      }, [a]);
      b(1);
      assert.deepEqual(result, [1, 2]);
    });
  });

  describe('streams created within dependent stream bodies', function() {
    it('if dependencies are met it is updated eventually', function() {
      var result;
      stream(1).pipe(map(function() {
        var n = flyd.stream(1);
        n.pipe(map(function(v) { result = v + 100; }));
      }));
      assert.equal(result, 101);
    });
    it('if dependencies are not met at creation it is updated after their dependencies are met', function() {
      var result;
      stream(1).pipe(map(function() {
        var n = stream();
        n.pipe(map(function(v) { result = v + 100; }));
        n(1);
      }));
      assert.equal(result, 101);
    });
    it('can create multi-level dependent streams inside a stream body', function() {
      var result = 0;
      var externalStream = stream(0);
      function mapper(val) {
        ++result;
        return val + 1;
      }
      stream(1).map(function() {
        externalStream
          .map(mapper)
          .map(mapper);
        return;
      });
      assert.equal(result, 2);
    });
    it('can create multi-level dependent streams inside a stream body part 2', function() {
      var result = '';
      var externalStream = stream(0);
      var theStream = stream(1);
      function mapper(val) {
        result += '' + val;
        return val + 1;
      }
      theStream.map(function() {
        externalStream
          .map(mapper)
          .map(mapper);
        return;
      });
      theStream(1);
      assert.equal(result, '0101');
    });
  });

  describe('on', function() {
    it('is invoked when stream changes', function() {
      var s = flyd.stream();
      var result = [];
      var f = function(val) { result.push(val); };
      flyd.on(f, s);
      s(1)(2);
      assert.deepEqual(result, [1, 2]);
    });
  });

  describe('map', function() {
    it('maps a function', function() {
      var x = stream(3);
      var doubleX = x.pipe(map(function(x) { return 2 * x; }));
      assert.equal(doubleX(), 6);
      x(1);
      assert.equal(doubleX(), 2);
    });
    it('maps a function', function() {
      var x = stream(3);
      var doubleX = flyd.map(function(x) { return 2 * x; }, x);
      assert.equal(doubleX(), 6);
      x(1);
      assert.equal(doubleX(), 2);
    });
    it('is curried', function() {
      var x = stream(3);
      var doubler = flyd.map(function(x) { return 2 * x; });
      var quadroX = doubler(doubler(x));
      assert.equal(quadroX(), 12);
      x(2);
      assert.equal(quadroX(), 8);
    });
    it('returns equivalent stream when mapping identity', function() {
      var x = stream(3);
      var x2 = x.pipe(map(function(a) { return a; }));
      assert.equal(x2(), x());
      x('foo');
      assert.equal(x2(), x());
    });
    it('is compositive', function() {
      function f(x) { return x * 2; }
      function g(x) { return x + 4; }
      var x = stream(3);
      var s1 = x.pipe(map(g)).pipe(map(f));
      var s2 = x.pipe(map(function(x) { return f(g(x)); }));
      assert.equal(s1(), s2());
      x(12);
      assert.equal(s1(), s2());
    });
  });

  describe('of', function() {
    it('creating a stream inside a stream all dependencies are updated', function() {
      var result = [];
      var str = flyd.stream();
      flyd.map(function(x) {
        result.push(x);
      }, str);
      flyd.map(function() {
        // create a stream, the first dependant on `str` should still be updated
        flyd.combine(function() { }, []);
      }, str);
      str(1);
      str(2);
      str(3);
      assert.deepEqual(result, [1, 2, 3]);
    });
  });

  describe('atomic updates', function() {
    it('does atomic updates', function() {
      var result = [];
      var a = stream(1);
      var b = combine(doubleFn, [a]);
      var c = combine(function(a) { return a() + 4; }, [a]);
      combine(function(b, c) {
        result.push(b() + c());
      }, [b, c]);
      a(2);
      assert.deepEqual(result, [7, 10]);
    });

    it('does not glitch', function() {
      var result = [];
      var s1 = stream(1);
      var s1x2 = flyd.map(function(x) { return x * 2; }, s1);
      var s2 = combine(sumFn, [s1, s1x2]);
      var s1x4 = combine(sumFn, [s1, s2]);
      flyd.map(function(n) { result.push(n); }, s1x4);
      s1(2)(3)(4);
      assert.deepEqual(result, [4, 8, 12, 16]);
    });

    it('handles complex dependency graph', function() {
      var result = [];
      var a = flyd.stream();
      var b = flyd.combine(function(a) { return a() + 1; }, [a]);
      var c = flyd.combine(function(a) { return a() + 2; }, [a]);
      var d = flyd.combine(function(c) { return c() + 3; }, [c]);
      var e = flyd.combine(function(b, d) {
        return b() + d();
      }, [b, d]);
      flyd.map(function(v) { result.push(v); }, e);
      a(1)(5)(11);
      assert.deepEqual(result, [8, 16, 28]);
    });
    it('handles another complex dependency graph', function() {
      var result = [];
      var a = flyd.stream();
      var b = flyd.combine(function(a) { return a() + 1; }, [a]);
      var c = flyd.combine(function(a) { return a() + 2; }, [a]);
      var d = flyd.combine(function(a) { return a() + 4; }, [a]);
      var e = flyd.combine(function(b, c, d) { return b() + c() + d(); }, [b, c, d]);
      flyd.map(function(v) { result.push(v); }, e);
      a(1)(2)(3);
      assert.deepEqual(result, [10, 13, 16]);
    });
    it('nested streams atomic update', function() {
      var invocationCount = 0;
      var mapper = function(val) {
        invocationCount += 1;
        return val + 1;
      };
      const s =
      stream(1).map(function() {
        stream(0)
        .map(mapper)
        .map(mapper);
      });
      assert.equal(invocationCount, 2);
    });
  });

  it('immediate', function () {
    const actual = []
    const a = stream()
    combine(() => actual.push('+'), [a]) // should not be evaluated
    flyd.immediate(combine(() => actual.push('*'), [a])) // should be evaluated
    assert.deepStrictEqual(actual, ['*'])
  })
});