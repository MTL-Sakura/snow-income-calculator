const DEFAULT_RATES = Object.freeze({
  baseSalary: 3500,
  lesson: 150,
  student: 11,
});

const TAX_STANDARD_DEDUCTION = 5000;
const TAX_BRACKETS = [
  { ceiling: 36000, rate: 0.03, quickDeduction: 0 },
  { ceiling: 144000, rate: 0.1, quickDeduction: 2520 },
  { ceiling: 300000, rate: 0.2, quickDeduction: 16920 },
  { ceiling: 420000, rate: 0.25, quickDeduction: 31920 },
  { ceiling: 660000, rate: 0.3, quickDeduction: 52920 },
  { ceiling: 960000, rate: 0.35, quickDeduction: 85920 },
  { ceiling: Number.POSITIVE_INFINITY, rate: 0.45, quickDeduction: 181920 },
];

const API = {
  time: "api/time.php",
  history: "api/history.php",
  worldTime: "https://worldtimeapi.org/api/timezone/Asia/Shanghai",
};

const STORAGE_KEYS = {
  password: "wage-calculator-password",
  remember: "wage-calculator-remember-password",
  rates: "wage-calculator-rates",
  chartRange: "wage-calculator-chart-range",
};

const state = {
  currentBeijingDate: null,
  selectedMonth: "",
  historyRecords: [],
  historyConnected: false,
  rates: { ...DEFAULT_RATES },
  chartRange: 12,
};

const el = {
  currentTime: document.querySelector("#currentTime"),
  monthPicker: document.querySelector("#monthPicker"),
  monthLabel: document.querySelector("#monthLabel"),
  totalSalary: document.querySelector("#totalSalary"),
  trainingTotal: document.querySelector("#trainingTotal"),
  lessonTotal: document.querySelector("#lessonTotal"),
  studentTotal: document.querySelector("#studentTotal"),
  taxTotal: document.querySelector("#taxTotal"),
  takeHomeTotal: document.querySelector("#takeHomeTotal"),
  studentCountText: document.querySelector("#studentCountText"),
  baseSalaryDisplay: document.querySelector("#baseSalaryDisplay"),
  lessonCount: document.querySelector("#lessonCount"),
  lessonRateHint: document.querySelector("#lessonRateHint"),
  rateSummary: document.querySelector("#rateSummary"),
  weekFields: document.querySelector("#weekFields"),
  miniCalendar: document.querySelector("#miniCalendar"),
  salaryNote: document.querySelector("#salaryNote"),
  baseSalaryRate: document.querySelector("#baseSalaryRate"),
  lessonRate: document.querySelector("#lessonRate"),
  studentRate: document.querySelector("#studentRate"),
  saveRates: document.querySelector("#saveRates"),
  rateStatus: document.querySelector("#rateStatus"),
  socialInsurance: document.querySelector("#socialInsurance"),
  specialDeduction: document.querySelector("#specialDeduction"),
  otherDeduction: document.querySelector("#otherDeduction"),
  employmentMonths: document.querySelector("#employmentMonths"),
  cumulativeTaxable: document.querySelector("#cumulativeTaxable"),
  currentTax: document.querySelector("#currentTax"),
  takeHomeSalary: document.querySelector("#takeHomeSalary"),
  taxContext: document.querySelector("#taxContext"),
  accessPassword: document.querySelector("#accessPassword"),
  rememberPassword: document.querySelector("#rememberPassword"),
  connectHistory: document.querySelector("#connectHistory"),
  saveRecord: document.querySelector("#saveRecord"),
  resetForm: document.querySelector("#resetForm"),
  historyStatus: document.querySelector("#historyStatus"),
  historyChart: document.querySelector("#historyChart"),
  historyList: document.querySelector("#historyList"),
  overwriteDialog: document.querySelector("#overwriteDialog"),
  overwriteMessage: document.querySelector("#overwriteMessage"),
};

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0);
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed) : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function monthParts(monthValue) {
  const [year, month] = String(monthValue).split("-").map(Number);
  return { year, month };
}

function formatMonthValue(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  return `${year}-${month}`;
}

function formatMonthLabel(monthValue) {
  if (!monthValue) return "--";
  const { year, month } = monthParts(monthValue);
  return `${year}年${month}月`;
}

function getLastDayOfMonth(monthValue) {
  const { year, month } = monthParts(monthValue);
  return new Date(year, month, 0).getDate();
}

