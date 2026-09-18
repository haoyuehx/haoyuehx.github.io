---
title: "CS144 Checkpoint 5：用 ARP 连接 IP 数据报与以太网帧"
date: 2026-08-24
lastmod: 2026-08-24
garden_tags: ["Computer Network", "CS144", "C++", "ARP", "Ethernet"]
project: "cs144"
project_tags: ["CS144", "Computer Network"]
draft: false
summary: "记录 CS144 Checkpoint 5 NetworkInterface 的设计与实现：区分最终目标与下一跳，用 ARP 解析 MAC 地址，缓存待发送数据报，并处理以太网帧收发和超时。"
status: "seeding"
---

# CS144 Checkpoint 5：用 ARP 连接 IP 数据报与以太网帧

这篇文章记录我完成 Stanford CS144 Checkpoint 5 中 `NetworkInterface` 的过程。
前面的 checkpoint 主要围绕 TCP：应用写入连续字节流，发送方把字节切成报文，
接收方再按序列号重组。到了这里，视角继续向下移动。一个 TCP 报文段被放进 IP
数据报之后，IP 数据报仍然不能凭空到达下一台设备，它还要被封装进当前链路能够
传输的以太网帧。

开始时，我看到构造函数已经初始化了接口名称、输出端口、以太网地址和 IP 地址，
一度不明白还需要实现什么。后来才意识到，构造函数只保存了接口的固定身份，真正
的任务是实现它在运行期间的行为：

```text
发送 IP 数据报时：下一跳 IP -> ARP 查询 MAC -> 封装以太网帧
收到以太网帧时：  过滤目标 MAC -> 解析 IPv4 或 ARP -> 上交或回复
时间经过时：      让 ARP 缓存和未完成请求按规则过期
```

这次最难的地方也不是 C++ 语法，而是先分清最终目标 IP、下一跳 IP 和下一跳 MAC
分别属于哪一层、在什么时候使用。

最终运行：

```bash
LSAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check5
```

严格编译检查、`net_interface` 和 `no_skip` 均通过。

> CS144 希望学习者不要公开完整 lab 解答，因此本文记录分层理解、状态设计、
> 处理流程、伪代码、错误和测试方法，不提供可直接提交的完整实现。

## 1. 从 IP 到以太网，中间缺了什么

`NetworkInterface` 的注释说它连接 Internet layer 与 network access layer。对应到
常见的五层模型，就是连接网络层和链路层：

```text
应用层       HTTP
传输层       TCP
网络层       IPv4                InternetDatagram
                         <--- NetworkInterface --->
链路层       Ethernet / ARP       EthernetFrame
物理层       网线、光纤、无线信号
```

从发送方向看，上层把两个参数交给接口：

```cpp
send_datagram( dgram, next_hop )
```

- `dgram` 是已经构造好的 IPv4 数据报，内部包含最终源 IP 和目标 IP；
- `next_hop` 是路由选择之后，这一跳应该交给的接口 IP；
- `NetworkInterface` 要把 `next_hop` 的 IP 解析成 MAC，再构造以太网帧；
- `OutputPort::transmit()` 最终把帧送入实际或模拟的链路。

从接收方向看，接口拿到的是完整以太网帧。它先判断目标 MAC，再根据 EtherType
决定 payload 是 IPv4 还是 ARP。IPv4 数据报会进入 `datagrams_received_`，等待上层
读取；ARP 消息则在本层被学习、回复或用于唤醒待发送数据报。

因此它不是路由器本身，也不是单纯的序列化工具，而是一个带缓存、队列和时间状态
的小型协议实体。

我最开始的直觉是：IP 地址已经能表示目标，为什么还要链路层地址？原因是 IP 与
以太网解决的问题不同：

```text
IP：  跨越多个网络，决定数据报最终去哪里、当前交给哪个下一跳
MAC：只在当前链路上，决定这一帧实际交给哪个网络接口
```

以访问 `8.8.8.8` 为例，假设本机位于 `192.168.1.0/24`，默认网关为
`192.168.1.1`。路由表发现 `8.8.8.8` 不在本地子网，于是选择默认网关作为下一跳。
这一跳发出的帧会类似：

