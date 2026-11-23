import {
  DEFAULT_DWELL_SECONDS,
  DEFAULT_ENABLED,
  DEFAULT_FOCUS_EXISTING,
  DEFAULT_LEFT_INDEX,
  DEFAULT_MAX_TABS,
  MAX_DWELL_SECONDS,
  MAX_LEFT_INDEX,
  MAX_MAX_TABS,
  MIN_LEFT_INDEX,
  MIN_MAX_TABS,
  normalizeDwellSeconds,
  normalizeEnabled,
  normalizeFocusExisting,
  normalizeLeftIndex,
  normalizeMaxTabs,
} from "./settings.js";

const form = document.querySelector("#settings");
const input = document.querySelector("#dwell-seconds");
const dwellUp = document.querySelector("#dwell-up");
const dwellDown = document.querySelector("#dwell-down");
const leftInput = document.querySelector("#left-index");
const leftUp = document.querySelector("#left-up");
const leftDown = document.querySelector("#left-down");
const maxInput = document.querySelector("#max-tabs-count");
const maxUp = document.querySelector("#max-up");
const maxDown = document.querySelector("#max-down");
const enableButton = document.querySelector("#enabled");
const card = document.querySelector("#behavior");
const focusInput = document.querySelector("#focus-existing");
const focusHint = document.querySelector("#focus-hint");
const status = document.querySelector("#status");

const FOCUS_ON = "既に開いているURLの場合は、新しいタブを作らずそのタブを表示します";
const FOCUS_OFF = "オフのあいだは、同じURLでも別のタブで開きます。";

input.max = String(MAX_DWELL_SECONDS);
leftInput.min = String(MIN_LEFT_INDEX);
leftInput.max = String(MAX_LEFT_INDEX);
maxInput.min = String(MIN_MAX_TABS);
maxInput.max = String(MAX_MAX_TABS);

