# Transformers Integration Test

Integration test for generic transformers. Performs the following tests:

* Checks that the number of items in a /transformers/your-type/ matches the /\_\_count
* Checks that the /\_\_count matches the number of ids in /\_\_ids.
* Checks that making calls to /\_\_ids /transformers/your-type/{uuid} are valid, and return all expected fields.
* Optionally creates a concept-publisher job, and checks if it succeeds.

## Install

Clone the repo, and run `make` in the project directory.

## Usage

To run the full suite of tests against an environment:

```
test-transformers -e dynpub-uk
```

To randomly select a number of elements from the ids array, and only test against those (recommended for large result sets):

```
test-transformers -e dynpub-uk -l 50
```

See help for an up-to-date usage:

```
test-transformers --help
```

## Development

Run a `make build` to download node_modules for local development.

## TODO

It's currently hardcoded for alphaville-series - it's a simple change though to the `index.js` if you wish to test another transformer.
