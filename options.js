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
const focusState = document.querySelector("#focus-existing-state");
const focusHint = document.querySelector("#focus-hint");
const seconds = document.querySelector("#seconds");
const preview = document.querySelector("#preview");
const status = document.querySelector("#status");
const submitButton = form.querySelector("button[type='submit']");

input.max = String(MAX_DWELL_SECONDS);

function describeDwell(value) {
  if (!enabledInput.checked) return "オフのあいだは、タブを移動しません。";
  if (value == null) {
    return `0から${MAX_DWELL_SECONDS}の整数を入力してください。`;
  }
  if (value === 0) {
    return "切り替えた瞬間に、固定タブのすぐ右へ移動します。";
  }
  return `${value}秒見続けると、固定タブのすぐ右へ移動します。`;
}

function readInput() {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 0 || value > MAX_DWELL_SECONDS) return null;
  return value;
}

function renderPreview() {
  preview.textContent = describeDwell(readInput());
}

function renderEnabled() {
  const enabled = enabledInput.checked;
  enabledState.textContent = enabled ? "オン" : "オフ";
  seconds.classList.toggle("is-off", !enabled);
  renderPreview();
}

function renderFocusExisting() {
  const enabled = focusInput.checked;
  focusState.textContent = enabled ? "オン" : "オフ";
  focusHint.textContent = enabled
    ? "アドレスバーやブックマークで開いたURLが既にあれば、そのタブに移ります。"
    : "オフのあいだは、同じURLでも別のタブで開きます。";
}

function applySeconds(value) {
  input.value = String(normalizeDwellSeconds(value));
  renderPreview();
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
    applySeconds(stored.dwellSeconds);
    renderEnabled();
    renderFocusExisting();
  } catch {
    enabledInput.checked = DEFAULT_ENABLED;
    focusInput.checked = DEFAULT_FOCUS_EXISTING;
    applySeconds(DEFAULT_DWELL_SECONDS);
    renderEnabled();
    renderFocusExisting();
  }
}

input.addEventListener("input", () => {
  status.textContent = "";
  renderPreview();
});

enabledInput.addEventListener("change", async () => {
  const enabled = enabledInput.checked;
  renderEnabled();
  status.textContent = "";
  try {
    await chrome.storage.sync.set({ enabled });
    status.textContent = enabled ? "オンにしました。" : "オフにしました。";
  } catch {
    enabledInput.checked = !enabled;
    renderEnabled();
    status.textContent = "保存できませんでした。";
  }
});

focusInput.addEventListener("change", async () => {
  const focusExisting = focusInput.checked;
  renderFocusExisting();
  status.textContent = "";
  try {
    await chrome.storage.sync.set({ focusExisting });
    status.textContent = focusExisting
      ? "同じURLは、開いているタブに移ります。"
      : "同じURLでも、別のタブで開きます。";
  } catch {
    focusInput.checked = !focusExisting;
    renderFocusExisting();
    status.textContent = "保存できませんでした。";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  if (!form.reportValidity()) return;

  const dwellSeconds = normalizeDwellSeconds(input.value);
  const enabled = enabledInput.checked;
  const focusExisting = focusInput.checked;
  submitButton.disabled = true;
  try {
    await chrome.storage.sync.set({ dwellSeconds, enabled, focusExisting });
    applySeconds(dwellSeconds);
    renderEnabled();
    renderFocusExisting();
    status.textContent = "保存しました。";
  } catch {
    status.textContent = "保存できませんでした。";
  } finally {
    submitButton.disabled = false;
  }
});

renderEnabled();
renderFocusExisting();
load();
