# 雪儿的工资计算器

一个给培训工资使用的轻量网页应用：输入上课节数、四周带学生人数，即时计算本月工资。当前月份和北京时间优先通过 WorldTimeAPI 获取，历史记录保存到自己的服务器，并用折线图和表格展示每月工资。

支持工资规则设置、工资备注、同月覆盖确认，以及居民个人工资薪金累计预扣法的个税预估。旧历史记录继续使用保存时的总额和费率，不会按新规则自动重算。

## 计算规则

```text
底薪 = 3500
课时费 = 上课节数 × 150
学生费 = 四周学生数合计 × 11
本月工资 = 底薪 + 课时费 + 学生费
```

底薪、每节课时费和每个学生费用均可在页面中修改。规则会先保存在当前浏览器，输入服务器访问密码后可以同步到服务器；保存月度工资时，也会同时保存该月实际使用的规则快照。

## 个税预估

页面按居民个人工资、薪金所得的累计预扣法估算：累计收入减去每个任职月份 5000 元减除费用、社保公积金、专项附加扣除及其他依法扣除，再使用个人所得税预扣率表计算。公式参考[国家税务总局官方解读](https://www.chinatax.gov.cn/chinatax/n810341/n810760/c3959585/content.html)。

预计到手工资会从税前工资中扣除本月社保公积金和预估个税。个税结果仅用于工资预估，它依赖本年度已经保存在应用中的历史收入和扣除数据；存在未录入月份、奖金、其他综合所得、减免税额或实际扣缴差异时，应以单位工资条、个人所得税 App 和税务机关计算结果为准。

## 文件结构

```text
index.html           页面结构
assets/styles.css    页面样式
assets/app.js        计算、日历、历史记录交互
api/time.php         WorldTimeAPI 代理
api/history.php      历史记录接口
api/config.example.php 配置模板
api/data/            历史记录存放目录
```

## 本地预览

如果本机安装了 PHP：

```bash
cp api/config.example.php api/config.php
php -S 127.0.0.1:8080
```

然后打开：

```text
http://127.0.0.1:8080
```

## 宝塔面板部署

1. 在宝塔面板添加站点，PHP 版本选择 7.4 或 8.x。
2. 把本项目所有文件上传到站点根目录，例如 `/www/wwwroot/你的域名/`。
3. 复制 `api/config.example.php` 为 `api/config.php`。
4. 编辑 `api/config.php`，把 `APP_PASSWORD` 改成只有你们知道的密码。
5. 确认 `api/data/` 目录可写。宝塔文件管理里可以设置权限为 `755` 或 `775`，所有者通常是 `www`。
6. 如果是 Nginx，建议在站点配置里加入：

```nginx
location ^~ /api/data/ {
    deny all;
}
```

7. 保存配置并重载 Nginx/Apache，打开域名即可使用。

以后更新项目时，在服务器项目目录执行：

```bash
git pull
```

本次升级不需要修改现有 `api/config.php`，也不会覆盖 `api/data/history.store.php`。更新后如仍看到旧页面，请使用无痕窗口打开，或强制刷新浏览器缓存。

## GitHub 上传

建议新建一个私有仓库，避免工资数据相关项目公开暴露。仓库建好后，在本地项目目录执行：

```bash
git add .
git commit -m "Initial wage calculator"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

`api/config.php` 和真实历史记录文件已被 `.gitignore` 忽略，不会上传到 GitHub。
