---
title: "Go Slice：使用、传参语义与底层实现"
date: 2026-08-31
lastmod: 2026-08-31
draft: false
garden_tags: ["Data Structures"]
summary: "从 reverse(nums[i+1:]) 出发，理解 Go Slice 的三字段结构、共享底层数组、append 扩容机制与常见陷阱。"
status: "evergreen"
---

在刷 LeetCode 的时候，我看到一个比较神奇的用法：`reverse(nums[i+1:])`。函数接收的是从 `i+1` 到末尾的 slice，并且在函数内部反转之后，原来的 `nums` 也随之改变。

它看起来有点像 C++ 中的：

```cpp
std::reverse(nums.begin() + i + 1, nums.end());
```

不过 C++ 传入的是一对迭代器，而 Go 直接传入了一个 slice。Go 的函数参数不是按值传递吗？为什么函数内部仍然可以修改原 slice 的内容？要回答这个问题，需要先弄清楚：**slice 本身不是数组，而是对底层数组某一段区间的描述。**

## 数组和 Slice 的区别

Go 的数组是值类型，长度也是类型的一部分，`[3]int` 和 `[4]int` 是两种不同的类型。赋值或传参时，整个数组都会被复制。

```go
func changeArray(a [3]int) {
	a[0] = 100
}

func main() {
	a := [3]int{1, 2, 3}
	changeArray(a)
	fmt.Println(a) // [1 2 3]
}
```

slice 的类型写作 `[]T`，长度不属于类型。它更像是底层数组上的一个“窗口”，复制 slice 时只会复制这个窗口的描述信息，而不会复制底层数组中的所有元素。

## Slice 的底层结构

在 Go runtime 中，slice 可以简化理解为下面的结构：

```go
type slice struct {
	array unsafe.Pointer // 指向底层数组中当前起点的指针
	len   int            // 当前可以访问的元素数量
	cap   int            // 从起点到底层数组末尾的容量
}
```

假设有如下代码：

```go
nums := []int{10, 20, 30, 40, 50}
part := nums[1:4]
```

此时可以把两者的关系理解为：

```text
底层数组:  [10, 20, 30, 40, 50]
nums:       ^  len=5 cap=5
part:           ^  len=3 cap=4
                   [20, 30, 40]
```

`part` 的指针指向底层数组中的 `20`，长度为 3，所以能通过下标访问 `20、30、40`；容量为 4，因为从 `20` 到底层数组末尾一共有 4 个位置。

需要注意的是，这个结构是 runtime 的内部实现，用来帮助理解即可。业务代码不应该依赖 `unsafe` 或手工修改 slice header。

## 为什么传入函数后能修改原数据

Go 的参数始终是按值传递，slice 也不例外。只是传递 slice 时，复制的是 `array、len、cap` 这三个字段，而复制前后的两个 slice header 仍然指向同一个底层数组。

```go
func reverse(nums []int) {
	for left, right := 0, len(nums)-1; left < right; left, right = left+1, right-1 {
		nums[left], nums[right] = nums[right], nums[left]
	}
}

func main() {
	nums := []int{1, 2, 3, 4, 5}
	reverse(nums[2:])
	fmt.Println(nums) // [1 2 5 4 3]
}
```

`nums[2:]` 会生成一个新的 slice header，但不会复制元素。`reverse` 修改的是共享底层数组中的数据，因此调用者可以看到变化。

这里要区分“修改元素”和“修改 slice 本身”：

```go
func removeFirst(s []int) {
	s = s[1:] // 只修改了函数内这份 slice header
}

func main() {
	s := []int{1, 2, 3}
	removeFirst(s)
	fmt.Println(s) // [1 2 3]
}
```

如果希望函数修改调用者所持有的长度、容量或起始位置，通常应当返回新的 slice，并由调用者接收：

```go
func removeFirst(s []int) []int {
	return s[1:]
}

s = removeFirst(s)
```

## 创建 Slice：字面量、make 和切片表达式

常见的创建方式有三种：

```go
// 1. 字面量
a := []int{1, 2, 3}

// 2. make：长度为 3，容量为 8
b := make([]int, 3, 8)

// 3. 从数组或已有 slice 截取
arr := [5]int{1, 2, 3, 4, 5}
c := arr[1:4]
```

`make([]T, length, capacity)` 会创建底层数组，并返回描述它的 slice。必须满足 `0 <= length <= capacity`。省略容量时，容量等于长度。

普通切片表达式 `a[low:high]` 使用左闭右开区间：

```text
len = high - low
cap = cap(a) - low
```

还可以使用完整切片表达式 `a[low:high:max]` 限制新 slice 的容量：

```text
len = high - low
cap = max - low
```

这在不希望子 slice 的 `append` 覆盖原数组后续元素时很有用：

```go
base := []int{1, 2, 3, 4}

x := base[:2]   // len=2 cap=4
x = append(x, 9) // 复用底层数组，base 变成 [1 2 9 4]

base = []int{1, 2, 3, 4}
y := base[:2:2]  // len=2 cap=2
y = append(y, 9) // 容量不足，分配新数组
fmt.Println(base) // [1 2 3 4]
```

## append 到底做了什么

`append` 一定会返回一个新的 slice header，因此正确用法是接住返回值：

```go
s = append(s, value)
```

当剩余容量足够时，`append` 直接把新元素写入原底层数组，只更新返回 slice 的长度；当容量不足时，runtime 会调用类似 `growslice` 的逻辑：