function getPayWeeks(monthValue) {
  const lastDay = getLastDayOfMonth(monthValue);
  return [
    { label: "第1周", start: 1, end: Math.min(7, lastDay) },
    { label: "第2周", start: 8, end: Math.min(14, lastDay) },
    { label: "第3周", start: 15, end: Math.min(21, lastDay) },
    { label: "第4周", start: 22, end: lastDay },
  ];
}

function renderWeekInputs() {
  const weeks = getPayWeeks(state.selectedMonth);
  el.weekFields.innerHTML = weeks
    .map((week, index) => {
      const range = `${week.start}日-${week.end}日`;
      return `
        <label class="week-card" for="week${index + 1}">
          <header>
            <span>${week.label}</span>
            <span>${range}</span>
          </header>
          <input id="week${index + 1}" class="money-input week-input" data-week="${index}" type="number" min="0" step="1" inputmode="numeric" placeholder="0">
          <small>每个学生 ${formatMoney(state.rates.student)}</small>
        </label>
      `;
    })
    .join("");
}

function isSameBeijingMonth(date, monthValue) {
  return formatMonthValue(date) === monthValue;
}

function getBeijingDay(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    day: "2-digit",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "day").value);
}

function renderCalendar() {
  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
  const { year, month } = monthParts(state.selectedMonth);
  const firstDate = new Date(year, month - 1, 1);
  const firstOffset = (firstDate.getDay() + 6) % 7;
  const lastDay = getLastDayOfMonth(state.selectedMonth);
  const todayDay =
    state.currentBeijingDate && isSameBeijingMonth(state.currentBeijingDate, state.selectedMonth)
      ? getBeijingDay(state.currentBeijingDate)
      : null;

  const cells = weekdays.map((day) => `<div class="calendar-cell weekday">${day}</div>`);
  for (let i = 0; i < firstOffset; i += 1) {
    cells.push('<div class="calendar-cell empty" aria-hidden="true"></div>');
  }
  for (let day = 1; day <= lastDay; day += 1) {
    const todayClass = day === todayDay ? " today" : "";
    cells.push(`<div class="calendar-cell${todayClass}" aria-label="${month}月${day}日">${day}</div>`);
  }
  el.miniCalendar.innerHTML = cells.join("");
}

function getStudentInputs() {
  return Array.from(document.querySelectorAll(".week-input"));
}

function getTaxInputValues() {
  const selectedMonthNumber = monthParts(state.selectedMonth).month || 1;
  const employmentMonths = clamp(toInt(el.employmentMonths.value) || selectedMonthNumber, 1, 12);
  return {
    socialInsurance: toAmount(el.socialInsurance.value),
    specialAdditional: toAmount(el.specialDeduction.value),
    otherDeduction: toAmount(el.otherDeduction.value),
    employmentMonths,
  };
}

function getFormValues() {
  return {
    month: state.selectedMonth,
    baseSalary: state.rates.baseSalary,
    lessonCount: toInt(el.lessonCount.value),
    studentsByWeek: getStudentInputs().map((input) => toInt(input.value)),
  };
}

function calculateTotals(values = getFormValues(), rates = state.rates) {
  const totalStudents = values.studentsByWeek.reduce((sum, count) => sum + count, 0);
  const trainingTotal = toAmount(rates.baseSalary);
  const lessonTotal = roundMoney(values.lessonCount * toAmount(rates.lesson));
  const studentTotal = roundMoney(totalStudents * toAmount(rates.student));
  return {
    totalStudents,
    trainingTotal,
    lessonTotal,
    studentTotal,
    totalSalary: roundMoney(trainingTotal + lessonTotal + studentTotal),
  };
}

