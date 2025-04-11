#!/usr/bin/env node

const { Command } = require("commander");
const io = require("socket.io-client");

// Parse command line arguments
const program = new Command();
program
  .option(
    "-c, --connections <number>",
    "Number of connections to create",
    parseInt,
    1
  )
  .option("-u, --url <url>", "Socket.IO server URL", "http://localhost:3000")
  .option(
    "-t, --timeout <ms>",
    "Connection timeout in milliseconds",
    parseInt,
    10000
  )
  .option(
    "-i, --interval <ms>",
    "Interval between creating connections in milliseconds",
    parseInt,
    100
  )
  .option("-v, --verbose", "Enable verbose logging", false)
  .option(
    "--log-level <level>",
    "Log level (0-3, higher is more verbose)",
    parseInt,
    1
  )
  .parse(process.argv);

const options = program.opts();
options.connections = 3;

// Set up timestamp logge
const logWithTimestamp = (level, message) => {
  if (level <= options.logLevel || (level === 1 && !options.verbose)) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }
};

// Log Levels:
// 0 - Critical only
// 1 - Normal (default)
// 2 - Detailed
// 3 - Debug

options.logLevel = 3;
console.log("Socket.IO Load Test");
console.log("===================");
console.log(`Target URL: ${options.url}`);
console.log(`Number of connections: ${options.connections}`);
console.log(`Connection timeout: ${options.timeout}ms`);
console.log(`Connection interval: ${options.interval}ms`);
console.log(`Log level: ${options.logLevel}`);
console.log("===================\n");

logWithTimestamp(0, "Test started");

// Track statistics
const stats = {
  connected: 0,
  failed: 0,
  disconnected: 0,
  reconnecting: 0,
  errors: {},
  events: {},
  startTime: Date.now(),
  lastLogTime: Date.now(),
  connectionAttempts: 0,
};

// Create connections
const sockets = [];
let connectionsCreated = 0;

// Set up periodic status reporting
const statusInterval = setInterval(() => {
  const currentTime = Date.now();
  const elapsedSinceStart = (currentTime - stats.startTime) / 1000;
  const elapsedSinceLastLog = (currentTime - stats.lastLogTime) / 1000;

  logWithTimestamp(1, `STATUS UPDATE (${elapsedSinceStart.toFixed(1)}s)`);
  logWithTimestamp(
    1,
    `Connections: Created=${connectionsCreated}, Active=${stats.connected}, Failed=${stats.failed}, Disconnected=${stats.disconnected}`
  );

  if (options.logLevel >= 2) {
    const connectRate = stats.connectionAttempts / elapsedSinceLastLog;
    logWithTimestamp(2, `Connection rate: ${connectRate.toFixed(2)}/second`);

    if (Object.keys(stats.errors).length > 0) {
      logWithTimestamp(2, `Recent errors: ${JSON.stringify(stats.errors)}`);
    }

    if (Object.keys(stats.events).length > 0) {
      logWithTimestamp(2, `Recent events: ${JSON.stringify(stats.events)}`);
    }
  }

  // Reset counters for rate calculations
  stats.connectionAttempts = 0;
  stats.lastLogTime = currentTime;
  stats.errors = {};
  stats.events = {};
}, 5000);

