---
title: "NJU PA"
date: 2025-02-21
lastmod: 2025-02-21
draft: false
slug: "nju-pa"
aliases: ["/projects/project4/"]
project_tags: ["NJU PA", "Computer Systems", "RISC-V"]
status: "growing"
summary: "Exploring how computer systems work through NEMU, Abstract Machine, and nanos-lite."
weight: 4
---

## PA 1
### pa 1.1
#### Run the first guest program

##### Issue 1: Error message

In the `nemu` directory, run `make run` to get:
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
Notice the shell message, "Please remove me in the source code and compile NEMU again," followed by the assertion failure in `welcome()`.

First, locate `src/monitor/monitor.c`:

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
Comment out the last two lines. NEMU should then run correctly.

##### Issue 2: Entering `q` immediately after starting NEMU prints an error
```shell
(nemu) q
make: *** [/home/haoyue/ics2024/nemu/scripts/native.mk:38: run] Error 1
```
Debug with LLDB.
```shell
haoyue@haoyue:~/ics2024/nemu$ lldb ./build/riscv32-nemu-interpreter 
(lldb) target create "./build/riscv32-nemu-interpreter"
Current executable set to '/home/haoyue/ics2024/nemu/build/riscv32-nemu-interpreter' (x86_64).
```
First, find the function called when `q` is entered.
```c
static int cmd_q(char *args) {
  return -1;
}
```
Set a breakpoint.
```shell
(lldb) b cmd_q
Breakpoint 1: where = riscv32-nemu-interpreter`cmd_q at sdb.c:53:3, address = 0x00000000000039f0
```
Run the program, enter `q`, and step through the code.
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
The return path calls `is_exit_status_bad()`.
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
The value of `good` is 1.
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
Modify `cmd_q`.
```c
static int cmd_q(char *args) {
  nemu_state.state = NEMU_QUIT;
  return -1;
}
```
#### Complete the implementation
##### Single-step execution
| Command | Syntax | Example | Description |
| :------: | :----------: | :---------: | :----------------------------------------------------: |
| Single step | `si [N]` | `si 10` | Execute N instructions and pause; defaults to 1 when N is omitted. |

Add the command to `cmd_table`.
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
Implementation:
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

##### Display registers
| Command | Syntax | Example | Description |
| :----------: | :---------------: | :----------: | :------------: |
| Show program state | `info SUBCMD` | `info r` | Display register values. |

Add the command to `cmd_table`.
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
Implement it by calling `isa_reg_display()`.
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
Implementation of `isa_reg_display()`:
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

##### Examine memory
| Command | Syntax | Example | Description |
| :------------------------------------: | :------------: | :-------------: | :------------------------------------: |
| Examine memory | `x N EXPR` | `x 10 $esp` | Evaluate `EXPR` as the starting address and print N consecutive 4-byte words in hexadecimal. |

Add the command to `cmd_table`.
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
Implement it by calling `vaddr_read(vaddr_t addr, int len)`.
Add a declaration to `sdb.h`:
```C
word_t vaddr_read(vaddr_t addr, int len);
```
Implementation of `cmd_x(char* args)`:
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
The main changes are in `/nemu/src/monitor/expr.c`.

#### Add the `cmd_p` command
As with the previous commands, first add `static int cmd_p(char* args);` to `sdb.c`.

Required behavior:
1. Validate the input.
2. If valid, evaluate the expression.

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

After implementing `cmd_p(char* args)`, complete `expr(args, &success)`.

#### Recognize tokens with regular expressions
First, add the token types to the `enum`.
An `enum` is a user-defined set of named integer values.
Each member **corresponds to an integer**. By default the first is 0 and subsequent values increase by 1, although values can be assigned explicitly.

```C
enum {
    TK_NOTYPE = 256,
    TK_EQ,      //257
    /* TODO: Add more token types */
    TK_HEX, // hexadecimal integer
    TK_UINT, // decimal integer
    TK_INT, // negative integer
};
```
Add the corresponding regular expressions to `rules[]`:

```C
static struct rule {
    const char* regex;
    int token_type;
} rules[] = {

    /* TODO: Add more rules.
     * Pay attention to the precedence level of different rules.
     */

    { "0x[0-9AaBbCcDdEeFf]+", TK_HEX }, // hexadecimal integer
    { "[0-9]+", TK_UINT }, // decimal integer
    { "-[0-9]+", TK_INT }, // negative integer
    { " +", TK_NOTYPE }, // spaces
    { "\\+", '+' }, // plus
    { "==", TK_EQ }, // equal
    { "-", '-' }, // minus sign
    { "\\*", '*' }, // multiplication
    { "/", '/' }, // division
    { "\\(", '(' }, // left parenthesis
    { "\\)", ')' }, // right parenthesis
};
```
The most important part is **token recognition**.

Approach:
1. Tokenize with regular expressions and record each token's position and length.
2. Check the token length.
3. Store tokens according to their recognized `token_type`.

Notes:
1. Increment `nr_token` after storing each token.
2. Terminate `tokens[nr_token].str` with `\0`.

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
                    tokens[nr_token].type = rules[i].token_type; // set the type
                    nr_token++;
                    break;
                case TK_INT:
                    Assert(substr_len < 32, "int token too long");
                    strncpy(tokens[nr_token].str, substr_start, substr_len);
                    tokens[nr_token].str[substr_len] = '\0';
                    tokens[nr_token].type = rules[i].token_type; // set the type
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
                    tokens[nr_token].type = rules[i].token_type; // set the type
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

#### Evaluate expressions from tokens
The main idea is recursion.
```bnf
<expr> ::= <number>    # a number is an expression
  | "(" <expr> ")"     # a parenthesized expression is an expression
  | <expr> "+" <expr>  # the sum of two expressions is an expression
  | <expr> "-" <expr>  # likewise for subtraction
  | <expr> "*" <expr>
  | <expr> "/" <expr>
```
Use divide and conquer to evaluate an expression through smaller subexpressions.
Code outline:
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
Find the main operator in a tokenized expression:

- A token that is not an operator cannot be the main operator.
- An operator inside parentheses cannot be the main operator. A fully parenthesized expression has already been handled by `check_parentheses()`.
- The main operator has the lowest precedence because it is evaluated last.
- If multiple operators share the lowest precedence, associativity determines which is evaluated last. In `1 + 2 + 3`, the right-hand `+` is the main operator.
Scan the token sequence once to identify the main operator using these rules.
Updated code outline:
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
    op = the position of the main operator in the token expression;
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
Implementation:
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
