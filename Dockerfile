# Web + API in one image (the API serves the built React app). The AI service has its own image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci
COPY apps ./apps
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 WEB_DIST=/app/apps/web/dist
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/migrations apps/api/migrations
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "apps/api/dist/server.js"]
