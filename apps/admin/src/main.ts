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
import ButtonGroup from "primevue/buttongroup";
import Card from "primevue/card";
import Checkbox from "primevue/checkbox";
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
import Breadcrumb from "primevue/breadcrumb";
import Stepper from "primevue/stepper";
import Step from "primevue/step";
import StepList from "primevue/steplist";
import StepPanel from "primevue/steppanel";
import StepPanels from "primevue/steppanels";
import SidebarLayout from "primevue/sidebarlayout";
import Sidebar from "primevue/sidebar";
import SidebarAside from "primevue/sidebaraside";
import SidebarBackdrop from "primevue/sidebarbackdrop";
import SidebarContent from "primevue/sidebarcontent";
import SidebarFooter from "primevue/sidebarfooter";
import SidebarGroup from "primevue/sidebargroup";
import SidebarGroupContent from "primevue/sidebargroupcontent";
import SidebarGroupLabel from "primevue/sidebargrouplabel";
import SidebarHeader from "primevue/sidebarheader";
import SidebarMain from "primevue/sidebarmain";
import SidebarMenu from "primevue/sidebarmenu";
import SidebarMenuButton from "primevue/sidebarmenubutton";
import SidebarMenuItem from "primevue/sidebarmenuitem";
import SidebarMenuSub from "primevue/sidebarmenusub";
import SidebarMenuSubButton from "primevue/sidebarmenusubbutton";
import SidebarMenuSubItem from "primevue/sidebarmenusubitem";
import SidebarPanel from "primevue/sidebarpanel";
import SidebarRail from "primevue/sidebarrail";
import SidebarSpacer from "primevue/sidebarspacer";
import SidebarTrigger from "primevue/sidebartrigger";
import FileUpload from "primevue/fileupload";
import Image from "primevue/image";
import OrderList from "primevue/orderlist";
import Paginator from "primevue/paginator";
import SelectButton from "primevue/selectbutton";
import AutoComplete from "primevue/autocomplete";
import Divider from "primevue/divider";
import DatePicker from "primevue/datepicker";

const app = createApp(App);
app.use(PrimeVue, {
  license: import.meta.env.VITE_PRIMEUI_LICENSE?.trim() || undefined,
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
app.component("ButtonGroup", ButtonGroup);
app.component("Card", Card);
app.component("Checkbox", Checkbox);
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
app.component("Breadcrumb", Breadcrumb);
app.component("Stepper", Stepper);
app.component("Step", Step);
app.component("StepList", StepList);
app.component("StepPanel", StepPanel);
app.component("StepPanels", StepPanels);
app.component("SidebarLayout", SidebarLayout);
app.component("Sidebar", Sidebar);
app.component("SidebarAside", SidebarAside);
app.component("SidebarBackdrop", SidebarBackdrop);
app.component("SidebarContent", SidebarContent);
app.component("SidebarFooter", SidebarFooter);
app.component("SidebarGroup", SidebarGroup);
app.component("SidebarGroupContent", SidebarGroupContent);
app.component("SidebarGroupLabel", SidebarGroupLabel);
app.component("SidebarHeader", SidebarHeader);
app.component("SidebarMain", SidebarMain);
app.component("SidebarMenu", SidebarMenu);
app.component("SidebarMenuButton", SidebarMenuButton);
app.component("SidebarMenuItem", SidebarMenuItem);
app.component("SidebarMenuSub", SidebarMenuSub);
app.component("SidebarMenuSubButton", SidebarMenuSubButton);
app.component("SidebarMenuSubItem", SidebarMenuSubItem);
app.component("SidebarPanel", SidebarPanel);
app.component("SidebarRail", SidebarRail);
app.component("SidebarSpacer", SidebarSpacer);
app.component("SidebarTrigger", SidebarTrigger);
app.component("FileUpload", FileUpload);
app.component("Image", Image);
app.component("OrderList", OrderList);
app.component("Paginator", Paginator);
app.component("SelectButton", SelectButton);
app.component("AutoComplete", AutoComplete);
app.component("Divider", Divider);
app.component("DatePicker", DatePicker);
onUnauthorized(() => {
  session.value = { authenticated: false, name: null, expiresAt: null };
  void router.push({
    path: "/admin/login",
    query: { next: router.currentRoute.value.fullPath },
  });
});
app.use(router).mount("#app");
