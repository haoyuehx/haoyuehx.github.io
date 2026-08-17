---
title: "CS144 Checkpoint 1：把乱序片段重组为连续字节流"
date: 2026-08-11
lastmod: 2026-08-11
garden_tags: ["Computer Network", "CS144", "C++", "TCP"]
draft: false
summary: "记录 CS144 Checkpoint 1 Reassembler 的设计与实现：接收窗口、区间裁剪与合并、即时组装、EOF 处理，以及重叠片段和容量限制带来的问题。"
status: "seeding"
---

# CS144 Checkpoint 1：把乱序片段重组为连续字节流

这篇文章记录我完成 Stanford CS144 Checkpoint 1 中 `Reassembler` 的过程。
Checkpoint 0 实现的 `ByteStream` 只需要处理按顺序写入的数据，而真实网络中的
数据报可能乱序、重复，甚至暂时缺失。`Reassembler` 要做的，就是把带绝对下标的
字符串片段重新拼成一条连续字节流。

开始实现时，我最大的误解是想把乱序数据直接插入 `ByteStream` 内部的
`buffer_`。真正理解接口后才发现，这个限制恰好体现了两个模块不同的职责：

```text
Reassembler：保存乱序、重叠、暂时不能输出的片段
ByteStream：  保存已经连续组装好、等待应用读取的字节
```

最终运行：

```bash
cmake --build build --target check1
```

结果为 18 个测试全部通过，其中包括重复片段、空洞、重叠、容量窗口和性能测试。

> CS144 希望学习者不要公开完整 lab 解答，因此本文记录设计、不变量、伪代码、
> 错误和测试方法，不提供可直接提交的完整实现。

## 1. Reassembler 在解决什么问题

`insert()` 每次会收到三个信息：

```cpp
insert( first_index, data, is_last_substring )
```

`first_index` 是 `data` 第一个字节在整条流中的绝对下标。例如：

```text
insert(5, "world", false)
```

表示已经知道：

```text
下标： 5 6 7 8 9
数据： w o r l d
```

如果 `[0, 5)` 尚未到达，`world` 不能直接交给 `ByteStream`，否则应用会先读到后半段。
它必须暂存在 Reassembler 中。后来收到：

```text
insert(0, "hello", false)
```

才可以连续输出：

```text
hello + world -> helloworld
```

这里有一个很重要的要求：每次调用 `insert()` 都要立即尝试组装，而不是等
`is_last_substring` 出现后再一次性处理。只要当前缺口被补上，已知的连续前缀就应
尽快进入 `ByteStream`。

## 2. 为什么不能直接修改 ByteStream 的 buffer

`buffer_` 是 `ByteStream` 的内部状态，而且 Reassembler 通过组合而不是继承拥有
`output_`，所以本来就不应该直接访问它。更重要的是，即使可以访问，按绝对下标
写入 `buffer_` 也不正确。

Reader 每次调用 `pop()` 都会移走缓冲区开头的数据。因此 `buffer_[0]` 只代表
“当前尚未读取的第一个字节”，并不固定代表整条流的第 0 个字节。

Reassembler 唯一应该使用的写入接口是：

```cpp
output_.writer().push( contiguous_data );
```

而当前第一个尚未组装的绝对下标已经由 Writer 记录：

```text
first_unassembled = writer.bytes_pushed()
```

因此没有必要再维护 `next_index_` 或 `assembled_bytes_`。重复状态不仅多余，还可能
因为某次更新遗漏而与 `bytes_pushed()` 不一致。

## 3. 内部状态和核心不变量

我使用一个有序映射保存待组装区间：

```text
pending_[片段起点] = 片段内容
```

概念上可能是：

```text
pending_ = {
    5  -> "fgh",
    10 -> "klm"
}
```

选择有序映射的原因是：

1. 可以按下标顺序找到最靠前的片段；
2. 可以通过 `lower_bound()` 找到新片段附近的区间；
3. 合并后只要检查最前面的区间是否从 `bytes_pushed()` 开始；
4. 不必为尚未收到的巨大空洞分配内存。

此外，还需要一个可选的结束下标：

```text
end_index：尚未见到最后片段时为空，否则表示流的总长度
```

实现中最重要的不变量是：

```text
1. pending_ 中的区间按起点有序；
2. pending_ 中不存在重叠或相邻区间；
3. 每个尚未组装的字节最多保存一份；
4. pending_ 中只保留当前接收窗口内的字节；
5. pending_ 的第一个区间如果从 bytes_pushed() 开始，就应立即输出。
```

