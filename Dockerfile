# Node.js 20 Base Image (Baileys package ke liye Node 20+ zaroori hai)
FROM node:20-alpine

# Working Directory set karein
WORKDIR /usr/src/app

# Package files copy karein
COPY package*.json ./

# Dependencies install karein
RUN npm install

# Baaki saara code copy karein
COPY . .

# App ko 8080 port par expose karein
EXPOSE 8080

# App start karne ki command
CMD ["node", "index.js"]
