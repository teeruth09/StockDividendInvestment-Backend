FROM node:22-alpine

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

#install app dependencies
RUN npm install

COPY . .

# 🔽 สร้าง Prisma Client ภายใน container
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]