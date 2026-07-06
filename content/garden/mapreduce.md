---
title: "MapReduce分布式系统"
date: 2026-07-06
lastmod: 2026-07-06
garden_tags: ["Distribute system", "6.5840", "MapReduce"]
draft: false
summary: "记录 6.5840 MapReduce Lab 的实现过程：RPC 协议、任务调度、worker 执行、容错与测试。"
status: "seeding"
---

# MapReduce 分布式系统 Lab 记录

这篇文章记录我完成 6.5840 MapReduce lab 的过程。这个 lab 表面上是在补全 `coordinator.go`、`worker.go` 和 `rpc.go`，但真正要想清楚的是一个更基础的问题：

> 多个 worker 进程如何从一个 coordinator 那里领取任务、执行任务、提交结果，并在 worker 崩溃时让系统继续完成？

最终通过的测试如下：

```bash
cd mr
go test -v -race
```

结果：

```text
cd mr; go test -v -race 
=== RUN   TestWc
--- PASS: TestWc (8.06s)
=== RUN   TestIndexer
--- PASS: TestIndexer (5.57s)
=== RUN   TestMapParallel
--- PASS: TestMapParallel (8.03s)
=== RUN   TestReduceParallel
--- PASS: TestReduceParallel (10.03s)
=== RUN   TestJobCount
--- PASS: TestJobCount (10.03s)
=== RUN   TestEarlyExit
--- PASS: TestEarlyExit (7.03s)
=== RUN   TestCrashWorker
--- PASS: TestCrashWorker (39.11s)
PASS
ok  	6.5840/mr	88.869s
```

## 1. 整体模型

MapReduce 的执行可以分成两个阶段：

1. Map 阶段：每个输入文件对应一个 map task。
2. Reduce 阶段：每个 reduce partition 对应一个 reduce task。

也就是说：

```text
map task 数量    = 输入文件数量
reduce task 数量 = nReduce
worker 数量      = 当前活着的 worker 进程数量
```

这里最容易误解的是：worker 数量不等于文件数量。worker 只是执行任务的进程，它会不断向 coordinator 请求任务。一个 worker 可以连续完成多个 map task 和 reduce task。

整体流程是：

```text
worker -> coordinator: 请求任务
coordinator -> worker: 返回 map / reduce / wait / exit
worker: 执行任务
worker -> coordinator: 汇报任务完成
coordinator: 更新任务状态，必要时推进阶段
```

## 2. RPC 协议设计

我最后采用了两个 RPC：

```text
RequestTask: worker 请求一个任务
FinishTask: worker 汇报一个任务完成
```

对应的结构体是：

```go
type RequestTaskArgs struct {
}

type RequestTaskReply struct {
    TaskType int
    TaskId   int
    FileName string
    NMap     int
    NReduce  int
}

type FinishTaskArgs struct {
    TaskType int
    TaskId   int
}

type FinishTaskReply struct {
}
```

`RequestTaskArgs` 可以为空，因为 worker 只是问：“有没有活给我？”

`RequestTaskReply` 需要携带任务信息：

- `TaskType`：任务类型，比如 map、reduce、wait、exit。
- `TaskId`：任务编号。
- `FileName`：map task 需要读取的输入文件名。
- `NMap`：reduce task 需要知道一共有多少个 map 输出。
- `NReduce`：map task 需要知道要分成多少个 reduce bucket。

任务类型我用了四种：

```go
const (
    MapTask int = iota
    ReduceTask
    WaitTask
    ExitTask
)
```

`WaitTask` 很重要。它表示当前没有可分配任务，但整个 job 还没结束。例如 map 阶段有任务正在运行，其他 worker 此时就应该等一会儿再来问，而不是直接退出。

## 3. Coordinator 的状态设计

Coordinator 需要记录每个任务的状态：

```go
type TaskState struct {
    Status    int
    StartTime time.Time
}
```

任务状态：

```go
const (
    Idle int = iota
    InProgress
    Finished
)
```

Coordinator 本身保存：

```go
type Coordinator struct {
    mu sync.Mutex

    nMap    int
    nReduce int
    files   []string

    mapTask     []TaskState
    reduceTasks []TaskState

    phase Phase
}
```

阶段：

