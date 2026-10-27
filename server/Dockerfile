FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# dev 服务器直连 npmjs 不稳定，走 npmmirror
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com && npm cache clean --force
COPY src ./src
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "--experimental-strip-types", "src/index.ts"]
