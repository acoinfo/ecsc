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
const { ARCHITECTURES, BUNDLES } = require('ecsc/lib/spec')
const optparser = require('ecsc/lib/optparser')
const logger = require('ecsc/lib/logger')
const pack = require('./pack')

module.exports = build

const HELP = `
ecs build [options]  build image with options. 

  -h | --help     print this help document
  -f | --file     set ecsfile path
  -t | --tag      set image tag

CPU Architect
  noarch, x86-64, arm64, arm, riscv64, mips64, ppc, loongarch

Example
  ecs build -t apache:latest -f /path/to/ecsfile'
`

const copyFileList = []
const defaultMounts = [
  {
    'destination': '/etc/lic',
    'source': '/etc/lic',
    'options': 'rx'
  }
]
const cmdSpec = {
  $help: true,
  f: verifyEcsfile,   // optional ecsfile path, to be verified if set
  t: verifyTag,   // option image tag, to be verified if set
}

const ecsFileDefault = 'Ecsfile'

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

  const { configTemplate } = options

  let { ECSFILE, TAG } = await makeOptions(parsedArgv)

  const BUNDLE = TAG.split(':')[0] // get bundle by TAG
  logger.info(`ECSFILE: ${ECSFILE}, TAG: ${TAG}, BUNDLE: ${BUNDLE}`)

  configTemplate.mounts.length = 0
  const configJson = await parseEcsfile(ECSFILE, configTemplate) // parse ecsfile

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

function parseEcsfile(ecsfile, configJson) {
  return new Promise((resolve, reject) => {
    fsPromises.readFile(path.resolve(ecsfile), 'utf8')
      .then((data) => {
        const lines = data.split('\n')
        lines.forEach((line, index) => {
          if (line.trim() && !line.startsWith('#')) { // filter empty line and comment
            if (line.endsWith('\r'))
              line = line.slice(0, -1)
            line = line.trim().replace(/\s+/g, ' ') // replace multiple spaces
            const rows = line.split(' ')
            const cmd = rows[0]
            const args = rows.slice(1)
            let mount 
            let cp 
            switch (cmd) {
            case 'ARCH':
              if (ARCHITECTURES.includes(args[0])) { // verify arch is in ARCHITECTURES
                configJson.platform.arch = args[0]
              } else {
                logger.error('Unsupported arch: ' + args[0])
                reject('Unsupported arch: ' + args[0])
              }
              break
            case 'MOUNT':
              mount = {
                'destination': args[0],
                'source': args[1],
                'options': args.slice(2)
              }
              configJson.mounts.push(mount)
              break
            case 'ENV':
              if ((args[0].match(/=/g) || []).length !== 1) {
                reject('env format error: ' + index + ' ' + args[0])
              } else {
                configJson.process.env.push(args[0])
              }
              break
            case 'CMD':
              configJson.process.args = args
              break
            case 'ADD': case 'COPY':
              console.log('config add:', args)
              
              cp = {
                from: args[0],
                to: args[1]
              }
              console.log('copyfile:', cp)
              copyFileList.push(cp)
              break
            case 'WORKDIR':
              configJson.process.cwd = args[0]
              break
            }
          }
        })

        for (const defaultMount in defaultMounts) { // add default mount
          if (!configJson.mounts.includes(defaultMounts[defaultMount])) {
            configJson.mounts.push(defaultMounts[defaultMount])
          }
        }

        resolve(configJson)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function printCmdHelp() {
  logger.info(HELP)
}

function stringify(obj) {
  return JSON.stringify(obj, null, '  ')
}

function makeOptions(parsedArgv) {
  const cliOpts = Object.keys(parsedArgv).filter(k => !k.startsWith('$'))
  if (cliOpts.length < 1) { // start wizard if no cli args
    printCmdHelp()
    process.exit()
  }

  try {
    const { f: ff, t: tt } = parsedArgv
    if (fs.existsSync(ff)) {
      const ecsfileDir = verifyEcsfile(ff)
      const tag = verifyTag(tt)
      const bundleOptions = { ECSFILE: ecsfileDir, TAG: tag }
      return bundleOptions
    }
  } catch (err) {
    logger.error(err.message)
    printCmdHelp()
    process.exit()
  }
}

function verifyEcsfile(dir) {
  if (!(dir && typeof dir === 'string')) {
    throw Error('Bundle directory is required!')
  }
  const parent = path.resolve(dir)

  try {
    fs.accessSync(parent, fs.constants.W_OK)
  } catch (err) {
    throw Error(`Bundle directory's parent '${parent}' is not writable!`)
  }
  return path.join(parent, ecsFileDefault)
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
