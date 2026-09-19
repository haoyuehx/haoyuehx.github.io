---
title: "CS144 Checkpoint 3：滑动窗口、累计确认与 TCP 重传"
date: 2026-08-21
lastmod: 2026-08-21
garden_tags: ["Networking", "CS144"]
project: "cs144"
project_tags: ["CS144", "Networking"]
cover: "/images/cs144/checkpoint-3.webp"
draft: false
summary: "记录 CS144 Checkpoint 3 的实现过程：TCPSender 如何填满接收窗口、管理未确认报文、处理累计 ACK，并用 RTO、指数退避和零窗口探测实现可靠发送。"
status: "seeding"
---

# CS144 Checkpoint 3：滑动窗口、累计确认与 TCP 重传

这篇文章记录我完成 Stanford CS144 Checkpoint 3 的过程。Checkpoint 2 实现了
TCPReceiver：接收带有 32 位序列号的 TCP 报文，把 payload 交给 Reassembler，并
根据连续接收进度生成 ACK 和窗口。Checkpoint 3 来到了连接的另一侧，需要实现
TCPSender，把应用写入 ByteStream 的字节切分成报文，并在不可靠网络上不断重传，
直到接收方确认。

这个 checkpoint 的代码仍然不算长，但几个状态之间的关系很紧密：

```text
next absolute seqno
latest cumulative ACK
advertised window
outstanding segments
retransmission timer
current RTO
consecutive retransmissions
```

一开始我把发送过程理解成“从 ByteStream 读一点，然后发出去”。真正写起来才发现，
`push()`、`receive()` 和 `tick()` 分别代表三类独立事件，它们必须通过同一组成员状态
保持一致。一个地方少更新一次，结果可能不是普通的断言失败，而是窗口计算错误、
错误重传，甚至直接进入无限循环。

最终运行：

```bash
ASAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check3
```

结果为 37 个测试全部通过，其中包括 SYN、payload、FIN、窗口变化、部分确认、零
窗口、无效 ACK、超时重传、指数退避、RST、性能测试和严格编译检查。

> CS144 希望学习者不要公开完整 lab 解答，因此本文记录接口理解、状态推导、
> 伪代码、错误和测试方法，不提供可直接提交的完整实现。

## 1. TCPSender 位于哪一层

应用面对的是一个连续的输出字节流：

```text
application
    |
    | Writer::push(data)
    v
ByteStream
    |
    | TCPSender::push()
    v
TCPSenderMessage
  seqno / SYN / payload / FIN / RST
    |
    v
unreliable network
```

ByteStream 不关心 TCP 序号、窗口和重传。它只保存应用已经写入、但 TCPSender 还没
取走的字节。TCPSender 需要完成四件事：

1. 根据接收窗口把字节切成一个或多个报文；
2. 给每个新报文分配正确的序列号，并处理 SYN 和 FIN；
3. 保存已发送但尚未完全确认的报文；
4. 超时后重传最早的未确认报文。

接收方会反向发送 `TCPReceiverMessage`：

```text
TCPReceiverMessage
  ackno / window_size / RST
          |
          | TCPSender::receive()
          v
更新累计确认、接收窗口和重传状态
```

因此 TCPSender 不是简单的序列化工具，而是一个小型状态机。

## 2. 四个入口对应四类事件

TCPSender 的主要接口可以按事件理解：

```text
push(transmit)
  应用有新数据，或者 ACK 推动窗口向右移动，尝试发送新报文

receive(receiver_message)
  收到累计 ACK、窗口通告或 RST，更新发送状态

tick(ms, transmit)
  外部通知时间经过，检查最早的 outstanding 报文是否超时

make_empty_message()
  生成当前正确 seqno 和 RST 状态的零长度报文
```

从网络事件角度看，`push()`、`receive()` 和 `tick()` 的发生顺序是异步的。但在这个
实验中，它们不是由多个线程同时执行，而是由外层代码依次调用：

```text
push -> tick -> tick -> receive -> push -> receive -> ...
```

所以不需要 mutex 或 atomic，但不能假设它们严格交替。例如，窗口通告可能在第一
次 `push()` 之前到达，也可能连续收到多个重复 ACK。

## 3. 序号按字节计算，发送按报文进行

我最早的一个疑问是：TCP 的 sequence number 按字节编号，是不是 TCPSender 也要
一个字节一个字节地发送？答案是否定的。

假设 SYN 已经确认，下一绝对序号为 1，ByteStream 中有：

