<template>
    <b-modal
        v-if="showModal"
        v-bind:visible="showModal"
        hide-footer
        size="xl"
        @close="close()"
    >
        <img
            class="w-100" 
            v-bind:src="image"
        />
    </b-modal>
    <div
        v-else 
        class="message-banner-container"
    >
        <span 
            v-if="message.message"
            v-t="message.message"></span>
        <span class="message-banner-cross" v-on:click="close">&#x2716;</span>
        
        <br/>
        <button 
            v-for="(button,index) in message.buttons"
            v-bind:key="'messageButton-'+index"
            v-on:click="onButtonClick(button.action)"
            v-t="button.label">
        </button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import { MessageDefinedActions, MessageDefinitions, MessageDefinition, MessageTypes, DefaultFormattedMessage} from "@/types/types";

export default Vue.extend({
    name: "MessageBanner",
    store,

    data() {
        return {
            image: "" as string,
        };
    },

    created() {
        this.image = require("@/assets/images/"+this.message.path);
    },
    //Updated is needed in case one message pops and before its gone another is shown
    updated() {
        this.image = require("@/assets/images/"+this.message.path);
    },

    computed: {
        message(): MessageDefinition {
            return store.getters.getCurrentMessage();
        },

        showModal(): boolean{
            return this.message.type === MessageTypes.imageDisplay
        },
    },

    methods: {
        close(): void {
            store.dispatch("setMessageBanner", MessageDefinitions.NoMessage);
        },
        onButtonClick(payload: VoidFunction | string){
            // If the type of the action associated with this button is a function
            // we run this function. If the type is string then we run a predefined action. 
            if((typeof payload) === "function"){
                (payload as VoidFunction)();
            }
            else{
                switch(payload){
                case MessageDefinedActions.closeBanner:
                    store.dispatch("setMessageBanner", MessageDefinitions.NoMessage);
                    break;
                case MessageDefinedActions.undo:
                    store.commit(
                        "applyStateUndoRedoChanges",
                        true
                    );
                    break;
                default:
                    break;
                }
            }
        },
    },
});
</script>

<style lang="scss">
.message-banner-container {
    display: inline-block;
    width: 100%;
    background-color: #BBBBBB;
    padding:5px;
}

.message-banner-cross {
    float: right;
    margin-right:15px;
    cursor:pointer;
}
</style>
