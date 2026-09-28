import { ref } from "vue";
import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";

export const adminPreset = definePreset(Aura, {
  semantic: {
    primary: Object.fromEntries(
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((level) => [
        level,
        `{orange.${level}}`,
      ]),
    ),
  },
});
export const dark = ref(localStorage.getItem("cashew-admin-theme") === "dark");
document.documentElement.classList.toggle("admin-dark", dark.value);
export function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("admin-dark", dark.value);
  localStorage.setItem("cashew-admin-theme", dark.value ? "dark" : "light");
}
