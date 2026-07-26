FROM node:22.18-bookworm-slim
COPY --chown=node:node lib /app/lib
WORKDIR /app/lib/emsenn/services/561-group/services/lenticule-science/services/obsmetrological-services-section/services/wit-transition-assay
RUN npm install -g npm@11 && rm -f package-lock.json && npm install --omit=dev --install-links && npm cache clean --force && node --check bin/server.mjs
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 A2A_TASK_STORE_ROOT=/var/lib/wit/a2a/tasks WIT_RWIL_ROOT=/var/lib/wit
USER node
EXPOSE 8080
CMD ["node", "bin/server.mjs"]
