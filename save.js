/**
 * Copyright (C) 2023 ACINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Wangxuan <wangxuan@acoinfo.com>
 * File   : save.js
 * Desc   : save OCI bundle as ECS (OCI compliant) image.
 */

const hash = require('crypto')
const path = require('path')
const fs = require('fs')

const dayjs = require('dayjs')
const tar = require('tar')
const tarfs = require('tar-fs')

class Image {
  constructor (tarball, name, bundle, tag) {
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

    console.log('Create ' + path.join(savepath, 'json') + ' end.')
    console.log('Create ' + path.join(savepath, 'VERSION') + ' end.')
  }
}

function layerFileToTar(image) {
  return new Promise((resolve, reject) => {
    //mkdir layer directory
    fs.mkdirSync(image.tarTempLayerPath_, { recursive: true })
    console.log('Create ' + image.tarTempLayerPath_ + ' end.')

    // tar layer directory to layer.tar
    const TarPath = path.join(image.tarTempLayerPath_, 'layer.tar')
    const writeStream = fs.createWriteStream(TarPath)

    tar.create(
      {C: image.bundlePath_},
      ['rootfs']).pipe(writeStream)

    writeStream.on('finish', () => {
      writeStream.close()
      console.log('Create ' + TarPath + ' end.')
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

function createRepositories(image) {
  return new Promise((resolve, reject) => {
    const Repositories = {
      [image.name]: {
        [image.tag]: image.hashtable_
      }
    }
    const repositoriesPath = path.join(image.tempPath_, 'repositories')
    fs.writeFileSync(repositoriesPath, JSON.stringify(Repositories))

    console.log('Create ' + repositoriesPath + ' end.')

    if (1) {
      return resolve(100)
    } else {
      return reject(1)
    }
  })
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

    imgConfig.config.Labels['sylixos.resources.cpu.highestPrio'] = rtConfig.sylixos.resources.cpu.highestPrio
    imgConfig.config.Labels['sylixos.resources.cpu.lowestPrio'] = rtConfig.sylixos.resources.cpu.lowestPrio
    imgConfig.config.Labels['sylixos.resources.memory.kheapLimit'] = rtConfig.sylixos.resources.memory.kheapLimit
    imgConfig.config.Labels['sylixos.resources.memory.memoryLimitMB'] = rtConfig.sylixos.resources.memory.memoryLimitMB
    imgConfig.config.Labels['sylixos.resources.disk.limitMB'] = rtConfig.sylixos.resources.disk.limitMB
    imgConfig.config.Labels['sylixos.resources.kernelObject.deviceLimit'] = rtConfig.sylixos.resources.kernelObject.deviceLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.dlopenLibraryLimit'] = rtConfig.sylixos.resources.kernelObject.dlopenLibraryLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.eventLimit'] = rtConfig.sylixos.resources.kernelObject.eventLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.eventSetLimit'] = rtConfig.sylixos.resources.kernelObject.eventSetLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.msgQueueLimit'] = rtConfig.sylixos.resources.kernelObject.msgQueueLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.partitionLimit'] = rtConfig.sylixos.resources.kernelObject.partitionLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.posixMqueueLimit'] = rtConfig.sylixos.resources.kernelObject.posixMqueueLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.regionLimit'] = rtConfig.sylixos.resources.kernelObject.regionLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.rmsLimit'] = rtConfig.sylixos.resources.kernelObject.rmsLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.socketLimit'] = rtConfig.sylixos.resources.kernelObject.socketLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.srtpLimit'] = rtConfig.sylixos.resources.kernelObject.srtpLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.threadLimit'] = rtConfig.sylixos.resources.kernelObject.threadLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.threadPoolLimit'] = rtConfig.sylixos.resources.kernelObject.threadPoolLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.threadVarLimit'] = rtConfig.sylixos.resources.kernelObject.threadVarLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.timerLimit'] = rtConfig.sylixos.resources.kernelObject.timerLimit
    imgConfig.config.Labels['sylixos.resources.kernelObject.xsiipcLimit'] = rtConfig.sylixos.resources.kernelObject.xsiipcLimit
    imgConfig.config.Labels['sylixos.network.ftpdEnable'] = rtConfig.sylixos.network.ftpdEnable
    imgConfig.config.Labels['sylixos.network.telnetdEnable'] = rtConfig.sylixos.network.telnetdEnable

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

    console.log('create ' + path.join(image.tempPath_, hashtable + '.json') + ' end.')

    return resolve(100)
  })
}

function createManifest(image) {
  return new Promise((resolve, reject) => {
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
    fs.writeFileSync(manifestPath, JSON.stringify(manifestObj))
     
    console.log('Create ' + manifestPath + ' end.')

    if (1) {
      return resolve(100)
    } else {
      return reject(1)
    }
  })
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
      console.log('Create ' + TarPath + ' end.')
      return resolve(100)
    })

    writeStream.on('error', (err) => {
      return reject(err)
    })
  })
}

async function imagePack (tarball, bundle, name, tag) {
 
  if (!tarball.endsWith('.tar')) {
    console.log('TarballPath must end with .tar, but now is ' + tarball)
    return
  }

  const image = new Image(tarball, name, bundle, tag)

  Status = await layerFileToTar(image)
  Status = await createLayerOthers(image)
  Status = await createConfig(image)
  Status = await createManifest(image)
  Status = await createRepositories(image)
  Status = await imageFileToTar(image)
}

module.exports = {
  imagePack: imagePack,
}