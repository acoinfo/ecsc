# Ecsfile 使用说明

用户可通过配置 Ecsfile 脚本文件打包容器镜像。

## 开始

``` sh
# install the package globally
npm install -g ecsc

# verify if the package has been installed
ecsc version

# print help document
ecsc help
```

## 工作流程

创建一个容器镜像需要以下两个步骤：

1. 配置 Ecsfile 脚本文件
2. 执行命令打包镜像

### Ecsfile 文件配置

Ecsfile 脚本文件内容配置示例如下

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

- `ARCH` 指定容器待运行的目标设备架构。其中，ARCH 可配置的参数有：noarch, x86-64, arm64, arm, riscv64, mips64, ppc, loongarch。其中 noarch 表示该容器可以在多平台架构下运行。
- `MOUNT` 参数一指定宿主机的运行环境，参数二指定容器内的运行环境，参数三指定映射权限。此条指令用于将宿主机的运行环境映射至容器中。
- `COPY` 参数一指定需要打包的文件路径，参数二指定容器 Bundle 内的路径。此条指令用于将参数一指定的路径下文件拷贝至容器 Bundle 内。
- `ENV` 指定需要声明的环境变量
- `WORKDIR` 指定容器的工作路径
- `CMD` 指定容器的启动参数

### 打包流程

本小节以 Ecsfile 示例配置为例展开说明。

1. 在安装完 ecsc 命令行工具后，在工作目录下创建 `app` 目录用于存放需要打包的文件。
2. 创建 Ecsfile 脚本文件，根据上一小节的说明进行配置。

>**说明：**
>
>Ecsfile 需要与 `app` 目录放在同一路径下。

3. 用户使用如下的命令将需要的文件打包为 tar 包，并且会自动生成 Bundle 文件。

```bash
ecsc build /path/to/ecsfile -t HelloWorld:latest
```

以上 `build` 命令也支持命令行参数

```bash
ecs build [options]  build image with options. 

  -h | --help     print this help document
  -f | --file     set ecsfile path
  -t | --tag      set image tag
```