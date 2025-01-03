/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : tar.js
 * Desc   : tar stream operations
 */

'use strict'

const fs = require('fs')
const path = require('path')
const fsPromises = require('fs/promises')
const { Readable } = require('stream')
const TarStream = require('tar-stream')
const { makeReadonlyProp, isPromiseLike } = require('./utilities')

/**
 * @typedef {import('tar-stream').Pack} Pack
 * @typedef {import('tar-stream').Extract} Extract
 * @typedef {import('tar-stream').Headers} Headers
 * 
 * @typedef {(err: Error) => void} Callback
 * 
 * @typedef {{
 *  includeEmptyFile: boolean,
 *  includeEmptyDir: boolean,
 *  recursive: boolean,
 *  depthFirst: boolean,
 *  deferFileRead: boolean,
 *  pathTransform?: (path: string) => string
 * }} WalkOptions
 * 
 * @typedef {'symlink'|'file'|'dir'} EntryType
 * @typedef {String|Buffer|Readable} TarEntryData
 * @typedef {() => Promise<EntryData>} TarEntryDataAsync
 * @typedef {{ header: Headers, type: EntryType, data: EntryData|TarEntryDataAsync }} TarEntry
 * 
 * @typedef {(
 *  header: Headers,
 *  stream: Readable,
 *  next?: Callback) => void|Promise<void>} UntarEntryCb
 */

/**
 * @type {WalkOptions}
 */
const walkdirDefaults = Object.defineProperties({}, {
  includeEmptyFile: makeReadonlyProp(true),
  includeEmptyDir: makeReadonlyProp(true),
  recursive: makeReadonlyProp(true),
  depthFirst: makeReadonlyProp(true),
  deferFileRead: makeReadonlyProp(true)
})

module.exports = {
  walkdirDefaults,
  walkdir,
  tar,
  tarfs,
  untar,
  untarfs,
  pack: TarStream.pack,
  extract: TarStream.extract
}

/**
 * Tar the file or directory into the specified tar-stream packer then resolve
 *   with that packer.
 * 
 * @param {Pack} pack 
 * @param {AsyncIterable<TarEntry>} entryIterable 
 * @returns {Promise<Pack>}
 */
async function tar (pack, entryIterable) {
  if (!pack) {
    throw Error('pack must be a readable stream')
  }
  if (!(entryIterable && typeof entryIterable.next === 'function')) {
    throw Error('entryIterator must be an iterator')
  }

  let result = await entryIterable.next()
  while (!result.done) {
    const { header, type, data } = result.value
    header.type = type

    switch (type) {
    case 'symlink':
      await packLink(pack, header, data)
      break
    case 'file':
      await packFile(pack, header, data)
      break
    case 'directory':
      header.size = 0
      pack.entry(header)
      break
    default:
      if (data instanceof Readable) {
        data.resume() // flush unsupport 
      }
      throw Error(`unsupport entry type ${type}: ${header.name}`)
    }
    result = await entryIterable.next()
  }
  return pack
}

/**
 * @param  {String} dest
 * @param  {...String} source
 * @returns {Promise<Pack>}
 */
function tarfs (dest, ...source) {
  if (!isString(dest)) {
    throw Error('dest file must be a non-empty string')
  }
  if (source.length < 1) {
    throw Error('source file must be a non-empty string')
  }
  const pack = TarStream.pack()
  pack.pipe(fs.createWriteStream(dest))
  return tar(pack, walkdir(source)).then(pack => {
    pack.finalize()
    return pack
  })
}

/**
 * Open the given tar file and callback on each entry. The callback should
 * return a promise, the stream reading conntinues once the promise resolved
 *
 * @param {Extract} extract source stream to untar
 * @param {UntarEntryCb} entryCb async function to handle each tar entry
 */
