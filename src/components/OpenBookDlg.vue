<template>
    <ModalDlg
        :dlgId="dlgId"
        :dlg-title="$t('book.dialogTitle')"
        showCloseBtn
        css-class="open-book-dlg"
        :okCustomTitle="$t('buttonLabel.choose')"
        :ok-disabled="!(selectedChapterIndex >= 0 && selectedChapterIndex < chapters.length && selectedChapterProjectIndex >= 0 && selectedChapterProjectIndex < projectsInCurrentChapter.length)" >
        <div>
            <h1>Creative Python Programming with Strype</h1>
            <p>
                Strype has an accompanying <a href="https://strype.org/book/" target="_blank">textbook with a free preview version</a>.  From here you can open the projects described in the book.
            </p>
        </div>
        <div class="d-flex" style="height: 400px;border-top: #aaa solid 1px; padding-top: 1rem;">
            <!-- Left Pane: List Group -->
            <BListGroup class="flex-column" style="width: 30% !important;">
                <BListGroupItem
                    v-for="(item, index) in chapters"
                    :key="index"
                    :active="selectedChapterIndex === index && chapters.length > 1"
                    button
                    class="open-book-dlg-book-group-item"
                >
                    {{ item.name }}
                </BListGroupItem>
            </BListGroup>

            <!-- Right Pane: Dynamic Grid -->
            <div class="flex-grow-1 p-3 overflow-auto">
                <div class="d-flex flex-column">
                    <button
                        v-for="(item, i) in projectsInCurrentChapter"
                        :key="i"
                        :class="{'d-flex': true, 'open-book-dlg-book-item': true, 'open-book-dlg-selected-book-item': selectedChapterProjectIndex === i}"
                        type="button"
                        @click="selectedChapterProjectIndex = i"
                        @dblclick="onDblClick"
                        @keydown.space.self="selectedChapterProjectIndex = i"
                    >
                        <!-- 1x1 transparent image if image is missing: -->
                        <img :src="item.imgURL || 'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='" alt="Preview" class="open-book-dlg-preview flex-shrink-0"/>
                        <div class="d-flex flex-column flex-fill">
                            <span class="open-book-dlg-name">{{item.name}}</span>
                            <span class="open-book-dlg-description" v-html="item.description" />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    </ModalDlg>
</template>

<script setup lang="ts">
import {nextTick, onMounted, ref} from "vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { BListGroup, BListGroupItem } from "bootstrap-vue-next";
import { eventBus } from "@/helpers/appContext";
import { CustomEventTypes } from "@/helpers/editor";
import {Demo, getBuiltinDemos} from "@/helpers/demos";

interface Chapter {
    name: string;
    projects: Promise<Demo[]>;
}

const chapters: Chapter[] = [
    {name: "Chapter 1", projects: getBuiltinDemos("book_projects/chapter01")},
    {name: "Chapter 2", projects: getBuiltinDemos("book_projects/chapter02")},
];

const props = defineProps<{
    dlgId: string;
}>();

const selectedChapterIndex = ref(0);
const selectedChapterProjectIndex = ref(0);
const projectsInCurrentChapter = ref<{ name: string, description: string | undefined, imgURL: string | undefined, projectFile: () => Promise<string | undefined> }[]>([]);

onMounted(() => {
    // It seems that Vue Bootstrap Next do not exposes @click on BListGroupItem therefore we cannot register anything on our items' click event, it will be ignored.
    // Instead, once this component is mounted we manually register the click events here.
    nextTick(() => document.querySelectorAll(".open-book-dlg-book-group-item").forEach((el, index) => {
        el.addEventListener("click", () => changeBookDialogCategory(index));
    }));
});

async function changeBookDialogCategory(index: number) {
    selectedChapterIndex.value = index;
    projectsInCurrentChapter.value = [];
    const r = [];
    // Note async: will run each in background
    const projects = await chapters[index].projects;
    for (const proj of projects) {
        let img: Promise<string | undefined>;
        if ("dataURL" in proj.image) {
            img = proj.image.dataURL;
        }
        else if ("imgURL" in proj.image) {
            img = Promise.resolve(proj.image.imgURL);
        }
        else {
            img = Promise.resolve<string | undefined>(undefined);
        }
        const details = {
            name: proj.name,
            description: proj.description,
            imgURL: undefined as (string | undefined),
            projectFile: proj.demoFile,
        };
        r.push(details);
        img.then((url) => {
            details.imgURL = url;
        });
    }
    projectsInCurrentChapter.value = r;
}

function shown() {
    changeBookDialogCategory(0);
}

function getSelectedProject(): ({ name: string, chapter: string, projectFile: Promise<string | undefined> } | undefined) {
    if (selectedChapterProjectIndex.value >= 0 && selectedChapterProjectIndex.value < projectsInCurrentChapter.value.length) {
        const d = projectsInCurrentChapter.value[selectedChapterProjectIndex.value];
        return { name: d.name, projectFile: d.projectFile(), chapter: chapters[selectedChapterIndex.value].name };
    }
    return undefined;
}

function onDblClick() {
    // Triggers the modal's OK event to load the selected example. The click event is fired before the double-click event:
    // selectedBookItemIndex is already set to the right value.
    // We first close the dialog, than simulate a "close with action" in the Menu (since we can't close with "OK" status.)
    eventBus.emit(CustomEventTypes.hideStrypeModal, { trigger: "ok", componentId: props.dlgId });
}

defineExpose({getSelectedProject, shown});
</script>
<style>
.open-book-dlg > .modal-dialog {
    width: auto; /* important to let content control size */
    min-width: min(800px, 80vw);
}

.open-book-dlg-book-item {
    padding: 10px 20px 10px 20px;
    background-color: white;
    border: 0px;
    text-align: left;
}

.open-book-dlg-book-item:hover {
    background-color: #f8f9fa;
}

.open-book-dlg-selected-book-item, .open-book-dlg-selected-book-item:hover {
    background-color: #007bff;
}

img.open-book-dlg-preview {
    width: 120px;
    height: 100px;
    object-fit: contain;
    display: block;
    margin-right: 30px;
}

span.open-book-dlg-name {
    font-weight: bold;
    font-size: 125%;
}

.open-book-dlg-selected-book-item span.open-book-dlg-name {
    color: white;
}

span.open-book-dlg-description {
    color: #777;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2; /* 2 lines of text at most */
    -webkit-box-orient: vertical;
}

.open-book-dlg-selected-book-item span.open-book-dlg-description {
    color: #eee;
}

.open-book-dlg-selected-book-item span.open-book-dlg-description a {
    color: white;
}

.open-book-dlg-book-group-item {
    --bs-list-group-item-padding-x:1.25rem;
    --bs-list-group-item-padding-y:0.75rem;
}

.open-book-dlg-add-library-panel input {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
