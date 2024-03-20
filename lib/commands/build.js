/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : yanchaodong <yanchaodong@acoinfo.com>
 * File   : build.js
 * Desc   : build command
 */

'use strict'

const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const { BUNDLES } = require('../spec')
const optparser = require('../optparser')
const pack = require('./pack')
const ecsfile = require('../ecsfile')
const logger = require('../logger')

module.exports = build

const HELP = `
ecs build [options] PATH

Start OCI image build from given PATH, where an Ecsfile is required.

Options
  -h | --help     print this help document
  -t | --tag      set image tag

CPU Architect
  noarch, x86-64, arm64, arm, riscv64, mips64, ppc, loongarch

Example
  ecs build -t apache:latest -f /path/to/ecsfile'
`

const DEFAULT_ECSFILE = 'Ecsfile'


const cmdSpec = {
  $help: true,
  t: verifyTag,   // optional image tag, to be verified if set
}

async function build(argv, options) {
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

  const { configTemplate: configJson } = options
  const { ECSFILE, TAG } = makeOptions(parsedArgv)
  const BUNDLE = TAG.split(':')[0] // get bundle by TAG

  logger.info(`Build start from ${ECSFILE}${TAG ? ', with tag ' + TAG : ''}`)
  configJson.mounts.length = 0

  const ecsfileBase = path.dirname(ECSFILE)
  const ecsfileContent = await fsPromises.readFile(ECSFILE, 'utf8')

  const copyFileList = await ecsfile.parse(ecsfileContent, ecsfileBase, configJson)
  const pathToRootfs = path.join(BUNDLE, 'rootfs') // generate rootfs path
  const pathToConfig = path.join(BUNDLE, 'config.json') // generate config.json path
  const pathToStartup = path.join(pathToRootfs, 'etc', 'startup.sh') // generate startup.sh path

  await fsPromises.mkdir(pathToRootfs, { recursive: true }) // create rootfs
  logger.info('+ builded', pathToRootfs)

  await fsPromises.writeFile(pathToConfig, stringify(configJson)).then( // create config.json
    () => logger.info('+ builded', pathToConfig),
    err => logger.error('- build failed', pathToConfig, err) || Promise.reject(err))

  for (const bundle of BUNDLES) { // create bundle
    const pathToDir = path.join(pathToRootfs, bundle)
    await fsPromises.mkdir(pathToDir, { recursive: true }).then(
      () => logger.info('+ builded', pathToDir),
      err => logger.error('- build failed', pathToDir, err) || Promise.reject(err))
  }

  let startupSh = ''
  if (options.startup.shstack) {
    startupSh += `shstack ${options.startup.shstack}`
  }

  startupSh += '\n'
  logger.info('startupsh: ', startupSh)

  await fsPromises.mkdir(path.dirname(pathToStartup), { recursive: true }).then(
    () => logger.info('+ builded', path.dirname(pathToStartup)),
  )
  await fsPromises.writeFile(pathToStartup, startupSh).then( // create startup.sh
    () => logger.info('+ builded', pathToStartup),
    err => logger.error('- build failed', pathToStartup, err) || Promise.reject(err)
  )

  for (const file of copyFileList) { // copy files by copyFileList
    await doCopyFile(file.from, path.join(pathToRootfs, file.to))
  }

  const pack_command = `${BUNDLE} -t ${TAG}`
  pack(pack_command.split(' ')) // ecs pack
}

function printCmdHelp() {
  logger.info(HELP)
}

function stringify(obj) {
  return JSON.stringify(obj, null, '  ')
}

function makeOptions(parsedArgv) {
  const [PATH] = parsedArgv.$argv
  if (!PATH) { // build PATH is required
    printCmdHelp()
    process.exit()
  }

  try {
    const { t: optTag } = parsedArgv
    const ecsfile = verifyEcsfilePath(PATH)
    const tag = verifyTag(optTag)
    return { ECSFILE: ecsfile, TAG: tag }
  } catch (err) {
    logger.error(err.message)
    printCmdHelp()
    process.exit()
  }
}

function verifyEcsfilePath(dir) {
  try {
    const stats = fs.statSync(dir)
    if (!stats.isDirectory()) {
      throw Error()
    }
  } catch {
    throw Error('Build PATH directory is required!')
  }
  const ecsfile = path.resolve(dir, DEFAULT_ECSFILE)
  try {
    fs.accessSync(ecsfile, fs.constants.R_OK)
  } catch {
    throw Error(`Build PATH "${dir}" has no ${DEFAULT_ECSFILE} or not readable!`)
  }
  return ecsfile
}

function verifyTag(tag) {
  if (tag === undefined) {
    return 'none'
  }
  return tag
}

async function doCopyFile(src, dest)
{
  return new Promise((resolve, reject) => {
    const copyFile = async (src, dest) => {
      try {
        await fsPromises.mkdir(path.dirname(dest), { recursive: true })
        await fsPromises.copyFile(src, dest)
        resolve()
      } catch (err) {
        reject(err)
      }
    }

    const copyFolder = async (src, dest) => {
      try {
        await fsPromises.mkdir(dest, { recursive: true })
        const files = await fsPromises.readdir(src)
        for (const file of files) {
          const srcPath = path.join(src, file)
          const destPath = path.join(dest, file)
          const stat = await fsPromises.stat(srcPath)
          if (stat.isDirectory()) {
            await copyFolder(srcPath, destPath)
          } else {
            await copyFile(srcPath, destPath)
          }
        }
        resolve()
      } catch (err) {
        reject(err)
      }
    }

    fsPromises.stat(src)
      .then((stat) => {
        if (stat.isDirectory()) {
          copyFolder(src, dest)
        } else {
          copyFile(src, dest)
        }
      })
      .catch((err) => reject(err))
  })
}