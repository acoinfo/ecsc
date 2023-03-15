#!/usr/bin/env node

/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : main.js
 * Desc   : command line entrypoint
 */

'use strict'

const fs = require('fs')
const path = require('path')
const JSON5 = require('json5')

const optparser = require('./lib/optparser')
const Commands = require('./lib/commands')

const logger = require('./lib/logger')
const config = {
  create: {
    configTemplate: loadConfigTemplate('config.json5'),
    startup: { shstack: 200000 }
  }
}

run()

function run () {
  const parsedOptions = optparser.parseProcessArgv()

  if (parsedOptions._help) {
    return Commands.help()
  }
  if (parsedOptions._version) {
    return Commands.version()
  }

  if (parsedOptions._cmd) {
    const cmd = parsedOptions._cmd
    const command =  Commands[parsedOptions._cmd]
    if (command) {
      return command(parsedOptions._argv, config[cmd])
    }
    logger.warn(`Command "${parsedOptions._cmd}" is not supported`)
  }
  return Commands.help()
}

function loadConfigTemplate (json5) {
  const loaded = fs.readFileSync(path.join(__dirname, json5))
  return JSON5.parse(loaded)
}