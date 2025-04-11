#!/bin/bash

# Create directory for certificates if it doesn't exist
mkdir -p nginx/certs

# Generate self-signed certificate for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem \
  -out nginx/certs/cert.pem \
  -subj "/CN=f2f-experiment.tempserver.click" \
  -addext "subjectAltName=DNS:f2f-experiment.tempserver.click"

# Set permissions
chmod 600 nginx/certs/key.pem
chmod 600 nginx/certs/cert.pem

echo "Self-signed certificate generated successfully"