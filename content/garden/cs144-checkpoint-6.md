---
title: "CS144 Checkpoint 6：最长前缀匹配与 IPv4 路由转发"
date: 2026-08-28
lastmod: 2026-08-28
garden_tags: ["Computer Network", "CS144", "C++", "IPv4", "Router"]
project: "cs144"
project_tags: ["CS144", "Computer Network"]
cover: "/images/cs144/checkpoint-6.webp"
draft: false
summary: "记录 CS144 Checkpoint 6 Router 的设计与实现：保存路由规则、执行最长前缀匹配、区分下一跳与输出接口，并正确处理 TTL、IPv4 校验和与默认路由。"
status: "seeding"
---

# CS144 Checkpoint 6：最长前缀匹配与 IPv4 路由转发

这篇文章记录我完成 Stanford CS144 Checkpoint 6 中 `Router` 的过程。Checkpoint 5
实现的 `NetworkInterface` 已经能够用 ARP 把下一跳 IP 解析成 MAC，并在 IPv4
数据报与以太网帧之间转换。但它不会自己决定数据报应该走哪个接口，也不知道下一跳
应该是谁。Checkpoint 6 要补上的正是这一层：读取目标 IPv4 地址，查询路由表，然后
把数据报交给正确的输出接口。

一开始我把 `route()` 理解成“遍历路由表，看到匹配项就发送”。真正实现后才发现，
路由器处理的是两组集合之间的关系：多个接口不断收到数据报，每个数据报又要与整张
路由表比较。循环顺序、队列消费、最长前缀、TTL 和输出接口只要有一项处理错误，
表现就可能从编译失败变成无限循环，或者把数据报送回原来的网络。

最终运行：

```bash
ASAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check6
```

严格编译检查、`net_interface`、`router` 和 `no_skip` 共 4 项测试全部通过。

> CS144 希望学习者不要公开完整 lab 解答，因此本文记录分层理解、状态设计、
> 匹配算法、伪代码、错误和测试方法，不提供可直接提交的完整实现。

## 1. Router 与 NetworkInterface 如何分工

Checkpoint 5 和 6 很容易被混在一起，因为两者都会接触“下一跳”。它们的职责实际
位于相邻但不同的层次：

```text
Router
  输入：目标 IPv4 地址
  查询：routing table
  输出：下一跳 IP + 输出接口编号
                 |
                 v
NetworkInterface
  输入：IPv4 数据报 + 下一跳 IP
  查询：ARP cache
  输出：目标 MAC 已填写的 Ethernet frame
```

Router 做的是网络层选择：

```text
destination IP
    -> longest-prefix match
    -> selected route
    -> output interface + next-hop IP
```

NetworkInterface 做的是链路层交付：

```text
next-hop IP
    -> ARP
    -> next-hop MAC
    -> Ethernet frame
```

以主机从 `10.0.0.2` 向 `192.168.0.2` 发送数据为例，数据报先到路由器的 `eth0`。
Router 根据目标 IP 选择通向 `192.168.0.0/24` 的 `eth2`，然后把下一跳设置为最终
目的地址。`eth2` 对应的 NetworkInterface 再查询 `192.168.0.2` 的 MAC 并发帧。

这里至少有三个地址不能混淆：

```text
dgram.header.dst       数据报的最终目标 IP
route.next_hop         当前路由指定的下一跳 IP，可能为空
EthernetFrame.dst      下一跳在输出链路上的 MAC
```

Router 不修改最终目标 IP，也不直接处理 MAC；NetworkInterface 不重新查询路由表。
两个模块通过 `send_datagram(dgram, next_hop)` 连接起来。

## 2. 一条路由需要保存什么

`add_route()` 每次得到四项信息：

```text
route_prefix    网络前缀
prefix_length   前缀长度，范围为 0 到 32
next_hop        可选的下一跳地址
interface_num   输出接口编号
```

