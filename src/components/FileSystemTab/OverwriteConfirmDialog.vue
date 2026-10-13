<!-- Shown when an upload into "/local" would overwrite an existing file of the same name, asking
     the user to confirm or cancel -- see FileSystemPane.vue's proceedWithUpload(). -->
<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="$t('fileSystemTab.overwriteDialogTitle')">
        <span>{{ $t("fileSystemTab.overwriteDialogMessage", {name: fileName}) }}</span>
        <template #modal-footer-content="{cancel}">
            <button class="btn btn-secondary" @click="$emit('cancelled'); cancel()">
                {{ $t("buttonLabel.cancel") }}
            </button>
            <button class="btn btn-primary" @click="$emit('overwrite'); cancel()">
                {{ $t("fileSystemTab.overwrite") }}
            </button>
        </template>
    </ModalDlg>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import ModalDlg from "@/components/ModalDlg.vue";

export default defineComponent({
    name: "OverwriteConfirmDialog",

    components: {
        ModalDlg,
    },

    props: {
        dlgId: { type: String, required: true },
        fileName: { type: String, required: true },
    },

    emits: ["overwrite", "cancelled"],
});
</script>
