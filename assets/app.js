const RATES = {
  baseSalary: 3500,
  lesson: 150,
  student: 11,
};

const API = {
  time: "api/time.php",
  history: "api/history.php",
  worldTime: "https://worldtimeapi.org/api/timezone/Asia/Shanghai",
};

const STORAGE_KEYS = {
  password: "wage-calculator-password",
  remember: "wage-calculator-remember-password",
};

const state = {
  currentBeijingDate: null,
  selectedMonth: "",
  historyRecords: [],
};

const el = {
  currentTime: document.querySelector("#currentTime"),
  monthPicker: document.querySelector("#monthPicker"),
  monthLabel: document.querySelector("#monthLabel"),
  totalSalary: document.querySelector("#totalSalary"),
  trainingTotal: document.querySelector("#trainingTotal"),
  lessonTotal: document.querySelector("#lessonTotal"),
  studentTotal: document.querySelector("#studentTotal"),
  studentCountText: document.querySelector("#studentCountText"),
  baseSalaryDisplay: document.querySelector("#baseSalaryDisplay"),
  lessonCount: document.querySelector("#lessonCount"),
  weekFields: document.querySelector("#weekFields"),
  miniCalendar: document.querySelector("#miniCalendar"),
  accessPassword: document.querySelector("#accessPassword"),
  rememberPassword: document.querySelector("#rememberPassword"),
  connectHistory: document.querySelector("#connectHistory"),
  saveRecord: document.querySelector("#saveRecord"),
  resetForm: document.querySelector("#resetForm"),
  historyStatus: document.querySelector("#historyStatus"),
  historyChart: document.querySelector("#historyChart"),
  historyList: document.querySelector("#historyList"),
};

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
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

