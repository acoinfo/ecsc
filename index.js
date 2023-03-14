#!/usr/bin/env node

const fs = require('fs')  
const path = require('path')

const inquirer = require('inquirer')
const chalk = require('chalk')
const figlet = require('figlet')
const JSON5 = require('json5')

const save = require('./save')

const configJson = JSON5.parse(fs.readFileSync(path.join(__dirname, 'config.json5')))

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

const startupSh = 'shstack 200000'

function mkdirs(dirname, callback) {
  fs.access(dirname, fs.constants.F_OK, (err) => { 
    if (err) {
      mkdirs(path.dirname(dirname), function () {
        fs.mkdir(dirname, callback)
      })
    } else {
      callback(dirname)
    }
  })
}

/*
*  /etc for special
*/
const bundle = [
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

const init = () => {
  console.log(
    chalk.green(
      figlet.textSync('ECS Image Tool', {
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  )
}

const askQuestions = () => {
  const questions = [
    {
      type: 'input',
      name: 'BUNDLE',
      message: 'What is the name of the bundle?'
    },
    {
      type: 'list',
      name: 'ARCH',
      message: 'What is the architecture of the target device?',
      choices: ['x86-64', 'arm64', 'arm', 'mips64', 'ppc', 'loongarch'],
    },
    {
      type: 'confirm',
      name: 'MOUNT_JSRE',
      message: 'Do you want to using the JSRE of the host?',
    },
    {
      type: 'input',
      name: 'ARGUMENT',
      message: 'What is the start parameter of the image?'
    },
  ]
  return inquirer.prompt(questions)
}

async function run (cmd, arg0, arg1, arg2, arg3) {
  switch (cmd) {

  case 'create':

    init()

    // ask questions
    const answers = await askQuestions()
    const { BUNDLE, ARCH, MOUNT_JSRE, ARGUMENT } = answers

    mkdirs(BUNDLE + '/rootfs', function () {
      configJson.platform.arch = ARCH
      if (MOUNT_JSRE) {
        configJson.mounts.push(autoMountLib)
        configJson.mounts.push(autoMountJsBin)                
      }            
      if (ARGUMENT) {
        configJson.process.args = ARGUMENT.split(' ')
      }

      fs.writeFile(BUNDLE + '/config.json', JSON.stringify(configJson), (error) => {
        if (error) {
          console.log(`+ create /config.json fail, ${error}`)
          return
        }
        console.log('> create ' + BUNDLE + '/config.json success!')

        for (let i = 0; i < bundle.length; i++) {
          mkdirs(BUNDLE + '/rootfs' + bundle[i], () => {console.log('> create ' + BUNDLE + '/rootfs' + bundle[i] + ' success!')})
        }

        mkdirs(BUNDLE + '/rootfs/etc', () => {
          console.log('> create ' + BUNDLE + '/rootfs/etc' + ' success!')

          fs.writeFile(BUNDLE + '/rootfs/etc/startup.sh', startupSh, (error) => {
            if (error) {
              console.log(`+ create /rootfs/etc fail, ${error}`)
              return
            }
            console.log('> create ' + BUNDLE + '/rootfs/etc/startup.sh success!')
          }) 
        })
      })   
    })
    break

  case 'pack':
    if (arg0 == undefined) {
      console.log('Usage: ecsc pack tarballPath bundle name tag')
      console.log('   e.g.: ecsc pack demo.tar demo example latest')
      break
    }

    /*
        * arg0: tarball
        * arg1: bundle
        * arg2: name
        * arg3: tag
        */
    save.imagePack(arg0, arg1, arg2, arg3)
    break

  case 'help':
    console.log('Usage: ecsc [command] [arguments]')
    console.log('  command: ')
    console.log('    create [-f EcsFile]:  create an image bundle')
    console.log('       e.g.: ecsc create')
    console.log('       e.g.: ecsc create -f EcsFile (not support yet)')
    console.log('    pack tarballPath bundle name tag:  pack an image bundle')
    console.log('       e.g.: ecsc pack demo.tar demo example latest')
    break

  default:
    throw new Error('Cmd invalid.')
  }
}

run(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7])
  .catch(err => {
    console.log('Usage: ecsc [command] [arguments]')
    console.log('  command: ')
    console.log('    create [-f EcsFile]:  create an image bundle')
    console.log('       e.g.: ecsc create')
    console.log('       e.g.: ecsc create -f EcsFile (not support yet)')
    console.log('    pack tarballPath bundle name tag:  pack an image bundle')
    console.log('       e.g.: ecsc pack demo.tar demo example latest')

    console.error('Fetch ERROR:', err.message)
  })
