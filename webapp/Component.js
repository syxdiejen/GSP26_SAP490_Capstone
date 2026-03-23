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

            const oLocalModel = new JSONModel();
            oLocalModel.loadData("test/mockData.json");
            this.setModel(oLocalModel, "local");
         
             //create the views based on the url/hash
             this.getRouter().initialize();
        }
    });
});