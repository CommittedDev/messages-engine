FROM node:18 AS builder
WORKDIR /app
COPY package.json package-lock.json ./

# Install dependencies
RUN npm config set strict-ssl false
RUN npm install

# Install TypeScript globally
RUN npm install typescript -g

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build


FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
CMD npm run start