可以把一条路由理解成：

> 如果目标地址的前 prefix_length 位与 route_prefix 相同，就可以从
> interface_num 对应接口发出，并把数据报交给 next_hop。

`next_hop` 使用 `optional<Address>`，因为路由有两种类型。

第一种是经过另一台路由器：

```text
0.0.0.0/0 -> next hop 171.67.76.1 -> interface 0
```

这时数据报的最终目的可能是互联网中的任意地址，但当前链路只需要把它交给
`171.67.76.1`。

第二种是直连网络：

```text
192.168.0.0/24 -> direct -> interface 2
```

`next_hop` 为空表示目标主机就在输出接口连接的网络中。此时下一跳就是数据报自己的
最终目标地址：

```text
next_hop = Address::from_ipv4_numeric(dgram.header.dst)
```

我用一个结构体保存这四项，再用 `vector` 保存整张路由表。`add_route()` 本身只需要
把新规则加入容器，不负责排序，也不需要提前计算所有可能的目的地址。

## 3. 最长前缀匹配是什么

同一个目标地址可能同时匹配多条路由。例如路由表中存在：

```text
0.0.0.0/0
143.195.0.0/17
143.195.192.0/19
```

目标 `143.195.200.1` 同时匹配 `/0`、`/17` 和 `/19`。路由器不能选择第一条命中
的规则，而要选择前缀最长，也就是最具体的 `/19`。

可以把它理解成地址范围逐层缩小：

```text
/0    覆盖全部 IPv4 地址
/17   覆盖一个较大的子网
/19   覆盖其中更具体的一部分
/32   只匹配一台主机
```

因此扫描路由表时需要维护：

```text
best_route = 尚未找到

对每条 route：
    如果 route 匹配 destination
       并且尚无 best_route，或它的 prefix_length 更长：
        best_route = route
```

完整扫描结束后，`best_route` 才是最终结果。循环顺序必须围绕“一个数据报扫描整张
表”组织，不能把路由表放在最外层：

```text
正确：
for each interface
    while interface has datagram
        for each route
            update best match
        forward once

错误：
for each route
    for each interface
        consume all datagrams using only this route
```

后一种写法无法比较多条路由，数据报会在遇到第一条路由时就被消费。

## 4. 如何构造前缀掩码

IPv4 地址是 32 位整数。长度为 `L` 的前缀掩码由高 `L` 位的 1 和低 `32-L` 位的
0 组成：

```text
/8   11111111 00000000 00000000 00000000
/16  11111111 11111111 00000000 00000000
/24  11111111 11111111 11111111 00000000
/32  11111111 11111111 11111111 11111111
```

匹配条件是：

```text
(destination & mask) == (route_prefix & mask)
```

两边都做掩码很重要。调用者通常会传入规范化网络地址，但匹配逻辑不必依赖前缀低位
一定为零。只比较前 `L` 位正好表达 CIDR 路由的语义。

`/0` 必须单独处理。它没有固定前缀位，掩码为零：

```text
destination & 0 == route_prefix & 0 == 0
```

所以 `/0` 匹配所有目标地址，正好充当默认路由。我曾经写出：

```text
if prefix_length > 0:
    calculate mask and match
```

这样虽然避开了位移边界，却也让默认路由永远无法匹配。正确思路不是跳过 `/0`，而是
明确规定它的掩码为零。

单独处理 `/0` 还能避免执行：

```text
32-bit value << 32
```

在 C++ 中，位移量等于类型宽度不是合法的普通移位操作。`/32` 则没有问题，它需要
左移 0 位，得到全 1 掩码。

掩码常量最好使用无符号类型，例如带 `U` 后缀，避免有符号右移、溢出和类型提升让
位运算的含义变得模糊。

## 5. `route()` 应该以数据报为处理单位

每个 NetworkInterface 都维护一个 `datagrams_received()` 队列。Router 的一次
`route()` 调用要遍历所有接口，并把当时已经收到的数据报全部处理完。

