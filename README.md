# project

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

### To run local tests
```
npm test:cypress
```

To speed up the tests locally, we can target specific tests by editing package.json to run only the files of interest (**when doing so, remember _NOT TO COMMIT_ the changes!**).
For example, adding the ```--spec``` argument like in this example:
```
....
"cy:run:microbit": "cypress run --env mode=microbit --spec tests/cypress/e2e/autocomplete.cy.ts",
"cy:run:python": "cypress run --env mode=python --spec tests/cypress/e2e/autocomplete.cy.ts",
...

```

Also the relevant ```describe``` function call in the tests files can be turned into ```describe.only``` to only run that test in the file. Be aware that it will silently turns off all the other tests!
