# latest as of 2023-06-17
FROM node:20.3-bookworm

# Install dependencies
RUN mkdir /app
WORKDIR /app
COPY package*.json /app
RUN npm install

# Copy app & launch
COPY . /app

CMD ["npm", "start"]
