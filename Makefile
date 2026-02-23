SHELL := /bin/bash

.PHONY: specify plan tasks check agent

SPECIFY_DESC ?= new feature
FEATURE ?=
SPEC_ENV = $(if $(FEATURE),SPECIFY_FEATURE=$(FEATURE),)

specify:
	@bash .specify/scripts/bash/create-new-feature.sh "$(SPECIFY_DESC)"

plan:
	@$(SPEC_ENV) bash .specify/scripts/bash/setup-plan.sh

tasks:
	@$(SPEC_ENV) bash -lc 'source .specify/scripts/bash/common.sh; \
	eval "$$(get_feature_paths)"; \
	if [ -f "$$TASKS" ]; then \
		echo "tasks.md already exists: $$TASKS"; \
	else \
		cp .specify/templates/tasks-template.md "$$TASKS"; \
		echo "Created tasks template: $$TASKS"; \
	fi'

check:
	@$(SPEC_ENV) bash .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks

agent:
	@$(SPEC_ENV) bash .specify/scripts/bash/update-agent-context.sh codex
