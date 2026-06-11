<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Shanghai');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    respond(['ok' => false, 'error' => '服务器还没有配置 api/config.php'], 500);
}

require $configPath;

if (!defined('APP_PASSWORD') || APP_PASSWORD === '' || APP_PASSWORD === 'change-this-password') {
    respond(['ok' => false, 'error' => '请先在 api/config.php 设置访问密码'], 500);
}

if (!defined('DATA_FILE')) {
    define('DATA_FILE', __DIR__ . '/data/history.store.php');
}

$rates = [
    'trainingDay' => 100,
    'lesson' => 150,
    'student' => 15,
];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    respond(['ok' => true]);
}

require_password();

if ($method === 'GET') {
    $store = load_store();
    $month = $_GET['month'] ?? null;
    if ($month !== null) {
        assert_month($month);
        $record = $store['records'][$month] ?? null;
        respond(['ok' => true, 'record' => $record]);
    }
    respond(['ok' => true, 'records' => sorted_records($store['records'])]);
}

if ($method === 'POST') {
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        respond(['ok' => false, 'error' => '提交内容不是有效 JSON'], 400);
    }

    $record = normalize_record($payload, $rates);
    $store = update_store(function (array $store) use ($record): array {
        $month = $record['month'];
        $existing = $store['records'][$month] ?? null;
        $record['createdAt'] = is_array($existing) && isset($existing['createdAt'])
            ? $existing['createdAt']
            : $record['updatedAt'];
        $store['records'][$month] = $record;
        return $store;
    });
    respond(['ok' => true, 'record' => $store['records'][$record['month']], 'records' => sorted_records($store['records'])]);
}

if ($method === 'DELETE') {
    $month = $_GET['month'] ?? '';
    assert_month($month);
    $store = update_store(function (array $store) use ($month): array {
        unset($store['records'][$month]);
        return $store;
    });
    respond(['ok' => true, 'records' => sorted_records($store['records'])]);
}

respond(['ok' => false, 'error' => '不支持的请求方式'], 405);

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_password(): void
{
    $provided = $_SERVER['HTTP_X_APP_PASSWORD'] ?? '';
    if (!hash_equals((string) APP_PASSWORD, (string) $provided)) {
        respond(['ok' => false, 'error' => '访问密码不正确'], 401);
    }
}

function assert_month(string $month): void
{
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
        respond(['ok' => false, 'error' => '月份格式不正确'], 400);
    }
}

function to_non_negative_int($value, string $field): int
{
    if ($value === '' || $value === null) {
        return 0;
    }
    if (!is_numeric($value)) {
        respond(['ok' => false, 'error' => $field . ' 必须是数字'], 400);
    }
    $number = (int) $value;
    if ($number < 0 || $number > 99999) {
        respond(['ok' => false, 'error' => $field . ' 超出范围'], 400);
    }
    return $number;
}

function normalize_record(array $payload, array $rates): array
{
    $month = (string) ($payload['month'] ?? '');
    assert_month($month);

    $students = $payload['studentsByWeek'] ?? [];
    if (!is_array($students)) {
        respond(['ok' => false, 'error' => '每周学生数格式不正确'], 400);
    }

    $studentsByWeek = [];
    for ($i = 0; $i < 4; $i += 1) {
        $studentsByWeek[] = to_non_negative_int($students[$i] ?? 0, '第' . ($i + 1) . '周学生数');
    }

    $trainingDays = to_non_negative_int($payload['trainingDays'] ?? 0, '培训天数');
    $lessonCount = to_non_negative_int($payload['lessonCount'] ?? 0, '上课节数');
    $totalStudents = array_sum($studentsByWeek);
    $trainingTotal = $trainingDays * $rates['trainingDay'];
    $lessonTotal = $lessonCount * $rates['lesson'];
    $studentTotal = $totalStudents * $rates['student'];

    return [
        'month' => $month,
        'trainingDays' => $trainingDays,
        'lessonCount' => $lessonCount,
        'studentsByWeek' => $studentsByWeek,
        'rates' => $rates,
        'totals' => [
            'totalStudents' => $totalStudents,
            'trainingTotal' => $trainingTotal,
            'lessonTotal' => $lessonTotal,
            'studentTotal' => $studentTotal,
            'totalSalary' => $trainingTotal + $lessonTotal + $studentTotal,
        ],
        'updatedAt' => date(DATE_ATOM),
    ];
}

function sorted_records(array $records): array
{
    krsort($records);
    return array_values($records);
}

function store_prefix(): string
{
    return "<?php exit; ?>\n";
}

function empty_store(): array
{
    return ['records' => []];
}

function decode_store(string $raw): array
{
    $prefix = store_prefix();
    if (strncmp($raw, $prefix, strlen($prefix)) === 0) {
        $raw = substr($raw, strlen($prefix));
    }
    if (trim($raw) === '') {
        return empty_store();
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !isset($decoded['records']) || !is_array($decoded['records'])) {
        return empty_store();
    }
    return $decoded;
}

function encode_store(array $store): string
{
    return store_prefix() . json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function ensure_store_dir(): void
{
    $dir = dirname(DATA_FILE);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        respond(['ok' => false, 'error' => '无法创建历史记录目录'], 500);
    }
    if (!is_writable($dir)) {
        respond(['ok' => false, 'error' => '历史记录目录没有写入权限'], 500);
    }
}

function open_store()
{
    ensure_store_dir();
    $handle = fopen(DATA_FILE, 'c+');
    if ($handle === false) {
        respond(['ok' => false, 'error' => '无法打开历史记录文件'], 500);
    }
    return $handle;
}

function load_store(): array
{
    $handle = open_store();
    flock($handle, LOCK_SH);
    rewind($handle);
    $raw = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return decode_store((string) $raw);
}

function update_store(callable $mutator): array
{
    $handle = open_store();
    flock($handle, LOCK_EX);
    rewind($handle);
    $store = decode_store((string) stream_get_contents($handle));
    $store = $mutator($store);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, encode_store($store));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $store;
}