function getRecordMetrics(record) {
  if (record.totals) {
    return {
      totalStudents:
        record.totals.totalStudents ??
        (record.studentsByWeek || []).reduce((sum, count) => sum + toInt(count), 0),
      trainingTotal: Number(record.totals.trainingTotal) || 0,
      lessonTotal: Number(record.totals.lessonTotal) || 0,
      studentTotal: Number(record.totals.studentTotal) || 0,
      totalSalary: Number(record.totals.totalSalary) || 0,
    };
  }

  const studentsByWeek = record.studentsByWeek || [];
  const totalStudents = studentsByWeek.reduce((sum, count) => sum + toInt(count), 0);
  const savedRates = record.rates || {};
  const savedBaseSalary = Number(savedRates.baseSalary);
  const savedTrainingDayRate = Number(savedRates.trainingDay);
  const trainingTotal = Number.isFinite(savedBaseSalary)
    ? savedBaseSalary
    : Number.isFinite(savedTrainingDayRate)
      ? toInt(record.trainingDays) * savedTrainingDayRate
      : state.rates.baseSalary;
  const lessonRate = Number.isFinite(Number(savedRates.lesson)) ? Number(savedRates.lesson) : state.rates.lesson;
  const studentRate = Number.isFinite(Number(savedRates.student)) ? Number(savedRates.student) : state.rates.student;
  const lessonTotal = toInt(record.lessonCount) * lessonRate;
  const studentTotal = totalStudents * studentRate;

  return {
    totalStudents,
    trainingTotal,
    lessonTotal,
    studentTotal,
    totalSalary: roundMoney(trainingTotal + lessonTotal + studentTotal),
  };
}

function getTaxBracket(taxableIncome) {
  return TAX_BRACKETS.find((bracket) => taxableIncome <= bracket.ceiling) || TAX_BRACKETS[0];
}

function getPriorYearRecords(monthValue) {
  const yearPrefix = `${monthParts(monthValue).year}-`;
  return state.historyRecords.filter(
    (record) => String(record.month).startsWith(yearPrefix) && String(record.month) < monthValue,
  );
}

function calculateTax(totals = calculateTotals(), taxInput = getTaxInputValues()) {
  const priorRecords = getPriorYearRecords(state.selectedMonth);
  const previousIncome = priorRecords.reduce((sum, record) => sum + getRecordMetrics(record).totalSalary, 0);
  const previousDeductions = priorRecords.reduce((sum, record) => {
    return sum + (Number(record.tax?.deductionsTotal) || 0);
  }, 0);
  const previousTax = priorRecords.reduce((sum, record) => {
    return sum + (Number(record.tax?.estimatedTax) || 0);
  }, 0);
  const deductionsTotal = roundMoney(
    taxInput.socialInsurance + taxInput.specialAdditional + taxInput.otherDeduction,
  );
  const cumulativeIncome = roundMoney(previousIncome + totals.totalSalary);
  const cumulativeTaxableIncome = Math.max(
    0,
    roundMoney(
      cumulativeIncome -
        TAX_STANDARD_DEDUCTION * taxInput.employmentMonths -
        previousDeductions -
        deductionsTotal,
    ),
  );
  const bracket = getTaxBracket(cumulativeTaxableIncome);
  const cumulativeTaxDue = Math.max(
    0,
    roundMoney(cumulativeTaxableIncome * bracket.rate - bracket.quickDeduction),
  );
  const estimatedTax = Math.max(0, roundMoney(cumulativeTaxDue - previousTax));

  return {
    ...taxInput,
    deductionsTotal,
    previousIncome,
    previousDeductions,
    previousTax,
    cumulativeIncome,
    cumulativeTaxableIncome,
    cumulativeTaxDue,
    appliedRate: bracket.rate,
    quickDeduction: bracket.quickDeduction,
    estimatedTax,
    takeHome: Math.max(0, roundMoney(totals.totalSalary - taxInput.socialInsurance - estimatedTax)),
    historyMonthCount: priorRecords.length,
    missingTaxMonthCount: priorRecords.filter((record) => !record.tax).length,
  };
}

function updateTaxContext(tax) {
  el.taxContext.classList.toggle("is-warn", !state.historyConnected || tax.missingTaxMonthCount > 0);
  if (!state.historyConnected) {
    el.taxContext.textContent = "尚未连接历史数据，当前结果只适合作为粗略预估。";
    return;
  }
  if (tax.missingTaxMonthCount > 0) {
    el.taxContext.textContent = `已计入本年度 ${tax.historyMonthCount} 条历史收入，其中 ${tax.missingTaxMonthCount} 条没有历史扣除数据。`;
    return;
  }
  el.taxContext.textContent = `已计入本年度 ${tax.historyMonthCount} 条历史收入，按任职 ${tax.employmentMonths} 个月累计预估。`;
}

