# 部署与一键更新

- 公开仓库：`https://github.com/Tucyan/deep-surge-gameplay-lab`
- 游戏：`https://taskstream.xyz/deep-surge-lab/`
- 策划工具：`https://taskstream.xyz/deep-surge-editor/`
- SSH：`root@123.57.154.12`
- 服务器仓库：`/opt/deep-surge-lab/repo`
- 当前发布：`/opt/deep-surge-lab/current`（指向已检查的发布目录）

## 更新

在本目录修改内容、运行检查并提交推送到公开仓库 `main`。GitHub CLI 使用 Tucyan 账户。然后双击 `一键更新服务器.cmd`。

原 `water-era/一键更新服务器.cmd` 的 SSH 更新入口已调整为更新此实验项目。

服务器脚本从公开仓库拉取一次，执行语法、发布配置和规则测试，通过后原子切换发布目录，并检查两个 HTTP 入口。失败时保留或恢复上一次发布；旧发布目录保留以供回退。单次拉取超时60秒，不自动重试。

```sh
ssh root@123.57.154.12 'bash /opt/deep-surge-lab/repo/scripts/update-server.sh'
```

首次部署通过 Git bundle 上传，避免服务器首次从 GitHub 下载。`--local` 仅用于部署服务器仓库当前提交。每次更新不改 Nginx。

## Nginx

`scripts/nginx-origin.conf` 提供 `127.0.0.1:3184` 静态服务；`scripts/nginx-locations.inc` 插入现有 HTTPS 站点，提供两个新路径。安装配置前备份，`nginx -t` 通过后重新加载。原游戏路径 `/deep-surge/` 保留。

## 默认玩法

策划导出的合法配置替换 `config/default.json` 后即可随提交发布。浏览器已应用的个人配置优先于发布配置；在游戏“玩法配置”选择“恢复发布配置”可切换回网站默认。配置改动使内容版本变化，旧配置进度不会作为新配置进度读取。

没有在线共享数据库或公开写入接口。策划编辑、导入和应用均保存在使用者的浏览器，导出文件负责分享与备份。
