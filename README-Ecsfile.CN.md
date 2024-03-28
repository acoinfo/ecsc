# Ecsfile 使用说明

从 `0.2.0` 版本开始 `ecsc` 增加了新的 `build` 命令，用户可通过配置 Ecsfile 脚本文件实现自
动化地镜像打包。

## 工作流程

创建一个容器镜像需要以下步骤：

1. 创建一个工作目录，并在其中添加一个 Ecsfile 脚本文件；
2. 在工作目录中准备需要复制到容器镜像中的其他目录和文件，例如以下例子中的 `app/HelloWorld.js`；
3. 使用 `ecsc build path/to/workspace` 命令完成镜像打包。

## Ecsfile 文件配置说明

以下是一个 Ecsfile 的完整示例：

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

- `ARCH` 指定容器待运行的目标设备架构。其中，ARCH 可配置的参数有：noarch, x86-64, arm64, arm, riscv64, mips64, ppc, loongarch。其中 `noarch` 表示该容器可以在多平台架构下运行。
- `MOUNT` 参数一指定宿主机的运行环境，参数二指定容器内的运行环境，参数三指定映射权限。此条指令用于将宿主机的运行环境映射至容器中。
- `COPY` 参数一指定需要打包的源文件路径（**相对路径以打包的工作目录为基础**），参数二指定容器内的文件系统路径。
- `ENV` 指定需要声明的环境变量
- `WORKDIR` 指定容器的工作路径
- `CMD` 指定容器的启动参数

## build 命令说明

当完成工作目录的准备后，用户可以使用 `ecsc build PATH -t tag` 命令完成镜像打包。其中，
`PATH` 工作目录是是必须的，并且工作目录中必须包含一个名为 `Ecsfile` 的配置文件。工作目录中
应该包含其他容器镜像打包所需的文件，例如 `COPY` 指令的源文件。参数 `-t` 是可选参数，用于指定
容器镜像的标签。

以下是 `build` 命令的完整说明：

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