---
title: "MIT 6.S081"
date: 2025-07-07
lastmod: 2025-07-07
draft: false
slug: "mit-6s081"
aliases: ["/projects/project5/"]
project_tags: ["Operating System", "xv6", "RISC-V"]
status: "growing"
summary: "围绕 xv6 完成 Unix utilities、系统调用、页表与并发等操作系统实验。"
weight: 5
---

## Lab1: Xv6 and Unix utilities
### Boot xv6
按照官网给的lab tools page配置一下环境
**Debian or Ubuntu**
```shell
sudo apt-get install git build-essential gdb-multiarch qemu-system-misc gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu 
```
检验安装是否成功
```shell
$ qemu-system-riscv64 --version
QEMU emulator version 8.2.2 (Debian 1:8.2.2+ds-0ubuntu1.7)
Copyright (c) 2003-2023 Fabrice Bellard and the QEMU Project developers
```
```shell
$ riscv64-linux-gnu-gcc --version
riscv64-linux-gnu-gcc (Ubuntu 13.3.0-6ubuntu2~24.04) 13.3.0
Copyright (C) 2023 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
```
将项目下载下来
```shell
git clone git://g.csail.mit.edu/xv6-labs-2024
```

```shell
$ cd xv6-labs-2024
$ make qemu
... # 编译工具和选项
qemu-system-riscv64 -machine virt -bios none -kernel kernel/kernel -m 128M -smp 3 -nographic -global virtio-mmio.force-legacy=false -drive file=fs.img,if=none,format=raw,id=x0 -device virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0

xv6 kernel is booting

hart 2 starting
hart 1 starting
init: starting sh

$ ls
.              1 1 1024
..             1 1 1024
README         2 2 2403
xargstest.sh   2 3 93
cat            2 4 34280
echo           2 5 33208
forktest       2 6 16200
grep           2 7 37544
init           2 8 33672
kill           2 9 33120
ln             2 10 32944
ls             2 11 36312
mkdir          2 12 33184
rm             2 13 33168
sh             2 14 54744
stressfs       2 15 34064
usertests      2 16 179368
grind          2 17 49416
wc             2 18 35240
zombie         2 19 32544
console        3 20 0
```

#### vscode 添加clangd LSP
项目根目录运行
```shell
$ bear -- make
```
自动记录 make 的所有编译参数，生成 compile_commands.json，clangd 会自动识别

### sleep 
参考user/中的其他一些程序(例如 user/echo.c 、 user/grep.c 和 user/rm.c)了解命令行参数如何传递给程序。

命令行参数从```main(int argc, char *argv[]) ```传入

argc：Argument Count，参数个数（包含程序名本身）。

argv：Argument Vector，参数字符串数组，每个元素是一个 char*

**注意**：如果用户忘记传递参数，sleep 应该打印一条错误消息。

命令行参数以字符串形式传递；可以使用atoi将其转换为整数(在user/ulib.c实现)。

使用系统调用 sleep，查看xv6文档，找到sleep以及需要使用的write：

|System call|Description|
|----------------------------------|----------------------------------|
|int sleep(int n)|Pause for n clock ticks.|
|int write(int fd, char *buf, int n)|Write n bytes from buf to file descriptor fd; returns n.|

根据以上内容就可以完成代码
```C
//sleep.c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int main(int argc, char* argv[])
{
    if (argc != 2) {
        write(1, "Usage: sleep <ticks>\n", 22);
        exit(1);
    }

    for (char* p = argv[1]; *p; p++) {
        if (*p < '0' || *p > '9') {
            fprintf(2, "sleep: invalid time interval '%s'\n",argv[1]);
            exit(1);
        }
    }

    sleep(atoi(argv[1]));
    exit(0);
}
```
之后在Makefile里找到第180行添加
```shell
180 UPROGS=\
181     $U/_cat\
182     $U/_echo\
183     $U/_forktest\
184     $U/_grep\
185     $U/_init\
186     $U/_kill\
187     $U/_ln\
188     $U/_ls\
189     $U/_mkdir\
190     $U/_rm\
191     $U/_sh\ 
192     $U/_sleep\
193     $U/_stressfs\
194     $U/_usertests\
195     $U/_grind\
196     $U/_wc\ 
197     $U/_zombie\
```
编译测试
```shell
$ ./grade-lab-util sleep
make: 'kernel/kernel' is up to date.
== Test sleep, no arguments == sleep, no arguments: OK (1.1s) 
== Test sleep, returns == sleep, returns: OK (0.7s) 
== Test sleep, makes syscall == sleep, makes syscall: OK (1.0s)
```