1. 计算至少能容纳新长度的容量；
2. 分配一块新的底层数组；
3. 把旧元素复制到新数组；
4. 返回指向新数组的 slice。

因此，`append` 前后是否仍然共享底层数组，取决于这次操作有没有触发扩容：

```go
func appendOne(s []int) {
	s[0] = 100
	s = append(s, 200)
	fmt.Println("inside:", s)
}

func main() {
	a := make([]int, 1, 1)
	a[0] = 1
	appendOne(a)
	fmt.Println("outside:", a) // [100]
}
```

对 `s[0]` 的修改发生在扩容之前，所以调用者能看到；`append` 因容量不足而得到新的数组，但新的 slice header 只保存在函数内部，所以调用者看不到追加的 `200`。这也是自定义追加函数通常要返回 slice 的原因。

### 当前 Go 的扩容策略

“容量不够就固定翻倍”只是便于记忆的近似说法，并不完整。当前 runtime 的 `nextslicecap` 大致遵循：

- 如果一次追加所需的新长度超过旧容量的两倍，直接以新长度作为候选容量；
- 旧容量小于 256 时，候选容量通常按两倍增长；
- 旧容量不小于 256 时，通过一个公式从约 2 倍平滑过渡到约 1.25 倍，并循环增长到足够容纳新长度；
- 最终还会根据元素大小和内存分配器的 size class 做向上取整。

所以不要在业务逻辑中依赖某一次 `append` 得到的精确容量。扩容策略属于实现细节，可能随 Go 版本变化。如果能预估元素数量，提前分配容量通常可以减少扩容和复制：

```go
result := make([]int, 0, expectedSize)
for _, value := range input {
	if value > 0 {
		result = append(result, value)
	}
}
```

## copy、重叠复制与独立副本

内置的 `copy(dst, src)` 返回实际复制的元素个数，即 `min(len(dst), len(src))`，并且能正确处理源和目标重叠的情况。

```go
s := []int{1, 2, 3, 4, 5}
copy(s[1:], s[:4])
fmt.Println(s) // [1 1 2 3 4]
```

如果想得到不共享底层数组的副本，可以这样写：

```go
clone := make([]int, len(s))
copy(clone, s)
```

Go 1.21 及之后也可以使用标准库中的 `slices.Clone`：

```go
clone := slices.Clone(s)
```

## nil Slice 和空 Slice

下面两种 slice 的长度和容量都是 0，也都可以直接 `append`，但它们并不完全相同：

```go
var a []int          // nil slice
b := []int{}         // 非 nil 的空 slice
c := make([]int, 0)  // 非 nil 的空 slice

fmt.Println(a == nil) // true
fmt.Println(b == nil) // false
```

slice 只能和 `nil` 比较，不能直接比较两个 slice。某些编码协议还会区分 nil 和空 slice，例如默认情况下 `encoding/json` 会分别编码成 `null` 和 `[]`，设计接口时需要留意。

## 常见陷阱

### 1. append 意外修改另一个 Slice

只要容量足够，两个 slice 的追加和修改就可能互相影响：

```go
a := []int{1, 2, 3, 4}
b := a[:2]
b = append(b, 99)

fmt.Println(a) // [1 2 99 4]
fmt.Println(b) // [1 2 99]
```

如果需要隔离数据，可以显式复制，或者用完整切片表达式把容量限制为长度。

### 2. 小 Slice 持有大数组

切片不会复制数据，因此一个很小的子 slice 也可能让整个大数组无法被垃圾回收：

```go
func firstKB(data []byte) []byte {
	return data[:1024]
}
```

如果 `data` 很大，而返回值会长期存活，应该复制真正需要的部分：

```go
func firstKB(data []byte) []byte {
	return append([]byte(nil), data[:1024]...)
}
```

### 3. 删除元素后仍然持有指针

对于包含指针、map、slice 或其他引用的元素类型，仅仅缩短长度不一定能让被删除对象及时回收。可以在缩短 slice 前清零不再需要的槽位。Go 1.21 起可以使用内置的 `clear`：

```go
copy(s[i:], s[i+1:])
clear(s[len(s)-1:])
s = s[:len(s)-1]
```

### 4. 并发读写不是安全的

slice header 和底层数组都没有内置同步机制。多个 goroutine 并发读写同一个 slice，或者一边 `append` 一边读取，都可能产生数据竞争。需要通过互斥锁、channel 或明确的数据所有权来同步，并用 `go test -race` 检查竞态。

## 回到最初的问题

`reverse(nums[i+1:])` 能修改 `nums`，并不是 Go 进行了引用传递，而是因为：

1. `nums[i+1:]` 创建了一个新的 slice header；
2. 这个 header 和 `nums` 指向同一个底层数组；
3. 函数按值接收 header，但通过其中的指针修改了共享数组的元素；
4. `reverse` 没有改变调用者的 slice header，所以无需返回 slice。

一句话总结：**slice 是值类型，但它的值中包含指向底层数组的指针。传递 slice 会复制描述符，不会复制元素。**

## 参考资料

- [slice 实践以及底层实现](https://2637309949.github.io/go-interview/#/docs%2FGo%2Fslice%E5%AE%9E%E8%B7%B5%E4%BB%A5%E5%8F%8A%E5%BA%95%E5%B1%82%E5%AE%9E%E7%8E%B0)
- [Go Slices: usage and internals](https://go.dev/blog/slices-intro)
- [Go 语言规范：Slice expressions](https://go.dev/ref/spec#Slice_expressions)
- [Go runtime：slice.go](https://go.dev/src/runtime/slice.go)
