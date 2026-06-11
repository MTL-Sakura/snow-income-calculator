<?php

// 部署时复制为 api/config.php，然后把密码改成只有你们知道的值。
define('APP_PASSWORD', 'change-this-password');

// 默认会把历史记录保存成 PHP 文件，避免被浏览器直接下载成明文 JSON。
define('DATA_FILE', __DIR__ . '/data/history.store.php');
