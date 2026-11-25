COMPOSE = docker compose -f infra/docker-compose.yml
export DOCKER_HOST ?= unix:///var/run/docker.sock

.PHONY: up down logs ps mock mock-bad test

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=80

ps:
	$(COMPOSE) ps

mock:
	PYTHONPATH=. python -m transport.event_simulator.cli $(EVENT)

mock-bad:
	PYTHONPATH=. python -m transport.event_simulator.cli --bad

test:
	python -m pytest -q
