sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], (UIComponent, JSONModel) => {
    "use strict";
    return UIComponent.extend("zemail.template.app.Component", {
        metadata: {
         interfaces: ["sap.ui.core.IAsyncContentCreation"],
         manifest: "json"
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

         const oModel = new JSONModel();
         oModel.loadData("test/mockData.json")

         this.setModel(oModel);
         
         //create the views based on the url/hash
         this.getRouter().initialize();
        }
    });
});