function formatMoney(value) {
  return moneyFormatter.format(value || 0);
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function monthParts(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
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
          <small>每个学生 ¥${RATES.student}</small>
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

function getFormValues() {
  return {
    month: state.selectedMonth,
    baseSalary: RATES.baseSalary,
    lessonCount: toInt(el.lessonCount.value),
    studentsByWeek: getStudentInputs().map((input) => toInt(input.value)),
  };
}

function calculateTotals(values = getFormValues()) {
  const totalStudents = values.studentsByWeek.reduce((sum, count) => sum + count, 0);
  const trainingTotal = RATES.baseSalary;
  const lessonTotal = values.lessonCount * RATES.lesson;
  const studentTotal = totalStudents * RATES.student;
  return {
    totalStudents,
    trainingTotal,
    lessonTotal,
    studentTotal,
    totalSalary: trainingTotal + lessonTotal + studentTotal,
  };
}

function updateTotals() {
  const totals = calculateTotals();
  el.baseSalaryDisplay.textContent = formatMoney(RATES.baseSalary);
  el.totalSalary.textContent = formatMoney(totals.totalSalary);
  el.trainingTotal.textContent = formatMoney(totals.trainingTotal);
  el.lessonTotal.textContent = formatMoney(totals.lessonTotal);
  el.studentTotal.textContent = formatMoney(totals.studentTotal);
  el.studentCountText.textContent = `共 ${totals.totalStudents} 人`;
}

function normalizeNumberInput(input) {
  const value = toInt(input.value);
  input.value = value > 0 ? String(value) : "";
}

function setStatus(message, kind = "") {
  el.historyStatus.textContent = message;
  el.historyStatus.classList.toggle("is-good", kind === "good");
  el.historyStatus.classList.toggle("is-warn", kind === "warn");
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
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function loadBeijingTime() {
  try {
    const data = await fetchJson(API.time);
    return {
      date: new Date(data.datetime),
      source: "WorldTimeAPI",
    };
  } catch (serverError) {
    try {
      const data = await fetchJson(API.worldTime);
      return {
        date: new Date(data.datetime),
        source: "WorldTimeAPI",
      };
    } catch (directError) {
      return {
        date: new Date(),
        source: "本机时间备用",
      };
    }
  }
}

function updateCurrentTimeLabel(source) {
  el.currentTime.textContent = `${dateTimeFormatter.format(state.currentBeijingDate)} · ${source}`;
}

function renderMonth() {
  el.monthPicker.value = state.selectedMonth;
  el.monthLabel.textContent = formatMonthLabel(state.selectedMonth);
  renderWeekInputs();
  renderCalendar();
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
    rates: RATES,
    totals,
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
  updateTotals();
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
  if (!password) {
    throw new Error("请先输入访问密码");
  }

  const options = {
    method,
    headers: {
      "X-App-Password": password,
    },
  };

  if (payload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  return fetchJson(`${API.history}${query}`, options);
}

function getRecordMetrics(record) {
  if (record.totals) {
    return {
      totalStudents:
        record.totals.totalStudents ??
        (record.studentsByWeek || []).reduce((sum, count) => sum + toInt(count), 0),
      trainingTotal: record.totals.trainingTotal || 0,
      lessonTotal: record.totals.lessonTotal || 0,
      studentTotal: record.totals.studentTotal || 0,
      totalSalary: record.totals.totalSalary || 0,
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
      : RATES.baseSalary;
  const lessonRate = Number.isFinite(Number(savedRates.lesson)) ? Number(savedRates.lesson) : RATES.lesson;
  const studentRate = Number.isFinite(Number(savedRates.student)) ? Number(savedRates.student) : RATES.student;
  const lessonTotal = toInt(record.lessonCount) * lessonRate;
  const studentTotal = totalStudents * studentRate;
  const totalSalary = trainingTotal + lessonTotal + studentTotal;

  return {
    totalStudents,
    trainingTotal,
    lessonTotal,
    studentTotal,
    totalSalary,
  };
}

function sortRecordsByMonth(records) {
  return [...records].sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

function formatShortMonth(monthValue) {
  const { year, month } = monthParts(monthValue);
  return month === 1 ? `${year}年1月` : `${month}月`;
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

  const chartRecords = sortRecordsByMonth(records).slice(-12);
  const values = chartRecords.map((record) => getRecordMetrics(record).totalSalary);
  const latestRecord = chartRecords[chartRecords.length - 1];
  const latestTotal = values[values.length - 1] || 0;
  const highestTotal = Math.max(...values, 0);
  const highestIndex = values.indexOf(highestTotal);
  const latestIndex = values.length - 1;
  const averageTotal = values.reduce((sum, value) => sum + value, 0) / values.length || 0;
  const maxValue = Math.max(highestTotal, 1);
  const width = 960;
  const height = 340;
  const top = 34;
  const right = 36;
  const bottom = 68;
  const left = 64;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const chartBottom = height - bottom;
  const xStep = chartRecords.length > 1 ? chartWidth / (chartRecords.length - 1) : 0;
  const yFor = (value) => chartBottom - (value / maxValue) * chartHeight;

  const points = chartRecords.map((record, index) => {
    const x = chartRecords.length === 1 ? left + chartWidth / 2 : left + index * xStep;
    const y = yFor(getRecordMetrics(record).totalSalary);
    return { x, y, record };
  });

  const linePath =
    points.length === 1
      ? `M ${points[0].x - 18} ${points[0].y} L ${points[0].x + 18} ${points[0].y}`
      : points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`;
  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = chartBottom - ratio * chartHeight;
      const label = formatMoney(maxValue * ratio);
      return `
        <g>
          <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="chart-grid-line"></line>
          <text x="${left - 12}" y="${y + 4}" class="chart-axis-label" text-anchor="end">${label}</text>
        </g>
      `;
    })
    .join("");
  const dots = points
    .map((point, index) => {
      const total = getRecordMetrics(point.record).totalSalary;
      const showValue = index === latestIndex || index === highestIndex || points.length === 1;
      return `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="5" class="chart-dot"></circle>
          ${
            showValue
              ? `<text x="${point.x}" y="${point.y - 12}" class="chart-value" text-anchor="middle">${formatMoney(total)}</text>`
              : ""
          }
          <text x="${point.x}" y="${chartBottom + 28}" class="chart-axis-label" text-anchor="middle">${formatShortMonth(point.record.month)}</text>
        </g>
      `;
    })
    .join("");

  el.historyChart.innerHTML = `
    <section class="chart-panel" aria-label="每月工资走势">
      <div class="chart-head">
        <div>
          <p class="eyebrow">工资走势</p>
          <h3>每月总工资折线图</h3>
        </div>
        <div class="chart-stats" aria-label="工资统计摘要">
          <span><small>最新</small><b>${formatMoney(latestTotal)}</b></span>
          <span><small>最高</small><b>${formatMoney(highestTotal)}</b></span>
          <span><small>平均</small><b>${formatMoney(averageTotal)}</b></span>
        </div>
      </div>
      <div class="chart-canvas">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${formatMonthLabel(latestRecord.month)}工资${formatMoney(latestTotal)}">
          <defs>
            <linearGradient id="salaryArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#147a72" stop-opacity="0.26"></stop>
              <stop offset="100%" stop-color="#147a72" stop-opacity="0.02"></stop>
            </linearGradient>
          </defs>
          ${gridLines}
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

  const rows = records
    .map((record) => {
      const totals = getRecordMetrics(record);
      const updated = record.updatedAt ? new Date(record.updatedAt) : null;
      const updatedText = updated ? dateTimeFormatter.format(updated) : "未记录";
      return `
        <tr>
          <td class="history-month">${formatMonthLabel(record.month)}</td>
          <td class="history-money">${formatMoney(totals.totalSalary || 0)}</td>
          <td>${formatMoney(totals.trainingTotal || 0)}</td>
          <td>${formatMoney(totals.lessonTotal || 0)}</td>
          <td>${formatMoney(totals.studentTotal || 0)}</td>
          <td>${totals.totalStudents} 人</td>
          <td>${updatedText}</td>
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
            <th scope="col">总工资</th>
            <th scope="col">底薪/培训费</th>
            <th scope="col">课时费</th>
            <th scope="col">学生费</th>
            <th scope="col">学生数</th>
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

async function loadHistory() {
  const data = await historyRequest("GET");
  state.historyRecords = data.records || [];
  renderHistory(state.historyRecords);
  persistPasswordPreference();
  setStatus("历史记录已连接。", "good");
}

async function saveCurrentRecord() {
  const record = buildRecord();
  const data = await historyRequest("POST", record);
  state.historyRecords = data.records || [];
  renderHistory(state.historyRecords);
  persistPasswordPreference();
  setStatus(`${formatMonthLabel(record.month)} 已保存。`, "good");
}

async function deleteRecord(month) {
  const data = await historyRequest("DELETE", null, `?month=${encodeURIComponent(month)}`);
  state.historyRecords = data.records || [];
  renderHistory(state.historyRecords);
  setStatus(`${formatMonthLabel(month)} 已删除。`, "good");
}

function resetForm() {
  el.lessonCount.value = "";
  getStudentInputs().forEach((input) => {
    input.value = "";
  });
  updateTotals();
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    if (event.target.matches(".money-input")) {
      updateTotals();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches(".money-input")) {
      normalizeNumberInput(event.target);
      updateTotals();
    }
  });

  el.monthPicker.addEventListener("change", () => {
    setMonth(el.monthPicker.value);
    resetForm();
  });

  el.connectHistory.addEventListener("click", async () => {
    setStatus("正在连接历史记录...");
    try {
      await loadHistory();
    } catch (error) {
      setStatus(error.message || "历史记录连接失败", "warn");
    }
  });

  el.saveRecord.addEventListener("click", async () => {
    setStatus("正在保存...");
    try {
      await saveCurrentRecord();
    } catch (error) {
      setStatus(error.message || "保存失败", "warn");
    }
  });

  el.resetForm.addEventListener("click", () => {
    resetForm();
    setStatus("已清空当前输入。");
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
        setStatus(`${formatMonthLabel(month)} 已载入。`, "good");
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
  restorePasswordPreference();
  bindEvents();
  const time = await loadBeijingTime();
  state.currentBeijingDate = time.date;
  state.selectedMonth = formatMonthValue(time.date);
  updateCurrentTimeLabel(time.source);
  renderMonth();

  if (getPassword()) {
    try {
      await loadHistory();
    } catch (error) {
      setStatus(error.message || "历史记录连接失败", "warn");
    }
  }
}

init();