```go
const (
    MapPhase Phase = iota
    ReducePhase
    DonePhase
)
```

这里的核心是：所有 coordinator 状态都要用 `mu` 保护。RPC handler 会被多个 worker 并发调用，如果没有锁，任务分配和完成状态就可能乱掉。

## 4. RequestTask：任务调度

`RequestTask` 是 coordinator 的调度入口。

在 `MapPhase` 中，它扫描 `mapTask`：

```text
如果发现 Idle task:
    分配给 worker

如果发现 InProgress 但运行超过 10 秒:
    认为原 worker 可能崩溃，重新分配

如果没有可分配任务:
    返回 WaitTask
```

Reduce 阶段同理，只是扫描 `reduceTasks`。

关键逻辑是 timeout：

```go
task.Status == InProgress && time.Since(task.StartTime) > 10*time.Second
```

这个设计让系统具备基本容错能力。worker 崩溃后不会调用 `FinishTask`，所以任务会一直处于 `InProgress`。超过 10 秒后，coordinator 会把它重新分配给其他 worker。

## 5. FinishTask：推进阶段

worker 完成任务后，会调用 `FinishTask`：

```text
FinishTask(MapTask, taskId)
FinishTask(ReduceTask, taskId)
```

Coordinator 收到后：

```text
如果是 map task:
    标记 mapTask[taskId] = Finished
    如果所有 map task 都完成，进入 ReducePhase

如果是 reduce task:
    标记 reduceTasks[taskId] = Finished
    如果所有 reduce task 都完成，进入 DonePhase
```

一开始我考虑过维护 `unfinishedMapTasks` 这样的计数器，但最后没有用。原因是 crash/retry 场景里可能出现重复完成汇报：

```text
worker A 拿到 map task 2
worker A 很慢
coordinator 超时后把 task 2 分配给 worker B
worker B 完成 task 2
worker A 后来也完成并汇报 task 2
```

如果用计数器，很容易重复减一。扫描 slice 虽然简单，但更不容易写错：

```go
func (c *Coordinator) AllMapTasksDone() bool {
    for _, task := range c.mapTask {
        if task.Status != Finished {
            return false
        }
    }
    return true
}
```

这里有一个坑：这个 helper 不应该自己再加锁。如果 `FinishTask` 已经持有 `c.mu`，helper 里再 `Lock()` 会死锁，因为 Go 的 `sync.Mutex` 不是可重入锁。

## 6. Worker 主循环

Worker 的结构很直接：

```text
循环:
    请求任务
    如果是 MapTask:
        执行 map
        汇报完成
    如果是 ReduceTask:
        执行 reduce
        汇报完成
    如果是 WaitTask:
        sleep 一会儿
    如果是 ExitTask:
        return
```

这个循环很重要。worker 不能只请求一次任务就退出，否则一个 worker 最多只会完成一个 task，测试里的并行和任务数量检查都会失败。

## 7. Map Task 的实现

Map task 做四件事：

1. 读取输入文件。
2. 调用用户传入的 `mapf`。
3. 按 key 分区到不同 reduce bucket。
4. 写出中间文件。

`mapf` 的类型是：

```go
func(string, string) []KeyValue
```

它来自 plugin。例如 word count 的 map function 会把文本拆成单词，然后返回：

```text
hello 1
world 1
hello 1
```

MapReduce 框架本身不关心具体业务逻辑，它只负责调用 `mapf`，然后把结果分发给 reduce 阶段。

分区规则是：

```go
r := ihash(kv.Key) % reply.NReduce
```

这个规则保证同一个 key 一定进入同一个 reduce bucket。比如 `"hello"` 永远被分到 reduce task 1，那么所有 map task 产生的 `"hello"` 都会进入：

```text
mr-0-1
mr-1-1
mr-2-1
...
```

这样 reduce task 1 才能看到 `"hello"` 的所有 value。

中间文件命名：

```text
mr-mapTaskId-reduceTaskId
```

例如 map task 3，`NReduce = 2`，会产生：

```text
mr-3-0
mr-3-1
```

文件内容用 JSON 编码 `KeyValue`，这样 reduce 阶段可以直接用 `json.Decoder` 读回来，不需要手写脆弱的字符串解析。

