---
title: "Git 使用教程"
date: 2026-03-14
lastmod: 2026-03-14
draft: false
garden_tags: ["Linux", "Git"]
summary: " "
status: "seeding"
---

# Git 使用教程

Git 是分布式版本控制系统，核心用途是记录文件变化、管理历史版本和支持多人协作。

学习 Git 时，先记住三个区域：

| 区域   | 说明           |
| ---- | ------------ |
| 工作区  | 正在直接编辑的文件    |
| 暂存区  | 准备提交的内容      |
| 本地仓库 | 已经提交成历史版本的内容 |

一个最常见的工作流如下：

```bash
编辑文件
git status
git add .
git commit -m "说明这次修改"
git push
```

---

## 1. Git 基础与初始化

### 1.1 Git 能做什么
- 跟踪代码、文档和配置文件的历史变化。
- 随时回退到之前的版本。
- 通过分支并行开发，避免互相覆盖。
- 借助远程仓库进行协作。

### 1.2 常见概念
| 名词 | 含义 |
| --- | --- |
| repository / repo | 版本库 |
| commit | 一次提交，一个历史快照 |
| branch | 分支 |
| merge | 合并分支 |
| rebase | 变基，整理提交历史 |
| remote | 远程仓库地址 |
| tag | 标签，常用于版本发布 |

### 1.3 首次使用先配置身份
```bash
git config --global user.name "your_name"
git config --global user.email "your_email@example.com"
git config --global --list
```

### 1.4 创建本地仓库
```bash
mkdir my_project
cd my_project
git init
```

### 1.5 克隆远程仓库
```bash
git clone https://github.com/user/repo.git
git clone https://github.com/user/repo.git myrepo
```

### 1.6 查看仓库状态
```bash
git status
git log --oneline
```

> [!tip]
> `git init` 适合从零开始建仓库，`git clone` 适合把已有远程仓库拉到本地。

---

## 2. 本地提交流程

这部分对应最基础、也最常用的本地开发流程：修改文件、加入暂存区、提交到本地仓库。

### 2.1 添加到暂存区
```bash
git add README.md
git add .
```

### 2.2 提交到本地仓库
```bash
git commit -m "初始化项目"
```

### 2.3 查看修改与历史
```bash
git status
git log
git log --oneline
```

### 2.4 删除文件
```bash
git rm test.txt
git rm --cached config.local
```

- `git rm` 会删除文件并放入暂存区。
- `git rm --cached` 只取消跟踪，不删除本地文件。

### 2.5 忽略文件
Git 使用 `.gitignore` 忽略不需要纳入版本控制的文件：

```gitignore
build/
*.log
.env
.vscode/
```

如果文件已经被跟踪，仅添加 `.gitignore` 不够，还要执行：

```bash
git rm --cached .env
git commit -m "停止跟踪 .env"
```

### 2.6 常见易错点
- 没有先 `git add` 就直接 `git commit`。
- 提交信息写得太模糊，比如 `update`、`fix`。
- 以为 `.gitignore` 能自动忽略已经提交过的文件。

---

## 3. 远程仓库与同步

### 3.1 查看和添加远程仓库
```bash
git remote -v
git remote add origin https://github.com/user/repo.git
git remote set-url origin https://github.com/user/new-repo.git
git remote remove origin
```

### 3.2 推送本地内容到远程仓库
```bash
git push -u origin main
git push
```

如果仓库默认分支还是 `master`，把 `main` 改成 `master` 即可。

### 3.3 拉取远程内容
```bash
git pull
git pull origin main
git fetch origin
```

- `git pull` = `git fetch` + `git merge`
- `git fetch` 只获取远程更新，不直接改当前工作区

### 3.4 合并远程分支到本地
```bash
git fetch origin
git merge origin/dev
```

这种写法比直接 `pull` 更可控，适合先看清远程变化再合并。

### 3.5 删除远程分支
```bash
git push origin --delete dev
```

### 3.6 HTTPS 与 SSH
HTTPS：

```bash
https://github.com/user/repo.git
```

SSH：

```bash
git@github.com:user/repo.git
```

- HTTPS 配置简单。
- SSH 更适合长期开发和频繁推送。

---

## 4. 分支管理与合并

