---
title: "CS144 Checkpoint 2：从回绕序列号到 TCP 接收方"
date: 2026-08-16
lastmod: 2026-08-16
garden_tags: ["Computer Network", "CS144", "C++", "TCP"]
draft: false
summary: "记录 CS144 Checkpoint 2 的实现过程：32 位 TCP 序列号的 wrap/unwrap、checkpoint 的作用、SYN/FIN 占用序列号，以及 TCPReceiver 的接收、确认与流量控制。"
status: "seeding"
---

# CS144 Checkpoint 2：从回绕序列号到 TCP 接收方

这篇文章记录我完成 Stanford CS144 Checkpoint 2 的过程。前两个 checkpoint 已经
实现了有限容量的 `ByteStream` 和能够处理乱序、重复、重叠片段的 `Reassembler`。
到了 Checkpoint 2，任务终于开始和 TCP 协议本身发生直接联系：把 TCP 报文段中的
32 位序列号转换成 Reassembler 使用的 64 位流索引，并根据接收状态生成 ACK 和
窗口大小。

这个 checkpoint 的最终代码不多，但我花时间最多的地方不是 C++，而是区分三套
非常相似、实际含义不同的编号：

```text
TCP sequence number
absolute sequence number
stream index
```

一旦这三套编号混在一起，SYN、首字节、FIN 和 ACK 都很容易产生 off-by-one 错误。

最终运行：

```bash
ASAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check2
```

结果为 30 个测试全部通过，其中包括序列号回绕、随机 roundtrip、乱序接收、窗口
变化、FIN、RST 和性能测试。

> CS144 希望学习者不要公开完整 lab 解答，因此本文记录接口理解、编号推导、
> 伪代码、错误和测试方法，不提供可直接提交的完整实现。

## 1. TCPReceiver 位于哪一层

Checkpoint 1 中，Reassembler 的输入已经是理想化的形式：

```text
(64 位 stream index, payload, 是否为最后片段)
```

但网络中真正到达的是 TCP 报文段：

```text
(32 位 seqno, SYN, payload, FIN, RST)
```

TCPReceiver 的主要职责就是充当二者之间的适配层：

```text
TCPSenderMessage
  seqno / SYN / payload / FIN / RST
                |
                | 识别 ISN
                | unwrap 序列号
                | 去掉 SYN 的编号偏移
                v
            Reassembler
                |
                v
            ByteStream
                |
                v
              应用
```

反方向上，TCPReceiver 还要根据 Reassembler 和 ByteStream 的当前状态生成：

```text
TCPReceiverMessage
  ackno / window_size / RST
```

这让我意识到 TCPReceiver 并不需要重新实现乱序缓存和容量管理。它真正新增的状态
很少，算法重点是编号转换。

## 2. 三套编号必须分清

假设字节流内容是：

```text
cat
```

先忽略实际随机 ISN，用从 0 开始的绝对序列号表示：

| 元素 | SYN | c | a | t | FIN |
|---|---:|---:|---:|---:|---:|
| absolute seqno | 0 | 1 | 2 | 3 | 4 |
| stream index | - | 0 | 1 | 2 | - |

三套编号的区别是：

| 编号 | 起点 | 是否包含 SYN/FIN | 位数 | 是否回绕 |
|---|---|---|---|---|
| sequence number | 随机 ISN | 是 | 32 位 | 是 |
| absolute sequence number | 0 | 是 | 64 位 | 否 |
| stream index | 0 | 否 | 64 位 | 否 |

关键关系是：

```text
第一个 payload 字节：absolute seqno = 1，stream index = 0
第二个 payload 字节：absolute seqno = 2，stream index = 1
```

因此，在不考虑当前报文是否携带 SYN 时，数据字节通常满足：

```text
stream index = absolute seqno - 1
```

这里的减一就是 SYN 占用的编号。FIN 同样占用一个 absolute seqno，但它位于数据
末尾，不属于 Reassembler 中的实际字节。

### 2.1 `Wrap32::raw_value_` 不是什么

一开始我把 `Wrap32` 内部的 `raw_value_` 误解成了 SYN。实际上它只是一个原始的
32 位数值，可以出现在不同语境中：

```text
作为初始零点时：表示 ISN，也就是 SYN 的 seqno
作为报文 seqno 时：可能指向 SYN、payload 开头或 FIN
作为 ackno 时：表示接收方下一步需要的序列号
```

