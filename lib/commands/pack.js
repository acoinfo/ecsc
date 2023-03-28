/**
 * Copyright (C) 2023 ACINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Wangxuan <wangxuan@acoinfo.com>
 * File   : pack.js
 * Desc   : pack OCI bundle (dir) as ECS (OCI compliant) image.
 */

const os = require('os')
const fs = require('fs')
const path = require('path')
const hash = require('crypto')
const fsPromises = require('fs/promises')
const { Transform } = require('stream')

const tar = require('../tar')
const flatten = require('../utilities').flatten
const optparser = require('../optparser')
const logger = require('../logger')

module.exports = pack

const HELP = `
ecsc pack <bundle> [-t name[:tag]] [tarball_path]

  bundle            the container runtime bundle directory
  name[:tag]        container image name and tag, defaults to 'bundle:latest'
  tarball_path      optional tarball file name, defaults to 'bundle.arch.tar'
`

/**
 * @param {String} digest 
 * @param {String} parentDigest 
 */
function createLayerJson(digest, parentDigest) {
  const layerjson = {
    id: digest,
    created: isoDatePadding(),
    os: 'sylixos',
    container_config: {
      Hostname: '',
      Domainname: '',
      User: '',
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      Env: null,
      Cmd: null,
      Image: '',
      Volumes: null,
      WorkingDir: '',
      Entrypoint: null,
      OnBuild: null,
      Labels: null
    }
  }
  if (parentDigest) {
    layerjson.parent = parentDigest
  }
  return JSON.stringify(layerjson)
}

/**
 * @param {String} name 
 * @param {String} tag 
 * @param {String} imageDigest 
 */
function createRepositories(name, tag, imageDigest) {
  const repositories = {
    [name]: {
      [tag]: imageDigest
    }
  }
  return JSON.stringify(repositories)
}

/**
 * Create image.json:
 * https://github.com/opencontainers/image-spec/blob/main/config.md#properties
 * @param {*} image 
 * @returns 
 */
function createConfig (rtConfig, imageDigest) {
  // RFC33939 is a more specific profile of ISO8601 (Date.prototype.toISOString)
  // https://www.rfc-editor.org/rfc/rfc3339#page-2
  const createdTm = new Date().toISOString()
  const imgConfig = {
    created: createdTm,
    // author: null,
    architecture: rtConfig.platform.arch,
    os: 'sylixos',
    config: {
      User: rtConfig.process.user.uid + ':' + rtConfig.process.user.gid,
      // ExposedPorts: null,
      Env: rtConfig.process.env,
      Entrypoint: rtConfig.process.args,
      // Cmd: null,
      // Volumes: null,
      WorkingDir: '/' + rtConfig.root.path,
      Labels: {
        hostname: rtConfig.hostname,
      }
    },
    rootfs: {
      type: 'layers',
      diff_ids : ['sha256:' + imageDigest]
    },
    history: [{
      created: createdTm,
      // author: null,
      created_by: 'ecsc',
      // comment: null,
      empty_layer: false
    }]
  }

  for (let i = 0; i < rtConfig.mounts.length; i++) {
    const labelDst = 'mounts.' + i + '.destination'
    imgConfig.config.Labels[labelDst] = rtConfig.mounts[i].destination
    const labelSrc = 'mounts.' + i + '.source'
    imgConfig.config.Labels[labelSrc] = rtConfig.mounts[i].source
    const labelOpt = 'mounts.' + i + '.options'
    imgConfig.config.Labels[labelOpt] = rtConfig.mounts[i].options[0]
  }

  for (let i = 0; i < rtConfig.sylixos.commands.length; i++) {
    const labelCmd = 'sylixos.commands.' + i
    imgConfig.config.Labels[labelCmd] = rtConfig.sylixos.commands[i]
  }

  for (let i = 0; i < rtConfig.sylixos.devices.length; i++) {
    const labelPath = 'sylixos.devices.' + i + '.path'
    imgConfig.config.Labels[labelPath] = rtConfig.sylixos.devices[i].path
    const labelAccess = 'sylixos.devices.' + i + '.access'
    imgConfig.config.Labels[labelAccess] = rtConfig.sylixos.devices[i].access
  }

  const labels = imgConfig.config.Labels
  for (const [k, v] of Object.entries(flatten(rtConfig.sylixos.resources))) {
    labels[`sylixos.resources.${k}`] = String(v)
  }
  for (const [k, v] of Object.entries(flatten(rtConfig.sylixos.network))) {
    labels[`sylixos.network.${k}`] = String(v)
  }

  const imageConfig = JSON.stringify(imgConfig)
  const imageConfigDigest = hash.createHash('sha256').update(imageConfig).digest('hex')

  return { imageConfig, imageConfigDigest }
}

function createManifest (name, tag, imageConfigDigest, layerDigest) {
  const manifest = [{
    Config: `${imageConfigDigest}.json`,
    RepoTags: [`${name}:${tag}`],
    Layers: [`${layerDigest}/layer.tar`]
  }]
  return JSON.stringify(manifest)
}