```text
EthernetFrame
  dst MAC = 默认网关的 MAC
  src MAC = 本机接口的 MAC
  type    = IPv4
  payload = InternetDatagram
              dst IP = 8.8.8.8
              src IP = 本机 IP
```

这里两个“目标”并不相同：

```text
目标 IP  = 8.8.8.8             最终目的地
目标 MAC = 192.168.1.1 的 MAC  当前这一跳的接收者
```

路由器收到帧后去掉旧链路的帧头，读取目标 IP，查询自己的路由表，再为下一条链路
构造新的帧。目标 IP 通常保持不变，目标 MAC 则逐跳改变。

这也解释了交换机和路由器的区别：

| 设备 | 主要层级 | 查看地址 | 保存状态 |
|---|---:|---|---|
| 交换机 | 链路层（L2） | MAC | MAC 地址表 |
| 路由器 | 网络层（L3） | IP | 路由表 |

交换机让帧在当前局域网内到达正确端口，路由器让 IP 数据报跨越不同网络。
`NetworkInterface` 正处于二者使用的信息交界处：上层已经选好了下一跳 IP，它负责
找到下一跳 MAC 并真正发帧。

如果 ARP 缓存里还不知道 `192.168.1.1` 对应哪个 MAC，本机就无法填写以太网帧的
`dst`。ARP 的基本过程是：

```text
本机广播：谁拥有 192.168.1.1？请告诉 192.168.1.10
                           |
                           v
网关单播：192.168.1.1 在 aa:bb:cc:dd:ee:ff
```

ARP 请求的以太网目标地址是：

```text
ff:ff:ff:ff:ff:ff
```

同一广播域中的设备都会收到这条请求，但正常情况下只有 ARP 消息中
`target_ip_address` 对应的接口回复。回复通常是发回请求者 MAC 的单播帧。

需要特别注意，广播并不意味着同一子网内所有设备都能看到所有网页数据。现代交换
网络会把普通单播帧转发到目标 MAC 所在端口；广播主要用于 ARP 这类需要让本地所有
接口都看到的消息。

ARP 解析的也不是任意最终 IP，而是：

> 下一跳 IP -> 下一跳在当前链路中的 MAC

如果最终目标就在同一子网，下一跳可能就是最终目标；如果最终目标在互联网中，
下一跳通常是网关。

## 2. 构造函数之外还要保存哪些状态

初始头文件中的构造函数已经保存：

```text
name_              人类可读的接口名
port_              输出帧的端口
ethernet_address_  本接口的 MAC
ip_address_        本接口的 IP
```

这些都是相对固定的属性。但网络接口工作时还必须记住动态信息：

```text
已经学到的 IP -> MAC 映射
每条映射已经存在多久
哪些下一跳正在等待 ARP 回复
每个下一跳后面排队了哪些 IP 数据报
ARP 请求已经等待多久
已经收到并准备交给上层的 IPv4 数据报
```

所以“private 变量已经赋值”和“类已经实现完成”是两件事。构造函数解决的是对象
刚创建时处于什么状态，三个成员函数解决的是对象遇到发送、接收、时间流逝事件时
如何改变状态。

我最后使用了两个以 32 位 IPv4 数值地址为 key 的映射。它们看起来相似，语义和
生命周期却不同。

每个缓存项需要保存：

```text
next-hop IP -> { EthernetAddress, age }
```

它表示“当前知道这个 IP 对应哪个 MAC”。收到任何有效 ARP 请求或回复时，都能从
sender 字段学习映射，并把该项年龄重置为零。缓存项存活 30 秒，之后必须重新 ARP。

年龄属于每个映射，不能用一个全局计时器。两个映射可能分别在第 0 秒和第 15 秒
学到，那么它们也应该分别在第 30 秒和第 45 秒过期。

每个未完成项需要保存：

```text
next-hop IP -> { queue<InternetDatagram>, age }
```

它同时表达两件事：

1. 已经为这个 IP 发过 ARP 请求，5 秒内不要重复广播；
2. 这些数据报都在等待同一个 MAC，得到回复后要按顺序发出。

将“请求是否 pending”和“等待的数据报队列”放在同一项里，可以自然保持一个重要
不变量：

```text
存在 pending_[ip]
    <=>
最近 5 秒内已经为 ip 发过请求，并且相关数据报正在等待
```

