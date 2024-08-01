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

const { ARCHITECTURES, BUNDLES, DEFAULT_ARCH } = require('../spec')
const { clone } = require('../utilities')
const optparser = require('../optparser')
const banner = require('../banner')
const logger = require('../logger')

module.exports = create

const HELP = `
ecs create [options]  create bundle with options or start an interactive wizard. 

  -h | --help     print this help document
  -d directory    path to local OCI bundle directory to be created.
  -a arch         CPU architect to use, defaults to 'noarch' if not set, check
                  CPU Architect section for more information.
  -p args         container process (entrypoint) and its arguments.
  -j              if set, mount and use host JSRE files.
  -o              if set, overwrite exsiting bundle directory if exist.

CPU Architect
  noarch, x86-64, x86, arm64, arm, riscv64, riscv32, mips64, mips32, ppc, loongarch, csky, sparc

Example
  ecs create -d ./demo -p '/bin/javascript /apps/demo.js'
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

const cmdSpec = {
  $help: true,
  d: verifyBundleDir,   // optional bundle dir, to be verified if set
  p: verifyProcessArgs, // optional process args, to be verified if set
  a: verifyArch,  // optional, cpu arch
  j: null, // boolean, mount and re-use host JSRE
  o: null, // boolean, overwrite exiting bundle dir
}

async function create (argv, options) {
  let parsedArgv
  try {
    parsedArgv = optparser.parseArgv(argv, cmdSpec)
  } catch (err) {
    logger.warn(err.message)
    return printCmdHelp()
  }
  if (parsedArgv.$help) {
    return printCmdHelp()
  }

  const { configTemplate } = options
  const configJson = clone(configTemplate)
  const bundleOptions = await makeOptions(parsedArgv)

  const { BUNDLE, ARCH, MOUNT, PROCESS } = bundleOptions

  configJson.platform.arch = ARCH
  logger.info ('+ config arch:', ARCH)

  if (PROCESS.ARGS) {
    configJson.process.args = PROCESS.ARGS.split(/\s/)
  }
  logger.info ('+ config process.args:', configJson.process.args)

  const pathToRootfs = path.join(BUNDLE, 'rootfs')
  const pathToConfig = path.join(BUNDLE, 'config.json')
  const pathToStartup = path.join(pathToRootfs, 'etc', 'startup.sh')

  await fsPromises.mkdir(pathToRootfs, { recursive: true })
  logger.info ('+ config rootfs:', pathToRootfs)

  configJson.mounts.push(autoMountLib)
  if (MOUNT.JSRE) {
    configJson.mounts.push(autoMountJsBin)
    logger.info ('+ config mounts:', configJson.mounts)
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
      message: 'What is the architecture of the bundle?',
      choices: ARCHITECTURES,
    },
    {
      type: 'confirm',
      name: 'MOUNT.JSRE',
      message: 'Would you mount and reuse JSRE from the container host?',
    },
    {
      type: 'input',
      name: 'PROCESS.ARGS',
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
  return `Directory "${name}" alreay exist!`
}

function printCmdHelp () {
  logger.info(HELP)
}

function stringify (obj) {
  return JSON.stringify(obj, null, '  ')
}

function makeOptions (parsedArgv) {
  const cliOpts = Object.keys(parsedArgv).filter(k => !k.startsWith('$'))
  if (cliOpts.length < 1) { // start wizard if no cli args
    return inquireBundleOptions()
  }

  try {
    const { d: bundleDir, o: overwrite } = parsedArgv
    if (fs.existsSync(bundleDir)) {
      if (overwrite) {
        fs.rmdirSync(bundleDir, { recursive: true })
      } else {
        throw Error(`Bundle directory '${bundleDir}' already exists!`)
      }
    }

    const MOUNT = {
      JSRE: typeof parsedArgv.j === 'boolean' ? parsedArgv.j : true
    }
    const PROCESS = {
      ARGS: parsedArgv.p
    }
    return { BUNDLE: bundleDir, ARCH: parsedArgv.a ?? DEFAULT_ARCH , MOUNT, PROCESS }
  } catch (err) {
    logger.error(err.message)
    printCmdHelp()
    process.exit()
  }
}

function verifyBundleDir (dir) {
  if (!(dir && typeof dir === 'string')) {
    throw Error('Bundle directory is required!')
  }
  const parent = path.dirname(dir)
  try {
    fs.accessSync(parent, fs.constants.W_OK)
  } catch (err) {
    throw Error(`Bundle directory's parent '${parent}' is not writable!`)
  }
  return dir
}

function verifyArch (arch) {
  if (arch === undefined) {
    return ARCHITECTURES[0] // noarch
  }
  if (!ARCHITECTURES.includes(arch)) {
    throw Error(`Unsupported arch: '${arch}'`)
  }
  return arch
}

function verifyProcessArgs (args) {
  if (! (args && typeof args === 'string')) {
    throw Error('Process args is required!')
  }
  return args
}