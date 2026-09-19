---
title: "ssh连接"
date: 2025-06-18
lastmod: 2025-06-18
draft: false
garden_tags: ["Web & DevOps"]
summary: " "
status: "evergreen"
--- 

## 本地创建ssh密钥对
```bash
ssh-keygen -t rsa -f ~/.ssh/my-ssh-key -C your_username
```
```my-ssh-key```:密钥名称
```your_username```:远程服务器登陆名

生成两个文件
私钥:```~/.ssh/my-ssh-key```

公钥:```~/.ssh/my-ssh-key.pub```

## 将公钥内容添加到服务器
服务器上创建```.ssh```文件夹
```bash
# 新建文件夹
sudo mkdir -p /home/new_username/.ssh
# 拥有者添加读、写、执行权限
sudo chmod 700 /home/new_username/.ssh
```

把你本地生成的公钥复制到服务器：
```bash
sudo vim /home/new_username/.ssh/authorized_keys
```

设置权限和所有权
```bash
#所有者可读可写，其他用户没有任何权限
sudo chmod 600 /home/new_username/.ssh/authorized_keys
sudo chown -R new_username:new_username /home/new_username/.ssh
```

## 本地访问测试
```
ssh -i ~/.ssh/your_key new_username@your_server_ip
```
