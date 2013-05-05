SHELL:=/bin/bash -O extglob

SRC = \
	src/vlexer.js \
	src/vast.js \
	src/vparser.js \
	src/vcompiler.js \
	src/vexports.js \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js \
	src/vexpress.js

LINTSRC = \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js \
	src/vexpress.js \
	src/vlexer.js \
	src/vast.js \
	src/vparser.js \
	src/vcompiler.js

RUNTIMEREQSRC = \
	src/vruntime.js

RUNTIMEALLSRC = \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js

UGLIFY = $(shell find node_modules -name "uglifyjs" -type f)
VOWS = $(shell find node_modules -name "vows" -type f)
JSHINT = $(shell find node_modules/jshint -name "hint" -type f)

VERSIONREPL = node support/version.js replace
BUILDBUMP = node support/version.js build

LICENSE = $(VERSIONREPL) < support/license.header.js

EXPORTSHEAD = support/exports.head.js
EXPORTSTAIL = support/exports.tail.js

LICENSEHEADER = build/license.js

build: package.json $(SRC)
	@$(BUILDBUMP)
	@$(LICENSE) > $(LICENSEHEADER)
	@cat $(LICENSEHEADER) $(EXPORTSHEAD) $(SRC) <($(VERSIONREPL)< $(EXPORTSTAIL)) > build/vash.js
	@cat $(LICENSEHEADER) $(RUNTIMEREQSRC) > build/vash-runtime.js
	@cat $(LICENSEHEADER) $(RUNTIMEALLSRC) > build/vash-runtime-all.js
	@rm $(LICENSEHEADER)

build-min: build
	@$(UGLIFY) build/vash.js > build/vash.min.js
	@$(UGLIFY) build/vash-runtime.js > build/vash-runtime.min.js
	@$(UGLIFY) build/vash-runtime-all.js > build/vash-runtime-all.min.js

stats: build-min
	@printf "%16s %s \n" "vash.js" $$(wc -c < build/vash.js | tr -d ' ')k
	@printf "%16s %s \n" "min" $$(wc -c < build/vash.min.js | tr -d ' ')k
	@printf "%16s %s \n" "gzipped" $$(gzip -cf < build/vash.min.js | wc -c | tr -d ' ')k
	@echo --
	@printf "%16s %s \n" "vash-runtime.js" $$(wc -c < build/vash-runtime.js | tr -d ' ')k
	@printf "%16s %s \n" "min" $$(wc -c < build/vash-runtime.min.js | tr -d ' ')k
	@printf "%16s %s \n" "gzipped" $$(gzip -cf < build/vash-runtime.min.js | wc -c | tr -d ' ')k

test: build
	@$(VOWS) test/vows/* --spec

test-min: build-min
	@$(VOWS) test/vows/* --spec --whichv=../../build/vash.min.js --whichr=../../build/vash-runtime.min.js

lint:
	@$(JSHINT) $(LINTSRC)

clean:
	@rm build/*

docs: build
	@cat \
		<(echo '<!-- This document was generated from README.vash -->') \
		<(bin/vash <README.vash --render --helpers <(bin/vash <docs/helpers/* --helper)) \
		> README.md

docs-dev: docs
	@cat \
		<(echo '<link href="docs/gfm.css" rel="stylesheet" type="text/css">') \
		<(node_modules/marked/bin/marked <README.md) \
		> README.html

.PHONY: clean docs docs-dev build-min test test-min
