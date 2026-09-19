---
title: "GDB debug tutorial"
date: 2025-02-19
lastmod: 2025-02-19
draft: false
garden_tags: ["Developer Tools", "Debugging"]
summary: "参考 https://linuxconfig.org/gdb-debugging-tutorial-for-beginners"
status: "evergreen"
---

```c
#hello.c
#include <stdio.h>
int main(void) {
  printf("Hello, Linux World!\n");
  return 0;
}
```

```shell
#Makefile
hello:hello.c  
	gcc gcc -g -o hello hello.c

.PHONY: clean

clean:
	rm hello
```

1. 进入gdb
```shell
gdb ./hello
```

2. 查看源码
```shell
(gdb)l
1	#include <stdio.h>
2	int main(void) {
3	  printf("Hello, Linux World!\n");
4	  return 0;
5	}
```

3. 设置断点
```shell
(gdb)b 3
```
这样会在运行到源码第3行时停止，可以查看变量的值、堆栈情况等；这个行号是gdb的行号。

4. 查看断点处情况
```shell
(gdb) info b
```

5. 运行代码　　
```shell
(gdb) r
```

6. 显示变量值
```shell
(gdb) p n
```
在程序暂停时，键入"p 变量名"(print)即可；

7. 观察变量
```shell
(gdb) watch n
```
在某一循环处，往往希望能够观察一个变量的变化情况，这时就可以键入命令"watch"来观察变量的变化情况，GDB在"n"设置了观察点；

8. 单步运行
```shell
(gdb) n
```

9. 程序继续运行　　
```shell
(gdb) c
```
使程序继续往下运行，直到再次遇到断点或程序结束；

10. 退出GDB
```shell
(gdb) q
```