function updateRateUi(syncInputs = false) {
  el.baseSalaryDisplay.textContent = formatMoney(state.rates.baseSalary);
  el.lessonRateHint.textContent = `每节 ${formatMoney(state.rates.lesson)}`;
  el.rateSummary.textContent = `${state.rates.baseSalary} / ${state.rates.lesson} / ${state.rates.student}`;
  if (syncInputs) {
    el.baseSalaryRate.value = String(state.rates.baseSalary);
    el.lessonRate.value = String(state.rates.lesson);
    el.studentRate.value = String(state.rates.student);
  }
  document.querySelectorAll(".week-card small").forEach((hint) => {
    hint.textContent = `每个学生 ${formatMoney(state.rates.student)}`;
  });
}

function updateTotals() {
  const totals = calculateTotals();
  const tax = calculateTax(totals);
  updateRateUi();
  el.totalSalary.textContent = formatMoney(totals.totalSalary);
  el.trainingTotal.textContent = formatMoney(totals.trainingTotal);
  el.lessonTotal.textContent = formatMoney(totals.lessonTotal);
  el.studentTotal.textContent = formatMoney(totals.studentTotal);
  el.studentCountText.textContent = `共 ${totals.totalStudents} 人`;
  el.taxTotal.textContent = formatMoney(tax.estimatedTax);
  el.takeHomeTotal.textContent = formatMoney(tax.takeHome);
  el.cumulativeTaxable.textContent = formatMoney(tax.cumulativeTaxableIncome);
  el.currentTax.textContent = formatMoney(tax.estimatedTax);
  el.takeHomeSalary.textContent = formatMoney(tax.takeHome);
  updateTaxContext(tax);
}

function normalizeCountInput(input) {
  const value = toInt(input.value);
  input.value = value > 0 ? String(value) : "";
}

function normalizeAmountInput(input) {
  const value = toAmount(input.value);
  input.value = value > 0 ? String(value) : "";
}

function normalizeEmploymentMonths() {
  const fallback = monthParts(state.selectedMonth).month || 1;
  el.employmentMonths.value = String(clamp(toInt(el.employmentMonths.value) || fallback, 1, 12));
}

function setStatus(message, kind = "") {
  el.historyStatus.textContent = message;
  el.historyStatus.classList.toggle("is-good", kind === "good");
  el.historyStatus.classList.toggle("is-warn", kind === "warn");
}

function setRateStatus(message, kind = "") {
  el.rateStatus.textContent = message;
  el.rateStatus.classList.toggle("is-good", kind === "good");
  el.rateStatus.classList.toggle("is-warn", kind === "warn");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("服务器返回内容不是有效 JSON");
  }
  if (!response.ok || data.ok === false) {
    const requestError = new Error(data.error || "请求失败");
    requestError.status = response.status;
    requestError.code = data.code || "";
    throw requestError;
  }
  return data;
}

async function loadBeijingTime() {
  try {
    const data = await fetchJson(API.time);
    return { date: new Date(data.datetime), source: "WorldTimeAPI" };
  } catch (serverError) {
    try {
      const data = await fetchJson(API.worldTime);
      return { date: new Date(data.datetime), source: "WorldTimeAPI" };
    } catch (directError) {
      return { date: new Date(), source: "本机时间备用" };
    }
  }
}

function updateCurrentTimeLabel(source) {
  el.currentTime.textContent = `${dateTimeFormatter.format(state.currentBeijingDate)} · ${source}`;
}

function renderMonth() {
  el.monthPicker.value = state.selectedMonth;
  el.monthLabel.textContent = formatMonthLabel(state.selectedMonth);
  el.employmentMonths.value = String(monthParts(state.selectedMonth).month || 1);
  renderWeekInputs();
  renderCalendar();
  updateRateUi(true);
  updateTotals();
}

function setMonth(monthValue) {
  state.selectedMonth = monthValue;
  renderMonth();
}

function buildRecord() {
  const values = getFormValues();
  const totals = calculateTotals(values);
  return {
    ...values,
    rates: { ...state.rates },
    totals,
    taxInput: getTaxInputValues(),
    note: el.salaryNote.value.trim(),
  };
}

function fillForm(record) {
  state.selectedMonth = record.month;
  renderMonth();
  el.lessonCount.value = record.lessonCount || "";
  getStudentInputs().forEach((input, index) => {
    const value = record.studentsByWeek?.[index] || 0;
    input.value = value > 0 ? String(value) : "";
  });
  el.salaryNote.value = record.note || "";
  const tax = record.tax || {};
  el.socialInsurance.value = tax.socialInsurance || "";
  el.specialDeduction.value = tax.specialAdditional || "";
  el.otherDeduction.value = tax.otherDeduction || "";
  el.employmentMonths.value = String(tax.employmentMonths || monthParts(record.month).month || 1);
  updateTotals();
}

