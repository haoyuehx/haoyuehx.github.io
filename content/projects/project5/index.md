---
title: "MIT 6.S081"
date: 2025-07-07
lastmod: 2025-07-07
draft: false
slug: "mit-6s081"
aliases: ["/projects/project5/"]
project_tags: ["Operating System", "xv6", "RISC-V"]
status: "growing"
summary: "Operating-systems labs with xv6, from Unix utilities to system calls, page tables, and concurrency."
weight: 5
---

## Lab1: Xv6 and Unix utilities
### Boot xv6
Set up the environment following the official lab tools page.
**Debian or Ubuntu**
```shell
sudo apt-get install git build-essential gdb-multiarch qemu-system-misc gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu 
```
Verify the installation.
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
Download the project.
```shell
git clone git://g.csail.mit.edu/xv6-labs-2024
```

```shell
$ cd xv6-labs-2024
$ make qemu
... # build tools and options
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

#### Add clangd LSP support to VS Code
Run this command in the project root:
```shell
$ bear -- make
```
This records Make's compilation arguments in `compile_commands.json`, which clangd detects automatically.

### sleep 
Refer to programs in `user/`, such as `user/echo.c`, `user/grep.c`, and `user/rm.c`, to see how command-line arguments are passed.

Command-line arguments enter through `main(int argc, char *argv[])`.

`argc` (argument count) includes the program name.

`argv` (argument vector) is an array of argument strings, each a `char *`.

**Note:** If the user omits the argument, `sleep` should print an error.

Arguments are passed as strings; use `atoi` (implemented in `user/ulib.c`) to convert one to an integer.

Use the `sleep` system call. Consult the xv6 documentation for `sleep` and the required `write` call:

|System call|Description|
|----------------------------------|----------------------------------|
|int sleep(int n)|Pause for n clock ticks.|
|int write(int fd, char *buf, int n)|Write n bytes from buf to file descriptor fd; returns n.|

With this information, the implementation is straightforward.
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
Then add the program around line 180 of the Makefile:
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
Build and test.
```shell
$ ./grade-lab-util sleep
make: 'kernel/kernel' is up to date.
== Test sleep, no arguments == sleep, no arguments: OK (1.1s) 
== Test sleep, returns == sleep, returns: OK (0.7s) 
== Test sleep, makes syscall == sleep, makes syscall: OK (1.0s)
```

### pingpong
The main system calls are:
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

        wait(0);// wait for the child process to exit
    }
    exit(0);
}
```

Add it to the Makefile:
```shell
180 UPROGS=\
...
190     $U/_pingpong\
```

Build and test.
```shell
$ ./grade-lab-util pingpong
make: 'kernel/kernel' is up to date.
== Test pingpong == pingpong: OK (2.7s)
```

### primes
Implement a prime sieve with `pipe` and `fork`.
![sieve](./sieve.gif)

Each process handles one prime and passes only numbers not divisible by it to the next process.

The `prime` function prints the current prime and forks. The child recurses; the parent sends numbers not divisible by the current prime through the pipe.

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
    int p, n;   // Keep these local so each recursive call has independent pipe descriptors.
    int p_to_c[2];      // Static descriptors would be shared, causing incorrect closes and blocked processes.
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

Build and test.
```shell
$ ./grade-lab-util primes
make: 'kernel/kernel' is up to date.
== Test primes == primes: OK (1.5s)
```

### find
Find all files with a given name in a directory tree.
The implementation is based on `user/ls.c`.

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
#include "kernel/fs.h"      // directory-entry structure
#include "kernel/fcntl.h"   // flags for open()

void find(char* path, char* target)
{
    char buf[512], *p;  // buf stores the path; p manipulates the string
    int fd;             // file descriptor
    struct dirent de;   // directory entry
    struct stat st;     // file status

    if ((fd = open(path, O_RDONLY)) < 0) {      // open path read-only and get a descriptor
        fprintf(2, "find: cannot open %s\n", path);
        return;
    }

    if (fstat(fd, &st) < 0) {   // write file status into st
        fprintf(2, "find: cannot stat %s\n", path);
        close(fd);
        return;
    }

    while (read(fd, &de, sizeof(de)) == sizeof(de)) {   // read each directory entry
        if (strlen(path) + 1 + DIRSIZ + 1 > sizeof buf) {
            // Check that buf can hold the complete path.
            // strlen(path): length of the current path.
            // + 1: room for the / separator.
            // + DIRSIZ: maximum length of de.name.
            // + 1: room for the terminating \0.
            printf("find: path too long\n");
            break;
        }

        if (de.inum == 0)
            continue;

        strcpy(buf, path);
        p = buf + strlen(buf);
        *p++ = '/';
        memmove(p, de.name, DIRSIZ);

        // Copy de.name into buf immediately after /.
        // Use memmove because the fixed-size de.name array may not end in \0.
        p[DIRSIZ] = 0;

        if (stat(buf, &st) < 0) {
            printf("find: cannot stat %s\n", buf);
            continue;
        }

        if (strcmp(de.name, ".") == 0 || strcmp(de.name, "..") == 0)
            continue;
        // Do not recurse into the current or parent directory.

        if (st.type == T_DIR) {
            // Recurse when the next entry is a directory.
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
How `xargs` works:
1. Read standard input.
2. Append the input as additional arguments to the specified command.
3. Execute the command with those arguments.

```C
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

#define MAX_BUF 512 

int main(int argc, char* argv[])
{
    char* new_argv[3];  // combined arguments
    char line_buf[MAX_BUF];
    int current_len = 0;

    for (int i = 1; i < argc ; i++) {
        new_argv[i - 1] = argv[i];
    }
    int initial_arg_count = argc - 1;

    while (read(0, line_buf + current_len, 1) > 0) {
        if (line_buf[current_len] == '\n') {    // execute when a newline is reached
            line_buf[current_len] = '\0';
            new_argv[initial_arg_count] = line_buf;
            new_argv[initial_arg_count + 1] = 0; 

            if (fork() == 0) {
                exec(new_argv[0], new_argv);    // execute the requested command
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