是否存在 SYN 由单独的布尔标志表示：

```text
message.SYN      报文是否携带 SYN
message.seqno    报文起始元素的 32 位序列号
```

如果 `SYN == true`，`message.seqno` 指向 SYN；否则它通常指向 payload 的第一个
字节。`Wrap32` 只保存数值，并不知道这个数值对应哪种 TCP 元素。

## 3. Wrap32：wrap、unwrap 与 checkpoint

`wrap()` 的目标是：给定绝对序列号 `n` 和 ISN，得到实际 TCP 序列号。

数学关系是：

```text
seqno = ISN + n (mod 2^32)
```

我最初尝试手动取模，并写出了类似：

```text
(n + ISN) % ((1 << 32) - 1)
```

这里有两个错误。

第一，模数应该是 `2^32`，而不是 `2^32 - 1`。例如 `n = 2^32 - 1` 时，正确
结果仍然是 `UINT32_MAX`；使用错误模数却会得到 0。

第二，普通字面量 `1` 通常是 32 位 `int`，`1 << 32` 会把一个 32 位值左移
32 位，属于错误或未定义行为。

后来发现最简单的方法是利用无符号整数转换：

```text
uint64_t 转 uint32_t = 只保留低 32 位 = 对 2^32 取模
```

再把这个 32 位偏移加到 `zero_point` 上即可。头文件已经提供了
`Wrap32 + uint32_t` 运算符，32 位无符号加法会自然回绕，所以 `wrap()` 不需要
自己维护复杂的模运算。

### 3.1 为什么 `unwrap()` 必须要 checkpoint

`unwrap()` 要完成反方向转换：

```text
32 位 seqno -> 64 位 absolute seqno
```

问题是一个 32 位序列号可能对应无限多个绝对序列号。例如 ISN 为 0、seqno 为 5：

```text
5
2^32 + 5
2 * 2^32 + 5
3 * 2^32 + 5
...
```

只看低 32 位，无法判断当前报文属于哪次回绕。checkpoint 提供一个调用者认为
“正确答案大概在附近”的绝对序列号，`unwrap()` 从所有候选值中选择离它最近的一个。

例如：

```text
seqno = 5, checkpoint = 10
最近候选 = 5

seqno = 5, checkpoint = 2^32 + 8
最近候选 = 2^32 + 5
```

checkpoint 不需要就是正确答案，它只需要处于正确答案附近。TCPReceiver 当前最可信
的进度，就是 Reassembler 已经连续输出了多少字节。

### 3.2 `unwrap()` 的候选值构造

第一步是计算当前 seqno 相对于 ISN 的低 32 位偏移：

```text
offset = seqno - ISN (mod 2^32)
```

这里同样可以利用 32 位无符号减法的自然回绕。例如 ISN 接近 `UINT32_MAX`，当前
seqno 已经绕回到一个小值，减法仍能得到正确的低 32 位距离。

第二步，把 offset 放进 checkpoint 当前所在的 `2^32` 周期：

```text
candidate = checkpoint 的高 32 位 + offset
```

这只是初始候选。真正最近的答案只可能是：

```text
candidate - 2^32
candidate
candidate + 2^32
```

相邻两个候选相距 `2^32`，分界点是一半：

```text
2^32 / 2 = 2^31
```

所以当 candidate 与 checkpoint 的距离超过 `2^31` 时，应该尝试移动到相邻周期。
实现时还要防止：

```text
candidate - 2^32 在 0 以下
candidate + 2^32 超过 UINT64_MAX
```

我最初的 `unwrap()` 有几个典型问题：

- 使用 checkpoint 与 ISN 相减，而不是当前 `raw_value_` 与 ISN 相减；
- 返回值加了 ISN 本身，而不是加当前 seqno 相对 ISN 的 offset；
- 把无符号数和 `-raw_value_` 比较，以为能表达负数；
- 某些分支没有 return，严格编译直接报错。

最后把问题改写成“构造三个相邻候选并选最近者”后，逻辑反而变短，也更容易验证。

## 4. TCPReceiver 的状态与接收流程

在收到 SYN 以前，接收方不知道序列号零点，无法把后续 seqno 转换为绝对序列号。
因此 TCPReceiver 需要保存：

```text
optional<Wrap32> initial_seqno
```

之所以用 optional，是因为它准确表达两个阶段：