```text
abcdefgh
```

窗口大小为 8 时，可以放进同一条消息：

```text
message.seqno  = absolute 1 wrapped with ISN
message.payload = "abcdefgh"
```

但消息中的每个字节仍各自占用一个序号：

| 字节 | a | b | c | d | e | f | g | h |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| absolute seqno | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |

接收方完整收到后通常返回累计 `ACK = 9`，意思不是“确认第 9 个字节”，而是：

> 9 之前的序号已经连续收到，下一步需要序号 9。

如果窗口大于单个 payload 上限，`push()` 会连续构造多个消息。假设窗口为 2500，
ByteStream 中数据充足，而 `MAX_PAYLOAD_SIZE` 为 1000：

```text
message 1: 1000 bytes
message 2: 1000 bytes
message 3:  500 bytes
```

所以“填满窗口”表示一次 `push()` 可以调用多次 `transmit()`，不是生成一个无限大
的 TCP 报文。

## 4. SYN 和 FIN 为什么也占窗口

`TCPSenderMessage::sequence_length()` 的定义是：

```text
SYN + payload.size() + FIN
```

SYN 和 FIN 没有 payload 字节，但各自消耗一个 TCP 序号，因此也占接收窗口空间。
例如一个空字节流可以用下面的报文表示：

```text
SYN = true
payload = ""
FIN = true
sequence_length = 2
```

如果第一次 `push()` 时窗口仍是默认值 1，就只能发送一个 SYN-only 报文：

```text
absolute seqno 0: SYN
```

它虽然没有 payload，却不是零长度 TCP 消息，因为 `sequence_length()` 为 1。它
必须进入 outstanding 队列，也必须启动重传计时器。

如果在第一次 `push()` 前已经收到了更大的窗口通告，同一条报文可以包含：

```text
SYN + payload + FIN
```

构造一条新报文时，我最终采用的顺序是：

```text
1. 放入 SYN（如果还没发送）
2. 尽可能读取 payload
3. 数据流已经结束且仍有空间时，放入 FIN
```

必须先读取 payload 再判断 `Reader::is_finished()`。最后一批字节被读走之后，Reader
才可能从“已关闭但仍有缓冲数据”变成 finished。

## 5. TCPSender 需要保存哪些状态

我把状态分成四组。

第一组是字节流和序号零点：

```text
ByteStream input
Wrap32 ISN
```

第二组描述发送进度和窗口：

```text
next_seqno
latest absolute ACK
receiver_window_size
SYN sent?
FIN sent?
```

`next_seqno` 是下一个新报文应该使用的绝对序号。它从 0 开始，只在发送新报文时
增加：

```text
next_seqno += message.sequence_length()
```

重传旧报文不能再次增加它。`make_empty_message()` 也不占序号，因此不修改它。

第三组是 outstanding 队列。每项至少需要保存：

```text
完整 TCPSenderMessage
该消息的绝对起始序号
```

使用 deque 很自然：新消息按序号递增进入队尾，累计 ACK 从队首删除已经完全确认
的消息，超时时也只重传队首。

第四组是重传计时器：

```text
initial RTO
current RTO
elapsed milliseconds
consecutive retransmissions
```

不一定需要单独的 `timer_running`。只要维护不变量：

```text
outstanding 为空     -> 计时器停止
outstanding 不为空   -> 计时器运行
```

就可以用队列是否为空表示计时器状态。

## 6. `push()`：如何真正填满窗口

`push()` 的核心不是“ByteStream 里有多少数据”，而是“当前还能占用多少序号”。

假设：

```text
next_seqno = 11
absolute ACK = 4
receiver window = 10
```

那么已经发送但未确认的序号数量为：

```text
in_flight = next_seqno - ACK = 7
```

还可以发送：

```text
available = window - in_flight = 3
```

对应的范围是：

```text
接收窗口：[4, 14)
已发送：  [4, 11)
可发送：  [11, 14)
```

### 6.1 为什么窗口满要判断 `>=`

正常填充时，`in_flight` 最多等于窗口。但窗口由接收方通告，可能在已有数据飞行
途中缩小：

```text
原窗口 = 5，发送方已经发出 5 个序号
新窗口 = 2，ACK 没有前进
此时 in_flight = 5 > window = 2
```

已经发出的内容不能撤回，只能停止发送新数据。因此条件必须是：

```text
if in_flight >= effective_window:
    stop filling
```

