#!/bin/bash

# This script automates the initial setup of Let's Encrypt certificates with certbot

# Exit on error
set -e

# Domain information
domains=(f2f-experiment.tempserver.click)
rsa_key_size=4096
email="" # Add your email for urgent renewal and security notices (optional)
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

# Set up paths
data_path="./certbot"
nginx_conf_path="./nginx/conf"

if [ -d "$data_path/conf/live/$domains" ]; then
  read -p "Existing certificate found for $domains. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

# Check if domain is accessible
echo "### Checking domain availability..."
curl -s "http://${domains[0]}" > /dev/null
if [ $? -ne 0 ]; then
  echo "WARNING: Unable to reach domain ${domains[0]}. Make sure it's properly set up and points to this server."
  echo "Proceeding anyway, but certificate issuance may fail."
fi

# Create directories for certbot challenge if they don't exist
mkdir -p "$data_path/www"
mkdir -p "$data_path/conf"

# Create temporary nginx config for certificate acquisition
echo "### Creating temporary config for certificate acquisition..."
cat > "$nginx_conf_path/default.conf.template" << EOF
server {
    listen 80;
    server_name ${domains[0]};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${domains[0]};
    
    # Dummy certificate in case we need to start nginx before getting the actual certificates
    ssl_certificate /etc/nginx/ssl/dummy.crt;
    ssl_certificate_key /etc/nginx/ssl/dummy.key;
    
    # Proxy settings
    location / {
        proxy_pass http://host.docker.internal:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Create dummy certificate
echo "### Creating dummy certificate for ${domains[0]}..."
mkdir -p ./nginx/ssl
openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
  -keyout ./nginx/ssl/dummy.key -out ./nginx/ssl/dummy.crt \
  -subj "/CN=localhost"

# Replace the default.conf with the template
cp "$nginx_conf_path/default.conf.template" "$nginx_conf_path/default.conf"

# Start nginx
echo "### Starting nginx..."
docker compose up --force-recreate -d nginx

# Wait for nginx to start
echo "### Waiting for nginx to start..."
sleep 5

# Request Let's Encrypt certificate
echo "### Requesting Let's Encrypt certificate for ${domains[0]}..."

domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate certbot options based on staging/production
staging_arg=""
if [ $staging -eq 1 ]; then
  staging_arg="--staging"
fi

email_arg=""
if [ -n "$email" ]; then
  email_arg="--email $email"
fi

# Run certbot
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  $staging_arg \
  $email_arg \
  $domain_args \
  --rsa-key-size $rsa_key_size \
  --agree-tos \
  --force-renewal

echo "### Reloading nginx with new certificate..."
docker compose exec nginx nginx -s reload

# Create final nginx config
echo "### Creating final nginx config..."
cat > "$nginx_conf_path/default.conf" << EOF
server {
    listen 80;
    server_name ${domains[0]};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${domains[0]};

    ssl_certificate /etc/letsencrypt/live/${domains[0]}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domains[0]}/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Proxy settings
    location / {
        proxy_pass http://host.docker.internal:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Reload nginx with the final config
docker compose exec nginx nginx -s reload

echo "### Done! Let's Encrypt SSL certificate has been obtained successfully."
echo "### Certificate will be renewed automatically."