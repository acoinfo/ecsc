/**
 * Copyright (C) 2023 ACINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Wangxuan <wangxuan@acoinfo.com>
 * File   : pack.js
 * Desc   : pack OCI bundle (dir) as ECS (OCI compliant) image.
 */

const fs = require('fs')
const path = require('path')
const hash = require('crypto')
const fsPromises = require('fs/promises')

const dayjs = require('dayjs')
const tar = require('tar')
const tarfs = require('tar-fs')

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

class Image {
  constructor (bundle, tarball, name, tag) {
    this.tarball = tarball
    this.name = name
    this.tag  = tag
    this.tempPath_ = name + '_temp'
    this.bundlePath_  = bundle
    this.tarTempLayerPath_ = path.join(name + '_temp', 'latest')
    this.bundleRootfsPath_ = path.join(bundle, 'rootfs')
  }
}

function createLayerJson(image, savepath, hashtable, parenthashTable) {
  let layerjson = {}
  if (parenthashTable === '') {
    layerjson = {
      id: hashtable,
      created: dayjs().format('YYYY-MM-DDTHH:mm:ssZ'),
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
      },
      os: 'sylixos'
    }
  } else {
    layerjson = {
      id: hashtable,
      parent: parenthashTable,
      created: dayjs().format('YYYY-MM-DDTHH:mm:ssZ'),
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
      },
      os: 'sylixos'
    }
  }
  if (layerjson) {
    fs.writeFileSync(path.join(savepath, 'json'), JSON.stringify(layerjson))
    fs.writeFileSync(path.join(savepath, 'VERSION'), '1.0')

    logger.info('Create ' + path.join(savepath, 'json') + ' end.')
    logger.info('Create ' + path.join(savepath, 'VERSION') + ' end.')
  }
}

function layerFileToTar(image) {
  return new Promise((resolve, reject) => {
    //mkdir layer directory
    fs.mkdirSync(image.tarTempLayerPath_, { recursive: true })
    logger.info('Create ' + image.tarTempLayerPath_ + ' end.')

    // tar layer directory to layer.tar
    const TarPath = path.join(image.tarTempLayerPath_, 'layer.tar')
    const writeStream = fs.createWriteStream(TarPath)

    tar.create(
      {C: image.bundlePath_},
      ['rootfs']).pipe(writeStream)

    writeStream.on('finish', () => {
      writeStream.close()
      logger.info('Create ' + TarPath + ' end.')
      return resolve(100)
    })
    
    writeStream.on('error', (err) => {
      return reject(err)
    })
  })
}

function createLayerOthers(image) {
  return new Promise((resolve, reject) => {
    let parentHashTable = ''

    // calculate hash
    const TarPath = path.join(image.tarTempLayerPath_, 'layer.tar')
    const layerbuf = fs.readFileSync(TarPath)
    const hashtable = hash.createHash('sha256').update(layerbuf).digest('hex')
    image.hashtable_ = hashtable

    // create layer json
    createLayerJson(image, image.tarTempLayerPath_, hashtable, parentHashTable)

    // rename directory
    try {
      fs.renameSync(image.tarTempLayerPath_, path.join(image.tempPath_, hashtable)) 
    } catch (err){
      return reject(1)
    }

    return resolve(100)
  })
}

async function createRepositories(image) {
  const repositories = {
    [image.name]: {
      [image.tag]: image.hashtable_
    }
  }
  const repositoriesPath = path.join(image.tempPath_, 'repositories')
  await fsPromises.writeFile(repositoriesPath, JSON.stringify(repositories))

  logger.info('Create ' + repositoriesPath + ' end.')
}

