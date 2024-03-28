/**
 * Copyright (C) 2024 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : ecsfile.js
 * Desc   : Ecsfile processor
 */

'use strict'

const path = require('path')
const { ARCHITECTURES } = require('./spec')

const DefaultMounts = [
  { 'destination': '/etc/lic', 'source': '/etc/lic', 'options': 'rx' }
]

const ErrorCodes = {
  'ARCH': 1,
  'MOUNT': 2,
  'ENV': 3,
  'COPY': 4
}

class EcsfileError extends Error {
  static ErrorCodes = ErrorCodes

  constructor(code, message) {
    super(message)
    this._code = code
  }

  get code () { return this._code }
}

module.exports = {
  EcsfileError,
  parse
}

async function parse(ecsfile, basedir, configJson) {
  const copyFileList = []
  const columnSep = ' '

  ecsfile.split(/[\r\n]/).forEach((line, index) => {
    line = line.replace(/\s\s+/g, ' ').trim()
    if (line.startsWith('#') || line.length < 1) {
      return // filter empty line and comment
    }

    const [cmd, ...args] = line.split(columnSep)

    switch (cmd) {
    case 'ARCH':
      configJson.platform.arch = verifyArch(args[0], index)
      break
    case 'MOUNT':
      configJson.mounts.push({
        'destination': args[0],
        'source': args[1],
        'options': args.slice(2)
      })
      break
    case 'ENV':
      configJson.process.env.push(verifyEnv(args[0], index))
      break
    case 'CMD':
      configJson.process.args = args
      break
    case 'WORKDIR':
      configJson.process.cwd = args[0]
      break
    case 'ADD': 
    case 'COPY':
      verifyCopy(args, index, basedir, copyFileList)
      break
    }
  })
  
  for (const defaultMount in DefaultMounts) { // add default mount
    if (!configJson.mounts.includes(DefaultMounts[defaultMount])) {
      configJson.mounts.push(DefaultMounts[defaultMount])
    }
  }

  return copyFileList
}

function verifyArch (archName, index) {
  if (ARCHITECTURES.includes(archName)) { // verify arch is in ARCHITECTURES
    return archName
  }
  throw EcsfileError(ErrorCodes.ARCH, `ARCH name is unsupported: ${archName} at line ${index}`)
}

function verifyEnv (envExpr, index) {
  const regexp = /^\w+=[^:]+(?::[^:]+)*$/
  if (regexp.test(envExpr)) {
    return envExpr
  }
  throw EcsfileError(ErrorCodes.ENV, `ENV expression is invalid: "${envExpr}" at line ${index}`)
}

function verifyCopy (args, index, basedir, copyFileList) {
  const [ src, dst ] = args
  const from = path.resolve(basedir, src)
  copyFileList.push({ from, to:dst })
}