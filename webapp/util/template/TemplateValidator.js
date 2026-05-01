sap.ui.define([
    "zemail/template/app/util/template/TemplateNormalizer"
], function (TemplateNormalizer) {
    "use strict";

    function validateForm(oData) {
        var sTemplateName = TemplateNormalizer.trim(oData.templateName);
        var sSenderEmail = TemplateNormalizer.trim(oData.senderEmail);
        var sBodyHtml = String(oData.bodyHtml || "");

        var sVersion = TemplateNormalizer.normalizeVersion(oData.bodyVersion);
        var sLineType = TemplateNormalizer.normalizeLineType(oData.bodyLineType);
        var sLanguage = TemplateNormalizer.normalizeLanguage(oData.bodyLanguage);

        if (!sTemplateName) {
            return {
                valid: false,
                messageKey: "templateNameRequired"
            };
        }

        if (sSenderEmail && !TemplateNormalizer.isValidEmail(sSenderEmail)) {
            return {
                valid: false,
                messageKey: "templateSenderEmailInvalid"
            };
        }

        if (!sLanguage) {
            return {
                valid: false,
                messageKey: "templateLanguageRequired"
            };
        }

        if (!sVersion) {
            return {
                valid: false,
                messageKey: "templateVersionRequired"
            };
        }

        if (TemplateNormalizer.trim(oData.bodyVersion).length > 3) {
            return {
                valid: false,
                messageKey: "templateVersionMaxLength"
            };
        }

        if (!sLineType) {
            return {
                valid: false,
                messageKey: "templateLineTypeRequired"
            };
        }

        if (TemplateNormalizer.trim(oData.bodyLineType).length !== 1) {
            return {
                valid: false,
                messageKey: "templateLineTypeExactLength"
            };
        }

        if (!sBodyHtml.trim()) {
            return {
                valid: false,
                messageKey: "templateBodyHtmlRequired"
            };
        }

        return {
            valid: true
        };
    }

    function isBasicInfoValid(oData) {
        return !!(
            TemplateNormalizer.trim(oData.templateName) &&
            TemplateNormalizer.trim(oData.department) &&
            TemplateNormalizer.trim(oData.category)
        );
    }

    return {
        validateForm: validateForm,
        isBasicInfoValid: isBasicInfoValid
    };
});