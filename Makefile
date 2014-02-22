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

UGLIFY = node_modules/uglify-js/bin/uglifyjs
VOWS = node_modules/vows/bin/vows
JSHINT = node_modules/jshint/bin/hint

VERSIONREPL = node support/version.js replace

EXPORTSHEAD = support/exports.head.js
EXPORTSTAIL = support/exports.tail.js

LICENSEHEADER = build/license.js

all: build build-min

build: build-bump license package.json $(SRC)
	@mkdir -p build
	@cat $(LICENSEHEADER) $(EXPORTSHEAD) $(SRC) <($(VERSIONREPL)< $(EXPORTSTAIL)) > build/vash.js
	@cat $(LICENSEHEADER) $(RUNTIMEREQSRC) > build/vash-runtime.js
	@cat $(LICENSEHEADER) $(RUNTIMEALLSRC) > build/vash-runtime-all.js
	@rm $(LICENSEHEADER)

build-min: build
	@$(UGLIFY) build/vash.js > build/vash.min.js
	@$(UGLIFY) build/vash-runtime.js > build/vash-runtime.min.js
	@$(UGLIFY) build/vash-runtime-all.js > build/vash-runtime-all.min.js

build-bump:
	@node support/version.js build

license:
	@mkdir -p build
	@$(VERSIONREPL) < support/license.header.js > $(LICENSEHEADER)

stats: build-min
	@printf "%16s %s \n" "vash.js" $$(wc -c < build/vash.js | tr -d ' ')k
	@printf "%16s %s \n" "min" $$(wc -c < build/vash.min.js | tr -d ' ')k
	@printf "%16s %s \n" "gzipped" $$(gzip -cf < build/vash.min.js | wc -c | tr -d ' ')k
	@echo --
	@printf "%16s %s \n" "vash-runtime.js" $$(wc -c < build/vash-runtime.js | tr -d ' ')k
	@printf "%16s %s \n" "min" $$(wc -c < build/vash-runtime.min.js | tr -d ' ')k
	@printf "%16s %s \n" "gzipped" $$(gzip -cf < build/vash-runtime.min.js | wc -c | tr -d ' ')k

test: build
	VASHPATH=../../build/vash.js \
	VASHRUNTIMEPATH=../../build/vash-runtime.min.js \
	$(VOWS) test/vows/* --spec

test-min: build-min
	VASHPATH=../../build/vash.js \
	VASHRUNTIMEPATH=../../build/vash-runtime.min.js \
	$(VOWS) test/vows/* --spec

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
		<(echo '<!DOCTYPE html><link href="docs/gfm.css" rel="stylesheet" type="text/css">') \
		<(node_modules/marked/bin/marked <README.md) \
		> README.html

.PHONY: all build-bump clean docs docs-dev build-min license test test-min
