---
title: "NJU PA"
date: 2025-02-21
lastmod: 2025-02-21
draft: false
slug: "nju-pa"
aliases: ["/projects/project4/"]
project_tags: ["NJU PA", "Computer Systems", "RISC-V"]
status: "growing"
summary: "基于 NEMU、AM 和 nanos-lite，从指令执行开始逐步理解计算机系统如何运行。"
weight: 4
---

## PA 1
### pa 1.1
#### 运行第一个客户程序

##### 问题1 错误信息

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

##### 问题2 在运行NEMU之后直接键入q退出, 你会发现终端输出了一些错误信息. 
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
#### 补全代码
##### 单步执行
|   命令   |     格式     |  使用举例   |                          说明                          |
| :------: | :----------: | :---------: | :----------------------------------------------------: |
| 单步执行 | ```si [N]``` | ```si 10``` | 让程序单步执行N条指令后暂停执行,当N没有给出时, 缺省为1 |

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

##### 打印寄存器
|     命令     |       格式        |   使用举例   |      说明      |
| :----------: | :---------------: | :----------: | :------------: |
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

##### 扫描内存
|                  命令                  |      格式      |    使用举例     |                  说明                  |
| :------------------------------------: | :------------: | :-------------: | :------------------------------------: |
|                扫描内存                | ```x N EXPR``` | ```x 10 $esp``` | 求出表达式EXPR的值, 将结果作为起始内存 |
| 地址, 以十六进制形式输出连续的N个4字节 |

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
### pa1.2
主要修改 /nemu/src/monitor/expr.c

#### 添加cmd_p命令
首先，和前几个命令一样在```sdb.c```文件里添加```static int cmd_p(char* args);```

需要实现的功能：
1. 检测输入是否正确
2. 如果输入正确，计算表达式的值

```C
static int cmd_p(char* args)
{
    if (args == NULL) {
        printf("p: missing argument.\n");
        return 0;
    }
    bool success = true;
    word_t result = expr(args, &success);
    if (success) {
        printf("%u\n", result);
    } else {
        printf("Invalid expression: %s\n", args);
    }
    return 0;
}
```

写完```static int cmd_p(char* args)```完善```expr(args, &success)```

#### 正则表达式识别token
首先在```enum```里添加```token```类型
```enum``` 枚举类型是一种可以由用户自定义数据集的数据类型。
 枚举类型的每一个枚举值都**对应一个整型数**，默认情况下，第一个枚举值的值是0，然后依次增1，但也可以显示初始化任意一个枚举值对应的整形数，没定义的枚举值默认情况下在其前一个枚举值的对应整型数上加1.

```C
enum {
    TK_NOTYPE = 256,
    TK_EQ,      //257
    /* TODO: Add more token types */
    TK_HEX, // 十六进制整数
    TK_UINT, // 十进制整数
    TK_INT, // 负整数
};
```
在```rules[]```数组里添加新的正则表达对应

```C
static struct rule {
    const char* regex;
    int token_type;
} rules[] = {

    /* TODO: Add more rules.
     * Pay attention to the precedence level of different rules.
     */

    { "0x[0-9AaBbCcDdEeFf]+", TK_HEX }, // 十六进制整数
    { "[0-9]+", TK_UINT }, // 十进制整数
    { "-[0-9]+", TK_INT }, // 负整数
    { " +", TK_NOTYPE }, // spaces
    { "\\+", '+' }, // plus
    { "==", TK_EQ }, // equal
    { "-", '-' }, // 减号
    { "\\*", '*' }, // 乘号
    { "/", '/' }, // 除号
    { "\\(", '(' }, // 左括号
    { "\\)", ')' }, // 右括号
};
```
最重要的部分:**token识别**

主要思路:
1. 通过正则表达式进行分词,得到token的位置和长度
2. 首先对token长度进行判断
3. 通过正则表达式识别出的token_type进行分类存储

注意点:
1. 每次存储完之后```nr_token```自增
2. 存储时```tokens[nr_token].str```最后一位置为```\0```

```c
static bool make_token(char* e)
{
    int position = 0;
    int i;
    regmatch_t pmatch;

    nr_token = 0;

    while (e[position] != '\0') {
        /* Try all rules one by one. */
        for (i = 0; i < NR_REGEX; i++) {
            if (regexec(&re[i], e + position, 1, &pmatch, 0) == 0 && pmatch.rm_so == 0) {
                char* substr_start = e + position;
                int substr_len = pmatch.rm_eo;

                Log("match rules[%d] = \"%s\" at position %d with len %d: %.*s",
                    i, rules[i].regex, position, substr_len, substr_len, substr_start);

                position += substr_len;
                
                /* TODO: Now a new token is recognized with rules[i]. Add codes
                 * to record the token in the array `tokens'. For certain types
                 * of tokens, some extra actions should be performed.
                 */

                Assert(nr_token < 32, "too many tokens,token should less than 32 characters");

                switch (rules[i].token_type) {
                case TK_NOTYPE:
                    break;
                case TK_HEX:
                case TK_UINT:
                    Assert(substr_len < 32, "hex/uint token too long");
                    strncpy(tokens[nr_token].str, substr_start, substr_len);
                    tokens[nr_token].str[substr_len] = '\0';
                    tokens[nr_token].type = rules[i].token_type; // 设置类型
                    nr_token++;
                    break;
                case TK_INT:
                    Assert(substr_len < 32, "int token too long");
                    strncpy(tokens[nr_token].str, substr_start, substr_len);
                    tokens[nr_token].str[substr_len] = '\0';
                    tokens[nr_token].type = rules[i].token_type; // 设置类型
                    nr_token++;
                    break;
                case '+':
                case '-':
                case '*':
                case '/':
                case '(':
                case ')':
                    strncpy(tokens[nr_token].str, substr_start, substr_len);
                    tokens[nr_token].str[substr_len] = '\0';
                    tokens[nr_token].type = rules[i].token_type; // 设置类型
                    nr_token++;
                    break;
                default:
                    Assert(false, "unknow token type %d", rules[i].token_type);
                }
                break;
            }
        }

        if (i == NR_REGEX) {
            printf("no match at position %d\n%s\n%*.s^\n", position, e, position, "");
            return false;
        }
    }

    return true;
}
```

#### 根据token求表达式的值
主要思路:递归
```bnf
<expr> ::= <number>    # 一个数是表达式
  | "(" <expr> ")"     # 在表达式两边加个括号也是表达式
  | <expr> "+" <expr>  # 两个表达式相加也是表达式
  | <expr> "-" <expr>  # 接下来你全懂了
  | <expr> "*" <expr>
  | <expr> "/" <expr>
