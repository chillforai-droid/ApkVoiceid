FROM node:18-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
