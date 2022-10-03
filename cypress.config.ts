import { defineConfig } from "cypress"
import {rm} from "fs";

export default defineConfig({
    downloadsFolder: "tests/cypress/downloads",
    fixturesFolder:	false,
    screenshotsFolder: "tests/cypress/screenshots",
    videosFolder: "tests/cypress/videos",
    e2e: {
        specPattern: "tests/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
        supportFile: false,
        // Inspired by https://docs.cypress.io/api/plugins/configuration-api#Usage
        setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
            on("task", {
                deleteFile(filePath) {
                    console.log("deleting file %s", filePath)

                    return new Promise((resolve, reject) => {
                        rm(filePath, {maxRetries: 10}, (err) => {
                            if (err && !err.message.startsWith("ENOENT")) {
                                console.error(err)
                                return reject(err)
                            }
                            resolve(null)
                        })
                    })
                },
            })
            
            config.baseUrl = config.env.mode == "microbit" ? "http://localhost:8081/microbit/" : "http://localhost:8081/editor/"
            return config
        },
    },
})
