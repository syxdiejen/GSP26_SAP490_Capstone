sap.ui.define([], function () {
    "use strict";

    function trim(vValue) {
        return String(vValue || "").trim();
    }

    function normalizeLanguage(vLanguage) {
        return trim(vLanguage).toUpperCase().slice(0, 2);
    }

    function normalizeVersion(vVersion) {
        return trim(vVersion).slice(0, 3);
    }

    function normalizeLineType(vLineType) {
        return trim(vLineType).toUpperCase().slice(0, 1);
    }

    function isValidEmail(sEmail) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(sEmail));
    }

    function buildHeaderPayload(oData) {
        var sSenderEmail = trim(oData.senderEmail);

        var oPayload = {
            TemplateName: trim(oData.templateName),
            Department: trim(oData.department),
            Category: trim(oData.category),
            Subject: trim(oData.subject),
            IsActive: false
        };

        if (sSenderEmail) {
            oPayload.SenderEmail = sSenderEmail;
        }

        return oPayload;
    }

    function buildBodyPayload(oData) {
        return {
            Language: normalizeLanguage(oData.bodyLanguage),
            Version: normalizeVersion(oData.bodyVersion),
            LineType: normalizeLineType(oData.bodyLineType),
            Content: String(oData.bodyHtml || "")
        };
    }

    return {
        trim: trim,
        normalizeLanguage: normalizeLanguage,
        normalizeVersion: normalizeVersion,
        normalizeLineType: normalizeLineType,
        isValidEmail: isValidEmail,
        buildHeaderPayload: buildHeaderPayload,
        buildBodyPayload: buildBodyPayload
    };
});