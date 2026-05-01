sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    function getDefaultData() {
        return {
            mode: "create",
            title: "Create Email Template",

            templateName: "",
            department: "",
            category: "",
            subject: "",
            senderEmail: "",

            dbKey: "",
            bodyDbKey: "",
            isActiveEntity: false,
            isDraftCreated: false,
            busy: false,

            editorMode: "RTE",

            bodyLanguage: "EN",
            bodyVersion: "001",
            bodyLineType: "H",
            bodyHtml: "",
            bodyPreview: "",

            availableVariables: [],
            usedVariables: [],
            previewHtml: ""
        };
    }

    return {
        createViewModel: function () {
            return new JSONModel(getDefaultData());
        },

        resetForm: function (oModel) {
            var aAvailableVariables = oModel.getProperty("/availableVariables") || [];
            var oData = getDefaultData();

            oData.availableVariables = aAvailableVariables;
            oModel.setData(oData);
        }
    };
});