function createConfig (image) {
  return new Promise((resolve, reject) => {
    const configBuf = fs.readFileSync(path.join(image.bundlePath_, 'config.json'))

    let rtConfig = JSON.parse(configBuf)
    let createdTm = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS000000') + 'Z'

    const imgConfig = {
      created: createdTm,
      architecture: rtConfig.platform.arch,
      os: 'sylixos',
      config: {
        User: rtConfig.process.user.uid + ':' + rtConfig.process.user.gid,
        Env: rtConfig.process.env,
        Entrypoint: rtConfig.process.args,
        WorkingDir: '/' + rtConfig.root.path,
        Labels: {
          hostname: rtConfig.hostname,
        }
      },
      rootfs: {
        type: 'lyaers',
        diff_ids : ['sha256:' + image.hashtable_]
      },
      history: [{
        created: createdTm,
        created_by: 'ecsc',
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

    const configJsonPath = path.join(image.tempPath_, 'image_config.json')
    fs.writeFileSync(configJsonPath, JSON.stringify(imgConfig))  

    const configJsonBuf = fs.readFileSync(configJsonPath)
    const hashtable = hash.createHash('sha256').update(configJsonBuf).digest('hex')
    image.configHash_ = hashtable

    // rename image_config.json
    try {
      fs.renameSync(configJsonPath, path.join(image.tempPath_, hashtable + '.json')) 
    } catch (err) {
      return reject(1)
    }

    logger.info('create ' + path.join(image.tempPath_, hashtable + '.json') + ' end.')

    return resolve(100)
  })
}

async function createManifest(image) {
  const manifestObj = []
  const RepoTagsList = []
  RepoTagsList.push(`${image.name}:${image.tag}`)
  const LayerList = []
  for (let i = 0; i < 1; i++) {
    const layertarPath = image.hashtable_
    LayerList.push(`${layertarPath}/layer.tar`)
  }
  const maniItem = {
    Config: image.configHash_ + '.json',
    RepoTags: RepoTagsList,
    Layers: LayerList
  }
  manifestObj.push(maniItem)
  const manifestPath = path.join(image.tempPath_, 'manifest.json')
  await fsPromises.writeFile(manifestPath, JSON.stringify(manifestObj))
    
  logger.info('Create ' + manifestPath + ' end.')
}

function imageFileToTar(image) {
  return new Promise((resolve, reject) => {
    const TarPath = image.tarball
    const writeStream = fs.createWriteStream(TarPath)

    const entries = fs.readdirSync(image.tempPath_)
    tarfs.pack(image.tempPath_, { entries }).pipe(writeStream)

    writeStream.on('finish', () => {
      writeStream.close()
      fs.rmSync(image.tempPath_, { force: true, recursive: true })
      logger.info('Create ' + TarPath + ' end.')
      return resolve(100)
    })

    writeStream.on('error', (err) => {
      return reject(err)
    })
  })
}

async function pack (argv) {
  let parsedArgv
  try {
    parsedArgv = optparser.parseArgv(argv, { $help: true, t: true })
  } catch (err) {
    logger.warn(err.message)
    return printCmdHelp()
  }
  if (parsedArgv.$help) {
    return printCmdHelp()
  }

  const { $argv, t: inputTag } = parsedArgv
  const [bundle, ...args] = $argv

  try {
    const { tarball } = await validateInputArgs(bundle, args)
    const [name, tag] = validateInputTag(bundle, inputTag)
    
    const image = new Image(bundle, tarball, name, tag)

    await layerFileToTar(image)
    await createLayerOthers(image)
    await createConfig(image)
    await createManifest(image)
    await createRepositories(image)
    await imageFileToTar(image)
  } catch (err) {
    logger.error(err.message)
    logger.error('exit!')
  }
}

async function validateBundle (bundle) {
  const pathToConfig = path.join(bundle, 'config.json')
  const config = await fsPromises.readFile(pathToConfig)
  return JSON.parse(config)
}

async function validateInputArgs (bundle, inputArgs) {
  const [tarball] = inputArgs
  if (!isString(bundle)) {
    throw Error ('bundle is required and must be a string!')
  }
  const config = await validateBundle(bundle)

  if (tarball) {
    if (!isString(tarball)) {
      throw Error ('tarball_path must be a non-empty string!')
    }
    if (!tarball.endsWith('.tar')) {
      return { config, bundle, tarball: tarball + '.tar'}
    }
    return { config, bundle, tarball}
  } else {
    const filename = path.basename(bundle)
    return { 
      config,
      bundle,
      tarball: `${filename}.${config.platform.arch}.tar`
    }
  }
}

function validateInputTag (bundle, inputTag) {
  if (inputTag == null) {
    return [path.basename(bundle), 'latest']
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

function printCmdHelp () {
  logger.info(HELP)
}