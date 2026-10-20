FROM oven/bun:1.3.11-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run check

FROM oven/bun:1.3.11-alpine
WORKDIR /app
ENV NODE_ENV=production ATLAS_PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
USER bun
CMD ["bun", "run", "dist/cli.js", "--http"]
