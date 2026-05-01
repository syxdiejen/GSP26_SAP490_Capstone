sap.ui.define([], function () {
    "use strict";

    function mapHeaderToFormData(oData) {
        var aBodies = (oData.to_Body && oData.to_Body.results) || [];
        var oBody = aBodies[0] || null;

        return {
            templateName: oData.TemplateName || "",
            department: oData.Department || "",
            category: oData.Category || "",
            subject: oData.Subject || "",
            dbKey: oData.DbKey || "",
            isActiveEntity: !!oData.IsActiveEntity,
            bodyDbKey: oBody ? (oBody.DbKey || "") : "",
            bodyLanguage: oBody ? (oBody.Language || "EN") : "EN",
            bodyVersion: oBody ? (oBody.Version || "001") : "001",
            bodyLineType: oBody ? (oBody.LineType || "H") : "H",
            bodyHtml: oBody ? (oBody.Content || "") : ""
        };
    }

    return {
        mapHeaderToFormData: mapHeaderToFormData
    };
});