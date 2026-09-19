---
title: "nju pa1.1"
date: 2025-02-21
lastmod: 2025-03-06
draft: false
garden_tags: ["Computer Architecture", "Debugging"]
summary: " "
status: "growing"
---

## 运行第一个客户程序

### 问题1 错误信息

进入nemu文件夹，运行```make run```得到
```shell
+ CC src/nemu-main.c
+ CC src/engine/interpreter/init.c
+ CC src/engine/interpreter/hostcall.c
+ CC src/device/io/map.c
+ CC src/device/io/mmio.c
+ CC src/device/io/port-io.c
+ CC src/isa/riscv32/reg.c
+ CC src/isa/riscv32/inst.c
+ CC src/isa/riscv32/init.c
+ CC src/isa/riscv32/system/mmu.c
+ CC src/isa/riscv32/system/intr.c
+ CC src/isa/riscv32/logo.c
+ CC src/isa/riscv32/difftest/dut.c
+ CC src/cpu/cpu-exec.c
+ CC src/cpu/difftest/ref.c
+ CC src/cpu/difftest/dut.c
+ CC src/monitor/sdb/expr.c
+ CC src/monitor/sdb/watchpoint.c
+ CC src/monitor/sdb/sdb.c
+ CC src/monitor/monitor.c
+ CC src/utils/log.c
+ CC src/utils/disasm.c
+ CC src/utils/state.c
+ CC src/utils/timer.c
+ CC src/memory/paddr.c
+ CC src/memory/vaddr.c
+ LD /home/haoyue/ics2024/nemu/build/riscv32-nemu-interpreter
#	-@git add /home/haoyue/ics2024/nemu/.. -A --ignore-errors
#	-@while (test -e .git/index.lock); do sleep 0.1; done
#	-@(echo ">  "compile NEMU"" && echo 23241121  Haoyuehx  && uname -a && uptime) | git commit -F - -q --author='tracer-ics2024 <tracer@njuics.org>' --no-verify --allow-empty
#	-@sync
#	-@git add /home/haoyue/ics2024/nemu/.. -A --ignore-errors
#	-@while (test -e .git/index.lock); do sleep 0.1; done
#	-@(echo ">  "run NEMU"" && echo 23241121  Haoyuehx  && uname -a && uptime) | git commit -F - -q --author='tracer-ics2024 <tracer@njuics.org>' --no-verify --allow-empty
#	-@sync
/home/haoyue/ics2024/nemu/build/riscv32-nemu-interpreter --log=/home/haoyue/ics2024/nemu/build/nemu-log.txt  
[src/utils/log.c:30 init_log] Log is written to /home/haoyue/ics2024/nemu/build/nemu-log.txt
[src/memory/paddr.c:50 init_mem] physical memory area [0x80000000, 0x87ffffff]
[src/monitor/monitor.c:51 load_img] No image is given. Use the default build-in image.
[src/monitor/monitor.c:28 welcome] Trace: ON
[src/monitor/monitor.c:31 welcome] If trace is enabled, a log file will be generated to record the trace. This may lead to a large log file. If it is not necessary, you can disable it in menuconfig
[src/monitor/monitor.c:32 welcome] Build time: 16:32:13, Feb 21 2025
Welcome to riscv32-NEMU!
For help, type "help"
[src/monitor/monitor.c:35 welcome] Exercise: Please remove me in the source code and compile NEMU again.
riscv32-nemu-interpreter: src/monitor/monitor.c:36: void welcome(): Assertion `0' failed.
make: *** [/home/haoyue/ics2024/nemu/scripts/native.mk:38: run] Aborted (core dumped)
```
注意到shell里面的这句话'Please remove me in the source code and compile NEMU again.
riscv32-nemu-interpreter: src/monitor/monitor.c:36: void welcome(): Assertion `0' failed.'

首先找到```src/monitor/monitor.c```将

```c
static void welcome() {
  Log("Trace: %s", MUXDEF(CONFIG_TRACE, ANSI_FMT("ON", ANSI_FG_GREEN), ANSI_FMT("OFF", ANSI_FG_RED)));
  IFDEF(CONFIG_TRACE, Log("If trace is enabled, a log file will be generated "
        "to record the trace. This may lead to a large log file. "
        "If it is not necessary, you can disable it in menuconfig"));
  Log("Build time: %s, %s", __TIME__, __DATE__);
  printf("Welcome to %s-NEMU!\n", ANSI_FMT(str(__GUEST_ISA__), ANSI_FG_YELLOW ANSI_BG_RED));
  printf("For help, type \"help\"\n");
  # Log("Exercise: Please remove me in the source code and compile NEMU again.");
  # assert(0);
}
```
后两行注释掉，nemu就可以正确运行。