我最终采用的事件顺序可以概括为：

```text
从某个输入接口队列取出一个数据报
        |
        v
立即 pop，使队列向前推进
        |
        v
TTL 是否允许继续转发？
        |
        v
扫描整张路由表，选择最长匹配
        |
        v
没有匹配则丢弃
        |
        v
更新 TTL 和 checksum
        |
        v
确定 next hop 和输出接口
        |
        v
调用输出 NetworkInterface::send_datagram()
```

先复制或移动到局部对象，再从队列 `pop()`，有几个好处：

1. 每轮循环一定让队列变短，不会反复处理同一个 `front()`；
2. 后续任何 `continue` 都不会忘记弹出数据报；
3. 局部数据报可以修改 TTL；
4. 不会长期持有指向队列元素的引用。

我最初只读取了 `front()`，却忘记 `pop()`。结果 `while (!queue.empty())` 的条件永远
为真，同一个数据报会被无休止地检查或发送。队列循环除了需要退出条件，还必须保证
每条继续执行的路径都会让状态前进。

## 6. `InternetDatagram` 是对象，不是指针

这次第一个编译错误来自对类型的误解。我一度写出类似：

```text
if datagram:
    destination = datagram->header().dst
```

但 `InternetDatagram` 是普通的 `IPv4Datagram` 结构体，不是 `optional`，也不是
智能指针。因此：

```text
不需要判断 datagram 是否“有值”
成员访问使用 . 而不是 ->
header 是字段，不是 header() 函数
dst 已经是 uint32_t，不是 Address
```

正确理解类型以后，访问关系是：

```text
InternetDatagram
    .header
        .dst
        .ttl
        .compute_checksum()
```

当接口需要 `Address` 而手里只有数值 IPv4 地址时，再显式使用
`Address::from_ipv4_numeric()` 转换。不要因为最终需要 `Address`，就误以为
`header.dst` 本身也是一个带成员函数的对象。

## 7. TTL 为什么必须在路由器中修改

IPv4 Header 中的 TTL（Time To Live）防止数据报在错误路由形成的环路中永远转发。
每经过一台路由器，TTL 都减少一：

```text
host sends TTL=3
router A forwards TTL=2
router B forwards TTL=1
router C must drop it
```

本实验要求：

```text
TTL <= 1  -> 丢弃，不转发
TTL > 1   -> 减一，然后转发
```

这里不能对无符号 TTL 先无条件减一再检查。TTL 为 0 时继续减会发生回绕，得到一个
很大的值，反而让本该过期的数据报继续存活。

TTL 是 IPv4 Header 的一部分。修改它以后，旧的 header checksum 不再对应新头部，
因此必须重新计算校验和：

```text
decrement TTL
recompute IPv4 header checksum
forward
```

如果只减 TTL 不更新 checksum，下一台设备会把数据报视为头部损坏。路由器不需要
重新计算 TCP checksum，因为 TCP payload 和 TCP pseudo-header 中使用的源、目标 IP
都没有改变；这里改变的是 IPv4 Header 自己。

## 8. 输出接口不是输入接口

一台路由器有多个 NetworkInterface。数据报可能从 `eth0` 进入，根据路由表从
`eth2` 发出：

```text
incoming interface eth0
        |
        v
Router longest-prefix match
        |
        v
route.interface_num = 2
        |
        v
interfaces_[2].send_datagram(...)
```

我最初在遍历输入接口时直接调用当前 `interface->send_datagram()`。这等于把数据报
送回原来的网络，忽略了路由项中专门保存的 `interface_num`。

输入接口只告诉 Router 数据从哪里来；输出接口由最佳路由决定。二者可能恰好相同，
例如同一网络中的两个主机把流量错误地交给路由器，但实现不能假定它们总是相同。

确定输出接口后，还要决定下一跳：

