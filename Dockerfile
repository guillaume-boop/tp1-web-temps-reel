FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["npm", "start"]