不同下一跳必须有独立队列。否则同时查询 A 和 B，而 B 的回复先到时，就可能错误地
把 A 的数据报发给 B。

```text
ARP cache：30 秒，限制已知映射的新鲜度
pending：   5 秒，限制重复请求并决定等待数据报的生命周期
```

5 秒后仍未收到回复，pending 项连同旧数据报一起丢弃。之后如果上层又发送一个新
数据报，接口才会建立新的 pending 项并再次广播。这不是每 5 秒自动重传一次，
因为实验只要求在新的发送事件到来时触发查询。

## 3. `send_datagram()`：先查缓存，再决定发送或等待

`send_datagram()` 的思考顺序可以压缩成三个分支：

```text
输入 dgram, next_hop
        |
        v
ARP cache 中有 next_hop？
  | yes                    | no
  v                        v
封装 IPv4 帧并发送      已经有 pending 项？
                           | yes          | no
                           v              v
                        只追加队列     建立队列
                                       广播一次 ARP 请求
```

已知下一跳 MAC 时，不需要修改 IP 数据报本身，只要给它套上一层以太网头：

```text
frame.src  = 本接口 MAC
frame.dst  = 缓存中的下一跳 MAC
frame.type = IPv4
frame.payload = serialize(dgram)
```

尤其不能把 `dgram.header.dst` 改成 `next_hop`。前者是最终目标，后者只负责当前一跳。

如果缓存没有映射，并且这个 IP 还没有 pending 项，需要：

1. 建立该 IP 对应的等待队列；
2. 把数据报放进去；
3. 将请求年龄设为零；
4. 广播一条 ARP 请求。

顺序上最好先把本地状态准备好，再发送请求。这样从状态机角度看，请求一旦发出，
对象已经处于“正在等待回复”的一致状态。

如果 5 秒内又收到发往同一下一跳的数据报，只追加到现有队列，不能再次发 ARP：

```text
dgram1 -> queue
dgram2 -> queue
dgram3 -> queue

网络上只有一条 ARP request
```

等回复到达后，三个数据报都要发送，不能只保存最后一个，也不能因为内容相同就去重。
上层调用了两次发送，就代表两个独立的发送动作。

## 4. ARP 请求如何构造

ARP 消息本身和承载它的以太网帧各有一组地址：

```text
Ethernet header
  src  = 本接口 MAC
  dst  = ff:ff:ff:ff:ff:ff
  type = ARP

ARP payload
  opcode                   = REQUEST
  sender_ethernet_address  = 本接口 MAC
  sender_ip_address        = 本接口 IP
  target_ethernet_address  = 空地址
  target_ip_address        = 要查询的下一跳 IP
```

请求中未知的正是 target Ethernet address，因此它不能被提前填成广播地址。广播是
外层以太网帧的投递方式；ARP payload 中目标硬件地址仍然表示“尚不知道”。

为了避免在缓存命中和 ARP 回复到达后重复拼装 IPv4 帧，我把“数据报 + 目标 MAC ->
发送帧”抽成了一个小 helper。ARP 请求也单独封装成 helper。这样主流程描述的是状态
转移，而不是被字段赋值淹没。

## 5. `recv_frame()`：先过滤，再按类型处理

接收端比发送端更容易写成一个很长的函数。比较清楚的处理顺序是：

```text
收到 EthernetFrame
        |
        v
目标 MAC 是本机或广播？ -- no --> 忽略
        |
       yes
        v
EtherType 是 IPv4？ ---- yes --> 解析成功后上交
        |
       no
        v
EtherType 是 ARP？ ----- no --> 忽略
        |
       yes
        v
解析 ARP -> 学习 sender -> 必要时回复 -> 冲刷对应 pending 队列
```

网络接口可能看到广播帧，也可能在测试或共享链路上看到发给其他接口的帧。只有下面
两种目标需要继续处理：

```text
frame.header.dst == ethernet_address_
frame.header.dst == ETHERNET_BROADCAST
```

发给其他 MAC 的 IPv4 或 ARP 帧都应该安静地忽略，而不是上交或学习。

如果 EtherType 表示 IPv4，就尝试把 payload 解析为 `InternetDatagram`。只有解析
成功才进入 `datagrams_received_`：