第 2 条把相邻区间也合并，不是接口正确性的硬性要求，但可以让输出逻辑和计数
逻辑更简单。

## 4. 先算清楚接收窗口

Reassembler 不能无限保存未来数据。当前接收窗口的左边界是第一个尚未组装的
字节：

```text
first_unassembled = writer.bytes_pushed()
```

右边界由 ByteStream 当前可用容量决定：

```text
first_unacceptable = first_unassembled + writer.available_capacity()
```

所以本次最多接受半开区间：

```text
[first_unassembled, first_unacceptable)
```

半开区间非常适合处理字节位置，因为它的长度就是右端点减左端点。例如
`[5, 10)` 包含 5 个字节，对应下标 5 到 9。

这里容易把 `available_capacity()` 理解成 Reassembler 可以额外使用的容量。实际上，
整个容量约束要同时覆盖 ByteStream 中尚未读取的字节和 Reassembler 中未组装的
字节。上述窗口公式正好把两者统一起来。

假设容量为 5，ByteStream 中已经有 3 字节尚未读取，那么可用容量只有 2。无论
未来片段有多长，Reassembler 当前也只能接受两个位置的新信息。Reader 读走数据后，
窗口才会继续向右移动；之前因为超出窗口被丢弃的数据需要发送方再次发送。

## 5. `insert()` 的完整思考顺序

我的 `insert()` 最终可以拆成六个步骤。

### 5.1 先记录 EOF，而不是先裁剪数据

如果 `is_last_substring == true`，代表这个片段给出了整条流的结束位置：

```text
end_index = first_index + data.size()
```

这个信息必须在窗口裁剪前记录。最后片段的数据可能全部位于当前窗口之外，需要被
暂时丢弃，但它仍然告诉了 Reassembler 整条流在哪里结束。

例如：

```text
容量：2
insert(5, "xyz", true)
```

`xyz` 当前不能保存，但 EOF 下标 8 仍然有效。如果把 EOF 信息和数据一起丢掉，
以后即使 `[0, 8)` 全部组装完成，也不知道何时关闭 Writer。

### 5.2 把输入片段裁剪到窗口内

输入片段覆盖：

```text
[first_index, first_index + data.size())
```

它与当前接收窗口求交后，保留范围为：

```text
kept_begin = max(data_begin, first_unassembled)
kept_end   = min(data_end, first_unacceptable)
```

只有 `kept_begin < kept_end` 时才有字节需要保存。这个步骤同时处理两种无用数据：

- 左侧已经组装过的旧数据；
- 右侧超出当前容量的未来数据。

裁剪下标后，还要把绝对下标换算成字符串内偏移：

```text
substring offset = kept_begin - first_index
substring length = kept_end - kept_begin
```

一开始我只考虑了“整个片段在窗口外”，没有考虑片段一半已组装、一半仍然有用的
情况。例如已经输出到下标 4 后又收到 `[0, 6)`，真正应该保留并输出的只有 `[4, 6)`。

### 5.3 找到可能重叠的前一个区间

对裁剪后的新区间起点调用 `lower_bound()`，能找到第一个起点不小于它的旧区间。
但不能直接从这里开始向后合并，因为它的前一个区间也可能覆盖新区间的左端：

```text
旧区间：[2, 7)
新区间：   [5, 9)
lower_bound(5) 会越过起点为 2 的旧区间
```

所以还要检查前驱：如果前驱的结束位置大于等于新区间起点，就从前驱开始合并。
这里的“大于等于”也会合并首尾相接的区间。

### 5.4 合并所有重叠或相邻区间

找到起点后，持续向右检查，直到下一个旧区间的起点严格大于当前合并区间的终点。
每次合并都计算：

```text
union_begin = min(new_begin, old_begin)
union_end   = max(new_end, old_end)
```

然后创建覆盖并集的字符串，把新旧内容复制到各自偏移。题目保证不同片段对同一位置
给出的字节一致，因此重叠部分由哪一份覆盖都不会改变结果。

例如：

```text
已有：[1, 3) = "bc"
已有：[4, 6) = "ef"
新来：[2, 5) = "cde"
```

合并过程为：

```text
[1, 3) + [2, 5) -> [1, 5)
[1, 5) + [4, 6) -> [1, 6) = "bcdef"
```

这样 `pending_` 中不会重复保存 `c` 和 `e`，容量语义和 pending 计数才是准确的。

### 5.5 立即输出连续前缀

合并完成后，反复检查 `pending_` 的第一个区间：

```text
while 最前区间的起点 == writer.bytes_pushed():
    从 pending_ 取出该区间
    writer.push(区间内容)
```

