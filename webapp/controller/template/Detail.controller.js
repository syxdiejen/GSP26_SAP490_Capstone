sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "zemail/template/app/model/formatter"
], (Controller, History, formatter) => {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.Detail", {
        formatter: formatter,
        onInit() {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("detail").attachPatternMatched(this.onObjectMatched, this);
        },

        onObjectMatched(oEvent) {
            const sPath = window.decodeURIComponent(
                oEvent.getParameter("arguments").emailPath
            );

            this.getView().bindElement({
                path: "/" + sPath,
                model: "email"
            });
        },

        onNavBack() {
            const sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("templatelist", {}, true);
            }
        },

        onPreviewModeChange(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oWrapper = this.byId("previewWrapper");

            oWrapper.removeStyleClass("previewDesktop");
            oWrapper.removeStyleClass("previewTablet");
            oWrapper.removeStyleClass("previewMobile");

            if (sKey === "tablet") {
                oWrapper.addStyleClass("previewTablet");
            } else if (sKey === "mobile") {
                oWrapper.addStyleClass("previewMobile");
            } else {
                oWrapper.addStyleClass("previewDesktop");
            }
        }
    });
});