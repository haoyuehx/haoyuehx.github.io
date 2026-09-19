---
title: "使用nginx部署网站"
date: 2025-02-10
lastmod: 2025-02-10
draft: false
garden_tags: ["Web & DevOps"]
summary: " "
status: "growing"
---

## 安装Nginx
``` bash
sudo apt-get update
sudo apt-get install nginx
```
安装完成后，可以使用以下命令启动Nginx
```bash
sudo systemctl start nginx
```

## 配置Nginx
在```/etc/nginx/sites-available```新建配置文件```hugo```
```bash
sudo vim /etc/nginx/sites-available/hugo
```
添加如下配置文件
```nginx
#/etc/nginx/sites-available/hugo
server {
    listen 80;
    server_name haoyuehxのblog.652205015.xyz;

    root /home/ubuntu/myBlog/public;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

将此配置文件保存后，创建一个符号链接到/etc/nginx/sites-enabled/ 目录，以启用该配置：
```bash
sudo ln -s /etc/nginx/sites-available/hugo /etc/nginx/sites-enabled/
```
禁用默认文件
```bash
sudo rm /etc/nginx/sites-enabled/default
```

## 测试 Nginx 配置
测试配置文件是否有语法错误：
```bash
sudo nginx -t
```
重新加载 Nginx 服务：
```bash
sudo systemctl reload nginx
```
重启 Nginx 服务：
```bash
sudo systemctl restart nginx
```

## 查看nginx的log日志

- 访问日志
默认情况下，Nginx的访问日志文件路径为/var/log/nginx/access.log。你可以使用以下命令来查看访问日志文件：
```bash
sudo cat /var/log/nginx/access.log          #这个命令将会输出访问日志文件的所有内容。
sudo tail -f /var/log/nginx/access.log      #这个命令将会实时输出访问日志文件的内容，你可以在日志文件更新时立即看到新的日志内容。
```

## 查询域名所对应的ip

```bash
nslookup -type=NS haoyuehxのblog.652205015.xyz
```