function readRatesFromInputs() {
  return {
    baseSalary: toAmount(el.baseSalaryRate.value),
    lesson: toAmount(el.lessonRate.value),
    student: toAmount(el.studentRate.value),
  };
}

function persistRates() {
  localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify(state.rates));
}

function applyRates(rates, persist = true) {
  if (!rates || typeof rates !== "object") return;
  state.rates = {
    baseSalary: toAmount(rates.baseSalary),
    lesson: toAmount(rates.lesson),
    student: toAmount(rates.student),
  };
  if (persist) persistRates();
  updateRateUi(true);
  updateTotals();
}

function restoreRatePreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.rates) || "null");
    if (saved && typeof saved === "object") {
      state.rates = {
        baseSalary: toAmount(saved.baseSalary),
        lesson: toAmount(saved.lesson),
        student: toAmount(saved.student),
      };
    }
  } catch (error) {
    localStorage.removeItem(STORAGE_KEYS.rates);
  }
}

function getPassword() {
  return el.accessPassword.value.trim();
}

function persistPasswordPreference() {
  const password = getPassword();
  if (el.rememberPassword.checked && password) {
    localStorage.setItem(STORAGE_KEYS.password, password);
    localStorage.setItem(STORAGE_KEYS.remember, "1");
  } else {
    localStorage.removeItem(STORAGE_KEYS.password);
    localStorage.removeItem(STORAGE_KEYS.remember);
  }
}

function restorePasswordPreference() {
  const remembered = localStorage.getItem(STORAGE_KEYS.remember) === "1";
  el.rememberPassword.checked = remembered;
  if (remembered) {
    el.accessPassword.value = localStorage.getItem(STORAGE_KEYS.password) || "";
  }
}

async function historyRequest(method, payload, query = "") {
  const password = getPassword();
  if (!password) throw new Error("请先输入访问密码");

  const options = {
    method,
    headers: { "X-App-Password": password },
  };
  if (payload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }
  return fetchJson(`${API.history}${query}`, options);
}

