FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

EXPOSE 5173

# Run Vite dev server exposed to host
CMD ["npm", "run", "dev", "--", "--host"]
