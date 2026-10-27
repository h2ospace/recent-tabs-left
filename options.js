import { DEFAULT_DWELL_SECONDS, MAX_DWELL_SECONDS, normalizeDwellSeconds } from "./settings.js";

const form = document.querySelector("#settings");
const input = document.querySelector("#dwell-seconds");
const preview = document.querySelector("#preview");
const status = document.querySelector("#status");
const submitButton = form.querySelector("button[type='submit']");

input.max = String(MAX_DWELL_SECONDS);

function describeDwell(value) {
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

function applySeconds(value) {
  const seconds = normalizeDwellSeconds(value);
  input.value = String(seconds);
  renderPreview();
}

async function load() {
  try {
    const stored = await chrome.storage.sync.get({
      dwellSeconds: DEFAULT_DWELL_SECONDS,
    });
    applySeconds(stored.dwellSeconds);
  } catch {
    applySeconds(DEFAULT_DWELL_SECONDS);
  }
}

input.addEventListener("input", () => {
  status.textContent = "";
  renderPreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  if (!form.reportValidity()) return;

  const dwellSeconds = normalizeDwellSeconds(input.value);
  submitButton.disabled = true;
  try {
    await chrome.storage.sync.set({ dwellSeconds });
    applySeconds(dwellSeconds);
    status.textContent = "保存しました。";
  } catch {
    status.textContent = "保存できませんでした。";
  } finally {
    submitButton.disabled = false;
  }
});

renderPreview();
load();
