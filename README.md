# ECSC (ECS Command-line Tool)

ECSC is a command-line tool for ECS (Edge Container Stack) of AcoInfo. It has the follwing features:

- Create a container bundle.
- Package a container bundle as a container image.

ECSC support works in Node.js runtime in both Windows and Linux. 

## ECSC Install

User can use the following command to install ECSC when Node.js is installed.

``` bash
npm install -g ecsc
```

Use the following command to determine whether the installation is successful:

``` bash
ecsc version
```

The version of ecsc should be printed.

## ECSC Helper

User can use the following command to display the help information of ECSC.

``` bash
ecsc help
```

## ECSC Functions

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