`push()` 会增加 `bytes_pushed()`，于是下一个相邻区间也可能立刻满足条件。这就是
为什么应该使用循环，而不是只检查一次。

例如：

```text
bytes_pushed = 0
pending      = [3, 6), [6, 9)
新插入      = [0, 3)
```

补上开头后，三个区间实际形成 `[0, 9)`，应该在同一次 `insert()` 中全部输出，而不是
等下一次调用来触发。

### 5.6 到达 EOF 才关闭 Writer

`is_last_substring` 出现不代表可以立即关闭，`pending_.empty()` 也不代表流已经完整。
正确的关闭条件是：

```text
end_index 已知 && writer.bytes_pushed() == end_index
```

例如最后片段 `[5, 10)` 先到时，只能记录 `end_index = 10`。等 `[0, 5)` 到达并使
累计输出真正达到 10，才调用 `writer.close()`。

空流也能自然落入这个规则：

```text
insert(0, "", true)
end_index = 0
bytes_pushed = 0
```

两者相等，因此立即关闭。

## 6. `count_bytes_pending()` 为什么看似简单

`count_bytes_pending()` 要返回的是 Reassembler 自己保存了多少未组装字节，不包括
已经进入 ByteStream 的数据。

如果允许 `pending_` 保存重叠区间，简单累加字符串长度会出错：

```text
[1, 4) 长度 3
[2, 5) 长度 3
```

两者实际只覆盖 `[1, 5)` 的 4 个不同字节，但简单求和会得到 6。

我的处理方式不是在 `count_bytes_pending()` 中临时计算区间并集，而是在每次
`insert()` 时就维护“区间互不重叠”的不变量。因此计数时只需要遍历映射并累加每段
字符串长度。

几个关键场景如下：

| 场景 | pending 计数变化 |
|---|---|
| 插入全新乱序片段 | 增加新覆盖的字节数 |
| 插入完全重复片段 | 不变 |
| 插入部分重叠片段 | 只增加未见过的字节数 |
| 插入超出窗口的片段 | 不变 |
| 空洞补齐并输出连续数据 | 减少相应字节数，通常变为 0 |
| 数据已在 ByteStream 中但尚未被 Reader 读取 | 不计入 pending |

题目提示不要为了测试函数增加额外状态。直接从 `pending_` 推导结果，也避免维护
`pending_bytes_` 时漏加、漏减或重复减的问题。

## 7. 实现过程中遇到的问题

### 7.1 只用 `find(next_index)` 无法处理重叠

最初的思路是把片段直接放进映射，然后寻找是否存在起点恰好等于
`bytes_pushed()` 的条目。这只能处理已经切分整齐的片段：

```text
[0, 3), [3, 6), [6, 9)
```

遇到 `[0, 2)` 和 `[1, 4)` 时，第二段虽然能把连续范围延伸到 4，却永远不会以 2
作为 key，简单的 `find(2)` 会误以为仍有空洞。解决方法是插入时先裁剪并合并区间，
让映射表达“已经知道哪些连续范围”，而不是机械保存每次函数调用的原始参数。

### 7.2 相同起点不能直接覆盖

如果直接写：

```text
pending[first_index] = data
```

那么先收到 `[1, 5)`，后收到较短的 `[1, 3)` 时，长片段会被短片段覆盖，已经知道的
`[3, 5)` 信息反而丢失。相同起点也是一般区间合并问题的一部分，不能特殊地用赋值
处理。

### 7.3 `pending_.empty()` 不是结束条件

片段可能因为超出容量而完全被丢弃，此时 pending 为空，但流前面仍有巨大空洞。
因此结束判断必须比较累计输出位置与 EOF 位置，而不是观察容器是否为空。

### 7.4 EOF 片段也可能位于窗口之外

如果先裁剪、发现片段为空后直接返回，就会漏掉 `is_last_substring` 携带的结束信息。
正确顺序是先根据原始片段记录 EOF，再处理哪些数据字节能够进入当前窗口。

### 7.5 容量不是流的总长度

容量为 2 不代表整条流最多只有 2 字节，而是任意时刻 ByteStream 和待组装数据不能
无限占用内存。Reader 读走两个字节后，窗口可以继续前进并接收后续数据。这和
Checkpoint 0 中 ByteStream 的容量语义是一致的。

### 7.6 测试环境中的 LeakSanitizer 报错

第一次运行 `check1` 时，测试不是断言失败，而是出现：

```text
LeakSanitizer does not work under ptrace
```

