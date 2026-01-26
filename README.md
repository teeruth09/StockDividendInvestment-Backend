## Project setup

```bash
Create local configuration files by copying .sample files (and change the configs if needed)
./.env.development.sample > .env & .env.development

$ npm install

#prisma setting
npm run db:init
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```