function createSocket() {
  if (connectionsCreated >= options.connections) return;

  connectionsCreated++;
  stats.connectionAttempts++;
  const socketIndex = connectionsCreated;

  logWithTimestamp(
    2,
    `Creating connection ${socketIndex}/${options.connections}`
  );

  // Track socket lifecycle
  const socketData = {
    id: socketIndex,
    startTime: Date.now(),
    state: "connecting",
    events: [],
  };

  const socket = io(options.url, {
    reconnection: true,
    reconnectionAttempts: 2,
    reconnectionDelay: 1000,
    timeout: options.timeout,
    // transports: ["websocket"],
    forceNew: true,
    query: {
      // clientId: `load-test-${socketIndex}`,
      target_id: `${socketIndex + 10000}`,
    },
  });

  sockets.push(socket);

  // Log socket connection event with timing
  const logSocketEvent = (event, data) => {
    const now = Date.now();
    const elapsed = now - socketData.startTime;
    socketData.events.push({ time: now, event, data });

    if (!stats.events[event]) {
      stats.events[event] = 0;
    }
    stats.events[event]++;

    logWithTimestamp(
      3,
      `[Socket ${socketIndex}] ${event} (${elapsed}ms) ${
        data ? ": " + JSON.stringify(data) : ""
      }`
    );
  };

  // Track all socket events
  socket.onAny((eventName, ...args) => {
    logSocketEvent(`event:${eventName}`, args.length > 0 ? args[0] : null);
  });

  // Listen for server response
  socket.on("server_response", (data) => {
    logWithTimestamp(
      1,
      `Socket ${socketIndex} received server response: ${JSON.stringify(data)}`
    );
  });

  socket.on("connect", () => {
    stats.connected++;
    socketData.state = "connected";
    const connectTime = Date.now() - socketData.startTime;

    logWithTimestamp(
      1,
      `Socket ${socketIndex} connected in ${connectTime}ms (${stats.connected}/${options.connections})`
    );

    // Send 3 messages with the requested format
    for (let subindex = 1; subindex <= 3; subindex++) {
      const message = {
        id: `${socketIndex}-${subindex}`,
      };
      logWithTimestamp(
        1,
        `Socket ${socketIndex} sending message ${subindex}/3: ${JSON.stringify(
          message
        )}`
      );
      socket.emit("test", message);
    }

    if (stats.connected % 10 === 0 || stats.connected === options.connections) {
      logWithTimestamp(
        0,
        `Connected: ${stats.connected}/${options.connections}`
      );
    }

    if (stats.connected + stats.failed === options.connections) {
      displayResults();
    }
  });

  socket.on("connect_error", (err) => {
    const errorType = err.message || "Unknown";
    if (!stats.errors[errorType]) {
      stats.errors[errorType] = 0;
    }
    stats.errors[errorType]++;

    logSocketEvent("connect_error", { message: err.message });

    logWithTimestamp(
      2,
      `Socket ${socketIndex} connection error: ${err.message}`
    );
  });

  socket.on("connect_timeout", () => {
    logSocketEvent("connect_timeout");
    logWithTimestamp(2, `Socket ${socketIndex} connection timeout`);
  });

  socket.on("error", (err) => {
    const errorType = err.message || "Unknown";
    if (!stats.errors[errorType]) {
      stats.errors[errorType] = 0;
    }
    stats.errors[errorType]++;

    logSocketEvent("error", { message: err.message });
    logWithTimestamp(2, `Socket ${socketIndex} error: ${err.message}`);
  });

  socket.on("disconnect", (reason) => {
    stats.disconnected++;
    socketData.state = "disconnected";

    logSocketEvent("disconnect", { reason });
    logWithTimestamp(2, `Socket ${socketIndex} disconnected: ${reason}`);
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    stats.reconnecting++;
    socketData.state = "reconnecting";

    logSocketEvent("reconnect_attempt", { attemptNumber });
    logWithTimestamp(
      2,
      `Socket ${socketIndex} reconnect attempt ${attemptNumber}`
    );
  });

  socket.on("reconnect", (attemptNumber) => {
    logSocketEvent("reconnect", { attemptNumber });
    logWithTimestamp(
      2,
      `Socket ${socketIndex} reconnected after ${attemptNumber} attempts`
    );
  });

  socket.on("reconnect_error", (err) => {
    const errorType = err.message || "Unknown";
    if (!stats.errors[errorType]) {
      stats.errors[errorType] = 0;
    }
    stats.errors[errorType]++;

    logSocketEvent("reconnect_error", { message: err.message });
    logWithTimestamp(
      2,
      `Socket ${socketIndex} reconnection error: ${err.message}`
    );
  });

  socket.on("reconnect_failed", () => {
    stats.failed++;
    socketData.state = "failed";

    logSocketEvent("reconnect_failed");
    logWithTimestamp(1, `Socket ${socketIndex} reconnection failed`);

    if (stats.connected + stats.failed === options.connections) {
      displayResults();
    }
  });

  // Schedule next connection
  if (connectionsCreated < options.connections) {
    setTimeout(createSocket, options.interval);
  }
}

