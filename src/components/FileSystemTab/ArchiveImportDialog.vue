<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="$t('fileSystemTab.archiveDialogTitle')">
        <span>{{ $t("fileSystemTab.archiveDialogMessage", {name: fileName}) }}</span>
        <template #modal-footer-content="{cancel}">
            <button class="btn btn-secondary" @click="$emit('cancelled'); cancel()">
                {{ $t("buttonLabel.cancel") }}
            </button>
            <button class="btn btn-secondary" @click="$emit('keep-zip'); cancel()">
                {{ $t("fileSystemTab.keepAsZip") }}
            </button>
            <button class="btn btn-primary" @click="$emit('unzip'); cancel()">
                {{ $t("fileSystemTab.unzipContents") }}
            </button>
        </template>
    </ModalDlg>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import ModalDlg from "@/components/ModalDlg.vue";

export default defineComponent({
    name: "ArchiveImportDialog",

    components: {
        ModalDlg,
    },

    props: {
        dlgId: { type: String, required: true },
        fileName: { type: String, required: true },
    },

    emits: ["keep-zip", "unzip", "cancelled"],
});
</script>
