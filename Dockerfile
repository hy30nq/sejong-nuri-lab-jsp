FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY portal/package.json portal/package.json
COPY portal/server/package.json portal/server/package.json
RUN npm ci
COPY portal portal
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production TRAINING_MODE=1 ENABLE_OS_COMMAND_LAB=1 \
    S02_SOCKET_PATH=/run/s02/exec.sock TARGET_API_HOST=0.0.0.0 \
    TARGET_API_PORT=4200 TARGET_DB_PATH=/data/target.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
COPY portal/package.json portal/package.json
COPY portal/server/package.json portal/server/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY portal/server portal/server
COPY --from=build /app/portal/dist portal/dist
RUN mkdir -p /data /run/s02 /app/portal/server/uploads \
    && chown -R node:node /data /run/s02 /app/portal/server/uploads
USER node
EXPOSE 4200
CMD ["node", "portal/server/src/server.mjs"]
