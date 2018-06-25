"use strict";

var pipe = function pipe() {
  for (var _len = arguments.length, fns = Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }

  return function (x) {
    return fns.reduce(function (y, f) {
      return f(y);
    }, x);
  };
};

var g = function g(n) {
  return n + 1;
};
var f = function f(n) {
  return n * 2;
};

var doStuffBetter = pipe(g, f);

console.log(
  doStuffBetter(20) // 42
);

const pipe = (...fns) => x => fns.reduce((y, f) => f(y), x);