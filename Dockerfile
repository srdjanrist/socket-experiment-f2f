FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Make script executable
RUN chmod +x index.js

# Set entry point
ENTRYPOINT ["node", "index.js"]

# Default command (can be overridden when running the container)
CMD ["--help"]