/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : create.js
 * Desc   : create command
 */

'use strict'

const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const inquirer = require('inquirer')

const { ARCHITECTURES, BUNDLES } = require('../spec')
const { clone } = require('../utilities')
const optparser = require('../optparser')
const banner = require('../banner')
const logger = require('../logger')

module.exports = create

const HELP = `
ecs create          start an interactive bundle creating wizard
`



const autoMountLib = {
  'destination': '/lib',
  'source': '/lib',
  'options':['rx']
}

const autoMountJsBin = {
  'destination': '/bin/javascript',
  'source': '/bin/javascript',
  'options':['rx']
}

async function create (argv, options) {
  let parsedArgv
  try {
    parsedArgv = optparser.parseArgv(argv, { $help: true })
  } catch (err) {
    logger.warn(err.message)
    return printCmdHelp()
  }
  if (parsedArgv.$help) {
    return printCmdHelp()
  }

  const { configTemplate } = options
  const configJson = clone(configTemplate)
  
  // TODO: we should start the inquiry depending on the parsredArgv
  const answers = await inquireBundleOptions()
  const { BUNDLE, ARCH, MOUNT, process } = answers
  configJson.platform.arch = ARCH

  const pathToRootfs = path.join(BUNDLE, 'rootfs')
  const pathToConfig = path.join(BUNDLE, 'config.json')
  const pathToStartup = path.join(pathToRootfs, 'etc', 'startup.sh')

  await fsPromises.mkdir(pathToRootfs, { recursive: true })

  if (MOUNT.JSRE) {
    configJson.mounts.push(autoMountLib)
    configJson.mounts.push(autoMountJsBin)                
  }            
  if (process && process.args) {
    configJson.process.args = process.args.split(/\s/)
  }

  await fsPromises.writeFile(pathToConfig, stringify(configJson)).then(
    () =>  logger.info ('+ created', pathToConfig),
    err => logger.error('- create failed', pathToConfig, err) || Promise.reject(err))

  if (options.startup) {
    await fsPromises.mkdir(path.dirname(pathToStartup), { recursive: true })

    let startupSh = ''
    if (options.startup.shstack) {
      startupSh += `shstack ${options.startup.shstack}`
    }
    startupSh += '\n'
    
    await fsPromises.writeFile(pathToStartup, startupSh).then(
      () =>  logger.info ('+ created', pathToStartup),
      err => logger.error('- create failed', pathToStartup, err) || Promise.reject(err))
  }

  for (const bundle of BUNDLES) {
    const pathToDir = path.join(pathToRootfs, bundle)
    await fsPromises.mkdir(pathToDir, { recursive: true }).then(
      () =>  logger.info ('+ created', pathToDir),
      err => logger.error('- create failed', pathToDir, err) || Promise.reject(err))
  }

  logger.info('+ done!')
}


function inquireBundleOptions () {
  const questions = [
    {
      type: 'input',
      name: 'BUNDLE',
      message: 'What is name for the bundle (directory)?',
      validate: validateBundleName
    },
    {
      type: 'list',
      name: 'ARCH',
      message: 'What is the architecture(s) of the bundle?',
      choices: ARCHITECTURES,
    },
    {
      type: 'confirm',
      name: 'MOUNT.JSRE',
      message: 'Would you mount and reuse JSRE from the container host?',
    },
    {
      type: 'input',
      name: 'process.args',
      message: 'What is the start parameter (process.args) of the image?'
    },
  ]
  banner()
  return inquirer.prompt(questions)
}

function validateBundleName (name) {
  if (name) {
    try {
      // we have to use sync API to block inquirer flow
      fs.accessSync(name)
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        return true
      }
    }
  }
  return `directory "${name}" alreay exist!`
}

function printCmdHelp () {
  logger.info(HELP)
}

function stringify (obj) {
  return JSON.stringify(obj, null, '  ')
}