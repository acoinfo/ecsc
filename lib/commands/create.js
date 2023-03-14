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
const JSON5 = require('json5')

const { clone } = require('../utilities')
const logger = require('../logger')

module.exports = create

const ARCHITECTURES = [
  'x86-64',
  'arm64',
  'arm',
  'mips64',
  'ppc',
  'loongarch'
]

const BUNDLES = [
  '/apps',
  '/home',
  '/bin',
  '/qt',
  '/boot',
  '/dev',
  '/lib',
  '/proc',
  '/root',
  '/sbin',
  '/tmp',
  '/usr',
  '/var',
]

const defaultOptions = { startup: { shstack: 200000 }}
const defaultConfigJson = JSON5.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'config.json5')))

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

async function create (configJson, options = defaultOptions) {
  // ask questions
  const answers = await wizard()
  const { BUNDLE, ARCH, MOUNT, process } = answers
  if (configJson == null) {
    configJson = clone(defaultConfigJson)
  }
  configJson.sylixos.arch = ARCH

  const pathToRootfs = path.join(BUNDLE, 'rootfs')
  const pathToConfig = path.join(BUNDLE, 'config.json')

  await fsPromises.mkdir(pathToRootfs, { recursive: true })

  if (MOUNT.JSRE) {
    configJson.mounts.push(autoMountLib)
    configJson.mounts.push(autoMountJsBin)                
  }            
  if (process && process.args) {
    configJson.process.args = process.args.split(/\s/)
  }

  await fsPromises.writeFile(pathToConfig, JSON.stringify(configJson)).then(
    () =>  logger.info ('+ created', pathToConfig),
    err => logger.error('- create failed', pathToConfig, err) || Promise.reject(err))

  if (options.startup) {
    const pathToStartup = path.join(pathToRootfs, 'etc', 'startup.sh')
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


function wizard () {
  const questions = [
    {
      type: 'input',
      name: 'BUNDLE',
      message: 'What is name for the bundle (directory)?',
      validate: validateBundleName
    },
    {
      type: 'checkbox',
      name: 'ARCH',
      message: 'What is the architecture(s) of the bundle?',
      choices: ARCHITECTURES,
    },
    {
      type: 'confirm',
      name: 'MOUNT.JSRE',
      message: 'Mount and reuse JSRE from the container host?',
    },
    {
      type: 'input',
      name: 'process.args',
      message: 'What is the start parameter (process.args) of the image?'
    },
  ]
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

