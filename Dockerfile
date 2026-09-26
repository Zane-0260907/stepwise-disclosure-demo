FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY web ./web
COPY fixtures ./fixtures
COPY evidence/research ./evidence/research
ENV DEMO_HOST=0.0.0.0
ENV DEMO_PORT=4793
EXPOSE 4793
CMD ["node", "src/app-server.mjs"]
