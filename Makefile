# Variables
COMPOSE = docker-compose

#Commands
help:
	@echo "Usage:"
	@echo "  make build       - Build Docker image"
	@echo "  make up          - Start all containers in background"
	@echo "  make down        - Stop all containers"
	@echo "  make restart     - Restart all containers"
	@echo "  make logs        - Show logs for all containers"
	@echo "  make nest-logs   - Show logs for NestJS app"
	@echo "  make db-shell    - Enter PostgreSQL shell"
	@echo "  make prisma-gen  - Generate Prisma Client inside container"
	@echo "  make prisma-push - Push Prisma schema to DB"
	@echo "  make seed        - Prisma schema DB Seed"
	@echo "  make migrate     - Prisma schema DB migrate"
	@echo "  make db-rebuild  - Clear db with Seed"
	@echo "  make clean       - Remove all containers and volumes"

#Build Docker image
build:
	${COMPOSE} build

#Start the application
up:
	$(COMPOSE) up -d

#Stop the application
down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down && $(COMPOSE) up -d

logs:
	$(COMPOSE) logs -f

nest-logs:
	$(COMPOSE) logs -f nest-app

prisma-gen:
	docker exec nest-app npx prisma generate

prisma-push:
	docker exec nest-app npx prisma db push

seed:
	docker exec -it nest-app npm run db:seed

migrate:
	docker exec -it nest-app npx prisma migrate dev

db-rebuild:
	docker exec nest-app npm run db:reset

db-shell:
	docker exec -it nest-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}

clean:
	$(COMPOSE) down -v