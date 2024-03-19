# Ecsfile User Guide

You can configure an Ecsfile script file to package container images.

## Get started

``` sh
# install the package globally
npm install -g ecsc

# verify if the package has been installed
ecsc version

# print help document
ecsc help
```

## Workflow

Creating a container image requires the following two steps:

1. Configure the ecsfile script file
2. Run the command to package the image

### Ecsfile file configuration

The following is an example of how to configure the content of a script file Ecsfile

```bash
ARCH arm64

MOUNT /bin/javascript /bin/javascript rx

MOUNT /lib /lib rx

MOUNT /qt /qt rx

COPY ./app/HelloWorld.js /apps/hello/HelloWorld.js

ENV PATH=/usr/bin:/bin:/usr/pkg/sbin:/sbin:/usr/local/bin

ENV LD_LIBRARY_PATH=/qt/lib:/usr/lib:/lib:/usr/local/lib:/lib/jsre:/lib/vsoa

WORKDIR /apps/hello

CMD javascript ./hello/HelloWorld.js
```

- `ARCH` Specify the target device architecture on which the container is to run. Among them, ARCH can configure the following parameters: noarch, x86-64, arm64, arm, riscv64, mips64, ppc, loongarch. where noarch means that the container can run in a multi-platform architecture.
- `MOUNT` Parameter 1 specifies the runtime environment of the host, parameter 2 specifies the runtime environment in the container, and parameter 3 specifies the mapping permissions. This command is used to map the runtime environment of the host to the container.
- `COPY` Parameter 1 specifies the path of the file to be packaged, and parameter 2 specifies the path within the container bundle. This command is used to copy files in the path specified in parameter 1 to the container bundle.
- `ENV` Specify the environment variables that need to be declared.
- `WORKDIR` Specifies the working path of the container.
- `CMD` Specify the startup parameters of the container.

### Packaging process

This section uses the Ecsfile sample configuration as an example.

1. After installing the ecsc command-line tool, create an 'app' directory in the working directory to store the files that need to be packaged.
2. Create an ecsfile script file and configure it according to the instructions in the previous section.

>**Notice：**
>
>The Ecsfile needs to be placed in the same directory as the 'app' directory.

3. You can use the following command to package the required files into tar files, and the bundle files will be automatically generated.

```bash
ecsc build -t HelloWorld:latest -f /path/to/ecsfile
```

The 'build' command above also supports command-line arguments

```bash
ecs build [options]  build image with options. 

  -h | --help     print this help document
  -f | --file     set ecsfile path
  -t | --tag      set image tag

Example
  ecs build -t apache:latest -f /path/to/ecsfile'
```