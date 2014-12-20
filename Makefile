TESTS =  $(shell ls -S `find tests -type f -name "*.js" -print`)
REPORTER = spec
TIMEOUT = 3000
MOCHA_OPTS =


install:
	@npm install

test: install
	@NODE_ENV=test node \
		node_modules/.bin/istanbul cover --preserve-comments \
		./node_modules/.bin/_mocha \
		-- -u exports \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		--require should \
		$(MOCHA_OPTS) \
		$(TESTS)

build: install
	node_modules/.bin/uglifyjs \
		./src/lokijs.js \
		-o build/lokijs.min.js

clean:
	@rm -rf node_modules
	@rm -rf coverage

.PHONY: test build