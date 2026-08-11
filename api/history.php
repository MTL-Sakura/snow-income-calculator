<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Shanghai');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const DEFAULT_RATES = [
    'baseSalary' => 3500,
    'lesson' => 150,
    'student' => 11,
];
const TAX_STANDARD_DEDUCTION = 5000;

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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    respond(['ok' => true]);
}

require_password();

if ($method === 'GET') {
    $store = load_store();
    $month = $_GET['month'] ?? null;
    if ($month !== null) {
        assert_month((string) $month);
        $record = $store['records'][$month] ?? null;
        respond(['ok' => true, 'record' => $record, 'settings' => $store['settings']]);
    }
    respond([
        'ok' => true,
        'records' => sorted_records($store['records']),
        'settings' => $store['settings'],
    ]);
}

if ($method === 'PUT') {
    $payload = read_json_payload();
    $settingsPayload = isset($payload['settings']) && is_array($payload['settings'])
        ? $payload['settings']
        : $payload;
    $settings = normalize_rates($settingsPayload);
    $store = update_store(function (array $store) use ($settings): array {
        $store['settings'] = $settings;
        return $store;
    });
    respond([
        'ok' => true,
        'settings' => $store['settings'],
        'records' => sorted_records($store['records']),
    ]);
}

if ($method === 'POST') {
    $payload = read_json_payload();
    $currentStore = load_store();
    $requestedMonth = (string) ($payload['month'] ?? '');
    assert_month($requestedMonth);
    if (isset($currentStore['records'][$requestedMonth]) && empty($payload['overwrite'])) {
        respond([
            'ok' => false,
            'code' => 'MONTH_EXISTS',
            'error' => '该月份已有历史记录，请确认后再覆盖',
        ], 409);
    }
    $ratesPayload = isset($payload['rates']) && is_array($payload['rates'])
        ? $payload['rates']
        : $currentStore['settings'];
    $rates = normalize_rates($ratesPayload);
    $record = normalize_record($payload, $rates, $currentStore['records']);

    $store = update_store(function (array $store) use ($record, $rates): array {
        $month = $record['month'];
        $existing = $store['records'][$month] ?? null;
        $record['createdAt'] = is_array($existing) && isset($existing['createdAt'])
            ? $existing['createdAt']
            : $record['updatedAt'];
        $store['records'][$month] = $record;
        $store['settings'] = $rates;
        return $store;
    });
    respond([
        'ok' => true,
        'record' => $store['records'][$record['month']],
        'records' => sorted_records($store['records']),
        'settings' => $store['settings'],
    ]);
}

if ($method === 'DELETE') {
    $month = (string) ($_GET['month'] ?? '');
    assert_month($month);
    $store = update_store(function (array $store) use ($month): array {
        unset($store['records'][$month]);
        return $store;
    });
    respond([
        'ok' => true,
        'records' => sorted_records($store['records']),
        'settings' => $store['settings'],
    ]);
}

respond(['ok' => false, 'error' => '不支持的请求方式'], 405);

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_payload(): array
{
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        respond(['ok' => false, 'error' => '提交内容不是有效 JSON'], 400);
    }
    return $payload;
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

function to_non_negative_amount($value, string $field)
{
    if ($value === '' || $value === null || !is_numeric($value)) {
        respond(['ok' => false, 'error' => $field . ' 必须是数字'], 400);
    }
    $number = (float) $value;
    if (!is_finite($number) || $number < 0 || $number > 1000000) {
        respond(['ok' => false, 'error' => $field . ' 超出范围'], 400);
    }
    $rounded = round($number, 2);
    return floor($rounded) === $rounded ? (int) $rounded : $rounded;
}

function normalize_rates(array $rates): array
{
    return [
        'baseSalary' => to_non_negative_amount($rates['baseSalary'] ?? DEFAULT_RATES['baseSalary'], '月底薪'),
        'lesson' => to_non_negative_amount($rates['lesson'] ?? DEFAULT_RATES['lesson'], '每节课时费'),
        'student' => to_non_negative_amount($rates['student'] ?? DEFAULT_RATES['student'], '每个学生费用'),
    ];
}

