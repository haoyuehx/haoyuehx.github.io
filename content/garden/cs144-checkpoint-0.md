---
title: "CS144 Checkpoint 0：从 HTTP 客户端到有限容量字节流"
date: 2026-08-08
lastmod: 2026-08-08
garden_tags: ["Computer Network", "CS144", "C++", "HTTP"]
draft: false
summary: "记录 CS144 Checkpoint 0 的实现过程：用 TCP socket 发送 HTTP 请求、设计有限容量 ByteStream，以及编译、单元测试和网络超时中遇到的问题。"
status: "seeding"
---

# CS144 Checkpoint 0：从 HTTP 客户端到有限容量字节流

这篇文章记录我完成 Stanford CS144 Checkpoint 0 的过程。开始这个 lab 时，我几乎没有计算机网络基础，所以一开始最大的困惑不是 C++ 语法，而是：这两个任务到底在模拟什么？

Checkpoint 0 的两个编程任务分别是：

1. 实现一个简单的 HTTP 客户端 `webget`；
2. 实现一个位于内存中的、容量有限的可靠字节流 `ByteStream`。

它们实际上对应同一个抽象的两端：应用程序希望像读写文件一样读写连续字节，而操作系统提供的 TCP socket 正好暴露了这种接口。`webget` 使用操作系统已经实现好的 TCP；`ByteStream` 则先在单机内存中实现一个更小、更容易观察的字节流模型。

> CS144 希望学习者不要公开完整 lab 解答，因此本文只记录接口理解、设计思路、错误和测试方法，不提供可直接提交的完整实现。

## 1. 先弄清 `webget` 要写什么

最开始我分不清自己要写的是 HTTP 连接、HTTP 请求还是 HTTP 响应。后来把角色关系画出来就清楚了：

```text
webget（客户端）
    |
    | 1. 建立 TCP 连接
    | 2. 发送 HTTP 请求
    v
HTTP 服务器
    |
    | 3. 返回 HTTP 响应
    v
webget 读取并原样打印响应
```

因此，我需要构造的是请求报文，而不是响应报文。对于主机 `cs144.keithw.org` 和路径 `/hello`，报文结构为：

```http
GET /hello HTTP/1.1
Host: cs144.keithw.org
Connection: close

```

代码真正发送时，每行必须以 `\r\n` 结束，最后再用一个空行表示请求头结束：

```text
GET <path> HTTP/1.1\r\n
Host: <host>\r\n
Connection: close\r\n
\r\n
```

`Connection: close` 对这个小程序尤其重要。服务器发送完响应后关闭连接，客户端才能通过 EOF 判断响应已经读完。

## 2. `TCPSocket` 的使用流程

这个任务不需要自己实现 TCP 三次握手，也不需要处理 IP 数据包。项目提供的 `TCPSocket` 封装了操作系统 socket，程序只需要完成：

```text
创建 socket -> connect -> write request -> read until EOF -> print
```

这里我遇到的第一个编译错误是把 `read()` 想象成一个返回字符串的函数：

```cpp
std::string data = socket.read(); // 错误理解
```

实际接口是：

```cpp
void read( std::string& buffer );
```

它使用“输出参数”：调用者先创建一个可修改的字符串，再把字符串直接传给 `read()`。参数声明中的 `&` 表示引用，但调用时传变量名即可，不需要传 `&buffer`。

这也让我重新理解了下面三个签名的区别：

```cpp
void f( std::string value );        // 复制
void f( std::string& value );       // 可修改引用
void f( const std::string& value ); // 只读引用
```

读取时不能假设一次 `read()` 就能得到完整响应。TCP 提供的是字节流，不保留 HTTP 报文的边界，所以必须持续读取，直到 EOF。

## 3. `webget` 测试为什么会超时

实现能够通过编译器和 bug-checker，但运行：

```bash
cmake --build build --target check_webget
```

得到：

```text
t_webget ... Timeout 15.05 sec
```

这个测试不是完全本地的单元测试。测试脚本会连接外部地址：

```text
cs144.keithw.org:80
```

因此超时至少可能发生在三个位置：

```text
DNS/连接阶段 -> 请求发送阶段 -> 等待响应或 EOF 阶段
```

为了区分代码错误和网络问题，我采用的检查方式是：

```bash
timeout 10 ./build/apps/webget example.com /
nc -vz -w 5 cs144.keithw.org 80
curl --noproxy '*' -v --max-time 10 \
  http://cs144.keithw.org/nph-hasher/xyzzy
```

还可以临时在连接、写入和每次读取前后向 `std::cerr` 打印日志。不能把调试信息写到 `std::cout`，否则它会混入 HTTP 响应，导致输出校验失败。