### 4.1 查看、创建和切换分支
```bash
git branch
git branch dev
git switch -c dev
git switch dev
```

旧写法也常见：

```bash
git checkout -b dev
git checkout dev
```

### 4.2 合并本地分支
假设把 `dev` 合并到 `main`：

```bash
git switch main
git merge dev
```

### 4.3 删除本地分支
```bash
git branch -d dev
git branch -D dev
```

- `-d` 是安全删除，只能删已合并分支。
- `-D` 是强制删除，风险更高。

### 4.4 解决冲突
冲突常出现在 `merge`、`pull`、`rebase` 时。

冲突文件中会出现类似标记：

```text
<<<<<<< HEAD
当前分支内容
=======
另一分支内容
>>>>>>> dev
```

处理步骤：
1. 手动修改成最终版本。
2. 删除冲突标记。
3. 执行 `git add <file>`。
4. 继续 `git commit` 或 `git rebase --continue`。

> [!warning]
> 解决冲突时不要只删标记，一定要确认最终代码逻辑正确。

---

## 5. 历史回退与撤销修改

这一部分最容易混淆，关键是分清你要撤销的是工作区、暂存区，还是提交历史。

### 5.1 撤销工作区和暂存区修改
```bash
git restore README.md
git restore --staged README.md
```

旧写法：

```bash
git checkout -- README.md
git reset HEAD README.md
```

### 5.2 回退到前一次提交
```bash
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

- `--soft`：回退提交，修改保留在暂存区。
- `--mixed`：回退提交，修改保留在工作区。
- `--hard`：回退提交，并丢弃工作区和暂存区修改。

### 5.3 回到指定提交
```bash
git reset --hard <commit_id>
git checkout <commit_id>
```

- `reset --hard` 适合真正回退。
- `checkout <commit_id>` 更适合临时查看旧版本，会进入 `detached HEAD` 状态。

### 5.4 使用 revert 撤销提交
```bash
git revert HEAD
```

`revert` 会新增一个反向提交，不会改写已有历史，更适合公共分支。

### 5.5 强制操作
```bash
git push --force-with-lease origin main
git push -f origin main
git reset --hard HEAD~1
```

- 强推会改写远程历史。
- 团队协作中优先使用 `--force-with-lease`，不要随手 `-f`。

---

## 6. 标签、变基与储藏

### 6.1 标签管理
创建标签：

```bash
git tag v1.0
git tag -a v1.0 -m "版本 1.0 发布"
git tag -a v1.0 a1b2c3d -m "给指定提交打标签"
```

查看标签：

```bash
git tag
git show v1.0
```

推送标签：

```bash
git push origin v1.0
git push origin --tags
```

删除标签：

```bash
git tag -d v1.0
git push origin --delete tag v1.0
```

### 6.2 rebase 操作
假设当前在 `dev` 分支，想把它整理到最新 `main` 之上：

```bash
git switch dev
git rebase main
```

冲突后继续：

```bash
git add .
git rebase --continue
```

放弃本次 rebase：

```bash
git rebase --abort
```

- `merge` 会保留合并痕迹。
- `rebase` 会让历史更线性。
- 不要随意 rebase 已经公开给别人的共享分支。

### 6.3 储藏修改
保存当前修改：

```bash
git stash
git stash push -m "做到一半的登录页面"
```

查看储藏：

```bash
git stash list
```

恢复储藏：

```bash
git stash pop
git stash apply
git stash apply stash@{1}
```

删除储藏：

```bash
git stash drop stash@{0}
git stash clear
```

- `pop`：恢复后删除记录。
- `apply`：恢复但保留记录。

---

## Git 常用命令速查

| 目标     | 命令                         |
| ------ | -------------------------- |
| 查看状态   | `git status`               |
| 查看历史   | `git log --oneline`        |
| 添加到暂存区 | `git add .`                |
| 提交     | `git commit -m "message"`  |
| 推送     | `git push`                 |
| 拉取     | `git pull`                 |
| 查看分支   | `git branch`               |
| 切换分支   | `git switch dev`           |
| 合并分支   | `git merge dev`            |
| 查看远程   | `git remote -v`            |
| 打标签    | `git tag -a v1.0 -m "msg"` |
| 储藏     | `git stash`                |