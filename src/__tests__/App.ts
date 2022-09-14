import { PiniaVuePlugin } from 'pinia'
import { createLocalVue, mount } from "@vue/test-utils"
import { createTestingPinia } from '@pinia/testing'
import App from "../App.vue"
import i18n from "../i18n"


describe("App.vue Basic Test", () => {
    it("has correct frame containers", () => {
        const localVue = createLocalVue()
        localVue.use(PiniaVuePlugin)
        const wrapper = mount(App, {
            localVue,
            i18n,
            pinia: createTestingPinia(),
        })

        // check that the sections are present and correct:
        let headers = wrapper.findAll(".frame-container-label-span")
        expect(headers.length).toBe(3)
        expect(headers.at(0).text()).toBe("Imports:")
        expect(headers.at(1).text()).toBe("Function definitions:")
        expect(headers.at(2).text()).toBe("My code:")
    })
})