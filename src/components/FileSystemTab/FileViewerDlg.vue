<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="fileName" size="lg">
        <div class="file-viewer-dlg-body">
            <div v-if="kind === 'loading'" class="file-viewer-dlg-message">{{ $t("fileSystemTab.loading") }}</div>
            <img v-else-if="kind === 'image'" :src="objectUrl" class="file-viewer-dlg-image" :alt="fileName" />
            <audio v-else-if="kind === 'sound'" :src="objectUrl" controls class="file-viewer-dlg-audio" />
            <pre v-else-if="kind === 'text'" class="file-viewer-dlg-text">{{ text }}</pre>
            <div v-else class="file-viewer-dlg-message">
                {{ tooLarge ? $t("fileSystemTab.viewTooLarge") : $t("fileSystemTab.viewUnsupported") }}
            </div>
        </div>
        <template #modal-footer-content="{cancel}">
            <button v-if="kind === 'unsupported'" class="btn btn-secondary" @click="$emit('download')">
                {{ $t("fileSystemTab.download") }}
            </button>
            <button class="btn btn-primary" @click="$emit('closed'); cancel()">
                {{ $t("buttonLabel.close") }}
            </button>
        </template>
    </ModalDlg>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import ModalDlg from "@/components/ModalDlg.vue";

export default defineComponent({
    name: "FileViewerDlg",

    components: {
        ModalDlg,
    },

    props: {
        dlgId: { type: String, required: true },
        fileName: { type: String, required: true },
        kind: { type: String as PropType<"loading" | "image" | "sound" | "text" | "unsupported">, required: true },
        // Only set when kind is "image" or "sound" (an object URL built from the file's bytes --
        // see FileSystemPane.vue's onView()).
        objectUrl: { type: String, default: undefined },
        // Only set when kind is "text".
        text: { type: String, default: undefined },
        // Only meaningful when kind is "unsupported": distinguishes "too large to even try
        // previewing" from "fetched fine, but not a type we know how to render".
        tooLarge: { type: Boolean, default: false },
    },

    emits: ["closed", "download"],
});
</script>

<style lang="scss">
.file-viewer-dlg-body {
    max-height: 60vh;
    overflow: auto;
}

.file-viewer-dlg-image {
    max-width: 100%;
    display: block;
    margin: 0 auto;
}

.file-viewer-dlg-audio {
    display: block;
    width: 100%;
    margin: 1em 0;
}

.file-viewer-dlg-text {
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
}

.file-viewer-dlg-message {
    text-align: center;
    padding: 2em 0;
    opacity: 0.8;
}
</style>