```text
route.next_hop 有值
    -> 使用指定网关地址

route.next_hop 为空
    -> 直连网络，使用 dgram.header.dst
```

之后 NetworkInterface 会为这个下一跳执行 ARP。Router 到这里不再关心 MAC。

## 9. 为什么当前实现使用 vector

当前路由表使用 `vector<Route>`。每个数据报需要扫描全部 `R` 条路由：

```text
add route:  O(1) amortized
lookup:     O(R)
space:      O(R)
```

真实互联网路由表可能包含大量前缀，线性扫描显然不够。但 CS144 测试中的路由数量
很少，`vector` 有几个实际优势：

1. 实现短，最长前缀逻辑一眼可见；
2. 连续内存的遍历具有良好缓存局部性；
3. 不需要维护复杂节点所有权；
4. 添加路由不会改变已有查找语义；
5. 更容易把错误定位在协议逻辑，而不是数据结构实现。

算法复杂度不是唯一指标。对只有十几条规则的教学路由器，常数、可读性和正确性通常
比把理论查找复杂度降到 32 次 bit 访问更重要。

## 10. Trie 和 Patricia Trie 能否优化

可以。IPv4 地址固定为 32 位，很适合二进制 Trie。每层根据当前 bit 走向 0 或 1
子节点，路由规则可以保存在中间节点：

```text
                 root 保存 /0
                /              \
             bit 0            bit 1
             /   \            /   \
           ...   ...        ...   ...
```

插入 `/L` 路由时只走前 `L` 位。查询时沿目标地址向下，并不断记录最近遇到的路由；
走不下去时，最近记录的节点就是最长前缀匹配。

对于 IPv4：

```text
insert: O(prefix_length)，最多 32 层
lookup: O(32)
```

普通 Trie 的问题是可能出现很长的单分支链。Patricia Trie 本质上是路径压缩后的
Trie：把没有路由、也没有分叉的一串节点压成一条带若干 bit 的边。

```text
普通 Trie：
root -> 0 -> 0 -> 0 -> 1 -> 0 -> branch

Patricia Trie：
root ------ "00010" ------> branch
```

它通常使用更少节点、减少查询时的指针跳转，但插入和删除需要分裂、合并压缩路径，
实现明显更复杂。两者关系可以概括为：

```text
Trie            每条边通常表示一个 bit
Radix tree      一条边可以表示多个 bit
Patricia Trie   压缩所有单分支路径的 Radix/Trie 结构
```

因此 Patricia Trie 不是和 Trie 完全无关的第二种结构，而是它的压缩变体。若把这个
项目当作数据结构练习，可以先保留 `vector` 版本作为正确性基线，再实现二进制 Trie，
最后尝试 Patricia 压缩，并用同一组路由测试比较结果。

## 11. 本次最容易犯的错误

回顾实现过程，问题主要集中在“处理单位”和“类型含义”上：

```text
把 InternetDatagram 当成 optional 或指针
把 header 字段写成 header() 函数
只读取 queue.front()，忘记 queue.pop()
把路由表放在外层循环，无法为一个数据报比较全部规则
遇到第一条匹配就发送，没有选择最长前缀
为了避免移位 32 而跳过 /0，导致默认路由失效
使用输入 interface 发送，忽略 route.interface_num
忘记丢弃 TTL 为 0 或 1 的数据报
修改 TTL 后忘记重新计算 IPv4 checksum
把直连路由的空 next_hop 理解成没有目的地
```

这些错误可以通过几个不变量统一检查：

```text
每个接收队列中的数据报恰好被取出一次
每个数据报最多被转发一次
被转发的数据报一定使用最长匹配路由
没有匹配路由或 TTL 已耗尽的数据报一定被丢弃
每次转发恰好让 TTL 减少一
转发后的 IPv4 header checksum 与新 TTL 一致
输出接口和下一跳都来自最终选中的路由
```

