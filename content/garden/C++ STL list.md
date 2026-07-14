---
title: "C++ STL list"
date: 2025-02-12
lastmod: 2025-02-12
draft: false
math: true
garden_tags: ["algorithm", "链表", "stl"]
summary: " "
status: "evergreen"
---

## 题目 luogu P1160 队列安排
一个学校里老师要将班上$N$个同学排成一列，同学被编号为$1∼N$，他采取如下的方法：
- 1.先将$1$号同学安排进队列，这时队列中只有他一个人；

- 2.$2∼N$号同学依次入列，编号为$i$的同学入列方式为：老师指定编号为$i$的同学站在编号为$1∼(i−1)$中某位同学（即之前已经入列的同学）的左边或右边；

- 3.从队列中去掉$M$个同学，其他同学位置顺序不变。

在所有同学按照上述方法队列排列完毕后，老师想知道从左到右所有同学的编号。

### 思路1：
通过链表模拟
```C++
#include <iostream>
#include <set>

using namespace std;

struct Node {
    int ID;
    Node *front, *next;
};//定义链表节点

Node* addNode(Node* head, int k, int p, int ID)     //插入节点函数
{
    Node* temp = head;
    while (temp->ID != k)
        temp = temp->next;

    Node* newNode = new Node { ID, nullptr, nullptr };

    if (p == 0) {   // 插入到左边
        newNode->next = temp;
        newNode->front = temp->front;
        if (temp->front)
            temp->front->next = newNode;
        temp->front = newNode;
        if (temp == head)
            head = newNode;
    } else {    // 插入到右边
        newNode->front = temp;
        newNode->next = temp->next;
        if (temp->next)
            temp->next->front = newNode;
        temp->next = newNode;
    }
    return head;
}

Node* cutNode(Node* head, int ID)
{
    Node* temp = head;
    while (temp && temp->ID != ID)
        temp = temp->next;

    if (!temp)
        return head;    // 没找到直接返回

    if (temp->front)
        temp->front->next = temp->next;
    if (temp->next)
        temp->next->front = temp->front;

    if (temp == head)
        head = temp->next;  // 处理删除头结点情况

    delete temp;
    return head;
}

int main()
{
    int n;
    cin >> n;
    Node* head = new Node { 1, nullptr, nullptr };

    for (int i = 0; i < n - 1; i++) {
        int k, p;
        cin >> k >> p;
        head = addNode(head, k, p, i + 2);
    }

    int m;
    cin >> m;
    set<int> num;
    for (int i = 0; i < m; i++) {
        int x;
        cin >> x;
        if (num.count(x))
            continue;
        num.insert(x);
        head = cutNode(head, x);
    }

    Node* temp = head;
    while (temp) {
        cout << temp->ID << " ";
        temp = temp->next;
    }

    return 0;
}
```
缺点：
寻找时遍历链表时间复杂度$O(n)$;
综合分析：
插入操作：$O(N²)$
删除操作：$O(MN)$
遍历输出：$O(N)$
总复杂度为：

$$O(N^2+MN+N)$$

### 思路2：
优化方向
1.用```unordered_map<int, Node*>```记录节点地址，查找$O(1)$，降低$O(N²)$到$O(N)$

2.使用 list 代替手写链表
C++ STL list 结构本身就是双向链表，能减少手写链表的开销。



```C++
#include <iostream>
#include <unordered_map>
#include <list>
#include <set>

using namespace std;

int main() {
    int n;
    cin >> n;

    list<int> studentList;
    unordered_map<int, list<int>::iterator> posMap;  // 存储每个编号的迭代器位置

    studentList.push_back(1);
    posMap[1] = studentList.begin();

    for (int i = 0; i < n - 1; i++) {
        int k, p, ID = i + 2;
        cin >> k >> p;
        
        auto it = posMap[k];  // O(1) 找到 k 位置
        if (p == 0) {
            posMap[ID] = studentList.insert(it, ID);  // O(1) 插入左边，insert返回值是迭代器
        } else {
            posMap[ID] = studentList.insert(next(it), ID);  // O(1) 插入右边，insert返回值是迭代器
        }
    }

    int m;
    cin >> m;
    set<int> removeSet;
    for (int i = 0; i < m; i++) {
        int x;
        cin >> x;
        if (removeSet.count(x)) continue;
        removeSet.insert(x);
        studentList.erase(posMap[x]);  // O(1) 删除
    }

    for (int id : studentList) {
        cout << id << " ";
    }

    return 0;
}
```

优化后，总复杂度为：
$$O(N)+O(M)+O(N)=O(N)$$