### 问题2 在运行NEMU之后直接键入q退出, 你会发现终端输出了一些错误信息. 
```shell
(nemu) q
make: *** [/home/haoyue/ics2024/nemu/scripts/native.mk:38: run] Error 1
```
使用lldb debug
```shell
haoyue@haoyue:~/ics2024/nemu$ lldb ./build/riscv32-nemu-interpreter 
(lldb) target create "./build/riscv32-nemu-interpreter"
Current executable set to '/home/haoyue/ics2024/nemu/build/riscv32-nemu-interpreter' (x86_64).
```
首先找到键入q后调用的函数
```c
static int cmd_q(char *args) {
  return -1;
}
```
添加断点
```shell
(lldb) b cmd_q
Breakpoint 1: where = riscv32-nemu-interpreter`cmd_q at sdb.c:53:3, address = 0x00000000000039f0
```
运行,输入q,单步调试
```shell
(lldb) run
Process 119418 launched: '/home/haoyue/ics2024/nemu/build/riscv32-nemu-interpreter' (x86_64)
[src/utils/log.c:30 init_log] Log is written to stdout
[src/utils/log.c:30 init_log] Log is written to stdout
[src/memory/paddr.c:50 init_mem] physical memory area [0x80000000, 0x87ffffff]
[src/memory/paddr.c:50 init_mem] physical memory area [0x80000000, 0x87ffffff]
[src/monitor/monitor.c:51 load_img] No image is given. Use the default build-in image.
[src/monitor/monitor.c:51 load_img] No image is given. Use the default build-in image.
[src/monitor/monitor.c:28 welcome] Trace: ON
[src/monitor/monitor.c:28 welcome] Trace: ON
[src/monitor/monitor.c:31 welcome] If trace is enabled, a log file will be generated to record the trace. This may lead to a large log file. If it is not necessary, you can disable it in menuconfig
[src/monitor/monitor.c:31 welcome] If trace is enabled, a log file will be generated to record the trace. This may lead to a large log file. If it is not necessary, you can disable it in menuconfig
[src/monitor/monitor.c:32 welcome] Build time: 16:37:26, Feb 21 2025
[src/monitor/monitor.c:32 welcome] Build time: 16:37:26, Feb 21 2025
Welcome to riscv32-NEMU!
For help, type "help"
(nemu) q
Process 119418 stopped
* thread #1, name = 'riscv32-nemu-in', stop reason = breakpoint 1.1
    frame #0: 0x00005555555579f0 riscv32-nemu-interpreter`cmd_q(args=<unavailable>) at sdb.c:53:3
   50  	
   51  	static int cmd_q(char *args) {
   52  	//   nemu_state.state = NEMU_QUIT;
-> 53  	  return -1;
   54  	}
   55  	
   56  	static int cmd_help(char *args);
```
发现返回```is_exit_status_bad()```
```shell
(lldb) s
Process 119418 stopped
* thread #1, name = 'riscv32-nemu-in', stop reason = step in
    frame #0: 0x000055555555635d riscv32-nemu-interpreter`main(argc=<unavailable>, argv=<unavailable>) at nemu-main.c:34:10
   31  	  /* Start engine. */
   32  	  engine_start();
   33  	
-> 34  	  return is_exit_status_bad();
   35  	}
```
发现good值是1
```shell
(lldb) s
Process 119418 stopped
* thread #1, name = 'riscv32-nemu-in', stop reason = step in
    frame #0: 0x000055555555821f riscv32-nemu-interpreter`is_exit_status_bad at state.c:23:3
   20  	int is_exit_status_bad() {
   21  	  int good = (nemu_state.state == NEMU_END && nemu_state.halt_ret == 0) ||
   22  	    (nemu_state.state == NEMU_QUIT);
-> 23  	  return !good;
   24  	}