```
根据分治法,将大的表达式化为小的表达式进行求值
代码框架:
```C
eval(p, q) {
  if (p > q) {
    /* Bad expression */
  }
  else if (p == q) {
    /* Single token.
     * For now this token should be a number.
     * Return the value of the number.
     */
  }
  else if (check_parentheses(p, q) == true) {
    /* The expression is surrounded by a matched pair of parentheses.
     * If that is the case, just throw away the parentheses.
     */
    return eval(p + 1, q - 1);
  }
  else {
    /* We should do more things here. */
  }
}
```
在一个token表达式中寻找主运算符:

- 非运算符的token不是主运算符.
- 出现在一对括号中的token不是主运算符. 注意到这里不会出现有括号包围整个表达式的情况, 因为这种情况已经在check_parentheses()相应的if块中被处理了.
- 主运算符的优先级在表达式中是最低的. 这是因为主运算符是最后一步才进行的运算符.
- 当有多个运算符的优先级都是最低时, 根据结合性, 最后被结合的运算符才是主运算符. 一个例子是1 + 2 + 3, 它的主运算符应该是右边的+.
要找出主运算符, 只需要将token表达式全部扫描一遍, 就可以按照上述方法唯一确定主运算符.
代码框架更新
```C
eval(p, q) {
  if (p > q) {
    /* Bad expression */
  }
  else if (p == q) {
    /* Single token.
     * For now this token should be a number.
     * Return the value of the number.
     */
  }
  else if (check_parentheses(p, q) == true) {
    /* The expression is surrounded by a matched pair of parentheses.
     * If that is the case, just throw away the parentheses.
     */
    return eval(p + 1, q - 1);
  }
  else {
    op = the position of 主运算符 in the token expression;
    val1 = eval(p, op - 1);
    val2 = eval(op + 1, q);

    switch (op_type) {
      case '+': return val1 + val2;
      case '-': /* ... */
      case '*': /* ... */
      case '/': /* ... */
      default: assert(0);
    }
  }
}
```
代码实现
```C
bool check_parentheses(int p, int q)
{
    if (tokens[p].type != '(' || tokens[q].type != ')') {
        return false;
    }
    int n_left = 0;
    for (int i = p + 1; i <= q - 1; i++) {
        if (tokens[i].type == '(') {
            n_left++;
        } else if (tokens[i].type == ')') {
            n_left--;
            if (n_left < 0) {
                return false;
            }
        }
    }
    return n_left == 0;
}

int find_main_op(int p, int q)
{
    int main_op = -1;
    int main_op_priority = 3;

    for (int i = p; i <= q; i++) {

        int priority = 0;
        switch (tokens[i].type) {
        case '+':
        case '-':
            priority = 1;
            break;
        case '*':
        case '/':
            priority = 2;
            break;
        case '(':
            while (tokens[i].type != ')') {
                i++;
            }
            continue;
        default:
            continue;
        }
        if (priority <= main_op_priority) {
            main_op_priority = priority;
            main_op = i;
        }
    }
    return main_op;
}

word_t eval_expr(int p, int q, bool* success)
{
    if (p > q) {
        *success = false;
        return 0;
    } else if (p == q) {
        *success = true;
        word_t result = 0;
        switch (tokens[p].type) {
        case TK_HEX:
            sscanf(tokens[p].str, "%x", &result);
            return result;
        case TK_UINT:
            sscanf(tokens[p].str, "%d", &result);
            return result;
        case TK_INT:
            sscanf(tokens[p].str, "%d", &result);
            return result;
        default:
            Assert(false, "error token type %d", tokens[p].type);
        }
    } else if (check_parentheses(p, q) == true) {
        return eval_expr(p + 1, q - 1, success);
    } else {
        *success = true;
        int op = find_main_op(p, q);
        int val1 = eval_expr(p, op - 1, success);
        int val2 = eval_expr(op + 1, q, success);
        switch (tokens[op].type) {
        case '+':
            return val1 + val2;
        case '-':
            return val1 - val2;
        case '*':
            return val1 * val2;
        case '/':
            return val1 / val2;
        default:
            assert(0);
        }
    }
    return 0;
}
```
