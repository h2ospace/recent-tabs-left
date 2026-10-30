import {
  DEFAULT_DWELL_SECONDS,
  DEFAULT_ENABLED,
  DEFAULT_FOCUS_EXISTING,
  MAX_DWELL_SECONDS,
  normalizeDwellSeconds,
  normalizeEnabled,
  normalizeFocusExisting,
} from "./settings.js";

const form = document.querySelector("#settings");
const input = document.querySelector("#dwell-seconds");
const enabledInput = document.querySelector("#enabled");
const enabledState = document.querySelector("#enabled-state");
const focusInput = document.querySelector("#focus-existing");
const focusHint = document.querySelector("#focus-hint");
const dwell = document.querySelector("#dwell");
const dwellUp = document.querySelector("#dwell-up");
const dwellDown = document.querySelector("#dwell-down");
const status = document.querySelector("#status");

const FOCUS_ON = "既に開いているURLの場合は、新しいタブを作らずそのタブを表示します。";
const FOCUS_OFF = "オフのあいだは、同じURLでも別のタブで開きます。";

input.max = String(MAX_DWELL_SECONDS);

function readInput() {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 0 || value > MAX_DWELL_SECONDS) return null;
  return value;
}

function renderEnabled() {
  const enabled = enabledInput.checked;
  enabledState.textContent = enabled ? "有効" : "無効";
  enabledState.classList.toggle("is-off", !enabled);
  dwell.classList.toggle("is-off", !enabled);
}

function renderFocusExisting() {
  focusHint.textContent = focusInput.checked ? FOCUS_ON : FOCUS_OFF;
}

function invalidMessage() {
  return `0から${MAX_DWELL_SECONDS}の整数を入力してください。`;
}

let savedDwell = null;
let dwellCommitTimer = 0;

function showStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function renderStepper() {
  const value = readInput();
  dwellUp.disabled = value != null && value >= MAX_DWELL_SECONDS;
  dwellDown.disabled = value != null && value <= 0;
}

async function commitDwell() {
  const value = readInput();
  if (value == null) {
    showStatus(invalidMessage(), true);
    renderStepper();
    return;
  }
  input.value = String(value);
  renderStepper();
  if (value === savedDwell) return;
  try {
    await chrome.storage.sync.set({ dwellSeconds: value });
    savedDwell = value;
    showStatus("保存しました", false);
  } catch {
    showStatus("保存できませんでした。", true);
  }
}

function stepDwell(delta) {
  const current = readInput() ?? 0;
  const next = Math.min(MAX_DWELL_SECONDS, Math.max(0, current + delta));
  input.value = String(next);
  commitDwell();
}

async function load() {
  try {
    const stored = await chrome.storage.sync.get({
      dwellSeconds: DEFAULT_DWELL_SECONDS,
      enabled: DEFAULT_ENABLED,
      focusExisting: DEFAULT_FOCUS_EXISTING,
    });
    enabledInput.checked = normalizeEnabled(stored.enabled);
    focusInput.checked = normalizeFocusExisting(stored.focusExisting);
    savedDwell = normalizeDwellSeconds(stored.dwellSeconds);
    input.value = String(savedDwell);
  } catch {
    enabledInput.checked = DEFAULT_ENABLED;
    focusInput.checked = DEFAULT_FOCUS_EXISTING;
    savedDwell = DEFAULT_DWELL_SECONDS;
    input.value = String(DEFAULT_DWELL_SECONDS);
  }
  renderEnabled();
  renderFocusExisting();
  renderStepper();
}

input.addEventListener("input", () => {
  showStatus("", false);
  renderStepper();
});

input.addEventListener("blur", () => {
  window.clearTimeout(dwellCommitTimer);
  dwellCommitTimer = window.setTimeout(() => {
    commitDwell();
  }, 0);
});

function commitStep(delta) {
  window.clearTimeout(dwellCommitTimer);
  stepDwell(delta);
}

dwellUp.addEventListener("click", () => {
  commitStep(1);
});

dwellDown.addEventListener("click", () => {
  commitStep(-1);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  commitDwell();
});

enabledInput.addEventListener("change", async () => {
  const enabled = enabledInput.checked;
  renderEnabled();
  try {
    await chrome.storage.sync.set({ enabled });
    showStatus("保存しました", false);
  } catch {
    enabledInput.checked = !enabled;
    renderEnabled();
    showStatus("保存できませんでした。", true);
  }
});

focusInput.addEventListener("change", async () => {
  const focusExisting = focusInput.checked;
  renderFocusExisting();
  try {
    await chrome.storage.sync.set({ focusExisting });
    showStatus("保存しました", false);
  } catch {
    focusInput.checked = !focusExisting;
    renderFocusExisting();
    showStatus("保存できませんでした。", true);
  }
});

renderEnabled();
renderFocusExisting();
load();
