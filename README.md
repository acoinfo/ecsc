# ECSC (ECS Commander)

ECSC is a package of command-line tools for Edge Container Stack of ACOINFO. You may use it to:

- Create a container bundle.
- Package a container bundle into an OCI container image tarball.


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

To create an container image, there are 3 steps to do:

1. create an bundle (directory).
2. prepare and copy your files into the bundle (directory).
3. pack the bundle directory into an OCI image tar.

### 1. Create Container Bundle

Invoke `create` sub command without any option will start an interactive wizard:

``` sh
$ ecsc create

   _____________ _____                              __       
  / __/ ___/ __// ___/__  __ _  __ _  ___ ____  ___/ /__ ____
 / _// /___\ \ / /__/ _ \/  ' \/  ' \/ _ `/ _ \/ _  / -_) __/
/___/\___/___/ \___/\___/_/_/_/_/_/_/\_,_/_//_/\_,_/\__/_/   

? What is name for the bundle (directory)? demo
? What is the architecture(s) of the bundle? x86-64
? Would you mount and reuse JSRE from the container host? Yes
? What is the start parameter (process.args) of the image? javascript /apps/hello.js
```

After that bundle will be created in working directory, a default shell file 
`/etc/startup.sh` will also be created with 'shstack 200000'.

### 2. Copy application files

This step requires manual file coping or editing. Application developer may
layout the application files into `<bundle>/rootfs` accordingly.

**Notes**
- the archtecture of binary files must be covered by those set in step 1.
- application entrypoint should be the same as `process.args` set in step 1.

### 3. Package bundle into OCI image

``` sh
$ ecsc pack <bundle> [-t name[:tag]] [tarball_path]
```
- `bundle` is the container bundle directory to pack from.
- `name[:tag]` container image name and tag, defaults to 'bundle:latest'.
- `tarball_path` optional tarball file name, defaults to 'bundle.arch.tar'.

For example, to package the 'demo' bundle created in step 1:

``` sh
# below command will pack the 'demo' bundle directory and create a 'demo.tar'
# with 'demo:latest' as it name and tag, in current working directory
ecsc pack ./demo
```
