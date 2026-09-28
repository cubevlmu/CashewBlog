import { createApp } from "vue";
import PrimeVue from "primevue/config";
import { adminPreset } from "./theme";
import "./utilities.css";
import ConfirmationService from "primevue/confirmationservice";
import "primeicons/primeicons.css";
import App from "./App.vue";
import Field from "./components/Field.vue";
import { router } from "./router";
import { onUnauthorized } from "./api/http";
import { session } from "./state";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
import Button from "primevue/button";
import Card from "primevue/card";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Password from "primevue/password";
import Tag from "primevue/tag";
import Toolbar from "primevue/toolbar";
import Panel from "primevue/panel";
import Fieldset from "primevue/fieldset";
import Fluid from "primevue/fluid";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import ToggleSwitch from "primevue/toggleswitch";
import Dialog from "primevue/dialog";
import ConfirmDialog from "primevue/confirmdialog";
import Steps from "primevue/steps";
import FileUpload from "primevue/fileupload";
import Image from "primevue/image";
import OrderList from "primevue/orderlist";
import SelectButton from "primevue/selectbutton";

const app = createApp(App);
app.use(PrimeVue, {
  locale: {
    accept: "确定",
    reject: "取消",
    choose: "选择",
    upload: "上传",
    cancel: "取消",
    emptyMessage: "暂无数据",
    emptySelectionMessage: "未选择",
    emptySearchMessage: "无匹配结果",
    searchMessage: "{0} 个结果",
    selectionMessage: "已选择 {0} 项",
    weak: "弱",
    medium: "中",
    strong: "强",
    passwordPrompt: "请输入密码",
  },
  theme: {
    preset: adminPreset,
    options: {
      darkModeSelector: ".admin-dark",
      cssLayer: { name: "primevue", order: "theme, base, primevue, utilities" },
    },
  },
});
app.use(ConfirmationService);
app.component("Field", Field);
app.component("Splitter", Splitter);
app.component("SplitterPanel", SplitterPanel);
app.component("Button", Button);
app.component("Card", Card);
app.component("Column", Column);
app.component("DataTable", DataTable);
app.component("InputText", InputText);
app.component("Message", Message);
app.component("Password", Password);
app.component("Tag", Tag);
app.component("Toolbar", Toolbar);
app.component("Panel", Panel);
app.component("Fieldset", Fieldset);
app.component("Fluid", Fluid);
app.component("Select", Select);
app.component("MultiSelect", MultiSelect);
app.component("Textarea", Textarea);
app.component("InputNumber", InputNumber);
app.component("ToggleSwitch", ToggleSwitch);
app.component("Dialog", Dialog);
app.component("ConfirmDialog", ConfirmDialog);
app.component("Steps", Steps);
app.component("FileUpload", FileUpload);
app.component("Image", Image);
app.component("OrderList", OrderList);
app.component("SelectButton", SelectButton);
onUnauthorized(() => {
  session.value = { authenticated: false, name: null, expiresAt: null };
  void router.push({
    path: "/admin/login",
    query: { next: router.currentRoute.value.fullPath },
  });
});
app.use(router).mount("#app");
