.PHONY: lint format backend-lint backend-format frontend-lint frontend-format

lint: frontend-lint backend-lint

format: frontend-format backend-format

backend-lint:
	$(MAKE) -C backend lint

backend-format:
	$(MAKE) -C backend format

frontend-lint:
	cd frontend && npm run lint

frontend-format:
	cd frontend && npm run format