```text
空：   还没有收到 SYN，不能生成 ACK，也不能解释普通 payload
有值：已经知道 ISN，可以进行 wrap 和 unwrap
```

只有第一个到达并设置 SYN 的报文用于建立 ISN。SYN 可能重传，后续重复 SYN 不应
随意改变已经确定的零点。

除此之外，不需要额外维护“已经接收多少字节”“下一个期待下标”和“流是否结束”：

```text
已连续组装的数据量 -> Writer::bytes_pushed()
当前可用容量       -> Writer::available_capacity()
是否收到完整 FIN    -> Writer::is_closed()
是否发生错误        -> ByteStream::has_error()
乱序片段            -> Reassembler
```

重复保存这些状态只会产生不同步风险。

### 4.1 `receive()` 是逐报文处理，不是批量排序

`receive()` 每次接收一个 `TCPSenderMessage`：

```text
网络收到报文 A -> receive(A) -> insert(A.payload)
网络收到报文 B -> receive(B) -> insert(B.payload)
网络收到报文 C -> receive(C) -> insert(C.payload)
```

TCPReceiver 不需要先收集一组 messages 再排序。真实网络中的报文是逐个到达的，
接收方也不知道后面还有多少报文。乱序保存、重叠去重和补洞已经由 Reassembler
负责。

一个 message 的 payload 可能包含很多字节，因此是“一条报文调用一次 insert”，
不是每个字节调用一次。

逐报文立即处理还有三个好处：

1. 当前报文一旦补上空洞，数据可以立刻交给应用；
2. 累计 ACK 可以及时向右推进；
3. 接收窗口能立即反映容量变化。

### 4.2 `receive()` 的处理顺序

我最终把接收过程理解为以下步骤：

```text
1. 如果 RST 被设置，标记 ByteStream 发生错误
2. 如果这是第一个 SYN，记录 ISN
3. 如果仍然没有 ISN，忽略当前普通报文
4. 用当前接收进度作为 checkpoint，unwrap message.seqno
5. 如果 message 带 SYN，越过 SYN 找到 payload 起点
6. 转换成不包含 SYN 的 stream index
7. 把 payload 和 FIN 信息交给 Reassembler
```

RST 必须在“没有 SYN 就返回”之前处理，因为复位报文可能在建立 ISN 前到达。

即使 payload 为空，也不能仅凭 `payload.empty()` 跳过 Reassembler。一个空 payload
可能同时携带 FIN：

```text
payload = ""
FIN = true
```

对于空字节流，甚至可能在同一条报文中出现：

```text
SYN = true
payload = ""
FIN = true
```

这时 Reassembler 仍然需要收到“最后片段为空”的信息，才能关闭 ByteStream。

## 5. 从 TCP seqno 转换到 stream index

`Writer::bytes_pushed()` 只统计 payload 字节，不包含 SYN。`unwrap()` 需要的是 absolute
sequence number 附近的 checkpoint，而 absolute 编号包含 SYN。

假设已经连续组装 3 个 payload 字节：

```text
absolute seqno 0：SYN
absolute seqno 1：stream index 0
absolute seqno 2：stream index 1
absolute seqno 3：stream index 2
```

下一个期待的是：

```text
stream index = 3
absolute seqno = 4
```

因此：

```text
checkpoint = bytes_pushed + 1
```

这里的 `+1` 就是 SYN 占用的位置。checkpoint 的职责只是判断当前 seqno 属于哪个
回绕周期，因此使用“下一个期待的绝对序列号”最自然。

### 5.1 SYN 和 payload 起点的转换

`message.seqno` 在两种报文中的含义不同：

```text
SYN = true： seqno 指向 SYN
SYN = false：seqno 指向 payload 起点，或空 payload 时的 FIN
```

假设 `segment_absolute_seqno` 是 message.seqno 展开后的值，要得到 payload 起始
绝对序列号，需要：

```text
payload_absolute_seqno = segment_absolute_seqno + SYN
```

C++ 中 bool 参与算术时，false 为 0、true 为 1：

```text
有 SYN：   从 SYN 向后移动一个序列号，到达 payload
没有 SYN：seqno 已经指向 payload，不移动
```

随后去掉 SYN 在 absolute 编号中占用的位置：

```text
stream index = payload_absolute_seqno - 1
```

例如 SYN 与数据一起到达：

