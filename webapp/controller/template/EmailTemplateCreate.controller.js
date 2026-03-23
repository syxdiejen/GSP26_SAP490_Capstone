sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateCreate", {
        onInit: function () {
            const oModel = new JSONModel({
                name: "",
                category: "Sales",
                subject: "",
                description: "",
                editorMode: "HTML",
                contentHtml: "",
                previewHtml: "",
                testEmail: "",
                availableVariables: [
                    { label: "Customer Name", token: "&CUSTOMER_NAME&" },
                    { label: "Order ID", token: "&ORDER_ID&" },
                    { label: "Order Date", token: "&ORDER_DATE&" },
                    { label: "Company Name", token: "&COMPANY_NAME&" }
                ],
                usedVariables: []
            });

            this.getView().setModel(oModel, "create");
        },

        onInsertVariable: function (oEvent) {
            const oItem = oEvent.getSource();
            const sToken = oItem.getBindingContext("create").getProperty("token");
            const oModel = this.getView().getModel("create");
            const sContent = oModel.getProperty("/contentHtml") || "";

            // Demo đơn giản: append cuối nội dung
            // Muốn chuẩn hơn thì cần lấy caret position trong editor
            oModel.setProperty("/contentHtml", sContent + sToken);

            MessageToast.show("Inserted " + sToken);
        },

        onScanVariables: function () {
            const oModel = this.getView().getModel("create");
            const sContent = oModel.getProperty("/contentHtml") || "";
            const sSubject = oModel.getProperty("/subject") || "";
            const sAll = sSubject + " " + sContent;

            const aMatches = [...sAll.matchAll(/&([A-Z0-9_]+)&/g)];
            const aUnique = [...new Set(aMatches.map(function (m) {
                return m[1];
            }))];

            const aVariables = aUnique.map(function (sName) {
                return {
                    name: sName,
                    description: "Detected from template content"
                };
            });

            oModel.setProperty("/usedVariables", aVariables);

            if (aVariables.length) {
                MessageToast.show("Found " + aVariables.length + " variables");
            } else {
                MessageToast.show("No variables found");
            }
        },

        onPreview: function () {
            const oModel = this.getView().getModel("create");
            const sHtml = oModel.getProperty("/contentHtml") || "";

            // Demo: preview trực tiếp
            // Thực tế nên sanitize HTML trước khi render
            oModel.setProperty("/previewHtml", sHtml);
            MessageToast.show("Preview updated");
        },

        onSendTestMail: function () {
            const oModel = this.getView().getModel("create");
            const sEmail = oModel.getProperty("/testEmail");

            if (!sEmail) {
                MessageBox.warning("Please enter a test email address");
                return;
            }

            MessageToast.show("Test mail sent to " + sEmail + " (demo)");
        },

        onSaveDraft: function () {
            const oPayload = this._buildPayload(false);
            console.log("Draft payload", oPayload);
            MessageToast.show("Template draft saved");
        },

        onSaveActivate: function () {
            const oPayload = this._buildPayload(true);
            console.log("Active payload", oPayload);
            MessageToast.show("Template saved and activated");
        },

        _buildPayload: function (bActive) {
            const oModel = this.getView().getModel("create");

            return {
                NAME: oModel.getProperty("/name"),
                CATEGORY: oModel.getProperty("/category"),
                SUBJECT: oModel.getProperty("/subject"),
                DESCRIPTION: oModel.getProperty("/description"),
                CONTENT_HTML: oModel.getProperty("/contentHtml"),
                VARIABLES: oModel.getProperty("/usedVariables").map(function (oVar) {
                    return oVar.name;
                }),
                ACTIVE: bActive
            };
        }
    });
});