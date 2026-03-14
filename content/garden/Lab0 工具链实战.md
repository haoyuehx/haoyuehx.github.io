---
title: Lab0 工具链实战：从命令行到可复用构建流
date: 2026-03-11
lastmod: 2026-03-11
draft: false
garden_tags: ["操作系统", "Linux", "工具链", "Shell", "Makefile"]
summary: "lab0 工具链教程"
status: "evergreen"
---

# Lab0 工具链实战

Unix 哲学可以概括为几条非常“工程化”的原则：
- 一个程序只做好一件事，并把这件事做到足够好。
- 程序之间通过文本流协作，而不是彼此耦合。
- 优先组合小工具，而不是一开始就写一个“大而全”的系统。
- 让每一步都可观察、可替换、可调试。

## 1. 基础命令：文件与目录是所有工作的起点

| 场景          | 命令                                     |
| ----------- | -------------------------------------- |
| 当前目录        | `pwd`                                  |
| 切换目录        | `cd <dir>` / `cd ..` / `cd -`          |
| 列出详细信息      | `ls -alh`                              |
| 创建目录        | `mkdir -p <dir>`                       |
| 创建空文件/更新时间戳 | `touch <file>`                         |
| 复制          | `cp <src> <dst>` / `cp -r <dir> <dst>` |
| 移动/重命名      | `mv <src> <dst>`                       |
| 删除          | `rm <file>` / `rm -r <dir>`            |
| 查看文件        | `cat <file>` / `less <file>`           |

> [!tip]
> 删除类操作建议先用 `ls`、`find ... -print`、`echo` 预演一遍目标。

---

## 2. 重定向与管道：把命令拼成“数据流”

命令行真正强大的地方，不是单个命令，而是命令之间的数据连接。

### 2.1 重定向速查
| 写法                   | 含义                 |
| -------------------- | ------------------ |
| `cmd > out.log`      | 覆盖写标准输出            |
| `cmd >> out.log`     | 追加写标准输出            |
| `cmd 2> err.log`     | 覆盖写标准错误            |
| `cmd 2>> err.log`    | 追加写标准错误            |
| `cmd > all.log 2>&1` | 合并 stdout + stderr |
| `cmd < in.txt`       | 文件作为 stdin         |

### 2.2 管道速查
| 写法                   | 含义         |
| -------------------- | ---------- |
| `cmd1 \| cmd2`       | 上一条输出喂给下一条 |
| `cmd \| tee out.log` | 一边显示一边落盘   |

### 2.3 实战
```bash
# 构建日志统一收集
make > build.log 2>&1

# 一边看一边保存
./run_tests.sh | tee test.log

# 统计错误行数
grep "ERROR" app.log | wc -l
```

---

## 3. `find`：文件系统检索入口

### 3.1 语法
```bash
find <path...> <条件...> <动作>
```

### 3.2 常用条件
| 类别 | 示例 | 说明 |
|---|---|---|
| 名称 | `-name "*.c"` / `-iname "readme"` | 名称匹配 |
| 类型 | `-type f` / `-type d` | 文件/目录 |
| 时间 | `-mtime -7` / `-atime +30` | 最近修改/长时间未访问 |
| 大小 | `-size +100M` | 按文件大小 |
| 深度 | `-maxdepth 2` | 限制层级 |

### 3.3 常用动作
| 动作 | 示例 | 说明 |
|---|---|---|
| 打印 | `-print` | 默认动作 |
| 详细输出 | `-ls` | 类 `ls -dils` |
| 执行命令 | `-exec cmd {} +` | 批量执行 |
| 删除 | `-delete` | 高危 |

### 3.4 实战
```bash
# 找出所有 C 源文件
find src -type f -name "*.c"

# 排除 build 目录
find . -path ./build -prune -o -name "*.log" -print
```

---

## 4. `grep`：文本筛选主力

### 4.1 高频参数
| 参数 | 含义 |
|---|---|
| `-n` | 显示行号 |
| `-r` | 递归搜索 |
| `-i` | 忽略大小写 |
| `-E` | 扩展正则 |
| `-v` | 反向匹配 |

### 4.2 实战
```bash
# 递归查 TODO
grep -rn "TODO" src

# 找多个关键词
grep -E "error|fatal|panic" app.log

# 反向筛选非空行
grep -v "^$" README.md
```

---

## 5. `sed`：流式替换与清洗

`sed` 适合做“按行扫描 + 规则替换/删除/打印”的文本处理，尤其适合批量改配置和清洗日志。

