default: install

build:
	npm install

install: global_install

global_install: package.json
		npm install -g