如果只判断相等，随后计算无符号整数 `window - in_flight` 会下溢成一个巨大的正数。

### 6.2 零窗口为什么临时当作 1

接收方通告窗口为零时，如果发送方永远不发送，就可能永远不知道窗口已经重新打开。
所以 `push()` 需要临时把零窗口视为 1，允许发送一个序号作为窗口探测：

```text
effective_window = advertised_window == 0 ? 1 : advertised_window
```

但成员变量必须保留真实的零：

```text
receiver_window_size = 0
```

这是因为 `tick()` 超时重传零窗口探测时，不应该增加连续重传次数，也不应该对 RTO
做指数退避。临时窗口 1 只属于 `push()` 的局部计算。

### 6.3 一条报文如何尽量装满

每轮循环构造一条消息，大致过程是：

```text
计算当前剩余窗口
创建带有正确 seqno/RST 的空消息
如果 SYN 未发送，消耗一个空间放 SYN
读取 min(剩余空间, MAX_PAYLOAD_SIZE) 个 payload 字节
如果输入结束且仍有空间，消耗一个空间放 FIN
如果 sequence_length 为零，退出
记录消息、推进 next_seqno、必要时启动计时器、调用 transmit
```

这里 `MAX_PAYLOAD_SIZE` 只限制 payload，不限制整个 sequence length。一条消息在窗口
足够时可以占用：

```text
1 SYN + MAX_PAYLOAD_SIZE bytes + 1 FIN
```

读取 payload 最好使用项目提供的 `read(Reader&, max_len, string&)`，而不是只调用
一次 `peek()`。ByteStream 是环形缓冲区，一段逻辑连续的数据可能在底层数组中跨越
末尾，`read()` 已经负责多次 peek/pop。

### 6.4 为什么构造完再统一更新 `next_seqno`

我一开始想在添加 SYN 时立刻执行：

```text
message.SYN = true
next_seqno++
```

如果消息完成后又执行：

```text
next_seqno += message.sequence_length()
```

SYN 就会被计算两次。payload 和 FIN 也存在同样风险。

更清楚的做法是把过程分成两阶段：

```text
构造阶段：只修改 message 和局部 available_space
提交阶段：根据最终 sequence_length 一次更新全局状态
```

这样消息的绝对起始序号始终是构造前的 `next_seqno`，也更方便保存到 outstanding
队列中。

### 6.5 计时器何时启动

每次发送非零长度的新消息时，如果计时器尚未运行，就从零开始计时。如果已经有
更早的 outstanding 消息，发送新消息不能重置计时器：

```text
发送 A，timer = 0
经过 900 ms
发送 B，timer 仍然是 900 ms
再经过 100 ms，A 达到 RTO，应当重传 A
```

因此可以在消息入队前记录：

```text
timer_was_stopped = outstanding.empty()
```

只有原队列为空时才把 elapsed 清零。

## 7. `receive()`：累计 ACK 如何推动窗口

`receive()` 同时处理三件事：

```text
RST
advertised window
cumulative ACK
```

RST 要最先传播到 ByteStream。窗口字段即使在 `ackno` 为空时仍然有意义，因此也要
更新。只有 ACK 相关逻辑需要等待 `ackno.has_value()`。

### 7.1 unwrap ACK 与拒绝未来确认

线上 ACK 是 32 位 Wrap32，内部状态使用 64 位绝对序号。当前已发送到的
`next_seqno` 是自然的 checkpoint：

```text
absolute_ack = ackno.unwrap(ISN, next_seqno)
```

接收方不能确认发送方尚未发送的数据：

```text
absolute_ack > next_seqno -> invalid ACK
```

无效 ACK 不能删除 outstanding 消息，也不能重置 RTO 和重传次数。

重复 ACK 和旧 ACK 同样不能让确认进度倒退：

```text
absolute_ack <= latest_ack -> no new data acknowledged
```

它们可能携带窗口信息，但不属于“确认了新数据”的事件，因此不能重启计时器。

### 7.2 什么时候从 outstanding 删除消息

假设一条消息的绝对范围是：

```text
[segment_start, segment_start + sequence_length)
```

只有满足：

```text
segment_end <= absolute_ack
```

消息占用的所有序号才被完全确认，可以从队首删除。

如果 ACK 只确认了一个消息的前半部分，本实验不要求裁剪 payload：

```text
segment = [1, 4), payload="abc"
ACK = 2
```