async function pack (argv) {
  try {
    const { bundle, tarball, name, tag } = await validateInput(argv)
    const rootfs = path.join(bundle, 'rootfs')
    const rtConfig = await fsPromises.readFile(path.join(bundle, 'config.json'))
    
    const outputTar = tar.pack()
    const outputStream = outputTar.pipe(fs.createWriteStream(tarball))
    
    const { layerTarFile, size } = await rootfsToLayerTar(rootfs)
    const layerTarDigest = await promisifyEvent('finish',
      fs.createReadStream(layerTarFile).pipe(hash.createHash('sha256')),
      layerTarHash => layerTarHash.digest('hex'))

    await new Promise((resolve, reject) => {
      outputTar.entry({ name: layerTarDigest, type: 'directory' })
      const header = { name: `${layerTarDigest}/layer.tar`, type: 'file', size }
      const layerTarEntry = outputTar.entry(header)
      fs.createReadStream(layerTarFile)
        .pipe(layerTarEntry)
        .once('error', reject)
        .once('finish', () => {
          logger.info(`+ pack ${layerTarDigest}/layer.tar`)
          fsPromises.unlink(layerTarFile)
          resolve()
        })
    })
    
    const outputTarEntry = asyncEntry.bind(outputTar)
    await outputTarEntry({ name: `${layerTarDigest}/VERSION` }, '1.0')
    await outputTarEntry({ name: `${layerTarDigest}/json` }, createLayerJson(layerTarDigest))

    const { imageConfig, imageConfigDigest } = createConfig(JSON.parse(rtConfig), layerTarDigest)
    await outputTarEntry({ name: `${imageConfigDigest}.json`}, imageConfig)
    
    await outputTarEntry({ name: 'repositories'}, createRepositories(name, tag, layerTarDigest))
    await outputTarEntry({ name: 'manifest.json'}, createManifest(name, tag, imageConfigDigest, layerTarDigest))

    outputTar.finalize()
    
    return promisifyEvent('finish', outputStream)
      .then(() => logger.info('+ done!'))

  } catch (err) {
    logger.error('-', err.message)
    logger.error('- exit!')
  }
}

async function rootfsToLayerTar (rootfs, tarfile = 'layer.tar') {
  const tmpdir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'ecsc-'))
  const layerTarFile = path.join(tmpdir, tarfile)
  
  const pack = tar.pack()
  const pathTransform = trimBase.bind(null, path.dirname(rootfs))
  const outputStream = fs.createWriteStream(layerTarFile)

  let bytes = 0
  pack.pipe(new Transform({
    transform(chunk, _, callback) {
      bytes += chunk.length
      callback(null, chunk)
    }
  })).pipe(outputStream)
  tar.tar(pack, tar.walkdir([rootfs], { pathTransform }))
    .then(() => pack.finalize())

  return promisifyEvent('close', outputStream, () => ({ layerTarFile, size: bytes }))
}

async function validateInput(argv) {
  let parsedArgv
  try {
    parsedArgv = optparser.parseArgv(argv, { $help: true, t: true })
  } catch (err) {
    logger.warn('-', err.message)
    return printCmdHelp()
  }
  if (parsedArgv.$help) {
    return printCmdHelp()
  }

  const { $argv, t: inputTag } = parsedArgv
  const [bundle, ...args] = $argv

  const config = await validateBundle(bundle)
  const bundleDirname = path.basename(bundle)

  let { tarball } = validateInputArgs(args)
  if (!tarball) {
    tarball = `${bundleDirname}.${config.platform.arch}.tar`
  }
  const [name, tag] = validateInputTag(bundleDirname, inputTag)

  return { bundle, tarball, name, tag }
}

async function validateBundle (bundle) {
  if (!isString(bundle)) {
    throw Error ('bundle is required and must be a string!')
  }
  const pathToConfig = path.join(bundle, 'config.json')
  const config = await fsPromises.readFile(pathToConfig)
  return JSON.parse(config)
}

function validateInputArgs (inputArgs) {
  const [tarball] = inputArgs
  if (tarball) {
    if (!isString(tarball)) {
      throw Error ('tarball_path must be a non-empty string!')
    }
    return tarball.endsWith('.tar') ? { tarball } : { tarball: tarball + '.tar' }
  }
  return {}
}

function validateInputTag (bundleDirname, inputTag) {
  if (inputTag == null) {
    return [bundleDirname, 'latest']
  }
  if (!isString(inputTag)) {
    throw Error('name and tag must be non-empty string')
  }
  const sections = inputTag.split(':')
  if (sections.length > 2) {
    throw Error(`invalid name tag ${inputTag}`)
  } else if (sections.length === 2) {
    return sections
  }
  return [inputTag, 'latest']
}

function isString (s) {
  return s && typeof s === 'string'
}

function trimBase (baseToTrim, filepath) {
  const base = path.join(baseToTrim)
  const baseLen = base.length + 1 // 1 = last '/'
  if (filepath.startsWith(base)) {
    return filepath.substring(baseLen)
  }
  return filepath
}

function asyncEntry (header, buffer) {
  logger.info(`+ pack ${header.name}`)
  return new Promise((resolve, reject) => {
    this.entry(header, buffer, err => {
      if (err) return reject(err)
      resolve()
    })
  })
}

function promisifyEvent (event, emitter, cb) {
  return new Promise((resolve, reject) => {
    emitter.once(event, () => resolve(typeof cb === 'function' ? cb(emitter) : cb))
      .once('error', reject)
  })
}

function isoDatePadding (date = new Date()) {
  const iso = date.toISOString()
  return `${iso.substring(0, 23)}000000Z`
}

function printCmdHelp () {
  logger.info(HELP)
}