这是当前运行环境对进程跟踪的限制，不是 Reassembler 的逻辑错误。为了继续验证
功能，我临时关闭 leak detection 后重新运行完整测试：

```bash
ASAN_OPTIONS=detect_leaks=0 cmake --build build --target check1
```

最终 18/18 测试通过。关闭检测只适合区分环境问题和功能问题，不能作为长期忽略
内存错误的手段；这里的实现使用标准库容器和字符串管理所有权，没有手动
`new`/`delete`。

## 8. 备选数据结构

### 8.1 每个字节一个 map 节点

最直观的方式是：

```text
map<index, char>
```

它天然容易去重，判断某个下标是否存在也很直接。但每个字节都需要一个树节点，
内存开销很大；插入长片段时还要对每个字节执行一次对数复杂度操作，性能较差。

### 8.2 固定大小字符数组加存在位图

也可以按照容量准备字符数组，再用布尔数组记录每个位置是否到达。这种方法访问快，
但绝对下标到循环缓冲区位置的转换更容易出错，窗口滑动后还要清理和复用槽位。
对于这个 lab 的接口，有序区间更容易解释和验证。

### 8.3 保存原始字符串列表

直接使用 `vector` 保存每次到达的片段，代码开头最简单，但每次组装都要扫描全部
片段，而且重复和重叠数据会让实际内存突破容量约束。它没有维护题目真正关心的
“已知字节集合”。

### 8.4 有序的不相交区间

最终使用的 `map<起点, 字符串>` 在可读性和效率之间比较平衡。查找附近区间是
对数复杂度，合并时只访问真正发生重叠的节点；连续输出也只需要查看映射开头。
代价是区间合并代码需要仔细处理前驱、相邻关系和字符串偏移。

## 9. 测试应覆盖哪些行为

只测试顺序到达很容易产生“代码已经完成”的错觉。我认为至少要检查：

```text
单个片段从 0 开始
多个片段顺序到达
多个片段逆序到达
中间有一个或多个空洞
完全重复、完全包含、左右部分重叠
一个新片段同时连接多个旧区间
片段左侧已经组装
片段右侧超出容量
整个片段位于窗口之外
最后片段先到
最后片段只有一部分能进入窗口
空字符串表示 EOF
Reader 读走数据后窗口继续前进
字符串中包含零字节
```

本次通过的 Reassembler 测试包括：

```text
reassembler_single
reassembler_cap
reassembler_seq
reassembler_dup
reassembler_holes
reassembler_overlapping
reassembler_win
reassembler_speed_test
```

自动测试之外，还可以在每次插入后检查这些关系：

```text
pending 区间互不重叠
pending 区间均位于当前可接受范围
count_bytes_pending 等于所有区间长度之和
bytes_pushed 之前不存在 pending 数据
Writer 关闭时 bytes_pushed 等于 end_index
```

## 10. 从 Reassembler 理解 TCP 接收方

这个 checkpoint 还没有实现完整 TCP，但已经体现了接收方的核心困难。网络只负责
交付一个个可能乱序、重复的分组，应用却希望看到一条有序且不重复的字节流：

```text
乱序片段
   |
   | 按序号定位、裁剪窗口、去重并补洞
   v
Reassembler
   |
   | 只输出连续前缀
   v
ByteStream
   |
   v
应用程序
```

这与选择重传协议中的接收缓存很相似：失序到达的数据可以先保存，但不能越过空洞
交付给上层。窗口限制则保证接收方不会因为发送方不断发送很远的未来数据而无限
占用内存。

完成这个任务后，我对“TCP 提供可靠、有序字节流”的理解不再只是书上的一句话。
所谓有序，不是网络天然按顺序送达，而是接收方通过序号、缓存、去重和连续前缀
检查，把不可靠的数据报重新整理成应用能使用的抽象。

## 11. 总结

`Reassembler` 的代码量不大，但正确性依赖几个边界同时成立：

```text
用 bytes_pushed 表示第一个尚未组装的下标
根据 available_capacity 计算当前接收窗口
输入片段先裁剪，再与 pending 区间合并
任何字节最多保存一次
连续前缀出现后立即 push
EOF 单独记录，到达结束下标时才 close
```

这次最有价值的经验不是学会某个 `std::map` 写法，而是先定义状态含义和不变量，
再让每一步操作维护它们。只要 `pending_` 始终表示“窗口内已知但尚未输出的不相交
字节区间”，`count_bytes_pending()`、连续输出和容量限制都会变得自然；反过来，如果
容器里保存的是未经处理的原始调用记录，后续每个函数都会被迫重复处理重叠、重复
和过期数据。
