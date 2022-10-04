// This import appears unused but breaks the build if you remove it:
import Vue from "vue"; // eslint-disable-line @typescript-eslint/no-unused-vars
declare module "vue/types/vue" {
  interface VueConstructor {
    $confirm: any;
  }
}
