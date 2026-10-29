// Screenshot a CDP tab via websocket
import { spawn } from "node:child_process";

const tabId = process.argv[2];
const out = process.argv[3];

// Use a tiny node websocket client via CDP HTTP + ws
// Simpler: use the /json/close + a screenshot through the DevTools protocol
// We'll use the `chrome-remote-interface` style via raw ws — but to avoid deps,
// use the CDP HTTP endpoint for screenshot is not available. Instead use node's
// built-in fetch to a small helper. For now: use `import` of ws? Not installed.
// Fallback: use chromium's --screenshot flag via a new headless instance.
console.log(JSON.stringify({ tabId, out }));
