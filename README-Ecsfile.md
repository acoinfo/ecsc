# Ecsfile Guide

Since verion `0.2.0`, `ecsc` support new `build` sub command that one may use to
create OCI images automatically.

## Workflow

To create a container image, steps are as follows:

1. Create a workspace directory, then create an `Ecsfile` inside;
2. Prepare your directories and files inside the workspace directory, i.e. copy
`app/HelloWorld.js` in the below example into it;
3. Use `ecsc build path/to/workspace` command to complete the build.

## Ecsfile specification

Below is a complete example of Ecsfile:

```sh
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

- `ARCH` Defines the target device architecture on which the container is to run.
  Among them, ARCH could be one of the following: noarch, x86-64, arm64, arm,
  riscv64, mips64, ppc, loongarch. Where `noarch` means that the container image
  is architecture-independent.
- `MOUNT` is used to mount host files or directories into the container at runtime.
  Parameter 1 specifies the filepath on the host, parameter 2 specifies
  the target mounting path inside the container, and parameter 3 specifies the
  mapping permissions.
- `COPY` is used to copy files into container image bundle during the build
  process. Parameter 1 specifies the path of the local file to be packaged, and
  parameter 2 specifies the path within the container *rootfs*.
- `ENV` Declares environment variables for the containerized application process.
- `WORKDIR` Specifies the working directory of the container process.
- `CMD` Specify the command and parameters to start the container process.

## build sub command

Once the working directory is setup, user may use `ecsc build PATH -t tag` to
complete container image bundling. The `PATH` argument is required. It is the
file path to your local working directory. The `build` command requires an
`Ecsfile` inside `PATH` and other files as source of `COPY` instructions. Option
`-t` is optional, it is used to set the image tag.

Complete build command help document is as below:

```sh
ecsc build [options] PATH

Start OCI image build from given PATH, where an Ecsfile is required. Check
README-Ecsfile for more information.

Options
  -h | --help     print this help document
  -t | --tag      set image tag

Example
  ecsc build /path/to/workspace -t apache:latest
```