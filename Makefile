# ─────────────────────────────────────────────────────────────────────────────
# Recurrsive — Developer Makefile
#
# Common development tasks for the Engineering Intelligence Platform.
# Run `make help` to see all available targets.
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help install build test lint typecheck dev clean docker-up docker-down verify release

# ── Defaults ──────────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help

# ── Colors ────────────────────────────────────────────────────────────────────
CYAN  := \033[36m
GREEN := \033[32m
RESET := \033[0m

# ── Help ──────────────────────────────────────────────────────────────────────
help: ## Show this help
	@echo ""
	@echo "$(CYAN)Recurrsive$(RESET) — Developer Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────
install: ## Install all dependencies
	pnpm install

# ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build all 14 packages
	pnpm build

build-server: ## Build server only
	pnpm build --filter @recurrsive/server

build-dashboard: ## Build dashboard only
	pnpm build --filter @recurrsive/dashboard

build-website: ## Build website only
	pnpm build --filter @recurrsive/website

# ── Test ──────────────────────────────────────────────────────────────────────
test: ## Run all tests (3,343+ across 140 test files)
	pnpm test

test-server: ## Run server tests (423)
	pnpm test --filter @recurrsive/server

test-dashboard: ## Run dashboard tests (81)
	pnpm test --filter @recurrsive/dashboard

test-website: ## Run website tests (69)
	pnpm test --filter @recurrsive/website

test-mcp: ## Run MCP server tests (254)
	pnpm test --filter @recurrsive/mcp

test-cli: ## Run CLI tests (308)
	pnpm test --filter @recurrsive/cli

test-pkg: ## Run tests for a specific package (PKG=reasoning)
	pnpm test --filter @recurrsive/$(PKG)

# ── Quality ───────────────────────────────────────────────────────────────────
lint: ## Lint all packages
	pnpm lint

typecheck: ## Typecheck all packages
	pnpm typecheck

# ── Development ───────────────────────────────────────────────────────────────
dev-server: ## Start API server (port 3000)
	pnpm dev --filter @recurrsive/server

dev-dashboard: ## Start dashboard (port 3100)
	pnpm dev --filter @recurrsive/dashboard

dev-website: ## Start website (port 3200)
	pnpm dev --filter @recurrsive/website

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up: ## Start full stack (Postgres + Server + Dashboard + Website)
	docker compose -f docker/docker-compose.yml up --build -d

docker-down: ## Stop full stack and remove volumes
	docker compose -f docker/docker-compose.yml down -v

docker-logs: ## Tail logs from all services
	docker compose -f docker/docker-compose.yml logs -f

# ── Verification ──────────────────────────────────────────────────────────────
verify: build test ## Full CI verification (build + test)
	@echo ""
	@echo "$(GREEN)✓ All checks passed$(RESET)"

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: ## Remove build artifacts, caches, and node_modules
	rm -rf apps/*/dist apps/*/.next packages/*/dist
	rm -rf node_modules/.cache .turbo
	@echo "$(GREEN)✓ Cleaned$(RESET)"

clean-full: clean ## Full clean including node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@echo "$(GREEN)✓ Full clean complete — run 'make install' to reinstall$(RESET)"

# ── Release ───────────────────────────────────────────────────────────────────
release: verify ## Create a release tag (VERSION=0.5.7)
ifndef VERSION
	$(error VERSION is required. Usage: make release VERSION=0.5.7)
endif
	git tag -a v$(VERSION) -m "Release v$(VERSION)"
	@echo "$(GREEN)✓ Tagged v$(VERSION) — push with: git push origin v$(VERSION)$(RESET)"
