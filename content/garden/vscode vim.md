---
title: "vscode vim keyboard"
date: 2025-07-27
lastmod: 2025-07-27
draft: false
garden_tags: ["Developer Tools"]
summary: " "
status: "seeding"
---

1. 基本开关
- `"vim.easymotion": true`  
  打开 EasyMotion 功能：按 `<leader><leader> + 某个字母` 后，屏幕上每个可见单词/字符会出现一个高亮字母，再按对应字母就能直接跳过去。
  
- `"vim.incsearch": true`  
  实时搜索高亮：输入 `/keyword` 时，每敲一个字符就即时把匹配到的文字高亮出来。

- `"vim.useSystemClipboard": true`  
  复制/粘贴时默认用系统剪贴板。即按 `y` 复制的内容可以直接 `Ctrl+V` 粘到别的软件里。

- `"vim.useCtrlKeys": true`  
  允许 Vim 接管 VS Code 默认的 `Ctrl+?` 快捷键（比如 `Ctrl+f` 不再是“查找”，而是 Vim 的向下翻页）。后面 `handleKeys` 又把部分 `Ctrl+?` 禁用了。

- `"vim.hlsearch": true`  
  搜索结束后仍然把上一次搜索结果高亮显示，直到你手动 `:nohl`。

--------------------------------
2. Insert 模式的小技巧
```json
"vim.insertModeKeyBindings": [
  { "before": ["j", "j"], "after": ["<Esc>"] }
]
```
在插入模式下连续按两次 `j` 相当于按一次 `Esc`，回到普通模式。很多 Vim 用户嫌 `Esc` 太远，就这样改。

--------------------------------
3. Normal 模式的自定义快捷键  
（下面 `<leader>` 统一被设成了空格键 `<space>`）

- `<leader> + d`  
  等价于按 `d d`，删除当前行。

- `Ctrl + n`  
  执行 `:nohl`，取消上一次搜索的高亮。

- `K`（大写）  
  把光标所在行从中间断开，相当于按 `O` 再回车，但无声执行。

- `g d`  
  把光标所在符号的“定义”在**右侧**打开（VS Code 的“侧边预览”）。

- `g i`  
  先水平分屏，然后跳到光标符号的“实现”文件。

- `g t`  
  先水平分屏，然后跳到光标符号的“类型定义”文件。

- `r n`  
  重命名光标所在符号（等价于 VS Code 的 `F2`）。

- `f f`  
  对整个文件执行格式化（`Format Document`）。

- `s n`  
  把当前标签页复制到右侧新分栏（相当于 Vim 的 `Ctrl-w v`）。

- `s c`  
  关闭当前标签页（相当于 Vim 的 `Ctrl-w c`）。

- `s h` / `s l`  
  向左/向右切换标签页（Vim 原生 `g T` / `g t`）。

- `s s`  
  循环跳到下一个编辑器组（在多个分栏之间来回）。

- `z z`  
  一键进入/退出 Zen Mode（全屏、无干扰写作模式）。

--------------------------------
4. Leader 键
```json
"vim.leader": "<space>"
```
把空格键设成“前缀键”。所以上面所有 `s n`、`f f` 等组合键都要先按一下空格，再按后面那个字母。

--------------------------------
5. 把部分 Ctrl 组合键还给 VS Code
```json
"vim.handleKeys": {
  "<C-a>": false,
  "<C-f>": false,
  "<C-c>": false,
  "<C-b>": false,
  "<C-0>": false
}
```
这几个键不再由 Vim 接管，保持 VS Code 默认行为：  
- `Ctrl+a` 全选  
- `Ctrl+f` 查找  
- `Ctrl+c` 复制  
- `Ctrl+b` 打开/关闭侧边栏  
- `Ctrl+0` 聚焦侧边栏
