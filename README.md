# ECSC (ECS Command tools)

ECSC is a command-line tool for Edge Container Stack of ACOINFO. You may use it to:

- Create a container bundle.
- Package a container bundle as a container image.


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
1. create an bundle (directory)
2. prepare and copy your files into the bundle (directory)
3. pack the bundle directory into a tar file.

### Create Container Bundle

User can use the following command to create an empty bundle:

``` bash
ecsc create
```

Then the interaction process will begin.

```
  _____ ____ ____     ____                                          _       _ _              _____           _
 | ____/ ___/ ___|   / ___|___  _ __ ___  _ __ ___   __ _ _ __   __| |     | (_)_ __   ___  |_   _|__   ___ | |
 |  _|| |   \___ \  | |   / _ \| '_ ` _ \| '_ ` _ \ / _` | '_ \ / _` |_____| | | '_ \ / _ \   | |/ _ \ / _ \| |
 | |__| |___ ___) | | |__| (_) | | | | | | | | | | | (_| | | | | (_| |_____| | | | | |  __/   | | (_) | (_) | |
 |_____\____|____/   \____\___/|_| |_| |_|_| |_| |_|\__,_|_| |_|\__,_|     |_|_|_| |_|\___|   |_|\___/ \___/|_|
? What is the name of the bundle?
```

User need to ask the following questions:
- The name of the bundle.
- The architecture of the target device
  (Provide options: x86-64, x86, arm64, arm, mips64, mips32, riscv64, riscv32, ppc, loongarch, sparc, csky).
- Whether to mount '/lib' to host '/lib' (the option is 'readonly').
- The startup parameter of the bundle.

For example, create a bundle which name is `demo` and target device is `x86-64`, the '/lib' is auto mounted to the host '/lib' and the startup parameter is `javascript /apps/HelloVSOA.js`:

``` bash
? What is the name of the bundle? demo
? What is the architecture of the target device? x86-64
? Do you want to mount '/lib' to host '/lib'? (The mount option is 'rx') Yes
? What is the start argument of the image? javascript /apps/HelloVSOA.js
> create demo/config.json success!
> create demo/rootfs/apps success
> create demo/rootfs/home success
> create demo/rootfs/boot success
> create demo/rootfs/qt success
> create demo/rootfs/dev success
> create demo/rootfs/lib success
> create demo/rootfs/proc success
> create demo/rootfs/root success
> create demo/rootfs/tmp success
> create demo/rootfs/sbin success
> create demo/rootfs/usr success
> create demo/rootfs/var success
> create demo/rootfs/etc success
> copy demo/rootfs/bin/javascript success
> create demo/rootfs/etc/startup.sh success!
```

Then the bundle will be created under the working directory, the 'javascript' binary tool will be copied to the '/bin' and a default shell file as '/etc/startup.sh' will be created which the content is 'shstack 200000'.

### Copy Files

User need to copy the necessary files into the bundle.

### Package Container Bundle as Tarball

User use the following command to package a container bundle as a tarball.

``` bash
ecsc  pack  tarballPath  bundle  name  tag
```

- `tarballPath` is the path of the target tarball, which should be suffixed with '.tar'.
- `bundle` is the specified bundle path to package.
- `name` is the name of the tarball image.
- `tag` is the tag of the image, may be `latest`.

For example, package the above bundle 'demo' as an image `demo.tar`:

``` bash
ecsc pack demo.tar demo x64_demo latest
```

Then the image `demo.tar` is created in current working directory.