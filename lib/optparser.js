/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : optparser.js
 * Desc   : minimal command line options parser
 */

/**
 * CLI Client modules should try catch exceptions from this module and print
 * help document and hint message from the error object.
 */

const readonlyTrue = { enumerable: true, value: true }
const defaultSpec = Object.defineProperties({}, {
  $help: readonlyTrue,
  $version: readonlyTrue
})

module.exports = {
  defaultSpec,
  parseArgv,
  parseProcessArgv,
  parseString
}

/**
 * @typedef {true|RegExp|((v: string) => boolean)} ValuedOptionValidator
 * 
 * @typedef {{
 *   $cmd?: boolean
 *   $help?: boolean
 *   $version?: boolean
 *   [o: string]: ValuedOptionValidator|null
 * }} OptionSpec
 * 
 * @typedef {{
 *   $cmd?: boolean
 *   $help?: boolean
 *   $version?: boolean
 *   [o: string]: string
 * }} OptionResult
 */

/**
 * @param {OptionSpec} [optionSpec]
 * @returns {OptionResult}
 * @example
 * parseProcessArgv({ foo: /^validation/, flag: null, opt_: true })
 */
function parseProcessArgv (optionSpec) {
  // application can always get 'exec' via process.argv0
  const [/*exec:nodeBinary*/, $entry, ...args] = process.argv
  const spec = optionSpec || { $cmd: true, $help: true, $version: true }
  return Object.assign({ $entry }, parseArgv(args, spec))
}

/**
 * @param {string} argv
 * @param {OptionSpec} [optionSpec]
 * @returns {OptionResult}
 * 
 * @example
 * parseProcessArgv('--foo v32 --flag', { foo: /^v/, flag: null })
 */
function parseString (argv, optionSpec) {
  if (argv == null || argv === '') {
    return { $argv: [] }
  }
  if (isString(argv)) {
    return parseArgv(argv.split(/\s/), optionSpec)
  }
  throw Error('argv must be an non-empty string')
}

/**
 * @param {Array<string>} argv
 * @param {OptionSpec} [optionSpec]
 * @returns {OptionResult}
 */
function parseArgv (argv, optionSpec = defaultSpec) {
  if (!(Array.isArray(argv) && argv.every(isString))) {
    throw Error('argv must be an array of string')
  }
  if (typeof optionSpec !== 'object') {
    throw Error('optionSpec must be an object')
  }

  if (optionSpec.$help) {
    if (['--help', '-h'].includes(argv[0])) {
      return { $help: true }
    }
    if (!optionSpec.$cmd && (argv.includes('--help') || argv.includes('-h'))) {
      return { $help: true }
    }
  }
  if (optionSpec.$version) {
    if (['--version', '-v'].includes(argv[0])) {
      return { $version: true }
    }
    if (!optionSpec.$cmd && (argv.includes('--version') || argv.includes('-v'))) {
      return { $version: true }
    }
  }

  if (optionSpec.$cmd) {
    const cmd = popFirstOptionAsCmd(argv)
    return { $cmd: cmd, $argv: argv }
  }

  const n = argv.length
  const requiredOptions = []
  const result = { $argv: [] }
  optionSpec = normalizeAndFindRequired(optionSpec, requiredOptions)

  for (let i = 0; i < n; i++) {
    const arg = argv[i]
    const len = arg.length
    let opt = ''

    if (arg.startsWith('--')) {
      if (len === 2) {
        continue // just ignore '--' for now
      }
      opt = arg.substring('2')
    } else if (arg.startsWith('-')) {
      if (len === 1) {
        result.$argv.push(arg) // assume useful single dash
        continue
      }
      if (len > 2) {
        opt = arg.substring(1, 2)
        result[opt] = verifyOptionValue(opt, arg.substring(2), optionSpec[opt])
        continue
      }
      opt = arg.substring(1)
    } else {
      result.$argv.push(arg)
      continue
    }

    if (!Object.prototype.hasOwnProperty.call(optionSpec, opt)) {
      throw Error(`option "${arg}" is not supported`)
    }

    let optValue
    const optValueSpec = optionSpec[opt]
    if (optValueSpec == null) {
      optValue = true // no value and verifier for flag option
    } else if (optValueSpec instanceof RegExp) {
      optValue = verifyNextAsOptionValue(i++, optValueSpec)
    } else if (typeof optValueSpec === 'function') {
      optValue = verifyNextAsOptionValue(i++, optValueSpec)
    } else if (optValueSpec) {
      optValue = verifyNextAsOptionValue(i++, true)
    } else {
      throw Error(`option "${opt}" has invalid verifier "${optValueSpec}"`)
    }
    result[opt] = optValue
  }

  assertRequiredOptions(requiredOptions, Object.keys(result))

  return result

  function verifyNextAsOptionValue (i, verifier) {
    if (i + 1 >= n) {
      throw Error(`option "${argv[i]}" requires an option value`)
    }
    return verifyOptionValue(argv[i], argv[i + 1], verifier)
  }
  
  function verifyOptionValue(opt, optValue, verifier) {
    const error = Error(`option "${opt}" has invalid value "${optValue}"`)
    if (typeof verifier === 'function') {
      if (!verifier(optValue)) throw error
    } else if (verifier instanceof RegExp) {
      if (!verifier.exec(optValue)) throw error
    } else if (!verifier) {
      throw Error(`option "${opt}" has invalid verifier`)
    }
    return optValue
  }
}

function normalizeAndFindRequired (optionSpec, requiredOptions) {
  const normalized = {}
  Object.keys(optionSpec)
    .forEach(o => {
      if (isRequiredOption(o)) {
        const normalizedName = o.substring(0, o.length - 1)
        normalized[normalizedName] = optionSpec[o]
        requiredOptions.push(normalizedName)
      } else {
        normalized[o] = optionSpec[o]
      }
    })
  return normalized
}

function popFirstOptionAsCmd (argv) {
  if (Array.isArray(argv) && argv.length > 0) {
    const match = /^\s*[[A-Za-z][\w\d]*\s*$/.exec(argv[0])
    if (match) {
      return argv.shift().trim()
    }
    throw Error(`cmd "${argv[0]}" should starts with alphabet only`)
  }
}

function assertRequiredOptions (requiredOptions, parsedOpts) {
  const opts = new Set(parsedOpts)
  requiredOptions.forEach(o => {
    if (!opts.has(o)) {
      const opt = o.length > 1 ? `--${o}` : `-${o}`
      throw Error(`option "${opt}" is required`)
    }
  })
}

function isRequiredOption (o) {
  return isString(o) && o.endsWith('_') && o.length > 1
}

function isString (s) {
  return s && typeof s === 'string'
}