```text
segment absolute seqno = 0
SYN = 1
payload absolute seqno = 1
stream index = 0
```

普通的第一个数据报文：

```text
segment absolute seqno = 1
SYN = 0
payload absolute seqno = 1
stream index = 0
```

两种情况最终都正确映射到 Reassembler 的第 0 个字节。

### 5.2 为什么 payload absolute seqno 为 0 时不能 insert

我最初给这个判断写了错误注释，以为“等于 0 表示收到了 SYN”。实际上正好相反：
如果报文带 SYN，前一步已经加一，payload 起点会从 absolute 0 移到 absolute 1。

`payload_absolute_seqno == 0` 只能表示类似：

```text
message.SYN = false
message.seqno = ISN
```

也就是一条没有 SYN 的报文声称 payload 或 FIN 位于 absolute seqno 0。但 absolute
seqno 0 专门留给 SYN，普通数据不能占用它，因此这条报文应被忽略。

这个检查还避免了无符号下溢。如果继续计算：

```text
stream index = 0 - 1
```

`uint64_t` 不会得到 -1，而会回绕成 `UINT64_MAX`，使 Reassembler 看见一个极大的
伪造下标。

更准确的注释应表达：

```text
absolute sequence number zero is reserved for SYN;
payload/FIN cannot start there, and subtracting one would underflow.
```

### 5.3 为什么把 payload `std::move` 给 Reassembler

`receive()` 按值取得 message，当前函数拥有其中的字符串。Reassembler 的
`insert()` 也按值接收字符串。

如果直接传 `message.payload`，有名字的字符串是左值，通常需要复制整个 payload。
使用 `std::move` 表示之后不再需要它，允许 `std::string` 把内部缓冲区所有权转移给
`insert()`。

```text
不 move：复制 payload 字符
move：   转移指针、长度和容量
```

`std::move` 本身不搬运数据，它只是把表达式转换成可移动的右值；真正的资源转移由
`std::string` 的移动构造函数完成。移动后对象仍然合法，但不能再依赖原来的内容。

## 6. `send()` 与累计 ACK

`receive()` 不直接返回 ACK。外层 TCP 代码在需要回复时调用 `send()`，由它根据
当前整体状态生成 `TCPReceiverMessage`。

ACK 是累计确认，表达的是：

> 从开头到哪里已经全部连续收到，下一步需要哪个序列号？

如果先收到后面的乱序片段，它可以进入 Reassembler pending，但只要前面仍有空洞，
`bytes_pushed()` 就不会增加，ACK 也不会越过空洞。这与 SR 接收方缓存失序分组但
按序交付的思路相似。

### 6.1 ACK 如何计算 SYN 和 FIN

基础确认位置是已经连续组装的 payload 字节数：

```text
writer.bytes_pushed()
```

但 TCP absolute 编号还包含 SYN，因此始终加一：

```text
absolute ackno = bytes_pushed + 1
```

如果 Reassembler 已经知道 FIN，并且所有数据连续到达，Writer 会关闭。此时 FIN 也
已经被可靠接收，还要再加一：

```text
absolute ackno = bytes_pushed + 1 + writer.is_closed()
```

其中 bool 转换为整数后：

```text
未关闭：+0
已关闭：+1，确认 FIN
```

最后用 ISN 把 absolute ackno wrap 成 32 位 ackno。

如果尚未收到 SYN，ISN 为空，接收方无法产生有意义的 ACK，因此 `ackno` 应保持
`nullopt`。窗口大小和 RST 状态仍然可以生成。

## 7. 接收窗口、流量控制与 RST

TCPReceiver 返回的 `window_size` 表示从 ackno 开始，接收方目前还愿意接收多少
序列号。它直接来自 ByteStream 的可用容量：

```text
window size = writer.available_capacity()
```

当应用没有及时读取数据时：

```text
ByteStream buffered 增加
available_capacity 减少
TCP window 变小
发送方被迫放慢或停止
```

当应用调用 Reader 弹出数据后：

```text
ByteStream buffered 减少
available_capacity 增加
TCP window 重新扩大
发送方可以继续发送
```

协议中的窗口字段只有 16 位，最大值为 65,535。即使 ByteStream 容量更大，发送时
也要把窗口上限裁剪到 `uint16_t` 最大值，而不能直接强制转换，否则较大的容量可能
截断并回绕成一个错误的小窗口。

