const OPEN_TRANSITIONS = new Set(["typed", "auto_bookmark"]);

export function isBlankUrl(raw) {
  if (!raw) return true;
  try {
    const url = new URL(raw);
    if (url.protocol === "about:" && url.pathname === "blank") return true;
    if (url.protocol === "chrome:" || url.protocol === "chrome-untrusted:") {
      return url.hostname === "newtab" || url.hostname.startsWith("new-tab-page");
    }
  } catch {
    return false;
  }
  return false;
}

export function normalizeUrl(raw) {
  if (typeof raw !== "string" || isBlankUrl(raw)) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

export function isAddressOrBookmark(transitionType, qualifiers = []) {
  if (!OPEN_TRANSITIONS.has(transitionType)) return false;
  return !qualifiers.includes("forward_back");
}

export function pickExistingTab(tabs, currentTabId, normalized) {
  const matches = tabs.filter((tab) => {
    if (tab.id === currentTabId) return false;
    return normalizeUrl(tab.url) === normalized || normalizeUrl(tab.pendingUrl) === normalized;
  });
  const committed = matches.filter((tab) => normalizeUrl(tab.url) === normalized);
  const pool = committed.length > 0 ? committed : matches;
  if (pool.length === 0) return null;

  const current = tabs.find((tab) => tab.id === currentTabId);
  const rank = (tab) => {
    const sameWindow = current && tab.windowId === current.windowId ? 2 : 0;
    return sameWindow * 10 + (tab.active ? 1 : 0);
  };
  return [...pool].sort((a, b) => {
    const byRank = rank(b) - rank(a);
    if (byRank !== 0) return byRank;
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  })[0];
}

export function createReuseController({ queryTabs, focusWindow, focusTab, closeTab, goBack, isEnabled }) {
  const freshTabs = new Map();
  const navigation = new Map();
  const chains = new Map();

  function enqueue(tabId, task) {
    const previous = chains.get(tabId) ?? Promise.resolve();
    const run = previous.then(task, task);
    chains.set(
      tabId,
      run.then(
        () => {},
        () => {},
      ),
    );
    return run;
  }

  async function focusExisting(tabId, state) {
    if (!(await isEnabled())) return;
    const normalized = normalizeUrl(state.url);
    if (!normalized) return;
    const existing = pickExistingTab(await queryTabs(), tabId, normalized);
    if (!existing) return;

    const closeNew = state.closeNew;
    state.closeNew = false;
    state.fromOpen = false;
    try {
      await focusWindow(existing.windowId);
      await focusTab(existing.id);
      if (closeNew) await closeTab(tabId);
      else await goBack(tabId);
    } catch {
      // 移動先のタブが既に閉じている場合などは、今のタブをそのまま残す
    }
  }

  return {
    onCreated(tab) {
      const initial = tab.pendingUrl || tab.url || "";
      freshTabs.set(tab.id, {
        blank: isBlankUrl(initial),
        direct: !isBlankUrl(initial),
      });
    },

    onRemoved(tabId) {
      freshTabs.delete(tabId);
      navigation.delete(tabId);
      chains.delete(tabId);
    },

    onCommitted(details) {
      if (details.frameId !== 0) return undefined;
      return enqueue(details.tabId, async () => {
        const url = details.url || "";
        if (!normalizeUrl(url)) return;

        const fresh = freshTabs.get(details.tabId);
        let state = navigation.get(details.tabId);
        if (fresh) {
          freshTabs.delete(details.tabId);
          state = {
            closeNew: Boolean(fresh.blank || fresh.direct),
            fromOpen: false,
            url,
          };
          navigation.set(details.tabId, state);
        } else if (!state) {
          state = { closeNew: false, fromOpen: false, url };
          navigation.set(details.tabId, state);
        }
        state.url = url;

        const qualifiers = details.transitionQualifiers || [];
        const redirected =
          qualifiers.includes("server_redirect") || qualifiers.includes("client_redirect");
        const opened = isAddressOrBookmark(details.transitionType, qualifiers);
        if (opened) state.fromOpen = true;
        else if (!redirected) {
          state.fromOpen = false;
          state.closeNew = false;
          return;
        }
        if (!state.fromOpen) return;

        await focusExisting(details.tabId, state);
      });
    },
  };
}