### pingpong
主要使用的系统调用
| System call                         | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
| int fork()                    | Create a process, return child’s PID.                                 |
| int wait(int *status) | Wait for a child to exit; exit status in *status; returns child PID. |
|int getpid()|Return the current process’s PID.|
|int write(int fd, char *buf, int n)|Write n bytes from buf to file descriptor fd; returns n.|
|int read(int fd, char *buf, int n)|Read n bytes into buf; returns number read; or 0 if end of file.|
|int close(int fd)|Release open file fd.|
|int pipe(int p[])|Create a pipe, put read/write file descriptors in p[0] and p[1].|

```C
// pingpong.c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int main(int argc, char* argv[])
{
    
    int p_to_c[2];
    int c_to_p[2];

    pipe(p_to_c);
    pipe(c_to_p);

    char buf[1];
    
    if (fork() == 0) {
        // Child process code
        close(p_to_c[1]);
        close(c_to_p[0]);
        
        read(p_to_c[0], buf, sizeof(buf));

        fprintf(1, "%d: received ping\n", getpid());
        write(c_to_p[1], buf, sizeof(buf));

        close(p_to_c[0]);
        close(c_to_p[1]);
    }
    else {
        // Parent process code
        close(p_to_c[0]);
        close(c_to_p[1]);

        write(p_to_c[1], "a", sizeof(buf));

        read(c_to_p[0], buf, sizeof(buf));
        fprintf(1, "%d: received pong\n", getpid());
        
        close(p_to_c[1]);
        close(c_to_p[0]);

        wait(0);//等待子进程结束
    }
    exit(0);
}
```

Makefile添加:
```shell
180 UPROGS=\
...
190     $U/_pingpong\
```

编译测试
```shell
$ ./grade-lab-util pingpong
make: 'kernel/kernel' is up to date.
== Test pingpong == pingpong: OK (2.7s)
```

### primes
用```pipe```和```fork```实现一个素数筛
![sieve](./sieve.gif)

核心思想是：每个进程负责一个素数，只传递不能被该素数整除的数字给下一个进程。

prime函数打印当前素数，fork新的进程，子进程递归调用，父进程将不能被当前数整除的用```pipe```给子进程

| System call                         | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
| int pipe(int p[])                    | Create a pipe, put read/write file descriptors in p[0] and p[1].|
| int read(int fd, char *buf, int n) | Read n bytes into buf; returns number read; or 0 if end of file. |
|int close(int fd)|Release open file fd.|
|int fork()|Create a process, return child’s PID.|

```C
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

void primes(int) __attribute__((noreturn));

void primes(int fd)
{
    int p, n;   //必须局部变量（非static），保证每个递归层有自己独立的管道fd数组。
    int p_to_c[2];      //static 变量导致管道fd共享，关闭异常，造成进程阻塞和未退出。改为局部变量即可正常退出。
    pipe(p_to_c);

    if (read(fd, &p, 4) == 0) {
        close(fd);
        exit(0);
    }

    fprintf(1, "prime %d\n", p);

    if (fork() == 0) {
        close(p_to_c[1]);
        close(fd);
        primes(p_to_c[0]);
    } else {
        close(p_to_c[0]);
        while (read(fd, &n, 4) != 0) {
            if (n % p != 0) {
                write(p_to_c[1], &n, 4);
            }
        }
        close(p_to_c[1]);
        close(fd);
        wait(0);
    }
    exit(0);
}

int main(int argc, char* argv[])
{
    int p_to_c[2];
    pipe(p_to_c);
    if (fork() == 0) {
        close(p_to_c[1]);
        primes(p_to_c[0]);
    } else {
        close(p_to_c[0]);
        for (int i = 2; i <= 280; i++) {
            write(p_to_c[1], &i, 4);
        }
        close(p_to_c[1]);
        wait(0);
    }
    exit(0);
}
```

```shell
180 UPROGS=\
...
191     $U/_primes\
```

编译测试
```shell
$ ./grade-lab-util primes
make: 'kernel/kernel' is up to date.
== Test primes == primes: OK (1.5s)
```

### find
查找目录树中所有指定名称的文件
主要借鉴代码```user/ls.c```

| System call                         | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
|int open(char *file, int flags)|Open a file; flags indicate read/write; returns an fd (file descriptor).|
|int fstat(int fd, struct stat *st)|Place info about an open file into *st.|
|int read(int fd, char *buf, int n)|Read n bytes into buf; returns number read; or 0 if end of file.|

