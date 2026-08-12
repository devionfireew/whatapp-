# Alpine ki jagah Debian-based Node 20 (Baileys & WhatsApp bots ke liye best)
FROM node:20-slim

# Working directory set karein
WORKDIR /usr/src/app

# Package files copy karein
COPY package*.json ./

# Clean install with legacy peer deps
RUN npm install --legacy-peer-deps

# Complete source code copy karein
COPY . .

# Port expose karein
EXPOSE 8080

# App start command
CMD ["node", "index.js"]
