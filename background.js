import { DEFAULT_DWELL_SECONDS, normalizeDwellSeconds } from "./settings.js";

const KEEPALIVE_SLICE_MS = 20_000;
const inFlight = new Set();
const watchTokens = new Map();
const commitChains = new Map();

// アクティブのまま設定秒数が過ぎたタブを、固定タブのすぐ右へ移動する
chrome.tabs.onActivated.addListener((info) => {
  return watchTab(info.tabId, info.windowId);
});

chrome.runtime.onInstalled.addListener(() => armActiveTabs());
chrome.runtime.onStartup.addListener(() => armActiveTabs());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("dwell:")) return;
  const windowId = Number(alarm.name.slice("dwell:".length));
  if (!Number.isInteger(windowId)) return;
  return resumeWindow(windowId);
});

function beginWatch(windowId) {
  const token = (watchTokens.get(windowId) ?? 0) + 1;
  watchTokens.set(windowId, token);
  return token;
}

function isCurrentWatch(windowId, token) {
  return watchTokens.get(windowId) === token;
}

function alarmName(windowId) {
  return `dwell:${windowId}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function commit(windowId, task) {
  const previous = commitChains.get(windowId) ?? Promise.resolve();
  const run = previous.then(task, task);
  commitChains.set(
    windowId,
    run.then(
      () => {},
      () => {},
    ),
  );
  return run;
}

async function getDwellSeconds() {
  const stored = await chrome.storage.sync.get({
    dwellSeconds: DEFAULT_DWELL_SECONDS,
  });
  return normalizeDwellSeconds(stored.dwellSeconds);
}

async function readPending() {
  const stored = await chrome.storage.session.get("pendingMoves");
  const pendingMoves = stored.pendingMoves;
  return pendingMoves && typeof pendingMoves === "object" ? pendingMoves : {};
}

async function writePending(pendingMoves) {
  await chrome.storage.session.set({ pendingMoves });
}

async function clearPending(windowId) {
  const key = String(windowId);
  const pendingMoves = await readPending();
  delete pendingMoves[key];
  await writePending(pendingMoves);
  await chrome.alarms.clear(alarmName(windowId));
}

async function waitWithKeepalive(ms, isCancelled) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (isCancelled()) return false;
    await sleep(Math.min(KEEPALIVE_SLICE_MS, end - Date.now()));
    if (isCancelled()) return false;
    if (Date.now() < end) {
      await chrome.runtime.getPlatformInfo();
    }
  }
  return !isCancelled();
}

async function watchTab(tabId, windowId, remainingMs) {
  const token = beginWatch(windowId);
  inFlight.add(windowId);

  try {
    let tab = null;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      tab = null;
    }
    if (!isCurrentWatch(windowId, token)) return;

    if (!tab || tab.pinned) {
      await commit(windowId, async () => {
        if (!isCurrentWatch(windowId, token)) return;
        await clearPending(windowId);
      });
      return;
    }

    let waitMs = remainingMs;
    if (waitMs == null) {
      waitMs = (await getDwellSeconds()) * 1000;
      if (!isCurrentWatch(windowId, token)) return;
    }
    waitMs = Math.max(0, waitMs);
    const dueAt = Date.now() + waitMs;

    const committed = await commit(windowId, async () => {
      if (!isCurrentWatch(windowId, token)) return false;
      const pendingMoves = await readPending();
      if (!isCurrentWatch(windowId, token)) return false;
      pendingMoves[String(windowId)] = { tabId, dueAt };
      await writePending(pendingMoves);
      if (!isCurrentWatch(windowId, token)) return false;
      if (waitMs > 0) {
        await chrome.alarms.create(alarmName(windowId), {
          delayInMinutes: waitMs / 60_000,
        });
      } else {
        await chrome.alarms.clear(alarmName(windowId));
      }
      return isCurrentWatch(windowId, token);
    });
    if (!committed) return;

    if (waitMs > 0) {
      const finished = await waitWithKeepalive(
        Math.max(0, dueAt - Date.now()),
        () => !isCurrentWatch(windowId, token),
      );
      if (!finished) return;
    }

    await finishWatch(tabId, windowId, token);
  } catch (error) {
    console.error(error);
  } finally {
    if (isCurrentWatch(windowId, token)) inFlight.delete(windowId);
  }
}

async function finishWatch(tabId, windowId, token) {
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!isCurrentWatch(windowId, token)) return;

  if (!active || active.id !== tabId) {
    await commit(windowId, async () => {
      if (!isCurrentWatch(windowId, token)) return;
      await clearPending(windowId);
    });
    return;
  }

  await moveLeft(tabId, windowId, token);
  await commit(windowId, async () => {
    if (!isCurrentWatch(windowId, token)) return;
    await clearPending(windowId);
  });
}

async function moveLeft(tabId, windowId, token, retry = 0) {
  if (!isCurrentWatch(windowId, token)) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned) return;
    const pinned = await chrome.tabs.query({ windowId, pinned: true });
    if (tab.index === pinned.length) return;
    await chrome.tabs.move(tabId, { index: pinned.length });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (/No tab with id/i.test(message)) return;
    if (retry >= 10 || !isCurrentWatch(windowId, token)) return;
    await sleep(150);
    return moveLeft(tabId, windowId, token, retry + 1);
  }
}

async function resumeWindow(windowId) {
  if (inFlight.has(windowId)) return;
  const pending = (await readPending())[String(windowId)];
  if (!pending || pending.tabId == null || !Number.isFinite(pending.dueAt)) return;
  const remaining = Math.max(0, pending.dueAt - Date.now());
  return watchTab(pending.tabId, windowId, remaining);
}

async function armActiveTabs() {
  const pendingMoves = await readPending();
  const tabs = await chrome.tabs.query({ active: true });
  await Promise.all(
    tabs.map((tab) => {
      if (tab.id == null) return undefined;
      const pending = pendingMoves[String(tab.windowId)];
      if (pending && pending.tabId === tab.id && Number.isFinite(pending.dueAt)) {
        return watchTab(tab.id, tab.windowId, Math.max(0, pending.dueAt - Date.now()));
      }
      return watchTab(tab.id, tab.windowId);
    }),
  );
}
