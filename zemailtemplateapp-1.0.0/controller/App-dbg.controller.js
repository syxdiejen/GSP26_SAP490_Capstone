sap.ui.define([
    "sap/ui/core/mvc/Controller",

], (Controller) => {
    "use strict";
    return Controller.extend("zemail.template.app.controller.App", {
            onItemSelect: function (oEvent) {
                const sKey = oEvent.getParameter("item").getKey();
                const oRouter = this.getOwnerComponent().getRouter();

                oRouter.navTo(sKey);
            }
        }
)
})