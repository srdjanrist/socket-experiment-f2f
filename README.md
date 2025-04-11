# Socket.IO Load Testing Tool

A simple Node.js utility for load testing Socket.IO servers by creating multiple concurrent connections.

## Installation

```bash
npm install
```

## Usage

```bash
node index.js --url <socket-io-server-url> --connections <number>
```

### Options

- `-c, --connections <number>`: Number of connections to create (default: 1)
- `-u, --url <url>`: Socket.IO server URL (default: http://localhost:3000)
- `-t, --timeout <ms>`: Connection timeout in milliseconds (default: 10000)
- `-i, --interval <ms>`: Interval between creating connections in milliseconds (default: 100)
- `-v, --verbose`: Enable verbose logging (default: false)
- `--log-level <level>`: Log level from 0-3, higher means more verbose (default: 1)

### Log Levels

- 0: Critical only (minimal output)
- 1: Normal (default)
- 2: Detailed
- 3: Debug (most verbose)

## Examples

Test with 100 connections to a local server:
```bash
node index.js --url http://localhost:3000 --connections 100
```

Test with 50 connections and detailed logging:
```bash
node index.js --url http://example.com --connections 50 --log-level 2
```

## Features

- Customizable number of simultaneous connections
- Detailed connection statistics
- Event tracking and error reporting
- Automatic JSON report generation
- Memory usage monitoring