只要某个测试失败，就可以按这些关系判断是队列、匹配、生命周期还是接口选择出了
问题，而不需要一开始就在整段循环里盲目加日志。

## 12. 测试如何验证路由器

完整测试命令是：

```bash
ASAN_OPTIONS=detect_leaks=0 \
cmake --build build --target check6
```

最终结果为：

```text
compile with bug-checkers  Passed
net_interface              Passed
router                     Passed
no_skip                    Passed

4/4 tests passed
```

路由器测试构造了多个模拟网络段和接口，覆盖的行为包括：

```text
两个普通子网之间互相转发
通过默认路由发往互联网
多个重叠前缀之间选择最长匹配
直连网络使用最终目标作为下一跳
两个主机位于同一输出网络
TTL 为 1 或 0 时不转发
转发后 TTL 和 IPv4 checksum 正确
```

`check6` 也会重新运行 `net_interface`。这是合理的，因为 Router 最终依赖
NetworkInterface 发送数据报；下层模块出现回归时，路由器的端到端行为同样不可信。

当前运行环境中的 LeakSanitizer 可能因为 ptrace 限制而退出，所以测试时临时关闭
不可用的 leak detection。功能测试通过并不代表可以永久忽略内存问题；这里只是为了
区分运行环境限制和协议实现错误，而代码本身使用标准库容器管理所有权。

## 13. 从主机到路由器的完整一跳

完成 Checkpoint 5 和 6 后，一个数据报经过路由器的过程可以完整画出来：

```text
source host
    |
    | ARP for gateway
    v
Ethernet frame addressed to router MAC
    |
    v
router input NetworkInterface
    | remove Ethernet framing
    v
InternetDatagram enters datagrams_received queue
    |
    v
Router::route
    | check TTL
    | longest-prefix match on destination IP
    | decrement TTL and recompute checksum
    | select output interface and next hop
    v
router output NetworkInterface
    | ARP for next hop if necessary
    | create new Ethernet frame
    v
next link
```

进入路由器的以太网帧和离开路由器的以太网帧不是同一个帧：源、目标 MAC 都会随着
链路改变。中间的 IPv4 数据报大体保持不变，但 TTL 每跳减少，IPv4 Header checksum
也随之更新。最终目标 IP 不会因为选择下一跳而改成网关 IP。

这正是分层的价值：

```text
Ethernet 解决当前链路交付
ARP      解决下一跳 IP 到 MAC 的映射
Router   根据最终目标 IP 选择下一跳
IPv4     提供跨网络寻址和 TTL
TCP      在端到端路径上提供可靠字节流
```

## 14. 总结

Checkpoint 6 的代码量比前几个 TCP 状态机少，但它把 Checkpoint 5 的链路接口真正
组织成了一台路由器：

```text
add_route
  保存 prefix、prefix length、next hop 和 output interface

route
  消费所有输入接口的数据报
  丢弃 TTL 已耗尽的数据报
  对目标 IPv4 地址执行最长前缀匹配
  更新 TTL 和 IPv4 checksum
  交给最佳路由指定的输出 NetworkInterface

NetworkInterface
  用 ARP 将 Router 选择的 next hop 解析成 MAC
```

这次最重要的经验，是把“遍历路由表”改写成“为一个数据报选择唯一最佳路由”。只要
始终以数据报为处理单位，最长前缀、TTL 和输出接口都能在一次清楚的状态转换中完成。
如果反过来以路由项为处理单位，队列消费和多条规则之间的关系就很容易混乱。

`vector` 线性扫描已经足以完成实验，也最容易验证。Trie 和 Patricia Trie 能把查找
优化到与 32 位地址长度相关，但它们解决的是路由表规模问题，不会替代 TTL、下一跳、
校验和和队列生命周期这些协议语义。先建立正确的转发不变量，再考虑数据结构优化，
比一开始就追求复杂索引更可靠。