function displayResults() {
  const duration = (Date.now() - stats.startTime) / 1000;

  logWithTimestamp(0, "\nTEST RESULTS");
  logWithTimestamp(0, "===================");
  logWithTimestamp(0, `Total connections attempted: ${options.connections}`);
  logWithTimestamp(0, `Successful connections: ${stats.connected}`);
  logWithTimestamp(0, `Failed connections: ${stats.failed}`);
  logWithTimestamp(
    0,
    `Success rate: ${((stats.connected / options.connections) * 100).toFixed(
      2
    )}%`
  );
  logWithTimestamp(0, `Disconnected: ${stats.disconnected}`);
  logWithTimestamp(0, `Time elapsed: ${duration.toFixed(2)} seconds`);
  logWithTimestamp(
    0,
    `Connections per second: ${(stats.connected / duration).toFixed(2)}`
  );

  if (options.logLevel >= 1) {
    logWithTimestamp(1, `Connection errors by type:`);
    const errorTypes = Object.keys(stats.errors).sort();
    errorTypes.forEach((type) => {
      logWithTimestamp(1, `  - ${type}: ${stats.errors[type]}`);
    });

    logWithTimestamp(1, `Event counts:`);
    const eventTypes = Object.keys(stats.events).sort();
    eventTypes.forEach((type) => {
      logWithTimestamp(1, `  - ${type}: ${stats.events[type]}`);
    });
  }

  logWithTimestamp(0, "===================");
  logWithTimestamp(0, "\nTest complete. Press Ctrl+C to exit");

  // Stop the periodic status updates
  clearInterval(statusInterval);
}

// Generate a report file with detailed statistics
function saveReport() {
  const reportData = {
    timestamp: new Date().toISOString(),
    config: options,
    stats: {
      connected: stats.connected,
      failed: stats.failed,
      disconnected: stats.disconnected,
      reconnecting: stats.reconnecting,
      duration: (Date.now() - stats.startTime) / 1000,
      connectionsPerSecond:
        stats.connected / ((Date.now() - stats.startTime) / 1000),
    },
    errors: stats.errors,
    events: stats.events,
    sockets: sockets.map((s, i) => ({
      id: i + 1,
      connected: s.connected,
      disconnected: s.disconnected,
    })),
  };

  const reportFilename = `socket-test-report-${Date.now()}.json`;
  const fs = require("fs");

  try {
    fs.writeFileSync(reportFilename, JSON.stringify(reportData, null, 2));
    logWithTimestamp(0, `Report saved to ${reportFilename}`);
  } catch (err) {
    logWithTimestamp(0, `Error saving report: ${err.message}`);
  }
}

// Handle process exit
process.on("SIGINT", () => {
  logWithTimestamp(0, "\nTest interrupted - cleaning up...");

  // Generate report if we've created any connections
  if (connectionsCreated > 0) {
    saveReport();
  }

  // Close all active connections
  logWithTimestamp(1, `Closing ${sockets.length} connections...`);
  let closed = 0;

  sockets.forEach((socket) => {
    if (socket.connected) {
      socket.disconnect();
      closed++;
    }
  });

  logWithTimestamp(1, `Closed ${closed} active connections`);
  process.exit(0);
});

// Display memory usage periodically if debug logging enabled
if (options.logLevel >= 3) {
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    logWithTimestamp(
      3,
      `Memory usage: RSS=${Math.round(
        memoryUsage.rss / 1024 / 1024
      )}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(
        memoryUsage.heapTotal / 1024 / 1024
      )}MB`
    );
  }, 10000);
}

// Start creating connections
logWithTimestamp(
  0,
  `Starting to create ${options.connections} connections to ${options.url}`
);
createSocket();