此时 ACK 进度可以前进到 2，但完整的 `"abc"` 仍保留在 outstanding 队列中。超时
后依然原样重传整个消息，直到收到 `ACK >= 4` 才删除。

### 7.3 新 ACK 如何重置重传状态

只要收到严格大于历史 ACK、且不超过 `next_seqno` 的有效确认，就说明有新数据
成功到达。此时需要：

```text
current RTO = initial RTO
consecutive retransmissions = 0
elapsed timer = 0
```

如果删除后队列为空，计时器自然停止；如果仍有 outstanding 消息，则从初始 RTO
重新为新的队首计时。

### 7.4 一次漏掉 `pop_front()` 导致的无限循环

这次最直接的 bug 出现在删除已确认消息的循环中。我最初只写了退出条件，却忘记
真正弹出队首：

```text
while outstanding is not empty:
    inspect front
    if front is not fully acknowledged:
        break
    // forgot to pop front
```

SYN 的范围是 `[0, 1)`。收到 `ACK = 1` 后，队首已经完全确认，不满足 break 条件；
但队列又没有变化，于是下一轮继续检查同一个 SYN，形成死循环。测试表现为：

```text
receive(ACK for SYN), then push
individual test step took longer than 2 seconds
```

这个错误提醒我：检查队列循环时，除了验证终止条件，还要确认每一条不终止的路径
都会让循环状态前进。

## 8. `tick()`：实验中唯一的时间来源

`tick(ms_since_last_tick)` 不是询问系统当前时间，而是外部明确通知又过去了多少毫秒。
实现中不应调用 `time()`、`clock()` 或 `gettimeofday()`：

```text
tick(600) -> elapsed += 600
tick(399) -> elapsed += 399，共 999
tick(1)   -> elapsed 达到 1000，RTO 到期
```

这种设计让测试完全确定，不受机器速度和调度影响。

### 8.1 到期时重传谁

如果 outstanding 为空，计时器没有运行，`tick()` 直接返回。否则累计 elapsed，并在：

```text
elapsed >= current RTO
```

时重传队首，也就是最低序号、最早尚未完全确认的消息。

这里的边界容易写错。判断“尚未到期”应当是：

```text
elapsed < current RTO -> return
```

如果写成 `elapsed <= current RTO`，恰好等于 RTO 时反而不会重传，会比要求多等待
一次 tick。

重传旧消息时不能：

```text
增加 next_seqno
再次放入 outstanding
重新读取 ByteStream
改变消息的 SYN/FIN/payload
```

只需要把保存的完整消息再次交给 `transmit()`。

### 8.2 指数退避

普通非零窗口下，每次超时重传后：

```text
consecutive retransmissions += 1
current RTO *= 2
elapsed = 0
```

例如初始 RTO 为 1000 ms：

```text
第 1 次超时：1000 ms 后重传，下一次等待 2000 ms
第 2 次超时：2000 ms 后重传，下一次等待 4000 ms
第 3 次超时：4000 ms 后重传，下一次等待 8000 ms
```

指数退避避免网络已经拥塞时仍以固定高频率重复发送。

### 8.3 零窗口下为什么不退避

窗口为零时，发送的一个序号是窗口探测，不表示网络丢包。超时后仍然需要重传，
但不能把它计为连接质量恶化：

```text
advertised window == 0:
    retransmit oldest segment
    do not increment consecutive retransmissions
    do not double RTO
```

这也是为什么 `receive()` 必须保存真实窗口 0，而不是提前把它改成 1。

一次 `tick()` 即使传入的时间远大于 RTO，本实验也只重传一次，然后从零开始下一轮
计时。`tick()` 表示一次观察事件，不要求补做所有理论上错过的超时。

## 9. `make_empty_message()` 并不是发送空数据

`make_empty_message()` 只构造并返回消息，不调用 `transmit()`。它需要设置：

```text
seqno = wrap(next_seqno, ISN)
RST   = ByteStream error state
SYN   = false
FIN   = false
payload = empty
```

这种消息的 `sequence_length()` 为零，所以：

```text
不进入 outstanding
不启动计时器
不增加 next_seqno
不会被重传
```

它用于外层需要发送 ACK 等控制信息、但当前没有发送方数据可以携带时。C++20 的聚合
指定初始化可以只写 `seqno` 和 `RST`，其余字段使用结构体中的默认成员初始化值。

RST 状态最好直接复用 ByteStream 的 error flag，而不是在 TCPSender 中再保存一个
重复布尔值：

