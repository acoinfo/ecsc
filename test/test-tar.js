const fsPromise = require('fs/promises')
const path = require('path')
const test = require('tape')
const tar = require('../lib/tar')

const source = [
  path.join(__dirname, '..', 'test'),
  path.join(__dirname, '..', 'package.json')
]
const dest = path.join(__dirname, '..', '__test.tar')

function cleanup () {
  return fsPromise.unlink(dest)
}

test('tar.tarfs', t => {
  return tar.tarfs(dest, ...source)
    .then(() => t.pass(`tarfs ${dest} success`))
    .then(t.end)
})

test('tar.untarfs', t => {
  let ok = false
  tar.untarfs(dest, (header, stream) => {
    stream.resume() // flush
    t.pass(`untarfs ${header.name} success`)
    if (header.name.endsWith('package.json')) {
      ok = true
    }
  })
    .then(() => ok ? t.end() : t.fail('untar cannot find package.json'))
    .then(cleanup, cleanup)
})