ACK 和 window 一起描述接收窗口：

```text
左边缘：ackno
右边缘：ackno + window_size
窗口：  [ackno, ackno + window_size)
```

ACK 表示连续接收进度，window 表示容量，两者不能混为一谈。

### 7.1 RST 如何传递错误状态

收到 sender message 中的 RST 时，需要把 ByteStream 标记为错误。这样错误状态由
底层流统一保存，而不是在 TCPReceiver 再维护一个重复的布尔变量。

反方向生成 receiver message 时，`send()` 查询 ByteStream 的错误状态并设置 RST。
因此错误传播路径是：

```text
收到 RST
   -> ByteStream error = true
   -> send().RST = true
```

即使还没收到 SYN，RST 也应被处理，所以它位于 receive 的早期返回之前。

## 8. 测试过程和环境问题

完整测试命令是：

```bash
cmake --build build --target check2
```

当前环境直接运行时，LeakSanitizer 会因为进程处于 ptrace 环境而退出：

```text
LeakSanitizer does not work under ptrace
```

这不是断言失败。为了区分环境问题和代码问题，我临时关闭 leak detection：

```bash
ASAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check2
```

Wrap32 也可以单独测试：

```bash
ASAN_OPTIONS=detect_leaks=0 \
ctest --test-dir build --output-on-failure \
-R '^wrapping_integers_'
```

最终结果：

```text
wrapping_integers_cmp        Passed
wrapping_integers_wrap       Passed
wrapping_integers_unwrap     Passed
wrapping_integers_roundtrip  Passed
wrapping_integers_extra      Passed

recv_connect                 Passed
recv_transmit                Passed
recv_window                  Passed
recv_reorder                 Passed
recv_reorder_more            Passed
recv_close                   Passed
recv_special                 Passed

30/30 tests passed
```

这些测试覆盖了：

- 非零 ISN；
- 多次 `2^32` 回绕；
- 大量随机 wrap/unwrap roundtrip；
- SYN 前到达的数据；
- SYN 与 payload 同时到达；
- 空 payload、FIN-only 和空流；
- 乱序、重叠和重复报文；
- 窗口缩小、窗口恢复和 16 位上限；
- 无效 absolute seqno 0；
- RST 错误传播。

## 9. 这次最容易犯的错误

回顾实现过程，最值得记录的错误有：

```text
把 Wrap32::raw_value_ 当成 SYN
把 2^32 - 1 当作 wrap 的模数
使用 1 << 32
unwrap 时拿 checkpoint 与 ISN 相减
忘记 absolute seqno 包含 SYN
把第一个 payload 的 absolute seqno 和 stream index 都当成 0
只在 payload 非空时调用 Reassembler，漏掉 FIN-only
用 payload_absolute_seqno - 1 时没有防止无符号下溢
把 ACK 理解成对单个报文的确认，而不是累计确认
窗口大于 UINT16_MAX 时直接强制转换
```

这些问题表面上分散，根源几乎都是没有先说明“当前变量属于哪套编号”。后来我把
变量名写得更具体：

```text
segment_absolute_seqno
payload_absolute_seqno
stream_index
absolute_ackno
```

代码虽然多了几个单词，但每次加一或减一的含义都明显了。

## 10. 总结

Checkpoint 2 把前两个 checkpoint 的通用组件接到了真实 TCP 语义上：

```text
Wrap32
  解决 32 位 seqno 与 64 位 absolute seqno 的转换

TCPReceiver::receive
  把 seqno/SYN/payload/FIN 转换成 Reassembler 输入

Reassembler + ByteStream
  负责乱序重组、容量限制、连续输出和结束状态

TCPReceiver::send
  根据连续接收进度和可用容量生成 ackno/window/RST
```

这个 lab 最重要的经验是：涉及协议编号时，不能只看数值是否相同，必须先明确编号
空间。SYN 的 absolute seqno 是 0，第一个数据字节的 stream index 也是 0，但它们
并不是同一个位置；中间隔着“absolute 编号包含 SYN、stream index 不包含 SYN”这条
规则。

把三套编号、每个控制标志占用的序列号和模块职责画清楚以后，TCPReceiver 本身
确实只需要很少代码。复杂性没有消失，而是被合理地分配给 Wrap32、Reassembler 和
ByteStream，各模块只维护自己真正拥有的状态。
