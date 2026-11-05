FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY . .
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
