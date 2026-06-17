FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN rm -rf node_modules
RUN npm install
CMD ["npm", "run", "dev"]