'use strict'

const test = require('tape')
const { parseArgv, parseString } = require('../lib/optparser')

test('optparser -h or -v', t => {
  t.deepEqual(parseArgv('--help'), { _help: true }, 'parse --help')
  t.deepEqual(parseArgv('-h'), { _help: true }, 'parse -h')
  t.deepEqual(parseArgv('--version'), { _version: true }, 'parse --version')
  t.deepEqual(parseArgv('-v'), { _version: true }, 'parse -v')

  t.deepEqual(parseArgv(['-h', '-v']), { _help: true }, 'parse -v -h')
  t.deepEqual(parseArgv(['-v', '-h']), { _version: true }, 'parse -v -h')
  t.end()
})

test('optparser without spec', t => {
  t.deepEqual(parseArgv('help'), { _cmd: 'help' }, 'parse help')
  t.deepEqual(parseArgv(['-a', '3', '--foo']),
    { '0': '-a', '1': '3', '2': '--foo' }, 'parse help -a 3 --foo')
  t.end()
})

test('optparser with spec', t => {
  const spec = { a: {/*requried but no-verifier*/}, b: false, foo: true, bar: false }
  let message
  message = 'option "-a" is required'
  t.throws(() => parseString(spec, '-b --foo --bar'), { message }, message)
  message = 'option "--foo" is required'
  t.throws(() => parseString(spec, '-a 32 --bar'), { message }, message)
  t.throws(() => parseString(spec, 'foo -a 32 --bar'), { message }, message)

  let argv
  argv = 'cmd -a 32 --foo'
  t.deepEqual(parseString(spec, argv), { _cmd: 'cmd', a: '32', foo: true }, argv)
  argv = 'cmd -a v -b --foo --bar'
  t.deepEqual(parseString(spec, argv), { _cmd: 'cmd', a: 'v', b: true, foo: true, bar: true }, argv)

  t.end()
})

test('optparser with complex spec', t => {
  const spec = { 
    a: { o: true, v: /^a/ },
    b: v => v.startsWith('b'),
    foo: { o: false, v: v => v.startsWith('foo') },
    bar: /^bar/
  }
  
  let message
  message = 'option "-b" is required'
  t.throws(() => parseString(spec, '-a a --foo foo --bar bar'), { message }, message)
  message = 'option "--foo" is required'
  t.throws(() => parseString(spec, '-b b --bar bar'), { message }, message)
  message = 'option "-b" has invalid value "c"'
  t.throws(() => parseString(spec, '-a a -b c --foo foo --bar bar'), { message }, message)
  message = 'option "--foo" has invalid value "3"'
  t.throws(() => parseString(spec, '-b b2 --foo 3 --bar bar4'), { message }, message)

  let argv
  argv = '-a a3 -b b --foo foo --bar bar'
  t.deepEqual(parseString(spec, argv), { a: 'a3', b: 'b', foo: 'foo', bar: 'bar' }, argv)

  t.end()
})

test('optparser invalid options', t => {
  let message
  const spec = { foo: false, b: {} }

  message = 'option "-a" is not supported'
  t.throws(() => parseString(spec, '-a'), { message }, message)
  message = 'option "-b" requires an option value'
  t.throws(() => parseString(spec, '-b'), { message }, message)
  message = 'option "bar" is not supported'
  t.throws(() => parseString(spec, '--foo bar'), { message }, message)

  t.end()
})