(lldb) print good
(int) 1
```
应该修改cmd_q
```c
static int cmd_q(char *args) {
  nemu_state.state = NEMU_QUIT;
  return -1;
}
```
## 补全代码
### 单步执行
|命令|格式|使用举例|说明|
|:-:|:-:|:-:|:-:|
|单步执行|```si [N]```|```si 10```|让程序单步执行N条指令后暂停执行,当N没有给出时, 缺省为1|

```cmd_table```添加命令
```C
static struct {
  const char *name;
  const char *description;
  int (*handler) (char *);
} cmd_table[] = {
    { "help", "Display information about all supported commands", cmd_help },
    { "c", "Continue the execution of the program", cmd_c },
    { "q", "Exit NEMU", cmd_q },
    { "si", "Step into n instructions", cmd_is },
    /* TODO: Add more commands */
};
```
实现方法
```C
static int cmd_is(char* args)
{
    int n_inst = 1;
    char extra;
    if (args == NULL) {
        cpu_exec(n_inst);
        return 0;
    }
    if (sscanf(args, "%d%c", &n_inst, &extra) != 1) {
        printf("error: invalid thread index '%s'.\n", args);
        return 0;
    }
    if (n_inst == 0) {
        printf("error: Thread index 0 is out of range (valid values are 0 - 1).\n");
        return 0;
    }
    cpu_exec(n_inst);
    return 0;
}
```

### 打印寄存器
|命令|格式|使用举例|说明|
| :-: | :-: | :-: | :-: |
| 打印程序状态 | ```info SUBCMD``` | ```info r``` | 打印寄存器状态 |

```cmd_table```添加命令
```C
static struct {
  const char *name;
  const char *description;
  int (*handler) (char *);
} cmd_table[] = {
    { "help", "Display information about all supported commands", cmd_help },
    { "c", "Continue the execution of the program", cmd_c },
    { "q", "Exit NEMU", cmd_q },
    { "si", "Step into n instructions", cmd_is },
    { "info", "Print program status", cmd_info },
    /* TODO: Add more commands */
};
```
实现方法，调用```isa_reg_display()```
```C
static int cmd_info(char* args)
{
    if (args == NULL) {
        printf("info: missing argument.\n");
        return 0;
    }
    else if (strcmp(args, "r") == 0) {
        isa_reg_display();
        return 0;
    }
    // else if (strcmp(args, "w") == 0) {
    //     return 0;
    // }
    else {
        printf("Undefined info command: \"%s\".\n", args);
        return 0;
    }
    return 0;
}
```
```isa_reg_display()```实现方法
```C
void isa_reg_display()
{
    for (int i = 0; i < REG_NUM; i++) {
        word_t val = cpu.gpr[i];
        printf("%-4s 0x%-16x %d\n", regs[i], val, val);
    }
}

word_t isa_reg_str2val(const char *s, bool *success) {
    for (int i = 0; i < REG_NUM; i++) {
        if (strcmp(s, regs[i]) == 0) {
            *success = true;
            return cpu.gpr[i];
        }
    }
    *success = false;
    return 0;
}
```

### 扫描内存
|     命令     |       格式        |   使用举例   |      说明      |
| :----------: | :---------------: | :----------: | :------------: |
| 扫描内存 | ```x N EXPR``` | ```x 10 $esp``` | 求出表达式EXPR的值, 将结果作为起始内存
地址, 以十六进制形式输出连续的N个4字节 |

```cmd_table```添加命令
```C
static struct {
    const char* name;
    const char* description;
    int (*handler)(char*);
} cmd_table[] = {
    { "help", "Display information about all supported commands", cmd_help },
    { "c", "Continue the execution of the program", cmd_c },
    { "q", "Exit NEMU", cmd_q },
    { "si", "Step into n instructions", cmd_is },
    { "info", "Print program status", cmd_info },
    { "x", "Examine memory", cmd_x },
    /* TODO: Add more commands */
};
```
实现方法，调用```vaddr_read(vaddr_t addr, int len)```
在```sdb.h```文件添加一行
```C
word_t vaddr_read(vaddr_t addr, int len);
```
```cmd_x(char* args)```实现
```C
static int cmd_x(char* args)
{

    char* n_word = strtok(args, " ");
    char* arg_expr = strtok(NULL, " ");
    if (!n_word || !arg_expr) {
        printf("Invalid arguments!\n");
        return 0;
    }
    int len;
    if (sscanf(n_word, "%d", &len) != 1) {
        printf("error: first argument should be an integer, but got %s\n", n_word);
        return 0;
    }
    word_t start_addr = 0;

    if (sscanf(arg_expr, "%x", &start_addr) != 1) {
        printf("error: require a hex expression, but got %s\n", arg_expr);
        return 0;
    }
    if (start_addr < 0x80000000 || start_addr > 0x87ffffff) {
        printf("Address 0x%x is out of bounds!\n", start_addr);
        return 0;
    }

    for (int i = 0; i < len; i++) {
        word_t current_addr = start_addr + i * 4;
        word_t val = vaddr_read(current_addr, 4);
        if (i == 0) {
            printf("0x%x:", current_addr);
        } else if (i % 4 == 0 && i != 0) {
            printf("\n0x%x:", current_addr);
        }
        printf("\t0x%08x", val);
    }
    printf("\n");
    return 0;
}
```
