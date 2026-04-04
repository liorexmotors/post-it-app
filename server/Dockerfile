# Node.js + Playwright for Railway deployment
FROM node:20-slim

# Install Playwright system dependencies (Chromium)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./

# Install Node dependencies
RUN npm install --production

# Install Playwright browsers (chromium only)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Copy source
COPY . .

# Expose port
EXPOSE 3001

# Start
CMD ["node", "index.js"]
