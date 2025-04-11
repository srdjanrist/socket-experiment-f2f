# Socket.IO Load Testing Tool

A simple Node.js utility for load testing Socket.IO servers by creating multiple concurrent connections, with Nginx proxy configuration.

## Socket.IO Load Testing Tool

### Installation

```bash
npm install
```

### Usage

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

### Examples

Test with 100 connections to a local server:
```bash
node index.js --url http://localhost:3000 --connections 100
```

Test with 50 connections and detailed logging:
```bash
node index.js --url http://example.com --connections 50 --log-level 2
```

### Docker Usage

```bash
# Build the image
docker build -t socket-experiment .

# Run with parameters
docker run socket-experiment --url http://your-server:3000 --connections 50
```

## Nginx Proxy with Let's Encrypt SSL

This setup includes Nginx as a reverse proxy that redirects traffic from f2f-experiment.tempserver.click to localhost:5000, with automatic SSL certificate provisioning via Let's Encrypt.

### Getting Started

1. Make sure your domain (f2f-experiment.tempserver.click) points to your server's IP address.

2. Edit the `init-letsencrypt.sh` script to add your email address (optional but recommended).

3. Run the initialization script to set up Let's Encrypt certificates:

```bash
./init-letsencrypt.sh
```

4. After certificates are obtained, the Nginx proxy will automatically be configured.

5. For subsequent starts, simply use:

```bash
docker compose up -d
```

The certificates will automatically renew when needed (every ~90 days).

### What This Setup Provides

- Automatic SSL certificate generation and renewal via Certbot
- HTTP to HTTPS redirection
- WebSocket support for Socket.IO connections
- Forwards traffic from f2f-experiment.tempserver.click to localhost:5000
- Proper security headers and optimized SSL configuration

### Requirements

- Domain name pointing to your server
- Ports 80 and 443 open and accessible from the internet
- Docker and Docker Compose installed on your server