为了避免 worker 崩溃时留下半写文件，我先写临时文件，再 rename：

```text
temp file -> mr-X-Y
```

`rename` 在同一文件系统中是原子的，这样其他阶段不会看到半成品。

## 8. Reduce Task 的实现

Reduce task 不需要 `FileName`。它只需要：

```text
reply.TaskId 作为 reduce id
reply.NMap   知道有多少个 map 输出文件
```

reduce task `r` 读取：

```text
mr-0-r
mr-1-r
mr-2-r
...
mr-(NMap-1)-r
```

读取完所有中间数据后：

1. 按 key 排序。
2. 把相同 key 的 value 聚合到一起。
3. 调用用户传入的 `reducef`。
4. 输出到 `mr-out-r`。

输出格式必须和 `mrsequential.go` 一致：

```go
fmt.Fprintf(ofile, "%v %v\n", key, output)
```

reduce 输出也使用临时文件再 rename：

```text
temp file -> mr-out-X
```

这对 `TestEarlyExit` 和 crash 场景都很关键，因为测试会检查输出文件是否稳定。

## 9. 测试分别在检查什么

这个 lab 的测试很有指导性：

| 测试 | 关注点 |
|---|---|
| `TestWc` | word count 输出是否正确 |
| `TestIndexer` | indexer 输出是否正确 |
| `TestMapParallel` | map worker 是否真的并行 |
| `TestReduceParallel` | reduce worker 是否真的并行 |
| `TestJobCount` | map task 数量是否正确，不能重复跑 |
| `TestEarlyExit` | coordinator/worker 不能在输出稳定前退出 |
| `TestCrashWorker` | worker 崩溃后任务能否重新分配 |

其中 `TestCrashWorker` 是最能说明系统是否像一个分布式系统的测试。只要 worker 可能崩溃，就不能把 “任务被分配了” 当成 “任务完成了”。只有 worker 写完文件并调用 `FinishTask` 后，coordinator 才能把任务标记为完成。

## 10. 我踩到的几个坑

### 10.1 worker 不应该重新 load plugin

`main/mrworker.go` 已经加载了 plugin，并把 `mapf`、`reducef` 传给：

```go
mr.Worker(sockname, mapf, reducef)
```

所以 `worker.go` 里不需要再 import `mr` 或重新 load plugin。`worker.go` 本身就在 `package mr` 里，直接使用 `KeyValue` 即可。

### 10.2 `NMap` 和 `NReduce` 的用途不同

Map task 需要 `NReduce`：

```text
把 mapf 产生的 key/value 分到多少个 reduce bucket
```

Reduce task 需要 `NMap`：

```text
知道要读多少个 map 输出文件
```

所以：

```text
map:    use NReduce
reduce: use NMap
```

### 10.3 reduce 读取文件名容易写反

正确格式是：

```go
fmt.Sprintf("mr-%d-%d", mapId, reduceId)
```

对于 reduce task `2`，如果有 4 个 map task，应该读：

```text
mr-0-2
mr-1-2
mr-2-2
mr-3-2
```

### 10.4 helper 里重复加锁会死锁

一开始我让 `AllMapTasksDone()` 自己加锁，但它是在 `FinishTask()` 已经持有锁的时候被调用的。这样会导致同一个 goroutine 试图再次获得同一把 `sync.Mutex`，直接卡住。

最后的原则是：

```text
外层 RPC handler 负责加锁
内部扫描 helper 不再加锁
```

## 11. 小结

这个 lab 的实现并不长，但它把分布式系统里几个很重要的概念压缩到了一起：

- coordinator 作为中心调度器。
- worker 通过 RPC 拉取任务。
- task 有明确状态机。
- 阶段推进必须等前一阶段全部完成。
- 崩溃恢复依赖 timeout 和重新分配。
- 文件输出要考虑原子性，避免半成品。

最后我对这个 lab 的理解是：MapReduce 的核心不只是 map 和 reduce 两个函数，而是围绕这两个函数建立的一套可靠执行协议。

```text
分任务 -> 调度 -> 执行 -> 落盘 -> 汇报 -> 推进阶段 -> 容错重试
```

把这条链路想清楚以后，代码就比较自然了。