function sortRecordsByMonth(records) {
  return [...records].sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

function formatShortMonth(monthValue) {
  const { year, month } = monthParts(monthValue);
  return month === 1 ? `${year}年1月` : `${month}月`;
}

function getChartRecords(records) {
  const sorted = sortRecordsByMonth(records);
  return state.chartRange === "all" ? sorted : sorted.slice(-Number(state.chartRange));
}

function renderHistoryChart(records) {
  if (!records.length) {
    el.historyChart.innerHTML = `
      <div class="chart-empty">
        <strong>暂无工资走势</strong>
        <span>等待历史数据</span>
      </div>
    `;
    return;
  }

  const chartRecords = getChartRecords(records);
  const values = chartRecords.map((record) => getRecordMetrics(record).totalSalary);
  const latestRecord = chartRecords[chartRecords.length - 1];
  const latestTotal = values[values.length - 1] || 0;
  const previousTotal = values[values.length - 2];
  const change = Number.isFinite(previousTotal) ? roundMoney(latestTotal - previousTotal) : null;
  const highestTotal = Math.max(...values, 0);
  const highestIndex = values.indexOf(highestTotal);
  const latestIndex = values.length - 1;
  const averageTotal = values.reduce((sum, value) => sum + value, 0) / values.length || 0;
  const axisMax = Math.max(1000, Math.ceil((highestTotal * 1.12) / 1000) * 1000);
  const width = Math.max(960, chartRecords.length * 92);
  const height = 350;
  const top = 40;
  const right = 36;
  const bottom = 68;
  const left = 70;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const chartBottom = height - bottom;
  const xStep = chartRecords.length > 1 ? chartWidth / (chartRecords.length - 1) : 0;
  const yFor = (value) => chartBottom - (value / axisMax) * chartHeight;

  const points = chartRecords.map((record, index) => ({
    x: chartRecords.length === 1 ? left + chartWidth / 2 : left + index * xStep,
    y: yFor(getRecordMetrics(record).totalSalary),
    record,
  }));
  const linePath =
    points.length === 1
      ? `M ${points[0].x - 18} ${points[0].y} L ${points[0].x + 18} ${points[0].y}`
      : points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`;
  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = chartBottom - ratio * chartHeight;
      return `
        <g>
          <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="chart-grid-line"></line>
          <text x="${left - 12}" y="${y + 4}" class="chart-axis-label" text-anchor="end">${formatMoney(axisMax * ratio)}</text>
        </g>
      `;
    })
    .join("");
  const labelEvery = chartRecords.length > 14 ? Math.ceil(chartRecords.length / 12) : 1;
  const dots = points
    .map((point, index) => {
      const totals = getRecordMetrics(point.record);
      const showValue = index === latestIndex || index === highestIndex || points.length === 1;
      const showLabel = index === 0 || index === latestIndex || index % labelEvery === 0;
      const prior = index > 0 ? values[index - 1] : null;
      const pointChange = prior === null ? "" : `，较上月${totals.totalSalary >= prior ? "增加" : "减少"}${formatMoney(Math.abs(totals.totalSalary - prior))}`;
      return `
        <g class="chart-point">
          <title>${formatMonthLabel(point.record.month)}：${formatMoney(totals.totalSalary)}${pointChange}</title>
          <circle cx="${point.x}" cy="${point.y}" r="5" class="chart-dot"></circle>
          ${showValue ? `<text x="${point.x}" y="${point.y - 13}" class="chart-value" text-anchor="middle">${formatMoney(totals.totalSalary)}</text>` : ""}
          ${showLabel ? `<text x="${point.x}" y="${chartBottom + 28}" class="chart-axis-label" text-anchor="middle">${formatShortMonth(point.record.month)}</text>` : ""}
        </g>
      `;
    })
    .join("");
  const averageY = yFor(averageTotal);
  const changeClass = change === null ? "is-neutral" : change >= 0 ? "is-positive" : "is-negative";
  const changeText = change === null ? "--" : `${change >= 0 ? "+" : "-"}${formatMoney(Math.abs(change))}`;
  const ranges = [
    { value: 6, label: "近6月" },
    { value: 12, label: "近12月" },
    { value: "all", label: "全部" },
  ];

  el.historyChart.innerHTML = `
    <section class="chart-panel" aria-label="每月工资走势">
      <div class="chart-head">
        <div>
          <p class="eyebrow">工资走势</p>
          <h3>每月总工资折线图</h3>
          <div class="chart-range" aria-label="图表时间范围">
            ${ranges
              .map(
                (range) =>
                  `<button type="button" data-chart-range="${range.value}" class="${String(state.chartRange) === String(range.value) ? "is-active" : ""}">${range.label}</button>`,
              )
              .join("")}
          </div>
        </div>
        <div class="chart-stats" aria-label="工资统计摘要">
          <span><small>最新</small><b>${formatMoney(latestTotal)}</b></span>
          <span><small>较上月</small><b class="${changeClass}">${changeText}</b></span>
          <span><small>最高</small><b>${formatMoney(highestTotal)}</b></span>
          <span><small>平均</small><b>${formatMoney(averageTotal)}</b></span>
        </div>
      </div>
      <div class="chart-canvas">
        <svg viewBox="0 0 ${width} ${height}" style="min-width: ${Math.max(760, chartRecords.length * 84)}px" role="img" aria-label="${formatMonthLabel(latestRecord.month)}工资${formatMoney(latestTotal)}">
          <defs>
            <linearGradient id="salaryArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#147a72" stop-opacity="0.26"></stop>
              <stop offset="100%" stop-color="#147a72" stop-opacity="0.02"></stop>
            </linearGradient>
          </defs>
          ${gridLines}
          <line x1="${left}" y1="${averageY}" x2="${width - right}" y2="${averageY}" class="chart-average-line"></line>
          <text x="${width - right}" y="${averageY - 7}" class="chart-average-label" text-anchor="end">平均 ${formatMoney(averageTotal)}</text>
          <path d="${areaPath}" class="chart-area"></path>
          <path d="${linePath}" class="chart-line"></path>
          ${dots}
        </svg>
      </div>
    </section>
  `;
}

function renderHistoryList(records) {
  if (!records.length) {
    el.historyList.innerHTML = '<p class="history-empty">暂无历史工资数据。</p>';
    return;
  }

  const rows = [...records]
    .sort((a, b) => String(b.month).localeCompare(String(a.month)))
    .map((record) => {
      const totals = getRecordMetrics(record);
      const updated = record.updatedAt ? new Date(record.updatedAt) : null;
      const updatedText = updated && !Number.isNaN(updated.getTime()) ? dateTimeFormatter.format(updated) : "未记录";
      const tax = Number(record.tax?.estimatedTax);
      const takeHome = Number(record.tax?.takeHome);
      const note = record.note ? escapeHtml(record.note) : "--";
      return `
        <tr>
          <td class="history-month">${formatMonthLabel(record.month)}</td>
          <td class="history-money">${formatMoney(totals.totalSalary)}</td>
          <td>${Number.isFinite(tax) ? formatMoney(tax) : "--"}</td>
          <td class="history-take-home">${Number.isFinite(takeHome) ? formatMoney(takeHome) : "--"}</td>
          <td>${formatMoney(totals.trainingTotal)}</td>
          <td>${formatMoney(totals.lessonTotal)}</td>
          <td>${formatMoney(totals.studentTotal)}</td>
          <td>${totals.totalStudents} 人</td>
          <td class="history-note" title="${note}">${note}</td>
          <td>${escapeHtml(updatedText)}</td>
          <td>
            <div class="history-actions">
              <button type="button" data-action="load" data-month="${record.month}">载入</button>
              <button type="button" data-action="delete" data-month="${record.month}">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  el.historyList.innerHTML = `
    <div class="history-table-wrap">
      <table class="history-table">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col">税前工资</th>
            <th scope="col">预估个税</th>
            <th scope="col">预计到手</th>
            <th scope="col">底薪/培训费</th>
            <th scope="col">课时费</th>
            <th scope="col">学生费</th>
            <th scope="col">学生数</th>
            <th scope="col">备注</th>
            <th scope="col">更新时间</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderHistory(records) {
  renderHistoryChart(records);
  renderHistoryList(records);
}

async function loadHistory({ syncSettings = true, announce = true } = {}) {
  const data = await historyRequest("GET");
  state.historyRecords = data.records || [];
  state.historyConnected = true;
  if (syncSettings && data.settings) {
    applyRates(data.settings);
    setRateStatus("工资规则已与服务器同步。", "good");
  }
  renderHistory(state.historyRecords);
  updateTotals();
  persistPasswordPreference();
  if (announce) setStatus("历史记录已连接。", "good");
}

async function saveRatesToServer() {
  applyRates(readRatesFromInputs());
  if (!getPassword()) {
    setRateStatus("规则已保存在本机；输入访问密码后可同步服务器。", "good");
    return;
  }
  setRateStatus("正在保存规则...");
  const data = await historyRequest("PUT", { settings: state.rates });
  applyRates(data.settings || state.rates);
  setRateStatus("工资规则已保存到服务器。", "good");
}

async function saveCurrentRecord(overwrite = false) {
  const record = buildRecord();
  const data = await historyRequest("POST", { ...record, overwrite });
  state.historyRecords = data.records || [];
  state.historyConnected = true;
  if (data.settings) applyRates(data.settings);
  renderHistory(state.historyRecords);
  updateTotals();
  persistPasswordPreference();
  setStatus(`${formatMonthLabel(record.month)} 已保存。`, "good");
}

async function deleteRecord(month) {
  const data = await historyRequest("DELETE", null, `?month=${encodeURIComponent(month)}`);
  state.historyRecords = data.records || [];
  renderHistory(state.historyRecords);
  updateTotals();
  setStatus(`${formatMonthLabel(month)} 已删除。`, "good");
}

function resetForm() {
  el.lessonCount.value = "";
  getStudentInputs().forEach((input) => {
    input.value = "";
  });
  el.salaryNote.value = "";
  el.socialInsurance.value = "";
  el.specialDeduction.value = "";
  el.otherDeduction.value = "";
  el.employmentMonths.value = String(monthParts(state.selectedMonth).month || 1);
  updateTotals();
}

function confirmOverwrite(month) {
  const message = `${formatMonthLabel(month)} 已有历史记录，覆盖后将以当前输入替换原记录。`;
  if (!el.overwriteDialog || typeof el.overwriteDialog.showModal !== "function") {
    return Promise.resolve(window.confirm(message));
  }
  el.overwriteMessage.textContent = message;
  return new Promise((resolve) => {
    el.overwriteDialog.addEventListener(
      "close",
      () => resolve(el.overwriteDialog.returnValue === "confirm"),
      { once: true },
    );
    el.overwriteDialog.showModal();
  });
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    if (event.target.matches(".money-input, .tax-input")) {
      updateTotals();
    }
    if (event.target.matches(".rate-input")) {
      state.rates = readRatesFromInputs();
      persistRates();
      updateTotals();
      setRateStatus("规则已在本机更新，尚未同步服务器。");
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches(".money-input")) normalizeCountInput(event.target);
    if (event.target.matches(".tax-input:not(#employmentMonths), .rate-input")) normalizeAmountInput(event.target);
    if (event.target.matches("#employmentMonths")) normalizeEmploymentMonths();
    if (event.target.matches(".money-input, .tax-input, .rate-input")) updateTotals();
  });

  el.monthPicker.addEventListener("change", () => {
    setMonth(el.monthPicker.value);
    resetForm();
  });

  el.saveRates.addEventListener("click", async () => {
    try {
      await saveRatesToServer();
    } catch (error) {
      setRateStatus(error.message || "工资规则保存失败", "warn");
    }
  });

  el.connectHistory.addEventListener("click", async () => {
    setStatus("正在连接历史记录...");
    try {
      await loadHistory();
    } catch (error) {
      state.historyConnected = false;
      updateTotals();
      setStatus(error.message || "历史记录连接失败", "warn");
    }
  });

  el.saveRecord.addEventListener("click", async () => {
    setStatus("正在准备保存...");
    try {
      if (!state.historyConnected) await loadHistory({ syncSettings: false, announce: false });
      const existing = state.historyRecords.some((record) => record.month === state.selectedMonth);
      let overwrite = false;
      if (existing && !(await confirmOverwrite(state.selectedMonth))) {
        setStatus("已取消覆盖，原记录保持不变。", "warn");
        return;
      }
      overwrite = existing;
      setStatus("正在保存...");
      try {
        await saveCurrentRecord(overwrite);
      } catch (error) {
        if (error.code !== "MONTH_EXISTS") throw error;
        if (!(await confirmOverwrite(state.selectedMonth))) {
          setStatus("已取消覆盖，原记录保持不变。", "warn");
          return;
        }
        setStatus("正在覆盖保存...");
        await saveCurrentRecord(true);
      }
    } catch (error) {
      setStatus(error.message || "保存失败", "warn");
    }
  });

  el.resetForm.addEventListener("click", () => {
    resetForm();
    setStatus("已清空当前输入。");
  });

  el.historyChart.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-chart-range]");
    if (!button) return;
    const value = button.dataset.chartRange;
    state.chartRange = value === "all" ? "all" : Number(value);
    localStorage.setItem(STORAGE_KEYS.chartRange, String(state.chartRange));
    renderHistoryChart(state.historyRecords);
  });

  el.historyList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const month = button.dataset.month;
    const action = button.dataset.action;
    if (action === "load") {
      const record = state.historyRecords.find((item) => item.month === month);
      if (record) {
        fillForm(record);
        setStatus(`${formatMonthLabel(month)} 已载入；再次保存会先请求覆盖确认。`, "good");
      }
    }
    if (action === "delete") {
      setStatus("正在删除...");
      try {
        await deleteRecord(month);
      } catch (error) {
        setStatus(error.message || "删除失败", "warn");
      }
    }
  });

  el.rememberPassword.addEventListener("change", persistPasswordPreference);
}

async function init() {
  restoreRatePreference();
  restorePasswordPreference();
  const savedChartRange = localStorage.getItem(STORAGE_KEYS.chartRange);
  if (savedChartRange === "all" || savedChartRange === "6" || savedChartRange === "12") {
    state.chartRange = savedChartRange === "all" ? "all" : Number(savedChartRange);
  }
  bindEvents();
  const time = await loadBeijingTime();
  state.currentBeijingDate = Number.isNaN(time.date.getTime()) ? new Date() : time.date;
  state.selectedMonth = formatMonthValue(state.currentBeijingDate);
  updateCurrentTimeLabel(time.source);
  renderMonth();
  renderHistory([]);

  if (getPassword()) {
    try {
      await loadHistory();
    } catch (error) {
      state.historyConnected = false;
      updateTotals();
      setStatus(error.message || "历史记录连接失败", "warn");
    }
  }
}

init();