### 5.1 语法结构
```bash
sed [选项] '<地址><命令>' file
```
- 地址：决定“哪些行”执行命令（如 `1,5`、`/regex/`）。
- 命令：对命中行执行动作（如 `s` 替换、`d` 删除、`p` 打印）。

### 5.2 常用选项
| 选项 | 作用 |
|---|---|
| `-n` | 关闭默认输出，配合 `p` 精准打印 |
| `-i` | 原地修改文件 |
| `-E` | 使用扩展正则（ERE） |

### 5.3 地址与命令速查
| 类型 | 示例 | 说明 |
|---|---|---|
| 行号地址 | `sed -n '10,20p' file` | 打印 10-20 行 |
| 正则地址 | `sed '/ERROR/p' file` | 命中 `ERROR` 的行 |
| 替换首个 | `sed 's/old/new/' file` | 每行只替换首个 |
| 全局替换 | `sed 's/old/new/g' file` | 每行全部替换 |
| 删除命中行 | `sed '/^#/d' file` | 删除注释行 |
| 删除空行 | `sed '/^$/d' file` | 清理空行 |
| 引用分组 | `sed -E 's/(foo)_(bar)/\\2_\\1/' file` | 分组重排 |

### 5.4 实战模板
```bash
# 1) 预览替换（不改文件）
sed 's/^DEBUG=.*/DEBUG=false/' .env

# 2) 原地替换（建议先备份）
sed -i.bak 's/^DEBUG=.*/DEBUG=false/' .env

# 3) 提取某段日志（起止模式）
sed -n '/BEGIN/,/END/p' app.log

# 4) 只看去掉注释和空行后的配置
sed '/^#/d;/^$/d' conf.ini
```

### 5.5 易错点
- `-i` 会直接改文件，建议优先用 `-i.bak`。
- 正则里含 `/` 时，改用其他分隔符更清晰：`sed 's#/usr/local#/opt#g' file`。
- `sed` 默认会输出每一行；只想输出命中内容时要配 `-n ...p`。

---

## 6. `awk`：按列处理与聚合

`awk` 适合“按字段处理文本”：筛选、格式化、统计、聚合一条命令完成。

### 6.1 语法结构
```bash
awk [选项] 'pattern { action }' file
```
- `pattern`：匹配条件（可省略，省略表示每行都执行）。
- `action`：对命中行执行的动作（打印、累加、格式化）。
- 特殊块：`BEGIN {}`（读文件前执行）、`END {}`（读完后执行）。

### 6.2 常用变量与分隔符
| 项 | 含义 |
|---|---|
| `$0` | 整行 |
| `$1..$N` | 第 1..N 列 |
| `NR` | 当前行号（全局） |
| `FNR` | 当前文件内行号 |
| `NF` | 当前行字段数 |
| `FS` | 输入分隔符 |
| `OFS` | 输出分隔符 |

### 6.3 高频模式
| 目标 | 示例 | 说明 |
|---|---|---|
| 打印列 | `awk '{print $1, $5}' access.log` | 默认空白分隔 |
| 指定分隔符 | `awk -F: '{print $1, $7}' /etc/passwd` | 以 `:` 分列 |
| 条件过滤 | `awk '$3 > 100 {print $1, $3}' data.txt` | 只输出满足条件行 |
| 行号输出 | `awk '{print NR \":\" $0}' file` | 给每行加编号 |
| 求和 | `awk '{sum += $3} END {print sum}' data.txt` | END 输出聚合结果 |
| 计数 | `awk '/ERROR/ {cnt++} END {print cnt+0}' app.log` | 模式命中计数 |

### 6.4 实战模板
```bash
# 1) 输出文件前 10 行的第 1、2 列
awk 'NR<=10 {print $1, $2}' access.log

# 2) CSV 处理（逗号分隔）
awk -F, 'NR==1 {print "name,score"; next} {print $1 "," $3}' score.csv

# 3) 统计状态码分布（假设第 9 列是状态码）
awk '{code[$9]++} END {for (c in code) print c, code[c]}' access.log

# 4) 多文件处理时区分文件名
awk '{print FILENAME, FNR, $0}' a.txt b.txt
```

### 6.5 易错点
- 分隔符不对会导致字段错位，先 `awk '{print NF, $0}'` 抽样检查。
- 数值比较要确保字段是数字；必要时可写 `$3+0` 强制数值语义。
- 关联数组遍历顺序默认无序；如果要排序，交给 `sort` 处理。

---

## 7. `xargs`：把输入转成参数批处理

### 7.1 高频参数
| 参数 | 含义 |
|---|---|
| `-0` | 配合 `find -print0` 安全处理空格 |
| `-n N` | 每批 N 个参数 |
| `-I {}` | 占位符替换 |