目前这个外部服务器测试在我的网络环境中仍然超时。因此本文只把 `webget` 记为“实现和编译已完成，官方网络测试待确认”，而不是声称整个 `check0` 已经通过。

## 4. ByteStream 到底是什么

`ByteStream` 是一个先进先出、容量有限的内存缓冲区：

```text
Writer -> [ bounded buffer ] -> Reader
```

Writer 向尾部写入，Reader 从头部查看和弹出。例如容量为 5：

```text
push("abc")     buffer = "abc"
pop(2)          buffer = "c"
push("defgh")  buffer = "cdefg"，多出的 "h" 不被接收
```

这里的容量限制的是“当前尚未读取的字节数”，而不是这个流一生能传输的总字节数。容量为 1 的流也可以累计传输很多数据，只要 Reader 每次读走一个字节后 Writer 再继续写。

我最后需要维护的状态可以概括为：

```text
buffer          当前已写入但尚未弹出的字节
capacity        buffer 能容纳的最大字节数
bytes_pushed    历史累计成功写入量
bytes_popped    历史累计弹出量
closed          Writer 是否已经关闭
error           流是否发生错误
```

最重要的两个不变量是：

```text
buffer.size() <= capacity
bytes_pushed - bytes_popped == buffer.size()
```

很多 bug 都可以通过检查这两个关系发现。

## 5. C++ 类接口中学到的细节

### 5.1 为什么有两个 `writer()`

接口里同时存在：

```cpp
Writer& writer();
const Writer& writer() const;
```

非 const 的 `ByteStream` 返回可修改的 Writer，因此可以调用 `push()` 和 `close()`；const 对象只能得到只读 Writer，只能查询状态。

第二个声明里的两个 `const` 作用不同：返回类型前的 `const` 限制返回对象，函数末尾的 `const` 表示这个成员函数不会修改当前对象。

### 5.2 构造函数初始化列表

```cpp
ByteStream::ByteStream( uint64_t capacity )
  : capacity_( capacity )
{}
```

冒号后的部分叫成员初始化列表，它使用传入参数直接初始化成员。项目用尾部下划线区分成员变量和局部变量：`capacity_` 是成员，`capacity` 是参数。下划线只是命名约定，并不是 `protected` 的语法。

我新增字符串成员后还遇到了：

```text
buffer_ should be initialized in the member initialization list
```

`std::string` 本来就会被默认构造，但项目启用了 `-Weffc++ -Werror`，警告会被当作错误。给成员加上 `{}`，明确表示初始化为空字符串，就能符合项目的严格编译设置。

## 6. CS144 的 Modern C++ 编码规范

CS144 不只是要求代码“能跑”，还希望代码尽量难以被误用。它采用的 Modern C++ 风格可以概括为：缩小公开接口、让状态始终合法，并让对象自己管理资源生命周期。

### 6.1 用 RAII 管理资源

传统 C 风格经常出现成对操作：

```text
malloc -> free
new    -> delete
open   -> close
```

问题是，函数可能提前返回或抛出异常，导致后半个清理操作没有执行。RAII（Resource Acquisition Is Initialization）的做法是：在对象构造时获取资源，在析构时自动释放资源。这样资源生命周期就和对象作用域绑定在一起。

`TCPSocket` 就是一个例子。socket 对象离开作用域时，其内部文件描述符会自动关闭。因此手动调用 `close()` 可以表达“现在就关闭”，但不需要依赖它来避免泄漏。

在这个 lab 中，我遵循以下限制：

- 不使用 `malloc()`、`free()`、`new` 和 `delete`；
- 基本不使用裸指针，确实存在所有权需求时才考虑智能指针；
- 使用 `std::string`，不使用 `char*`、`strlen()`、`strcpy()` 等 C 风格字符串接口；
- 不使用 C 风格强制转换，需要转换时使用 `static_cast` 等明确的 C++ 转换；
- 不引入任务不需要的模板、线程、锁和虚函数。

最后一条是 CS144 对这些 lab 的范围约束，并不表示模板、线程或虚函数在其他 C++ 项目中不应该使用。

### 6.2 默认 const，按引用传递

CS144 建议让所有不需要修改的东西保持 `const`：

```cpp
const uint64_t bytes_to_pop = /* ... */;
```

成员函数如果只查询状态，也应该标记为 `const`：

```cpp
uint64_t bytes_buffered() const;
```

对于不需要复制、也不需要修改的复杂参数，优先使用 const 引用：

```cpp
void connect( const Address& address );
```

这样既避免复制，也通过类型系统保证函数不会修改参数。变量还应放在尽可能小的作用域内，并避免全局变量，从而减少意外共享状态。

### 6.3 使用可靠的文档和自动检查