```text
Ethernet payload
      |
      | parse
      v
InternetDatagram -> queue -> 上层 Router / TCP-IP adapter
```

链路层接口不需要在这里解析 TCP 端口、序列号或 HTTP。分层的意义正是每一层只处理
自己的头部，然后把 payload 交给上层。

ARP 请求与回复都包含发送者的 IP 和 MAC，所以两者都可以更新缓存：

```text
arp.sender_ip_address -> arp.sender_ethernet_address
```

只从 reply 学习会漏掉一个很有用的场景：其他主机广播询问本机时，它已经在请求中
主动告诉了自己的地址。本机回复之后如果马上要向它发送数据，就应该直接使用刚学到
的映射，不必再反向发一遍 ARP 请求。

如果同一个 IP 的映射已存在，再次收到消息不仅要更新 MAC，也要把年龄重置为零。
否则一个刚刚重新确认过的映射仍可能马上按旧时间过期。

不是收到任何广播 ARP 都回复。必须同时满足：

```text
opcode == REQUEST
target_ip_address == 本接口 IP
```

回复帧是发给请求者 MAC 的单播。ARP payload 中 sender 字段换成本接口身份，target
字段则填写原请求者的地址。

学习 sender 映射之后，检查的 key 应该是：

```text
arp.sender_ip_address
```

如果恰好有对应 pending 项，就取出该 IP 的整个队列，用刚学到的 sender MAC 逐个
发送，然后删除 pending 项。这样即使多个 ARP 回复乱序到达，每条回复也只会唤醒
属于自己的数据报。

## 6. `tick()`：让两类状态独立过期

和 TCPSender 的重传计时器一样，NetworkInterface 不应该在业务代码中读取系统
时钟。测试通过：

```cpp
tick( ms_since_last_tick )
```

明确告诉对象经过了多少毫秒。每次调用要分别遍历两张表：

```text
ARP cache entry.age += elapsed
    age >= 30000 -> erase

pending entry.age += elapsed
    age >= 5000  -> erase，同时丢弃等待数据报
```

边界应使用 `>=`，因为一次 tick 可能直接跨过阈值，例如从 4,990 ms 增加 20 ms。
只判断等于 5,000 会永久错过过期时刻。

C++ 中遍历容器时删除当前元素，需要使用 `erase()` 返回的下一个迭代器：

```cpp
for ( auto it = table.begin(); it != table.end(); ) {
  if ( expired( it->second ) )
    it = table.erase( it );
  else
    ++it;
}
```

这里展示的是通用遍历模式，不是完整 lab 实现。重点是删除后不能再对已经失效的旧
迭代器执行 `++it`。

## 7. 实现中最容易出错的地方

回看这次实现，最容易混淆的问题基本都来自“把两层地址或两类状态当成同一个东西”。
我最后归纳出下面几点：

1. `InternetDatagram` 的目标 IP 由上层决定，`next_hop` 由路由表决定。
   NetworkInterface 只为下一跳查 MAC，不能篡改最终目标 IP。
2. ARP 请求是广播，但之后的 ARP 回复和 IPv4 数据通常是单播。同一广播域的接口都
   可能看到请求，正常情况下只有目标 IP 所有者回复。
3. 一条 pending 记录必须容纳多个数据报。只保存一个对象会让后来的发送覆盖先前
   数据，队列才能保持调用次数和顺序。
4. 不同 IP 的计时和队列必须独立。全局一个“最近发过 ARP”的标志会错误抑制其他
   目标的请求，全局等待队列则会在回复乱序时把数据发给错误 MAC。
5. 学习发生在 request 和 reply 两条路径。ARP sender 字段本身就是一条地址声明，
   先统一学习、再判断是否回复，状态转移会更简单。
6. EtherType 只是声称 payload 的类型，仍要检查 `parse()` 是否成功。格式错误的
   IPv4 或 ARP payload 不能进入缓存或接收队列。
7. 新增的 `unordered_map` 和 `queue` 可以默认初始化为空，构造函数不必为了看起来
   完整而重复初始化所有容器。

