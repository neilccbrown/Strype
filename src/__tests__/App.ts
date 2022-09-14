import { PiniaVuePlugin } from 'pinia'
import { createLocalVue, mount, WrapperArray } from "@vue/test-utils"
import { createTestingPinia } from '@pinia/testing'
import App from "../App.vue"
import i18n from "../i18n"

function testApp() {
    const localVue = createLocalVue()
    localVue.use(PiniaVuePlugin)
    const wrapper = mount(App, {
        localVue,
        i18n,
        pinia: createTestingPinia({ stubActions: false }),
    })
    return wrapper
}

function checkTextIs(ws: WrapperArray<any>, expecteds : string[]) {
    expect(ws.length).toBe(expecteds.length)
    for (let i = 0; i < ws.length; i++) {
        expect(ws.at(i).text()).toBe(expecteds[i])
    }
}

describe("App.vue Basic Test", () => {
    it("has correct frame containers", () => {
        const wrapper = testApp()

        // check that the sections are present and correct:
        let headers = wrapper.findAll(".frame-container-label-span")
        checkTextIs(headers, ["Imports:", "Function definitions:", "My code:"])
    })
    it("translate correctly", async () => {
        const wrapper = testApp()

        // Starts as English:
        expect((wrapper.get('select#appLangSelect').element as HTMLSelectElement).value).toBe('en')

        // Swap to French and check it worked:
        await wrapper.get("button#showHideMenu").trigger("click")
        await wrapper.get("select#appLangSelect").setValue("fr")
        expect((wrapper.get("select#appLangSelect").element as HTMLSelectElement).value).toBe('fr')

        // check that the sections are present and translated:
        let headers = wrapper.findAll(".frame-container-label-span")
        checkTextIs(headers, ["Imports :", "Définitions de fonctions :", "Mon code :"])
    })
})