C++ 标准库接口优先查询 [cppreference](https://en.cppreference.com/)，避免依赖可能过时的资料。完成代码后运行项目提供的检查：

```bash
cmake --build build --target format
cmake --build build --target tidy
cmake --build build --target test
```

其中 `format` 统一代码风格，`tidy` 给出 Modern C++ 和潜在错误方面的建议，测试则验证行为。工具不能替代设计，但能把许多低级错误提前暴露出来。

## 7. 实现 `push()` 时踩到的坑

`push(data)` 不能无条件把全部数据放进缓冲区。正确的推理顺序是：

```text
剩余容量 = capacity - buffer.size
实际接收量 = min(data.size, 剩余容量)
只追加实际接收的前缀
bytes_pushed 只增加实际接收量
```

我最初只在“数据超过容量”时更新 `bytes_pushed`。结果写入 `"hello"`、容量为 15 时没有进入溢出分支，累计写入量仍然是 0，测试报错：

```text
Unsuccessful Writer expectation: bytes_pushed = 5
```

这个错误说明累计计数不能依赖是否溢出，每次成功接收数据都必须更新。Writer 关闭后也不应继续接受新数据。

## 8. 实现 `pop()` 时踩到的坑

我最初写了类似：

```cpp
buffer.substr( 0, len );
```

问题是 `substr()` 返回一个新字符串，不会修改原字符串，而且返回值在这里被直接丢弃。即使接住返回值，`substr(0, len)` 取得的也是准备弹出的前缀，而不是弹出后应保留的后缀。

`pop()` 的正确语义是：

```text
实际弹出量 = min(len, buffer.size)
删除 buffer 开头的实际弹出量
bytes_popped 增加实际弹出量
```

尤其不能在缓冲区只有 3 字节时，因为调用 `pop(10)` 就把累计弹出量增加 10。计数器应记录真正发生的操作。

## 9. “暂时为空”不等于“已经结束”

另一个失败发生在对象刚构造时：缓冲区为空，于是我让 `is_finished()` 返回了 true。

但空缓冲区有两种完全不同的含义：

```text
Writer 未关闭 + buffer 为空：暂时没数据，以后还可以继续写
Writer 已关闭 + buffer 为空：所有数据都读完，流真正结束
```

因此 Reader finished 必须同时考虑 Writer 的关闭状态和缓冲区状态：

| Writer closed | buffer empty | Reader finished |
|---|---|---|
| false | true | false |
| false | false | false |
| true | false | false |
| true | true | true |

这个区别和网络读取中的 EOF 很相似：一次暂时没有可见数据，并不等于对端已经永久结束发送。

## 10. 测试策略

完整目标 `check0` 会先运行 `t_webget`，并且设置了遇到失败立即停止。由于外部服务器超时，后面的 ByteStream 测试一开始都没有机会运行，输出中的 `50%` 只是“已运行两个测试，通过一个”，并不是整个 lab 完成了一半。

为了先验证本地 ByteStream，我使用：

```bash
ctest --test-dir build \
  --output-on-failure \
  --stop-on-failure \
  -R '^byte_stream_|^no_skip'
```

最终本地结果是：

```text
byte_stream_basics       Passed
byte_stream_capacity     Passed
byte_stream_one_write    Passed
byte_stream_two_writes   Passed
byte_stream_many_writes  Passed
byte_stream_stress_test  Passed
no_skip                  Passed
byte_stream_speed_test   Passed
```

性能结果：

```text
pop length 4096: 16.40 Gbit/s
pop length 128:   3.64 Gbit/s
pop length 32:    1.05 Gbit/s
```

最低结果也超过实验要求的 0.1 Gbit/s。当前实现使用连续字符串保存缓冲区，从头删除在理论上需要移动剩余字符，但在本次测试规模下表现足够好。如果后续面对更大的数据或大量很短的 pop，可以考虑维护读取偏移量，避免每次移动整个后缀。

## 11. 小结

Checkpoint 0 的代码量并不大，但它让我把几个原本分散的概念连了起来：

- HTTP 请求只是写入 TCP 字节流的一段文本；
- TCP 是字节流，因此读取没有天然的消息边界；
- EOF 表示对端真正结束，而不是“当前暂时没有数据”；
- 有限容量需要明确区分当前缓冲量和历史累计量；
- C++ 引用可以让函数通过参数写回结果；
- const 重载让可写接口和只读接口使用同一个名字；
- 单元测试的失败步骤往往比最终错误信息更能说明状态机哪里错了。

最终进度是：ByteStream 的功能、压力和性能测试全部通过；`webget` 可以通过编译和 bug-checker，但依赖外部服务器的测试仍需要在网络条件合适时重新确认。

