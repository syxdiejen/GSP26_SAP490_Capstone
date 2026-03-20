sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "zemail/template/app/model/formatter"
], function (Controller, MessageToast, MessageBox, Filter, FilterOperator, formatter) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateList", {
        formatter: formatter,

        onInit: function () {
        },

        onItemPress: function (oEvent) {
            const oItem = oEvent.getSource();
            this._navToDetail(oItem.getBindingContext("email"));
        },

        onEditTemplate: function () {
            MessageToast.show("Edit template - demo later");
        },

        onCreateEmail: function () {
            MessageToast.show("Create new template - demo later");
        },

        onCopyTemplate: function () {
            MessageToast.show("Copy template - demo later");
        },

        onDeleteTemplate: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            const oModel = this.getView().getModel("email");
            const sPath = oContext.getPath();
            const aTemplates = oModel.getProperty("/EmailTemplates");

            MessageBox.confirm("Delete this template?", {
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        const iIndex = parseInt(sPath.split("/").pop(), 10);
                        aTemplates.splice(iIndex, 1);
                        oModel.setProperty("/EmailTemplates", aTemplates);
                        MessageToast.show("Template deleted");
                    }
                }
            });
        },

        onSearch: function (oEvent) {
            const sValue = oEvent.getParameter("newValue");
            const oTable = this.byId("emailTemplateTable");
            const oBinding = oTable.getBinding("items");
            const aFilters = [];

            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Name", FilterOperator.Contains, sValue),
                        new Filter("Subject", FilterOperator.Contains, sValue),
                        new Filter("Status", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }

            oBinding.filter(aFilters);
        },

        _navToDetail: function (oContext) {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("detail", {
                emailPath: window.encodeURIComponent(
                    oContext.getPath().substring(1)
                )
            });
        }
    });
});