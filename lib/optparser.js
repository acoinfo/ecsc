/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : optparser.js
 * Desc   : command line options parser
 */

/**
 * CLI Client modules should try catch exceptions from this module and print
 * help document and hint message within the error object.
 */

module.exports = {
  parseString,
  parseProcessArgv,
  parseArgv,
}

/**
 * @typedef {(boolean|RegExp|{r:boolean, v:Function})} CmdOptionValueSpec
 * @example
 * const optsValueSpec = { 
 *   o1: truthy,    // required option
 *   o2: false,     // acceptable optional boolean (flag) option
 *   o4: /regexp/,  // required and verified by /regexp/
 *   o3: { o: true, v: ()=>{} } // optional but verified by fn
 * }
 * 
 * @typedef {{[k: string ]: CmdOptionValueSpec}} CmdOptionSpec
 * 
 * @typedef {'_entry'|'_help'|'_version'|string} CmdOptionsKey
 * @typedef {{[k: CmdOptionsKey]: boolean|string}} CmdOptions
 * 
 * @param {CmdOptionSpec} [optionSpec]
 * @returns {CmdOptions}
 */
function parseProcessArgv (optionSpec) {
  // application can always get 'exec' via process.argv0
  const [/*exec:nodeBinary*/, _entry, ...args] = process.argv
  return Object.assign({ _entry }, parseArgv(optionSpec, args))
}

/**
 * @param {CmdOptionSpec|Array<CmdOptionSpec>} [optionSpec]
 * @param {string} argv
 * @returns {CmdOptions}
 */
function parseString (optionSpec, argv) {
  if (typeof optionSpec === 'string') {
    argv = optionSpec
    optionSpec = undefined
  }
  if (isString(argv)) {
    return parseArgv(optionSpec, argv.split(/\s/))
  }
}

/**
 * 
 * @param {CmdOptionSpec|Array<CmdOptionSpec>} [optionSpec]
 * @param {Array<string>} argv
 * @returns {CmdOptions}
 */
function parseArgv (optionSpec, argv) {
  if (typeof optionSpec === 'string' || Array.isArray(optionSpec)) {
    argv = optionSpec
    optionSpec = undefined
  }

  if (isString(argv)) {
    argv = [argv]
  } else if (!(Array.isArray(argv) && argv.every(isString))) {
    throw Error('argv must be an array of string')
  }

  if (['--help', '-h'].includes(argv[0])) {
    return { _help: true }
  }
  if (['--version', '-v'].includes(argv[0])) {
    return { _version: true }
  }

  const _cmd = getFirstOptionAsCmd(argv)
  if (!(optionSpec && typeof optionSpec === 'object')) {
    if (_cmd) {
      return { _cmd, _argv: argv } // { _cmd: 'xx', argv: ['xx', 'xx'.. ] }
    }
    return { _argv: argv }
  }
  
  const n = argv.length
  const result = _cmd ? { _cmd } : {}

  for (let i = 0; i < n; i++) {
    const arg = argv[i]
    let opt = ''

    if (arg === '--') {
      continue // just ignore for now
    } else if (arg.startsWith('--')) {
      opt = arg.substring('2')
    } else if (arg.startsWith('-')) {
      opt = arg.substring('1')
    } else {
      throw Error(`option "${arg}" is not supported`)
    }

    if (!Object.prototype.hasOwnProperty.call(optionSpec, opt)) {
      throw Error(`option "${arg}" is not supported`)
    }

    let optValue
    const optValueSpec = optionSpec[opt]
    if (typeof optValueSpec === 'boolean') {
      optValue = true
    } else if (optValueSpec instanceof RegExp) {
      optValue = verifyOptionValue(i++, optValueSpec)
    } else if (typeof optValueSpec === 'function') {
      optValue = verifyOptionValue(i++, optValueSpec)
    } else if (typeof optValueSpec === 'object') {
      optValue = verifyOptionValue(i++, optValueSpec.v)
    }
    result[opt] = optValue
  }

  assertRequiredOptions(optionSpec, Object.keys(result))

  return result

  function verifyOptionValue (i, verifier) {
    if (i + 1 >= n) {
      throw Error(`option "${argv[i]}" requires an option value`)
    }
    const optValue = argv[i + 1]
    const error = Error(`option "${argv[i]}" has invalid value "${optValue}"`)
    if (typeof verifier === 'function') {
      if (!verifier(optValue)) throw error
    } else if (verifier instanceof RegExp) {
      if (!verifier.exec(optValue)) throw error
    } else if (verifier) {
      throw Error(`option "${argv[i]}" has invalid verifier`)
    }
    return optValue
  }
}

function getFirstOptionAsCmd (argv) {
  if (Array.isArray(argv) && argv.length > 0) {
    const match = /^\s*\w[\w\d]*\s*$/.exec(argv[0])
    if (match) {
      return argv.shift().trim()
    }
  }
}

function assertRequiredOptions (optionSpec, parsedOpts) {
  const options = Object.keys(optionSpec)
  options.forEach(o => {
    const optArgSpec = optionSpec[o]
    if (optArgSpec) { 
      if (!parsedOpts.includes(o)) {
        if (typeof optArgSpec === 'object' && optArgSpec.o) {
          return
        }
        const opt = o.length > 1 ? `--${o}` : `-${o}`
        throw Error(`option "${opt}" is required`)  
      }
    }
  })
}

function isString (s) {
  return s && typeof s === 'string'
}