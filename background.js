import { createReuseController } from "./reuse-tab.js";
import { pickTabsToClose } from "./tab-limit.js";
import {
  DEFAULT_DWELL_SECONDS,
  DEFAULT_ENABLED,
  DEFAULT_FOCUS_EXISTING,
  DEFAULT_MAX_TABS,
  normalizeDwellSeconds,
  normalizeEnabled,
  normalizeFocusExisting,
  normalizeMaxTabs,
} from "./settings.js";

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

const reuseTabs = createReuseController({
  queryTabs: () => chrome.tabs.query({}),
  focusWindow: (windowId) => chrome.windows.update(windowId, { focused: true }),
  focusTab: (tabId) => chrome.tabs.update(tabId, { active: true }),
  closeTab: (tabId) => chrome.tabs.remove(tabId),
  goBack: (tabId) => chrome.tabs.goBack(tabId),
  isEnabled: async () => {
    const stored = await chrome.storage.sync.get({ focusExisting: DEFAULT_FOCUS_EXISTING });
    return normalizeFocusExisting(stored.focusExisting);
  },
});

chrome.tabs.onCreated.addListener((tab) => {
  reuseTabs.onCreated(tab);
  scheduleTabLimit(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  reuseTabs.onRemoved(tabId);
});

chrome.webNavigation.onCommitted.addListener((details) => reuseTabs.onCommitted(details));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("dwell:")) return;
  const windowId = Number(alarm.name.slice("dwell:".length));
  if (!Number.isInteger(windowId)) return;
  return resumeWindow(windowId);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !Object.prototype.hasOwnProperty.call(changes, "enabled")) return;
  if (normalizeEnabled(changes.enabled.newValue)) return enqueueMode(() => armActiveTabs());
  return enqueueMode(() => disableAll());
});

let modeChain = Promise.resolve();

function enqueueMode(task) {
  const run = modeChain.then(task, task);
  modeChain = run.then(
    () => {},
    () => {},
  );
  return run;
}

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

async function getSettings() {
  const stored = await chrome.storage.sync.get({
    dwellSeconds: DEFAULT_DWELL_SECONDS,
    enabled: DEFAULT_ENABLED,
    maxTabs: DEFAULT_MAX_TABS,
  });
  return {
    dwellSeconds: normalizeDwellSeconds(stored.dwellSeconds),
    enabled: normalizeEnabled(stored.enabled),
    maxTabs: normalizeMaxTabs(stored.maxTabs),
  };
}

const pendingLimits = new Map();
const limitChains = new Map();
const TAB_LIMIT_WAIT_MS = 400;

function enqueueLimit(windowId, task) {
  const previous = limitChains.get(windowId) ?? Promise.resolve();
  const run = previous.then(task, task);
  limitChains.set(
    windowId,
    run.then(
      () => {},
      () => {},
    ),
  );
  return run;
}

function scheduleTabLimit(tab) {
  if (tab.id == null || tab.windowId == null) return;
  let pending = pendingLimits.get(tab.windowId);
  if (!pending) {
    pending = { keepIds: new Set(), timer: 0 };
    pendingLimits.set(tab.windowId, pending);
  }
  pending.keepIds.add(tab.id);
  clearTimeout(pending.timer);
  const windowId = tab.windowId;
  pending.timer = setTimeout(() => {
    const keepIds = new Set(pending.keepIds);
    pendingLimits.delete(windowId);
    return enqueueLimit(windowId, () => enforceTabLimit(windowId, keepIds));
  }, TAB_LIMIT_WAIT_MS);
}

async function enforceTabLimit(windowId, keepIds) {
  const settings = await getSettings();
  if (!settings.enabled) return;
  let tabs;
  try {
    tabs = await chrome.tabs.query({ windowId });
  } catch {
    return;
  }
  const closing = pickTabsToClose(tabs, { maxTabs: settings.maxTabs, keepIds });
  if (closing.length === 0) return;
  try {
    await chrome.tabs.remove(closing);
  } catch {
    // 閉じる直前にタブが無くなっている場合は、そのままでよい
  }
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

    const settings = await getSettings();
    if (!isCurrentWatch(windowId, token)) return;
    if (!tab || tab.pinned || !settings.enabled) {
      await commit(windowId, async () => {
        if (!isCurrentWatch(windowId, token)) return;
        await clearPending(windowId);
      });
      return;
    }

    let waitMs = remainingMs;
    if (waitMs == null) {
      waitMs = settings.dwellSeconds * 1000;
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
  if (!(await getSettings()).enabled) {
    await clearPending(windowId);
    return;
  }
  const pending = (await readPending())[String(windowId)];
  if (!pending || pending.tabId == null || !Number.isFinite(pending.dueAt)) return;
  const remaining = Math.max(0, pending.dueAt - Date.now());
  return watchTab(pending.tabId, windowId, remaining);
}

async function disableAll() {
  const pendingMoves = await readPending();
  const windowIds = new Set([
    ...watchTokens.keys(),
    ...Object.keys(pendingMoves).map((windowId) => Number(windowId)),
  ]);
  const alarms = await chrome.alarms.getAll();
  for (const alarm of alarms) {
    if (!alarm.name.startsWith("dwell:")) continue;
    const windowId = Number(alarm.name.slice("dwell:".length));
    if (Number.isInteger(windowId)) windowIds.add(windowId);
  }

  for (const windowId of windowIds) beginWatch(windowId);
  inFlight.clear();
  await Promise.all([...windowIds].map((windowId) => commit(windowId, () => clearPending(windowId))));
}

async function armActiveTabs() {
  if (!(await getSettings()).enabled) return;
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
