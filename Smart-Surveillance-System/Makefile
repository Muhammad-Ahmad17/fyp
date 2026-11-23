COMPOSE := docker compose -f infra/docker-compose.yml
EVENT   ?= helmet_missing

.PHONY: edge-agent up down clean ps logs infra redis-alerts dead-letter psql mock mock-bad test lint typecheck build edge-test prod-up

up:            ## build and start everything (dashboard on :8080)
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

clean:         ## stop and wipe volumes
	$(COMPOSE) down -v

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=50

infra:         ## only mosquitto + redis + postgres (run the Node apps with npm run dev)
	$(COMPOSE) up -d mosquitto redis postgres

redis-alerts:
	$(COMPOSE) exec redis redis-cli XRANGE ppe:alerts - + COUNT 5

dead-letter:
	$(COMPOSE) exec redis redis-cli XRANGE ppe:dead_letter - +

psql:
	$(COMPOSE) exec postgres psql -U intellisafe intellisafe

mock:          ## publish one valid event over MQTT: make mock EVENT=fire
	npm run mock -w @intellisafe/simulator -- $(EVENT)

mock-bad:      ## publish an invalid payload (lands in ppe:dead_letter)
	npm run mock -w @intellisafe/simulator -- --bad

build:
	npm run build

typecheck:
	npm run typecheck

lint:
	npm run lint

test:
	npm test

edge-test:
	.venv/bin/python -m pytest -q

edge-agent:    ## run the edge agent with the stub model against the local stack
	EVIDENCE_UPLOAD_URL=http://localhost:3000/api/evidence .venv/bin/python -m edge.agent

prod-up:
	docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up --build -d
