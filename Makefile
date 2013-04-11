SHELL:=/bin/bash -O extglob

SRC = \
	support/exports.head.js \
	src/vlexer.js \
	src/vast.js \
	src/vparser.js \
	src/vcompiler.js \
	src/vexports.js \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js \
	src/vexpress.js \
	support/exports.tail.js

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

LICENSE = @node support/tasks.js license
BUILDBUMP = @node support/version.js build

LICENSEHEADER = build/license.js

build: $(SRC)
	$(BUILDBUMP)
	$(LICENSE) > $(LICENSEHEADER)
	@cat $(LICENSEHEADER) $^ > build/vash.js
	@cat $(LICENSEHEADER) $(RUNTIMEREQSRC) > build/vash-runtime.js
	@cat $(LICENSEHEADER) $(RUNTIMEALLSRC) > build/vash-runtime-all.js
	@rm $(LICENSEHEADER)
	@node support/version.js

build-min: build
	@$(UGLIFY) build/vash.js > build/vash.min.js \
			&& du -h build/vash.js build/vash.min.js
	@$(UGLIFY) build/vash-runtime.js > build/vash-runtime.min.js \
			&& du -h build/vash-runtime.js build/vash-runtime.min.js
	@$(UGLIFY) build/vash-runtime-all.js > build/vash-runtime-all.min.js \
			&& du -h build/vash-runtime-all.js build/vash-runtime-all.min.js

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
		<(echo '<script type="text">This document was generated from README.vash</script>') \
		<(bin/vash <README2.vash --render --helpers <(bin/vash <docs/helpers/* --helper)) \
		> README2.md

docs-dev: docs
	@cat \
		<(echo '<link href="docs/gfm.css" rel="stylesheet" type="text/css">') \
		<(node_modules/marked/bin/marked <README2.md) \
		> README2.html

.PHONY: build clean docs docs-dev build-min test test-min