```text
receive RST -> ByteStream error = true
make/send message -> RST reflects ByteStream error
```

## 10. 测试过程与环境问题

完整测试命令是：

```bash
cmake --build build --target check3
```

和 Checkpoint 2 一样，当前环境直接运行时，LeakSanitizer 会因为进程处于 ptrace 环境
而退出：

```text
LeakSanitizer does not work under ptrace
```

这不是 TCPSender 断言失败。关闭 leak detection 后可以验证其余 sanitizer 和功能：

```bash
ASAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check3
```

最终结果：

```text
compile with bug-checkers      Passed

send_connect                   Passed
send_transmit                  Passed
send_window                    Passed
send_ack                       Passed
send_close                     Passed
send_retx                      Passed
send_extra                     Passed

compile with optimization      Passed
byte_stream_speed_test         Passed
reassembler_speed_test         Passed

37/37 tests passed
```

发送方测试覆盖了：

- SYN-only、SYN 与 payload 同报文；
- 多次短写入和大窗口连续分段；
- `MAX_PAYLOAD_SIZE` 只限制 payload；
- FIN-only、payload + FIN 和 SYN + FIN；
- 窗口增长、缩小、填满和零窗口探测；
- 合法、重复、过期、部分和越界 ACK；
- 最早 outstanding 报文重传；
- 精确 RTO 边界和跨越 RTO 的 tick；
- 新 ACK 重置 RTO，重复 ACK 不重置；
- 非零窗口指数退避与零窗口不退避；
- RST 双向错误传播。

## 11. 这次最容易犯的错误

回顾实现过程，最值得记录的问题有：

```text
把 TCP 按字节编号误解成每字节发送一条消息
忘记 SYN 和 FIN 各占一个窗口位置
把 MAX_PAYLOAD_SIZE 当成整个 sequence length 的上限
第一次 push 前忘记默认窗口为 1
在 receive 中把零窗口永久改成 1
窗口缩小时只判断 in_flight == window，没有处理大于
使用无符号 window - in_flight 时没有防止下溢
构造 SYN 时提前增加 next_seqno，提交消息时又增加一次
发送新消息时无条件重置已经运行的计时器
把 ACK 当成对单条报文的确认，而不是累计确认
收到部分 ACK 后裁剪 outstanding 消息，增加不必要复杂度
接受超过 next_seqno 的未来 ACK
重复 ACK 也重置 RTO 和重传次数
删除队首的 while 循环忘记 pop_front，造成无限循环
在 tick 中用 elapsed <= RTO 判断未到期
重传时再次增加 next_seqno 或重复入队
零窗口重传时错误地进行指数退避
调用系统时钟，而不是只使用 tick 参数
调用 has_error() 试图设置错误，而不是 set_error()
```

这些错误背后的共同问题，是没有把“构造一个新报文”“确认旧序号”和“重传旧报文”
分成三个不同状态变化：

```text
发送新报文：分配新序号，进入 outstanding
收到新 ACK：推进确认点，删除已完全确认的消息
超时重传：复用旧消息，不分配任何新序号
```

只要先判断当前属于哪一类事件，很多容易重复更新的变量就会变得清楚。

## 12. 总结

Checkpoint 3 完成了 TCP 发送方向的核心可靠性机制：

```text
ByteStream
  保存应用尚未发送的连续字节

TCPSender::push
  根据 ACK 和 advertised window 切分并发送新报文

outstanding deque
  保存尚未完全确认、未来可能需要重传的完整消息

TCPSender::receive
  处理累计 ACK、窗口变化和 RST

TCPSender::tick
  驱动 RTO、最早报文重传和指数退避
```

这个 checkpoint 最重要的经验，是把滑动窗口理解成两个不断向右移动的边界：

```text
left edge  = cumulative ACK
right edge = cumulative ACK + advertised window
```

`next_seqno` 位于其中，表示已经发送到哪里。`push()` 只能把它向右推进到窗口右边缘；
`receive()` 通过新 ACK 推动左边缘；`tick()` 在左边缘长时间不动时，重新发送最早
的 outstanding 消息。

到这里，Checkpoint 1 的 Reassembler、Checkpoint 2 的 TCPReceiver 和 Checkpoint 3
的 TCPSender 已经组成了一条完整的可靠字节流路径。TCP 的许多细节看起来分散，
但最终都围绕同一个目标：在窗口允许的范围内发送新序号，并确保每个序号最终至少
被接收方成功收到一次。