C++ 层面也有几个小选择能让实现更清晰。`Address::ipv4_numeric()` 返回的
`uint32_t` 很适合作为 `unordered_map` 的 key；使用 `find()` 可以在一次哈希查询后
继续访问元素，也避免 `operator[]` 意外插入。收到 ARP 后，我先把待发送队列移动到
局部变量、删除 pending 项，再逐个 `transmit()`，这样状态转换和输出动作不会互相
缠绕。至于 helper，“发送目标 MAC 已知的 IPv4 帧”和“广播 ARP 请求”都是完整且
重复的语义，抽出来之后三个入口函数会更接近协议状态机本身。

## 8. 测试如何覆盖状态机

仅测试“请求一次、回复一次、发出一个数据报”远远不够。这个模块的错误往往出现在
事件交错和时间边界中，至少应覆盖：

1. 缓存未知时广播 ARP，请求字段和帧头均正确；
2. 同一 IP 在 5 秒内连续发送，只广播一次但保存所有数据报；
3. ARP 回复到达后，等待队列按顺序全部发送；
4. 两个 IP 的回复乱序到达，数据报仍发给正确 MAC；
5. 从 ARP request 也能学习映射；
6. 只有询问本机 IP 的 request 才回复；
7. ARP 映射在 30 秒后过期，再次发送需要重新查询；
8. 再次学习已有映射时，其 30 秒年龄重新开始；
9. pending 在 5 秒后过期，旧数据报被丢弃，新发送触发新请求；
10. 发给其他 MAC 的帧、未知 EtherType 和解析失败 payload 被忽略；
11. 发给本机的合法 IPv4 数据报进入接收队列。

这次运行普通 `check5` 时，LeakSanitizer 在受 ptrace 影响的环境中可能报告：

```text
LeakSanitizer does not work under ptrace
```

这不是协议断言失败。当前环境可以暂时关闭不可用的泄漏检测，再运行同一组编译和
功能测试：

```bash
LSAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check5
```

如果关闭后仍有测试失败，就应该回到具体测试行为，而不是把所有错误都归因于运行
环境。

## 9. 从网页访问重新看完整分层

完成这个 checkpoint 后，前面几次实验终于能连成一条更完整的路径。以 HTTP/1.1
或 HTTP/2 over TCP 为例，发送方向是：

```text
HTTP message
    |
    v
TCP segment             端口定位进程，序列号保证有序可靠
    |
    v
IPv4 datagram           IP 定位最终主机，路由表选择下一跳
    |
    v
Ethernet frame          MAC 在当前链路交付给下一跳
    |
    v
physical link
```

接收方向逐层相反：

```text
Ethernet frame
    -> IPv4 datagram
    -> TCP segment
    -> 重组后的可靠字节流
    -> TLS 解密（HTTPS）
    -> HTTP response
    -> HTML / CSS / JS / 图片
    -> 浏览器渲染
```

TCP 重组得到的不是“最终网页”，而是有序字节流；HTTP 和浏览器还要继续解释内容。
同样，NetworkInterface 也不理解 TCP 端口和网页，它只把以太网与 IP 之间的边界处理
正确。每一层只完成一小部分职责，组合起来才形成一次真实网络通信。

Checkpoint 5 的代码量不算大，但它让我第一次真正理解 IP 地址和 MAC 地址为什么要
同时存在。最关键的认识可以归纳为：

1. IP 负责跨网络寻址，MAC 负责当前链路的一跳交付；
2. 路由模块选择下一跳 IP，NetworkInterface 用 ARP 找到下一跳 MAC；
3. 最终目标 IP 通常不变，以太网目标 MAC 会逐跳改变；
4. ARP 请求使用广播帧，正常情况下只有目标 IP 所有者回复；
5. 请求和回复都能提供 sender 的 IP-to-MAC 映射；
6. ARP cache 和 pending request 是两套不同状态，分别在 30 秒和 5 秒后过期；
7. 同一个未解析 IP 后面可能等待多个数据报，不同 IP 的状态必须相互独立；
8. `send_datagram()`、`recv_frame()` 和 `tick()` 分别对应发送、接收和时间三类事件。

前几个 checkpoint 让我看到 TCP 如何把不可靠报文变成可靠字节流，这次则让我看到
一个 IP 数据报如何真正落到当前链路上。理解 NetworkInterface 之后，ARP 不再只是
课本中一张“IP 转 MAC”的表，而是发送路径中不可缺少的一段状态机。