async function untar (extract, entryCb) {
  if (!extract) {
    throw Error('extract must be a readable stream')
  }
  if (typeof entryCb !== 'function') {
    throw Error('callback must be a function')
  }

  return new Promise((resolve, reject) => {
    extract.on('entry', onEntry)
      .once('finish', resolve.bind(null, extract))
      .once('error', reject)
  })

  function onEntry (header, stream, next) {
    try {
      if (entryCb.length > 2) { // asume 3rd arg callback
        entryCb(header, stream, next)
      } else {
        const promise = entryCb(header, stream)
        isPromiseLike(promise) ? promise.then(next, next) : stream.once('end', next)
      }
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Untar the given file or socket
 * @param {String} source to read from
 * @param {(header: Headers, stream: Readable) => Promise<void>} callback 
 * @returns {Promise<Extract>}
 */
function untarfs (source, callback) {
  return createReadable(source)
    .then(readable => readable.pipe(TarStream.extract()))
    .then(extract => untar(extract, callback))

  function createReadable (fileOrStream) {
    if (fileOrStream instanceof Readable) {
      Promise.resolve(fileOrStream)
    }
    if (typeof fileOrStream === 'string') {
      return fsPromises.stat(fileOrStream).then(stats => {
        return (stats.isFile() || stats.isSocket())
          ? fs.createReadStream(fileOrStream)
          : Promise.reject(Error(`unsupported file type: ${fileOrStream}`))
      })
    }
    throw Error(`fileOrStream must be a string or Readable: ${fileOrStream}`)
  }
}

function packFile (pack, header, data) {
  if (typeof data === 'function') {
    data = data() // deferFileRead
  }
  if (isPromiseLike(data)) {
    return data.then(data => packFile(pack, header, data))
  }

  if (data instanceof Readable) {
    return new Promise((resolve, reject) => {
      data.on('end', resolve)
        .on('error', reject)
        .pipe(pack.entry(header))
    })
  } 
  else { // Buffer or String
    if (data == null) {
      data = Buffer.alloc(0)
    }
    return new Promise((resolve, reject) => {
      pack.entry(header, data, err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

function packLink (pack, header, data) {
  if (typeof data === 'function') {
    const promise = data()
    if (isPromiseLike(promise)) {
      return promise.then(data => packLink(header, data))
    }
    data = promise
  }
  pack.entry(header).end(data)
  return Promise.resolve()
}

/**
 * Walk the give files and directories
 * @param {Array<String>} files 
 * @param {WalkOptions} options 
 */
async function* walkdir (files, options = walkdirDefaults) {
  if (!(Array.isArray(files) && files.every(isString))) {
    throw Error('files must be an array of file or directory names')
  }
  Object.keys(walkdirDefaults).forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(options, k)) {
      options[k] = walkdirDefaults[k]
    }
  })
  const pathTransform = typeof options.pathTransform === 'function'
    ? options.pathTransform
    : undefined

  for (const dir of files.map(f => path.join(f)/*normalize file path*/)) {
    const stats = await fsPromises.lstat(dir)
    stats.name = pathTransform ? pathTransform(dir) : dir

    if (stats.isFile()) {
      if (stats.size < 1 && options.includeEmptyFile) {
        yield { header: stats, type: 'file' }
      } else {
        const entry = { header: stats, type: 'file' }
        if (options.deferFileRead) {
          entry.data = () => fs.createReadStream(dir)
        } else {
          entry.data = fs.createReadStream(dir)
        }
        yield entry
      }

    } else if (stats.isSymbolicLink()) {
      const entry = { header: stats, type: 'symlink' }
      if (options.dataCallback) {
        entry.data = () => fsPromises.readlink(dir, { encoding: 'buffer' })
      }
      yield entry

    } else if (stats.isDirectory() && options.recursive) {
      if (stats.name && options.includeEmptyDir) {
        yield { header: stats, type: 'directory' }
      }
      const entries = await fsPromises.readdir(dir, { withFileTypes: true })
      if (options.depthFirst) {
        entries.sort((a, b) => {
          if (a.isDirectory()) {
            return b.isDirectory() ? 0 : -1
          } else {
            return b.isDirectory() ? 1 : 0
          }
        })
      }
      const subEntries = entries.map(e => path.join(dir, e.name))
      for await (const sub of walkdir(subEntries, options)) {
        yield sub
      }
    }
  }
}

function isString(s) {
  return s && typeof s === 'string'
}