function normalize_note($value): string
{
    $note = trim((string) $value);
    $length = function_exists('mb_strlen') ? mb_strlen($note, 'UTF-8') : strlen($note);
    if ($length > 500) {
        respond(['ok' => false, 'error' => '备注不能超过 500 个字符'], 400);
    }
    return $note;
}

function normalize_record(array $payload, array $rates, array $existingRecords): array
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

    $lessonCount = to_non_negative_int($payload['lessonCount'] ?? 0, '上课节数');
    $totalStudents = array_sum($studentsByWeek);
    $trainingTotal = $rates['baseSalary'];
    $lessonTotal = round($lessonCount * $rates['lesson'], 2);
    $studentTotal = round($totalStudents * $rates['student'], 2);
    $totalSalary = round($trainingTotal + $lessonTotal + $studentTotal, 2);
    $tax = calculate_tax($payload['taxInput'] ?? [], $month, $totalSalary, $existingRecords);

    return [
        'month' => $month,
        'baseSalary' => $rates['baseSalary'],
        'lessonCount' => $lessonCount,
        'studentsByWeek' => $studentsByWeek,
        'rates' => $rates,
        'totals' => [
            'totalStudents' => $totalStudents,
            'trainingTotal' => $trainingTotal,
            'lessonTotal' => $lessonTotal,
            'studentTotal' => $studentTotal,
            'totalSalary' => $totalSalary,
        ],
        'tax' => $tax,
        'note' => normalize_note($payload['note'] ?? ''),
        'updatedAt' => date(DATE_ATOM),
    ];
}

function calculate_tax($taxInput, string $month, float $totalSalary, array $records): array
{
    if (!is_array($taxInput)) {
        $taxInput = [];
    }
    $calendarMonth = (int) substr($month, 5, 2);
    $employmentMonths = to_non_negative_int($taxInput['employmentMonths'] ?? $calendarMonth, '本年任职月数');
    if ($employmentMonths < 1 || $employmentMonths > 12) {
        respond(['ok' => false, 'error' => '本年任职月数必须在 1 到 12 之间'], 400);
    }

    $socialInsurance = to_non_negative_amount($taxInput['socialInsurance'] ?? 0, '社保公积金');
    $specialAdditional = to_non_negative_amount($taxInput['specialAdditional'] ?? 0, '专项附加扣除');
    $otherDeduction = to_non_negative_amount($taxInput['otherDeduction'] ?? 0, '其他依法扣除');
    $deductionsTotal = round($socialInsurance + $specialAdditional + $otherDeduction, 2);
    $yearPrefix = substr($month, 0, 4) . '-';
    $previousIncome = 0.0;
    $previousDeductions = 0.0;
    $previousTax = 0.0;
    $historyMonthCount = 0;
    $missingTaxMonthCount = 0;

    foreach ($records as $record) {
        if (!is_array($record)) {
            continue;
        }
        $recordMonth = (string) ($record['month'] ?? '');
        if (strncmp($recordMonth, $yearPrefix, 5) !== 0 || $recordMonth >= $month) {
            continue;
        }
        $historyMonthCount += 1;
        $previousIncome += record_total_salary($record);
        if (isset($record['tax']) && is_array($record['tax'])) {
            $previousDeductions += numeric_or_zero($record['tax']['deductionsTotal'] ?? 0);
            $previousTax += numeric_or_zero($record['tax']['estimatedTax'] ?? 0);
        } else {
            $missingTaxMonthCount += 1;
        }
    }

    $cumulativeIncome = round($previousIncome + $totalSalary, 2);
    $cumulativeTaxableIncome = max(
        0,
        round(
            $cumulativeIncome -
            TAX_STANDARD_DEDUCTION * $employmentMonths -
            $previousDeductions -
            $deductionsTotal,
            2
        )
    );
    $bracket = tax_bracket($cumulativeTaxableIncome);
    $cumulativeTaxDue = max(
        0,
        round($cumulativeTaxableIncome * $bracket['rate'] - $bracket['quickDeduction'], 2)
    );
    $estimatedTax = max(0, round($cumulativeTaxDue - $previousTax, 2));

    return [
        'method' => 'cumulative-withholding-estimate',
        'standardDeductionPerMonth' => TAX_STANDARD_DEDUCTION,
        'employmentMonths' => $employmentMonths,
        'socialInsurance' => $socialInsurance,
        'specialAdditional' => $specialAdditional,
        'otherDeduction' => $otherDeduction,
        'deductionsTotal' => $deductionsTotal,
        'previousIncome' => round($previousIncome, 2),
        'previousDeductions' => round($previousDeductions, 2),
        'previousTax' => round($previousTax, 2),
        'cumulativeIncome' => $cumulativeIncome,
        'cumulativeTaxableIncome' => $cumulativeTaxableIncome,
        'appliedRate' => $bracket['rate'],
        'quickDeduction' => $bracket['quickDeduction'],
        'cumulativeTaxDue' => $cumulativeTaxDue,
        'estimatedTax' => $estimatedTax,
        'takeHome' => max(0, round($totalSalary - $socialInsurance - $estimatedTax, 2)),
        'historyMonthCount' => $historyMonthCount,
        'missingTaxMonthCount' => $missingTaxMonthCount,
    ];
}

