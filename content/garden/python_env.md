---
title: "python环境配置"
date: 2025-03-14
lastmod: 2025-03-18
draft: false
garden_tags: ["Developer Tools"]
summary: " "
status: "growing"
---

# 安装python环境
1. 安装pyenv
```shell
# 使用官方脚本安装
curl https://pyenv.run | bash

# 将以下内容添加到 ~/.bashrc 或 ~/.zshrc
echo 'export PATH="$HOME/.pyenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init --path)"' >> ~/.bashrc
echo 'eval "$(pyenv virtualenv-init -)"' >> ~/.bashrc  # 可选：虚拟环境插件
source ~/.bashrc
```
2. 安装python指定版本
```shell
pyenv install 3.6
pyenv local 3.6         # 在当前目录及子目录使用 3.8.12
```
3. 在指定版本下创建虚拟环境
```shell
python -m venv venv     # 使用当前 pyenv 设置的 Python 版本创建虚拟环境
source venv/bin/activate
deactivate              # 推出虚拟环境
```
4. 删除虚拟环境
```shell
pyenv uninstall 3.6
```
