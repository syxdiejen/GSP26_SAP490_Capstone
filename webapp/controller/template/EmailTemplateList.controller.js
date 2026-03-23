sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/model/formatter"
], function (Controller, MessageToast, MessageBox, Filter, FilterOperator, JSONModel, formatter) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateList", {
        formatter: formatter,

        onInit: function () {
            const oEmailModel = new JSONModel({
                EmailTemplates: [],
                AllEmailTemplates: []
            });
            this.getView().setModel(oEmailModel, "email");

            this._loadTemplates();
        },

        _loadTemplates: function () {
            const oODataModel = this.getOwnerComponent().getModel();
            const oEmailModel = this.getView().getModel("email");
            const that = this;

            oODataModel.read("/Header", {
                urlParameters: {
                    "$expand": "to_Body,to_Variables",
                    "$format": "json"
                },
                success: function (oData) {
                    const aResults = oData.results || [];
                    const aMapped = aResults.map(function (oItem) {
                        const aBodies = (oItem.to_Body && oItem.to_Body.results) ? oItem.to_Body.results : [];
                        const oFirstBody = aBodies.length > 0 ? aBodies[0] : null;

                        return {
                            DbKey: oItem.DbKey,
                            TemplateId: oItem.TemplateId,
                            TemplateName: oItem.TemplateName,
                            Department: oItem.Department,
                            Category: oItem.Category,
                            IsActive: oItem.IsActive,
                            SenderEmail: oItem.SenderEmail,
                            CreatedBy: oItem.CreatedBy,
                            CreatedOn: oItem.CreatedOn,
                            Subject: that._extractSubject(oFirstBody ? oFirstBody.Content : ""),
                            BodyContent: oFirstBody ? oFirstBody.Content : "",
                            Language: oFirstBody ? oFirstBody.Language : "",
                            Version: oFirstBody ? oFirstBody.Version : "",
                            Variables: (oItem.to_Variables && oItem.to_Variables.results) ? oItem.to_Variables.results : []
                        };
                    });

                    oEmailModel.setProperty("/EmailTemplates", aMapped);
                    oEmailModel.setProperty("/AllEmailTemplates", aMapped);
                },
                error: function () {
                    MessageBox.error("Không tải được dữ liệu template từ backend.");
                }
            });
        },

        _extractSubject: function (sContent) {
            if (!sContent) {
                return "";
            }

            const aLines = sContent.split("\n");
            const sSubjectLine = aLines.find(function (sLine) {
                return sLine && sLine.trim().startsWith("Subject:");
            });

            if (sSubjectLine) {
                return sSubjectLine.replace("Subject:", "").trim();
            }

            return sContent.length > 80 ? sContent.substring(0, 80) + "..." : sContent;
        },

        onItemPress: function (oEvent) {
            const oItem = oEvent.getSource();
            this._navToDetail(oItem.getBindingContext("email"));
        },

        onEditTemplate: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            const oData = oContext.getObject();
            MessageToast.show("Edit template: " + oData.TemplateId);
        },

        onCreateEmail: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("templatecreate");
        },

        onCopyTemplate: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            const oData = oContext.getObject();
            MessageToast.show("Copy template: " + oData.TemplateId);
        },

        onDeleteTemplate: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            const oModel = this.getView().getModel("email");
            const sPath = oContext.getPath();
            const aTemplates = oModel.getProperty("/EmailTemplates").slice();

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

        onToggleActive: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const oContext = oEvent.getSource().getBindingContext("email");
            const oData = oContext.getObject();

            oData.IsActive = bState;
            oContext.getModel().refresh(true);

            MessageToast.show("Template " + oData.TemplateId + " is now " + (bState ? "Active" : "Inactive"));
        },

        onSearch: function (oEvent) {
            const sValue = (oEvent.getParameter("newValue") || "").toLowerCase();
            const oModel = this.getView().getModel("email");
            const aAll = oModel.getProperty("/AllEmailTemplates") || [];

            if (!sValue) {
                oModel.setProperty("/EmailTemplates", aAll);
                return;
            }

            const aFiltered = aAll.filter(function (oItem) {
                return (oItem.TemplateName || "").toLowerCase().includes(sValue) ||
                    (oItem.TemplateId || "").toLowerCase().includes(sValue) ||
                    (oItem.Subject || "").toLowerCase().includes(sValue) ||
                    (oItem.Category || "").toLowerCase().includes(sValue);
            });

            oModel.setProperty("/EmailTemplates", aFiltered);
        },

        onCategoryChange: function (oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oModel = this.getView().getModel("email");
            const aAll = oModel.getProperty("/AllEmailTemplates") || [];

            if (sKey === "ALL") {
                oModel.setProperty("/EmailTemplates", aAll);
                return;
            }

            const aFiltered = aAll.filter(function (oItem) {
                return oItem.Category === sKey;
            });

            oModel.setProperty("/EmailTemplates", aFiltered);
        },

        _navToDetail: function (oContext) {
            const oRouter = this.getOwnerComponent().getRouter();
            const oData = oContext.getObject();

            oRouter.navTo("detail", {
                emailPath: window.encodeURIComponent(oData.DbKey)
            });
        }
    });
});