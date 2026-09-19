---
title: "ST表模板"
date: 2025-02-19
lastmod: 2025-02-19
draft: false
garden_tags: ["Algorithms", "Data Structures", "Templates"]
summary: " "
status: "seeding"
---

```c++
#include <iostream>
#include <vector>
#include <cmath>
#include <functional>
#include <algorithm>
using namespace std;

template<typename T>
class SparseTable {
public:
    using Func = function<T(const T&, const T&)>;
    SparseTable(const vector<T>& arr, Func op = [](const T &a, const T &b){ return max(a, b); }) : op(op) {
        int n = arr.size(), maxLog = floor(log2(n)) + 1;
        table.assign(n, vector<T>(maxLog));
        for (int i = 0; i < n; ++i)
            table[i][0] = arr[i];
        for (int j = 1; j < maxLog; ++j)
            for (int i = 0; i + (1 << j) <= n; ++i)
                table[i][j] = op(table[i][j - 1], table[i + (1 << (j - 1))][j - 1]);
    }
    T query(int L, int R) const {
        int j = floor(log2(R - L + 1));
        return op(table[L][j], table[R - (1 << j) + 1][j]);
    }
private:
    vector<vector<T>> table;
    Func op;
};

int main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int N, M;
    cin >> N >> M;
    vector<int> arr(N);
    for (int i = 0; i < N; i++) cin >> arr[i];
    SparseTable<int> st(arr);
    while (M--) {
        int L, R;
        cin >> L >> R;
        // Adjust for 1-indexed input if necessary:
        cout << st.query(L - 1, R - 1) << "\n";
    }
    return 0;
}
```
