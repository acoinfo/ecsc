'use strict'

const test = require('tape')
const { parseArgv, parseString, parseProcessArgv } = require('../lib/optparser')

test('optparser -h or -v', t => {
  t.deepEqual(parseArgv(['--help']), { $help: true }, 'parse --help')
  t.deepEqual(parseArgv(['-h']), { $help: true }, 'parse -h')
  t.deepEqual(parseArgv(['--version']), { $version: true }, 'parse --version')
  t.deepEqual(parseArgv(['-v']), { $version: true }, 'parse -v')

  t.deepEqual(parseArgv(['-h', '-v']), { $help: true }, 'parse -v -h')
  t.deepEqual(parseArgv(['-v', '-h']), { $help: true }, 'parse -v -h') // help first
  t.end()
})

test('optparser without spec', t => {
  t.deepEqual(parseArgv(['help']), { $argv: ['help'] }, 'parse help')
  t.deepEqual(parseArgv(['foo', '3', 'bar']),
    { $argv: ['foo', '3', 'bar'] }, 'parse ["foo", "3", "bar"]')
  t.end()
})

test('optparser only { _cmd }', t => {
  const spec = { $cmd: true }
  t.deepEqual(parseArgv(['help'], spec), { $cmd: 'help', $argv: [] }, 'parse help as cmd')
  t.deepEqual(parseArgv(['help', '-h'], { $help: true }), { $help: true }, 'parse help')
  t.deepEqual(parseArgv(['a', '3', '--foo'], spec),
    { $cmd: 'a', $argv: ['3', '--foo'] }, 'parse help -a 3 --foo')

  let message
  message = 'cmd "-a" should starts with alphabet only'
  t.throws(() => parseArgv(['-a', '3', '--foo'], spec), { message }, message)
  message = 'cmd "3" should starts with alphabet only'
  t.throws(() => parseArgv(['3', '--foo'], spec), { message }, message)
  t.end()
})

test('optparser with _cmd spec which ignores others', t => {
  const spec = { $cmd: true, a: {/*requried but no-verifier*/}, b: false, foo: true, bar: false }

  let argv
  argv = 'cmd -a 32 --foo'
  t.deepEqual(parseString(argv, spec),
    { $cmd: 'cmd', $argv: ['-a', '32', '--foo'] }, argv)
  argv = 'cmd a v -b --foo --bar'
  t.deepEqual(parseString(argv, spec), 
    { $cmd: 'cmd', $argv: ['a', 'v', '-b', '--foo', '--bar'] }, argv)

  t.end()
})

test('optparser with spec', t => {
  const spec = { 
    a_: () => true,   // required valued option with an passthrough verifier
    foo_: true, // required valued option, 'truthy' = passthrough verifier
    b: null,    // optional flag option that has no verifier (null)
    bar: null   // optional valuded option
  }
     
  let message
  message = 'option "-a" is required'
  // t.throws(() => parseString('cmd -b --foo --bar', spec), { message }, message)
  message = 'option "--foo" is required'
  t.throws(() => parseString('-a 32 --bar', spec), { message }, message)
  t.throws(() => parseString('foo -a 32 --bar', spec), { message }, message)

  let argv
  argv = 'cmd -a 32 --foo bar'
  t.deepEqual(parseString(argv, spec), { $argv: ['cmd'], a: '32', foo: 'bar' }, argv)
  argv = 'cmd -a v -b --foo vv --bar o'
  t.deepEqual(parseString(argv, spec), { $argv: ['cmd', 'o'], a: 'v', b: true, foo: 'vv', bar: true }, argv)

  t.end()
})

test('optparser with spec of verifier', t => {
  const spec = { 
    a: /^a/,
    b_: v => v.startsWith('b'),
    foo_: v => ['foo'].includes(v),
    bar: /^bar/
  }
  const parse = s => parseString(s, spec)

  let message
  message = 'option "-b" is required'
  t.throws(() => parse('-a a --foo foo --bar bar'), { message }, message)
  message = 'option "--foo" is required'
  t.throws(() => parse('-b b --bar bar'), { message }, message)
  message = 'option "-b" has invalid value "c"'
  t.throws(() => parse('-a a -b c --foo foo --bar bar'), { message }, message)
  message = 'option "--foo" has invalid value "3"'
  t.throws(() => parse('-b b2 --foo 3 --bar bar4'), { message }, message)

  let argv
  argv = '-a a1 v -b b --foo foo vv --bar bar vvv'
  t.deepEqual(parse(argv), { $argv:['v', 'vv', 'vvv'], a: 'a1', b: 'b', foo: 'foo', bar: 'bar' }, argv)
  argv = '-a a2 v -b bar --foo foo vv vvv'
  t.deepEqual(parse(argv), { $argv:['v', 'vv', 'vvv'], a: 'a2', b: 'bar', foo: 'foo' }, argv)

  t.end()
})

test('optparser with repeatable value verifier', t => {
  const spec = { 
    a: /^[a-z]/
  }
  const parse = s => parseString(s, spec)

  let message = 'option "-a" requires an option value'
  t.throws(() => parse('-a'), { message }, 'option "-a" is required')

  t.throws(() => parse('-a a -a'), { message }, 'second option "-a" is required')

  let argv = '-a a1 -a a2'
  t.deepEqual(parse(argv), { $argv:[], a: ['a1', 'a2'] }, argv)

  t.end()
})

test('optparser parseProcessArgv', t => {
  const procArgv = parseProcessArgv({ $cmd: false })
  t.ok(procArgv.$entry, `parseProcessArgv $entry ${procArgv.$entry}`)
  t.ok(Array.isArray(procArgv.$argv), 'parseProcessArgv({ $cmd: false })')
  t.end()
})

test('optparser boundary conditions', t => {
  t.deepEqual(parseString(), { $argv: [] }, 'parseString()')
  t.deepEqual(parseString(''), { $argv: [] }, 'parseString("")')
  t.deepEqual(parseArgv([]), { $argv: [] }, 'parseArgv([])')
  t.deepEqual(parseArgv([]), { $argv: [] }, 'parseArgv([])')
  t.end()
})

test('optparser mixed options and values', t => {
  const spec = { t: true, }
  t.deepEqual(parseString('foo a -t t1 b -t t2 c', spec),
    { $argv: ['foo', 'a', 'b', 'c'], t: ['t1','t2'] }, 'parseString("foo a -t t1 b -t t2 c")')
  t.end()
})

test('optparser invalid options', t => {
  let message
  const spec = { foo: false, b: {} }

  message = 'option "-a" is not supported'
  t.throws(() => parseString('-a', spec), { message }, message)
  message = 'option "-b" requires an option value'
  t.throws(() => parseString('-b', spec), { message }, message)

  t.end()
})