### 7.2 实战
```bash
# 安全批量 grep
find src -name "*.c" -print0 | xargs -0 grep -n "TODO"

# 每次处理 10 个参数
find . -name "*.jpg" | xargs -n 10 echo
```

---

## 8. `gcc`：从源码到可执行文件

### 8.1 常用命令
```bash
# 一步编译链接
gcc main.c -o app

# 分步编译
gcc -c main.c -o main.o
gcc -c util.c -o util.o
gcc main.o util.o -o app
```

### 8.2 建议参数
| 参数 | 作用 |
|---|---|
| `-std=c11` | C 标准 |
| `-Wall -Wextra` | 开启警告 |
| `-g` | 调试信息 |
| `-O2` | 优化 |
| `-Iinclude` | 头文件目录 |
| `-L<dir> -l<name>` | 库路径与库 |

推荐开发命令：
```bash
gcc -std=c11 -Wall -Wextra -g src/main.c -o app
```

---

## 9. `Makefile`：把“命令集合”变成“构建系统”

当项目文件变多后，手敲 `gcc` 会失控。`Makefile` 的价值是声明依赖，让增量构建自动发生。

### 9.1 一个可直接用的最小 `Makefile`
```makefile
CC := gcc
CFLAGS := -std=c11 -Wall -Wextra -g -O2
TARGET := app
SRCDIR := src
OBJDIR := build
SOURCES := $(wildcard $(SRCDIR)/*.c)
OBJECTS := $(patsubst $(SRCDIR)/%.c,$(OBJDIR)/%.o,$(SOURCES))

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) $^ -o $@

$(OBJDIR)/%.o: $(SRCDIR)/%.c | $(OBJDIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(OBJDIR):
	mkdir -p $(OBJDIR)

run: $(TARGET)
	./$(TARGET)

clean:
	rm -rf $(OBJDIR) $(TARGET)
```

