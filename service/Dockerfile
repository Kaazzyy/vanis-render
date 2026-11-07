FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN mkdir -p /app/data/files && chmod -R 777 /app/data
EXPOSE 3000
CMD ["node", "index.js"]
