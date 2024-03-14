#!/usr/bin/env node

/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Wangxuan <wangxuan@acoinfo.com>
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
  }, 
  build: {
    configTemplate: loadConfigTemplate('config.json5'),
    startup: { shstack: 200000 }
  }
}

run()

function run() {
  try {
    const parsedOptions = optparser.parseProcessArgv()

    if (parsedOptions.$help) {
      return Commands.help()
    }
    if (parsedOptions.$version) {
      return Commands.version()
    }

    if (parsedOptions.$cmd) {
      const cmd = parsedOptions.$cmd
      const command = Commands[cmd]
      if (command) {
        return command(parsedOptions.$argv, config[cmd])
      }
      logger.warn(`Command "${cmd}" is not supported`)
    } else if (parsedOptions.$argv.length > 0) {
      logger.warn(`Option "${parsedOptions.$argv[0]}" is not supported`)
    }
  } catch (err) {
    logger.warn(err.message)
  }
  return Commands.help()
}

function loadConfigTemplate(json5) {
  const loaded = fs.readFileSync(path.join(__dirname, json5))
  return JSON5.parse(loaded)
}