```C
// find.c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fs.h"      //目录项(directory entry)结构体
#include "kernel/fcntl.h"   //使用open()是权限限制

void find(char* path, char* target)
{
    char buf[512], *p;  //buf存储目录path,*p操作字符串
    int fd;             //存储文件描述符
    struct dirent de;   //目录项
    struct stat st;     //文件状态

    if ((fd = open(path, O_RDONLY)) < 0) {      //只读打开path，通过path映射一个fd
        fprintf(2, "find: cannot open %s\n", path);
        return;
    }

    if (fstat(fd, &st) < 0) {   //st写入path文件状态
        fprintf(2, "find: cannot stat %s\n", path);
        close(fd);
        return;
    }

    while (read(fd, &de, sizeof(de)) == sizeof(de)) {   //通过fd逐项读取目录内部的目录项
        if (strlen(path) + 1 + DIRSIZ + 1 > sizeof buf) {
            // 在构建新的完整路径之前，检查 buf 缓冲区是否足够大。
            // strlen(path): 当前路径的长度。
            // + 1: 为路径分隔符 / 留出空间。
            // + DIRSIZ : 为目录项名称 de.name 留出最大空间。
            // + 1 : 为字符串结束符 \0 留出空间。
            printf("find: path too long\n");
            break;
        }

        if (de.inum == 0)
            continue;

        strcpy(buf, path);
        p = buf + strlen(buf);
        *p++ = '/';
        memmove(p, de.name, DIRSIZ);

        // 将当前目录项的名称de.name复制到buf中，紧跟在/之后。
        // 使用memmove而不是strcpy是因为de.name可能不是以\0结尾的(它是一个固定大小的数组 char name[DIRSIZ])。
        p[DIRSIZ] = 0;

        if (stat(buf, &st) < 0) {
            printf("find: cannot stat %s\n", buf);
            continue;
        }

        if (strcmp(de.name, ".") == 0 || strcmp(de.name, "..") == 0)
            continue;
        // 不递归自身和上一级目录

        if (st.type == T_DIR) {
            //下一级是文件夹就递归
            find(buf, target);
        }
        else if (strcmp(de.name, target) == 0) {
            fprintf(1, "%s\n",buf);
        }
    }
}

int main(int argc, char* argv[])
{
    if (argc != 3) {
        fprintf(2, "Usage: find <path> <filename>\n");
        exit(1);
    }

    find(argv[1], argv[2]);
    exit(0);
}
```

### xargs
xargs工作方式:
1. 读取标准输入
2. 把从标准输入读到的内容，作为额外的参数添加到xargs后面指定的命令的末尾。
3. 然后，它会执行这个由原始命令和新增参数组成的完整命令。

```C
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

#define MAX_BUF 512 

int main(int argc, char* argv[])
{
    char* new_argv[3];  //合并后参数
    char line_buf[MAX_BUF];
    int current_len = 0;

    for (int i = 1; i < argc ; i++) {
        new_argv[i - 1] = argv[i];
    }
    int initial_arg_count = argc - 1;

    while (read(0, line_buf + current_len, 1) > 0) {
        if (line_buf[current_len] == '\n') {    //遇到换行符直接执行
            line_buf[current_len] = '\0';
            new_argv[initial_arg_count] = line_buf;
            new_argv[initial_arg_count + 1] = 0; 

            if (fork() == 0) {
                exec(new_argv[0], new_argv);    //执行原始命令
                fprintf(2, "xargs: exec failed\n");
                exit(1);
            } else { 
                wait(0);
                current_len = 0;
            }
        } else if (current_len < MAX_BUF - 1) {
            current_len++;
        } else {
            fprintf(2, "xargs: line too long, truncated\n");
        }
    }

    if (current_len > 0) {
        line_buf[current_len] = '\0';
        new_argv[initial_arg_count] = line_buf;
        new_argv[initial_arg_count + 1] = 0;

        if (fork() == 0) {
            exec(new_argv[0], new_argv);
            fprintf(2, "xargs: exec failed\n");
            exit(1);
        } else {
            wait(0);
        }
    }

    exit(0);
}
```

## lab1 grade
```shell
$ make grade
== Test sleep, no arguments == 
$ make qemu-gdb
sleep, no arguments: OK (2.4s) 
== Test sleep, returns == 
$ make qemu-gdb
sleep, returns: OK (0.6s) 
== Test sleep, makes syscall == 
$ make qemu-gdb
sleep, makes syscall: OK (1.0s) 
== Test pingpong == 
$ make qemu-gdb
pingpong: OK (0.9s) 
== Test primes == 
$ make qemu-gdb
primes: OK (1.5s) 
== Test find, in current directory == 
$ make qemu-gdb
find, in current directory: OK (0.8s) 
== Test find, in sub-directory == 
$ make qemu-gdb
find, in sub-directory: OK (1.2s) 
== Test find, recursive == 
$ make qemu-gdb
find, recursive: OK (0.8s) 
== Test xargs == 
$ make qemu-gdb
xargs: OK (1.6s) 
== Test xargs, multi-line echo == 
$ make qemu-gdb
xargs, multi-line echo: OK (0.5s) 
== Test time == 
time: OK 
Score: 110/110
```
