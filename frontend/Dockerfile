# Stage 1: Build
FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Nginx (Alpine) to serve static files
FROM nginx:alpine

# Copy built files to Nginx directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# We expose port 80 internally
EXPOSE 80

# This is just an internal web server. The main proxy is our main Nginx container.
CMD ["nginx", "-g", "daemon off;"]
