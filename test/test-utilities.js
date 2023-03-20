const test = require('tape')
const utils = require('../lib/utilities')

test('utils.clone', t => {
  const clone = utils.clone
  
  const o1 = [ 1, { foo: [2, false] }]
  const c1 = clone(o1)
  t.deepEqual(c1, o1)
  o1[1].foo[2] = true
  t.notDeepEqual(c1, o1)

  const o2 = { foo: [ 1, { bar: [ [0], () => {}] }], f2: null }
  const c2 = clone(o2)
  t.deepEqual(c2, o2)
  o2.foo[1].bar[0][0] = true
  t.notDeepEqual(c1, o1)

  t.end()
})

test('utils.clone', t => {
  const flatten = utils.flatten
  const o1 = { a: [ { b: { c: 4 }, d: null }, '2' ], foo: 23 }
  t.deepEqual(flatten(o1), { 'a.0.b.c': 4, 'a.0.d': null, 'a.1': '2', foo: 23 },
    '{ a: [ { b: { c: 4 }, d: null }, "2" ], foo: 23 }')
  t.end()
})
