FROM node:20-bullseye

# Install dependencies required by Chromium
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy server package.json and install production deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

# Copy server code
COPY server/ ./server/
WORKDIR /usr/src/app/server

ENV PORT=4000
EXPOSE 4000
CMD ["node", "index.js"]