function tax_bracket(float $taxableIncome): array
{
    if ($taxableIncome <= 36000) {
        return ['rate' => 0.03, 'quickDeduction' => 0];
    }
    if ($taxableIncome <= 144000) {
        return ['rate' => 0.10, 'quickDeduction' => 2520];
    }
    if ($taxableIncome <= 300000) {
        return ['rate' => 0.20, 'quickDeduction' => 16920];
    }
    if ($taxableIncome <= 420000) {
        return ['rate' => 0.25, 'quickDeduction' => 31920];
    }
    if ($taxableIncome <= 660000) {
        return ['rate' => 0.30, 'quickDeduction' => 52920];
    }
    if ($taxableIncome <= 960000) {
        return ['rate' => 0.35, 'quickDeduction' => 85920];
    }
    return ['rate' => 0.45, 'quickDeduction' => 181920];
}

function record_total_salary(array $record): float
{
    if (isset($record['totals']['totalSalary']) && is_numeric($record['totals']['totalSalary'])) {
        return (float) $record['totals']['totalSalary'];
    }

    $rates = coerce_stored_rates($record['rates'] ?? []);
    $students = isset($record['studentsByWeek']) && is_array($record['studentsByWeek'])
        ? array_sum(array_map('numeric_or_zero', $record['studentsByWeek']))
        : 0;
    if (isset($record['rates']['baseSalary']) && is_numeric($record['rates']['baseSalary'])) {
        $base = (float) $record['rates']['baseSalary'];
    } elseif (isset($record['rates']['trainingDay']) && is_numeric($record['rates']['trainingDay'])) {
        $base = numeric_or_zero($record['trainingDays'] ?? 0) * (float) $record['rates']['trainingDay'];
    } else {
        $base = (float) $rates['baseSalary'];
    }
    return round(
        $base +
        numeric_or_zero($record['lessonCount'] ?? 0) * $rates['lesson'] +
        $students * $rates['student'],
        2
    );
}

function numeric_or_zero($value): float
{
    return is_numeric($value) ? (float) $value : 0.0;
}

function sorted_records(array $records): array
{
    krsort($records);
    return array_values($records);
}

function coerce_stored_rates($rates): array
{
    if (!is_array($rates)) {
        return DEFAULT_RATES;
    }
    $normalized = [];
    foreach (DEFAULT_RATES as $key => $fallback) {
        $value = $rates[$key] ?? $fallback;
        $normalized[$key] = is_numeric($value) && (float) $value >= 0
            ? round((float) $value, 2)
            : $fallback;
        if (floor($normalized[$key]) === $normalized[$key]) {
            $normalized[$key] = (int) $normalized[$key];
        }
    }
    return $normalized;
}

function store_prefix(): string
{
    return "<?php exit; ?>\n";
}

function empty_store(): array
{
    return ['records' => [], 'settings' => DEFAULT_RATES];
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
    $decoded['settings'] = coerce_stored_rates($decoded['settings'] ?? DEFAULT_RATES);
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