function readInteger(field, min, max) {
  if (field.value.trim() === "") return null;
  const value = Number(field.value);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function readInput() {
  return readInteger(input, 0, MAX_DWELL_SECONDS);
}

function readLeftIndex() {
  return readInteger(leftInput, MIN_LEFT_INDEX, MAX_LEFT_INDEX);
}

function readMaxTabs() {
  return readInteger(maxInput, MIN_MAX_TABS, MAX_MAX_TABS);
}

let enabledOn = true;
let savedFocusExisting = DEFAULT_FOCUS_EXISTING;

function renderEnabled() {
  enableButton.setAttribute("aria-pressed", String(enabledOn));
  enableButton.textContent = enabledOn ? "無効にする" : "有効にする";
  card.classList.toggle("is-off", !enabledOn);
  input.disabled = !enabledOn;
  leftInput.disabled = !enabledOn;
  maxInput.disabled = !enabledOn;
  focusInput.disabled = !enabledOn;
  focusInput.checked = enabledOn && savedFocusExisting;
  renderFocusExisting();
  renderSteppers();
}

function renderSteppers() {
  const dwell = readInput();
  dwellUp.disabled = !enabledOn || (dwell != null && dwell >= MAX_DWELL_SECONDS);
  dwellDown.disabled = !enabledOn || (dwell != null && dwell <= 0);
  const left = readLeftIndex();
  leftUp.disabled = !enabledOn || (left != null && left >= MAX_LEFT_INDEX);
  leftDown.disabled = !enabledOn || (left != null && left <= MIN_LEFT_INDEX);
  const max = readMaxTabs();
  maxUp.disabled = !enabledOn || (max != null && max >= MAX_MAX_TABS);
  maxDown.disabled = !enabledOn || (max != null && max <= MIN_MAX_TABS);
}

function stepField(field, min, max, fallback, delta, commit) {
  const current = readInteger(field, min, max) ?? fallback;
  field.value = String(Math.min(max, Math.max(min, current + delta)));
  renderSteppers();
  commit();
}

function renderFocusExisting() {
  focusHint.textContent = focusInput.checked ? FOCUS_ON : FOCUS_OFF;
}

function showStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

let savedDwell = null;

async function commitDwell() {
  const value = readInput();
  if (value == null) {
    showStatus(`0から${MAX_DWELL_SECONDS}の整数を入力してください。`, true);
    return false;
  }
  input.value = String(value);
  if (value === savedDwell) return true;
  try {
    await chrome.storage.sync.set({ dwellSeconds: value });
    savedDwell = value;
    showStatus("保存しました", false);
    return true;
  } catch {
    showStatus("保存できませんでした。", true);
    return false;
  }
}

let savedMaxTabs = null;

async function commitMaxTabs() {
  const value = readMaxTabs();
  if (value == null) {
    showStatus(`${MIN_MAX_TABS}から${MAX_MAX_TABS}の整数を入力してください。`, true);
    return false;
  }
  maxInput.value = String(value);
  if (value === savedMaxTabs) return true;
  try {
    await chrome.storage.sync.set({ maxTabs: value });
    savedMaxTabs = value;
    showStatus("保存しました", false);
    return true;
  } catch {
    showStatus("保存できませんでした。", true);
    return false;
  }
}

let savedLeftIndex = null;

async function commitLeftIndex() {
  const value = readLeftIndex();
  if (value == null) {
    showStatus(`${MIN_LEFT_INDEX}から${MAX_LEFT_INDEX}の整数を入力してください。`, true);
    return false;
  }
  leftInput.value = String(value);
  if (value === savedLeftIndex) return true;
  try {
    await chrome.storage.sync.set({ leftIndex: value });
    savedLeftIndex = value;
    showStatus("保存しました", false);
    return true;
  } catch {
    showStatus("保存できませんでした。", true);
    return false;
  }
}

async function load() {
  try {
    const stored = await chrome.storage.sync.get({
      dwellSeconds: DEFAULT_DWELL_SECONDS,
      enabled: DEFAULT_ENABLED,
      focusExisting: DEFAULT_FOCUS_EXISTING,
      leftIndex: DEFAULT_LEFT_INDEX,
      maxTabs: DEFAULT_MAX_TABS,
    });
    enabledOn = normalizeEnabled(stored.enabled);
    savedFocusExisting = normalizeFocusExisting(stored.focusExisting);
    savedDwell = normalizeDwellSeconds(stored.dwellSeconds);
    input.value = String(savedDwell);
    savedLeftIndex = normalizeLeftIndex(stored.leftIndex);
    leftInput.value = String(savedLeftIndex);
    savedMaxTabs = normalizeMaxTabs(stored.maxTabs);
    maxInput.value = String(savedMaxTabs);
  } catch {
    enabledOn = DEFAULT_ENABLED;
    savedFocusExisting = DEFAULT_FOCUS_EXISTING;
    savedDwell = DEFAULT_DWELL_SECONDS;
    input.value = String(DEFAULT_DWELL_SECONDS);
    savedLeftIndex = DEFAULT_LEFT_INDEX;
    leftInput.value = String(DEFAULT_LEFT_INDEX);
    savedMaxTabs = DEFAULT_MAX_TABS;
    maxInput.value = String(DEFAULT_MAX_TABS);
  }
  renderEnabled();
  renderFocusExisting();
}

input.addEventListener("input", () => {
  showStatus("", false);
  renderSteppers();
});

input.addEventListener("blur", () => {
  commitDwell();
});

leftInput.addEventListener("input", () => {
  showStatus("", false);
  renderSteppers();
});

leftInput.addEventListener("blur", () => {
  commitLeftIndex();
});

maxInput.addEventListener("input", () => {
  showStatus("", false);
  renderSteppers();
});

function keepFieldFocus(button) {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
}

for (const button of [dwellUp, dwellDown, leftUp, leftDown, maxUp, maxDown]) {
  keepFieldFocus(button);
}

dwellUp.addEventListener("click", () => {
  stepField(input, 0, MAX_DWELL_SECONDS, 0, 1, commitDwell);
});

dwellDown.addEventListener("click", () => {
  stepField(input, 0, MAX_DWELL_SECONDS, 0, -1, commitDwell);
});

leftUp.addEventListener("click", () => {
  stepField(leftInput, MIN_LEFT_INDEX, MAX_LEFT_INDEX, MIN_LEFT_INDEX, 1, commitLeftIndex);
});

leftDown.addEventListener("click", () => {
  stepField(leftInput, MIN_LEFT_INDEX, MAX_LEFT_INDEX, MIN_LEFT_INDEX, -1, commitLeftIndex);
});

maxUp.addEventListener("click", () => {
  stepField(maxInput, MIN_MAX_TABS, MAX_MAX_TABS, DEFAULT_MAX_TABS, 1, commitMaxTabs);
});

maxDown.addEventListener("click", () => {
  stepField(maxInput, MIN_MAX_TABS, MAX_MAX_TABS, DEFAULT_MAX_TABS, -1, commitMaxTabs);
});

maxInput.addEventListener("blur", () => {
  commitMaxTabs();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (readInput() == null) {
    commitDwell();
    return;
  }
  if (readLeftIndex() == null) {
    commitLeftIndex();
    return;
  }
  if (readMaxTabs() == null) {
    commitMaxTabs();
    return;
  }
  commitDwell();
  commitLeftIndex();
  commitMaxTabs();
});

enableButton.addEventListener("click", async () => {
  const enabled = !enabledOn;
  enabledOn = enabled;
  renderEnabled();
  try {
    await chrome.storage.sync.set({ enabled });
    showStatus("保存しました", false);
  } catch {
    enabledOn = !enabled;
    renderEnabled();
    showStatus("保存できませんでした。", true);
  }
});

focusInput.addEventListener("change", async () => {
  if (!enabledOn) return;
  const focusExisting = focusInput.checked;
  savedFocusExisting = focusExisting;
  renderFocusExisting();
  try {
    await chrome.storage.sync.set({ focusExisting });
    showStatus("保存しました", false);
  } catch {
    savedFocusExisting = !focusExisting;
    renderEnabled();
    showStatus("保存できませんでした。", true);
  }
});

chrome.storage?.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  let refresh = false;
  if (Object.prototype.hasOwnProperty.call(changes, "enabled")) {
    enabledOn = normalizeEnabled(changes.enabled.newValue);
    refresh = true;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "focusExisting")) {
    savedFocusExisting = normalizeFocusExisting(changes.focusExisting.newValue);
    refresh = true;
  }
  if (!refresh) return;
  renderEnabled();
});

renderEnabled();
renderFocusExisting();
load();