### 9.2 Makefile 符号与语义速查
| 符号/写法 | 含义 | 示例 |
|---|---|---|
| `target: deps` | 规则定义：目标依赖于前置文件 | `app: main.o util.o` |
| `\t<cmd>` | 配方命令（必须是 Tab 开头） | `\tgcc ...` |
| `=` | 递归展开变量（延迟求值） | `A = $(B)` |
| `:=` | 立即展开变量（定义时求值） | `A := $(B)` |
| `?=` | 仅在未定义时赋值 | `CC ?= gcc` |
| `+=` | 追加变量 | `CFLAGS += -O2` |
| `$(VAR)` | 取变量值 | `$(CC)` |
| `%` | 模式匹配（模式规则） | `%.o: %.c` |
| `$@` | 当前目标名 | 规则里输出文件名 |
| `$<` | 第一个依赖 | 单源编译常用 |
| `$^` | 所有依赖（去重） | 链接阶段常用 |
| `$?` | 比目标新的依赖 | 增量更新场景 |
| `.PHONY` | 声明伪目标 | `.PHONY: clean run` |
| `#` | 注释 | `# build config` |
| `\` | 换行续写 | 长命令拆行 |
| `|` | order-only 依赖 | `obj.o: src.c \| build` |

### 9.3 常用内置函数
| 函数 | 作用 | 示例 |
|---|---|---|
| `$(wildcard pattern)` | 匹配文件列表 | `$(wildcard src/*.c)` |
| `$(patsubst a,b,text)` | 模式替换 | `.c -> .o` |
| `$(subst from,to,text)` | 字符串替换 | 替换路径前缀 |
| `$(addprefix p,names)` | 批量加前缀 | 生成路径列表 |
| `$(addsuffix s,names)` | 批量加后缀 | 生成扩展名 |
| `$(shell cmd)` | 执行 shell 并取输出 | `$(shell uname)` |

### 9.4 使用方式
```bash
make        # 构建
make run    # 运行
make clean  # 清理
```

---

## 10. Shell 脚本：把流程标准化成一条命令

`Makefile` 擅长构建依赖，Shell 脚本擅长串联任意步骤（检查、测试、打包、发布）。

### 10.1 一个可直接用的 `build.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

echo "[1/4] lint-like scan"
find src -name "*.c" -print0 | xargs -0 grep -nE "TODO|FIXME" || true

echo "[2/4] build"
make >"$LOG_DIR/build.log" 2>&1

echo "[3/4] run"
./app >"$LOG_DIR/run.log" 2>&1

echo "[4/4] done"
echo "build log: $LOG_DIR/build.log"
echo "run log:   $LOG_DIR/run.log"
```

### 10.2 Shell 常用语法：函数、条件、循环
| 能力 | 语法模板 | 说明 |
|---|---|---|
| 函数 | `fn() { ... }` | 复用逻辑 |
| 条件 `if` | `if [[ cond ]]; then ... elif ... else ... fi` | 分支判断 |
| 分支 `case` | `case \"$x\" in ... esac` | 多分支更清晰 |
| `for` 循环 | `for x in a b; do ...; done` | 遍历列表 |
| `while` 循环 | `while cond; do ...; done` | 条件循环 |
| 数组遍历 | `for x in \"${arr[@]}\"; do ...; done` | 批量参数 |
| 小括号 `()` | `(cd /tmp && ls)` | 子 Shell；不影响当前 Shell 目录/变量 |
| 双小括号 `(( ))` | `((i++)); ((a > b))` | 算术运算/算术判断（整数） |
| 中括号 `[ ]` | `if [ -f file.txt ]; then ...; fi` | 传统测试命令，`[` 与 `]` 两侧要留空格 |
| 双中括号 `[[ ]]` | `if [[ "$s" == *.log ]]; then ...; fi` | Bash 扩展测试；支持模式匹配，变量通常无需额外转义 |

### 10.3 怎么判断输入参数是不是空

这里通常要分两种情况：
- 没传参数：比如直接执行 `./build.sh`，此时 `$1` 不存在。
- 传了空字符串：比如执行 `./build.sh ""`，此时 `$1` 存在，但内容为空。

```bash
# 判断“第一个参数是否为空或未传”
if [[ -z "${1:-}" ]]; then
  echo "first argument is empty"
fi

# 判断“是否根本没传任何参数”
if [[ $# -eq 0 ]]; then
  echo "no arguments provided"
fi

# 区分“没传”和“传了空字符串”
if [[ $# -eq 0 ]]; then
  echo "missing argument"
elif [[ -z "$1" ]]; then
  echo "argument is an empty string"
else
  echo "argument = $1"
fi
```

- `-z`：判断字符串长度是否为 0。
- `${1:-}`：当 `$1` 未设置时，给一个空字符串默认值；配合 `set -u` 更安全。
- `$#`：当前传入参数个数。

如果脚本开启了 `set -u`，不要直接写 `[[ -z "$1" ]]` 判断“可能不存在”的参数，更稳妥的写法是 `[[ -z "${1:-}" ]]`。

### 10.4 Shell 实战版（含函数 + 条件 + 循环）
```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing command: $cmd" >&2
    exit 1
  fi
}

scan_todo() {
  log "scan TODO/FIXME in src"
  find src -name "*.c" -print0 | xargs -0 grep -nE "TODO|FIXME" || true
}

build_target() {
  local mode="${1:-debug}"
  case "$mode" in
    debug) CFLAGS_EXTRA="-O0 -g" ;;
    release) CFLAGS_EXTRA="-O2 -DNDEBUG" ;;
    *)
      echo "usage: $0 [debug|release]" >&2
      exit 2
      ;;
  esac
  log "build mode=$mode"
  make CFLAGS_EXTRA="$CFLAGS_EXTRA" >"$LOG_DIR/build-$mode.log" 2>&1
}

run_with_checks() {
  if [[ ! -x ./app ]]; then
    echo "binary ./app not found or not executable" >&2
    return 1
  fi
  log "run app"
  ./app >"$LOG_DIR/run.log" 2>&1
}

main() {
  local mode="${1:-debug}"
  local required=(find xargs grep make)
  local cmd
  for cmd in "${required[@]}"; do
    require_cmd "$cmd"
  done

  scan_todo
  build_target "$mode"

  local i=0
  while [[ $i -lt 1 ]]; do
    run_with_checks || true
    i=$((i + 1))
  done

  log "done"
  log "build log: $LOG_DIR/build-$mode.log"
  log "run log:   $LOG_DIR/run.log"
}

main "$@"
```

### 10.5 执行方式
```bash
chmod +x build.sh
./build.sh           # debug
./build.sh release   # release
```

---

## 11. 一条龙流程（查问题 -> 改代码 -> 构建）

```bash
# 1) 定位源码文件
find src -type f \( -name "*.c" -o -name "*.h" \)

# 2) 搜索待处理标记
find src -name "*.c" -print0 | xargs -0 grep -nE "TODO|FIXME"

# 3) 预览替换
find src -name "*.c" -print0 | xargs -0 sed 's/old_api/new_api/g'

# 4) 构建并保存日志
make > build.log 2>&1
```

> [!warning]
> 高危操作：`rm -rf`、`find ... -delete`、`sed -i`。建议固定流程：先预览、再执行、最后核验。
