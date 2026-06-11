const RATES = {
  trainingDay: 100,
  lesson: 150,
  student: 15,
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
  trainingDays: document.querySelector("#trainingDays"),
  lessonCount: document.querySelector("#lessonCount"),
  weekFields: document.querySelector("#weekFields"),
  miniCalendar: document.querySelector("#miniCalendar"),
  accessPassword: document.querySelector("#accessPassword"),
  rememberPassword: document.querySelector("#rememberPassword"),
  connectHistory: document.querySelector("#connectHistory"),
  saveRecord: document.querySelector("#saveRecord"),
  resetForm: document.querySelector("#resetForm"),
  historyStatus: document.querySelector("#historyStatus"),
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
    trainingDays: toInt(el.trainingDays.value),
    lessonCount: toInt(el.lessonCount.value),
    studentsByWeek: getStudentInputs().map((input) => toInt(input.value)),
  };
}

function calculateTotals(values = getFormValues()) {
  const totalStudents = values.studentsByWeek.reduce((sum, count) => sum + count, 0);
  const trainingTotal = values.trainingDays * RATES.trainingDay;
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
  el.trainingDays.value = record.trainingDays || "";
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

function renderHistoryList(records) {
  if (!records.length) {
    el.historyList.innerHTML = '<p class="status-text">还没有保存过月份。</p>';
    return;
  }

  el.historyList.innerHTML = records
    .map((record) => {
      const total = record.totals?.totalSalary || 0;
      const updated = record.updatedAt ? new Date(record.updatedAt) : null;
      const updatedText = updated ? dateTimeFormatter.format(updated) : "未记录更新时间";
      return `
        <article class="history-item">
          <div>
            <strong>${formatMonthLabel(record.month)} · ${formatMoney(total)}</strong>
            <span>${updatedText}</span>
          </div>
          <div class="history-actions">
            <button type="button" data-action="load" data-month="${record.month}">载入</button>
            <button type="button" data-action="delete" data-month="${record.month}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadHistory() {
  const data = await historyRequest("GET");
  state.historyRecords = data.records || [];
  renderHistoryList(state.historyRecords);
  persistPasswordPreference();
  setStatus("历史记录已连接。", "good");
}

async function saveCurrentRecord() {
  const record = buildRecord();
  const data = await historyRequest("POST", record);
  state.historyRecords = data.records || [];
  renderHistoryList(state.historyRecords);
  persistPasswordPreference();
  setStatus(`${formatMonthLabel(record.month)} 已保存。`, "good");
}

async function deleteRecord(month) {
  const data = await historyRequest("DELETE", null, `?month=${encodeURIComponent(month)}`);
  state.historyRecords = data.records || [];
  renderHistoryList(state.historyRecords);
  setStatus(`${formatMonthLabel(month)} 已删除。`, "good");
}

function resetForm() {
  el.trainingDays.value = "";
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
