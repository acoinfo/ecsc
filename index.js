#!/usr/bin/env node

const fs = require('fs');  
const path = require('path');
const cp = require('child_process');
const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const save = require('./save');

const configJson = {
    "ociVersion": "1.0.0",
    "platform": {
        "os": "sylixos",
        "arch": "arm64"
    },
    "process": {
        "user": {
            "uid": 0,
            "gid": 0
        },
        "args": [
            ""
        ], 
        "env": [
            "LD_LIBRARY_PATH=/qt/lib:/usr/lib:/lib:/usr/local/lib:/lib/jsre:/lib/vsoa",
            "PATH=/usr/bin:/bin:/usr/pkg/sbin:/sbin:/usr/local/bin"
        ], 
        "cwd": "/"
    },
    "root": {
        "path": "rootfs",
        "readonly": false
    },
    "hostname": "sylixos_ecs",
    "mounts": [
        {
            "destination": "/qt",
            "source": "/qt",
            "options":["rx"]
        },
        {
            "destination": "/etc/lic",
            "source": "/etc/lic",
            "options":["rw"]
        }
    ], 
    "sylixos": {
        "devices": [
            {
                "path": "/dev/fb0",
                "access": "rw"
            },
            {
                "path": "/dev/input/xmse",
                "access": "rw"
            },
            {
                "path": "/dev/input/xkbd",
                "access": "rw"
            },
            {
                "path": "/dev/net/vnd",
                "access": "rw"
            }
        ], 
        "resources": {
            "cpu": {
                "highestPrio": 160,
                "lowestPrio": 250
            },
            "memory": {
                "kheapLimit": 2097152,
                "memoryLimitMB": 512
            },
            "kernelObject": {
                "threadLimit": 300,
                "threadPoolLimit": 1,
                "eventLimit": 800,
                "eventSetLimit": 50,
                "partitionLimit": 5,
                "regionLimit": 5,
                "msgQueueLimit": 50,
                "timerLimit": 5,
                "rmsLimit": 5,
                "threadVarLimit": 2,
                "posixMqueueLimit": 300,
                "dlopenLibraryLimit": 50,
                "xsiipcLimit": 100,
                "socketLimit": 50,
                "srtpLimit": 10,
                "deviceLimit": 60
            },
            "disk": {
                "limitMB": 2048
            }
        },
        "commands": [
            "exec",
            "top",
            "cpuus",
            "vi",
            "cat",
            "touch",
            "ps",
            "ts",
            "tp",
            "ss",
            "ints",
            "ls",
            "cd",
            "pwd",
            "modules",
            "varload",
            "varsave",
            "shstack",
            "srtp",
            "shfile",
            "help",
            "debug",
            "shell",
            "ll",
            "sync",
            "ln",
            "kill",
            "free",
            "ifconfig",
            "mems",
            "env"
        ], 
        "network": {
            "telnetdEnable": true,
            "ftpdEnable": true
        }
    }
};

const autoMountLib = {
    "destination": "/lib",
    "source": "/lib",
    "options":["rx"]
};

const autoMountJsBin = {
    "destination": "/bin/javascript",
    "source": "/bin/javascript",
    "options":["rx"]
};

const startupSh = "shstack 200000";

function mkdirs(dirname, callback) {
    fs.access(dirname, fs.constants.F_OK, (err) => { 
        if (err) {
            mkdirs(path.dirname(dirname), function () {
                fs.mkdir(dirname, callback);
            });
        } else {
            callback(dirname);
        }
    });
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
];

const init = () => {
    console.log(
      chalk.green(
        figlet.textSync("ECS Image Tool", {
          horizontalLayout: "default",
          verticalLayout: "default"
        })
      )
    );
};

const askQuestions = () => {
    const questions = [
      {
        type: "input",
        name: "BUNDLE",
        message: "What is the name of the bundle?"
      },
      {
        type: "list",
        name: "ARCH",
        message: "What is the architecture of the target device?",
        choices: ["x86-64", "arm64", "arm", "mips64", "ppc", "loongarch"],
      },
      {
        type: "confirm",
        name: "MOUNT_JSRE",
        message: "Do you want to using the JSRE of the host?",
      },
      {
        type: "input",
        name: "ARGUMENT",
        message: "What is the start parameter of the image?"
      },
    ];
    return inquirer.prompt(questions);
  };

async function run (cmd, arg0, arg1, arg2, arg3, arg4) {
    switch (cmd) {

    case 'create':

        init();

        // ask questions
        const answers = await askQuestions();
        const { BUNDLE, ARCH, MOUNT_JSRE, ARGUMENT } = answers;

        mkdirs(BUNDLE + '/rootfs', function () {
            configJson.platform.arch = ARCH;
            if (MOUNT_JSRE) {
                configJson.mounts.push(autoMountLib);
                configJson.mounts.push(autoMountJsBin);                
            }            
            if (ARGUMENT) {
                configJson.process.args = ARGUMENT.split(' ');
            }

            fs.writeFile(BUNDLE + '/config.json', JSON.stringify(configJson), (error) => {
                if (error) {
                    console.log(`+ create /config.json fail, ${error}`);
                    return;
                }
                console.log('> create ' + BUNDLE + '/config.json success!');

                for (let i = 0; i < bundle.length; i++) {
                    mkdirs(BUNDLE + '/rootfs' + bundle[i], () => {console.log('> create ' + BUNDLE + '/rootfs' + bundle[i] + ' success!')});
                }

                mkdirs(BUNDLE + '/rootfs/etc', () => {
                    console.log('> create ' + BUNDLE + '/rootfs/etc' + ' success!');

                    fs.writeFile(BUNDLE + '/rootfs/etc/startup.sh', startupSh, (error) => {
                        if (error) {
                            console.log(`+ create /rootfs/etc fail, ${error}`);
                            return;
                        }
                        console.log('> create ' + BUNDLE + '/rootfs/etc/startup.sh success!');
                    }); 
                });
            });   
        });
        break;

    case 'pack':
        if (arg0 == undefined) {
            console.log('Usage: ecsc pack tarballPath bundle name tag');
            console.log('   e.g.: ecsc pack demo.tar demo example latest');
            break;
        }

        /*
        * arg0: tarball
        * arg1: bundle
        * arg2: name
        * arg3: tag
        */
        save.imagePack(arg0, arg1, arg2, arg3);
        break;

    case 'help':
        console.log('Usage: ecsc [command] [arguments]');
        console.log('  command: ');
        console.log('    create [-f EcsFile]:  create an image bundle');
        console.log('       e.g.: ecsc create');
        console.log('       e.g.: ecsc create -f EcsFile (not support yet)');
        console.log('    pack tarballPath bundle name tag:  pack an image bundle');
        console.log('       e.g.: ecsc pack demo.tar demo example latest');
        break;

      default:
        throw new Error('Cmd invalid.')
    }
}

run(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7])
    .catch(err => {
        console.log('Usage: ecsc [command] [arguments]');
        console.log('  command: ');
        console.log('    create [-f EcsFile]:  create an image bundle');
        console.log('       e.g.: ecsc create');
        console.log('       e.g.: ecsc create -f EcsFile (not support yet)');
        console.log('    pack tarballPath bundle name tag:  pack an image bundle');
        console.log('       e.g.: ecsc pack demo.tar demo example latest');

        console.error('Fetch ERROR:', err.message);
	})
