<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Shanghai');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$url = 'https://worldtimeapi.org/api/timezone/Asia/Shanghai';
$body = fetch_url($url);

if ($body === null) {
    respond([
        'ok' => false,
        'error' => '无法连接 WorldTimeAPI',
        'fallbackDatetime' => date(DATE_ATOM),
    ], 502);
}

$data = json_decode($body, true);
if (!is_array($data) || empty($data['datetime'])) {
    respond([
        'ok' => false,
        'error' => 'WorldTimeAPI 返回内容异常',
        'fallbackDatetime' => date(DATE_ATOM),
    ], 502);
}

respond([
    'ok' => true,
    'source' => 'WorldTimeAPI',
    'timezone' => $data['timezone'] ?? 'Asia/Shanghai',
    'datetime' => $data['datetime'],
    'unixtime' => $data['unixtime'] ?? null,
    'utcOffset' => $data['utc_offset'] ?? '+08:00',
]);

function fetch_url(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'wage-calculator/1.0',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if (is_string($body) && $status >= 200 && $status < 300) {
            return $body;
        }
        return null;
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 6,
            'header' => "User-Agent: wage-calculator/1.0\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    return is_string($body) ? $body : null;
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
